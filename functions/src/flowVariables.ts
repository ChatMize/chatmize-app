/**
 * BotMaps variable capture (server side).
 *
 * When a question block is sent, the conversation doc carries a
 * `pendingVariables` field naming the variable being collected. Every
 * inbound message passes through here: if a question is pending, the
 * message text is treated as the answer, validated by type (text, number,
 * date), and saved to the contact record's variables/customFields maps —
 * the same maps the {{tag}} personalization resolver reads. Invalid input
 * gets one plain-English re-prompt before we stop asking.
 *
 * Phone and email capture live in contactCapture.ts; this module covers
 * text, number, and date questions.
 *
 * No-dash rule: all user-facing copy avoids em dashes and hyphenated
 * compounds.
 */
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import type { NormalizedMessage } from "./store";

const db = () => getFirestore("chatmize-prod");

export type VariableType = "text" | "number" | "date";

export interface PendingVariables {
  variable: string;
  varType: VariableType;
  attempts: number;
}

/**
 * Clean a builder-typed variable name into tag-safe form, mirroring the
 * frontend sanitizer in src/lib/flowVariables.ts.
 */
export function sanitizeVariableName(raw: string): string {
  return (raw || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

const MONTHS: Record<string, number> = {
  january: 1, jan: 1,
  february: 2, feb: 2,
  march: 3, mar: 3,
  april: 4, apr: 4,
  may: 5,
  june: 6, jun: 6,
  july: 7, jul: 7,
  august: 8, aug: 8,
  september: 9, sep: 9, sept: 9,
  october: 10, oct: 10,
  november: 11, nov: 11,
  december: 12, dec: 12,
};

function isRealDate(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  if (y < 1900 || y > 2100) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function toIso(y: number, m: number, d: number): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${y}-${p(m)}-${p(d)}`;
}

/**
 * Parse a hand-typed date into YYYY-MM-DD. Accepts ISO, US numeric,
 * month-name forms, and today/tomorrow. US-first for ambiguous numerics.
 * Null when unparseable or impossible.
 */
export function parseNaturalDate(raw: string, now: Date = new Date()): string | null {
  const v = (raw || "").trim().toLowerCase();
  if (!v) return null;
  const y0 = now.getFullYear();
  const m0 = now.getMonth() + 1;
  const d0 = now.getDate();

  if (v === "today") return toIso(y0, m0, d0);
  if (v === "tomorrow") {
    const t = new Date(now.getTime() + 86400000);
    return toIso(t.getFullYear(), t.getMonth() + 1, t.getDate());
  }

  let m: RegExpMatchArray | null;
  if ((m = /^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})$/.exec(v))) {
    const y = +m[1], mo = +m[2], d = +m[3];
    return isRealDate(y, mo, d) ? toIso(y, mo, d) : null;
  }
  if ((m = /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/.exec(v))) {
    let y = +m[3];
    if (y < 100) y += 2000;
    const mo = +m[1], d = +m[2];
    return isRealDate(y, mo, d) ? toIso(y, mo, d) : null;
  }
  if ((m = /^([a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?$/.exec(v))) {
    const mo = MONTHS[m[1]];
    if (!mo) return null;
    const d = +m[2];
    const y = m[3] ? +m[3] : y0;
    return isRealDate(y, mo, d) ? toIso(y, mo, d) : null;
  }
  if ((m = /^(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]+)(?:,?\s+(\d{4}))?$/.exec(v))) {
    const mo = MONTHS[m[2]];
    if (!mo) return null;
    const d = +m[1];
    const y = m[3] ? +m[3] : y0;
    return isRealDate(y, mo, d) ? toIso(y, mo, d) : null;
  }
  return null;
}

export type VariableValidation =
  | { ok: true; value: string }
  | { ok: false; error: string };

/** Validate one typed answer. Dates normalize to YYYY-MM-DD. */
export function validateVariableInput(raw: string, type: VariableType): VariableValidation {
  const v = (raw || "").trim();
  if (!v) return { ok: false, error: "Type your answer to continue." };
  if (type === "text") {
    if (v.length > 500) return { ok: false, error: "That answer is too long. Keep it under 500 characters." };
    return { ok: true, value: v };
  }
  if (type === "number") {
    const n = Number(v.replace(/,/g, ""));
    if (!Number.isFinite(n)) return { ok: false, error: "That does not look like a number. Try again with digits only." };
    return { ok: true, value: String(n) };
  }
  const iso = parseNaturalDate(v);
  if (!iso) {
    return { ok: false, error: "I could not read that as a date. Try something like Jan 5 2027." };
  }
  return { ok: true, value: iso };
}

/**
 * Names the contact record already owns. {{phone}}, {{email}}, and the other
 * built in tags always resolve to the contact's real fields first in the
 * personalization resolver, so a variable saved under one of these names
 * would never win. Blocked at the send/API boundary with a plain message.
 */
export const RESERVED_VARIABLE_NAMES: ReadonlySet<string> = new Set([
  "first_name",
  "last_name",
  "full_name",
  "name",
  "email",
  "phone",
  "company",
  "job_title",
  "city",
  "state",
  "country",
  "zip",
  "zip_code",
]);

/**
 * Reject reserved contact field names (e.g. phone, email). Throws with a
 * plain English message the builder or API caller can act on.
 */
export function assertVariableNameAllowed(raw: string): string {
  const name = sanitizeVariableName(raw);
  if (!name) throw new Error("Give this variable a name so the answer has somewhere to go.");
  if (RESERVED_VARIABLE_NAMES.has(name)) {
    throw new Error(
      `The name ${name} already belongs to the contact record, so {{${name}}} would show the contact's real info. Pick a different name.`
    );
  }
  return name;
}

