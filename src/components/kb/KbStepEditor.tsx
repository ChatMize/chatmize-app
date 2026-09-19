import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Eye,
  GripVertical,
  Image as ImageIcon,
  Lightbulb,
  Loader2,
  Plus,
  Save,
  Send,
  Trash2,
  Undo2,
  X,
} from 'lucide-react';
import {
  KB_CATEGORIES,
  KbArticle,
  KbStep,
  getKbArticle,
  newKbStep,
  publishKbArticleFn,
  saveKbArticle,
  unpublishKbArticleFn,
  uploadKbImage,
} from '../../lib/kb';
import { KbImage } from './KbImage';
import { KbArticleViewer } from './KbArticleViewer';

function StepImageField({
  workspaceId,
  articleId,
  stepId,
  imagePath,
  onChange,
}: {
  workspaceId: string;
  articleId: string;
  stepId: string;
  imagePath?: string;
  onChange: (path?: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startUpload = async (file: File) => {
    setError(null);
    setUploading(true);
    try {
      const path = await uploadKbImage(workspaceId, articleId, stepId, file);
      onChange(path);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed. Try a different image.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        className="hidden"
        onChange={e => {
          const f = e.target.files?.[0];
          if (f) startUpload(f);
          e.target.value = '';
        }}
      />
      {imagePath ? (
        <div className="relative group rounded-xl overflow-hidden border border-white/10">
          <KbImage path={imagePath} alt="Step illustration" className="w-full max-h-56 object-cover" />
          <button
            onClick={() => onChange(undefined)}
            title="Remove image"
            className="absolute top-2 right-2 p-1.5 rounded-lg bg-slate-950/80 text-slate-300 hover:text-rose-300 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => fileRef.current?.click()}
          onDragOver={e => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => {
            e.preventDefault();
            setDragging(false);
            const f = e.dataTransfer.files?.[0];
            if (f) startUpload(f);
          }}
          className={`w-full p-4 rounded-xl border border-dashed text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-all ${
            dragging
              ? 'border-cyan-400 bg-cyan-500/10 text-cyan-300'
              : 'border-white/15 bg-white/[0.02] text-slate-400 hover:text-slate-200 hover:border-white/25'
          }`}
        >
          {uploading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <ImageIcon className="w-4 h-4" />
          )}
          {uploading ? 'Uploading and compressing...' : 'Add a screenshot: click to browse or drop a file here'}
        </button>
      )}
      {error && <p className="text-xs text-rose-300 mt-1.5">{error}</p>}
    </div>
  );
}

export function KbStepEditor({
  workspaceId,
  articleId,
  onClose,
  onPublished,
}: {
  workspaceId: string;
  articleId: string;
  onClose: () => void;
  onPublished: () => void;
}) {
  const [article, setArticle] = useState<KbArticle | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [confirmPublish, setConfirmPublish] = useState(false);
  const [publishNote, setPublishNote] = useState('');
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishDone, setPublishDone] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [tagsDraft, setTagsDraft] = useState('');
  const [customCategory, setCustomCategory] = useState(false);
  const dragStepId = useRef<string | null>(null);

  useEffect(() => {
    let live = true;
    setLoading(true);
    getKbArticle(workspaceId, articleId)
      .then(a => {
        if (!live) return;
        if (!a) {
          setLoadError('This article could not be found.');
        } else {
          setArticle(a);
          setTagsDraft(a.tags.join(', '));
          setCustomCategory(!KB_CATEGORIES.includes(a.category));
        }
        setLoading(false);
      })
      .catch(() => {
        if (!live) return;
        setLoadError('Could not load this article. Check your connection and try again.');
        setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [workspaceId, articleId]);

  const touch = (next: KbArticle) => {
    setArticle(next);
    setDirty(true);
    setPublishDone(false);
  };

  const updateStep = (stepId: string, patch: Partial<KbStep>) => {
    if (!article) return;
    touch({
      ...article,
      steps: article.steps.map(s => (s.id === stepId ? { ...s, ...patch } : s)),
    });
  };

  const addStep = (afterId?: string) => {
    if (!article) return;
    const steps = [...article.steps];
    const insertAt = afterId ? steps.findIndex(s => s.id === afterId) + 1 : steps.length;
    steps.splice(insertAt, 0, newKbStep(insertAt));
    touch({ ...article, steps: steps.map((s, i) => ({ ...s, order: i })) });
  };

  const duplicateStep = (stepId: string) => {
    if (!article) return;
    const idx = article.steps.findIndex(s => s.id === stepId);
    if (idx < 0) return;
    const src = article.steps[idx];
    const copy: KbStep = {
      ...src,
      id: `step_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      title: src.title ? `${src.title} (copy)` : '',
    };
    const steps = [...article.steps];
    steps.splice(idx + 1, 0, copy);
    touch({ ...article, steps: steps.map((s, i) => ({ ...s, order: i })) });
  };

  const removeStep = (stepId: string) => {
    if (!article || article.steps.length <= 1) return;
    touch({
      ...article,
      steps: article.steps.filter(s => s.id !== stepId).map((s, i) => ({ ...s, order: i })),
    });
  };

  const moveStep = (stepId: string, dir: -1 | 1) => {
    if (!article) return;
    const idx = article.steps.findIndex(s => s.id === stepId);
    const swap = idx + dir;
    if (idx < 0 || swap < 0 || swap >= article.steps.length) return;
    const steps = [...article.steps];
    [steps[idx], steps[swap]] = [steps[swap], steps[idx]];
    touch({ ...article, steps: steps.map((s, i) => ({ ...s, order: i })) });
  };

  const handleDrop = (targetId: string) => {
    if (!article || !dragStepId.current || dragStepId.current === targetId) return;
    const from = article.steps.findIndex(s => s.id === dragStepId.current);
    const to = article.steps.findIndex(s => s.id === targetId);
    if (from < 0 || to < 0) return;
    const steps = [...article.steps];
    const [moved] = steps.splice(from, 1);
    steps.splice(to, 0, moved);
    touch({ ...article, steps: steps.map((s, i) => ({ ...s, order: i })) });
    dragStepId.current = null;
  };

  const handleSave = async (): Promise<boolean> => {
    if (!article) return false;
    setSaving(true);
    try {
      const tags = tagsDraft
        .split(',')
        .map(t => t.trim())
        .filter(Boolean)
        .slice(0, 12);
      const next = { ...article, tags };
      await saveKbArticle(workspaceId, next);
      setArticle(next);
      setDirty(false);
      return true;
    } catch {
      setPublishError('Could not save the draft. Check your connection and try again.');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    setPublishError(null);
    if (!article) return;
    if (!article.title.trim()) {
      setPublishError('Give the article a title before publishing.');
      return;
    }
    if (article.steps.length === 0 || article.steps.every(s => !s.title.trim() && !s.body.trim())) {
      setPublishError('Add at least one step with content before publishing.');
      return;
    }
    const saved = await handleSave();
    if (!saved) return;
    setPublishing(true);
    try {
      await publishKbArticleFn(workspaceId, article.id, publishNote.trim() || undefined);
      setPublishDone(true);
      setConfirmPublish(false);
      setPublishNote('');
      const fresh = await getKbArticle(workspaceId, article.id);
      if (fresh) {
        setArticle(fresh);
        setDirty(false);
      }
      onPublished();
    } catch (e) {
      setPublishError(e instanceof Error ? e.message : 'Publishing failed. Try again.');
    } finally {
      setPublishing(false);
    }
  };

  const handleUnpublish = async () => {
    if (!article) return;
    setPublishing(true);
    try {
      await unpublishKbArticleFn(workspaceId, article.id);
      const fresh = await getKbArticle(workspaceId, article.id);
      if (fresh) setArticle(fresh);
      onPublished();
    } catch {
      setPublishError('Could not unpublish. Try again.');
    } finally {
      setPublishing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
      </div>
    );
  }

  if (loadError || !article) {
    return (
      <div className="text-center py-24">
        <p className="text-sm text-slate-300 font-semibold">{loadError || 'Article not found.'}</p>
        <button
          onClick={onClose}
          className="mt-4 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm font-semibold text-slate-200 cursor-pointer"
        >
          Back to articles
        </button>
      </div>
    );
  }

  if (previewing) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Preview: how readers will see this guide
          </p>
          <button
            onClick={() => setPreviewing(false)}
            className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-sm font-semibold text-slate-200 cursor-pointer"
          >
            Back to editing
          </button>
        </div>
        <div className="bg-white/[0.02] border border-white/10 rounded-2xl overflow-hidden max-h-[70vh]">
          <KbArticleViewer article={article} allowFeedback={false} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Articles
        </button>
        <div className="flex-1" />
        {dirty && (
          <span className="text-[11px] font-bold text-amber-300 bg-amber-500/10 border border-amber-500/25 px-2.5 py-1 rounded-full">
            Unsaved changes
          </span>
        )}
        <span
          className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${
            article.status === 'published'
              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
              : 'bg-slate-500/15 text-slate-300 border-slate-500/30'
          }`}
        >
          {article.status}
        </span>
        <button
          onClick={() => setPreviewing(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-slate-200 cursor-pointer"
        >
          <Eye className="w-4 h-4" />
          Preview
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-slate-200 disabled:opacity-50 cursor-pointer"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save draft
        </button>
        {article.status === 'published' ? (
          <button
            onClick={handleUnpublish}
            disabled={publishing}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-xs font-bold text-amber-300 disabled:opacity-50 cursor-pointer"
          >
            <Undo2 className="w-4 h-4" />
            Unpublish
          </button>
        ) : (
          <button
            onClick={() => setConfirmPublish(true)}
            disabled={publishing}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-xs font-bold hover:opacity-90 disabled:opacity-50 cursor-pointer"
          >
            {publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Publish
          </button>
        )}
      </div>

      {(publishError) && (
        <p className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/25 rounded-xl px-3.5 py-2.5">
          {publishError}
        </p>
      )}
      {publishDone && (
        <p className="text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/25 rounded-xl px-3.5 py-2.5 flex items-center gap-2">
          <Check className="w-4 h-4" />
          Published. A revision snapshot was saved so you can always see exactly what went live.
        </p>
      )}

      {/* Article meta */}
      <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5 space-y-4">
        <div>
          <label className="text-xs font-bold text-slate-300 block mb-1.5">Article title</label>
          <input
            type="text"
            value={article.title}
            onChange={e => touch({ ...article, title: e.target.value })}
            placeholder="What will this guide teach?"
            className="w-full px-3.5 py-2.5 bg-slate-900 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 outline-none focus:border-cyan-500"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-slate-300 block mb-1.5">Category</label>
            {customCategory ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={article.category}
                  onChange={e => touch({ ...article, category: e.target.value })}
                  placeholder="Custom category"
                  className="flex-1 px-3.5 py-2.5 bg-slate-900 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 outline-none focus:border-cyan-500"
                />
                <button
                  onClick={() => {
                    setCustomCategory(false);
                    touch({ ...article, category: KB_CATEGORIES[0] });
                  }}
                  className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-semibold text-slate-300 cursor-pointer"
                >
                  Presets
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <select
                  value={article.category}
                  onChange={e => touch({ ...article, category: e.target.value })}
                  className="flex-1 px-3.5 py-2.5 bg-slate-900 border border-white/10 rounded-xl text-sm text-white outline-none focus:border-cyan-500"
                >
                  {KB_CATEGORIES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <button
                  onClick={() => {
                    setCustomCategory(true);
                    touch({ ...article, category: '' });
                  }}
                  className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-semibold text-slate-300 cursor-pointer"
                >
                  Custom
                </button>
              </div>
            )}
          </div>
          <div>
            <label className="text-xs font-bold text-slate-300 block mb-1.5">Tags (comma separated)</label>
            <input
              type="text"
              value={tagsDraft}
              onChange={e => {
                setTagsDraft(e.target.value);
                setDirty(true);
              }}
              placeholder="instagram, onboarding, setup"
              className="w-full px-3.5 py-2.5 bg-slate-900 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 outline-none focus:border-cyan-500"
            />
          </div>
        </div>
        <div>
          <label className="text-xs font-bold text-slate-300 block mb-1.5">Cover image (optional)</label>
          <StepImageField
            workspaceId={workspaceId}
            articleId={article.id}
            stepId="cover"
            imagePath={article.coverImagePath || undefined}
            onChange={path => touch({ ...article, coverImagePath: path || '' })}
          />
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white">
            Steps <span className="text-slate-500 font-normal">({article.steps.length})</span>
          </h3>
          <p className="text-[11px] text-slate-500">Drag the handle to reorder</p>
        </div>

        {article.steps.map((step, i) => (
          <div
            key={step.id}
            draggable
            onDragStart={() => {
              dragStepId.current = step.id;
            }}
            onDragOver={e => e.preventDefault()}
            onDrop={() => handleDrop(step.id)}
            className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 space-y-3"
          >
            <div className="flex items-center gap-2">
              <span
                className="cursor-grab active:cursor-grabbing text-slate-500 hover:text-slate-300 p-1"
                title="Drag to reorder"
              >
                <GripVertical className="w-4 h-4" />
              </span>
              <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-xs font-extrabold text-white flex-shrink-0">
                {i + 1}
              </span>
              <input
                type="text"
                value={step.title}
                onChange={e => updateStep(step.id, { title: e.target.value })}
                placeholder={`Step ${i + 1} title`}
                className="flex-1 min-w-0 px-3 py-2 bg-slate-900 border border-white/10 rounded-xl text-sm font-semibold text-white placeholder-slate-500 outline-none focus:border-cyan-500"
              />
              <div className="flex items-center gap-0.5 flex-shrink-0">
                <button
                  onClick={() => moveStep(step.id, -1)}
                  disabled={i === 0}
                  title="Move up"
                  className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/10 disabled:opacity-30 cursor-pointer"
                >
                  <ChevronUp className="w-4 h-4" />
                </button>
                <button
                  onClick={() => moveStep(step.id, 1)}
                  disabled={i === article.steps.length - 1}
                  title="Move down"
                  className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/10 disabled:opacity-30 cursor-pointer"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
                <button
                  onClick={() => duplicateStep(step.id)}
                  title="Duplicate step"
                  className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/10 cursor-pointer"
                >
                  <Copy className="w-4 h-4" />
                </button>
                <button
                  onClick={() => addStep(step.id)}
                  title="Add step below"
                  className="p-1.5 rounded-lg text-slate-500 hover:text-cyan-300 hover:bg-white/10 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                </button>
                <button
                  onClick={() => removeStep(step.id)}
                  disabled={article.steps.length <= 1}
                  title="Delete step"
                  className="p-1.5 rounded-lg text-slate-500 hover:text-rose-300 hover:bg-white/10 disabled:opacity-30 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <textarea
              value={step.body}
              onChange={e => updateStep(step.id, { body: e.target.value })}
              placeholder="Explain this step in plain words. Short paragraphs read best."
              rows={3}
              className="w-full px-3 py-2 bg-slate-900 border border-white/10 rounded-xl text-sm text-slate-200 placeholder-slate-500 outline-none focus:border-cyan-500 resize-y"
            />

            <StepImageField
              workspaceId={workspaceId}
              articleId={article.id}
              stepId={step.id}
              imagePath={step.imagePath}
              onChange={path => updateStep(step.id, { imagePath: path })}
            />

            <div className="flex gap-2.5 items-start p-3 rounded-xl bg-amber-500/[0.06] border border-amber-500/20">
              <Lightbulb className="w-4 h-4 text-amber-400 flex-shrink-0 mt-2" />
              <input
                type="text"
                value={step.tip || ''}
                onChange={e => updateStep(step.id, { tip: e.target.value })}
                placeholder="Optional tip callout, e.g. where to find this setting"
                className="flex-1 bg-transparent text-sm text-amber-100/90 placeholder-amber-200/30 outline-none py-1"
              />
              {step.tip && (
                <button
                  onClick={() => updateStep(step.id, { tip: '' })}
                  className="text-amber-200/40 hover:text-amber-200 cursor-pointer mt-1"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        ))}

        <button
          onClick={() => addStep()}
          className="w-full p-3.5 rounded-2xl border border-dashed border-white/15 text-sm font-bold text-slate-400 hover:text-cyan-300 hover:border-cyan-500/40 flex items-center justify-center gap-2 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Add step
        </button>
      </div>

      {/* Publish confirm */}
      {confirmPublish && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-white/10 rounded-2xl p-6 space-y-4">
            <h3 className="text-base font-bold text-white">Publish this article?</h3>
            <p className="text-sm text-slate-400">
              It becomes visible to readers right away. A full revision snapshot is saved at publish time, so the exact published version is always on record.
            </p>
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1.5">Publish note (optional)</label>
              <input
                type="text"
                value={publishNote}
                onChange={e => setPublishNote(e.target.value)}
                placeholder="What changed in this version?"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 outline-none focus:border-cyan-500"
              />
            </div>
            {publishError && <p className="text-xs text-rose-300">{publishError}</p>}
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setConfirmPublish(false);
                  setPublishError(null);
                }}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-sm font-semibold text-slate-200 cursor-pointer"
              >
                Keep editing
              </button>
              <button
                onClick={handlePublish}
                disabled={publishing}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-sm font-bold hover:opacity-90 disabled:opacity-50 cursor-pointer flex items-center gap-2"
              >
                {publishing && <Loader2 className="w-4 h-4 animate-spin" />}
                Publish now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
