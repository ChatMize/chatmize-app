/**
 * SegMate migration importer backend.
 *
 * Folded into the metaOAuthStatus callable (proxy blocks new Cloud Function
 * creation); logic lives here so it can split out later. Every action is
 * Super Admin only (Karl runs this white-glove, row by row).
 *
 * Data model (chatmize-prod):
 *   migration_rows/{rowKey}    per-email import state, keyed by sha256(emailLower)[0:16]
 *   migration_jobs/{autoId}    append-only job log (every run, row, result)
 *   migration_staging/{rowKey} extractor payloads (bots/packages) awaiting import
 *   migration_billing/{rowKey} billing staging per migration path
 *
 * Hard guardrails (see spec ~/workspace/chatmize/specs/segmate-importer-spec.md):
 * - SegMate MySQL is SELECT-only (extractor script enforces; this function never
 *   touches MySQL at all).
 * - PayKickStart is never touched from here (read-only by policy; no API calls).
 * - Stripe: staging prepares customer+card only. Subscription creation happens
 *   ONLY via migrationBillingActivate with confirmed:true (explicit in-UI
 *   confirmation). No charges, no trials started, nothing billed before that.
 */
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { createHash, randomBytes } from "crypto";
import { MIGRATION_COHORT, MigrationCohortRow } from "./migrationCohort";

const db = () => getFirestore("chatmize-prod");
const PROJECT_ID = "gen-lang-client-0433776094";
const REAUTH_BASE_URL = "https://app.chatmize.com/billing/reauth";

/** Stripe secret lives in Secret Manager (firebase functions:secrets:set STRIPE_SECRET_KEY). */
async function stripeSecretKey(): Promise<string> {
  const tokRes = await fetch(
    "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token",
    { headers: { "Metadata-Flavor": "Google" } },
  );
  if (!tokRes.ok) throw new Error("metadata server unreachable (not on GCP?)");
  const { access_token } = (await tokRes.json()) as { access_token: string };
  const res = await fetch(
    `https://secretmanager.googleapis.com/v1/projects/${PROJECT_ID}/secrets/STRIPE_SECRET_KEY/versions/latest:access`,
    { headers: { Authorization: `Bearer ${access_token}` } },
  );
  if (!res.ok) {
    throw new Error(
      "STRIPE_SECRET_KEY not set — run: firebase functions:secrets:set STRIPE_SECRET_KEY (from Karl's Mac)",
    );
  }
  const j = (await res.json()) as { payload: { data: string } };
  return Buffer.from(j.payload.data, "base64").toString("utf8");
}

async function stripeGet(path: string, key: string): Promise<any> {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  const j = (await res.json()) as any;
  if (!res.ok) throw new Error(`Stripe GET ${path}: ${j?.error?.message ?? res.status}`);
  return j;
}

async function stripePost(path: string, key: string, params: Record<string, string>): Promise<any> {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(params),
  });
  const j = (await res.json()) as any;
  if (!res.ok) throw new Error(`Stripe POST ${path}: ${j?.error?.message ?? res.status}`);
  return j;
}

export function migrationRowKey(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex").slice(0, 16);
}

function findCohortRow(email: string): MigrationCohortRow {
  const lower = email.trim().toLowerCase();
  const row = MIGRATION_COHORT.find((r) => r.email === lower);
  if (!row) throw new HttpsError("invalid-argument", `Email ${email} is not in the 42-row migration cohort.`);
  return row;
}

async function logJob(entry: {
  type: string;
  email: string;
  ok: boolean;
  steps: string[];
  error?: string;
  byUid: string;
}): Promise<void> {
  await db()
    .collection("migration_jobs")
    .add({
      ...entry,
      at: FieldValue.serverTimestamp(),
    });
}

