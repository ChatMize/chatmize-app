/**
 * BotMaps contact-capture handling (server side).
 *
 * When a contact-capture block is sent, the conversation doc carries a
 * `pendingCapture` field listing which fields (phone/email) are still
 * wanted. Every inbound message passes through here: if a capture is
 * pending, the message is treated as the answer — either a one-tap
 * quick-reply payload (Meta fills in the user's own phone/email) or
 * hand-typed text. Valid values are saved to the contact record;
 * invalid input gets one plain-English re-prompt before we stop asking.
 *
 * No-dash rule: all user-facing copy avoids em dashes and hyphenated
 * compounds.
 */
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { promises as dns } from "dns";
import validator from "validator";
import { PhoneNumberUtil, PhoneNumberFormat } from "google-libphonenumber";
import { NormalizedMessage } from "./store";
import {
  sendChannelMessageInternal,
  ContactCapture,
  ContactCaptureField,
} from "./channelSend";

const db = () => getFirestore("chatmize-prod");

export interface PendingCapture {
  fields: ContactCaptureField[];
  remaining: ContactCaptureField[];
  mode: "quick_reply" | "free_text" | "both";
  attempts: number;
}

// ---------------------------------------------------------------------------
// Free validation stack (no paid APIs).
// Phone: google-libphonenumber. Email: validator.isEmail + DNS MX lookup +
// typo suggestions + disposable-domain blocklist.
// ---------------------------------------------------------------------------

const phoneUtil = PhoneNumberUtil.getInstance();

/**
 * Parse a typed or one-tap phone value. Numbers starting with + carry
 * their own country code; otherwise assume US (Karl's audience).
 * Accepts when libphonenumber says the number is possible; returns E.164
 * for storage. Null when not a plausible phone number.
 */
export function parsePhoneToE164(v: string): string | null {
  const trimmed = v.trim();
  if (!trimmed) return null;
  try {
    const num = trimmed.startsWith("+")
      ? phoneUtil.parse(trimmed, "ZZ")
      : phoneUtil.parse(trimmed, "US");
    if (!phoneUtil.isPossibleNumber(num)) return null;
    return phoneUtil.format(num, PhoneNumberFormat.E164);
  } catch {
    return null;
  }
}

/** Common domain typos -> correction, for the "did you mean" prompt. */
const COMMON_DOMAIN_TYPOS: Record<string, string> = {
  "gmial.com": "gmail.com",
  "gamil.com": "gmail.com",
  "gmali.com": "gmail.com",
  "gmail.co": "gmail.com",
  "hotmial.com": "hotmail.com",
  "hotmai.com": "hotmail.com",
  "hotamil.com": "hotmail.com",
  "yaho.com": "yahoo.com",
  "yahooo.com": "yahoo.com",
  "outlok.com": "outlook.com",
  "outllok.com": "outlook.com",
  "aol.cm": "aol.com",
  "icloud.cm": "icloud.com",
  "protonnmail.com": "protonmail.com",
  "protonamil.com": "protonmail.com",
};

/** Suggest a corrected email when the domain looks like a common typo. */
export function suggestEmailFix(email: string): string | null {
  const parts = email.trim().split("@");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  const fix = COMMON_DOMAIN_TYPOS[parts[1].toLowerCase()];
  return fix ? `${parts[0]}@${fix}` : null;
}

// DNS MX cache: domain -> has MX. 1 hour TTL, in memory.
const mxCache = new Map<string, { ok: boolean; at: number }>();

/**
 * Does the domain have MX records? Returns null when DNS itself fails
 * (fail open: never block a capture because DNS flaked).
 */
async function domainHasMx(domain: string): Promise<boolean | null> {
  const cached = mxCache.get(domain);
  if (cached && Date.now() - cached.at < 3_600_000) return cached.ok;
  try {
    const recs = await dns.resolveMx(domain);
    const ok = recs.length > 0;
    mxCache.set(domain, { ok, at: Date.now() });
    return ok;
  } catch {
    return null;
  }
}

