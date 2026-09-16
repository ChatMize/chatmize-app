import React, { useEffect, useState } from 'react';
import { Library, Trash2, Star, Loader2 } from 'lucide-react';
import {
  SnapshotDoc,
  ALL_SNAPSHOT_KINDS,
  SNAPSHOT_KIND_LABELS,
  listAllSnapshots,
  deleteSnapshot,
  setSnapshotTemplate,
} from '../../lib/snapshots';

/** Super Admin curation: feature snapshots into the library, set niches, moderate. */
export const SnapshotAdminTab: React.FC = () => {
  const [snapshots, setSnapshots] = useState<SnapshotDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [nicheEdits, setNicheEdits] = useState<Record<string, string>>({});

  const refresh = () => {
    setLoading(true);
    listAllSnapshots()
      .then(setSnapshots)
      .catch(() => setSnapshots([]))
      .finally(() => setLoading(false));
  };

  useEffect(refresh, []);

  const toggleTemplate = async (snap: SnapshotDoc) => {
    const niche = nicheEdits[snap.id] ?? snap.niche ?? '';
    try {
      await setSnapshotTemplate(snap.id, !snap.isTemplate, niche.trim() || undefined);
      refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to update snapshot.');
    }
  };

  const saveNiche = async (snap: SnapshotDoc) => {
    const niche = (nicheEdits[snap.id] ?? snap.niche ?? '').trim();
    try {
      await setSnapshotTemplate(snap.id, snap.isTemplate, niche || undefined);
      refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to save niche.');
    }
  };

  const remove = async (snap: SnapshotDoc) => {
    if (!window.confirm(`Delete the snapshot "${snap.name}"? Its share link will stop working.`)) return;
    try {
      await deleteSnapshot(snap.id);
      refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to delete snapshot.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-400 text-sm gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading snapshots...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-white">Snapshot Curation</h2>
        <p className="text-xs text-slate-400">
          Feature snapshots into the template library subscribers pay for. Set the niche so users can find them.
        </p>
      </div>

      {snapshots.length === 0 ? (
        <div className="border border-dashed border-white/15 rounded-3xl p-10 text-center">
          <Library className="w-6 h-6 text-slate-600 mx-auto mb-2" />
          <p className="text-sm text-slate-400">No snapshots yet</p>
          <p className="text-xs text-slate-500 mt-1">Share one from Bot Maps → Share to stock the library.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {snapshots.map((snap) => {
            const total = ALL_SNAPSHOT_KINDS.reduce((a, k) => a + (snap.counts?.[k] || 0), 0);
            return (
              <div
                key={snap.id}
                className={`rounded-2xl border p-4 flex flex-col sm:flex-row sm:items-center gap-4 ${
                  snap.isTemplate ? 'border-purple-500/40 bg-purple-500/5' : 'border-white/10 bg-slate-900/60'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-bold text-white truncate">{snap.name}</h3>
                    {snap.isTemplate && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-purple-500/15 text-purple-300 border border-purple-500/30 flex items-center gap-1 shrink-0">
                        <Star className="w-3 h-3" /> In library
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500">
                    {total} items · by {snap.createdByName || snap.createdByUid.slice(0, 8)} ·{' '}
                    {new Date(snap.createdAt).toLocaleDateString()}
                  </p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {ALL_SNAPSHOT_KINDS.map((k) => {
                      const n = snap.counts?.[k] || 0;
                      if (!n) return null;
                      return (
                        <span key={k} className="text-[10px] text-slate-500 bg-white/5 px-1.5 py-0.5 rounded">
                          {n} {SNAPSHOT_KIND_LABELS[k].toLowerCase()}
                        </span>
                      );
                    })}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <input
                    value={nicheEdits[snap.id] ?? snap.niche ?? ''}
                    onChange={(e) => setNicheEdits((p) => ({ ...p, [snap.id]: e.target.value }))}
                    onBlur={() => saveNiche(snap)}
                    placeholder="Niche"
                    className="w-28 bg-slate-800/60 border border-white/10 rounded-xl px-2.5 py-1.5 text-[11px] text-white placeholder:text-slate-600 focus:outline-none focus:border-purple-500/50"
                  />
                  <button
                    onClick={() => toggleTemplate(snap)}
                    title={snap.isTemplate ? 'Remove from library' : 'Feature in library'}
                    className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                      snap.isTemplate
                        ? 'bg-purple-500/20 border-purple-500/40 text-purple-200 hover:bg-purple-500/30'
                        : 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:border-white/25'
                    }`}
                  >
                    <Star className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => remove(snap)}
                    title="Delete snapshot"
                    className="p-2.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 rounded-xl transition-all cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
