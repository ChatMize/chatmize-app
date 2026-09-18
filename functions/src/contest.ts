/**
 * ChatMize Contest Engine (viral contests / giveaways).
 *
 * Folded into EXISTING Cloud Functions (proxy blocks new function creation):
 * - Admin actions ride the `metaOAuthStatus` callable via `action` params
 *   (same fold-in pattern as the WhatsApp actions there). Auth + workspace
 *   membership are enforced by the host before this router runs.
 * - The public (unauthenticated) API rides the `metaWebhook` onRequest
 *   function at path /contest-api (hosting rewrite -> metaWebhook).
 *
 * Collections (top-level, every doc carries workspaceId):
 *   contests/{contestId}                 config + counters
 *   contest_participants/{participantId} entries (deterministic doc ids)
 *   contest_referrals/{referralId}       referral audit trail
 *   contest_draws/{drawId}               winner selections (approval-gated)
 *   contest_leaderboards/{contestId}     public top-100 snapshot (1 doc)
 *   contest_grants/{grantId}             pending/held reward grants
 *   contest_rate_limits/{key}            entry rate-limit counters
 *
 * Serverless-cheap rules: batch writes inside the transactions that already
 * happen, FieldValue.increment counters, one public leaderboard doc per
 * contest rewritten at most once per 60s and only when the order changed.
 */
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { createHash, randomBytes } from "crypto";
import { grantCredits } from "./credits.js";

const db = () => getFirestore("chatmize-prod");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ContestType = "giveaway" | "leaderboard" | "milestones";
export type ContestStatus = "draft" | "active" | "closed" | "archived";
export type DrawMode = "weighted" | "top_n" | "milestones";
export type ActionVerification = "verified" | "selfreported" | "unverifiable";
export type ParticipantStatus = "active" | "flagged" | "banned" | "winner" | "disqualified";
export type RewardKind = "ai_credits" | "business_prize" | "none";

export interface ContestActionDef {
  id: string;
  kind: string; // enter | referral | purchase | survey | follow | visit | share | other
  label: string;
  points: number;
  tickets: number;
  verification: ActionVerification;
  required?: boolean;
}

export interface ContestTier {
  threshold: number;
  rewardKind: RewardKind;
  rewardValue: number; // AI credits, or 0 for business_prize/none
  rewardLabel: string;
}

export interface ContestPrize {
  place: number; // 1 = first
  label: string;
  rewardKind: RewardKind;
  rewardValue: number;
  rewardNote?: string;
}

export interface FraudFlag {
  reason: string;
  at: string;
}

export interface ContestDoc {
  workspaceId: string;
  title: string;
  description: string;
  heroImageUrl: string;
  type: ContestType;
  status: ContestStatus;
  published: boolean;
  startsAt: string; // ISO
  endsAt: string; // ISO
  timezone: string;
  entryKeyword: string;
  actions: ContestActionDef[];
  referralPoints: number;
  referralTickets: number;
  tiers: ContestTier[];
  prizes: ContestPrize[];
  draw: { mode: DrawMode; winnerCount: number; alternatesCount: number; claimWindowDays: number };
  counters: { entries: number; referrals: number; clicks: number; actionsCompleted: number };
  fraudConfig: {
    maxEntriesPerHour: number;
    maxReferralsPerHour: number;
    maxReferralsPerReferrer: number;
    prizeHoldHours: number;
  };
  fraudFlags: FraudFlag[];
  consentText: { contest: string; marketing: string };
  rulesText: string;
  amoeText: string;
  announceAt: string;
  createdByUid: string;
  createdAt: string;
  updatedAt: string;
}

export interface ActionCompletion {
  actionId: string;
  at: string;
  verification: ActionVerification;
}

export interface RewardGrant {
  kind: RewardKind;
  value: number;
  label: string;
  status: "held" | "released" | "pending_fulfillment";
  releaseAt: string | null;
  grantedAt: string;
  note: string;
}

export interface ParticipantDoc {
  workspaceId: string;
  contestId: string;
  channel: "email" | "phone" | "messenger" | "instagram" | "sms";
  channelIdentityHash: string;
  email: string | null;
  phone: string | null;
  displayName: string;
  leaderboardAlias: string;
  showOnLeaderboard: boolean;
  referralCode: string;
  referredBy: string | null; // referrer referralCode, immutable
  points: number;
  tickets: number;
  actionsCompleted: ActionCompletion[];
  tiersUnlocked: number[];
  rewardGrants: RewardGrant[];
  status: ParticipantStatus;
  referralsDisabled: boolean;
  riskScore: number;
  fraudFlags: FraudFlag[];
  messageCount: number;
  lastActiveAt: string;
  consent: { contest: boolean; marketing: boolean; at: string };
  enteredAt: string;
}

export interface ReferralDoc {
  workspaceId: string;
  contestId: string;
  referrerId: string;
  referrerCode: string;
  refereeId: string;
  credited: boolean;
  creditDeniedReason: string | null;
  createdAt: string;
  creditedAt: string | null;
}

export interface DrawWinner {
  participantId: string;
  alias: string;
  place: number;
  pointsAtDraw: number;
  ticketsAtDraw: number;
}

export interface DrawDoc {
  workspaceId: string;
  contestId: string;
  mode: DrawMode;
  seed: string;
  winnerCount: number;
  winners: DrawWinner[];
  alternates: DrawWinner[];
  eligibleCount: number;
  status: "pending_approval" | "approved" | "announced";
  createdByUid: string;
  createdAt: string;
  approvedByUid: string | null;
  approvedAt: string | null;
  announcedAt: string | null;
}

export interface LeaderboardEntry {
  alias: string;
  points: number;
  referrals: number;
  rank: number;
}

export interface LeaderboardDoc {
  contestId: string;
  workspaceId: string;
  top: LeaderboardEntry[];
  totals: { entries: number; points: number };
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // unambiguous: no 0/O/1/I/L

function generateReferralCode(): string {
  const bytes = randomBytes(8);
  let code = "";
  for (const b of bytes) code += CODE_ALPHABET[b % CODE_ALPHABET.length];
  return code;
}

/** Deterministic participant doc id: one entry per identity per contest. */
function participantIdFor(contestId: string, channel: string, identity: string): string {
  return "p_" + sha256Hex(`contest:${contestId}|${channel}|${identity}`).slice(0, 32);
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/[^\d]/g, "");
  if (phone.trim().startsWith("+")) return "+" + digits;
  return digits;
}

/** Display alias: name + last initial, e.g. "Sarah K." */
function aliasFor(displayName: string): string {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Anonymous";
  if (parts.length === 1) return parts[0].slice(0, 24);
  return `${parts[0].slice(0, 20)} ${parts[1][0].toUpperCase()}.`;
}

function nowIso(): string {
  return new Date().toISOString();
}

