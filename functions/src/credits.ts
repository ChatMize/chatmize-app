import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { logger } from "firebase-functions";

export type CreditReason =
  | "monthly_grant"
  | "topup_purchase"
  | "admin_adjust"
  | "copilot_session"
  | "ai_reply"
  | "ai_content"
  | "sms_send";

export interface CreditBalance {
  workspaceId: string;
  balance: number;
  monthlyAllowance: number;
  lastResetAt: string;
  updatedAt: string;
}

const db = () => getFirestore();
const balanceRef = (workspaceId: string) =>
  db().collection("credit_balances").doc(workspaceId);
const ledgerRef = (workspaceId: string) =>
  db().collection("credit_ledger").doc(workspaceId).collection("entries");

/** Read the current balance; null when the workspace has no credit account yet. */
export async function getBalance(workspaceId: string): Promise<CreditBalance | null> {
  const snap = await balanceRef(workspaceId).get();
  if (!snap.exists) return null;
  return { workspaceId, ...(snap.data() as Omit<CreditBalance, "workspaceId">) };
}

/** Create the credit account if missing. New workspaces start at zero; the
 *  monthly allowance is set when a plan is assigned (Super Admin / Stripe). */
export async function ensureCreditAccount(
  workspaceId: string,
  monthlyAllowance = 0,
): Promise<CreditBalance> {
  const ref = balanceRef(workspaceId);
  const snap = await ref.get();
  if (snap.exists) {
    return { workspaceId, ...(snap.data() as Omit<CreditBalance, "workspaceId">) };
  }
  const now = new Date().toISOString();
  const account: CreditBalance = {
    workspaceId,
    balance: 0,
    monthlyAllowance,
    lastResetAt: now,
    updatedAt: now,
  };
  await ref.set(account);
  logger.info("Credit account created", { workspaceId, monthlyAllowance });
  return account;
}

async function appendLedger(
  workspaceId: string,
  delta: number,
  reason: CreditReason,
  balanceAfter: number,
  note?: string,
): Promise<void> {
  await ledgerRef(workspaceId).add({
    workspaceId,
    delta,
    reason,
    balanceAfter,
    note: note ?? null,
    createdAt: new Date().toISOString(),
  });
}

/**
 * Spend credits atomically. Throws when the balance is insufficient, so
 * callers can pause the AI feature and prompt a top-up instead of going
 * negative.
 */
export async function spendCredits(
  workspaceId: string,
  amount: number,
  reason: CreditReason,
  note?: string,
): Promise<{ balance: number }> {
  if (amount <= 0) throw new Error("spend amount must be positive");
  const result = await db().runTransaction(async (tx) => {
    const ref = balanceRef(workspaceId);
    const snap = await tx.get(ref);
    if (!snap.exists) {
      throw new Error(`no credit account for workspace ${workspaceId}`);
    }
    const data = snap.data() as Omit<CreditBalance, "workspaceId">;
    if (data.balance < amount) {
      throw new Error(
        `insufficient credits: balance=${data.balance} required=${amount}`,
      );
    }
    const balance = data.balance - amount;
    const now = new Date().toISOString();
    tx.update(ref, { balance, updatedAt: now });
    return balance;
  });
  await appendLedger(workspaceId, -amount, reason, result, note);
  logger.info("Credits spent", { workspaceId, amount, reason, balance: result });
  return { balance: result };
}

/** Grant credits (top-up purchase, monthly grant, or admin adjustment). */
export async function grantCredits(
  workspaceId: string,
  amount: number,
  reason: Extract<CreditReason, "monthly_grant" | "topup_purchase" | "admin_adjust">,
  note?: string,
): Promise<{ balance: number }> {
  if (amount <= 0) throw new Error("grant amount must be positive");
  await ensureCreditAccount(workspaceId);
  const result = await db().runTransaction(async (tx) => {
    const ref = balanceRef(workspaceId);
    const snap = await tx.get(ref);
    const data = snap.data() as Omit<CreditBalance, "workspaceId">;
    const balance = data.balance + amount;
    tx.update(ref, { balance, updatedAt: new Date().toISOString() });
    return balance;
  });
  await appendLedger(workspaceId, amount, reason, result, note);
  logger.info("Credits granted", { workspaceId, amount, reason, balance: result });
  return { balance: result };
}

/** Set the monthly allowance (called when a plan is assigned). */
export async function setMonthlyAllowance(
  workspaceId: string,
  monthlyAllowance: number,
): Promise<void> {
  const account = await ensureCreditAccount(workspaceId, monthlyAllowance);
  await balanceRef(workspaceId).update({
    monthlyAllowance,
    updatedAt: new Date().toISOString(),
  });
  logger.info("Monthly allowance set", {
    workspaceId,
    from: account.monthlyAllowance,
    to: monthlyAllowance,
  });
}

/** Reset every workspace balance to its monthly allowance. Runs on schedule. */
export async function resetAllMonthlyCredits(): Promise<{ reset: number }> {
  const snap = await db().collection("credit_balances").get();
  let reset = 0;
  for (const d of snap.docs) {
    const data = d.data() as Omit<CreditBalance, "workspaceId">;
    const now = new Date().toISOString();
    const delta = data.monthlyAllowance - data.balance;
    await d.ref.update({
      balance: data.monthlyAllowance,
      lastResetAt: now,
      updatedAt: now,
    });
    await appendLedger(
      d.id,
      delta,
      "monthly_grant",
      data.monthlyAllowance,
      "monthly allowance reset",
    );
    reset += 1;
  }
  logger.info("Monthly credit reset complete", { reset });
  return { reset };
}
