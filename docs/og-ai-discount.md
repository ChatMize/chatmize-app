# OG AI Credit Discount — implementation notes (feat/og-ai-discount)

Settled decision (2026-09-18): AI credits sell a la carte at 4x ChatMize's AI
cost and in monthly bundles at 3x cost. OG customers (SegMate migrants) get
40% off BOTH formats.

## What existed before this branch

- `credit_balances/{workspaceId}` + `credit_ledger/{workspaceId}/entries`
  with atomic spend/grant (functions/src/credits.ts).
- Pricing constants: 1 credit = $0.001 face value, 4x a la carte, 3x plan
  (functions/src/ai/router.ts `CREDIT_PRICING`, `TOPUP_PACKS`).
- Callables: `getCreditBalance` (read), `adjustCredits` (superadmin manual),
  `resetMonthlyCredits` (scheduled). Frontend helpers in src/lib/billing.ts.
- Plans as data in the `plans` collection; `stripePriceId?` placeholders.
- No OG flag, no purchase path, no Stripe wiring.

## What this branch adds

- **OG flag**: `og?: boolean` + `ogGrantedAt?: string` on the Workspace
  type (src/types/workspace.ts). Set once at migration; immutable. Nothing
  sets it yet — the migration importer writes it.
- **functions/src/creditPricing.ts** (pure, no Firebase deps): `quoteCredits()`
  computes list price (integer cents) and applies `OG_DISCOUNT_RATE = 0.4`
  for OG workspaces. The 40% OG discount is the only discount in the system.
- **functions/src/creditOrders.ts**: `credit_orders/{orderId}` schema —
  workspaceId, uid, credits, format, listPriceCents, ogDiscountCents,
  finalPriceCents, isOg, status (quoted|fulfilled|cancelled), timestamps.
- **Callables** (functions/src/index.ts):
  - `quoteCreditPurchase` — any workspace member; reads the workspace's real
    `og` flag, writes a `quoted` order, returns it. No money moves, no
    credits granted.
  - `fulfillCreditOrder` — Super Admin only; idempotent (transaction-guarded)
    flip quoted -> fulfilled, then grants credits via the ledger as
    `topup_purchase`. Callers must verify payment first; today that is a
    human Super Admin, next the Stripe webhook.
  - `cancelCreditOrder` (module fn, no callable yet) — quoted orders only.
- **Frontend** (src/lib/billing.ts): `previewCreditPrice()` (display-only,
  server recomputes), `quoteCreditPurchase()`, `formatCents()`.

## What remains before go-live

1. Stripe wiring: Checkout session per quoted order + webhook calling
   `fulfillCreditOrder` after payment verification. Nothing in this branch
   charges money — that is intentional.
2. Purchase UI: credits page calling `quoteCreditPurchase`, showing the
   OG-discounted price, then handing off to Stripe.
3. Migration importer sets `og: true` + `ogGrantedAt` on migrated workspaces.
4. Reconciliation: a periodic job comparing `credit_orders` (fulfilled)
   against `credit_ledger` (topup_purchase) to catch flip-without-grant
   orphans (see note in creditOrders.ts).
5. Carryover cap still TBD (spec suggests 3x monthly plan amount).
6. Deploy the new functions + set the Cloud Run invoker binding per the
   manual-deploy runbook in AGENTS.md.

## Pricing sanity check

- 2,500 credits a la carte: list $10.00, OG pays $6.00.
- 2,500 credits bundle: list $7.50, OG pays $4.50.
- 25,000 credits a la carte: list $100.00, OG pays $60.00.
