import { getApp } from 'firebase/app';
import { getFunctions, httpsCallable } from 'firebase/functions';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { prodDb } from './firebase';

const functions = getFunctions(getApp(), 'us-west2');

// ---------------------------------------------------------------------------
// Types (mirror functions/src/contest.ts)
// ---------------------------------------------------------------------------

export type ContestType = 'giveaway' | 'leaderboard' | 'milestones';
export type ContestStatus = 'draft' | 'active' | 'closed' | 'archived';
export type DrawMode = 'weighted' | 'top_n' | 'milestones';
export type ParticipantStatus = 'active' | 'flagged' | 'banned' | 'winner' | 'disqualified';
export type RewardKind = 'ai_credits' | 'business_prize' | 'none';

export interface ContestActionDef {
  id: string;
  kind: string;
  label: string;
  points: number;
  tickets: number;
  verification: 'verified' | 'selfreported' | 'unverifiable';
  required?: boolean;
}

export interface ContestTier {
  threshold: number;
  rewardKind: RewardKind;
  rewardValue: number;
  rewardLabel: string;
}

export interface ContestPrize {
  place: number;
  label: string;
  rewardKind: RewardKind;
  rewardValue: number;
  rewardNote?: string;
}

export interface Contest {
  id: string;
  workspaceId: string;
  title: string;
  description: string;
  heroImageUrl: string;
  type: ContestType;
  status: ContestStatus;
  published: boolean;
  startsAt: string;
  endsAt: string;
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
  fraudFlags: Array<{ reason: string; at: string }>;
  consentText: { contest: string; marketing: string };
  rulesText: string;
  amoeText: string;
  announceAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface Participant {
  id: string;
  displayName: string;
  leaderboardAlias: string;
  channel: string;
  email: string | null;
  phone: string | null;
  referralCode: string;
  referredBy: string | null;
  points: number;
  tickets: number;
  status: ParticipantStatus;
  riskScore: number;
  fraudFlags: Array<{ reason: string; at: string }>;
  tiersUnlocked: number[];
  actionsCompleted: Array<{ actionId: string; at: string; verification: string }>;
  rewardGrants: Array<{ kind: RewardKind; value: number; label: string; status: string; grantedAt: string; note: string }>;
  consent: { contest: boolean; marketing: boolean; at: string };
  enteredAt: string;
  lastActiveAt: string;
}

export interface DrawWinner {
  participantId: string;
  alias: string;
  place: number;
  pointsAtDraw: number;
  ticketsAtDraw: number;
}

export interface ContestDraw {
  id: string;
  mode: DrawMode;
  seed: string;
  winnerCount: number;
  winners: DrawWinner[];
  alternates: DrawWinner[];
  eligibleCount: number;
  status: 'pending_approval' | 'approved' | 'announced';
  createdAt: string;
  approvedAt: string | null;
}

export interface LeaderboardEntry {
  alias: string;
  points: number;
  referrals: number;
  rank: number;
}

export interface PublicContest {
  id: string;
  title: string;
  description: string;
  heroImageUrl: string;
  type: ContestType;
  status: ContestStatus;
  startsAt: string;
  endsAt: string;
  timezone: string;
  actions: ContestActionDef[];
  referralPoints: number;
  referralTickets: number;
  tiers: ContestTier[];
  prizes: ContestPrize[];
  draw: { mode: DrawMode; winnerCount: number; claimWindowDays: number };
  counters: { entries: number; referrals: number };
  rulesText: string;
  amoeText: string;
  announceAt: string;
  consentText: { contest: string; marketing: string };
}

// ---------------------------------------------------------------------------
// Admin: callable actions (folded into metaOAuthStatus; auth + workspace
// membership enforced by the host)
// ---------------------------------------------------------------------------

async function callContest(workspaceId: string, action: string, extra: Record<string, unknown> = {}) {
  const fn = httpsCallable<Record<string, unknown>, unknown>(functions, 'metaOAuthStatus');
  const res = await fn({ workspaceId, action, ...extra });
  return res.data as any;
}

export async function upsertContest(workspaceId: string, input: Record<string, unknown>): Promise<{ contestId: string }> {
  return callContest(workspaceId, 'contestUpsert', { contestId: input.contestId, input });
}

export async function drawWinners(workspaceId: string, contestId: string): Promise<{ drawId: string; winners: DrawWinner[] }> {
  return callContest(workspaceId, 'contestDraw', { contestId });
}

export async function approveDraw(workspaceId: string, contestId: string, drawId: string): Promise<{ approved: number }> {
  return callContest(workspaceId, 'contestApproveDraw', { contestId, drawId });
}

export async function setParticipantStatus(
  workspaceId: string,
  contestId: string,
  participantId: string,
  status: ParticipantStatus,
  reason?: string,
): Promise<{ ok: boolean; invalidatedReferrals: number }> {
  return callContest(workspaceId, 'contestSetParticipantStatus', { contestId, participantId, status, reason });
}

export async function recordActionCompletion(
  workspaceId: string,
  contestId: string,
  participantId: string,
  actionId: string,
): Promise<{ points: number; tickets: number }> {
  return callContest(workspaceId, 'contestRecordAction', { contestId, participantId, actionId });
}

// ---------------------------------------------------------------------------
// Admin: reads (direct Firestore; member rules apply)
// ---------------------------------------------------------------------------

export async function listContests(workspaceId: string): Promise<Contest[]> {
  const q = query(
    collection(prodDb, 'contests'),
    where('workspaceId', '==', workspaceId),
    orderBy('createdAt', 'desc'),
    limit(100),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Contest, 'id'>) }));
}

