import { createHmac, timingSafeEqual } from "crypto";

/**
 * Verify the X-Hub-Signature-256 header Meta sends with every webhook POST.
 * Uses the Meta App Secret from Secret Manager. Rejects anything that does
 * not carry a valid signature, so attackers cannot inject fake events.
 */
export function verifyMetaSignature(
  rawBody: Buffer,
  signatureHeader: string | undefined,
  appSecret: string,
): boolean {
  if (!signatureHeader || !appSecret) return false;
  const expected =
    "sha256=" + createHmac("sha256", appSecret).update(rawBody).digest("hex");
  const a = Buffer.from(signatureHeader);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Handle Meta's webhook verification handshake (GET). */
export function verifyHandshake(
  mode: unknown,
  token: unknown,
  challenge: unknown,
  verifyToken: string,
): { ok: boolean; challenge?: string } {
  if (mode === "subscribe" && token === verifyToken && typeof challenge === "string") {
    return { ok: true, challenge };
  }
  return { ok: false };
}
