import React, { useState, useEffect } from 'react';
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
  MousePointer,
  Lock,
  Loader2,
  Pause,
  Play,
  AlertTriangle
} from 'lucide-react';
import { SendChatCloakedLink, MmeLinkConfig, IgmeLinkConfig, CloakedDestinationType, CloakingMode } from '../../types/growthTools';
import { QrCodeModal } from './QrCodeModal';
import { QrBuilderTab } from './QrBuilderTab'; // [BUILDER C: QR tab] new QR Builder tab component
import { ImageUpload } from '../ImageUpload';
import { prodDb } from '../../lib/firebase';
import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  updateDoc,
  query,
  where,
  DocumentData
} from 'firebase/firestore';

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

/**
 * Firestore contract for the send.chat cloaker backend (Builder A).
 * Collection `cloaked_links`, document ID `${workspaceSlug}_${slug}`
 * (URL-safe lowercase). The hosted resolver reads the routing fields
 * (destinationType / destinationUrl / cloakingMode / ref) and increments
 * clickCount; this UI only reads clickCount.
 */
const CLOAKED_LINKS_COLLECTION = 'cloaked_links';
const LOCAL_LINKS_KEY = 'chatmize_sendchat_links';

const DESTINATION_OPTIONS: Array<{ value: CloakedDestinationType; label: string; hint: string }> = [
  { value: 'takeover', label: 'Bridge Page + Live Chat', hint: 'Hosted send.chat card with a chat widget and CTA button' },
  { value: 'messenger', label: 'Direct Messenger', hint: 'm.me link opens a Facebook Messenger thread' },
  { value: 'instagram', label: 'Direct Instagram DM', hint: 'ig.me link opens an Instagram Direct thread' },
  { value: 'url', label: 'Plain URL (301)', hint: 'Straight redirect to any URL, no bridge page' },
];

const DEST_URL_PLACEHOLDERS: Record<CloakedDestinationType, string> = {
  takeover: 'https://yourdomain.com/final-offer (the bridge page continues here)',
  messenger: 'https://m.me/YourPage?ref=promo',
  instagram: 'https://ig.me/m/your_handle?ref=promo',
  url: 'https://yourdomain.com/any-page',
};

const DEST_BADGE_STYLES: Record<CloakedDestinationType, string> = {
  messenger: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  instagram: 'bg-pink-500/15 text-pink-300 border-pink-500/30',
  takeover: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
  url: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
};

const cleanSlug = (input: string) => {
  return input.toLowerCase().replace(/[^a-z0-9-_]/g, '-').replace(/-+/g, '-');
};

const linkDocId = (workspace: string, slug: string) => `${workspace}_${slug}`;

/** Map localStorage-era destination values to the Firestore contract union. */
const normalizeDestType = (t: unknown): CloakedDestinationType => {
  if (t === 'messenger' || t === 'instagram' || t === 'takeover' || t === 'url') return t;
  if (t === 'web_chat') return 'takeover';
  return 'url';
};

/** Normalize a Firestore document (or legacy localStorage record) to the UI shape. */
const toUiLink = (id: string, data: DocumentData): SendChatCloakedLink => {
  const workspaceSlug = String(data.workspaceSlug || 'workspace');
  const slug = cleanSlug(String(data.slug || 'link')) || 'link';
  return {
    id,
    workspaceSlug,
    slug,
    fullShortUrl: String(data.fullShortUrl || `https://send.chat/${workspaceSlug}/${slug}`),
    destinationType: normalizeDestType(data.destinationType),
    destinationUrl: String(data.destinationUrl || ''),
    title: String(data.title || 'Untitled link'),
    description: String(data.description || ''),
    previewImage: data.previewImage ? String(data.previewImage) : undefined,
    cloakingMode: data.cloakingMode === 'direct' || data.cloakingMode === 'masked' ? data.cloakingMode : 'bridge',
    connectedBotId: data.connectedBotId ? String(data.connectedBotId) : undefined,
    ref: data.ref ? String(data.ref) : (data.refPayload ? String(data.refPayload) : undefined),
    clickCount: typeof data.clickCount === 'number' ? data.clickCount : (typeof data.totalClicks === 'number' ? data.totalClicks : 0),
    createdBy: data.createdBy ? String(data.createdBy) : undefined,
    createdAt: String(data.createdAt || new Date().toISOString()),
    updatedAt: data.updatedAt ? String(data.updatedAt) : undefined,
    status: data.status === 'paused' ? 'paused' : 'active',
    refPayload: data.refPayload ? String(data.refPayload) : undefined,
    totalClicks: typeof data.totalClicks === 'number' ? data.totalClicks : undefined,
    totalConversions: typeof data.totalConversions === 'number' ? data.totalConversions : undefined,
    lastClickedAt: data.lastClickedAt ? String(data.lastClickedAt) : undefined,
  };
};