// Disposable-domain blocklist, loaded lazily so cold starts stay fast.
let disposableSet: Set<string> | null = null;
async function getDisposableSet(): Promise<Set<string>> {
  if (!disposableSet) {
    const mod = (await import("disposable-email-domains")) as unknown as
      | { default: string[] }
      | string[];
    const list = Array.isArray(mod) ? mod : mod.default;
    disposableSet = new Set(list.map((d) => d.toLowerCase()));
  }
  return disposableSet;
}

export type EmailRejectReason = "syntax" | "typo" | "disposable" | "no_mx";

export interface EmailCheck {
  ok: boolean;
  normalized?: string;
  reason?: EmailRejectReason;
  suggestion?: string | null;
}

/**
 * Full email validation for hand-typed input:
 * syntax (validator.isEmail) -> typo suggestion -> disposable blocklist ->
 * DNS MX lookup. One-tap values skip the MX/disposable layers because
 * they come straight from the user's Meta profile.
 */
export async function checkEmail(
  v: string,
  opts?: { oneTap?: boolean },
): Promise<EmailCheck> {
  const trimmed = v.trim();
  if (!validator.isEmail(trimmed)) {
    return { ok: false, reason: "syntax", suggestion: suggestEmailFix(trimmed) };
  }
  const normalized = trimmed.toLowerCase();
  const suggestion = suggestEmailFix(normalized);
  if (suggestion) {
    return { ok: false, reason: "typo", suggestion };
  }
  if (opts?.oneTap) return { ok: true, normalized };
  const domain = normalized.split("@")[1];
  if ((await getDisposableSet()).has(domain)) {
    return { ok: false, reason: "disposable" };
  }
  const mx = await domainHasMx(domain);
  if (mx === false) {
    return { ok: false, reason: "no_mx" };
  }
  return { ok: true, normalized };
}

export interface CaptureResolution {
  field: ContactCaptureField;
  /** Normalized value for storage: E.164 for phone, lowercase for email. */
  value: string;
  /** Present when the input was rejected. */
  rejectReason?: EmailRejectReason | "phone";
  suggestion?: string | null;
}

/**
 * Resolve one inbound answer against the remaining wanted fields.
 * One-tap payloads get light validation (Meta-sourced); typed text gets
 * the full stack.
 */
export async function resolveCaptureValue(
  raw: string,
  remaining: ContactCaptureField[],
  oneTap: boolean,
): Promise<CaptureResolution | null> {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Email first: a valid email never parses as a phone number.
  const email = await checkEmail(trimmed, { oneTap });
  if (email.ok && email.normalized && remaining.includes("email")) {
    return { field: "email", value: email.normalized };
  }
  if (email.ok && email.normalized && !remaining.includes("email")) {
    // They gave an email but we wanted a phone: fall through to phone check.
  } else if (!email.ok && remaining.includes("email")) {
    return {
      field: "email",
      value: trimmed,
      rejectReason: email.reason,
      suggestion: email.suggestion ?? null,
    };
  }

  const e164 = parsePhoneToE164(trimmed);
  if (e164 && remaining.includes("phone")) {
    return { field: "phone", value: e164 };
  }
  if (remaining.includes("phone")) {
    return { field: "phone", value: trimmed, rejectReason: "phone" };
  }
  // Wanted email only, got something unclassifiable.
  return {
    field: "email",
    value: trimmed,
    rejectReason: email.reason ?? "syntax",
    suggestion: email.suggestion ?? null,
  };
}

function convoRef(workspaceId: string, channel: string, senderId: string) {
  return db()
    .collection("workspaces")
    .doc(workspaceId)
    .collection("conversations")
    .doc(`${channel}_${senderId}`);
}

/**
 * Process one inbound message against a pending contact capture.
 * Returns true when a capture was pending (the message was consumed as
 * the answer, valid or not), false when no capture is pending.
 * Never throws — failures are logged and the capture is left alone.
 */
