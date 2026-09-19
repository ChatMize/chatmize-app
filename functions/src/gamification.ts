/**
 * ChatMize Gamification — badges, streaks, revenue tracking, referrals.
 *
 * Design (approved 2026-09-18, DECISIONS.md item 17):
 * - Private leaderboard: each user sees only their own progress vs thresholds.
 * - Playful badge names. AI credits are the incentive currency.
 * - Referral rewards paid in AI credits when a referred workspace activates.
 * - Agency client badges visible to the agency (mirrored per workspace).
 * - OG stamp: permanent, SegMate migrants only, never earnable any other way.
 *
 * Cost guardrails: evaluation piggybacks on writes that already happen
 * (message triggers, send callables, revenue logging). No scheduled scans,
 * no per-message function storms. Counters live in a single doc per
 * workspace; one read + one write per event.
 */

import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { grantCredits } from "./credits";
import { trackRevenue } from "./analytics";

const db = () => getFirestore("chatmize-prod");

export type BadgeTrack = "messages" | "streaks" | "money" | "getting_started" | "og";

export interface BadgeDef {
  id: string;
  name: string;
  description: string;
  track: BadgeTrack;
  graphic: string; // /badges/*.webp
  credits: number; // AI credit reward, granted once per workspace
}

export const BADGES: BadgeDef[] = [
  {
    id: "og_stamp",
    name: "OG Stamp",
    description: "Original SegMate crew. This stamp can never be earned any other way.",
    track: "og",
    graphic: "/badges/og-stamp.webp",
    credits: 500,
  },
  {
    id: "first_flow",
    name: "Flow Boss",
    description: "Published your first BotMap flow.",
    track: "getting_started",
    graphic: "/badges/first-flow.webp",
    credits: 100,
  },
  {
    id: "first_broadcast",
    name: "Broadcaster",
    description: "Sent your first broadcast.",
    track: "getting_started",
    graphic: "/badges/first-broadcast.webp",
    credits: 100,
  },
  {
    id: "first_reply",
    name: "First Responder",
    description: "Handled your first conversation message.",
    track: "messages",
    graphic: "/badges/messages-bronze.webp",
    credits: 25,
  },
  {
    id: "chatterbox",
    name: "Chatterbox",
    description: "100 messages handled. The conversations are flowing.",
    track: "messages",
    graphic: "/badges/messages-bronze.webp",
    credits: 100,
  },
  {
    id: "thousand_club",
    name: "Thousand Club",
    description: "1,000 messages handled. Certified conversation machine.",
    track: "messages",
    graphic: "/badges/messages-silver.webp",
    credits: 250,
  },
  {
    id: "titan_10k",
    name: "10K Titan",
    description: "10,000 messages handled. An absolute unit.",
    track: "messages",
    graphic: "/badges/messages-gold.webp",
    credits: 750,
  },
  {
    id: "legend_100k",
    name: "100K Legend",
    description: "100,000 messages handled. Legendary status.",
    track: "messages",
    graphic: "/badges/messages-gold.webp",
    credits: 2500,
  },
  {
    id: "week_warrior",
    name: "Week Warrior",
    description: "Active 7 days in a row. Consistency compounds.",
    track: "streaks",
    graphic: "/badges/streak-flame.webp",
    credits: 200,
  },
  {
    id: "month_master",
    name: "Month Master",
    description: "Active 30 days in a row. Unstoppable.",
    track: "streaks",
    graphic: "/badges/streak-flame.webp",
    credits: 800,
  },
  {
    id: "first_dollar",
    name: "First Dollar",
    description: "Logged your first dollar of attributed revenue.",
    track: "money",
    graphic: "/badges/money-coin.webp",
    credits: 100,
  },
  {
    id: "grand_slam",
    name: "Grand Slam",
    description: "$1,000 in attributed revenue. Money loves speed.",
    track: "money",
    graphic: "/badges/money-coin.webp",
    credits: 500,
  },
];

export const badgeById = (id: string): BadgeDef | undefined =>
  BADGES.find((b) => b.id === id);

export interface EarnedBadge {
  id: string;
  earnedAt: string;
}

interface Counters {
  messagesHandled: number;
  flowsPublished: number;
  broadcastsSent: number;
  revenueCents: number;
  streakDays: number;
  lastActiveDay: string; // YYYY-MM-DD (UTC)
  rewardsGranted: string[]; // badge ids whose credit reward already hit the workspace
  updatedAt: string;
}

const countersRef = (workspaceId: string) =>
  db().collection("workspaces").doc(workspaceId).collection("gamification").doc("counters");

