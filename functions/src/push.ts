/**
 * Web push notifications as a native ChatMize channel (Firebase Cloud Messaging).
 *
 * Businesses collect push subscribers on their own sites through the hosted
 * subscribe page or the embeddable opt-in prompt, then send web notifications
 * from ChatMize: one-off sends, broadcasts, BotMaps "Send push" actions,
 * booking reminders, and owner alerts (for example dead channel reconnects).
 *
 * Data model
 * - workspaces/{ws}/push_subscribers/{tokenHash}: one doc per FCM token.
 *   { token, subscribed, tags[], contactId?, role?: 'owner'|'subscriber',
 *     userAgent?, createdAt, updatedAt }
 * - workspaces/{ws}/push_broadcasts/{id}: idempotent broadcast state.
 * - workspaces/{ws}/push_analytics/{YYYY-MM-DD}: cheap daily counters
 *   { sent, delivered, clicked } consumed by the analytics dashboard.
 * - system_settings/push_config: { vapidPublicKey } (Super Admin only).
 *
 * Token writes from the public internet go through the subscribe/unsubscribe
 * callables below (Admin SDK bypasses Firestore rules); clients never write
 * push_subscribers directly.
 */
import { createHash } from "crypto";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getMessaging } from "firebase-admin/messaging";
import { logger } from "firebase-functions";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const REGION = "us-west2";
const db = () => getFirestore("chatmize-prod");

// Safety caps so a broadcast can never spin out of control on scale-to-zero.
const MAX_RECIPIENTS_PER_RUN = 5000;
const FCM_BATCH_SIZE = 500;
const TITLE_MAX = 120;
const BODY_MAX = 500;

export type PushLinkType = "messenger" | "onpage" | "website";

export interface PushPayload {
  title: string;
  body: string;
  /** Where the notification opens on tap. */
  linkType?: PushLinkType;
  linkValue?: string;
  image?: string;
}

/** Human labels for the link type picker (shared by backend validation). */
export const PUSH_LINK_TYPE_LABELS: Record<PushLinkType, string> = {
  messenger: "Messenger deep link",
  onpage: "On-page chat",
  website: "Website URL",
};

