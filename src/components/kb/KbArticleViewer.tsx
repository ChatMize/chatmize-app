import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, BookOpen, Check, Lightbulb, ThumbsDown, ThumbsUp } from 'lucide-react';
import { KbArticle, kbFeedbackFn } from '../../lib/kb';
import { KbImage } from './KbImage';

/** Shown when an article id or slug does not resolve. Never falls back to another article. */
export function KbArticleNotFound({ onBack, searchHint }: { onBack?: () => void; searchHint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-20 px-6">
      <div className="w-14 h-14 rounded-2xl bg-slate-800/80 border border-white/10 flex items-center justify-center mb-4">
        <BookOpen className="w-7 h-7 text-slate-500" />
      </div>
      <h3 className="text-lg font-bold text-white mb-1">Article not found</h3>
      <p className="text-sm text-slate-400 max-w-sm">
        {searchHint || 'This guide does not exist or is no longer published. Try searching the knowledge base for what you need.'}
      </p>
      {onBack && (
        <button
          onClick={onBack}
          className="mt-5 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-sm font-semibold text-slate-200 flex items-center gap-2 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to articles
        </button>
      )}
    </div>
  );
}

function StepTip({ text }: { text: string }) {
  return (
    <div className="flex gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/25">
      <Lightbulb className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
      <div>
        <p className="text-xs font-bold text-amber-300 uppercase tracking-wider mb-1">Tip</p>
        <p className="text-sm text-amber-100/90 leading-relaxed whitespace-pre-wrap">{text}</p>
      </div>
    </div>
  );
}

export function KbArticleViewer({
  article,
  workspaceId,
  onBack,
  allowFeedback = true,
}: {
  article: KbArticle;
  workspaceId?: string;
  onBack?: () => void;
  allowFeedback?: boolean;
}) {
  const [vote, setVote] = useState<'yes' | 'no' | null>(null);
  const [progress, setProgress] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const viewCounted = useRef(false);

  useEffect(() => {
    setVote(null);
    setProgress(0);
    viewCounted.current = false;
    scrollRef.current?.scrollTo({ top: 0 });
  }, [article.id]);

  useEffect(() => {
    if (!workspaceId || viewCounted.current || article.status !== 'published') return;
    viewCounted.current = true;
    kbFeedbackFn(workspaceId, article.id, 'view').catch(() => {
      // Views are best effort; a failed count never blocks reading.
    });
  }, [workspaceId, article.id, article.status]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const max = el.scrollHeight - el.clientHeight;
    setProgress(max > 0 ? Math.min(100, Math.round((el.scrollTop / max) * 100)) : 0);
  };

  const castVote = async (kind: 'yes' | 'no') => {
    if (vote || !workspaceId) return;
    setVote(kind);
    try {
      await kbFeedbackFn(workspaceId, article.id, kind);
    } catch {
      // Vote failed; keep the local state so the UI stays honest.
    }
  };

  const showProgress = article.steps.length >= 4;

  return (
    <div className="flex flex-col h-full min-h-0">
      {showProgress && (
        <div className="h-1 bg-white/5 rounded-full overflow-hidden flex-shrink-0">
          <div
            className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto min-h-0">
        <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">
          {onBack && (
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to articles
            </button>
          )}

          <div>
            <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 text-[10px] font-bold uppercase tracking-wider">
              {article.category}
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold text-white mt-3">{article.title}</h1>
            {article.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {article.tags.map(tag => (
                  <span key={tag} className="text-[11px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-slate-400">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {article.coverImagePath && (
            <KbImage path={article.coverImagePath} alt={article.title} className="w-full rounded-2xl border border-white/10" />
          )}

          <ol className="space-y-8">
            {article.steps.map((step, i) => (
              <li key={step.id} className="flex gap-4">
                <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-sm font-extrabold text-white shadow-md shadow-blue-500/20">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0 space-y-3">
                  {step.title && <h2 className="text-lg font-bold text-white">{step.title}</h2>}
                  {step.body && (
                    <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{step.body}</p>
                  )}
                  {step.imagePath && (
                    <KbImage
                      path={step.imagePath}
                      alt={step.title || `Step ${i + 1}`}
                      className="w-full rounded-xl border border-white/10"
                    />
                  )}
                  {step.tip && <StepTip text={step.tip} />}
                </div>
              </li>
            ))}
          </ol>

          {allowFeedback && article.status === 'published' && (
            <div className="pt-6 border-t border-white/10">
              {vote ? (
                <p className="text-sm text-slate-300 flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400" />
                  Thanks for the feedback. It helps us keep these guides useful.
                </p>
              ) : (
                <div className="flex items-center gap-3">
                  <p className="text-sm font-semibold text-slate-300">Was this helpful?</p>
                  <button
                    onClick={() => castVote('yes')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-emerald-500/20 border border-white/10 hover:border-emerald-500/40 text-xs font-bold text-slate-300 hover:text-emerald-300 cursor-pointer"
                  >
                    <ThumbsUp className="w-3.5 h-3.5" />
                    Yes
                  </button>
                  <button
                    onClick={() => castVote('no')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-rose-500/20 border border-white/10 hover:border-rose-500/40 text-xs font-bold text-slate-300 hover:text-rose-300 cursor-pointer"
                  >
                    <ThumbsDown className="w-3.5 h-3.5" />
                    No
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
