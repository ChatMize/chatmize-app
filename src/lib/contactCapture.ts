/**
 * Lightweight contact-capture validation for the BotMaps simulator.
 * Mirrors the server-side rules in functions/src/contactCapture.ts, but
 * without the npm deps or DNS (not available in the browser). The server
 * is authoritative; this is only so the simulator behaves realistically.
 */

export type CaptureField = "phone" | "email";
export type CaptureMode = "quick_reply" | "free_text" | "both";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isEmailSyntax(v: string): boolean {
  return EMAIL_RE.test(v.trim());
}

/** Phone sanity: 7 to 15 digits after stripping formatting. */
export function isPhoneDigits(v: string): boolean {
  const digits = v.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15;
}

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

/**
 * Validate one typed answer against the wanted fields.
 * Returns the normalized value or an error message (no dashes).
 */
export function validateCaptureInput(
  raw: string,
  fields: CaptureField[],
): { ok: true; field: CaptureField; value: string } | { ok: false; error: string } {
  const v = raw.trim();
  if (!v) return { ok: false, error: "Type your answer to continue." };
  const looksEmail = isEmailSyntax(v);
  const looksPhone = isPhoneDigits(v);
  if (looksEmail && fields.includes("email")) {
    const suggestion = suggestEmailFix(v);
    if (suggestion) {
      return { ok: false, error: `Did you mean ${suggestion}?` };
    }
    return { ok: true, field: "email", value: v.toLowerCase() };
  }
  if (looksPhone && fields.includes("phone")) {
    return { ok: true, field: "phone", value: v };
  }
  if (fields.length === 1 && fields[0] === "email") {
    const suggestion = suggestEmailFix(v);
    if (suggestion) return { ok: false, error: `Did you mean ${suggestion}?` };
    return { ok: false, error: "That does not look like a valid email address. Try again." };
  }
  if (fields.length === 1 && fields[0] === "phone") {
    return { ok: false, error: "That does not look like a valid phone number. Try again with the area code." };
  }
  return { ok: false, error: "That does not look like an email or phone number. Try again." };
}
