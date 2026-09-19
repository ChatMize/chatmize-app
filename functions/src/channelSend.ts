/**
 * Shared Meta-channel send pipeline (Messenger / Instagram / WhatsApp).
 *
 * This is the exact production pipeline previously embedded in the
 * sendChannelMessage callable: token self-heal per connection, IG route
 * resolution (IG-only vs Page anchor), personalization tag resolution,
 * provider send, single-writer outbound persistence, and token-invalid
 * handling with owner notification.
 *
 * Both the Firebase callable (index.ts) and the MCP server call this —
 * there is exactly one send path.
 */
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import {
  WHATSAPP_TOKEN_DEFAULT,
  WHATSAPP_PHONE_NUMBER_ID,
  META_PAGE_TOKEN_DEFAULT,
} from "./secrets";
import {
  resolvePageToken,
  ensureFreshPageToken,
} from "./metaOAuth";
import {
  getIgToken,
  ensureFreshIgToken,
  markIgTokenInvalid,
} from "./instagramOAuth";
import {
  CHANNEL_SENDERS,
  sendInstagramMessage,
  sendInstagramDirectMessage,
  sendMessengerMedia,
  sendInstagramMedia,
  sendInstagramDirectMedia,
  MediaAttachmentType,
} from "./send";
import {
  resolvePersonalizationTags,
  getContactForRecipient,
} from "./personalization";
import { recordOutboundMessage, Channel } from "./store";

const db = () => getFirestore("chatmize-prod");

export type ChannelSendErrorCode =
  | "invalid-argument"
  | "failed-precondition"
  | "permission-denied"
  | "resource-exhausted"
  | "internal";