/** Seeded PRNG (mulberry32) so draws are reproducible from the stored seed. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function verificationForKind(kind: string): ActionVerification {
  // Structural rule from the research: rewards attach to verifiable actions.
  // Shares are never rewarded directly (not verifiable on any platform).
  switch (kind) {
    case "enter":
    case "referral":
    case "purchase":
    case "survey":
      return "verified";
    case "follow":
    case "visit":
      return "selfreported";
    case "share":
      return "unverifiable";
    default:
      return "selfreported";
  }
}

const DEFAULT_ACTIONS: ContestActionDef[] = [
  { id: "enter", kind: "enter", label: "Enter the contest", points: 10, tickets: 1, verification: "verified", required: true },
];

function defaultContest(workspaceId: string, uid: string): ContestDoc {
  const now = nowIso();
  const ends = new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString();
  return {
    workspaceId,
    title: "Untitled Contest",
    description: "",
    heroImageUrl: "",
    type: "giveaway",
    status: "draft",
    published: false,
    startsAt: now,
    endsAt: ends,
    timezone: "America/Phoenix",
    entryKeyword: "",
    actions: DEFAULT_ACTIONS,
    referralPoints: 25,
    referralTickets: 5,
    tiers: [],
    prizes: [],
    draw: { mode: "weighted", winnerCount: 1, alternatesCount: 2, claimWindowDays: 7 },
    counters: { entries: 0, referrals: 0, clicks: 0, actionsCompleted: 0 },
    fraudConfig: {
      maxEntriesPerHour: 200,
      maxReferralsPerHour: 100,
      maxReferralsPerReferrer: 500,
      prizeHoldHours: 0,
    },
    fraudFlags: [],
    consentText: {
      contest: "I agree to receive contest-related messages about this giveaway.",
      marketing: "Send me marketing messages and offers.",
    },
    rulesText: "",
    amoeText: "No purchase necessary to enter or win. See full rules for the free alternate method of entry.",
    announceAt: ends,
    createdByUid: uid,
    createdAt: now,
    updatedAt: now,
  };
}

function sanitizeContestPublic(c: ContestDoc & { id?: string }): Record<string, unknown> {
  // Public surface: never leak fraudConfig internals, flags, or counters internals.
  return {
    id: c.id ?? null,
    title: c.title,
    description: c.description,
    heroImageUrl: c.heroImageUrl,
    type: c.type,
    status: c.status,
    startsAt: c.startsAt,
    endsAt: c.endsAt,
    timezone: c.timezone,
    actions: c.actions.map((a) => ({
      id: a.id,
      kind: a.kind,
      label: a.label,
      points: a.points,
      tickets: a.tickets,
      verification: a.verification,
    })),
    referralPoints: c.referralPoints,
    referralTickets: c.referralTickets,
    tiers: c.tiers,
    prizes: c.prizes,
    draw: { mode: c.draw.mode, winnerCount: c.draw.winnerCount, claimWindowDays: c.draw.claimWindowDays },
    counters: { entries: c.counters.entries, referrals: c.counters.referrals },
    rulesText: c.rulesText,
    amoeText: c.amoeText,
    announceAt: c.announceAt,
    consentText: c.consentText,
  };
}

function validateContestInput(input: Record<string, unknown>): string | null {
  const title = input.title;
  if (typeof title !== "string" || title.trim().length === 0) return "title is required";
  if (title.length > 120) return "title must be 120 characters or fewer";
  const type = input.type;
  if (type !== "giveaway" && type !== "leaderboard" && type !== "milestones")
    return "type must be giveaway, leaderboard, or milestones";
  const status = input.status;
  if (status !== undefined && !["draft", "active", "closed", "archived"].includes(status as string))
    return "invalid status";
  const startsAt = input.startsAt as string | undefined;
  const endsAt = input.endsAt as string | undefined;
  if (startsAt && endsAt && new Date(startsAt).getTime() >= new Date(endsAt).getTime())
    return "endsAt must be after startsAt";
  const actions = input.actions;
  if (actions !== undefined) {
    if (!Array.isArray(actions) || actions.length === 0) return "at least one action is required";
    if (actions.length > 20) return "too many actions (max 20)";
    for (const a of actions as Array<Record<string, unknown>>) {
      if (typeof a.label !== "string" || !a.label.trim()) return "every action needs a label";
      const pts = Number(a.points);
      const tix = Number(a.tickets);
      if (!Number.isFinite(pts) || pts < 0 || pts > 100000) return "action points out of range";
      if (!Number.isFinite(tix) || tix < 0 || tix > 100000) return "action tickets out of range";
    }
    const hasEnter = (actions as Array<{ kind?: string }>).some((a) => a.kind === "enter");
    if (!hasEnter) return "an entry action (kind=enter) is required";
  }
  // The share action is never rewarded: structural anti-gaming rule.
  const shareActions = Array.isArray(actions)
    ? (actions as Array<{ kind?: string; points?: number; tickets?: number }>).filter(
        (a) => a.kind === "share" && (Number(a.points) > 0 || Number(a.tickets) > 0),
      )
    : [];
  if (shareActions.length > 0) return "share actions cannot carry points or tickets (not verifiable)";
  return null;
}

async function getContestOrThrow(contestId: string): Promise<{ id: string; data: ContestDoc }> {
  const snap = await db().collection("contests").doc(contestId).get();
  if (!snap.exists) throw new HttpsError("not-found", "Contest not found.");
  return { id: snap.id, data: snap.data() as ContestDoc };
}

function assertWorkspaceMatch(contest: ContestDoc, workspaceId: string): void {
  if (contest.workspaceId !== workspaceId) {
    throw new HttpsError("permission-denied", "Contest does not belong to this workspace.");
  }
}

// ---------------------------------------------------------------------------
// Leaderboard snapshot (public, cheap)
// ---------------------------------------------------------------------------

const LEADERBOARD_THROTTLE_MS = 60_000;
const LEADERBOARD_TOP_N = 100;

async function refreshPublicLeaderboard(contestId: string): Promise<void> {
  const lbRef = db().collection("contest_leaderboards").doc(contestId);
  const cached = await lbRef.get();
  const cachedData = cached.data() as LeaderboardDoc | undefined;
  const updatedAtMs = cachedData ? new Date(cachedData.updatedAt).getTime() : 0;
  if (Date.now() - updatedAtMs < LEADERBOARD_THROTTLE_MS) return; // throttle during viral spikes

  const contest = await getContestOrThrow(contestId);
  const q = await db()
    .collection("contest_participants")
    .where("contestId", "==", contestId)
    .where("status", "==", "active")
    .where("showOnLeaderboard", "==", true)
    .orderBy("points", "desc")
    .limit(LEADERBOARD_TOP_N)
    .get();

  const top: LeaderboardEntry[] = [];
  let rank = 0;
  for (const d of q.docs) {
    const p = d.data() as ParticipantDoc;
    rank += 1;
    top.push({ alias: p.leaderboardAlias, points: p.points, referrals: 0, rank });
  }
  // Referral sub-stat per entrant: count credited referrals in the top set.
  if (top.length > 0) {
    const ids = q.docs.map((d) => d.id);
    // Chunked `in` queries (max 10 per chunk) to stay within Firestore limits.
    for (let i = 0; i < ids.length; i += 10) {
      const chunk = ids.slice(i, i + 10);
      const refQ = await db()
        .collection("contest_referrals")
        .where("contestId", "==", contestId)
        .where("referrerId", "in", chunk)
        .where("credited", "==", true)
        .get();
      const counts = new Map<string, number>();
      for (const r of refQ.docs) {
        const rid = (r.data() as ReferralDoc).referrerId;
        counts.set(rid, (counts.get(rid) ?? 0) + 1);
      }
      for (let j = 0; j < chunk.length; j++) {
        top[i + j].referrals = counts.get(chunk[j]) ?? 0;
      }
    }
  }

  const prevTop = cachedData?.top ?? [];
  const changed =
    prevTop.length !== top.length ||
    prevTop.some(
      (e, i) => e.alias !== top[i].alias || e.points !== top[i].points || e.rank !== top[i].rank,
    );
  if (!changed && cached.exists) return; // no write when order is stable

  const totalsQ = await db()
    .collection("contest_participants")
    .where("contestId", "==", contestId)
    .count()
    .get();
  const doc: LeaderboardDoc = {
    contestId,
    workspaceId: contest.data.workspaceId,
    top,
    totals: { entries: totalsQ.data().count, points: top.reduce((s, e) => s + e.points, 0) },
    updatedAt: nowIso(),
  };
  await lbRef.set(doc);
  logger.info("Contest leaderboard snapshot refreshed", { contestId, topN: top.length });
}

// ---------------------------------------------------------------------------
// Reward grants (AI credits with optional hold period)
// ---------------------------------------------------------------------------

async function createGrant(
  workspaceId: string,
  contestId: string,
  participantId: string,
  kind: RewardKind,
  value: number,
  label: string,
  holdHours: number,
): Promise<void> {
  if (kind !== "ai_credits" || value <= 0) {
    // Business prizes / no-reward tiers are recorded on the participant doc
    // for manual fulfillment; only AI credits move through the ledger.
    await db()
      .collection("contest_participants")
      .doc(participantId)
      .update({
        rewardGrants: FieldValue.arrayUnion({
          kind,
          value,
          label,
          status: kind === "business_prize" ? "pending_fulfillment" : "released",
          releaseAt: null,
          grantedAt: nowIso(),
          note: `Contest reward: ${label}`,
        } satisfies RewardGrant),
      });
    return;
  }
  const releaseAt =
    holdHours > 0 ? new Date(Date.now() + holdHours * 3600 * 1000).toISOString() : nowIso();
  const grantRef = db().collection("contest_grants").doc();
  await grantRef.set({
    workspaceId,
    contestId,
    participantId,
    kind,
    value,
    label,
    status: "held",
    releaseAt,
    createdAt: nowIso(),
    releasedAt: null,
  });
  if (holdHours <= 0) {
    await releaseDueGrants(workspaceId, contestId);
  }
}

/**
 * Release held AI-credit grants whose hold period expired. Called lazily
 * inside admin contest actions (no dedicated scheduler in v1, by design:
 * every release is also visible in the admin UI immediately after).
 */
