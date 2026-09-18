import React, { useEffect, useState } from 'react';
import { X, Share2, Copy, Check, Link2 } from 'lucide-react';
import {
  ALL_SNAPSHOT_KINDS,
  SNAPSHOT_KIND_LABELS,
  SnapshotAssetKind,
  SnapshotPayload,
  exportWorkspaceSnapshot,
  createSnapshot,
  snapshotShareUrl,
} from '../../lib/snapshots';

interface ShareSnapshotModalProps {
  onClose: () => void;
  /** Current workspace slug; growth links export from Firestore under it. */
  workspaceSlug?: string;
}

/** Create a shareable snapshot link ("Sharbot link") for this workspace's setup. */
export const ShareSnapshotModal: React.FC<ShareSnapshotModalProps> = ({ onClose, workspaceSlug }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [niche, setNiche] = useState('');
  const [kinds, setKinds] = useState<SnapshotAssetKind[]>([...ALL_SNAPSHOT_KINDS]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [preview, setPreview] = useState<{
    payload: SnapshotPayload;
    counts: Record<SnapshotAssetKind, number>;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    exportWorkspaceSnapshot(kinds, { workspaceSlug })
      .then((p) => {
        if (!cancelled) setPreview(p);
      })
      .catch(() => {
        if (!cancelled) setPreview(null);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(kinds), workspaceSlug]);

  const toggleKind = (kind: SnapshotAssetKind) => {
    setKinds((prev) => (prev.includes(kind) ? prev.filter((k) => k !== kind) : [...prev, kind]));
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      setError('Give your snapshot a name.');
      return;
    }
    if (kinds.length === 0) {
      setError('Select at least one thing to share.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const { payload, counts } = await exportWorkspaceSnapshot(kinds, { workspaceSlug });
      const total = Object.values(counts).reduce((a, b) => a + b, 0);
      if (total === 0) {
        throw new Error('There is nothing to share yet. Build a bot map first.');
      }
      const id = await createSnapshot({
        name: name.trim(),
        description: description.trim(),
        niche: niche.trim() || undefined,
        payload,
        counts,
      });
      setShareUrl(snapshotShareUrl(id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create the share link.');
    } finally {
      setSaving(false);
    }
  };

  const copyLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable
    }
  };

  const inputCls =
    'w-full bg-slate-800/60 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/50';

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-slate-900 border border-white/10 rounded-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-cyan-500/15">
              <Share2 className="w-4 h-4 text-cyan-300" />
            </span>
            <div>
              <h2 className="text-base font-black text-white">Share workspace snapshot</h2>
              <p className="text-[11px] text-slate-500">Anyone with the link can import it into their account.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-500 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {shareUrl ? (
          <div className="space-y-4 text-center py-4">
            <span className="inline-flex p-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/30">
              <Link2 className="w-5 h-5 text-emerald-300" />
            </span>
            <h3 className="text-sm font-bold text-white">Your share link is ready</h3>
            <div className="flex items-center gap-2 bg-slate-800/60 border border-white/10 rounded-xl p-2 pl-3">
              <p className="flex-1 text-[11px] text-cyan-300 font-mono truncate text-left">{shareUrl}</p>
              <button
                type="button"
                onClick={copyLink}
                className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-[11px] font-bold flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-500">
              Connections and secrets are never included. Imported bots land as drafts.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 bg-white/10 hover:bg-white/15 text-white rounded-xl text-xs font-bold cursor-pointer"
            >
              Done
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Snapshot name</label>
              <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Dental lead-gen starter kit" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Description</label>
              <textarea className={inputCls} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is inside and who is it for?" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Niche (optional)</label>
              <input className={inputCls} value={niche} onChange={(e) => setNiche(e.target.value)} placeholder="e.g. Dental, E-commerce, Coaches" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Include</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {ALL_SNAPSHOT_KINDS.map((kind) => {
                  const active = kinds.includes(kind);
                  return (
                    <button
                      key={kind}
                      type="button"
                      onClick={() => toggleKind(kind)}
                      className={`flex items-center justify-between px-3 py-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        active
                          ? 'bg-cyan-500/10 border-cyan-500/40 text-white'
                          : 'bg-slate-800/40 border-white/10 text-slate-500'
                      }`}
                    >
                      <span>{SNAPSHOT_KIND_LABELS[kind]}</span>
                      <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono ${active ? 'bg-cyan-500/20 text-cyan-300' : 'bg-white/5 text-slate-600'}`}>
                        {preview ? preview.counts[kind] : '…'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
            {error && <p className="text-[11px] text-red-400">{error}</p>}
            <button
              type="button"
              onClick={handleCreate}
              disabled={saving}
              className="w-full py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold cursor-pointer shadow-lg shadow-blue-500/20"
            >
              {saving ? 'Creating share link...' : 'Create share link'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
