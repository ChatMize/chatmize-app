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

/**
 * NOTE: Instagram's API does not allow fetching the profile (name/photo) of
 * someone who sends a DM to a business account. This is a Meta privacy
 * restriction, not a code issue. The contact shows as "Instagram User" with
 * the Instagram icon; users can rename it manually via Edit Info in the UI.
 * (Messenger via Facebook Page CAN fetch profiles using the Page token.)
 */

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
  // NOTE: We cannot fetch the IG sender's name/photo (Meta privacy restriction).
  // The contact shows as "Instagram User"; rename manually via Edit Info.
  const contactId = `contact_${msg.channel}_${msg.senderId}`;
  const contactRef = db().collection("contacts").doc(contactId);

  const displayName = msg.channel === "instagram" ? "Instagram User"
    : msg.channel === "messenger" ? "Messenger User"
    : msg.channel === "whatsapp" ? "WhatsApp User"
    : "Web User";

  batch.set(
    contactRef,
    {
      id: contactId,
      name: displayName,
      firstName: displayName,
      channel: msg.channel,
      senderId: msg.senderId,
      lastMessageAt: FieldValue.serverTimestamp(),
      lastMessageText: msg.text ?? "",
      lastInteractionAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
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
