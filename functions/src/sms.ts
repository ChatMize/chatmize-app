/**
 * SMS via Twilio: sending, provisioning, opt-in compliance, and logging.
 *
 * ChatMize owns the Twilio account. Each workspace gets its own provisioned
 * phone number; message costs are covered by the plan's monthly SMS allowance
 * first, then by AI credits (8 credits per segment at face value).
 */
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } from "./secrets";
import { spendCredits } from "./credits";

export const SMS_CREDITS_PER_SEGMENT = 8;

export interface SmsConnection {
  workspaceId: string;
  phoneNumber: string; // E.164
  twilioSid: string;
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

const db = () => getFirestore();
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
  twilioSid: string,
): Promise<void> {
  const convoId = `sms_${from.replace("+", "")}`;
  const convoRef = db()
    .collection("workspaces")
    .doc(workspaceId)
    .collection("conversations")
    .doc(convoId);
  const messageRef = convoRef.collection("messages").doc(twilioSid);
  const already = await messageRef.get();
  if (already.exists) {
    logger.info("Duplicate SMS webhook delivery ignored", { twilioSid });
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
    externalId: twilioSid,
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
  twilioSid: string,
): Promise<void> {
  const convoId = `sms_${to.replace("+", "")}`;
  const convoRef = db()
    .collection("workspaces")
    .doc(workspaceId)
    .collection("conversations")
    .doc(convoId);
  const messageRef = convoRef.collection("messages").doc(twilioSid);
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
    externalId: twilioSid,
    createdAt: FieldValue.serverTimestamp(),
  });
  await batch.commit();
}

export async function logSms(entry: {  workspaceId: string;
  direction: "outbound" | "inbound";
  to: string;
  from: string;
  body: string;
  segments: number;
  creditsCharged: number;
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