export async function releaseDueGrants(workspaceId: string, contestId: string): Promise<number> {
  const q = await db()
    .collection("contest_grants")
    .where("workspaceId", "==", workspaceId)
    .where("contestId", "==", contestId)
    .where("status", "==", "held")
    .where("releaseAt", "<=", nowIso())
    .limit(100)
    .get();
  let released = 0;
  for (const d of q.docs) {
    const g = d.data() as {
      participantId: string;
      value: number;
      label: string;
    };
    try {
      await grantCredits(workspaceId, g.value, "contest_reward", `Contest reward: ${g.label} (${contestId})`);
      await d.ref.update({ status: "released", releasedAt: nowIso() });
      await db()
        .collection("contest_participants")
        .doc(g.participantId)
        .update({
          rewardGrants: FieldValue.arrayUnion({
            kind: "ai_credits",
            value: g.value,
            label: g.label,
            status: "released",
            releaseAt: null,
            grantedAt: nowIso(),
            note: `Contest reward: ${g.label}`,
          } satisfies RewardGrant),
        });
      released += 1;
    } catch (err) {
      logger.error("Contest grant release failed", { grantId: d.id, err });
    }
  }
  return released;
}

/** Milestone check after any points change; grants newly unlocked tiers. */
async function evaluateTiers(
  contest: ContestDoc & { id?: string },
  contestId: string,
  participantId: string,
  points: number,
  alreadyUnlocked: number[],
): Promise<number[]> {
  const newly: number[] = [];
  for (const tier of [...contest.tiers].sort((a, b) => a.threshold - b.threshold)) {
    if (points >= tier.threshold && !alreadyUnlocked.includes(tier.threshold)) {
      newly.push(tier.threshold);
      await createGrant(
        contest.workspaceId,
        contestId,
        participantId,
        tier.rewardKind,
        tier.rewardValue,
        tier.rewardLabel,
        contest.fraudConfig.prizeHoldHours,
      );
    }
  }
  if (newly.length > 0) {
    await db()
      .collection("contest_participants")
      .doc(participantId)
      .update({ tiersUnlocked: FieldValue.arrayUnion(...newly) });
    logger.info("Contest tiers unlocked", { contestId, participantId, tiers: newly });
  }
  return [...alreadyUnlocked, ...newly];
}

// ---------------------------------------------------------------------------
// Entry (shared core for public web entry and chat identity entry)
// ---------------------------------------------------------------------------

export interface EntryInput {
  contestId: string;
  channel: ParticipantDoc["channel"];
  identity: string; // normalized email / phone / psid / igsid
  displayName: string;
  email?: string;
  phone?: string;
  refCode?: string;
  consentMarketing?: boolean;
  showOnLeaderboard?: boolean;
  clientIpHash?: string | null;
}

export interface EntryResult {
  ok: boolean;
  duplicate: boolean;
  participantId: string;
  referralCode: string;
  referralLink: string;
  points: number;
  tickets: number;
  referredBy: string | null;
  referralCredited: boolean;
}

async function generateUniqueReferralCode(contestId: string): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateReferralCode();
    const existing = await db()
      .collection("contest_participants")
      .where("contestId", "==", contestId)
      .where("referralCode", "==", code)
      .limit(1)
      .get();
    if (existing.empty) return code;
  }
  // Extremely unlikely fallback: time-suffixed code.
  return generateReferralCode() + Date.now().toString(36).slice(-2).toUpperCase();
}