/** Entry point, called from metaOAuthStatus for action.startsWith("migration"). */
export async function handleMigrationAction(
  action: string,
  data: Record<string, unknown>,
  uid: string,
  token: Record<string, unknown> | undefined,
): Promise<unknown> {
  if (token?.superadmin !== true) {
    throw new HttpsError("permission-denied", "Migration importer is Super Admin only.");
  }
  const email = (data.email as string | undefined)?.trim().toLowerCase();
  switch (action) {
    case "migrationDryRun":
      if (!email) throw new HttpsError("invalid-argument", "email is required.");
      return dryRun(email, uid);
    case "migrationImport":
      if (!email) throw new HttpsError("invalid-argument", "email is required.");
      return importRow(email, uid, data);
    case "migrationStageBots":
      if (!email) throw new HttpsError("invalid-argument", "email is required.");
      return stageBots(email, uid, data.payload);
    case "migrationBillingStage":
      if (!email) throw new HttpsError("invalid-argument", "email is required.");
      return billingStage(email, uid);
    case "migrationBillingActivate":
      if (!email) throw new HttpsError("invalid-argument", "email is required.");
      if (data.confirmed !== true) {
        throw new HttpsError(
          "failed-precondition",
          "Activation needs explicit confirmation (confirmed:true). This creates a real Stripe subscription.",
        );
      }
      return billingActivate(email, uid);
    case "migrationSetTierDecision":
      if (!email) throw new HttpsError("invalid-argument", "email is required.");
      return setTierDecision(email, uid, data.decision as string | undefined);
    default:
      throw new HttpsError("invalid-argument", `Unknown migration action: ${action}`);
  }
}

// ---------------------------------------------------------------------------
// Dry run — computes exactly what WOULD be created. Writes nothing except the
// job log entry.
// ---------------------------------------------------------------------------

async function dryRun(email: string, uid: string) {
  const steps: string[] = [];
  const row = findCohortRow(email);
  steps.push(`cohort row found: ${row.name} <${row.email}> (${row.migrationPath})`);

  if (row.migrationPath === "unknown") {
    const result = {
      ok: false,
      blocked: true,
      reason:
        "Rail undetermined (saad.ahmed@jeeglo.com): no PayKickStart transactions, plan conflict. Needs Karl's individual review before import.",
      row,
    };
    await logJob({ type: "dry_run", email, ok: false, steps, error: result.reason, byUid: uid });
    return result;
  }

  // Auth user: link or create?
  let authUser: { exists: boolean; uid?: string } = { exists: false };
  try {
    const existing = await getAuth().getUserByEmail(email);
    authUser = { exists: true, uid: existing.uid };
    steps.push(`auth user EXISTS (${existing.uid}) — will link, not duplicate`);
  } catch {
    steps.push("auth user does not exist — will create");
  }

  const rowKey = migrationRowKey(email);
  const wsId = `ws-mig-${rowKey.slice(0, 10)}`;
  const wsSnap = await db().collection("workspaces").doc(wsId).get();
  steps.push(wsSnap.exists ? `workspace ${wsId} EXISTS — will reuse` : `workspace ${wsId} will be created`);

  const rowSnap = await db().collection("migration_rows").doc(rowKey).get();
  const prior = rowSnap.exists ? (rowSnap.data() as Record<string, unknown>) : null;
  if (prior?.status === "complete" || prior?.status === "imported") {
    steps.push(`row already ${prior.status} — re-run is a no-op unless force:true`);
  }

  const stagingSnap = await db().collection("migration_staging").doc(rowKey).get();
  const staged = stagingSnap.exists ? (stagingSnap.data() as Record<string, unknown>) : null;
  const botCount = (staged?.botCount as number) ?? 0;
  const packageCount = (staged?.packageCount as number) ?? 0;
  steps.push(
    staged
      ? `staged payload present: ${botCount} bot(s), ${packageCount} template package(s) → snapshot drafts`
      : "no staged bot payload — run the extractor (scripts/segmate-extract.mjs) and stage it before import, or import without bots",
  );

  const tierDecision = (prior?.tierDecision as string) ?? null;
  const plan = (prior?.planOverride as string) ?? row.suggestedPlan;

  const preview = {
    ok: true,
    email,
    name: row.name,
    wouldCreate: {
      authUser: authUser.exists ? { action: "link", uid: authUser.uid } : { action: "create" },
      workspace: {
        action: wsSnap.exists ? "reuse" : "create",
        id: wsId,
        name: `${row.name} — ChatMize`,
        plan: `$${plan}/mo (historical pricing preserved)`,
        planNote: row.isFreeze
          ? "SegMate $3/mo Freeze → ChatMize $9 base (flagged; override per row if Karl decides otherwise)"
          : undefined,
      },
      membership: { role: "owner" },
      entitlements: {
        ogStamp: "permanent OG stamp badge (every migrant)",
        agency: row.agency ? "lifetime-agency entitlement (bonus)" : "none",
        migrationBonus: "1 month service credit (monthly plan) — no cash value",
      },
      snapshots: staged
        ? {
            bots: `${botCount} SegMate bot(s) → workspace snapshot drafts (never auto-published)`,
            packages: `${packageCount} Template Club package(s) → industry-package drafts (curationStatus: draft)`,
          }
        : { note: "no staged payload — snapshots skipped until extraction is staged" },
    },
    billing: billingPreview(row),
    tierBump: row.tierBump
      ? {
          candidate: true,
          fanpageCount: row.fanpageCount,
          activePages: row.activePages,
          threshold: row.tierThreshold,
          karlDecision: tierDecision,
          note: "Karl decides per row whether total or active page count governs. No auto-bump.",
        }
      : { candidate: false },
    priorStatus: prior?.status ?? "not_started",
  };
  await logJob({ type: "dry_run", email, ok: true, steps, byUid: uid });
  return preview;
}

