import React, { useState, useEffect, useRef } from 'react';
import { 
  KanbanCard, 
  KanbanColumnId, 
  KanbanCategory, 
  KanbanPriority,
  KanbanChecklistItem,
  KanbanQaStatus
} from '../../types/workspace';
import { KANBAN_COLUMNS, INITIAL_KANBAN_CARDS } from '../../data/workspaceDefaults';
import { EditKanbanCardModal } from './EditKanbanCardModal';
import { KanbanPricingModal } from './KanbanPricingModal';
import { CardQaNoteModal } from './CardQaNoteModal';
import { db } from '../../lib/firebase';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { 
  Plus, 
  Search, 
  Filter, 
  ArrowRight, 
  ArrowLeft, 
  CheckSquare, 
  Square, 
  Trash2, 
  Edit3, 
  X, 
  Check, 
  Sparkles, 
  Calculator, 
  Layers, 
  Clock, 
  User, 
  ChevronRight,
  ChevronLeft,
  RotateCcw,
  Download,
  Undo2,
  GripVertical,
  Maximize2,
  Minimize2,
  Tag,
  CheckCircle2,
  Cloud,
  CalendarDays,
  Bot,
  ClipboardCheck,
  FileText,
  MessageSquareCode
} from 'lucide-react';

export const SuperAdminKanban: React.FC = () => {
  // Main Cards State — starts empty; the Firestore subscription below resolves the
  // real board (Firestore -> localStorage cache -> seed cards) and clears the loading flag.
  const [cards, setCards] = useState<KanbanCard[]>([]);
  const [isBoardLoading, setIsBoardLoading] = useState(true);
  // Ref mirror of cards so async handlers (e.g. the undo toast) always see the latest board.
  const cardsRef = useRef<KanbanCard[]>([]);

  const [syncStatus, setSyncStatus] = useState<'synced' | 'saving' | 'offline'>('synced');

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'all' | KanbanCategory>('all');
  const [selectedPriority, setSelectedPriority] = useState<'all' | KanbanPriority>('all');
  const [quickFilter, setQuickFilter] = useState<'all' | 'urgent_high' | 'checklist_incomplete' | 'meta_channels' | 'pricing' | 'has_ai_notes'>('all');

  // Modals & Panels
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<KanbanCard | null>(null);
  const [qaNoteCard, setQaNoteCard] = useState<KanbanCard | null>(null);
  const [isPricingModalOpen, setIsPricingModalOpen] = useState(false);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);

  // Column Collapse State (for focused horizontal space)
  const [collapsedCols, setCollapsedCols] = useState<Set<KanbanColumnId>>(new Set());

  // HTML5 Drag and Drop State
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null);
  const [dragOverColId, setDragOverColId] = useState<KanbanColumnId | null>(null);

  // Undo Delete Toast (the undo action itself restores via saveCards -> Firestore)
  const [toastMessage, setToastMessage] = useState<{ text: string; action?: { label: string; onClick: () => void } } | null>(null);
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);

  // New Card Form State
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newCol, setNewCol] = useState<KanbanColumnId>('backlog');
  const [newCat, setNewCat] = useState<KanbanCategory>('Workspaces & Accounts');
  const [newPrio, setNewPrio] = useState<KanbanPriority>('high');
  const [newTagsStr, setNewTagsStr] = useState('');
  const [newChecklistText, setNewChecklistText] = useState('');
  const [newChecklistItems, setNewChecklistItems] = useState<{ id: string; text: string; done: boolean }[]>([]);
  const [newEffort, setNewEffort] = useState('');
  const [newAssignee, setNewAssignee] = useState('');
  const [newQaNotes, setNewQaNotes] = useState('');
  const [newQaStatus, setNewQaStatus] = useState<KanbanQaStatus>('ready_for_ai');

  // Real-time Firestore Load & Sync
  useEffect(() => {
    let isMounted = true;
    const kanbanDocRef = doc(db, 'system_settings', 'admin_kanban');

    // Local fallback: cached board, else the seed cards. Used when Firestore is
    // unreachable or holds no cards, so the board never renders empty or flashes
    // seed data over a curated board.
    const resolveLocalCards = (): KanbanCard[] => {
      try {
        const saved = localStorage.getItem('chatmize_admin_kanban_cards');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch (e) {
        console.warn('Could not parse cached kanban cards', e);
      }
      return INITIAL_KANBAN_CARDS;
    };

    const finishLoading = (resolved: KanbanCard[]) => {
      if (!isMounted) return;
      setCards(resolved);
      setSyncStatus('synced');
      setIsBoardLoading(false);
    };

    // Subscribe to real-time changes
    const unsubscribe = onSnapshot(kanbanDocRef, async (snap) => {
      if (!isMounted) return;
      if (snap.exists()) {
        const data = snap.data();
        if (Array.isArray(data?.cards) && data.cards.length > 0) {
          try {
            localStorage.setItem('chatmize_admin_kanban_cards', JSON.stringify(data.cards));
          } catch (e) {
            console.error(e);
          }
          finishLoading(data.cards);
          return;
        }
        // Document exists but holds no cards: fall back locally without overwriting it.
        finishLoading(resolveLocalCards());
        return;
      }
      // Document does not exist yet; seed it with the local/seed cards.
      const cardsToSeed = resolveLocalCards();
      try {
        await setDoc(kanbanDocRef, {
          cards: cardsToSeed,
          updatedAt: new Date().toISOString()
        }, { merge: true });
      } catch (err) {
        console.warn('Could not seed initial kanban doc', err);
      }
      if (isMounted) {
        setCards(cardsToSeed);
        setSyncStatus('synced');
        setIsBoardLoading(false);
      }
    }, (err) => {
      console.warn('Firestore real-time sync notice:', err);
      if (!isMounted) return;
      setCards(resolveLocalCards());
      setSyncStatus('offline');
      setIsBoardLoading(false);
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const showToast = (text: string, action?: { label: string; onClick: () => void }) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastMessage({ text, action });
    toastTimerRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 5500);
  };

  const saveCards = (newCards: KanbanCard[]) => {
    setCards(newCards);
    cardsRef.current = newCards;
    try {
      localStorage.setItem('chatmize_admin_kanban_cards', JSON.stringify(newCards));
    } catch (e) {
      console.error('Failed to save to localStorage', e);
    }

    // Background Firestore Sync
    setSyncStatus('saving');
    const kanbanDocRef = doc(db, 'system_settings', 'admin_kanban');
    setDoc(kanbanDocRef, {
      cards: newCards,
      updatedAt: new Date().toISOString()
    }, { merge: true })
      .then(() => setSyncStatus('synced'))
      .catch((e) => {
        console.warn('Firestore sync failed, local copy intact:', e);
        setSyncStatus('offline');
      });
  };

  // Move card left / right
  const handleMoveCard = (cardId: string, direction: 'left' | 'right') => {
    const colOrder: KanbanColumnId[] = ['backlog', 'spec', 'in_progress', 'testing', 'done'];
    const card = cards.find(c => c.id === cardId);
    if (!card) return;

    const currentIndex = colOrder.indexOf(card.columnId);
    let targetIndex = currentIndex;

    if (direction === 'left' && currentIndex > 0) {
      targetIndex = currentIndex - 1;
    } else if (direction === 'right' && currentIndex < colOrder.length - 1) {
      targetIndex = currentIndex + 1;
    }

    if (targetIndex !== currentIndex) {
      const targetColName = KANBAN_COLUMNS.find(c => c.id === colOrder[targetIndex])?.title || 'Next phase';
      const updated = cards.map(c => 
        c.id === cardId ? { ...c, columnId: colOrder[targetIndex] } : c
      );
      saveCards(updated);
      showToast(`Moved to ${targetColName}`);
    }
  };

  // Drag and drop handler
  const handleDropCard = (targetColId: KanbanColumnId) => {
    if (!draggedCardId) return;
    const card = cards.find(c => c.id === draggedCardId);
    if (!card || card.columnId === targetColId) {
      setDraggedCardId(null);
      setDragOverColId(null);
      return;
    }

    const targetColName = KANBAN_COLUMNS.find(c => c.id === targetColId)?.title || targetColId;
    const updated = cards.map(c => 
      c.id === draggedCardId ? { ...c, columnId: targetColId } : c
    );
    saveCards(updated);
    setDraggedCardId(null);
    setDragOverColId(null);
    showToast(`Moved to ${targetColName}`);
  };

  const handleToggleChecklist = (cardId: string, itemId: string) => {
    const updated = cards.map(c => {
      if (c.id === cardId) {
        return {
          ...c,
          checklist: c.checklist.map(item => 
            item.id === itemId ? { ...item, done: !item.done } : item
          )
        };
      }
      return c;
    });
    saveCards(updated);
  };

  // Delete with Instant Undo (iframe safe, no window.confirm)
  const handleDeleteCard = (cardId: string) => {
    const cardIndex = cards.findIndex(c => c.id === cardId);
    if (cardIndex === -1) return;
    const cardToDelete = cards[cardIndex];

    const updated = cards.filter(c => c.id !== cardId);
    saveCards(updated);

    // Provide Undo option — restores through saveCards so Firestore stays in sync
    showToast(`Card "${cardToDelete.title.substring(0, 24)}..." deleted`, {
      label: 'Undo',
      onClick: () => {
        const restored = [...cardsRef.current];
        if (!restored.some(c => c.id === cardToDelete.id)) {
          restored.splice(Math.min(cardIndex, restored.length), 0, cardToDelete);
        }
        saveCards(restored);
        showToast('Card restored successfully');
      }
    });
  };

  // Save changes from Edit Modal
  const handleSaveCard = (updatedCard: KanbanCard) => {
    const updated = cards.map(c => c.id === updatedCard.id ? updatedCard : c);
    saveCards(updated);
    showToast('Architecture card updated');
  };

  // Fast Save from QA Note for AI Modal
  const handleSaveQaNote = (cardId: string, qaNotes: string, qaStatus: KanbanQaStatus) => {
    const updated = cards.map(c => {
      if (c.id === cardId) {
        const trimmed = qaNotes.trim();
        return {
          ...c,
          qaNotes: trimmed || undefined,
          qaStatus: trimmed ? qaStatus : undefined,
          qaUpdatedAt: trimmed ? new Date().toISOString().split('T')[0] : undefined
        };
      }
      return c;
    });
    saveCards(updated);
    showToast(qaNotes.trim() ? 'Note & QA directive saved for AI' : 'QA note cleared');
  };

  // Create new card
  const handleCreateCard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const tags = newTagsStr
      .split(',')
      .map(t => t.trim().replace(/^#/, ''))
      .filter(Boolean);

    const created: KanbanCard = {
      id: `card-${Date.now()}`,
      title: newTitle.trim(),
      description: newDesc.trim(),
      columnId: newCol,
      category: newCat,
      priority: newPrio,
      tags: tags.length > 0 ? tags : ['Planning'],
      checklist: newChecklistItems,
      estimatedEffort: newEffort.trim() || undefined,
      assignee: newAssignee.trim() || 'Admin Team',
      qaNotes: newQaNotes.trim() || undefined,
      qaStatus: newQaNotes.trim() ? newQaStatus : undefined,
      qaUpdatedAt: newQaNotes.trim() ? new Date().toISOString().split('T')[0] : undefined,
      createdAt: new Date().toISOString().split('T')[0]
    };

    saveCards([created, ...cards]);
    setIsAddModalOpen(false);
    resetNewForm();
    showToast('New planning card created');
  };

  const resetNewForm = () => {
    setNewTitle('');
    setNewDesc('');
    setNewCol('backlog');
    setNewCat('Workspaces & Accounts');
    setNewPrio('high');
    setNewTagsStr('');
    setNewChecklistItems([]);
    setNewChecklistText('');
    setNewEffort('');
    setNewAssignee('');
    setNewQaNotes('');
    setNewQaStatus('ready_for_ai');
  };

  const handleAddChecklistItem = () => {
    if (!newChecklistText.trim()) return;
    setNewChecklistItems(prev => [
      ...prev,
      { id: `chk-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`, text: newChecklistText.trim(), done: false }
    ]);
    setNewChecklistText('');
  };

  // Export Roadmap to JSON
  const handleExportRoadmap = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(cards, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `chatmize_kanban_roadmap_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast('Roadmap exported to JSON file');
  };

  // Reset to default cards — always downloads a timestamped backup of the current
  // board first, so a reset can never silently destroy curated planning notes.
  const handleResetToDefaults = () => {
    const backupStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(cards, null, 2));
    const backupAnchor = document.createElement('a');
    backupAnchor.setAttribute("href", backupStr);
    backupAnchor.setAttribute("download", `chatmize_kanban_BACKUP_${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    document.body.appendChild(backupAnchor);
    backupAnchor.click();
    backupAnchor.remove();

    saveCards(INITIAL_KANBAN_CARDS);
    setIsResetConfirmOpen(false);
    showToast('Backup downloaded. Reset to default strategic roadmap');
  };

  const toggleColumnCollapse = (colId: KanbanColumnId) => {
    setCollapsedCols(prev => {
      const next = new Set(prev);
      if (next.has(colId)) {
        next.delete(colId);
      } else {
        next.add(colId);
      }
      return next;
    });
  };

  // Filtering
  const filteredCards = cards.filter(c => {
    const matchesSearch = 
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.assignee && c.assignee.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (c.qaNotes && c.qaNotes.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (c.notes && c.notes.toLowerCase().includes(searchQuery.toLowerCase())) ||
      c.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesCat = selectedCategory === 'all' || c.category === selectedCategory;
    const matchesPrio = selectedPriority === 'all' || c.priority === selectedPriority;

    let matchesQuick = true;
    if (quickFilter === 'urgent_high') {
      matchesQuick = c.priority === 'urgent' || c.priority === 'high';
    } else if (quickFilter === 'checklist_incomplete') {
      matchesQuick = c.checklist.length > 0 && c.checklist.some(item => !item.done);
    } else if (quickFilter === 'meta_channels') {
      matchesQuick = c.category === 'Channels & Meta';
    } else if (quickFilter === 'pricing') {
      matchesQuick = c.category === 'Billing & Pricing';
    } else if (quickFilter === 'has_ai_notes') {
      matchesQuick = Boolean(c.qaNotes && c.qaNotes.trim().length > 0);
    }

    return matchesSearch && matchesCat && matchesPrio && matchesQuick;
  });

  // Global Progress Stats
  const totalCards = cards.length;
  const completedCards = cards.filter(c => c.columnId === 'done').length;
  const totalChecklistItems = cards.reduce((acc, c) => acc + c.checklist.length, 0);
  const doneChecklistItems = cards.reduce((acc, c) => acc + c.checklist.filter(i => i.done).length, 0);
  const overallProgress = totalChecklistItems > 0 
    ? Math.round((doneChecklistItems / totalChecklistItems) * 100) 
    : (totalCards > 0 ? Math.round((completedCards / totalCards) * 100) : 0);

  const isFiltersActive = searchQuery !== '' || selectedCategory !== 'all' || selectedPriority !== 'all' || quickFilter !== 'all';

  return (
    <div className="space-y-6" data-no-emoji>
      {/* Top Banner with Architecture Planning Context & Pricing Simulator Trigger */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-500/20 rounded-2xl p-5 sm:p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-400 animate-pulse" />
              <span className="text-[11px] font-bold text-indigo-300 uppercase tracking-widest">
                Strategic Super Admin Engine
              </span>
              <span className="text-[10px] text-slate-500">•</span>
              <span className="text-[11px] text-slate-400 flex items-center gap-1">
                <Cloud className="w-3 h-3 text-cyan-400" />
                {syncStatus === 'synced' ? 'Cloud & Local Synced' : syncStatus === 'saving' ? 'Syncing...' : 'Local Mode'}
              </span>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/25 flex-shrink-0">
                <Layers className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2.5 flex-wrap">
                  Architecture &amp; Workspaces Kanban
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-semibold uppercase tracking-wider">
                    {totalCards} Spec Cards
                  </span>
                </h2>
                <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                  Plan &amp; track core ChatMize systems: 1 FB Page = 1 IG = 1 WhatsApp asset binding, Agency Flat Unlimited vs. Tiered billing, and White-label client portals.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={() => setIsPricingModalOpen(true)}
              className="px-3.5 py-2 sm:py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30 font-semibold text-xs transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-cyan-500/10"
              title="Compare Agency Flat vs Per-Page Economics"
            >
              <Calculator className="w-4 h-4 text-cyan-400" />
              <span>Pricing Strategy Matrix</span>
            </button>

            <button
              onClick={handleExportRoadmap}
              className="px-3 py-2 sm:py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-semibold text-xs transition-all flex items-center gap-1.5 cursor-pointer"
              title="Export Roadmap to JSON"
            >
              <Download className="w-3.5 h-3.5 text-slate-400" />
              <span>Export</span>
            </button>

            <button
              onClick={() => setIsResetConfirmOpen(true)}
              className="p-2 sm:p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 transition-all cursor-pointer"
              title="Reset to default strategic roadmap"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              onClick={() => {
                setNewCol('backlog');
                setIsAddModalOpen(true);
              }}
              className="px-4 py-2 sm:py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white font-bold text-xs shadow-lg shadow-indigo-500/25 transition-all flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Planning Card</span>
            </button>
          </div>
        </div>

        {/* Global Progress Bar Strip */}
        <div className="mt-5 pt-4 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <span className="text-slate-400 font-medium">Roadmap Progress:</span>
            <div className="w-36 sm:w-56 h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 via-cyan-400 to-emerald-400 transition-all duration-300"
                style={{ width: `${overallProgress}%` }}
              />
            </div>
            <span className="font-mono font-bold text-emerald-400">{overallProgress}%</span>
          </div>

          <div className="flex items-center gap-4 text-[11px] text-slate-400">
            <span>Live Shipped: <strong className="text-white">{completedCards}/{totalCards}</strong></span>
            <span>Checklist Execution: <strong className="text-white">{doneChecklistItems}/{totalChecklistItems} items</strong></span>
          </div>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search cards by title, specs, tags, or assignees..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500 placeholder:text-slate-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Dropdown Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-400">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value as any)}
                className="bg-transparent text-slate-200 focus:outline-none cursor-pointer"
              >
                <option value="all">All Categories</option>
                <option value="Workspaces & Accounts">Workspaces &amp; Accounts</option>
                <option value="Billing & Pricing">Billing &amp; Pricing</option>
                <option value="Channels & Meta">Channels &amp; Meta</option>
                <option value="White-label & Agency">White-label &amp; Agency</option>
                <option value="Nurture Tools">Nurture Tools</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-400">
              <span className="text-[10px] uppercase font-bold text-slate-500">Prio:</span>
              <select
                value={selectedPriority}
                onChange={(e) => setSelectedPriority(e.target.value as any)}
                className="bg-transparent text-slate-200 focus:outline-none cursor-pointer"
              >
                <option value="all">All Priorities</option>
                <option value="urgent">Urgent</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>

            {isFiltersActive && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('all');
                  setSelectedPriority('all');
                  setQuickFilter('all');
                }}
                className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                title="Reset all filters"
              >
                <X className="w-3 h-3" />
                <span>Clear</span>
              </button>
            )}
          </div>
        </div>

        {/* Quick Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex-shrink-0">
            Quick Views:
          </span>
          <button
            onClick={() => setQuickFilter('all')}
            className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer flex-shrink-0 ${
              quickFilter === 'all'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800'
            }`}
          >
            All Cards ({cards.length})
          </button>
          <button
            onClick={() => setQuickFilter('urgent_high')}
            className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer flex-shrink-0 ${
              quickFilter === 'urgent_high'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800'
            }`}
          >
            Urgent &amp; High
          </button>
          <button
            onClick={() => setQuickFilter('checklist_incomplete')}
            className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer flex-shrink-0 ${
              quickFilter === 'checklist_incomplete'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800'
            }`}
          >
            Incomplete Tasks
          </button>
          <button
            onClick={() => setQuickFilter('meta_channels')}
            className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer flex-shrink-0 ${
              quickFilter === 'meta_channels'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800'
            }`}
          >
            Meta Channels (FB/IG/WA)
          </button>
          <button
            onClick={() => setQuickFilter('pricing')}
            className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer flex-shrink-0 ${
              quickFilter === 'pricing'
                ? 'bg-cyan-600 text-white shadow-sm'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800'
            }`}
          >
            Billing &amp; Tiers
          </button>
          <button
            onClick={() => setQuickFilter('has_ai_notes')}
            className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer flex-shrink-0 flex items-center gap-1.5 ${
              quickFilter === 'has_ai_notes'
                ? 'bg-violet-600 text-white shadow-sm font-semibold'
                : 'bg-violet-950/30 hover:bg-violet-900/40 text-violet-300 border border-violet-800/40'
            }`}
          >
            <Bot className="w-3 h-3 text-violet-300" />
            <span>Notes for AI ({cards.filter(c => Boolean(c.qaNotes && c.qaNotes.trim())).length})</span>
          </button>
        </div>
      </div>

      {/* KANBAN BOARD COLUMNS WITH HTML5 DRAG & DROP */}
      {isBoardLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3.5 items-start" aria-label="Loading roadmap board">
          {KANBAN_COLUMNS.map((col) => (
            <div key={col.id} className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-3 min-h-[550px] animate-pulse">
              <div className="h-4 w-2/3 bg-slate-800 rounded mb-4" />
              <div className="space-y-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-2">
                    <div className="h-3 w-3/4 bg-slate-800 rounded" />
                    <div className="h-3 w-full bg-slate-800/60 rounded" />
                    <div className="h-3 w-1/2 bg-slate-800/60 rounded" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3.5 items-start">
        {KANBAN_COLUMNS.map((col) => {
          const colCards = filteredCards.filter(c => c.columnId === col.id);
          const isCollapsed = collapsedCols.has(col.id);
          const isDragOver = dragOverColId === col.id;

          if (isCollapsed) {
            return (
              <div
                key={col.id}
                className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-2.5 flex flex-col items-center justify-between min-h-[550px] transition-all"
              >
                <div className="flex flex-col items-center gap-3 pt-2">
                  <button
                    onClick={() => toggleColumnCollapse(col.id)}
                    className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
                    title={`Expand ${col.title}`}
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                  </button>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${col.badgeColor}`}>
                    {colCards.length}
                  </span>
                  <div className="[writing-mode:vertical-lr] rotate-180 text-xs font-bold uppercase tracking-wider text-slate-400 mt-4">
                    {col.title}
                  </div>
                </div>

                <button
                  onClick={() => {
                    setNewCol(col.id);
                    setIsAddModalOpen(true);
                  }}
                  className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-white cursor-pointer mb-2"
                  title={`Add to ${col.title}`}
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          }

          return (
            <div
              key={col.id}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (dragOverColId !== col.id) {
                  setDragOverColId(col.id);
                }
              }}
              onDragLeave={(e) => {
                if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                if (dragOverColId === col.id) {
                  setDragOverColId(null);
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                handleDropCard(col.id);
              }}
              className={`bg-slate-900/60 border rounded-2xl p-3 flex flex-col gap-3 min-h-[550px] transition-all duration-150 ${
                isDragOver 
                  ? 'border-indigo-400 bg-indigo-950/20 shadow-xl shadow-indigo-500/10 ring-2 ring-indigo-500/30' 
                  : 'border-slate-800'
              }`}
            >
              {/* Column Header */}
              <div className="flex items-center justify-between pb-2 border-b border-slate-800 px-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-xs uppercase tracking-wider text-slate-300">
                    {col.title}
                  </h3>
                  <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-bold ${col.badgeColor}`}>
                    {colCards.length}
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      setNewCol(col.id);
                      setIsAddModalOpen(true);
                    }}
                    className="p-1 rounded hover:bg-slate-800 text-slate-500 hover:text-slate-200 transition-colors cursor-pointer"
                    title={`Add card to ${col.title}`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => toggleColumnCollapse(col.id)}
                    className="p-1 rounded hover:bg-slate-800 text-slate-500 hover:text-slate-200 transition-colors cursor-pointer"
                    title="Collapse column"
                  >
                    <Minimize2 className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Column Description */}
              <p className="text-[10px] text-slate-500 px-1 line-clamp-1">
                {col.description}
              </p>

              {/* Cards List */}
              <div className="space-y-3 flex-1">
                {colCards.map((card) => {
                  const completedChecklist = card.checklist.filter(i => i.done).length;
                  const totalChecklist = card.checklist.length;
                  const percentDone = totalChecklist > 0 ? Math.round((completedChecklist / totalChecklist) * 100) : 0;
                  const isBeingDragged = draggedCardId === card.id;

                  return (
                    <div
                      key={card.id}
                      draggable={true}
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', card.id);
                        setDraggedCardId(card.id);
                      }}
                      onDragEnd={() => {
                        setDraggedCardId(null);
                        setDragOverColId(null);
                      }}
                      className={`bg-slate-950 border border-slate-800 hover:border-indigo-500/50 rounded-xl p-3.5 space-y-3 transition-all shadow-sm group hover:shadow-indigo-500/10 cursor-grab active:cursor-grabbing relative ${
                        isBeingDragged ? 'opacity-40 scale-95 border-dashed border-indigo-400' : ''
                      }`}
                    >
                      {/* Drag Handle & Top Badges */}
                      <div className="flex items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <GripVertical className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-400 flex-shrink-0" />
                          <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                            card.priority === 'urgent'
                              ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                              : card.priority === 'high'
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                              : card.priority === 'medium'
                              ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                              : 'bg-slate-800 text-slate-400 border-slate-700'
                          }`}>
                            {card.priority}
                          </span>
                        </div>

                        <span className="text-[10px] text-slate-400 font-medium truncate max-w-[120px]">
                          {card.category}
                        </span>
                      </div>

                      {/* Card Title & Desc (Clickable to Edit) */}
                      <div 
                        onClick={() => setEditingCard(card)}
                        className="cursor-pointer"
                        title="Click to view & edit details"
                      >
                        <h4 className="text-xs font-bold text-slate-100 leading-snug group-hover:text-indigo-300 transition-colors">
                          {card.title}
                        </h4>
                        <p className="text-[11px] text-slate-400 line-clamp-3 mt-1 leading-relaxed">
                          {card.description}
                        </p>
                      </div>

                      {/* Dedicated Note Section for AI Agent (User QA ↔ AI Management) */}
                      {card.qaNotes ? (
                        <div 
                          onClick={(e) => {
                            e.stopPropagation();
                            setQaNoteCard(card);
                          }}
                          className="p-2.5 rounded-xl bg-violet-950/25 hover:bg-violet-950/40 border border-violet-500/35 hover:border-violet-400/60 transition-all cursor-pointer group/qa space-y-1.5"
                          title="Click to edit QA note / directive for AI"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 font-bold text-[10px] text-violet-300">
                              <div className="w-4 h-4 rounded bg-violet-500/20 border border-violet-500/40 flex items-center justify-center text-violet-300">
                                <Bot className="w-2.5 h-2.5" />
                              </div>
                              <span>Note for AI</span>
                              {card.qaStatus && (
                                <span className={`text-[9px] px-1.5 py-0.2 rounded font-semibold border ${
                                  card.qaStatus === 'ready_for_ai'
                                    ? 'bg-violet-500/20 text-violet-300 border-violet-500/40'
                                    : card.qaStatus === 'revisions_requested'
                                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                                    : card.qaStatus === 'in_qa_review'
                                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                    : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                }`}>
                                  {card.qaStatus === 'ready_for_ai' ? 'Ready for AI' :
                                   card.qaStatus === 'revisions_requested' ? 'Revisions' :
                                   card.qaStatus === 'in_qa_review' ? 'In QA' : 'Approved'}
                                </span>
                              )}
                            </div>
                            <span className="text-[9px] text-violet-400/70 group-hover/qa:text-violet-300 flex items-center gap-0.5">
                              <Edit3 className="w-2.5 h-2.5" /> Edit
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-200 leading-relaxed font-sans bg-slate-950/60 p-2 rounded-lg border border-violet-900/40">
                            "{card.qaNotes}"
                          </p>
                          {card.qaUpdatedAt && (
                            <div className="text-[9px] text-slate-500 flex items-center gap-1 font-mono">
                              <Clock className="w-2.5 h-2.5" /> QA: {card.qaUpdatedAt}
                            </div>
                          )}
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setQaNoteCard(card);
                          }}
                          className="w-full py-1.5 px-2 rounded-lg border border-dashed border-slate-800 hover:border-violet-500/40 bg-slate-900/30 hover:bg-violet-950/20 text-[10px] text-slate-400 hover:text-violet-300 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                          title="Add note / directive for the AI agent"
                        >
                          <Bot className="w-3 h-3 text-violet-400/80" />
                          <span>+ Add Note for AI</span>
                        </button>
                      )}

                      {/* Internal architecture notes (if present) */}
                      {card.notes && !card.qaNotes && (
                        <div className="text-[10px] text-slate-400 bg-slate-900/40 p-2 rounded-lg border border-slate-800/60 flex items-start gap-1.5">
                          <FileText className="w-3 h-3 text-slate-500 flex-shrink-0 mt-0.5" />
                          <span className="line-clamp-2 italic">{card.notes}</span>
                        </div>
                      )}

                      {/* Checklist Progress */}
                      {totalChecklist > 0 && (
                        <div className="space-y-1.5 pt-1 border-t border-slate-900">
                          <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                            <span>Tasks ({completedChecklist}/{totalChecklist})</span>
                            <span className={percentDone === 100 ? 'text-emerald-400 font-bold' : 'text-slate-400'}>
                              {percentDone}%
                            </span>
                          </div>
                          <div className="w-full h-1 bg-slate-900 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                percentDone === 100 ? 'bg-emerald-400' : 'bg-indigo-500'
                              }`}
                              style={{ width: `${percentDone}%` }}
                            />
                          </div>

                          {/* Quick checklist items preview/toggle */}
                          <div className="space-y-1 pt-1 max-h-24 overflow-y-auto pr-1">
                            {card.checklist.map((item) => (
                              <button
                                key={item.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleChecklist(card.id, item.id);
                                }}
                                className="w-full text-left flex items-start gap-1.5 text-[10px] text-slate-300 hover:text-white cursor-pointer py-0.5"
                              >
                                {item.done ? (
                                  <CheckSquare className="w-3 h-3 text-emerald-400 flex-shrink-0 mt-0.5" />
                                ) : (
                                  <Square className="w-3 h-3 text-slate-600 flex-shrink-0 mt-0.5" />
                                )}
                                <span className={`truncate ${item.done ? 'line-through text-slate-500' : ''}`}>
                                  {item.text}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Tags chips */}
                      {card.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {card.tags.map((tag, i) => (
                            <span
                              key={i}
                              className="text-[9px] px-1.5 py-0.2 rounded bg-slate-900 text-slate-400 border border-slate-800"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Footer: Assignee, Due Date, Edit, Move arrows, Delete */}
                      <div className="flex items-center justify-between pt-2 border-t border-slate-900 text-[10px] text-slate-500">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="truncate max-w-[90px] font-medium text-slate-400">
                            {card.assignee || 'Unassigned'}
                          </span>
                          {card.dueDate && (() => {
                            const today = new Date().toISOString().split('T')[0];
                            const isOverdue = card.dueDate < today && card.columnId !== 'done';
                            const isToday = card.dueDate === today;
                            return (
                              <span
                                className={`flex items-center gap-1 px-1.5 py-0.5 rounded font-semibold whitespace-nowrap ${
                                  isOverdue
                                    ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                                    : isToday
                                      ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                                      : 'bg-slate-900 text-slate-400 border border-slate-800'
                                }`}
                                title={isOverdue ? 'Overdue' : `Due ${card.dueDate}`}
                              >
                                <CalendarDays className="w-3 h-3" />
                                {card.dueDate}
                              </span>
                            );
                          })()}
                        </div>

                        <div className="flex items-center gap-0.5">
                          {/* Edit Button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingCard(card);
                            }}
                            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-indigo-300 cursor-pointer transition-colors"
                            title="Edit Card"
                          >
                            <Edit3 className="w-3 h-3" />
                          </button>

                          {/* Move Left */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMoveCard(card.id, 'left');
                            }}
                            disabled={col.id === 'backlog'}
                            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 disabled:opacity-20 disabled:hover:bg-transparent cursor-pointer transition-colors"
                            title="Move column left"
                          >
                            <ArrowLeft className="w-3 h-3" />
                          </button>

                          {/* Move Right */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMoveCard(card.id, 'right');
                            }}
                            disabled={col.id === 'done'}
                            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 disabled:opacity-20 disabled:hover:bg-transparent cursor-pointer transition-colors"
                            title="Move column right"
                          >
                            <ArrowRight className="w-3 h-3" />
                          </button>

                          {/* Delete (with Undo) */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteCard(card.id);
                            }}
                            className="p-1 rounded hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 cursor-pointer transition-colors"
                            title="Delete card"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {colCards.length === 0 && (
                  <div className="text-center py-12 px-3 border border-dashed border-slate-800 rounded-xl text-slate-600 text-xs">
                    {isDragOver ? 'Drop card here' : 'No cards in this phase'}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      )}

      {/* EDIT CARD MODAL */}
      <EditKanbanCardModal
        card={editingCard}
        isOpen={!!editingCard}
        onClose={() => setEditingCard(null)}
        onSave={handleSaveCard}
        onDelete={handleDeleteCard}
      />

      {/* QUICK QA NOTE & DIRECTIVE FOR AI MODAL */}
      <CardQaNoteModal
        card={qaNoteCard}
        isOpen={!!qaNoteCard}
        onClose={() => setQaNoteCard(null)}
        onSave={handleSaveQaNote}
      />

      {/* PRICING STRATEGY MODAL */}
      <KanbanPricingModal
        isOpen={isPricingModalOpen}
        onClose={() => setIsPricingModalOpen(false)}
      />

      {/* RESET TO DEFAULTS CONFIRMATION MODAL */}
      {isResetConfirmOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 max-w-md w-full rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Reset Roadmap to Defaults?</h3>
                <p className="text-xs text-slate-400">Restore standard ChatMize architecture cards.</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 bg-slate-950 p-3 rounded-xl border border-slate-800 leading-relaxed">
              This will reset the roadmap board back to the official default architecture cards (including Facebook Silo bindings, Commercial Tier comparisons, and Multi-tenant Workspaces).
              A timestamped JSON backup of your current board downloads automatically first, so nothing is lost.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsResetConfirmOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleResetToDefaults}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 cursor-pointer"
              >
                Reset Board
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD PLANNING CARD MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-hidden">
          <div className="bg-slate-900 border border-indigo-500/30 rounded-2xl max-w-lg w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Sticky Header */}
            <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/95 backdrop-blur-sm z-10">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Add Architecture / Planning Card</h3>
                  <p className="text-xs text-slate-400">Spec new features, pricing tiers, or channel constraints.</p>
                </div>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCard} className="flex flex-col flex-1 min-h-0 overflow-hidden text-xs">
              {/* Scrollable Body */}
              <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-3.5">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Card Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Free Light Account Limits & Upgrade Gates"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500 text-xs"
                  />
                </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Description / Technical Spec *</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Describe architectural requirements, pricing rules, or Meta API considerations..."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500 text-xs"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Column</label>
                  <select
                    value={newCol}
                    onChange={(e) => setNewCol(e.target.value as KanbanColumnId)}
                    className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs"
                  >
                    <option value="backlog">Backlog</option>
                    <option value="spec">Architecture Spec</option>
                    <option value="in_progress">In Development</option>
                    <option value="testing">Testing &amp; Sandbox</option>
                    <option value="done">Completed &amp; Live</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Category</label>
                  <select
                    value={newCat}
                    onChange={(e) => setNewCat(e.target.value as KanbanCategory)}
                    className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs"
                  >
                    <option value="Workspaces & Accounts">Workspaces &amp; Accounts</option>
                    <option value="Billing & Pricing">Billing &amp; Pricing</option>
                    <option value="Channels & Meta">Channels &amp; Meta</option>
                    <option value="White-label & Agency">White-label &amp; Agency</option>
                    <option value="Nurture Tools">Nurture Tools</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Priority</label>
                  <select
                    value={newPrio}
                    onChange={(e) => setNewPrio(e.target.value as KanbanPriority)}
                    className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs"
                  >
                    <option value="urgent">Urgent</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Assignee</label>
                  <input
                    type="text"
                    placeholder="e.g. Core Arch, Karl / Exec"
                    value={newAssignee}
                    onChange={(e) => setNewAssignee(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs"
                  >
                  </input>
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Estimated Effort</label>
                  <input
                    type="text"
                    placeholder="e.g. 3 days, 1 sprint"
                    value={newEffort}
                    onChange={(e) => setNewEffort(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Tags (comma separated)</label>
                <input
                  type="text"
                  placeholder="Meta Graph, Multi-Tenant, Whitelabel"
                  value={newTagsStr}
                  onChange={(e) => setNewTagsStr(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs"
                />
              </div>

              {/* Quick Checklist Creation */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <label className="font-semibold text-slate-300 block">Initial Checklist / Sub-Tasks</label>
                
                {newChecklistItems.length > 0 && (
                  <div className="space-y-1 max-h-28 overflow-y-auto">
                    {newChecklistItems.map((item, idx) => (
                      <div key={item.id} className="flex items-center justify-between gap-2 p-1 px-2 rounded bg-slate-950 border border-slate-800">
                        <span className="text-[11px] text-slate-300 truncate">{idx + 1}. {item.text}</span>
                        <button
                          type="button"
                          onClick={() => setNewChecklistItems(prev => prev.filter(i => i.id !== item.id))}
                          className="text-slate-500 hover:text-rose-400"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    placeholder="Add checklist task..."
                    value={newChecklistText}
                    onChange={(e) => setNewChecklistText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddChecklistItem();
                      }
                    }}
                    className="flex-1 px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs"
                  />
                  <button
                    type="button"
                    onClick={handleAddChecklistItem}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold cursor-pointer"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Note / Directive for AI Agent */}
              <div className="p-3 rounded-xl bg-violet-950/20 border border-violet-500/30 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-violet-300 flex items-center gap-1.5">
                    <Bot className="w-3.5 h-3.5 text-violet-400" />
                    <span>Directive &amp; Note for AI Agent (Optional)</span>
                  </label>
                  <span className="text-[10px] text-violet-400/80 font-semibold">User QA ↔ AI</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-400 font-semibold flex-shrink-0">QA Status:</span>
                  <select
                    value={newQaStatus}
                    onChange={(e) => setNewQaStatus(e.target.value as KanbanQaStatus)}
                    className="px-2 py-1 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs flex-1"
                  >
                    <option value="ready_for_ai">Ready for AI Implementation</option>
                    <option value="revisions_requested">Revisions Requested by QA</option>
                    <option value="in_qa_review">In QA Review</option>
                    <option value="qa_approved">QA Passed &amp; Approved</option>
                  </select>
                </div>
                <textarea
                  rows={2}
                  placeholder="Instructions for the AI to read when managing or testing this card..."
                  value={newQaNotes}
                  onChange={(e) => setNewQaNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs focus:outline-none focus:border-violet-500 placeholder:text-slate-600"
                />
              </div>
            </div>

            {/* Sticky Footer */}
            <div className="flex-shrink-0 flex items-center justify-end gap-2 px-6 py-3.5 border-t border-slate-800 bg-slate-900/95 backdrop-blur-sm z-10">
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/20 cursor-pointer"
              >
                Create Card
              </button>
            </div>
          </form>
          </div>
        </div>
      )}

      {/* FLOATING UNDO & TOAST NOTIFICATION */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 border border-indigo-500/40 text-slate-200 px-4 py-3 rounded-2xl shadow-2xl shadow-indigo-950/80 flex items-center gap-3 animate-in slide-in-from-bottom-3 duration-200 text-xs">
          <div className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
          <span className="font-medium">{toastMessage.text}</span>
          {toastMessage.action && (
            <button
              onClick={() => {
                toastMessage.action?.onClick();
                setToastMessage(null);
              }}
              className="ml-2 px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[11px] flex items-center gap-1 cursor-pointer transition-colors"
            >
              <Undo2 className="w-3 h-3" />
              <span>{toastMessage.action.label}</span>
            </button>
          )}
          <button
            onClick={() => setToastMessage(null)}
            className="text-slate-400 hover:text-white text-xs ml-2 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
};