export function tokenDocId(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function cleanText(v: unknown, max: number): string {
  // Strip control characters (notification text must stay clean) then cap.
  return String(v ?? "").replace(/[\x00-\x1F\x7F-\x9F]/g, "").trim().slice(0, max);
}

export function cleanLinkValue(v: unknown): string {
  return String(v ?? "").trim();
}

/**
 * Resolve the tap target for a notification from the sender-picked link type.
 * - messenger: a Page username, Page ID, or m.me URL becomes an M link
 *   (https://m.me/<page>) that opens the business in Messenger.
 * - onpage: a full https URL of the business page hosting their ChatMize chat.
 *   We append ?chatmize_chat=open so the on-site widget auto-opens the chat.
 * - website: a plain full https URL, used for sales messages and promos.
 */
export function resolvePushLink(linkType: unknown, linkValue: unknown): string | undefined {
  const value = cleanLinkValue(linkValue);
  if (!value) return undefined;
  const type = linkType === "messenger" || linkType === "onpage" ? linkType : "website";

  if (type === "messenger") {
    let handle = value;
    const m = value.match(/(?:m\.me\/|messenger\.com\/t\/)([A-Za-z0-9._-]+)/i);
    if (m) {
      handle = m[1];
    } else {
      handle = value.replace(/^https?:\/\//i, "").replace(/^www\./i, "").split(/[/?#]/)[0];
    }
    if (!/^[A-Za-z0-9._-]{1,64}$/.test(handle)) {
      throw new HttpsError(
        "invalid-argument",
        "Messenger link must be a Page username, Page ID, or m.me link.",
      );
    }
    return `https://m.me/${handle}`;
  }

  if (!/^https:\/\//i.test(value)) {
    throw new HttpsError("invalid-argument", "Link must be a full https URL.");
  }
  const url = value.slice(0, 2000);
  if (type === "onpage") {
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}chatmize_chat=open`;
  }
  return url;
}

async function getVapidKey(): Promise<string | null> {
  const snap = await db().collection("system_settings").doc("push_config").get();
  const key = (snap.data() as { vapidPublicKey?: string } | undefined)?.vapidPublicKey;
  return key && key.trim() ? key.trim() : null;
}

async function getWorkspaceName(workspaceId: string): Promise<string> {
  const snap = await db().collection("workspaces").doc(workspaceId).get();
  return ((snap.data() as { name?: string } | undefined)?.name ?? "ChatMize").slice(0, 80);
}

async function getPromptCopy(workspaceId: string): Promise<{
  headline: string; subtext: string; allowLabel: string; dismissLabel: string;
}> {
  const snap = await db()
    .collection("workspaces").doc(workspaceId)
    .collection("push_settings").doc("prompt").get();
  const d = (snap.data() ?? {}) as Record<string, string>;
  return {
    headline: d.headline || "Get updates from us",
    subtext: d.subtext || "Tap allow and we will send you helpful updates right in your browser. No spam, unsubscribe anytime.",
    allowLabel: d.allowLabel || "Allow notifications",
    dismissLabel: d.dismissLabel || "Not now",
  };
}

/** Public config for the hosted subscribe page. No auth required. */
export const getPushPublicConfig = onCall({ region: REGION }, async (request) => {
  const { workspaceId } = (request.data ?? {}) as { workspaceId?: string };
  if (!workspaceId) throw new HttpsError("invalid-argument", "workspaceId is required.");
  const vapidPublicKey = await getVapidKey();
  if (!vapidPublicKey) return { configured: false as const };
  const [workspaceName, prompt] = await Promise.all([
    getWorkspaceName(workspaceId),
    getPromptCopy(workspaceId),
  ]);
  return { configured: true as const, vapidPublicKey, workspaceName, prompt };
});

/** Channel status for the app UI. Workspace members only. */
export const getPushStatus = onCall({ region: REGION }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in required.");
  const { workspaceId } = (request.data ?? {}) as { workspaceId?: string };
  if (!workspaceId) throw new HttpsError("invalid-argument", "workspaceId is required.");
  await requirePushWorkspaceAccess(uid, workspaceId, request.auth?.token);
  const [vapidPublicKey, countSnap] = await Promise.all([
    getVapidKey(),
    db().collection("workspaces").doc(workspaceId)
      .collection("push_subscribers").where("subscribed", "==", true).count().get(),
  ]);
  return {
    configured: !!vapidPublicKey,
    subscriberCount: countSnap.data().count,
    isSuperAdmin: request.auth?.token?.superadmin === true,
  };
});

/** Store the Firebase Web Push certificate key pair public key. Super Admin only. */
export const setPushVapidKey = onCall({ region: REGION }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in required.");
  if (request.auth?.token?.superadmin !== true) {
    throw new HttpsError("permission-denied", "Only a Super Admin can change push settings.");
  }
  const { vapidPublicKey } = (request.data ?? {}) as { vapidPublicKey?: string };
  const key = String(vapidPublicKey ?? "").trim();
  if (!key || key.length < 20) throw new HttpsError("invalid-argument", "That VAPID key looks invalid.");
  await db().collection("system_settings").doc("push_config").set(
    { vapidPublicKey: key, updatedAt: new Date().toISOString(), updatedBy: uid },
    { merge: true },
  );
  return { ok: true };
});

/** Customize the opt-in prompt copy. Workspace members only. */
export const setPushPromptCopy = onCall({ region: REGION }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in required.");
  const { workspaceId, headline, subtext, allowLabel, dismissLabel } =
    (request.data ?? {}) as Record<string, string>;
  if (!workspaceId) throw new HttpsError("invalid-argument", "workspaceId is required.");
  await requirePushWorkspaceAccess(uid, workspaceId, request.auth?.token);
  await db().collection("workspaces").doc(workspaceId)
    .collection("push_settings").doc("prompt").set({
      headline: cleanText(headline, 80) || "Get updates from us",
      subtext: cleanText(subtext, 300),
      allowLabel: cleanText(allowLabel, 40) || "Allow notifications",
      dismissLabel: cleanText(dismissLabel, 40) || "Not now",
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  return { ok: true };
});

/** Simple throttle so the public subscribe endpoint cannot be hammered. */
async function checkSubscribeThrottle(workspaceId: string): Promise<void> {
  const ref = db().collection("push_subscribe_throttle").doc(workspaceId);
  const now = Date.now();
  const windowMs = 60 * 60 * 1000;
  const maxPerHour = 500;
  await db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const d = (snap.data() ?? {}) as { count?: number; windowStart?: number };
    if (!snap.exists || (d.windowStart ?? 0) + windowMs < now) {
      tx.set(ref, { count: 1, windowStart: now });
      return;
    }
    if ((d.count ?? 0) >= maxPerHour) {
      throw new HttpsError("resource-exhausted", "Too many signups right now. Try again later.");
    }
    tx.update(ref, { count: FieldValue.increment(1) });
  });
}

/**
 * Public subscribe. Called by the hosted subscribe page or the embeddable
 * prompt after the browser grants notification permission.
 */
export const subscribePush = onCall({ region: REGION }, async (request) => {
  const { workspaceId, token, userAgent, tags, contactId, ownerUid, channelSenderIds } =
    (request.data ?? {}) as {
      workspaceId?: string; token?: string; userAgent?: string;
      tags?: string[]; contactId?: string; ownerUid?: string; channelSenderIds?: string[];
    };
  if (!workspaceId || !token) {
    throw new HttpsError("invalid-argument", "workspaceId and token are required.");
  }
  if (token.length < 20 || token.length > 4096) {
    throw new HttpsError("invalid-argument", "That push token looks invalid.");
  }
  const ws = await db().collection("workspaces").doc(workspaceId).get();
  if (!ws.exists) throw new HttpsError("not-found", "Workspace not found.");
  await checkSubscribeThrottle(workspaceId);

  // Owner alerts: only the signed-in owner can register an owner token.
  let role: "owner" | "subscriber" = "subscriber";
  if (ownerUid) {
    if (request.auth?.uid !== ownerUid) {
      throw new HttpsError("permission-denied", "Owner signup needs a signed in session.");
    }
    await requirePushWorkspaceAccess(ownerUid, workspaceId, request.auth?.token);
    role = "owner";
  }

  const cleanTags = Array.isArray(tags)
    ? [...new Set(tags.map((t) => String(t).trim().slice(0, 60)).filter(Boolean))].slice(0, 20)
    : [];
  // Channel conversation IDs (e.g. "messenger_12345") let the no-reply check
  // find this subscriber's inbound messages across channels.
  const cleanSenderIds = Array.isArray(channelSenderIds)
    ? [...new Set(channelSenderIds.map((s) => String(s).trim().slice(0, 128)).filter(Boolean))].slice(0, 10)
    : [];
  const now = new Date().toISOString();
  await db().collection("workspaces").doc(workspaceId)
    .collection("push_subscribers").doc(tokenDocId(token)).set({
      token,
      subscribed: true,
      role,
      tags: cleanTags,
      contactId: contactId ? String(contactId).slice(0, 128) : null,
      channelSenderIds: cleanSenderIds,
      ownerUid: role === "owner" ? ownerUid : null,
      userAgent: String(userAgent ?? "").slice(0, 300),
      unsubscribedAt: null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: now,
    }, { merge: true });
  logger.info("Push subscribed", { workspaceId, role, tags: cleanTags.length });
  return { ok: true };
});

/** Public unsubscribe. */
export const unsubscribePush = onCall({ region: REGION }, async (request) => {
  const { workspaceId, token } = (request.data ?? {}) as { workspaceId?: string; token?: string };
  if (!workspaceId || !token) throw new HttpsError("invalid-argument", "workspaceId and token are required.");
  await db().collection("workspaces").doc(workspaceId)
    .collection("push_subscribers").doc(tokenDocId(token)).set({
      subscribed: false,
      unsubscribedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  return { ok: true };
});

// ---------------------------------------------------------------------------
// Sending
// ---------------------------------------------------------------------------

async function pruneDeadTokens(
  workspaceId: string,
  tokens: string[],
  responses: Array<{ success: boolean; error?: { code?: string } }>,
): Promise<number> {
  let pruned = 0;
  const batch = db().batch();
  responses.forEach((r, i) => {
    const code = r.error?.code ?? "";
    if (!r.success && (/not-registered|invalid-registration-token|invalid-argument/i.test(code))) {
      batch.delete(
        db().collection("workspaces").doc(workspaceId)
          .collection("push_subscribers").doc(tokenDocId(tokens[i])),
      );
      pruned++;
    }
  });
  if (pruned > 0) await batch.commit();
  return pruned;
}

function todayId(): string {
  return new Date().toISOString().slice(0, 10);
}

async function trackSent(workspaceId: string, sent: number): Promise<void> {
  if (sent <= 0) return;
  await db().collection("workspaces").doc(workspaceId)
    .collection("push_analytics").doc(todayId())
    .set({ sent: FieldValue.increment(sent), updatedAt: new Date().toISOString() }, { merge: true });
}

/** Public tracking ping from the service worker (delivered / clicked). */
export const trackPushEvent = onCall({ region: REGION }, async (request) => {
  const { workspaceId, event } = (request.data ?? {}) as { workspaceId?: string; event?: string };
  if (!workspaceId) throw new HttpsError("invalid-argument", "workspaceId is required.");
  if (event !== "delivered" && event !== "clicked") {
    throw new HttpsError("invalid-argument", "event must be delivered or clicked.");
  }
  await db().collection("workspaces").doc(workspaceId)
    .collection("push_analytics").doc(todayId())
    .set({ [event]: FieldValue.increment(1), updatedAt: new Date().toISOString() }, { merge: true });
  return { ok: true };
});

async function resolveTokens(
  workspaceId: string,
  opts: { contactId?: string; tags?: string[]; role?: "owner" },
): Promise<string[]> {
  let q = db().collection("workspaces").doc(workspaceId)
    .collection("push_subscribers").where("subscribed", "==", true) as FirebaseFirestore.Query;
  if (opts.role) q = q.where("role", "==", opts.role);
  if (opts.contactId) q = q.where("contactId", "==", opts.contactId);
  if (opts.tags && opts.tags.length > 0) q = q.where("tags", "array-contains-any", opts.tags.slice(0, 10));
  const snap = await q.get();
  return snap.docs.map((d) => (d.data() as { token?: string }).token).filter((t): t is string => !!t);
}

async function fanoutPush(
  workspaceId: string,
  payload: PushPayload,
  tokens: string[],
  broadcastId?: string,
): Promise<{ sent: number; failed: number; pruned: number }> {
  const title = cleanText(payload.title, TITLE_MAX);
  const body = cleanText(payload.body, BODY_MAX);
  if (!title || !body) throw new HttpsError("invalid-argument", "Title and message are required.");
  const link = resolvePushLink(payload.linkType, payload.linkValue);
  const image = payload.image && /^https:\/\//i.test(payload.image) ? payload.image.slice(0, 2000) : undefined;

  let sent = 0, failed = 0, pruned = 0;
  const messaging = getMessaging();
  for (let i = 0; i < tokens.length; i += FCM_BATCH_SIZE) {
    const batchTokens = tokens.slice(i, i + FCM_BATCH_SIZE);
    const resp = await messaging.sendEachForMulticast({
      tokens: batchTokens,
      notification: { title, body, ...(image ? { image } : {}) },
      webpush: {
        ...(link ? { fcmOptions: { link } } : {}),
        notification: {
          icon: "/chatmize-head.png",
          badge: "/chatmize-head.png",
          requireInteraction: false,
        },
      },
      data: {
        workspaceId,
        broadcastId: broadcastId ?? "",
        type: "chatmize-push",
      },
    });
    sent += resp.successCount;
    failed += resp.failureCount;
    pruned += await pruneDeadTokens(workspaceId, batchTokens, resp.responses as never);
  }
  await trackSent(workspaceId, sent);
  return { sent, failed, pruned };
}

/**
 * One-off send. Targets a contact, a tag segment, or every subscriber.
 * Workspace members only.
 */
export const sendPush = onCall({ region: REGION }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in required.");
  const { workspaceId, title, body, linkType, linkValue, image, contactId, tags } =
    (request.data ?? {}) as PushPayload & { workspaceId?: string; contactId?: string; tags?: string[] };
  if (!workspaceId) throw new HttpsError("invalid-argument", "workspaceId is required.");
  await requirePushWorkspaceAccess(uid, workspaceId, request.auth?.token);
  const vapid = await getVapidKey();
  if (!vapid) throw new HttpsError("failed-precondition", "Push is not set up yet. Add the VAPID key in Super Admin.");

  const tokens = await resolveTokens(workspaceId, { contactId, tags });
  if (tokens.length === 0) throw new HttpsError("failed-precondition", "No push subscribers match.");
  if (tokens.length > MAX_RECIPIENTS_PER_RUN) {
    throw new HttpsError("invalid-argument", `Too many recipients for one send (${MAX_RECIPIENTS_PER_RUN} max). Use a broadcast.`);
  }
  const result = await fanoutPush(workspaceId, { title, body, linkType, linkValue, image }, tokens);
  logger.info("Push sent", { workspaceId, ...result });
  return { ok: true, ...result, recipients: tokens.length };
});

interface PushBroadcastState {
  workspaceId: string;
  title: string; body: string;
  linkType?: PushLinkType; linkValue?: string; image?: string;
  recipients: string[];
  status: "running" | "complete";
  processed: number; sent: number; failed: number; pruned: number;
  createdAt: string; updatedAt: string;
}

/**
 * Broadcast to all subscribers with idempotency (same pattern as SMS
 * broadcasts): retries with the same key resume instead of resending.
 * Workspace members only.
 */
export const sendPushBroadcast = onCall(
  { region: REGION, timeoutSeconds: 540 },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Sign in required.");
    const { workspaceId, title, body, linkType, linkValue, image, idempotencyKey } =
      (request.data ?? {}) as PushPayload & { workspaceId?: string; idempotencyKey?: string };
    if (!workspaceId || !title || !body) {
      throw new HttpsError("invalid-argument", "workspaceId, title and body are required.");
    }
    await requirePushWorkspaceAccess(uid, workspaceId, request.auth?.token);
    const vapid = await getVapidKey();
    if (!vapid) throw new HttpsError("failed-precondition", "Push is not set up yet. Add the VAPID key in Super Admin.");

    const key = (idempotencyKey ?? "").trim() || `pb_${Date.now().toString(36)}`;
    const bcastRef = db().collection("workspaces").doc(workspaceId)
      .collection("push_broadcasts").doc(key);

    let state: PushBroadcastState;
    const existing = await bcastRef.get();
    if (existing.exists) {
      const d = existing.data() as PushBroadcastState;
      if (d.status === "complete") {
        return { ok: true, broadcastId: key, replayed: true, sent: d.sent, failed: d.failed };
      }
      if (d.workspaceId !== workspaceId) {
        throw new HttpsError("invalid-argument", "This idempotency key is already in use.");
      }
      state = d;
    } else {
      const tokens = await resolveTokens(workspaceId, {});
      if (tokens.length === 0) throw new HttpsError("failed-precondition", "No push subscribers yet.");
      if (tokens.length > MAX_RECIPIENTS_PER_RUN) {
        throw new HttpsError("invalid-argument", `Broadcasts are limited to ${MAX_RECIPIENTS_PER_RUN} recipients per run.`);
      }
      const now = new Date().toISOString();
      state = {
        workspaceId,
        title: cleanText(title, TITLE_MAX), body: cleanText(body, BODY_MAX),
        linkType: (linkType === "messenger" || linkType === "onpage" ? linkType : "website") as PushLinkType,
        linkValue: cleanLinkValue(linkValue),
        image: image && /^https:\/\//i.test(image) ? image : undefined,
        recipients: tokens, status: "running",
        processed: 0, sent: 0, failed: 0, pruned: 0,
        createdAt: now, updatedAt: now,
      };
      try {
        await bcastRef.create(state);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (!/already exists/i.test(msg)) throw e;
        state = ((await bcastRef.get()).data() as PushBroadcastState);
      }
    }

    const remaining = state.recipients.slice(state.processed);
    const result = await fanoutPush(
      workspaceId,
      { title: state.title, body: state.body, linkType: state.linkType, linkValue: state.linkValue, image: state.image },
      remaining, key,
    );
    state.processed = state.recipients.length;
    state.sent += result.sent;
    state.failed += result.failed;
    state.pruned += result.pruned;
    state.status = "complete";
    state.updatedAt = new Date().toISOString();
    await bcastRef.set(state, { merge: true });
    logger.info("Push broadcast complete", { workspaceId, broadcastId: key, sent: state.sent });
    return { ok: true, broadcastId: key, sent: state.sent, failed: state.failed, pruned: state.pruned };
  },
);

// ---------------------------------------------------------------------------
// Delayed push + the escalation chain (no-reply gate)
// ---------------------------------------------------------------------------

/**
 * Did this contact reply anywhere since `sinceMs`? Checks the workspace's
 * stored inbound messages across every conversation linked to the contact.
 * This is the shared "no reply within X" evaluator for the escalation chain:
 * Messenger -> SMS -> push -> (future) email. Each step waits, then asks this
 * before sending, so a reply anywhere stops the chain.
 */
export async function contactRepliedSince(
  workspaceId: string,
  contactId: string,
  sinceMs: number,
): Promise<boolean> {
  if (!contactId || !sinceMs) return false;
  const convoIds = new Set<string>();
  // The contactId may itself be a conversation doc id (defensive).
  convoIds.add(contactId);
  try {
    const subs = await db().collection("workspaces").doc(workspaceId)
      .collection("push_subscribers")
      .where("contactId", "==", contactId)
      .where("subscribed", "==", true)
      .get();
    for (const d of subs.docs) {
      const ids = (d.data() as { channelSenderIds?: string[] }).channelSenderIds;
      if (Array.isArray(ids)) ids.forEach((id) => convoIds.add(id));
    }
  } catch (e) {
    logger.warn("contactRepliedSince subscriber lookup failed", { workspaceId, e });
  }
  for (const convoId of convoIds) {
    try {
      const hit = await db().collection("workspaces").doc(workspaceId)
        .collection("conversations").doc(convoId)
        .collection("messages")
        .where("direction", "==", "inbound")
        .where("timestampMs", ">=", sinceMs)
        .limit(1)
        .get();
      if (!hit.empty) return true;
    } catch {
      // Missing composite index or doc: treat as no signal, keep checking.
    }
  }
  return false;
}

interface ScheduledPush {
  workspaceId: string;
  title: string; body: string;
  linkType?: PushLinkType; linkValue?: string; image?: string;
  contactId?: string | null; tags?: string[];
  sendAt: string; // ISO
  onlyIfNoReply: boolean;
  noReplyWindowMinutes: number;
  status: "scheduled" | "sending" | "sent" | "skipped_replied" | "cancelled" | "failed";
  idempotencyKey?: string;
  createdBy: string; createdAt: string; updatedAt: string;
  result?: { sent: number; failed: number; skipped?: boolean };
}

/**
 * Schedule a push for later. This is what powers "send push in X
 * minutes/hours" on the BotMaps push node and the escalation chain:
 * schedule the follow-up, and at fire time the no-reply gate decides.
 * Workspace members only.
 */
export const schedulePush = onCall({ region: REGION }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in required.");
  const {
    workspaceId, title, body, linkType, linkValue, image,
    contactId, tags, sendAt, onlyIfNoReply, noReplyWindowMinutes, idempotencyKey,
  } = (request.data ?? {}) as PushPayload & {
    workspaceId?: string; contactId?: string; tags?: string[];
    sendAt?: string; onlyIfNoReply?: boolean; noReplyWindowMinutes?: number;
    idempotencyKey?: string;
  };
  if (!workspaceId || !title || !body || !sendAt) {
    throw new HttpsError("invalid-argument", "workspaceId, title, body and sendAt are required.");
  }
  await requirePushWorkspaceAccess(uid, workspaceId, request.auth?.token);
  const vapid = await getVapidKey();
  if (!vapid) throw new HttpsError("failed-precondition", "Push is not set up yet. Add the VAPID key in Super Admin.");
  const sendAtMs = Date.parse(sendAt);
  if (!Number.isFinite(sendAtMs) || sendAtMs <= Date.now()) {
    throw new HttpsError("invalid-argument", "sendAt must be a future time.");
  }
  if (sendAtMs - Date.now() > 30 * 24 * 3600 * 1000) {
    throw new HttpsError("invalid-argument", "Cannot schedule more than 30 days ahead.");
  }
  // Validate the link now so a bad link fails fast instead of at fire time.
  resolvePushLink(linkType, linkValue);

  const key = (idempotencyKey ?? "").trim() || `ps_${Date.now().toString(36)}`;
  const ref = db().collection("workspaces").doc(workspaceId).collection("push_scheduled").doc(key);
  const existing = await ref.get();
  if (existing.exists) {
    return { ok: true, scheduleId: key, replayed: true };
  }
  const now = new Date().toISOString();
  const doc: ScheduledPush = {
    workspaceId,
    title: cleanText(title, TITLE_MAX), body: cleanText(body, BODY_MAX),
    linkType: (linkType === "messenger" || linkType === "onpage" ? linkType : "website") as PushLinkType,
    linkValue: cleanLinkValue(linkValue),
    image: image && /^https:\/\//i.test(image) ? image.slice(0, 2000) : undefined,
    contactId: contactId ? String(contactId).slice(0, 128) : null,
    tags: Array.isArray(tags) ? tags.map((t) => String(t).slice(0, 60)).slice(0, 20) : [],
    sendAt: new Date(sendAtMs).toISOString(),
    onlyIfNoReply: onlyIfNoReply === true,
    noReplyWindowMinutes: Math.max(1, Math.min(60 * 24 * 7, Math.floor(Number(noReplyWindowMinutes) || 60))),
    status: "scheduled",
    idempotencyKey: key,
    createdBy: uid, createdAt: now, updatedAt: now,
  };
  await ref.create(doc);
  logger.info("Push scheduled", { workspaceId, scheduleId: key, sendAt: doc.sendAt });
  return { ok: true, scheduleId: key };
});

/** Cancel a scheduled push before it fires. Workspace members only. */
export const cancelScheduledPush = onCall({ region: REGION }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in required.");
  const { workspaceId, scheduleId } = (request.data ?? {}) as { workspaceId?: string; scheduleId?: string };
  if (!workspaceId || !scheduleId) {
    throw new HttpsError("invalid-argument", "workspaceId and scheduleId are required.");
  }
  await requirePushWorkspaceAccess(uid, workspaceId, request.auth?.token);
  const ref = db().collection("workspaces").doc(workspaceId).collection("push_scheduled").doc(scheduleId);
  await db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError("not-found", "Scheduled push not found.");
    const d = snap.data() as ScheduledPush;
    if (d.status !== "scheduled") {
      throw new HttpsError("failed-precondition", `Already ${d.status}; cannot cancel.`);
    }
    tx.update(ref, { status: "cancelled", updatedAt: new Date().toISOString() });
  });
  return { ok: true };
});

/**
 * Sweep handler for due scheduled pushes. Wired to a 10 minute Cloud
 * Scheduler job in index.ts. Claims each due doc, applies the no-reply gate,
 * fans out, and records the outcome. Scale-to-zero safe: capped per run.
 */
export async function runPushScheduleSweep(): Promise<{ checked: number; sent: number; skipped: number }> {
  const nowIso = new Date().toISOString();
  const due = await db().collectionGroup("push_scheduled")
    .where("status", "==", "scheduled")
    .where("sendAt", "<=", nowIso)
    .orderBy("sendAt", "asc")
    .limit(50)
    .get();
  let sent = 0, skipped = 0;
  for (const snap of due.docs) {
    const ref = snap.ref;
    // Claim the doc so a concurrent sweep run cannot double send.
    const claimed = await db().runTransaction(async (tx) => {
      const fresh = await tx.get(ref);
      if (!fresh.exists || (fresh.data() as ScheduledPush).status !== "scheduled") return null;
      tx.update(ref, { status: "sending", updatedAt: new Date().toISOString() });
      return fresh.data() as ScheduledPush;
    });
    if (!claimed) continue;
    try {
      const vapid = await getVapidKey();
      if (!vapid) throw new Error("Push not configured");
      // Escalation gate: if the contact replied inside the window, skip.
      if (claimed.onlyIfNoReply && claimed.contactId) {
        const windowMs = claimed.noReplyWindowMinutes * 60 * 1000;
        const replied = await contactRepliedSince(claimed.workspaceId, claimed.contactId, Date.now() - windowMs);
        if (replied) {
          await ref.update({
            status: "skipped_replied",
            updatedAt: new Date().toISOString(),
            result: { sent: 0, failed: 0, skipped: true },
          });
          skipped++;
          logger.info("Scheduled push skipped: contact replied", { scheduleId: snap.id });
          continue;
        }
      }
      const tokens = await resolveTokens(claimed.workspaceId, {
        contactId: claimed.contactId ?? undefined,
        tags: claimed.tags,
      });
      if (tokens.length === 0) {
        await ref.update({
          status: "skipped_replied",
          updatedAt: new Date().toISOString(),
          result: { sent: 0, failed: 0, skipped: true },
        });
        skipped++;
        continue;
      }
      const result = await fanoutPush(
        claimed.workspaceId,
        {
          title: claimed.title, body: claimed.body,
          linkType: claimed.linkType, linkValue: claimed.linkValue, image: claimed.image,
        },
        tokens,
      );
      await ref.update({
        status: "sent",
        updatedAt: new Date().toISOString(),
        result: { sent: result.sent, failed: result.failed },
      });
      sent++;
    } catch (e) {
      await ref.update({
        status: "failed",
        updatedAt: new Date().toISOString(),
        result: { sent: 0, failed: 0 },
      });
      logger.error("Scheduled push failed", { scheduleId: snap.id, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return { checked: due.size, sent, skipped };
}

// ---------------------------------------------------------------------------
// Shared helpers for other modules (booking reminders, owner alerts, BotMaps)
// ---------------------------------------------------------------------------

/** Tokens for one contact (booking reminders, BotMaps sends). */
export async function pushTokensForContact(workspaceId: string, contactId: string): Promise<string[]> {
  if (!contactId) return [];
  return resolveTokens(workspaceId, { contactId });
}

/**
 * Send a push notification to a contact. Used by booking reminders and the
 * BotMaps "Send push" action. Returns false when the contact has no push
 * subscription so callers can fall back to another channel.
 */
export async function sendPushToContact(
  workspaceId: string,
  contactId: string,
  payload: PushPayload,
): Promise<boolean> {
  const tokens = await pushTokensForContact(workspaceId, contactId);
  if (tokens.length === 0) return false;
  const vapid = await getVapidKey();
  if (!vapid) return false;
  await fanoutPush(workspaceId, payload, tokens);
  return true;
}

/**
 * Push alert to workspace owners who enabled browser alerts in the app.
 * Hook point for dead channel reconnect alerts (see docs/meta-connection-guide.md).
 */
export async function sendOwnerPushAlert(
  workspaceId: string,
  payload: PushPayload,
): Promise<boolean> {
  const tokens = await resolveTokens(workspaceId, { role: "owner" });
  if (tokens.length === 0) return false;
  const vapid = await getVapidKey();
  if (!vapid) return false;
  await fanoutPush(workspaceId, payload, tokens);
  return true;
}

/**
 * Workspace membership check (mirrors the one in index.ts; kept local so this
 * module stays self-contained). Super Admins bypass; anyone else must be a
 * workspace member.
 */
async function requirePushWorkspaceAccess(
  uid: string,
  workspaceId: string,
  token: unknown,
): Promise<void> {
  if ((token as { superadmin?: boolean } | undefined)?.superadmin === true) return;
  const membersCol = db().collection("workspaces").doc(workspaceId).collection("members");
  const member = await membersCol.doc(uid).get();
  if (member.exists) return;
  const ws = await db().collection("workspaces").doc(workspaceId).get();
  if (!ws.exists) {
    throw new HttpsError("permission-denied", "Not a member of this workspace.");
  }
  const first = await membersCol.limit(1).get();
  await membersCol.doc(uid).set({
    uid,
    role: first.empty ? "owner" : "member",
    createdAt: new Date().toISOString(),
  });
}
