/**
 * SMS via Twilio, Telnyx, and Bandwidth: sending, provisioning, opt-in
 * compliance, and logging.
 *
 * Twilio: ChatMize owns the account; each workspace gets a provisioned number.
 * Telnyx/Bandwidth: workspaces connect their own number from a ChatMize-owned
 * account (or their own account in a future BYOC phase); the provider choice
 * is stored per workspace. Message costs are covered by the plan's monthly
 * SMS allowance first, then by AI credits (8 credits per segment at face value).
 */
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { createVerify } from "crypto";
import {
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TELNYX_API_KEY,
  TELNYX_PUBLIC_KEY,
  BANDWIDTH_ACCOUNT_ID,
  BANDWIDTH_API_TOKEN,
  BANDWIDTH_API_SECRET,
} from "./secrets";
import { spendCredits } from "./credits";

export const SMS_CREDITS_PER_SEGMENT = 8;

/** Supported SMS providers. Twilio numbers are auto-provisioned; Telnyx and
 * Bandwidth numbers are connected manually (workspace provides the number,
 * ChatMize shows the webhook URL to configure in the provider dashboard). */
export type SmsProvider = "twilio" | "telnyx" | "bandwidth";

export const SMS_PROVIDERS: Array<{ id: SmsProvider; label: string; blurb: string }> = [
  { id: "twilio", label: "Twilio", blurb: "Auto-provisioned number, handled for you" },
  { id: "telnyx", label: "Telnyx", blurb: "Connect your Telnyx number" },
  { id: "bandwidth", label: "Bandwidth", blurb: "Connect your Bandwidth number" },
];

export interface SmsConnection {
  workspaceId: string;
  phoneNumber: string; // E.164
  provider: SmsProvider;
  /** Twilio number SID (twilio provider only). */
  twilioSid?: string;
  /** Provider-side identifier for the number (telnyx/bandwidth). */
  externalNumberId?: string;
  status: "provisioning" | "active" | "suspended";
  compliance: {
    /** 10DLC brand/campaign state. Toll-free numbers skip 10DLC. */
    tenDlc: "not_required" | "pending" | "approved";
    note: string;
  };
  monthlyAllowance: number;
  usedThisMonth: number;
  usageMonth: string; // YYYY-MM
  createdAt: string;
  updatedAt: string;
}

export interface SmsOptIn {
  workspaceId: string;
  phone: string; // E.164
  optedIn: boolean;
  source: string;
  optedInAt: string | null;
  optedOutAt: string | null;
  updatedAt: string;
}

const db = () => getFirestore("chatmize-prod");
const connRef = (workspaceId: string) => db().collection("sms_connections").doc(workspaceId);
const optInRef = (workspaceId: string, phone: string) =>
  db().collection("sms_optins").doc(`${workspaceId}_${phone}`);
const logRef = (workspaceId: string) => db().collection("sms_logs").doc(workspaceId).collection("entries");

// ---------------------------------------------------------------------------
// Phone + segment math
// ---------------------------------------------------------------------------

/** Normalize to E.164. Assumes NANP (+1) when given a 10-digit national number. */
export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (raw.startsWith("+") && digits.length >= 11 && digits.length <= 15) return `+${digits}`;
  return null;
}

const GSM7_BASIC =
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ\u001bÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
const GSM7_EXT = "^{}\\[~]|€";

function isGsm7(text: string): boolean {
  for (const ch of text) {
    if (GSM7_BASIC.includes(ch) || GSM7_EXT.includes(ch)) continue;
    return false;
  }
  return true;
}

/** Number of carrier segments a message will consume. */
export function calculateSegments(text: string): number {
  if (!text) return 0;
  const gsm = isGsm7(text);
  const singleLimit = gsm ? 160 : 70;
  const concatLimit = gsm ? 153 : 67;
  if (text.length <= singleLimit) return 1;
  return Math.ceil(text.length / concatLimit);
}

// ---------------------------------------------------------------------------
// Twilio REST
// ---------------------------------------------------------------------------

