import React, { useState, useEffect } from 'react';
import { KanbanCard, KanbanQaStatus } from '../../types/workspace';
import { 
  Bot, 
  X, 
  Check, 
  ClipboardCheck, 
  AlertCircle, 
  RotateCcw, 
  Clock, 
  CheckCircle2, 
  MessageSquareCode,
  Sparkles,
  Trash2
} from 'lucide-react';

interface CardQaNoteModalProps {
  card: KanbanCard | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (cardId: string, qaNotes: string, qaStatus: KanbanQaStatus) => void;
}

export const CardQaNoteModal: React.FC<CardQaNoteModalProps> = ({
  card,
  isOpen,
  onClose,
  onSave
}) => {
  const [qaNotes, setQaNotes] = useState('');
  const [qaStatus, setQaStatus] = useState<KanbanQaStatus>('ready_for_ai');

  useEffect(() => {
    if (card) {
      setQaNotes(card.qaNotes || '');
      setQaStatus(card.qaStatus || 'ready_for_ai');
    }
  }, [card]);

  if (!isOpen || !card) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(card.id, qaNotes.trim(), qaStatus);
    onClose();
  };

  const handleClearNote = () => {
    setQaNotes('');
  };

  const handleAddTemplate = (prefix: string) => {
    setQaNotes(prev => {
      const trimmed = prev.trim();
      if (!trimmed) return `${prefix}: `;
      return `${trimmed}\n\n${prefix}: `;
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-hidden">
      <div className="bg-slate-900 border border-violet-500/40 rounded-2xl max-w-xl w-full max-h-[92vh] flex flex-col shadow-2xl text-xs text-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Sticky Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-5 sm:px-6 py-3.5 border-b border-slate-800 bg-slate-900/95 backdrop-blur-sm z-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-violet-500/20 flex-shrink-0">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-white">Directives &amp; QA Note for AI Agent</h3>
                <span className="text-[10px] px-2 py-0.5 rounded bg-violet-500/20 text-violet-300 font-semibold border border-violet-500/30">
                  User ↔ AI Pipeline
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5 truncate max-w-xs sm:max-w-md">
                Target card: <strong className="text-slate-200 font-semibold">{card.title}</strong>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          {/* Scrollable Body */}
          <div className="flex-1 min-h-0 overflow-y-auto px-5 sm:px-6 py-4 space-y-4">
            {/* Status Selector */}
            <div>
              <label className="block font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <ClipboardCheck className="w-3.5 h-3.5 text-violet-400" />
                  QA &amp; AI Workflow Status
                </span>
                {card.qaUpdatedAt && (
                  <span className="text-[10px] text-slate-500 flex items-center gap-1 font-mono">
                    <Clock className="w-3 h-3" /> Last updated: {card.qaUpdatedAt}
                  </span>
                )}
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setQaStatus('ready_for_ai')}
                  className={`px-3 py-2 rounded-xl text-left border flex items-center gap-2 transition-all cursor-pointer ${
                    qaStatus === 'ready_for_ai'
                    ? 'bg-violet-500/20 border-violet-500 text-violet-200 shadow-md shadow-violet-500/10'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-900'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
                <div>
                  <div className="font-bold text-[11px]">Ready for AI</div>
                  <div className="text-[9px] text-slate-500">AI picks up &amp; implements</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setQaStatus('revisions_requested')}
                className={`px-3 py-2 rounded-xl text-left border flex items-center gap-2 transition-all cursor-pointer ${
                  qaStatus === 'revisions_requested'
                    ? 'bg-rose-500/20 border-rose-500 text-rose-200 shadow-md shadow-rose-500/10'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-900'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-rose-400" />
                <div>
                  <div className="font-bold text-[11px]">Revisions Needed</div>
                  <div className="text-[9px] text-slate-500">QA found issues/adjustments</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setQaStatus('in_qa_review')}
                className={`px-3 py-2 rounded-xl text-left border flex items-center gap-2 transition-all cursor-pointer ${
                  qaStatus === 'in_qa_review'
                    ? 'bg-amber-500/20 border-amber-500 text-amber-200 shadow-md shadow-amber-500/10'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-900'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                <div>
                  <div className="font-bold text-[11px]">In QA Review</div>
                  <div className="text-[9px] text-slate-500">User is validating features</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setQaStatus('qa_approved')}
                className={`px-3 py-2 rounded-xl text-left border flex items-center gap-2 transition-all cursor-pointer ${
                  qaStatus === 'qa_approved'
                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-200 shadow-md shadow-emerald-500/10'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-900'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <div>
                  <div className="font-bold text-[11px]">QA Approved</div>
                  <div className="text-[9px] text-slate-500">Passes all requirements</div>
                </div>
              </button>
            </div>
          </div>

          {/* Note Area */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-slate-300 flex items-center gap-1.5">
                <MessageSquareCode className="w-3.5 h-3.5 text-indigo-400" />
                Note / Directives for the AI Agent
              </label>
              {qaNotes && (
                <button
                  type="button"
                  onClick={handleClearNote}
                  className="text-[10px] text-slate-500 hover:text-rose-400 flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <Trash2 className="w-3 h-3" /> Clear note
                </button>
              )}
            </div>

            <textarea
              rows={5}
              value={qaNotes}
              onChange={(e) => setQaNotes(e.target.value)}
              placeholder="Write directives for the AI to read... (e.g. 'AI: Please verify that when switching between Workspace Silo 1 and 2, the Meta Graph tokens do not cross-pollinate. Test this scenario...')"
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 leading-relaxed font-sans placeholder:text-slate-600"
              autoFocus
            />

            {/* Quick Template Chips */}
            <div className="flex items-center gap-1.5 flex-wrap pt-1">
              <span className="text-[10px] text-slate-500">Quick inserts:</span>
              <button
                type="button"
                onClick={() => handleAddTemplate('AI Directive')}
                className="text-[10px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-violet-300 border border-slate-700 cursor-pointer transition-colors"
              >
                + AI Directive
              </button>
              <button
                type="button"
                onClick={() => handleAddTemplate('QA Feedback')}
                className="text-[10px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 cursor-pointer transition-colors"
              >
                + QA Feedback
              </button>
              <button
                type="button"
                onClick={() => handleAddTemplate('Bug / Edge Case')}
                className="text-[10px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-rose-300 border border-slate-700 cursor-pointer transition-colors"
              >
                + Bug / Edge Case
              </button>
              <button
                type="button"
                onClick={() => handleAddTemplate('QA Passed')}
                className="text-[10px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700 cursor-pointer transition-colors"
              >
                + QA Passed
              </button>
            </div>
          </div>

            <div className="p-3 rounded-xl bg-violet-950/20 border border-violet-500/20 text-[11px] text-slate-300 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-violet-300">
                <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                How the AI Agent reads this
              </div>
              <p className="text-slate-400 leading-relaxed">
                Notes saved here are permanently preserved in the card specification and synced to Firestore &amp; localStorage. Whenever you ask the AI to implement, iterate, or inspect cards, the AI directly reads your directives in this section.
              </p>
            </div>
          </div>

          {/* Sticky Footer */}
          <div className="flex-shrink-0 flex items-center justify-between px-5 sm:px-6 py-3.5 border-t border-slate-800 bg-slate-900/95 backdrop-blur-sm z-10">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer transition-colors"
            >
              Cancel
            </button>

            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-violet-500/25 cursor-pointer transition-all flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Save Directive for AI</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
