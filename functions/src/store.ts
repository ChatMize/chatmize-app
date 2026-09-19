import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { logger } from "firebase-functions";

export type Channel = "messenger" | "instagram" | "whatsapp";

export interface NormalizedMessage {
  channel: Channel;
  /** Page-scoped (PSID), Instagram-scoped (IGSID), or WhatsApp sender id. */
  senderId: string;
  /** The Meta Page / IG business account / WhatsApp number id that received it. */
  recipientId: string;
  /** Meta message id for idempotency. */
  externalId: string;
  text?: string;
  /** One-tap quick-reply payload (user_phone_number / user_email value). */
  quickReplyPayload?: string;
  timestampMs: number;
  raw: unknown;
}

const db = () => getFirestore("chatmize-prod");

const PROJECT_ID = "gen-lang-client-0433776094";

/**
 * Fetch the sender's profile (name, photo) using the workspace's Page token.
 * For Instagram/Messenger DMs, the Page token can look up the sender's IGSID/PSID.
 */
async function fetchSenderProfile(
  workspaceId: string,
  senderId: string,
  channel: Channel,
): Promise<{ name?: string; avatarUrl?: string }> {
  try {
    // Get the Page token secret name from the meta integration
    const integSnap = await db()
      .collection("workspaces")
      .doc(workspaceId)
      .collection("integrations")
      .doc("meta")
      .get();
    if (!integSnap.exists) return {};
    const integData = integSnap.data()!;
    const secretName = integData.secretName as string | undefined;
    if (!secretName) return {};

    // Get the Page token from Secret Manager
    const { GoogleAuth } = await import("google-auth-library");
    const auth = new GoogleAuth({
      scopes: ["https://www.googleapis.com/auth/cloud-platform"],
    });
    const client = await auth.getClient();
    const gtoken = await client.getAccessToken();
    const res = await fetch(
      `https://secretmanager.googleapis.com/v1/projects/${PROJECT_ID}/secrets/${secretName}/versions/latest:access`,
      { headers: { Authorization: `Bearer ${gtoken.token}` } },
    );
    if (!res.ok) return {};
    const data = (await res.json()) as { payload?: { data?: string } };
    const payload = data.payload?.data;
    if (!payload) return {};
    const pageToken = Buffer.from(payload, "base64").toString("utf8");

    // Fetch the sender's profile via Facebook Graph API
    // For Instagram: IGSID works with Page token that has instagram_manage_messages
    // For Messenger: PSID works with Page token
    const profileRes = await fetch(
      `https://graph.facebook.com/v18.0/${senderId}?fields=id,name,username,first_name,last_name,profile_pic&access_token=${encodeURIComponent(pageToken)}`,
    );
    if (!profileRes.ok) {
      const errText = await profileRes.text();
      logger.warn("Profile fetch failed", { senderId, status: profileRes.status, error: errText.slice(0, 200) });
      return {};
    }
    const profile = (await profileRes.json()) as {
      name?: string;
      username?: string;
      first_name?: string;
      last_name?: string;
      profile_pic?: string;
    };
    const name = profile.name
      || (profile.first_name ? `${profile.first_name} ${profile.last_name || ""}`.trim() : undefined)
      || profile.username;
    return {
      name,
      avatarUrl: profile.profile_pic,
    };
  } catch (e) {
    logger.warn("Failed to fetch sender profile", { senderId, error: String(e) });
    return {};
  }
}

/**
 * Upsert the conversation and append the inbound message.
 * Document ids are deterministic (channel + sender) so retries and
 * duplicate webhook deliveries are naturally idempotent.
 */
