/**
 * Website Overlays (overlays.js SDK) backend.
 *
 * Two surfaces, both folded into EXISTING Cloud Functions because creating
 * new functions through this environment's egress proxy fails (the functionId
 * never binds on POST .../functions). The logic lives here in its own module
 * so it can be split into a dedicated function later with a ~5-line change.
 *
 * 1. Callable actions (folded into `metaOAuthStatus`, routed by `action`):
 *      overlayList      -> { overlays: [...] }            (private docs + stats merged)
 *      overlaySave      -> { overlay }                    (create or update)
 *      overlayDelete    -> { ok: true }
 *    overlaySetStatus   -> { ok: true }
 *    Every mutation republishes the public snapshot doc
 *    `overlayConfigs/{workspaceId}` (read-only to the world; the snippet
 *    fetches it straight from Firestore).
 *
 * 2. Tracking endpoint (folded into `metaWebhook`, cloaker-style):
 *      POST /__overlay/track  { workspaceId, events: [{overlayId, event}] }
 *    event is one of impression|click|lead. One batched Firestore write per
 *    flush via FieldValue.increment — no reads, no per-event writes.
 *
 * Cost posture (serverless-and-cheap): config reads happen client-side via
 * Firestore REST (zero function invocations); tracking is one write per
 * flush (up to 25 events); config writes only happen when an admin saves.
 */
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";

const db = () => getFirestore("chatmize-prod");

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type OverlayAction =
  | "overlayList"
  | "overlaySave"
  | "overlayDelete"
  | "overlaySetStatus";

const OVERLAY_TYPES = new Set(["popup_modal", "slider", "page_takeover", "sticky_bar"]);
const OVERLAY_TRIGGERS = new Set(["immediate", "time_delay", "exit_intent", "scroll_depth", "button_click"]);
const OVERLAY_POSITIONS = new Set(["bottom_right", "bottom_left", "center", "top_bar", "bottom_bar"]);
const OVERLAY_STATUSES = new Set(["active", "paused", "draft"]);
const OVERLAY_CTA_ACTIONS = new Set(["open_bot", "open_url", "copy_code", "enter_contest", "take_survey"]);
const TRACK_EVENTS = new Set(["impression", "click", "lead", "survey_completed"]);

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const WS_RE = /^[A-Za-z0-9_-]{1,128}$/;
const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const PLACEHOLDER_DOMAIN_RE = /yourdomain|example\.com|localhost/i;

/* ------------------------------------------------------------------ */
/* Sanitization: whitelist fields, clamp lengths, validate enums.      */
/* ------------------------------------------------------------------ */

function str(v: unknown, max: number): string {
  if (typeof v !== "string") return "";
  return v.slice(0, max);
}
function num(v: unknown, dflt: number, min: number, max: number): number {
  const n = typeof v === "number" ? v : parseFloat(String(v));
  if (!isFinite(n)) return dflt;
  return Math.min(max, Math.max(min, n));
}
function strArr(v: unknown, maxItems: number, maxLen: number): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const item of v) {
    if (typeof item !== "string") continue;
    const s = item.slice(0, maxLen).trim();
    if (s && !out.includes(s)) out.push(s);
    if (out.length >= maxItems) break;
  }
  return out;
}
function safeRedirectUrl(v: unknown): string {
  const s = str(v, 500).trim();
  return /^https?:\/\//i.test(s) ? s : "";
}

/** Strip obvious placeholder domains (e.g. *.yourdomain.com) before publish. */
function cleanDomains(list: string[]): string[] {
  return list.filter((d) => !PLACEHOLDER_DOMAIN_RE.test(d));
}

