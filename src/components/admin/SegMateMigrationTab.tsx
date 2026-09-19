import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { getApp } from 'firebase/app';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { MIGRATION_COHORT, MigrationCohortRow } from '../../data/segmateCohort';
import {
  Users, Search, Play, Eye, CheckCircle2, AlertTriangle, Clock3, Loader2,
  CreditCard, Crown, ArrowUpCircle, FileJson, ScrollText, X, RefreshCw, Ban,
} from 'lucide-react';

const functions = getFunctions(getApp(), 'us-west2');

async function callMigration(action: string, payload: Record<string, unknown>): Promise<any> {
  const fn = httpsCallable<Record<string, unknown>, any>(functions, 'metaOAuthStatus');
  const res = await fn({ action, ...payload });
  return res.data;
}

interface RowState {
  status?: string;
  billingStatus?: string;
  tierDecision?: string;
  plan?: string;
  workspaceId?: string;
  authUid?: string;
}

interface JobEntry {
  id: string;
  type: string;
  email: string;
  ok: boolean;
  steps: string[];
  error?: string;
  at?: { toDate?: () => Date; seconds?: number };
}

const PATH_LABEL: Record<string, { label: string; cls: string }> = {
  'paypal-reauth': { label: 'PayPal re-auth', cls: 'bg-sky-500/15 text-sky-300 border-sky-500/30' },
  'stripe-silent': { label: 'Stripe silent', cls: 'bg-violet-500/15 text-violet-300 border-violet-500/30' },
  'stripe-reauth': { label: 'Stripe re-entry', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  'unknown': { label: 'Blocked', cls: 'bg-red-500/15 text-red-300 border-red-500/30' },
};

const STATUS_LABEL: Record<string, string> = {
  not_started: 'Not started',
  imported: 'Imported',
  complete: 'Complete',
};

function fmtDate(ts?: JobEntry['at']): string {
  if (!ts) return '';
  if (typeof ts.toDate === 'function') return ts.toDate().toLocaleString();
  if (typeof ts.seconds === 'number') return new Date(ts.seconds * 1000).toLocaleString();
  return '';
}

/**
 * Super Admin concierge dashboard for the SegMate → ChatMize white-glove
 * migration (42-row cohort). Dry-run first, approve per row, billing staged
 * only — nothing bills without Karl's explicit confirmation.
 */
export const SegMateMigrationTab: React.FC = () => {
  const [search, setSearch] = useState('');
  const [pathFilter, setPathFilter] = useState<string>('all');
  const [rowStates, setRowStates] = useState<Record<string, RowState>>({});
  const [billingStates, setBillingStates] = useState<Record<string, any>>({});
  const [jobs, setJobs] = useState<JobEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<MigrationCohortRow | null>(null);
  const [preview, setPreview] = useState<any>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showJobs, setShowJobs] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rowsSnap, billSnap, jobsSnap] = await Promise.all([
        getDocs(collection(db, 'migration_rows')),
        getDocs(collection(db, 'migration_billing')),
        getDocs(query(collection(db, 'migration_jobs'), orderBy('at', 'desc'), limit(50))),
      ]);
      const rs: Record<string, RowState> = {};
      rowsSnap.forEach((d) => {
        const data = d.data() as any;
        if (data.email) rs[data.email.toLowerCase()] = data as RowState;
      });
      const bs: Record<string, any> = {};
      billSnap.forEach((d) => {
        const data = d.data() as any;
        if (data.email) bs[data.email.toLowerCase()] = data;
      });
      setRowStates(rs);
      setBillingStates(bs);
      setJobs(jobsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) } as JobEntry)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load migration state.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return MIGRATION_COHORT.filter((r) => {
      if (pathFilter !== 'all' && r.migrationPath !== pathFilter) return false;
      if (q && !r.email.includes(q) && !r.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [search, pathFilter]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { total: MIGRATION_COHORT.length, imported: 0 };
    for (const r of MIGRATION_COHORT) {
      const st = rowStates[r.email]?.status;
      if (st === 'imported' || st === 'complete') c.imported++;
    }
    return c;
  }, [rowStates]);

  const runAction = async (label: string, action: string, payload: Record<string, unknown>) => {
    setBusy(label);
    setError(null);
    try {
      const result = await callMigration(action, payload);
      await refresh();
      return result;
    } catch (e) {
      setError(e instanceof Error ? e.message : `${label} failed.`);
      return null;
    } finally {
      setBusy(null);
    }
  };

  const handleDryRun = async (row: MigrationCohortRow) => {
    const result = await runAction(`dryrun:${row.email}`, 'migrationDryRun', { email: row.email });
    if (result) { setSelected(row); setPreview(result); }
  };

  const handleImport = async (row: MigrationCohortRow, planOverride?: string) => {
    const st = rowStates[row.email];
    if ((st?.status === 'imported' || st?.status === 'complete')) {
      if (!window.confirm(`Re-run import for ${row.email}? The row is already ${st.status}. Only choose OK to force a re-run.`)) return;
    }
    const result = await runAction(`import:${row.email}`, 'migrationImport', {
      email: row.email,
      force: st?.status === 'imported' || st?.status === 'complete' ? true : undefined,
      planOverride,
      tierDecision: st?.tierDecision,
    });
    if (result) { setPreview(null); }
  };

  const handleStageFile = async (row: MigrationCohortRow, file: File) => {
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      await runAction(`stage:${row.email}`, 'migrationStageBots', { email: row.email, payload });
    } catch (e) {
      setError(e instanceof Error ? `Bad staging file: ${e.message}` : 'Bad staging file.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900/80 border border-white/10 rounded-3xl p-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
              <Users className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-lg font-bold text-white">SegMate Migration Importer</h3>
              <p className="text-xs text-slate-400">
                White-glove concierge tool — dry-run first, approve row by row. {counts.imported} of {counts.total} imported.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowJobs(!showJobs)} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10">
              <ScrollText className="w-4 h-4" /> Job log ({jobs.length})
            </button>
            <button onClick={refresh} disabled={loading} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 disabled:opacity-50">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </div>
        </div>
        {error && (
          <div className="mt-4 flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> {error}
          </div>
        )}
        {/* Path legend */}
        <div className="mt-4 flex flex-wrap gap-2 text-[11px]">
          {Object.entries(PATH_LABEL).map(([k, v]) => {
            const n = MIGRATION_COHORT.filter((r) => r.migrationPath === k).length;
            return (
              <button key={k} onClick={() => setPathFilter(pathFilter === k ? 'all' : k)}
                className={`px-2.5 py-1 rounded-full border font-semibold ${v.cls} ${pathFilter === k ? 'ring-2 ring-white/40' : 'opacity-80'}`}>
                {v.label} · {n}
              </button>
            );
          })}
        </div>
      </div>

      {/* Job log */}
      {showJobs && (
        <div className="bg-slate-950 border border-white/10 rounded-3xl p-5 font-mono text-xs max-h-80 overflow-y-auto">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3">Migration job log (latest {jobs.length})</div>
          {jobs.length === 0 && <p className="text-slate-600 italic">No jobs yet.</p>}
          {jobs.map((j) => (
            <div key={j.id} className="py-2 border-b border-white/5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={j.ok ? 'text-emerald-400' : 'text-red-400'}>{j.ok ? '✓' : '✗'}</span>
                <span className="text-slate-300 font-bold">{j.type}</span>
                <span className="text-cyan-300">{j.email}</span>
                <span className="text-slate-500">{fmtDate(j.at)}</span>
              </div>
              {j.steps?.map((s, i) => <div key={i} className="text-slate-400 pl-5">→ {s}</div>)}
              {j.error && <div className="text-red-400 pl-5">error: {j.error}</div>}
            </div>
          ))}
        </div>
      )}

      {/* Cohort table */}
      <div className="bg-slate-900/80 border border-white/10 rounded-3xl overflow-hidden">
        <div className="p-4 border-b border-white/10 flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search email or name…"
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/50" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-b border-white/10">
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3">Path</th>
                <th className="px-4 py-3">Flags</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const st = rowStates[r.email];
                const status = st?.status ?? 'not_started';
                const path = PATH_LABEL[r.migrationPath];
                return (
                  <tr key={r.email} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-white text-[13px]">{r.name}</div>
                      <div className="text-xs text-slate-400">{r.email}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-300">
                      {r.suggestedPlan === 'blocked' ? <span className="text-red-300">Unknown</span> : `$${r.suggestedPlan}/mo`}
                      <div className="text-slate-500 text-[11px]">{r.segmatePlan.replace('SegMate ', '')}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full border text-[11px] font-semibold ${path.cls}`}>{path.label}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {r.tierBump && <span title={`${r.fanpageCount} pages (${r.activePages ?? '?'} active), threshold ${r.tierThreshold}`} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px] font-bold"><ArrowUpCircle className="w-3 h-3" />bump?</span>}
                        {r.agency && <span title="Lifetime agency holder" className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-300 border border-purple-500/30 text-[10px] font-bold"><Crown className="w-3 h-3" />agency</span>}
                        {r.isFreeze && <span title="SegMate $3/mo freeze account" className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-500/15 text-slate-300 border border-slate-500/30 text-[10px] font-bold"><Ban className="w-3 h-3" />freeze</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-xs font-semibold ${status === 'complete' ? 'text-emerald-300' : status === 'imported' ? 'text-cyan-300' : 'text-slate-400'}`}>
                        {status === 'imported' || status === 'complete' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Clock3 className="w-3.5 h-3.5" />}
                        {STATUS_LABEL[status] ?? status}
                      </span>
                      {st?.billingStatus && <div className="text-[11px] text-slate-500">billing: {st.billingStatus}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1.5">
                        <button title="Dry-run preview" onClick={() => handleDryRun(r)} disabled={busy !== null}
                          className="p-2 rounded-lg bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 disabled:opacity-50">
                          {busy === `dryrun:${r.email}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
                        </button>
                        <button title="Open row" onClick={() => { setSelected(r); setPreview(null); }}
                          className="p-2 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/25">
                          <Play className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Row detail drawer */}
      {selected && (
        <RowDetail
          row={selected}
          state={rowStates[selected.email] ?? {}}
          billing={billingStates[selected.email]}
          preview={preview}
          busy={busy}
          onClose={() => { setSelected(null); setPreview(null); }}
          onDryRun={() => handleDryRun(selected)}
          onImport={(planOverride) => handleImport(selected, planOverride)}
          onStageFile={(f) => handleStageFile(selected, f)}
          onAction={runAction}
          onRefresh={refresh}
        />
      )}
    </div>
  );
};

/** Detail panel for one cohort row: dry-run preview, import, staging, billing, tier call. */
function RowDetail(props: {
  row: MigrationCohortRow;
  state: RowState;
  billing: any;
  preview: any;
  busy: string | null;
  onClose: () => void;
  onDryRun: () => void;
  onImport: (planOverride?: string) => void;
  onStageFile: (f: File) => void;
  onAction: (label: string, action: string, payload: Record<string, unknown>) => Promise<any>;
  onRefresh: () => void;
}) {
  const { row, state, billing, preview, busy } = props;
  const [planOverride, setPlanOverride] = useState<string>('');
  const [activateConfirm, setActivateConfirm] = useState('');
  const fileRef = React.useRef<HTMLInputElement>(null);
  const blocked = row.migrationPath === 'unknown';

  const doTier = async (decision: 'base' | 'bump') => {
    await props.onAction(`tier:${row.email}`, 'migrationSetTierDecision', { email: row.email, decision });
  };
  const doBillingStage = async () => {
    await props.onAction(`bill:${row.email}`, 'migrationBillingStage', { email: row.email });
  };
  const doActivate = async () => {
    if (activateConfirm.trim().toUpperCase() !== 'ACTIVATE') return;
    const res = await props.onAction(`activate:${row.email}`, 'migrationBillingActivate', { email: row.email, confirmed: true });
    if (res) setActivateConfirm('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto bg-black/60 backdrop-blur-sm" onClick={props.onClose}>
      <div className="w-full max-w-3xl my-8 bg-slate-900 border border-white/10 rounded-3xl p-6 space-y-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-bold text-white">{row.name}</h3>
            <p className="text-xs text-slate-400">{row.email} · {row.segmatePlan}</p>
            <p className="text-xs text-slate-500 mt-1">{row.notes}</p>
          </div>
          <button onClick={props.onClose} className="p-2 rounded-lg bg-white/5 text-slate-400 hover:bg-white/10"><X className="w-4 h-4" /></button>
        </div>

        {blocked && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs">
            <Ban className="w-4 h-4 mt-0.5 shrink-0" />
            Blocked: rail undetermined, no PayKickStart transactions, plan conflict. Do not import until Karl rules on this row.
          </div>
        )}

        {/* Flags */}
        <div className="flex flex-wrap gap-2 text-[11px]">
          <span className={`px-2 py-1 rounded-full border font-semibold ${PATH_LABEL[row.migrationPath].cls}`}>{PATH_LABEL[row.migrationPath].label}</span>
          {row.tierBump && <span className="px-2 py-1 rounded-full border font-semibold bg-amber-500/15 text-amber-300 border-amber-500/30">
            Tier-bump candidate: {row.fanpageCount} pages ({row.activePages ?? '?'} active), bar {row.tierThreshold}
            {state.tierDecision && state.tierDecision !== 'pending' ? ` — Karl: ${state.tierDecision}` : ' — awaiting Karl'}
          </span>}
          {row.agency && <span className="px-2 py-1 rounded-full border font-semibold bg-purple-500/15 text-purple-300 border-purple-500/30">Lifetime agency → entitlement</span>}
          {state.status && <span className="px-2 py-1 rounded-full border font-semibold bg-white/5 text-slate-300 border-white/10">Row: {STATUS_LABEL[state.status] ?? state.status}</span>}
          {state.billingStatus && <span className="px-2 py-1 rounded-full border font-semibold bg-white/5 text-slate-300 border-white/10">Billing: {state.billingStatus}</span>}
        </div>

        {/* Tier-bump call */}
        {row.tierBump && !blocked && (
          <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20">
            <div className="text-xs font-bold text-amber-300 mb-2">Karl's tier call (no auto-bump)</div>
            <div className="flex gap-2">
              <button disabled={busy !== null} onClick={() => doTier('base')}
                className={`px-3 py-2 rounded-xl text-xs font-bold border ${state.tierDecision === 'base' ? 'bg-amber-500/25 border-amber-400 text-amber-200' : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'}`}>
                Base $9 — count active pages only ({row.activePages ?? '?'})
              </button>
              <button disabled={busy !== null} onClick={() => doTier('bump')}
                className={`px-3 py-2 rounded-xl text-xs font-bold border ${state.tierDecision === 'bump' ? 'bg-amber-500/25 border-amber-400 text-amber-200' : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'}`}>
                Bump $17 — count all {row.fanpageCount} pages
              </button>
            </div>
          </div>
        )}

        {/* Dry run */}
        <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-bold text-white">Dry-run preview</div>
            <button disabled={busy !== null || blocked} onClick={props.onDryRun}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/25 disabled:opacity-50">
              {busy?.startsWith('dryrun:') ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />} Preview what would be created
            </button>
          </div>
          {preview && preview.email === row.email && (
            <pre className="text-[11px] font-mono text-slate-300 bg-slate-950 rounded-xl p-4 overflow-x-auto max-h-72 overflow-y-auto">
              {JSON.stringify(preview, null, 2)}
            </pre>
          )}
        </div>

        {/* Import */}
        {!blocked && (
          <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 space-y-3">
            <div className="text-xs font-bold text-white">Approve import</div>
            <div className="flex items-center gap-2 flex-wrap">
              <label className="text-xs text-slate-400">Plan override:</label>
              <select value={planOverride} onChange={(e) => setPlanOverride(e.target.value)}
                className="px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white">
                <option value="">Suggested (${row.suggestedPlan})</option>
                <option value="9">$9/mo</option>
                <option value="17">$17/mo</option>
              </select>
              <button disabled={busy !== null} onClick={() => props.onImport(planOverride || undefined)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-50">
                {busy?.startsWith('import:') ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                {state.status === 'imported' || state.status === 'complete' ? 'Re-run import (force)' : 'Approve & import'}
              </button>
            </div>
            <p className="text-[11px] text-slate-500">Idempotent per email. Creates/links the Auth user, workspace + owner membership, OG stamp, agency entitlement, 1-month service credit, and snapshot drafts from staged bots. Never emails the customer.</p>
          </div>
        )}

        {/* Bot staging */}
        {!blocked && (
          <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 space-y-2">
            <div className="text-xs font-bold text-white">Bot extraction staging</div>
            <p className="text-[11px] text-slate-500">
              Run <span className="font-mono text-slate-400">scripts/segmate-extract.mjs --email {row.email}</span> on the VM (read-only), then upload the JSON here.
            </p>
            <input ref={fileRef} type="file" accept=".json,application/json" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) props.onStageFile(f); e.target.value = ''; }} />
            <button disabled={busy !== null} onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 disabled:opacity-50">
              {busy?.startsWith('stage:') ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileJson className="w-4 h-4" />} Upload staged JSON
            </button>
          </div>
        )}

        {/* Billing */}
        {!blocked && (
          <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 space-y-3">
            <div className="text-xs font-bold text-white flex items-center gap-2"><CreditCard className="w-4 h-4" /> Billing — staged only</div>
            {row.migrationPath === 'paypal-reauth' && (
              <div className="space-y-2">
                <button disabled={busy !== null} onClick={doBillingStage}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold bg-sky-500/15 border border-sky-500/30 text-sky-300 hover:bg-sky-500/25 disabled:opacity-50">
                  {busy?.startsWith('bill:') ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />} Generate re-auth link
                </button>
                {billing?.reauthUrl && (
                  <div className="text-[11px] text-slate-400 break-all">
                    <div className="font-mono text-cyan-300">{billing.reauthUrl}</div>
                    <div className="mt-1 text-slate-500">Send white-glove. PayKickStart untouched. Status: {billing.status}</div>
                  </div>
                )}
              </div>
            )}
            {row.migrationPath === 'stripe-silent' && (
              <div className="space-y-2">
                <button disabled={busy !== null} onClick={doBillingStage}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold bg-violet-500/15 border border-violet-500/30 text-violet-300 hover:bg-violet-500/25 disabled:opacity-50">
                  {busy?.startsWith('bill:') ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />} Stage billing (draft only)
                </button>
                {billing?.status === 'staged' && (
                  <div className="p-3 rounded-xl bg-violet-500/5 border border-violet-500/20 space-y-2">
                    <div className="text-[11px] text-slate-300">
                      Staged: customer <span className="font-mono">{billing.customerId}</span>, card {billing.cardBrand} ****{billing.cardLast4}.
                      No subscription exists yet. Nothing has been charged.
                    </div>
                    <div className="flex items-center gap-2">
                      <input value={activateConfirm} onChange={(e) => setActivateConfirm(e.target.value)} placeholder='Type ACTIVATE to confirm'
                        className="px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white placeholder:text-slate-500 w-44" />
                      <button disabled={busy !== null || activateConfirm.trim().toUpperCase() !== 'ACTIVATE'} onClick={doActivate}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold bg-red-500/15 border border-red-500/30 text-red-300 hover:bg-red-500/25 disabled:opacity-50">
                        {busy?.startsWith('activate:') ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertTriangle className="w-4 h-4" />} Create subscription
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-500">Creates a real ${state.plan ?? row.suggestedPlan}/mo Stripe subscription with a 30-day trial (the 1-month migration credit). This is the only action in the importer that can bill.</p>
                  </div>
                )}
                {billing?.status === 'active' && (
                  <div className="text-[11px] text-emerald-300">Active: subscription <span className="font-mono">{billing.subscriptionId}</span></div>
                )}
              </div>
            )}
            {row.migrationPath === 'stripe-reauth' && (
              <div className="text-[11px] text-amber-300">
                {billing?.status === 'card_needed' || !billing
                  ? <>Needs card re-entry — {billing?.reason ?? 'no portable payment method'}. <button onClick={doBillingStage} className="underline">Flag in system</button></>
                  : `Status: ${billing.status}`}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