interface GrowthLinksViewProps {  workspaceName?: string;
  workspaceSlug?: string;
  availableBots?: Array<{ id: string; name: string }>;
  onNavigateToFlows?: (botId?: string) => void;
  initialSubTab?: 'cloaker' | 'mme' | 'igme' | 'qr'; // [BUILDER C: QR tab] added 'qr'
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
  const [activeTab, setActiveTab] = useState<'cloaker' | 'mme' | 'igme' | 'qr'>(initialSubTab); // [BUILDER C: QR tab] added 'qr'
  
  // Workspace slug is locked to the current workspace: users cannot change it,
  // so every branded link stays namespaced to the workspace that owns it.
  const lockedWorkspaceSlug = cleanSlug(workspaceSlug) || 'workspace';

  // Cloaked Links State (Firestore-backed)
  const [links, setLinks] = useState<SendChatCloakedLink[]>([]);
  const [linksLoading, setLinksLoading] = useState(true);
  const [linksError, setLinksError] = useState<string | null>(null);
  const [linksSaving, setLinksSaving] = useState(false);
  const [migrationNotice, setMigrationNotice] = useState<string | null>(null);

  const readLocalLinks = (): DocumentData[] => {
    try {
      const saved = localStorage.getItem(LOCAL_LINKS_KEY);
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  /** One-time migration: import localStorage links into Firestore, then clear the key. */
  const migrateLocalLinks = async (saved: DocumentData[]): Promise<SendChatCloakedLink[]> => {
    const migrated: SendChatCloakedLink[] = [];
    const now = new Date().toISOString();
    for (const raw of saved) {
      try {
        const slug = cleanSlug(String(raw.slug || 'link')) || 'link';
        const docId = linkDocId(lockedWorkspaceSlug, slug);
        const record = {
          workspaceSlug: lockedWorkspaceSlug,
          slug,
          fullShortUrl: String(raw.fullShortUrl || `https://send.chat/${lockedWorkspaceSlug}/${slug}`),
          destinationType: normalizeDestType(raw.destinationType),
          destinationUrl: String(raw.destinationUrl || ''),
          title: String(raw.title || 'Untitled link'),
          description: String(raw.description || ''),
          previewImage: raw.previewImage ? String(raw.previewImage) : null,
          cloakingMode: raw.cloakingMode === 'direct' || raw.cloakingMode === 'masked' ? raw.cloakingMode : 'bridge',
          connectedBotId: raw.connectedBotId ? String(raw.connectedBotId) : null,
          ref: raw.ref ? String(raw.ref) : (raw.refPayload ? String(raw.refPayload) : null),
          clickCount: typeof raw.clickCount === 'number' ? raw.clickCount : (typeof raw.totalClicks === 'number' ? raw.totalClicks : 0),
          createdBy: 'growth-links-ui (migrated from browser storage)',
          createdAt: String(raw.createdAt || now),
          updatedAt: now,
          status: raw.status === 'paused' ? 'paused' : 'active',
        };
        await setDoc(doc(prodDb, CLOAKED_LINKS_COLLECTION, docId), record);
        migrated.push(toUiLink(docId, record));
      } catch {
        // Skip records that fail to migrate; keep going with the rest.
      }
    }
    localStorage.removeItem(LOCAL_LINKS_KEY);
    return migrated;
  };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLinksLoading(true);
      setLinksError(null);
      try {
        const q = query(
          collection(prodDb, CLOAKED_LINKS_COLLECTION),
          where('workspaceSlug', '==', lockedWorkspaceSlug)
        );
        const snap = await getDocs(q);
        let rows = snap.docs.map(d => toUiLink(d.id, d.data()));

        const saved = readLocalLinks();
        if (saved.length > 0 && rows.length === 0) {
          rows = await migrateLocalLinks(saved);
          if (!cancelled && rows.length > 0) {
            setMigrationNotice(
              `Imported ${rows.length} link${rows.length === 1 ? '' : 's'} from this browser into the shared database.`
            );
          }
        }

        rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        if (!cancelled) setLinks(rows);
      } catch {
        if (!cancelled) setLinksError('Could not load links from the database. Check your connection and try again.');
      } finally {
        if (!cancelled) setLinksLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [lockedWorkspaceSlug]);

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [qrModalData, setQrModalData] = useState<{ url: string; title: string; subtitle?: string } | null>(null);

  // [BUILDER C: QR tab] prefill for "QR for this link" buttons: opens the QR tab with a cloaked link
  const [qrPrefillUrl, setQrPrefillUrl] = useState<string | null>(null);
  const [qrPrefillLabel, setQrPrefillLabel] = useState<string | null>(null);
  const [qrPrefillNonce, setQrPrefillNonce] = useState(0);
  const openQrTabForLink = (url: string, label?: string) => {
    setQrPrefillUrl(url);
    setQrPrefillLabel(label || url);
    setQrPrefillNonce((n) => n + 1);
    setIsCreatingLink(false);
    setActiveTab('qr');
  };
  const [previewModalLink, setPreviewModalLink] = useState<SendChatCloakedLink | null>(null);
  const [clickTrackingNotice, setClickTrackingNotice] = useState<string | null>(null);
  const [showQuickGuide, setShowQuickGuide] = useState(true);

  // New Cloaked Link Form
  const [isCreatingLink, setIsCreatingLink] = useState(false);
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

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSaveNewLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (linksSaving) return;
    const finalSlug = cleanSlug(newLinkSlug) || 'link';
    const finalWorkspace = lockedWorkspaceSlug;
    const fullUrl = `https://send.chat/${finalWorkspace}/${finalSlug}`;
    const docId = linkDocId(finalWorkspace, finalSlug);

    if (links.some(l => l.id === docId || (l.workspaceSlug === finalWorkspace && l.slug === finalSlug))) {
      setLinksError(`A link with the slug "${finalSlug}" already exists in this workspace. Pick a different slug.`);
      return;
    }

    const now = new Date().toISOString();
    const record = {
      workspaceSlug: finalWorkspace,
      slug: finalSlug,
      fullShortUrl: fullUrl,
      destinationType: newLinkDestType,
      destinationUrl: newLinkDestUrl.trim(),
      title: newLinkTitle.trim(),
      description: newLinkDesc.trim(),
      previewImage: newLinkImage.trim() || null,
      cloakingMode: newLinkMode,
      connectedBotId: newLinkBotId || null,
      ref: newLinkRef.trim() || null,
      clickCount: 0,
      createdBy: 'growth-links-ui',
      createdAt: now,
      updatedAt: now,
      status: 'active' as const,
    };

    setLinksSaving(true);
    setLinksError(null);
    try {
      await setDoc(doc(prodDb, CLOAKED_LINKS_COLLECTION, docId), record);
      setLinks(prev => [toUiLink(docId, record), ...prev]);
      setIsCreatingLink(false);
    } catch {
      setLinksError('Could not save the link to the database. Check your connection and try again.');
    } finally {
      setLinksSaving(false);
    }
  };

  const handleDeleteLink = async (link: SendChatCloakedLink) => {
    if (!confirm(`Delete send.chat/${link.workspaceSlug}/${link.slug}? Visitors will no longer reach its destination.`)) return;
    const docId = linkDocId(link.workspaceSlug, link.slug);
    try {
      await deleteDoc(doc(prodDb, CLOAKED_LINKS_COLLECTION, docId));
      setLinks(prev => prev.filter(l => l.id !== link.id));
    } catch {
      setLinksError('Could not delete the link. Check your connection and try again.');
    }
  };

  const handleToggleActive = async (link: SendChatCloakedLink) => {
    const nextStatus = link.status === 'active' ? 'paused' : 'active';
    const docId = linkDocId(link.workspaceSlug, link.slug);
    setLinks(prev => prev.map(l => l.id === link.id ? { ...l, status: nextStatus } : l));
    try {
      await updateDoc(doc(prodDb, CLOAKED_LINKS_COLLECTION, docId), {
        status: nextStatus,
        updatedAt: new Date().toISOString(),
      });
    } catch {
      setLinks(prev => prev.map(l => l.id === link.id ? { ...l, status: link.status } : l));
      setLinksError('Could not update the link status. Check your connection and try again.');
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
    <div className="space-y-6 max-w-7xl mx-auto pb-12" data-no-personalization>
      
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

        {/* [BUILDER C: QR tab] fourth sub-tab */}
        <button
          onClick={() => setActiveTab('qr')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'qr'
              ? 'bg-gradient-to-r from-violet-500/20 to-purple-500/20 text-violet-300 border border-violet-500/40 shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
          }`}
        >
          <QrCode className="w-4 h-4 text-violet-400" />
          <span>QR Builder</span>
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
                      https://send.chat/<span className="text-cyan-400">{lockedWorkspaceSlug}</span>/<span className="text-emerald-400">{cleanSlug(newLinkSlug) || 'slug'}</span>
                    </span>
                  </div>
                  <span className="text-xs text-slate-400">Automatic 301/Bridge Redirect</span>
                </div>

                {/* Workspace & Slug inputs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      Workspace Namespace Slug
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500">
                        <Lock className="w-3 h-3" />
                        Locked to this workspace
                      </span>
                    </label>
                    <div className="flex items-center px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-xs select-none" title="The workspace slug is fixed and cannot be changed">
                      <span className="text-slate-500 mr-1">send.chat/</span>
                      <span className="flex-1 text-cyan-300 font-mono">{lockedWorkspaceSlug}</span>
                      <Lock className="w-3.5 h-3.5 text-slate-600" />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300">Custom Campaign Slug</label>
                    <input data-no-emoji
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

                  {/* Destination type picker: four routing modes from the cloaker contract */}
                  <div className="space-y-2">
                    <label className="text-[11px] text-slate-400">Destination Type</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                      {DESTINATION_OPTIONS.map((opt) => {
                        const selected = newLinkDestType === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setNewLinkDestType(opt.value)}
                            aria-pressed={selected}
                            className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                              selected
                                ? 'border-cyan-500/60 bg-cyan-500/10 shadow-sm'
                                : 'border-white/10 bg-slate-950 hover:border-cyan-500/30'
                            }`}
                          >
                            <span className={`text-xs font-bold block ${selected ? 'text-cyan-300' : 'text-white'}`}>
                              {opt.label}
                            </span>
                            <span className="text-[11px] text-slate-400 block mt-0.5 leading-snug">
                              {opt.hint}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] text-slate-400">Final Destination Target URL</label>
                    <input
                      type="url"
                      value={newLinkDestUrl}
                      onChange={(e) => setNewLinkDestUrl(e.target.value)}
                      placeholder={DEST_URL_PLACEHOLDERS[newLinkDestType]}
                      className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-xs text-white focus:border-cyan-500 focus:outline-none font-mono"
                      required
                    />
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
                    <ImageUpload
                      label="Preview Thumbnail Image"
                      value={newLinkImage}
                      onChange={(url) => setNewLinkImage(url)}
                      accentClass="focus-within:border-cyan-500"
                    />
                  </div>
                </div>

                {/* Submit button */}
                <div className="flex items-center justify-end gap-3 pt-2">
                  {linksError && (
                    <span className="text-xs text-rose-300 flex items-center gap-1.5 mr-auto">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      {linksError}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsCreatingLink(false)}
                    className="px-4 py-2 text-xs text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={linksSaving}
                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-cyan-500/20 cursor-pointer disabled:opacity-60"
                  >
                    {linksSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    <span>{linksSaving ? 'Saving to database...' : 'Generate & Save Cloaked Link'}</span>
                  </button>
                </div>

              </form>
            </div>
          )}

          {/* Links List Table */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">send.chat Cloaked URLs</h3>
              <span className="text-xs text-slate-400">{links.length} total URLs cloaked</span>
            </div>

            {migrationNotice && (
              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>{migrationNotice}</span>
              </div>
            )}

            {linksError && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                <span>{linksError}</span>
              </div>
            )}

            {linksLoading ? (
              <div className="p-10 rounded-2xl bg-slate-900/60 border border-white/10 flex flex-col items-center justify-center gap-3 text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
                <span className="text-xs">Loading links from the database...</span>
              </div>
            ) : links.length === 0 ? (
              <div className="p-10 rounded-2xl bg-slate-900/60 border border-white/10 flex flex-col items-center justify-center gap-3 text-center">
                <Link2 className="w-8 h-8 text-slate-600" />
                <p className="text-sm font-bold text-white">No send.chat links yet</p>
                <p className="text-xs text-slate-400 max-w-sm">
                  Create your first branded link above. It is stored in the shared database so it works everywhere, not just this browser.
                </p>
                <button
                  onClick={() => setIsCreatingLink(true)}
                  className="mt-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-cyan-500/20"
                >
                  <Plus className="w-4 h-4" />
                  <span>New send.chat Link</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {links.map((link) => {
                  const isCopied = copiedId === link.id;
                  const isActive = link.status !== 'paused';

                  return (
                    <div
                      key={link.id}
                      className={`p-4 rounded-2xl bg-slate-900/80 border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 group ${
                        isActive ? 'border-white/10 hover:border-cyan-500/40' : 'border-white/5 opacity-70'
                      }`}
                    >
                      {/* Left: Link info */}
                      <div className="space-y-1.5 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-mono font-bold text-cyan-300">
                            {link.fullShortUrl}
                          </span>

                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${DEST_BADGE_STYLES[link.destinationType]}`}>
                            {link.destinationType.toUpperCase()}
                          </span>

                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 text-slate-400">
                            Mode: {link.cloakingMode}
                          </span>

                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            isActive
                              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                              : 'bg-slate-500/15 text-slate-400 border-slate-500/30'
                          }`}>
                            {isActive ? 'ACTIVE' : 'PAUSED'}
                          </span>
                        </div>

                        <p className="text-xs text-slate-200 font-medium truncate">{link.title}</p>

                        <div className="flex items-center gap-2 text-[11px] text-slate-400 truncate">
                          <span className="text-slate-500">Target:</span>
                          <span className="truncate font-mono">{link.destinationUrl}</span>
                        </div>
                      </div>

                      {/* Middle: Click Stats (read-only; counted by the hosted resolver) */}
                      <div className="flex items-center gap-4 px-4 py-2 rounded-xl bg-slate-950/60 border border-white/5 flex-shrink-0" title="Clicks are counted by the hosted send.chat resolver">
                        <div>
                          <span className="text-[10px] text-slate-500 block">Total Clicks</span>
                          <span className="text-sm font-bold text-white flex items-center gap-1">
                            <MousePointer className="w-3.5 h-3.5 text-cyan-400" />
                            {link.clickCount}
                          </span>
                        </div>
                        {link.ref && (
                          <div className="border-l border-white/10 pl-4">
                            <span className="text-[10px] text-slate-500 block">Ref</span>
                            <span className="text-sm font-bold text-slate-300 font-mono">
                              {link.ref}
                            </span>
                          </div>
                        )}
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
                          onClick={() => handleToggleActive(link)}
                          className={`p-2 rounded-xl border text-xs transition-colors cursor-pointer ${
                            isActive
                              ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border-amber-500/30'
                              : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                          }`}
                          title={isActive ? 'Pause this link (visitors see it as inactive)' : 'Activate this link'}
                        >
                          {isActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                        </button>

                        {/* [BUILDER C: QR tab] one-click "QR for this link": opens the QR Builder tab prefilled with this cloaked link */}
                        <button
                          onClick={() => openQrTabForLink(link.fullShortUrl, link.title)}
                          className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 text-xs transition-colors cursor-pointer"
                          title="Build QR Code for this link"
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
                          onClick={() => handleDeleteLink(link)}
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
            )}

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
                  <input data-no-emoji
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
                <input data-no-emoji
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
                  <input data-no-emoji
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
                <input data-no-emoji
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

      {/* [BUILDER C: QR tab] =========================================================================
          TAB 4: QR BUILDER
          ========================================================================= */}
      {activeTab === 'qr' && (
        <QrBuilderTab
          prefillUrl={qrPrefillUrl}
          prefillLabel={qrPrefillLabel}
          prefillNonce={qrPrefillNonce}
        />
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
                    // Preview only: real clicks are counted by the hosted resolver.
                    setClickTrackingNotice(
                      `Bridge preview for send.chat/${previewModalLink.workspaceSlug}/${previewModalLink.slug}. Live visitor clicks are counted automatically.`
                    );
                    setTimeout(() => setClickTrackingNotice(null), 3500);
                  }}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 cursor-pointer"
                >
                  <span>Continue to {{
                    messenger: 'Facebook Messenger',
                    instagram: 'Instagram Direct',
                    takeover: 'Live Chat',
                    url: 'Website',
                  }[previewModalLink.destinationType]}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>

                <p className="text-[10px] text-center text-slate-500">
                  Smart Bridge safely bypasses in-app browser blocks and deep-links directly into the native mobile app.
                </p>
              </div>
            </div>

            {/* Modal Footer Controls */}
            <div className="flex items-center justify-between text-xs pt-1">
              <span className="text-slate-400">Total clicks tracked: <strong className="text-white font-mono">{previewModalLink.clickCount}</strong> <span className="text-[10px] text-slate-500">(read-only, counted by the resolver)</span></span>
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