export interface SanitizedOverlay {
  id: string;
  name: string;
  type: string;
  status: string;
  headline: string;
  subheadline: string;
  badgeText: string;
  offerCode: string;
  ctaText: string;
  ctaAction: string;
  redirectUrl: string;
  brandColor: string;
  theme: "dark" | "light";
  position: string;
  triggerType: string;
  triggerDelaySeconds: number;
  triggerScrollPercent: number;
  exitIntentSensitivity: "low" | "medium" | "high";
  mobileTrigger: {
    enabled: boolean;
    triggerType: string;
    delaySeconds: number;
    scrollPercent: number;
  } | null;
  frequency: { cooldownHours: number; maxPerVisitor: number };
  pageTargeting: { mode: "all" | "include" | "exclude"; patterns: string[] };
  abGroup: string;
  abWeight: number;
  whitelistedDomains: string[];
  connectedBotId: string;
  botName: string;
  surveyId: string;
  surveyName: string;
  requireEmailCapture: boolean;
  requireNameCapture: boolean;
  removeBranding: boolean;
  updatedAt: string;
}

function sanitizeOverlay(input: unknown, fallbackId: string): SanitizedOverlay {
  const o = (input ?? {}) as Record<string, unknown>;
  const id = typeof o.id === "string" && ID_RE.test(o.id) ? o.id : fallbackId;
  const type = typeof o.type === "string" && OVERLAY_TYPES.has(o.type) ? o.type : "popup_modal";
  const status = typeof o.status === "string" && OVERLAY_STATUSES.has(o.status) ? o.status : "draft";
  const triggerType =
    typeof o.triggerType === "string" && OVERLAY_TRIGGERS.has(o.triggerType) ? o.triggerType : "time_delay";
  const position =
    typeof o.position === "string" && OVERLAY_POSITIONS.has(o.position) ? o.position : "center";
  const ctaAction =
    typeof o.ctaAction === "string" && OVERLAY_CTA_ACTIONS.has(o.ctaAction) ? o.ctaAction : "open_url";
  const theme = o.theme === "light" ? "light" : "dark";

  const mtRaw = o.mobileTrigger as Record<string, unknown> | undefined;
  const mt =
    mtRaw && typeof mtRaw === "object"
      ? {
          enabled: mtRaw.enabled !== false,
          triggerType:
            typeof mtRaw.triggerType === "string" && OVERLAY_TRIGGERS.has(mtRaw.triggerType)
              ? mtRaw.triggerType
              : "time_delay",
          delaySeconds: num(mtRaw.delaySeconds, 5, 0, 300),
          scrollPercent: num(mtRaw.scrollPercent, 50, 1, 100),
        }
      : null;

  const fRaw = o.frequency as Record<string, unknown> | undefined;
  const ptRaw = o.pageTargeting as Record<string, unknown> | undefined;
  const ptMode =
    ptRaw && (ptRaw.mode === "include" || ptRaw.mode === "exclude") ? ptRaw.mode : "all";

  return {
    id,
    name: str(o.name, 80) || "Untitled overlay",
    type,
    status,
    headline: str(o.headline, 140),
    subheadline: str(o.subheadline, 300),
    badgeText: str(o.badgeText, 40),
    offerCode: str(o.offerCode, 40),
    ctaText: str(o.ctaText, 60) || "Learn More",
    ctaAction,
    redirectUrl: safeRedirectUrl(o.redirectUrl),
    brandColor: typeof o.brandColor === "string" && HEX_RE.test(o.brandColor) ? o.brandColor : "#3b82f6",
    theme,
    position,
    triggerType,
    triggerDelaySeconds: num(o.triggerDelaySeconds, 5, 0, 300),
    triggerScrollPercent: num(o.triggerScrollPercent, 50, 1, 100),
    exitIntentSensitivity:
      o.exitIntentSensitivity === "low" || o.exitIntentSensitivity === "high" ? o.exitIntentSensitivity : "medium",
    mobileTrigger: mt,
    frequency: {
      cooldownHours: num(fRaw?.cooldownHours, 24, 0, 720),
      maxPerVisitor: Math.round(num(fRaw?.maxPerVisitor, 0, 0, 1000)),
    },
    pageTargeting: {
      mode: ptMode,
      patterns: strArr(ptRaw?.patterns, 20, 200),
    },
    /* A/B allocation: overlays sharing an abGroup compete; the snippet
       picks one per visitor weighted by abWeight, sticky via localStorage. */
    abGroup: str(o.abGroup, 64),
    abWeight: Math.round(num(o.abWeight, 50, 1, 100)),
    whitelistedDomains: strArr(o.whitelistedDomains, 10, 100),
    connectedBotId: str(o.connectedBotId, 128),
    botName: str(o.botName, 80),
    surveyId: typeof o.surveyId === "string" && ID_RE.test(o.surveyId) ? o.surveyId : "",
    surveyName: str(o.surveyName, 80),
    requireEmailCapture: o.requireEmailCapture === true,
    requireNameCapture: o.requireNameCapture === true,
    removeBranding: o.removeBranding === true,
    updatedAt: new Date().toISOString(),
  };
}

