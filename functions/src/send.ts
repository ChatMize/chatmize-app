import { Channel } from "./store";

const GRAPH_VERSION = "v21.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;
const IG_GRAPH_BASE = `https://graph.instagram.com/${GRAPH_VERSION}`;

export interface SendResult {
  ok: boolean;
  metaMessageId: string | null;
  error?: string;
}

async function postJson(
  url: string,
  accessToken: string,
  body: Record<string, unknown>,
): Promise<SendResult> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as {
      message_id?: string;
      messages?: Array<{ id?: string }>;
      error?: { message?: string; code?: number };
    };
    if (!res.ok) {
      return {
        ok: false,
        metaMessageId: null,
        error: data.error?.message ?? `Graph API HTTP ${res.status}`,
      };
    }
    return {
      ok: true,
      metaMessageId: data.message_id ?? data.messages?.[0]?.id ?? null,
    };
  } catch (err) {
    return {
      ok: false,
      metaMessageId: null,
      error: err instanceof Error ? err.message : "network error",
    };
  }
}

/** Send a Messenger message via the page access token. */
export interface QuickReply {
  content_type: "text";
  title: string;
  payload: string;
}

/**
 * Sanitize raw quick reply titles into Meta quick_reply objects.
 * Meta limits: max 13 replies, 20 chars per title. Quick replies are a
 * Meta-channel feature and must ride on a text message (Messenger docs:
 * "add the quick_replies array to a text message"; Instagram docs:
 * "Quick replies only support plain text").
 */
export function toQuickReplies(titles: string[] | undefined | null): QuickReply[] {
  if (!titles || titles.length === 0) return [];
  return titles
    .map((t) => (typeof t === "string" ? t.trim() : ""))
    .filter((t) => t.length > 0)
    .slice(0, 13)
    .map((t) => ({
      content_type: "text" as const,
      title: t.slice(0, 20),
      payload: t.slice(0, 1000),
    }));
}

/** Send a Messenger text message via the page access token. */
export function sendMessengerMessage(
  pageAccessToken: string,
  psid: string,
  text: string,
  quickReplies?: QuickReply[],
): Promise<SendResult> {
  return postJson(`${GRAPH_BASE}/me/messages`, pageAccessToken, {
    recipient: { id: psid },
    messaging_type: "RESPONSE",
    message: {
      text,
      ...(quickReplies && quickReplies.length > 0 ? { quick_replies: quickReplies } : {}),
    },
  });
}

/** Attachment types Meta accepts for Messenger and Instagram DMs. */
export type MediaAttachmentType = "video" | "audio" | "image";

/**
 * Send a Messenger media attachment (video, audio, or image) via the page
 * access token. The URL must be publicly fetchable by Meta's servers —
 * Firebase Storage download URLs (with their unguessable token) qualify.
 */
export function sendMessengerMedia(
  pageAccessToken: string,
  psid: string,
  mediaUrl: string,
  mediaType: MediaAttachmentType,
): Promise<SendResult> {
  return postJson(`${GRAPH_BASE}/me/messages`, pageAccessToken, {
    recipient: { id: psid },
    messaging_type: "RESPONSE",
    message: {
      attachment: {
        type: mediaType,
        payload: { url: mediaUrl, is_reusable: true },
      },
    },
  });
}

/** Send an Instagram DM via the linked page access token. */
export function sendInstagramMessage(
  pageAccessToken: string,
  igsid: string,
  text: string,
  quickReplies?: QuickReply[],
): Promise<SendResult> {
  return postJson(`${GRAPH_BASE}/me/messages`, pageAccessToken, {
    recipient: { id: igsid },
    message: {
      text,
      ...(quickReplies && quickReplies.length > 0 ? { quick_replies: quickReplies } : {}),
    },
  });
}

/**
 * Send an Instagram media attachment (video or audio, per Meta's Messaging
 * API) via the linked page access token on graph.facebook.com.
 */
export function sendInstagramMedia(
  pageAccessToken: string,
  igsid: string,
  mediaUrl: string,
  mediaType: MediaAttachmentType,
): Promise<SendResult> {
  return postJson(`${GRAPH_BASE}/me/messages`, pageAccessToken, {
    recipient: { id: igsid },
    message: {
      attachment: {
        type: mediaType,
        payload: { url: mediaUrl, is_reusable: true },
      },
    },
  });
}

/**
 * Send an Instagram DM via an Instagram Login (IG-only) user token.
 * IGSIDs are scoped to the app that received them, so a conversation that
 * arrived through the standalone Instagram connection can only be answered
 * with that connection's token. Never log the token.
 */
export function sendInstagramDirectMessage(
  igAccessToken: string,
  igsid: string,
  text: string,
  quickReplies?: QuickReply[],
): Promise<SendResult> {
  return postJson(`${IG_GRAPH_BASE}/me/messages`, igAccessToken, {
    recipient: { id: igsid },
    message: {
      text,
      ...(quickReplies && quickReplies.length > 0 ? { quick_replies: quickReplies } : {}),
    },
  });
}

/**
 * Send an Instagram media attachment via an Instagram Login (IG-only) user
 * token on graph.instagram.com. Same attachment shape as the page-anchored
 * path; IGSIDs stay scoped to the connection that received them.
 */
export function sendInstagramDirectMedia(
  igAccessToken: string,
  igsid: string,
  mediaUrl: string,
  mediaType: MediaAttachmentType,
): Promise<SendResult> {
  return postJson(`${IG_GRAPH_BASE}/me/messages`, igAccessToken, {
    recipient: { id: igsid },
    message: {
      attachment: {
        type: mediaType,
        payload: { url: mediaUrl, is_reusable: true },
      },
    },
  });
}

/** Send a WhatsApp text message via the Cloud API. */
export function sendWhatsappMessage(
  whatsappToken: string,
  phoneNumberId: string,
  to: string,
  text: string,
): Promise<SendResult> {
  return postJson(`${GRAPH_BASE}/${phoneNumberId}/messages`, whatsappToken, {
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: { body: text },
  });
}

export const CHANNEL_SENDERS: Record<
  Channel,
  (
    token: string,
    recipientId: string,
    text: string,
    phoneNumberId?: string,
  ) => Promise<SendResult>
> = {
  messenger: (token, recipientId, text) => sendMessengerMessage(token, recipientId, text),
  instagram: (token, recipientId, text) => sendInstagramMessage(token, recipientId, text),
  whatsapp: (token, recipientId, text, phoneNumberId) =>
    sendWhatsappMessage(token, phoneNumberId ?? "", recipientId, text),
};
