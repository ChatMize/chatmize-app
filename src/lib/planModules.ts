import { useEffect, useState } from "react";
import { doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";
import type { Plan } from "./billing";

/**
 * Modular plan builder. Every sellable option is a MODULE; plans are composed
 * from modules. Plans change without deploys because the module registry and
 * plan definitions live in Firestore.
 *
 * Module types:
 * - boolean: feature on/off (channels, integrations, api access)
 * - limit: count cap per scope (capture tools per workspace, seats, workspaces)
 * - metered: counted units (AI credits, support chats, extra seat price)
 *
 * Enforcement pattern (the rule for every feature builder):
 *   import { canUse, limitFor } from "../lib/planModules";
 *   if (!canUse(plan, "bookings_app")) return <UpgradePrompt/>;
 *   const max = limitFor(plan, "capture_tools");
 *
 * New features MUST register their module in DEFAULT_PLAN_MODULES below as
 * part of the build. See docs/plan-modules.md.
 */

export type PlanModuleType = "boolean" | "limit" | "metered";

export type PlanModuleCategory =
  | "capture"
  | "seats"
  | "workspaces"
  | "credits"
  | "channels"
  | "integrations"
  | "features";

export const MODULE_CATEGORY_LABELS: Record<PlanModuleCategory, string> = {
  capture: "Capture tools",
  seats: "Seats",
  workspaces: "Workspaces",
  credits: "Credits and usage",
  channels: "Channels",
  integrations: "Integrations",
  features: "Features",
};

export interface PlanModule {
  id: string;
  name: string;
  description: string;
  type: PlanModuleType;
  category: PlanModuleCategory;
  /** Human scope label, e.g. "per workspace" or "per month". */
  unit: string;
  /** Value used when a plan does not override the module. */
  defaultValue: boolean | number;
  /** True while the feature is still being built. Shows in admin only. */
  placeholder?: boolean;
}

/**
 * The canonical module catalog. Seed values reflect Karl's decided pricing
 * (see DECISIONS.md). Super Admin can edit these in the admin UI; this list
 * is the fallback and the seed source.
 */
export const DEFAULT_PLAN_MODULES: PlanModule[] = [
  // --- Capture tools (Karl 2026-09-19: called "capture tools", not nurture tools)
  {
    id: "capture_tools",
    name: "Capture tools per workspace",
    description: "How many capture tools (popups, sliders, takeovers, sticky bars, waitlists, contests, QR) a workspace can create. Extra tools can be bought a la carte or unlocked by upgrading.",
    type: "limit",
    category: "capture",
    unit: "per workspace",
    defaultValue: 5,
  },
  {
    id: "capture_tool_extra_price_cents",
    name: "Extra capture tool price",
    description: "A la carte price for each capture tool above the plan limit, per month.",
    type: "metered",
    category: "capture",
    unit: "cents per extra tool per month",
    defaultValue: 0,
  },
  // --- Seats (Karl 2026-09-18: $5 per seat per workspace per month)
  {
    id: "seats_included",
    name: "Included seats",
    description: "Team seats included per workspace. $9 tier includes 1, $17 tier includes 2, OG workspaces include 3.",
    type: "limit",
    category: "seats",
    unit: "per workspace",
    defaultValue: 1,
  },
  {
    id: "seat_extra_price_cents",
    name: "Extra seat price",
    description: "Price per additional seat per workspace per month.",
    type: "metered",
    category: "seats",
    unit: "cents per seat per month",
    defaultValue: 500,
  },
  // --- Workspaces
  {
    id: "workspaces_included",
    name: "Included workspaces",
    description: "Workspaces included per account. $17 tier includes 3. OG migrants keep 3 grandfathered.",
    type: "limit",
    category: "workspaces",
    unit: "per account",
    defaultValue: 1,
  },
  // --- Credits and usage
  {
    id: "ai_credits_monthly",
    name: "AI credits per month",
    description: "$17 tier gets 5000 per month. Rolls over up to one month of allowance. Future free tier gets 500 with no rollover.",
    type: "metered",
    category: "credits",
    unit: "per month",
    defaultValue: 0,
  },
  {
    id: "ai_credits_rollover_months",
    name: "Credit rollover",
    description: "How many months of allowance can roll over. Paid tiers roll up to one month, free tier has no rollover.",
    type: "limit",
    category: "credits",
    unit: "months",
    defaultValue: 1,
  },
  {
    id: "ai_support_chats",
    name: "AI support chats",
    description: "AI support chats per month: 100 on $9, 500 on $17, then metered.",
    type: "metered",
    category: "credits",
    unit: "per month",
    defaultValue: 0,
  },
  {
    id: "contacts_limit",
    name: "Contact limit",
    description: "Max active contacts. Plan threshold counting uses contacts plus AI credits plus workspaces.",
    type: "limit",
    category: "credits",
    unit: "per workspace",
    defaultValue: 2500,
  },
  {
    id: "sms_allowance_monthly",
    name: "SMS segments included",
    description: "SMS segments included per month before credit billing kicks in. Billed at 25 percent over carrier cost.",
    type: "metered",
    category: "credits",
    unit: "per month",
    defaultValue: 0,
  },
  // --- Channels
  {
    id: "channel_messenger",
    name: "Messenger channel",
    description: "Facebook Messenger channel connection.",
    type: "boolean",
    category: "channels",
    unit: "",
    defaultValue: true,
  },
  {
    id: "channel_instagram",
    name: "Instagram channel",
    description: "Instagram DM channel connection.",
    type: "boolean",
    category: "channels",
    unit: "",
    defaultValue: true,
  },
  {
    id: "channel_whatsapp",
    name: "WhatsApp channel",
    description: "WhatsApp channel connection.",
    type: "boolean",
    category: "channels",
    unit: "",
    defaultValue: false,
  },
  {
    id: "channel_telegram",
    name: "Telegram channel",
    description: "Telegram channel connection.",
    type: "boolean",
    category: "channels",
    unit: "",
    defaultValue: false,
  },
  // --- Integrations
  {
    id: "integration_shopify",
    name: "Shopify integration",
    description: "Connect a Shopify store: abandoned cart recovery, order updates, post purchase flows.",
    type: "boolean",
    category: "integrations",
    unit: "",
    defaultValue: false,
  },
  {
    id: "integration_sheets",
    name: "Google Sheets integration",
    description: "Log contact fields and variables to a Google Sheet, look rows up for personalization.",
    type: "boolean",
    category: "integrations",
    unit: "",
    defaultValue: false,
  },
  {
    id: "integration_bigmarker",
    name: "BigMarker integration",
    description: "Register contacts for webinars and sync attendance status.",
    type: "boolean",
    category: "integrations",
    unit: "",
    defaultValue: false,
  },
  {
    id: "integration_zapier",
    name: "Zapier and webhooks",
    description: "Webhooks and Zapier connectors.",
    type: "boolean",
    category: "integrations",
    unit: "",
    defaultValue: false,
  },
  // --- Features
  {
    id: "api_access",
    name: "API access",
    description: "MCP and REST API access. Included on all paid tiers, never on free.",
    type: "boolean",
    category: "features",
    unit: "",
    defaultValue: false,
  },
  {
    id: "bookings_app",
    name: "Bookings app",
    description: "Native bookings with availability calendar and reminders.",
    type: "boolean",
    category: "features",
    unit: "",
    defaultValue: false,
    placeholder: true,
  },
  {
    id: "survey_builder",
    name: "Survey builder",
    description: "Survey elements for popups, slide ins, and growth tools.",
    type: "boolean",
    category: "features",
    unit: "",
    defaultValue: false,
    placeholder: true,
  },
  {
    id: "analytics_dashboard",
    name: "Analytics dashboard",
    description: "Flow funnels, message performance, subscriber growth, revenue attribution.",
    type: "boolean",
    category: "features",
    unit: "",
    defaultValue: false,
    placeholder: true,
  },
  {
    id: "snapshot_library",
    name: "Snapshot template library",
    description: "Full workspace snapshots and industry packages.",
    type: "boolean",
    category: "features",
    unit: "",
    defaultValue: false,
  },
  {
    id: "broadcasts",
    name: "Broadcasts",
    description: "Broadcasts and blasts with delivery reporting.",
    type: "boolean",
    category: "features",
    unit: "",
    defaultValue: false,
  },
  {
    id: "sms",
    name: "SMS",
    description: "SMS sending via Twilio.",
    type: "boolean",
    category: "features",
    unit: "",
    defaultValue: false,
  },
  {
    id: "copilot",
    name: "Copilot builder",
    description: "In app Copilot builder.",
    type: "boolean",
    category: "features",
    unit: "",
    defaultValue: false,
  },
  {
    id: "whitelabel",
    name: "White label",
    description: "White label branding and domain.",
    type: "boolean",
    category: "features",
    unit: "",
    defaultValue: false,
  },
];

export const MODULE_INDEX: Record<string, PlanModule> = Object.fromEntries(
  DEFAULT_PLAN_MODULES.map((m) => [m.id, m]),
);

// --- Firestore registry layer (system_settings/plan_modules) ---

const registryRef = doc(db, "system_settings", "plan_modules");

function normalizeModules(data: Record<string, unknown>): PlanModule[] {
  const out: PlanModule[] = [];
  for (const m of DEFAULT_PLAN_MODULES) {
    const saved = data[m.id] as Partial<PlanModule> | undefined;
    out.push({ ...m, ...(saved || {}), id: m.id });
  }
  // Include any admin-added modules not in the code list.
  for (const [id, saved] of Object.entries(data)) {
    if (!MODULE_INDEX[id] && saved && typeof saved === "object") {
      out.push({ ...(saved as PlanModule), id });
    }
  }
  return out;
}

/** Seed the registry when empty (idempotent). */
export async function ensureDefaultModules(): Promise<void> {
  const snap = await getDoc(registryRef);
  if (snap.exists()) return;
  const modules: Record<string, PlanModule> = {};
  for (const m of DEFAULT_PLAN_MODULES) modules[m.id] = m;
  await setDoc(registryRef, {
    modules,
    updatedAt: new Date().toISOString(),
  });
}

export function subscribeToModules(
  onUpdate: (modules: PlanModule[]) => void,
  onError?: (err: Error) => void,
) {
  return onSnapshot(
    registryRef,
    (snap) => {
      if (!snap.exists()) {
        onUpdate(DEFAULT_PLAN_MODULES);
        return;
      }
      const data = snap.data() as { modules?: Record<string, unknown> };
      onUpdate(normalizeModules(data.modules || {}));
    },
    (err) => {
      console.error("Error listening to plan modules:", err);
      onError?.(err);
    },
  );
}

export async function saveModule(module: PlanModule): Promise<void> {
  const snap = await getDoc(registryRef);
  const data = (snap.data() as { modules?: Record<string, PlanModule> } | undefined)?.modules || {};
  await setDoc(
    registryRef,
    { modules: { ...data, [module.id]: module }, updatedAt: new Date().toISOString() },
    { merge: true },
  );
}

// --- Enforcement helpers ---

export type ModuleValue = boolean | number;

/**
 * Resolve the effective value of a module for a plan: the plan's override
 * wins, otherwise the module's default. Unknown modules resolve false.
 */
export function moduleValueFor(
  plan: Plan | null | undefined,
  moduleId: string,
  modules: PlanModule[] = DEFAULT_PLAN_MODULES,
): ModuleValue {
  const def = modules.find((m) => m.id === moduleId) ?? MODULE_INDEX[moduleId];
  const override = plan?.modules?.[moduleId];
  if (override !== undefined) return override;
  if (!def) return false;
  return def.defaultValue;
}

/** Boolean gate: is this module switched on for the plan? */
export function canUse(
  plan: Plan | null | undefined,
  moduleId: string,
  modules: PlanModule[] = DEFAULT_PLAN_MODULES,
): boolean {
  const value = moduleValueFor(plan, moduleId, modules);
  if (typeof value === "boolean") return value;
  return value > 0;
}

/**
 * Limit gate: the numeric cap for a limit/metered module.
 * Returns Infinity when the module is boolean-on or the value is not numeric.
 */
export function limitFor(
  plan: Plan | null | undefined,
  moduleId: string,
  modules: PlanModule[] = DEFAULT_PLAN_MODULES,
): number {
  const value = moduleValueFor(plan, moduleId, modules);
  if (typeof value === "number") return value;
  return value ? Infinity : 0;
}

/** Live module registry, falling back to the code defaults. */
export function usePlanModules(): { modules: PlanModule[]; loading: boolean } {
  const [modules, setModules] = useState<PlanModule[]>(DEFAULT_PLAN_MODULES);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    ensureDefaultModules()
      .catch((e) => console.warn("Could not ensure plan modules:", e))
      .finally(() => {
        unsub = subscribeToModules(
          (data) => {
            setModules(data.length > 0 ? data : DEFAULT_PLAN_MODULES);
            setLoading(false);
          },
          () => setLoading(false),
        );
      });
    return () => unsub?.();
  }, []);

  return { modules, loading };
}
