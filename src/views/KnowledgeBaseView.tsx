import { useCallback, useEffect, useState } from 'react';
import { BookOpen } from 'lucide-react';
import {
  KbArticle,
  archiveKbArticle,
  createKbArticle,
  deleteKbArticle,
  getKbArticle,
  listKbArticles,
} from '../lib/kb';
import { KbArticleList } from '../components/kb/KbArticleList';
import { KbStepEditor } from '../components/kb/KbStepEditor';
import { KbArticleNotFound, KbArticleViewer } from '../components/kb/KbArticleViewer';

/**
 * Knowledge Base owner section (Capture Tools > Knowledge Base).
 * Phase 1: builder MVP. Article list, step block editor, and viewer.
 */
export function KnowledgeBaseView({ workspaceId }: { workspaceId?: string }) {
  const [screen, setScreen] = useState<'list' | 'edit' | 'view'>('list');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [articles, setArticles] = useState<KbArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewArticle, setViewArticle] = useState<KbArticle | null>(null);
  const [viewMissing, setViewMissing] = useState(false);
  const [creating, setCreating] = useState(false);

  const refresh = useCallback(async () => {
    if (!workspaceId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setArticles(await listKbArticles(workspaceId));
    } catch {
      setArticles([]);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleNew = async () => {
    if (!workspaceId || creating) return;
    setCreating(true);
    try {
      const id = await createKbArticle(workspaceId, {
        title: 'Untitled article',
        category: 'Start here',
        tags: [],
      });
      setActiveId(id);
      setScreen('edit');
      refresh();
    } finally {
      setCreating(false);
    }
  };

  const handleView = async (id: string) => {
    if (!workspaceId) return;
    setViewMissing(false);
    setViewArticle(null);
    const a = await getKbArticle(workspaceId, id);
    if (!a) {
      setViewMissing(true);
    } else {
      setViewArticle(a);
    }
    setActiveId(id);
    setScreen('view');
  };

  const handleDelete = async (id: string) => {
    if (!workspaceId) return;
    const target = articles.find(a => a.id === id);
    if (!window.confirm(`Delete "${target?.title || 'this article'}"? This cannot be undone.`)) return;
    await deleteKbArticle(workspaceId, id);
    refresh();
  };

  const handleArchive = async (id: string) => {
    if (!workspaceId) return;
    await archiveKbArticle(workspaceId, id);
    refresh();
  };

  const goList = () => {
    setScreen('list');
    setActiveId(null);
    setViewArticle(null);
    setViewMissing(false);
    refresh();
  };

  return (
    <div className="flex-1 flex flex-col gap-6 max-w-6xl mx-auto w-full pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-white/10">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1 flex items-center gap-2.5">
            <BookOpen className="w-6 h-6 text-cyan-400" />
            Knowledge Base
          </h2>
          <p className="text-slate-400 text-sm">
            Write visual guides one step at a time. Each step can carry a screenshot and a tip, and every publish is snapshotted.
          </p>
        </div>
      </div>

      {!workspaceId ? (
        <p className="text-sm text-slate-400 text-center py-16">Select a workspace to manage its knowledge base.</p>
      ) : screen === 'edit' && activeId ? (
        <KbStepEditor
          workspaceId={workspaceId}
          articleId={activeId}
          onClose={goList}
          onPublished={refresh}
        />
      ) : screen === 'view' ? (
        viewMissing || !viewArticle ? (
          <KbArticleNotFound onBack={goList} />
        ) : (
          <KbArticleViewer article={viewArticle} workspaceId={workspaceId} onBack={goList} />
        )
      ) : (
        <KbArticleList
          articles={articles}
          loading={loading}
          onNew={handleNew}
          onEdit={id => {
            setActiveId(id);
            setScreen('edit');
          }}
          onView={handleView}
          onDelete={handleDelete}
          onArchive={handleArchive}
        />
      )}
    </div>
  );
}
