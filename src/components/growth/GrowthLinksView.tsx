import React, { useState } from 'react';
import { 
  Link2, 
  Share2, 
  Copy, 
  Check, 
  ExternalLink, 
  QrCode, 
  Plus, 
  Trash2, 
  Settings2, 
  Sparkles, 
  ArrowRight, 
  ShieldCheck, 
  Globe, 
  CheckCircle2, 
  Smartphone, 
  Instagram, 
  MessageSquare,
  Bot,
  Eye,
  TrendingUp,
  MousePointer
} from 'lucide-react';
import { SendChatCloakedLink, MmeLinkConfig, IgmeLinkConfig, CloakedDestinationType, CloakingMode } from '../../types/growthTools';
import { DEFAULT_CLOAKED_LINKS } from '../../data/growthToolsDefaults';
import { QrCodeModal } from './QrCodeModal';

export const LINK_PRESETS = [
  {
    name: 'Instagram Bio Flash Sale',
    workspaceSlug: 'apex-marketing',
    slug: 'bio-sale',
    destType: 'instagram' as CloakedDestinationType,
    destUrl: 'https://ig.me/m/apex_marketing_official?ref=bio_flash_sale',
    title: '⚡ Exclusive Flash Sale — DM to Claim',
    desc: 'Tap below to DM us directly on Instagram and get your instant 25% promo voucher code.',
    image: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=600&auto=format&fit=crop&q=80',
    mode: 'bridge' as CloakingMode,
    ref: 'bio_flash_sale'
  },
  {
    name: 'Messenger VIP Strategy Call',
    workspaceSlug: 'apex-marketing',
    slug: 'vip-call',
    destType: 'messenger' as CloakedDestinationType,
    destUrl: 'https://m.me/ApexMarketingAgency?ref=vip_call_booking',
    title: '🚀 Book Free 15-Min Pipeline Strategy Call',
    desc: 'Chat directly with our automated booking assistant on Messenger to secure your VIP spot.',
    image: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=600&auto=format&fit=crop&q=80',
    mode: 'bridge' as CloakingMode,
    ref: 'vip_call_booking'
  },
  {
    name: 'TikTok Bio Cart Saver',
    workspaceSlug: 'apex-marketing',
    slug: 'save20',
    destType: 'messenger' as CloakedDestinationType,
    destUrl: 'https://m.me/ApexMarketingAgency?ref=cart_save20',
    title: '🎁 20% Cart Saver Voucher',
    desc: 'Unlock your 20% discount coupon in Facebook Messenger right now.',
    image: 'https://images.unsplash.com/photo-1513151233558-d860c5398176?w=600&auto=format&fit=crop&q=80',
    mode: 'direct' as CloakingMode,
    ref: 'cart_save20'
  }
];

interface GrowthLinksViewProps {
  workspaceName?: string;
  workspaceSlug?: string;
  availableBots?: Array<{ id: string; name: string }>;
  onNavigateToFlows?: (botId?: string) => void;
  initialSubTab?: 'cloaker' | 'mme' | 'igme';
}