function billingPreview(row: MigrationCohortRow): Record<string, unknown> {
  switch (row.migrationPath) {
    case "paypal-reauth":
      return {
        path: "paypal-reauth",
        plan: "Import account + workspace + data. Generate a personal re-authorization link for Karl to send white-glove. No silent billing.",
      };
    case "stripe-silent":
      return {
        path: "stripe-silent",
        plan: "Stage: find Stripe customer by email, confirm saved card, record customer+card. Draft only — subscription is created ONLY after Karl's explicit per-batch activation.",
      };
    case "stripe-reauth":
      return {
        path: "stripe-reauth",
        plan:
          row.email === "csabal@hotmail.com"
            ? "No Stripe customer record — flag: needs card re-entry."
            : "Only an expired Amex saved — flag: needs card re-entry.",
      };
    default:
      return { path: row.migrationPath, plan: "blocked until Karl rules." };
  }
}

// ---------------------------------------------------------------------------
// Import — idempotent per email. Re-running a completed row is a no-op unless
// force:true. Every step is recorded in migration_jobs.
// ---------------------------------------------------------------------------

async function importRow(email: string, uid: string, data: Record<string, unknown>) {
  const steps: string[] = [];
  const row = findCohortRow(email);
  if (row.migrationPath === "unknown") {
    throw new HttpsError("failed-precondition", "Row is blocked: rail undetermined. Karl must rule first.");
  }
  const force = data.force === true;
  const rowKey = migrationRowKey(email);
  const rowRef = db().collection("migration_rows").doc(rowKey);
  const prior = (await rowRef.get()).data() as Record<string, unknown> | undefined;

  if ((prior?.status === "complete" || prior?.status === "imported") && !force) {
    await logJob({ type: "import", email, ok: true, steps: ["idempotent no-op: row already " + prior?.status], byUid: uid });
    return { ok: true, noop: true, status: prior?.status, workspaceId: prior?.workspaceId, authUid: prior?.authUid };
  }

  const plan = ((data.planOverride as string) || (prior?.planOverride as string) || row.suggestedPlan) as string;
  if (plan === "blocked") throw new HttpsError("failed-precondition", "Plan is blocked for this row.");
  const tierDecision =
    (data.tierDecision as string) || (prior?.tierDecision as string) || (row.tierBump ? "pending" : "n/a");
  steps.push(`plan=$${plan}/mo tierDecision=${tierDecision}${force ? " (force re-run)" : ""}`);

  try {
    // 1. Firebase Auth — link or create.
    let authUid: string;
    try {
      authUid = (await getAuth().getUserByEmail(email)).uid;
      steps.push(`auth: linked existing user ${authUid}`);
    } catch {
      const created = await getAuth().createUser({ email, displayName: row.name || undefined });
      authUid = created.uid;
      steps.push(`auth: created user ${authUid}`);
    }

    // 2. Workspace (+ owner membership). Deterministic id → idempotent.
    const wsId = `ws-mig-${rowKey.slice(0, 10)}`;
    const wsRef = db().collection("workspaces").doc(wsId);
    const wsSnap = await wsRef.get();
    const bonusMonths = 1; // monthly plans: 1 month service credit (approved decision)
    const freeUntil = new Date(Date.now() + bonusMonths * 30 * 24 * 3600 * 1000).toISOString();
    if (!wsSnap.exists) {
      await wsRef.set({
        name: `${row.name} — ChatMize`,
        slug: wsId,
        plan,
        createdAt: new Date().toISOString(),
        createdBy: "segmate-importer",
        migratedFrom: "segmate",
        segmateEmail: email,
        segmatePlan: row.segmatePlan,
        subscription: { status: "migration_bonus", bonusMonths, freeUntil, bonusGrantedAt: new Date().toISOString() },
      });
      steps.push(`workspace: created ${wsId} ($${plan}/mo, 1-month migration credit to ${freeUntil.slice(0, 10)})`);
    } else {
      steps.push(`workspace: reused ${wsId}`);
    }
    await wsRef.collection("members").doc(authUid).set(
      { role: "owner", addedAt: new Date().toISOString(), source: "segmate-importer" },
      { merge: true },
    );
    steps.push("membership: owner record written");

    // 3. User doc + permanent OG stamp.
    await db()
      .collection("users")
      .doc(authUid)
      .set(
        {
          email,
          displayName: row.name,
          migratedFrom: "segmate",
          badges: {
            og_stamp: { awardedAt: new Date().toISOString(), permanent: true, source: "segmate_migration" },
          },
        },
        { merge: true },
      );
    steps.push("user doc: OG stamp badge written (permanent)");

    // 4. Snapshots from staged payload (drafts only, never auto-published).
    const staging = (await db().collection("migration_staging").doc(rowKey).get()).data() as
      | { bots?: Array<{ name?: string; raw?: unknown }>; packages?: Array<{ name?: string; niche?: string; raw?: unknown }> }
      | undefined;
    let snapshotIds: string[] = [];
    if (staging && (staging.bots?.length || staging.packages?.length)) {
      for (const bot of staging.bots ?? []) {
        const ref = await db()
          .collection("snapshots")
          .add({
            name: bot.name || "Imported SegMate bot",
            description: `Migrated from SegMate (${email}) — draft, needs review before publishing.`,
            niche: "",
            createdByUid: authUid,
            createdByName: row.name,
            createdAt: new Date().toISOString(),
            version: 1,
            isTemplate: false,
            public: false,
            access: "subscriber",
            starterBonus: false,
            status: "draft",
            workspaceId: wsId,
            migratedFrom: "segmate",
            segmateEmail: email,
            counts: {},
            payload: { segmateRaw: bot.raw ?? null },
          });
        snapshotIds.push(ref.id);
      }
      for (const pkg of staging.packages ?? []) {
        const ref = await db()
          .collection("snapshots")
          .add({
            name: pkg.name || "Imported Template Club package",
            description: `Template Club package migrated from SegMate (${email}) — industry-package draft, needs curation.`,
            niche: pkg.niche || "",
            createdByUid: authUid,
            createdByName: row.name,
            createdAt: new Date().toISOString(),
            version: 1,
            isTemplate: true,
            curationStatus: "draft",
            public: false,
            access: "subscriber",
            starterBonus: false,
            status: "draft",
            workspaceId: wsId,
            migratedFrom: "segmate",
            segmateEmail: email,
            counts: {},
            payload: { segmateRaw: pkg.raw ?? null },
          });
        snapshotIds.push(ref.id);
      }
      steps.push(`snapshots: ${snapshotIds.length} draft(s) created`);
    } else {
      steps.push("snapshots: no staged payload — skipped (stage bots first to include them)");
    }

    // 5. Row state.
    await rowRef.set(
      {
        email,
        name: row.name,
        migrationPath: row.migrationPath,
        status: "imported",
        authUid,
        workspaceId: wsId,
        plan,
        tierDecision,
        entitlements: {
          ogStamp: true,
          agency: row.agency,
          migrationBonusMonths: bonusMonths,
        },
        snapshotIds,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    steps.push("row state: imported");

    await logJob({ type: "import", email, ok: true, steps, byUid: uid });
    return { ok: true, status: "imported", authUid, workspaceId: wsId, plan, snapshotIds, steps };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    steps.push(`FAILED: ${message}`);
    await logJob({ type: "import", email, ok: false, steps, error: message, byUid: uid });
    logger.error("SegMate import failed", { email, steps });
    throw new HttpsError("internal", `Import failed at step ${steps.length}: ${message}`);
  }
}

// ---------------------------------------------------------------------------
// Staging — stores the extractor payload for a row (Super Admin pastes /
// uploads what scripts/segmate-extract.mjs produced on the VM).
// ---------------------------------------------------------------------------

async function stageBots(email: string, uid: string, payload: unknown) {
  findCohortRow(email); // validates cohort membership
  const p = (payload ?? {}) as { bots?: unknown[]; packages?: unknown[] };
  const bots = Array.isArray(p.bots) ? p.bots : [];
  const packages = Array.isArray(p.packages) ? p.packages : [];
  const bytes = Buffer.byteLength(JSON.stringify(payload ?? {}), "utf8");
  if (bytes > 800_000) {
    throw new HttpsError(
      "invalid-argument",
      `Staged payload is ${(bytes / 1024).toFixed(0)}KB — over the 800KB staging cap. Split it per bot and stage in pieces.`,
    );
  }
  const rowKey = migrationRowKey(email);
  await db().collection("migration_staging").doc(rowKey).set({
    email,
    stagedAt: new Date().toISOString(),
    stagedBy: uid,
    botCount: bots.length,
    packageCount: packages.length,
    payload: { bots, packages },
  });
  await logJob({ type: "stage_bots", email, ok: true, steps: [`staged ${bots.length} bot(s), ${packages.length} package(s)`], byUid: uid });
  return { ok: true, botCount: bots.length, packageCount: packages.length };
}

// ---------------------------------------------------------------------------
// Billing staging — per migration path. NEVER charges. Stripe subscription
// creation happens ONLY in billingActivate with confirmed:true.
// ---------------------------------------------------------------------------

async function billingStage(email: string, uid: string) {
  const steps: string[] = [];
  const row = findCohortRow(email);
  const rowKey = migrationRowKey(email);
  const billRef = db().collection("migration_billing").doc(rowKey);

  if (row.migrationPath === "paypal-reauth") {
    const reauthToken = randomBytes(24).toString("hex");
    const reauthUrl = `${REAUTH_BASE_URL}?token=${reauthToken}`;
    await billRef.set(
      {
        email,
        path: "paypal-reauth",
        status: "reauth_pending",
        reauthToken,
        reauthUrl,
        createdAt: new Date().toISOString(),
        createdBy: uid,
      },
      { merge: true },
    );
    steps.push("re-auth link generated (Karl sends white-glove; no billing moved)");
    await db().collection("migration_rows").doc(rowKey).set({ billingStatus: "reauth_pending" }, { merge: true });
    await logJob({ type: "billing_stage", email, ok: true, steps, byUid: uid });
    return {
      ok: true,
      path: "paypal-reauth",
      status: "reauth_pending",
      reauthUrl,
      messageTemplate: `Hi ${row.name} — ChatMize is live (the new home of SegMate). Your account is ready; complete billing here to keep everything running: ${reauthUrl}`,
      note: "PayKickStart was not touched. The /billing/reauth page lands with the billing-hardening build.",
    };
  }

  if (row.migrationPath === "stripe-reauth") {
    const reason =
      row.email === "csabal@hotmail.com"
        ? "No Stripe customer record found (PK charged via one-off tokens)."
        : "Only an expired Amex is saved despite the Sept 2026 charge.";
    await billRef.set({ email, path: "stripe-reauth", status: "card_needed", reason }, { merge: true });
    steps.push("flagged: needs card re-entry");
    await db().collection("migration_rows").doc(rowKey).set({ billingStatus: "card_needed" }, { merge: true });
    await logJob({ type: "billing_stage", email, ok: true, steps, byUid: uid });
    return { ok: true, path: "stripe-reauth", status: "card_needed", reason };
  }

  if (row.migrationPath === "stripe-silent") {
    const key = await stripeSecretKey();
    const customers = (await stripeGet(`customers?email=${encodeURIComponent(email)}&limit=10`, key)) as {
      data: Array<{ id: string; email: string; created: number }>;
    };
    if (!customers.data.length) {
      throw new HttpsError("failed-precondition", `No Stripe customer found for ${email} — treat as card re-entry.`);
    }
    // Most recently created customer wins (audit found duplicate records).
    const customer = customers.data.sort((a, b) => b.created - a.created)[0];
    steps.push(`stripe customer ${customer.id}`);
    const pms = (await stripeGet(`customers/${customer.id}/payment_methods?type=card&limit=10`, key)) as {
      data: Array<{ id: string; card: { brand: string; last4: string; exp_year: number; exp_month: number } }>;
    };
    const now = new Date();
    const valid = pms.data.filter(
      (pm) => pm.card.exp_year > now.getFullYear() || (pm.card.exp_year === now.getFullYear() && pm.card.exp_month >= now.getMonth() + 1),
    );
    if (!valid.length) {
      await billRef.set({ email, path: "stripe-silent", status: "card_needed", reason: "No unexpired card on file.", customerId: customer.id }, { merge: true });
      await db().collection("migration_rows").doc(rowKey).set({ billingStatus: "card_needed" }, { merge: true });
      await logJob({ type: "billing_stage", email, ok: true, steps: [...steps, "no valid card — flagged"], byUid: uid });
      return { ok: true, path: "stripe-silent", status: "card_needed", reason: "No unexpired card on file.", customerId: customer.id };
    }
    const pm = valid[0];
    steps.push(`saved card: ${pm.card.brand} ****${pm.card.last4} (no charge, no subscription created)`);
    await billRef.set(
      {
        email,
        path: "stripe-silent",
        status: "staged",
        customerId: customer.id,
        paymentMethodId: pm.id,
        cardBrand: pm.card.brand,
        cardLast4: pm.card.last4,
        stagedAt: new Date().toISOString(),
        stagedBy: uid,
      },
      { merge: true },
    );
    await db().collection("migration_rows").doc(rowKey).set({ billingStatus: "staged" }, { merge: true });
    await logJob({ type: "billing_stage", email, ok: true, steps, byUid: uid });
    return {
      ok: true,
      path: "stripe-silent",
      status: "staged",
      customerId: customer.id,
      card: `${pm.card.brand} ****${pm.card.last4}`,
      note: "Draft only. The subscription is created ONLY via migrationBillingActivate with Karl's explicit confirmation.",
    };
  }

  throw new HttpsError("failed-precondition", `Billing staging is blocked for path ${row.migrationPath}.`);
}

/** Creates the real Stripe subscription. ONLY call with confirmed:true (Karl's explicit in-UI confirmation). */
async function billingActivate(email: string, uid: string) {
  const steps: string[] = [];
  const row = findCohortRow(email);
  if (row.migrationPath !== "stripe-silent") {
    throw new HttpsError("failed-precondition", `Activation only applies to stripe-silent rows (this row: ${row.migrationPath}).`);
  }
  const rowKey = migrationRowKey(email);
  const billSnap = await db().collection("migration_billing").doc(rowKey).get();
  const bill = billSnap.data() as
    | { status?: string; customerId?: string; paymentMethodId?: string }
    | undefined;
  if (!bill || bill.status !== "staged" || !bill.customerId || !bill.paymentMethodId) {
    throw new HttpsError("failed-precondition", "Run billing staging first — nothing is staged for this row.");
  }
  const rowSnap = await db().collection("migration_rows").doc(rowKey).get();
  const plan = ((rowSnap.data() as Record<string, unknown> | undefined)?.plan as string) || row.suggestedPlan;
  const unitAmount = plan === "17" ? 1700 : 900;

  const key = await stripeSecretKey();
  const sub = (await stripePost("subscriptions", key, {
    customer: bill.customerId,
    "items[0][price_data][unit_amount]": String(unitAmount),
    "items[0][price_data][currency]": "usd",
    "items[0][price_data][recurring][interval]": "month",
    "items[0][price_data][product_data][name]": `ChatMize $${plan}/mo (SegMate migration)`,
    default_payment_method: bill.paymentMethodId,
    trial_period_days: "30", // 1-month migration service credit: first charge after the free month
    "metadata[chatmize_migration]": "segmate",
    "metadata[segmate_email]": email,
    "metadata[activated_by]": uid,
  })) as { id: string; status: string };

  steps.push(`subscription ${sub.id} created (${sub.status}, 30-day trial = migration credit)`);
  await db().collection("migration_billing").doc(rowKey).set(
    {
      status: "active",
      subscriptionId: sub.id,
      activatedAt: new Date().toISOString(),
      activatedBy: uid,
    },
    { merge: true },
  );
  await db().collection("migration_rows").doc(rowKey).set({ billingStatus: "active", status: "complete" }, { merge: true });
  await logJob({ type: "billing_activate", email, ok: true, steps, byUid: uid });
  logger.info("SegMate migration billing activated", { email, subscription: sub.id, byUid: uid });
  return { ok: true, subscriptionId: sub.id, status: sub.status };
}

async function setTierDecision(email: string, uid: string, decision: string | undefined) {
  if (decision !== "base" && decision !== "bump") {
    throw new HttpsError("invalid-argument", 'decision must be "base" or "bump".');
  }
  const row = findCohortRow(email);
  if (!row.tierBump) throw new HttpsError("failed-precondition", "Row is not a tier-bump candidate.");
  const rowKey = migrationRowKey(email);
  await db()
    .collection("migration_rows")
    .doc(rowKey)
    .set({ tierDecision: decision, tierDecidedAt: new Date().toISOString(), tierDecidedBy: uid }, { merge: true });
  await logJob({ type: "tier_decision", email, ok: true, steps: [`tier decision: ${decision}`], byUid: uid });
  return { ok: true, decision };
}