async function twilioApi(
  path: string,
  method: "GET" | "POST" = "POST",
  params: Record<string, string> = {},
): Promise<any> {
  const sid = TWILIO_ACCOUNT_SID.value();
  const token = TWILIO_AUTH_TOKEN.value();
  if (!sid || !token) throw new Error("Twilio credentials are not configured.");
  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}${path}`;
  const auth = Buffer.from(`${sid}:${token}`).toString("base64");
  const res = await fetch(url, {
    method,
    headers: {
Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: method === "POST" ? new URLSearchParams(params).toString() : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      `Twilio API ${res.status}: ${(data as any).message ?? "request failed"}`,
    );
  }
  return data;
}

/** Purchase a phone number and point its SMS webhook at our receiver. */
export async function provisionTwilioNumber(
  workspaceId: string,
  webhookUrl: string,
  areaCode?: string,
): Promise<{ phoneNumber: string; sid: string }> {
  const params: Record<string, string> = { SmsUrl: webhookUrl, SmsMethod: "POST" };
  let numberData: any;
  if (areaCode) {
    // Long code with a local area code.
    const search = await twilioApi("/AvailablePhoneNumbers/US/Local.json", "GET", {
      AreaCode: areaCode,
      SmsEnabled: "true",
    });
    const first = search?.available_phone_numbers?.[0];
    if (!first) throw new Error(`No SMS-capable numbers available in area code ${areaCode}.`);
    numberData = await twilioApi("/IncomingPhoneNumbers.json", "POST", {
      PhoneNumber: first.phone_number,
      ...params,
    });
  } else {
    // Toll-free: simpler verification, no 10DLC required.
    const search = await twilioApi("/AvailablePhoneNumbers/US/TollFree.json", "GET", {
      SmsEnabled: "true",
    });
    const first = search?.available_phone_numbers?.[0];
    if (!first) throw new Error("No SMS-capable toll-free numbers available.");
    numberData = await twilioApi("/IncomingPhoneNumbers.json", "POST", {
      PhoneNumber: first.phone_number,
      ...params,
    });
  }
  logger.info("Twilio number provisioned", {
    workspaceId,
    phoneNumber: numberData.phone_number,
  });
  return { phoneNumber: numberData.phone_number, sid: numberData.sid };
}

/** Send one SMS via Twilio. Returns the Twilio message SID. */
export async function twilioSendSms(
  from: string,
  to: string,
  body: string,
): Promise<string> {
  const data = await twilioApi(
    `/Messages.json`,
    "POST",
    { From: from, To: to, Body: body },
  );
  return data.sid as string;
}

// ---------------------------------------------------------------------------
// Telnyx REST
// ---------------------------------------------------------------------------

async function telnyxApi(path: string, body: Record<string, unknown>): Promise<any> {
  const apiKey = TELNYX_API_KEY.value();
  if (!apiKey) throw new Error("Telnyx credentials are not configured.");
  const res = await fetch(`https://api.telnyx.com/v2${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const errors = (data as any)?.errors?.map((e: any) => e.detail).join("; ");
    throw new Error(`Telnyx API ${res.status}: ${errors ?? "request failed"}`);
  }
  return data;
}

/** Send one SMS via Telnyx. Returns the Telnyx message ID. */
export async function telnyxSendSms(
  from: string,
  to: string,
  body: string,
): Promise<string> {
  const data = await telnyxApi("/messages", { from, to, text: body });
  const id = (data as any)?.data?.id;
  if (!id) throw new Error("Telnyx send returned no message id.");
  return id as string;
}

// ---------------------------------------------------------------------------
// Bandwidth REST
// ---------------------------------------------------------------------------

async function bandwidthApi(path: string, body: Record<string, unknown>): Promise<any> {
  const accountId = BANDWIDTH_ACCOUNT_ID.value();
  const apiToken = BANDWIDTH_API_TOKEN.value();
  const apiSecret = BANDWIDTH_API_SECRET.value();
  if (!accountId || !apiToken || !apiSecret) {
    throw new Error("Bandwidth credentials are not configured.");
  }
  const auth = Buffer.from(`${apiToken}:${apiSecret}`).toString("base64");
  const res = await fetch(
    `https://messaging.bandwidth.com/api/v2/users/${accountId}${path}`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      `Bandwidth API ${res.status}: ${(data as any)?.description ?? "request failed"}`,
    );
  }
  return data;
}

