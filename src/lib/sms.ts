import { getApp } from "firebase/app";
import { getFunctions, httpsCallable } from "firebase/functions";
import { SmsStatus } from "../types/workspace";

const functions = getFunctions(getApp(), "us-west2");

/** Credits charged per SMS segment when the plan allowance is exhausted. */
export const SMS_CREDITS_PER_SEGMENT = 8;

export async function getSmsStatus(workspaceId: string): Promise<SmsStatus> {
  const fn = httpsCallable<{ workspaceId: string }, SmsStatus>(functions, "getSmsStatus");
  const res = await fn({ workspaceId });
  return res.data;
}

export async function provisionSmsNumber(
  workspaceId: string,
  areaCode?: string,
): Promise<{ phoneNumber: string; alreadyProvisioned: boolean }> {
  const fn = httpsCallable<
    { workspaceId: string; areaCode?: string },
    { phoneNumber: string; alreadyProvisioned: boolean }
  >(functions, "provisionSmsNumber");
  const res = await fn({ workspaceId, areaCode });
  return res.data;
}

export async function setSmsOptIn(
  workspaceId: string,
  phone: string,
  optedIn: boolean,
  source = "manual",
): Promise<{ ok: boolean; phone: string; optedIn: boolean }> {
  const fn = httpsCallable<
    { workspaceId: string; phone: string; optedIn: boolean; source: string },
    { ok: boolean; phone: string; optedIn: boolean }
  >(functions, "setSmsOptIn");
  const res = await fn({ workspaceId, phone, optedIn, source });
  return res.data;
}

export interface SendSmsResult {
  ok: boolean;
  twilioSid: string;
  segments: number;
  chargedTo: "allowance" | "credits";
}

export async function sendSms(
  workspaceId: string,
  to: string,
  body: string,
): Promise<SendSmsResult> {
  const fn = httpsCallable<{ workspaceId: string; to: string; body: string }, SendSmsResult>(
    functions,
    "sendSms",
  );
  const res = await fn({ workspaceId, to, body });
  return res.data;
}

export interface SmsBroadcastReport {
  ok: boolean;
  broadcastId: string;
  sent: number;
  failed: number;
  skipped: number;
  creditsCharged: number;
  errors: string[];
}

export async function sendSmsBroadcast(
  workspaceId: string,
  body: string,
): Promise<SmsBroadcastReport> {
  const fn = httpsCallable<{ workspaceId: string; body: string }, SmsBroadcastReport>(
    functions,
    "sendSmsBroadcast",
  );
  const res = await fn({ workspaceId, body });
  return res.data;
}

// --- Client-side cost estimates (mirrors the backend math) -------------------

const GSM7_BASIC =
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ\x1bÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
const GSM7_EXT = "^{}\\[~]|€";

function isGsm7(text: string): boolean {
  for (const ch of text) {
    if (GSM7_BASIC.includes(ch) || GSM7_EXT.includes(ch)) continue;
    return false;
  }
  return true;
}

/** Estimated carrier segments for a message (client preview; backend is authoritative). */
export function estimateSegments(text: string): number {
  if (!text) return 0;
  const gsm = isGsm7(text);
  if (text.length <= (gsm ? 160 : 70)) return 1;
  return Math.ceil(text.length / (gsm ? 153 : 67));
}

/** Estimated credit cost for sending `segments` to `recipients` recipients. */
export function estimateBroadcastCredits(segments: number, recipients: number): number {
  return segments * recipients * SMS_CREDITS_PER_SEGMENT;
}
