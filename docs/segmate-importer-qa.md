# SegMate Migration Importer — QA Checklist

White-glove importer for the 42-row SegMate → ChatMize cohort.
Card: `card-sep16-segmate-importer` · Spec: `specs/segmate-importer-spec.md` · Cohort CSV: `your_files/segmate-migration-map.csv`.

**Hard rules (never change without Karl):** SegMate MySQL is SELECT-only.
PayKickStart is read-only — no cancels, refunds, or plan changes. Nothing is
emailed to customers. Stripe subscriptions only activate after Karl's explicit
in-UI confirmation. Freeze users need a visible per-row decision.

## Pre-QA build checks
- [ ] `npm run build` (root) — zero errors
- [ ] `cd functions && npx tsc` (or npm run build) — zero errors
- [ ] Super Admin → Migration tab shows 42 rows, filters work (PayPal / Stripe silent / Stripe re-entry / Blocked)
- [ ] Row detail opens; blocked row (saad.ahmed@jeeglo.com) shows the block notice and no import actions

## Dry-run (per row)
- [ ] Dry-run on a paypal-reauth row returns the exact planned writes (auth link-or-create, workspace, membership, OG stamp, service credit, draft counts) and creates no customer data
- [ ] Dry-run on a stripe-silent row shows staged billing summary only — no subscription exists in Stripe
- [ ] Dry-run on a tier-bump candidate shows fanpage totals and active count, awaiting Karl's call
- [ ] Every dry-run appends exactly one `migration_jobs` doc of type `migrationDryRun`

## Import (test on a scratch email first, never a real customer row)
- [ ] Import creates/links Auth user, exactly one workspace, owner membership
- [ ] Re-running the same row does not duplicate workspace, membership, snapshots, or jobs (idempotent per email)
- [ ] Auth link path: importing an email that already has a Firebase Auth user links it, never creates a duplicate
- [ ] Staged bots import as snapshot drafts (deterministic ids — rerun adds none); Template Club packages become industry-package drafts
- [ ] Agency row records entitlement (agency=true, workspaceAllowance=3) but creates only one workspace

## Billing
- [ ] PayPal row: re-auth URL generates; PayKickStart untouched (verify subscription still active there)
- [ ] Stripe silent row: staging writes customer/payment-method only — confirm no subscription in Stripe dashboard
- [ ] Stripe activate button stays disabled until `ACTIVATE` is typed; activation creates exactly one subscription with 30-day trial
- [ ] Stripe re-entry rows (CsabaL@hotmail.com, marcelo@chartec.net) flag card_needed — no silent billing attempted

## Live row-by-row runbook (Karl)
1. Filter by path, work top to bottom.
2. Tier-bump candidates: verify active page count in SegMate, then click Base $9 or Bump $17 before importing.
3. For each row: Preview (dry-run) → Approve & import → check job log → billing action per path.
4. PayPal rows: send the re-auth link white-glove (no automated customer email exists).
5. saad.ahmed@jeeglo.com: blocked until Karl rules.
6. Freeze accounts ($3/mo): Karl decides per row — offer $9 or park.

## Rollback
- Import writes no destructive ops; nothing customer-facing is deleted or emailed.
- Billing activation is the only money-moving step and requires typed ACTIVATE.
- If a row imports wrong: correct in the app UI (workspace/membership/entitlements are plain Firestore docs); do not re-run until the row's status is reviewed.
