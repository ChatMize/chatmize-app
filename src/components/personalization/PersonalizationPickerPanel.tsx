import { useMemo, useState } from 'react';
import { PERSONALIZATION_TAGS, tagSyntax } from './personalizationTags';

interface Props {
  onPick: (tagText: string) => void;
}

/**
 * Lazy-loaded personalization panel: searchable list of merge tags with
 * human readable labels. Picking one inserts the {{tag}} text at the cursor.
 */
export default function PersonalizationPickerPanel({ onPick }: Props) {
  const [query, setQuery] = useState('');

  const tags = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return PERSONALIZATION_TAGS;
    return PERSONALIZATION_TAGS.filter(
      (t) =>
        t.label.toLowerCase().includes(q) ||
        t.tag.toLowerCase().includes(q) ||
        t.hint.toLowerCase().includes(q)
    );
  }, [query]);

  return (
    <div
      data-personalization-panel
      className="w-[300px] max-w-[calc(100vw-3rem)] rounded-2xl border border-white/15 bg-slate-900 shadow-2xl shadow-black/60 overflow-hidden"
    >
      <div className="p-2.5 border-b border-white/10">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search tags..."
          autoFocus
          className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
        />
      </div>
      <div className="max-h-[280px] overflow-y-auto p-1.5">
        {tags.map((t) => (
          <button
            key={t.tag}
            type="button"
            onClick={() => onPick(tagSyntax(t.tag))}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left hover:bg-white/10 transition-colors cursor-pointer"
          >
            <span className="shrink-0 font-mono text-[11px] text-cyan-300 bg-cyan-500/10 border border-cyan-500/20 rounded-md px-1.5 py-0.5">
              {tagSyntax(t.tag)}
            </span>
            <span className="min-w-0">
              <span className="block text-xs font-semibold text-white truncate">{t.label}</span>
              <span className="block text-[10px] text-slate-500 truncate">{t.hint}</span>
            </span>
          </button>
        ))}
        {tags.length === 0 && (
          <div className="p-4 text-center text-[11px] text-slate-500">No tags match.</div>
        )}
      </div>
      <div className="px-3 py-2 border-t border-white/10 text-[10px] text-slate-500 leading-snug">
        Empty fields send as blank. Custom contact fields also work: type them as {'{{field_name}}'}.
      </div>
    </div>
  );
}
