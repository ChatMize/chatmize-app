import React, { useState, useEffect, useRef, useCallback } from 'react';
import { EmojiPickerButton, useEmojiTarget } from '../emoji';
import {
  MessageSquare,
  Plus,
  Sparkles,
  Code,
  Eye,
  Copy,
  Check,
  Trash2,
  Bot,
  Settings2,
  Send,
  Headphones,
  CheckCircle2,
  ArrowLeft,
  Palette,
  Globe,
  UserCheck,
  ArrowUp,
  Layout,
  RotateCcw,
  Minimize2,
  Workflow,
  Loader2,
  AlertTriangle
} from 'lucide-react';
import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
} from 'firebase/firestore';
import { prodDb } from '../../lib/firebase';
import { SupportChatWidgetConfig } from '../../types/growthTools';
import { ImageUpload } from '../ImageUpload';
import { SupportBotSession, createSessionFromBotMap } from '../../utils/supportBotRunner';
import { loadBotMapData } from '../../utils/botMapStorage';

/** Sentinel doc that gates unauthenticated visitor reads (see firestore.rules). */
const SENTINEL_DOC_ID = 'widget_support_active_check';

interface SupportChatViewProps {
  /** Firestore workspace id — widgets persist at workspaces/{workspaceId}/support_widgets. Required. */
  workspaceId: string;
  availableBots?: Array<{ id: string; name: string }>;
  onNavigateToFlows?: (botId?: string) => void;
}

const MODE_KEY = 'chatmize_supportchat_mode';
const SELECTED_KEY = 'chatmize_supportchat_widget';

const COLOR_PRESETS = [
  { name: 'Cyan Blue', hex: '#00d2ff' },
  { name: 'Royal Blue', hex: '#3b82f6' },
  { name: 'Emerald', hex: '#10b981' },
  { name: 'Purple Neon', hex: '#a855f7' },
  { name: 'Amber Glow', hex: '#f59e0b' },
  { name: 'Rose Red', hex: '#ec4899' }
];

export const WIDGET_TEMPLATES = [
  {
    name: 'Customer Support FAQ',
    headline: 'Need Help or Have Questions?',
    subheadline: 'Our AI Specialist and team reply within 60 seconds.',
    welcomeMessage: 'Hi there! Welcome to our website. How can I assist you today? Feel free to ask about our pricing, features, or order status!',
    brandColor: '#00d2ff',
    botName: 'Support Concierge',
    quickReplies: [
      { id: 'qr-1', label: 'Talk to Sales', payload: 'TALK_SALES' },
      { id: 'qr-2', label: 'Track Order', payload: 'TRACK_ORDER' },
      { id: 'qr-3', label: 'Pricing Plans', payload: 'PRICING' }
    ]
  },
  {
    name: 'E-Commerce Assistant',
    headline: 'Looking for the Perfect Deal?',
    subheadline: 'Instant discounts, sizing help, and order tracking.',
    welcomeMessage: 'Welcome to our store! Looking for a specific item, or want to claim today\'s exclusive 15% off coupon?',
    brandColor: '#10b981',
    botName: 'Shopping Assistant',
    quickReplies: [
      { id: 'qr-1', label: 'Get 15% Off Code', payload: 'GET_COUPON' },
      { id: 'qr-2', label: 'Shipping & Delivery', payload: 'SHIPPING_INFO' },
      { id: 'qr-3', label: 'Best Sellers', payload: 'POPULAR_ITEMS' }
    ]
  },
  {
    name: 'VIP Demo & Sales Booking',
    headline: 'Scale Your Conversions with AI',
    subheadline: 'Book a 1-on-1 strategy call with our growth specialists.',
    welcomeMessage: 'Ready to 10x your client messaging? I can answer any questions or lock in a tailored 15-minute live platform walkthrough!',
    brandColor: '#3b82f6',
    botName: 'Growth Specialist',
    quickReplies: [
      { id: 'qr-1', label: 'Book 15-Min Demo', payload: 'BOOK_DEMO' },
      { id: 'qr-2', label: 'ROI & Pricing', payload: 'CALCULATE_ROI' },
      { id: 'qr-3', label: 'See Case Studies', payload: 'CASE_STUDIES' }
    ]
  },
  {
    name: 'Lead Magnet Delivery',
    headline: 'Download Free Growth Blueprint',
    subheadline: 'Get our battle-tested messaging templates instantly.',
    welcomeMessage: 'Grab your free copy of our 2026 Omnichannel Conversion Playbook! Where should we send your instant download?',
    brandColor: '#a855f7',
    botName: 'Resource Assistant',
    quickReplies: [
      { id: 'qr-1', label: 'Send to My Email', payload: 'EMAIL_OPTIN' },
      { id: 'qr-2', label: 'Preview Chapters', payload: 'PREVIEW_BOOK' }
    ]
  }
];

/** Real bot maps owned by this browser profile (BotMaps list, not demo placeholders). */
function loadRealBots(): Array<{ id: string; name: string }> {
  try {
    const saved = localStorage.getItem('chatmize_bot_maps_list');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((b: any) => b && b.id)
          .map((b: any) => ({ id: String(b.id), name: String(b.name || b.id) }));
      }
    }
  } catch { /* ignore */ }
  return [];
}

