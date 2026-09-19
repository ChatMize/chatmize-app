import React, { useState, useEffect, useMemo } from 'react';
import { Rocket, CalendarDays, GitCommit, Package, Tag, ArrowLeft } from 'lucide-react';
import {
  BuildCatalogEntry,
  BUILD_CATALOG_TAGS,
  fetchBuildCatalogEntries,
  formatCatalogDate,
  markCatalogSeen,
} from '../lib/buildCatalog';

interface BuildCatalogViewProps {
  onBack?: () => void;
}

const TAG_LABELS: Record<string, string> = {
  botmaps: 'Bot Maps',
  growth: 'Growth Tools',
  integrations: 'Integrations',
  channels: 'Channels',
  billing: 'Billing',
  analytics: 'Analytics',
  support: 'Support Suite',
  platform: 'Platform',
};

export const BuildCatalogView: React.FC<BuildCatalogViewProps> = ({ onBack }) => {
  const [entries, setEntries] = useState<BuildCatalogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTag, setActiveTag] = useState<string>('all');

  useEffect(() => {
    fetchBuildCatalogEntries(200).then((list) => {
      setEntries(list);
      setLoading(false);
      markCatalogSeen(list[0] || null);
    });
  }, []);

  const filtered = useMemo(
    () => (activeTag === 'all' ? entries : entries.filter((e) => e.tags.includes(activeTag))),
    [entries, activeTag]
  );

  const tagsInUse = useMemo(() => {
    const s = new Set<string>();
    entries.forEach((e) => e.tags.forEach((t) => s.add(t)));
    return [...BUILD_CATALOG_TAGS].filter((t) => s.has(t));
  }, [entries]);

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        {onBack && (
          <button
            onClick={onBack}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-900 border border-slate-800 transition-colors cursor-pointer"
            title="Back"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        )}
        <div className="p-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
          <Rocket className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Build Catalog</h1>
          <p className="text-xs text-slate-400">
            Every feature we ship, with the date it was built and the date it went live.
          </p>
        </div>
      </div>

      {tagsInUse.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveTag('all')}
            className={`px-3 py-1.5 rounded-full text-[11px] font-bold border transition-colors cursor-pointer ${
              activeTag === 'all'
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                : 'text-slate-400 border-slate-800 hover:text-white hover:border-slate-700'
            }`}
          >
            All builds
          </button>
          {tagsInUse.map((t) => (
            <button
              key={t}
              onClick={() => setActiveTag(t)}
              className={`px-3 py-1.5 rounded-full text-[11px] font-bold border transition-colors cursor-pointer ${
                activeTag === t
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : 'text-slate-400 border-slate-800 hover:text-white hover:border-slate-700'
              }`}
            >
              {TAG_LABELS[t] || t}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-slate-500 py-10 text-center">Loading the build catalog...</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-3xl bg-slate-900/60 border border-slate-800 p-10 text-center">
          <Rocket className="w-8 h-8 text-slate-600 mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-300">No builds logged yet</p>
          <p className="text-xs text-slate-500 mt-1">
            New releases will appear here the moment they go live.
          </p>
        </div>
      ) : (
        <div className="relative">
          <div className="absolute left-[19px] top-2 bottom-2 w-px bg-slate-800" />
          <div className="space-y-4">
            {filtered.map((e) => (
              <div key={e.id} className="relative pl-12">
                <div className="absolute left-3 top-5 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-slate-950 shadow-sm shadow-emerald-400/40" />
                <div className="rounded-2xl bg-slate-900/70 border border-slate-800 p-4 sm:p-5 hover:border-emerald-500/30 transition-colors">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h2 className="text-sm sm:text-base font-bold text-white">{e.title}</h2>
                    {e.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {e.tags.map((t) => (
                          <span
                            key={t}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-[10px] font-semibold text-slate-300"
                          >
                            <Tag className="w-2.5 h-2.5" />
                            {TAG_LABELS[t] || t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  {e.summary && <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">{e.summary}</p>}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3 text-[11px] text-slate-500">
                    {e.buildDate && (
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarDays className="w-3.5 h-3.5 text-slate-600" />
                        Built {formatCatalogDate(e.buildDate)}
                      </span>
                    )}
                    {e.goLiveDate && (
                      <span className="inline-flex items-center gap-1.5">
                        <Rocket className="w-3.5 h-3.5 text-emerald-500" />
                        Live {formatCatalogDate(e.goLiveDate)}
                      </span>
                    )}
                    {e.deployCommit && (
                      <span className="inline-flex items-center gap-1.5 font-mono">
                        <GitCommit className="w-3.5 h-3.5 text-slate-600" />
                        {e.deployCommit.slice(0, 7)}
                      </span>
                    )}
                    {e.bundleName && (
                      <span className="inline-flex items-center gap-1.5 font-mono truncate max-w-[220px]">
                        <Package className="w-3.5 h-3.5 text-slate-600" />
                        {e.bundleName}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
