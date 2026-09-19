/**
 * ChatMize MCP tool implementations (v1, BETA).
 *
 * Every tool receives a ToolContext carrying the workspace resolved from
 * the caller's API key. ALL Firestore access is scoped to
 * workspaces/{workspaceId} — nothing outside the key's workspace is
 * reachable. Contacts live in the root `contacts` collection, so contact
 * tools prove workspace membership through the workspace's conversations.
 *
 * Sends go through the exact production pipelines (channelSend.ts,
 * smsSend.ts, smsBroadcast.ts) — nothing is reinvented here.
 */
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { sendChannelMessageInternal, ChannelSendError } from "../channelSend";
import { sendSmsInternal, SmsSendError } from "../smsSend";
import { runSmsBroadcastInternal, SmsBroadcastError } from "../smsBroadcast";
import { executeWebhookAction } from "../flowWebhook";
import {
  appendSheetsRow,
  readSheetsRows,
  listSheetsTabs,
  resolveSpreadsheetId,
} from "../googleSheets";
import { sanitizeVariableName, assertVariableNameAllowed } from "../flowVariables";
import type { VerifiedKey } from "./auth";

const db = () => getFirestore("chatmize-prod");

export interface ToolContext {
  key: VerifiedKey;
  workspaceId: string;
}

const CONVERSATIONS_PAGE_MAX = 100;
const MESSAGES_PAGE_MAX = 200;

type ConversationSummary = {
  conversationId: string;
  channel: string;
  senderId: string;
  lastMessageText: string;
  lastMessageAt: string | null;
};

function tsToIso(v: unknown): string | null {
  if (!v) return null;
  if (typeof v === "number") return new Date(v).toISOString();
  if (typeof (v as { toDate?: unknown }).toDate === "function") {
    return (v as { toDate: () => Date }).toDate().toISOString();
  }
  return null;
}

/** list_conversations: recent threads in this workspace, newest first. */
export async function listConversations(
  ctx: ToolContext,
  args: { channel?: string; limit?: number },
): Promise<ConversationSummary[]> {
  const limit = Math.min(Math.max(args.limit ?? 20, 1), CONVERSATIONS_PAGE_MAX);
  let q = db()
    .collection("workspaces")
    .doc(ctx.workspaceId)
    .collection("conversations")
    .orderBy("lastMessageAt", "desc")
    .limit(limit);
  if (args.channel) {
    q = q.where("channel", "==", args.channel) as typeof q;
  }
  const snap = await q.get();
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      conversationId: d.id,
      channel: String(data.channel ?? ""),
      senderId: String(data.senderId ?? ""),
      lastMessageText: String(data.lastMessageText ?? ""),
      lastMessageAt: tsToIso(data.lastMessageAt),
    };
  });
}

type MessageView = {
  messageId: string;
  direction: string;
  channel: string;
  senderId: string;
  text: string;
  timestampMs: number | null;
  ok: boolean | null;
  error: string | null;
};

/** read_conversation: message history for one thread, oldest first. */
export async function readConversation(
  ctx: ToolContext,
  args: { conversationId: string; limit?: number },
): Promise<MessageView[]> {
  if (!args.conversationId) throw new Error("conversationId is required.");
  const limit = Math.min(Math.max(args.limit ?? 50, 1), MESSAGES_PAGE_MAX);
  const snap = await db()
    .collection("workspaces")
    .doc(ctx.workspaceId)
    .collection("conversations")
    .doc(args.conversationId)
    .collection("messages")
    .orderBy("timestampMs", "asc")
    .limit(limit)
    .get();
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      messageId: d.id,
      direction: String(data.direction ?? ""),
      channel: String(data.channel ?? ""),
      senderId: String(data.senderId ?? ""),
      text: String(data.text ?? ""),
      timestampMs: typeof data.timestampMs === "number" ? data.timestampMs : null,
      ok: typeof data.ok === "boolean" ? data.ok : null,
      error: typeof data.error === "string" ? data.error : null,
    };
  });
}

/**
 * Resolve a send target. Accepts either an explicit recipient (PSID / IGSID /
 * WhatsApp number / E.164 phone for SMS) or a conversationId from this
 * workspace, from which the recipient is derived.
 */
