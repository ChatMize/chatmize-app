import { useEffect, useMemo, useState } from 'react';
import { BookOpen, Loader2, Search } from 'lucide-react';
import { KbArticle, listKbArticles } from '../../lib/kb';
import { KbArticleNotFound, KbArticleViewer } from './KbArticleViewer';

/**
 * The in app help center. Replaces the old hardcoded integration guide
 * browser in Settings: articles come from the workspace knowledge base, and
 * a bad article id renders a real "not found" state instead of silently
 * falling back to another guide.
 */
export function KbHelpCenter({
  workspaceId,
  initialSearch,
}: {
  workspaceId?: string;
  initialSearch?: string;
}) {
  const [articles, setArticles] = useState<KbArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState(initialSearch || '');
  const [category, setCategory] = useState('all');

  useEffect(() => {
    setSearch(initialSearch || '');
  }, [initialSearch]);

  useEffect(() => {
    if (!workspaceId) {
      setLoading(false);
      return;
    }
    let live = true;
    setLoading(true);
    listKbArticles(workspaceId)
      .then(all => {
        if (!live) return;
        setArticles(all.filter(a => a.status === 'published'));
        setLoading(false);
      })
      .catch(() => {
        if (!live) return;
        setArticles([]);
        setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [workspaceId]);

  const categories = useMemo(() => {
    const set = new Map<string, number>();
    articles.forEach(a => set.set(a.category, (set.get(a.category) || 0) + 1));
    return [...set.entries()].sort((a, b) => b[1] - a[1]);
  }, [articles]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return articles.filter(a => {
      if (category !== 'all' && a.category !== category) return false;
      if (!q) return true;
      return (
        a.title.toLowerCase().includes(q) ||
        a.tags.some(t => t.toLowerCase().includes(q)) ||
        a.steps.some(s => s.title.toLowerCase().includes(q) || s.body.toLowerCase().includes(q))
      );
    });
  }, [articles, search, category]);

  const selected = selectedId ? articles.find(a => a.id === selectedId || a.slug === selectedId) || null : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
      </div>
    );
  }

  if (!workspaceId) {
    return (
      <div className="text-center py-24">
        <p className="text-sm text-slate-400">Select a workspace to browse its knowledge base.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
      <div className="md:col-span-4 bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-4 flex flex-col gap-3">
        <div className="pb-3 border-b border-white/10 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-bold text-white">Knowledge Base</h3>
            </div>
            <span className="text-[10px] font-mono text-cyan-300 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded-full font-bold">
              {articles.length} {articles.length === 1 ? 'Guide' : 'Guides'}
            </span>
          </div>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search guides..."
              className="w-full pl-8 pr-2.5 py-1.5 bg-slate-900 border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 outline-none focus:border-cyan-500"
            />
          </div>
          <div className="flex flex-wrap gap-1 pt-1">
            <button
              onClick={() => setCategory('all')}
              className={`px-2 py-1 rounded-lg text-[10px] font-bold cursor-pointer ${
                category === 'all' ? 'bg-cyan-500 text-slate-950' : 'bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/5'
              }`}
            >
              All
            </button>
            {categories.map(([name, count]) => (
              <button
                key={name}
                onClick={() => setCategory(name)}
                className={`px-2 py-1 rounded-lg text-[10px] font-bold cursor-pointer ${
                  category === name ? 'bg-cyan-500 text-slate-950' : 'bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/5'
                }`}
              >
                {name} ({count})
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1 max-h-[620px] overflow-y-auto pr-1" style={{ scrollbarWidth: 'none' }}>
          {filtered.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-8 px-4">
              {articles.length === 0
                ? 'No published guides yet. Create them in the Knowledge Base builder.'
                : 'No guides match your search.'}
            </p>
          ) : (
            filtered.map(a => (
              <button
                key={a.id}
                onClick={() => setSelectedId(a.id)}
                className={`w-full text-left p-2.5 rounded-xl transition-all cursor-pointer ${
                  selectedId === a.id
                    ? 'bg-gradient-to-r from-cyan-500/20 to-blue-600/20 border border-cyan-500/30 text-white'
                    : 'hover:bg-white/5 text-slate-300 border border-transparent'
                }`}
              >
                <p className="text-xs font-bold truncate">{a.title}</p>
                <p className="text-[10px] text-slate-500 truncate">
                  {a.category} · {a.steps.length} {a.steps.length === 1 ? 'step' : 'steps'}
                </p>
              </button>
            ))
          )}
        </div>
      </div>

      <div className="md:col-span-8 bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl min-h-[420px] max-h-[720px] overflow-hidden flex flex-col">
        {selectedId === null ? (
          <div className="flex flex-col items-center justify-center text-center py-20 px-6 flex-1">
            <BookOpen className="w-10 h-10 text-slate-600 mb-3" />
            <p className="text-sm font-bold text-white">Pick a guide to start reading</p>
            <p className="text-xs text-slate-400 mt-1 max-w-xs">
              Visual guides with screenshots walk you through each setup one step at a time.
            </p>
          </div>
        ) : selected ? (
          <KbArticleViewer
            article={selected}
            workspaceId={workspaceId}
            onBack={() => setSelectedId(null)}
          />
        ) : (
          <KbArticleNotFound
            onBack={() => setSelectedId(null)}
            searchHint="This guide link is broken or the article was unpublished. Pick another guide from the list."
          />
        )}
      </div>
    </div>
  );
}
