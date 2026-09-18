import React, { useState } from 'react';
import { EmojiPickerButton, useEmojiTarget } from '../emoji';
import { 
  Sparkles, 
  MessageSquare, 
  Layout, 
  Sliders, 
  Maximize2, 
  Layers, 
  Check, 
  ChevronRight, 
  ChevronLeft, 
  Code, 
  Bot, 
  Zap, 
  Globe, 
  Eye, 
  Copy, 
  CheckCircle2, 
  Plus, 
  Trash2, 
  ArrowRight,
  ShieldCheck,
  MousePointer,
  Clock,
  Smartphone,
  Monitor,
  Palette,
  Boxes,
  Lock,
  ExternalLink,
  HelpCircle,
  FileCode
} from 'lucide-react';
import { 
  NurtureTool, 
  NurtureToolType, 
  NurtureTrigger, 
  NurturePosition, 
  NurturePlan 
} from '../../types/nurture';
import { ImageUpload } from '../ImageUpload';

export interface NurtureStepWizardProps {
  initialArchetype?: NurtureToolType;
  editingTool?: NurtureTool | null;
  availableBots: Array<{ id: string; name: string }>;
  plans: NurturePlan[];
  onSave: (tool: NurtureTool) => void;
  onCancel: () => void;
  onTestLive?: (tool: NurtureTool) => void;
}

const COLOR_PRESETS = [
  { name: 'Electric Cyan', hex: '#00d2ff' },
  { name: 'Royal Blue', hex: '#3b82f6' },
  { name: 'Emerald Growth', hex: '#10b981' },
  { name: 'Purple Neon', hex: '#a855f7' },
  { name: 'Amber Sunset', hex: '#f59e0b' },
  { name: 'Rose Pink', hex: '#ec4899' },
  { name: 'Ruby Crimson', hex: '#ef4444' }
];