/**
 * Save a variable to the contact record. Writes both the `variables` and
 * `customFields` maps, mirroring the frontend setContactVariable helper —
 * the {{tag}} resolver reads both.
 */
export async function saveVariableToContact(
  contactId: string,
  variable: string,
  value: string | number | boolean,
): Promise<void> {
  const clean = assertVariableNameAllowed(variable);
  await db()
    .collection("contacts")
    .doc(contactId)
    .set(
      {
        [`variables.${clean}`]: value,
        [`customFields.${clean}`]: value,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
}

function convoRef(workspaceId: string, channel: string, senderId: string) {
  return db()
    .collection("workspaces")
    .doc(workspaceId)
    .collection("conversations")
    .doc(`${channel}_${senderId}`);
}

/**
 * Process one inbound message against a pending variable question.
 * Returns true when a question was pending (the message was consumed as
 * the answer, valid or not), false when nothing is pending.
 * Never throws — failures are logged and the pending state is left alone.
 */
export async function handleVariableCapture(
  workspaceId: string,
  msg: NormalizedMessage,
): Promise<boolean> {
  try {
    if (msg.channel !== "messenger" && msg.channel !== "instagram" && msg.channel !== "whatsapp") {
      return false;
    }
    const ref = convoRef(workspaceId, msg.channel, msg.senderId);
    const snap = await ref.get();
    const pending = snap.data()?.pendingVariables as PendingVariables | undefined;
    if (!pending || !pending.variable) return false;

    const raw = (msg.text ?? "").trim();
    if (!raw) return true; // sticker or empty payload: keep waiting

    const contactId = `contact_${msg.channel}_${msg.senderId}`;
    const check = validateVariableInput(raw, pending.varType ?? "text");
    if (check.ok) {
      await saveVariableToContact(contactId, pending.variable, check.value);
      await ref.set({ pendingVariables: FieldValue.delete() }, { merge: true });
      logger.info("Variable captured", {
        workspaceId,
        channel: msg.channel,
        variable: sanitizeVariableName(pending.variable),
      });
      return true;
    }

    // Invalid input: one re-prompt with plain guidance, then stop asking.
    const attempts = (pending.attempts ?? 0) + 1;
    if (attempts >= 2) {
      await ref.set({ pendingVariables: FieldValue.delete() }, { merge: true });
      logger.info("Variable capture abandoned after invalid input", {
        workspaceId,
        channel: msg.channel,
        variable: sanitizeVariableName(pending.variable),
      });
      return true;
    }
    await ref.set(
      { pendingVariables: { ...pending, attempts } },
      { merge: true },
    );
    // Re-prompt through the normal send pipeline (never throws the hook).
    try {
      const { sendChannelMessageInternal } = await import("./channelSend.js");
      await sendChannelMessageInternal(
        workspaceId,
        msg.channel,
        msg.senderId,
        check.error,
        null,
        null,
        null,
      );
    } catch (err) {
      logger.warn("Variable re-prompt send failed", {
        workspaceId,
        err: err instanceof Error ? err.message : String(err),
      });
    }
    return true;
  } catch (err) {
    logger.warn("Variable capture hook failed", {
      workspaceId,
      err: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}
