/**
 * AI credit purchase pricing — the single source of truth for what credits
 * COST THE CUSTOMER. (What they cost ChatMize lives in the model catalog in
 * ./ai/router; spend-side metering charges 1 credit per $0.001 of raw cost.)
 *
 * Settled product decision (2026-09-18):
 *  - A la carte top-ups sell at 4x ChatMize's AI cost.
 *  - Monthly credit bundles sell at 3x ChatMize's AI cost.
 *  - OG customers (SegMate migrants, workspace doc `og === true`) get 40%
 *    off BOTH formats. The discount applies at quote time and is stored on
 *    every credit_orders doc so it stays auditable.
 *
 * This module is pure (no Firebase deps) so the frontend can import the same
 * math for price previews. Currency is integer cents everywhere.
 */
import { CREDIT_PRICING } from "./ai/router";

export type CreditPurchaseFormat = "alacarte" | "bundle";

/** Settled OG discount: 40% off either purchase format. */
export const OG_DISCOUNT_RATE = 0.4;

/** Retail margin per purchase format. */
export const FORMAT_MARGINS: Record<CreditPurchaseFormat, number> = {
  alacarte: CREDIT_PRICING.alacarteMargin, // 4
  bundle: CREDIT_PRICING.planMargin, // 3
};

export interface CreditQuote {
  credits: number;
  format: CreditPurchaseFormat;
  /** Margin applied to raw cost for this format (4 = a la carte, 3 = bundle). */
  margin: number;
  listPriceCents: number;
  ogDiscountCents: number;
  finalPriceCents: number;
  isOg: boolean;
}

/** List price in cents before any discount. */
export function listPriceCentsFor(
  credits: number,
  format: CreditPurchaseFormat,
): number {
  const margin = FORMAT_MARGINS[format];
  return Math.round(
    credits * CREDIT_PRICING.usdPerCreditFace * margin * 100,
  );
}

/**
 * Quote a credit purchase. Throws on invalid input; never returns a
 * fractional cent. The OG discount is the only discount in the system —
 * there are no promo codes or stacked discounts by design.
 */
export function quoteCredits(
  credits: number,
  format: CreditPurchaseFormat,
  isOg: boolean,
): CreditQuote {
  if (!Number.isInteger(credits) || credits <= 0) {
    throw new Error("credits must be a positive integer");
  }
  if (format !== "alacarte" && format !== "bundle") {
    throw new Error("format must be 'alacarte' or 'bundle'");
  }
  const margin = FORMAT_MARGINS[format];
  const listPriceCents = listPriceCentsFor(credits, format);
  const ogDiscountCents = isOg
    ? Math.round(listPriceCents * OG_DISCOUNT_RATE)
    : 0;
  return {
    credits,
    format,
    margin,
    listPriceCents,
    ogDiscountCents,
    finalPriceCents: listPriceCents - ogDiscountCents,
    isOg,
  };
}
