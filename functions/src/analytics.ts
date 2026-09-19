/**
 * ChatMize Analytics — cheap, aggregated event tracking.
 *
 * Cost design (Karl's rule: serverless, scale to zero, watch Firestore):
 * - NO raw event documents. Every tracked event is folded into ONE daily
 *   counter document per workspace: workspaces/{ws}/analytics/{YYYY-MM-DD}.
 * - Each tracked event = a single Firestore write (one .set with
 *   FieldValue.increment on several fields at once), fire-and-forget.
 * - The dashboard reads N daily docs for an N-day range (30 reads for
 *   30 days) plus the gamification counters it already reads. No scans.
 * - Simulator test runs go to a SEPARATE subcollection (analytics_sim) so
 *   test traffic never pollutes live numbers. The dashboard can include
 *   them with an explicit toggle.
 *
 * Field layout per daily doc (all numbers):
 *   sent/delivered/read/clicked/inbound/convosNew/subsNew/subsRemoved/
 *   fallback: { messenger, instagram, whatsapp, sms }
 *   broadcastsSent, broadcastsFailed
 *   handoffsStarted/handoffsResolved: { channel }, handoffResponseMs,
 *   handoffResponses
 *   revenueCents, revenueEvents
 *   flows: { [safeFlowId]: { name, entered, completed, revenueCents,
 *            steps: { [safeStepId]: { title, views } } } }
 *   campaigns: { [safeCampaignId]: { name, channel, sent, failed,
 *              delivered, read, clicked, unsub } }
 */
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { logger } from "firebase-functions";

const db = () => getFirestore("chatmize-prod");

export type AnalyticsChannel =
  | "messenger"
  | "instagram"
  | "whatsapp"
  | "sms"
  | "push"
  | "web";

export const ANALYTICS_CHANNELS: AnalyticsChannel[] = [
  "messenger",
  "instagram",
  "whatsapp",
  "sms",
  "push",
  "web",
];

const dayKey = (d: Date = new Date()) => d.toISOString().slice(0, 10);

/** Firestore map keys cannot contain dots; keep ids readable. */
export const sanitizeKey = (s: string): string =>
  (s || "").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80) || "unknown";

const dayRef = (workspaceId: string, day: string, sim: boolean) =>
  db()
    .collection("workspaces")
    .doc(workspaceId)
    .collection(sim ? "analytics_sim" : "analytics")
    .doc(day);

/**
 * Fold one or more counter increments into today's (or the given day's)
 * analytics doc. Fire-and-forget safe: never throws, never blocks the
 * caller. Callers should NOT await this in hot paths.
 */
export function trackAnalytics(
  workspaceId: string,
  increments: Record<string, number>,
  opts?: { sim?: boolean; day?: string },
): void {
  if (!workspaceId) return;
  const clean: Record<string, unknown> = {
    updatedAt: new Date().toISOString(),
  };
  for (const [k, v] of Object.entries(increments)) {
    if (!Number.isFinite(v) || v === 0) continue;
    clean[k] = FieldValue.increment(Math.round(v));
  }
  if (Object.keys(clean).length <= 1) return;
  dayRef(workspaceId, opts?.day ?? dayKey(), !!opts?.sim)
    .set(clean, { merge: true })
    .catch((err) =>
      logger.warn("Analytics track failed", {
        workspaceId,
        err: err instanceof Error ? err.message : String(err),
      }),
    );
}

// ---------------------------------------------------------------------------
// Message lifecycle
// ---------------------------------------------------------------------------

export function trackMessageSent(workspaceId: string, channel: AnalyticsChannel, n = 1): void {
  trackAnalytics(workspaceId, { [`sent.${channel}`]: n });
}

export function trackMessageDelivered(workspaceId: string, channel: AnalyticsChannel, n = 1): void {
  trackAnalytics(workspaceId, { [`delivered.${channel}`]: n });
}

export function trackMessageRead(workspaceId: string, channel: AnalyticsChannel, n = 1): void {
  trackAnalytics(workspaceId, { [`read.${channel}`]: n });
}

export function trackMessageClicked(workspaceId: string, channel: AnalyticsChannel, n = 1): void {
  trackAnalytics(workspaceId, { [`clicked.${channel}`]: n });
}

export function trackInbound(
  workspaceId: string,
  channel: AnalyticsChannel,
  opts?: { newConvo?: boolean; newContact?: boolean; clicked?: boolean },
): void {
  const inc: Record<string, number> = { [`inbound.${channel}`]: 1 };
  if (opts?.newConvo) inc[`convosNew.${channel}`] = 1;
  if (opts?.newContact) inc[`subsNew.${channel}`] = 1;
  if (opts?.clicked) inc[`clicked.${channel}`] = 1;
  trackAnalytics(workspaceId, inc);
}