/* ------------------------------------------------------------------ */
/* Public snapshot: only active overlays, only snippet-safe fields.    */
/* ------------------------------------------------------------------ */

function toPublicShape(o: Record<string, unknown>): Record<string, unknown> {
  return {
    id: o.id,
    type: o.type,
    headline: o.headline ?? "",
    subheadline: o.subheadline ?? "",
    badgeText: o.badgeText ?? "",
    offerCode: o.offerCode ?? "",
    ctaText: o.ctaText ?? "",
    ctaAction: o.ctaAction ?? "open_url",
    redirectUrl: o.redirectUrl ?? "",
    brandColor: o.brandColor ?? "#3b82f6",
    theme: o.theme ?? "dark",
    position: o.position ?? "center",
    triggerType: o.triggerType ?? "time_delay",
    triggerDelaySeconds: o.triggerDelaySeconds ?? 5,
    triggerScrollPercent: o.triggerScrollPercent ?? 50,
    exitIntentSensitivity: o.exitIntentSensitivity ?? "medium",
    mobileTrigger: o.mobileTrigger ?? null,
    frequency: o.frequency ?? { cooldownHours: 24, maxPerVisitor: 0 },
    pageTargeting: o.pageTargeting ?? { mode: "all", patterns: [] },
    abGroup: o.abGroup ?? "",
    abWeight: o.abWeight ?? 50,
    /* Placeholder domains never reach the snippet (would block everything). */
    whitelistedDomains: cleanDomains(Array.isArray(o.whitelistedDomains) ? (o.whitelistedDomains as string[]) : []),
    requireEmailCapture: o.requireEmailCapture === true,
    requireNameCapture: o.requireNameCapture === true,
    removeBranding: o.removeBranding === true,
    surveyId: o.surveyId ?? "",
    surveyName: o.surveyName ?? "",
  };
}

/** Regenerate overlayConfigs/{workspaceId} from the private overlay docs. */
export async function publishOverlayConfig(workspaceId: string): Promise<void> {
  const snap = await db().collection("workspaces").doc(workspaceId).collection("overlays").get();
  const overlays: Record<string, unknown>[] = [];
  snap.forEach((d) => {
    const data = d.data();
    if (data.status === "active") overlays.push(toPublicShape({ ...data, id: d.id }));
  });
  overlays.sort((a, b) => String(b.id).localeCompare(String(a.id)));
  await db()
    .collection("overlayConfigs")
    .doc(workspaceId)
    .set(
      {
        version: 1,
        workspaceId,
        updatedAt: FieldValue.serverTimestamp(),
        overlays,
      },
      { merge: true }
    );
}

/* ------------------------------------------------------------------ */
/* Callable actions. Caller must have run requireWorkspaceAccess.       */
/* ------------------------------------------------------------------ */

export async function overlayList(workspaceId: string) {
  const [overlaysSnap, statsSnap] = await Promise.all([
    db().collection("workspaces").doc(workspaceId).collection("overlays").get(),
    db().collection("overlayStats").doc(workspaceId).get(),
  ]);
  const stats = (statsSnap.data()?.overlays ?? {}) as Record<
    string,
    { impressions?: number; clicks?: number; leads?: number }
  >;
  const overlays: Record<string, unknown>[] = [];
  overlaysSnap.forEach((d) => {
    const data = d.data();
    const s = stats[d.id] ?? {};
    overlays.push({
      ...data,
      id: d.id,
      totalViews: s.impressions ?? 0,
      totalInteractions: s.clicks ?? 0,
      totalLeads: s.leads ?? 0,
    });
  });
  overlays.sort((a, b) => String(b.updatedAt ?? "").localeCompare(String(a.updatedAt ?? "")));
  return { overlays };
}

