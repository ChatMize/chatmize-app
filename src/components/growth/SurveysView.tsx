import React, { useState, useEffect, useCallback } from 'react';
import {
  ClipboardList,
  Plus,
  Pencil,
  Trash2,
  BarChart3,
  Link2,
  Copy,
  Check,
  Eye,
  ChevronUp,
  ChevronDown,
  GripVertical,
  X,
  Loader2,
  Play,
  Pause,
  Archive,
  HelpCircle,
} from 'lucide-react';
import {
  Survey,
  SurveyQuestion,
  SurveyQuestionType,
  SURVEY_QUESTION_TYPES,
  SurveyResults,
  newSurvey,
  newSurveyQuestion,
} from '../../types/surveys';
import {
  fetchSurveys,
  saveSurvey,
  deleteSurvey,
  setSurveyStatus,
  fetchSurveyResults,
  surveyPageUrl,
} from '../../lib/surveys';
import { sanitizeVariableName, validateVariableName } from '../../lib/flowVariables';

interface SurveysViewProps {
  workspaceId?: string;
}

type Screen = { name: 'list' } | { name: 'build'; surveyId: string } | { name: 'results'; surveyId: string };

function QuestionEditor({
  q,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
  dragHandleProps,
}: {
  q: SurveyQuestion;
  onChange: (q: SurveyQuestion) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  dragHandleProps: React.HTMLAttributes<HTMLDivElement>;
}) {
  const needsOptions = q.type === 'multiple_choice' || q.type === 'checkboxes' || q.type === 'dropdown';
  const nameCheck = validateVariableName(q.variableName);
  const set = (patch: Partial<SurveyQuestion>) => onChange({ ...q, ...patch });

  return (
    <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <div {...dragHandleProps} className="cursor-grab text-slate-500 hover:text-slate-300 p-1" title="Drag to reorder">
          <GripVertical className="w-4 h-4" />
        </div>
        <select
          value={q.type}
          onChange={(e) => {
            const t = e.target.value as SurveyQuestionType;
            set({ type: t, options: t === 'multiple_choice' || t === 'checkboxes' || t === 'dropdown' ? (q.options?.length ? q.options : ['Option 1', 'Option 2']) : q.options, scaleMax: t === 'rating' ? (q.scaleMax || 5) : undefined });
          }}
          className="text-xs font-bold bg-slate-800 border border-white/10 rounded-lg px-2 py-1.5 text-white outline-none"
        >
          {SURVEY_QUESTION_TYPES.map((t) => (
            <option key={t.v} value={t.v}>{t.label}</option>
          ))}
        </select>
        <div className="flex-1" />
        <button type="button" onClick={onMoveUp} className="p-1.5 text-slate-400 hover:text-white" title="Move up">
          <ChevronUp className="w-4 h-4" />
        </button>
        <button type="button" onClick={onMoveDown} className="p-1.5 text-slate-400 hover:text-white" title="Move down">
          <ChevronDown className="w-4 h-4" />
        </button>
        <button type="button" onClick={onRemove} className="p-1.5 text-rose-400 hover:text-rose-300" title="Remove question">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <input
        value={q.label}
        onChange={(e) => set({ label: e.target.value })}
        placeholder="Ask something..."
        className="w-full p-2.5 rounded-xl border border-white/10 bg-white/5 text-white text-sm outline-none focus:border-cyan-400 placeholder:text-slate-500"
      />
      <input
        value={q.description || ''}
        onChange={(e) => set({ description: e.target.value })}
        placeholder="Helper text (optional)"
        className="w-full p-2.5 rounded-xl border border-white/10 bg-white/5 text-white text-sm outline-none focus:border-cyan-400 placeholder:text-slate-500"
      />

      {needsOptions && (
        <div className="space-y-1.5">
          {(q.options || []).map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                value={opt}
                onChange={(e) => {
                  const next = [...(q.options || [])];
                  next[i] = e.target.value;
                  set({ options: next });
                }}
                placeholder={`Option ${i + 1}`}
                className="flex-1 p-2 rounded-lg border border-white/10 bg-white/5 text-white text-sm outline-none focus:border-cyan-400 placeholder:text-slate-500"
              />
              <button
                type="button"
                onClick={() => set({ options: (q.options || []).filter((_, j) => j !== i) })}
                className="p-1.5 text-slate-500 hover:text-rose-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => set({ options: [...(q.options || []), `Option ${(q.options || []).length + 1}`] })}
            className="text-xs text-cyan-300 hover:text-cyan-200 font-semibold"
          >
            + Add option
          </button>
        </div>
      )}

      {q.type === 'rating' && (
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span>Scale:</span>
          <select
            value={q.scaleMax || 5}
            onChange={(e) => set({ scaleMax: Number(e.target.value) })}
            className="bg-slate-800 border border-white/10 rounded-lg px-2 py-1 text-white outline-none"
          >
            {[3, 4, 5, 7, 10].map((n) => (
              <option key={n} value={n}>1 to {n}</option>
            ))}
          </select>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[11px] font-bold text-slate-400">Saves into variable</label>
          <input
            value={q.variableName}
            onChange={(e) => set({ variableName: sanitizeVariableName(e.target.value) })}
            placeholder="e.g. favorite_color"
            className={`w-full mt-1 p-2 rounded-lg border bg-white/5 text-white text-sm font-mono outline-none placeholder:text-slate-500 ${
              nameCheck.ok ? 'border-white/10 focus:border-cyan-400' : 'border-rose-500/60'
            }`}
          />
          {!nameCheck.ok && q.variableName && (
            <p className="text-[11px] text-rose-300 mt-1">{nameCheck.error}</p>
          )}
          {nameCheck.ok && (
            <p className="text-[11px] text-slate-500 mt-1">Use as {`{{${nameCheck.name}}}`} in BotMaps</p>
          )}
        </div>
        <div className="flex items-end pb-1">
          <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={q.required}
              onChange={(e) => set({ required: e.target.checked })}
              className="accent-cyan-400 w-4 h-4"
            />
            Required
          </label>
        </div>
      </div>
    </div>
  );
}

function BuilderScreen({
  survey,
  onChange,
  onSave,
  onBack,
  saving,
  saveError,
}: {
  survey: Survey;
  onChange: (s: Survey) => void;
  onSave: () => void;
  onBack: () => void;
  saving: boolean;
  saveError: string | null;
}) {
  const [dragId, setDragId] = useState<string | null>(null);
  const set = (patch: Partial<Survey>) => onChange({ ...survey, ...patch });

  const moveQuestion = (from: number, to: number) => {
    if (to < 0 || to >= survey.questions.length) return;
    const next = [...survey.questions];
    const [q] = next.splice(from, 1);
    next.splice(to, 0, q);
    set({ questions: next });
  };

  const updateQuestion = (id: string, q: SurveyQuestion) =>
    set({ questions: survey.questions.map((x) => (x.id === id ? q : x)) });

  const addQuestion = (t: SurveyQuestionType) =>
    set({ questions: [...survey.questions, newSurveyQuestion(t)] });

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-sm text-slate-400 hover:text-white font-semibold">
          ← Back
        </button>
        <div className="flex-1" />
        <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${
          survey.status === 'active' ? 'bg-emerald-500/20 text-emerald-300' :
          survey.status === 'closed' ? 'bg-slate-500/20 text-slate-400' :
          'bg-amber-500/20 text-amber-300'
        }`}>
          {survey.status.toUpperCase()}
        </span>
        <button
          onClick={onSave}
          disabled={saving}
          className="px-5 py-2 rounded-xl bg-cyan-500 text-slate-950 text-sm font-extrabold hover:bg-cyan-400 disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin inline" /> : 'Save survey'}
        </button>
      </div>

      {saveError && (
        <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-sm font-semibold">
          {saveError}
        </div>
      )}

      <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-3">
        <input
          value={survey.title}
          onChange={(e) => set({ title: e.target.value })}
          placeholder="Survey title"
          className="w-full text-xl font-extrabold bg-transparent text-white outline-none placeholder:text-slate-500"
        />
        <textarea
          value={survey.description || ''}
          onChange={(e) => set({ description: e.target.value })}
          placeholder="Short description shown under the title (optional)"
          rows={2}
          className="w-full p-2.5 rounded-xl border border-white/10 bg-white/5 text-white text-sm outline-none focus:border-cyan-400 placeholder:text-slate-500"
        />
      </div>

      <div className="space-y-3" onDragOver={(e) => e.preventDefault()}>
        {survey.questions.map((q, i) => (
          <div
            key={q.id}
            draggable={false}
            onDragOver={(e) => {
              e.preventDefault();
              if (dragId && dragId !== q.id) {
                const from = survey.questions.findIndex((x) => x.id === dragId);
                moveQuestion(from, i);
              }
            }}
            onDragEnd={() => setDragId(null)}
          >
            <QuestionEditor
              q={q}
              onChange={(nq) => updateQuestion(q.id, nq)}
              onRemove={() => set({ questions: survey.questions.filter((x) => x.id !== q.id) })}
              onMoveUp={() => moveQuestion(i, i - 1)}
              onMoveDown={() => moveQuestion(i, i + 1)}
              dragHandleProps={{
                draggable: true,
                onDragStart: (e) => {
                  setDragId(q.id);
                  e.dataTransfer.effectAllowed = 'move';
                },
              }}
            />
          </div>
        ))}
      </div>

      <div className="bg-white/5 border border-dashed border-white/15 rounded-2xl p-4">
        <p className="text-xs font-bold text-slate-400 mb-2">ADD A QUESTION</p>
        <div className="flex flex-wrap gap-2">
          {SURVEY_QUESTION_TYPES.map((t) => (
            <button
              key={t.v}
              onClick={() => addQuestion(t.v)}
              title={t.hint}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white border border-white/10"
            >
              + {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-3">
        <p className="text-sm font-bold text-white">Finish screen</p>
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
            <input type="checkbox" checked={survey.collectEmail} onChange={(e) => set({ collectEmail: e.target.checked })} className="accent-cyan-400 w-4 h-4" />
            Ask for email (attaches answers to a contact)
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
            <input type="checkbox" checked={survey.collectPhone} onChange={(e) => set({ collectPhone: e.target.checked })} className="accent-cyan-400 w-4 h-4" />
            Ask for phone number too
          </label>
        </div>
        <div>
          <label className="text-[11px] font-bold text-slate-400">Thank you message</label>
          <input
            value={survey.thankYouMessage}
            onChange={(e) => set({ thankYouMessage: e.target.value })}
            className="w-full mt-1 p-2.5 rounded-xl border border-white/10 bg-white/5 text-white text-sm outline-none focus:border-cyan-400"
          />
        </div>
      </div>
    </div>
  );
}

function ResultsScreen({ workspaceId, surveyId, onBack }: { workspaceId: string; surveyId: string; onBack: () => void }) {
  const [results, setResults] = useState<SurveyResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setLoading(true);
    fetchSurveyResults(workspaceId, surveyId)
      .then((r) => { if (live) { setResults(r); setLoading(false); } })
      .catch((e) => { if (live) { setError(e instanceof Error ? e.message : 'Could not load results.'); setLoading(false); } });
    return () => { live = false; };
  }, [workspaceId, surveyId]);

  if (loading) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="w-8 h-8 text-cyan-400 animate-spin" /></div>;
  }
  if (error || !results) {
    return <div className="p-4 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-sm">{error || 'No results.'}</div>;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-sm text-slate-400 hover:text-white font-semibold">← Back</button>
        <h2 className="text-lg font-extrabold text-white flex-1">{results.survey.title}</h2>
        <span className="text-xs font-bold text-slate-400">{results.totalResponses} responses</span>
      </div>

      {results.aggregates.map((a) => (
        <div key={a.questionId} className="bg-white/5 border border-white/10 rounded-2xl p-5">
          <p className="text-sm font-bold text-white mb-3">{a.label}</p>
          {a.optionCounts && (
            <div className="space-y-2">
              {Object.entries(a.optionCounts).map(([opt, n]) => {
                const total = Math.max(1, a.responseCount);
                return (
                  <div key={opt}>
                    <div className="flex justify-between text-xs text-slate-300 mb-1">
                      <span>{opt}</span>
                      <span className="font-bold">{n} ({Math.round((n / total) * 100)}%)</span>
                    </div>
                    <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                      <div className="h-full bg-cyan-400 rounded-full" style={{ width: `${Math.round((n / total) * 100)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {a.average != null && (
            <div className="flex items-center gap-3">
              <span className="text-3xl font-extrabold text-cyan-300">{a.average}</span>
              <span className="text-xs text-slate-400">average from {a.responseCount} answers</span>
            </div>
          )}
          {a.samples && a.samples.length > 0 && (
            <ul className="space-y-1.5">
              {a.samples.map((s, i) => (
                <li key={i} className="text-xs text-slate-300 bg-white/5 border border-white/10 rounded-lg p-2">{s}</li>
              ))}
            </ul>
          )}
          {a.responseCount === 0 && (
            <p className="text-xs text-slate-500">No answers yet.</p>
          )}
        </div>
      ))}

      <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
        <p className="text-sm font-bold text-white mb-3">Latest responses</p>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {results.responses.slice(0, 50).map((r) => (
            <div key={r.id} className="text-xs bg-slate-900/60 border border-white/10 rounded-xl p-3">
              <div className="flex justify-between text-slate-400 mb-1.5">
                <span>{r.email || r.phone || 'Anonymous'}</span>
                <span>{new Date(r.completedAt).toLocaleString()}</span>
              </div>
              <div className="space-y-1">
                {r.answers.map((ans) => (
                  <div key={ans.questionId} className="flex gap-2">
                    <span className="text-slate-500 font-mono">{ans.variableName}:</span>
                    <span className="text-slate-200">{Array.isArray(ans.value) ? ans.value.join(', ') : ans.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {results.responses.length === 0 && (
            <p className="text-xs text-slate-500">No responses yet. Share the link to start collecting.</p>
          )}
        </div>
      </div>
    </div>
  );
}

export const SurveysView: React.FC<SurveysViewProps> = ({ workspaceId }) => {
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);
  const [screen, setScreen] = useState<Screen>({ name: 'list' });
  const [editing, setEditing] = useState<Survey | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!workspaceId) { setLoading(false); return; }
    setLoading(true);
    fetchSurveys(workspaceId)
      .then((s) => { setSurveys(s); setLoading(false); })
      .catch(() => setLoading(false));
  }, [workspaceId]);

  useEffect(() => { load(); }, [load]);

  const startNew = () => {
    if (!workspaceId) return;
    const s = newSurvey(workspaceId);
    setEditing(s);
    setSaveError(null);
    setScreen({ name: 'build', surveyId: s.id });
  };

  const startEdit = (s: Survey) => {
    setEditing(JSON.parse(JSON.stringify(s)));
    setSaveError(null);
    setScreen({ name: 'build', surveyId: s.id });
  };

  const handleSave = async () => {
    if (!workspaceId || !editing || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      const saved = await saveSurvey(workspaceId, editing);
      setSurveys((prev) => {
        const i = prev.findIndex((s) => s.id === saved.id);
        if (i >= 0) { const next = [...prev]; next[i] = saved; return next; }
        return [saved, ...prev];
      });
      setScreen({ name: 'list' });
      setEditing(null);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Could not save the survey.');
    } finally {
      setSaving(false);
    }
  };

  const handleStatus = async (s: Survey, status: 'draft' | 'active' | 'closed') => {
    if (!workspaceId) return;
    try {
      await setSurveyStatus(workspaceId, s.id, status);
      setSurveys((prev) => prev.map((x) => (x.id === s.id ? { ...x, status } : x)));
    } catch { /* keep silent, list will refresh */ }
  };

  const handleDelete = async (id: string) => {
    if (!workspaceId) return;
    try {
      await deleteSurvey(workspaceId, id);
      setSurveys((prev) => prev.filter((s) => s.id !== id));
      setConfirmDelete(null);
    } catch { setConfirmDelete(null); }
  };

  const copyLink = async (id: string) => {
    try {
      await navigator.clipboard.writeText(surveyPageUrl(id));
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch { /* clipboard unavailable */ }
  };

  if (!workspaceId) {
    return <p className="text-sm text-slate-400">Select a workspace to build surveys.</p>;
  }

  if (screen.name === 'build' && editing) {
    return (
      <BuilderScreen
        survey={editing}
        onChange={setEditing}
        onSave={handleSave}
        onBack={() => { setScreen({ name: 'list' }); setEditing(null); }}
        saving={saving}
        saveError={saveError}
      />
    );
  }

  if (screen.name === 'results') {
    return <ResultsScreen workspaceId={workspaceId} surveyId={screen.surveyId} onBack={() => setScreen({ name: 'list' })} />;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center">
          <ClipboardList className="w-5 h-5 text-cyan-300" />
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-extrabold text-white">Surveys</h2>
          <p className="text-xs text-slate-400">Ask questions anywhere: share a link, drop one in a popup or slide in, and every answer lands in a contact variable BotMaps can use.</p>
        </div>
        <button
          onClick={startNew}
          className="px-4 py-2 rounded-xl bg-cyan-500 text-slate-950 text-sm font-extrabold hover:bg-cyan-400 flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" /> New survey
        </button>
      </div>

      <div className="flex items-start gap-2 p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/25 text-xs text-cyan-200">
        <HelpCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <span>New here? Build a survey, set it to Active, then share the link or embed it in a popup or slide in from Website Overlays. Answers save into the contact variables you name, so BotMaps flows can personalize on them.</span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24"><Loader2 className="w-8 h-8 text-cyan-400 animate-spin" /></div>
      ) : surveys.length === 0 ? (
        <div className="text-center py-16 bg-white/5 border border-dashed border-white/15 rounded-2xl">
          <ClipboardList className="w-10 h-10 text-slate-500 mx-auto mb-3" />
          <p className="text-sm font-bold text-white mb-1">No surveys yet</p>
          <p className="text-xs text-slate-400 mb-4">Create your first survey and start collecting answers in minutes.</p>
          <button onClick={startNew} className="px-4 py-2 rounded-xl bg-cyan-500 text-slate-950 text-sm font-extrabold hover:bg-cyan-400">
            Create a survey
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {surveys.map((s) => (
            <div key={s.id} className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-3">
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-extrabold text-white truncate">{s.title}</h3>
                  <p className="text-[11px] text-slate-400">{s.questions.length} questions · {s.counters?.responses ?? 0} responses</p>
                </div>
                <span className={`text-[10px] font-bold px-2 py-1 rounded-full flex-shrink-0 ${
                  s.status === 'active' ? 'bg-emerald-500/20 text-emerald-300' :
                  s.status === 'closed' ? 'bg-slate-500/20 text-slate-400' :
                  'bg-amber-500/20 text-amber-300'
                }`}>
                  {s.status.toUpperCase()}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button onClick={() => startEdit(s)} className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-bold text-white flex items-center gap-1">
                  <Pencil className="w-3 h-3" /> Edit
                </button>
                <button onClick={() => setScreen({ name: 'results', surveyId: s.id })} className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-bold text-white flex items-center gap-1">
                  <BarChart3 className="w-3 h-3" /> Results
                </button>
                <button onClick={() => copyLink(s.id)} className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-bold text-white flex items-center gap-1">
                  {copiedId === s.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Link2 className="w-3 h-3" />} {copiedId === s.id ? 'Copied' : 'Copy link'}
                </button>
                <a href={surveyPageUrl(s.id)} target="_blank" rel="noopener noreferrer" className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-bold text-white flex items-center gap-1">
                  <Eye className="w-3 h-3" /> Preview
                </a>
                {s.status !== 'active' ? (
                  <button onClick={() => handleStatus(s, 'active')} className="px-2.5 py-1.5 rounded-lg bg-emerald-600/30 hover:bg-emerald-600/50 text-[11px] font-bold text-emerald-200 flex items-center gap-1">
                    <Play className="w-3 h-3" /> Activate
                  </button>
                ) : (
                  <button onClick={() => handleStatus(s, 'closed')} className="px-2.5 py-1.5 rounded-lg bg-slate-700/50 hover:bg-slate-700 text-[11px] font-bold text-slate-300 flex items-center gap-1">
                    <Pause className="w-3 h-3" /> Close
                  </button>
                )}
                {s.status === 'closed' && (
                  <button onClick={() => handleStatus(s, 'draft')} className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-bold text-white flex items-center gap-1">
                    <Archive className="w-3 h-3" /> Reopen
                  </button>
                )}
                {confirmDelete === s.id ? (
                  <>
                    <button onClick={() => handleDelete(s.id)} className="px-2.5 py-1.5 rounded-lg bg-rose-600 text-[11px] font-bold text-white">
                      Confirm delete
                    </button>
                    <button onClick={() => setConfirmDelete(null)} className="px-2.5 py-1.5 rounded-lg bg-slate-800 text-[11px] font-bold text-white">
                      Keep
                    </button>
                  </>
                ) : (
                  <button onClick={() => setConfirmDelete(s.id)} className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-bold text-rose-300 flex items-center gap-1">
                    <Trash2 className="w-3 h-3" /> Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