export async function getContest(contestId: string): Promise<Contest | null> {
  const snap = await getDoc(doc(prodDb, 'contests', contestId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<Contest, 'id'>) };
}

export function subscribeContest(contestId: string, cb: (c: Contest | null) => void) {
  return onSnapshot(doc(prodDb, 'contests', contestId), (snap) => {
    cb(snap.exists() ? ({ id: snap.id, ...(snap.data() as Omit<Contest, 'id'>) }) : null);
  });
}

export async function listParticipants(
  contestId: string,
  opts: { status?: ParticipantStatus | 'all'; search?: string; pageSize?: number } = {},
): Promise<Participant[]> {
  const pageSize = Math.min(opts.pageSize ?? 50, 100);
  let q: any = query(
    collection(prodDb, 'contest_participants'),
    where('contestId', '==', contestId),
    orderBy('enteredAt', 'desc'),
    limit(pageSize),
  );
  if (opts.status && opts.status !== 'all') {
    q = query(
      collection(prodDb, 'contest_participants'),
      where('contestId', '==', contestId),
      where('status', '==', opts.status),
      orderBy('enteredAt', 'desc'),
      limit(pageSize),
    );
  }
  const snap = await getDocs(q);
  let list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Participant, 'id'>) }));
  if (opts.search) {
    const s = opts.search.toLowerCase();
    list = list.filter(
      (p) =>
        p.displayName.toLowerCase().includes(s) ||
        p.leaderboardAlias.toLowerCase().includes(s) ||
        (p.email ?? '').toLowerCase().includes(s) ||
        p.referralCode.toLowerCase().includes(s),
    );
  }
  return list;
}

export async function listDraws(contestId: string): Promise<ContestDraw[]> {
  const q = query(
    collection(prodDb, 'contest_draws'),
    where('contestId', '==', contestId),
    orderBy('createdAt', 'desc'),
    limit(20),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ContestDraw, 'id'>) }));
}

export async function listRecentReferrals(contestId: string, pageSize = 50): Promise<Array<Record<string, any>>> {
  const q = query(
    collection(prodDb, 'contest_referrals'),
    where('contestId', '==', contestId),
    orderBy('createdAt', 'desc'),
    limit(pageSize),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export function subscribeLeaderboard(
  contestId: string,
  cb: (lb: { top: LeaderboardEntry[]; totals: { entries: number; points: number }; updatedAt: string } | null) => void,
) {
  return onSnapshot(doc(prodDb, 'contest_leaderboards', contestId), (snap) => {
    cb(snap.exists() ? (snap.data() as any) : null);
  });
}

// ---------------------------------------------------------------------------
// Public API (/contest-api -> metaWebhook onRequest; no auth)
// ---------------------------------------------------------------------------

async function publicApi<T>(action: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch('/contest-api', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...body }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any).error || `Request failed (${res.status})`);
  return data as T;
}

