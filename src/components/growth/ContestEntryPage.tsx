import React, { useState, useEffect, useCallback } from 'react';
import {
  Trophy,
  Users,
  Clock,
  CheckCircle2,
  Copy,
  Check,
  Loader2,
  Share2,
  Gift,
  ListChecks,
  ShieldCheck,
  ChevronDown,
  Medal,
} from 'lucide-react';
import {
  getPublicContest,
  trackReferralClick,
  enterContestPublic,
  subscribeLeaderboard,
  entryPageUrl,
  referralLinkFor,
  PublicContest,
  LeaderboardEntry,
} from '../../lib/contests';

interface ContestEntryPageProps {
  contestId: string;
}

function useCountdown(targetIso: string): { days: number; hours: number; mins: number; secs: number; ended: boolean } {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const diff = new Date(targetIso).getTime() - now;
  if (diff <= 0) return { days: 0, hours: 0, mins: 0, secs: 0, ended: true };
  return {
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff / 3600000) % 24),
    mins: Math.floor((diff / 60000) % 60),
    secs: Math.floor((diff / 1000) % 60),
    ended: false,
  };
}

export const ContestEntryPage: React.FC<ContestEntryPageProps> = ({ contestId }) => {
  const [contest, setContest] = useState<PublicContest | null>(null);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'missing' | 'closed'>('loading');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [refCode] = useState(() => {
    try {
      return new URLSearchParams(window.location.search).get('ref')?.toUpperCase() || '';
    } catch {
      return '';
    }
  });

  // Entry form
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [consentMarketing, setConsentMarketing] = useState(false);
  const [anonymous, setAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Post-entry
  const [myCode, setMyCode] = useState<string | null>(null);
  const [myLink, setMyLink] = useState<string | null>(null);
  const [wasDuplicate, setWasDuplicate] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showRules, setShowRules] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { contest: c, reason } = await getPublicContest(contestId);
        if (cancelled) return;
        if (!c) {
          setLoadState(reason === 'closed' || reason === 'archived' ? 'closed' : 'missing');
          return;
        }
        setContest(c);
        setLoadState('ready');
        // Restore a previous entry on this device.
        try {
          const saved = localStorage.getItem(`chatmize_contest_${contestId}`);
          if (saved) {
            const parsed = JSON.parse(saved);
            setMyCode(parsed.referralCode);
            setMyLink(entryPageUrl(contestId, parsed.referralCode));
            setWasDuplicate(true);
          }
        } catch { /* ignore */ }
        if (refCode) trackReferralClick(contestId);
      } catch {
        if (!cancelled) setLoadState('missing');
      }
    })();
    return () => { cancelled = true; };
  }, [contestId, refCode]);

  useEffect(() => {
    if (loadState !== 'ready') return;
    return subscribeLeaderboard(contestId, (lb) => {
      if (lb) setLeaderboard(lb.top);
    });
  }, [contestId, loadState]);

  const countdown = useCountdown(contest?.endsAt ?? new Date().toISOString());

  const submit = useCallback(async () => {
    setFormError(null);
    if (!name.trim()) { setFormError('Please enter your name.'); return; }
    if (!email.trim() && !phone.trim()) { setFormError('An email or phone number is required.'); return; }
    setSubmitting(true);
    try {
      const res = await enterContestPublic(contestId, {
        displayName: name.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        ref: refCode || undefined,
        consentContest: true,
        consentMarketing,
        anonymous,
      });
      setMyCode(res.referralCode);
      const link = referralLinkFor(contestId, res.referralCode);
      setMyLink(link);
      setWasDuplicate(res.duplicate);
      try {
        localStorage.setItem(`chatmize_contest_${contestId}`, JSON.stringify({ referralCode: res.referralCode }));
      } catch { /* ignore */ }
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Entry failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [contestId, name, email, phone, refCode, consentMarketing, anonymous]);

  const copyLink = useCallback(async () => {
    if (!myLink) return;
    try {
      await navigator.clipboard.writeText(myLink);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = myLink;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [myLink]);

  const shareNative = useCallback(async () => {
    if (!myLink || !contest) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: contest.title, text: `I'm in to win: ${contest.title}`, url: myLink });
      } catch { /* dismissed */ }
    } else {
      copyLink();
    }
  }, [myLink, contest, copyLink]);

  if (loadState === 'loading') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  if (loadState === 'missing') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <Trophy className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-slate-900 mb-2">Contest not found</h1>
          <p className="text-slate-500">This contest link is invalid or was removed.</p>
        </div>
      </div>
    );
  }

  if (loadState === 'closed' || !contest) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <Trophy className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-slate-900 mb-2">This contest has ended</h1>
          <p className="text-slate-500">Entries are closed. Winners will be announced through the official channels.</p>
        </div>
      </div>
    );
  }

  const entered = myCode !== null;
  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Hero */}
      <div className="bg-gradient-to-br from-indigo-700 via-purple-700 to-fuchsia-700 text-white">
        <div className="max-w-3xl mx-auto px-5 py-10 sm:py-14">
          {contest.heroImageUrl && (
            <img src={contest.heroImageUrl} alt={contest.title} className="w-full max-h-72 object-cover rounded-2xl shadow-xl mb-6" />
          )}
          <div className="flex items-center gap-2 text-indigo-200 text-xs font-bold uppercase tracking-widest mb-3">
            <Gift className="w-4 h-4" />
            {contest.type === 'giveaway' ? 'Giveaway' : contest.type === 'leaderboard' ? 'Leaderboard race' : 'Referral challenge'}
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold leading-tight mb-3">{contest.title}</h1>
          {contest.description && <p className="text-indigo-100 text-base mb-6">{contest.description}</p>}

          {/* Countdown */}
          <div className="bg-white/10 backdrop-blur rounded-2xl p-4 inline-block">
            <div className="flex items-center gap-2 text-indigo-200 text-xs font-semibold uppercase tracking-wider mb-2">
              <Clock className="w-4 h-4" /> {countdown.ended ? 'Contest ended' : 'Entries close in'}
            </div>
            <div className="flex gap-3">
              {[
                [countdown.days, 'days'],
                [countdown.hours, 'hrs'],
                [countdown.mins, 'min'],
                [countdown.secs, 'sec'],
              ].map(([v, label]) => (
                <div key={label as string} className="text-center">
                  <div className="text-2xl sm:text-3xl font-extrabold tabular-nums">{pad(v as number)}</div>
                  <div className="text-[10px] uppercase tracking-wider text-indigo-200">{label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-4 mt-5 text-sm text-indigo-100">
            <span className="flex items-center gap-1.5"><Users className="w-4 h-4" /> {contest.counters.entries.toLocaleString()} entered</span>
            <span className="flex items-center gap-1.5"><Share2 className="w-4 h-4" /> {contest.counters.referrals.toLocaleString()} referrals</span>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-5 py-8 space-y-8">
        {/* Entry / success */}
        {!entered ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-bold mb-1">Enter now — it takes 20 seconds</h2>
            <p className="text-sm text-slate-500 mb-5">One entry per person. Winners announced {contest.announceAt ? new Date(contest.announceAt).toLocaleDateString() : 'after close'}.</p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1">Your name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Jane Smith"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900"
                />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-1">Email</label>
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@email.com"
                    type="email"
                    autoComplete="email"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Phone <span className="font-normal text-slate-400">(optional)</span></label>
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(555) 123-4567"
                    type="tel"
                    autoComplete="tel"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900"
                  />
                </div>
              </div>
              <label className="flex items-start gap-2.5 text-sm text-slate-600 cursor-pointer">
                <input type="checkbox" checked={consentMarketing} onChange={(e) => setConsentMarketing(e.target.checked)} className="mt-1 w-4 h-4 accent-indigo-600" />
                <span>{contest.consentText.marketing}</span>
              </label>
              <label className="flex items-start gap-2.5 text-sm text-slate-600 cursor-pointer">
                <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} className="mt-1 w-4 h-4 accent-indigo-600" />
                <span>Enter anonymously on the public leaderboard</span>
              </label>
              <p className="text-xs text-slate-400 flex items-start gap-1.5">
                <ShieldCheck className="w-4 h-4 flex-shrink-0" />
                {contest.consentText.contest}
              </p>
              {formError && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">{formError}</div>}
              <button
                onClick={submit}
                disabled={submitting || countdown.ended}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold text-base hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trophy className="w-5 h-5" />}
                {submitting ? 'Entering...' : countdown.ended ? 'Entries closed' : 'Enter to win'}
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-emerald-200 p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-11 h-11 rounded-full bg-emerald-100 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold">{wasDuplicate ? "You're already in!" : "You're in! Now multiply your chances."}</h2>
                <p className="text-sm text-slate-500">
                  Every friend who enters through your link earns you <strong>+{contest.referralPoints} pts</strong> and <strong>+{contest.referralTickets} tickets</strong>.
                </p>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <input readOnly value={myLink ?? ''} className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 bg-slate-50 text-sm text-slate-700 font-mono" onFocus={(e) => e.target.select()} />
              <button onClick={copyLink} className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 flex items-center gap-1.5">
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
              <button onClick={shareNative} className="px-4 py-2.5 rounded-xl border border-slate-300 font-semibold text-sm hover:bg-slate-50 flex items-center gap-1.5">
                <Share2 className="w-4 h-4" /> Share
              </button>
            </div>
          </div>
        )}

        {/* Prizes */}
        {contest.prizes.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2"><Medal className="w-5 h-5 text-amber-500" /> Prizes</h2>
            <div className="space-y-3">
              {contest.prizes.map((p) => (
                <div key={p.place} className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-amber-100 text-amber-700 font-extrabold flex items-center justify-center text-sm flex-shrink-0">
                    {p.place}
                  </div>
                  <div>
                    <div className="font-semibold text-sm">{p.label}</div>
                    {p.rewardKind === 'ai_credits' && p.rewardValue > 0 && (
                      <div className="text-xs text-slate-500">+ {p.rewardValue} AI credits</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* How it works */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2"><ListChecks className="w-5 h-5 text-indigo-600" /> How it works</h2>
          <ol className="space-y-3 text-sm">
            <li className="flex gap-3"><span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center flex-shrink-0">1</span><span><strong>Enter</strong> above — one entry per person, 20 seconds.</span></li>
            <li className="flex gap-3"><span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center flex-shrink-0">2</span><span><strong>Share your link</strong> — friends who enter earn you bonus points and tickets.</span></li>
            <li className="flex gap-3"><span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center flex-shrink-0">3</span><span><strong>Win</strong> — {contest.draw.mode === 'top_n' ? `top ${contest.draw.winnerCount} on the leaderboard win` : 'winners drawn at random'} and announced publicly.</span></li>
          </ol>
          {contest.actions.filter((a) => a.kind !== 'enter' && a.kind !== 'referral').length > 0 && (
            <div className="mt-5 pt-5 border-t border-slate-100">
              <div className="text-sm font-semibold mb-2">Bonus actions</div>
              <div className="space-y-2">
                {contest.actions.filter((a) => a.kind !== 'enter' && a.kind !== 'referral').map((a) => (
                  <div key={a.id} className="flex items-center justify-between text-sm bg-slate-50 rounded-xl px-4 py-2.5">
                    <span>{a.label}</span>
                    <span className="text-xs font-bold text-indigo-700">+{a.points} pts · +{a.tickets} tickets</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Live leaderboard */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-bold mb-1 flex items-center gap-2"><Trophy className="w-5 h-5 text-amber-500" /> Live leaderboard</h2>
          <p className="text-xs text-slate-400 mb-4">Updates in real time as entries and referrals come in.</p>
          {leaderboard.length === 0 ? (
            <p className="text-sm text-slate-500">No entries yet — be the first.</p>
          ) : (
            <div className="space-y-1.5">
              {leaderboard.slice(0, 10).map((e) => (
                <div key={`${e.rank}-${e.alias}`} className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-slate-50">
                  <span className="w-7 text-sm font-extrabold text-slate-400 tabular-nums">{e.rank}</span>
                  <span className="flex-1 text-sm font-medium truncate">{e.alias}</span>
                  <span className="text-xs text-slate-400">{e.referrals} referrals</span>
                  <span className="text-sm font-bold text-indigo-700 tabular-nums">{e.points.toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Rules */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <button onClick={() => setShowRules(!showRules)} className="flex items-center justify-between w-full text-left">
            <h2 className="text-lg font-bold">Official rules</h2>
            <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${showRules ? 'rotate-180' : ''}`} />
          </button>
          {showRules && (
            <div className="mt-4 text-sm text-slate-600 space-y-3 whitespace-pre-wrap">
              {contest.rulesText && <p>{contest.rulesText}</p>}
              <p className="font-semibold">Alternate method of entry</p>
              <p>{contest.amoeText}</p>
              <p className="text-xs text-slate-400">No payment is ever required to enter or claim a prize. Winners are announced only through the official channels of the business running this contest.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
