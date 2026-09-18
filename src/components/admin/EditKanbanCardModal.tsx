import React, { useState, useEffect } from 'react';
import { 
  KanbanCard, 
  KanbanColumnId, 
  KanbanCategory, 
  KanbanPriority, 
  KanbanChecklistItem,
  KanbanQaStatus
} from '../../types/workspace';
import { 
  X, 
  Check, 
  Trash2, 
  Plus, 
  CheckSquare, 
  Square, 
  Tag, 
  Clock, 
  CalendarDays,
  User, 
  AlertCircle,
  FileText,
  Bot,
  ClipboardCheck,
  Sparkles
} from 'lucide-react';

interface EditKanbanCardModalProps {
  card: KanbanCard | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedCard: KanbanCard) => void;
  onDelete: (cardId: string) => void;
}

export const EditKanbanCardModal: React.FC<EditKanbanCardModalProps> = ({
  card,
  isOpen,
  onClose,
  onSave,
  onDelete
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [columnId, setColumnId] = useState<KanbanColumnId>('backlog');
  const [category, setCategory] = useState<KanbanCategory>('Workspaces & Accounts');
  const [priority, setPriority] = useState<KanbanPriority>('high');
  const [assignee, setAssignee] = useState('');
  const [estimatedEffort, setEstimatedEffort] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [qaNotes, setQaNotes] = useState('');
  const [qaStatus, setQaStatus] = useState<KanbanQaStatus>('ready_for_ai');
  const [tags, setTags] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState('');
  const [checklist, setChecklist] = useState<KanbanChecklistItem[]>([]);
  const [newChecklistText, setNewChecklistText] = useState('');

  useEffect(() => {
    if (card) {
      setTitle(card.title);
      setDescription(card.description);
      setColumnId(card.columnId);
      setCategory(card.category);
      setPriority(card.priority);
      setAssignee(card.assignee || '');
      setEstimatedEffort(card.estimatedEffort || '');
      setDueDate(card.dueDate || '');
      setNotes(card.notes || '');
      setQaNotes(card.qaNotes || '');
      setQaStatus(card.qaStatus || 'ready_for_ai');
      setTags([...card.tags]);
      setChecklist([...card.checklist]);
    }
  }, [card]);

  if (!isOpen || !card) return null;

  const handleAddTag = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = newTagInput.trim().replace(/^#/, '');
    if (!trimmed) return;
    if (!tags.includes(trimmed)) {
      setTags(prev => [...prev, trimmed]);
    }
    setNewTagInput('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(prev => prev.filter(t => t !== tagToRemove));
  };

  const handleAddChecklistItem = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = newChecklistText.trim();
    if (!trimmed) return;
    const newItem: KanbanChecklistItem = {
      id: `chk-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      text: trimmed,
      done: false
    };
    setChecklist(prev => [...prev, newItem]);
    setNewChecklistText('');
  };

  const handleToggleChecklistItem = (id: string) => {
    setChecklist(prev => prev.map(item => 
      item.id === id ? { ...item, done: !item.done } : item
    ));
  };

  const handleDeleteChecklistItem = (id: string) => {
    setChecklist(prev => prev.filter(item => item.id !== id));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;

    const isQaNotesChanged = qaNotes.trim() !== (card.qaNotes || '').trim();
    const updated: KanbanCard = {
      ...card,
      title: title.trim(),
      description: description.trim(),
      columnId,
      category,
      priority,
      assignee: assignee.trim() || undefined,
      estimatedEffort: estimatedEffort.trim() || undefined,
      dueDate: dueDate.trim() || undefined,
      notes: notes.trim() || undefined,
      qaNotes: qaNotes.trim() || undefined,
      qaStatus: qaNotes.trim() ? qaStatus : undefined,
      qaUpdatedAt: qaNotes.trim() 
        ? (isQaNotesChanged ? new Date().toISOString().split('T')[0] : card.qaUpdatedAt || new Date().toISOString().split('T')[0])
        : undefined,
      tags: tags.length > 0 ? tags : ['Planning'],
      checklist
    };

    onSave(updated);
    onClose();
  };

  const completedChecklistCount = checklist.filter(i => i.done).length;
  const progressPercent = checklist.length > 0 
    ? Math.round((completedChecklistCount / checklist.length) * 100) 
    : 0;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-hidden" data-no-emoji>
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl text-xs text-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Sticky Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-5 sm:px-6 py-3.5 border-b border-slate-800 bg-slate-900/95 backdrop-blur-sm z-10">
          <div className="flex items-center gap-2.5">
            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
              priority === 'urgent'
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                : priority === 'high'
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : priority === 'medium'
                ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}>
              {priority} Priority
            </span>
            <span className="text-slate-400 text-xs font-medium">
              Created {card.createdAt}
            </span>
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
          {/* Scrollable Form Body */}
          <div className="flex-1 min-h-0 overflow-y-auto px-5 sm:px-6 py-5 space-y-4">
            {/* Card Title */}
            <div>
              <label className="block font-semibold text-slate-300 mb-1">Card Title *</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Meta Graph API Silo Token Vault"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-xs focus:outline-none focus:border-indigo-500 font-medium"
              />
            </div>

          {/* Description */}
          <div>
            <label className="block font-semibold text-slate-300 mb-1">Architecture Specification & Requirements *</label>
            <textarea
              rows={3}
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Specify technical constraints, API token handling, and multi-tenant rules..."
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-indigo-500 leading-relaxed"
            />
          </div>

          {/* Column Phase, Category, Priority Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-300 mb-1">Column / Phase</label>
              <select
                value={columnId}
                onChange={(e) => setColumnId(e.target.value as KanbanColumnId)}
                className="w-full px-2.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
              >
                <option value="backlog">Backlog</option>
                <option value="spec">Architecture Spec</option>
                <option value="in_progress">In Development</option>
                <option value="testing">Testing &amp; Sandbox</option>
                <option value="done">Completed &amp; Live</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">Architecture Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as KanbanCategory)}
                className="w-full px-2.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
              >
                <option value="Workspaces & Accounts">Workspaces &amp; Accounts</option>
                <option value="Billing & Pricing">Billing &amp; Pricing</option>
                <option value="Channels & Meta">Channels &amp; Meta</option>
                <option value="White-label & Agency">White-label &amp; Agency</option>
                <option value="Nurture Tools">Nurture Tools</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">Strategic Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as KanbanPriority)}
                className="w-full px-2.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
              >
                <option value="urgent">Urgent</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>

          {/* Assignee, Effort & Due Date */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-slate-400" />
                Assignee / Owner
              </label>
              <input
                type="text"
                placeholder="e.g. Core Arch, Karl / Exec"
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                Estimated Effort / Sprint
              </label>
              <input
                type="text"
                placeholder="e.g. 3 days, 1 sprint, Done"
                value={estimatedEffort}
                onChange={(e) => setEstimatedEffort(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
                Deadline
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Checklist Manager */}
          <div className="space-y-2 pt-2 border-t border-slate-800">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-slate-300 flex items-center gap-1.5">
                <CheckSquare className="w-3.5 h-3.5 text-emerald-400" />
                Checklist Items ({completedChecklistCount}/{checklist.length})
              </label>
              {checklist.length > 0 && (
                <span className="text-[10px] font-mono text-emerald-400 font-bold">
                  {progressPercent}% Complete
                </span>
              )}
            </div>

            {/* Checklist progress bar */}
            {checklist.length > 0 && (
              <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                <div
                  className={`h-full transition-all ${progressPercent === 100 ? 'bg-emerald-400' : 'bg-indigo-500'}`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            )}

            {/* Existing Checklist items */}
            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
              {checklist.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-2 p-1.5 px-2.5 rounded-lg bg-slate-950/70 border border-slate-800/80 group"
                >
                  <button
                    type="button"
                    onClick={() => handleToggleChecklistItem(item.id)}
                    className="flex items-center gap-2 text-left flex-1 cursor-pointer min-w-0"
                  >
                    {item.done ? (
                      <CheckSquare className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                    ) : (
                      <Square className="w-3.5 h-3.5 text-slate-600 flex-shrink-0" />
                    )}
                    <span className={`text-xs truncate ${item.done ? 'line-through text-slate-500' : 'text-slate-300'}`}>
                      {item.text}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteChecklistItem(item.id)}
                    className="p-1 rounded text-slate-500 hover:text-rose-400 opacity-60 group-hover:opacity-100 transition-opacity"
                    title="Remove item"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>

            {/* Add checklist input */}
            <div className="flex items-center gap-2 pt-1">
              <input
                type="text"
                placeholder="Add new requirement or sub-task..."
                value={newChecklistText}
                onChange={(e) => setNewChecklistText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddChecklistItem();
                  }
                }}
                className="flex-1 px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
              />
              <button
                type="button"
                onClick={() => handleAddChecklistItem()}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer"
              >
                Add Item
              </button>
            </div>
          </div>

          {/* Tags Manager */}
          <div className="space-y-2 pt-2 border-t border-slate-800">
            <label className="block font-semibold text-slate-300 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-indigo-400" />
              Tags &amp; Architectural Keywords
            </label>

            <div className="flex flex-wrap gap-1.5 min-h-[28px] p-2 rounded-xl bg-slate-950 border border-slate-800">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-indigo-500/15 text-indigo-300 border border-indigo-500/30"
                >
                  #{tag}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    className="hover:text-rose-300 cursor-pointer ml-0.5"
                    title="Remove tag"
                  >
                    ×
                  </button>
                </span>
              ))}
              {tags.length === 0 && (
                <span className="text-[11px] text-slate-500 italic">No tags applied</span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Add tag (e.g. Meta Graph, Pricing, Whitelabel)..."
                value={newTagInput}
                onChange={(e) => setNewTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
                className="flex-1 px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
              />
              <button
                type="button"
                onClick={() => handleAddTag()}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer"
              >
                Add Tag
              </button>
            </div>
          </div>

          {/* QA & User Directives for AI Agent */}
          <div className="p-3.5 rounded-xl bg-violet-950/20 border border-violet-500/30 space-y-3">
            <div className="flex items-center justify-between">
              <label className="block font-bold text-violet-300 flex items-center gap-2">
                <div className="w-5 h-5 rounded-md bg-violet-500/20 border border-violet-500/40 flex items-center justify-center text-violet-300">
                  <Bot className="w-3.5 h-3.5" />
                </div>
                <span>Notes &amp; QA Directives for AI Agent</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300 font-semibold border border-violet-500/30">
                  User QA ↔ AI Management
                </span>
              </label>

              {card.qaUpdatedAt && (
                <span className="text-[10px] text-slate-500 flex items-center gap-1 font-mono">
                  <Clock className="w-3 h-3" /> Updated: {card.qaUpdatedAt}
                </span>
              )}
            </div>

            <p className="text-[11px] text-slate-400">
              Leave instructions, acceptance criteria, test scenarios, or QA feedback. The AI Agent managing this board directly reads these directives.
            </p>

            {/* QA Workflow Status */}
            <div className="space-y-1">
              <span className="text-[11px] font-semibold text-slate-300 flex items-center gap-1">
                <ClipboardCheck className="w-3 h-3 text-violet-400" />
                QA Status:
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                <button
                  type="button"
                  onClick={() => setQaStatus('ready_for_ai')}
                  className={`px-2 py-1.5 rounded-lg text-left border flex items-center gap-1.5 cursor-pointer transition-all ${
                    qaStatus === 'ready_for_ai'
                      ? 'bg-violet-500/25 border-violet-500 text-violet-200 shadow-sm font-semibold'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />
                  <span className="text-[10px] truncate">Ready for AI</span>
                </button>

                <button
                  type="button"
                  onClick={() => setQaStatus('revisions_requested')}
                  className={`px-2 py-1.5 rounded-lg text-left border flex items-center gap-1.5 cursor-pointer transition-all ${
                    qaStatus === 'revisions_requested'
                      ? 'bg-rose-500/25 border-rose-500 text-rose-200 shadow-sm font-semibold'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                  <span className="text-[10px] truncate">Revisions Needed</span>
                </button>

                <button
                  type="button"
                  onClick={() => setQaStatus('in_qa_review')}
                  className={`px-2 py-1.5 rounded-lg text-left border flex items-center gap-1.5 cursor-pointer transition-all ${
                    qaStatus === 'in_qa_review'
                      ? 'bg-amber-500/25 border-amber-500 text-amber-200 shadow-sm font-semibold'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  <span className="text-[10px] truncate">In QA Review</span>
                </button>

                <button
                  type="button"
                  onClick={() => setQaStatus('qa_approved')}
                  className={`px-2 py-1.5 rounded-lg text-left border flex items-center gap-1.5 cursor-pointer transition-all ${
                    qaStatus === 'qa_approved'
                      ? 'bg-emerald-500/25 border-emerald-500 text-emerald-200 shadow-sm font-semibold'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span className="text-[10px] truncate">QA Approved</span>
                </button>
              </div>
            </div>

            {/* QA Notes Textarea */}
            <div className="space-y-1.5">
              <textarea
                rows={3}
                value={qaNotes}
                onChange={(e) => setQaNotes(e.target.value)}
                placeholder="Write QA notes or directives for the AI to read (e.g., 'AI: Ensure token isolation between FB pages is verified. Test edge case where child workspace has no IG linked...')"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 placeholder:text-slate-600"
              />

              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] text-slate-500">Quick inserts:</span>
                <button
                  type="button"
                  onClick={() => setQaNotes(prev => prev.trim() ? `${prev.trim()}\n\nAI Directive: ` : 'AI Directive: ')}
                  className="text-[10px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-violet-300 border border-slate-700 cursor-pointer"
                >
                  + AI Directive
                </button>
                <button
                  type="button"
                  onClick={() => setQaNotes(prev => prev.trim() ? `${prev.trim()}\n\nQA Feedback: ` : 'QA Feedback: ')}
                  className="text-[10px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 cursor-pointer"
                >
                  + QA Feedback
                </button>
                <button
                  type="button"
                  onClick={() => setQaNotes(prev => prev.trim() ? `${prev.trim()}\n\nBug / Edge Case: ` : 'Bug / Edge Case: ')}
                  className="text-[10px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-rose-300 border border-slate-700 cursor-pointer"
                >
                  + Bug / Edge Case
                </button>
                {qaNotes && (
                  <button
                    type="button"
                    onClick={() => setQaNotes('')}
                    className="text-[10px] text-slate-500 hover:text-rose-400 ml-auto cursor-pointer"
                  >
                    Clear QA note
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Internal Notes */}
          <div className="pt-2 border-t border-slate-800">
            <label className="block font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              Internal Architecture Notes (Optional)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Engineering caveats, token security reminders, or team comments..."
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Sticky Footer */}
        <div className="flex-shrink-0 flex items-center justify-between px-5 sm:px-6 py-3.5 border-t border-slate-800 bg-slate-900/95 backdrop-blur-sm z-10">
          <button
            type="button"
            onClick={() => {
              onDelete(card.id);
              onClose();
            }}
            className="px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete Card</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white font-bold text-xs shadow-lg shadow-indigo-500/25 cursor-pointer transition-all flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Save Changes</span>
            </button>
          </div>
        </div>
      </form>
      </div>
    </div>
  );
};