export async function persistInboundMessage(
  workspaceId: string,
  msg: NormalizedMessage,
): Promise<void> {
  const convoId = `${msg.channel}_${msg.senderId}`;
  const convoRef = db()
    .collection("workspaces")
    .doc(workspaceId)
    .collection("conversations")
    .doc(convoId);
  const messageRef = convoRef.collection("messages").doc(msg.externalId);

  const already = await messageRef.get();
  if (already.exists) {
    logger.info("Duplicate webhook delivery ignored", { externalId: msg.externalId });
    return;
  }

  const batch = db().batch();
  batch.set(
    convoRef,
    {
      channel: msg.channel,
      senderId: msg.senderId,
      recipientId: msg.recipientId,
      lastMessageAt: FieldValue.serverTimestamp(),
      lastMessageText: msg.text ?? "",
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  batch.set(messageRef, {
    direction: "inbound",
    channel: msg.channel,
    senderId: msg.senderId,
    text: msg.text ?? "",
    quickReplyPayload: msg.quickReplyPayload ?? null,
    timestampMs: msg.timestampMs,
    externalId: msg.externalId,
    createdAt: FieldValue.serverTimestamp(),
  });
  // Upsert the contact so the inbox UI (which lists contacts) shows the conversation.
  // NOTE: UI reads from root `contacts` collection (not workspace subcollection).
  // NOTE: the contact/message batch commits FIRST with a fallback display name.
  // The sender profile fetch (Secret Manager + Graph API, several slow network
  // hops) used to block the batch and delayed inbox updates by ~a minute.
  // It now runs after the commit and merges name/avatar when it lands.
  const contactId = `contact_${msg.channel}_${msg.senderId}`;
  const contactRef = db().collection("contacts").doc(contactId);

  const fallbackName =
    msg.channel === "instagram" ? "Instagram User"
    : msg.channel === "messenger" ? "Messenger User"
    : msg.channel === "whatsapp" ? "WhatsApp User"
    : "Web User";

  const contactData: Record<string, unknown> = {
    id: contactId,
    name: fallbackName,
    firstName: fallbackName,
    channel: msg.channel,
    senderId: msg.senderId,
    lastMessageAt: FieldValue.serverTimestamp(),
    lastMessageText: msg.text ?? "",
    lastInteractionAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  batch.set(contactRef, contactData, { merge: true });
  await batch.commit();

  // Contact capture: if a BotMaps capture block armed pendingCapture on
  // this conversation, treat this inbound message as the answer (one-tap
  // quick reply or typed text), validate, and save to the contact.
  // Dynamic import avoids a module cycle (contactCapture -> channelSend).
  try {
    const { handleContactCapture } = await import("./contactCapture.js");
    await handleContactCapture(workspaceId, msg);
  } catch (err) {
    logger.warn("Contact capture hook failed", {
      workspaceId,
      err: err instanceof Error ? err.message : String(err),
    });
  }

  // Background profile enrichment: never blocks the inbox.
  fetchSenderProfile(workspaceId, msg.senderId, msg.channel)
    .then((profile) => {
      if (!profile.name && !profile.avatarUrl) return;
      const enrichment: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
      if (profile.name) {
        enrichment.name = profile.name;
        enrichment.firstName = profile.name;
      }
      if (profile.avatarUrl) enrichment.avatarUrl = profile.avatarUrl;
      return contactRef.set(enrichment, { merge: true });
    })
    .catch((e) => logger.warn("Background profile enrichment failed", { senderId: msg.senderId, error: String(e) }));
}

/** Park a webhook event that failed processing so it can be retried/inspected. */
export async function parkDeadLetter(
  workspaceId: string,
  reason: string,
  payload: unknown,
): Promise<void> {
  await db()
    .collection("workspaces")
    .doc(workspaceId)
    .collection("webhook_dead_letter")
    .add({
      reason,
      payload,
      createdAt: FieldValue.serverTimestamp(),
      status: "pending_retry",
    });
}

/** Park a webhook event that could not be routed to any workspace. */
export async function parkGlobalDeadLetter(
  reason: string,
  payload: unknown,
): Promise<void> {
  await db().collection("webhook_dead_letter").add({
    reason,
    payload,
    createdAt: FieldValue.serverTimestamp(),
    status: "pending_retry",
  });
}

/** Record an outbound send attempt and its Meta result.
 * This is the single writer for outbound thread persistence: the frontend
 * must NOT also write the message, or the thread shows duplicates.
 * timestampMs is required so the inbox orderBy('timestampMs') sorts correctly
 * (docs missing it sort first and appear at the top of the thread).
 * clientMessageId lets the frontend reconcile its optimistic message with
 * this persisted doc instead of flashing a duplicate. */
export async function recordOutboundMessage(
  workspaceId: string,
  channel: Channel,
  recipientId: string,
  text: string,
  metaMessageId: string | null,
  ok: boolean,
  error?: string,
  clientMessageId?: string | null,
): Promise<void> {
  const convoId = `${channel}_${recipientId}`;
  const convoRef = db()
    .collection("workspaces")
    .doc(workspaceId)
    .collection("conversations")
    .doc(convoId);
  const batch = db().batch();
  batch.set(
    convoRef,
    {
      channel,
      senderId: recipientId,
      lastMessageAt: FieldValue.serverTimestamp(),
      lastMessageText: text,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  batch.set(convoRef.collection("messages").doc(), {
    direction: "outbound",
    channel,
    senderId: recipientId,
    text,
    ok,
    error: error ?? null,
    externalId: metaMessageId,
    timestampMs: Date.now(),
    clientId: clientMessageId ?? null,
    createdAt: FieldValue.serverTimestamp(),
  });
  await batch.commit();
}