export async function enterContest(input: EntryInput): Promise<EntryResult> {
  const { id: contestId, data: contest } = await getContestOrThrow(input.contestId);
  if (contest.status !== "active" || !contest.published) {
    throw new HttpsError("failed-precondition", "This contest is not accepting entries right now.");
  }
  const nowMs = Date.now();
  if (nowMs < new Date(contest.startsAt).getTime() || nowMs > new Date(contest.endsAt).getTime()) {
    throw new HttpsError("failed-precondition", "This contest is not accepting entries right now.");
  }

  const pid = participantIdFor(contestId, input.channel, input.identity);
  const enterAction = contest.actions.find((a) => a.kind === "enter") ?? DEFAULT_ACTIONS[0];
  const referralLinkBase = `/enter/${contestId}`;

  const result = await db().runTransaction(async (tx) => {
    const partRef = db().collection("contest_participants").doc(pid);
    const existing = await tx.get(partRef);
    if (existing.exists) {
      const p = existing.data() as ParticipantDoc;
      return {
        duplicate: true as const,
        participantId: pid,
        referralCode: p.referralCode,
        points: p.points,
        tickets: p.tickets,
        referredBy: p.referredBy,
        referralCredited: false as const,
        referrerTierCheck: null as { id: string; points: number; unlocked: number[] } | null,
      };
    }

    // Rate limiting: per-IP per-hour attempt counter (best-effort; the
    // deterministic doc id above is the hard duplicate guarantee).
    if (input.clientIpHash) {
      const hour = new Date().toISOString().slice(0, 13).replace(/[^0-9]/g, "");
      const rlRef = db().collection("contest_rate_limits").doc(`${input.clientIpHash}_${hour}`);
      const rlSnap = await tx.get(rlRef);
      const attempts = ((rlSnap.data() as { count?: number } | undefined)?.count ?? 0) + 1;
      if (attempts > 50) {
        throw new HttpsError("resource-exhausted", "Too many entries from this network. Try again later.");
      }
      tx.set(rlRef, { count: attempts, at: nowIso() }, { merge: true });
    }

    // Velocity flag (stealth): contest-wide entry spike vs configured baseline.
    const hourKey = new Date().toISOString().slice(0, 13);
    const hvRef = db().collection("contest_rate_limits").doc(`contest_${contestId}_${hourKey}`);
    const hvSnap = await tx.get(hvRef);
    const hourEntries = ((hvSnap.data() as { count?: number } | undefined)?.count ?? 0) + 1;
    tx.set(hvRef, { count: hourEntries, at: nowIso() }, { merge: true });
    if (hourEntries > contest.fraudConfig.maxEntriesPerHour) {
      tx.update(db().collection("contests").doc(contestId), {
        fraudFlags: FieldValue.arrayUnion({
          reason: `entry velocity ${hourEntries}/hr exceeded baseline ${contest.fraudConfig.maxEntriesPerHour}`,
          at: nowIso(),
        }),
      });
    }

    const referralCode = await generateUniqueReferralCode(contestId);
    const participant: ParticipantDoc = {
      workspaceId: contest.workspaceId,
      contestId,
      channel: input.channel,
      channelIdentityHash: sha256Hex(input.identity),
      email: input.email ?? null,
      phone: input.phone ?? null,
      displayName: input.displayName.slice(0, 80),
      leaderboardAlias: aliasFor(input.displayName),
      showOnLeaderboard: input.showOnLeaderboard !== false,
      referralCode,
      referredBy: null,
      points: enterAction.points,
      tickets: enterAction.tickets,
      actionsCompleted: [{ actionId: enterAction.id, at: nowIso(), verification: enterAction.verification }],
      tiersUnlocked: [],
      rewardGrants: [],
      status: "active",
      referralsDisabled: false,
      riskScore: 0,
      fraudFlags: [],
      messageCount: 0,
      lastActiveAt: nowIso(),
      consent: { contest: true, marketing: input.consentMarketing === true, at: nowIso() },
      enteredAt: nowIso(),
    };

    // Referral attribution: credit lands only when the referee completes
    // entry (this transaction). Self-referral is impossible by construction
    // of the deterministic doc id + the explicit check below.
    let referralCredited = false;
    let referredBy: string | null = null;
    let referrerTierCheck: { id: string; points: number; unlocked: number[] } | null = null;
    const refCode = (input.refCode ?? "").trim().toUpperCase();
    if (refCode) {
      const referrerQ = db()
        .collection("contest_participants")
        .where("contestId", "==", contestId)
        .where("referralCode", "==", refCode)
        .limit(1);
      const referrerSnap = await tx.get(referrerQ);
      if (!referrerSnap.empty) {
        const referrerDoc = referrerSnap.docs[0];
        const referrer = referrerDoc.data() as ParticipantDoc;
        const isSelf = referrerDoc.id === pid;
        if (!isSelf && referrer.status === "active" && !referrer.referralsDisabled) {
          // Per-referrer cap: structural, near-zero cost.
          const priorQ = db()
            .collection("contest_referrals")
            .where("contestId", "==", contestId)
            .where("referrerId", "==", referrerDoc.id)
            .where("credited", "==", true)
            .count();
          const priorCount = (await tx.get(priorQ)).data().count;
          referredBy = refCode;
          participant.referredBy = refCode;
          const referralRef = db().collection("contest_referrals").doc(`r_${pid}`);
          if (priorCount >= contest.fraudConfig.maxReferralsPerReferrer) {
            tx.set(referralRef, {
              workspaceId: contest.workspaceId,
              contestId,
              referrerId: referrerDoc.id,
              referrerCode: refCode,
              refereeId: pid,
              credited: false,
              creditDeniedReason: "referrer cap reached",
              createdAt: nowIso(),
              creditedAt: null,
            } satisfies ReferralDoc);
          } else {
            tx.set(referralRef, {
              workspaceId: contest.workspaceId,
              contestId,
              referrerId: referrerDoc.id,
              referrerCode: refCode,
              refereeId: pid,
              credited: true,
              creditDeniedReason: null,
              createdAt: nowIso(),
              creditedAt: nowIso(),
            } satisfies ReferralDoc);
            const newPoints = referrer.points + contest.referralPoints;
            tx.update(referrerDoc.ref, {
              points: newPoints,
              tickets: referrer.tickets + contest.referralTickets,
              lastActiveAt: nowIso(),
            });
            tx.update(db().collection("contests").doc(contestId), {
              "counters.referrals": FieldValue.increment(1),
            });
            referralCredited = true;
            // Tier evaluation happens post-transaction (it performs its own
            // writes and must not run inside this transaction).
            referrerTierCheck = { id: referrerDoc.id, points: newPoints, unlocked: referrer.tiersUnlocked ?? [] };
          }
        }
      }
    }

    tx.set(partRef, participant);
    tx.update(db().collection("contests").doc(contestId), {
      "counters.entries": FieldValue.increment(1),
      "counters.actionsCompleted": FieldValue.increment(1),
    });
    return {
      duplicate: false as const,
      participantId: pid,
      referralCode,
      points: participant.points,
      tickets: participant.tickets,
      referredBy,
      referralCredited,
      referrerTierCheck,
    };
  });

  // Post-transaction: leaderboard snapshot + tier checks. Kept out of the
  // transaction to bound its size; all are idempotent.
  await refreshPublicLeaderboard(contestId).catch((e) =>
    logger.warn("Leaderboard refresh failed after entry", { contestId, e }),
  );
  const tierChecks: Array<{ id: string; points: number; unlocked: number[] }> = [];
  if (!result.duplicate) tierChecks.push({ id: result.participantId, points: result.points, unlocked: [] });
  if (result.referrerTierCheck) tierChecks.push(result.referrerTierCheck);
  for (const tc of tierChecks) {
    await evaluateTiers(contest, contestId, tc.id, tc.points, tc.unlocked).catch((e) =>
      logger.warn("Tier evaluation failed after entry", { contestId, e }),
    );
  }

  return {
    ok: true,
    duplicate: result.duplicate,
    participantId: result.participantId,
    referralCode: result.referralCode,
    referralLink: `${referralLinkBase}?ref=${result.referralCode}`,
    points: result.points,
    tickets: result.tickets,
    referredBy: result.referredBy,
    referralCredited: result.referralCredited,
  };
}

