import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { getApp } from "firebase/app";
import { getFunctions, httpsCallable } from "firebase/functions";
import { db } from "./firebase";

/**
 * Canonical billing model. Plans are DATA, not code: Super Admin creates and
 * edits them in the `plans` Firestore collection without deploying.
 */

// Every capability a plan can unlock. Features gate UI and backend behavior
// through hasFeature() in entitlements.ts. Add new keys here, never inline.
export type PlanFeature =
  | "messenger"
  | "instagram"
  | "whatsapp"
  | "flow_builder"
  | "broadcasts"
  | "recurring_notifications"
  | "sms"
  | "ai_agents"
  | "copilot"
  | "webhooks"
  | "whitelabel"
  | "subaccounts"
  | "migration_bridge"
  | "api_access"
  | "priority_support"
  | "dfu_onboarding"
  | "done_for_you_flows"
  | "managed_broadcasts"
  | "dedicated_manager"
  | "snapshot_library";

export const FEATURE_LABELS: Record<PlanFeature, string> = {
  messenger: "Facebook Messenger channel",
  instagram: "Instagram DMs",
  whatsapp: "WhatsApp channel",
  flow_builder: "Drag & drop flow builder",
  broadcasts: "Broadcasts & blasts",
  recurring_notifications: "Meta Recurring Notifications",
  sms: "SMS via Twilio",
  ai_agents: "AI smart agents & lead qualification",
  copilot: "In-app Copilot builder",
  webhooks: "Webhooks & Zapier connectors",
  whitelabel: "White-label branding & domain",
  subaccounts: "Client sub-accounts",
  migration_bridge: "1-click migration bridge",
  api_access: "Direct Meta webhook event relays",
  priority_support: "Priority support",
  dfu_onboarding: "Done-for-you onboarding",
  done_for_you_flows: "Team builds your flows",
  managed_broadcasts: "Managed broadcasts",
  dedicated_manager: "Dedicated account manager",
  snapshot_library: "Snapshot template library",
};

export const ALL_FEATURES = Object.keys(FEATURE_LABELS) as PlanFeature[];

/**
 * Fulfillment track. DIY = self-service, the user spends their own credits.
 * DFU (done-for-you) = white-glove, Karl's team operates the AI on the
 * client's behalf out of the plan's credit pool.
 */
export type PlanMode = "diy" | "dfu";

export const PLAN_MODE_LABELS: Record<PlanMode, string> = {
  diy: "DIY Self Service",
  dfu: "Done For You",
};

export interface Plan {
  id: string;
  name: string;
  tagline?: string;
  /** DIY self service vs DFU white-glove fulfillment. */
  mode: PlanMode;
  /** Monthly price in cents (4900 = $49). */
  priceMonthlyCents: number;
  /** Max active contacts; null = unlimited. */
  contactLimit: number | null;
  /** AI credits granted each month. DFU plans draw the service team's usage from this pool. */
  aiCreditsMonthly: number;
  /** SMS segments included each month before credit billing kicks in. Draft default. */
  smsAllowanceMonthly: number;
  features: PlanFeature[];
  /**
   * Modular plan composition: moduleId -> value (boolean for on/off modules,
   * number for limit/metered modules). Overrides the module registry defaults.
   * See src/lib/planModules.ts. Built in the Super Admin plan builder UI.
   */
  modules?: Record<string, boolean | number>;
  /** DFU service line items, e.g. "We build your first 3 flows". */
  serviceInclusions: string[];
  badge?: string;
  color?: string;
  /** Stripe price id, wired when billing goes live. */
  stripePriceId?: string;
  /** Hidden plans stay assignable by Super Admin but off the pricing page. */
  isPublic: boolean;
  /** Denormalized for the Super Admin dashboard. */
  subscribersCount: number;
  updatedAt: string;
}