export async function overlaySave(workspaceId: string, uid: string, input: unknown) {
  if (!input || typeof input !== "object") {
    throw new HttpsError("invalid-argument", "overlay payload is required.");
  }
  const col = db().collection("workspaces").doc(workspaceId).collection("overlays");
  const raw = input as Record<string, unknown>;
  const isUpdate = typeof raw.id === "string" && ID_RE.test(raw.id);
  let docRef;
  let existingData: Record<string, unknown> = {};
  if (isUpdate) {
    docRef = col.doc(raw.id as string);
    const existingSnap = await docRef.get();
    if (!existingSnap.exists) throw new HttpsError("not-found", "Overlay not found.");
    existingData = existingSnap.data() ?? {};
  } else {
    docRef = col.doc();
  }
  const clean = sanitizeOverlay(raw, docRef.id);
  const now = new Date().toISOString();
  await docRef.set(
    {
      ...clean,
      id: docRef.id,
      createdAt: existingData.createdAt ?? now,
      createdBy: existingData.createdBy ?? uid,
      updatedAt: now,
    },
    { merge: true }
  );
  await publishOverlayConfig(workspaceId);
  logger.info("Overlay saved", { workspaceId, overlayId: docRef.id, status: clean.status });
  return { overlay: { ...clean, id: docRef.id, createdAt: existingData.createdAt ?? now } };
}

export async function overlayDelete(workspaceId: string, overlayId: unknown) {
  if (typeof overlayId !== "string" || !ID_RE.test(overlayId)) {
    throw new HttpsError("invalid-argument", "overlayId is required.");
  }
  const docRef = db().collection("workspaces").doc(workspaceId).collection("overlays").doc(overlayId);
  const existing = await docRef.get();
  if (!existing.exists) throw new HttpsError("not-found", "Overlay not found.");
  await docRef.delete();
  await publishOverlayConfig(workspaceId);
  logger.info("Overlay deleted", { workspaceId, overlayId });
  return { ok: true };
}