// ---------------------------------------------------------------------------
// Admin: upsert / draw / approve / status / recordAction / chatEnter
// ---------------------------------------------------------------------------

function coerceContestPatch(input: Record<string, unknown>, base: ContestDoc): Partial<ContestDoc> {
  const patch: Partial<ContestDoc> = {};
  const str = (v: unknown) => (typeof v === "string" ? v : undefined);
  const num = (v: unknown, d: number) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : d;
  };
  if (str(input.title) !== undefined) patch.title = str(input.title)!.slice(0, 120);
  if (str(input.description) !== undefined) patch.description = str(input.description)!.slice(0, 2000);
  if (str(input.heroImageUrl) !== undefined) patch.heroImageUrl = str(input.heroImageUrl)!.slice(0, 500);
  if (input.type === "giveaway" || input.type === "leaderboard" || input.type === "milestones")
    patch.type = input.type;
  if (
    input.status === "draft" ||
    input.status === "active" ||
    input.status === "closed" ||
    input.status === "archived"
  )
    patch.status = input.status;
  if (typeof input.published === "boolean") patch.published = input.published;
  if (str(input.startsAt)) patch.startsAt = str(input.startsAt)!;
  if (str(input.endsAt)) patch.endsAt = str(input.endsAt)!;
  if (str(input.timezone)) patch.timezone = str(input.timezone)!;
  if (str(input.entryKeyword) !== undefined) patch.entryKeyword = str(input.entryKeyword)!.slice(0, 40);
  if (Array.isArray(input.actions)) {
    patch.actions = (input.actions as Array<Record<string, unknown>>).map((a, i) => ({
      id: str(a.id) || `action_${i}`,
      kind: str(a.kind) || "other",
      label: (str(a.label) || "Action").slice(0, 120),
      points: Math.max(0, Math.min(100000, Math.round(num(a.points, 0)))),
      tickets: Math.max(0, Math.min(100000, Math.round(num(a.tickets, 0)))),
      verification: verificationForKind(str(a.kind) || "other"),
      required: a.required === true,
    }));
  }
  if (input.referralPoints !== undefined) patch.referralPoints = Math.max(0, Math.round(num(input.referralPoints, 0)));
  if (input.referralTickets !== undefined) patch.referralTickets = Math.max(0, Math.round(num(input.referralTickets, 0)));
  if (Array.isArray(input.tiers)) {
    patch.tiers = (input.tiers as Array<Record<string, unknown>>)
      .map((t) => ({
        threshold: Math.max(1, Math.round(num(t.threshold, 1))),
        rewardKind: (["ai_credits", "business_prize", "none"] as RewardKind[]).includes(t.rewardKind as RewardKind)
          ? (t.rewardKind as RewardKind)
          : "none",
        rewardValue: Math.max(0, Math.round(num(t.rewardValue, 0))),
        rewardLabel: (str(t.rewardLabel) || "Reward").slice(0, 120),
      }))
      .sort((a, b) => a.threshold - b.threshold);
  }
  if (Array.isArray(input.prizes)) {
    patch.prizes = (input.prizes as Array<Record<string, unknown>>).map((p, i) => ({
      place: Math.max(1, Math.round(num(p.place, i + 1))),
      label: (str(p.label) || `Prize ${i + 1}`).slice(0, 120),
      rewardKind: (["ai_credits", "business_prize", "none"] as RewardKind[]).includes(p.rewardKind as RewardKind)
        ? (p.rewardKind as RewardKind)
        : "business_prize",
      rewardValue: Math.max(0, Math.round(num(p.rewardValue, 0))),
      rewardNote: str(p.rewardNote)?.slice(0, 300),
    }));
  }
  const drawIn = input.draw as Record<string, unknown> | undefined;
  if (drawIn && typeof drawIn === "object") {
    patch.draw = {
      mode: drawIn.mode === "top_n" || drawIn.mode === "milestones" ? drawIn.mode : "weighted",
      winnerCount: Math.max(1, Math.min(100, Math.round(num(drawIn.winnerCount, base.draw.winnerCount)))),
      alternatesCount: Math.max(0, Math.min(20, Math.round(num(drawIn.alternatesCount, base.draw.alternatesCount)))),
      claimWindowDays: Math.max(1, Math.min(90, Math.round(num(drawIn.claimWindowDays, base.draw.claimWindowDays)))),
    };
  }
  const fraudIn = input.fraudConfig as Record<string, unknown> | undefined;
  if (fraudIn && typeof fraudIn === "object") {
    patch.fraudConfig = {
      maxEntriesPerHour: Math.max(1, Math.round(num(fraudIn.maxEntriesPerHour, base.fraudConfig.maxEntriesPerHour))),
      maxReferralsPerHour: Math.max(1, Math.round(num(fraudIn.maxReferralsPerHour, base.fraudConfig.maxReferralsPerReferrer))),
      maxReferralsPerReferrer: Math.max(1, Math.round(num(fraudIn.maxReferralsPerReferrer, base.fraudConfig.maxReferralsPerReferrer))),
      prizeHoldHours: Math.max(0, Math.min(720, Math.round(num(fraudIn.prizeHoldHours, base.fraudConfig.prizeHoldHours)))),
    };
  }
  const consentIn = input.consentText as Record<string, unknown> | undefined;
  if (consentIn && typeof consentIn === "object") {
    patch.consentText = {
      contest: (str(consentIn.contest) ?? base.consentText.contest).slice(0, 500),
      marketing: (str(consentIn.marketing) ?? base.consentText.marketing).slice(0, 500),
    };
  }
  if (str(input.rulesText) !== undefined) patch.rulesText = str(input.rulesText)!.slice(0, 10000);
  if (str(input.amoeText) !== undefined) patch.amoeText = str(input.amoeText)!.slice(0, 5000);
  if (str(input.announceAt)) patch.announceAt = str(input.announceAt)!;
  return patch;
}

