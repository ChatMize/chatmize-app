import React, { useEffect, useMemo, useState } from 'react';
import { MailPlus, Search, Download, Loader2, CheckCircle2, Clock3, Crown } from 'lucide-react';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { db } from '../../lib/firebase';

interface WaitlistSignup {
  id: string;
  name: string;
  email: string;
  status: 'pending' | 'confirmed';
  source: string;
  segmateUser: boolean;
  createdAt?: { toDate?: () => Date; seconds?: number };
  confirmedAt?: { toDate?: () => Date; seconds?: number } | null;
  consentAt?: string;
}

function tsToDate(ts: WaitlistSignup['createdAt']): Date | null {
  if (!ts) return null;
  if (typeof ts.toDate === 'function') return ts.toDate();
  if (typeof ts.seconds === 'number') return new Date(ts.seconds * 1000);
  return null;
}

function toCsv(rows: WaitlistSignup[]): string {
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const header = 'name,email,status,source,segmate_user,signed_up_at,confirmed_at';
  const lines = rows.map((r) => {
    const created = tsToDate(r.createdAt);
    const confirmed = tsToDate(r.confirmedAt ?? undefined);
    return [
      esc(r.name || ''),
      esc(r.email || ''),
      r.status,
      esc(r.source || ''),
      r.segmateUser ? 'yes' : 'no',
      esc(created ? created.toISOString() : ''),
      esc(confirmed ? confirmed.toISOString() : ''),
    ].join(',');
  });
  return [header, ...lines].join('\n');
}

/** Super Admin: waitlist signups with status, search, filter, and CSV export. */
export const WaitlistAdminTab: React.FC = () => {
  const [signups, setSignups] = useState<WaitlistSignup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'confirmed'>('all');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const q = query(collection(db, 'waitlist_signups'), orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        if (cancelled) return;
        setSignups(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<WaitlistSignup, 'id'>) })),
        );
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load waitlist.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return signups.filter((s) => {
      if (statusFilter !== 'all' && s.status !== statusFilter) return false;
      if (!needle) return true;
      return (s.name || '').toLowerCase().includes(needle) || (s.email || '').toLowerCase().includes(needle);
    });
  }, [signups, search, statusFilter]);

  const counts = useMemo(() => {
    const confirmed = signups.filter((s) => s.status === 'confirmed').length;
    return { total: signups.length, confirmed, pending: signups.length - confirmed };
  }, [signups]);

  const exportCsv = () => {
    const blob = new Blob([toCsv(filtered)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chatmize-waitlist-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="p-2 rounded-xl bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            <MailPlus className="w-5 h-5" />
          </span>
          <div>
            <h2 className="text-lg font-black text-white tracking-tight">Waitlist Signups</h2>
            <p className="text-xs text-slate-400">
              {counts.total} total &middot; {counts.confirmed} confirmed &middot; {counts.pending} pending
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or email"
              className="pl-10 pr-4 py-2 rounded-xl bg-slate-950/80 border border-white/10 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/60"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="px-3 py-2 rounded-xl bg-slate-950/80 border border-white/10 text-sm text-slate-200 cursor-pointer"
          >
            <option value="all">All statuses</option>
            <option value="confirmed">Confirmed</option>
            <option value="pending">Pending</option>
          </select>
          <button
            onClick={exportCsv}
            disabled={filtered.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-all cursor-pointer disabled:opacity-40"
          >
            <Download className="w-4 h-4" />
            Export CSV ({filtered.length})
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16 text-slate-400 text-sm gap-2">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading signups...
        </div>
      )}

      {!loading && error && (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {error} (Super Admin access is required to read waitlist signups.)
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-12 text-center text-sm text-slate-400">
          No signups yet. Share <span className="text-slate-200 font-mono">/waitlist</span> to start collecting.
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-b border-white/10">
                  <th className="px-4 py-3 font-bold">Name</th>
                  <th className="px-4 py-3 font-bold">Email</th>
                  <th className="px-4 py-3 font-bold">Status</th>
                  <th className="px-4 py-3 font-bold">Source</th>
                  <th className="px-4 py-3 font-bold">Signed up</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => {
                  const created = tsToDate(s.createdAt);
                  return (
                    <tr key={s.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                      <td className="px-4 py-3 text-white font-semibold whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5">
                          {s.name}
                          {s.segmateUser && (
                            <span title="SegMate user (OG seed)" className="text-amber-400">
                              <Crown className="w-3.5 h-3.5" />
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-300">{s.email}</td>
                      <td className="px-4 py-3">
                        {s.status === 'confirmed' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Confirmed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                            <Clock3 className="w-3.5 h-3.5" /> Pending
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-xs">{s.source || '—'}</td>
                      <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">
                        {created ? created.toLocaleString() : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