export async function handleContactCapture(
  workspaceId: string,
  msg: NormalizedMessage,
): Promise<boolean> {
  try {
    if (msg.channel !== "messenger" && msg.channel !== "instagram" && msg.channel !== "whatsapp") {
      return false;
    }
    const ref = convoRef(workspaceId, msg.channel, msg.senderId);
    const snap = await ref.get();
    const pending = snap.data()?.pendingCapture as PendingCapture | undefined;
    if (!pending || !Array.isArray(pending.remaining) || pending.remaining.length === 0) {
      return false;
    }

    const raw = (msg.quickReplyPayload ?? msg.text ?? "").trim();
    if (!raw) return true; // sticker or empty payload: keep waiting

    const contactId = `contact_${msg.channel}_${msg.senderId}`;
    const contactRef = db().collection("contacts").doc(contactId);

    const resolution = await resolveCaptureValue(
      raw,
      pending.remaining,
      !!msg.quickReplyPayload,
    );
    if (!resolution) return true;

    if (!resolution.rejectReason) {
      await contactRef.set(
        {
          [resolution.field === "phone" ? "phone" : "email"]: resolution.value,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      const remaining = pending.remaining.filter((f) => f !== resolution.field);
      logger.info("Contact capture saved", {
        workspaceId,
        channel: msg.channel,
        field: resolution.field,
        remaining,
      });
      if (remaining.length === 0) {
        await ref.set({ pendingCapture: FieldValue.delete() }, { merge: true });
        return true;
      }
      // Still missing fields: ask for the rest with the same mode.
      const capture: ContactCapture = {
        fields: remaining,
        mode: pending.mode,
        attempts: 0,
      };
      await sendChannelMessageInternal(
        workspaceId,
        msg.channel,
        msg.senderId,
        capturePromptFor(remaining),
        null,
        null,
        capture,
      );
      return true;
    }

    // Invalid input: one re-prompt with plain guidance, then stop asking.
    const attempts = (pending.attempts ?? 0) + 1;
    if (attempts >= 2) {
      await ref.set({ pendingCapture: FieldValue.delete() }, { merge: true });
      logger.info("Contact capture abandoned after invalid input", {
        workspaceId,
        channel: msg.channel,
        remaining: pending.remaining,
      });
      return true;
    }
    const capture: ContactCapture = {
      fields: pending.remaining,
      mode: pending.mode,
      attempts,
    };
    await sendChannelMessageInternal(
      workspaceId,
      msg.channel,
      msg.senderId,
      rejectionGuidance(resolution, pending.mode),
      null,
      null,
      capture,
    );
    return true;
  } catch (err) {
    logger.warn("Contact capture handling failed", {
      workspaceId,
      err: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

/** Default prompt when asking for the remaining fields. */
export function capturePromptFor(remaining: ContactCaptureField[]): string {
  if (remaining.length === 2) return "How can we reach you? Tap below or type it in.";
  return remaining[0] === "phone"
    ? "What is your phone number? Tap below or type it in."
    : "What is your email address? Tap below or type it in.";
}

/**
 * Plain-English re-prompt for rejected input. No dashes, ever.
 * Typo rejections name the suggested fix so the user can just retype it.
 */
export function rejectionGuidance(
  r: CaptureResolution,
  mode: "quick_reply" | "free_text" | "both",
): string {
  const tapHint =
    mode === "free_text" ? "" : " You can also tap the button above.";
  if (r.rejectReason === "typo" && r.suggestion) {
    return `Did you mean ${r.suggestion}? Please type it again.${tapHint}`;
  }
  if (r.rejectReason === "disposable") {
    return `Please use your real email address, not a temporary one.${tapHint}`;
  }
  if (r.rejectReason === "no_mx") {
    return `That email domain does not look real. Check the spelling and try again.${tapHint}`;
  }
  if (r.rejectReason === "phone") {
    return `That does not look like a valid phone number. Please type it again with the area code.${tapHint}`;
  }
  return `That does not look like a valid email address. Please type it again.${tapHint}`;
}