export async function adminUpsertContest(
  workspaceId: string,
  uid: string,
  input: Record<string, unknown>,
): Promise<{ contestId: string }> {
  const contestId = typeof input.contestId === "string" && input.contestId ? input.contestId : db().collection("contests").doc().id;
  const ref = db().collection("contests").doc(contestId);
  const existing = await ref.get();
  const base: ContestDoc = existing.exists
    ? (existing.data() as ContestDoc)
    : defaultContest(workspaceId, uid);
  if (existing.exists) assertWorkspaceMatch(base, workspaceId);

  const patch = coerceContestPatch(input, base);
  const merged = { ...base, ...patch, workspaceId, updatedAt: nowIso() };
  const err = validateContestInput(merged as unknown as Record<string, unknown>);
  if (err) throw new HttpsError("invalid-argument", err);

  // Publishing guard: trust checklist must be satisfied before going live.
  if (merged.status === "active" && merged.published) {
    if (!merged.rulesText.trim()) throw new HttpsError("failed-precondition", "Rules text is required before publishing.");
    if (!merged.title.trim() || merged.title === "Untitled Contest")
      throw new HttpsError("failed-precondition", "Give the contest a real title before publishing.");
  }

  await ref.set(merged, { merge: true });
  // Lazy release of any due held grants while an admin is working.
  await releaseDueGrants(workspaceId, contestId).catch(() => {});
  logger.info("Contest upserted", { workspaceId, contestId, status: merged.status });
  return { contestId };
}

async function eligibleParticipants(contestId: string): Promise<Array<{ id: string; data: ParticipantDoc }>> {
  const q = await db()
    .collection("contest_participants")
    .where("contestId", "==", contestId)
    .where("status", "==", "active")
    .get();
  return q.docs.map((d) => ({ id: d.id, data: d.data() as ParticipantDoc }));
}

/**
 * Run winner selection. Closes the contest and writes a draw doc in
 * `pending_approval` — nothing is granted or announced until the business
 * approves (the KingSumo lesson).
 */
export async function adminDrawWinners(
  workspaceId: string,
  uid: string,
  contestId: string,
): Promise<{ drawId: string; winners: DrawWinner[] }> {
  const { data: contest } = await getContestOrThrow(contestId);
  assertWorkspaceMatch(contest, workspaceId);
  if (contest.status === "archived") throw new HttpsError("failed-precondition", "Contest is archived.");

  const eligible = await eligibleParticipants(contestId);
  if (eligible.length === 0) throw new HttpsError("failed-precondition", "No eligible participants to draw from.");

  const seed = randomBytes(16).toString("hex");
  const rng = mulberry32(parseInt(seed.slice(0, 8), 16));
  const winnerCount = Math.min(contest.draw.winnerCount, eligible.length);
  const alternatesCount = Math.min(contest.draw.alternatesCount, Math.max(0, eligible.length - winnerCount));

  let ordered: Array<{ id: string; data: ParticipantDoc }>;
  if (contest.draw.mode === "top_n") {
    ordered = [...eligible].sort(
      (a, b) => b.data.points - a.data.points || a.data.enteredAt.localeCompare(b.data.enteredAt),
    );
  } else if (contest.draw.mode === "weighted") {
    // Weighted random draw by tickets, without replacement (seeded).
    const pool = eligible.map((e) => ({ ...e, weight: Math.max(1, e.data.tickets) }));
    ordered = [];
    for (let n = 0; n < winnerCount + alternatesCount && pool.length > 0; n++) {
      const total = pool.reduce((s, e) => s + e.weight, 0);
      let roll = rng() * total;
      let idx = 0;
      for (; idx < pool.length; idx++) {
        roll -= pool[idx].weight;
        if (roll <= 0) break;
      }
      idx = Math.min(idx, pool.length - 1);
      ordered.push(pool[idx]);
      pool.splice(idx, 1);
    }
  } else {
    // milestones: no draw; tiers already auto-unlocked at threshold crossing.
    throw new HttpsError("failed-precondition", "Milestone contests unlock automatically; no draw needed.");
  }

  const toWinner = (e: { id: string; data: ParticipantDoc }, place: number): DrawWinner => ({
    participantId: e.id,
    alias: e.data.leaderboardAlias,
    place,
    pointsAtDraw: e.data.points,
    ticketsAtDraw: e.data.tickets,
  });
  const winners = ordered.slice(0, winnerCount).map((e, i) => toWinner(e, i + 1));
  const alternates = ordered.slice(winnerCount, winnerCount + alternatesCount).map((e, i) => toWinner(e, winnerCount + i + 1));

  const drawRef = db().collection("contest_draws").doc();
  const draw: DrawDoc = {
    workspaceId,
    contestId,
    mode: contest.draw.mode,
    seed,
    winnerCount,
    winners,
    alternates,
    eligibleCount: eligible.length,
    status: "pending_approval",
    createdByUid: uid,
    createdAt: nowIso(),
    approvedByUid: null,
    approvedAt: null,
    announcedAt: null,
  };
  const batch = db().batch();
  batch.set(drawRef, draw);
  batch.update(db().collection("contests").doc(contestId), { status: "closed", updatedAt: nowIso() });
  await batch.commit();
  logger.info("Contest draw completed", { workspaceId, contestId, drawId: drawRef.id, winners: winners.length });
  return { drawId: drawRef.id, winners };
}

/**
 * Approve a pending draw: marks winners, releases prizes. AI-credit prizes
 * honor the contest hold period; business prizes are recorded for manual
 * fulfillment. Approval is the human gate — nothing granted before this.
 */
