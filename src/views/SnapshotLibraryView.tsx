import React, { useEffect, useState } from 'react';
import { Library, Download, Search, Lock, Loader2, Crown, Gift } from 'lucide-react';
import {
  SnapshotDoc,
  ALL_SNAPSHOT_KINDS,
  SNAPSHOT_KIND_LABELS,
  listTemplates,
  listStarterBonuses,
  importSnapshotPayload,
} from '../lib/snapshots';
import { hasFeature, usePlan } from '../lib/entitlements';
import { WorkspaceSilo } from '../types/workspace';

interface SnapshotLibraryViewProps {
  workspace?: WorkspaceSilo;
  onImported: () => void;
  onUpgrade: () => void;
}

/**
 * Curated snapshot repository.
 * - Starter bonus: free snapshots every account gets, importable on any plan.
 * - Subscriber library: gated by the `snapshot_library` feature (Agency).
 */
export const SnapshotLibraryView: React.FC<SnapshotLibraryViewProps> = ({
  workspace,
  onImported,
  onUpgrade,
}) => {
  const [bonuses, setBonuses] = useState<SnapshotDoc[]>([]);
  const [templates, setTemplates] = useState<SnapshotDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [importingId, setImportingId] = useState<string | null>(null);
  const [importedId, setImportedId] = useState<string | null>(null);
  const plan = usePlan(workspace?.planId);
  const hasAccess = hasFeature(plan, 'snapshot_library');

  useEffect(() => {
    Promise.all([listStarterBonuses().catch(() => [] as SnapshotDoc[]), listTemplates().catch(() => [] as SnapshotDoc[])])
      .then(([b, t]) => {
        setBonuses(b);
        // Starter bonuses also appear as templates; keep them out of the paid section.
        const bonusIds = new Set(b.map((x) => x.id));
        setTemplates(t.filter((x) => !bonusIds.has(x.id) && x.access !== 'free'));
      })
      .finally(() => setLoading(false));
  }, []);

  const matches = (t: SnapshotDoc) => {
    if (!query.trim()) return true;
    const q = query.trim().toLowerCase();
    return (
      t.name.toLowerCase().includes(q) ||
      (t.description || '').toLowerCase().includes(q) ||
      (t.niche || '').toLowerCase().includes(q)
    );
  };

  const handleImport = async (snap: SnapshotDoc) => {
    setImportingId(snap.id);
    try {
      await importSnapshotPayload(snap.payload, { workspaceSlug: workspace?.slug });
      setImportedId(snap.id);
      setTimeout(() => {
        setImportedId(null);
        onImported();
      }, 1200);
    } catch {
      // Firestore unavailable: unblock the UI without marking success.
    } finally {
      setImportingId(null);
    }
  };

  const renderCard = (snap: SnapshotDoc, locked: boolean) => {
    const total = ALL_SNAPSHOT_KINDS.reduce((a, k) => a + (snap.counts?.[k] || 0), 0);
    const done = importedId === snap.id;
    return (
      <div key={snap.id} className="rounded-3xl border border-white/10 bg-slate-900/60 p-5 flex flex-col">
        <div className="flex flex-wrap gap-1.5 mb-2">
          {snap.niche && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-purple-500/15 text-purple-300 border border-purple-500/30">
              {snap.niche}
            </span>
          )}
          {snap.access === 'free' && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
              Free bonus
            </span>
          )}
        </div>
        <h3 className="text-sm font-black text-white">{snap.name}</h3>
        {snap.description && <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">{snap.description}</p>}
        <div className="flex flex-wrap gap-1.5 mt-3 mb-4">
          {ALL_SNAPSHOT_KINDS.map((k) => {
            const n = snap.counts?.[k] || 0;
            if (!n) return null;
            return (
              <span key={k} className="text-[10px] font-bold text-slate-400 bg-white/5 border border-white/10 px-2 py-0.5 rounded-full">
                {n} {SNAPSHOT_KIND_LABELS[k].toLowerCase()}
              </span>
            );
          })}
        </div>
        <div className="mt-auto">
          {locked ? (
            <button
              onClick={onUpgrade}
              className="w-full py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:border-white/25 transition-all"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Unlock to import</span>
            </button>
          ) : (
            <button
              onClick={() => handleImport(snap)}
              disabled={importingId === snap.id || done}
              className={`w-full py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                done
                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                  : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-lg shadow-purple-500/20'
              }`}
            >
              <Download className="w-3.5 h-3.5" />
              <span>{done ? 'Imported' : `Import ${total} items`}</span>
            </button>
          )}
        </div>
      </div>
    );
  };

  const freeTemplates = templates.filter((t) => t.access === 'free');
  const paidTemplates = templates.filter((t) => t.access !== 'free');
  const shownBonuses = bonuses.filter(matches);
  const shownFree = freeTemplates.filter(matches);
  const shownPaid = paidTemplates.filter(matches);

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="p-2.5 rounded-2xl bg-purple-500/15 border border-purple-500/30">
            <Library className="w-5 h-5 text-purple-300" />
          </span>
          <div>
            <h2 className="text-xl font-black text-white">Snapshot Library</h2>
            <p className="text-xs text-slate-400">
              Done-for-you workspace setups. Import an entire niche kit in one click.
            </p>
          </div>
        </div>
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search niches..."
            className="bg-slate-800/60 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-purple-500/50 w-56"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24 text-slate-400 text-sm gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading templates...
        </div>
      ) : (
        <>
          {/* Free starter bonus: every account, every plan */}
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <Gift className="w-4 h-4 text-emerald-300" />
              <h3 className="text-sm font-black text-white">Your starter bonus</h3>
              <span className="text-[10px] text-slate-500 font-bold">Free with your account, any plan</span>
            </div>
            {shownBonuses.length === 0 && shownFree.length === 0 ? (
              <p className="text-xs text-slate-500">Starter snapshots are being prepared. Check back soon.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {shownBonuses.map((s) => renderCard(s, false))}
                {shownFree.map((s) => renderCard(s, false))}
              </div>
            )}
          </section>

          {/* Subscriber library */}
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <Crown className="w-4 h-4 text-amber-300" />
              <h3 className="text-sm font-black text-white">Subscriber library</h3>
              {!hasAccess && <span className="text-[10px] text-slate-500 font-bold">Unlocks with library access</span>}
            </div>
            {!hasAccess && (
              <div className="rounded-3xl border border-amber-500/30 bg-amber-500/5 p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <span className="p-2 rounded-xl bg-amber-500/15">
                    <Lock className="w-4 h-4 text-amber-300" />
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-white">Full library access is a subscriber perk</h3>
                    <p className="text-xs text-slate-400 mt-1">
                      You can browse every snapshot below. One-click import unlocks on plans with library
                      access (Agency). Your current plan{plan ? ` (${plan.name})` : ''} does not include it.
                    </p>
                  </div>
                </div>
                <button
                  onClick={onUpgrade}
                  className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white rounded-xl text-xs font-bold cursor-pointer shadow-lg shadow-orange-500/20 shrink-0"
                >
                  Unlock the library
                </button>
              </div>
            )}
            {shownPaid.length === 0 ? (
              <p className="text-xs text-slate-500">More subscriber snapshots are on the way.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {shownPaid.map((s) => renderCard(s, !hasAccess))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
};
