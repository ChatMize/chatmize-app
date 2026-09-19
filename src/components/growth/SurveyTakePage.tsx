import React, { useState, useEffect } from 'react';
import { Loader2, CheckCircle2, Star, ChevronDown, Calendar } from 'lucide-react';
import {
  getPublicSurvey,
  submitSurveyResponse,
  PublicSurvey,
  PublicSurveyQuestion,
} from '../../lib/surveys';

interface SurveyTakePageProps {
  surveyId: string;
}

type AnswerValue = string | string[];

function QuestionInput({
  q,
  value,
  onChange,
}: {
  q: PublicSurveyQuestion;
  value: AnswerValue;
  onChange: (v: AnswerValue) => void;
}) {
  const str = Array.isArray(value) ? '' : (value as string);
  switch (q.type) {
    case 'multiple_choice':
      return (
        <div className="space-y-2">
          {q.options.map((opt) => (
            <label
              key={opt}
              className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                str === opt
                  ? 'border-cyan-400 bg-cyan-500/10'
                  : 'border-white/10 bg-white/5 hover:border-white/25'
              }`}
            >
              <input
                type="radio"
                name={q.id}
                checked={str === opt}
                onChange={() => onChange(opt)}
                className="accent-cyan-400"
              />
              <span className="text-sm text-white">{opt}</span>
            </label>
          ))}
        </div>
      );
    case 'checkboxes': {
      const arr = Array.isArray(value) ? value : [];
      const toggle = (opt: string) =>
        onChange(arr.includes(opt) ? arr.filter((o) => o !== opt) : [...arr, opt]);
      return (
        <div className="space-y-2">
          {q.options.map((opt) => (
            <label
              key={opt}
              className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                arr.includes(opt)
                  ? 'border-cyan-400 bg-cyan-500/10'
                  : 'border-white/10 bg-white/5 hover:border-white/25'
              }`}
            >
              <input
                type="checkbox"
                checked={arr.includes(opt)}
                onChange={() => toggle(opt)}
                className="accent-cyan-400"
              />
              <span className="text-sm text-white">{opt}</span>
            </label>
          ))}
        </div>
      );
    }
    case 'rating': {
      const max = q.scaleMax || 5;
      const n = Number(str) || 0;
      return (
        <div className="flex gap-2">
          {Array.from({ length: max }, (_, i) => i + 1).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => onChange(String(v))}
              className="p-1 transition-transform hover:scale-110"
              aria-label={`${v} star${v > 1 ? 's' : ''}`}
            >
              <Star
                className={`w-9 h-9 ${v <= n ? 'text-amber-400 fill-amber-400' : 'text-slate-600'}`}
              />
            </button>
          ))}
        </div>
      );
    }
    case 'nps': {
      const n = Number(str);
      return (
        <div>
          <div className="flex flex-wrap gap-1.5">
            {Array.from({ length: 11 }, (_, v) => (
              <button
                key={v}
                type="button"
                onClick={() => onChange(String(v))}
                className={`w-10 h-10 rounded-lg text-sm font-bold border transition-all ${
                  v === n
                    ? 'bg-cyan-500 border-cyan-400 text-slate-950'
                    : 'border-white/10 bg-white/5 text-slate-300 hover:border-white/30'
                }`}
              >
                {v}
              </button>
            ))}
          </div>
          <div className="flex justify-between text-[11px] text-slate-500 mt-1.5">
            <span>Not likely</span>
            <span>Very likely</span>
          </div>
        </div>
      );
    }
    case 'dropdown':
      return (
        <div className="relative">
          <select
            value={str}
            onChange={(e) => onChange(e.target.value)}
            className="w-full p-3 rounded-xl border border-white/10 bg-white/5 text-white text-sm appearance-none outline-none focus:border-cyan-400"
          >
            <option value="" className="bg-slate-900">Choose one...</option>
            {q.options.map((opt) => (
              <option key={opt} value={opt} className="bg-slate-900">
                {opt}
              </option>
            ))}
          </select>
          <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      );
    case 'long_text':
      return (
        <textarea
          value={str}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
          placeholder="Type your answer..."
          className="w-full p-3 rounded-xl border border-white/10 bg-white/5 text-white text-sm outline-none focus:border-cyan-400 placeholder:text-slate-500"
        />
      );
    case 'date':
      return (
        <div className="relative">
          <input
            type="date"
            value={str}
            onChange={(e) => onChange(e.target.value)}
            className="w-full p-3 rounded-xl border border-white/10 bg-white/5 text-white text-sm outline-none focus:border-cyan-400 [color-scheme:dark]"
          />
          <Calendar className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none hidden" />
        </div>
      );
    case 'short_text':
    default:
      return (
        <input
          type="text"
          value={str}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Type your answer..."
          className="w-full p-3 rounded-xl border border-white/10 bg-white/5 text-white text-sm outline-none focus:border-cyan-400 placeholder:text-slate-500"
        />
      );
  }
}

