import React, { useState, useEffect, useMemo, useRef } from 'react';
import { EmojiPickerButton, useEmojiTarget } from '../components/emoji';
import { MetaReconnectModal, isConnectionExpiredError } from '../components/MetaReconnectModal';
import { PersonalizationPickerButton, usePersonalizationTarget } from '../components/personalization';
import { getApp } from 'firebase/app';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { 
  MessageSquare, 
  Send, 
  Bot, 
  UserCheck, 
  Clock, 
  Calendar, 
  Tag, 
  Plus, 
  Search, 
  Filter, 
  CheckCircle2, 
  AlertCircle, 
  ShieldCheck, 
  Smartphone, 
  Instagram, 
  Globe, 
  RefreshCw, 
  Edit3, 
  Save, 
  X, 
  ChevronRight, 
  ArrowRight, 
  ExternalLink, 
  Zap, 
  BookOpen, 
  FileText, 
  Share2, 
  Flame, 
  Bell, 
  User, 
  Check, 
  CornerDownLeft, 
  Play, 
  Pause, 
  Sliders, 
  Shield, 
  Info, 
  Phone, 
  Mail, 
  Building2, 
  DollarSign, 
  AlertTriangle,
  Layers,
  ChevronDown,
  Copy
} from 'lucide-react';
import { 
  subscribeToContacts, 
  subscribeToConversationMessages,
  saveContact, 
  updateContactField, 
  seedInitialMetaContacts,
  prodDb,
  ContactRecord 
} from '../lib/firebase';

// Message interface
export interface ConversationMessage {
  id: string;
  contactId: string;
  sender: 'customer' | 'bot' | 'agent' | 'system';
  text: string;
  timestamp: string;
  senderName?: string;
  metaTag?: 'CONFIRMED_EVENT_UPDATE' | 'POST_PURCHASE_UPDATE' | 'ACCOUNT_UPDATE' | 'HUMAN_AGENT';
  type?: 'text' | 'content_card' | 'quick_reply' | 'event_log' | 'rn_prompt';
  contentCard?: {
    title: string;
    description: string;
    badge?: string;
    imageUrl?: string;
    buttonText: string;
    buttonUrl?: string;
    flowId?: string;
  };
  /** Send lifecycle: optimistic 'sending' -> 'delivered' on channel API
   * success, 'failed' on error. Persisted outbound messages (which arrive
   * via the Firestore subscription) show 'delivered' once the channel
   * accepted them; 'sent' is kept for future channel-ack refinement. */
  deliveryStatus?: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
}

// Follow-Up Rule interface
export interface FollowUpRule {
  id: string;
  contactId: string;
  title: string;
  triggerType: 'inactivity' | 'scheduled' | 'tag_added' | 'stage_change';
  delayDescription: string;
  targetAction: 'send_flow' | 'send_message' | 'notify_agent' | 'apply_tag';
  contentSnippet: string;
  status: 'active' | 'triggered' | 'paused';
  scheduledFor?: string;
  createdAt: string;
}

// Pre-packaged Audience Content Library
export interface AudienceContentItem {
  id: string;
  type: 'flow' | 'guide' | 'rn_optin' | 'coupon';
  title: string;
  category: string;
  description: string;
  badge: string;
  buttonText: string;
  previewText: string;
  flowId?: string;
  channelSupport: ('messenger' | 'instagram' | 'whatsapp' | 'web')[];
}

const AUDIENCE_CONTENT_CATALOG: AudienceContentItem[] = [
  {
    id: 'flow-workshop',
    type: 'flow',
    title: 'Build-A-Bot Live Workshop Invite',
    category: 'Interactive Bot Map Flow',
    description: 'Direct interactive registration flow with automated calendar booking & reminder opt-in.',
    badge: 'Live Bot Flow',
    buttonText: 'Reserve VIP Seat 🎟️',
    previewText: 'Hey {{first_name}}, I saved you a priority seat for our upcoming Build-A-Bot Live Workshop! Click below to confirm.',
    flowId: 'bm-webinar-01',
    channelSupport: ['messenger', 'instagram', 'whatsapp', 'web']
  },
  {
    id: 'flow-coupon',
    type: 'coupon',
    title: 'VIP 30% First-Order Voucher',
    category: 'Conversion Incentive',
    description: 'Limited-time discount coupon card with 1-click checkout activation link.',
    badge: 'Offer Card',
    buttonText: 'Claim 30% Off Code 🔥',
    previewText: 'As a thank you for checking out Chatmize, here is an exclusive 30% discount token for your account: VIP30.',
    flowId: 'bm-coupon-02',
    channelSupport: ['messenger', 'instagram', 'whatsapp', 'web']
  },
  {
    id: 'guide-playbook',
    type: 'guide',
    title: '2026 Meta DM Funnel Blueprint (PDF)',
    category: 'Audience Resource',
    description: 'Complete breakdown of Click-to-Messenger ads, Recurring Notifications, and WhatsApp sales funnels.',
    badge: 'Lead Magnet',
    buttonText: 'Open Free PDF 📖',
    previewText: 'Here is the step-by-step 2026 Meta DM Funnel Blueprint we discussed. Includes copy templates & prompt guides.',
    channelSupport: ['messenger', 'instagram', 'whatsapp', 'web']
  },
  {
    id: 'rn-daily-hacks',
    type: 'rn_optin',
    title: 'Daily Bot Growth Hacks (Recurring Opt-In)',
    category: 'Meta Marketing Message',
    description: 'Meta-compliant recurring notification opt-in card granting 180-day daily broadcast permissions.',
    badge: 'Meta RN Opt-In',
    buttonText: 'Get Daily Tips 🔔',
    previewText: 'Would you like to receive 1 actionable bot growth hack every weekday right here in Messenger?',
    channelSupport: ['messenger', 'instagram']
  },
  {
    id: 'flow-quiz',
    type: 'flow',
    title: 'AI Automation Readiness Quiz',
    category: 'Lead Scoring Flow',
    description: '4-question conversational assessment that auto-calculates lead score and assigns CRM tags.',
    badge: 'Interactive Quiz',
    buttonText: 'Take 2-Min Quiz ⚡',
    previewText: 'Discover which AI automation model will yield the highest ROI for your business in 2 minutes.',
    flowId: 'bm-quiz-03',
    channelSupport: ['messenger', 'instagram', 'whatsapp', 'web']
  }
];

