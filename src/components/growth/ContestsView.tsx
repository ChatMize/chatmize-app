import React, { useState, useEffect, useCallback } from 'react';
import {
  Trophy,
  Plus,
  Copy,
  Check,
  ExternalLink,
  Loader2,
  ChevronLeft,
  Users,
  Share2,
  MousePointerClick,
  Zap,
  Flag,
  Ban,
  RotateCcw,
  Dices,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  Pencil,
  Eye,
  ShieldCheck,
  Medal,
  RefreshCw,
} from 'lucide-react';
import {
  listContests,
  getContest,
  subscribeContest,
  upsertContest,
  drawWinners,
  approveDraw,
  setParticipantStatus,
  recordActionCompletion,
  listParticipants,
  listDraws,
  listRecentReferrals,
  subscribeLeaderboard,
  entryPageUrl,
  newContestInput,
  ACTION_KINDS,
  Contest,
  Participant,
  ContestDraw,
  LeaderboardEntry,
  ParticipantStatus,
} from '../../lib/contests';
import { ImageUpload } from '../ImageUpload';

interface ContestsViewProps {
  workspaceId?: string;
}

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-slate-500/20 text-slate-300',
  active: 'bg-emerald-500/20 text-emerald-300',
  closed: 'bg-amber-500/20 text-amber-300',
  archived: 'bg-slate-700/40 text-slate-500',
};

const PSTATUS_STYLES: Record<string, string> = {
  active: 'bg-emerald-500/20 text-emerald-300',
  flagged: 'bg-amber-500/20 text-amber-300',
  banned: 'bg-red-500/20 text-red-300',
  winner: 'bg-purple-500/20 text-purple-300',
  disqualified: 'bg-slate-500/20 text-slate-400',
};

function toLocalInput(iso: string): string {
  try {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return '';
  }
}

function fromLocalInput(v: string): string {
  if (!v) return new Date().toISOString();
  return new Date(v).toISOString();
}

const inputCls =
  'w-full px-3 py-2 rounded-xl bg-slate-800 border border-white/10 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500 placeholder:text-slate-500';
const labelCls = 'block text-xs font-semibold text-slate-300 mb-1.5';
const sectionCls = 'bg-slate-900/60 border border-white/10 rounded-2xl p-5 space-y-4';
const sectionTitleCls = 'text-sm font-bold text-white flex items-center gap-2';