export const SurveyTakePage: React.FC<SurveyTakePageProps> = ({ surveyId }) => {
  const [survey, setSurvey] = useState<PublicSurvey | null>(null);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'missing' | 'closed'>('loading');
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [embed] = useState(() => {
    try {
      return new URLSearchParams(window.location.search).get('embed') === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const { survey: s, reason } = await getPublicSurvey(surveyId);
        if (!live) return;
        if (!s) {
          setLoadState(reason === 'closed' ? 'closed' : 'missing');
          return;
        }
        setSurvey(s);
        setLoadState('ready');
      } catch {
        if (live) setLoadState('missing');
      }
    })();
    return () => {
      live = false;
    };
  }, [surveyId]);

  const setAnswer = (id: string, v: AnswerValue) =>
    setAnswers((a) => ({ ...a, [id]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!survey || submitting) return;
    setFormError(null);
    for (const q of survey.questions) {
      if (!q.required) continue;
      const v = answers[q.id];
      const empty = v == null || (Array.isArray(v) ? v.length === 0 : !String(v).trim());
      if (empty) {
        setFormError(`Please answer: ${q.label}`);
        return;
      }
    }
    if (survey.collectEmail && !email.trim()) {
      setFormError('Please add your email so we can save your answers.');
      return;
    }
    if (survey.collectEmail && email && !/^\S+@\S+\.\S+$/.test(email.trim())) {
      setFormError('That email does not look valid.');
      return;
    }
    if (survey.collectPhone && !phone.trim()) {
      setFormError('Please add your phone number so we can save your answers.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await submitSurveyResponse(
        surveyId,
        Object.fromEntries(
          Object.entries(answers).filter(([, v]) =>
            v != null && (Array.isArray(v) ? v.length > 0 : String(v).trim())
          )
        ),
        { email: email.trim() || undefined, phone: phone.trim() || undefined }
      );
      setDone(res.thankYouMessage || 'Thanks for sharing your answers!');
      try {
        window.parent.postMessage({ type: 'chatmize:survey-completed', surveyId }, '*');
      } catch { /* not embedded */ }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not submit your answers.');
    } finally {
      setSubmitting(false);
    }
  };

  const shell = (inner: React.ReactNode) => (
    <div className={`min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex items-start justify-center ${embed ? 'p-3' : 'p-6 py-12'}`}>
      <div className={`w-full ${embed ? 'max-w-full' : 'max-w-xl'}`}>{inner}</div>
    </div>
  );

  if (loadState === 'loading') {
    return shell(
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
      </div>
    );
  }

  if (loadState === 'missing') {
    return shell(
      <div className="text-center py-24">
        <h1 className="text-xl font-bold text-white mb-2">Survey not found</h1>
        <p className="text-sm text-slate-400">This link may be old or the survey was removed.</p>
      </div>
    );
  }

  if (loadState === 'closed') {
    return shell(
      <div className="text-center py-24">
        <h1 className="text-xl font-bold text-white mb-2">This survey is closed</h1>
        <p className="text-sm text-slate-400">It is no longer accepting answers.</p>
      </div>
    );
  }

  if (done) {
    return shell(
      <div className="text-center py-16 bg-white/5 border border-white/10 rounded-2xl p-8">
        <CheckCircle2 className="w-14 h-14 text-emerald-400 mx-auto mb-4" />
        <h1 className="text-xl font-bold text-white mb-2">All done</h1>
        <p className="text-sm text-slate-300">{done}</p>
      </div>
    );
  }

  return shell(
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className={embed ? '' : 'bg-white/5 border border-white/10 rounded-2xl p-6'}>
        <h1 className="text-2xl font-extrabold text-white">{survey!.title}</h1>
        {survey!.description && (
          <p className="text-sm text-slate-400 mt-2">{survey!.description}</p>
        )}
      </div>

      {survey!.questions.map((q, i) => (
        <div key={q.id} className="bg-white/5 border border-white/10 rounded-2xl p-5">
          <div className="mb-3">
            <span className="text-xs font-mono text-cyan-300/70 mr-2">{i + 1}</span>
            <span className="text-[15px] font-bold text-white">
              {q.label}
              {q.required && <span className="text-rose-400 ml-1">*</span>}
            </span>
            {q.description && (
              <p className="text-xs text-slate-400 mt-1">{q.description}</p>
            )}
          </div>
          <QuestionInput q={q} value={answers[q.id] ?? ''} onChange={(v) => setAnswer(q.id, v)} />
        </div>
      ))}

      {(survey!.collectEmail || survey!.collectPhone) && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
          <p className="text-[15px] font-bold text-white mb-1">Where should we save your answers?</p>
          <p className="text-xs text-slate-400 mb-3">So your answers stay attached to you for a personal reply.</p>
          {survey!.collectEmail && (
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              autoComplete="email"
              className="w-full p-3 rounded-xl border border-white/10 bg-white/5 text-white text-sm outline-none focus:border-cyan-400 placeholder:text-slate-500 mb-2"
            />
          )}
          {survey!.collectPhone && (
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Phone number"
              autoComplete="tel"
              inputMode="tel"
              className="w-full p-3 rounded-xl border border-white/10 bg-white/5 text-white text-sm outline-none focus:border-cyan-400 placeholder:text-slate-500"
            />
          )}
        </div>
      )}

      {formError && (
        <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-sm font-semibold">
          {formError}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full p-4 rounded-xl bg-cyan-500 text-slate-950 font-extrabold text-base hover:bg-cyan-400 disabled:opacity-50 transition-colors"
      >
        {submitting ? (
          <span className="inline-flex items-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin" /> Submitting...
          </span>
        ) : (
          'Submit answers'
        )}
      </button>
    </form>
  );
};
