/**
 * Brand Guard & Content Integrity System
 * 
 * Mandate: Under no circumstances may competitor brand names (e.g. ManyChat)
 * appear in any user-facing interface, documentation, templates, or exports.
 * Chatmize is designed from the ground up as a superior, more intuitive,
 * omnichannel flow builder and growth engine.
 */

export const FORBIDDEN_COMPETITOR_TERMS = [
  'manychat',
  'ManyChat',
  'MANYCHAT',
  'Manychat',
  'segmate',
  'SegMate',
  'SEGMATE',
  'Segmate',
] as const;

/**
 * Hard-coded brand sanitizer to eliminate any competitor mentions
 * and replace them with Chatmize-native terminology.
 */
export function sanitizeBrandText(input: string): string {
  if (!input) return input;
  let result = input;
  for (const term of FORBIDDEN_COMPETITOR_TERMS) {
    const regex = new RegExp(term, 'gi');
    result = result.replace(regex, 'Chatmize');
  }
  return result;
}

/**
 * Validates that a string contains zero mentions of competitor brands.
 * Returns true if clean, false if any violation found.
 */
export function validateBrandSafety(input: string): boolean {
  if (!input) return true;
  const lower = input.toLowerCase();
  return !FORBIDDEN_COMPETITOR_TERMS.some(term => lower.includes(term.toLowerCase()));
}