const freshCounters = (): Counters => ({
  messagesHandled: 0,
  flowsPublished: 0,
  broadcastsSent: 0,
  revenueCents: 0,
  streakDays: 0,
  lastActiveDay: "",
  rewardsGranted: [],
  updatedAt: new Date().toISOString(),
});

async function getCounters(workspaceId: string): Promise<Counters> {
  const snap = await countersRef(workspaceId).get();
  if (!snap.exists) {
    const c = freshCounters();
    await countersRef(workspaceId).set(c);
    return c;
  }
  return { ...freshCounters(), ...(snap.data() as Partial<Counters>) };
}

const todayDay = () => new Date().toISOString().slice(0, 10);
const yesterdayDay = () => new Date(Date.now() - 86400000).toISOString().slice(0, 10);

async function getOwnerUids(workspaceId: string): Promise<string[]> {
  const snap = await db()
    .collection("workspaces")
    .doc(workspaceId)
    .collection("members")
    .where("role", "in", ["owner", "admin"])
    .get();
  return snap.docs.map((d) => d.id);
}

async function getUserBadges(uid: string): Promise<EarnedBadge[]> {
  const snap = await db().collection("users").doc(uid).get();
  const data = snap.data() as { badges?: EarnedBadge[] } | undefined;
  return Array.isArray(data?.badges) ? data.badges! : [];
}

/**
 * Grant a badge record to a user (idempotent) and mirror it per workspace
 * so agencies see their clients' badges. Credit rewards are granted once
 * per workspace, tracked on the counters doc.
 */
async function grantBadge(
  workspaceId: string,
  uid: string,
  badgeId: string,
  counters: Counters,
): Promise<boolean> {
  const badge = badgeById(badgeId);
  if (!badge) return false;
  const userRef = db().collection("users").doc(uid);
  const existing = await getUserBadges(uid);
  const now = new Date().toISOString();
  let granted = false;

  if (!existing.some((b) => b.id === badgeId)) {
    await userRef.set(
      {
        badges: [...existing, { id: badgeId, earnedAt: now }],
        updatedAt: now,
      },
      { merge: true },
    );
    granted = true;
    // Per-workspace mirror for agency visibility.
    const displaySnap = await userRef.get();
    const displayName =
      (displaySnap.data() as { displayName?: string } | undefined)?.displayName ?? "";
    await db()
      .collection("workspaces")
      .doc(workspaceId)
      .collection("gamification")
      .doc(`member_${uid}`)
      .set({ uid, displayName, badges: [...existing, { id: badgeId, earnedAt: now }], updatedAt: now }, { merge: true });
    logger.info("Badge granted", { workspaceId, uid, badgeId });
    // Referral activation: first badge earned by a referred user pays the referrer.
    await maybePayReferrer(uid);
  }

  if (!counters.rewardsGranted.includes(badgeId) && badge.credits > 0) {
    await grantCredits(workspaceId, badge.credits, "badge_reward", `Badge earned: ${badge.name}`).catch(
      (err) => logger.error("Badge credit grant failed", { workspaceId, badgeId, err }),
    );
    counters.rewardsGranted.push(badgeId);
    await countersRef(workspaceId).set(
      { rewardsGranted: counters.rewardsGranted, updatedAt: now },
      { merge: true },
    );
  }
  return granted;
}

async function maybePayReferrer(referredUid: string): Promise<void> {
  const REFERRAL_CREDITS = 500;
  const userRef = db().collection("users").doc(referredUid);
  const snap = await userRef.get();
  const data = snap.data() as
    | { referredBy?: string; referralRewarded?: boolean; referredWorkspaceId?: string }
    | undefined;
  if (!data?.referredBy || data.referralRewarded || !data.referredWorkspaceId) return;
  await grantCredits(
    data.referredWorkspaceId,
    REFERRAL_CREDITS,
    "referral_reward",
    `Referral activated: ${referredUid}`,
  ).catch((err) => logger.error("Referral credit grant failed", { referredUid, err }));
  await userRef.set({ referralRewarded: true }, { merge: true });
  logger.info("Referral reward paid", { referredUid, referrer: data.referredBy });
}

