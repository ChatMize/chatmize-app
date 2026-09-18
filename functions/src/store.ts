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
  timestampMs: number;
  raw: unknown;
}

const db = () => getFirestore("chatmize-prod");

const PROJECT_ID = "gen-lang-client-0433776094";

/** Fetch the IG sender's public profile (name, username, pic) for the contact card. */
async function fetchInstagramSenderProfile(
  workspaceId: string,
  senderId: string,
): Promise<{ name?: string; username?: string; avatarUrl?: string }> {
  try {
    const { GoogleAuth } = await import("google-auth-library");
    const auth = new GoogleAuth({
      scopes: ["https://www.googleapis.com/auth/cloud-platform"],
    });
    const client = await auth.getClient();
    const gtoken = await client.getAccessToken();
    const safe = workspaceId.toUpperCase().replace(/[^A-Z0-9_]/g, "_").slice(0, 100);
    const secretName = `IG_TOKEN_WS_${safe}`;
    const res = await fetch(
      `https://secretmanager.googleapis.com/v1/projects/${PROJECT_ID}/secrets/${secretName}/versions/latest:access`,
      { headers: { Authorization: `Bearer ${gtoken.token}` } },
    );
    if (!res.ok) return {};
    const data = (await res.json()) as { payload?: { data?: string } };
    const payload = data.payload?.data;
    if (!payload) return {};
    const igToken = Buffer.from(payload, "base64").toString("utf8");

    // Try the Instagram Graph API for the sender's profile
    const profileRes = await fetch(
      `https://graph.instagram.com/${senderId}?fields=id,username,name,profile_picture_url&access_token=${encodeURIComponent(igToken)}`,
    );
    if (!profileRes.ok) return {};
    const profile = (await profileRes.json()) as {
      username?: string;
      name?: string;
      profile_picture_url?: string;
    };
    return {
      name: profile.name || profile.username,
      username: profile.username,
      avatarUrl: profile.profile_picture_url,
    };
  } catch (e) {
    logger.warn("Failed to fetch IG sender profile", { senderId, error: String(e) });
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
    timestampMs: msg.timestampMs,
    externalId: msg.externalId,
    createdAt: FieldValue.serverTimestamp(),
  });
  // Upsert the contact so the inbox UI (which lists contacts) shows the conversation.
  // NOTE: UI reads from root `contacts` collection (not workspace subcollection).
  const contactId = `contact_${msg.channel}_${msg.senderId}`;
  const contactRef = db().collection("contacts").doc(contactId);

  // Fetch the sender's real profile (name, pic) for Instagram/Messenger.
  let profileName = "Instagram User";
  let avatarUrl: string | undefined;
  if (msg.channel === "instagram") {
    const profile = await fetchInstagramSenderProfile(workspaceId, msg.senderId);
    if (profile.name) profileName = profile.name;
    if (profile.avatarUrl) avatarUrl = profile.avatarUrl;
  }

  const contactData: Record<string, unknown> = {
    id: contactId,
    name: profileName,
    firstName: profileName,
    channel: msg.channel,
    senderId: msg.senderId,
    lastMessageAt: FieldValue.serverTimestamp(),
    lastMessageText: msg.text ?? "",
    lastInteractionAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (avatarUrl) contactData.avatarUrl = avatarUrl;

  batch.set(contactRef, contactData, { merge: true });
  await batch.commit();
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

/** Record an outbound send attempt and its Meta result. */
export async function recordOutboundMessage(
  workspaceId: string,
  channel: Channel,
  recipientId: string,
  text: string,
  metaMessageId: string | null,
  ok: boolean,
  error?: string,
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
    createdAt: FieldValue.serverTimestamp(),
  });
  await batch.commit();
}