export async function getPublicContest(contestId: string): Promise<{ contest: PublicContest | null; reason?: string }> {
  return publicApi('get', { contestId });
}

export async function trackReferralClick(contestId: string): Promise<void> {
  try {
    await publicApi('click', { contestId });
  } catch {
    // informational only; never breaks the page
  }
}

export interface EnterPayload {
  displayName: string;
  email?: string;
  phone?: string;
  ref?: string;
  consentContest: boolean;
  consentMarketing: boolean;
  anonymous: boolean;
}

export interface EnterResult {
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

export async function enterContestPublic(contestId: string, payload: EnterPayload): Promise<EnterResult> {
  return publicApi('enter', { contestId, ...payload });
}

export async function getPublicLeaderboard(contestId: string): Promise<{ leaderboard: { top: LeaderboardEntry[]; totals: { entries: number; points: number }; updatedAt: string } | null }> {
  return publicApi('leaderboard', { contestId });
}

// ---------------------------------------------------------------------------
// Links
// ---------------------------------------------------------------------------

export function entryPageUrl(contestId: string, refCode?: string): string {
  const base = `${window.location.origin}/enter/${contestId}`;
  return refCode ? `${base}?ref=${refCode}` : base;
}

export function referralLinkFor(contestId: string, referralCode: string): string {
  return entryPageUrl(contestId, referralCode);
}

// ---------------------------------------------------------------------------
// Editor defaults (new contest scaffold)
// ---------------------------------------------------------------------------

export function newContestInput(): Record<string, unknown> {
  const startsAt = new Date();
  const endsAt = new Date(Date.now() + 14 * 24 * 3600 * 1000);
  return {
    title: '',
    description: '',
    heroImageUrl: '',
    type: 'giveaway',
    status: 'draft',
    published: false,
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
    timezone: 'America/Phoenix',
    entryKeyword: '',
    actions: [
      { id: 'enter', kind: 'enter', label: 'Enter the contest', points: 10, tickets: 1, required: true },
      { id: 'referral', kind: 'referral', label: 'Refer a friend who enters', points: 25, tickets: 5 },
    ],
    referralPoints: 25,
    referralTickets: 5,
    tiers: [],
    prizes: [{ place: 1, label: 'Grand prize', rewardKind: 'business_prize', rewardValue: 0, rewardNote: '' }],
    draw: { mode: 'weighted', winnerCount: 1, alternatesCount: 2, claimWindowDays: 7 },
    fraudConfig: {
      maxEntriesPerHour: 200,
      maxReferralsPerHour: 100,
      maxReferralsPerReferrer: 500,
      prizeHoldHours: 0,
    },
    consentText: {
      contest: 'I agree to receive contest-related messages about this giveaway.',
      marketing: 'Send me marketing messages and offers.',
    },
    rulesText: '',
    amoeText: 'No purchase necessary to enter or win. See full rules for the free alternate method of entry.',
    announceAt: endsAt.toISOString(),
  };
}

export const ACTION_KINDS = [
  { kind: 'enter', label: 'Contest entry', verification: 'verified', hint: 'Chat identity — strongest proof' },
  { kind: 'referral', label: 'Referral conversion', verification: 'verified', hint: 'Friend completes entry via your link' },
  { kind: 'purchase', label: 'Purchase / booking', verification: 'verified', hint: 'Server-side event via webhook' },
  { kind: 'survey', label: 'Survey / question', verification: 'verified', hint: 'Completed in chat' },
  { kind: 'follow', label: 'Follow on IG / FB', verification: 'selfreported', hint: 'API check where supported' },
  { kind: 'visit', label: 'Visit a link / video', verification: 'selfreported', hint: 'Click completion only' },
  { kind: 'share', label: 'Share the contest', verification: 'unverifiable', hint: 'Never rewarded — drives referrals instead' },
  { kind: 'other', label: 'Other', verification: 'selfreported', hint: 'Manual review' },
] as const;