function badgeEarnedFor(badgeId: string, c: Counters): boolean {
  switch (badgeId) {
    case "first_reply":
      return c.messagesHandled >= 1;
    case "chatterbox":
      return c.messagesHandled >= 100;
    case "thousand_club":
      return c.messagesHandled >= 1000;
    case "titan_10k":
      return c.messagesHandled >= 10000;
    case "legend_100k":
      return c.messagesHandled >= 100000;
    case "week_warrior":
      return c.streakDays >= 7;
    case "month_master":
      return c.streakDays >= 30;
    case "first_dollar":
      return c.revenueCents >= 1;
    case "grand_slam":
      return c.revenueCents >= 100000;
    case "first_flow":
      return c.flowsPublished >= 1;
    case "first_broadcast":
      return c.broadcastsSent >= 1;
    default:
      return false;
  }
}

/**
 * Evaluate all non-OG badges against counters and grant newly earned ones
 * to the actor (when known) plus workspace owners. Returns the badge ids
 * that were newly granted to anyone.
 */
export async function evaluateBadges(
  workspaceId: string,
  actorUid?: string,
): Promise<string[]> {
  const counters = await getCounters(workspaceId);
  const targets = new Set<string>();
  if (actorUid) targets.add(actorUid);
  for (const ownerUid of await getOwnerUids(workspaceId)) targets.add(ownerUid);
  const newlyGranted: string[] = [];
  for (const badge of BADGES) {
    if (badge.id === "og_stamp") continue; // handled separately
    if (!badgeEarnedFor(badge.id, counters)) continue;
    for (const uid of targets) {
      if (await grantBadge(workspaceId, uid, badge.id, counters)) {
        newlyGranted.push(badge.id);
      }
    }
  }
  return [...new Set(newlyGranted)];
}

/** OG stamp: granted when the migrant flag is set. Never earnable otherwise. */
export async function maybeGrantOgStamp(workspaceId: string, uid: string): Promise<boolean> {
  const userRef = db().collection("users").doc(uid);
  const snap = await userRef.get();
  const data = snap.data() as { isSegMateMigrant?: boolean } | undefined;
  if (!data?.isSegMateMigrant) return false;
  const counters = await getCounters(workspaceId);
  return grantBadge(workspaceId, uid, "og_stamp", counters);
}

function touchStreak(c: Counters): void {
  const today = todayDay();
  if (c.lastActiveDay === today) return;
  c.streakDays = c.lastActiveDay === yesterdayDay() ? c.streakDays + 1 : 1;
  c.lastActiveDay = today;
}

/** Record one handled message (inbound or outbound). Returns new badge ids. */
export async function recordMessageHandled(
  workspaceId: string,
  actorUid?: string,
): Promise<string[]> {
  const counters = await getCounters(workspaceId);
  counters.messagesHandled += 1;
  touchStreak(counters);
  counters.updatedAt = new Date().toISOString();
  await countersRef(workspaceId).set(counters, { merge: true });
  return evaluateBadges(workspaceId, actorUid);
}

/** Record a client-side event (flow published, broadcast sent). */
export async function recordClientEvent(
  workspaceId: string,
  uid: string,
  event: "flow_published" | "broadcast_sent",
  extraMessages = 0,
): Promise<string[]> {
  const counters = await getCounters(workspaceId);
  if (event === "flow_published") counters.flowsPublished += 1;
  if (event === "broadcast_sent") counters.broadcastsSent += 1;
  touchStreak(counters);
  counters.updatedAt = new Date().toISOString();
  await countersRef(workspaceId).set(counters, { merge: true });
  if (event === "broadcast_sent") {
    // Broadcast volume counts: 1 for the send action + actual delivered sends.
    counters.messagesHandled += 1 + Math.max(0, Math.floor(extraMessages));
    await countersRef(workspaceId).set({ messagesHandled: counters.messagesHandled }, { merge: true });
  }
  const earned = await evaluateBadges(workspaceId, uid);
  await maybeGrantOgStamp(workspaceId, uid);
  return earned;
}

export interface RevenueEntry {
  amountCents: number;
  note: string;
  loggedBy: string;
  loggedAt: string;
  source: "manual" | "flow_action";
  /** Optional attribution for the analytics dashboard ("this flow earned $X"). */
  flowId?: string;
  flowName?: string;
  campaignId?: string;
  campaignName?: string;
}

export interface RevenueAttributionInput {
  flowId?: string;
  flowName?: string;
  campaignId?: string;
  campaignName?: string;
}