export function trackSubscriberRemoved(workspaceId: string, channel: AnalyticsChannel, n = 1): void {
  trackAnalytics(workspaceId, { [`subsRemoved.${channel}`]: n });
}

// ---------------------------------------------------------------------------
// Broadcasts / campaigns
// ---------------------------------------------------------------------------

export interface CampaignAttribution {
  campaignId: string;
  name: string;
  channel: AnalyticsChannel;
}

export function trackBroadcastSent(
  workspaceId: string,
  campaign: CampaignAttribution,
  sent: number,
  failed: number,
): void {
  const id = sanitizeKey(campaign.campaignId);
  trackAnalytics(workspaceId, {
    broadcastsSent: sent,
    broadcastsFailed: failed,
    [`campaigns.${id}.sent`]: sent,
    [`campaigns.${id}.failed`]: failed,
    [`sent.${campaign.channel}`]: sent,
  });
  // Names ride along as plain strings (not increments).
  dayRef(workspaceId, dayKey(), false)
    .set(
      {
        [`campaigns.${id}.name`]: campaign.name.slice(0, 120),
        [`campaigns.${id}.channel`]: campaign.channel,
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    )
    .catch((err) =>
      logger.warn("Analytics campaign name write failed", {
        workspaceId,
        err: err instanceof Error ? err.message : String(err),
      }),
    );
}

export function trackBroadcastEngagement(
  workspaceId: string,
  campaignId: string,
  field: "delivered" | "read" | "clicked" | "unsub",
  n = 1,
): void {
  const id = sanitizeKey(campaignId);
  trackAnalytics(workspaceId, { [`campaigns.${id}.${field}`]: n });
}

// ---------------------------------------------------------------------------
// Flow funnel (entered -> per-step views -> completed)
// ---------------------------------------------------------------------------

export type FlowEventType = "entered" | "step" | "completed";

export function trackFlowEventInternal(
  workspaceId: string,
  flowId: string,
  flowName: string,
  type: FlowEventType,
  opts?: { stepId?: string; stepTitle?: string; sim?: boolean },
): void {
  const id = sanitizeKey(flowId);
  const inc: Record<string, number> = {};
  if (type === "entered") inc[`flows.${id}.entered`] = 1;
  if (type === "completed") inc[`flows.${id}.completed`] = 1;
  if (type === "step" && opts?.stepId) {
    const sid = sanitizeKey(opts.stepId);
    inc[`flows.${id}.steps.${sid}.views`] = 1;
  }
  trackAnalytics(workspaceId, inc, { sim: opts?.sim });
  // Names ride along as plain strings.
  const nameUpdate: Record<string, unknown> = {
    [`flows.${id}.name`]: flowName.slice(0, 120),
    updatedAt: new Date().toISOString(),
  };
  if (type === "step" && opts?.stepId && opts?.stepTitle) {
    nameUpdate[`flows.${id}.steps.${sanitizeKey(opts.stepId)}.title`] =
      opts.stepTitle.slice(0, 120);
  }
  dayRef(workspaceId, dayKey(), !!opts?.sim)
    .set(nameUpdate, { merge: true })
    .catch((err) =>
      logger.warn("Analytics flow name write failed", {
        workspaceId,
        err: err instanceof Error ? err.message : String(err),
      }),
    );
}

// ---------------------------------------------------------------------------
// Unanswered / fallback (the quality metric)
// ---------------------------------------------------------------------------

export function trackFallback(workspaceId: string, channel: AnalyticsChannel, n = 1): void {
  trackAnalytics(workspaceId, { [`fallback.${channel}`]: n });
}

// ---------------------------------------------------------------------------
// Human handoff
// ---------------------------------------------------------------------------

export function trackHandoffStarted(workspaceId: string, channel: AnalyticsChannel): void {
  trackAnalytics(workspaceId, { [`handoffsStarted.${channel}`]: 1 });
}

export function trackHandoffResolved(
  workspaceId: string,
  channel: AnalyticsChannel,
  responseMs: number,
): void {
  trackAnalytics(workspaceId, {
    [`handoffsResolved.${channel}`]: 1,
    handoffResponseMs: Math.max(0, Math.round(responseMs)),
    handoffResponses: 1,
  });
}

// ---------------------------------------------------------------------------
// Revenue attribution ("this flow earned $X")
// ---------------------------------------------------------------------------

export interface RevenueAttribution {
  flowId?: string;
  flowName?: string;
  campaignId?: string;
  campaignName?: string;
}

export function trackRevenue(
  workspaceId: string,
  amountCents: number,
  attribution?: RevenueAttribution,
): void {
  if (!Number.isFinite(amountCents) || amountCents <= 0) return;
  const inc: Record<string, number> = {
    revenueCents: Math.round(amountCents),
    revenueEvents: 1,
  };
  if (attribution?.flowId) {
    inc[`flows.${sanitizeKey(attribution.flowId)}.revenueCents`] = Math.round(amountCents);
  }
  if (attribution?.campaignId) {
    inc[`campaigns.${sanitizeKey(attribution.campaignId)}.revenueCents`] =
      Math.round(amountCents);
  }
  trackAnalytics(workspaceId, inc);
  const names: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (attribution?.flowId && attribution?.flowName) {
    names[`flows.${sanitizeKey(attribution.flowId)}.name`] =
      attribution.flowName.slice(0, 120);
  }
  if (attribution?.campaignId && attribution?.campaignName) {
    names[`campaigns.${sanitizeKey(attribution.campaignId)}.name`] =
      attribution.campaignName.slice(0, 120);
  }
  if (Object.keys(names).length > 1) {
    dayRef(workspaceId, dayKey(), false)
      .set(names, { merge: true })
      .catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// Dashboard reads
// ---------------------------------------------------------------------------

export interface DailyAnalytics {
  date: string;
  sent: Record<string, number>;
  delivered: Record<string, number>;
  read: Record<string, number>;
  clicked: Record<string, number>;
  inbound: Record<string, number>;
  convosNew: Record<string, number>;
  subsNew: Record<string, number>;
  subsRemoved: Record<string, number>;
  fallback: Record<string, number>;
  broadcastsSent: number;
  broadcastsFailed: number;
  handoffsStarted: Record<string, number>;
  handoffsResolved: Record<string, number>;
  handoffResponseMs: number;
  handoffResponses: number;
  revenueCents: number;
  revenueEvents: number;
  flows: Record<
    string,
    {
      name?: string;
      entered?: number;
      completed?: number;
      revenueCents?: number;
      steps?: Record<string, { title?: string; views?: number }>;
    }
  >;
  campaigns: Record<
    string,
    {
      name?: string;
      channel?: string;
      sent?: number;
      failed?: number;
      delivered?: number;
      read?: number;
      clicked?: number;
      unsub?: number;
      revenueCents?: number;
    }
  >;
}

const numMap = (v: unknown): Record<string, number> => {
  if (!v || typeof v !== "object") return {};
  const out: Record<string, number> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (typeof val === "number") out[k] = val;
  }
  return out;
};

const num = (v: unknown): number => (typeof v === "number" ? v : 0);

/** Read N daily docs (live or sim). One small read per day. */
export async function readDailyAnalytics(
  workspaceId: string,
  days: number,
  sim = false,
): Promise<DailyAnalytics[]> {
  const out: DailyAnalytics[] = [];
  const today = new Date();
  for (let i = 0; i < days; i++) {
    const d = new Date(today.getTime() - i * 86400000);
    const key = dayKey(d);
    const snap = await dayRef(workspaceId, key, sim).get();
    const data = (snap.data() ?? {}) as Record<string, unknown>;
    out.push({
      date: key,
      sent: numMap(data.sent),
      delivered: numMap(data.delivered),
      read: numMap(data.read),
      clicked: numMap(data.clicked),
      inbound: numMap(data.inbound),
      convosNew: numMap(data.convosNew),
      subsNew: numMap(data.subsNew),
      subsRemoved: numMap(data.subsRemoved),
      fallback: numMap(data.fallback),
      broadcastsSent: num(data.broadcastsSent),
      broadcastsFailed: num(data.broadcastsFailed),
      handoffsStarted: numMap(data.handoffsStarted),
      handoffsResolved: numMap(data.handoffsResolved),
      handoffResponseMs: num(data.handoffResponseMs),
      handoffResponses: num(data.handoffResponses),
      revenueCents: num(data.revenueCents),
      revenueEvents: num(data.revenueEvents),
      flows: (data.flows ?? {}) as DailyAnalytics["flows"],
      campaigns: (data.campaigns ?? {}) as DailyAnalytics["campaigns"],
    });
  }
  return out.reverse(); // oldest first for charts
}
