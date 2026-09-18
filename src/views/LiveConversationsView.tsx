import React, { useState, useEffect, useMemo, useRef } from 'react';
import { EmojiPickerButton, useEmojiTarget } from '../components/emoji';
import { MetaReconnectModal, isConnectionExpiredError } from '../components/MetaReconnectModal';
import { PersonalizationPickerButton, usePersonalizationTarget } from '../components/personalization';
import { getApp } from 'firebase/app';
import { getFunctions, httpsCallable } from 'firebase/functions';
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  doc,
  setDoc,
  addDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import {
  MessageSquare,
  Send,
  Bot,
  UserCheck,
  Clock,
  Search,
  CheckCircle2,
  AlertCircle,
  Smartphone,
  Instagram,
  Globe,
  RefreshCw,
  Edit3,
  Save,
  X,
  Tag,
  Plus,
  Mail,
  AlertTriangle,
  Copy,
  User,
  ShieldCheck,
  Pause,
} from 'lucide-react';
import {
  subscribeToContacts,
  subscribeToConversationMessages,
  updateContactField,
  prodDb,
  ContactRecord
} from '../lib/firebase';
import { ChannelBrandIcon } from '../components/ChannelBrandIcon';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ConversationMessage {
  id: string;
  contactId: string;
  sender: 'customer' | 'bot' | 'agent' | 'system';
  text: string;
  timestamp: string;
  timestampMs?: number;
  senderName?: string;
  metaTag?: 'CONFIRMED_EVENT_UPDATE' | 'POST_PURCHASE_UPDATE' | 'ACCOUNT_UPDATE' | 'HUMAN_AGENT';
  type?: 'text' | 'event_log';
  deliveryStatus?: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  local?: boolean; // optimistic local message not yet confirmed by Firestore
}

export interface InboxConversation {
  id: string;
  channel: 'messenger' | 'instagram' | 'whatsapp' | 'web';
  senderId: string;
  lastMessageAtMs: number;
  lastMessageText: string;
  lastMessageDirection?: 'inbound' | 'outbound';
  /** Automation-handled conversations are 'inactive'. They show in the inbox
   *  marked inactive and never sit in the active agent queue. */
  status: 'inactive' | 'active';
  agentHandling: boolean;
  humanRequested: boolean;
  humanRequestedAtMs?: number;
  humanRequestText?: string;
}

export interface HandoffRecord {
  id: string;
  conversationId: string;
  reason?: string;
  requestedBy?: 'visitor' | 'agent';
  requestedAtMs: number;
  status: 'requested' | 'acknowledged' | 'resolved';
  assigneeEmail?: string;
}

// ---------------------------------------------------------------------------
// Explicit human-request detection.
// A handoff record is ONLY created when the visitor explicitly asks for a
// human. These patterns detect that intent in inbound visitor messages.
// ---------------------------------------------------------------------------

const HUMAN_REQUEST_SIGNALS: { re: RegExp; label: string }[] = [
  { re: /\btalk to (a |the )?(human|real person|person|someone|agent|representative|rep)\b/i, label: 'asked to talk to a human' },
  { re: /\bspeak (to|with) (a |the )?(human|real person|person|someone|agent|representative)\b/i, label: 'asked to speak with a human' },
  { re: /\b(real|live|actual) (human|person|agent|support)\b/i, label: 'asked for a real human' },
  { re: /\bhuman (agent|support|being)\b/i, label: 'asked for a human agent' },
  { re: /\bi want (a |the )?(human|person|agent|manager|supervisor)\b/i, label: 'asked for a human' },
  { re: /\bget me (a |the )?(human|person|agent|manager|supervisor)\b/i, label: 'asked for a human' },
  { re: /\btransfer me\b/i, label: 'asked to be transferred' },
  { re: /\bescalate\b/i, label: 'asked to escalate' },
  { re: /\bcustomer service\b/i, label: 'asked for customer service' },
  { re: /\bcall me\b/i, label: 'asked for a phone call' },
  { re: /\bis this a (bot|robot)\b/i, label: 'asked if this is a bot' },
  { re: /\bstop (the )?bot\b/i, label: 'asked to stop the bot' },
  { re: /\bconnect me (to|with) (a |the )?(human|person|someone|agent)\b/i, label: 'asked to be connected to a human' },
];

