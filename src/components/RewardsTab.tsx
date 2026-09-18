import { useCallback, useEffect, useState } from "react";
import {
  Award,
  Check,
  Copy,
  DollarSign,
  Flame,
  Gift,
  Loader2,
  Lock,
  MessageCircle,
  Rocket,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import type { WorkspaceSilo } from "../types/workspace";
import {
  applyReferral,
  formatDollars,
  getGamificationState,
  getReferralCode,
  logRevenue,
  nextBadgeForTrack,
  type BadgeDef,
  type GamificationState,
} from "../lib/gamification";

const TRACK_META: Record<BadgeDef["track"], { label: string; icon: React.ReactNode; stat: (s: GamificationState) => string }> = {
  getting_started: {
    label: "Getting started",
    icon: <Rocket className="w-4 h-4" />,
    stat: (s) => `${s.counters.flowsPublished} flows · ${s.counters.broadcastsSent} broadcasts`,
  },
  messages: {
    label: "Messages",
    icon: <MessageCircle className="w-4 h-4" />,
    stat: (s) => `${s.counters.messagesHandled.toLocaleString()} handled`,
  },
  streaks: {
    label: "Streaks",
    icon: <Flame className="w-4 h-4" />,
    stat: (s) => `${s.counters.streakDays} day${s.counters.streakDays === 1 ? "" : "s"} active`,
  },
  money: {
    label: "Money",
    icon: <DollarSign className="w-4 h-4" />,
    stat: (s) => `${formatDollars(s.counters.revenueCents)} attributed`,
  },
  og: {
    label: "Legacy",
    icon: <Award className="w-4 h-4" />,
    stat: () => "one of one",
  },
};

export function RewardsTab({ workspace }: { workspace?: WorkspaceSilo }) {
  const [state, setState] = useState<GamificationState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [revAmount, setRevAmount] = useState("");
  const [revNote, setRevNote] = useState("");
  const [revSaving, setRevSaving] = useState(false);
  const [revMsg, setRevMsg] = useState("");
  const [refInput, setRefInput] = useState("");
  const [refMsg, setRefMsg] = useState("");
  const [refSaving, setRefSaving] = useState(false);

  const refresh = useCallback(async () => {
    if (!workspace?.id) return;
    setLoading(true);
    setError("");
    try {
      setState(await getGamificationState(workspace.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load rewards.");
    } finally {
      setLoading(false);
    }
  }, [workspace?.id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const copyCode = async () => {
    if (!state?.referralCode) return;
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}${window.location.pathname}?ref=${state.referralCode}`,
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };

  const submitRevenue = async () => {
    if (!workspace?.id) return;
    const amount = parseFloat(revAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setRevMsg("Enter a positive dollar amount.");
      return;
    }
    setRevSaving(true);
    setRevMsg("");
    try {
      const res = await logRevenue(workspace.id, amount, revNote.trim() || "Manual revenue entry");
      setRevAmount("");
      setRevNote("");
      setRevMsg(
        res.newBadges.length > 0
          ? `Logged! Badge earned: ${res.newBadges.join(", ")}.`
          : "Logged. Keep stacking.",
      );
      refresh();
    } catch (e) {
      setRevMsg(e instanceof Error ? e.message : "Could not log revenue.");
    } finally {
      setRevSaving(false);
    }
  };

  const submitReferral = async () => {
    if (!workspace?.id || !refInput.trim()) return;
    setRefSaving(true);
    setRefMsg("");
    try {
      const res = await applyReferral(workspace.id, refInput.trim());
      setRefMsg(res.ok ? "Referral code applied. Earn your first badge to activate it." : "A referral code is already applied to your account.");
      setRefInput("");
    } catch (e) {
      setRefMsg(e instanceof Error ? e.message : "Could not apply that code.");
    } finally {
      setRefSaving(false);
    }
  };

  const ensureCode = async () => {
    if (!workspace?.id) return;
    try {
      const { code } = await getReferralCode(workspace.id);
      setState((s) => (s ? { ...s, referralCode: code } : s));
    } catch {
      /* ignore */
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading your rewards...
      </div>
    );
  }
  if (error || !state) {
    return (
      <div className="py-16 text-center">
        <p className="text-slate-400 text-sm mb-3">{error || "Could not load rewards."}</p>
        <button onClick={refresh} className="px-4 py-2 rounded-xl bg-cyan-600 text-white text-xs font-bold cursor-pointer">Try again</button>
      </div>
    );
  }

  const earnedIds = new Set(state.earned.map((b) => b.id));
  const earnedCount = state.earned.length;
  const totalCredits = state.badges.filter((b) => earnedIds.has(b.id)).reduce((sum, b) => sum + b.credits, 0);

  return (
    <div className="space-y-6">
      {/* Header stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-2xl bg-slate-900/80 border border-white/10 p-4">
          <div className="flex items-center gap-2 text-amber-300 text-xs font-bold mb-1"><Award className="w-4 h-4" /> Badges</div>
          <div className="text-2xl font-black text-white">{earnedCount}<span className="text-sm text-slate-500 font-bold">/{state.badges.length}</span></div>
        </div>
        <div className="rounded-2xl bg-slate-900/80 border border-white/10 p-4">
          <div className="flex items-center gap-2 text-cyan-300 text-xs font-bold mb-1"><Sparkles className="w-4 h-4" /> Credits earned</div>
          <div className="text-2xl font-black text-white">{totalCredits.toLocaleString()}</div>
        </div>
        <div className="rounded-2xl bg-slate-900/80 border border-white/10 p-4">
          <div className="flex items-center gap-2 text-orange-300 text-xs font-bold mb-1"><Flame className="w-4 h-4" /> Streak</div>
          <div className="text-2xl font-black text-white">{state.counters.streakDays}<span className="text-sm text-slate-500 font-bold"> days</span></div>
        </div>
        <div className="rounded-2xl bg-slate-900/80 border border-white/10 p-4">
          <div className="flex items-center gap-2 text-emerald-300 text-xs font-bold mb-1"><TrendingUp className="w-4 h-4" /> Revenue</div>
          <div className="text-2xl font-black text-white">{formatDollars(state.counters.revenueCents)}</div>
        </div>
      </div>

      {/* Your progress (private leaderboard) */}
      <div className="rounded-2xl bg-slate-900/80 border border-white/10 p-5">
        <h3 className="text-sm font-black text-white mb-1">Your progress</h3>
        <p className="text-xs text-slate-500 mb-4">Only you see this. Hit the next milestone in each track to earn AI credits.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {(Object.keys(TRACK_META) as BadgeDef["track"][]).map((track) => {
            const next = nextBadgeForTrack(state, track);
            const meta = TRACK_META[track];
            return (
              <div key={track} className="rounded-xl bg-white/[0.03] border border-white/10 p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500/20 to-blue-600/20 border border-cyan-500/20 flex items-center justify-center text-cyan-300 shrink-0">
                  {meta.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-white">{meta.label}</div>
                  <div className="text-[11px] text-slate-400">{meta.stat(state)}</div>
                  {next ? (
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Next: <span className="text-amber-300 font-bold">{next.name}</span> (+{next.credits} credits)
                    </div>
                  ) : (
                    <div className="text-[11px] text-emerald-300 font-bold mt-0.5">Track complete</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Badge shelf */}
      <div className="rounded-2xl bg-slate-900/80 border border-white/10 p-5">
        <h3 className="text-sm font-black text-white mb-4">Badge shelf</h3>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
          {state.badges.map((badge) => {
            const earned = earnedIds.has(badge.id);
            return (
              <div
                key={badge.id}
                title={`${badge.name} — ${badge.description} (+${badge.credits} AI credits)`}
                className={`rounded-2xl border p-3 flex flex-col items-center text-center transition-all ${
                  earned
                    ? "bg-white/[0.04] border-amber-500/30 shadow-[0_0_18px_rgba(245,158,11,0.12)]"
                    : "bg-white/[0.015] border-white/5 opacity-45 grayscale"
                }`}
              >
                <img src={badge.graphic} alt={badge.name} className="w-14 h-14 rounded-xl object-cover mb-2" loading="lazy" />
                <div className="text-[11px] font-bold text-white leading-tight">{badge.name}</div>
                <div className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
                  {earned ? <Check className="w-3 h-3 text-emerald-400" /> : <Lock className="w-3 h-3" />}
                  +{badge.credits} credits
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Log revenue */}
        <div className="rounded-2xl bg-slate-900/80 border border-white/10 p-5">
          <h3 className="text-sm font-black text-white mb-1 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-emerald-300" /> Log revenue
          </h3>
          <p className="text-xs text-slate-500 mb-4">
            Tag a booking or sale with its dollar value. Totals feed your money badges.
            You can also add a <span className="text-slate-300 font-bold">Log Revenue</span> action inside any BotMap flow.
          </p>
          <div className="flex gap-2 mb-2">
            <input
              value={revAmount}
              onChange={(e) => setRevAmount(e.target.value)}
              placeholder="Amount ($)"
              inputMode="decimal"
              className="flex-1 min-w-0 rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50"
            />
            <button
              onClick={submitRevenue}
              disabled={revSaving}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-xs font-bold cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
            >
              {revSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Log it
            </button>
          </div>
          <input
            value={revNote}
            onChange={(e) => setRevNote(e.target.value)}
            placeholder="Note (optional): e.g. Booking — teeth whitening"
            maxLength={280}
            className="w-full rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50"
          />
          {revMsg && <p className="text-xs text-slate-400 mt-2">{revMsg}</p>}
        </div>

        {/* Referrals */}
        <div className="rounded-2xl bg-slate-900/80 border border-white/10 p-5">
          <h3 className="text-sm font-black text-white mb-1 flex items-center gap-2">
            <Gift className="w-4 h-4 text-purple-300" /> Referrals
          </h3>
          <p className="text-xs text-slate-500 mb-4">
            Earn <span className="text-white font-bold">500 AI credits</span> for every workspace you refer that activates.
          </p>
          <div className="flex gap-2 mb-4">
            <div className="flex-1 rounded-xl bg-slate-950 border border-white/10 px-3 py-2 font-mono text-sm text-cyan-300">
              {state.referralCode || <button onClick={ensureCode} className="text-cyan-400 text-xs font-bold cursor-pointer">Get my code</button>}
            </div>
            {state.referralCode && (
              <button
                onClick={copyCode}
                className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-slate-300 text-xs font-bold cursor-pointer flex items-center gap-1.5 hover:bg-white/10"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "Copied" : "Copy link"}
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <input
              value={refInput}
              onChange={(e) => setRefInput(e.target.value.toUpperCase())}
              placeholder="Have a code? Enter it here"
              className="flex-1 min-w-0 rounded-xl bg-slate-950 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-purple-500/50 font-mono"
            />
            <button
              onClick={submitReferral}
              disabled={refSaving || !refInput.trim()}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 text-white text-xs font-bold cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
            >
              {refSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <Users className="w-3.5 h-3.5" /> Apply
            </button>
          </div>
          {refMsg && <p className="text-xs text-slate-400 mt-2">{refMsg}</p>}
        </div>
      </div>
    </div>
  );
}
