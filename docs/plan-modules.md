# Plan modules (modular plan builder)

Karl's rule (2026-09-19): plans are built MODULARLY. Every sellable option is a
module. Plans are composed from modules. Plans change without deploys because
the registry and plan definitions live in Firestore.

## The rule for every feature builder

**Every new feature registers its module as part of its build.** No exceptions.

1. Add your module to `DEFAULT_PLAN_MODULES` in BOTH:
   - `src/lib/planModules.ts` (frontend catalog)
   - `functions/src/planModules.ts` (server catalog, keep in sync)
2. Choose a type:
   - `boolean`: on/off (channels, integrations, api access)
   - `limit`: count cap (capture tools per workspace, seats, workspaces)
   - `metered`: counted units (AI credits, support chats, prices)
3. Give it a `category` (capture, seats, workspaces, credits, channels,
   integrations, features), a `unit` (e.g. "per workspace"), and a sensible
   `defaultValue` used when a plan does not override it.
4. Mark `placeholder: true` if the feature is still in build.
5. Enforce it in your feature code (see below).

## Enforcing modules in feature code

Frontend:

```ts
import { canUse, limitFor } from "../lib/planModules";
import { usePlan } from "../lib/entitlements";

const plan = usePlan(workspacePlanId);

// Boolean gate
if (!canUse(plan, "bookings_app")) {
  return <UpgradePromptModal resourceName="bookings" limit={0} onClose={...} />;
}

// Limit gate
const max = limitFor(plan, "capture_tools");
if (items.length >= max) {
  setLimitModalOpen(true);
  return;
}
```

`<UpgradePromptModal>` lives at `src/components/UpgradePromptModal.tsx`. It offers
both paths Karl wants: upgrade the plan, or buy a la carte.

Server side (bookings, surveys, analytics, anything enforced in Functions):

```ts
import { canUse, limitFor } from "./planModules";
// load the plan doc's `modules` field, then:
if (!canUse(planLike, "survey_builder")) throw new HttpsError("permission-denied", ...);
const max = limitFor(planLike, "capture_tools");
```

There is also a `getModuleValue` callable: pass `{ workspaceId, moduleId }`,
get back `{ value, allowed, limit }`. And a Super Admin `seedPlanModules`
callable for the registry.

## How plans are composed

- Registry: `system_settings/plan_modules` doc. Managed in Super Admin >
  Plans for Sale > Plan Modules (seed, edit, add).
- Plan definitions: `plans/{planId}` docs. Each plan has a
  `modules: Record<moduleId, boolean | number>` map of overrides.
- Resolution: plan override wins, otherwise the registry default, otherwise
  false. `moduleValueFor`, `canUse`, `limitFor` implement this on both sides.

## Current module catalog

Capture: `capture_tools` (limit per workspace, default 5),
`capture_tool_extra_price_cents` (a la carte price).
Seats: `seats_included` (per workspace), `seat_extra_price_cents` (default 500).
Workspaces: `workspaces_included` (per account).
Credits: `ai_credits_monthly`, `ai_credits_rollover_months`,
`ai_support_chats`, `contacts_limit`, `sms_allowance_monthly`.
Channels: `channel_messenger`, `channel_instagram`, `channel_whatsapp`,
`channel_telegram`.
Integrations: `integration_shopify`, `integration_sheets`,
`integration_bigmarker`, `integration_zapier`.
Features: `api_access`, `bookings_app` (in build), `survey_builder` (in build),
`analytics_dashboard` (in build), `snapshot_library`, `broadcasts`, `sms`,
`copilot`, `whitelabel`.

Decided values live in DECISIONS.md; the registry is the runtime source of truth.
