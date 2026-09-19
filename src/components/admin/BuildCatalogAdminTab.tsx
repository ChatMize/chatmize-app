import React, { useState, useEffect } from 'react';
import { Rocket, Plus, Pencil, Trash2, X, Check, CalendarDays } from 'lucide-react';
import {
  BuildCatalogEntry,
  BUILD_CATALOG_TAGS,
  fetchBuildCatalogEntries,
  logBuildEntry,
  updateBuildEntry,
  deleteBuildEntry,
  formatCatalogDate,
  LogBuildEntryInput,
} from '../../lib/buildCatalog';
import { BUILD_CATALOG_SEED } from '../../lib/buildCatalogSeed';

const EMPTY_FORM: LogBuildEntryInput = {
  title: '',
  summary: '',
  buildDate: new Date().toISOString().slice(0, 10),
  goLiveDate: new Date().toISOString().slice(0, 10),
  deployCommit: '',
  bundleName: '',
  tags: [],
  icon: '',
};

export const BuildCatalogAdminTab: React.FC = () => {
  const [entries, setEntries] = useState<BuildCatalogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<BuildCatalogEntry | null>(null);
  const [form, setForm] = useState<LogBuildEntryInput>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const reload = async () => {
    setLoading(true);
    setEntries(await fetchBuildCatalogEntries(200));
    setLoading(false);
  };

  useEffect(() => {
    reload();
  }, []);

  const startAdd = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setError('');
  };

  const startEdit = (e: BuildCatalogEntry) => {
    setEditing(e);
    setForm({
      title: e.title,
      summary: e.summary,
      buildDate: e.buildDate,
      goLiveDate: e.goLiveDate,
      deployCommit: e.deployCommit || '',
      bundleName: e.bundleName || '',
      tags: [...e.tags],
      icon: e.icon || '',
    });
    setError('');
  };

  const toggleTag = (t: string) => {
    setForm((f) => ({
      ...f,
      tags: f.tags?.includes(t) ? f.tags.filter((x) => x !== t) : [...(f.tags || []), t],
    }));
  };

  const save = async () => {
    if (!form.title.trim() || !form.buildDate || !form.goLiveDate) {
      setError('Title, build date, and go live date are required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (editing) {
        await updateBuildEntry(editing.id, form);
      } else {
        await logBuildEntry(form);
      }
      setEditing(null);
      await reload();
    } catch (err: any) {
      setError(err?.message || 'Save failed. Super Admin access is required.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm('Delete this catalog entry?')) return;
    try {
      await deleteBuildEntry(id);
      await reload();
    } catch (err: any) {
      setError(err?.message || 'Delete failed.');
    }
  };

  const backfill = async () => {
    if (!window.confirm(`Add ${BUILD_CATALOG_SEED.length} seed entries for the September launch builds? Entries with matching titles are skipped.`)) return;
    setSaving(true);
    setError('');
    try {
      const existing = new Set(entries.map((e) => e.title.toLowerCase()));
      let added = 0;
      for (const seed of BUILD_CATALOG_SEED) {
        if (existing.has(seed.title.toLowerCase())) continue;
        await logBuildEntry(seed);
        added++;
      }
      await reload();
      if (added === 0) setError('All seed entries already exist.');
    } catch (err: any) {
      setError(err?.message || 'Backfill failed. Super Admin access is required.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Rocket className="w-4 h-4 text-emerald-400" />
            Build Catalog Entries ({entries.length})
          </h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            What users see in the bell dropdown and the catalog page. Deploy coordinators add entries
            automatically with logBuildEntry after each deploy.
          </p>
        </div>
        <button
          onClick={startAdd}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Add entry
        </button>
      </div>
      {entries.length === 0 && !loading && (
        <button
          onClick={backfill}
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 p-4 rounded-2xl border border-dashed border-emerald-500/40 text-xs font-bold text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-50 transition-colors cursor-pointer"
        >
          <Rocket className="w-4 h-4" />
          {saving ? 'Adding seed entries...' : `Backfill ${BUILD_CATALOG_SEED.length} September launch builds`}
        </button>
      )}

      {error && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-300">{error}</div>
      )}

      {(editing || form.title !== '' || form.summary !== '') && (
        <div className="rounded-2xl bg-slate-900/80 border border-slate-700 p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white">{editing ? 'Edit entry' : 'New entry'}</span>
            <button
              onClick={() => {
                setEditing(null);
                setForm({ ...EMPTY_FORM });
              }}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">Title</label>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Native bookings app"
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/60"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">Summary</label>
              <textarea
                value={form.summary}
                onChange={(e) => setForm({ ...form, summary: e.target.value })}
                rows={2}
                placeholder="What shipped and why it matters"
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/60"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">Build date</label>
              <input
                type="date"
                value={form.buildDate}
                onChange={(e) => setForm({ ...form, buildDate: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-emerald-500/60"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">Go live date</label>
              <input
                type="date"
                value={form.goLiveDate}
                onChange={(e) => setForm({ ...form, goLiveDate: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-emerald-500/60"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">Deploy commit</label>
              <input
                value={form.deployCommit || ''}
                onChange={(e) => setForm({ ...form, deployCommit: e.target.value })}
                placeholder="b55d723"
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white font-mono placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/60"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">Bundle name</label>
              <input
                value={form.bundleName || ''}
                onChange={(e) => setForm({ ...form, bundleName: e.target.value })}
                placeholder="assets/index-xxxx.js"
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white font-mono placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/60"
              />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">Tags</label>
            <div className="flex flex-wrap gap-1.5">
              {BUILD_CATALOG_TAGS.map((t) => (
                <button
                  key={t}
                  onClick={() => toggleTag(t)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-bold border transition-colors cursor-pointer ${
                    form.tags?.includes(t)
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'text-slate-500 border-slate-800 hover:text-slate-300'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 transition-colors cursor-pointer"
          >
            <Check className="w-4 h-4" />
            {saving ? 'Saving...' : editing ? 'Save changes' : 'Add to catalog'}
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-xs text-slate-500 py-6 text-center">Loading entries...</p>
      ) : (
        <div className="space-y-2">
          {entries.map((e) => (
            <div
              key={e.id}
              className="flex items-center gap-3 p-3 rounded-xl bg-slate-900/60 border border-slate-800"
            >
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-white truncate">{e.title}</p>
                <p className="text-[10px] text-slate-500 flex items-center gap-2 mt-0.5">
                  <span className="inline-flex items-center gap-1">
                    <CalendarDays className="w-3 h-3" />
                    Built {formatCatalogDate(e.buildDate)} · Live {formatCatalogDate(e.goLiveDate)}
                  </span>
                  {e.tags.slice(0, 3).map((t) => (
                    <span key={t} className="px-1.5 py-px rounded bg-slate-800 text-slate-400">
                      {t}
                    </span>
                  ))}
                </p>
              </div>
              <button
                onClick={() => startEdit(e)}
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                title="Edit"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => remove(e.id)}
                className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800 cursor-pointer"
                title="Delete"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          {entries.length === 0 && !loading && (
            <p className="text-xs text-slate-500 py-6 text-center">
              No entries yet. Run the backfill script or log the next deploy.
            </p>
          )}
        </div>
      )}
    </div>
  );
};