export async function adminApproveDraw(
  workspaceId: string,
  uid: string,
  contestId: string,
  drawId: string,
): Promise<{ approved: number }> {
  const { data: contest } = await getContestOrThrow(contestId);
  assertWorkspaceMatch(contest, workspaceId);
  const drawRef = db().collection("contest_draws").doc(drawId);
  const drawSnap = await drawRef.get();
  if (!drawSnap.exists) throw new HttpsError("not-found", "Draw not found.");
  const draw = drawSnap.data() as DrawDoc;
  if (draw.contestId !== contestId || draw.workspaceId !== workspaceId)
    throw new HttpsError("permission-denied", "Draw does not belong to this contest.");
  if (draw.status !== "pending_approval") throw new HttpsError("failed-precondition", "Draw is not pending approval.");

  const prizeByPlace = new Map(contest.prizes.map((p) => [p.place, p]));
  let approved = 0;
  for (const w of draw.winners) {
    const partRef = db().collection("contest_participants").doc(w.participantId);
    const partSnap = await partRef.get();
    if (!partSnap.exists) continue;
    const part = partSnap.data() as ParticipantDoc;
    // Winner revalidation at payout: skip anyone flagged/banned since the draw.
    if (part.status !== "active") {
      logger.warn("Draw approval skipped non-active winner", { contestId, participantId: w.participantId, status: part.status });
      continue;
    }
    const prize = prizeByPlace.get(w.place);
    await partRef.update({ status: "winner", lastActiveAt: nowIso() });
    if (prize) {
      await createGrant(
        workspaceId,
        contestId,
        w.participantId,
        prize.rewardKind,
        prize.rewardValue,
        `${prize.label} (place ${w.place})`,
        contest.fraudConfig.prizeHoldHours,
      );
    }
    approved += 1;
  }
  await drawRef.update({ status: "approved", approvedByUid: uid, approvedAt: nowIso() });
  await refreshPublicLeaderboard(contestId).catch(() => {});
  logger.info("Contest draw approved", { workspaceId, contestId, drawId, approved });
  return { approved };
}

/**
 * Fraud review: flag / ban / disqualify / reinstate a participant.
 * Banning invalidates the participant's referral tree (past and future):
 * past credited referrals are revoked and the referrer loses the points,
 * future referrals through their code are not credited (referees still enter).
 */
export async function adminSetParticipantStatus(
  workspaceId: string,
  contestId: string,
  participantId: string,
  status: ParticipantStatus,
  reason?: string,
): Promise<{ ok: boolean; invalidatedReferrals: number }> {
  const { data: contest } = await getContestOrThrow(contestId);
  assertWorkspaceMatch(contest, workspaceId);
  if (!["active", "flagged", "banned", "disqualified"].includes(status))
    throw new HttpsError("invalid-argument", "Invalid status.");

  const partRef = db().collection("contest_participants").doc(participantId);
  const partSnap = await partRef.get();
  if (!partSnap.exists) throw new HttpsError("not-found", "Participant not found.");
  const part = partSnap.data() as ParticipantDoc;
  if (part.contestId !== contestId) throw new HttpsError("permission-denied", "Participant is not in this contest.");

  let invalidatedReferrals = 0;
  await db().runTransaction(async (tx) => {
    if (status === "banned" || status === "disqualified") {
      // Referral-tree invalidation: revoke past credited referrals.
      const refsQ = db()
        .collection("contest_referrals")
        .where("contestId", "==", contestId)
        .where("referrerId", "==", participantId)
        .where("credited", "==", true)
        .limit(500);
      const refsSnap = await tx.get(refsQ);
      for (const r of refsSnap.docs) {
        tx.update(r.ref, { credited: false, creditDeniedReason: `referrer ${status}` });
        invalidatedReferrals += 1;
      }
      if (invalidatedReferrals > 0) {
        tx.update(partRef, {
          points: Math.max(0, part.points - invalidatedReferrals * contest.referralPoints),
          tickets: Math.max(0, part.tickets - invalidatedReferrals * contest.referralTickets),
        });
      }
      tx.update(partRef, { referralsDisabled: true });
    }
    if (status === "active") {
      tx.update(partRef, { referralsDisabled: false });
    }
    tx.update(partRef, {
      status,
      lastActiveAt: nowIso(),
      ...(reason
        ? { fraudFlags: FieldValue.arrayUnion({ reason, at: nowIso() }) }
        : {}),
    });
  });
  await refreshPublicLeaderboard(contestId).catch(() => {});
  logger.info("Contest participant status changed", { workspaceId, contestId, participantId, status, invalidatedReferrals });
  return { ok: true, invalidatedReferrals };
}

/**
 * Record a verified bonus-action completion for a participant (purchase,
 * booking, survey, ...). Called by staff or by server-side integrations;
 * points/tickets come from the contest's action config, never the client.
 */
export async function adminRecordAction(
  workspaceId: string,
  contestId: string,
  participantId: string,
  actionId: string,
): Promise<{ points: number; tickets: number }> {
  const { data: contest } = await getContestOrThrow(contestId);
  assertWorkspaceMatch(contest, workspaceId);
  const action = contest.actions.find((a) => a.id === actionId);
  if (!action) throw new HttpsError("not-found", "Action not found on this contest.");
  if (action.kind === "enter" || action.kind === "referral")
    throw new HttpsError("invalid-argument", "Entry and referral actions are recorded by the entry flow only.");

  const partRef = db().collection("contest_participants").doc(participantId);
  const partSnap = await partRef.get();
  if (!partSnap.exists) throw new HttpsError("not-found", "Participant not found.");
  const part = partSnap.data() as ParticipantDoc;
  if (part.contestId !== contestId) throw new HttpsError("permission-denied", "Participant is not in this contest.");
  if (part.status !== "active") throw new HttpsError("failed-precondition", "Participant is not active.");
  if (part.actionsCompleted.some((c) => c.actionId === actionId))
    throw new HttpsError("already-exists", "Action already completed for this participant.");

  const newPoints = part.points + action.points;
  const newTickets = part.tickets + action.tickets;
  await partRef.update({
    points: newPoints,
    tickets: newTickets,
    actionsCompleted: FieldValue.arrayUnion({
      actionId,
      at: nowIso(),
      verification: action.verification,
    } satisfies ActionCompletion),
    lastActiveAt: nowIso(),
  });
  await db()
    .collection("contests")
    .doc(contestId)
    .update({ "counters.actionsCompleted": FieldValue.increment(1), updatedAt: nowIso() });
  await evaluateTiers(contest, contestId, participantId, newPoints, part.tiersUnlocked ?? []);
  await refreshPublicLeaderboard(contestId).catch(() => {});
  return { points: newPoints, tickets: newTickets };
}

/**
 * Chat-identity entry (Messenger PSID / Instagram scoped ID). The inbound
 * webhook / flow engine calls this once the entry conversation completes;
 * attribution uses the same server-side ref-code mechanics as web entry.
 */
export async function adminChatEnter(
  workspaceId: string,
  contestId: string,
  channel: "messenger" | "instagram",
  channelIdentity: string,
  displayName: string,
  refCode?: string,
): Promise<EntryResult> {
  const { data: contest } = await getContestOrThrow(contestId);
  assertWorkspaceMatch(contest, workspaceId);
  if (!channelIdentity) throw new HttpsError("invalid-argument", "channelIdentity is required.");
  return enterContest({
    contestId,
    channel,
    identity: channelIdentity,
    displayName: displayName || "Chat entrant",
    refCode,
    showOnLeaderboard: true,
  });
}

// ---------------------------------------------------------------------------
// Admin action router (called from the metaOAuthStatus callable host)
// ---------------------------------------------------------------------------

