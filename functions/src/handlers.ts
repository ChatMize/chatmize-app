import { NormalizedMessage } from "./store";

interface MetaEntry {
  id?: string;
  time?: number;
  messaging?: Array<{
    sender?: { id?: string };
    recipient?: { id?: string };
    timestamp?: number;
    message?: { mid?: string; text?: string; is_echo?: boolean };
  }>;
  changes?: Array<{
    field?: string;
    value?: {
      from?: { id?: string };
      id?: string;
      text?: string;
      timestamp?: string;
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
      timestampMs: m.timestamp ?? Date.now(),
      raw: m,
    });
  }

  for (const c of entry.changes ?? []) {
    if (c.field !== "messages") continue;
    const v = c.value;
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
