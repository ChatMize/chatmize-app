import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, ArrowRight, Rocket } from 'lucide-react';
import {
  BuildCatalogEntry,
  fetchBuildCatalogEntries,
  countUnread,
  markCatalogSeen,
  formatCatalogDate,
} from '../../lib/buildCatalog';

interface BuildCatalogBellProps {
  onOpenCatalog: () => void;
}

/**
 * Build catalog bell. Sits next to the notifications bell in the top nav.
 * Every deploy lands here as a message. Clicking an entry opens the catalog.
 */
export const BuildCatalogBell: React.FC<BuildCatalogBellProps> = ({ onOpenCatalog }) => {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<BuildCatalogEntry[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    fetchBuildCatalogEntries(8).then((list) => {
      if (!alive) return;
      setEntries(list);
      setUnread(countUnread(list));
      setLoading(false);
    });
    const t = setInterval(() => {
      fetchBuildCatalogEntries(8).then((list) => {
        if (!alive) return;
        setEntries(list);
        setUnread(countUnread(list));
      });
    }, 5 * 60 * 1000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const openCatalog = () => {
    markCatalogSeen(entries[0] || null);
    setUnread(0);
    setOpen(false);
    onOpenCatalog();
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-900 border border-slate-800 transition-colors cursor-pointer relative"
        title="What is new in ChatMize"
      >
        <Sparkles className="w-4 h-4" />
        {unread > 0 && (
          <span className="absolute top-1.5 right-1.5 min-w-[8px] h-2 px-0.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50 flex items-center justify-center">
            <span className="text-[7px] font-bold text-slate-950 leading-none">{unread > 9 ? '9+' : unread}</span>
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[calc(100vw-2rem)] max-w-xs sm:w-96 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl shadow-slate-950 p-3 z-50 animate-in fade-in zoom-in-95">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800 mb-2">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <Rocket className="w-3.5 h-3.5 text-emerald-400" />
              Freshly built in ChatMize
            </span>
            <button
              onClick={openCatalog}
              className="text-[10px] text-cyan-400 font-semibold hover:text-cyan-300 cursor-pointer"
            >
              View all
            </button>
          </div>

          {loading ? (
            <p className="text-[11px] text-slate-500 py-4 text-center">Loading builds...</p>
          ) : entries.length === 0 ? (
            <p className="text-[11px] text-slate-500 py-4 text-center">
              No builds logged yet. New releases will show up here.
            </p>
          ) : (
            <div className="space-y-2 text-xs max-h-80 overflow-y-auto">
              {entries.map((e) => (
                <button
                  key={e.id}
                  onClick={openCatalog}
                  className="w-full text-left p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/50 hover:border-emerald-500/40 hover:bg-slate-800 transition-all cursor-pointer"
                >
                  <p className="font-semibold text-slate-200 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                    {e.title}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">{e.summary}</p>
                  <span className="text-[9px] text-slate-500 mt-1 block">
                    Live {formatCatalogDate(e.goLiveDate || e.buildDate)}
                  </span>
                </button>
              ))}
            </div>
          )}

          <button
            onClick={openCatalog}
            className="mt-2 w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-bold text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors cursor-pointer"
          >
            Open the build catalog
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