/** Send one SMS via Bandwidth. Returns the Bandwidth message ID. */
export async function bandwidthSendSms(
  from: string,
  to: string,
  body: string,
): Promise<string> {
  const data = await bandwidthApi("/messages", {
    from,
    to,
    text: body,
  });
  const id = (data as any)?.id;
  if (!id) throw new Error("Bandwidth send returned no message id.");
  return id as string;
}

// ---------------------------------------------------------------------------
// Provider router
// ---------------------------------------------------------------------------

/**
 * Send one SMS via the workspace's configured provider.
 * Returns the provider's message ID (sid). Throws on provider errors.
 */
export async function sendSmsViaProvider(
  provider: SmsProvider,
  from: string,
  to: string,
  body: string,
): Promise<string> {
  switch (provider) {
    case "telnyx":
      return telnyxSendSms(from, to, body);
    case "bandwidth":
      return bandwidthSendSms(from, to, body);
    case "twilio":
    default:
      return twilioSendSms(from, to, body);
  }
}

/** Normalize a possibly-legacy connection (pre-provider field) to twilio. */
export function providerOf(conn: SmsConnection): SmsProvider {
  return conn.provider ?? "twilio";
}

// ---------------------------------------------------------------------------
// Inbound webhook parsing (provider-neutral)
// ---------------------------------------------------------------------------

export interface ParsedInboundSms {
  from: string; // E.164
  to: string; // E.164 (our number)
  body: string;
  externalId: string; // provider message id (for dedup)
}

/** Parse a Telnyx messaging webhook (message.received event). */
export function parseTelnyxWebhook(payload: any): ParsedInboundSms | null {
  const data = payload?.data;
  if (!data || data.event_type !== "message.received") return null;
  const p = data.payload ?? {};
  const from = normalizePhone(String(p.from?.phone_number ?? ""));
  const to = normalizePhone(String(p.to?.[0]?.phone_number ?? ""));
  const body = String(p.text ?? "");
  const id = String(p.id ?? "");
  if (!from || !id) return null;
  return { from, to: to ?? "", body, externalId: `telnyx_${id}` };
}

/** Parse a Bandwidth messaging webhook (message-received event). */
export function parseBandwidthWebhook(payload: any): ParsedInboundSms | null {
  const events = Array.isArray(payload) ? payload : [payload];
  for (const e of events) {
    if (e?.type !== "message-received" && e?.type !== "message_received") continue;
    const m = e.message ?? {};
    const from = normalizePhone(String(m.from ?? ""));
    const to = normalizePhone(String(m.to ?? ""));
    const body = String(m.text ?? "");
    const id = String(m.id ?? "");
    if (!from || !id) continue;
    return { from, to: to ?? "", body, externalId: `bw_${id}` };
  }
  return null;
}

/**
 * Verify a Telnyx webhook signature (Ed25519).
 * Telnyx sends `telnyx-signature-ed25519` and `telnyx-timestamp` headers;
 * the signed payload is `${timestamp}|${rawBody}`.
 */
