import React, { useState } from 'react';
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
  Sliders, 
  Layers,
  Smartphone,
  Monitor,
  ExternalLink,
  ShieldCheck,
  UserCheck,
  ArrowUp,
  Layout,
  RotateCcw,
  Minimize2,
  Maximize2
} from 'lucide-react';
import { SupportChatWidgetConfig } from '../../types/growthTools';
import { DEFAULT_SUPPORT_WIDGETS } from '../../data/growthToolsDefaults';

interface SupportChatViewProps {
  availableBots?: Array<{ id: string; name: string }>;
  onNavigateToFlows?: (botId?: string) => void;
}

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
    welcomeMessage: '👋 Hi there! Welcome to our website. How can I assist you today? Feel free to ask about our pricing, features, or order status!',
    brandColor: '#00d2ff',
    botName: 'Support Concierge',
    quickReplies: [
      { id: 'qr-1', label: '💬 Talk to Sales', payload: 'TALK_SALES' },
      { id: 'qr-2', label: '📦 Track Order', payload: 'TRACK_ORDER' },
      { id: 'qr-3', label: '❓ Pricing Plans', payload: 'PRICING' }
    ]
  },
  {
    name: 'E-Commerce Assistant',
    headline: 'Looking for the Perfect Deal?',
    subheadline: 'Instant discounts, sizing help, and order tracking.',
    welcomeMessage: '🛍️ Welcome to our store! Looking for a specific item, or want to claim today\'s exclusive 15% off coupon?',
    brandColor: '#10b981',
    botName: 'Shopping Assistant',
    quickReplies: [
      { id: 'qr-1', label: '🎁 Get 15% Off Code', payload: 'GET_COUPON' },
      { id: 'qr-2', label: '🚚 Shipping & Delivery', payload: 'SHIPPING_INFO' },
      { id: 'qr-3', label: '⭐ Best Sellers', payload: 'POPULAR_ITEMS' }
    ]
  },
  {
    name: 'VIP Demo & Sales Booking',
    headline: 'Scale Your Conversions with AI',
    subheadline: 'Book a 1-on-1 strategy call with our growth specialists.',
    welcomeMessage: '🚀 Ready to 10x your client messaging? I can answer any questions or lock in a tailored 15-minute live platform walkthrough!',
    brandColor: '#3b82f6',
    botName: 'Growth Specialist',
    quickReplies: [
      { id: 'qr-1', label: '📅 Book 15-Min Demo', payload: 'BOOK_DEMO' },
      { id: 'qr-2', label: '💰 ROI & Pricing', payload: 'CALCULATE_ROI' },
      { id: 'qr-3', label: '📊 See Case Studies', payload: 'CASE_STUDIES' }
    ]
  },
  {
    name: 'Lead Magnet Delivery',
    headline: 'Download Free Growth Blueprint',
    subheadline: 'Get our battle-tested messaging templates instantly.',
    welcomeMessage: '🎁 Grab your free copy of our 2026 Omnichannel Conversion Playbook! Where should we send your instant download?',
    brandColor: '#a855f7',
    botName: 'Resource Assistant',
    quickReplies: [
      { id: 'qr-1', label: '📥 Send to My Email', payload: 'EMAIL_OPTIN' },
      { id: 'qr-2', label: '👀 Preview Chapters', payload: 'PREVIEW_BOOK' }
    ]
  }
];