export const GrowthLinksView: React.FC<GrowthLinksViewProps> = ({
  workspaceName = 'Apex Marketing',
  workspaceSlug = 'apex-marketing',
  availableBots = [
    { id: 'bot-customer-support-faq', name: 'Customer Support FAQ Bot' },
    { id: 'bot-lead-magnet-optin', name: 'Lead Magnet & Sales Bot' },
    { id: 'bot-webinar-registration', name: 'Webinar RSVP Assistant' },
    { id: 'bot-abandoned-cart-recovery', name: 'Cart Recovery & Voucher Bot' }
  ],
  onNavigateToFlows,
  initialSubTab = 'cloaker'
}) => {
  const [activeTab, setActiveTab] = useState<'cloaker' | 'mme' | 'igme'>(initialSubTab);
  
  // Cloaked Links State
  const [links, setLinks] = useState<SendChatCloakedLink[]>(() => {
    const saved = localStorage.getItem('chatmize_sendchat_links');
    return saved ? JSON.parse(saved) : DEFAULT_CLOAKED_LINKS;
  });

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [qrModalData, setQrModalData] = useState<{ url: string; title: string; subtitle?: string } | null>(null);
  const [previewModalLink, setPreviewModalLink] = useState<SendChatCloakedLink | null>(null);
  const [clickTrackingNotice, setClickTrackingNotice] = useState<string | null>(null);
  const [showQuickGuide, setShowQuickGuide] = useState(true);

  // New Cloaked Link Form
  const [isCreatingLink, setIsCreatingLink] = useState(false);
  const [newLinkWorkspace, setNewLinkWorkspace] = useState(workspaceSlug || 'my-workspace');
  const [newLinkSlug, setNewLinkSlug] = useState('special-offer');
  const [newLinkDestType, setNewLinkDestType] = useState<CloakedDestinationType>('messenger');
  const [newLinkDestUrl, setNewLinkDestUrl] = useState('https://m.me/YourBrand?ref=promo');
  const [newLinkTitle, setNewLinkTitle] = useState('🎁 Exclusive Special Offer — Chat with Us');
  const [newLinkDesc, setNewLinkDesc] = useState('Tap here to chat directly with our assistant and unlock exclusive perks.');
  const [newLinkImage, setNewLinkImage] = useState('https://images.unsplash.com/photo-1557804506-669a67965ba0?w=600&auto=format&fit=crop&q=80');
  const [newLinkMode, setNewLinkMode] = useState<CloakingMode>('bridge');
  const [newLinkBotId, setNewLinkBotId] = useState(availableBots[0]?.id || '');
  const [newLinkRef, setNewLinkRef] = useState('promo');

  // m.me Builder State
  const [mmePage, setMmePage] = useState('ApexMarketingAgency');
  const [mmeBotId, setMmeBotId] = useState(availableBots[0]?.id || '');
  const [mmeRefPayload, setMmeRefPayload] = useState('spring_promo_2026');
  const [copiedMme, setCopiedMme] = useState(false);

  // ig.me Builder State
  const [igHandle, setIgHandle] = useState('apex_marketing_official');
  const [igBotId, setIgBotId] = useState(availableBots[0]?.id || '');
  const [igRefPayload, setIgRefPayload] = useState('vip_growth_audit');
  const [copiedIg, setCopiedIg] = useState(false);

  const persistLinks = (updated: SendChatCloakedLink[]) => {
    setLinks(updated);
    localStorage.setItem('chatmize_sendchat_links', JSON.stringify(updated));
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const cleanSlug = (input: string) => {
    return input.toLowerCase().replace(/[^a-z0-9-_]/g, '-').replace(/-+/g, '-');
  };

  const handleSaveNewLink = (e: React.FormEvent) => {
    e.preventDefault();
    const finalSlug = cleanSlug(newLinkSlug) || 'link';
    const finalWorkspace = cleanSlug(newLinkWorkspace) || 'workspace';
    const fullUrl = `https://send.chat/${finalWorkspace}/${finalSlug}`;

    const newCloakedLink: SendChatCloakedLink = {
      id: `link-${Date.now().toString().slice(-6)}`,
      workspaceSlug: finalWorkspace,
      slug: finalSlug,
      fullShortUrl: fullUrl,
      destinationType: newLinkDestType,
      destinationUrl: newLinkDestUrl,
      title: newLinkTitle,
      description: newLinkDesc,
      previewImage: newLinkImage,
      cloakingMode: newLinkMode,
      connectedBotId: newLinkBotId,
      refPayload: newLinkRef,
      status: 'active',
      totalClicks: 0,
      totalConversions: 0,
      createdAt: new Date().toISOString()
    };

    const updated = [newCloakedLink, ...links];
    persistLinks(updated);
    setIsCreatingLink(false);
  };

  const handleDeleteLink = (id: string) => {
    if (confirm('Are you sure you want to delete this cloaked link?')) {
      const updated = links.filter(l => l.id !== id);
      persistLinks(updated);
    }
  };

  // m.me generated link
  const generatedMmeUrl = `https://m.me/${mmePage.trim()}?ref=${encodeURIComponent(mmeRefPayload.trim())}`;
  
  // ig.me generated link
  const cleanIgUser = igHandle.replace('@', '').trim();
  const generatedIgUrl = `https://ig.me/m/${cleanIgUser}?ref=${encodeURIComponent(igRefPayload.trim())}`;

  // One-click handoff to send.chat Cloaker
  const handleCloakMmeLink = () => {
    setNewLinkDestType('messenger');
    setNewLinkDestUrl(generatedMmeUrl);
    setNewLinkRef(mmeRefPayload.trim());
    setNewLinkBotId(mmeBotId);
    setNewLinkSlug(cleanSlug(mmeRefPayload.trim()) || 'messenger-link');
    setNewLinkTitle(`Chat on Messenger — ${mmePage}`);
    setIsCreatingLink(true);
    setActiveTab('cloaker');
  };

  const handleCloakIgLink = () => {
    setNewLinkDestType('instagram');
    setNewLinkDestUrl(generatedIgUrl);
    setNewLinkRef(igRefPayload.trim());
    setNewLinkBotId(igBotId);
    setNewLinkSlug(cleanSlug(igRefPayload.trim()) || 'ig-dm-link');
    setNewLinkTitle(`DM on Instagram — @${cleanIgUser}`);
    setIsCreatingLink(true);
    setActiveTab('cloaker');
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      
      {/* Top Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/95 to-slate-950 border border-white/10 relative overflow-hidden shadow-xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/30 text-xs font-semibold">
              <Link2 className="w-3.5 h-3.5 text-purple-400" />
              <span>send.chat Branded Cloaker &amp; Meta Link Suite</span>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Growth Links &amp; URL Cloaker</h1>
            <p className="text-sm text-slate-400 max-w-2xl">
              Create clean branded <span className="text-cyan-300 font-mono font-semibold">send.chat/{workspaceSlug}/[slug]</span> cloaked URLs with custom social cards, plus generate direct <span className="text-blue-300 font-mono">m.me</span> and <span className="text-pink-300 font-mono">ig.me</span> bot trigger links.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {activeTab === 'cloaker' && !isCreatingLink && (
              <button
                onClick={() => setIsCreatingLink(true)}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-cyan-500/20"
              >
                <Plus className="w-4 h-4" />
                <span>New send.chat Link</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-3">
        <button
          onClick={() => {
            setActiveTab('cloaker');
            setIsCreatingLink(false);
          }}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'cloaker'
              ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
          }`}
        >
          <Globe className="w-4 h-4 text-cyan-400" />
          <span>send.chat Link Cloaker</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-cyan-500/20 font-mono">
            {links.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('mme')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'mme'
              ? 'bg-gradient-to-r from-blue-500/20 to-cyan-500/20 text-blue-300 border border-blue-500/40 shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
          }`}
        >
          <MessageSquare className="w-4 h-4 text-blue-400" />
          <span>m.me Messenger Builder</span>
        </button>

        <button
          onClick={() => setActiveTab('igme')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'igme'
              ? 'bg-gradient-to-r from-pink-500/20 to-purple-500/20 text-pink-300 border border-pink-500/40 shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
          }`}
        >
          <Instagram className="w-4 h-4 text-pink-400" />
          <span>ig.me Instagram DM Builder</span>
        </button>
      </div>

      {/* =========================================================================
          TAB 1: send.chat LINK CLOAKER
          ========================================================================= */}
      {activeTab === 'cloaker' && (
        <div className="space-y-6">

          {/* Click tracking toast */}
          {clickTrackingNotice && (
            <div className="p-3.5 rounded-xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 text-xs font-semibold flex items-center justify-between animate-in slide-in-from-top-2 duration-200">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                <span>{clickTrackingNotice}</span>
              </div>
              <span className="text-[11px] text-cyan-400/80">Analytics Live</span>
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
                <span className="text-xs font-bold text-white uppercase tracking-wider">How send.chat Cloaking Works in 3 Steps</span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3 text-xs">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-cyan-500 text-slate-950 font-bold flex items-center justify-center flex-shrink-0 text-xs">1</div>
                  <div>
                    <h4 className="font-bold text-white">Create Branded Clean Link</h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">Use <span className="text-cyan-300 font-mono">send.chat/{workspaceSlug}/[slug]</span> instead of long, confusing destination URLs.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-500 text-white font-bold flex items-center justify-center flex-shrink-0 text-xs">2</div>
                  <div>
                    <h4 className="font-bold text-white">Custom OpenGraph Previews</h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">Control image, headline &amp; description when shared in iMessage, WhatsApp, or Facebook feeds.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-500 text-slate-950 font-bold flex items-center justify-center flex-shrink-0 text-xs">3</div>
                  <div>
                    <h4 className="font-bold text-white">Smart Bridge In-App Redirect</h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">Safely bypasses in-app browser blocks in TikTok, Instagram &amp; YouTube bio links.</p>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Link Creation Drawer / Form */}
          {isCreatingLink && (
            <div className="p-6 rounded-2xl bg-slate-900/90 border border-cyan-500/30 shadow-2xl space-y-5 animate-in fade-in duration-200">
              <div className="flex items-center justify-between pb-4 border-b border-white/10">
                <div className="space-y-0.5">
                  <h3 className="text-base font-bold text-white">Create Branded send.chat Cloaked URL</h3>
                  <p className="text-xs text-slate-400">Generate a custom masked or bridge redirect link for Meta Messenger, Instagram, or funnels.</p>
                </div>

                <button
                  onClick={() => setIsCreatingLink(false)}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>

              {/* 1-Click Preset Templates */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-white/5 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                    <span>1-Click Preset Templates</span>
                  </label>
                  <span className="text-[10px] text-slate-400">Instant autofill for campaigns</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {LINK_PRESETS.map((tmpl) => (
                    <button
                      key={tmpl.name}
                      type="button"
                      onClick={() => {
                        setNewLinkWorkspace(tmpl.workspaceSlug);
                        setNewLinkSlug(tmpl.slug);
                        setNewLinkDestType(tmpl.destType);
                        setNewLinkDestUrl(tmpl.destUrl);
                        setNewLinkTitle(tmpl.title);
                        setNewLinkDesc(tmpl.desc);
                        setNewLinkImage(tmpl.image);
                        setNewLinkMode(tmpl.mode);
                        setNewLinkRef(tmpl.ref);
                      }}
                      className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-850 border border-white/10 hover:border-cyan-500/50 text-left transition-all cursor-pointer group shadow-sm"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-200 group-hover:text-cyan-300 truncate">
                          {tmpl.name}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 line-clamp-1 mt-1 font-mono">
                        send.chat/{tmpl.slug}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <form onSubmit={handleSaveNewLink} className="space-y-5">
                
                {/* Generated URL Display Preview */}
                <div className="p-4 rounded-xl bg-slate-950 border border-cyan-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider block">Your Branded Short Link</span>
                    <span className="text-sm font-mono font-bold text-white">
                      https://send.chat/<span className="text-cyan-400">{cleanSlug(newLinkWorkspace) || 'workspace'}</span>/<span className="text-emerald-400">{cleanSlug(newLinkSlug) || 'slug'}</span>
                    </span>
                  </div>
                  <span className="text-xs text-slate-400">Automatic 301/Bridge Redirect</span>
                </div>

                {/* Workspace & Slug inputs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300">Workspace Namespace Slug</label>
                    <div className="flex items-center px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-xs text-white">
                      <span className="text-slate-500 mr-1">send.chat/</span>
                      <input
                        type="text"
                        value={newLinkWorkspace}
                        onChange={(e) => setNewLinkWorkspace(e.target.value)}
                        placeholder="your-workspace"
                        className="flex-1 bg-transparent focus:outline-none text-cyan-300 font-mono"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300">Custom Campaign Slug</label>
                    <input
                      type="text"
                      value={newLinkSlug}
                      onChange={(e) => setNewLinkSlug(e.target.value)}
                      placeholder="e.g. vip-offer, summer-sale"
                      className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-xs text-white focus:border-cyan-500 focus:outline-none font-mono"
                      required
                    />
                  </div>
                </div>

                {/* Destination Config */}
                <div className="space-y-3 p-4 rounded-xl bg-slate-950/60 border border-white/5">
                  <div className="flex items-center gap-2 text-xs font-bold text-white">
                    <Share2 className="w-4 h-4 text-cyan-400" />
                    <span>Destination &amp; Target Routing</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[11px] text-slate-400">Destination Platform</label>
                      <select
                        value={newLinkDestType}
                        onChange={(e) => setNewLinkDestType(e.target.value as any)}
                        className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-xs text-white focus:border-cyan-500 focus:outline-none"
                      >
                        <option value="messenger">Facebook Messenger (m.me)</option>
                        <option value="instagram">Instagram Direct (ig.me)</option>
                        <option value="web_chat">Website Chat Widget</option>
                        <option value="custom_url">External Custom URL</option>
                      </select>
                    </div>

                    <div className="sm:col-span-2 space-y-1.5">
                      <label className="text-[11px] text-slate-400">Final Destination Target URL</label>
                      <input
                        type="url"
                        value={newLinkDestUrl}
                        onChange={(e) => setNewLinkDestUrl(e.target.value)}
                        placeholder="https://m.me/..."
                        className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-xs text-white focus:border-cyan-500 focus:outline-none font-mono"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                    <div className="space-y-1.5">
                      <label className="text-[11px] text-slate-400">Redirect Cloaking Strategy</label>
                      <select
                        value={newLinkMode}
                        onChange={(e) => setNewLinkMode(e.target.value as any)}
                        className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-xs text-white focus:border-cyan-500 focus:outline-none"
                      >
                        <option value="bridge">Smart Bridge Page (Bypasses in-app browser blocks)</option>
                        <option value="direct">Direct 302 Redirect (Instant jump)</option>
                        <option value="masked">Masked Cloak (Keeps send.chat in address bar)</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[11px] text-slate-400">Connected Bot Flow (Optional)</label>
                      <select
                        value={newLinkBotId}
                        onChange={(e) => setNewLinkBotId(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-xs text-white focus:border-cyan-500 focus:outline-none"
                      >
                        <option value="">None (Generic Link)</option>
                        {availableBots.map((b) => (
                          <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Social Card / OpenGraph Customization */}
                <div className="space-y-3 p-4 rounded-xl bg-slate-950/60 border border-white/5">
                  <div className="flex items-center gap-2 text-xs font-bold text-white">
                    <Eye className="w-4 h-4 text-cyan-400" />
                    <span>Social Media OpenGraph Preview Card (Facebook, iMessage, WhatsApp)</span>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] text-slate-400">Social Share Title</label>
                    <input
                      type="text"
                      value={newLinkTitle}
                      onChange={(e) => setNewLinkTitle(e.target.value)}
                      placeholder="e.g. 🎁 Claim Your 20% Discount Voucher"
                      className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-xs text-white focus:border-cyan-500 focus:outline-none"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] text-slate-400">Social Share Description</label>
                    <textarea
                      rows={2}
                      value={newLinkDesc}
                      onChange={(e) => setNewLinkDesc(e.target.value)}
                      placeholder="e.g. Chat with our automated concierge to claim your voucher..."
                      className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-xs text-white focus:border-cyan-500 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] text-slate-400">Preview Thumbnail Image URL</label>
                    <input
                      type="url"
                      value={newLinkImage}
                      onChange={(e) => setNewLinkImage(e.target.value)}
                      placeholder="https://..."
                      className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-xs text-white focus:border-cyan-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Submit button */}
                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsCreatingLink(false)}
                    className="px-4 py-2 text-xs text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-cyan-500/20 cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    <span>Generate &amp; Save Cloaked Link</span>
                  </button>
                </div>

              </form>
            </div>
          )}

          {/* Links List Table */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">Active send.chat Cloaked URLs</h3>
              <span className="text-xs text-slate-400">{links.length} total URLs cloaked</span>
            </div>

            <div className="space-y-3">
              {links.map((link) => {
                const isCopied = copiedId === link.id;

                return (
                  <div
                    key={link.id}
                    className="p-4 rounded-2xl bg-slate-900/80 border border-white/10 hover:border-cyan-500/40 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 group"
                  >
                    {/* Left: Link info */}
                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-mono font-bold text-cyan-300">
                          {link.fullShortUrl}
                        </span>

                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          link.destinationType === 'messenger'
                            ? 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                            : link.destinationType === 'instagram'
                            ? 'bg-pink-500/15 text-pink-300 border-pink-500/30'
                            : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                        }`}>
                          {link.destinationType.toUpperCase()}
                        </span>

                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 text-slate-400">
                          Mode: {link.cloakingMode}
                        </span>
                      </div>

                      <p className="text-xs text-slate-200 font-medium truncate">{link.title}</p>

                      <div className="flex items-center gap-2 text-[11px] text-slate-400 truncate">
                        <span className="text-slate-500">Target:</span>
                        <span className="truncate font-mono">{link.destinationUrl}</span>
                      </div>
                    </div>

                    {/* Middle: Click Stats */}
                    <div className="flex items-center gap-4 px-4 py-2 rounded-xl bg-slate-950/60 border border-white/5 flex-shrink-0">
                      <div>
                        <span className="text-[10px] text-slate-500 block">Total Clicks</span>
                        <span className="text-sm font-bold text-white flex items-center gap-1">
                          <MousePointer className="w-3.5 h-3.5 text-cyan-400" />
                          {link.totalClicks}
                        </span>
                      </div>
                      <div className="border-l border-white/10 pl-4">
                        <span className="text-[10px] text-slate-500 block">Conversions</span>
                        <span className="text-sm font-bold text-emerald-400">
                          {link.totalConversions}
                        </span>
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                      <button
                        onClick={() => handleCopy(link.id, link.fullShortUrl)}
                        className="py-1.5 px-3 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                      >
                        {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{isCopied ? 'Copied' : 'Copy Link'}</span>
                      </button>

                      <button
                        onClick={() => setPreviewModalLink(link)}
                        className="py-1.5 px-3 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                        title="Test and simulate cloaked bridge page"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Preview Bridge</span>
                      </button>

                      <button
                        onClick={() => setQrModalData({
                          url: link.fullShortUrl,
                          title: link.title,
                          subtitle: `send.chat/${link.workspaceSlug}/${link.slug}`
                        })}
                        className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 text-xs transition-colors cursor-pointer"
                        title="View QR Code"
                      >
                        <QrCode className="w-4 h-4" />
                      </button>

                      <a
                        href={link.destinationUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 text-xs transition-colors cursor-pointer"
                        title="Test Destination Redirect"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>

                      <button
                        onClick={() => handleDeleteLink(link.id)}
                        className="p-2 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                        title="Delete Cloaked Link"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      )}

      {/* =========================================================================
          TAB 2: m.me FACEBOOK MESSENGER LINK BUILDER
          ========================================================================= */}
      {activeTab === 'mme' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Builder Form (7 cols) */}
          <div className="lg:col-span-7 bg-slate-900/90 border border-white/10 rounded-2xl p-6 space-y-6 shadow-xl">
            <div className="space-y-1 pb-4 border-b border-white/10">
              <div className="inline-flex items-center gap-2 px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-300 text-xs font-semibold">
                <MessageSquare className="w-3.5 h-3.5 text-blue-400" />
                <span>Meta Graph Verified Ref URL</span>
              </div>
              <h2 className="text-lg font-bold text-white">m.me Messenger Link Generator</h2>
              <p className="text-xs text-slate-400">
                Direct users into Facebook Messenger with a pre-attached <code>ref</code> payload that triggers specific bot flows.
              </p>
            </div>

            {/* Page & Bot Config */}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Facebook Page Username or Page ID</label>
                <div className="flex items-center px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-xs text-white">
                  <span className="text-slate-500 mr-1 font-mono">https://m.me/</span>
                  <input
                    type="text"
                    value={mmePage}
                    onChange={(e) => setMmePage(e.target.value)}
                    placeholder="YourPageUsername"
                    className="flex-1 bg-transparent focus:outline-none text-blue-400 font-mono font-bold"
                  />
                </div>
                <span className="text-[11px] text-slate-500">Example: "ApexMarketingAgency" or your numerical Facebook Page ID</span>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Target Bot / Automated Trigger</label>
                <select
                  value={mmeBotId}
                  onChange={(e) => setMmeBotId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-xs text-white focus:border-blue-500 focus:outline-none"
                >
                  {availableBots.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Ref Payload Parameter</label>
                <input
                  type="text"
                  value={mmeRefPayload}
                  onChange={(e) => setMmeRefPayload(e.target.value)}
                  placeholder="e.g. promo_coupon, webinar_optin"
                  className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-xs text-white focus:border-blue-500 focus:outline-none font-mono"
                />
                <span className="text-[11px] text-slate-500">This payload is received by the webhook to launch the exact message flow.</span>
              </div>
            </div>

            {/* Live Generated URL Box */}
            <div className="p-4 rounded-xl bg-slate-950 border border-blue-500/30 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400">Generated Messenger Link</span>
                <span className="text-[10px] text-slate-500 font-mono">Ready to share</span>
              </div>

              <div className="p-3 bg-slate-900 rounded-xl border border-white/5 font-mono text-xs text-white break-all select-all">
                {generatedMmeUrl}
              </div>

              <div className="flex items-center gap-3 pt-1">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(generatedMmeUrl);
                    setCopiedMme(true);
                    setTimeout(() => setCopiedMme(false), 2000);
                  }}
                  className="flex-1 py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md shadow-blue-500/20"
                >
                  {copiedMme ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedMme ? 'Copied to Clipboard!' : 'Copy m.me Link'}</span>
                </button>

                <button
                  onClick={() => setQrModalData({
                    url: generatedMmeUrl,
                    title: `m.me/${mmePage}`,
                    subtitle: `Ref: ${mmeRefPayload}`
                  })}
                  className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 text-xs transition-colors cursor-pointer"
                  title="Generate QR Code"
                >
                  <QrCode className="w-4 h-4" />
                </button>

                <a
                  href={generatedMmeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 text-xs transition-colors cursor-pointer"
                  title="Test in Messenger"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>

            {/* Cloak with send.chat Action */}
            <div className="p-4 rounded-xl bg-gradient-to-r from-cyan-950/40 via-slate-900 to-blue-950/40 border border-cyan-500/30 flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Turn this into a branded send.chat URL</span>
                </span>
                <p className="text-[11px] text-slate-400">
                  send.chat provides link cloaking, custom previews, and bridge landing pages for Facebook ads.
                </p>
              </div>

              <button
                onClick={handleCloakMmeLink}
                className="py-2 px-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap shadow-sm shadow-cyan-500/30"
              >
                <span>Cloak Link</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

          </div>

          {/* Quick Info / Guide (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="p-5 rounded-2xl bg-slate-900/90 border border-white/10 space-y-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Share2 className="w-4 h-4 text-blue-400" />
                <span>How m.me Ref Links Work</span>
              </h3>
              <ul className="text-xs text-slate-300 space-y-2.5">
                <li className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full bg-blue-500/20 text-blue-300 flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">1</span>
                  <span>Visitor clicks your link or scans the QR code on a flyer, business card, or Instagram bio.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full bg-blue-500/20 text-blue-300 flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">2</span>
                  <span>Facebook Messenger opens instantly with your page and triggers your connected AI bot flow.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full bg-blue-500/20 text-blue-300 flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">3</span>
                  <span>The lead is saved to your audience CRM with contact details and automated tags.</span>
                </li>
              </ul>
            </div>
          </div>

        </div>
      )}

      {/* =========================================================================
          TAB 3: ig.me INSTAGRAM DM LINK BUILDER
          ========================================================================= */}
      {activeTab === 'igme' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Builder Form (7 cols) */}
          <div className="lg:col-span-7 bg-slate-900/90 border border-white/10 rounded-2xl p-6 space-y-6 shadow-xl">
            <div className="space-y-1 pb-4 border-b border-white/10">
              <div className="inline-flex items-center gap-2 px-2 py-0.5 rounded-full bg-pink-500/10 text-pink-300 text-xs font-semibold">
                <Instagram className="w-3.5 h-3.5 text-pink-400" />
                <span>Instagram Direct Growth Link</span>
              </div>
              <h2 className="text-lg font-bold text-white">ig.me Instagram DM Link Generator</h2>
              <p className="text-xs text-slate-400">
                Direct users immediately into an Instagram Direct conversation with your professional account.
              </p>
            </div>

            {/* IG Handle & Ref */}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Instagram Handle (Username)</label>
                <div className="flex items-center px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-xs text-white">
                  <span className="text-slate-500 mr-1 font-mono">https://ig.me/m/</span>
                  <input
                    type="text"
                    value={igHandle}
                    onChange={(e) => setIgHandle(e.target.value)}
                    placeholder="your_instagram_handle"
                    className="flex-1 bg-transparent focus:outline-none text-pink-400 font-mono font-bold"
                  />
                </div>
                <span className="text-[11px] text-slate-500">Example: "chatmize_official" or "apex_dental"</span>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Target Bot / Trigger Flow</label>
                <select
                  value={igBotId}
                  onChange={(e) => setIgBotId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-xs text-white focus:border-pink-500 focus:outline-none"
                >
                  {availableBots.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Ref Payload / Keyword Starter</label>
                <input
                  type="text"
                  value={igRefPayload}
                  onChange={(e) => setIgRefPayload(e.target.value)}
                  placeholder="e.g. free_audit, vip_pass"
                  className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-xs text-white focus:border-pink-500 focus:outline-none font-mono"
                />
              </div>
            </div>

            {/* Generated URL Box */}
            <div className="p-4 rounded-xl bg-slate-950 border border-pink-500/30 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-pink-400">Generated Instagram DM Link</span>
                <span className="text-[10px] text-slate-500 font-mono">Ready to share</span>
              </div>

              <div className="p-3 bg-slate-900 rounded-xl border border-white/5 font-mono text-xs text-white break-all select-all">
                {generatedIgUrl}
              </div>

              <div className="flex items-center gap-3 pt-1">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(generatedIgUrl);
                    setCopiedIg(true);
                    setTimeout(() => setCopiedIg(false), 2000);
                  }}
                  className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md shadow-pink-500/20"
                >
                  {copiedIg ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedIg ? 'Copied to Clipboard!' : 'Copy ig.me Link'}</span>
                </button>

                <button
                  onClick={() => setQrModalData({
                    url: generatedIgUrl,
                    title: `ig.me/m/${cleanIgUser}`,
                    subtitle: `Ref: ${igRefPayload}`
                  })}
                  className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 text-xs transition-colors cursor-pointer"
                  title="Generate QR Code"
                >
                  <QrCode className="w-4 h-4" />
                </button>

                <a
                  href={generatedIgUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 text-xs transition-colors cursor-pointer"
                  title="Test in Instagram"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>

            {/* Cloak with send.chat Action */}
            <div className="p-4 rounded-xl bg-gradient-to-r from-purple-950/40 via-slate-900 to-pink-950/40 border border-purple-500/30 flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                  <span>Turn this into a branded send.chat URL</span>
                </span>
                <p className="text-[11px] text-slate-400">
                  Prevents Instagram DM links from breaking inside TikTok or YouTube bio browsers.
                </p>
              </div>

              <button
                onClick={handleCloakIgLink}
                className="py-2 px-3 rounded-xl bg-purple-500 hover:bg-purple-400 text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap shadow-sm shadow-purple-500/30"
              >
                <span>Cloak Link</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

          </div>

          {/* Quick Guide (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="p-5 rounded-2xl bg-slate-900/90 border border-white/10 space-y-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Instagram className="w-4 h-4 text-pink-400" />
                <span>Instagram Direct Automation</span>
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                When people tap your <code>ig.me</code> link on mobile, Instagram opens their direct message thread with your brand. The <code>ref</code> payload activates your keyword automations, story reply triggers, or automated FAQ menus.
              </p>
            </div>
          </div>

        </div>
      )}

      {/* Shared QR Code Modal */}
      {qrModalData && (
        <QrCodeModal
          url={qrModalData.url}
          title={qrModalData.title}
          subtitle={qrModalData.subtitle}
          onClose={() => setQrModalData(null)}
        />
      )}

      {/* Smartphone Bridge Page Simulator Modal */}
      {previewModalLink && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-slate-900 border border-white/10 rounded-3xl p-6 shadow-2xl space-y-4">
            
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400">send.chat Mobile Bridge Simulator</span>
                <h3 className="text-sm font-bold text-white truncate max-w-[260px]">{previewModalLink.title}</h3>
              </div>
              <button
                onClick={() => setPreviewModalLink(null)}
                className="text-slate-400 hover:text-white p-1 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {/* Simulated Phone Shell */}
            <div className="rounded-2xl border-2 border-slate-700 bg-slate-950 p-4 space-y-4 shadow-inner">
              {/* Browser Address Bar */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900 border border-white/10 text-[11px] font-mono text-slate-300">
                <span className="text-emerald-400">🔒</span>
                <span className="text-cyan-300 font-bold truncate">send.chat/{previewModalLink.workspaceSlug}/{previewModalLink.slug}</span>
              </div>

              {/* Social Card Preview */}
              <div className="rounded-xl overflow-hidden bg-slate-900 border border-white/10 space-y-3">
                {previewModalLink.previewImage && (
                  <img 
                    src={previewModalLink.previewImage} 
                    alt={previewModalLink.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-36 object-cover"
                  />
                )}
                <div className="p-3 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-cyan-400 block">
                    {previewModalLink.destinationType.toUpperCase()} DIRECT
                  </span>
                  <h4 className="text-xs font-bold text-white leading-snug">{previewModalLink.title}</h4>
                  <p className="text-[11px] text-slate-400 line-clamp-2">{previewModalLink.description}</p>
                </div>
              </div>

              {/* Bridge Action Button */}
              <div className="space-y-2">
                <button
                  onClick={() => {
                    const updated = links.map(l => l.id === previewModalLink.id ? { ...l, totalClicks: l.totalClicks + 1 } : l);
                    persistLinks(updated);
                    setPreviewModalLink({ ...previewModalLink, totalClicks: previewModalLink.totalClicks + 1 });
                    setClickTrackingNotice(`Click registered for send.chat/${previewModalLink.workspaceSlug}/${previewModalLink.slug}!`);
                    setTimeout(() => setClickTrackingNotice(null), 3500);
                  }}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 cursor-pointer"
                >
                  <span>Continue to {previewModalLink.destinationType === 'messenger' ? 'Facebook Messenger' : previewModalLink.destinationType === 'instagram' ? 'Instagram Direct' : 'Chat'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>

                <p className="text-[10px] text-center text-slate-500">
                  Smart Bridge safely bypasses in-app browser blocks and deep-links directly into the native mobile app.
                </p>
              </div>
            </div>

            {/* Modal Footer Controls */}
            <div className="flex items-center justify-between text-xs pt-1">
              <span className="text-slate-400">Total clicks tracked: <strong className="text-white font-mono">{previewModalLink.totalClicks}</strong></span>
              <a
                href={previewModalLink.destinationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1"
              >
                <span>Open Target URL</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