const PRESET_FOLLOW_UP_TEMPLATES = [
  {
    title: '2-Hour Inactivity Gentle Nudge',
    triggerType: 'inactivity' as const,
    delayDescription: '2 hours of silence',
    targetAction: 'send_message' as const,
    contentSnippet: 'Hey {{first_name}}, did you have any other questions about setting up your bot map? I\'m here to help!',
  },
  {
    title: 'Tomorrow 9:00 AM Agent Strategy Check-in',
    triggerType: 'scheduled' as const,
    delayDescription: 'Tomorrow at 9:00 AM',
    targetAction: 'notify_agent' as const,
    contentSnippet: 'Follow up regarding agency white-label pricing tier and custom API limits.',
  },
  {
    title: '24-Hour Meta Window Expiry Re-engagement',
    triggerType: 'scheduled' as const,
    delayDescription: '1 hour before 24-hr window closes',
    targetAction: 'send_flow' as const,
    contentSnippet: 'Send Build-A-Bot Live Workshop RSVP before the 24-hour standard messaging window closes.',
  },
  {
    title: 'Post-Purchase Onboarding Sequence',
    triggerType: 'stage_change' as const,
    delayDescription: 'Immediate on Customer conversion',
    targetAction: 'apply_tag' as const,
    contentSnippet: 'Tag contact as [Onboarding Active] and deliver access credentials flow.',
  }
];

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
  onNavigateToFlows
}) => {
  // Conversation data lives in the real Firestore workspace where the
  // webhook handler persists it (ws-chatmize-dev). The localStorage workspace
  // id is a UI silo label, not a Firestore path, so it must not be used here.
  // (Proper multi-workspace mapping lands with the support widget rebuild.)
  const workspaceId = 'ws-chatmize-dev';
  // Inbox contacts and conversations live in the backend database
  // (chatmize-prod), where the webhook handler persists them. The applet
  // database only holds stale demo/seed records, so every inbox read and
  // write must target prodDb until the workspace rebuild unifies this.
  const updateInboxContact = (contactId: string, updates: Partial<ContactRecord>) =>
    updateContactField(contactId, updates, prodDb);
  // State for contacts from Firestore
  const [contacts, setContacts] = useState<ContactRecord[]>([]);
  const [isLoadingContacts, setIsLoadingContacts] = useState<boolean>(true);
  const [selectedContactId, setSelectedContactId] = useState<string>('');

  // Filters & search
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [channelFilter, setChannelFilter] = useState<'all' | 'messenger' | 'instagram' | 'whatsapp' | 'web'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'needs_agent' | 'bot_active' | 'followup_due' | 'resolved'>('all');

  // Messages state (keyed by contactId)
  const [conversationsMap, setConversationsMap] = useState<Record<string, ConversationMessage[]>>({});

  // Bot mode per contact (bot vs human agent takeover)
  const [botModeMap, setBotModeMap] = useState<Record<string, boolean>>({
    'meta_fb_91827491823': true, // Sarah Jenkins: Bot active
    'meta_ig_28471928471': false, // Marcus Reed: Human agent takeover
    'meta_wa_84920194829': true, // Elena Rostova: Bot active
    'meta_fb_38291048291': false, // David Kim: Human agent takeover
    'meta_web_74829104820': true  // Maya Lin: Bot active
  });

  // Follow-up rules (keyed by contactId)
  const [followUpRulesMap, setFollowUpRulesMap] = useState<Record<string, FollowUpRule[]>>({});

  // Composer state
  const [messageInput, setMessageInput] = useState<string>('');
  const composerEmoji = useEmojiTarget<HTMLInputElement>();
  const notesEmoji = useEmojiTarget<HTMLTextAreaElement>();
  const ruleContentEmoji = useEmojiTarget<HTMLTextAreaElement>();
  const composerPz = usePersonalizationTarget<HTMLInputElement>();
  const [selectedMetaTag, setSelectedMetaTag] = useState<ConversationMessage['metaTag'] | ''>('');
  const [isSending, setIsSending] = useState<boolean>(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [showReconnectModal, setShowReconnectModal] = useState(false);

  // Modals & Panels
  const [showContentModal, setShowContentModal] = useState<boolean>(false);
  const [showRuleModal, setShowRuleModal] = useState<boolean>(false);
  const [newRuleTitle, setNewRuleTitle] = useState<string>('');
  const [newRuleDelay, setNewRuleDelay] = useState<string>('Tomorrow at 10:00 AM');
  const [newRuleAction, setNewRuleAction] = useState<FollowUpRule['targetAction']>('send_message');
  const [newRuleContent, setNewRuleContent] = useState<string>('');

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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Copy helper
  const handleCopyText = (text: string, label: string) => {
    if (!text) return;
    navigator.clipboard?.writeText(text);
    setCopiedNotice(label);
    setTimeout(() => setCopiedNotice(null), 2000);
  };

  // Fast Status Switcher helper
  const handleQuickStatusChange = async (newStatus: ContactRecord['status']) => {
    if (!activeContact) return;
    try {
      await updateInboxContact(activeContact.id, { status: newStatus });
      setContacts(prev => prev.map(c => c.id === activeContact.id ? { ...c, status: newStatus } : c));
      setEditForm(prev => ({ ...prev, status: newStatus }));
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  // Initialize and subscribe to Firestore contacts
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let didInitialSelect = false;

    const init = async () => {
      setIsLoadingContacts(true);
      await seedInitialMetaContacts();

      unsubscribe = subscribeToContacts(
        (fetchedContacts) => {
          setContacts(fetchedContacts);
          setIsLoadingContacts(false);
          // Only auto-select on first load; never steal the user's selection on updates.
          if (!didInitialSelect && fetchedContacts.length > 0) {
            didInitialSelect = true;
            setSelectedContactId((prev) => prev || fetchedContacts[0].id);
          }
        },
        (err) => {
          console.error('Failed to subscribe to contacts:', err);
          setIsLoadingContacts(false);
        },
        500,
        prodDb // Backend database: webhook-written contacts live here
      );
    };

    init();
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Selected contact object
  const activeContact = useMemo(() => {
    return contacts.find(c => c.id === selectedContactId) || contacts[0] || null;
  }, [contacts, selectedContactId]);

  // Subscribe to real webhook messages for Meta contacts (replaces seed demo data)
  useEffect(() => {
    if (!activeContact?.senderId || !activeContact?.channel) return;
    if (!['instagram', 'messenger', 'whatsapp'].includes(activeContact.channel)) return;

    const convoId = `${activeContact.channel}_${activeContact.senderId}`;
    // Uses the active workspace id so sends, reads, and writes all target
    // the workspace the user is actually looking at.

    const unsubscribe = subscribeToConversationMessages(
      workspaceId,
      convoId,
      (firestoreMessages) => {
        if (firestoreMessages.length === 0) return; // Keep local state until real messages arrive

        const realMessages: ConversationMessage[] = firestoreMessages.map((m) => ({
          id: m.id,
          contactId: activeContact.id,
          sender: m.direction === 'inbound' ? 'customer' : 'agent',
          text: m.text,
          timestamp: new Date(m.timestampMs).toISOString(),
          senderName: m.direction === 'inbound' ? activeContact.name : 'Agent',
          // Outbound docs land here only after the channel API accepted
          // the send, so they keep their terminal 'delivered' status instead
          // of dropping the optimistic sending/delivered transition.
          deliveryStatus: m.direction === 'inbound' ? undefined : 'delivered',
        }));

        setConversationsMap((prev) => ({
          ...prev,
          [activeContact.id]: realMessages,
        }));
      },
      (err) => {
        console.error('Failed to subscribe to real messages:', err);
      },
      prodDb // Backend database: webhook-written conversations live here
    );

    return () => unsubscribe();
  }, [activeContact?.id, activeContact?.senderId, activeContact?.channel]);

  // Sync edit form when active contact changes
  useEffect(() => {
    if (activeContact) {
      setEditForm({
        name: activeContact.name || '',
        email: activeContact.email || '',
        phone: activeContact.phone || '',
        company: activeContact.company || '',
        jobTitle: activeContact.jobTitle || '',
        status: activeContact.status || 'lead',
        notes: activeContact.notes || ''
      });
      setIsEditingContact(false);
    }
  }, [activeContact?.id]);

  // Initialize sample follow-up rules when contacts load. Note: demo
  // conversation seeding was removed here (2026-09-18). Threads now show
  // only real messages, never fabricated transcripts.
  useEffect(() => {
    if (contacts.length === 0) return;

    // Initialize sample Follow-Up Rules
    setFollowUpRulesMap(prev => {
      if (Object.keys(prev).length > 0) return prev;

      const initialRules: Record<string, FollowUpRule[]> = {};
      const now = new Date();

      contacts.forEach((c, idx) => {
        if (idx === 0) { // Sarah Jenkins
          initialRules[c.id] = [
            {
              id: 'rule-sj-1',
              contactId: c.id,
              title: '24h Window Nudge: Send VIP Code',
              triggerType: 'scheduled',
              delayDescription: 'In 3 hours (Before 24-hr window expires)',
              targetAction: 'send_message',
              contentSnippet: 'Hey Sarah! Here is the VIP30 code for 30% off your agency tier.',
              status: 'active',
              scheduledFor: new Date(now.getTime() + 3 * 3600 * 1000).toISOString(),
              createdAt: new Date().toISOString()
            }
          ];
        } else if (idx === 1) { // Marcus Reed
          initialRules[c.id] = [
            {
              id: 'rule-mr-1',
              contactId: c.id,
              title: 'Tomorrow 9AM: Sales Demo Call Follow-Up',
              triggerType: 'scheduled',
              delayDescription: 'Tomorrow at 9:00 AM',
              targetAction: 'notify_agent',
              contentSnippet: 'Marcus asked for pricing on 15k active subscribers. Send customized agency quotation.',
              status: 'active',
              scheduledFor: new Date(now.getTime() + 14 * 3600 * 1000).toISOString(),
              createdAt: new Date().toISOString()
            }
          ];
        } else {
          initialRules[c.id] = [
            {
              id: `rule-${c.id}-default`,
              contactId: c.id,
              title: '2-Hour Silence Check-in',
              triggerType: 'inactivity',
              delayDescription: '2 hours after last customer response',
              targetAction: 'send_message',
              contentSnippet: 'Checking in to see if you have any questions on setting up your automations.',
              status: 'active',
              createdAt: new Date().toISOString()
            }
          ];
        }
      });

      return initialRules;
    });
  }, [contacts]);

  // Helper to calculate Meta 24-hr messaging window
  const getMessagingWindowStatus = (contact: ContactRecord) => {
    if (!contact.messagingWindowExpiresAt) {
      return { 
        status: 'open', 
        label: 'Within 24h Window', 
        shortLabel: '24h Active',
        timeLeft: '18h left', 
        isExpired: false, 
        badgeColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25',
        dotColor: 'bg-emerald-400'
      };
    }
    const expiresAt = new Date(contact.messagingWindowExpiresAt).getTime();
    const now = Date.now();
    const diffHours = Math.round((expiresAt - now) / (1000 * 60 * 60));

    if (diffHours > 0) {
      return {
        status: 'open',
        label: 'Within 24h Window',
        shortLabel: `${diffHours}h left`,
        timeLeft: `${diffHours}h remaining`,
        isExpired: false,
        badgeColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25',
        dotColor: 'bg-emerald-400'
      };
    } else {
      return {
        status: 'expired',
        label: 'Outside 24h Window (Tag Required)',
        shortLabel: 'Tag Req.',
        timeLeft: 'Outside 24h window',
        isExpired: true,
        badgeColor: 'text-amber-400 bg-amber-500/10 border-amber-500/25',
        dotColor: 'bg-amber-400'
      };
    }
  };

  // Filtered contacts list
  const filteredContacts = useMemo(() => {
    return contacts.filter(c => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = c.name.toLowerCase().includes(q);
        const matchesEmail = (c.email || '').toLowerCase().includes(q);
        const matchesCompany = (c.company || '').toLowerCase().includes(q);
        const matchesTags = (c.tags || []).some(t => t.toLowerCase().includes(q));
        if (!matchesName && !matchesEmail && !matchesCompany && !matchesTags) return false;
      }

      // Channel filter
      if (channelFilter !== 'all' && c.channel !== channelFilter) {
        return false;
      }

      // Status filter
      if (statusFilter !== 'all') {
        const isBotActive = botModeMap[c.id] ?? true;
        const hasRules = (followUpRulesMap[c.id] || []).length > 0;
        if (statusFilter === 'needs_agent' && isBotActive) return false;
        if (statusFilter === 'bot_active' && !isBotActive) return false;
        if (statusFilter === 'followup_due' && !hasRules) return false;
        if (statusFilter === 'resolved' && c.status !== 'customer') return false;
      }

      return true;
    });
  }, [contacts, searchQuery, channelFilter, statusFilter, botModeMap, followUpRulesMap]);

  // Current active conversation messages
  const currentMessages = useMemo(() => {
    if (!activeContact) return [];
    return conversationsMap[activeContact.id] || [];
  }, [conversationsMap, activeContact?.id]);

  // Current active follow-up rules
  const currentRules = useMemo(() => {
    if (!activeContact) return [];
    return followUpRulesMap[activeContact.id] || [];
  }, [followUpRulesMap, activeContact?.id]);

  // Send message handler
  const handleSendMessage = async () => {
    if (!messageInput.trim() || !activeContact) return;

    setIsSending(true);
    setSendError(null);
    const textToSend = messageInput.trim();

    const isBotActive = botModeMap[activeContact.id] ?? false;
    const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const newMsg: ConversationMessage = {
      id: `msg-${Date.now()}`,
      contactId: activeContact.id,
      sender: isBotActive ? 'bot' : 'agent',
      senderName: isBotActive ? 'Chatmize AI Agent' : 'Live Agent',
      text: textToSend,
      timestamp: nowStr,
      metaTag: selectedMetaTag || undefined,
      deliveryStatus: 'sending'
    };

    // Optimistically add to local state
    setConversationsMap(prev => ({
      ...prev,
      [activeContact.id]: [...(prev[activeContact.id] || []), newMsg]
    }));

    setMessageInput('');
    setSelectedMetaTag('');

    try {
      // Call backend to send via the real channel API
      const functions = getFunctions(getApp(), 'us-west2');
      const sendFn = httpsCallable(functions, 'sendChannelMessage');

      // Map UI channel to backend channel
      const channelMap: Record<string, string> = {
        'instagram': 'instagram',
        'messenger': 'messenger',
        'whatsapp': 'whatsapp',
        'facebook': 'messenger',
      };
      const backendChannel = channelMap[activeContact.channel?.toLowerCase()] || 'instagram';

      await sendFn({
        workspaceId,
        channel: backendChannel,
        recipientId: activeContact.senderId || activeContact.id,
        text: textToSend,
      });

      // Mark as delivered
      setConversationsMap(prev => ({
        ...prev,
        [activeContact.id]: (prev[activeContact.id] || []).map(m =>
          m.id === newMsg.id ? { ...m, deliveryStatus: 'delivered' } : m
        )
      }));

      // Write to Firestore so it persists and appears in realtime.
      // Must target prodDb (backend database) so the message lands in the
      // same conversation thread the webhook reads and writes.
      const { doc, setDoc, collection } = await import('firebase/firestore');
      const convoId = `${activeContact.channel}_${activeContact.senderId || activeContact.id}`;
      const msgRef = doc(collection(prodDb, 'workspaces', workspaceId, 'conversations', convoId, 'messages'));
      await setDoc(msgRef, {
        text: textToSend,
        direction: 'outbound',
        channel: backendChannel,
        senderId: activeContact.senderId,
        timestampMs: Date.now(),
        createdAt: new Date().toISOString(),
      });

    } catch (err) {
      console.error('Failed to send message:', err);
      // Surface the real backend reason (e.g. expired page connection)
      // instead of a bare "failed" with no explanation.
      const reason = err instanceof Error && err.message ? err.message : 'Send failed.';
      setSendError(reason);
      // Dead Meta token: pop the reconnect modal on the spot so the owner
      // can fix it immediately instead of hunting through Settings.
      if (isConnectionExpiredError(reason)) {
        setShowReconnectModal(true);
      }
      // Mark as failed
      setConversationsMap(prev => ({
        ...prev,
        [activeContact.id]: (prev[activeContact.id] || []).map(m =>
          m.id === newMsg.id ? { ...m, deliveryStatus: 'failed' } : m
        )
      }));
    } finally {
      setIsSending(false);
    }

    // Update last interaction in Firestore
    updateInboxContact(activeContact.id, {
      lastInteractionAt: new Date().toISOString()
    }).catch(err => console.error('Error updating interaction:', err));

    // Scroll to bottom after sending
    setTimeout(() => {
      const chatContainer = document.querySelector('[data-chat-messages]');
      if (chatContainer) {
        chatContainer.scrollTop = chatContainer.scrollHeight;
      }
    }, 100);
  };

  // Toggle Bot Mode vs Human Takeover
  const toggleBotMode = () => {
    if (!activeContact) return;
    const nextMode = !(botModeMap[activeContact.id] ?? true);
    setBotModeMap(prev => ({
      ...prev,
      [activeContact.id]: nextMode
    }));

    // Post a system log in the thread
    const systemNotice: ConversationMessage = {
      id: `sys-${Date.now()}`,
      contactId: activeContact.id,
      sender: 'system',
      text: nextMode 
        ? '🤖 Bot Handover: AI Agent resumed automated conversation flow.' 
        : '👤 Human Takeover: Live Agent paused automated Bot responses.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      type: 'event_log'
    };

    setConversationsMap(prev => ({
      ...prev,
      [activeContact.id]: [...(prev[activeContact.id] || []), systemNotice]
    }));
  };

  // Send Audience Content Card into thread
  const handleSendAudienceContent = (content: AudienceContentItem) => {
    if (!activeContact) return;

    // Substitute {{first_name}}
    const personalizedText = content.previewText.replace(/\{\{first_name\}\}/g, activeContact.firstName || activeContact.name.split(' ')[0]);

    const contentMsg: ConversationMessage = {
      id: `content-${Date.now()}`,
      contactId: activeContact.id,
      sender: 'bot',
      senderName: 'Chatmize AI Content Hub',
      text: personalizedText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      type: 'content_card',
      contentCard: {
        title: content.title,
        description: content.description,
        badge: content.badge,
        buttonText: content.buttonText,
        flowId: content.flowId
      },
      deliveryStatus: 'delivered'
    };

    setConversationsMap(prev => ({
      ...prev,
      [activeContact.id]: [...(prev[activeContact.id] || []), contentMsg]
    }));

    setShowContentModal(false);

    // If it's a flow, tag the contact with the audience tag
    const flowTag = `Delivered: ${content.title}`;
    if (!activeContact.tags.includes(flowTag)) {
      const updatedTags = [...activeContact.tags, flowTag];
      updateInboxContact(activeContact.id, { tags: updatedTags }).catch(console.error);
    }
  };

  // Add Follow-Up Rule
  const handleAddFollowUpRule = () => {
    if (!newRuleTitle.trim() || !activeContact) return;

    const newRule: FollowUpRule = {
      id: `rule-${Date.now()}`,
      contactId: activeContact.id,
      title: newRuleTitle.trim(),
      triggerType: 'scheduled',
      delayDescription: newRuleDelay,
      targetAction: newRuleAction,
      contentSnippet: newRuleContent.trim() || 'Follow up with customer regarding requested content.',
      status: 'active',
      createdAt: new Date().toISOString()
    };

    setFollowUpRulesMap(prev => ({
      ...prev,
      [activeContact.id]: [...(prev[activeContact.id] || []), newRule]
    }));

    // Post log to conversation thread
    const ruleLog: ConversationMessage = {
      id: `rule-log-${Date.now()}`,
      contactId: activeContact.id,
      sender: 'system',
      text: `📅 Follow-Up Rule Created: "${newRule.title}" scheduled for [${newRule.delayDescription}].`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      type: 'event_log'
    };

    setConversationsMap(prev => ({
      ...prev,
      [activeContact.id]: [...(prev[activeContact.id] || []), ruleLog]
    }));

    setNewRuleTitle('');
    setNewRuleContent('');
    setShowRuleModal(false);
  };

  // Trigger / Execute Rule Now
  const handleExecuteRuleNow = (rule: FollowUpRule) => {
    if (!activeContact) return;

    const execMsg: ConversationMessage = {
      id: `rule-exec-${Date.now()}`,
      contactId: activeContact.id,
      sender: rule.targetAction === 'send_flow' ? 'bot' : 'agent',
      senderName: rule.targetAction === 'send_flow' ? 'Chatmize AI Rule Runner' : 'Live Agent (Follow-Up)',
      text: rule.contentSnippet.replace(/\{\{first_name\}\}/g, activeContact.firstName || 'there'),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      deliveryStatus: 'delivered'
    };

    setConversationsMap(prev => ({
      ...prev,
      [activeContact.id]: [...(prev[activeContact.id] || []), execMsg]
    }));

    // Mark rule as triggered
    setFollowUpRulesMap(prev => ({
      ...prev,
      [activeContact.id]: (prev[activeContact.id] || []).map(r => 
        r.id === rule.id ? { ...r, status: 'triggered' } : r
      )
    }));
  };

  // Delete Rule
  const handleDeleteRule = (ruleId: string) => {
    if (!activeContact) return;
    setFollowUpRulesMap(prev => ({
      ...prev,
      [activeContact.id]: (prev[activeContact.id] || []).filter(r => r.id !== ruleId)
    }));
  };

  // Save Contact updates to Firestore
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
        notes: editForm.notes.trim()
      };

      await updateInboxContact(activeContact.id, updates);

      // Update local contact record
      setContacts(prev => prev.map(c => c.id === activeContact.id ? { ...c, ...updates } : c));

      setIsEditingContact(false);
      setSaveSuccessNotice(true);
      setTimeout(() => setSaveSuccessNotice(false), 2500);

      // Add system log
      const sysMsg: ConversationMessage = {
        id: `sys-edit-${Date.now()}`,
        contactId: activeContact.id,
        sender: 'system',
        text: `📝 Contact Profile Updated: Synchronized customer details with Firestore & Audience CRM.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        type: 'event_log'
      };

      setConversationsMap(prev => ({
        ...prev,
        [activeContact.id]: [...(prev[activeContact.id] || []), sysMsg]
      }));
    } catch (err) {
      console.error('Failed to update contact in Firestore:', err);
    }
  };

  // Add Tag to Contact
  const handleAddTag = async (tagToAdd: string) => {
    if (!activeContact || !tagToAdd.trim()) return;
    const cleanTag = tagToAdd.trim();
    if (activeContact.tags.includes(cleanTag)) return;

    const newTags = [...activeContact.tags, cleanTag];
    await updateInboxContact(activeContact.id, { tags: newTags });
    setContacts(prev => prev.map(c => c.id === activeContact.id ? { ...c, tags: newTags } : c));
    setNewTagInput('');
  };

  // Remove Tag from Contact
  const handleRemoveTag = async (tagToRemove: string) => {
    if (!activeContact) return;
    const newTags = activeContact.tags.filter(t => t !== tagToRemove);
    await updateInboxContact(activeContact.id, { tags: newTags });
    setContacts(prev => prev.map(c => c.id === activeContact.id ? { ...c, tags: newTags } : c));
  };

  // Add/Update Custom Variable
  const handleSaveVariable = async () => {
    if (!activeContact || !newVarKey.trim()) return;
    const key = newVarKey.trim().toLowerCase().replace(/\s+/g, '_');
    const val = newVarVal.trim();

    const updatedVars = {
      ...(activeContact.variables || {}),
      [key]: val
    };

    await updateInboxContact(activeContact.id, { 
      variables: updatedVars,
      customFields: updatedVars
    });

    setContacts(prev => prev.map(c => c.id === activeContact.id ? { 
      ...c, 
      variables: updatedVars,
      customFields: updatedVars 
    } : c));

    setNewVarKey('');
    setNewVarVal('');
  };

  // Channel badge helper
  const renderChannelIcon = (channel: string) => {
    switch (channel) {
      case 'messenger':
        return <MessageSquare className="w-3.5 h-3.5 text-blue-400" />;
      case 'instagram':
        return <Instagram className="w-3.5 h-3.5 text-pink-400" />;
      case 'whatsapp':
        return <Smartphone className="w-3.5 h-3.5 text-emerald-400" />;
      default:
        return <Globe className="w-3.5 h-3.5 text-cyan-400" />;
    }
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
      {/* =========================================================================
          TOP BAR: Streamlined Omnichannel Control Header & Sync Telemetry
          ========================================================================= */}
      <div className="px-5 py-2.5 border-b border-white/10 bg-slate-900/90 backdrop-blur-md flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-500 flex items-center justify-center shadow-md shadow-cyan-500/20 shrink-0">
            <MessageSquare className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-white tracking-tight">Live Conversations Inbox</h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Omnichannel Connected
              </span>
              <span className="hidden md:inline-flex px-1.5 py-0.5 rounded text-[10px] font-mono bg-white/5 text-slate-400 border border-white/10">
                {contacts.length} Contacts
              </span>
            </div>
          </div>
        </div>

        {/* Center/Right Action Toolbar */}
        <div className="flex items-center gap-2">
          {/* Active Contact Quick Glance */}
          {activeContact && (
            <div className="hidden lg:flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-950/60 border border-white/10 text-xs">
              <span className="text-slate-400 text-[11px]">Chatting with:</span>
              <span className="font-semibold text-white truncate max-w-[120px]">{activeContact.name}</span>
              <span className="text-slate-500">•</span>
              <span className="text-[11px] text-cyan-400 capitalize">{activeContact.channel}</span>
            </div>
          )}

          {/* Audience CRM View Shortcut */}
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

      {/* =========================================================================
          3-COLUMN MASTER INBOX LAYOUT
          ========================================================================= */}
      <div className="flex-1 flex overflow-hidden">
        {/* =========================================================================
            COLUMN 1: CONVERSATIONS LIST (Omnichannel Filter & Triage Feed)
            ========================================================================= */}
        <div className="w-80 xl:w-92 border-r border-white/10 flex flex-col bg-slate-900/40 shrink-0">
          {/* Search & Channel Filters */}
          <div className="p-3 border-b border-white/10 space-y-2.5 bg-slate-900/60">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search leads, tags, channels..."
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

            {/* Omnichannel Channel Pills */}
            <div className="flex items-center gap-1 overflow-x-auto pb-0.5 scrollbar-none text-[11px]">
              {[
                { id: 'all', label: 'All', icon: null },
                { id: 'messenger', label: 'Messenger', icon: <MessageSquare className="w-3 h-3 text-blue-400" /> },
                { id: 'instagram', label: 'Instagram', icon: <Instagram className="w-3 h-3 text-pink-400" /> },
                { id: 'whatsapp', label: 'WhatsApp', icon: <Smartphone className="w-3 h-3 text-emerald-400" /> },
                { id: 'web', label: 'Web', icon: <Globe className="w-3 h-3 text-cyan-400" /> }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setChannelFilter(tab.id as any)}
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

            {/* Status Segmented Tabs */}
            <div className="grid grid-cols-4 gap-1 p-1 bg-slate-950/70 rounded-xl border border-white/5 text-[10px]">
              {[
                { id: 'all', label: 'All' },
                { id: 'needs_agent', label: 'Needs Agent' },
                { id: 'bot_active', label: 'Bot' },
                { id: 'followup_due', label: 'Rules' }
              ].map(st => (
                <button
                  key={st.id}
                  onClick={() => setStatusFilter(st.id as any)}
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

          {/* Conversations Scrollable Feed */}
          <div className="flex-1 overflow-y-auto divide-y divide-white/5">
            {isLoadingContacts ? (
              <div className="p-8 text-center text-slate-500 flex flex-col items-center gap-3">
                <RefreshCw className="w-5 h-5 animate-spin text-cyan-400" />
                <span className="text-xs">Loading conversations from Firestore...</span>
              </div>
            ) : filteredContacts.length === 0 ? (
              <div className="p-8 text-center text-slate-500 flex flex-col items-center gap-2">
                <MessageSquare className="w-8 h-8 text-slate-600" />
                <p className="text-xs">No conversations match your search filters.</p>
              </div>
            ) : (
              filteredContacts.map(contact => {
                const isSelected = contact.id === activeContact?.id;
                const isBot = botModeMap[contact.id] ?? true;
                const windowInfo = getMessagingWindowStatus(contact);
                const rules = followUpRulesMap[contact.id] || [];
                const lastMsg = (conversationsMap[contact.id] || []).slice(-1)[0];

                return (
                  <button
                    key={contact.id}
                    onClick={() => setSelectedContactId(contact.id)}
                    className={`w-full text-left p-3 transition-all flex items-start gap-2.5 cursor-pointer relative ${
                      isSelected 
                        ? 'bg-slate-900/90 border-l-2 border-l-cyan-400 shadow-sm' 
                        : 'hover:bg-white/5 border-l-2 border-l-transparent'
                    }`}
                  >
                    {/* Avatar with Channel Badge */}
                    <div className="relative shrink-0">
                      {contact.avatarUrl ? (
                        <img 
                          src={contact.avatarUrl} 
                          alt={contact.name} 
                          referrerPolicy="no-referrer"
                          className="w-9 h-9 rounded-full object-cover border border-white/15"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-slate-800 text-cyan-400 flex items-center justify-center font-bold text-xs border border-white/10">
                          {contact.name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                        </div>
                      )}
                      {/* Channel Pill on Avatar */}
                      <div className="absolute -bottom-1 -right-1 p-0.5 rounded-full bg-slate-950 border border-white/20">
                        {renderChannelIcon(contact.channel)}
                      </div>
                    </div>

                    {/* Middle Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <h4 className={`text-xs font-bold truncate ${isSelected ? 'text-white' : 'text-slate-200'}`}>
                          {contact.name}
                        </h4>
                        <span className="text-[10px] text-slate-500 shrink-0 ml-1">
                          {lastMsg?.timestamp || 'Active'}
                        </span>
                      </div>

                      {/* Last Message Preview */}
                      <p className="text-[11px] text-slate-400 truncate mb-1.5">
                        {lastMsg?.sender === 'bot' && <span className="text-cyan-400 font-medium">Bot: </span>}
                        {lastMsg?.sender === 'agent' && <span className="text-purple-400 font-medium">Agent: </span>}
                        {lastMsg?.text || 'No recent messages'}
                      </p>

                      {/* Status Badges Row */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {/* Bot vs Human Pill */}
                        <span className={`px-1.5 py-0.2 rounded text-[9px] font-semibold border ${
                          isBot 
                            ? 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20' 
                            : 'text-purple-400 bg-purple-500/10 border-purple-500/20'
                        }`}>
                          {isBot ? '🤖 Bot' : '👤 Agent'}
                        </span>

                        {/* Meta 24h Window Indicator */}
                        <span 
                          className={`px-1.5 py-0.2 rounded text-[9px] font-semibold border ${windowInfo.badgeColor}`}
                          title={windowInfo.label}
                        >
                          {windowInfo.shortLabel}
                        </span>

                        {/* Follow-up Due Indicator */}
                        {rules.length > 0 && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-0.5">
                            <Clock className="w-2.5 h-2.5" />
                            <span>{rules.length} rule{rules.length > 1 ? 's' : ''}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* =========================================================================
            COLUMN 2: INTERACTIVE CHAT THREAD & ADVANCED COMPOSER
            ========================================================================= */}
        <div className="flex-1 flex flex-col bg-slate-950/70 overflow-hidden border-r border-white/10">
          {activeContact ? (
            <>
              {/* Active Conversation Header */}
              <div className="px-4 py-2.5 border-b border-white/10 bg-slate-900/80 backdrop-blur-sm flex flex-wrap items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    {activeContact.avatarUrl ? (
                      <img 
                        src={activeContact.avatarUrl} 
                        alt={activeContact.name} 
                        referrerPolicy="no-referrer"
                        className="w-9 h-9 rounded-full object-cover border border-white/15"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-cyan-600/20 text-cyan-400 font-bold text-xs flex items-center justify-center border border-white/10">
                        {activeContact.name.substring(0, 2).toUpperCase()}
                      </div>
                    )}
                    <span className="absolute -bottom-1 -right-1 p-0.5 rounded-full bg-slate-900 border border-white/15">
                      {renderChannelIcon(activeContact.channel)}
                    </span>
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-bold text-white">{activeContact.name}</h2>
                      
                      {/* Interactive CRM Stage Dropdown Selector */}
                      <div className="relative inline-flex items-center">
                        <select
                          value={activeContact.status}
                          onChange={(e) => handleQuickStatusChange(e.target.value as any)}
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

                      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-white/5 text-slate-300 border border-white/10">
                        {activeContact.channel}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                      <span>{activeContact.company || 'Individual Contact'}</span>
                      <span>•</span>
                      <span>{activeContact.email || activeContact.phone || 'No phone'}</span>
                    </div>
                  </div>
                </div>

                {/* Right Header Controls: Mode toggle & Actions */}
                <div className="flex items-center gap-2">
                  {/* Bot vs Human Takeover Toggle Switch */}
                  <button
                    onClick={toggleBotMode}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer border shadow-sm ${
                      (botModeMap[activeContact.id] ?? true)
                        ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40 hover:bg-cyan-500/25'
                        : 'bg-purple-500/15 text-purple-300 border-purple-500/40 hover:bg-purple-500/25'
                    }`}
                    title="Switch between AI Automation and Live Agent Human Takeover"
                  >
                    {(botModeMap[activeContact.id] ?? true) ? (
                      <>
                        <Bot className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Bot Handling (Take Over)</span>
                      </>
                    ) : (
                      <>
                        <UserCheck className="w-3.5 h-3.5 text-purple-400" />
                        <span>Human Takeover (Resume Bot)</span>
                      </>
                    )}
                  </button>

                  {/* Send Audience Content Button */}
                  <button
                    onClick={() => setShowContentModal(true)}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 text-cyan-300 border border-cyan-500/30 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                    title="Send an interactive Bot Map flow, Lead Magnet, or Recurring Notification card"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Send Content</span>
                  </button>

                  {/* Add Follow-Up Rule Button */}
                  <button
                    onClick={() => setShowRuleModal(true)}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                    title="Create follow-up automation rules for this customer"
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>+ Rule</span>
                  </button>
                </div>
              </div>

              {/* Follow-Up Rules Alert Bar (If any active rules exist) */}
              {currentRules.length > 0 && (
                <div className="px-4 py-2 bg-amber-950/30 border-b border-amber-500/20 flex items-center justify-between gap-2 text-xs text-amber-300 shrink-0">
                  <div className="flex items-center gap-2 truncate">
                    <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span className="font-semibold shrink-0">Scheduled Rule:</span>
                    <span className="text-amber-200/90 truncate">
                      "{currentRules[0].title}" ({currentRules[0].delayDescription})
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => handleExecuteRuleNow(currentRules[0])}
                      className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 cursor-pointer"
                      title="Execute this follow-up immediately"
                    >
                      Trigger Now
                    </button>
                    <button
                      onClick={() => handleDeleteRule(currentRules[0].id)}
                      className="p-1 text-amber-400/70 hover:text-amber-200 cursor-pointer"
                      title="Dismiss rule"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {/* Message Thread Scroll View */}
              <div data-chat-messages className="flex-1 overflow-y-auto p-4 space-y-3.5">
                {currentMessages.map(msg => {
                  if (msg.type === 'event_log') {
                    return (
                      <div key={msg.id} className="flex justify-center my-1.5">
                        <div className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[11px] text-slate-400 flex items-center gap-1.5 max-w-lg text-center">
                          <Zap className="w-3 h-3 text-cyan-400 shrink-0" />
                          <span>{msg.text}</span>
                          <span className="text-[10px] text-slate-500 ml-1 shrink-0">{msg.timestamp}</span>
                        </div>
                      </div>
                    );
                  }

                  const isCustomer = msg.sender === 'customer';
                  const isBot = msg.sender === 'bot';

                  return (
                    <div 
                      key={msg.id} 
                      className={`flex gap-2.5 ${isCustomer ? 'justify-start' : 'justify-end'}`}
                    >
                      {/* Customer Avatar on left */}
                      {isCustomer && (
                        <div className="w-7 h-7 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center shrink-0 mt-1 text-[10px] font-bold text-slate-300">
                          {activeContact.firstName?.[0] || 'C'}
                        </div>
                      )}

                      <div className={`max-w-md space-y-1 ${isCustomer ? 'items-start' : 'items-end'}`}>
                        {/* Sender Label */}
                        <div className={`flex items-center gap-1.5 text-[10px] ${isCustomer ? 'text-slate-400' : 'text-slate-400 justify-end'}`}>
                          <span>{msg.senderName || (isCustomer ? activeContact.name : 'Agent')}</span>
                          <span>•</span>
                          <span>{msg.timestamp}</span>
                          {msg.metaTag && (
                            <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[9px] font-semibold">
                              Tag: {msg.metaTag}
                            </span>
                          )}
                        </div>

                        {/* Bubble */}
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

                          {/* Content Card Attachment (if any) */}
                          {msg.contentCard && (
                            <div className="mt-2.5 p-3 rounded-xl bg-slate-950/80 border border-white/15 space-y-2">
                              {msg.contentCard.badge && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 inline-block">
                                  {msg.contentCard.badge}
                                </span>
                              )}
                              <h4 className="text-xs font-bold text-white">{msg.contentCard.title}</h4>
                              <p className="text-[11px] text-slate-400">{msg.contentCard.description}</p>
                              <div className="pt-1 flex items-center justify-between">
                                <button
                                  onClick={() => {
                                    if (msg.contentCard?.flowId && onNavigateToFlows) {
                                      onNavigateToFlows(msg.contentCard.flowId);
                                    }
                                  }}
                                  className="w-full py-1.5 px-3 rounded-lg text-xs font-bold bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition-all text-center cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-cyan-500/20"
                                >
                                  <span>{msg.contentCard.buttonText}</span>
                                  <ExternalLink className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Delivery status for outbound */}
                        {!isCustomer && msg.deliveryStatus && (
                          <div className="text-[10px] text-slate-500 flex items-center justify-end gap-1">
                            <CheckCircle2 className="w-2.5 h-2.5 text-cyan-400" />
                            <span className="capitalize">{msg.deliveryStatus}</span>
                          </div>
                        )}
                      </div>

                      {/* Agent / Bot Avatar on right */}
                      {!isCustomer && (
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-1 text-[10px] font-bold ${
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

              {/* Quick Template Chips Bar */}
              <div className="px-4 py-1.5 border-t border-white/5 bg-slate-900/40 flex items-center gap-2 overflow-x-auto scrollbar-none text-[11px] shrink-0">
                <span className="text-[10px] uppercase font-bold text-slate-500 shrink-0">Quick Reply:</span>
                {[
                  'Thank you for reaching out! Let me check on that.',
                  'Here is your exclusive VIP access pass.',
                  'Would you like to schedule a 1-on-1 walkthrough?',
                  'Can you confirm your preferred email address?'
                ].map((qr, idx) => (
                  <button
                    key={idx}
                    onClick={() => setMessageInput(qr)}
                    className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 whitespace-nowrap transition-all cursor-pointer text-[11px]"
                  >
                    "{qr.length > 28 ? qr.substring(0, 28) + '...' : qr}"
                  </button>
                ))}
              </div>

              {/* Message Composer & Policy Tag Bar */}
              <div className="p-3 border-t border-white/10 bg-slate-900/90 backdrop-blur-md space-y-2 shrink-0">
                {/* Meta Message Tag bar for compliance */}
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold text-slate-300">Policy Tag:</span>
                    <select
                      value={selectedMetaTag}
                      onChange={(e) => setSelectedMetaTag(e.target.value as any)}
                      className="bg-slate-950 border border-white/10 rounded-lg px-2 py-0.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500/50"
                    >
                      <option value="">Standard (Within 24-hr window)</option>
                      <option value="CONFIRMED_EVENT_UPDATE">CONFIRMED_EVENT_UPDATE (Event reminders)</option>
                      <option value="POST_PURCHASE_UPDATE">POST_PURCHASE_UPDATE (Order receipts)</option>
                      <option value="ACCOUNT_UPDATE">ACCOUNT_UPDATE (Security/Account)</option>
                      <option value="HUMAN_AGENT">HUMAN_AGENT (7-Day Agent Support)</option>
                    </select>
                  </div>

                  {/* Variable Pills for fast insertion */}
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <span className="text-slate-500 text-[10px]">Insert:</span>
                    <button
                      type="button"
                      onClick={() => setMessageInput(prev => `${prev} {{first_name}}`)}
                      className="px-1.5 py-0.5 rounded bg-white/5 hover:bg-cyan-500/20 text-cyan-300 border border-white/10 cursor-pointer font-mono text-[10px]"
                    >
                      {`{{first_name}}`}
                    </button>
                    <button
                      type="button"
                      onClick={() => setMessageInput(prev => `${prev} {{company}}`)}
                      className="px-1.5 py-0.5 rounded bg-white/5 hover:bg-cyan-500/20 text-cyan-300 border border-white/10 cursor-pointer font-mono text-[10px]"
                    >
                      {`{{company}}`}
                    </button>
                  </div>
                </div>

                {/* Send error banner: surfaces the real backend reason */}
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

                {/* Input row */}
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
                      placeholder={`Reply as ${ (botModeMap[activeContact.id] ?? true) ? 'Chatmize AI Agent' : 'Live Agent' }...`}
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
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500 p-8">
              <MessageSquare className="w-12 h-12 text-slate-700 mb-2" />
              <p className="text-sm">Select a conversation from the left to view the live chat thread.</p>
            </div>
          )}
        </div>

        {/* =========================================================================
            COLUMN 3: AUDIENCE & CONTACT CRM PROFILE INSPECTOR (Real-time Firestore Sync)
            ========================================================================= */}
        <div className="w-80 xl:w-92 border-l border-white/10 flex flex-col bg-slate-900/40 shrink-0 overflow-y-auto">
          {activeContact ? (
            <div className="p-4 space-y-5">
              {/* Header: Title & Edit Mode Toggle */}
              <div className="flex items-center justify-between pb-2.5 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-cyan-400" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-white">Audience CRM</h3>
                </div>

                <button
                  onClick={() => {
                    if (isEditingContact) {
                      handleSaveContactProfile();
                    } else {
                      setIsEditingContact(true);
                    }
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
              </div>

              {/* Success / Copied notice */}
              {saveSuccessNotice && (
                <div className="p-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2 animate-fadeIn">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Contact info synced with Firestore!</span>
                </div>
              )}

              {copiedNotice && (
                <div className="p-2 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-xs flex items-center gap-2 animate-fadeIn">
                  <Check className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span>{copiedNotice} copied to clipboard!</span>
                </div>
              )}

              {/* Customer Profile Header */}
              <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-white/10 space-y-3">
                <div className="flex items-center gap-3">
                  {activeContact.avatarUrl ? (
                    <img 
                      src={activeContact.avatarUrl} 
                      alt={activeContact.name} 
                      referrerPolicy="no-referrer"
                      className="w-11 h-11 rounded-full object-cover border border-white/15 shrink-0"
                    />
                  ) : (
                    <div className="w-11 h-11 rounded-full bg-slate-800 text-cyan-400 flex items-center justify-center font-bold text-sm border border-white/15 shrink-0">
                      {activeContact.name.substring(0, 2).toUpperCase()}
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-bold text-white truncate">{activeContact.name}</h4>
                    <p className="text-xs text-slate-400 truncate">{activeContact.company || 'Direct Contact'}</p>
                  </div>
                </div>

                {/* CRM Stage Quick Selector Pills */}
                <div className="grid grid-cols-3 gap-1 pt-1 text-[10px]">
                  {(['lead', 'subscriber', 'customer'] as const).map(st => (
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
              </div>

              {/* SECTION A: Primary Customer Details */}
              <div className="space-y-2.5">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Customer Identity</span>
                
                {isEditingContact ? (
                  <div className="space-y-2.5">
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">Full Name</label>
                      <input
                        type="text"
                        value={editForm.name}
                        onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                        className="w-full px-3 py-1.5 bg-slate-950 border border-white/15 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500/50"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">Email Address</label>
                      <input
                        type="email"
                        value={editForm.email}
                        onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                        className="w-full px-3 py-1.5 bg-slate-950 border border-white/15 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500/50"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">Mobile / Phone</label>
                      <input data-no-emoji
                        type="text"
                        value={editForm.phone}
                        onChange={(e) => setEditForm(prev => ({ ...prev, phone: e.target.value }))}
                        className="w-full px-3 py-1.5 bg-slate-950 border border-white/15 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500/50"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-1">Company</label>
                        <input
                          type="text"
                          value={editForm.company}
                          onChange={(e) => setEditForm(prev => ({ ...prev, company: e.target.value }))}
                          className="w-full px-3 py-1.5 bg-slate-950 border border-white/15 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500/50"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-1">Stage / Status</label>
                        <select
                          value={editForm.status}
                          onChange={(e) => setEditForm(prev => ({ ...prev, status: e.target.value as any }))}
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
                        <EmojiPickerButton onPick={(e) => notesEmoji.insert(e, editForm.notes, (v) => setEditForm(prev => ({ ...prev, notes: v })))} placement="down" />
                      </div>
                      <textarea
                        rows={2}
                        ref={notesEmoji.ref}
                        value={editForm.notes}
                        onChange={(e) => setEditForm(prev => ({ ...prev, notes: e.target.value }))}
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

              {/* SECTION B: Audience Tags Management */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Audience Tags</span>
                  <span className="text-[10px] text-slate-500">{activeContact.tags.length} applied</span>
                </div>

                {/* Tags cloud */}
                <div className="flex flex-wrap gap-1.5">
                  {activeContact.tags.map(tag => (
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

                {/* Add Tag row */}
                <div className="flex items-center gap-1.5 pt-1">
                  <input data-no-emoji
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

                {/* Quick suggestions */}
                <div className="flex flex-wrap gap-1 text-[10px] text-slate-400">
                  <span className="text-slate-500">Popular:</span>
                  {['VIP Client', 'Follow-up Due', 'Webinar Registered', 'High Budget'].map(sugg => (
                    <button
                      key={sugg}
                      onClick={() => handleAddTag(sugg)}
                      className="hover:text-cyan-400 underline decoration-dotted cursor-pointer"
                    >
                      +{sugg}
                    </button>
                  ))}
                </div>
              </div>

              {/* SECTION C: Active Follow-Up Rules List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Follow-Up Automation</span>
                  <button
                    onClick={() => setShowRuleModal(true)}
                    className="text-[10px] font-bold text-amber-400 hover:text-amber-300 cursor-pointer flex items-center gap-0.5"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add Rule</span>
                  </button>
                </div>

                <div className="space-y-1.5">
                  {currentRules.length === 0 ? (
                    <p className="text-slate-500 text-[11px] p-2 rounded-xl bg-slate-950/40 border border-white/5">
                      No automated follow-up rules active for this customer.
                    </p>
                  ) : (
                    currentRules.map(rule => (
                      <div 
                        key={rule.id}
                        className="p-2.5 rounded-xl bg-slate-950/70 border border-amber-500/20 space-y-1 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-amber-200 text-[11px] truncate">{rule.title}</span>
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            Active
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5 text-amber-400" />
                          <span>{rule.delayDescription}</span>
                        </p>
                        <div className="pt-1 flex items-center justify-between border-t border-white/5 text-[10px]">
                          <button
                            onClick={() => handleExecuteRuleNow(rule)}
                            className="text-amber-400 hover:text-amber-300 font-semibold cursor-pointer"
                          >
                            Trigger Now
                          </button>
                          <button
                            onClick={() => handleDeleteRule(rule.id)}
                            className="text-slate-500 hover:text-red-400 cursor-pointer"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* SECTION D: Dynamic Variables & Custom Fields */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Custom Variables</span>
                </div>

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

                {/* Add variable input */}
                <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                  <input data-no-emoji
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

              {/* SECTION E: Policy & Meta Compliance */}
              <div className="space-y-2 pt-2 border-t border-white/10">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Meta Messaging Policy</span>
                
                <div className="p-3 rounded-2xl bg-slate-950/80 border border-white/10 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">24-hr Window:</span>
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${getMessagingWindowStatus(activeContact).badgeColor}`}>
                      {getMessagingWindowStatus(activeContact).shortLabel}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">7-Day Agent:</span>
                    <span className="text-purple-300 font-semibold text-[11px]">Authorized</span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Recurring Tokens:</span>
                    <span className="text-cyan-300 font-semibold text-[11px]">
                      {activeContact.recurringTokens?.length ? `${activeContact.recurringTokens.length} Active` : '0 Active'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-slate-500 text-xs">
              Select a customer to inspect and update their CRM profile.
            </div>
          )}
        </div>
      </div>

      {/* =========================================================================
          MODAL 1: SEND AUDIENCE CONTENT (Bot Flows, Lead Magnets, Opt-In Cards)
          ========================================================================= */}
      {showContentModal && activeContact && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-slate-900 border border-white/15 rounded-3xl p-6 shadow-2xl space-y-5 animate-scaleUp">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Send Audience Content to {activeContact.name}</h3>
                  <p className="text-xs text-slate-400">Select an interactive Bot Map flow, guide, or Recurring Notification prompt to send.</p>
                </div>
              </div>
              <button 
                onClick={() => setShowContentModal(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/5"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Catalog Grid */}
            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {AUDIENCE_CONTENT_CATALOG.map(item => (
                <div 
                  key={item.id}
                  className="p-4 rounded-2xl bg-slate-950/60 border border-white/10 hover:border-cyan-500/30 transition-all flex items-start justify-between gap-4"
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                        {item.badge}
                      </span>
                      <span className="text-[11px] text-slate-500">• {item.category}</span>
                    </div>
                    <h4 className="text-xs font-bold text-white">{item.title}</h4>
                    <p className="text-xs text-slate-400">{item.description}</p>
                    <p className="text-[11px] text-slate-500 italic bg-white/5 p-2 rounded-xl border border-white/5">
                      "{item.previewText.replace(/\{\{first_name\}\}/g, activeContact.firstName || 'there')}"
                    </p>
                  </div>

                  <button
                    onClick={() => handleSendAudienceContent(item)}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition-all flex items-center gap-1.5 shrink-0 cursor-pointer shadow-md shadow-cyan-500/20"
                  >
                    <span>Send to Chat</span>
                    <Send className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-white/10 flex justify-end">
              <button
                onClick={() => setShowContentModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-white/5"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 2: ADD / CONFIGURE FOLLOW-UP RULE
          ========================================================================= */}
      {showRuleModal && activeContact && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-white/15 rounded-3xl p-6 shadow-2xl space-y-5 animate-scaleUp">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Configure Follow-Up Automation Rule</h3>
                  <p className="text-xs text-slate-400">Set intuitive reminder and re-engagement rules for {activeContact.name}.</p>
                </div>
              </div>
              <button 
                onClick={() => setShowRuleModal(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/5"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Presets */}
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-slate-400">Quick Rule Presets</label>
              <div className="grid grid-cols-2 gap-2">
                {PRESET_FOLLOW_UP_TEMPLATES.map((tmpl, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setNewRuleTitle(tmpl.title);
                      setNewRuleDelay(tmpl.delayDescription);
                      setNewRuleAction(tmpl.targetAction);
                      setNewRuleContent(tmpl.contentSnippet);
                    }}
                    className="p-2.5 text-left rounded-xl bg-slate-950/70 hover:bg-white/5 border border-white/10 hover:border-amber-500/30 transition-all text-xs cursor-pointer"
                  >
                    <span className="font-bold text-slate-200 block text-[11px]">{tmpl.title}</span>
                    <span className="text-[10px] text-amber-400/80">{tmpl.delayDescription}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Form Fields */}
            <div className="space-y-3">
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Rule Name</label>
                <input data-no-emoji
                  type="text"
                  value={newRuleTitle}
                  onChange={(e) => setNewRuleTitle(e.target.value)}
                  placeholder="e.g. 24h Webinar Re-engagement Nudge"
                  className="w-full px-3.5 py-2 bg-slate-950 border border-white/15 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500/50"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Timing / Trigger</label>
                  <input data-no-emoji
                    type="text"
                    value={newRuleDelay}
                    onChange={(e) => setNewRuleDelay(e.target.value)}
                    placeholder="e.g. Tomorrow at 10:00 AM"
                    className="w-full px-3.5 py-2 bg-slate-950 border border-white/15 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500/50"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Target Action</label>
                  <select
                    value={newRuleAction}
                    onChange={(e) => setNewRuleAction(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-950 border border-white/15 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500/50"
                  >
                    <option value="send_message">Send Re-engagement Message</option>
                    <option value="send_flow">Trigger Bot Map Flow</option>
                    <option value="notify_agent">Notify Live Agent</option>
                    <option value="apply_tag">Apply CRM Tag</option>
                  </select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400 block">Message Content / Action Payload</label>
                  <EmojiPickerButton onPick={(e) => ruleContentEmoji.insert(e, newRuleContent, setNewRuleContent)} placement="up" />
                </div>
                <textarea
                  rows={3}
                  ref={ruleContentEmoji.ref}
                  value={newRuleContent}
                  onChange={(e) => setNewRuleContent(e.target.value)}
                  placeholder="Message or flow instructions to execute..."
                  className="w-full px-3.5 py-2 bg-slate-950 border border-white/15 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500/50"
                />
              </div>
            </div>

            {/* Footer actions */}
            <div className="pt-2 border-t border-white/10 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowRuleModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddFollowUpRule}
                disabled={!newRuleTitle.trim()}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition-all cursor-pointer disabled:opacity-40 shadow-md shadow-amber-500/20"
              >
                Create Follow-Up Rule
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