export const SupportChatView: React.FC<SupportChatViewProps> = ({
  availableBots = [
    { id: 'bot-customer-support-faq', name: 'Customer Support FAQ Bot' },
    { id: 'bot-lead-magnet-optin', name: 'Lead Magnet & Sales Bot' },
    { id: 'bot-webinar-registration', name: 'Webinar RSVP Assistant' },
    { id: 'bot-abandoned-cart-recovery', name: 'Cart Recovery & Voucher Bot' }
  ],
  onNavigateToFlows
}) => {
  const [widgets, setWidgets] = useState<SupportChatWidgetConfig[]>(() => {
    const saved = localStorage.getItem('chatmize_support_widgets');
    return saved ? JSON.parse(saved) : DEFAULT_SUPPORT_WIDGETS;
  });

  const [activeMode, setActiveMode] = useState<'list' | 'editor' | 'preview'>('list');
  const [selectedWidgetId, setSelectedWidgetId] = useState<string>(widgets[0]?.id || '');
  const [editingWidget, setEditingWidget] = useState<SupportChatWidgetConfig | null>(null);
  
  // Embed modal
  const [embedModalWidget, setEmbedModalWidget] = useState<SupportChatWidgetConfig | null>(null);
  const [copiedEmbed, setCopiedEmbed] = useState(false);

  // Simulator state
  const [simMessages, setSimMessages] = useState<Array<{ sender: 'bot' | 'user'; text: string; time: string }>>([
    { sender: 'bot', text: '👋 Hi there! Welcome to our website. How can I assist you today?', time: 'Just now' }
  ]);
  const [simInput, setSimInput] = useState('');
  const [isSimOpen, setIsSimOpen] = useState(true);
  const [simDevice, setSimDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [newReplyLabel, setNewReplyLabel] = useState('');
  const headlineEmoji = useEmojiTarget<HTMLInputElement>();
  const subheadlineEmoji = useEmojiTarget<HTMLInputElement>();
  const welcomeEmoji = useEmojiTarget<HTMLTextAreaElement>();
  const chipEmoji = useEmojiTarget<HTMLInputElement>();
  const [isSimTyping, setIsSimTyping] = useState(false);
  const [leadCapturedNotice, setLeadCapturedNotice] = useState<string | null>(null);
  const [showQuickGuide, setShowQuickGuide] = useState(true);

  // Live Editor Preview controls
  const [editorPreviewMode, setEditorPreviewMode] = useState<'elevated' | 'corner'>('elevated');
  const [editorChatOpen, setEditorChatOpen] = useState(true);
  const [editorTestInput, setEditorTestInput] = useState('');
  const [editorTestMessages, setEditorTestMessages] = useState<Array<{ sender: 'bot' | 'user'; text: string; time: string }>>([]);

  const currentWidget = widgets.find(w => w.id === selectedWidgetId) || widgets[0];

  const persistWidgets = (newWidgets: SupportChatWidgetConfig[]) => {
    setWidgets(newWidgets);
    localStorage.setItem('chatmize_support_widgets', JSON.stringify(newWidgets));
  };

  const handleCreateNew = () => {
    const newWidget: SupportChatWidgetConfig = {
      id: `support-${Date.now().toString().slice(-6)}`,
      name: 'New Live Support Chat',
      status: 'active',
      headline: 'Need Help or Have Questions?',
      subheadline: 'Our AI Specialist and team reply within 60 seconds.',
      welcomeMessage: '👋 Hi there! Welcome to our store. How can I assist you today? Feel free to ask about our pricing, features, or order status!',
      brandColor: '#00d2ff',
      theme: 'dark',
      position: 'bottom_right',
      launcherIcon: 'chat',
      launcherText: 'Chat with Us',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
      botName: 'ChatMize Concierge',
      connectedBotId: availableBots[0]?.id || 'bot-customer-support-faq',
      quickReplies: [
        { id: 'qr-1', label: '💬 Talk to Sales', payload: 'TALK_SALES' },
        { id: 'qr-2', label: '📦 Track Order', payload: 'TRACK_ORDER' },
        { id: 'qr-3', label: '❓ Pricing Plans', payload: 'PRICING' }
      ],
      requireEmailCapture: true,
      requireNameCapture: true,
      requirePhoneCapture: false,
      removeBranding: false,
      autoOpenDelaySeconds: 3,
      whitelistedDomains: ['*.yourdomain.com', 'yourdomain.com', 'localhost:3000'],
      totalViews: 0,
      totalConversations: 0,
      totalLeads: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    setEditingWidget(newWidget);
    setActiveMode('editor');
  };

  const handleEdit = (widget: SupportChatWidgetConfig) => {
    setEditingWidget({ ...widget });
    setSelectedWidgetId(widget.id);
    setActiveMode('editor');
  };

  const handleSave = (updated: SupportChatWidgetConfig) => {
    const exists = widgets.some(w => w.id === updated.id);
    let newWidgets: SupportChatWidgetConfig[];
    if (exists) {
      newWidgets = widgets.map(w => w.id === updated.id ? { ...updated, updatedAt: new Date().toISOString() } : w);
    } else {
      newWidgets = [updated, ...widgets];
    }
    persistWidgets(newWidgets);
    setSelectedWidgetId(updated.id);
    setEditingWidget(null);
    setActiveMode('list');
  };

  const handleToggleStatus = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const updated = widgets.map(w => {
      if (w.id === id) {
        return { ...w, status: w.status === 'active' ? 'paused' : 'active' as const };
      }
      return w;
    });
    persistWidgets(updated);
  };

  const handleDuplicate = (widget: SupportChatWidgetConfig, e: React.MouseEvent) => {
    e.stopPropagation();
    const copy: SupportChatWidgetConfig = {
      ...widget,
      id: `support-${Date.now().toString().slice(-6)}`,
      name: `${widget.name} (Copy)`,
      totalViews: 0,
      totalConversations: 0,
      totalLeads: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    persistWidgets([copy, ...widgets]);
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this Support Chat widget?')) {
      const filtered = widgets.filter(w => w.id !== id);
      persistWidgets(filtered);
      if (selectedWidgetId === id && filtered[0]) {
        setSelectedWidgetId(filtered[0].id);
      }
    }
  };

  const handleSimSend = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!simInput.trim()) return;

    const userText = simInput.trim();
    setSimMessages(prev => [...prev, { sender: 'user', text: userText, time: 'Just now' }]);
    setSimInput('');
    setIsSimTyping(true);

    setTimeout(() => {
      setIsSimTyping(false);
      const lower = userText.toLowerCase();
      let botResponse = '';

      if (lower.includes('@') && lower.includes('.')) {
        botResponse = `✅ Perfect! I've linked your email (${userText}) to this conversation. A member of our support team will also follow up with full details if you leave!`;
        setLeadCapturedNotice(`Lead captured: ${userText}`);
        setTimeout(() => setLeadCapturedNotice(null), 4000);
        // Increment lead count in widget
        const updated = widgets.map(w => w.id === currentWidget.id ? { ...w, totalLeads: (w.totalLeads || 0) + 1 } : w);
        persistWidgets(updated);
      } else if (lower.includes('price') || lower.includes('cost') || lower.includes('plan') || lower.includes('pricing')) {
        botResponse = '💳 Our plans start at $29/mo with unlimited AI responses and 3 connected channels (FB, IG, WhatsApp). Would you like to see a comparison or start a 14-day free trial?';
      } else if (lower.includes('human') || lower.includes('agent') || lower.includes('specialist') || lower.includes('rep') || lower.includes('support')) {
        botResponse = '🙋 I am transferring your request to our priority agent queue! Please type your email or phone number above so we can reach you immediately.';
      } else if (lower.includes('order') || lower.includes('track') || lower.includes('shipping')) {
        botResponse = '📦 I can look up your delivery status right now! Please provide your Order Number (e.g. #ORD-8492).';
      } else if (lower.includes('coupon') || lower.includes('discount') || lower.includes('code') || lower.includes('deal')) {
        botResponse = '🎁 Here is an exclusive 15% discount voucher for you: use code "CHATMIZE15" at checkout!';
      } else if (lower.includes('demo') || lower.includes('book') || lower.includes('call')) {
        botResponse = '📅 Awesome! We would love to walk you through the platform. What is your best email or phone number to send the calendar invite?';
      } else {
        botResponse = `Thanks for reaching out about "${userText}"! I'm your 24/7 AI assistant. I can answer questions, guide your setup, or connect you with our lead strategist. What else can I assist with?`;
      }

      setSimMessages(prev => [
        ...prev, 
        { 
          sender: 'bot', 
          text: botResponse, 
          time: 'Just now' 
        }
      ]);
    }, 600);
  };

  const handleSimReplyClick = (reply: { label: string; payload: string }) => {
    setSimMessages(prev => [...prev, { sender: 'user', text: reply.label, time: 'Just now' }]);
    setIsSimTyping(true);

    setTimeout(() => {
      setIsSimTyping(false);
      let response = '';
      if (reply.payload === 'TALK_SALES' || reply.payload === 'BOOK_DEMO') {
        response = '🚀 Great! Our sales engineers are standing by. What is the best email address or phone number to send your calendar invite?';
      } else if (reply.payload === 'PRICING' || reply.payload === 'CALCULATE_ROI') {
        response = '📊 ChatMize starts at $29/mo for up to 5,000 active subscribers. You save over $200/mo compared to ManyChat! Would you like a breakdown of features?';
      } else if (reply.payload === 'TRACK_ORDER' || reply.payload === 'SHIPPING_INFO') {
        response = '🚚 Standard delivery takes 2-4 business days. You can also paste your tracking code here to check real-time courier updates!';
      } else if (reply.payload === 'GET_COUPON') {
        response = '🎉 You got it! Use code "VIP20" at checkout for 20% off your entire order today!';
      } else {
        response = `You selected "${reply.label}". I've initialized that workflow for you! What questions do you have?`;
      }

      setSimMessages(prev => [
        ...prev,
        {
          sender: 'bot',
          text: response,
          time: 'Just now'
        }
      ]);
    }, 550);
  };

  const getEmbedCode = (w: SupportChatWidgetConfig) => {
    return `<!-- ChatMize Live Support Widget Embed -->
<script 
  src="https://cdn.chatmize.com/sdk/support-chat.js" 
  data-widget-id="${w.id}" 
  data-color="${w.brandColor}" 
  data-position="${w.position}"
  async>
</script>`;
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
                  setActiveMode('list');
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

      {/* =========================================================================
          MODE 1: LIST VIEW (ALL LIVE SUPPORT WIDGETS)
          ========================================================================= */}
      {activeMode === 'list' && (
        <div className="space-y-6">

          {/* Toast Notification when a lead is captured during test */}
          {leadCapturedNotice && (
            <div className="p-3.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center justify-between animate-in slide-in-from-top-2 duration-200">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>{leadCapturedNotice}</span>
              </div>
              <span className="text-[11px] text-emerald-400/80">CRM Updated</span>
            </div>
          )}

          {/* Quick 3-Step Setup Guide */}
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
                    <h4 className="font-bold text-white">Attach Automated Bot</h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">Route questions to your AI customer support bot or lead magnet funnel.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-500 text-slate-950 font-bold flex items-center justify-center flex-shrink-0 text-xs">3</div>
                  <div>
                    <h4 className="font-bold text-white">Paste 1-Line Embed Code</h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">Copy snippet onto Shopify, WordPress, Webflow, or any custom website.</p>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Quick Metrics Bar */}
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

          {/* Widgets Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {widgets.map((widget) => {
              const connectedBot = availableBots.find(b => b.id === widget.connectedBotId);

              return (
                <div 
                  key={widget.id}
                  className="bg-slate-900/80 border border-white/10 rounded-2xl p-5 hover:border-cyan-500/40 hover:bg-slate-900 transition-all flex flex-col justify-between group shadow-xl"
                >
                  <div className="space-y-4">
                    {/* Top Row: Icon + Title + Status */}
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
                            <span className="capitalize">{widget.position.replace('_', ' ')}</span>
                            <span>•</span>
                            <span>Auto-open: {widget.autoOpenDelaySeconds > 0 ? `${widget.autoOpenDelaySeconds}s` : 'Manual click'}</span>
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

                    {/* Headline preview quote */}
                    <div className="p-3 rounded-xl bg-slate-950/70 border border-white/5 space-y-1">
                      <p className="text-xs text-white font-medium">{widget.headline}</p>
                      <p className="text-[11px] text-slate-400 line-clamp-2">{widget.welcomeMessage}</p>
                    </div>

                    {/* Bot & Feature Badges */}
                    <div className="flex items-center justify-between text-xs py-2 px-3 rounded-xl bg-white/5 border border-white/5">
                      <div className="flex items-center gap-2 text-slate-300">
                        <Bot className="w-3.5 h-3.5 text-cyan-400" />
                        <span className="truncate">{connectedBot?.name || widget.botName}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                        <span>{widget.quickReplies.length} Quick Replies</span>
                      </div>
                    </div>

                    {/* Performance mini stats */}
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

                  {/* Actions Bar */}
                  <div className="mt-4 pt-3 border-t border-white/10 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
                    <button
                      onClick={() => {
                        setSelectedWidgetId(widget.id);
                        setActiveMode('preview');
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
          
          {/* Left Column: Comprehensive Settings Form (7 cols) */}
          <div className="lg:col-span-7 bg-slate-900/90 border border-white/10 rounded-2xl p-6 space-y-6 shadow-xl">
            
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div>
                <h2 className="text-lg font-bold text-white">Edit Support Chat Widget</h2>
                <p className="text-xs text-slate-400">Configure appearance, chat behavior, and bot connection.</p>
              </div>
              <span className="text-xs px-2.5 py-1 rounded-full bg-cyan-500/10 text-cyan-300 font-mono">
                {editingWidget.id}
              </span>
            </div>

            {/* Quick-Jump Section Navigation Bar */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs" style={{ scrollbarWidth: 'none' }}>
              <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mr-1">Scroll to:</span>
              <button
                type="button"
                onClick={() => document.getElementById('section-branding')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-cyan-300 border border-white/10 text-[11px] whitespace-nowrap transition-colors cursor-pointer"
              >
                🎨 Branding
              </button>
              <button
                type="button"
                onClick={() => document.getElementById('section-avatar')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-cyan-300 border border-white/10 text-[11px] whitespace-nowrap transition-colors cursor-pointer"
              >
                🤖 Bot &amp; Avatar
              </button>
              <button
                type="button"
                onClick={() => document.getElementById('section-messages')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-cyan-300 border border-white/10 text-[11px] whitespace-nowrap transition-colors cursor-pointer"
              >
                💬 Welcome Message
              </button>
              <button
                type="button"
                onClick={() => document.getElementById('section-replies')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-cyan-300 border border-white/10 text-[11px] whitespace-nowrap transition-colors cursor-pointer"
              >
                ⚡ Quick Replies
              </button>
              <button
                type="button"
                onClick={() => document.getElementById('section-leadcapture')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-cyan-300 border border-white/10 text-[11px] whitespace-nowrap transition-colors cursor-pointer"
              >
                📋 Lead Form
              </button>
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
                <input
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

              {/* Position & Launcher Bubble Icon */}
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
            </div>

            {/* Connected Bot & Assistant Profile */}
            <div id="section-avatar" className="space-y-3 p-4 rounded-xl bg-slate-950/60 border border-white/5">
              <div className="flex items-center gap-2 text-xs font-bold text-white">
                <Bot className="w-4 h-4 text-cyan-400" />
                <span>AI Bot Engine &amp; Representative</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] text-slate-400">Connected Chat Bot</label>
                  <select
                    value={editingWidget.connectedBotId}
                    onChange={(e) => setEditingWidget({ ...editingWidget, connectedBotId: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-xs text-white focus:border-cyan-500 focus:outline-none"
                  >
                    {availableBots.map((b) => (
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

              <div className="space-y-1.5">
                <label className="text-[11px] text-slate-400">Avatar Image URL</label>
                <input
                  type="text"
                  value={editingWidget.avatarUrl}
                  onChange={(e) => setEditingWidget({ ...editingWidget, avatarUrl: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-xs text-white focus:border-cyan-500 focus:outline-none"
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
                <span className="text-[10px] text-slate-400">{editingWidget.quickReplies.length} chips configured</span>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {editingWidget.quickReplies.map((reply, idx) => (
                  <div 
                    key={reply.id} 
                    className="px-2.5 py-1 rounded-lg bg-slate-900 border border-white/10 text-xs text-slate-200 flex items-center gap-1.5"
                  >
                    <span>{reply.label}</span>
                    <button
                      type="button"
                      onClick={() => {
                        const updatedReplies = editingWidget.quickReplies.filter((_, i) => i !== idx);
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
                    placeholder="e.g. 🚀 Schedule VIP Demo"
                    ref={chipEmoji.ref}
                    value={newReplyLabel}
                    onChange={(e) => setNewReplyLabel(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (newReplyLabel.trim()) {
                          const newChip = {
                            id: `qr-${Date.now().toString().slice(-4)}`,
                            label: newReplyLabel.trim(),
                            payload: newReplyLabel.trim().toUpperCase().replace(/[^A-Z0-9]/g, '_')
                          };
                          setEditingWidget({ ...editingWidget, quickReplies: [...editingWidget.quickReplies, newChip] });
                          setNewReplyLabel('');
                        }
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
                  onClick={() => {
                    if (newReplyLabel.trim()) {
                      const newChip = {
                        id: `qr-${Date.now().toString().slice(-4)}`,
                        label: newReplyLabel.trim(),
                        payload: newReplyLabel.trim().toUpperCase().replace(/[^A-Z0-9]/g, '_')
                      };
                      setEditingWidget({ ...editingWidget, quickReplies: [...editingWidget.quickReplies, newChip] });
                      setNewReplyLabel('');
                    }
                  }}
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
                <label className="p-2.5 rounded-xl bg-slate-900 border border-white/10 flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingWidget.requireEmailCapture}
                    onChange={(e) => setEditingWidget({ ...editingWidget, requireEmailCapture: e.target.checked })}
                    className="rounded border-slate-700 text-cyan-500 focus:ring-0"
                  />
                  <span className="text-xs text-slate-300">Require Email</span>
                </label>

                <label className="p-2.5 rounded-xl bg-slate-900 border border-white/10 flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingWidget.requireNameCapture}
                    onChange={(e) => setEditingWidget({ ...editingWidget, requireNameCapture: e.target.checked })}
                    className="rounded border-slate-700 text-cyan-500 focus:ring-0"
                  />
                  <span className="text-xs text-slate-300">Require Name</span>
                </label>

                <label className="p-2.5 rounded-xl bg-slate-900 border border-white/10 flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingWidget.requirePhoneCapture}
                    onChange={(e) => setEditingWidget({ ...editingWidget, requirePhoneCapture: e.target.checked })}
                    className="rounded border-slate-700 text-cyan-500 focus:ring-0"
                  />
                  <span className="text-xs text-slate-300">Phone Number</span>
                </label>
              </div>
            </div>

            {/* Bottom Save Action */}
            <div id="section-save" className="pt-4 border-t border-white/10 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setEditingWidget(null);
                  setActiveMode('list');
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
                <span>Save Widget Changes</span>
              </button>
            </div>

          </div>

          {/* Right Column: Live Chat Visual Preview (5 cols) */}
          <div className="lg:col-span-5 sticky top-4 space-y-3">
            {/* Header Controls */}
            <div className="flex items-center justify-between text-xs text-slate-400 px-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-white">Live Widget Preview</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 font-mono">Real-time</span>
              </div>

              {/* Elevated vs Corner toggle */}
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
              
              {/* Browser Window Bar */}
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
                    }}
                    className="text-[10px] text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
                    title="Reset test conversation"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset</span>
                  </button>
                </div>
              </div>

              {/* Scrollable Preview Canvas */}
              <div className="overflow-y-auto p-4 flex-1 space-y-4" style={{ minHeight: '480px' }}>
                
                {editorPreviewMode === 'elevated' ? (
                  /* ================= ELEVATED VIEW: WIDGET IS SET UP HIGH IN SCREEN ================= */
                  <div className="space-y-4">
                    {editorChatOpen ? (
                      /* Expanded Live Chat Window placed prominently high */
                      <div className="w-full max-w-sm mx-auto rounded-2xl border border-white/15 bg-slate-900 shadow-2xl overflow-hidden flex flex-col transition-all">
                        {/* Header */}
                        <div 
                          className="p-3.5 flex items-center justify-between text-white transition-colors"
                          style={{ backgroundColor: editingWidget.brandColor }}
                        >
                          <div className="flex items-center gap-2.5">
                            <img
                              src={editingWidget.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop'}
                              alt={editingWidget.botName}
                              className="w-9 h-9 rounded-full object-cover border-2 border-white/30 shadow-sm"
                            />
                            <div>
                              <h4 className="text-xs font-bold leading-tight drop-shadow-sm">{editingWidget.headline || 'How can we help?'}</h4>
                              <p className="text-[10px] opacity-90 mt-0.5 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
                                <span>{editingWidget.botName || 'AI Support'}</span>
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

                        {/* Subheadline banner if present */}
                        {editingWidget.subheadline && (
                          <div className="px-3 py-1.5 bg-slate-950/80 border-b border-white/5 text-[10px] text-slate-400">
                            {editingWidget.subheadline}
                          </div>
                        )}

                        {/* Chat Messages Body */}
                        <div className="p-3.5 space-y-3 bg-slate-950/60 max-h-[220px] overflow-y-auto">
                          {/* Welcome Bot Bubble */}
                          <div className="p-3 rounded-2xl bg-slate-900 border border-white/10 text-xs text-slate-200 max-w-[90%] rounded-tl-none leading-relaxed shadow-sm">
                            {editingWidget.welcomeMessage || '👋 Hi there! How can we assist you today?'}
                          </div>

                          {/* Test interactions */}
                          {editorTestMessages.map((msg, idx) => (
                            <div
                              key={idx}
                              className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
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

                          {/* Quick Reply Chips (Interactive in preview!) */}
                          {editingWidget.quickReplies && editingWidget.quickReplies.length > 0 && (
                            <div className="pt-1">
                              <p className="text-[10px] text-slate-400 mb-1.5 font-medium">Quick options:</p>
                              <div className="flex flex-wrap gap-1.5">
                                {editingWidget.quickReplies.map((qr) => (
                                  <button
                                    key={qr.id}
                                    type="button"
                                    onClick={() => {
                                      const userMsg = { sender: 'user' as const, text: qr.label, time: 'Just now' };
                                      const botReply = { 
                                        sender: 'bot' as const, 
                                        text: `You selected "${qr.label}". Connecting you to our agent...`, 
                                        time: 'Just now' 
                                      };
                                      setEditorTestMessages(prev => [...prev, userMsg, botReply]);
                                    }}
                                    className="py-1.5 px-3 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-cyan-500/30 text-[11px] font-medium text-cyan-300 text-left transition-all cursor-pointer shadow-sm active:scale-95"
                                    title="Click to test this quick reply in the preview"
                                  >
                                    {qr.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Interactive Input Footer */}
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            if (editorTestInput.trim()) {
                              const userMsg = { sender: 'user' as const, text: editorTestInput.trim(), time: 'Just now' };
                              const botReply = { 
                                sender: 'bot' as const, 
                                text: `Thanks for writing! We received: "${editorTestInput.trim()}".`, 
                                time: 'Just now' 
                              };
                              setEditorTestMessages(prev => [...prev, userMsg, botReply]);
                              setEditorTestInput('');
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
                      /* Collapsed Banner state */
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

                    {/* Floating Launcher Preview (Below elevated window) */}
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

                      <p className="text-[10px] text-slate-500 text-center px-4">
                        Widget sits elevated high so you can scroll up and down the form on the left while editing.
                      </p>
                    </div>
                  </div>
                ) : (
                  /* ================= CORNER VIEW: PINNED TO BOTTOM ================= */
                  <div className="relative min-h-[460px] flex flex-col justify-between">
                    {/* Simulated website wireframe */}
                    <div className="space-y-3 opacity-20 select-none pointer-events-none">
                      <div className="h-4 w-32 bg-slate-700 rounded-full" />
                      <div className="h-8 w-64 bg-slate-800 rounded-lg" />
                      <div className="h-16 w-full bg-slate-900 rounded-xl" />
                      <div className="grid grid-cols-2 gap-2">
                        <div className="h-14 bg-slate-900 rounded-lg" />
                        <div className="h-14 bg-slate-900 rounded-lg" />
                      </div>
                    </div>

                    {/* Corner Chat Widget */}
                    <div className={`space-y-3 ${editingWidget.position === 'bottom_left' ? 'mr-auto' : 'ml-auto'} max-w-xs w-full`}>
                      {editorChatOpen && (
                        <div className="rounded-2xl border border-white/10 bg-slate-900 shadow-2xl overflow-hidden flex flex-col">
                          <div 
                            className="p-3 flex items-center justify-between text-white"
                            style={{ backgroundColor: editingWidget.brandColor }}
                          >
                            <div className="flex items-center gap-2">
                              <img
                                src={editingWidget.avatarUrl}
                                alt={editingWidget.botName}
                                className="w-7 h-7 rounded-full object-cover border border-white/30"
                              />
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
                          <div className="p-3 bg-slate-950/70 text-xs text-slate-200">
                            {editingWidget.welcomeMessage}
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

              {/* Bottom Quick Switch to Full Simulator */}
              <div className="p-2.5 bg-slate-900/90 border-t border-white/10 flex items-center justify-between px-3 text-[11px]">
                <span className="text-slate-400">Want full mobile &amp; desktop testing?</span>
                <button
                  type="button"
                  onClick={() => setActiveMode('preview')}
                  className="text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <span>Open Full Simulator</span>
                  <ExternalLink className="w-3 h-3" />
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
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center p-1 rounded-xl bg-slate-950 border border-white/10">
                <button
                  onClick={() => setSimDevice('desktop')}
                  className={`p-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
                    simDevice === 'desktop' ? 'bg-cyan-500/20 text-cyan-300 font-bold' : 'text-slate-400'
                  }`}
                >
                  <Monitor className="w-3.5 h-3.5" />
                  <span>Desktop</span>
                </button>
                <button
                  onClick={() => setSimDevice('mobile')}
                  className={`p-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
                    simDevice === 'mobile' ? 'bg-cyan-500/20 text-cyan-300 font-bold' : 'text-slate-400'
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>Mobile</span>
                </button>
              </div>

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
              
              {/* Mock Website Background */}
              <div className="space-y-4 opacity-20 pointer-events-none select-none">
                <div className="h-6 w-48 bg-slate-600 rounded-full" />
                <div className="h-10 w-96 bg-slate-700 rounded-lg" />
                <div className="h-32 w-full bg-slate-800 rounded-2xl" />
              </div>

              {/* Live Chat Modal in Frame */}
              {isSimOpen && (
                <div className="w-full max-w-sm ml-auto rounded-2xl border border-white/10 bg-slate-900 shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">
                  
                  {/* Chat Header */}
                  <div 
                    className="p-4 flex items-center justify-between text-white"
                    style={{ backgroundColor: currentWidget.brandColor }}
                  >
                    <div className="flex items-center gap-2.5">
                      <img
                        src={currentWidget.avatarUrl}
                        alt={currentWidget.botName}
                        className="w-8 h-8 rounded-full object-cover border border-white/30"
                      />
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

                  {/* Messages Feed */}
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

                    {/* Bot Typing indicator */}
                    {isSimTyping && (
                      <div className="flex items-center gap-1.5 p-3 rounded-2xl bg-slate-900 border border-white/10 text-slate-400 w-20">
                        <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    )}

                    {/* Quick reply chips */}
                    <div className="flex flex-col gap-1.5 pt-2">
                      {currentWidget.quickReplies.map((qr) => (
                        <button
                          key={qr.id}
                          onClick={() => handleSimReplyClick(qr)}
                          className="py-1.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-white/10 text-[11px] font-medium text-cyan-300 text-left transition-all cursor-pointer"
                        >
                          {qr.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Suggestion prompts */}
                  <div className="px-3 pt-2 pb-1 bg-slate-900/80 border-t border-white/5 flex items-center gap-1.5 overflow-x-auto">
                    <span className="text-[10px] text-slate-500 whitespace-nowrap">Try asking:</span>
                    {['What are your prices?', 'Talk to an agent', 'Give me a coupon', 'test@example.com'].map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => {
                          setSimInput(prompt);
                        }}
                        className="text-[10px] px-2 py-0.5 rounded-md bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 whitespace-nowrap cursor-pointer hover:text-cyan-300"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>

                  {/* Input bar */}
                  <form onSubmit={handleSimSend} className="p-3 bg-slate-900 border-t border-white/10 flex items-center gap-2">
                    <input
                      type="text"
                      value={simInput}
                      onChange={(e) => setSimInput(e.target.value)}
                      placeholder="Type a message (or enter email to test capture)..."
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

              {/* Launcher toggle button */}
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
              <span className="font-bold text-cyan-300 block">Compatible with any CMS or stack:</span>
              <p className="text-slate-400">Works seamlessly on Shopify, WordPress, Webflow, Squarespace, Wix, Next.js, and custom HTML.</p>
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
