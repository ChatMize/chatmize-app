import { useMemo, useState } from 'react';
import { AlertTriangle, Archive, Eye, FileText, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { KbArticle, kbHelpfulness } from '../../lib/kb';

export type KbStatusFilter = 'all' | 'draft' | 'published' | 'archived';

const STATUS_STYLE: Record<string, string> = {
  draft: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
  published: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  archived: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
};

function HelpfulnessCell({ article }: { article: KbArticle }) {
  const score = kbHelpfulness(article);
  if (score === null) {
    return <span className="text-slate-600 text-xs">No votes yet</span>;
  }
  const color = score >= 70 ? 'text-emerald-300' : score >= 40 ? 'text-amber-300' : 'text-rose-300';
  return (
    <span className={`text-xs font-bold ${color}`}>
      {score}% <span className="text-slate-500 font-normal">({article.helpfulYes + article.helpfulNo})</span>
    </span>
  );
}

export function KbArticleList({
  articles,
  loading,
  onNew,
  onEdit,
  onView,
  onDelete,
  onArchive,
}: {
  articles: KbArticle[];
  loading: boolean;
  onNew: () => void;
  onEdit: (id: string) => void;
  onView: (id: string) => void;
  onDelete: (id: string) => void;
  onArchive: (id: string) => void;
}) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<KbStatusFilter>('all');
  const [needsReviewOnly, setNeedsReviewOnly] = useState(false);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return articles.filter(a => {
      if (statusFilter !== 'all' && a.status !== statusFilter) return false;
      if (needsReviewOnly && !a.needsReview) return false;
      if (!q) return true;
      return (
        a.title.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q) ||
        a.tags.some(t => t.toLowerCase().includes(q)) ||
        a.steps.some(s => s.title.toLowerCase().includes(q) || s.body.toLowerCase().includes(q))
      );
    });
  }, [articles, search, statusFilter, needsReviewOnly]);

  const needsReviewCount = articles.filter(a => a.needsReview).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search articles, steps, tags..."
            className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 outline-none focus:border-cyan-500"
          />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {(['all', 'draft', 'published', 'archived'] as KbStatusFilter[]).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize cursor-pointer transition-all ${
                statusFilter === s
                  ? 'bg-cyan-500 text-slate-950'
                  : 'bg-white/5 text-slate-400 hover:text-white border border-white/10'
              }`}
            >
              {s === 'all' ? 'All' : s}
            </button>
          ))}
          <button
            onClick={() => setNeedsReviewOnly(v => !v)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center gap-1.5 ${
              needsReviewOnly
                ? 'bg-amber-500 text-slate-950'
                : 'bg-white/5 text-slate-400 hover:text-white border border-white/10'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            Needs review{needsReviewCount > 0 ? ` (${needsReviewCount})` : ''}
          </button>
        </div>
        <button
          onClick={onNew}
          className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-sm font-bold flex items-center gap-2 hover:opacity-90 cursor-pointer whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          New article
        </button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map(i => (
            <div key={i} className="h-16 rounded-2xl bg-white/5 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center text-center py-16 px-6 bg-white/[0.02] border border-white/10 rounded-2xl">
          <FileText className="w-10 h-10 text-slate-600 mb-3" />
          <p className="text-sm font-bold text-white">No articles found</p>
          <p className="text-xs text-slate-400 mt-1 max-w-xs">
            {articles.length === 0
              ? 'Write your first guide with the step by step builder. Each step can carry its own screenshot and a tip.'
              : 'Try a different search or clear the filters.'}
          </p>
          {articles.length === 0 && (
            <button
              onClick={onNew}
              className="mt-4 px-4 py-2 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-sm font-bold hover:bg-cyan-500/25 cursor-pointer"
            >
              Create your first article
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white/[0.03] border border-white/10 rounded-2xl overflow-hidden">
          <div className="hidden md:grid grid-cols-[1fr_110px_110px_90px_150px] gap-3 px-4 py-2.5 border-b border-white/10 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            <span>Article</span>
            <span>Status</span>
            <span>Helpfulness</span>
            <span>Views</span>
            <span className="text-right">Actions</span>
          </div>
          {filtered.map(article => (
            <div
              key={article.id}
              className="grid grid-cols-1 md:grid-cols-[1fr_110px_110px_90px_150px] gap-2 md:gap-3 px-4 py-3 border-b border-white/5 last:border-0 hover:bg-white/[0.02] items-center"
            >
              <div className="min-w-0">
                <button onClick={() => onView(article.id)} className="text-left cursor-pointer group">
                  <p className="text-sm font-bold text-white truncate group-hover:text-cyan-300">{article.title}</p>
                  <p className="text-[11px] text-slate-500 truncate">
                    {article.category} · {article.steps.length} {article.steps.length === 1 ? 'step' : 'steps'}
                  </p>
                </button>
                {article.needsReview && (
                  <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                    <AlertTriangle className="w-3 h-3" />
                    Needs review
                  </span>
                )}
              </div>
              <div>
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${STATUS_STYLE[article.status]}`}>
                  {article.status}
                </span>
              </div>
              <HelpfulnessCell article={article} />
              <span className="text-xs text-slate-400 font-mono">{article.viewCount}</span>
              <div className="flex items-center md:justify-end gap-1">
                <button
                  onClick={() => onView(article.id)}
                  title="Preview"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
                >
                  <Eye className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onEdit(article.id)}
                  title="Edit"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                {article.status !== 'archived' && (
                  <button
                    onClick={() => onArchive(article.id)}
                    title="Archive"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-amber-300 hover:bg-white/10 cursor-pointer"
                  >
                    <Archive className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => onDelete(article.id)}
                  title="Delete"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-300 hover:bg-white/10 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