/** Snapshot the connected bot's current BotMap so the visitor widget can run it. */
function snapshotBotFlow(botId: string): { nodes: any[]; connections: any[]; publishedAt: string } | null {
  if (!botId) return null;
  try {
    const data = loadBotMapData(botId);
    if (!data || !Array.isArray(data.nodes) || data.nodes.length === 0) return null;
    return {
      nodes: data.nodes,
      connections: Array.isArray(data.connections) ? data.connections : [],
      publishedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

function cleanWidgetDoc(w: SupportChatWidgetConfig): Record<string, any> {
  const { ...rest } = w as any;
  // Strip undefined (Firestore rejects it).
  return Object.fromEntries(Object.entries(rest).filter(([_, v]) => v !== undefined));
}

export const SupportChatView: React.FC<SupportChatViewProps> = ({
  workspaceId,
  availableBots,
  onNavigateToFlows
}) => {
  const bots = availableBots && availableBots.length > 0 ? availableBots : loadRealBots();

  // ---- Widget configs: Firestore (chatmize-prod), realtime ----
  const [widgets, setWidgets] = useState<SupportChatWidgetConfig[]>([]);
  const [widgetsLoading, setWidgetsLoading] = useState(true);
  const [widgetsError, setWidgetsError] = useState<string | null>(null);

  const [activeMode, setActiveMode] = useState<'list' | 'editor' | 'preview'>(() => {
    const s = localStorage.getItem(MODE_KEY);
    return s === 'editor' || s === 'preview' ? s : 'list';
  });
  const [selectedWidgetId, setSelectedWidgetId] = useState<string>(() => {
    return localStorage.getItem(SELECTED_KEY) || '';
  });
  const [editingWidget, setEditingWidget] = useState<SupportChatWidgetConfig | null>(null);

  const widgetsRef = collection(prodDb, 'workspaces', workspaceId, 'support_widgets');

  useEffect(() => {
    if (!workspaceId) {
      // Workspace id still resolving in App — don't query a placeholder path.
      setWidgetsLoading(true);
      return;
    }
    setWidgetsLoading(true);
    setWidgetsError(null);
    const q = query(widgetsRef, orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q,
      (snap) => {
        const list: SupportChatWidgetConfig[] = [];
        snap.forEach((d) => {
          // The public-access sentinel is bookkeeping, not a widget.
          if (d.id === SENTINEL_DOC_ID) return;
          list.push({ id: d.id, ...(d.data() as Omit<SupportChatWidgetConfig, 'id'>) });
        });
        setWidgets(list);
        setWidgetsLoading(false);
        if (list.length === 0) {
          seedDefaultWidget();
        } else if (!list.some((w) => w.id === selectedWidgetId)) {
          setSelectedWidgetId(list[0].id);
        }
      },
      (err) => {
        console.error('Support widgets listener failed:', err);
        setWidgetsError(err.message || 'Could not load widgets.');
        setWidgetsLoading(false);
      }
    );
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  const seedDefaultWidget = useCallback(async () => {
    const now = new Date().toISOString();
    const seed: SupportChatWidgetConfig = {
      id: 'support-chat-primary',
      name: 'Website Support Chat',
      status: 'active',
      headline: 'Need help or have questions?',
      subheadline: 'Our team typically replies within a few minutes.',
      welcomeMessage: 'Hi there! Welcome. How can I help you today?',
      brandColor: '#00d2ff',
      theme: 'dark',
      position: 'bottom_right',
      launcherIcon: 'chat',
      launcherText: 'Chat with us',
      avatarUrl: '',
      botName: 'Support',
      connectedBotId: '',
      quickReplies: [
        { id: 'qr-1', label: 'Talk to sales', payload: 'TALK_SALES' },
        { id: 'qr-2', label: 'Pricing', payload: 'PRICING' },
        { id: 'qr-3', label: 'Get support', payload: 'SUPPORT' }
      ],
      requireEmailCapture: false,
      requireNameCapture: false,
      requirePhoneCapture: false,
      removeBranding: false,
      autoOpenDelaySeconds: 0,
      whitelistedDomains: [],
      totalViews: 0,
      totalConversations: 0,
      totalLeads: 0,
      createdAt: now,
      updatedAt: now
    };
    try {
      await setDoc(doc(widgetsRef, seed.id), cleanWidgetDoc(seed));
    } catch (e) {
      console.error('Failed to seed default support widget:', e);
    }
  }, [widgetsRef]);

  const persistMode = (m: 'list' | 'editor' | 'preview') => {
    setActiveMode(m);
    localStorage.setItem(MODE_KEY, m);
  };
  const persistSelected = (id: string) => {
    setSelectedWidgetId(id);
    localStorage.setItem(SELECTED_KEY, id);
  };

  const handleCreateNew = () => {
    const newWidget: SupportChatWidgetConfig = {
      id: `support-${Date.now().toString(36)}`,
      name: 'New Live Support Chat',
      status: 'draft',
      headline: 'Need Help or Have Questions?',
      subheadline: 'Our team replies within a few minutes.',
      welcomeMessage: 'Hi there! Welcome. How can I help you today?',
      brandColor: '#00d2ff',
      theme: 'dark',
      position: 'bottom_right',
      launcherIcon: 'chat',
      launcherText: 'Chat with Us',
      avatarUrl: '',
      botName: 'Support',
      connectedBotId: bots[0]?.id || '',
      quickReplies: [
        { id: 'qr-1', label: 'Talk to Sales', payload: 'TALK_SALES' },
        { id: 'qr-2', label: 'Track Order', payload: 'TRACK_ORDER' },
        { id: 'qr-3', label: 'Pricing Plans', payload: 'PRICING' }
      ],
      requireEmailCapture: false,
      requireNameCapture: false,
      requirePhoneCapture: false,
      removeBranding: false,
      autoOpenDelaySeconds: 0,
      whitelistedDomains: [],
      totalViews: 0,
      totalConversations: 0,
      totalLeads: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    setEditingWidget(newWidget);
    persistMode('editor');
  };

  const handleEdit = (widget: SupportChatWidgetConfig) => {
    setEditingWidget({ ...widget, quickReplies: [...(widget.quickReplies || [])] });
    persistSelected(widget.id);
    persistMode('editor');
  };

  /** Save the widget to Firestore and publish the connected BotMap snapshot for the live widget. */
  const handleSave = async (updated: SupportChatWidgetConfig) => {
    const flow = snapshotBotFlow(updated.connectedBotId || '');
    const payload = cleanWidgetDoc({
      ...updated,
      updatedAt: new Date().toISOString(),
      publishedFlow: flow,
      publishedFlowBotId: updated.connectedBotId || null,
    });
    try {
      await setDoc(doc(widgetsRef, updated.id), payload, { merge: true });
      await refreshWidgetSentinel();
      persistSelected(updated.id);
      setEditingWidget(null);
      persistMode('list');
    } catch (e: any) {
      alert(`Could not save widget: ${e?.message || e}`);
    }
  };

  /**
   * Maintains the public sentinel doc that gates unauthenticated visitor
   * access (firestore.rules). Exists iff the workspace has >= 1 active
   * support widget. Called after every save / status toggle / delete.
   */
  async function refreshWidgetSentinel() {
    try {
      const snap = await getDocs(collection(prodDb, 'workspaces', workspaceId, 'support_widgets'));
      const hasActive = snap.docs.some(
        (d) => d.id !== SENTINEL_DOC_ID && (d.data() as any).status === 'active'
      );
      const sentinelRef = doc(prodDb, 'workspaces', workspaceId, 'support_widgets', SENTINEL_DOC_ID);
      if (hasActive) {
        await setDoc(sentinelRef, { active: true, updatedAt: new Date().toISOString() }, { merge: true });
      } else {
        await deleteDoc(sentinelRef);
      }
    } catch (e) {
      console.warn('Failed to refresh widget public-access sentinel:', e);
    }
  }

  const handleToggleStatus = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const w = widgets.find((x) => x.id === id);
    if (!w) return;
    const next = w.status === 'active' ? 'paused' : 'active';
    try {
      await updateDoc(doc(widgetsRef, id), { status: next, updatedAt: new Date().toISOString() });
      await refreshWidgetSentinel();
    } catch (e: any) {
      alert(`Could not update status: ${e?.message || e}`);
    }
  };

  const handleDuplicate = async (widget: SupportChatWidgetConfig, e: React.MouseEvent) => {
    e.stopPropagation();
    const copy: SupportChatWidgetConfig = {
      ...widget,
      id: `support-${Date.now().toString(36)}`,
      name: `${widget.name} (Copy)`,
      status: 'draft',
      totalViews: 0,
      totalConversations: 0,
      totalLeads: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    try {
      await setDoc(doc(widgetsRef, copy.id), cleanWidgetDoc(copy));
    } catch (err: any) {
      alert(`Could not duplicate widget: ${err?.message || err}`);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this Support Chat widget? It will stop rendering on every site using its embed code.')) return;
    try {
      await deleteDoc(doc(widgetsRef, id));
      await refreshWidgetSentinel();
      if (selectedWidgetId === id) {
        const remaining = widgets.filter((w) => w.id !== id);
        persistSelected(remaining[0]?.id || '');
      }
    } catch (err: any) {
      alert(`Could not delete widget: ${err?.message || err}`);
    }
  };

  const bumpLeads = async (widgetId: string) => {
    try {
      const w = widgets.find((x) => x.id === widgetId);
      await updateDoc(doc(widgetsRef, widgetId), {
        totalLeads: (w?.totalLeads || 0) + 1,
        updatedAt: new Date().toISOString(),
      });
    } catch { /* non-fatal */ }
  };

  const currentWidget = widgets.find(w => w.id === selectedWidgetId) || widgets[0] || null;

  // ---- BotMaps routing for the in-app simulator + editor preview ----
  // Quick replies and typed messages route through the connected bot's real
  // BotMap flow via the shared runner — never canned demo replies.
  const sessionCache = useRef<{ key: string; session: SupportBotSession | null }>({ key: '', session: null });

  const getBotSession = (widget: SupportChatWidgetConfig | null): SupportBotSession | null => {
    if (!widget) return null;
    const botId = widget.connectedBotId || '';
    const key = `${widget.id}:${botId}`;
    if (sessionCache.current.key !== key) {
      let session: SupportBotSession | null = null;
      if (botId) {
        try {
          const data = loadBotMapData(botId);
          session = createSessionFromBotMap(data as any);
        } catch { session = null; }
      }
      sessionCache.current = { key, session };
    }
    return sessionCache.current.session;
  };

  const botDisplayName = (widget: SupportChatWidgetConfig | null) => {
    const b = bots.find((x) => x.id === (widget?.connectedBotId || ''));
    return b ? b.name : (widget?.connectedBotId ? widget.connectedBotId : 'No bot connected');
  };

  // ---- Simulator state (full preview mode) ----
  interface SimMsg { sender: 'bot' | 'user'; text: string; time: string }
  const [simMessages, setSimMessages] = useState<SimMsg[]>([]);
  const [simQuickReplies, setSimQuickReplies] = useState<Array<{ label: string; payload: string }>>([]);
  const [simInput, setSimInput] = useState('');
  const [isSimOpen, setIsSimOpen] = useState(true);
  const [simDevice, setSimDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [isSimTyping, setIsSimTyping] = useState(false);
  const [leadCapturedNotice, setLeadCapturedNotice] = useState<string | null>(null);
  const [showQuickGuide, setShowQuickGuide] = useState(true);
  const simBootedFor = useRef('');

  const resetSimulator = (widget: SupportChatWidgetConfig | null) => {
    setSimMessages(widget ? [{ sender: 'bot', text: widget.welcomeMessage, time: 'Just now' }] : []);
    setSimQuickReplies(widget?.quickReplies?.map((q) => ({ label: q.label, payload: q.payload })) || []);
    setSimInput('');
    setIsSimTyping(false);
    sessionCache.current = { key: '', session: null };
    if (widget) simBootedFor.current = widget.id;
  };

  useEffect(() => {
    if (activeMode === 'preview' && currentWidget && simBootedFor.current !== currentWidget.id) {
      resetSimulator(currentWidget);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMode, currentWidget?.id]);

  const applyBotTurn = (widget: SupportChatWidgetConfig, turn: ReturnType<SupportBotSession['handleText']>) => {
    const botTexts: SimMsg[] = turn.texts.map((t) => ({ sender: 'bot' as const, text: t, time: 'Just now' }));
    setSimMessages((prev) => [...prev, ...botTexts]);
    // Bot-flow chips replace the widget's static chips; handoff keeps static chips.
    if (turn.quickReplies.length > 0) {
      setSimQuickReplies(turn.quickReplies);
    } else if (!turn.handoffToAgent) {
      setSimQuickReplies(widget.quickReplies?.map((q) => ({ label: q.label, payload: q.payload })) || []);
    }
    if (turn.aiDeferred) {
      setLeadCapturedNotice('AI step reached — the backend AI worker answers this in the live widget; the preview hands off to an agent.');
      setTimeout(() => setLeadCapturedNotice(null), 5000);
    }
  };

  const handleSimSend = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!simInput.trim() || !currentWidget) return;
    const userText = simInput.trim();
    setSimMessages((prev) => [...prev, { sender: 'user', text: userText, time: 'Just now' }]);
    setSimInput('');
    setSimQuickReplies([]);

    // Lead-capture test: an email-shaped input counts as a captured lead.
    if (currentWidget.requireEmailCapture && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(userText)) {
      setLeadCapturedNotice(`Lead captured: ${userText}`);
      setTimeout(() => setLeadCapturedNotice(null), 4000);
      bumpLeads(currentWidget.id);
    }

    const session = getBotSession(currentWidget);
    if (!session || !session.hasFlow()) {
      // No bot connected: the live widget routes this to an agent in
      // Live Conversations — say so honestly instead of faking a reply.
      setIsSimTyping(true);
      setTimeout(() => {
        setIsSimTyping(false);
        setSimMessages((prev) => [
          ...prev,
          { sender: 'bot', text: 'Thanks for reaching out! No bot is connected to this widget, so in the live widget this message goes straight to your team in Live Conversations. Connect a BotMap to automate replies.', time: 'Just now' },
        ]);
        setSimQuickReplies(currentWidget.quickReplies?.map((q) => ({ label: q.label, payload: q.payload })) || []);
      }, 600);
      return;
    }

    setIsSimTyping(true);
    setTimeout(() => {
      setIsSimTyping(false);
      applyBotTurn(currentWidget, session.handleText(userText));
    }, 650);
  };

  const handleSimReplyClick = (reply: { label: string; payload: string }) => {
    if (!currentWidget) return;
    setSimMessages((prev) => [...prev, { sender: 'user', text: reply.label, time: 'Just now' }]);
    setSimQuickReplies([]);
    const session = getBotSession(currentWidget);
    if (!session || !session.hasFlow()) {
      setIsSimTyping(true);
      setTimeout(() => {
        setIsSimTyping(false);
        setSimMessages((prev) => [
          ...prev,
          { sender: 'bot', text: `You selected "${reply.label}". No bot is connected, so the live widget hands this to your team in Live Conversations.`, time: 'Just now' },
        ]);
      }, 550);
      return;
    }
    setIsSimTyping(true);
    setTimeout(() => {
      setIsSimTyping(false);
      applyBotTurn(currentWidget, session.handlePayload(reply.payload, reply.label));
    }, 550);
  };

  // ---- Editor live preview test chat (routes through the same runner) ----
  const [editorPreviewMode, setEditorPreviewMode] = useState<'elevated' | 'corner'>('elevated');
  const [editorChatOpen, setEditorChatOpen] = useState(true);
  const [editorTestInput, setEditorTestInput] = useState('');
  const [editorTestMessages, setEditorTestMessages] = useState<SimMsg[]>([]);
  const [editorTestReplies, setEditorTestReplies] = useState<Array<{ label: string; payload: string }>>([]);
  const [editorTyping, setEditorTyping] = useState(false);
  const [newReplyLabel, setNewReplyLabel] = useState('');
  const headlineEmoji = useEmojiTarget<HTMLInputElement>();
  const subheadlineEmoji = useEmojiTarget<HTMLInputElement>();
  const welcomeEmoji = useEmojiTarget<HTMLTextAreaElement>();
  const chipEmoji = useEmojiTarget<HTMLInputElement>();
  const domainEmoji = useEmojiTarget<HTMLInputElement>();

  const editorSessionKey = useRef('');
  const getEditorSession = (): SupportBotSession | null => {
    if (!editingWidget) return null;
    const botId = editingWidget.connectedBotId || '';
    const key = `editor:${botId}`;
    if (editorSessionKey.current !== key) {
      editorSessionKey.current = key;
      let s: SupportBotSession | null = null;
      if (botId) {
        try { s = createSessionFromBotMap(loadBotMapData(botId) as any); } catch { s = null; }
      }
      (getEditorSession as any)._s = s;
    }
    return (getEditorSession as any)._s || null;
  };

  const editorApplyTurn = (turn: ReturnType<SupportBotSession['handleText']>) => {
    setEditorTestMessages((prev) => [...prev, ...turn.texts.map((t) => ({ sender: 'bot' as const, text: t, time: 'Just now' }))]);
    if (turn.quickReplies.length > 0) setEditorTestReplies(turn.quickReplies);
  };

  const editorBotRespond = (fn: (s: SupportBotSession) => ReturnType<SupportBotSession['handleText']>) => {
    const s = getEditorSession();
    if (!s || !s.hasFlow()) {
      setEditorTyping(true);
      setTimeout(() => {
        setEditorTyping(false);
        setEditorTestMessages((prev) => [...prev, { sender: 'bot', text: 'No bot connected — the live widget hands this to your team. Connect a BotMap above to automate replies.', time: 'Just now' }]);
      }, 550);
      return;
    }
    setEditorTyping(true);
    setTimeout(() => {
      setEditorTyping(false);
      editorApplyTurn(fn(s));
    }, 600);
  };

  // ---- Embed code (real snippet: dist/widget.js served by the hosting target) ----
  const [embedModalWidget, setEmbedModalWidget] = useState<SupportChatWidgetConfig | null>(null);
  const [copiedEmbed, setCopiedEmbed] = useState(false);

  const getWidgetScriptUrl = () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://app.chatmize.com';
    return `${origin.replace(/\/$/, '')}/widget.js`;
  };

  const getEmbedCode = (w: SupportChatWidgetConfig) => {
    return `<!-- ChatMize Live Support Widget -->\n<script\n  src="${getWidgetScriptUrl()}"\n  data-workspace="${workspaceId}"\n  data-widget="${w.id}"\n  async>\n</script>`;
  };

  const addQuickReplyChip = () => {
    if (!editingWidget || !newReplyLabel.trim()) return;
    const newChip = {
      id: `qr-${Date.now().toString(36)}`,
      label: newReplyLabel.trim(),
      payload: newReplyLabel.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '')
    };
    setEditingWidget({ ...editingWidget, quickReplies: [...(editingWidget.quickReplies || []), newChip] });
    setNewReplyLabel('');
  };

  const publishedFlowInfo = (w: SupportChatWidgetConfig | null) => {
    const pf = (w as any)?.publishedFlow;
    if (pf && Array.isArray(pf.nodes)) return `${pf.nodes.length} steps published${pf.publishedAt ? ` · ${new Date(pf.publishedAt).toLocaleDateString()}` : ''}`;
    return 'No flow published yet';
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">

      {/* Top Header Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/95 to-slate-950 border border-white/10 relative overflow-hidden shadow-xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 text-xs font-semibold">
              <MessageSquare className="w-3.5 h-3.5 text-cyan-400" />
              <span>Dedicated Live Support Chat</span>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Support Chat Widget Manager</h1>
            <p className="text-sm text-slate-400 max-w-2xl">
              Build, style, and deploy 24/7 AI-driven live chat widgets to your website. Completely isolated from popups and banners.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {activeMode !== 'list' && (
              <button
                onClick={() => {
                  setEditingWidget(null);
                  persistMode('list');
                }}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-white/10 text-xs font-bold flex items-center gap-2 transition-all cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>All Support Widgets</span>
              </button>
            )}

            {activeMode === 'list' && (
              <button
                onClick={handleCreateNew}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-cyan-500/20"
              >
                <Plus className="w-4 h-4" />
                <span>New Support Chat Widget</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Firestore load states */}
      {widgetsLoading && (
        <div className="p-10 rounded-2xl bg-slate-900/80 border border-white/10 flex items-center justify-center gap-3 text-slate-400 text-sm">
          <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
          <span>Loading widgets from chatmize-prod…</span>
        </div>
      )}

      {widgetsError && !widgetsLoading && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3 text-sm">
          <AlertTriangle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-rose-300">Could not load support widgets</p>
            <p className="text-slate-400 text-xs mt-1">{widgetsError}</p>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODE 1: LIST VIEW
          ========================================================================= */}
      {activeMode === 'list' && !widgetsLoading && (
        <div className="space-y-6">

          {leadCapturedNotice && (
            <div className="p-3.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center justify-between animate-in slide-in-from-top-2 duration-200">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>{leadCapturedNotice}</span>
              </div>
              <span className="text-[11px] text-emerald-400/80">CRM Updated</span>
            </div>
          )}

          {showQuickGuide && (
            <div className="p-5 rounded-2xl bg-gradient-to-r from-cyan-950/40 via-slate-900 to-blue-950/40 border border-cyan-500/30 shadow-lg relative">
              <button
                onClick={() => setShowQuickGuide(false)}
                className="absolute top-3 right-3 text-slate-500 hover:text-white text-xs p-1"
                title="Dismiss guide"
              >
                ✕
              </button>

              <div className="flex items-center gap-2 pb-3 border-b border-white/10">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">How 24/7 Support Chat Works in 3 Steps</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3 text-xs">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-cyan-500 text-slate-950 font-bold flex items-center justify-center flex-shrink-0 text-xs">1</div>
                  <div>
                    <h4 className="font-bold text-white">Customize Branding</h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">Set your brand color, greeting messages, and quick starter buttons.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-500 text-white font-bold flex items-center justify-center flex-shrink-0 text-xs">2</div>
                  <div>
                    <h4 className="font-bold text-white">Attach a BotMap</h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">Route questions through your BotMap flow or straight to your team.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-500 text-slate-950 font-bold flex items-center justify-center flex-shrink-0 text-xs">3</div>
                  <div>
                    <h4 className="font-bold text-white">Paste 1-Line Embed Code</h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">Copy the snippet onto any website — the live widget loads from chatmize-prod.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Quick Metrics Bar (real Firestore counters) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-white/10 space-y-1">
              <span className="text-xs text-slate-400 font-medium">Total Chat Impressions</span>
              <p className="text-2xl font-black text-white">
                {widgets.reduce((acc, w) => acc + (w.totalViews || 0), 0).toLocaleString()}
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-white/10 space-y-1">
              <span className="text-xs text-slate-400 font-medium">Live Conversations</span>
              <p className="text-2xl font-black text-cyan-400">
                {widgets.reduce((acc, w) => acc + (w.totalConversations || 0), 0).toLocaleString()}
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-white/10 space-y-1">
              <span className="text-xs text-slate-400 font-medium">Captured Contact Leads</span>
              <p className="text-2xl font-black text-emerald-400">
                {widgets.reduce((acc, w) => acc + (w.totalLeads || 0), 0).toLocaleString()}
              </p>
            </div>
          </div>

          {widgets.length === 0 && (
            <div className="p-10 rounded-2xl bg-slate-900/80 border border-white/10 text-center space-y-3">
              <MessageSquare className="w-8 h-8 text-slate-600 mx-auto" />
              <p className="text-sm text-slate-400">No support widgets yet. Create your first one to get an embed code.</p>
              <button
                onClick={handleCreateNew}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 font-bold text-xs inline-flex items-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>New Support Chat Widget</span>
              </button>
            </div>
          )}

          {/* Widgets Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {widgets.map((widget) => {
              const connectedBotName = botDisplayName(widget);
              return (
                <div
                  key={widget.id}
                  className="bg-slate-900/80 border border-white/10 rounded-2xl p-5 hover:border-cyan-500/40 hover:bg-slate-900 transition-all flex flex-col justify-between group shadow-xl"
                >
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm"
                          style={{ backgroundColor: `${widget.brandColor}25`, color: widget.brandColor }}
                        >
                          <MessageSquare className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="text-base font-bold text-white group-hover:text-cyan-300 transition-colors">
                            {widget.name}
                          </h3>
                          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400">
                            <span className="capitalize">{(widget.position || 'bottom_right').replace('_', ' ')}</span>
                            <span>•</span>
                            <span>Auto-open: {(widget.autoOpenDelaySeconds || 0) > 0 ? `${widget.autoOpenDelaySeconds}s` : 'Manual click'}</span>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={(e) => handleToggleStatus(widget.id, e)}
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center gap-1.5 cursor-pointer transition-colors flex-shrink-0 ${
                          widget.status === 'active'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30'
                            : 'bg-slate-800 text-slate-400 border border-white/10 hover:bg-slate-700'
                        }`}
                        title={widget.status === 'active' ? 'Click to Pause' : 'Click to Activate'}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${widget.status === 'active' ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                        <span className="capitalize">{widget.status}</span>
                      </button>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-950/70 border border-white/5 space-y-1">
                      <p className="text-xs text-white font-medium">{widget.headline}</p>
                      <p className="text-[11px] text-slate-400 line-clamp-2">{widget.welcomeMessage}</p>
                    </div>

                    <div className="flex items-center justify-between text-xs py-2 px-3 rounded-xl bg-white/5 border border-white/5">
                      <div className="flex items-center gap-2 text-slate-300 min-w-0">
                        <Bot className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
                        <span className="truncate">{connectedBotName}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400 flex-shrink-0">
                        <span>{(widget.quickReplies || []).length} Quick Replies</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="p-2 rounded-xl bg-slate-950/60 border border-white/5">
                        <span className="text-[10px] text-slate-500 block">Views</span>
                        <span className="text-xs font-bold text-white">{(widget.totalViews || 0).toLocaleString()}</span>
                      </div>
                      <div className="p-2 rounded-xl bg-slate-950/60 border border-white/5">
                        <span className="text-[10px] text-slate-500 block">Chats</span>
                        <span className="text-xs font-bold text-cyan-300">{(widget.totalConversations || 0).toLocaleString()}</span>
                      </div>
                      <div className="p-2 rounded-xl bg-slate-950/60 border border-white/5">
                        <span className="text-[10px] text-slate-500 block">Leads</span>
                        <span className="text-xs font-bold text-emerald-400">{(widget.totalLeads || 0).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-white/10 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
                    <button
                      onClick={() => {
                        persistSelected(widget.id);
                        resetSimulator(widget);
                        persistMode('preview');
                      }}
                      className="py-2 px-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md shadow-cyan-500/20"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Test Live Chat</span>
                    </button>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleEdit(widget)}
                        className="py-2 px-3 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                      >
                        <Settings2 className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Customize</span>
                      </button>

                      <button
                        onClick={() => setEmbedModalWidget(widget)}
                        className="py-2 px-3 bg-white/5 hover:bg-white/10 text-cyan-300 border border-white/10 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                        title="Get Embed Code"
                      >
                        <Code className="w-3.5 h-3.5" />
                        <span>Embed</span>
                      </button>

                      <button
                        onClick={(e) => handleDuplicate(widget, e)}
                        className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-xl border border-transparent hover:border-white/10 transition-colors cursor-pointer"
                        title="Duplicate Widget"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={(e) => handleDelete(widget.id, e)}
                        className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-colors cursor-pointer"
                        title="Delete Widget"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =========================================================================
          MODE 2: DEDICATED SUPPORT CHAT EDITOR
          ========================================================================= */}
      {activeMode === 'editor' && editingWidget && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

          {/* Left Column: Settings Form (7 cols) */}
          <div className="lg:col-span-7 bg-slate-900/90 border border-white/10 rounded-2xl p-6 space-y-6 shadow-xl">

            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div>
                <h2 className="text-lg font-bold text-white">Edit Support Chat Widget</h2>
                <p className="text-xs text-slate-400">Configure appearance, chat behavior, and BotMap connection. Saving publishes the bot flow to the live widget.</p>
              </div>
              <span className="text-xs px-2.5 py-1 rounded-full bg-cyan-500/10 text-cyan-300 font-mono">
                {editingWidget.id}
              </span>
            </div>

            {/* Quick-Jump Section Navigation */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs" style={{ scrollbarWidth: 'none' }}>
              <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mr-1">Scroll to:</span>
              {[
                ['section-branding', 'Branding'],
                ['section-avatar', 'Bot & Avatar'],
                ['section-messages', 'Welcome Message'],
                ['section-replies', 'Quick Replies'],
                ['section-leadcapture', 'Lead Form'],
                ['section-domains', 'Domains'],
              ].map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                  className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-cyan-300 border border-white/10 text-[11px] whitespace-nowrap transition-colors cursor-pointer"
                >
                  {label}
                </button>
              ))}
            </div>

            {/* 1-Click Preset Templates */}
            <div id="section-templates" className="p-4 rounded-xl bg-slate-950/60 border border-white/5 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                  <span>1-Click Preset Templates</span>
                </label>
                <span className="text-[10px] text-slate-400">Autofill content, branding &amp; replies</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {WIDGET_TEMPLATES.map((tmpl) => (
                  <button
                    key={tmpl.name}
                    type="button"
                    onClick={() => {
                      setEditingWidget({
                        ...editingWidget,
                        headline: tmpl.headline,
                        subheadline: tmpl.subheadline,
                        welcomeMessage: tmpl.welcomeMessage,
                        brandColor: tmpl.brandColor,
                        botName: tmpl.botName,
                        quickReplies: tmpl.quickReplies
                      });
                    }}
                    className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-850 border border-white/10 hover:border-cyan-500/50 text-left transition-all cursor-pointer group shadow-sm"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: tmpl.brandColor }} />
                      <span className="text-xs font-bold text-slate-200 group-hover:text-cyan-300 truncate">
                        {tmpl.name}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 line-clamp-1 mt-1">
                      {tmpl.subheadline}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Widget Name & Status */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Widget Name</label>
                <input data-no-emoji
                  type="text"
                  value={editingWidget.name}
                  onChange={(e) => setEditingWidget({ ...editingWidget, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-xs text-white focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Widget Status</label>
                <select
                  value={editingWidget.status}
                  onChange={(e) => setEditingWidget({ ...editingWidget, status: e.target.value as any })}
                  className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-xs text-white focus:border-cyan-500 focus:outline-none"
                >
                  <option value="active">Active (Serving Visitors)</option>
                  <option value="paused">Paused</option>
                  <option value="draft">Draft</option>
                </select>
              </div>
            </div>

            {/* Visual Branding & Colors */}
            <div id="section-branding" className="space-y-3 p-4 rounded-xl bg-slate-950/60 border border-white/5">
              <div className="flex items-center gap-2 text-xs font-bold text-white">
                <Palette className="w-4 h-4 text-cyan-400" />
                <span>Branding &amp; Appearance</span>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] text-slate-400">Brand Color Accent</label>
                <div className="flex items-center gap-2 flex-wrap">
                  {COLOR_PRESETS.map((color) => (
                    <button
                      key={color.hex}
                      type="button"
                      onClick={() => setEditingWidget({ ...editingWidget, brandColor: color.hex })}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2 border transition-all cursor-pointer ${
                        editingWidget.brandColor === color.hex
                          ? 'border-white text-white font-bold bg-white/10'
                          : 'border-white/10 text-slate-400 hover:border-white/20'
                      }`}
                    >
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: color.hex }} />
                      <span>{color.name}</span>
                    </button>
                  ))}
                  <input
                    type="color"
                    value={editingWidget.brandColor}
                    onChange={(e) => setEditingWidget({ ...editingWidget, brandColor: e.target.value })}
                    className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                    title="Custom hex picker"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="space-y-1.5">
                  <label className="text-[11px] text-slate-400">Screen Position</label>
                  <select
                    value={editingWidget.position}
                    onChange={(e) => setEditingWidget({ ...editingWidget, position: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-xs text-white focus:border-cyan-500 focus:outline-none"
                  >
                    <option value="bottom_right">Bottom Right Corner (Standard)</option>
                    <option value="bottom_left">Bottom Left Corner</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] text-slate-400">Launcher Icon</label>
                  <select
                    value={editingWidget.launcherIcon}
                    onChange={(e) => setEditingWidget({ ...editingWidget, launcherIcon: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-xs text-white focus:border-cyan-500 focus:outline-none"
                  >
                    <option value="chat">Chat Bubble</option>
                    <option value="headset">Support Headset</option>
                    <option value="sparkle">AI Sparkle</option>
                    <option value="bot">Robot Icon</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] text-slate-400">Launcher Button Text</label>
                <input
                  type="text"
                  value={editingWidget.launcherText || ''}
                  onChange={(e) => setEditingWidget({ ...editingWidget, launcherText: e.target.value })}
                  placeholder="Chat with Us"
                  className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-xs text-white focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] text-slate-400">Auto-Open After (seconds, 0 = manual click only)</label>
                <input
                  type="number"
                  min={0}
                  max={120}
                  value={editingWidget.autoOpenDelaySeconds || 0}
                  onChange={(e) => setEditingWidget({ ...editingWidget, autoOpenDelaySeconds: Math.max(0, Number(e.target.value) || 0) })}
                  className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-xs text-white focus:border-cyan-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Connected Bot & Assistant Profile */}
            <div id="section-avatar" className="space-y-3 p-4 rounded-xl bg-slate-950/60 border border-white/5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-white">
                  <Bot className="w-4 h-4 text-cyan-400" />
                  <span>BotMap Engine &amp; Representative</span>
                </div>
                {editingWidget.connectedBotId && onNavigateToFlows && (
                  <button
                    type="button"
                    onClick={() => onNavigateToFlows(editingWidget.connectedBotId)}
                    className="text-[11px] text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Workflow className="w-3.5 h-3.5" />
                    <span>Open in BotMaps</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] text-slate-400">Connected BotMap</label>
                  <select
                    value={editingWidget.connectedBotId || ''}
                    onChange={(e) => {
                      setEditingWidget({ ...editingWidget, connectedBotId: e.target.value });
                      editorSessionKey.current = '';
                    }}
                    className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-xs text-white focus:border-cyan-500 focus:outline-none"
                  >
                    <option value="">None — hand every chat to the team</option>
                    {bots.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] text-slate-400">Representative Display Name</label>
                  <input
                    type="text"
                    value={editingWidget.botName}
                    onChange={(e) => setEditingWidget({ ...editingWidget, botName: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-xs text-white focus:border-cyan-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-cyan-500/5 border border-cyan-500/20 text-[11px] text-slate-400">
                <span className="text-cyan-300 font-semibold">Published flow: </span>
                {publishedFlowInfo(editingWidget as SupportChatWidgetConfig)}
                <span className="block mt-1 text-slate-500">Saving this widget snapshots the connected BotMap into the live widget, so visitors get the current flow. AI steps are answered by the backend AI worker; everything else runs instantly.</span>
              </div>

              <div className="space-y-1.5">
                <ImageUpload
                  label="Avatar Image"
                  value={editingWidget.avatarUrl}
                  onChange={(url) => setEditingWidget({ ...editingWidget, avatarUrl: url })}
                  accentClass="focus-within:border-cyan-500"
                />
              </div>
            </div>

            {/* Messages & Greetings */}
            <div id="section-messages" className="space-y-3 p-4 rounded-xl bg-slate-950/60 border border-white/5">
              <div className="flex items-center gap-2 text-xs font-bold text-white">
                <MessageSquare className="w-4 h-4 text-cyan-400" />
                <span>Greeting &amp; Welcome Messages</span>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] text-slate-400">Header Headline</label>
                <div className="relative">
                  <input
                    type="text"
                    ref={headlineEmoji.ref}
                    value={editingWidget.headline}
                    onChange={(e) => setEditingWidget({ ...editingWidget, headline: e.target.value })}
                    className="w-full pl-3 pr-9 py-2 bg-slate-950 border border-white/10 rounded-xl text-xs text-white focus:border-cyan-500 focus:outline-none"
                  />
                  <span className="absolute right-1 top-1/2 -translate-y-1/2">
                    <EmojiPickerButton onPick={(e) => headlineEmoji.insert(e, editingWidget.headline, (v) => setEditingWidget({ ...editingWidget, headline: v }))} placement="up" />
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] text-slate-400">Header Subheadline</label>
                <div className="relative">
                  <input
                    type="text"
                    ref={subheadlineEmoji.ref}
                    value={editingWidget.subheadline}
                    onChange={(e) => setEditingWidget({ ...editingWidget, subheadline: e.target.value })}
                    className="w-full pl-3 pr-9 py-2 bg-slate-950 border border-white/10 rounded-xl text-xs text-white focus:border-cyan-500 focus:outline-none"
                  />
                  <span className="absolute right-1 top-1/2 -translate-y-1/2">
                    <EmojiPickerButton onPick={(e) => subheadlineEmoji.insert(e, editingWidget.subheadline, (v) => setEditingWidget({ ...editingWidget, subheadline: v }))} placement="up" />
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] text-slate-400">Initial Welcome Message (Chat Bubble)</label>
                <div className="relative">
                  <textarea
                    rows={2}
                    ref={welcomeEmoji.ref}
                    value={editingWidget.welcomeMessage}
                    onChange={(e) => setEditingWidget({ ...editingWidget, welcomeMessage: e.target.value })}
                    className="w-full px-3 py-2 pr-9 bg-slate-950 border border-white/10 rounded-xl text-xs text-white focus:border-cyan-500 focus:outline-none"
                  />
                  <span className="absolute right-1.5 bottom-1.5">
                    <EmojiPickerButton onPick={(e) => welcomeEmoji.insert(e, editingWidget.welcomeMessage, (v) => setEditingWidget({ ...editingWidget, welcomeMessage: v }))} placement="up" />
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Reply Starter Buttons */}
            <div id="section-replies" className="space-y-3 p-4 rounded-xl bg-slate-950/60 border border-white/5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-white">Quick Reply Starter Options</label>
                <span className="text-[10px] text-slate-400">{(editingWidget.quickReplies || []).length} chips configured</span>
              </div>
              <p className="text-[11px] text-slate-500">Chips route into the connected BotMap by payload — tapping one follows the matching flow step. Without a bot, the tap hands the chat to your team.</p>

              <div className="flex items-center gap-2 flex-wrap">
                {(editingWidget.quickReplies || []).map((reply, idx) => (
                  <div
                    key={reply.id}
                    className="px-2.5 py-1 rounded-lg bg-slate-900 border border-white/10 text-xs text-slate-200 flex items-center gap-1.5"
                    title={`Payload: ${reply.payload}`}
                  >
                    <span>{reply.label}</span>
                    <button
                      type="button"
                      onClick={() => {
                        const updatedReplies = (editingWidget.quickReplies || []).filter((_, i) => i !== idx);
                        setEditingWidget({ ...editingWidget, quickReplies: updatedReplies });
                      }}
                      className="text-slate-500 hover:text-rose-400 transition-colors ml-1"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2 pt-1">
                <div className="relative flex-1">
                  <input
                    type="text"
                    placeholder="e.g. Schedule a Demo"
                    ref={chipEmoji.ref}
                    value={newReplyLabel}
                    onChange={(e) => setNewReplyLabel(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addQuickReplyChip();
                      }
                    }}
                    className="w-full pl-3 pr-9 py-1.5 bg-slate-950 border border-white/10 rounded-xl text-xs text-white focus:border-cyan-500 focus:outline-none"
                  />
                  <span className="absolute right-1 top-1/2 -translate-y-1/2">
                    <EmojiPickerButton onPick={(e) => chipEmoji.insert(e, newReplyLabel, setNewReplyLabel)} placement="up" />
                  </span>
                </div>
                <button
                  type="button"
                  onClick={addQuickReplyChip}
                  className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Add Chip
                </button>
              </div>
            </div>

            {/* Lead Capture Settings */}
            <div id="section-leadcapture" className="space-y-3 p-4 rounded-xl bg-slate-950/60 border border-white/5">
              <div className="flex items-center gap-2 text-xs font-bold text-white">
                <UserCheck className="w-4 h-4 text-cyan-400" />
                <span>Pre-Chat Lead Form Fields</span>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {([
                  ['requireEmailCapture', 'Require Email'],
                  ['requireNameCapture', 'Require Name'],
                  ['requirePhoneCapture', 'Phone Number'],
                ] as const).map(([key, label]) => (
                  <label key={key} className="p-2.5 rounded-xl bg-slate-900 border border-white/10 flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!editingWidget[key]}
                      onChange={(e) => setEditingWidget({ ...editingWidget, [key]: e.target.checked })}
                      className="rounded border-slate-700 text-cyan-500 focus:ring-0"
                    />
                    <span className="text-xs text-slate-300">{label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Domain Allowlist */}
            <div id="section-domains" className="space-y-3 p-4 rounded-xl bg-slate-950/60 border border-white/5">
              <div className="flex items-center gap-2 text-xs font-bold text-white">
                <Globe className="w-4 h-4 text-cyan-400" />
                <span>Allowed Domains</span>
              </div>
              <p className="text-[11px] text-slate-500">The widget only renders on these domains. Use <span className="font-mono text-slate-300">*.example.com</span> for subdomains. Leave empty to allow everywhere.</p>
              <div className="flex items-center gap-2 flex-wrap">
                {(editingWidget.whitelistedDomains || []).map((d, idx) => (
                  <div key={idx} className="px-2.5 py-1 rounded-lg bg-slate-900 border border-white/10 text-xs text-slate-200 flex items-center gap-1.5 font-mono">
                    <span>{d}</span>
                    <button
                      type="button"
                      onClick={() => setEditingWidget({ ...editingWidget, whitelistedDomains: (editingWidget.whitelistedDomains || []).filter((_, i) => i !== idx) })}
                      className="text-slate-500 hover:text-rose-400 transition-colors ml-1"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <div className="relative">
                <input
                  type="text"
                  placeholder="e.g. *.myshop.com — press Enter to add"
                  ref={domainEmoji.ref}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const v = (e.target as HTMLInputElement).value.trim().toLowerCase();
                      if (v && !(editingWidget.whitelistedDomains || []).includes(v)) {
                        setEditingWidget({ ...editingWidget, whitelistedDomains: [...(editingWidget.whitelistedDomains || []), v] });
                      }
                      (e.target as HTMLInputElement).value = '';
                    }
                  }}
                  className="w-full px-3 py-1.5 bg-slate-950 border border-white/10 rounded-xl text-xs text-white focus:border-cyan-500 focus:outline-none font-mono"
                />
              </div>
            </div>

            {/* Bottom Save Action */}
            <div id="section-save" className="pt-4 border-t border-white/10 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setEditingWidget(null);
                  persistMode('list');
                }}
                className="px-4 py-2 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => handleSave(editingWidget)}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-cyan-500/20"
              >
                <Check className="w-4 h-4" />
                <span>Save &amp; Publish Widget</span>
              </button>
            </div>

          </div>

          {/* Right Column: Live Chat Visual Preview (5 cols) */}
          <div className="lg:col-span-5 sticky top-4 space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-400 px-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-white">Live Widget Preview</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 font-mono">Real-time</span>
              </div>

              <div className="flex items-center gap-1 bg-slate-900 border border-white/10 p-0.5 rounded-xl">
                <button
                  type="button"
                  onClick={() => setEditorPreviewMode('elevated')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all flex items-center gap-1 cursor-pointer ${
                    editorPreviewMode === 'elevated'
                      ? 'bg-cyan-500 text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Elevated view: Widget sits high in the screen for immediate viewing while editing"
                >
                  <ArrowUp className="w-3 h-3" />
                  <span>Elevated</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEditorPreviewMode('corner')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all flex items-center gap-1 cursor-pointer ${
                    editorPreviewMode === 'corner'
                      ? 'bg-cyan-500 text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Corner view: Bottom-anchored inside website mockup"
                >
                  <Layout className="w-3 h-3" />
                  <span>Corner</span>
                </button>
              </div>
            </div>

            {/* Mock Browser Container */}
            <div className="rounded-2xl border border-white/10 bg-slate-950 overflow-hidden shadow-2xl relative flex flex-col max-h-[calc(100vh-100px)]">

              <div className="flex items-center justify-between px-3 py-2 bg-slate-900 border-b border-white/10 text-[11px] text-slate-400">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500/70" />
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500/70" />
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/70" />
                </div>

                <div className="flex items-center gap-1 px-3 py-0.5 rounded-full bg-slate-950 text-[10px] font-mono text-slate-300 border border-white/5">
                  <span className="text-emerald-400">🔒</span>
                  <span>https://yourwebsite.com</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditorTestMessages([]);
                      setEditorTestInput('');
                      setEditorTestReplies([]);
                      editorSessionKey.current = '';
                    }}
                    className="text-[10px] text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
                    title="Reset test conversation"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset</span>
                  </button>
                </div>
              </div>

              <div className="overflow-y-auto p-4 flex-1 space-y-4" style={{ minHeight: '480px' }}>

                {editorPreviewMode === 'elevated' ? (
                  <div className="space-y-4">
                    {editorChatOpen ? (
                      <div className="w-full max-w-sm mx-auto rounded-2xl border border-white/15 bg-slate-900 shadow-2xl overflow-hidden flex flex-col transition-all">
                        <div
                          className="p-3.5 flex items-center justify-between text-white transition-colors"
                          style={{ backgroundColor: editingWidget.brandColor }}
                        >
                          <div className="flex items-center gap-2.5">
                            {editingWidget.avatarUrl ? (
                              <img
                                src={editingWidget.avatarUrl}
                                alt={editingWidget.botName}
                                className="w-9 h-9 rounded-full object-cover border-2 border-white/30 shadow-sm"
                              />
                            ) : (
                              <div className="w-9 h-9 rounded-full bg-black/25 border-2 border-white/30 flex items-center justify-center">
                                <Bot className="w-4 h-4 text-white" />
                              </div>
                            )}
                            <div>
                              <h4 className="text-xs font-bold leading-tight drop-shadow-sm">{editingWidget.headline || 'How can we help?'}</h4>
                              <p className="text-[10px] opacity-90 mt-0.5 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
                                <span>{editingWidget.botName || 'Support'}</span>
                                <span>• Active</span>
                              </p>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => setEditorChatOpen(false)}
                            className="p-1 rounded-lg bg-black/20 hover:bg-black/30 text-white transition-colors cursor-pointer"
                            title="Minimize to launcher bubble"
                          >
                            <Minimize2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {editingWidget.subheadline && (
                          <div className="px-3 py-1.5 bg-slate-950/80 border-b border-white/5 text-[10px] text-slate-400">
                            {editingWidget.subheadline}
                          </div>
                        )}

                        <div className="p-3.5 space-y-3 bg-slate-950/60 max-h-[220px] overflow-y-auto">
                          <div className="p-3 rounded-2xl bg-slate-900 border border-white/10 text-xs text-slate-200 max-w-[90%] rounded-tl-none leading-relaxed shadow-sm">
                            {editingWidget.welcomeMessage || 'Hi there! How can we help you today?'}
                          </div>

                          {editorTestMessages.map((msg, idx) => (
                            <div key={idx} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                              <div
                                className={`p-2.5 rounded-2xl text-xs max-w-[85%] leading-relaxed ${
                                  msg.sender === 'user'
                                    ? 'bg-cyan-500 text-slate-950 font-medium rounded-tr-none shadow-sm'
                                    : 'bg-slate-900 border border-white/10 text-slate-200 rounded-tl-none'
                                }`}
                              >
                                {msg.text}
                              </div>
                            </div>
                          ))}

                          {editorTyping && (
                            <div className="flex items-center gap-1.5 p-3 rounded-2xl bg-slate-900 border border-white/10 w-20">
                              <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce" />
                              <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                              <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                            </div>
                          )}

                          {(editorTestReplies.length > 0 ? editorTestReplies : (editingWidget.quickReplies || []).map((q) => ({ label: q.label, payload: q.payload }))).length > 0 && (
                            <div className="pt-1">
                              <p className="text-[10px] text-slate-400 mb-1.5 font-medium">Quick options:</p>
                              <div className="flex flex-wrap gap-1.5">
                                {(editorTestReplies.length > 0 ? editorTestReplies : (editingWidget.quickReplies || []).map((q) => ({ label: q.label, payload: q.payload }))).map((qr, i) => (
                                  <button
                                    key={`${qr.payload}-${i}`}
                                    type="button"
                                    onClick={() => {
                                      setEditorTestMessages((prev) => [...prev, { sender: 'user', text: qr.label, time: 'Just now' }]);
                                      setEditorTestReplies([]);
                                      editorBotRespond((s) => s.handlePayload(qr.payload, qr.label));
                                    }}
                                    className="py-1.5 px-3 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-cyan-500/30 text-[11px] font-medium text-cyan-300 text-left transition-all cursor-pointer shadow-sm active:scale-95"
                                    title={`Routes into the BotMap via payload ${qr.payload}`}
                                  >
                                    {qr.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            if (editorTestInput.trim()) {
                              const text = editorTestInput.trim();
                              setEditorTestMessages((prev) => [...prev, { sender: 'user', text, time: 'Just now' }]);
                              setEditorTestInput('');
                              setEditorTestReplies([]);
                              editorBotRespond((s) => s.handleText(text));
                            }
                          }}
                          className="p-2.5 bg-slate-900 border-t border-white/10 flex items-center gap-2"
                        >
                          <input
                            type="text"
                            value={editorTestInput}
                            onChange={(e) => setEditorTestInput(e.target.value)}
                            placeholder="Test typing a response..."
                            className="flex-1 bg-slate-950 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                          />
                          <button
                            type="submit"
                            className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-950 transition-transform active:scale-95 cursor-pointer font-bold"
                            style={{ backgroundColor: editingWidget.brandColor }}
                          >
                            <Send className="w-3.5 h-3.5" />
                          </button>
                        </form>
                      </div>
                    ) : (
                      <div className="p-4 rounded-xl bg-slate-900 border border-white/10 text-center space-y-2">
                        <p className="text-xs text-slate-300">Widget window is currently minimized.</p>
                        <button
                          type="button"
                          onClick={() => setEditorChatOpen(true)}
                          className="px-3 py-1.5 rounded-lg bg-cyan-500/20 text-cyan-300 text-xs font-semibold hover:bg-cyan-500/30 transition-colors cursor-pointer"
                        >
                          Click to expand chat window
                        </button>
                      </div>
                    )}

                    <div className="pt-2 border-t border-white/5 flex flex-col items-center gap-2">
                      <div className="flex items-center justify-between w-full px-2 text-[11px] text-slate-400">
                        <span>Launcher Button Preview:</span>
                        <span className="text-cyan-400 font-mono">
                          {editingWidget.position === 'bottom_left' ? '📍 Bottom Left' : '📍 Bottom Right'}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => setEditorChatOpen(!editorChatOpen)}
                        className="px-4 py-2.5 rounded-full flex items-center gap-2 shadow-xl text-slate-950 font-bold text-xs cursor-pointer transition-transform hover:scale-105"
                        style={{ backgroundColor: editingWidget.brandColor }}
                      >
                        {editingWidget.launcherIcon === 'headset' ? (
                          <Headphones className="w-4 h-4" />
                        ) : editingWidget.launcherIcon === 'sparkle' ? (
                          <Sparkles className="w-4 h-4" />
                        ) : editingWidget.launcherIcon === 'bot' ? (
                          <Bot className="w-4 h-4" />
                        ) : (
                          <MessageSquare className="w-4 h-4" />
                        )}
                        <span>{editingWidget.launcherText || 'Chat with Us'}</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="relative min-h-[460px] flex flex-col justify-between">
                    <div className="space-y-3 opacity-20 select-none pointer-events-none">
                      <div className="h-4 w-32 bg-slate-700 rounded-full" />
                      <div className="h-8 w-64 bg-slate-800 rounded-lg" />
                      <div className="h-16 w-full bg-slate-900 rounded-xl" />
                      <div className="grid grid-cols-2 gap-2">
                        <div className="h-14 bg-slate-900 rounded-lg" />
                        <div className="h-14 bg-slate-900 rounded-lg" />
                      </div>
                    </div>

                    <div className={`space-y-3 ${editingWidget.position === 'bottom_left' ? 'mr-auto' : 'ml-auto'} max-w-xs w-full`}>
                      {editorChatOpen && (
                        <div className="rounded-2xl border border-white/10 bg-slate-900 shadow-2xl overflow-hidden flex flex-col">
                          <div
                            className="p-3 flex items-center justify-between text-white"
                            style={{ backgroundColor: editingWidget.brandColor }}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              {editingWidget.avatarUrl ? (
                                <img
                                  src={editingWidget.avatarUrl}
                                  alt={editingWidget.botName}
                                  className="w-7 h-7 rounded-full object-cover border border-white/30"
                                />
                              ) : (
                                <div className="w-7 h-7 rounded-full bg-black/25 border border-white/30 flex items-center justify-center">
                                  <Bot className="w-3.5 h-3.5 text-white" />
                                </div>
                              )}
                              <span className="text-xs font-bold leading-tight truncate">{editingWidget.headline}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => setEditorChatOpen(false)}
                              className="text-white/80 hover:text-white cursor-pointer"
                            >
                              <Minimize2 className="w-3 h-3" />
                            </button>
                          </div>
                          <div className="p-3 bg-slate-950/70 text-xs text-slate-200 space-y-2">
                            <p>{editingWidget.welcomeMessage}</p>
                            {(editingWidget.quickReplies || []).length > 0 && (
                              <div className="flex flex-wrap gap-1.5 pt-1">
                                {(editingWidget.quickReplies || []).map((qr) => (
                                  <button
                                    key={qr.id}
                                    type="button"
                                    onClick={() => {
                                      setEditorTestMessages((prev) => [...prev, { sender: 'user', text: qr.label, time: 'Just now' }]);
                                      editorBotRespond((s) => s.handlePayload(qr.payload, qr.label));
                                    }}
                                    className="py-1 px-2.5 rounded-lg bg-slate-900 border border-cyan-500/30 text-[10px] font-medium text-cyan-300 cursor-pointer hover:bg-slate-800"
                                    title={`Routes into the BotMap via payload ${qr.payload}`}
                                  >
                                    {qr.label}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      <div className={`flex ${editingWidget.position === 'bottom_left' ? 'justify-start' : 'justify-end'}`}>
                        <button
                          type="button"
                          onClick={() => setEditorChatOpen(!editorChatOpen)}
                          className="px-4 py-2 rounded-full flex items-center gap-2 shadow-xl text-slate-950 font-bold text-xs cursor-pointer"
                          style={{ backgroundColor: editingWidget.brandColor }}
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>{editingWidget.launcherText || 'Chat'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

              </div>

              <div className="p-2.5 bg-slate-900/90 border-t border-white/10 flex items-center justify-between px-3 text-[11px]">
                <span className="text-slate-400">Want full mobile &amp; desktop testing?</span>
                <button
                  type="button"
                  onClick={() => {
                    if (editingWidget) {
                      persistSelected(editingWidget.id);
                      resetSimulator(editingWidget);
                    }
                    persistMode('preview');
                  }}
                  className="text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <span>Open Full Simulator</span>
                  <Eye className="w-3 h-3" />
                </button>
              </div>

            </div>
          </div>

        </div>
      )}

      {/* =========================================================================
          MODE 3: INTERACTIVE SIMULATOR (TEST LIVE RESPONSES)
          ========================================================================= */}
      {activeMode === 'preview' && currentWidget && (
        <div className="space-y-4">

          <div className="flex items-center justify-between p-4 bg-slate-900 border border-white/10 rounded-2xl">
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-400">Simulating Widget:</span>
              <span className="text-xs font-bold text-white">{currentWidget.name}</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 font-mono">
                {currentWidget.connectedBotId ? `BotMap: ${botDisplayName(currentWidget)}` : 'No bot — agent handoff'}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center p-1 rounded-xl bg-slate-950 border border-white/10">
                <button
                  onClick={() => setSimDevice('desktop')}
                  className={`p-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                    simDevice === 'desktop' ? 'bg-cyan-500/20 text-cyan-300 font-bold' : 'text-slate-400'
                  }`}
                >
                  <Layout className="w-3.5 h-3.5" />
                  <span>Desktop</span>
                </button>
                <button
                  onClick={() => setSimDevice('mobile')}
                  className={`p-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                    simDevice === 'mobile' ? 'bg-cyan-500/20 text-cyan-300 font-bold' : 'text-slate-400'
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Mobile</span>
                </button>
              </div>

              <button
                onClick={() => resetSimulator(currentWidget)}
                className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                title="Restart the test conversation"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restart</span>
              </button>

              <button
                onClick={() => setEmbedModalWidget(currentWidget)}
                className="px-3 py-1.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Code className="w-3.5 h-3.5" />
                <span>Get Embed Code</span>
              </button>
            </div>
          </div>

          {/* Interactive Simulation Frame */}
          <div className={`mx-auto transition-all ${simDevice === 'mobile' ? 'max-w-sm' : 'max-w-4xl'}`}>
            <div className="rounded-2xl border border-white/10 bg-slate-950 overflow-hidden shadow-2xl min-h-[580px] flex flex-col justify-between p-6 relative">

              <div className="space-y-4 opacity-20 pointer-events-none select-none">
                <div className="h-6 w-48 bg-slate-600 rounded-full" />
                <div className="h-10 w-96 bg-slate-700 rounded-lg" />
                <div className="h-32 w-full bg-slate-800 rounded-2xl" />
              </div>

              {isSimOpen && (
                <div className="w-full max-w-sm ml-auto rounded-2xl border border-white/10 bg-slate-900 shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">

                  <div
                    className="p-4 flex items-center justify-between text-white"
                    style={{ backgroundColor: currentWidget.brandColor }}
                  >
                    <div className="flex items-center gap-2.5">
                      {currentWidget.avatarUrl ? (
                        <img
                          src={currentWidget.avatarUrl}
                          alt={currentWidget.botName}
                          className="w-8 h-8 rounded-full object-cover border border-white/30"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-black/25 border border-white/30 flex items-center justify-center">
                          <Bot className="w-4 h-4 text-white" />
                        </div>
                      )}
                      <div>
                        <h4 className="text-xs font-bold leading-tight">{currentWidget.headline}</h4>
                        <span className="text-[10px] opacity-80">{currentWidget.botName}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => setIsSimOpen(false)}
                      className="text-white/80 hover:text-white text-xs font-bold p-1"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="p-4 space-y-3 h-72 overflow-y-auto bg-slate-950/70 text-xs">
                    {simMessages.map((msg, i) => (
                      <div
                        key={i}
                        className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
                      >
                        <div
                          className={`p-3 rounded-2xl max-w-[85%] ${
                            msg.sender === 'user'
                              ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 font-medium rounded-tr-none'
                              : 'bg-slate-900 border border-white/10 text-slate-200 rounded-tl-none'
                          }`}
                        >
                          {msg.text}
                        </div>
                        <span className="text-[9px] text-slate-500 mt-1 px-1">{msg.time}</span>
                      </div>
                    ))}

                    {isSimTyping && (
                      <div className="flex items-center gap-1.5 p-3 rounded-2xl bg-slate-900 border border-white/10 text-slate-400 w-20">
                        <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    )}

                    {simQuickReplies.length > 0 && !isSimTyping && (
                      <div className="flex flex-col gap-1.5 pt-2">
                        {simQuickReplies.map((qr, i) => (
                          <button
                            key={`${qr.payload}-${i}`}
                            onClick={() => handleSimReplyClick(qr)}
                            className="py-1.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-white/10 text-[11px] font-medium text-cyan-300 text-left transition-all cursor-pointer"
                            title={`Routes into the BotMap via payload ${qr.payload}`}
                          >
                            {qr.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="px-3 pt-2 pb-1 bg-slate-900/80 border-t border-white/5 flex items-center gap-1.5 overflow-x-auto">
                    <span className="text-[10px] text-slate-500 whitespace-nowrap">Try asking:</span>
                    {['What are your prices?', 'Talk to an agent', 'Do you offer a discount?'].map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => setSimInput(prompt)}
                        className="text-[10px] px-2 py-0.5 rounded-md bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 whitespace-nowrap cursor-pointer hover:text-cyan-300"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>

                  <form onSubmit={handleSimSend} className="p-3 bg-slate-900 border-t border-white/10 flex items-center gap-2">
                    <input
                      type="text"
                      value={simInput}
                      onChange={(e) => setSimInput(e.target.value)}
                      placeholder="Type a message to test the BotMap routing..."
                      className="flex-1 px-3 py-1.5 bg-slate-950 border border-white/10 rounded-xl text-xs text-white focus:border-cyan-500 focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={isSimTyping}
                      className="p-2 rounded-xl text-slate-950 font-bold transition-all cursor-pointer disabled:opacity-50"
                      style={{ backgroundColor: currentWidget.brandColor }}
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </form>

                </div>
              )}

              <div className={`flex ${currentWidget.position === 'bottom_left' ? 'justify-start' : 'justify-end'}`}>
                <button
                  onClick={() => setIsSimOpen(!isSimOpen)}
                  className="px-4 py-2.5 rounded-full flex items-center gap-2 shadow-2xl text-slate-950 font-bold text-xs cursor-pointer hover:scale-105 transition-transform"
                  style={{ backgroundColor: currentWidget.brandColor }}
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>{isSimOpen ? 'Close Chat' : (currentWidget.launcherText || 'Chat with Us')}</span>
                </button>
              </div>

            </div>
          </div>

        </div>
      )}

      {/* =========================================================================
          EMBED CODE MODAL
          ========================================================================= */}
      {embedModalWidget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-xl bg-slate-900 border border-white/10 rounded-2xl p-6 shadow-2xl space-y-5">

            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                  <Code className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Embed Support Chat Widget</h3>
                  <p className="text-xs text-slate-400">Paste this single tag right before the closing &lt;/body&gt; tag of your site.</p>
                </div>
              </div>

              <button
                onClick={() => setEmbedModalWidget(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="relative">
              <pre className="p-4 rounded-xl bg-slate-950 border border-white/10 text-xs font-mono text-cyan-300 overflow-x-auto whitespace-pre">
                {getEmbedCode(embedModalWidget)}
              </pre>

              <button
                onClick={() => {
                  navigator.clipboard.writeText(getEmbedCode(embedModalWidget));
                  setCopiedEmbed(true);
                  setTimeout(() => setCopiedEmbed(false), 2000);
                }}
                className="absolute top-3 right-3 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
              >
                {copiedEmbed ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedEmbed ? 'Copied!' : 'Copy Snippet'}</span>
              </button>
            </div>

            <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-xs text-slate-300 space-y-1">
              <span className="font-bold text-cyan-300 block">What the snippet does:</span>
              <p className="text-slate-400">Loads <span className="font-mono text-slate-300">widget.js</span> from this deployment, fetches the widget config live from chatmize-prod, and renders the chat on your visitor's page. Quick replies run the BotMap flow you published; anything unhandled lands in Live Conversations for your team.</p>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setEmbedModalWidget(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-all cursor-pointer"
              >
                Done
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