function detectHumanRequest(text: string): string | null {
  if (!text) return null;
  for (const sig of HUMAN_REQUEST_SIGNALS) {
    if (sig.re.test(text)) return sig.label;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PLATFORM_CHANNELS = ['messenger', 'instagram', 'whatsapp'] as const;

function tsToMs(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const t = Date.parse(v);
    return Number.isNaN(t) ? 0 : t;
  }
  if (v && typeof v === 'object' && typeof (v as { toMillis?: unknown }).toMillis === 'function') {
    try { return (v as { toMillis: () => number }).toMillis(); } catch { return 0; }
  }
  return 0;
}

function formatClock(ms: number): string {
  if (!ms) return '';
  return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatAgo(ms: number): string {
  if (!ms) return '';
  const diff = Date.now() - ms;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

type WindowState = 'open' | 'tag_required' | 'blocked' | 'unknown';

interface WindowInfo {
  state: WindowState;
  label: string;
  shortLabel: string;
  badgeColor: string;
  dotColor: string;
}

/**
 * Source-aware messaging rules.
 * Platform channels (Messenger / Instagram / WhatsApp) obey the Meta
 * messaging windows: 24h standard window, then the 7-day HUMAN_AGENT
 * extension. Outside the 7-day window the agent cannot message at all.
 * Webchat has no platform window and is never blocked here.
 */
function getWindowInfo(contact: ContactRecord | null | undefined, channel: string): WindowInfo {
  if (channel === 'web') {
    return {
      state: 'open',
      label: 'Webchat has no platform messaging window',
      shortLabel: 'No window',
      badgeColor: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/25',
      dotColor: 'bg-cyan-400',
    };
  }
  const now = Date.now();
  const w24 = contact?.messagingWindowExpiresAt ? Date.parse(contact.messagingWindowExpiresAt) : NaN;
  const d7 = contact?.humanAgentExpiresAt ? Date.parse(contact.humanAgentExpiresAt) : NaN;

  if (!Number.isNaN(w24) && now < w24) {
    const hrs = Math.max(1, Math.round((w24 - now) / 3_600_000));
    return {
      state: 'open',
      label: `Within the 24-hour messaging window (${hrs}h left)`,
      shortLabel: `${hrs}h left`,
      badgeColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25',
      dotColor: 'bg-emerald-400',
    };
  }
  if (!Number.isNaN(d7) && now < d7) {
    const days = Math.max(1, Math.round((d7 - now) / 86_400_000));
    return {
      state: 'tag_required',
      label: `24-hour window expired. HUMAN_AGENT tag required, ${days}d left of the 7-day window.`,
      shortLabel: `HUMAN_AGENT ${days}d`,
      badgeColor: 'text-amber-400 bg-amber-500/10 border-amber-500/25',
      dotColor: 'bg-amber-400',
    };
  }
  if (!Number.isNaN(w24) || !Number.isNaN(d7)) {
    return {
      state: 'blocked',
      label: 'Outside the 7-day messaging window. You cannot message this contact on this channel until they message you again.',
      shortLabel: 'Window closed',
      badgeColor: 'text-red-400 bg-red-500/10 border-red-500/25',
      dotColor: 'bg-red-400',
    };
  }
  return {
    state: 'unknown',
    label: 'Messaging window unknown for this contact. Sends may be blocked by Meta.',
    shortLabel: 'Window unknown',
    badgeColor: 'text-slate-400 bg-white/5 border-white/15',
    dotColor: 'bg-slate-400',
  };
}

interface LiveConversationsViewProps {
  workspaceId?: string;
  workspaceName?: string;
  ownerName?: string;
  /** False when the signed-in user is not the workspace owner. */
  isOwner?: boolean;
  onNavigateToAudience?: (contactId?: string) => void;
  onNavigateToFlows?: (flowId?: string) => void;
}

export const LiveConversationsView: React.FC<LiveConversationsViewProps> = ({
  workspaceId: workspaceIdProp,
  workspaceName,
  ownerName,
  isOwner = true,
  onNavigateToAudience,
}) => {
  // The workspace comes from the app's workspace context. There is no
  // hardcoded fallback: without a workspace there is no inbox to show.
  const workspaceId = workspaceIdProp || '';

  // All inbox reads and writes target the backend database (chatmize-prod),
  // where the webhook handler persists contacts and conversations.
  const updateInboxContact = (contactId: string, updates: Partial<ContactRecord>) =>
    updateContactField(contactId, updates, prodDb);

  const [conversations, setConversations] = useState<InboxConversation[]>([]);
  const [isLoadingConversations, setIsLoadingConversations] = useState<boolean>(true);
  const [contactsBySender, setContactsBySender] = useState<Record<string, ContactRecord>>({});
  const [handoffs, setHandoffs] = useState<HandoffRecord[]>([]);

  // The selected conversation survives refresh via the ?conversation= URL
  // param (set on select, read on load).
  const [selectedConvoId, setSelectedConvoId] = useState<string>(() => {
    try {
      return new URLSearchParams(window.location.search).get('conversation') || '';
    } catch {
      return '';
    }
  });

  const selectConversation = (id: string) => {
    setSelectedConvoId(id);
    try {
      const params = new URLSearchParams(window.location.search);
      if (id) params.set('conversation', id);
      else params.delete('conversation');
      const qs = params.toString();
      window.history.replaceState({}, '', window.location.pathname + (qs ? `?${qs}` : ''));
    } catch {
      // non-fatal: selection still works, refresh just won't restore it
    }
  };

  // Filters & search
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [channelFilter, setChannelFilter] = useState<'all' | 'messenger' | 'instagram' | 'whatsapp' | 'web'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'needs_agent' | 'automation'>('all');

  // Messages state (keyed by conversation id)
  const [conversationsMap, setConversationsMap] = useState<Record<string, ConversationMessage[]>>({});

  // Composer state
  const [messageInput, setMessageInput] = useState<string>('');
  const composerEmoji = useEmojiTarget<HTMLInputElement>();
  const notesEmoji = useEmojiTarget<HTMLTextAreaElement>();
  const composerPz = usePersonalizationTarget<HTMLInputElement>();
  const [selectedMetaTag, setSelectedMetaTag] = useState<ConversationMessage['metaTag'] | ''>('');
  const [isSending, setIsSending] = useState<boolean>(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [showReconnectModal, setShowReconnectModal] = useState(false);

  // Webchat email composer (webchat has no platform send path)
  const [emailTo, setEmailTo] = useState<string>('');
  const [emailSubject, setEmailSubject] = useState<string>('');
  const [emailBody, setEmailBody] = useState<string>('');
  const [emailCopied, setEmailCopied] = useState<boolean>(false);

  // Editable Contact Fields (Inspector)
  const [isEditingContact, setIsEditingContact] = useState<boolean>(false);
  const [editForm, setEditForm] = useState<{
    name: string;
    email: string;
    phone: string;
    company: string;
    jobTitle: string;
    status: ContactRecord['status'];
    notes: string;
  }>({
    name: '',
    email: '',
    phone: '',
    company: '',
    jobTitle: '',
    status: 'lead',
    notes: ''
  });
  const [newTagInput, setNewTagInput] = useState<string>('');
  const [newVarKey, setNewVarKey] = useState<string>('');
  const [newVarVal, setNewVarVal] = useState<string>('');
  const [saveSuccessNotice, setSaveSuccessNotice] = useState<boolean>(false);
  const [copiedNotice, setCopiedNotice] = useState<string | null>(null);
  const [handoffBusy, setHandoffBusy] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const contactKey = (channel: string, senderId: string) => `${channel}::${senderId}`;

  // -------------------------------------------------------------------------
  // Subscriptions
  // -------------------------------------------------------------------------

  // Conversations for this workspace, newest first. Automation-handled
  // conversations arrive as INACTIVE (see functions/src/store.ts).
  useEffect(() => {
    if (!workspaceId) {
      setIsLoadingConversations(false);
      return;
    }
    setIsLoadingConversations(true);
    const q = query(
      collection(prodDb, 'workspaces', workspaceId, 'conversations'),
      orderBy('lastMessageAt', 'desc'),
      limit(100)
    );
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const list: InboxConversation[] = [];
        snap.forEach((d) => {
          const data = d.data();
          const status = data.status === 'active' ? 'active' : 'inactive';
          list.push({
            id: d.id,
            channel: data.channel || 'messenger',
            senderId: data.senderId || '',
            lastMessageAtMs: tsToMs(data.lastMessageAt),
            lastMessageText: data.lastMessageText || '',
            lastMessageDirection: data.lastMessageDirection,
            status,
            agentHandling: data.agentHandling === true || status === 'active',
            humanRequested: data.humanRequested === true,
            humanRequestedAtMs: tsToMs(data.humanRequestedAt),
            humanRequestText: data.humanRequestText || '',
          });
        });
        setConversations(list);
        setIsLoadingConversations(false);
      },
      (err) => {
        console.error('Failed to subscribe to conversations:', err);
        setIsLoadingConversations(false);
      }
    );
    return () => unsubscribe();
  }, [workspaceId]);

  // Contacts (root collection) indexed by channel+senderId for display data.
  useEffect(() => {
    const unsubscribe = subscribeToContacts(
      (fetchedContacts) => {
        const map: Record<string, ContactRecord> = {};
        for (const c of fetchedContacts) {
          if (c.senderId) map[contactKey(c.channel, c.senderId)] = c;
        }
        setContactsBySender(map);
      },
      (err) => {
        console.error('Failed to subscribe to contacts:', err);
      },
      500,
      prodDb
    );
    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handoff records for this workspace.
  useEffect(() => {
    if (!workspaceId) return;
    const q = query(
      collection(prodDb, 'workspaces', workspaceId, 'handoffs'),
      orderBy('requestedAt', 'desc'),
      limit(100)
    );
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const list: HandoffRecord[] = [];
        snap.forEach((d) => {
          const data = d.data();
          list.push({
            id: d.id,
            conversationId: data.conversationId || '',
            reason: data.reason || '',
            requestedBy: data.requestedBy,
            requestedAtMs: tsToMs(data.requestedAt),
            status: data.status || 'requested',
            assigneeEmail: data.assigneeEmail || '',
          });
        });
        setHandoffs(list);
      },
      (err) => {
        console.error('Failed to subscribe to handoffs:', err);
      }
    );
    return () => unsubscribe();
  }, [workspaceId]);

  // Messages for the selected conversation.
  useEffect(() => {
    if (!workspaceId || !selectedConvoId) return;
    const unsubscribe = subscribeToConversationMessages(
      workspaceId,
      selectedConvoId,
      (firestoreMessages) => {
        const convo = conversationsRef.current.find((c) => c.id === selectedConvoId);
        const contact = convo ? contactsBySenderRef.current[contactKey(convo.channel, convo.senderId)] : undefined;
        const realMessages: ConversationMessage[] = firestoreMessages.map((m) => ({
          id: m.id,
          contactId: selectedConvoId,
          sender: m.direction === 'inbound' ? 'customer' : 'agent',
          text: m.text,
          timestamp: formatClock(m.timestampMs),
          timestampMs: m.timestampMs,
          senderName: m.direction === 'inbound' ? (contact?.name || 'Visitor') : 'Agent',
        }));
        setConversationsMap((prev) => {
          const existing = prev[selectedConvoId] || [];
          // Drop optimistic local messages once the matching real message
          // arrives from Firestore (same text, outbound, close in time).
          const confirmed = existing.filter((m) => {
            if (!m.local) return true;
            return !realMessages.some(
              (r) =>
                r.sender === 'agent' &&
                r.text === m.text &&
                Math.abs((r.timestampMs || 0) - (m.timestampMs || 0)) < 120_000
            );
          });
          const merged = [...realMessages];
          for (const m of confirmed) {
            if (m.local && !merged.some((r) => r.id === m.id)) merged.push(m);
          }
          merged.sort((a, b) => (a.timestampMs || 0) - (b.timestampMs || 0));
          return { ...prev, [selectedConvoId]: merged };
        });

        // Explicit human-request detection on inbound visitor messages.
        // A REAL handoff record is created the moment the visitor asks.
        for (const m of firestoreMessages) {
          if (m.direction !== 'inbound') continue;
          const signal = detectHumanRequest(m.text);
          if (signal) {
            void maybeCreateHandoffFromDetection(selectedConvoId, signal, m.text);
          }
        }
      },
      (err) => {
        console.error('Failed to subscribe to conversation messages:', err);
      },
      prodDb
    );
    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, selectedConvoId]);

  // Keep a ref of handoffs/conversations so the detection callback (which
  // closes over the first render) never acts on stale state.
  const handoffsRef = useRef<HandoffRecord[]>([]);
  handoffsRef.current = handoffs;
  const conversationsRef = useRef<InboxConversation[]>([]);
  conversationsRef.current = conversations;
  const contactsBySenderRef = useRef<Record<string, ContactRecord>>({});
  contactsBySenderRef.current = contactsBySender;

  /**
   * Create a REAL handoff record in Firestore when the visitor explicitly
   * asks for a human. The onHandoffCreated backend trigger watches
   * workspaces/{workspaceId}/handoffs/{handoffId} and fires the SES email.
   * Required shape: { conversationId, reason?, assigneeEmail?, assigneeUid? }.
   * Dedupes: never more than one open handoff per conversation.
   */
  const createHandoffRecord = async (
    convoId: string,
    reason: string,
    requestedBy: 'visitor' | 'agent'
  ): Promise<boolean> => {
    if (!workspaceId || !convoId) return false;
    const open = handoffsRef.current.some(
      (h) => h.conversationId === convoId && h.status !== 'resolved'
    );
    if (open) return false;

    const convo = conversationsRef.current.find((c) => c.id === convoId);
    const contact = convo ? contactsBySenderRef.current[contactKey(convo.channel, convo.senderId)] : undefined;

    const payload: Record<string, unknown> = {
      conversationId: convoId,
      reason,
      requestedBy,
      requestedAt: serverTimestamp(),
      status: 'requested',
      channel: convo?.channel || '',
      visitorName: contact?.name || 'Visitor',
    };
    // assigneeEmail intentionally omitted: the backend falls back to the
    // workspace owner email when it is absent.

    await addDoc(collection(prodDb, 'workspaces', workspaceId, 'handoffs'), payload);
    await setDoc(
      doc(prodDb, 'workspaces', workspaceId, 'conversations', convoId),
      {
        humanRequested: true,
        humanRequestedAt: serverTimestamp(),
        humanRequestText: reason,
        status: 'active',
        agentHandling: true,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    return true;
  };

  const maybeCreateHandoffFromDetection = async (
    convoId: string,
    signal: string,
    messageText: string
  ) => {
    const convo = conversationsRef.current.find((c) => c.id === convoId);
    if (!convo) return;
    if (convo.humanRequested) return; // already flagged
    const reason = `Visitor ${signal}: "${messageText.slice(0, 140)}"`;
    const created = await createHandoffRecord(convoId, reason, 'visitor');
    if (created) {
      setConversationsMap((prev) => ({
        ...prev,
        [convoId]: [
          ...(prev[convoId] || []),
          {
            id: `sys-handoff-${Date.now()}`,
            contactId: convoId,
            sender: 'system',
            text: `Visitor asked for a human (${signal}). Handoff requested, the workspace owner has been notified by email.`,
            timestamp: formatClock(Date.now()),
            timestampMs: Date.now(),
            type: 'event_log' as const,
          },
        ],
      }));
    }
  };

  // Manual handoff: the agent confirms the visitor explicitly asked for a human.
  const handleManualHandoff = async () => {
    if (!activeConvo || handoffBusy) return;
    setHandoffBusy(true);
    try {
      const created = await createHandoffRecord(
        activeConvo.id,
        activeContact
          ? `${activeContact.name} explicitly asked for a human (flagged by agent).`
          : 'Visitor explicitly asked for a human (flagged by agent).',
        'agent'
      );
      if (!created) {
        setSendError('There is already an open handoff for this conversation.');
      }
    } catch (err) {
      console.error('Failed to create handoff:', err);
      setSendError('Could not create the handoff record. Please try again.');
    } finally {
      setHandoffBusy(false);
    }
  };

  const handleResolveHandoff = async () => {
    if (!activeConvo || !activeHandoff) return;
    try {
      await updateDoc(
        doc(prodDb, 'workspaces', workspaceId, 'handoffs', activeHandoff.id),
        { status: 'resolved', resolvedAt: serverTimestamp() }
      );
      await setDoc(
        doc(prodDb, 'workspaces', workspaceId, 'conversations', activeConvo.id),
        { humanRequested: false, updatedAt: serverTimestamp() },
        { merge: true }
      );
    } catch (err) {
      console.error('Failed to resolve handoff:', err);
    }
  };

  // Auto-select: URL param first, then the newest conversation. Never steal
  // the user's selection on later updates.
  const didAutoSelect = useRef(false);
  useEffect(() => {
    if (didAutoSelect.current || conversations.length === 0) return;
    didAutoSelect.current = true;
    const valid = conversations.some((c) => c.id === selectedConvoId);
    if (!valid) {
      selectConversation(conversations[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversations]);

  // -------------------------------------------------------------------------
  // Computed
  // -------------------------------------------------------------------------

  const activeConvo: InboxConversation | null = useMemo(() => {
    return conversations.find((c) => c.id === selectedConvoId) || conversations[0] || null;
  }, [conversations, selectedConvoId]);

  const activeContact: ContactRecord | null = useMemo(() => {
    if (!activeConvo) return null;
    return contactsBySender[contactKey(activeConvo.channel, activeConvo.senderId)] || null;
  }, [contactsBySender, activeConvo]);

  const activeHandoff: HandoffRecord | null = useMemo(() => {
    if (!activeConvo) return null;
    return (
      handoffs.find((h) => h.conversationId === activeConvo.id && h.status !== 'resolved') || null
    );
  }, [handoffs, activeConvo]);

  const windowInfo: WindowInfo = useMemo(() => {
    return getWindowInfo(activeContact, activeConvo?.channel || 'messenger');
  }, [activeContact, activeConvo]);

  const isPlatformChannel = activeConvo ? (PLATFORM_CHANNELS as readonly string[]).includes(activeConvo.channel) : false;

  const needsAgent = (c: InboxConversation): boolean => {
    if (c.humanRequested) return true;
    return handoffs.some((h) => h.conversationId === c.id && h.status !== 'resolved');
  };

  const filteredConversations = useMemo(() => {
    return conversations.filter((c) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const contact = contactsBySender[contactKey(c.channel, c.senderId)];
        const hay = `${contact?.name || ''} ${contact?.email || ''} ${contact?.company || ''} ${(contact?.tags || []).join(' ')} ${c.lastMessageText}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (channelFilter !== 'all' && c.channel !== channelFilter) return false;
      if (statusFilter === 'needs_agent' && !needsAgent(c)) return false;
      if (statusFilter === 'automation' && (c.status === 'active' || needsAgent(c))) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversations, searchQuery, channelFilter, statusFilter, contactsBySender, handoffs]);

  const currentMessages = useMemo(() => {
    if (!activeConvo) return [];
    return conversationsMap[activeConvo.id] || [];
  }, [conversationsMap, activeConvo]);

  // When the 24h window has expired but the 7-day HUMAN_AGENT window is open,
  // default the policy tag so the send complies.
  useEffect(() => {
    if (windowInfo.state === 'tag_required') {
      setSelectedMetaTag('HUMAN_AGENT');
    }
  }, [windowInfo.state, activeConvo?.id]);

  // Pre-fill the webchat email composer from the contact record.
  useEffect(() => {
    if (activeConvo?.channel === 'web') {
      setEmailTo(activeContact?.email || '');
      setEmailSubject(`Re: your chat with ${workspaceName || 'us'}`);
    }
  }, [activeConvo?.id, activeConvo?.channel, activeContact?.email, workspaceName]);

  // -------------------------------------------------------------------------
  // Send (platform channels only)
  // -------------------------------------------------------------------------

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !activeConvo || !isPlatformChannel) return;
    if (windowInfo.state === 'blocked') {
      setSendError(windowInfo.label);
      return;
    }
    if (windowInfo.state === 'tag_required' && selectedMetaTag !== 'HUMAN_AGENT') {
      setSendError('The 24-hour window has expired. Select the HUMAN_AGENT policy tag to send inside the 7-day agent window.');
      return;
    }

    setIsSending(true);
    setSendError(null);
    const textToSend = messageInput.trim();
    const nowMs = Date.now();

    const optimistic: ConversationMessage = {
      id: `local-${nowMs}`,
      contactId: activeConvo.id,
      sender: activeConvo.agentHandling ? 'agent' : 'bot',
      senderName: activeConvo.agentHandling ? 'Live Agent' : 'Chatmize AI Agent',
      text: textToSend,
      timestamp: formatClock(nowMs),
      timestampMs: nowMs,
      metaTag: selectedMetaTag || undefined,
      deliveryStatus: 'sending',
      local: true,
    };

    setConversationsMap((prev) => ({
      ...prev,
      [activeConvo.id]: [...(prev[activeConvo.id] || []), optimistic],
    }));
    setMessageInput('');

    try {
      const functions = getFunctions(getApp(), 'us-west2');
      const sendFn = httpsCallable(functions, 'sendChannelMessage');
      await sendFn({
        workspaceId,
        channel: activeConvo.channel,
        recipientId: activeConvo.senderId,
        text: textToSend,
      });
      // The backend callable persists the outbound message to Firestore;
      // the subscription replaces this optimistic copy when it arrives.
      setConversationsMap((prev) => ({
        ...prev,
        [activeConvo.id]: (prev[activeConvo.id] || []).map((m) =>
          m.id === optimistic.id ? { ...m, deliveryStatus: 'delivered' as const } : m
        ),
      }));
    } catch (err) {
      console.error('Failed to send message:', err);
      const reason = err instanceof Error && err.message ? err.message : 'Send failed.';
      setSendError(reason);
      if (isConnectionExpiredError(reason)) {
        setShowReconnectModal(true);
      }
      setConversationsMap((prev) => ({
        ...prev,
        [activeConvo.id]: (prev[activeConvo.id] || []).map((m) =>
          m.id === optimistic.id ? { ...m, deliveryStatus: 'failed' as const } : m
        ),
      }));
    } finally {
      setIsSending(false);
    }

    if (activeContact) {
      updateInboxContact(activeContact.id, {
        lastInteractionAt: new Date().toISOString(),
      }).catch((err) => console.error('Error updating interaction:', err));
    }

    setTimeout(() => {
      const chatContainer = document.querySelector('[data-chat-messages]');
      if (chatContainer) chatContainer.scrollTop = chatContainer.scrollHeight;
    }, 100);
  };

  // -------------------------------------------------------------------------
  // Agent takeover (bot pause/resume). This is NOT a handoff: handoff records
  // are created only when the visitor explicitly asks for a human.
  // -------------------------------------------------------------------------

  const toggleAgentHandling = async () => {
    if (!activeConvo) return;
    const next = !activeConvo.agentHandling;
    try {
      await setDoc(
        doc(prodDb, 'workspaces', workspaceId, 'conversations', activeConvo.id),
        {
          status: next ? 'active' : 'inactive',
          agentHandling: next,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      const notice: ConversationMessage = {
        id: `sys-${Date.now()}`,
        contactId: activeConvo.id,
        sender: 'system',
        text: next
          ? 'Human takeover: a live agent paused automated responses.'
          : 'Automation resumed: the bot is handling this conversation again.',
        timestamp: formatClock(Date.now()),
        timestampMs: Date.now(),
        type: 'event_log',
      };
      setConversationsMap((prev) => ({
        ...prev,
        [activeConvo.id]: [...(prev[activeConvo.id] || []), notice],
      }));
    } catch (err) {
      console.error('Failed to toggle agent handling:', err);
    }
  };

  // -------------------------------------------------------------------------
  // Contact inspector handlers
  // -------------------------------------------------------------------------

  const handleCopyText = (text: string, label: string) => {
    if (!text) return;
    navigator.clipboard?.writeText(text);
    setCopiedNotice(label);
    setTimeout(() => setCopiedNotice(null), 2000);
  };

  const handleQuickStatusChange = async (newStatus: ContactRecord['status']) => {
    if (!activeContact) return;
    try {
      await updateInboxContact(activeContact.id, { status: newStatus });
      setContactsBySender((prev) => {
        const k = contactKey(activeContact.channel, activeContact.senderId || '');
        return prev[k] ? { ...prev, [k]: { ...prev[k], status: newStatus } } : prev;
      });
      setEditForm((prev) => ({ ...prev, status: newStatus }));
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  useEffect(() => {
    if (activeContact) {
      setEditForm({
        name: activeContact.name || '',
        email: activeContact.email || '',
        phone: activeContact.phone || '',
        company: activeContact.company || '',
        jobTitle: activeContact.jobTitle || '',
        status: activeContact.status || 'lead',
        notes: activeContact.notes || '',
      });
      setIsEditingContact(false);
    }
  }, [activeContact?.id]);

  const handleSaveContactProfile = async () => {
    if (!activeContact) return;
    try {
      const updates: Partial<ContactRecord> = {
        name: editForm.name.trim() || activeContact.name,
        email: editForm.email.trim(),
        phone: editForm.phone.trim(),
        company: editForm.company.trim(),
        jobTitle: editForm.jobTitle.trim(),
        status: editForm.status,
        notes: editForm.notes.trim(),
      };
      await updateInboxContact(activeContact.id, updates);
      setContactsBySender((prev) => {
        const k = contactKey(activeContact.channel, activeContact.senderId || '');
        return prev[k] ? { ...prev, [k]: { ...prev[k], ...updates } } : prev;
      });
      setIsEditingContact(false);
      setSaveSuccessNotice(true);
      setTimeout(() => setSaveSuccessNotice(false), 2500);
    } catch (err) {
      console.error('Failed to update contact in Firestore:', err);
    }
  };

  const handleAddTag = async (tagToAdd: string) => {
    if (!activeContact || !tagToAdd.trim()) return;
    const cleanTag = tagToAdd.trim();
    if (activeContact.tags.includes(cleanTag)) return;
    const newTags = [...activeContact.tags, cleanTag];
    await updateInboxContact(activeContact.id, { tags: newTags });
    setContactsBySender((prev) => {
      const k = contactKey(activeContact.channel, activeContact.senderId || '');
      return prev[k] ? { ...prev, [k]: { ...prev[k], tags: newTags } } : prev;
    });
    setNewTagInput('');
  };

  const handleRemoveTag = async (tagToRemove: string) => {
    if (!activeContact) return;
    const newTags = activeContact.tags.filter((t) => t !== tagToRemove);
    await updateInboxContact(activeContact.id, { tags: newTags });
    setContactsBySender((prev) => {
      const k = contactKey(activeContact.channel, activeContact.senderId || '');
      return prev[k] ? { ...prev, [k]: { ...prev[k], tags: newTags } } : prev;
    });
  };

  const handleSaveVariable = async () => {
    if (!activeContact || !newVarKey.trim()) return;
    const key = newVarKey.trim().toLowerCase().replace(/\s+/g, '_');
    const val = newVarVal.trim();
    const updatedVars = { ...(activeContact.variables || {}), [key]: val };
    await updateInboxContact(activeContact.id, { variables: updatedVars, customFields: updatedVars });
    setContactsBySender((prev) => {
      const k = contactKey(activeContact.channel, activeContact.senderId || '');
      return prev[k]
        ? { ...prev, [k]: { ...prev[k], variables: updatedVars, customFields: updatedVars } }
        : prev;
    });
    setNewVarKey('');
    setNewVarVal('');
  };

  // Real channel brand icons (Messenger / Instagram / WhatsApp / ChatMize webchat).
  const renderChannelIcon = (channel: string, className = 'w-3.5 h-3.5') => (
    <ChannelBrandIcon channel={channel} className={className} />
  );

  const openEmailApp = () => {
    const subject = encodeURIComponent(emailSubject);
    const body = encodeURIComponent(emailBody);
    window.location.href = `mailto:${encodeURIComponent(emailTo)}?subject=${subject}&body=${body}`;
  };

  if (!workspaceId) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-950 text-slate-400 p-8">
        <div className="text-center space-y-2">
          <MessageSquare className="w-10 h-10 text-slate-600 mx-auto" />
          <p className="text-sm font-semibold text-slate-200">No workspace selected</p>
          <p className="text-xs">Select a workspace to view its conversations.</p>
        </div>
      </div>
    );
  }

  const displayName = (c: InboxConversation): string => {
    const contact = contactsBySender[contactKey(c.channel, c.senderId)];
    return contact?.name || (c.channel === 'web' ? 'Web Visitor' : `${c.channel[0].toUpperCase()}${c.channel.slice(1)} User`);
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-4rem)] max-h-[calc(100vh-4rem)] overflow-hidden bg-slate-950 text-slate-100">
      {showReconnectModal && (
        <MetaReconnectModal
          workspaceId={workspaceId}
          workspaceName={workspaceName}
          ownerName={ownerName}
          isOwner={isOwner}
          onClose={() => setShowReconnectModal(false)}
        />
      )}

      {/* Top bar */}
      <div className="px-5 py-2.5 border-b border-white/10 bg-slate-900/90 backdrop-blur-md flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-500 flex items-center justify-center shadow-md shadow-cyan-500/20 shrink-0">
            <MessageSquare className="w-4 h-4 text-white" />
          </div>
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-bold text-white tracking-tight">Live Conversations Inbox</h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Omnichannel Connected
            </span>
            <span className="hidden md:inline-flex px-1.5 py-0.5 rounded text-[10px] font-mono bg-white/5 text-slate-400 border border-white/10">
              {conversations.length} Conversations
            </span>
            {conversations.filter(needsAgent).length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                {conversations.filter(needsAgent).length} need agent
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {activeConvo && (
            <div className="hidden lg:flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-950/60 border border-white/10 text-xs">
              <span className="text-slate-400 text-[11px]">Chatting with:</span>
              <span className="font-semibold text-white truncate max-w-[120px]">{displayName(activeConvo)}</span>
              <span className="text-slate-500">•</span>
              <span className="text-[11px] text-cyan-400 capitalize">{activeConvo.channel}</span>
            </div>
          )}
          <button
            onClick={() => onNavigateToAudience?.(activeContact?.id)}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
            title="Jump to Audience Manager CRM view for full customer segmentation"
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>Audience CRM</span>
          </button>
        </div>
      </div>

      {/* 3-column layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Column 1: conversation list */}
        <div className="w-80 xl:w-92 border-r border-white/10 flex flex-col bg-slate-900/40 shrink-0">
          <div className="p-3 border-b border-white/10 space-y-2.5 bg-slate-900/60">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search conversations..."
                className="w-full pl-8 pr-7 py-1.5 bg-slate-950/80 border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1 overflow-x-auto pb-0.5 scrollbar-none text-[11px]">
              {[
                { id: 'all', label: 'All', icon: null },
                { id: 'messenger', label: 'Messenger', icon: <ChannelBrandIcon channel="messenger" className="w-3 h-3" /> },
                { id: 'instagram', label: 'Instagram', icon: <ChannelBrandIcon channel="instagram" className="w-3 h-3" /> },
                { id: 'whatsapp', label: 'WhatsApp', icon: <ChannelBrandIcon channel="whatsapp" className="w-3 h-3" /> },
                { id: 'web', label: 'Web', icon: <ChannelBrandIcon channel="web" className="w-3 h-3" /> }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setChannelFilter(tab.id as typeof channelFilter)}
                  className={`px-2 py-1 rounded-lg font-medium whitespace-nowrap transition-all cursor-pointer flex items-center gap-1 ${
                    channelFilter === tab.id
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-1 p-1 bg-slate-950/70 rounded-xl border border-white/5 text-[10px]">
              {[
                { id: 'all', label: 'All' },
                { id: 'needs_agent', label: 'Needs Agent' },
                { id: 'automation', label: 'Automation' }
              ].map((st) => (
                <button
                  key={st.id}
                  onClick={() => setStatusFilter(st.id as typeof statusFilter)}
                  className={`py-1 rounded-lg text-center transition-all cursor-pointer font-semibold ${
                    statusFilter === st.id
                      ? 'bg-white/10 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-white/5">
            {isLoadingConversations ? (
              <div className="p-8 text-center text-slate-500 flex flex-col items-center gap-3">
                <RefreshCw className="w-5 h-5 animate-spin text-cyan-400" />
                <span className="text-xs">Loading conversations from Firestore...</span>
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="p-8 text-center text-slate-500 flex flex-col items-center gap-2">
                <MessageSquare className="w-8 h-8 text-slate-600" />
                <p className="text-xs">No conversations match your filters.</p>
                <p className="text-[11px] text-slate-600">New chats from Messenger, Instagram, WhatsApp, and webchat appear here automatically.</p>
              </div>
            ) : (
              filteredConversations.map((convo) => {
                const isSelected = convo.id === activeConvo?.id;
                const contact = contactsBySender[contactKey(convo.channel, convo.senderId)];
                const flagged = needsAgent(convo);
                const win = getWindowInfo(contact, convo.channel);
                const name = displayName(convo);
                return (
                  <button
                    key={convo.id}
                    onClick={() => selectConversation(convo.id)}
                    className={`w-full text-left p-3 transition-all flex items-start gap-2.5 cursor-pointer relative ${
                      isSelected
                        ? 'bg-slate-900/90 border-l-2 border-l-cyan-400 shadow-sm'
                        : 'hover:bg-white/5 border-l-2 border-l-transparent'
                    }`}
                  >
                    <div className="relative shrink-0">
                      {contact?.avatarUrl ? (
                        <img
                          src={contact.avatarUrl}
                          alt={name}
                          referrerPolicy="no-referrer"
                          className="w-9 h-9 rounded-full object-cover border border-white/15"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-slate-800 text-cyan-400 flex items-center justify-center font-bold text-xs border border-white/10">
                          {name.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div className="absolute -bottom-1 -right-1 p-0.5 rounded-full bg-slate-950 border border-white/20">
                        {renderChannelIcon(convo.channel)}
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <h4 className={`text-xs font-bold truncate ${isSelected ? 'text-white' : 'text-slate-200'}`}>
                          {name}
                        </h4>
                        <span className="text-[10px] text-slate-500 shrink-0 ml-1">
                          {formatAgo(convo.lastMessageAtMs)}
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-400 truncate mb-1.5">
                        {convo.lastMessageText || 'No messages yet'}
                      </p>

                      <div className="flex items-center gap-1.5 flex-wrap">
                        {/* Automation vs agent status: automation-handled
                            conversations are INACTIVE and stay out of the
                            active agent queue. */}
                        {flagged ? (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                            NEEDS AGENT
                          </span>
                        ) : convo.status === 'active' ? (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30">
                            AGENT ACTIVE
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-white/5 text-slate-400 border border-white/15">
                            INACTIVE · BOT
                          </span>
                        )}

                        <span
                          className={`px-1.5 py-0.2 rounded text-[9px] font-semibold border ${win.badgeColor}`}
                          title={win.label}
                        >
                          {win.shortLabel}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Column 2: thread + composer */}
        <div className="flex-1 flex flex-col bg-slate-950/70 overflow-hidden border-r border-white/10">
          {activeConvo ? (
            <>
              <div className="px-4 py-2.5 border-b border-white/10 bg-slate-900/80 backdrop-blur-sm flex flex-wrap items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    {activeContact?.avatarUrl ? (
                      <img
                        src={activeContact.avatarUrl}
                        alt={displayName(activeConvo)}
                        referrerPolicy="no-referrer"
                        className="w-9 h-9 rounded-full object-cover border border-white/15"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-cyan-600/20 text-cyan-400 font-bold text-xs flex items-center justify-center border border-white/10">
                        {displayName(activeConvo).substring(0, 2).toUpperCase()}
                      </div>
                    )}
                    <span className="absolute -bottom-1 -right-1 p-0.5 rounded-full bg-slate-900 border border-white/15">
                      {renderChannelIcon(activeConvo.channel)}
                    </span>
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-bold text-white">{displayName(activeConvo)}</h2>
                      {activeContact && (
                        <div className="relative inline-flex items-center">
                          <select
                            value={activeContact.status}
                            onChange={(e) => handleQuickStatusChange(e.target.value as ContactRecord['status'])}
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border cursor-pointer focus:outline-none ${
                              activeContact.status === 'customer'
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                : activeContact.status === 'subscriber'
                                ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                                : 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                            }`}
                            title="Click to update CRM Lifecycle Stage"
                          >
                            <option value="lead" className="bg-slate-900 text-blue-300">LEAD</option>
                            <option value="subscriber" className="bg-slate-900 text-purple-300">SUBSCRIBER</option>
                            <option value="customer" className="bg-slate-900 text-emerald-300">CUSTOMER</option>
                            <option value="unsubscribed" className="bg-slate-900 text-slate-400">UNSUBSCRIBED</option>
                          </select>
                        </div>
                      )}
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-white/5 text-slate-300 border border-white/10">
                        {activeConvo.channel}
                      </span>
                      {activeConvo.status === 'inactive' && !needsAgent(activeConvo) && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white/5 text-slate-400 border border-white/15">
                          INACTIVE · AUTOMATION HANDLING
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                      <span>{activeContact?.company || 'Individual Contact'}</span>
                      <span>•</span>
                      <span>{activeContact?.email || activeContact?.phone || 'No contact details'}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={toggleAgentHandling}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer border shadow-sm ${
                      activeConvo.agentHandling
                        ? 'bg-purple-500/15 text-purple-300 border-purple-500/40 hover:bg-purple-500/25'
                        : 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40 hover:bg-cyan-500/25'
                    }`}
                    title={activeConvo.agentHandling ? 'Hand the conversation back to automation' : 'Pause automation and reply as a live agent'}
                  >
                    {activeConvo.agentHandling ? (
                      <>
                        <Pause className="w-3.5 h-3.5 text-purple-400" />
                        <span>Agent Active (Resume Bot)</span>
                      </>
                    ) : (
                      <>
                        <Bot className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Bot Handling (Take Over)</span>
                      </>
                    )}
                  </button>

                  {/* Handoff is created only when the visitor explicitly asks
                      for a human. The button confirms the agent saw that ask. */}
                  {!activeHandoff && !activeConvo.humanRequested && (
                    <button
                      onClick={handleManualHandoff}
                      disabled={handoffBusy}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/40 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-40"
                      title="Visitor explicitly asked for a human: create the handoff record and notify the owner by email"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>{handoffBusy ? 'Requesting...' : 'Visitor asked for human'}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Handoff banner */}
              {(activeHandoff || activeConvo.humanRequested) && (
                <div className="px-4 py-2 bg-amber-950/40 border-b border-amber-500/25 flex items-center justify-between gap-3 text-xs shrink-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="font-bold text-amber-200">Human handoff {activeHandoff ? activeHandoff.status : 'requested'}</p>
                      <p className="text-amber-200/80 truncate text-[11px]">
                        {activeHandoff?.reason || activeConvo.humanRequestText || 'The visitor asked for a human.'}
                        {activeHandoff && ' The owner has been notified by email.'}
                      </p>
                    </div>
                  </div>
                  {activeHandoff && (
                    <button
                      onClick={handleResolveHandoff}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 cursor-pointer shrink-0"
                    >
                      Mark resolved
                    </button>
                  )}
                </div>
              )}

              {/* Platform messaging-window banner */}
              {isPlatformChannel && windowInfo.state !== 'open' && (
                <div className={`px-4 py-2 border-b flex items-start gap-2 text-xs shrink-0 ${
                  windowInfo.state === 'blocked'
                    ? 'bg-red-950/40 border-red-500/25 text-red-200'
                    : 'bg-amber-950/30 border-amber-500/20 text-amber-200'
                }`}>
                  {windowInfo.state === 'blocked' ? (
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  ) : (
                    <Clock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  )}
                  <p>{windowInfo.label}</p>
                </div>
              )}

              {/* Webchat: no platform window */}
              {activeConvo.channel === 'web' && (
                <div className="px-4 py-2 bg-cyan-950/30 border-b border-cyan-500/20 flex items-center gap-2 text-xs text-cyan-200 shrink-0">
                  <Globe className="w-4 h-4 text-cyan-400 shrink-0" />
                  <p>Webchat has no platform messaging window. Reply below by email instead.</p>
                </div>
              )}

              {/* Message thread */}
              <div data-chat-messages className="flex-1 overflow-y-auto p-4 space-y-3.5">
                {currentMessages.length === 0 && (
                  <div className="text-center text-slate-500 text-xs pt-8">
                    No messages in this conversation yet.
                  </div>
                )}
                {currentMessages.map((msg) => {
                  if (msg.type === 'event_log') {
                    return (
                      <div key={msg.id} className="flex justify-center my-1.5">
                        <div className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[11px] text-slate-400 flex items-center gap-1.5 max-w-lg text-center">
                          <span>{msg.text}</span>
                          <span className="text-[10px] text-slate-500 ml-1 shrink-0">{msg.timestamp}</span>
                        </div>
                      </div>
                    );
                  }
                  const isCustomer = msg.sender === 'customer';
                  const isBot = msg.sender === 'bot';
                  return (
                    <div key={msg.id} className={`flex gap-2.5 ${isCustomer ? 'justify-start' : 'justify-end'}`}>
                      {isCustomer && (
                        <div className="w-7 h-7 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center shrink-0 mt-1 text-[10px] font-bold text-slate-300">
                          {displayName(activeConvo)[0] || 'V'}
                        </div>
                      )}
                      <div className={`max-w-md space-y-1 ${isCustomer ? 'items-start' : 'items-end'}`}>
                        <div className={`flex items-center gap-1.5 text-[10px] text-slate-400 ${isCustomer ? '' : 'justify-end'}`}>
                          <span>{msg.senderName || (isCustomer ? displayName(activeConvo) : 'Agent')}</span>
                          <span>•</span>
                          <span>{msg.timestamp}</span>
                          {msg.metaTag && (
                            <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[9px] font-semibold">
                              Tag: {msg.metaTag}
                            </span>
                          )}
                        </div>
                        <div
                          className={`p-3 rounded-2xl text-xs leading-relaxed ${
                            isCustomer
                              ? 'bg-slate-900 border border-white/10 text-slate-200 rounded-tl-sm shadow-sm'
                              : isBot
                              ? 'bg-gradient-to-br from-cyan-950/80 to-blue-950/80 border border-cyan-500/30 text-cyan-100 rounded-tr-sm shadow-md shadow-cyan-950/20'
                              : 'bg-gradient-to-br from-purple-950/80 to-indigo-950/80 border border-purple-500/30 text-purple-100 rounded-tr-sm shadow-md'
                          }`}
                        >
                          <p className="whitespace-pre-wrap">{msg.text}</p>
                        </div>
                        {!isCustomer && msg.deliveryStatus && (
                          <div className="text-[10px] text-slate-500 flex items-center justify-end gap-1">
                            <CheckCircle2 className="w-2.5 h-2.5 text-cyan-400" />
                            <span className="capitalize">{msg.deliveryStatus}</span>
                          </div>
                        )}
                      </div>
                      {!isCustomer && (
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-1 ${
                          isBot ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                        }`}>
                          {isBot ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
                        </div>
                      )}
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Quick reply chips (platform channels) */}
              {isPlatformChannel && windowInfo.state !== 'blocked' && (
                <div className="px-4 py-1.5 border-t border-white/5 bg-slate-900/40 flex items-center gap-2 overflow-x-auto scrollbar-none text-[11px] shrink-0">
                  <span className="text-[10px] uppercase font-bold text-slate-500 shrink-0">Quick Reply:</span>
                  {[
                    'Thanks for reaching out! Looking into this now.',
                    'Got it, let me check that for you.',
                    'Can you share a bit more detail so I can help?',
                  ].map((qr, idx) => (
                    <button
                      key={idx}
                      onClick={() => setMessageInput(qr)}
                      className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 whitespace-nowrap transition-all cursor-pointer text-[11px]"
                    >
                      {qr}
                    </button>
                  ))}
                </div>
              )}

              {/* Composer: platform channels */}
              {isPlatformChannel && windowInfo.state !== 'blocked' && (
                <div className="p-3 border-t border-white/10 bg-slate-900/90 backdrop-blur-md space-y-2 shrink-0">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-semibold text-slate-300">Policy Tag:</span>
                      <select
                        value={selectedMetaTag}
                        onChange={(e) => setSelectedMetaTag(e.target.value as ConversationMessage['metaTag'] | '')}
                        className="bg-slate-950 border border-white/10 rounded-lg px-2 py-0.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500/50"
                      >
                        <option value="">Standard (Within 24h window)</option>
                        <option value="CONFIRMED_EVENT_UPDATE">CONFIRMED_EVENT_UPDATE (Event reminders)</option>
                        <option value="POST_PURCHASE_UPDATE">POST_PURCHASE_UPDATE (Order receipts)</option>
                        <option value="ACCOUNT_UPDATE">ACCOUNT_UPDATE (Security/Account)</option>
                        <option value="HUMAN_AGENT">HUMAN_AGENT (7-Day Agent Support)</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px]">
                      <span className="text-slate-500 text-[10px]">Insert:</span>
                      <button
                        type="button"
                        onClick={() => setMessageInput((prev) => `${prev} {{first_name}}`)}
                        className="px-1.5 py-0.5 rounded bg-white/5 hover:bg-cyan-500/20 text-cyan-300 border border-white/10 cursor-pointer font-mono text-[10px]"
                      >
                        {'{{first_name}}'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setMessageInput((prev) => `${prev} {{company}}`)}
                        className="px-1.5 py-0.5 rounded bg-white/5 hover:bg-cyan-500/20 text-cyan-300 border border-white/10 cursor-pointer font-mono text-[10px]"
                      >
                        {'{{company}}'}
                      </button>
                    </div>
                  </div>

                  {sendError && (
                    <div className="mb-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-start justify-between gap-2">
                      <span>{sendError}</span>
                      <button
                        onClick={() => setSendError(null)}
                        className="text-red-400 hover:text-red-200 shrink-0 font-bold"
                        aria-label="Dismiss"
                      >
                        ✕
                      </button>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        ref={(el) => { composerEmoji.ref(el); composerPz.ref(el); }}
                        value={messageInput}
                        onChange={(e) => setMessageInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSendMessage();
                          }
                        }}
                        placeholder={`Reply as ${activeConvo.agentHandling ? 'Live Agent' : 'Chatmize AI Agent'}...`}
                        className="w-full px-3.5 py-2.5 pr-16 bg-slate-950/80 border border-white/15 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
                      />
                      <span className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                        <EmojiPickerButton onPick={(e) => composerEmoji.insert(e, messageInput, setMessageInput)} placement="up" />
                        <PersonalizationPickerButton
                          onPick={(t) => composerPz.insert(t, messageInput, setMessageInput)}
                          placement="up"
                        />
                      </span>
                    </div>
                    <button
                      onClick={handleSendMessage}
                      disabled={!messageInput.trim() || isSending}
                      className="px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-40 shadow-md shadow-cyan-500/20"
                    >
                      <span>Send</span>
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {/* Blocked: outside the 7-day window */}
              {isPlatformChannel && windowInfo.state === 'blocked' && (
                <div className="p-4 border-t border-red-500/25 bg-red-950/30 shrink-0">
                  <div className="flex items-start gap-2 text-xs text-red-200">
                    <ShieldCheck className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">Messaging blocked</p>
                      <p className="text-red-200/80 mt-0.5">{windowInfo.label}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Webchat: email the contact instead */}
              {activeConvo.channel === 'web' && (
                <div className="p-3 border-t border-white/10 bg-slate-900/90 backdrop-blur-md space-y-2 shrink-0">
                  <div className="flex items-center gap-2 text-xs text-slate-300">
                    <Mail className="w-4 h-4 text-cyan-400" />
                    <span className="font-bold">Email {displayName(activeConvo)} instead</span>
                  </div>
                  {!activeContact?.email && (
                    <p className="text-[11px] text-amber-300 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      No email on file. Add one in the CRM panel on the right, then send.
                    </p>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="email"
                      value={emailTo}
                      onChange={(e) => setEmailTo(e.target.value)}
                      placeholder="To: email address"
                      className="px-3 py-2 bg-slate-950/80 border border-white/15 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
                    />
                    <input
                      type="text"
                      value={emailSubject}
                      onChange={(e) => setEmailSubject(e.target.value)}
                      placeholder="Subject"
                      className="px-3 py-2 bg-slate-950/80 border border-white/15 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
                    />
                  </div>
                  <textarea
                    rows={2}
                    value={emailBody}
                    onChange={(e) => setEmailBody(e.target.value)}
                    placeholder="Write your reply here, then open it in your email app to send."
                    className="w-full px-3 py-2 bg-slate-950/80 border border-white/15 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={openEmailApp}
                      disabled={!emailTo.trim()}
                      className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-40 shadow-md shadow-cyan-500/20"
                    >
                      <Mail className="w-3.5 h-3.5" />
                      <span>Open in email app</span>
                    </button>
                    <button
                      onClick={() => {
                        handleCopyText(`To: ${emailTo}\nSubject: ${emailSubject}\n\n${emailBody}`, 'Email draft');
                        setEmailCopied(true);
                        setTimeout(() => setEmailCopied(false), 2000);
                      }}
                      disabled={!emailTo.trim()}
                      className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 text-xs font-semibold cursor-pointer disabled:opacity-40 flex items-center gap-1.5"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>{emailCopied ? 'Copied!' : 'Copy draft'}</span>
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500 p-8">
              <MessageSquare className="w-12 h-12 text-slate-700 mb-2" />
              <p className="text-sm">Select a conversation from the left to view the thread.</p>
            </div>
          )}
        </div>

        {/* Column 3: contact inspector */}
        <div className="w-80 xl:w-92 border-l border-white/10 flex flex-col bg-slate-900/40 shrink-0 overflow-y-auto">
          {activeConvo ? (
            <div className="p-4 space-y-5">
              <div className="flex items-center justify-between pb-2.5 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-cyan-400" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-white">Audience CRM</h3>
                </div>
                {activeContact && (
                  <button
                    onClick={() => {
                      if (isEditingContact) handleSaveContactProfile();
                      else setIsEditingContact(true);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                      isEditingContact
                        ? 'bg-emerald-500 text-slate-950 font-bold'
                        : 'bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10'
                    }`}
                  >
                    {isEditingContact ? (
                      <>
                        <Save className="w-3.5 h-3.5" />
                        <span>Save CRM</span>
                      </>
                    ) : (
                      <>
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Edit Info</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {saveSuccessNotice && (
                <div className="p-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Contact info synced with Firestore!</span>
                </div>
              )}
              {copiedNotice && (
                <div className="p-2 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span>{copiedNotice} copied to clipboard!</span>
                </div>
              )}

              <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-white/10 space-y-3">
                <div className="flex items-center gap-3">
                  {activeContact?.avatarUrl ? (
                    <img
                      src={activeContact.avatarUrl}
                      alt={displayName(activeConvo)}
                      referrerPolicy="no-referrer"
                      className="w-11 h-11 rounded-full object-cover border border-white/15 shrink-0"
                    />
                  ) : (
                    <div className="w-11 h-11 rounded-full bg-slate-800 text-cyan-400 flex items-center justify-center font-bold text-sm border border-white/15 shrink-0">
                      {displayName(activeConvo).substring(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-bold text-white truncate">{displayName(activeConvo)}</h4>
                    <p className="text-xs text-slate-400 truncate">{activeContact?.company || 'Direct Contact'}</p>
                  </div>
                </div>
                {activeContact && (
                  <div className="grid grid-cols-3 gap-1 pt-1 text-[10px]">
                    {(['lead', 'subscriber', 'customer'] as const).map((st) => (
                      <button
                        key={st}
                        onClick={() => handleQuickStatusChange(st)}
                        className={`py-1 rounded-lg text-center font-bold uppercase transition-all cursor-pointer border ${
                          activeContact.status === st
                            ? st === 'customer'
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                              : st === 'subscriber'
                              ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                              : 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                            : 'bg-white/5 text-slate-400 border-white/5 hover:bg-white/10'
                        }`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {activeContact ? (
                <>
                  <div className="space-y-2.5">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Customer Identity</span>
                    {isEditingContact ? (
                      <div className="space-y-2.5">
                        <div>
                          <label className="text-[10px] text-slate-400 block mb-1">Full Name</label>
                          <input
                            type="text"
                            value={editForm.name}
                            onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
                            className="w-full px-3 py-1.5 bg-slate-950 border border-white/15 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500/50"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400 block mb-1">Email Address</label>
                          <input
                            type="email"
                            value={editForm.email}
                            onChange={(e) => setEditForm((prev) => ({ ...prev, email: e.target.value }))}
                            className="w-full px-3 py-1.5 bg-slate-950 border border-white/15 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500/50"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400 block mb-1">Mobile / Phone</label>
                          <input
                            data-no-emoji
                            type="text"
                            value={editForm.phone}
                            onChange={(e) => setEditForm((prev) => ({ ...prev, phone: e.target.value }))}
                            className="w-full px-3 py-1.5 bg-slate-950 border border-white/15 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500/50"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] text-slate-400 block mb-1">Company</label>
                            <input
                              type="text"
                              value={editForm.company}
                              onChange={(e) => setEditForm((prev) => ({ ...prev, company: e.target.value }))}
                              className="w-full px-3 py-1.5 bg-slate-950 border border-white/15 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500/50"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-400 block mb-1">Stage / Status</label>
                            <select
                              value={editForm.status}
                              onChange={(e) => setEditForm((prev) => ({ ...prev, status: e.target.value as ContactRecord['status'] }))}
                              className="w-full px-2 py-1.5 bg-slate-950 border border-white/15 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500/50"
                            >
                              <option value="lead">Lead</option>
                              <option value="subscriber">Subscriber</option>
                              <option value="customer">Customer</option>
                              <option value="unsubscribed">Unsubscribed</option>
                            </select>
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-[10px] text-slate-400 block">Agent Scratchpad Notes</label>
                            <EmojiPickerButton onPick={(e) => notesEmoji.insert(e, editForm.notes, (v) => setEditForm((prev) => ({ ...prev, notes: v })))} placement="down" />
                          </div>
                          <textarea
                            rows={2}
                            ref={notesEmoji.ref}
                            value={editForm.notes}
                            onChange={(e) => setEditForm((prev) => ({ ...prev, notes: e.target.value }))}
                            placeholder="Internal notes regarding deals, preferences..."
                            className="w-full px-3 py-1.5 bg-slate-950 border border-white/15 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500/50"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 rounded-2xl bg-slate-950/60 border border-white/10 space-y-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Email</span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-200 font-mono text-[11px]">{activeContact.email || '—'}</span>
                            {activeContact.email && (
                              <button
                                onClick={() => handleCopyText(activeContact.email!, 'Email')}
                                className="p-1 hover:text-cyan-400 text-slate-500 cursor-pointer"
                                title="Copy email"
                              >
                                <Copy className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Phone</span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-200 font-mono text-[11px]">{activeContact.phone || '—'}</span>
                            {activeContact.phone && (
                              <button
                                onClick={() => handleCopyText(activeContact.phone!, 'Phone')}
                                className="p-1 hover:text-cyan-400 text-slate-500 cursor-pointer"
                                title="Copy phone"
                              >
                                <Copy className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Company</span>
                          <span className="text-slate-200">{activeContact.company || '—'}</span>
                        </div>
                        {activeContact.notes && (
                          <div className="pt-2 border-t border-white/5">
                            <span className="text-[10px] text-slate-500 block mb-0.5">Notes:</span>
                            <p className="text-xs text-slate-300 italic">{activeContact.notes}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Audience Tags</span>
                      <span className="text-[10px] text-slate-500">{activeContact.tags.length} applied</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {activeContact.tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-0.5 rounded-lg text-xs font-semibold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 flex items-center gap-1 group"
                        >
                          <Tag className="w-2.5 h-2.5 text-cyan-400" />
                          <span>{tag}</span>
                          <button
                            onClick={() => handleRemoveTag(tag)}
                            className="text-cyan-400/60 hover:text-cyan-200 ml-0.5 cursor-pointer"
                            title="Remove tag"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center gap-1.5 pt-1">
                      <input
                        data-no-emoji
                        type="text"
                        value={newTagInput}
                        onChange={(e) => setNewTagInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddTag(newTagInput);
                          }
                        }}
                        placeholder="+ Add tag (e.g. VIP Lead, Hot)..."
                        className="flex-1 px-3 py-1.5 bg-slate-950 border border-white/15 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500/50"
                      />
                      <button
                        onClick={() => handleAddTag(newTagInput)}
                        disabled={!newTagInput.trim()}
                        className="px-3 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-xs font-bold cursor-pointer disabled:opacity-40"
                      >
                        Add
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Custom Variables</span>
                    <div className="p-2.5 rounded-xl bg-slate-950/60 border border-white/10 space-y-1 text-xs">
                      {Object.entries(activeContact.variables || {}).length === 0 ? (
                        <p className="text-slate-500 text-[11px]">No custom variables captured yet.</p>
                      ) : (
                        Object.entries(activeContact.variables || {}).map(([k, v]) => (
                          <div key={k} className="flex items-center justify-between py-0.5 border-b border-white/5 last:border-0">
                            <span className="font-mono text-cyan-400 text-[11px]">{`{{${k}}}`}</span>
                            <span className="text-slate-200 font-semibold text-[11px] truncate max-w-[130px]">{String(v)}</span>
                          </div>
                        ))
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                      <input
                        data-no-emoji
                        type="text"
                        value={newVarKey}
                        onChange={(e) => setNewVarKey(e.target.value)}
                        placeholder="variable_name"
                        className="px-2.5 py-1.5 bg-slate-950 border border-white/15 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500/50"
                      />
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          value={newVarVal}
                          onChange={(e) => setNewVarVal(e.target.value)}
                          placeholder="value"
                          className="w-full px-2.5 py-1.5 bg-slate-950 border border-white/15 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500/50"
                        />
                        <button
                          onClick={handleSaveVariable}
                          disabled={!newVarKey.trim()}
                          className="px-2.5 py-1.5 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-xs font-bold cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-slate-500 text-xs p-3 rounded-2xl bg-slate-950/60 border border-white/10">
                  No CRM record for this visitor yet. One is created automatically when the webhook sees their next message.
                </p>
              )}

              {/* Policy section */}
              <div className="space-y-2 pt-2 border-t border-white/10">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                  {activeConvo.channel === 'web' ? 'Webchat Policy' : 'Meta Messaging Policy'}
                </span>
                <div className="p-3 rounded-2xl bg-slate-950/80 border border-white/10 space-y-2">
                  {activeConvo.channel === 'web' ? (
                    <p className="text-[11px] text-slate-400">
                      Webchat has no platform messaging window. Use the email panel below the thread to reply.
                    </p>
                  ) : (
                    <>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">24h Window:</span>
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${windowInfo.badgeColor}`}>
                          {windowInfo.shortLabel}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">7-Day Agent:</span>
                        <span className="text-purple-300 font-semibold text-[11px]">
                          {activeContact?.humanAgentExpiresAt
                            ? Date.parse(activeContact.humanAgentExpiresAt) > Date.now()
                              ? `Open until ${new Date(activeContact.humanAgentExpiresAt).toLocaleDateString()}`
                              : 'Expired'
                            : 'Not set'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">Recurring Tokens:</span>
                        <span className="text-cyan-300 font-semibold text-[11px]">
                          {activeContact?.recurringTokens?.length ? `${activeContact.recurringTokens.length} Active` : '0 Active'}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-slate-500 text-xs">
              Select a conversation to inspect the contact.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
