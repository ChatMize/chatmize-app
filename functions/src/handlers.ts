import { NormalizedMessage } from "./store";

interface MetaEntry {
  id?: string;
  time?: number;
  messaging?: Array<{
    sender?: { id?: string };
    recipient?: { id?: string };
    timestamp?: number;
    message?: {
      mid?: string;
      text?: string;
      is_echo?: boolean;
      // One-tap quick replies (user_phone_number / user_email): Meta puts
      // the captured value in quick_reply.payload.
      quick_reply?: { payload?: string };
    };
  }>;
  changes?: Array<{
    field?: string;
    value?: {
      from?: { id?: string };
      id?: string;
      text?: string;
      timestamp?: string;
      // WhatsApp Cloud API: value.messages[] + value.metadata.phone_number_id
      metadata?: { phone_number_id?: string; display_phone_number?: string };
      messages?: Array<{
        from?: string;
        id?: string;
        timestamp?: string;
        type?: string;
        text?: { body?: string };
      }>;
    };
  }>;
  messages?: Array<{
    from?: string;
    id?: string;
    timestamp?: string;
    type?: string;
    text?: { body?: string };
  }>;
}

/**
 * Normalize a Meta webhook entry into inbound messages.
 * Supports: Messenger page events, Instagram messaging events, and
 * WhatsApp Business Cloud API message notifications.
 *
 * @param object the top-level `object` field of the webhook body
 *   ("page" for Messenger, "instagram" for Instagram, "whatsapp_business_account").
 */
export function normalizeEntry(entry: MetaEntry, object: string): NormalizedMessage[] {
  const out: NormalizedMessage[] = [];
  const channel = object === "instagram" ? "instagram" : "messenger";

  for (const m of entry.messaging ?? []) {
    // Skip echoes of our own outbound sends so a reply never lands
    // back in the inbox as a new inbound message.
    if (m.message?.is_echo) continue;
    const senderId = m.sender?.id;
    const mid = m.message?.mid;
    if (!senderId || !mid) continue;
    out.push({
      channel,
      senderId,
      recipientId: m.recipient?.id ?? "",
      externalId: mid,
      text: m.message?.text,
      quickReplyPayload: m.message?.quick_reply?.payload,
      timestampMs: m.timestamp ?? Date.now(),
      raw: m,
    });
  }

  for (const c of entry.changes ?? []) {
    if (c.field !== "messages") continue;
    const v = c.value;
    // WhatsApp Cloud API: messages live in value.messages[] with the phone
    // number id in value.metadata (entry.id is the WABA id).
    if (object === "whatsapp_business_account") {
      const phoneNumberId = v?.metadata?.phone_number_id ?? entry.id ?? "";
      for (const w of v?.messages ?? []) {
        if (!w.from || !w.id) continue;
        out.push({
          channel: "whatsapp",
          senderId: w.from,
          recipientId: phoneNumberId,
          externalId: w.id,
          text: w.text?.body,
          timestampMs: w.timestamp ? Number(w.timestamp) * 1000 : Date.now(),
          raw: w,
        });
      }
      continue;
    }
    const from = v?.from?.id;
    const id = v?.id;
    if (!from || !id) continue;
    out.push({
      channel: "instagram",
      senderId: from,
      recipientId: entry.id ?? "",
      externalId: id,
      text: v?.text,
      timestampMs: v?.timestamp ? Number(v.timestamp) * 1000 : Date.now(),
      raw: c,
    });
  }

  for (const w of entry.messages ?? []) {
    const from = w.from;
    const id = w.id;
    if (!from || !id) continue;
    out.push({
      channel: "whatsapp",
      senderId: from,
      recipientId: entry.id ?? "",
      externalId: id,
      text: w.text?.body,
      timestampMs: w.timestamp ? Number(w.timestamp) * 1000 : Date.now(),
      raw: w,
    });
  }

  return out;
}
