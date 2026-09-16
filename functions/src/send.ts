import { Channel } from "./store";

const GRAPH_VERSION = "v21.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

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
export function sendMessengerMessage(
  pageAccessToken: string,
  psid: string,
  text: string,
): Promise<SendResult> {
  return postJson(`${GRAPH_BASE}/me/messages`, pageAccessToken, {
    recipient: { id: psid },
    messaging_type: "RESPONSE",
    message: { text },
  });
}

/** Send an Instagram DM via the linked page access token. */
export function sendInstagramMessage(
  pageAccessToken: string,
  igsid: string,
  text: string,
): Promise<SendResult> {
  return postJson(`${GRAPH_BASE}/me/messages`, pageAccessToken, {
    recipient: { id: igsid },
    message: { text },
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
