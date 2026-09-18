import { getApp } from "firebase/app";
import { getFunctions, httpsCallable } from "firebase/functions";

const functions = getFunctions(getApp(), "us-west2");

export interface BadgeDef {
  id: string;
  name: string;
  description: string;
  track: "messages" | "streaks" | "money" | "getting_started" | "og";
  graphic: string;
  credits: number;
}

export interface EarnedBadge {
  id: string;
  earnedAt: string;
}

export interface GamificationState {
  badges: BadgeDef[];
  earned: EarnedBadge[];
  counters: {
    messagesHandled: number;
    flowsPublished: number;
    broadcastsSent: number;
    revenueCents: number;
    streakDays: number;
  };
  referralCode: string;
  isSegMateMigrant: boolean;
}

async function callGamification<T>(workspaceId: string, action: string, extra?: Record<string, unknown>): Promise<T> {
  const fn = httpsCallable<{ workspaceId: string; action: string } & Record<string, unknown>, T>(
    functions,
    "metaOAuthStatus",
  );
  const res = await fn({ workspaceId, action, ...(extra ?? {}) });
  return res.data;
}

export function getGamificationState(workspaceId: string): Promise<GamificationState> {
  return callGamification<GamificationState>(workspaceId, "gamificationGet");
}

export function recordGamificationEvent(
  workspaceId: string,
  event: "flow_published" | "broadcast_sent",
): Promise<{ ok: boolean; newBadges: string[] }> {
  return callGamification(workspaceId, "gamificationEvent", { event });
}

export function logRevenue(
  workspaceId: string,
  amountDollars: number,
  note: string,
  source: "manual" | "flow_action" = "manual",
): Promise<{ ok: boolean; revenueCents: number; newBadges: string[] }> {
  return callGamification(workspaceId, "logRevenue", { amountDollars, note, source });
}

export function getReferralCode(workspaceId: string): Promise<{ code: string }> {
  return callGamification(workspaceId, "getReferralCode");
}

export function applyReferral(
  workspaceId: string,
  code: string,
): Promise<{ ok: boolean; referrerUid?: string }> {
  return callGamification(workspaceId, "applyReferral", { code });
}

/** Next unearned badge per track, for the progress view. */
export function nextBadgeForTrack(state: GamificationState, track: BadgeDef["track"]): BadgeDef | null {
  const earnedIds = new Set(state.earned.map((b) => b.id));
  return state.badges.find((b) => b.track === track && !earnedIds.has(b.id)) ?? null;
}

export function formatDollars(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: cents % 100 === 0 ? 0 : 2 });
}
