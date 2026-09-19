/**
 * Server-side plan module helpers. Mirrors src/lib/planModules.ts.
 * KEEP IN SYNC with the frontend catalog; the registry doc
 * (system_settings/plan_modules) is the runtime source of truth.
 */

export type PlanModuleType = "boolean" | "limit" | "metered";

export interface PlanModule {
  id: string;
  name: string;
  description: string;
  type: PlanModuleType;
  category: string;
  unit: string;
  defaultValue: boolean | number;
  placeholder?: boolean;
}

export const DEFAULT_PLAN_MODULES: PlanModule[] = [
  { id: "capture_tools", name: "Capture tools per workspace", description: "Capture tool limit per workspace.", type: "limit", category: "capture", unit: "per workspace", defaultValue: 5 },
  { id: "capture_tool_extra_price_cents", name: "Extra capture tool price", description: "A la carte price per extra capture tool per month.", type: "metered", category: "capture", unit: "cents per extra tool per month", defaultValue: 0 },
  { id: "seats_included", name: "Included seats", description: "Team seats included per workspace.", type: "limit", category: "seats", unit: "per workspace", defaultValue: 1 },
  { id: "seat_extra_price_cents", name: "Extra seat price", description: "Price per additional seat per workspace per month.", type: "metered", category: "seats", unit: "cents per seat per month", defaultValue: 500 },
  { id: "workspaces_included", name: "Included workspaces", description: "Workspaces included per account.", type: "limit", category: "workspaces", unit: "per account", defaultValue: 1 },
  { id: "ai_credits_monthly", name: "AI credits per month", description: "Monthly AI credit allowance.", type: "metered", category: "credits", unit: "per month", defaultValue: 0 },
  { id: "ai_credits_rollover_months", name: "Credit rollover", description: "Months of allowance that roll over.", type: "limit", category: "credits", unit: "months", defaultValue: 1 },
  { id: "ai_support_chats", name: "AI support chats", description: "AI support chats per month.", type: "metered", category: "credits", unit: "per month", defaultValue: 0 },
  { id: "contacts_limit", name: "Contact limit", description: "Max active contacts per workspace.", type: "limit", category: "credits", unit: "per workspace", defaultValue: 2500 },
  { id: "sms_allowance_monthly", name: "SMS segments included", description: "SMS segments included per month.", type: "metered", category: "credits", unit: "per month", defaultValue: 0 },
  { id: "channel_messenger", name: "Messenger channel", description: "Facebook Messenger channel.", type: "boolean", category: "channels", unit: "", defaultValue: true },
  { id: "channel_instagram", name: "Instagram channel", description: "Instagram DM channel.", type: "boolean", category: "channels", unit: "", defaultValue: true },
  { id: "channel_whatsapp", name: "WhatsApp channel", description: "WhatsApp channel.", type: "boolean", category: "channels", unit: "", defaultValue: false },
  { id: "channel_telegram", name: "Telegram channel", description: "Telegram channel.", type: "boolean", category: "channels", unit: "", defaultValue: false },
  { id: "integration_shopify", name: "Shopify integration", description: "Shopify store connection.", type: "boolean", category: "integrations", unit: "", defaultValue: false },
  { id: "integration_sheets", name: "Google Sheets integration", description: "Google Sheets connection.", type: "boolean", category: "integrations", unit: "", defaultValue: false },
  { id: "integration_bigmarker", name: "BigMarker integration", description: "BigMarker connection.", type: "boolean", category: "integrations", unit: "", defaultValue: false },
  { id: "integration_zapier", name: "Zapier and webhooks", description: "Webhooks and Zapier connectors.", type: "boolean", category: "integrations", unit: "", defaultValue: false },
  { id: "api_access", name: "API access", description: "MCP and REST API access.", type: "boolean", category: "features", unit: "", defaultValue: false },
  { id: "bookings_app", name: "Bookings app", description: "Native bookings.", type: "boolean", category: "features", unit: "", defaultValue: false, placeholder: true },
  { id: "survey_builder", name: "Survey builder", description: "Survey elements for growth tools.", type: "boolean", category: "features", unit: "", defaultValue: false, placeholder: true },
  { id: "analytics_dashboard", name: "Analytics dashboard", description: "Unified analytics.", type: "boolean", category: "features", unit: "", defaultValue: false, placeholder: true },
  { id: "snapshot_library", name: "Snapshot template library", description: "Workspace snapshots and industry packages.", type: "boolean", category: "features", unit: "", defaultValue: false },
  { id: "broadcasts", name: "Broadcasts", description: "Broadcasts and blasts.", type: "boolean", category: "features", unit: "", defaultValue: false },
  { id: "sms", name: "SMS", description: "SMS sending.", type: "boolean", category: "features", unit: "", defaultValue: false },
  { id: "copilot", name: "Copilot builder", description: "In app Copilot builder.", type: "boolean", category: "features", unit: "", defaultValue: false },
  { id: "whitelabel", name: "White label", description: "White label branding and domain.", type: "boolean", category: "features", unit: "", defaultValue: false },
];

export interface PlanLike {
  modules?: Record<string, boolean | number>;
}

const byId = (modules: PlanModule[], id: string): PlanModule | undefined =>
  modules.find((m) => m.id === id);

export function moduleValueFor(
  plan: PlanLike | null | undefined,
  moduleId: string,
  registry: PlanModule[] = DEFAULT_PLAN_MODULES,
): boolean | number {
  const override = plan?.modules?.[moduleId];
  if (override !== undefined) return override;
  return byId(registry, moduleId)?.defaultValue ?? false;
}

export function canUse(
  plan: PlanLike | null | undefined,
  moduleId: string,
  registry: PlanModule[] = DEFAULT_PLAN_MODULES,
): boolean {
  const value = moduleValueFor(plan, moduleId, registry);
  return typeof value === "boolean" ? value : value > 0;
}

export function limitFor(
  plan: PlanLike | null | undefined,
  moduleId: string,
  registry: PlanModule[] = DEFAULT_PLAN_MODULES,
): number {
  const value = moduleValueFor(plan, moduleId, registry);
  return typeof value === "number" ? value : value ? Infinity : 0;
}