/** Plain error (no Firebase dependency) so non-callable callers can use it. */
export class ChannelSendError extends Error {
  code: ChannelSendErrorCode;
  constructor(code: ChannelSendErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

/** Meta error text means the page token is dead (not a transient send error). */
export function isMetaTokenError(error: string | undefined): boolean {
  if (!error) return false;
  return /error validating access token|session has been invalidated|session has expired|invalid oauth access token/i.test(
    error,
  );
}

/** Meta rejected the recipient because the IGSID is scoped to a different
 * app/connection than the token used (Graph error 100 / subcode 2018001). */
export function isWrongScopeRecipientError(error: string | undefined): boolean {
  if (!error) return false;
  return /no matching user found/i.test(error);
}

export interface ChannelSendResult {
  ok: boolean;
  metaMessageId: string | null;
}

/** Optional media attachment for a send (bot builder video/audio/image). */
export interface ChannelMedia {
  url: string;
  type: MediaAttachmentType;
}

/**
 * Send one message through the workspace's connected Meta channels.
 * Throws ChannelSendError on validation / connection / provider failures.
 *
 * Either text or media (or both — the caption is dropped for attachment
 * sends today) must be provided.
 */
export async function sendChannelMessageInternal(
  workspaceId: string,
  channel: Channel,
  recipientId: string,
  text: string,
  clientMessageId?: string | null,
  media?: ChannelMedia | null,
): Promise<ChannelSendResult> {
  if (!workspaceId || !channel || !recipientId) {
    throw new ChannelSendError(
      "invalid-argument",
      "workspaceId, channel, and recipientId are required.",
    );
  }
  if (!text && !media?.url) {
    throw new ChannelSendError(
      "invalid-argument",
      "Provide message text, a media attachment, or both.",
    );
  }
  if (media?.url && !["video", "audio", "image"].includes(media.type)) {
    throw new ChannelSendError(
      "invalid-argument",
      `Unsupported media type: ${media.type}. Use video, audio, or image.`,
    );
  }
  if (media?.url && channel === "whatsapp") {
    throw new ChannelSendError(
      "failed-precondition",
      "Media attachments are not supported on WhatsApp yet. Send text instead.",
    );
  }
  if (!["messenger", "instagram", "whatsapp"].includes(channel)) {
    throw new ChannelSendError("invalid-argument", `Unsupported channel: ${channel}.`);
  }

  // Personalization: resolve {{tags}} against the recipient's contact
  // record so merge tags never go out as raw text.
  const contact = await getContactForRecipient(channel, recipientId);
  const resolvedText = resolvePersonalizationTags(text, contact);
  // What lands in the conversation log for an attachment send.
  const logText = media?.url ? `[${media.type} attachment] ${media.url}` : resolvedText;

  // Token self-heal, per connection:
  // - Messenger always runs on the Page token.
  // - Instagram is answered with the token of the connection that received
  //   the conversation (IG-only token on graph.instagram.com, or the Page
  //   token on graph.facebook.com), because IGSIDs are app-scoped.
  let result;
  let igRoute: "ig" | "page" | null = null;
  if (channel === "whatsapp") {
    result = await CHANNEL_SENDERS[channel](
      WHATSAPP_TOKEN_DEFAULT.value(),
      recipientId,
      resolvedText,
      WHATSAPP_PHONE_NUMBER_ID.value(),
    );
  } else if (channel === "instagram") {    igRoute = await resolveInstagramRoute(workspaceId, recipientId);
    if (igRoute === null) {
      throw new ChannelSendError(
        "failed-precondition",
        "Instagram is not connected. Connect it in Settings under Channels, then send again.",
      );
    }
    if (igRoute === "ig") {
      const health = await ensureFreshIgToken(workspaceId);
      if (health === "invalid") {
        throw new ChannelSendError(
          "failed-precondition",
          "The Instagram connection expired. Reconnect it in Settings under Channels, then send again.",
        );
      }
      if (health === "unconnected") {
        throw new ChannelSendError(
          "failed-precondition",
          "Instagram is not connected. Connect it in Settings under Channels, then send again.",
        );
      }
      const igToken = await getIgToken(workspaceId);
      if (!igToken) {
        throw new ChannelSendError(
          "failed-precondition",
          "Could not read the Instagram token. Reconnect Instagram in Settings under Channels, then send again.",
        );
      }
      result = media?.url
        ? await sendInstagramDirectMedia(igToken, recipientId, media.url, media.type)
        : await sendInstagramDirectMessage(igToken, recipientId, resolvedText);
    } else {
      const health = await ensureFreshPageToken(workspaceId);
      if (health === "invalid") {
        throw new ChannelSendError(
          "failed-precondition",
          "The Facebook page connection expired. Reconnect it in Settings under Channels, then send again.",
        );
      }
      const pageToken = await resolvePageToken(workspaceId, META_PAGE_TOKEN_DEFAULT.value());
      result = media?.url
        ? await sendInstagramMedia(pageToken, recipientId, media.url, media.type)
        : await sendInstagramMessage(pageToken, recipientId, resolvedText);
    }
  } else {
    const health = await ensureFreshPageToken(workspaceId);
    if (health === "invalid") {
      throw new ChannelSendError(
        "failed-precondition",
        "The Facebook page connection expired. Reconnect it in Settings under Channels, then send again.",
      );
    }
    const pageToken = await resolvePageToken(workspaceId, META_PAGE_TOKEN_DEFAULT.value());
    result = media?.url
      ? await sendMessengerMedia(pageToken, recipientId, media.url, media.type)
      : await CHANNEL_SENDERS[channel](pageToken, recipientId, resolvedText);
  }

  await recordOutboundMessage(
    workspaceId,
    channel,
    recipientId,
    logText,
    result.metaMessageId,
    result.ok,
    result.error,
    clientMessageId ?? null,
  );

  if (!result.ok) {
    logger.error("Outbound send failed", { workspaceId, channel, error: result.error });
    if (isWrongScopeRecipientError(result.error)) {
      // The recipient id belongs to a different Meta app/connection than
      // the token used. Once the contact messages again, the reply will
      // route through the right connection.
      throw new ChannelSendError(
        "failed-precondition",
        "This conversation arrived through a different connection, so Meta rejected the reply. When the contact messages you again, the reply will go through.",
      );
    }
    if (isMetaTokenError(result.error)) {
      if (channel === "instagram" && igRoute === "ig") {
        // Reactive catch for the IG-only path: flag the IG integration so
        // the UI prompts an Instagram reconnect instead of a bare failure.
        await markIgTokenInvalid(workspaceId, result.error ?? "Send failed.");
        throw new ChannelSendError(
          "failed-precondition",
          "The Instagram connection expired. Reconnect it in Settings under Channels, then send again.",
        );
      }
      // Reactive catch: the token died between health checks. Flag the
      // integration so the UI prompts a reconnect instead of a bare failure.
      await db()
        .collection("workspaces")
        .doc(workspaceId)
        .collection("integrations")
        .doc("meta")
        .set(
          {
            status: "token_invalid",
            tokenInvalidAt: FieldValue.serverTimestamp(),
            tokenInvalidReason: result.error,
          },
          { merge: true },
        );
      // Fire-and-forget owner email; never breaks the send path.
      const { notifyOwnerReconnect } = await import("./notifications.js");
      void notifyOwnerReconnect(workspaceId, "meta");
      throw new ChannelSendError(
        "failed-precondition",
        "The Facebook page connection expired. Reconnect it in Settings under Channels, then send again.",
      );
    }
    throw new ChannelSendError("internal", result.error ?? "Send failed.");
  }
  logger.info("Outbound send ok", { workspaceId, channel, metaMessageId: result.metaMessageId });
  return { ok: true, metaMessageId: result.metaMessageId };
}

/**
 * Decide which token answers an Instagram conversation.
 *
 * IGSIDs are scoped to the Meta app that received them, so each conversation
 * must be answered with the token of the connection that received it:
 * - "ig": the conversation arrived through the IG-only connection
 *   (ChatMize-IG app) -> send with the IG user token on graph.instagram.com.
 * - "page": the conversation arrived through the Facebook-anchored linked
 *   Instagram account (or the IG-only connection was upgraded to the Page
 *   anchor) -> send with the Page token on graph.facebook.com as before.
 * - null: no Instagram connection is live on this workspace.
 */
export async function resolveInstagramRoute(
  workspaceId: string,
  recipientId: string,
): Promise<"ig" | "page" | null> {
  const integRef = db()
    .collection("workspaces")
    .doc(workspaceId)
    .collection("integrations");
  const convoRef = db()
    .collection("workspaces")
    .doc(workspaceId)
    .collection("conversations")
    .doc(`instagram_${recipientId}`);
  const [convoSnap, igSnap, metaSnap] = await Promise.all([
    convoRef.get(),
    integRef.doc("instagram").get(),
    integRef.doc("meta").get(),
  ]);
  const accountId =
    (convoSnap.data() as { recipientId?: string } | undefined)?.recipientId ??
    null;
  const ig = igSnap.data() as
    | {
        status?: string;
        igUserId?: string;
        anchoredViaPage?: boolean;
        anchoredPageId?: string;
      }
    | undefined;
  const meta = metaSnap.data() as
    | { status?: string; pageId?: string; instagram?: { id?: string } }
    | undefined;
  const igConnected = ig?.status === "connected" && !!ig.igUserId;
  const pageIgId =
    meta?.status === "connected" ? (meta.instagram?.id ?? null) : null;

  // Upgraded anchor: the IG-only connection was re-anchored to the Page
  // anchor, so its conversations now go out on the Page token.
  if (
    igConnected &&
    ig.anchoredViaPage &&
    pageIgId &&
    pageIgId === ig.igUserId &&
    ig.anchoredPageId === meta?.pageId
  ) {
    return "page";
  }
  if (accountId) {
    if (igConnected && accountId === ig.igUserId) return "ig";
    if (pageIgId && accountId === pageIgId) return "page";
  }
  // Fallback when the conversation is unknown: prefer the IG-only
  // connection, otherwise the Page anchor.
  if (igConnected) return "ig";
  if (pageIgId || meta?.status === "connected") return "page";
  return null;
}
