import React, { useEffect, useState } from 'react';
import { Download, Check, AlertTriangle, ArrowLeft, Loader2 } from 'lucide-react';
import {
  SnapshotDoc,
  SnapshotAssetKind,
  ALL_SNAPSHOT_KINDS,
  SNAPSHOT_KIND_LABELS,
  getSnapshot,
  importSnapshotPayload,
} from '../lib/snapshots';

interface SnapshotImportViewProps {
  snapshotId: string;
  workspaceName: string;
  onBack: () => void;
  onImported: () => void;
}

/** Preview + one-click import for a shared snapshot link. */
export const SnapshotImportView: React.FC<SnapshotImportViewProps> = ({
  snapshotId,
  workspaceName,
  onBack,
  onImported,
}) => {
  const [snapshot, setSnapshot] = useState<SnapshotDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState<Record<SnapshotAssetKind, number> | null>(null);

  useEffect(() => {
    getSnapshot(snapshotId)
      .then((s) => {
        if (!s) setNotFound(true);
        else setSnapshot(s);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [snapshotId]);

  const handleImport = () => {
    if (!snapshot) return;
    setImporting(true);
    try {
      const counts = importSnapshotPayload(snapshot.payload);
      setImported(counts);
    } finally {
      setImporting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400 text-sm gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading snapshot...
      </div>
    );
  }

  if (notFound || !snapshot) {
    return (
      <div className="max-w-lg mx-auto text-center py-24 space-y-4">
        <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto" />
        <h2 className="text-lg font-black text-white">Snapshot not found</h2>
        <p className="text-xs text-slate-400">This share link is invalid or the snapshot was deleted.</p>
        <button onClick={onBack} className="text-xs text-cyan-300 hover:text-cyan-200 font-bold cursor-pointer">
          Back to Bot Maps
        </button>
      </div>
    );
  }

  const totalItems = ALL_SNAPSHOT_KINDS.reduce((a, k) => a + (snapshot.counts?.[k] || 0), 0);

  return (
    <div className="max-w-2xl mx-auto py-8 space-y-6">
      <button
        onClick={onBack}
        className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 font-bold cursor-pointer"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Back
      </button>

      <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-6 sm:p-8 space-y-5">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-cyan-300 mb-1">
            Shared workspace snapshot{snapshot.niche ? ` · ${snapshot.niche}` : ''}
          </p>
          <h1 className="text-2xl font-black text-white">{snapshot.name}</h1>
          {snapshot.description && <p className="text-sm text-slate-400 mt-2">{snapshot.description}</p>}
          {snapshot.createdByName && (
            <p className="text-[11px] text-slate-500 mt-2">Shared by {snapshot.createdByName}</p>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {ALL_SNAPSHOT_KINDS.map((kind) => {
            const n = snapshot.counts?.[kind] || 0;
            if (!n) return null;
            return (
              <div key={kind} className="rounded-2xl bg-white/5 border border-white/10 p-3 text-center">
                <p className="text-xl font-black text-white">{n}</p>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{SNAPSHOT_KIND_LABELS[kind]}</p>
              </div>
            );
          })}
        </div>

        {imported ? (
          <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/30 p-5 text-center space-y-3">
            <span className="inline-flex p-2.5 rounded-2xl bg-emerald-500/15">
              <Check className="w-5 h-5 text-emerald-300" />
            </span>
            <h3 className="text-sm font-bold text-white">Imported into {workspaceName}</h3>
            <p className="text-xs text-slate-400">
              {totalItems} items added. Bots landed as drafts with zeroed stats. Reconnect your own
              accounts in Settings → Channels before going live.
            </p>
            <button
              onClick={onImported}
              className="px-6 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white rounded-xl text-xs font-bold cursor-pointer"
            >
              Go to Bot Maps
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <button
              onClick={handleImport}
              disabled={importing}
              className="w-full py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50 text-white rounded-2xl text-sm font-bold flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-blue-500/20"
            >
              <Download className="w-4 h-4" />
              <span>{importing ? 'Importing...' : `Import ${totalItems} items into ${workspaceName}`}</span>
            </button>
            <p className="text-[11px] text-slate-500 text-center">
              Your existing bots and tools are kept. Imported copies get new ids and start as drafts.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