export const ContestsView: React.FC<ContestsViewProps> = ({ workspaceId }) => {
  const [contests, setContests] = useState<Contest[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'edit' | 'detail'>('list');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editInput, setEditInput] = useState<Record<string, unknown> | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    try {
      setContests(await listContests(workspaceId));
    } catch (e) {
      console.error('Failed to load contests', e);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => { refresh(); }, [refresh]);

  const startCreate = () => {
    setEditInput(newContestInput());
    setSelectedId(null);
    setSaveError(null);
    setView('edit');
  };

  const startEdit = async (id: string) => {
    const c = await getContest(id);
    if (!c) return;
    setEditInput({ ...c, contestId: c.id });
    setSelectedId(id);
    setSaveError(null);
    setView('edit');
  };

  const openDetail = (id: string) => {
    setSelectedId(id);
    setView('detail');
  };

  const save = async () => {
    if (!workspaceId || !editInput) return;
    setSaving(true);
    setSaveError(null);
    try {
      const { contestId } = await upsertContest(workspaceId, editInput);
      await refresh();
      setSelectedId(contestId);
      setView('detail');
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const copy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* clipboard unavailable */
    }
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const set = (patch: Record<string, unknown>) =>
    setEditInput((prev) => (prev ? { ...prev, ...patch } : prev));

  if (!workspaceId) {
    return <div className="p-8 text-slate-400 text-sm">Select a workspace to manage contests.</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {view !== 'list' && (
            <button
              onClick={() => { setView('list'); refresh(); }}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300"
              title="Back to contests"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-400" /> Contests
            </h1>
            <p className="text-xs text-slate-400">Viral giveaways, leaderboard races, and referral milestones.</p>
          </div>
        </div>
        {view === 'list' && (
          <button
            onClick={startCreate}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-bold text-sm hover:from-amber-400 hover:to-orange-400 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> New contest
          </button>
        )}
      </div>

      {view === 'list' && (
        loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="w-8 h-8 text-cyan-400 animate-spin" /></div>
        ) : contests.length === 0 ? (
          <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-12 text-center">
            <Trophy className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <h2 className="text-white font-bold mb-2">No contests yet</h2>
            <p className="text-sm text-slate-400 mb-6 max-w-md mx-auto">
              Launch a giveaway or referral race. Every entrant becomes a contact, every share carries a tracked referral link.
            </p>
            <button onClick={startCreate} className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-bold text-sm">
              Create your first contest
            </button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {contests.map((c) => (
              <div key={c.id} className="bg-slate-900/60 border border-white/10 rounded-2xl p-5 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="font-bold text-white truncate">{c.title}</div>
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full flex-shrink-0 ${STATUS_STYLES[c.status]}`}>{c.status}</span>
                </div>
                <div className="text-xs text-slate-400 capitalize">{c.type} · {c.draw.mode === 'top_n' ? `top ${c.draw.winnerCount}` : c.draw.mode === 'weighted' ? `${c.draw.winnerCount} winner${c.draw.winnerCount > 1 ? 's' : ''} drawn` : 'milestones'}</div>
                <div className="flex gap-4 text-xs text-slate-400">
                  <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {(c.counters?.entries ?? 0).toLocaleString()}</span>
                  <span className="flex items-center gap-1"><Share2 className="w-3.5 h-3.5" /> {(c.counters?.referrals ?? 0).toLocaleString()}</span>
                  <span className="flex items-center gap-1"><MousePointerClick className="w-3.5 h-3.5" /> {(c.counters?.clicks ?? 0).toLocaleString()}</span>
                </div>
                <div className="text-[11px] text-slate-500">
                  {new Date(c.startsAt).toLocaleDateString()} → {new Date(c.endsAt).toLocaleDateString()}
                  {!c.published && c.status === 'active' && <span className="text-amber-300"> · unpublished</span>}
                </div>
                <div className="flex gap-2 pt-1">
                  <button onClick={() => openDetail(c.id)} className="flex-1 px-3 py-1.5 rounded-lg bg-cyan-500/20 text-cyan-300 text-xs font-bold hover:bg-cyan-500/30">Manage</button>
                  <button onClick={() => startEdit(c.id)} className="px-3 py-1.5 rounded-lg bg-white/5 text-slate-300 text-xs font-semibold hover:bg-white/10 flex items-center gap-1"><Pencil className="w-3.5 h-3.5" /> Edit</button>
                  <button
                    onClick={() => copy(entryPageUrl(c.id), `list-${c.id}`)}
                    className="px-3 py-1.5 rounded-lg bg-white/5 text-slate-300 text-xs font-semibold hover:bg-white/10 flex items-center gap-1"
                    title="Copy public entry link"
                  >
                    {copiedId === `list-${c.id}` ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                  <a href={entryPageUrl(c.id)} target="_blank" rel="noreferrer" className="px-3 py-1.5 rounded-lg bg-white/5 text-slate-300 hover:bg-white/10 flex items-center" title="Open entry page">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {view === 'edit' && editInput && (
        <ContestEditor
          input={editInput}
          set={set}
          onSave={save}
          saving={saving}
          saveError={saveError}
          onCancel={() => { setView(selectedId ? 'detail' : 'list'); }}
          workspaceId={workspaceId}
        />
      )}

      {view === 'detail' && selectedId && (
        <ContestDetail
          workspaceId={workspaceId}
          contestId={selectedId}
          onEdit={() => startEdit(selectedId)}
          onChanged={refresh}
          copy={copy}
          copiedId={copiedId}
        />
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Editor
// ---------------------------------------------------------------------------

function ContestEditor({ input, set, onSave, saving, saveError, onCancel, workspaceId }: {
  input: Record<string, unknown>;
  set: (patch: Record<string, unknown>) => void;
  onSave: () => void;
  saving: boolean;
  saveError: string | null;
  onCancel: () => void;
  workspaceId: string;
}) {
  const actions = (input.actions as Array<Record<string, unknown>>) ?? [];
  const tiers = (input.tiers as Array<Record<string, unknown>>) ?? [];
  const prizes = (input.prizes as Array<Record<string, unknown>>) ?? [];
  const draw = (input.draw as Record<string, unknown>) ?? {};
  const fraud = (input.fraudConfig as Record<string, unknown>) ?? {};
  const consent = (input.consentText as Record<string, unknown>) ?? {};

  const setAction = (idx: number, patch: Record<string, unknown>) => {
    const next = actions.map((a, i) => (i === idx ? { ...a, ...patch } : a));
    set({ actions: next });
  };
  const addAction = () => {
    set({ actions: [...actions, { id: `action_${Date.now()}`, kind: 'visit', label: '', points: 1, tickets: 1 }] });
  };
  const removeAction = (idx: number) => {
    const a = actions[idx];
    if (a.kind === 'enter') return; // entry action is mandatory
    set({ actions: actions.filter((_, i) => i !== idx) });
  };

  const verificationBadge = (kind: string) => {
    const def = ACTION_KINDS.find((k) => k.kind === kind);
    const v = def?.verification ?? 'selfreported';
    const style = v === 'verified' ? 'bg-emerald-500/20 text-emerald-300' : v === 'selfreported' ? 'bg-amber-500/20 text-amber-300' : 'bg-red-500/20 text-red-300';
    return (
      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${style}`} title={def?.hint}>
        {v === 'verified' ? 'verified' : v === 'selfreported' ? 'self-reported' : 'not verifiable'}
      </span>
    );
  };

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Basics */}
      <div className={sectionCls}>
        <div className={sectionTitleCls}>Basics</div>
        <div>
          <label className={labelCls}>Title</label>
          <input value={String(input.title ?? '')} onChange={(e) => set({ title: e.target.value })} placeholder="Win a $500 Dyson bundle" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Description</label>
          <textarea value={String(input.description ?? '')} onChange={(e) => set({ description: e.target.value })} rows={2} placeholder="Prize-first, number-first. What do they win and why should they care?" className={inputCls} />
        </div>
        <ImageUpload value={String(input.heroImageUrl ?? '')} onChange={(url) => set({ heroImageUrl: url })} label="Hero image (prize photo)" workspaceId={workspaceId} />
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Contest type</label>
            <select value={String(input.type ?? 'giveaway')} onChange={(e) => set({ type: e.target.value })} className={inputCls}>
              <option value="giveaway">Giveaway — weighted random draw</option>
              <option value="leaderboard">Leaderboard race — top N win</option>
              <option value="milestones">Referral milestones — auto-unlock</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Status</label>
            <select value={String(input.status ?? 'draft')} onChange={(e) => set({ status: e.target.value })} className={inputCls}>
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="closed">Closed</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        </div>
        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>Starts</label>
            <input type="datetime-local" value={toLocalInput(String(input.startsAt ?? ''))} onChange={(e) => set({ startsAt: fromLocalInput(e.target.value) })} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Ends</label>
            <input type="datetime-local" value={toLocalInput(String(input.endsAt ?? ''))} onChange={(e) => set({ endsAt: fromLocalInput(e.target.value) })} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Chat entry keyword <span className="font-normal text-slate-500">(optional)</span></label>
            <input value={String(input.entryKeyword ?? '')} onChange={(e) => set({ entryKeyword: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })} placeholder="WIN" className={inputCls} />
          </div>
        </div>
        <label className="flex items-center gap-2.5 text-sm text-slate-300 cursor-pointer">
          <input type="checkbox" checked={input.published === true} onChange={(e) => set({ published: e.target.checked })} className="w-4 h-4 accent-cyan-500" />
          <span><strong>Published</strong> — the entry page is publicly visible (only when Active)</span>
        </label>
      </div>

      {/* Actions & weights */}
      <div className={sectionCls}>
        <div className={sectionTitleCls}><Zap className="w-4 h-4 text-amber-400" /> Entry actions &amp; weights</div>
        <p className="text-xs text-slate-400 -mt-2">Points drive the leaderboard; tickets drive the random draw. Shares are never rewarded directly — only the referrals they produce.</p>
        <div className="space-y-3">
          {actions.map((a, i) => (
            <div key={String(a.id)} className="bg-slate-800/60 border border-white/5 rounded-xl p-3 space-y-3">
              <div className="grid sm:grid-cols-[1fr_120px_90px_90px_auto] gap-3 items-end">
                <div>
                  <label className={labelCls}>Label</label>
                  <input value={String(a.label ?? '')} onChange={(e) => setAction(i, { label: e.target.value })} placeholder="Refer a friend who enters" className={inputCls} disabled={a.kind === 'enter'} />
                </div>
                <div>
                  <label className={labelCls}>Kind</label>
                  <select value={String(a.kind ?? 'other')} onChange={(e) => setAction(i, { kind: e.target.value })} className={inputCls} disabled={a.kind === 'enter' || a.kind === 'referral'}>
                    {ACTION_KINDS.map((k) => <option key={k.kind} value={k.kind}>{k.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Points</label>
                  <input type="number" min={0} value={Number(a.points ?? 0)} onChange={(e) => setAction(i, { points: Number(e.target.value) })} className={inputCls} disabled={String(a.kind) === 'share'} />
                </div>
                <div>
                  <label className={labelCls}>Tickets</label>
                  <input type="number" min={0} value={Number(a.tickets ?? 0)} onChange={(e) => setAction(i, { tickets: Number(e.target.value) })} className={inputCls} disabled={String(a.kind) === 'share'} />
                </div>
                <div className="flex items-center gap-2 pb-1">
                  {verificationBadge(String(a.kind))}
                  {a.kind !== 'enter' && (
                    <button onClick={() => removeAction(i)} className="p-1.5 rounded-lg text-slate-500 hover:text-red-300 hover:bg-red-500/10" title="Remove action">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
              {String(a.kind) === 'share' && (
                <p className="text-[11px] text-amber-300/90">Shares are not verifiable on any platform — this action earns nothing itself, but the referrals it produces are rewarded.</p>
              )}
            </div>
          ))}
        </div>
        <button onClick={addAction} className="text-xs font-bold text-cyan-300 hover:text-cyan-200 flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5" /> Add action
        </button>
        <div className="grid sm:grid-cols-2 gap-4 pt-2 border-t border-white/5">
          <div>
            <label className={labelCls}>Referral reward — points</label>
            <input type="number" min={0} value={Number(input.referralPoints ?? 0)} onChange={(e) => set({ referralPoints: Number(e.target.value) })} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Referral reward — tickets</label>
            <input type="number" min={0} value={Number(input.referralTickets ?? 0)} onChange={(e) => set({ referralTickets: Number(e.target.value) })} className={inputCls} />
          </div>
        </div>
      </div>

      {/* Tiers */}
      <div className={sectionCls}>
        <div className={sectionTitleCls}><Medal className="w-4 h-4 text-purple-400" /> Referral milestone tiers <span className="font-normal text-slate-500 text-xs">(auto-unlock)</span></div>
        <div className="space-y-2">
          {tiers.map((t, i) => (
            <div key={i} className="grid sm:grid-cols-[110px_1fr_130px_110px_auto] gap-3 items-end bg-slate-800/60 border border-white/5 rounded-xl p-3">
              <div><label className={labelCls}>Points ≥</label><input type="number" min={1} value={Number(t.threshold ?? 1)} onChange={(e) => { const n = [...tiers]; n[i] = { ...n[i], threshold: Number(e.target.value) }; set({ tiers: n }); }} className={inputCls} /></div>
              <div><label className={labelCls}>Reward label</label><input value={String(t.rewardLabel ?? '')} onChange={(e) => { const n = [...tiers]; n[i] = { ...n[i], rewardLabel: e.target.value }; set({ tiers: n }); }} className={inputCls} placeholder="500 AI credits" /></div>
              <div><label className={labelCls}>Reward kind</label>
                <select value={String(t.rewardKind ?? 'none')} onChange={(e) => { const n = [...tiers]; n[i] = { ...n[i], rewardKind: e.target.value }; set({ tiers: n }); }} className={inputCls}>
                  <option value="ai_credits">AI credits</option>
                  <option value="business_prize">Business prize (manual)</option>
                  <option value="none">Recognition only</option>
                </select>
              </div>
              <div><label className={labelCls}>Credits</label><input type="number" min={0} value={Number(t.rewardValue ?? 0)} onChange={(e) => { const n = [...tiers]; n[i] = { ...n[i], rewardValue: Number(e.target.value) }; set({ tiers: n }); }} className={inputCls} /></div>
              <button onClick={() => set({ tiers: tiers.filter((_, j) => j !== i) })} className="p-2 rounded-lg text-slate-500 hover:text-red-300 hover:bg-red-500/10"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
        <button onClick={() => set({ tiers: [...tiers, { threshold: 100, rewardKind: 'ai_credits', rewardValue: 500, rewardLabel: '' }] })} className="text-xs font-bold text-cyan-300 hover:text-cyan-200 flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5" /> Add tier
        </button>
      </div>

      {/* Prizes */}
      <div className={sectionCls}>
        <div className={sectionTitleCls}><Trophy className="w-4 h-4 text-amber-400" /> Prizes</div>
        <div className="space-y-2">
          {prizes.map((p, i) => (
            <div key={i} className="grid sm:grid-cols-[70px_1fr_130px_110px_auto] gap-3 items-end bg-slate-800/60 border border-white/5 rounded-xl p-3">
              <div><label className={labelCls}>Place</label><input type="number" min={1} value={Number(p.place ?? i + 1)} onChange={(e) => { const n = [...prizes]; n[i] = { ...n[i], place: Number(e.target.value) }; set({ prizes: n }); }} className={inputCls} /></div>
              <div><label className={labelCls}>Prize label</label><input value={String(p.label ?? '')} onChange={(e) => { const n = [...prizes]; n[i] = { ...n[i], label: e.target.value }; set({ prizes: n }); }} className={inputCls} placeholder="Grand prize" /></div>
              <div><label className={labelCls}>Reward kind</label>
                <select value={String(p.rewardKind ?? 'business_prize')} onChange={(e) => { const n = [...prizes]; n[i] = { ...n[i], rewardKind: e.target.value }; set({ prizes: n }); }} className={inputCls}>
                  <option value="business_prize">Business prize (manual)</option>
                  <option value="ai_credits">AI credits</option>
                  <option value="none">Recognition only</option>
                </select>
              </div>
              <div><label className={labelCls}>Credits</label><input type="number" min={0} value={Number(p.rewardValue ?? 0)} onChange={(e) => { const n = [...prizes]; n[i] = { ...n[i], rewardValue: Number(e.target.value) }; set({ prizes: n }); }} className={inputCls} /></div>
              <button onClick={() => set({ prizes: prizes.filter((_, j) => j !== i) })} className="p-2 rounded-lg text-slate-500 hover:text-red-300 hover:bg-red-500/10"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
        <button onClick={() => set({ prizes: [...prizes, { place: prizes.length + 1, label: '', rewardKind: 'business_prize', rewardValue: 0 }] })} className="text-xs font-bold text-cyan-300 hover:text-cyan-200 flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5" /> Add prize
        </button>
        <div className="grid sm:grid-cols-3 gap-4 pt-3 border-t border-white/5">
          <div>
            <label className={labelCls}>Draw mode</label>
            <select value={String(draw.mode ?? 'weighted')} onChange={(e) => set({ draw: { ...draw, mode: e.target.value } })} className={inputCls}>
              <option value="weighted">Weighted random (by tickets)</option>
              <option value="top_n">Top N by points</option>
              <option value="milestones">Milestones only (no draw)</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Winners</label>
            <input type="number" min={1} max={100} value={Number(draw.winnerCount ?? 1)} onChange={(e) => set({ draw: { ...draw, winnerCount: Number(e.target.value) } })} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Claim window (days)</label>
            <input type="number" min={1} max={90} value={Number(draw.claimWindowDays ?? 7)} onChange={(e) => set({ draw: { ...draw, claimWindowDays: Number(e.target.value) } })} className={inputCls} />
          </div>
        </div>
      </div>

      {/* Fraud */}
      <div className={sectionCls}>
        <div className={sectionTitleCls}><ShieldCheck className="w-4 h-4 text-emerald-400" /> Anti-gaming</div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div><label className={labelCls}>Max entries / hour</label><input type="number" min={1} value={Number(fraud.maxEntriesPerHour ?? 200)} onChange={(e) => set({ fraudConfig: { ...fraud, maxEntriesPerHour: Number(e.target.value) } })} className={inputCls} /><p className="text-[10px] text-slate-500 mt-1">Spikes above this flag the contest for review.</p></div>
          <div><label className={labelCls}>Max referrals / referrer</label><input type="number" min={1} value={Number(fraud.maxReferralsPerReferrer ?? 500)} onChange={(e) => set({ fraudConfig: { ...fraud, maxReferralsPerReferrer: Number(e.target.value) } })} className={inputCls} /><p className="text-[10px] text-slate-500 mt-1">Extra referrals are not credited.</p></div>
          <div><label className={labelCls}>Max referrals / hour</label><input type="number" min={1} value={Number(fraud.maxReferralsPerHour ?? 100)} onChange={(e) => set({ fraudConfig: { ...fraud, maxReferralsPerHour: Number(e.target.value) } })} className={inputCls} /><p className="text-[10px] text-slate-500 mt-1">Velocity signal for the review queue.</p></div>
          <div><label className={labelCls}>Prize hold (hours)</label><input type="number" min={0} max={720} value={Number(fraud.prizeHoldHours ?? 0)} onChange={(e) => set({ fraudConfig: { ...fraud, prizeHoldHours: Number(e.target.value) } })} className={inputCls} /><p className="text-[10px] text-slate-500 mt-1">High-value rewards release after review.</p></div>
        </div>
      </div>

      {/* Trust checklist */}
      <div className={sectionCls}>
        <div className={sectionTitleCls}><CheckCircle2 className="w-4 h-4 text-cyan-400" /> Trust checklist</div>
        <p className="text-xs text-slate-400 -mt-2">Required before publishing. Visible rules are a trust signal — and the law in most US states.</p>
        <div>
          <label className={labelCls}>Official rules</label>
          <textarea value={String(input.rulesText ?? '')} onChange={(e) => set({ rulesText: e.target.value })} rows={4} placeholder="Eligibility, dates, how winners are selected, odds..." className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Alternate method of entry (no purchase necessary)</label>
          <textarea value={String(input.amoeText ?? '')} onChange={(e) => set({ amoeText: e.target.value })} rows={2} className={inputCls} />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Winners announced</label>
            <input type="datetime-local" value={toLocalInput(String(input.announceAt ?? ''))} onChange={(e) => set({ announceAt: fromLocalInput(e.target.value) })} className={inputCls} />
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Contest consent text</label>
            <textarea value={String(consent.contest ?? '')} onChange={(e) => set({ consentText: { ...consent, contest: e.target.value } })} rows={2} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Marketing consent text</label>
            <textarea value={String(consent.marketing ?? '')} onChange={(e) => set({ consentText: { ...consent, marketing: e.target.value } })} rows={2} className={inputCls} />
          </div>
        </div>
      </div>

      {saveError && (
        <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" /> {saveError}
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={onSave}
          disabled={saving}
          className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-slate-950 font-bold text-sm hover:from-cyan-400 hover:to-blue-400 disabled:opacity-50 flex items-center gap-2"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {saving ? 'Saving...' : 'Save contest'}
        </button>
        <button onClick={onCancel} className="px-6 py-2.5 rounded-xl bg-white/5 text-slate-300 font-semibold text-sm hover:bg-white/10">
          Cancel
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Detail (manage one contest)
// ---------------------------------------------------------------------------

interface ContestDetailProps {
  workspaceId: string;
  contestId: string;
  onEdit: () => void | Promise<void>;
  onChanged: () => void | Promise<void>;
  copy: (text: string, id: string) => void | Promise<void>;
  copiedId: string | null;
}

function ContestDetail({ workspaceId, contestId, onEdit, onChanged, copy, copiedId }: ContestDetailProps) {
  const [contest, setContest] = useState<Contest | null>(null);
  const [tab, setTab] = useState<'entries' | 'leaderboard' | 'referrals' | 'draws'>('entries');
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loadingParts, setLoadingParts] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | ParticipantStatus>('all');
  const [search, setSearch] = useState('');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [referrals, setReferrals] = useState<Array<Record<string, any>>>([]);
  const [draws, setDraws] = useState<ContestDraw[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionFor, setActionFor] = useState<string | null>(null);

  useEffect(() => {
    return subscribeContest(contestId, setContest);
  }, [contestId]);

  useEffect(() => {
    setTab('entries');
    setNotice(null);
  }, [contestId]);

  const loadParticipants = useCallback(async () => {
    setLoadingParts(true);
    try {
      setParticipants(await listParticipants(contestId, { status: statusFilter, search: search || undefined }));
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingParts(false);
    }
  }, [contestId, statusFilter, search]);

  useEffect(() => { loadParticipants(); }, [loadParticipants]);
  useEffect(() => {
    if (tab !== 'leaderboard') return;
    return subscribeLeaderboard(contestId, (lb) => { if (lb) setLeaderboard(lb.top); });
  }, [tab, contestId]);
  useEffect(() => {
    if (tab !== 'referrals') return;
    listRecentReferrals(contestId).then(setReferrals).catch(console.error);
  }, [tab, contestId]);
  useEffect(() => {
    if (tab !== 'draws') return;
    listDraws(contestId).then(setDraws).catch(console.error);
  }, [tab, contestId]);

  if (!contest) {
    return <div className="flex items-center justify-center py-16"><Loader2 className="w-8 h-8 text-cyan-400 animate-spin" /></div>;
  }

  const runDraw = async () => {
    if (!window.confirm(`Run the ${contest.draw.mode === 'top_n' ? 'top-N' : 'weighted random'} draw for "${contest.title}"? This closes the contest. Winners stay pending until you approve.`)) return;
    setBusy('draw');
    try {
      const { drawId, winners } = await drawWinners(workspaceId, contestId);
      setNotice(`Draw complete: ${winners.length} winner${winners.length === 1 ? '' : 's'} selected. Review and approve below.`);
      setDraws(await listDraws(contestId));
      setTab('draws');
      onChanged();
      void drawId;
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Draw failed.');
    } finally {
      setBusy(null);
    }
  };

  const approve = async (drawId: string) => {
    if (!window.confirm('Approve these winners? Prizes will be released (AI credits honor the hold period).')) return;
    setBusy(`approve-${drawId}`);
    try {
      const { approved } = await approveDraw(workspaceId, contestId, drawId);
      setNotice(`${approved} winner${approved === 1 ? '' : 's'} approved and prizes released.`);
      setDraws(await listDraws(contestId));
      loadParticipants();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Approval failed.');
    } finally {
      setBusy(null);
    }
  };

  const changeStatus = async (p: Participant, status: ParticipantStatus) => {
    const reason = status === 'active' ? undefined : window.prompt(`Reason for marking ${p.leaderboardAlias} as ${status} (shown in the review log):`) || undefined;
    if ((status === 'banned' || status === 'disqualified' || status === 'flagged') && reason === null) return;
    if (status === 'banned' && !window.confirm(`Ban ${p.leaderboardAlias}? Their referral tree will be invalidated (past and future referrals lose credit).`)) return;
    setBusy(`status-${p.id}`);
    try {
      const { invalidatedReferrals } = await setParticipantStatus(workspaceId, contestId, p.id, status, reason);
      setNotice(invalidatedReferrals > 0 ? `${p.leaderboardAlias} ${status}. ${invalidatedReferrals} referral credit(s) revoked.` : `${p.leaderboardAlias} marked ${status}.`);
      loadParticipants();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Status change failed.');
    } finally {
      setBusy(null);
    }
  };

  const completeAction = async (p: Participant, actionId: string) => {
    setBusy(`action-${p.id}`);
    try {
      const r = await recordActionCompletion(workspaceId, contestId, p.id, actionId);
      setNotice(`${p.leaderboardAlias} now at ${r.points} pts / ${r.tickets} tickets.`);
      loadParticipants();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Failed to record action.');
    } finally {
      setBusy(null);
    }
  };

  const bonusActions = contest.actions.filter((a) => a.kind !== 'enter' && a.kind !== 'referral');
  const entryUrl = entryPageUrl(contestId);

  return (
    <div className="space-y-5 max-w-6xl">
      {/* Header */}
      <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-bold text-white">{contest.title}</h2>
              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${STATUS_STYLES[contest.status]}`}>{contest.status}</span>
              {!contest.published && <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300">unpublished</span>}
            </div>
            <p className="text-xs text-slate-400 mt-1 capitalize">{contest.type} · {contest.draw.mode === 'top_n' ? `top ${contest.draw.winnerCount} win` : contest.draw.mode === 'weighted' ? 'weighted random draw' : 'milestone auto-unlock'} · ends {new Date(contest.endsAt).toLocaleString()}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={onEdit} className="px-3 py-1.5 rounded-lg bg-white/5 text-slate-200 text-xs font-bold hover:bg-white/10 flex items-center gap-1.5"><Pencil className="w-3.5 h-3.5" /> Edit</button>
            <button onClick={() => copy(entryUrl, 'entry')} className="px-3 py-1.5 rounded-lg bg-white/5 text-slate-200 text-xs font-bold hover:bg-white/10 flex items-center gap-1.5">
              {copiedId === 'entry' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />} Entry link
            </button>
            <a href={entryUrl} target="_blank" rel="noreferrer" className="px-3 py-1.5 rounded-lg bg-white/5 text-slate-200 text-xs font-bold hover:bg-white/10 flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5" /> View page
            </a>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          {[
            { icon: Users, label: 'Entries', value: (contest.counters?.entries ?? 0).toLocaleString(), color: 'text-cyan-400' },
            { icon: Share2, label: 'Referrals', value: (contest.counters?.referrals ?? 0).toLocaleString(), color: 'text-purple-400' },
            { icon: MousePointerClick, label: 'Link clicks', value: (contest.counters?.clicks ?? 0).toLocaleString(), color: 'text-amber-400' },
            { icon: Zap, label: 'Actions done', value: (contest.counters?.actionsCompleted ?? 0).toLocaleString(), color: 'text-emerald-400' },
          ].map((s) => (
            <div key={s.label} className="bg-slate-800/60 rounded-xl p-3">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400"><s.icon className={`w-3.5 h-3.5 ${s.color}`} /> {s.label}</div>
              <div className="text-xl font-extrabold text-white mt-1">{s.value}</div>
            </div>
          ))}
        </div>
        {contest.fraudFlags.length > 0 && (
          <div className="mt-4 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3">
            <div className="text-xs font-bold text-amber-300 flex items-center gap-1.5 mb-1.5"><AlertTriangle className="w-3.5 h-3.5" /> Fraud signals ({contest.fraudFlags.length})</div>
            <div className="space-y-1">
              {contest.fraudFlags.slice(-5).map((f, i) => (
                <div key={i} className="text-[11px] text-amber-200/80">{f.reason} · {new Date(f.at).toLocaleString()}</div>
              ))}
            </div>
          </div>
        )}
      </div>

      {notice && (
        <div className="text-sm text-cyan-200 bg-cyan-500/10 border border-cyan-500/30 rounded-xl px-4 py-2.5 flex items-start justify-between gap-3">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} className="text-cyan-400 hover:text-cyan-200 text-xs font-bold">Dismiss</button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-white/10">
        {(['entries', 'leaderboard', 'referrals', 'draws'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-bold capitalize border-b-2 -mb-px ${tab === t ? 'text-cyan-300 border-cyan-400' : 'text-slate-400 border-transparent hover:text-slate-200'}`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'entries' && (
        <div className="space-y-4">
          <div className="flex gap-3 flex-wrap">
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email, code..." className="px-3 py-2 rounded-xl bg-slate-800 border border-white/10 text-sm text-slate-100 placeholder:text-slate-500 w-64" />
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)} className="px-3 py-2 rounded-xl bg-slate-800 border border-white/10 text-sm text-slate-100">
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="flagged">Flagged</option>
              <option value="banned">Banned</option>
              <option value="winner">Winners</option>
              <option value="disqualified">Disqualified</option>
            </select>
            <button onClick={loadParticipants} className="px-3 py-2 rounded-xl bg-white/5 text-slate-300 text-sm font-semibold hover:bg-white/10 flex items-center gap-1.5">
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>
          {loadingParts ? (
            <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-cyan-400 animate-spin" /></div>
          ) : participants.length === 0 ? (
            <div className="text-sm text-slate-500 py-10 text-center">No entries yet.</div>
          ) : (
            <div className="bg-slate-900/60 border border-white/10 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-b border-white/10">
                      <th className="px-4 py-3">Entrant</th>
                      <th className="px-4 py-3">Points</th>
                      <th className="px-4 py-3">Tickets</th>
                      <th className="px-4 py-3">Ref code</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Entered</th>
                      <th className="px-4 py-3 text-right">Review</th>
                    </tr>
                  </thead>
                  <tbody>
                    {participants.map((p) => (
                      <tr key={p.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-white">{p.leaderboardAlias}</div>
                          <div className="text-[11px] text-slate-500">{p.email ?? p.phone ?? p.channel}{p.referredBy ? ` · via ${p.referredBy}` : ''}</div>
                          {p.fraudFlags.length > 0 && <div className="text-[11px] text-amber-300 flex items-center gap-1 mt-0.5"><Flag className="w-3 h-3" /> {p.fraudFlags.length} flag{p.fraudFlags.length > 1 ? 's' : ''}</div>}
                        </td>
                        <td className="px-4 py-3 font-bold text-cyan-300 tabular-nums">{p.points.toLocaleString()}</td>
                        <td className="px-4 py-3 tabular-nums text-slate-300">{p.tickets.toLocaleString()}</td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-400">{p.referralCode}</td>
                        <td className="px-4 py-3"><span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${PSTATUS_STYLES[p.status]}`}>{p.status}</span></td>
                        <td className="px-4 py-3 text-xs text-slate-500">{new Date(p.enteredAt).toLocaleString()}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1 justify-end items-center">
                            {bonusActions.length > 0 && (
                              actionFor === p.id ? (
                                <select
                                  value=""
                                  onChange={(e) => { if (e.target.value) { completeAction(p, e.target.value); setActionFor(null); } }}
                                  className="text-xs bg-slate-800 border border-white/10 rounded-lg px-2 py-1 text-slate-200"
                                >
                                  <option value="">Log action...</option>
                                  {bonusActions.filter((a) => !p.actionsCompleted.some((c) => c.actionId === a.id)).map((a) => (
                                    <option key={a.id} value={a.id}>{a.label} (+{a.points})</option>
                                  ))}
                                </select>
                              ) : (
                                <button onClick={() => setActionFor(p.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-300 hover:bg-emerald-500/10" title="Log bonus action">
                                  <Zap className="w-4 h-4" />
                                </button>
                              )
                            )}
                            {p.status === 'active' && (
                              <>
                                <button onClick={() => changeStatus(p, 'flagged')} disabled={busy === `status-${p.id}`} className="p-1.5 rounded-lg text-slate-400 hover:text-amber-300 hover:bg-amber-500/10" title="Flag for review"><Flag className="w-4 h-4" /></button>
                                <button onClick={() => changeStatus(p, 'banned')} disabled={busy === `status-${p.id}`} className="p-1.5 rounded-lg text-slate-400 hover:text-red-300 hover:bg-red-500/10" title="Ban (invalidates referral tree)"><Ban className="w-4 h-4" /></button>
                              </>
                            )}
                            {p.status !== 'active' && p.status !== 'winner' && (
                              <button onClick={() => changeStatus(p, 'active')} disabled={busy === `status-${p.id}`} className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-300 hover:bg-emerald-500/10" title="Reinstate">
                                <RotateCcw className="w-4 h-4" />
                              </button>
                            )}
                            {busy === `status-${p.id}` && <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'leaderboard' && (
        <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-5">
          <div className="text-xs text-slate-500 mb-4">Public snapshot — top 100, refreshed at most once per minute during spikes. Flagged and banned entrants never appear.</div>
          {leaderboard.length === 0 ? (
            <div className="text-sm text-slate-500 py-8 text-center">No leaderboard data yet.</div>
          ) : (
            <div className="space-y-1.5">
              {leaderboard.map((e) => (
                <div key={`${e.rank}-${e.alias}`} className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/[0.03]">
                  <span className={`w-8 text-sm font-extrabold tabular-nums ${e.rank <= 3 ? 'text-amber-300' : 'text-slate-500'}`}>{e.rank}</span>
                  <span className="flex-1 text-sm font-medium text-white truncate">{e.alias}</span>
                  <span className="text-xs text-slate-500">{e.referrals} referrals</span>
                  <span className="text-sm font-bold text-cyan-300 tabular-nums">{e.points.toLocaleString()} pts</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'referrals' && (
        <div className="bg-slate-900/60 border border-white/10 rounded-2xl overflow-hidden">
          {referrals.length === 0 ? (
            <div className="text-sm text-slate-500 py-10 text-center">No referrals recorded yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-b border-white/10">
                    <th className="px-4 py-3">Referrer code</th>
                    <th className="px-4 py-3">Referee</th>
                    <th className="px-4 py-3">Credited</th>
                    <th className="px-4 py-3">When</th>
                  </tr>
                </thead>
                <tbody>
                  {referrals.map((r) => (
                    <tr key={r.id} className="border-b border-white/5">
                      <td className="px-4 py-3 font-mono text-xs text-slate-300">{r.referrerCode}</td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">{String(r.refereeId).slice(0, 12)}…</td>
                      <td className="px-4 py-3">
                        {r.credited
                          ? <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">credited</span>
                          : <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-slate-500/20 text-slate-400" title={r.creditDeniedReason ?? ''}>denied</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">{new Date(r.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'draws' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-400 max-w-xl">
              Drawing closes the contest and selects winners, but <strong className="text-slate-200">nothing is granted or announced until you approve</strong>. Winners are revalidated (flag/ban status) at approval time.
            </p>
            <button
              onClick={runDraw}
              disabled={busy === 'draw' || contest.status === 'archived'}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-bold text-sm hover:from-amber-400 hover:to-orange-400 disabled:opacity-50 flex items-center gap-2"
            >
              {busy === 'draw' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Dices className="w-4 h-4" />}
              {busy === 'draw' ? 'Drawing...' : 'Run draw'}
            </button>
          </div>
          {draws.length === 0 ? (
            <div className="text-sm text-slate-500 py-10 text-center bg-slate-900/60 border border-white/10 rounded-2xl">No draws yet.</div>
          ) : (
            draws.map((d) => (
              <div key={d.id} className="bg-slate-900/60 border border-white/10 rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="text-sm font-bold text-white">
                    {d.mode === 'top_n' ? 'Top-N selection' : 'Weighted random draw'} · {d.winners.length} winner{d.winners.length === 1 ? '' : 's'}
                    <span className="text-slate-500 font-normal"> · {d.eligibleCount} eligible · {new Date(d.createdAt).toLocaleString()}</span>
                  </div>
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${d.status === 'approved' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}`}>
                    {d.status.replace('_', ' ')}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 font-mono break-all">seed: {d.seed}</div>
                <div className="space-y-1.5">
                  {d.winners.map((w) => (
                    <div key={w.participantId} className="flex items-center gap-3 text-sm bg-slate-800/60 rounded-xl px-3 py-2">
                      <span className="w-7 h-7 rounded-full bg-amber-500/20 text-amber-300 font-extrabold text-xs flex items-center justify-center">{w.place}</span>
                      <span className="flex-1 font-medium text-white">{w.alias}</span>
                      <span className="text-xs text-slate-500">{w.pointsAtDraw.toLocaleString()} pts · {w.ticketsAtDraw.toLocaleString()} tickets</span>
                    </div>
                  ))}
                  {d.alternates.length > 0 && (
                    <div className="text-[11px] text-slate-500 pt-1">Alternates: {d.alternates.map((a) => a.alias).join(', ')}</div>
                  )}
                </div>
                {d.status === 'pending_approval' && (
                  <button
                    onClick={() => approve(d.id)}
                    disabled={busy === `approve-${d.id}`}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold text-sm hover:from-emerald-400 hover:to-teal-400 disabled:opacity-50 flex items-center gap-2"
                  >
                    {busy === `approve-${d.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    Approve winners &amp; release prizes
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