async function resolveSendTarget(
  ctx: ToolContext,
  args: { channel: string; recipientId?: string; conversationId?: string },
): Promise<{ channel: string; recipientId: string }> {
  const channel = args.channel;
  if (!["messenger", "instagram", "whatsapp", "sms"].includes(channel)) {
    throw new Error("channel must be one of: messenger, instagram, whatsapp, sms.");
  }
  if (args.recipientId) return { channel, recipientId: args.recipientId };
  if (args.conversationId) {
    const convo = await db()
      .collection("workspaces")
      .doc(ctx.workspaceId)
      .collection("conversations")
      .doc(args.conversationId)
      .get();
    if (!convo.exists) throw new Error("Conversation not found in this workspace.");
    const data = convo.data() as { channel?: string; senderId?: string };
    if (!data.senderId) throw new Error("Conversation has no recipient to reply to.");
    return { channel: String(data.channel ?? channel), recipientId: data.senderId };
  }
  throw new Error("Provide recipientId or conversationId.");
}

/**
 * send_message: one outbound message through the workspace's real, connected
 * channels — the exact production send pipelines, including token self-heal,
 * personalization tag resolution, opt in enforcement (SMS), billing, and
 * single-writer persistence.
 */
export async function sendMessage(
  ctx: ToolContext,
  args: { channel: string; recipientId?: string; conversationId?: string; text?: string; mediaUrl?: string; mediaType?: "video" | "audio" | "image"; quickReplies?: string[]; contactCaptureFields?: Array<"phone" | "email">; contactCaptureMode?: "quick_reply" | "free_text" | "both"; variableCapture?: { variable: string; varType?: "text" | "number" | "date" } },
): Promise<{ ok: boolean; messageId: string | null; channel: string; recipientId: string }> {
  const hasCapture = !!args.contactCaptureFields?.length;
  const hasVariableCapture = !!args.variableCapture?.variable;
  if ((!args.text || !args.text.trim()) && !args.mediaUrl && !hasCapture && !hasVariableCapture && !(args.quickReplies?.length)) throw new Error("Provide text, a media attachment, quick replies, a contact capture, or a variable capture.");
  if (args.text && args.text.length > 1600) throw new Error("text is too long (max 1600 characters).");
  if (args.mediaUrl && !["video", "audio", "image"].includes(args.mediaType ?? "")) {
    throw new Error("mediaType must be video, audio, or image.");
  }
  if (args.quickReplies !== undefined && (!Array.isArray(args.quickReplies) || args.quickReplies.some((q) => typeof q !== "string"))) {
    throw new Error("quickReplies must be an array of strings.");
  }
  const { channel, recipientId } = await resolveSendTarget(ctx, args);
  try {
    if (channel === "sms") {
      if (args.mediaUrl) throw new Error("Media attachments are not supported on SMS.");
      const r = await sendSmsInternal(ctx.workspaceId, recipientId, args.text ?? "");
      return { ok: true, messageId: r.messageId, channel, recipientId };
    }
    const r = await sendChannelMessageInternal(
      ctx.workspaceId,
      channel as "messenger" | "instagram" | "whatsapp",
      recipientId,
      args.text ?? "",
      null,
      args.mediaUrl ? { url: args.mediaUrl, type: args.mediaType as "video" | "audio" | "image" } : null,
      {
        quickReplies: args.quickReplies ?? null,
        contactCapture: hasCapture
          ? { fields: args.contactCaptureFields!, mode: args.contactCaptureMode ?? "both" }
          : null,
        variableCapture: hasVariableCapture
          ? { variable: args.variableCapture!.variable, varType: args.variableCapture!.varType ?? "text" }
          : null,
      },
    );
    return { ok: true, messageId: r.metaMessageId, channel, recipientId };
  } catch (err) {
    if (err instanceof ChannelSendError || err instanceof SmsSendError) {
      throw new Error(`[${err.code}] ${err.message}`);
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Contacts. The root `contacts` collection is NOT workspace-scoped, so every
// contact tool proves workspace membership via the workspace's conversations:
// a contact is visible iff workspaces/{ws}/conversations/{channel}_{senderId}
// exists.
// ---------------------------------------------------------------------------

function parseContactId(contactId: string): { channel: string; senderId: string } {
  const m = /^contact_([^_]+)_(.+)$/.exec(contactId);
  if (!m) throw new Error("Invalid contactId.");
  return { channel: m[1], senderId: m[2] };
}

async function assertContactInWorkspace(ctx: ToolContext, contactId: string): Promise<void> {
  const { channel, senderId } = parseContactId(contactId);
  const convo = await db()
    .collection("workspaces")
    .doc(ctx.workspaceId)
    .collection("conversations")
    .doc(`${channel}_${senderId}`)
    .get();
  if (!convo.exists) {
    throw new Error("Contact not found in this workspace.");
  }
}

type ContactView = {
  contactId: string;
  name: string;
  channel: string;
  senderId: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  status: string | null;
  tags: string[];
  lastMessageAt: string | null;
};

function toContactView(id: string, data: Record<string, unknown>): ContactView {
  return {
    contactId: id,
    name: String(data.name ?? ""),
    channel: String(data.channel ?? ""),
    senderId: String(data.senderId ?? ""),
    email: typeof data.email === "string" ? data.email : null,
    phone: typeof (data.phone ?? data.mobile) === "string" ? String(data.phone ?? data.mobile) : null,
    company: typeof data.company === "string" ? data.company : null,
    status: typeof data.status === "string" ? data.status : null,
    tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
    lastMessageAt: tsToIso(data.lastMessageAt),
  };
}

/**
 * search_contacts: find contacts by name / email / phone / company.
 * Scoped to contacts that have a conversation in this workspace.
 */
export async function searchContacts(
  ctx: ToolContext,
  args: { query: string; limit?: number },
): Promise<ContactView[]> {
  const query = (args.query ?? "").trim().toLowerCase();
  if (!query) throw new Error("query is required.");
  const limit = Math.min(Math.max(args.limit ?? 20, 1), 50);

  // Candidate set: the workspace's recent conversations -> contact docs.
  const convos = await db()
    .collection("workspaces")
    .doc(ctx.workspaceId)
    .collection("conversations")
    .orderBy("lastMessageAt", "desc")
    .limit(200)
    .get();
  const contactIds = convos.docs.map((d) => {
    const data = d.data();
    return `contact_${String(data.channel ?? "")}_${String(data.senderId ?? "")}`;
  });
  const results: ContactView[] = [];
  // Firestore `in` queries cap at 30; chunk the fetches.
  for (let i = 0; i < contactIds.length && results.length < limit; i += 30) {
    const chunk = contactIds.slice(i, i + 30);
    const refs = chunk.map((id) => db().collection("contacts").doc(id));
    const snaps = await db().getAll(...refs);
    for (const snap of snaps) {
      if (!snap.exists || results.length >= limit) continue;
      const data = snap.data() as Record<string, unknown>;
      const haystack = [data.name, data.email, data.phone, data.mobile, data.company]
        .filter((v) => typeof v === "string")
        .join(" ")
        .toLowerCase();
      if (haystack.includes(query)) {
        results.push(toContactView(snap.id, data));
      }
    }
  }
  return results;
}

/** get_contact: full contact record (workspace-scoped). */
export async function getContact(
  ctx: ToolContext,
  args: { contactId: string },
): Promise<ContactView & { notes: string | null; customFields: Record<string, unknown>; variables: Record<string, unknown> }> {
  if (!args.contactId) throw new Error("contactId is required.");
  await assertContactInWorkspace(ctx, args.contactId);
  const snap = await db().collection("contacts").doc(args.contactId).get();
  if (!snap.exists) throw new Error("Contact not found.");
  const data = snap.data() as Record<string, unknown>;
  const customFields =
    typeof data.customFields === "object" && data.customFields !== null
      ? (data.customFields as Record<string, unknown>)
      : {};
  // variables and customFields are written together; merge so API users
  // see every named variable whatever map it landed in.
  const variables = {
    ...(typeof data.variables === "object" && data.variables !== null
      ? (data.variables as Record<string, unknown>)
      : {}),
    ...customFields,
  };
  return {
    ...toContactView(snap.id, data),
    notes: typeof data.notes === "string" ? data.notes : null,
    customFields,
    variables,
  };
}

const UPDATABLE_CONTACT_FIELDS = new Set([
  "name", "firstName", "lastName", "email", "phone", "company", "jobTitle",
  "city", "state", "country", "zipCode", "notes", "tags", "status",
]);

/** update_contact: patch allowlisted fields on a workspace contact. */
export async function updateContact(
  ctx: ToolContext,
  args: { contactId: string; fields: Record<string, unknown>; variables?: Record<string, string | number | boolean> },
): Promise<ContactView> {
  if (!args.contactId) throw new Error("contactId is required.");
  if (!args.fields || typeof args.fields !== "object") throw new Error("fields is required.");
  await assertContactInWorkspace(ctx, args.contactId);
  const patch: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
  for (const [k, v] of Object.entries(args.fields)) {
    if (!UPDATABLE_CONTACT_FIELDS.has(k)) {
      throw new Error(`Field "${k}" cannot be updated via the API.`);
    }
    patch[k] = v;
  }
  if (patch.tags !== undefined && !Array.isArray(patch.tags)) {
    throw new Error("tags must be an array of strings.");
  }
  // Named variables (BotMaps question-block answers): written to both the
  // variables and customFields maps, mirroring the app's setContactVariable
  // helper, so {{variable}} tags resolve in later messages.
  if (args.variables && typeof args.variables === "object") {
    for (const [rawKey, v] of Object.entries(args.variables)) {
      // Reserved contact field names (phone, email, ...) are rejected here:
      // {{phone}} always resolves to the contact's real phone number.
      const key = assertVariableNameAllowed(rawKey);
      if (typeof v !== "string" && typeof v !== "number" && typeof v !== "boolean") {
        throw new Error(`Variable "${key}" must be a string, number, or boolean.`);
      }
      patch[`variables.${key}`] = v;
      patch[`customFields.${key}`] = v;
    }
  }
  const ref = db().collection("contacts").doc(args.contactId);
  await ref.set(patch, { merge: true });
  const snap = await ref.get();
  return toContactView(snap.id, snap.data() as Record<string, unknown>);
}

/**
 * send_webhook: POST a contact's collected variables to a third party URL.
 * The BotMaps webhook action block stores its URL on the flow; this tool
 * fires the same push on demand. HTTPS only, private hosts refused,
 * 10s timeout, no retries.
 */
export async function sendWebhook(
  ctx: ToolContext,
  args: { contactId: string; url: string; variableNames?: string[] },
): Promise<{ ok: boolean; status: number | null; error?: string }> {
  if (!args.contactId) throw new Error("contactId is required.");
  if (!args.url) throw new Error("url is required.");
  await assertContactInWorkspace(ctx, args.contactId);
  const names = args.variableNames?.map(sanitizeVariableName).filter(Boolean);
  return executeWebhookAction(ctx.workspaceId, args.contactId, args.url, names?.length ? names : null);
}

/**
 * create_broadcast: SMS broadcast to opted-in numbers (v1 supports SMS only;
 * Meta-channel broadcasts are UI-only in ChatMize today). Runs the exact
 * production broadcast pipeline: idempotent, resumable, per-recipient opt in
 * re-check and personalization. When `phones` is omitted, broadcasts to every
 * opted-in number in the workspace.
 */
export async function createBroadcast(
  ctx: ToolContext,
  args: { channel: string; body: string; phones?: string[]; idempotencyKey?: string },
): Promise<{
  ok: boolean; broadcastId: string; complete: boolean;
  sent: number; failed: number; skipped: number; creditsCharged: number; errors: string[];
}> {
  if (args.channel !== "sms") {
    throw new Error("v1 broadcasts support channel \"sms\" only.");
  }
  if (!args.body || !args.body.trim()) throw new Error("body is required.");
  try {
    return await runSmsBroadcastInternal(ctx.workspaceId, args.body, args.phones, args.idempotencyKey);
  } catch (err) {
    if (err instanceof SmsBroadcastError) {
      throw new Error(`[${err.code}] ${err.message}`);
    }
    throw err;
  }
}

/**
 * sheets_append_row: append one row to a tab of the workspace's connected
 * Google Sheet. `values` maps column header -> cell value; cells land under
 * the matching header and unknown headers are ignored. No retries.
 */
export async function sheetsAppendRow(
  ctx: ToolContext,
  args: { tab: string; values: Record<string, string>; spreadsheetId?: string },
): Promise<{ updatedRange: string | null }> {
  if (!args.tab) throw new Error("tab is required.");
  if (!args.values || typeof args.values !== "object") throw new Error("values is required.");
  return appendSheetsRow(ctx.workspaceId, {
    tab: args.tab,
    values: args.values,
    spreadsheetId: args.spreadsheetId,
  });
}

/**
 * sheets_read_rows: read rows from a tab of the connected Google Sheet. The
 * first row is treated as headers; every row comes back keyed by header.
 * Optionally keep only rows where a column equals a value.
 */
export async function sheetsReadRows(
  ctx: ToolContext,
  args: {
    tab: string;
    matchHeader?: string;
    matchValue?: string;
    limit?: number;
    spreadsheetId?: string;
  },
): Promise<{ headers: string[]; rows: Array<Record<string, string>> }> {
  if (!args.tab) throw new Error("tab is required.");
  return readSheetsRows(ctx.workspaceId, {
    tab: args.tab,
    matchHeader: args.matchHeader,
    matchValue: args.matchValue,
    limit: args.limit,
    spreadsheetId: args.spreadsheetId,
  });
}

/**
 * sheets_list_tabs: list the tabs of the connected Google Sheet with their
 * header rows, so API users can see where to append or read.
 */
export async function sheetsListTabs(
  ctx: ToolContext,
  args: { spreadsheetId?: string },
): Promise<{ tabs: Array<{ title: string; headers: string[] }> }> {
  const spreadsheetId = await resolveSpreadsheetId(ctx.workspaceId, args.spreadsheetId);
  return { tabs: await listSheetsTabs(ctx.workspaceId, spreadsheetId) };
}