export async function overlaySetStatus(workspaceId: string, overlayId: unknown, status: unknown) {
  if (typeof overlayId !== "string" || !ID_RE.test(overlayId)) {
    throw new HttpsError("invalid-argument", "overlayId is required.");
  }
  if (typeof status !== "string" || !OVERLAY_STATUSES.has(status)) {
    throw new HttpsError("invalid-argument", "status must be active, paused, or draft.");
  }
  const docRef = db().collection("workspaces").doc(workspaceId).collection("overlays").doc(overlayId);
  const existing = await docRef.get();
  if (!existing.exists) throw new HttpsError("not-found", "Overlay not found.");
  await docRef.update({ status, updatedAt: new Date().toISOString() });
  await publishOverlayConfig(workspaceId);
  logger.info("Overlay status changed", { workspaceId, overlayId, status });
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Tracking endpoint: POST /__overlay/track (folded into metaWebhook). */
/* Cloaker-style contract: returns true when the request was handled.  */
/* ------------------------------------------------------------------ */

export interface OverlayTrackReq {
  path?: string;
  method?: string;
  body?: unknown;
  header(name: string): string | undefined;
}
export interface OverlayTrackRes {
  status(code: number): OverlayTrackRes;
  set(name: string, value: string): OverlayTrackRes;
  send(body: string): void;
  json(body: unknown): void;
  sendStatus(code: number): void;
}

const TRACK_PATH = "/__overlay/track";
const MAX_EVENTS_PER_FLUSH = 25;

function setCors(res: OverlayTrackRes): void {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");
  res.set("Access-Control-Max-Age", "86400");
}

export async function handleOverlayTrackRequest(
  req: OverlayTrackReq,
  res: OverlayTrackRes
): Promise<boolean> {
  if ((req.path || "") !== TRACK_PATH) return false;

  if (req.method === "OPTIONS") {
    setCors(res);
    res.sendStatus(204);
    return true;
  }
  if (req.method !== "POST") {
    setCors(res);
    res.sendStatus(405);
    return true;
  }
  setCors(res);

  try {
    const body = (req.body ?? {}) as {
      workspaceId?: unknown;
      events?: unknown;
    };
    const workspaceId = body.workspaceId;
    const events = body.events;
    if (typeof workspaceId !== "string" || !WS_RE.test(workspaceId)) {
      res.status(400).json({ ok: false, error: "bad workspaceId" });
      return true;
    }
    if (!Array.isArray(events) || events.length === 0 || events.length > MAX_EVENTS_PER_FLUSH) {
      res.status(400).json({ ok: false, error: "bad events" });
      return true;
    }

    /* Aggregate into a single batched write: one Firestore write per flush
       no matter how many events arrived. Invalid entries are dropped.
       Lead events may carry {email, name}: persisted per overlay after a
       single existence check (keeps the endpoint cheap under spam). */
    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const counts: Record<string, number> = {};
    const leadWrites: Array<{ overlayId: string; email: string; name: string }> = [];
    let accepted = 0;
    for (const e of events) {
      const evt = e as { overlayId?: unknown; event?: unknown; data?: unknown };
      if (typeof evt !== "object" || evt === null) continue;
      if (typeof evt.overlayId !== "string" || !ID_RE.test(evt.overlayId)) continue;
      if (typeof evt.event !== "string" || !TRACK_EVENTS.has(evt.event)) continue;
      accepted++;
      const key = `${evt.overlayId}.${evt.event}`;
      counts[key] = (counts[key] ?? 0) + 1;
      if (evt.event === "lead" && evt.data && typeof evt.data === "object") {
        const d = evt.data as Record<string, unknown>;
        const email = typeof d.email === "string" ? d.email.trim().slice(0, 254) : "";
        const name = typeof d.name === "string" ? d.name.trim().slice(0, 120) : "";
        if (EMAIL_RE.test(email)) leadWrites.push({ overlayId: evt.overlayId, email, name });
      }
    }
    if (accepted === 0) {
      res.status(400).json({ ok: false, error: "no valid events" });
      return true;
    }
    const keys = Object.keys(counts);
    const update: Record<string, unknown> = {
      workspaceId,
      updatedAt: FieldValue.serverTimestamp(),
    };
    for (const key of keys) {
      update[`overlays.${key}s`] = FieldValue.increment(counts[key]);
    }
    const batch = db().batch();
    batch.set(db().collection("overlayStats").doc(workspaceId), update, { merge: true });
    /* Persist captured leads under the overlay they came from. A single
       batched read verifies the overlays exist; lead writes go only to
       real overlays in this workspace. */
    if (leadWrites.length > 0) {
      const uniqueIds = [...new Set(leadWrites.map((l) => l.overlayId))];
      const overlayRefs = uniqueIds.map((id) =>
        db().collection("workspaces").doc(workspaceId).collection("overlays").doc(id)
      );
      const snaps = await db().getAll(...overlayRefs);
      const real = new Set(snaps.filter((s) => s.exists).map((s) => s.id));
      const nowIso = new Date().toISOString();
      for (const l of leadWrites) {
        if (!real.has(l.overlayId)) continue;
        batch.set(
          db()
            .collection("workspaces")
            .doc(workspaceId)
            .collection("overlays")
            .doc(l.overlayId)
            .collection("leads")
            .doc(),
          { email: l.email, name: l.name, ts: nowIso, source: "overlays.js" }
        );
      }
    }
    await batch.commit();
    res.status(200).json({ ok: true, accepted });
  } catch (err) {
    /* Tracking must never break a customer page: log, answer 200. */
    logger.warn("Overlay track failed", { error: String(err) });
    res.status(200).json({ ok: false });
  }
  return true;
}