const PRESET_TEMPLATES: Record<NurtureToolType, Array<{
  id: string;
  name: string;
  headline: string;
  subheadline: string;
  welcomeMessage: string;
  triggerType: NurtureTrigger;
  triggerDelaySeconds: number;
  triggerScrollPercent: number;
  quickReplies: Array<{ id: string; label: string; payload: string }>;
  brandColor: string;
}>> = {
  support_widget: [
    {
      id: 'support-1',
      name: '24/7 AI Customer Support Helpdesk',
      headline: 'Need Help or Have Questions?',
      subheadline: 'Our AI Specialist and team answer questions instantly.',
      welcomeMessage: '👋 Hi there! Welcome to our store. How can I assist you today? Ask about pricing, features, or order status!',
      triggerType: 'immediate',
      triggerDelaySeconds: 2,
      triggerScrollPercent: 0,
      quickReplies: [
        { id: 'qr-1', label: '💬 Talk to Sales', payload: 'TALK_SALES' },
        { id: 'qr-2', label: '📦 Track Order', payload: 'TRACK_ORDER' },
        { id: 'qr-3', label: '❓ Pricing & Plans', payload: 'PRICING' }
      ],
      brandColor: '#00d2ff'
    },
    {
      id: 'support-2',
      name: 'Sales Concierge & VIP Booking',
      headline: 'Schedule Your 1-on-1 Consultation',
      subheadline: 'Answer 2 quick questions to book your priority calendar slot.',
      welcomeMessage: 'Hello! I can help you find the right package and schedule a live demo with our specialists.',
      triggerType: 'time_delay',
      triggerDelaySeconds: 4,
      triggerScrollPercent: 0,
      quickReplies: [
        { id: 'qr-s1', label: '📅 Book Demo Now', payload: 'BOOK_DEMO' },
        { id: 'qr-s2', label: '💼 Enterprise Inquiries', payload: 'ENTERPRISE' }
      ],
      brandColor: '#3b82f6'
    }
  ],
  popup_modal: [
    {
      id: 'popup-1',
      name: 'Exit-Intent 15% Discount Lightbox',
      headline: 'Wait! Don\'t Leave Empty Handed 🎁',
      subheadline: 'Chat with our deal assistant right now and unlock an instant 15% promo code!',
      welcomeMessage: 'Hey! Before you go, would you like an exclusive 15% off discount voucher for today\'s order?',
      triggerType: 'exit_intent',
      triggerDelaySeconds: 5,
      triggerScrollPercent: 50,
      quickReplies: [
        { id: 'qr-p1', label: '🎉 Unlock 15% Code', payload: 'UNLOCK_DISCOUNT' },
        { id: 'qr-p2', label: '🤔 I have a quick question', payload: 'ASK_QUESTION' }
      ],
      brandColor: '#3b82f6'
    },
    {
      id: 'popup-2',
      name: 'VIP Early Access & Newsletter Lead Magnet',
      headline: 'Join the VIP Insiders Club',
      subheadline: 'Get weekly growth case studies, free templates, and subscriber perks.',
      welcomeMessage: 'Want our private 2026 playbook before anyone else? Confirm your email and I will send it over immediately!',
      triggerType: 'exit_intent',
      triggerDelaySeconds: 6,
      triggerScrollPercent: 60,
      quickReplies: [
        { id: 'qr-p3', label: '📥 Send Free Playbook', payload: 'SEND_PLAYBOOK' },
        { id: 'qr-p4', label: '⚡ See What is Inside', payload: 'PREVIEW' }
      ],
      brandColor: '#10b981'
    }
  ],
  slider: [
    {
      id: 'slider-1',
      name: 'Pricing Page Interactive Drawer',
      headline: 'Comparing Plans? Let\'s Find Your Fit',
      subheadline: 'Answer 2 quick questions to get a customized tier recommendation and ROI breakdown.',
      welcomeMessage: 'Hey there! Not sure which plan fits your monthly volume? I can analyze your needs in 30 seconds.',
      triggerType: 'scroll_depth',
      triggerDelaySeconds: 3,
      triggerScrollPercent: 40,
      quickReplies: [
        { id: 'qr-sl1', label: '📊 Calculate My ROI', payload: 'CALC_ROI' },
        { id: 'qr-sl2', label: '💼 Agency vs Pro?', payload: 'COMPARE' }
      ],
      brandColor: '#10b981'
    },
    {
      id: 'slider-2',
      name: 'Case Study & Proof Drawer',
      headline: 'See How DentalCare Grew Revenue +42%',
      subheadline: 'Read the verified breakdown of automated lead capture and Meta DM follow-ups.',
      welcomeMessage: 'Interested in seeing the exact flow DentalCare Austin used to generate 314 qualified leads last month?',
      triggerType: 'scroll_depth',
      triggerDelaySeconds: 4,
      triggerScrollPercent: 50,
      quickReplies: [
        { id: 'qr-sl3', label: '📖 Read Case Study', payload: 'READ_CASE_STUDY' },
        { id: 'qr-sl4', label: '🚀 Try This Flow', payload: 'CLONE_FLOW' }
      ],
      brandColor: '#a855f7'
    }
  ],
  page_takeover: [
    {
      id: 'takeover-1',
      name: 'Product Launch Fullscreen Takeover',
      headline: 'Introducing ChatMize 2.4 — Live Now 🚀',
      subheadline: 'Next-generation AI agents, omnichannel inbox, and automated nurture tools.',
      welcomeMessage: 'Welcome to the 2.4 release! Take the interactive product tour or claim grandfathered founder pricing today.',
      triggerType: 'immediate',
      triggerDelaySeconds: 1,
      triggerScrollPercent: 0,
      quickReplies: [
        { id: 'qr-t1', label: '🌟 Take 2-Min Tour', payload: 'TOUR' },
        { id: 'qr-t2', label: '🔥 Claim Founder Pricing', payload: 'PRICING' }
      ],
      brandColor: '#ec4899'
    },
    {
      id: 'takeover-2',
      name: 'Live Webinar & Masterclass RSVP',
      headline: 'Free Masterclass: Automating Meta DM Sales',
      subheadline: 'Live Thursday with live Q&A, free bot templates, and direct access.',
      welcomeMessage: 'Ready to join this week\'s high-converting Messenger & IG automation masterclass? Register below!',
      triggerType: 'immediate',
      triggerDelaySeconds: 2,
      triggerScrollPercent: 0,
      quickReplies: [
        { id: 'qr-t3', label: '🎟️ Reserve Free Seat', payload: 'RESERVE_SEAT' }
      ],
      brandColor: '#00d2ff'
    }
  ],
  sticky_bar: [
    {
      id: 'bar-1',
      name: 'Flash Sale & Free Shipping Announcement Bar',
      headline: '⚡ Flash Sale: Free shipping & live concierge support today only!',
      subheadline: 'Tap here to chat with our shopping assistant for exclusive vouchers.',
      welcomeMessage: 'Hi! Looking for today\'s flash sale coupon? Chat with me to apply it directly to your cart.',
      triggerType: 'immediate',
      triggerDelaySeconds: 0,
      triggerScrollPercent: 0,
      quickReplies: [
        { id: 'qr-b1', label: '🎁 Claim Free Shipping', payload: 'FREE_SHIP' },
        { id: 'qr-b2', label: '❓ Ask Question', payload: 'QUESTION' }
      ],
      brandColor: '#f59e0b'
    },
    {
      id: 'bar-2',
      name: 'System Maintenance / Live Notice Bar',
      headline: 'Notice: New AI Agents are currently being deployed to all workspaces.',
      subheadline: 'Need assistance? Tap to start an instant support conversation.',
      welcomeMessage: 'Hello! How can we assist you with today\'s system updates?',
      triggerType: 'immediate',
      triggerDelaySeconds: 0,
      triggerScrollPercent: 0,
      quickReplies: [
        { id: 'qr-b3', label: '💬 Chat Support', payload: 'SUPPORT' }
      ],
      brandColor: '#3b82f6'
    }
  ]
};

const ARCHETYPES: Array<{
  type: NurtureToolType;
  title: string;
  desc: string;
  badge: string;
  icon: any;
  color: string;
  bgLight: string;
  defaultPosition: NurturePosition;
}> = [
  {
    type: 'support_widget',
    title: 'Live Support Chat',
    desc: '24/7 floating customer service bubble in corner. Triggers conversational FAQ and bot triage.',
    badge: 'Popular',
    icon: MessageSquare,
    color: 'text-cyan-400',
    bgLight: 'bg-cyan-500/10 border-cyan-500/30',
    defaultPosition: 'bottom_right'
  },
  {
    type: 'popup_modal',
    title: 'Exit Popup Modal',
    desc: 'High-converting lightbox that triggers when visitor moves cursor to leave or after delay.',
    badge: 'High Conversion',
    icon: Layout,
    color: 'text-blue-400',
    bgLight: 'bg-blue-500/10 border-blue-500/30',
    defaultPosition: 'center'
  },
  {
    type: 'slider',
    title: 'Corner Slider',
    desc: 'Interactive slide-out drawer triggered by scroll depth or click. Perfect for pricing & ROI comparisons.',
    badge: 'Engaging',
    icon: Sliders,
    color: 'text-emerald-400',
    bgLight: 'bg-emerald-500/10 border-emerald-500/30',
    defaultPosition: 'bottom_right'
  },
  {
    type: 'page_takeover',
    title: 'Page Takeover',
    desc: 'Fullscreen immersive overlay for major product drops, webinar registrations, or seasonal sales.',
    badge: 'High Impact',
    icon: Maximize2,
    color: 'text-pink-400',
    bgLight: 'bg-pink-500/10 border-pink-500/30',
    defaultPosition: 'center'
  },
  {
    type: 'sticky_bar',
    title: 'Sticky Bar',
    desc: 'Sleek top or bottom persistent notification banner with headline and instant chat CTA button.',
    badge: 'Non-Intrusive',
    icon: Layers,
    color: 'text-amber-400',
    bgLight: 'bg-amber-500/10 border-amber-500/30',
    defaultPosition: 'top_bar'
  }
];

