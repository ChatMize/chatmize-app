/**
 * Credit purchase orders — the minimal purchase path for AI credits.
 *
 * Flow (deliberately payment-agnostic for now):
 *   1. `quoteCreditPurchase` callable (any workspace member): computes the
 *      price WITH the 40% OG discount applied, writes a `quoted` order doc.
 *      No money moves, no credits granted.
 *   2. Payment happens outside this module (Stripe Checkout / webhook next).
 *   3. `fulfillCreditOrder` callable (Super Admin only; the Stripe webhook
 *      will call it once billing is wired): atomically flips the order to
 *      `fulfilled` and grants the credits via the ledger (`topup_purchase`).
 *
 * Schema: `credit_orders/{orderId}` (top-level collection)
 *   orderId, workspaceId, uid, credits, format ("alacarte"|"bundle"),
 *   listPriceCents, ogDiscountCents, finalPriceCents, isOg,
 *   status ("quoted"|"fulfilled"|"cancelled"),
 *   createdAt, fulfilledAt?, note?
 *
 * The OG discount snapshot (isOg, ogDiscountCents) is stored on every order
 * so historical orders stay correct even if a flag ever changes.
 */
import { getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { grantCredits, isOgWorkspace } from "./credits";
import { quoteCredits, CreditPurchaseFormat, CreditQuote } from "./creditPricing";

const db = () => getFirestore("chatmize-prod");
const ordersRef = () => db().collection("credit_orders");

export type CreditOrderStatus = "quoted" | "fulfilled" | "cancelled";

export interface CreditOrder extends CreditQuote {
  orderId: string;
  workspaceId: string;
  /** Firebase uid of the member who placed the order. */
  uid: string;
  status: CreditOrderStatus;
  createdAt: string;
  fulfilledAt: string | null;
  note: string | null;
}

/**
 * Create a quoted order. Read-only with respect to money and balances:
 * nothing is charged and no credits are granted here.
 */
export async function createCreditOrder(
  workspaceId: string,
  uid: string,
  credits: number,
  format: CreditPurchaseFormat,
): Promise<CreditOrder> {
  const isOg = await isOgWorkspace(workspaceId);
  const quote = quoteCredits(credits, format, isOg);
  const now = new Date().toISOString();
  const ref = ordersRef().doc();
  const order: CreditOrder = {
    orderId: ref.id,
    workspaceId,
    uid,
    ...quote,
    status: "quoted",
    createdAt: now,
    fulfilledAt: null,
    note: null,
  };
  await ref.set(order);
  logger.info("Credit order quoted", {
    orderId: ref.id,
    workspaceId,
    credits,
    format,
    finalPriceCents: order.finalPriceCents,
    isOg,
  });
  return order;
}

/**
 * Fulfill an order: grant the credits and flip the order to fulfilled.
 * Idempotent — a second call for an already-fulfilled order returns it
 * without granting again. The state flip happens inside a transaction, so
 * two concurrent calls cannot double-grant.
 *
 * NOTE (money-adjacent): callers must have verified payment BEFORE calling.
 * Today that means a human Super Admin or (next step) the Stripe webhook.
 * The grant-after-flip ordering means a crash between the flip and the
 * grant leaves an order fulfilled-without-credits; the Super Admin credit
 * report should reconcile `credit_orders` (fulfilled) against
 * `credit_ledger` (topup_purchase) until a proper reconciliation job exists.
 */
export async function fulfillCreditOrder(
  orderId: string,
  note?: string,
): Promise<{ order: CreditOrder; alreadyFulfilled: boolean }> {
  const ref = ordersRef().doc(orderId);
  const now = new Date().toISOString();
  const flipped = await db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) {
      throw new Error(`unknown credit order ${orderId}`);
    }
    const order = { orderId: ref.id, ...(snap.data() as Omit<CreditOrder, "orderId">) };
    if (order.status === "fulfilled") {
      return { order, flipped: false };
    }
    if (order.status !== "quoted") {
      throw new Error(`order ${orderId} is ${order.status}, cannot fulfill`);
    }
    const fulfilled: CreditOrder = {
      ...order,
      status: "fulfilled",
      fulfilledAt: now,
      note: note ?? null,
    };
    tx.set(ref, fulfilled);
    return { order: fulfilled, flipped: true };
  });

  if (flipped.flipped) {
    const { order } = flipped;
    await grantCredits(order.workspaceId, order.credits, "topup_purchase", note ?? `credit order ${orderId}`);
    logger.info("Credit order fulfilled", {
      orderId,
      workspaceId: order.workspaceId,
      credits: order.credits,
      finalPriceCents: order.finalPriceCents,
    });
  } else {
    logger.info("Credit order already fulfilled; no double grant", { orderId });
  }
  return { order: flipped.order, alreadyFulfilled: !flipped.flipped };
}

/** Cancel a quoted order. Fulfilled orders cannot be cancelled here (no refunds by policy). */
export async function cancelCreditOrder(orderId: string): Promise<CreditOrder> {
  const ref = ordersRef().doc(orderId);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new Error(`unknown credit order ${orderId}`);
  }
  const order = { orderId: ref.id, ...(snap.data() as Omit<CreditOrder, "orderId">) };
  if (order.status !== "quoted") {
    throw new Error(`order ${orderId} is ${order.status}, cannot cancel`);
  }
  const cancelled: CreditOrder = { ...order, status: "cancelled" };
  await ref.set(cancelled);
  logger.info("Credit order cancelled", { orderId });
  return cancelled;
}
