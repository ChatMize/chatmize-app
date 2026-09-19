import { useMemo, useState } from 'react';
import { EMOJI_CATEGORIES } from './emojiData';

// The picker panel itself. Loaded lazily via React.lazy so the emoji data and
// this UI never ship in the initial page bundle.
export default function EmojiPickerPanel({ onPick }: { onPick: (emoji: string) => void }) {
  const [query, setQuery] = useState('');
  const [activeCat, setActiveCat] = useState(EMOJI_CATEGORIES[0].id);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    const out: { e: string; n: string }[] = [];
    for (const cat of EMOJI_CATEGORIES) {
      for (const em of cat.emojis) {
        if (em.n.toLowerCase().includes(q) || em.k.toLowerCase().includes(q)) {
          out.push(em);
          if (out.length >= 60) return out;
        }
      }
    }
    return out;
  }, [query]);

  const active = EMOJI_CATEGORIES.find((c) => c.id === activeCat) ?? EMOJI_CATEGORIES[0];

  return (
    <div
      data-emoji-panel
      className="w-[320px] max-w-[calc(100vw-3rem)] rounded-2xl border border-white/15 bg-slate-900 shadow-2xl shadow-black/60 overflow-hidden"
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="p-2 border-b border-white/10">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search emoji"
          autoFocus
          className="w-full px-3 py-1.5 rounded-xl bg-slate-950 border border-white/10 text-xs text-white placeholder-slate-500 outline-none focus:border-cyan-500/60"
        />
      </div>

      {results ? (
        <div className="p-2 max-h-[240px] overflow-y-auto">
          {results.length === 0 ? (
            <p className="text-[11px] text-slate-500 text-center py-6">No emoji found</p>
          ) : (
            <div className="grid grid-cols-8 gap-0.5">
              {results.map((em) => (
                <button
                  key={em.e}
                  type="button"
                  title={em.n}
                  onClick={() => onPick(em.e)}
                  className="text-xl p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer leading-none"
                >
                  {em.e}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="flex items-center gap-0.5 px-2 pt-2">
            {EMOJI_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                title={cat.label}
                onClick={() => setActiveCat(cat.id)}
                className={`flex-1 text-base p-1 rounded-lg transition-colors cursor-pointer leading-none ${
                  activeCat === cat.id ? 'bg-cyan-500/20' : 'hover:bg-white/10 opacity-60 hover:opacity-100'
                }`}
              >
                {cat.icon}
              </button>
            ))}
          </div>
          <div className="p-2 max-h-[240px] overflow-y-auto">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-1.5 pb-1">{active.label}</p>
            <div className="grid grid-cols-8 gap-0.5">
              {active.emojis.map((em) => (
                <button
                  key={em.e}
                  type="button"
                  title={em.n}
                  onClick={() => onPick(em.e)}
                  className="text-xl p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer leading-none"
                >
                  {em.e}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