export async function handleContestAdminAction(
  action: string,
  data: Record<string, unknown>,
  uid: string,
): Promise<unknown> {
  const workspaceId = data.workspaceId as string | undefined;
  if (!workspaceId) throw new HttpsError("invalid-argument", "workspaceId is required.");
  // Lazy release of due held grants on every admin touch.
  const contestId = data.contestId as string | undefined;

  switch (action) {
    case "contestUpsert": {
      if (contestId) await releaseDueGrants(workspaceId, contestId).catch(() => {});
      return adminUpsertContest(workspaceId, uid, { ...(data.input as Record<string, unknown>), contestId });
    }
    case "contestDraw": {
      if (!contestId) throw new HttpsError("invalid-argument", "contestId is required.");
      await releaseDueGrants(workspaceId, contestId).catch(() => {});
      return adminDrawWinners(workspaceId, uid, contestId);
    }
    case "contestApproveDraw": {
      if (!contestId) throw new HttpsError("invalid-argument", "contestId is required.");
      const drawId = data.drawId as string | undefined;
      if (!drawId) throw new HttpsError("invalid-argument", "drawId is required.");
      await releaseDueGrants(workspaceId, contestId).catch(() => {});
      return adminApproveDraw(workspaceId, uid, contestId, drawId);
    }
    case "contestSetParticipantStatus": {
      if (!contestId) throw new HttpsError("invalid-argument", "contestId is required.");
      const participantId = data.participantId as string | undefined;
      const status = data.status as ParticipantStatus | undefined;
      if (!participantId || !status) throw new HttpsError("invalid-argument", "participantId and status are required.");
      await releaseDueGrants(workspaceId, contestId).catch(() => {});
      return adminSetParticipantStatus(workspaceId, contestId, participantId, status, data.reason as string | undefined);
    }
    case "contestRecordAction": {
      if (!contestId) throw new HttpsError("invalid-argument", "contestId is required.");
      const participantId = data.participantId as string | undefined;
      const actionId = data.actionId as string | undefined;
      if (!participantId || !actionId) throw new HttpsError("invalid-argument", "participantId and actionId are required.");
      await releaseDueGrants(workspaceId, contestId).catch(() => {});
      return adminRecordAction(workspaceId, contestId, participantId, actionId);
    }
    case "contestChatEnter": {
      if (!contestId) throw new HttpsError("invalid-argument", "contestId is required.");
      const channel = data.channel as "messenger" | "instagram" | undefined;
      const channelIdentity = data.channelIdentity as string | undefined;
      if (channel !== "messenger" && channel !== "instagram")
        throw new HttpsError("invalid-argument", "channel must be messenger or instagram.");
      return adminChatEnter(workspaceId, contestId, channel, channelIdentity ?? "", (data.displayName as string) ?? "", data.refCode as string | undefined);
    }
    default:
      throw new HttpsError("invalid-argument", `Unknown contest action: ${action}`);
  }
}

// ---------------------------------------------------------------------------
// Public API (unauthenticated; rides metaWebhook at /contest-api)
// ---------------------------------------------------------------------------

function clientIpHash(req: { ip?: string; headers: Record<string, string | string[] | undefined> }): string | null {
  const fwd = req.headers["x-forwarded-for"];
  const raw = (Array.isArray(fwd) ? fwd[0] : fwd)?.split(",")[0]?.trim() || req.ip || "";
  if (!raw) return null;
  return sha256Hex(`contest-ip:${raw}`).slice(0, 24);
}

export async function handleContestPublicRequest(
  req: { body?: unknown; ip?: string; headers: Record<string, string | string[] | undefined> },
  res: {
    status: (code: number) => { json: (body: unknown) => void };
  },
): Promise<void> {
  const send = (code: number, body: unknown) => res.status(code).json(body);
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const action = body.action as string | undefined;
    const contestId = body.contestId as string | undefined;

    if (action === "get") {
      if (!contestId) return send(400, { error: "contestId is required" });
      const { id, data: contest } = await getContestOrThrow(contestId);
      if (contest.status !== "active" || !contest.published) {
        return send(200, { contest: null, reason: contest.status });
      }
      return send(200, { contest: sanitizeContestPublic({ ...contest, id }) });
    }

    if (action === "click") {
      if (!contestId) return send(400, { error: "contestId is required" });
      // Informational only: referral-link click, never rewarded.
      await db()
        .collection("contests")
        .doc(contestId)
        .update({ "counters.clicks": FieldValue.increment(1) })
        .catch(() => {});
      return send(200, { ok: true });
    }

    if (action === "enter") {
      if (!contestId) return send(400, { error: "contestId is required" });
      const displayName = String(body.displayName ?? "").trim().slice(0, 80);
      const emailRaw = String(body.email ?? "").trim();
      const phoneRaw = String(body.phone ?? "").trim();
      if (!displayName) return send(400, { error: "name is required" });
      if (!emailRaw && !phoneRaw) return send(400, { error: "email or phone is required" });

      let channel: EntryInput["channel"];
      let identity: string;
      let email: string | undefined;
      let phone: string | undefined;
      if (emailRaw) {
        const em = normalizeEmail(emailRaw);
        if (!isValidEmail(em)) return send(400, { error: "invalid email" });
        channel = "email";
        identity = em;
        email = em;
      } else {
        const ph = normalizePhone(phoneRaw);
        if (ph.replace(/\D/g, "").length < 7) return send(400, { error: "invalid phone" });
        channel = "phone";
        identity = ph;
        phone = ph;
      }
      if (!body.consentContest) return send(400, { error: "contest consent is required" });

      const result = await enterContest({
        contestId,
        channel,
        identity,
        displayName,
        email,
        phone,
        refCode: typeof body.ref === "string" ? body.ref : undefined,
        consentMarketing: body.consentMarketing === true,
        showOnLeaderboard: body.anonymous !== true,
        clientIpHash: clientIpHash(req),
      });
      return send(200, result);
    }

    if (action === "leaderboard") {
      if (!contestId) return send(400, { error: "contestId is required" });
      const snap = await db().collection("contest_leaderboards").doc(contestId).get();
      if (!snap.exists) {
        // Cold start: compute once so the first viewer seeds the snapshot.
        await refreshPublicLeaderboard(contestId).catch(() => {});
        const retry = await db().collection("contest_leaderboards").doc(contestId).get();
        return send(200, { leaderboard: retry.exists ? retry.data() : null });
      }
      return send(200, { leaderboard: snap.data() });
    }

    return send(400, { error: `unknown action: ${action}` });
  } catch (err) {
    if (err instanceof HttpsError) {
      const code = err.code === "resource-exhausted" ? 429 : err.code === "failed-precondition" ? 409 : 400;
      return send(code, { error: err.message });
    }
    logger.error("Contest public API failed", { err });
    return send(500, { error: "Something went wrong. Please try again." });
  }
}