/** Log revenue (money track v1). Sums per workspace in revenueCents. */
export async function logRevenue(
  workspaceId: string,
  uid: string,
  amountCents: number,
  note: string,
  source: "manual" | "flow_action",
  attribution?: RevenueAttributionInput,
): Promise<{ revenueCents: number; newBadges: string[] }> {
  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    throw new Error("amount must be a positive number of cents");
  }
  if (amountCents > 100000000) throw new Error("amount looks wrong; max is $1,000,000 per entry");
  const entry: RevenueEntry = {
    amountCents: Math.round(amountCents),
    note: note.slice(0, 280),
    loggedBy: uid,
    loggedAt: new Date().toISOString(),
    source,
    ...(attribution?.flowId ? { flowId: attribution.flowId.slice(0, 120) } : {}),
    ...(attribution?.flowName ? { flowName: attribution.flowName.slice(0, 120) } : {}),
    ...(attribution?.campaignId ? { campaignId: attribution.campaignId.slice(0, 120) } : {}),
    ...(attribution?.campaignName ? { campaignName: attribution.campaignName.slice(0, 120) } : {}),
  };
  await db()
    .collection("workspaces")
    .doc(workspaceId)
    .collection("gamification")
    .doc("revenue_log")
    .collection("entries")
    .add(entry);
  const counters = await getCounters(workspaceId);
  counters.revenueCents += entry.amountCents;
  touchStreak(counters);
  counters.updatedAt = new Date().toISOString();
  await countersRef(workspaceId).set(counters, { merge: true });
  // Analytics mirror: daily revenue counters + flow/campaign attribution
  // (fire-and-forget; the dashboard reads these instead of scanning entries).
  trackRevenue(workspaceId, entry.amountCents, attribution);
  const newBadges = await evaluateBadges(workspaceId, uid);
  await maybeGrantOgStamp(workspaceId, uid);
  logger.info("Revenue logged", { workspaceId, uid, amountCents: entry.amountCents, source });
  return { revenueCents: counters.revenueCents, newBadges };
}

// ---------------------------------------------------------------------------
// Referrals
// ---------------------------------------------------------------------------

const codeFor = () =>
  `CM-${Math.random().toString(36).slice(2, 8).toUpperCase().replace(/[^A-Z0-9]/g, "X")}`;

/** Get (or mint) the user's referral code. */
export async function getReferralCode(uid: string): Promise<string> {
  const userRef = db().collection("users").doc(uid);
  const snap = await userRef.get();
  const existing = (snap.data() as { referralCode?: string } | undefined)?.referralCode;
  if (existing) return existing;
  const code = codeFor();
  await userRef.set({ referralCode: code }, { merge: true });
  return code;
}

/** Apply a referral code at signup. One referrer per user, never yourself. */
export async function applyReferral(
  uid: string,
  code: string,
  workspaceId: string,
): Promise<{ ok: boolean; referrerUid?: string }> {
  const clean = (code || "").trim().toUpperCase();
  if (!clean) throw new Error("referral code is required");
  const userRef = db().collection("users").doc(uid);
  const snap = await userRef.get();
  const data = snap.data() as { referredBy?: string } | undefined;
  if (data?.referredBy) return { ok: false };
  const match = await db().collection("users").where("referralCode", "==", clean).limit(1).get();
  if (match.empty) throw new Error("that referral code does not exist");
  const referrerUid = match.docs[0].id;
  if (referrerUid === uid) throw new Error("you cannot refer yourself");
  await userRef.set(
    { referredBy: referrerUid, referralRewarded: false, referredWorkspaceId: workspaceId },
    { merge: true },
  );
  logger.info("Referral applied", { uid, referrerUid, workspaceId });
  return { ok: true, referrerUid };
}

/** Sanitized state for the Rewards UI (private: only the caller's own data). */
export async function getGamificationState(workspaceId: string, uid: string) {
  const counters = await getCounters(workspaceId);
  const badges = await getUserBadges(uid);
  const userSnap = await db().collection("users").doc(uid).get();
  const userData = (userSnap.data() as {
    referralCode?: string;
    isSegMateMigrant?: boolean;
  }) || {};
  // Self-heal the OG stamp whenever state is read.
  if (userData.isSegMateMigrant && !badges.some((b) => b.id === "og_stamp")) {
    await maybeGrantOgStamp(workspaceId, uid);
    badges.push({ id: "og_stamp", earnedAt: new Date().toISOString() });
  }
  const referralCode = userData.referralCode ?? (await getReferralCode(uid));
  return {
    badges: BADGES,
    earned: badges,
    counters: {
      messagesHandled: counters.messagesHandled,
      flowsPublished: counters.flowsPublished,
      broadcastsSent: counters.broadcastsSent,
      revenueCents: counters.revenueCents,
      streakDays: counters.streakDays,
    },
    referralCode,
    isSegMateMigrant: !!userData.isSegMateMigrant,
  };
}
