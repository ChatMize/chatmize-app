/**
 * BotMaps variable capture: shared validation for the question block.
 *
 * A question block asks the contact something (text, number, or date) and
 * saves the answer to a named variable on the contact record. Phone and
 * email are handled by the contact capture block (src/lib/contactCapture);
 * this module covers everything else.
 *
 * Browser-safe: no Node deps, no DNS. The server (functions/src/flowVariables)
 * is authoritative; this only keeps the simulator honest.
 */

export type VariableType = "text" | "number" | "date";

export const VARIABLE_TYPES: Array<{ v: VariableType; label: string; hint: string }> = [
  { v: "text", label: "Text", hint: "Any typed answer" },
  { v: "number", label: "Number", hint: "Digits, validated" },
  { v: "date", label: "Date", hint: "Typed date, saved as YYYY-MM-DD" },
];

/**
 * Clean a builder-typed variable name into tag-safe form:
 * lowercase, spaces and dashes become underscores, anything else dropped.
 * Matches the {{tag}} pattern the send paths resolve.
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
 * Parse a hand-typed date into YYYY-MM-DD. Accepts ISO, US numeric
 * (MM/DD/YYYY, MM-DD-YYYY), month-name forms ("Jan 5", "January 5 2027",
 * "5 Jan 2027"), and the words today / tomorrow. US-first for ambiguous
 * numerics (Karl's audience). Null when unparseable or impossible.
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
  // ISO: 2027-01-05 or 2027/01/05
  if ((m = /^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})$/.exec(v))) {
    const y = +m[1], mo = +m[2], d = +m[3];
    return isRealDate(y, mo, d) ? toIso(y, mo, d) : null;
  }
  // US numeric: 01/05/2027 or 01-05-2027 (also 2-digit year)
  if ((m = /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/.exec(v))) {
    let y = +m[3];
    if (y < 100) y += 2000;
    const mo = +m[1], d = +m[2];
    return isRealDate(y, mo, d) ? toIso(y, mo, d) : null;
  }
  // Month name first: "January 5 2027", "Jan 5", "Jan 5th 2027"
  if ((m = /^([a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?$/.exec(v))) {
    const mo = MONTHS[m[1]];
    if (!mo) return null;
    const d = +m[2];
    const y = m[3] ? +m[3] : y0;
    return isRealDate(y, mo, d) ? toIso(y, mo, d) : null;
  }
  // Day first: "5 Jan 2027", "5 January"
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

/**
 * Validate one typed answer for a question block.
 * Returns the normalized value to store (dates become YYYY-MM-DD).
 * Error copy follows the no-dash rule.
 */
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
 * built in tags always resolve to the contact's real fields first, so a
 * variable saved under one of these names would never win. They are blocked
 * at creation time instead, with a plain English explanation.
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

export interface VariableNameCheck {
  ok: boolean;
  name: string;
  error?: string;
}

/**
 * Check a builder-typed variable name: sanitize it, then reject empties and
 * reserved contact field names. Copy follows the no-dash rule.
 */
export function validateVariableName(raw: string): VariableNameCheck {
  const name = sanitizeVariableName(raw);
  if (!name) {
    return { ok: false, name, error: "Give this variable a name so the answer has somewhere to go." };
  }
  if (RESERVED_VARIABLE_NAMES.has(name)) {
    return {
      ok: false,
      name,
      error: `The name ${name} already belongs to the contact record, so {{${name}}} would show the contact's real info. Pick a different name.`,
    };
  }
  return { ok: true, name };
}
