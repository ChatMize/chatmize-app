/**
 * Email via a swappable provider adapter. Resend is the first provider;
 * AWS SES (or another provider) can replace it later by adding a second
 * send implementation and registering it in sendEmailViaProvider — call
 * sites only ever talk to the router, never to a provider directly.
 *
 * Resend pricing context (verified 2026-09-18, for cost awareness only):
 * - Pro: $20/mo for 50,000 emails (ten domains)
 * - Scale: $90/mo for 100,000 emails (1,000 domains)
 * - Overage: $0.90 per 1,000 emails (opt-in)
 * Dedicated IP is $30/mo on Scale and requires >3,000 emails/day.
 *
 * ChatMize owns the Resend account; each workspace sends from its own
 * verified sender identity (fromName + fromEmail) on a ChatMize-owned or
 * workspace-verified domain. Message costs are covered by the plan's
 * monthly email allowance first, then by AI credits (EMAIL_CREDITS_PER_EMAIL
 * per message at face value).
 */
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { RESEND_API_KEY } from "./secrets";
import { spendCredits } from "./credits";

/** One AI credit per email at face value. Tune as margins are finalized. */
export const EMAIL_CREDITS_PER_EMAIL = 1;

/**
 * Supported email providers. "resend" is live; "ses" is a registered
 * placeholder so the router shape is ready when AWS SES is wired in.
 */
export type EmailProvider = "resend" | "ses";

export const EMAIL_PROVIDERS: Array<{
  id: EmailProvider;
  label: string;
  blurb: string;
  available: boolean;
}> = [
  {
    id: "resend",
    label: "Resend",
    blurb: "Managed sending, ChatMize handles deliverability",
    available: true,
  },
  {
    id: "ses",
    label: "AWS SES",
    blurb: "Planned: swap-in replacement behind this same adapter",
    available: false,
  },
];

export interface EmailConnection {
  workspaceId: string;
  /** Display name shown on outbound mail, e.g. "Karl's Fitness Coaching". */
  fromName: string;
  /** Verified sender address, e.g. hello@chatmize.com or the workspace domain. */
  fromEmail: string;
  replyTo?: string;
  provider: EmailProvider;
  status: "provisioning" | "active" | "suspended";
  monthlyAllowance: number;
  usedThisMonth: number;
  usageMonth: string; // YYYY-MM
  createdAt: string;
  updatedAt: string;
}

export interface SendEmailPayload {
  to: string;
  subject: string;
  /** HTML body. Plain-text is auto-derived when omitted. */
  html: string;
  text?: string;
  replyTo?: string;
  /** Optional tags for provider-side analytics. */
  tags?: Array<{ name: string; value: string }>;
}

const db = () => getFirestore("chatmize-prod");
const connRef = (workspaceId: string) => db().collection("email_connections").doc(workspaceId);
const logRef = (workspaceId: string) => db().collection("email_logs").doc(workspaceId).collection("entries");

/** Error thrown when the operator has not added the provider key yet. */
function missingKeyError(): Error {
  return new Error(
    "Email sending is not configured yet. Add the RESEND_API_KEY secret " +
      "in Secret Manager (firebase functions:secrets:set RESEND_API_KEY), " +
      "then retry. No email was sent.",
  );
}

// ---------------------------------------------------------------------------
// Resend REST
// ---------------------------------------------------------------------------