export function verifyTelnyxSignature(
  rawBody: string,
  signatureB64: string,
  timestamp: string,
): boolean {
  try {
    const publicKey = TELNYX_PUBLIC_KEY.value();
    if (!publicKey || !signatureB64 || !timestamp) return false;
    const verify = createVerify("ed25519");
    verify.update(`${timestamp}|${rawBody}`);
    verify.end();
    return verify.verify(publicKey, Buffer.from(signatureB64, "base64"));
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Compliance keywords (TCPA)
// ---------------------------------------------------------------------------

const OPT_OUT = new Set(["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"]);
const OPT_IN = new Set(["START", "YES", "UNSTOP"]);
const HELP = new Set(["HELP", "INFO"]);

export type SmsKeyword = "opt_out" | "opt_in" | "help" | null;

export function classifyKeyword(text: string): SmsKeyword {
  const word = text.trim().toUpperCase();
  if (OPT_OUT.has(word)) return "opt_out";
  if (OPT_IN.has(word)) return "opt_in";
  if (HELP.has(word)) return "help";
  return null;
}

export function complianceReply(kind: Exclude<SmsKeyword, null>, brand = "ChatMize"): string {
  switch (kind) {
    case "opt_out":
      return `You have been unsubscribed and will receive no further messages. Reply START to resubscribe.`;
    case "opt_in":
      return `You are now subscribed to ${brand} alerts. Msg&data rates may apply. Reply STOP to cancel, HELP for help.`;
    case "help":
      return `${brand} alerts: msg&data rates may apply. Reply STOP to cancel.`;
  }
}

// ---------------------------------------------------------------------------
// Firestore state
// ---------------------------------------------------------------------------

export async function getSmsConnection(workspaceId: string): Promise<SmsConnection | null> {
  const snap = await connRef(workspaceId).get();
  if (!snap.exists) return null;
  return snap.data() as SmsConnection;
}

export async function saveSmsConnection(conn: SmsConnection): Promise<void> {
  await connRef(conn.workspaceId).set({ ...conn, updatedAt: new Date().toISOString() });
}

/** Lazily roll the monthly SMS allowance when the calendar month changes. */
export async function ensureAllowanceMonth(workspaceId: string): Promise<SmsConnection | null> {
  const conn = await getSmsConnection(workspaceId);
  if (!conn) return null;
  const month = new Date().toISOString().slice(0, 7);
  if (conn.usageMonth !== month) {
    conn.usedThisMonth = 0;
    conn.usageMonth = month;
    await saveSmsConnection(conn);
  }
  return conn;
}

export async function getOptIn(workspaceId: string, phone: string): Promise<SmsOptIn | null> {
  const snap = await optInRef(workspaceId, phone).get();
  if (!snap.exists) return null;
  return snap.data() as SmsOptIn;
}

export async function setOptIn(
  workspaceId: string,
  phone: string,
  optedIn: boolean,
  source: string,
): Promise<void> {
  const now = new Date().toISOString();
  const existing = await getOptIn(workspaceId, phone);
  const record: SmsOptIn = {
    workspaceId,
    phone,
    optedIn,
    source,
    optedInAt: optedIn ? now : existing?.optedInAt ?? null,
    optedOutAt: !optedIn ? now : null,
    updatedAt: now,
  };
  await optInRef(workspaceId, phone).set(record);
  logger.info("SMS opt-in state changed", { workspaceId, phone, optedIn, source });
}

export async function countOptIns(workspaceId: string): Promise<number> {
  const snap = await db()
    .collection("sms_optins")
    .where("workspaceId", "==", workspaceId)
    .where("optedIn", "==", true)
    .count()
    .get();
  return snap.data().count;
}

/** Persist an inbound SMS into the workspace conversation thread (sms_{phone}). */
export async function persistInboundSms(
  workspaceId: string,
  from: string,
  to: string,
  body: string,
  externalId: string,
): Promise<void> {
  const convoId = `sms_${from.replace("+", "")}`;
  const convoRef = db()
    .collection("workspaces")
    .doc(workspaceId)
    .collection("conversations")
    .doc(convoId);
  const messageRef = convoRef.collection("messages").doc(externalId);
  const already = await messageRef.get();
  if (already.exists) {
    logger.info("Duplicate SMS webhook delivery ignored", { externalId });
    return;
  }
  const batch = db().batch();
  batch.set(
    convoRef,
    {
      channel: "sms",
      senderId: from,
      recipientId: to,
      lastMessageAt: FieldValue.serverTimestamp(),
      lastMessageText: body,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  batch.set(messageRef, {
    direction: "inbound",
    channel: "sms",
    senderId: from,
    text: body,
    externalId,
    timestampMs: Date.now(),
    createdAt: FieldValue.serverTimestamp(),
  });
  await batch.commit();
}

/** Persist an outbound SMS into the workspace conversation thread (sms_{phone}). */
export async function persistOutboundSms(
  workspaceId: string,
  from: string,
  to: string,
  body: string,
  externalId: string,
): Promise<void> {
  const convoId = `sms_${to.replace("+", "")}`;
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
      channel: "sms",
      senderId: to,
      recipientId: from,
      lastMessageAt: FieldValue.serverTimestamp(),
      lastMessageText: body,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  batch.set(messageRef, {
    direction: "outbound",
    channel: "sms",
    senderId: from,
    text: body,
    externalId,
    timestampMs: Date.now(),
    createdAt: FieldValue.serverTimestamp(),
  });
  await batch.commit();
}

const INBOUND_PER_HOUR = 20;
const COMPLIANCE_REPLY_COOLDOWN_MS = 24 * 3600 * 1000;

const inboundLimitRef = (workspaceId: string, phone: string) =>
  db().collection("sms_inbound_limits").doc(`${workspaceId}_${phone}`);

export interface InboundThrottle {
  /** False when the sender exceeded 20 inbound messages in the last hour. */
  allowed: boolean;
  /** True when a compliance reply (STOP/START/HELP) may be sent now. */
  complianceDue: boolean;
}

/**
 * Per-sender inbound throttle. Counts every inbound message in a rolling
 * hourly window and reports whether the message may be processed and
 * whether a compliance reply is due (at most one per sender per 24h, so a
 * keyword spammer cannot make ChatMize pay for unlimited replies).
 */
export async function checkInboundThrottle(
  workspaceId: string,
  phone: string,
  keyword: SmsKeyword,
): Promise<InboundThrottle> {
  const now = Date.now();
  const res = await db().runTransaction(async (tx) => {
    const snap = await tx.get(inboundLimitRef(workspaceId, phone));
    let count = 0;
    let windowStart = now;
    let lastReply: string | null = null;
    if (snap.exists) {
      const d = snap.data() as {
        windowStart: number;
        count: number;
        lastComplianceReplyAt: string | null;
      };
      if (now - d.windowStart < 3600_000) {
        count = d.count;
        windowStart = d.windowStart;
      }
      lastReply = d.lastComplianceReplyAt ?? null;
    }
    const allowed = count < INBOUND_PER_HOUR;
    const complianceDue =
      keyword !== null &&
      (!lastReply || now - Date.parse(lastReply) > COMPLIANCE_REPLY_COOLDOWN_MS);
    tx.set(
      inboundLimitRef(workspaceId, phone),
      {
        workspaceId,
        phone,
        windowStart,
        count: count + 1,
        lastComplianceReplyAt: lastReply,
      },
      { merge: true },
    );
    return { allowed, complianceDue };
  });
  if (!res.allowed) {
    logger.warn("SMS inbound throttled: sender over hourly limit", { workspaceId, phone });
  }
  return res;
}

/** Record that a compliance reply was sent (starts the 24h cooldown). */
export async function markComplianceReplySent(
  workspaceId: string,
  phone: string,
): Promise<void> {
  await inboundLimitRef(workspaceId, phone).set(
    { lastComplianceReplyAt: new Date().toISOString() },
    { merge: true },
  );
}

export async function logSms(entry: {  workspaceId: string;  direction: "outbound" | "inbound";
  to: string;
  from: string;
  body: string;
  segments: number;
  creditsCharged: number;
  /** Provider message id (Twilio SID, Telnyx id, Bandwidth id). */
  messageId?: string | null;
  /** @deprecated Use messageId. Kept for backwards compat with old log entries. */
  twilioSid?: string | null;
  status: "sent" | "failed" | "received";
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
export async function chargeForSend(
  workspaceId: string,
  segments: number,
  note: string,
): Promise<{ chargedTo: "allowance" | "credits"; creditsCharged: number }> {
  const conn = await ensureAllowanceMonth(workspaceId);
  if (conn && conn.usedThisMonth + segments <= conn.monthlyAllowance) {
    conn.usedThisMonth += segments;
    await saveSmsConnection(conn);
    return { chargedTo: "allowance", creditsCharged: 0 };
  }
  const credits = segments * SMS_CREDITS_PER_SEGMENT;
  await spendCredits(workspaceId, credits, "sms_send", note);
  return { chargedTo: "credits", creditsCharged: credits };
}