// Default tiers. Strawman prices/limits: Karl edits these in the Super Admin
// UI (stored in Firestore), never in code.
export const DEFAULT_PLANS: Plan[] = [
  {
    id: "starter",
    name: "Starter Messenger",
    tagline: "Manual setup: you build every map and connection yourself",
    mode: "diy",
    priceMonthlyCents: 4900,
    contactLimit: 2500,
    aiCreditsMonthly: 0,
    smsAllowanceMonthly: 0,
    features: ["messenger", "instagram", "flow_builder"],
    serviceInclusions: [],
    color: "from-blue-500/20 to-cyan-500/20 border-cyan-500/30",
    isPublic: true,
    subscribersCount: 184,
    updatedAt: new Date().toISOString(),
  },
  {
    id: "pro",
    name: "Pro Automation & Blasts",
    tagline: "Broadcasts, SMS, and AI agents for growing teams",
    mode: "diy",
    priceMonthlyCents: 12900,
    contactLimit: 10000,
    aiCreditsMonthly: 10000,
    smsAllowanceMonthly: 500,
    features: [
      "messenger",
      "instagram",
      "whatsapp",
      "flow_builder",
      "broadcasts",
      "recurring_notifications",
      "sms",
      "ai_agents",
      "webhooks",
      "priority_support",
    ],
    serviceInclusions: [],
    badge: "Most Popular",
    color: "from-purple-500/20 to-indigo-500/20 border-purple-500/40",
    isPublic: true,
    subscribersCount: 420,
    updatedAt: new Date().toISOString(),
  },
  {
    id: "agency",
    name: "Agency & White-Label",
    tagline: "Sub-accounts and white-label for agencies",
    mode: "diy",
    priceMonthlyCents: 29900,
    contactLimit: null,
    aiCreditsMonthly: 50000,
    smsAllowanceMonthly: 5000,
    features: [
      "messenger",
      "instagram",
      "whatsapp",
      "flow_builder",
      "broadcasts",
      "recurring_notifications",
      "sms",
      "ai_agents",
      "copilot",
      "webhooks",
      "whitelabel",
      "subaccounts",
      "migration_bridge",
      "api_access",
      "priority_support",
      "snapshot_library",
    ],
    serviceInclusions: [],
    badge: "Enterprise",
    color: "from-amber-500/20 to-orange-500/20 border-amber-500/40",
    isPublic: true,
    subscribersCount: 78,
    updatedAt: new Date().toISOString(),
  },
];

export interface Subscription {
  workspaceId: string;
  planId: string;
  status: "active" | "past_due" | "canceled" | "trialing";
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  updatedAt: string;
}

export type CreditReason =
  | "monthly_grant"
  | "topup_purchase"
  | "admin_adjust"
  | "copilot_session"
  | "ai_reply"
  | "ai_content";

export interface CreditLedgerEntry {
  id: string;
  workspaceId: string;
  /** Negative for spend, positive for grants. */
  delta: number;
  reason: CreditReason;
  balanceAfter: number;
  note?: string;
  createdAt: string;
}

export interface CreditBalance {
  workspaceId: string;
  balance: number;
  monthlyAllowance: number;
  lastResetAt: string;
  updatedAt: string;
}

export function formatPrice(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

// --- Firestore data layer (plans collection) ---

const plansRef = collection(db, "plans");

/** Backfill defaults for plan docs written before a field existed. */
function normalizePlan(id: string, data: Omit<Plan, "id">): Plan {
  return { id, smsAllowanceMonthly: 0, modules: {}, ...data };
}

export function subscribeToPlans(
  onUpdate: (plans: Plan[]) => void,
  onError?: (err: Error) => void,
) {
  return onSnapshot(
    plansRef,
    (snap) => {
      const plans: Plan[] = [];
      snap.forEach((d) => plans.push(normalizePlan(d.id, d.data() as Omit<Plan, "id">)));
      onUpdate(plans);
    },
    (err) => {
      console.error("Error listening to plans:", err);
      onError?.(err);
    },
  );
}

/** Seed the default tiers when the collection is empty (idempotent). */
export async function ensureDefaultPlans(): Promise<void> {
  const snap = await getDocs(plansRef);
  if (!snap.empty) return;
  for (const plan of DEFAULT_PLANS) {
    const { id, ...data } = plan;
    await setDoc(doc(plansRef, id), data);
  }
}

export async function savePlan(plan: Plan): Promise<void> {
  const { id, ...data } = plan;
  await setDoc(doc(plansRef, id), { ...data, updatedAt: new Date().toISOString() }, { merge: true });
}

export async function deletePlan(planId: string): Promise<void> {
  await deleteDoc(doc(plansRef, planId));
}

export function subscribeToPublicPlans(
  onUpdate: (plans: Plan[]) => void,
  onError?: (err: Error) => void,
) {
  const q = query(plansRef, where("isPublic", "==", true));
  return onSnapshot(
    q,
    (snap) => {
      const plans: Plan[] = [];
      snap.forEach((d) => plans.push(normalizePlan(d.id, d.data() as Omit<Plan, "id">)));
      onUpdate(plans);
    },
    (err) => {
      console.error("Error listening to public plans:", err);
      onError?.(err);
    },
  );
}

// --- Cloud Functions callables (AI credits) ---

const functions = getFunctions(getApp(), "us-west2");

/** Read (and lazily create) a workspace's credit balance. Member or Super Admin. */
export async function fetchCreditBalance(workspaceId: string): Promise<CreditBalance> {
  const fn = httpsCallable<{ workspaceId: string }, CreditBalance>(functions, "getCreditBalance");
  const res = await fn({ workspaceId });
  return res.data;
}

/** Super Admin only: grant (positive delta) or deduct (negative) credits. */
export async function adminAdjustCredits(
  workspaceId: string,
  delta: number,
  reason: CreditReason,
  note?: string,
): Promise<{ balance: number }> {
  const fn = httpsCallable<
    { workspaceId: string; delta: number; reason: CreditReason; note?: string },
    { balance: number }
  >(functions, "adjustCredits");
  const res = await fn({ workspaceId, delta, reason, note });
  return res.data;
}