export const NurtureStepWizard: React.FC<NurtureStepWizardProps> = ({
  initialArchetype = 'support_widget',
  editingTool = null,
  availableBots,
  plans,
  onSave,
  onCancel,
  onTestLive
}) => {
  // Step navigation: 1 -> 2 -> 3 -> 4 -> 5
  const [currentStep, setCurrentStep] = useState<number>(editingTool ? 2 : 1);
  const [copiedEmbed, setCopiedEmbed] = useState<boolean>(false);
  const [newReplyLabel, setNewReplyLabel] = useState<string>('');
  const wizardEmoji = useEmojiTarget<HTMLTextAreaElement>();

  // Initial tool state
  const [form, setForm] = useState<NurtureTool>(() => {
    if (editingTool) return { ...editingTool };

    const selectedType = initialArchetype;
    const defaultTemplate = PRESET_TEMPLATES[selectedType]?.[0];
    const defaultArch = ARCHETYPES.find(a => a.type === selectedType) || ARCHETYPES[0];

    return {
      id: `nurture-${selectedType.replace('_', '-')}-${Date.now().toString().slice(-5)}`,
      name: defaultTemplate?.name || `New ${defaultArch.title}`,
      type: selectedType,
      accessLevel: plans[0]?.id || 'starter',
      planId: plans[0]?.id || 'plan-1',
      status: 'active',
      headline: defaultTemplate?.headline || 'Hi there! How can we assist your business today?',
      subheadline: defaultTemplate?.subheadline || 'Chat directly with our automated AI assistant or request a team callback.',
      welcomeMessage: defaultTemplate?.welcomeMessage || 'Hello! What questions can I answer for you today?',
      brandColor: defaultTemplate?.brandColor || '#00d2ff',
      theme: 'dark',
      position: defaultArch.defaultPosition,
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
      botName: 'ChatMize Concierge',
      connectedBotId: availableBots[0]?.id || 'bot-customer-support-faq',
      triggerType: defaultTemplate?.triggerType || 'immediate',
      triggerDelaySeconds: defaultTemplate?.triggerDelaySeconds || 2,
      triggerScrollPercent: defaultTemplate?.triggerScrollPercent || 0,
      exitIntentEnabled: selectedType === 'popup_modal',
      quickReplies: defaultTemplate?.quickReplies || [
        { id: 'qr-1', label: '👋 General Question', payload: 'QUESTION' },
        { id: 'qr-2', label: '🚀 Schedule Demo', payload: 'DEMO' },
        { id: 'qr-3', label: '💰 Pricing Info', payload: 'PRICING' }
      ],
      requireEmailCapture: true,
      requireNameCapture: true,
      removeBranding: false,
      metaPixelEvent: 'Lead',
      whitelistedDomains: ['*.yourdomain.com', 'yourdomain.com'],
      totalViews: 0,
      totalConversations: 0,
      totalLeads: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  });

  // Handle archetype change in Step 1
  const handleSelectArchetype = (type: NurtureToolType) => {
    const arch = ARCHETYPES.find(a => a.type === type) || ARCHETYPES[0];
    const template = PRESET_TEMPLATES[type]?.[0];
    setForm(prev => ({
      ...prev,
      type,
      name: template?.name || `New ${arch.title}`,
      headline: template?.headline || prev.headline,
      subheadline: template?.subheadline || prev.subheadline,
      welcomeMessage: template?.welcomeMessage || prev.welcomeMessage,
      triggerType: template?.triggerType || prev.triggerType,
      triggerDelaySeconds: template?.triggerDelaySeconds ?? prev.triggerDelaySeconds,
      triggerScrollPercent: template?.triggerScrollPercent ?? prev.triggerScrollPercent,
      exitIntentEnabled: type === 'popup_modal',
      position: arch.defaultPosition,
      brandColor: template?.brandColor || prev.brandColor,
      quickReplies: template?.quickReplies || prev.quickReplies
    }));
  };

  // Apply a template preset
  const handleApplyPreset = (template: typeof PRESET_TEMPLATES['support_widget'][0]) => {
    setForm(prev => ({
      ...prev,
      name: template.name,
      headline: template.headline,
      subheadline: template.subheadline,
      welcomeMessage: template.welcomeMessage,
      triggerType: template.triggerType,
      triggerDelaySeconds: template.triggerDelaySeconds,
      triggerScrollPercent: template.triggerScrollPercent,
      brandColor: template.brandColor,
      quickReplies: [...template.quickReplies]
    }));
  };

  // Add quick reply
  const handleAddQuickReply = () => {
    if (!newReplyLabel.trim()) return;
    const newChip = {
      id: `qr-${Date.now().toString().slice(-4)}`,
      label: newReplyLabel.trim(),
      payload: newReplyLabel.trim().toUpperCase().replace(/\s+/g, '_')
    };
    setForm(prev => ({
      ...prev,
      quickReplies: [...prev.quickReplies, newChip]
    }));
    setNewReplyLabel('');
  };

  const handleRemoveQuickReply = (id: string) => {
    setForm(prev => ({
      ...prev,
      quickReplies: prev.quickReplies.filter(q => q.id !== id)
    }));
  };

  // Embed script snippet
  const embedSnippet = `<script 
  src="https://cdn.chatmize.io/nurture.v2.js" 
  data-tool-id="${form.id}"
  data-brand-color="${form.brandColor}"
  data-position="${form.position}"
  async>
</script>`;

  const handleCopySnippet = () => {
    navigator.clipboard.writeText(embedSnippet);
    setCopiedEmbed(true);
    setTimeout(() => setCopiedEmbed(false), 2000);
  };

  const STEPS = [
    { num: 1, title: 'Archetype & Template', desc: 'Select tool type & starter' },
    { num: 2, title: 'Trigger & Timing', desc: 'When and where it appears' },
    { num: 3, title: 'Bot & Lead Capture', desc: 'Connect flow & input fields' },
    { num: 4, title: 'Styling & Branding', desc: 'Copy, colors & theme' },
    { num: 5, title: 'Review & Save', desc: 'Assign plan & get embed' }
  ];

  return (
    <div className="bg-slate-900/95 border border-white/10 rounded-2xl overflow-hidden shadow-2xl flex flex-col animate-in fade-in duration-200">
      
      {/* Top Wizard Navigation Header */}
      <div className="p-5 border-b border-white/10 bg-slate-950/60 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-cyan-400 text-[11px] font-mono font-bold uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              Step-by-Step Nurture Setup
            </span>
            <span className="text-slate-600">·</span>
            <span className="text-slate-400 text-xs">
              {editingTool ? `Editing "${editingTool.name}"` : 'Build New Growth Tool'}
            </span>
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <span>{STEPS[currentStep - 1]?.title}</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 font-mono">
              Step {currentStep} of 5
            </span>
          </h2>
        </div>

        {/* Wizard Step Progress Bar */}
        <div className="flex items-center gap-1.5">
          {STEPS.map((s) => {
            const isCompleted = currentStep > s.num;
            const isCurrent = currentStep === s.num;
            return (
              <button
                key={s.num}
                onClick={() => setCurrentStep(s.num)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  isCurrent
                    ? 'bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/20'
                    : isCompleted
                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                    : 'bg-white/5 text-slate-400 hover:bg-white/10'
                }`}
                title={s.title}
              >
                {isCompleted ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-mono ${
                    isCurrent ? 'bg-slate-950 text-cyan-300' : 'bg-white/10 text-slate-400'
                  }`}>
                    {s.num}
                  </span>
                )}
                <span className="hidden lg:inline">{s.title.split(' ')[0]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Body: Step Content + Interactive Preview Card */}
      <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[520px]">
        
        {/* Left Column: Form Controls (7 cols on lg) */}
        <div className="lg:col-span-7 flex flex-col justify-between space-y-6">

          {/* =========================================================
              STEP 1: ARCHETYPE & TEMPLATE SELECTION
              ========================================================= */}
          {currentStep === 1 && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div>
                <h3 className="text-sm font-bold text-white mb-1">Select Nurture Tool Archetype</h3>
                <p className="text-xs text-slate-400">
                  Each archetype has optimized trigger mechanics, positioning, and conversion behaviors for your website.
                </p>
              </div>

              {/* Archetype Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {ARCHETYPES.map((arch) => {
                  const Icon = arch.icon;
                  const isSelected = form.type === arch.type;
                  return (
                    <div
                      key={arch.type}
                      onClick={() => handleSelectArchetype(arch.type)}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between relative group ${
                        isSelected
                          ? 'bg-cyan-950/30 border-cyan-500 shadow-lg shadow-cyan-500/10 ring-1 ring-cyan-500/40'
                          : 'bg-slate-950/60 border-white/5 hover:border-white/20 hover:bg-slate-950'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div className={`p-2 rounded-xl ${arch.bgLight}`}>
                            <Icon className={`w-4 h-4 ${arch.color}`} />
                          </div>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            isSelected ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40' : 'bg-white/5 text-slate-400 border-white/10'
                          }`}>
                            {arch.badge}
                          </span>
                        </div>
                        <h4 className="text-xs font-bold text-white group-hover:text-cyan-300 transition-colors">
                          {arch.title}
                        </h4>
                        <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                          {arch.desc}
                        </p>
                      </div>

                      <div className="mt-3 pt-2 border-t border-white/5 flex items-center justify-between text-[10px]">
                        <span className="text-slate-500 font-mono">Pos: {arch.defaultPosition}</span>
                        {isSelected ? (
                          <span className="text-cyan-400 font-bold flex items-center gap-1">
                            <Check className="w-3 h-3" /> Selected
                          </span>
                        ) : (
                          <span className="text-slate-500 group-hover:text-slate-300">Click to choose</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Starter Templates for Selected Archetype */}
              <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    High-Converting Starter Presets
                  </h4>
                  <span className="text-[11px] text-slate-400">Click any preset to pre-fill copy</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(PRESET_TEMPLATES[form.type] || []).map((t) => (
                    <div
                      key={t.id}
                      onClick={() => handleApplyPreset(t)}
                      className="p-2.5 rounded-xl bg-slate-950/70 border border-white/10 hover:border-cyan-400/50 transition-all cursor-pointer flex flex-col justify-between"
                    >
                      <div>
                        <span className="text-xs font-semibold text-white block">{t.name}</span>
                        <span className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">{t.headline}</span>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-[10px] text-cyan-400">
                        <span className="font-mono">Trigger: {t.triggerType}</span>
                        <span className="font-bold">Apply Preset &rarr;</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tool Name Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Tool Display Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. 24/7 Live Support Chat Bubble"
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                />
              </div>
            </div>
          )}

          {/* =========================================================
              STEP 2: TRIGGER & TIMING CONDITIONS
              ========================================================= */}
          {currentStep === 2 && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div>
                <h3 className="text-sm font-bold text-white mb-1">Trigger &amp; Timing Rules</h3>
                <p className="text-xs text-slate-400">
                  Configure the exact user behavior that causes this nurture tool to appear on your site.
                </p>
              </div>

              {/* Trigger Type Radios */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {[
                  {
                    id: 'immediate',
                    label: 'Immediate Load',
                    desc: 'Shows instantly when page finishes rendering',
                    icon: Zap
                  },
                  {
                    id: 'time_delay',
                    label: 'Time Delay',
                    desc: 'Waits X seconds after visitor arrives',
                    icon: Clock
                  },
                  {
                    id: 'exit_intent',
                    label: 'Exit-Intent Lightbox',
                    desc: 'Detects cursor leaving viewport or back-press',
                    icon: MousePointer
                  },
                  {
                    id: 'scroll_depth',
                    label: 'Scroll Depth',
                    desc: 'Fires when visitor reaches % down the page',
                    icon: Sliders
                  }
                ].map((trig) => {
                  const Icon = trig.icon;
                  const isSelected = form.triggerType === trig.id;
                  return (
                    <div
                      key={trig.id}
                      onClick={() => setForm({ 
                        ...form, 
                        triggerType: trig.id as NurtureTrigger,
                        exitIntentEnabled: trig.id === 'exit_intent'
                      })}
                      className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-2.5 ${
                        isSelected
                          ? 'bg-cyan-950/30 border-cyan-400 text-white'
                          : 'bg-slate-950/50 border-white/5 text-slate-400 hover:bg-white/5'
                      }`}
                    >
                      <input
                        type="radio"
                        checked={isSelected}
                        onChange={() => {}}
                        className="mt-1 text-cyan-500 focus:ring-0 cursor-pointer"
                      />
                      <div>
                        <div className="flex items-center gap-1.5">
                          <Icon className="w-3.5 h-3.5 text-cyan-400" />
                          <span className="text-xs font-bold text-white">{trig.label}</span>
                        </div>
                        <span className="text-[11px] text-slate-400 block mt-0.5">{trig.desc}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Time Delay Configuration */}
              {(form.triggerType === 'time_delay' || form.triggerType === 'exit_intent') && (
                <div className="p-3.5 rounded-xl bg-slate-950/80 border border-white/10 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-cyan-400" />
                      Delay Before Appearance
                    </span>
                    <span className="font-mono text-cyan-300 font-bold">{form.triggerDelaySeconds} seconds</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="60"
                    value={form.triggerDelaySeconds}
                    onChange={(e) => setForm({ ...form, triggerDelaySeconds: parseInt(e.target.value) || 2 })}
                    className="w-full accent-cyan-400 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500">
                    <span>1s (Instant)</span>
                    <span>15s</span>
                    <span>30s</span>
                    <span>60s (Deep dwell)</span>
                  </div>
                </div>
              )}

              {/* Scroll Depth Configuration */}
              {form.triggerType === 'scroll_depth' && (
                <div className="p-3.5 rounded-xl bg-slate-950/80 border border-white/10 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5 text-emerald-400" />
                      Scroll Depth Trigger
                    </span>
                    <span className="font-mono text-emerald-300 font-bold">{form.triggerScrollPercent}% of page</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="90"
                    step="5"
                    value={form.triggerScrollPercent}
                    onChange={(e) => setForm({ ...form, triggerScrollPercent: parseInt(e.target.value) || 50 })}
                    className="w-full accent-emerald-400 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500">
                    <span>10% (Top of fold)</span>
                    <span>50% (Mid-page)</span>
                    <span>90% (Footer)</span>
                  </div>
                </div>
              )}

              {/* Whitelisted Target Domains */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-blue-400" />
                  Whitelisted Domains (Comma Separated)
                </label>
                <input data-no-emoji
                  type="text"
                  value={form.whitelistedDomains.join(', ')}
                  onChange={(e) => setForm({ 
                    ...form, 
                    whitelistedDomains: e.target.value.split(',').map(s => s.trim()).filter(Boolean) 
                  })}
                  placeholder="e.g. *.myshopify.com, yourbrand.com, localhost:3000"
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                />
                <span className="text-[10px] text-slate-500">
                  Wildcards supported (*.domain.com). The script will only execute on matching origins.
                </span>
              </div>
            </div>
          )}

          {/* =========================================================
              STEP 3: BOT MAP & LEAD CAPTURE
              ========================================================= */}
          {currentStep === 3 && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div>
                <h3 className="text-sm font-bold text-white mb-1">Bot Connection &amp; Lead Capture</h3>
                <p className="text-xs text-slate-400">
                  Select which automated Bot Map or AI Agent responds, and configure contact capture fields.
                </p>
              </div>

              {/* Connected Bot Selection */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Bot className="w-3.5 h-3.5 text-purple-400" />
                  Connected Bot Flow
                </label>
                <select
                  value={form.connectedBotId}
                  onChange={(e) => setForm({ ...form, connectedBotId: e.target.value })}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-cyan-300 font-bold focus:outline-none focus:border-cyan-400"
                >
                  {availableBots.map(b => (
                    <option key={b.id} value={b.id} className="bg-slate-900 text-slate-200">
                      🤖 {b.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Bot Name & Avatar */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">Bot Assistant Name</label>
                  <input
                    type="text"
                    value={form.botName}
                    onChange={(e) => setForm({ ...form, botName: e.target.value })}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>
                <div className="space-y-1">
                  <ImageUpload
                    label="Avatar Image"
                    value={form.avatarUrl}
                    onChange={(url) => setForm({ ...form, avatarUrl: url })}
                    accentClass="focus-within:border-cyan-400"
                  />
                </div>
              </div>

              {/* Welcome Message */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-300">First Bot Greeting Message</label>
                  <EmojiPickerButton onPick={(e) => wizardEmoji.insert(e, form.welcomeMessage, (v) => setForm({ ...form, welcomeMessage: v }))} placement="down" />
                </div>
                <textarea
                  rows={2}
                  ref={wizardEmoji.ref}
                  value={form.welcomeMessage}
                  onChange={(e) => setForm({ ...form, welcomeMessage: e.target.value })}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400"
                />
              </div>

              {/* Quick Reply Button Chips */}
              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-white/10 space-y-2.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                  <span>Quick Reply Buttons ({form.quickReplies.length})</span>
                  <span className="text-[10px] text-slate-500">1-tap prompts for visitors</span>
                </label>

                <div className="flex flex-wrap gap-1.5">
                  {form.quickReplies.map((qr) => (
                    <span
                      key={qr.id}
                      className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-xs text-slate-200 flex items-center gap-1.5"
                    >
                      <span>{qr.label}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveQuickReply(qr.id)}
                        className="text-slate-500 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>

                {/* Add Reply Input */}
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    placeholder="New quick reply chip (e.g. 🚀 Schedule Demo)"
                    value={newReplyLabel}
                    onChange={(e) => setNewReplyLabel(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddQuickReply())}
                    className="flex-1 bg-slate-900 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                  />
                  <button
                    type="button"
                    onClick={handleAddQuickReply}
                    className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-cyan-300 rounded-xl text-xs font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add</span>
                  </button>
                </div>
              </div>

              {/* Lead Capture Checkboxes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <label className="p-2.5 rounded-xl bg-slate-950/60 border border-white/10 flex items-center justify-between cursor-pointer">
                  <span>Require Email Capture</span>
                  <input
                    type="checkbox"
                    checked={form.requireEmailCapture}
                    onChange={(e) => setForm({ ...form, requireEmailCapture: e.target.checked })}
                    className="rounded text-cyan-500 focus:ring-0"
                  />
                </label>

                <label className="p-2.5 rounded-xl bg-slate-950/60 border border-white/10 flex items-center justify-between cursor-pointer">
                  <span>Require Name Capture</span>
                  <input
                    type="checkbox"
                    checked={form.requireNameCapture}
                    onChange={(e) => setForm({ ...form, requireNameCapture: e.target.checked })}
                    className="rounded text-cyan-500 focus:ring-0"
                  />
                </label>
              </div>
            </div>
          )}

          {/* =========================================================
              STEP 4: STYLING & BRANDING
              ========================================================= */}
          {currentStep === 4 && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div>
                <h3 className="text-sm font-bold text-white mb-1">Styling, Copy &amp; Placement</h3>
                <p className="text-xs text-slate-400">
                  Customize the visual identity, brand accent colors, headline copy, and screen positioning.
                </p>
              </div>

              {/* Headline & Subheadline */}
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">Widget Headline</label>
                  <input
                    type="text"
                    value={form.headline}
                    onChange={(e) => setForm({ ...form, headline: e.target.value })}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">Subheadline / Supporting Pitch</label>
                  <input
                    type="text"
                    value={form.subheadline}
                    onChange={(e) => setForm({ ...form, subheadline: e.target.value })}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              {/* Color Palettes */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5 text-cyan-400" />
                  Brand Accent Color
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  {COLOR_PRESETS.map((col) => (
                    <button
                      key={col.hex}
                      type="button"
                      onClick={() => setForm({ ...form, brandColor: col.hex })}
                      style={{ backgroundColor: col.hex }}
                      className={`w-7 h-7 rounded-full transition-transform cursor-pointer ${
                        form.brandColor.toLowerCase() === col.hex.toLowerCase()
                          ? 'scale-125 ring-2 ring-white shadow-lg'
                          : 'hover:scale-110'
                      }`}
                      title={col.name}
                    />
                  ))}
                  <div className="flex items-center gap-1.5 ml-2 bg-slate-950 border border-white/10 px-2 py-1 rounded-xl">
                    <input
                      type="color"
                      value={form.brandColor}
                      onChange={(e) => setForm({ ...form, brandColor: e.target.value })}
                      className="w-5 h-5 rounded cursor-pointer bg-transparent border-0"
                    />
                    <span className="font-mono text-xs text-slate-300">{form.brandColor}</span>
                  </div>
                </div>
              </div>

              {/* Position & Theme */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold">Screen Position</label>
                  <select
                    value={form.position}
                    onChange={(e) => setForm({ ...form, position: e.target.value as NurturePosition })}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-400"
                  >
                    <option value="bottom_right">Bottom Right Corner</option>
                    <option value="bottom_left">Bottom Left Corner</option>
                    <option value="center">Center Lightbox</option>
                    <option value="top_bar">Top Sticky Banner</option>
                    <option value="bottom_bar">Bottom Sticky Banner</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold">Color Mode / Theme</label>
                  <select
                    value={form.theme}
                    onChange={(e) => setForm({ ...form, theme: e.target.value as any })}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-400"
                  >
                    <option value="dark">Dark Theme (Standard)</option>
                    <option value="light">Light Theme</option>
                    <option value="auto">Auto / Follow Website CSS</option>
                  </select>
                </div>
              </div>

              {/* White-Label Toggle */}
              <label className="p-3 rounded-xl bg-slate-950/60 border border-white/10 flex items-center justify-between cursor-pointer text-xs">
                <div>
                  <span className="font-semibold text-white block">White-Label / Remove Branding</span>
                  <span className="text-[11px] text-slate-500 block">Hide "Powered by ChatMize" badge for client websites</span>
                </div>
                <input
                  type="checkbox"
                  checked={form.removeBranding}
                  onChange={(e) => setForm({ ...form, removeBranding: e.target.checked })}
                  className="rounded text-cyan-500 focus:ring-0"
                />
              </label>
            </div>
          )}

          {/* =========================================================
              STEP 5: REVIEW, SAVE TO LIBRARY & EMBED CODE
              ========================================================= */}
          {currentStep === 5 && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div>
                <h3 className="text-sm font-bold text-white mb-1">Review &amp; Save to Library</h3>
                <p className="text-xs text-slate-400">
                  Verify your settings, assign client packaging tier, and get the instant embed code snippet.
                </p>
              </div>

              {/* Summary Checklist Card */}
              <div className="p-4 rounded-xl bg-slate-950/80 border border-cyan-500/30 space-y-3 text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span className="font-bold text-white">{form.name}</span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 uppercase">
                    {form.type}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-slate-300">
                  <div><span className="text-slate-500">Trigger:</span> <span className="font-semibold">{form.triggerType} ({form.triggerDelaySeconds}s)</span></div>
                  <div><span className="text-slate-500">Position:</span> <span className="font-semibold">{form.position}</span></div>
                  <div><span className="text-slate-500">Connected Bot:</span> <span className="font-semibold text-purple-300">{availableBots.find(b => b.id === form.connectedBotId)?.name || form.connectedBotId}</span></div>
                  <div><span className="text-slate-500">Accent:</span> <span className="font-mono" style={{ color: form.brandColor }}>{form.brandColor}</span></div>
                  <div><span className="text-slate-500">Capture:</span> <span className="font-semibold">{form.requireEmailCapture ? 'Email Required' : 'Open'}</span></div>
                  <div><span className="text-slate-500">White-Label:</span> <span className="font-semibold">{form.removeBranding ? 'Enabled' : 'Standard'}</span></div>
                </div>
              </div>

              {/* Assign to Plan / Access Level */}
              <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Boxes className="w-3.5 h-3.5 text-purple-400" />
                  Assign to Client Access Plan
                </label>
                <select
                  value={form.planId || form.accessLevel}
                  onChange={(e) => setForm({ ...form, planId: e.target.value, accessLevel: e.target.value })}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400"
                >
                  {plans.map(p => (
                    <option key={p.id} value={p.id} className="bg-slate-900">
                      {p.name} {p.price ? `(${p.price})` : ''}
                    </option>
                  ))}
                </select>
                <span className="text-[11px] text-slate-500">
                  Controls which workspace seats and client accounts have permission to launch this tool.
                </span>
              </div>

              {/* Instant Embed Code */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-white/10 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                    <Code className="w-3.5 h-3.5 text-cyan-400" />
                    Instant HTML Embed Code
                  </span>
                  <button
                    type="button"
                    onClick={handleCopySnippet}
                    className="text-cyan-300 hover:underline flex items-center gap-1 text-[11px] font-bold cursor-pointer"
                  >
                    {copiedEmbed ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedEmbed ? 'Copied to Clipboard!' : 'Copy Code'}</span>
                  </button>
                </div>
                <pre className="p-2.5 rounded-lg bg-slate-900 border border-white/5 font-mono text-[11px] text-cyan-300 overflow-x-auto">
                  {embedSnippet}
                </pre>
                <span className="text-[10px] text-slate-500 block">
                  Paste this snippet right before the closing &lt;/body&gt; tag on your website or Shopify store.
                </span>
              </div>
            </div>
          )}

          {/* Wizard Footer Step Controls */}
          <div className="pt-4 border-t border-white/10 flex items-center justify-between gap-3">
            <div>
              {currentStep > 1 ? (
                <button
                  type="button"
                  onClick={() => setCurrentStep(prev => prev - 1)}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Previous</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onCancel}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              {onTestLive && (
                <button
                  type="button"
                  onClick={() => onTestLive(form)}
                  className="px-3.5 py-2 bg-white/5 hover:bg-white/10 text-cyan-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Test in Simulator</span>
                </button>
              )}

              {currentStep < 5 ? (
                <button
                  type="button"
                  onClick={() => setCurrentStep(prev => prev + 1)}
                  className="px-5 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold rounded-xl text-xs shadow-md shadow-cyan-500/20 flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Next Step</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onSave(form)}
                  className="px-6 py-2 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-black rounded-xl text-xs shadow-lg shadow-emerald-500/20 flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Save Tool to Library</span>
                </button>
              )}
            </div>
          </div>

        </div>

        {/* Right Column: Live Interactive Visual Mockup (5 cols on lg) */}
        <div className="lg:col-span-5 bg-slate-950/80 border border-white/10 rounded-2xl p-4 flex flex-col justify-between relative overflow-hidden">
          
          <div>
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/10 text-xs">
              <div className="flex items-center gap-1.5 text-slate-300">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="font-semibold">Live Visual Preview</span>
              </div>
              <span className="text-[10px] font-mono text-slate-500 capitalize">
                {form.type.replace('_', ' ')} · {form.position.replace('_', ' ')}
              </span>
            </div>

            {/* Simulated Website Canvas Frame */}
            <div className="bg-slate-900 rounded-xl p-4 border border-white/5 relative min-h-[380px] flex flex-col justify-between overflow-hidden shadow-inner">
              
              {/* Simulated Website Content in Background */}
              <div className="opacity-25 space-y-2 pointer-events-none select-none">
                <div className="h-4 w-1/3 bg-slate-700 rounded"></div>
                <div className="h-2.5 w-full bg-slate-800 rounded"></div>
                <div className="h-2.5 w-4/5 bg-slate-800 rounded"></div>
                <div className="grid grid-cols-3 gap-2 mt-4">
                  <div className="h-16 bg-slate-800 rounded-lg"></div>
                  <div className="h-16 bg-slate-800 rounded-lg"></div>
                  <div className="h-16 bg-slate-800 rounded-lg"></div>
                </div>
              </div>

              {/* Floating Widget Visual Representation */}
              {form.type === 'sticky_bar' ? (
                <div 
                  className="absolute top-0 left-0 right-0 p-2.5 px-4 text-xs flex items-center justify-between text-white shadow-xl z-20"
                  style={{ backgroundColor: form.brandColor }}
                >
                  <span className="font-bold line-clamp-1">{form.headline}</span>
                  <button className="px-2.5 py-1 rounded bg-slate-950 text-white font-bold text-[10px] whitespace-nowrap">
                    Chat Now
                  </button>
                </div>
              ) : form.type === 'popup_modal' || form.type === 'page_takeover' ? (
                <div className="absolute inset-4 bg-slate-900/95 border border-white/15 rounded-xl p-4 shadow-2xl z-20 flex flex-col justify-between animate-in zoom-in-95 duration-150">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <img 
                        src={form.avatarUrl} 
                        alt={form.botName}
                        className="w-7 h-7 rounded-full object-cover border border-white/20"
                      />
                      <div>
                        <span className="text-xs font-bold text-white block">{form.botName}</span>
                        <span className="text-[10px] text-slate-400 block">AI Special Offer</span>
                      </div>
                    </div>
                    <h4 className="text-sm font-bold text-white mt-1 leading-snug">{form.headline}</h4>
                    <p className="text-xs text-slate-300 mt-1">{form.subheadline}</p>
                  </div>

                  <div className="space-y-2 mt-3">
                    <div className="p-2 rounded-lg bg-white/5 border border-white/5 text-[11px] text-slate-300">
                      {form.welcomeMessage}
                    </div>

                    <div className="flex flex-wrap gap-1">
                      {form.quickReplies.slice(0, 2).map(qr => (
                        <span 
                          key={qr.id}
                          className="text-[10px] font-semibold px-2 py-1 rounded-md text-slate-950 font-bold"
                          style={{ backgroundColor: form.brandColor }}
                        >
                          {qr.label}
                        </span>
                      ))}
                    </div>
                  </div>

                  {!form.removeBranding && (
                    <span className="text-[9px] text-slate-500 text-center block pt-1">
                      ⚡ Powered by ChatMize
                    </span>
                  )}
                </div>
              ) : (
                /* Support Chat Bubble or Slider in bottom right */
                <div className="absolute bottom-3 right-3 flex flex-col items-end gap-2 z-20">
                  <div className="w-56 bg-slate-900 border border-white/15 rounded-2xl p-3 shadow-2xl animate-in slide-in-from-bottom-2 duration-150">
                    <div className="flex items-center gap-2 pb-2 border-b border-white/10">
                      <img 
                        src={form.avatarUrl} 
                        alt={form.botName}
                        className="w-6 h-6 rounded-full object-cover border border-white/20"
                      />
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-white truncate block">{form.botName}</span>
                        <span className="text-[9px] text-emerald-400 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Online
                        </span>
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-200 mt-2 font-medium">{form.headline}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-2">{form.welcomeMessage}</p>

                    <div className="flex flex-col gap-1 mt-2">
                      {form.quickReplies.slice(0, 2).map(qr => (
                        <div 
                          key={qr.id}
                          className="text-[10px] px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-cyan-300 font-medium"
                        >
                          {qr.label}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Corner Bubble Trigger */}
                  <div 
                    className="w-10 h-10 rounded-full shadow-lg flex items-center justify-center text-slate-950 cursor-pointer"
                    style={{ backgroundColor: form.brandColor }}
                  >
                    <MessageSquare className="w-5 h-5 fill-current" />
                  </div>
                </div>
              )}

            </div>
          </div>

          <div className="mt-3 pt-2 border-t border-white/5 text-[11px] text-slate-400 flex items-center justify-between">
            <span>Whitelisted: <strong className="text-slate-300">{form.whitelistedDomains[0] || 'yourdomain.com'}</strong></span>
            <span className="font-mono text-cyan-400 text-[10px]">{form.theme.toUpperCase()}</span>
          </div>

        </div>

      </div>

    </div>
  );
};