async function resendApi(
  path: string,
  method: "POST" | "GET" = "POST",
  body: Record<string, unknown> = {},
): Promise<any> {
  const apiKey = RESEND_API_KEY.value();
  if (!apiKey) throw missingKeyError();
  const res = await fetch(`https://api.resend.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: method === "POST" ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      (data as any)?.message ?? (data as any)?.error ?? "request failed";
    throw new Error(`Resend API ${res.status}: ${message}`);
  }
  return data;
}

/** Derive a plain-text fallback from HTML when the caller omits text. */
export function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Send one email via Resend. Returns the Resend message id.
 * Throws missingKeyError() when RESEND_API_KEY is not set, so the
 * operator gets a clear instruction instead of a cryptic 401.
 */
export async function resendSendEmail(
  from: string,
  payload: SendEmailPayload,
): Promise<string> {
  const data = await resendApi("/emails", "POST", {
    from,
    to: [payload.to],
    subject: payload.subject,
    html: payload.html,
    text: payload.text ?? htmlToText(payload.html),
    ...(payload.replyTo ? { reply_to: payload.replyTo } : {}),
    ...(payload.tags?.length ? { tags: payload.tags } : {}),
  });
  const id = (data as any)?.id;
  if (!id) throw new Error("Resend send returned no message id.");
  return id as string;
}

// ---------------------------------------------------------------------------
// Provider router — call sites use only this, never a provider directly.
// ---------------------------------------------------------------------------

/**
 * Send one email via the workspace's configured provider.
 * `from` is the verified sender ("Name <address@domain>").
 * Returns the provider's message ID. Throws on provider errors.
 */
export async function sendEmailViaProvider(
  provider: EmailProvider,
  from: string,
  payload: SendEmailPayload,
): Promise<string> {
  switch (provider) {
    case "ses":
      // AWS SES lands here when wired: same signature, no call-site changes.
      throw new Error(
        "AWS SES is not wired yet. Keep provider 'resend' until the SES adapter is implemented.",
      );
    case "resend":
    default:
      return resendSendEmail(from, payload);
  }
}

/** Normalize a possibly-legacy connection (pre-provider field) to resend. */
export function providerOf(conn: EmailConnection): EmailProvider {
  return conn.provider ?? "resend";
}

/** Format "Name <address>" from a connection's sender identity. */
export function senderOf(conn: EmailConnection): string {
  return `${conn.fromName} <${conn.fromEmail}>`;
}

/** Minimal RFC-style email validation for outbound sends. */
export function isValidEmail(raw: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(raw.trim());
}

// ---------------------------------------------------------------------------
// Firestore state
// ---------------------------------------------------------------------------

export async function getEmailConnection(workspaceId: string): Promise<EmailConnection | null> {
  const snap = await connRef(workspaceId).get();
  if (!snap.exists) return null;
  return snap.data() as EmailConnection;
}

export async function saveEmailConnection(conn: EmailConnection): Promise<void> {
  await connRef(conn.workspaceId).set({ ...conn, updatedAt: new Date().toISOString() });
}

/** Lazily roll the monthly email allowance when the calendar month changes. */
export async function ensureEmailAllowanceMonth(workspaceId: string): Promise<EmailConnection | null> {
  const conn = await getEmailConnection(workspaceId);
  if (!conn) return null;
  const month = new Date().toISOString().slice(0, 7);
  if (conn.usageMonth !== month) {
    conn.usedThisMonth = 0;
    conn.usageMonth = month;
    await saveEmailConnection(conn);
  }
  return conn;
}

/** Persist an outbound email into the workspace conversation thread (email_{address}). */
export async function persistOutboundEmail(
  workspaceId: string,
  from: string,
  to: string,
  subject: string,
  externalId: string,
): Promise<void> {
  const convoId = `email_${to.toLowerCase().replace(/[^a-z0-9]/g, "_")}`;
  const convoRef = db()
    .collection("workspaces")
    .doc(workspaceId)
    .collection("conversations")
    .doc(convoId);
  const messageRef = convoRef.collection("messages").doc(externalId);
  const batch = db().batch();
  batch.set(
    convoRef,
    {
      channel: "email",
      senderId: to,
      recipientId: from,
      lastMessageAt: FieldValue.serverTimestamp(),
      lastMessageText: subject,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  batch.set(messageRef, {
    direction: "outbound",
    channel: "email",
    senderId: from,
    text: subject,
    externalId,
    createdAt: FieldValue.serverTimestamp(),
  });
  await batch.commit();
}

export async function logEmail(entry: {
  workspaceId: string;
  direction: "outbound";
  to: string;
  from: string;
  subject: string;
  creditsCharged: number;
  /** Provider message id (Resend id, SES message id). */
  messageId?: string | null;
  status: "sent" | "failed";
  error?: string;
  broadcastId?: string;
}): Promise<void> {
  await logRef(entry.workspaceId).add({
    ...entry,
    createdAt: FieldValue.serverTimestamp(),
  });
}

/**
 * Charge for an outbound send: monthly allowance first, then credits.
 * Throws when neither covers the cost.
 */
export async function chargeForEmailSend(
  workspaceId: string,
  count: number,
  note: string,
): Promise<{ chargedTo: "allowance" | "credits"; creditsCharged: number }> {
  const conn = await ensureEmailAllowanceMonth(workspaceId);
  if (conn && conn.usedThisMonth + count <= conn.monthlyAllowance) {
    conn.usedThisMonth += count;
    await saveEmailConnection(conn);
    return { chargedTo: "allowance", creditsCharged: 0 };
  }
  const credits = count * EMAIL_CREDITS_PER_EMAIL;
  await spendCredits(workspaceId, credits, "email_send", note);
  return { chargedTo: "credits", creditsCharged: credits };
}
