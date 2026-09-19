import React, { useState, useEffect } from 'react';
import { EmojiPickerButton, useEmojiTarget } from '../emoji';
import { 
  Layout, 
  Sliders, 
  Layers, 
  Maximize2, 
  Plus, 
  Eye, 
  Code, 
  Copy, 
  Check, 
  Trash2, 
  Bot, 
  Settings2, 
  ArrowLeft, 
  Palette, 
  Clock, 
  MousePointer, 
  CheckCircle2, 
  ExternalLink,
  Sparkles,
  Zap,
  Tag,
  Monitor,
  Smartphone,
  Trophy,
  Gift,
  Globe,
  FlaskConical,
  ClipboardList
} from 'lucide-react';
import { WebsiteOverlay, OverlayType, OverlayTrigger, OverlayPosition, OverlayCtaAction, MobileTriggerType, MobileTriggerConfig, ContestStub } from '../../types/growthTools';
import {
  fetchOverlays,
  saveOverlay,
  deleteOverlay,
  setOverlayStatus,
  overlayEmbedCode,
} from '../../lib/overlays';
import { usePlan } from '../../lib/entitlements';
import { limitFor } from '../../lib/planModules';
import { UpgradePromptModal } from '../UpgradePromptModal';
import { fetchSurveys } from '../../lib/surveys';
import type { Survey } from '../../types/surveys';

interface WebsiteOverlaysViewProps {
  workspaceId?: string;
  availableBots?: Array<{ id: string; name: string }>;
  onNavigateToFlows?: (botId?: string) => void;
  initialFilter?: OverlayType | 'all';
  /** Firestore plan id of the active workspace; drives capture tool limits. */
  workspacePlanId?: string;
}

const OVERLAY_TYPE_INFO: Record<OverlayType, {
  name: string;
  icon: any;
  desc: string;
  badge: string;
  color: string;
  bgLight: string;
  defaultPosition: OverlayPosition;
}> = {
  popup_modal: {
    name: 'Exit Popup Modal',
    icon: Layout,
    desc: 'High-converting lightbox that triggers when visitor moves cursor to leave or after delay.',
    badge: 'Exit-Intent',
    color: 'text-blue-400',
    bgLight: 'bg-blue-500/10 border-blue-500/30',
    defaultPosition: 'center'
  },
  slider: {
    name: 'Corner Slider Drawer',
    icon: Sliders,
    desc: 'Interactive slide-out drawer triggered by scroll depth or click. Great for plan comparisons & case studies.',
    badge: 'Slide-in',
    color: 'text-emerald-400',
    bgLight: 'bg-emerald-500/10 border-emerald-500/30',
    defaultPosition: 'bottom_right'
  },
  sticky_bar: {
    name: 'Sticky Header/Footer Bar',
    icon: Layers,
    desc: 'Sleek top or bottom persistent notification banner with headline and instant action CTA button.',
    badge: 'Announcement',
    color: 'text-amber-400',
    bgLight: 'bg-amber-500/10 border-amber-500/30',
    defaultPosition: 'top_bar'
  },
  page_takeover: {
    name: 'Fullscreen Page Takeover',
    icon: Maximize2,
    desc: 'Fullscreen immersive overlay for major product drops, webinar registrations, or seasonal sales.',
    badge: 'High Impact',
    color: 'text-pink-400',
    bgLight: 'bg-pink-500/10 border-pink-500/30',
    defaultPosition: 'center'
  }
};

const COLOR_PRESETS = [
  { name: 'Royal Blue', hex: '#3b82f6' },
  { name: 'Electric Cyan', hex: '#00d2ff' },
  { name: 'Emerald', hex: '#10b981' },
  { name: 'Amber', hex: '#f59e0b' },
  { name: 'Purple', hex: '#a855f7' },
  { name: 'Rose', hex: '#ec4899' }
];

export const OVERLAY_PRESETS = [
  {
    name: '20% Cart Saver Voucher',
    type: 'popup_modal' as OverlayType,
    headline: "Wait! Don't Leave Empty Handed 🎁",
    subheadline: "Get an instant 20% off coupon code sent right to your inbox or phone.",
    badgeText: "Exclusive Promo",
    offerCode: "SAVE20",
    ctaText: "Claim My 20% Discount",
    brandColor: '#3b82f6',
    triggerType: 'exit_intent' as OverlayTrigger
  },
  {
    name: 'Free Strategy Call Drawer',
    type: 'slider' as OverlayType,
    headline: "Scale Your Business With AI Experts 🚀",
    subheadline: "Schedule a complimentary 15-minute pipeline analysis call with our team.",
    badgeText: "Free Strategy Session",
    offerCode: "",
    ctaText: "Book Free 15-Min Call",
    brandColor: '#10b981',
    triggerType: 'scroll_depth' as OverlayTrigger
  },
  {
    name: 'Flash Sale Announcement Bar',
    type: 'sticky_bar' as OverlayType,
    headline: "⚡ Flash Sale: Get 30% off all annual plans until midnight!",
    subheadline: "Use coupon FLASH30 at checkout before time runs out.",
    badgeText: "Limited Time",
    offerCode: "FLASH30",
    ctaText: "Shop Flash Sale",
    brandColor: '#f59e0b',
    triggerType: 'immediate' as OverlayTrigger
  },
  {
    name: 'Major Product Launch Takeover',
    type: 'page_takeover' as OverlayType,
    headline: "Introducing ChatMize 2.4 Omnichannel Suite 🎉",
    subheadline: "Complete automation for Instagram, WhatsApp, Facebook, and Web Chat in one dashboard.",
    badgeText: "New Release",
    offerCode: "EARLYBIRD",
    ctaText: "Explore What's New",
    brandColor: '#ec4899',
    triggerType: 'time_delay' as OverlayTrigger
  }
];

/**
 * STUB contest list for the "Enter Contest / Giveaway" CTA picker.
 * Contest entities don't exist yet (see viral-contests-spec.md) — when the
 * Contests module ships, this is replaced by the real contest list and the
 * overlay's `contestId` resolves against it.
 */
export const STUB_CONTESTS: ContestStub[] = [
  { id: 'contest-stub-summer-giveaway', name: 'Summer Giveaway', status: 'active', entriesCount: 1284 },
  { id: 'contest-stub-vip-launch', name: 'VIP Launch Raffle', status: 'draft', entriesCount: 0 }
];

/** Sensible mobile fallback: mirrors the desktop delay, never exit_intent. */
const defaultMobileTrigger = (delaySeconds: number, scrollPercent: number): MobileTriggerConfig => ({
  enabled: true,
  triggerType: 'time_delay',
  delaySeconds,
  scrollPercent
});

/** Mini wireframe preview shown inside each format-picker card. */
const FormatPreview: React.FC<{ type: OverlayType; brandColor: string }> = ({ type, brandColor }) => {
  const bar = { backgroundColor: brandColor };
  if (type === 'popup_modal') {
    return (
      <div className="h-14 rounded-md bg-slate-950/80 border border-white/10 flex items-center justify-center p-1.5 mb-2">
        <div className="w-3/5 h-full rounded bg-slate-800 border border-white/15 p-1 space-y-1">
          <div className="h-1.5 w-4/5 rounded-full bg-slate-600" />
          <div className="h-1 w-3/5 rounded-full bg-slate-700" />
          <div className="h-2 w-full rounded" style={bar} />
        </div>
      </div>
    );
  }
  if (type === 'slider') {
    return (
      <div className="h-14 rounded-md bg-slate-950/80 border border-white/10 p-1.5 mb-2 flex justify-end">
        <div className="w-1/2 h-full rounded bg-slate-800 border border-white/15 p-1 space-y-1">
          <div className="h-1.5 w-4/5 rounded-full bg-slate-600" />
          <div className="h-2 w-full rounded" style={bar} />
        </div>
      </div>
    );
  }
  if (type === 'sticky_bar') {
    return (
      <div className="h-14 rounded-md bg-slate-950/80 border border-white/10 p-1.5 mb-2 space-y-1">
        <div className="h-4 w-full rounded flex items-center justify-between px-1.5" style={bar}>
          <div className="h-1.5 w-2/5 rounded-full bg-white/70" />
          <div className="h-2.5 w-8 rounded bg-slate-950/80" />
        </div>
        <div className="h-1.5 w-3/5 rounded-full bg-slate-700" />
        <div className="h-1.5 w-4/5 rounded-full bg-slate-700" />
      </div>
    );
  }
  return (
    <div className="h-14 rounded-md border border-white/10 p-1.5 mb-2 space-y-1.5" style={{ backgroundColor: `${brandColor}18` }}>
      <div className="h-1.5 w-1/3 rounded-full bg-slate-500 mx-auto" />
      <div className="h-2 w-2/3 rounded-full bg-slate-400 mx-auto" />
      <div className="h-2.5 w-1/2 rounded mx-auto" style={bar} />
    </div>
  );
};

const MOBILE_TRIGGER_OPTIONS: Array<{ value: MobileTriggerType; label: string }> = [
  { value: 'time_delay', label: 'Time Delay (Wait X seconds on page)' },
  { value: 'scroll_depth', label: 'Scroll Depth (Scrolled X% of page)' },
  { value: 'button_click', label: 'On Click (Attached to page button)' },
  { value: 'immediate', label: 'Immediate (Show on page load)' }
];

const describeMobileTrigger = (o: WebsiteOverlay): string => {
  const m = o.mobileTrigger;
  if (!m || !m.enabled) return 'Mobile: follows desktop';
  if (m.triggerType === 'time_delay') return `Mobile: ${m.delaySeconds}s delay`;
  if (m.triggerType === 'scroll_depth') return `Mobile: ${m.scrollPercent}% scroll`;
  return `Mobile: ${m.triggerType.replace('_', ' ')}`;
};

/** CTA button label — shows a trophy when the action is a contest entry. */
const CtaLabel: React.FC<{ overlay: WebsiteOverlay }> = ({ overlay }) => (
  <span className="inline-flex items-center justify-center gap-1.5">
    {overlay.ctaAction === 'enter_contest' && <Trophy className="w-3.5 h-3.5" />}
    {overlay.ctaAction === 'take_survey' && <ClipboardList className="w-3.5 h-3.5" />}
    <span>{overlay.ctaText}</span>
  </span>
);

export const WebsiteOverlaysView: React.FC<WebsiteOverlaysViewProps> = ({
  workspaceId,
  // No fake bots: the parent passes the workspace's real bots; empty when unknown.
  availableBots = [],
  onNavigateToFlows,
  initialFilter = 'all',
  workspacePlanId
}) => {
  // Modular plan enforcement: the workspace's plan caps capture tools.
  const plan = usePlan(workspacePlanId);
  const captureToolLimit = limitFor(plan, 'capture_tools');
  const [limitModalOpen, setLimitModalOpen] = useState(false);

  // Overlays are stored per workspace in Firestore via the backend callable
  // actions (see src/lib/overlays.ts). No local demo data: the list starts
  // empty and loads from the server.
  const [overlays, setOverlays] = useState<WebsiteOverlay[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const [activeFilter, setActiveFilter] = useState<OverlayType | 'all'>(initialFilter);
  const [activeMode, setActiveMode] = useState<'list' | 'editor' | 'preview'>('list');
  const [selectedOverlayId, setSelectedOverlayId] = useState<string>('');
  const [editingOverlay, setEditingOverlay] = useState<WebsiteOverlay | null>(null);
  const overlayEmoji = useEmojiTarget<HTMLTextAreaElement>();
  const overlayCtaEmoji = useEmojiTarget<HTMLInputElement>();

  // Embed modal
  const [embedModalOverlay, setEmbedModalOverlay] = useState<WebsiteOverlay | null>(null);
  const [copiedEmbed, setCopiedEmbed] = useState(false);

  // Simulator
  const [simOverlayActive, setSimOverlayActive] = useState(true);
  const [simDevice, setSimDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [simLeadSubmitted, setSimLeadSubmitted] = useState(false);
  const [simEmail, setSimEmail] = useState('');
  const [simTriggerStatus, setSimTriggerStatus] = useState<string | null>(null);
  const [leadCapturedNotice, setLeadCapturedNotice] = useState<string | null>(null);
  const [showQuickGuide, setShowQuickGuide] = useState(true);

  // Surveys for the take_survey CTA action. Loaded lazily when the editor opens.
  const [surveyOptions, setSurveyOptions] = useState<Survey[]>([]);
  useEffect(() => {
    if (!workspaceId || activeMode !== 'editor') return;
    let cancelled = false;
    fetchSurveys(workspaceId)
      .then((list) => { if (!cancelled) setSurveyOptions(list); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [workspaceId, activeMode]);

  useEffect(() => {
    if (!workspaceId) {
      setLoading(false);
      setLoadError('No workspace selected.');
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    fetchOverlays(workspaceId)
      .then((list) => {
        if (cancelled) return;
        setOverlays(list);
        setSelectedOverlayId((prev) => prev || list[0]?.id || '');
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : 'Failed to load overlays.');
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [workspaceId]);

  const showNotice = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 5000);
  };

  const currentOverlay = overlays.find(o => o.id === selectedOverlayId) || overlays[0];

  // Simulator: which trigger actually fires depends on the previewed device.
  const simMobileCfg = currentOverlay?.mobileTrigger;
  const simMobileActive = simDevice === 'mobile' && simMobileCfg?.enabled !== false;
  const simEffTrigger: string = currentOverlay
    ? (simMobileActive
        ? (simMobileCfg?.triggerType || (currentOverlay.triggerType === 'exit_intent' ? 'time_delay' : currentOverlay.triggerType))
        : currentOverlay.triggerType)
    : 'time_delay';
  const simEffDelay = currentOverlay
    ? (simMobileActive ? (simMobileCfg?.delaySeconds ?? currentOverlay.triggerDelaySeconds) : currentOverlay.triggerDelaySeconds)
    : 0;
  const simEffScroll = currentOverlay
    ? (simMobileActive ? (simMobileCfg?.scrollPercent ?? currentOverlay.triggerScrollPercent) : currentOverlay.triggerScrollPercent)
    : 0;

  const filteredOverlays = activeFilter === 'all'
    ? overlays
    : overlays.filter(o => o.type === activeFilter);

  const requireWorkspace = (): string | null => {
    if (!workspaceId) {
      showNotice('No workspace selected. Pick a workspace first.');
      return null;
    }
    return workspaceId;
  };

  const handleCreateNew = (type: OverlayType = 'popup_modal') => {
    // Plan enforcement: creating beyond the capture tool limit shows the
    // upgrade prompt instead of opening the editor.
    if (overlays.length >= captureToolLimit) {
      setLimitModalOpen(true);
      return;
    }
    const info = OVERLAY_TYPE_INFO[type];
    // New overlays start as drafts with neutral copy — nothing fake is
    // published. The user edits content, then sets status to active.
    const newOverlay: WebsiteOverlay = {
      // Empty id: the backend assigns a Firestore id on first save.
      id: '',
      name: `New ${info.name}`,
      type: type,
      status: 'draft',
      headline: 'Your headline here',
      subheadline: 'Add a short description of your offer.',
      badgeText: '',
      offerCode: '',
      ctaText: 'Learn More',
      ctaAction: 'open_url',
      redirectUrl: '',
      brandColor: '#3b82f6',
      theme: 'dark',
      position: info.defaultPosition,
      triggerType: type === 'popup_modal' ? 'exit_intent' : type === 'slider' ? 'scroll_depth' : 'immediate',
      triggerDelaySeconds: 4,
      triggerScrollPercent: 40,
      exitIntentSensitivity: 'medium',
      // Mobile never gets exit_intent — default to a timed trigger instead.
      mobileTrigger: defaultMobileTrigger(4, 40),
      // Real bot is picked in the editor; never invent a connected bot id.
      connectedBotId: '',
      botName: '',
      requireEmailCapture: false,
      requireNameCapture: false,
      removeBranding: false,
      // Display rules: show everywhere, 24h cooldown, no per-visitor cap.
      frequency: { cooldownHours: 24, maxPerVisitor: 0 },
      pageTargeting: { mode: 'all', patterns: [] },
      abGroup: '',
      abWeight: 50,
      // Empty = serve on all domains. Placeholder domains like
      // *.yourdomain.com are stripped at publish time anyway.
      whitelistedDomains: [],
      totalViews: 0,
      totalInteractions: 0,
      totalLeads: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    setEditingOverlay(newOverlay);
    setActiveMode('editor');
  };

  /** Backfill display-rule fields on overlays saved before those fields existed. */
  const normalizeOverlay = (overlay: WebsiteOverlay): WebsiteOverlay => ({
    ...overlay,
    frequency: overlay.frequency ?? { cooldownHours: 24, maxPerVisitor: 0 },
    pageTargeting: overlay.pageTargeting ?? { mode: 'all', patterns: [] },
    abGroup: overlay.abGroup ?? '',
    abWeight: overlay.abWeight ?? 50,
  });

  const handleEdit = (overlay: WebsiteOverlay) => {
    setEditingOverlay(normalizeOverlay({ ...overlay }));
    setSelectedOverlayId(overlay.id);
    setActiveMode('editor');
  };

  const handleSave = async (updated: WebsiteOverlay) => {
    const wsId = requireWorkspace();
    if (!wsId) return;
    setSaving(true);
    try {
      const saved = await saveOverlay(wsId, updated);
      setOverlays((prev) => {
        const exists = prev.some(o => o.id === saved.id);
        return exists
          ? prev.map(o => o.id === saved.id ? saved : o)
          : [saved, ...prev];
      });
      setSelectedOverlayId(saved.id);
      setEditingOverlay(null);
      setActiveMode('list');
      showNotice(saved.status === 'active'
        ? `Overlay "${saved.name}" saved and published.`
        : `Overlay "${saved.name}" saved as ${saved.status}. Set it to Active to publish it to your site.`);
    } catch (err) {
      showNotice(`Save failed: ${err instanceof Error ? err.message : 'unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const wsId = requireWorkspace();
    if (!wsId) return;
    const current = overlays.find(o => o.id === id);
    if (!current) return;
    const next = current.status === 'active' ? 'paused' : 'active';
    // Optimistic update; roll back on failure.
    setOverlays((prev) => prev.map(o => o.id === id ? { ...o, status: next } : o));
    try {
      await setOverlayStatus(wsId, id, next);
    } catch (err) {
      setOverlays((prev) => prev.map(o => o.id === id ? { ...o, status: current.status } : o));
      showNotice(`Status change failed: ${err instanceof Error ? err.message : 'unknown error'}`);
    }
  };

  const handleDuplicate = async (overlay: WebsiteOverlay, e: React.MouseEvent) => {
    e.stopPropagation();
    const wsId = requireWorkspace();
    if (!wsId) return;
    // New backend-generated id: drop the old one.
    const copy = normalizeOverlay({
      ...overlay,
      id: '',
      name: `${overlay.name} (Copy)`,
      status: 'draft' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as WebsiteOverlay);
    setSaving(true);
    try {
      const saved = await saveOverlay(wsId, copy);
      setOverlays((prev) => [saved, ...prev]);
      showNotice(`Duplicated as "${saved.name}".`);
    } catch (err) {
      showNotice(`Duplicate failed: ${err instanceof Error ? err.message : 'unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const wsId = requireWorkspace();
    if (!wsId) return;
    if (!confirm('Are you sure you want to delete this overlay?')) return;
    const removed = overlays.find(o => o.id === id);
    setOverlays((prev) => prev.filter(o => o.id !== id));
    try {
      await deleteOverlay(wsId, id);
      if (selectedOverlayId === id) {
        setSelectedOverlayId((prev) => {
          const rest = overlays.filter(o => o.id !== id);
          return prev === id ? (rest[0]?.id || '') : prev;
        });
      }
    } catch (err) {
      if (removed) setOverlays((prev) => [removed, ...prev]);
      showNotice(`Delete failed: ${err instanceof Error ? err.message : 'unknown error'}`);
    }
  };

  /** Patch the mobile trigger config, creating a sane default if none exists yet. */
  const updateMobileTrigger = (patch: Partial<MobileTriggerConfig>) => {
    if (!editingOverlay) return;
    const current = editingOverlay.mobileTrigger
      || defaultMobileTrigger(editingOverlay.triggerDelaySeconds, editingOverlay.triggerScrollPercent);
    setEditingOverlay({ ...editingOverlay, mobileTrigger: { ...current, ...patch } });
  };

  /** One snippet per workspace: it serves every active overlay. */
  const getEmbedCode = (_o: WebsiteOverlay) => {
    return workspaceId ? overlayEmbedCode(workspaceId) : '<!-- Select a workspace to get your embed code -->';
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {notice && (
        <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-200 text-sm font-medium">
          {notice}
        </div>
      )}
      {loadError && !loading && (
        <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-200 text-sm font-medium">
          {loadError}
        </div>
      )}

      {/* Top Header Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/95 to-slate-950 border border-white/10 relative overflow-hidden shadow-xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/30 text-xs font-semibold">
              <Layout className="w-3.5 h-3.5 text-blue-400" />
              <span>Website Growth Overlays Suite</span>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Exit Popups, Sliders, Takeovers &amp; Bars</h1>
            <p className="text-sm text-slate-400 max-w-2xl">
              Build high-converting behavioral popups and announcement banners. Built separately from Support Chat so you have dedicated control.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {activeMode !== 'list' && (
              <button
                onClick={() => {
                  setEditingOverlay(null);
                  setActiveMode('list');
                }}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-white/10 text-xs font-bold flex items-center gap-2 transition-all cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>All Overlays</span>
              </button>
            )}

            {activeMode === 'list' && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleCreateNew('popup_modal')}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-blue-500/20"
                >
                  <Plus className="w-4 h-4" />
                  <span>New Exit Popup</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* =========================================================================
          MODE 1: LIST VIEW (FILTERED BY OVERLAY FORMAT)
          ========================================================================= */}
      {activeMode === 'list' && (
        <div className="space-y-6">

          {/* Lead captured toast */}
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
            <div className="p-5 rounded-2xl bg-gradient-to-r from-blue-950/40 via-slate-900 to-cyan-950/40 border border-blue-500/30 shadow-lg relative">
              <button
                onClick={() => setShowQuickGuide(false)}
                className="absolute top-3 right-3 text-slate-500 hover:text-white text-xs p-1"
                title="Dismiss guide"
              >
                ✕
              </button>
              
              <div className="flex items-center gap-2 pb-3 border-b border-white/10">
                <Sparkles className="w-4 h-4 text-blue-400" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">How Website Overlays Work in 3 Steps</span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3 text-xs">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-500 text-white font-bold flex items-center justify-center flex-shrink-0 text-xs">1</div>
                  <div>
                    <h4 className="font-bold text-white">Choose Trigger Rule</h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">Fire on exit-intent (mouse leaves page), scroll depth (e.g. 50%), or timed delay.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-cyan-500 text-slate-950 font-bold flex items-center justify-center flex-shrink-0 text-xs">2</div>
                  <div>
                    <h4 className="font-bold text-white">Add Irresistible Offer</h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">Voucher codes, email opt in, VIP call booking, or instant launch announcements.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-500 text-slate-950 font-bold flex items-center justify-center flex-shrink-0 text-xs">3</div>
                  <div>
                    <h4 className="font-bold text-white">Copy 1-Line Embed Code</h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">Paste into Shopify, WordPress, Webflow, or custom funnel HTML.</p>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Format Filter Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
            <button
              onClick={() => setActiveFilter('all')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
                activeFilter === 'all'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-white/10'
              }`}
            >
              <span>All Overlays</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/20 font-mono">
                {overlays.length}
              </span>
            </button>

            {(Object.keys(OVERLAY_TYPE_INFO) as OverlayType[]).map((type) => {
              const info = OVERLAY_TYPE_INFO[type];
              const count = overlays.filter(o => o.type === type).length;
              const Icon = info.icon;

              return (
                <button
                  key={type}
                  onClick={() => setActiveFilter(type)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
                    activeFilter === type
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                      : 'bg-slate-900 text-slate-400 hover:text-white border border-white/10'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{info.name}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/20 font-mono">
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Overlays Grid */}
          {loading ? (
            <div className="p-10 rounded-2xl bg-slate-900/60 border border-white/10 text-center text-slate-400 text-sm">
              Loading overlays…
            </div>
          ) : filteredOverlays.length === 0 ? (
            <div className="p-10 rounded-2xl bg-slate-900/60 border border-white/10 text-center space-y-3">
              <p className="text-slate-300 font-semibold">No overlays yet</p>
              <p className="text-slate-500 text-sm max-w-md mx-auto">
                Create your first overlay or start from a template below. Paste the embed snippet
                on your site and active overlays go live instantly.
              </p>
              <button
                onClick={() => handleCreateNew('popup_modal')}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-bold text-xs inline-flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-blue-500/20"
              >
                <Plus className="w-4 h-4" />
                <span>Create overlay</span>
              </button>
            </div>
          ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {filteredOverlays.map((overlay) => {
              const info = OVERLAY_TYPE_INFO[overlay.type];
              const Icon = info.icon;

              return (
                <div 
                  key={overlay.id}
                  className="bg-slate-900/80 border border-white/10 rounded-2xl p-5 hover:border-blue-500/40 hover:bg-slate-900 transition-all flex flex-col justify-between group shadow-xl"
                >
                  <div className="space-y-4">
                    {/* Top Row: Format Tag + Status Toggle */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <div 
                          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm"
                          style={{ backgroundColor: `${overlay.brandColor}25`, color: overlay.brandColor }}
                        >
                          <Icon className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-base font-bold text-white group-hover:text-blue-300 transition-colors">
                              {overlay.name}
                            </h3>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400">
                            <span className="capitalize">{info.name}</span>
                            <span>•</span>
                            <span className="font-mono text-cyan-400">
                              Desktop: {overlay.triggerType.replace('_', ' ')}
                            </span>
                            <span>•</span>
                            <span className="font-mono text-violet-300">
                              {describeMobileTrigger(overlay)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={(e) => handleToggleStatus(overlay.id, e)}
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center gap-1.5 cursor-pointer transition-colors flex-shrink-0 ${
                          overlay.status === 'active'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30'
                            : 'bg-slate-800 text-slate-400 border border-white/10 hover:bg-slate-700'
                        }`}
                        title={overlay.status === 'active' ? 'Click to Pause' : 'Click to Activate'}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${overlay.status === 'active' ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                        <span className="capitalize">{overlay.status}</span>
                      </button>
                    </div>

                    {/* Headline & Offer Banner */}
                    <div className="p-3 rounded-xl bg-slate-950/70 border border-white/5 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20">
                          {overlay.badgeText || 'Promo Offer'}
                        </span>
                        {overlay.offerCode && (
                          <span className="text-[10px] font-mono font-bold text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                            Code: {overlay.offerCode}
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-bold text-white">{overlay.headline}</p>
                      <p className="text-[11px] text-slate-400 line-clamp-2">{overlay.subheadline}</p>
                    </div>

                    {/* CTA Info & Trigger details */}
                    <div className="flex items-center justify-between text-xs py-2 px-3 rounded-xl bg-white/5 border border-white/5">
                      <div className="flex items-center gap-2 text-slate-300">
                        <Zap className="w-3.5 h-3.5 text-blue-400" />
                        <span className="truncate">CTA: "{overlay.ctaText}"</span>
                      </div>
                      <span className="text-[11px] text-slate-400">
                        {overlay.requireEmailCapture ? 'Captures Email' : 'Direct Action'}
                      </span>
                    </div>

                    {/* Performance metrics */}
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="p-2 rounded-xl bg-slate-950/60 border border-white/5">
                        <span className="text-[10px] text-slate-500 block">Views</span>
                        <span className="text-xs font-bold text-white">{(overlay.totalViews || 0).toLocaleString()}</span>
                      </div>
                      <div className="p-2 rounded-xl bg-slate-950/60 border border-white/5">
                        <span className="text-[10px] text-slate-500 block">Interactions</span>
                        <span className="text-xs font-bold text-blue-300">{(overlay.totalInteractions || 0).toLocaleString()}</span>
                      </div>
                      <div className="p-2 rounded-xl bg-slate-950/60 border border-white/5">
                        <span className="text-[10px] text-slate-500 block">Leads</span>
                        <span className="text-xs font-bold text-emerald-400">{(overlay.totalLeads || 0).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="mt-4 pt-3 border-t border-white/10 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
                    <button
                      onClick={() => {
                        setSelectedOverlayId(overlay.id);
                        setSimOverlayActive(true);
                        setSimLeadSubmitted(false);
                        setActiveMode('preview');
                      }}
                      className="py-2 px-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md shadow-blue-500/20"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Test Trigger Live</span>
                    </button>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleEdit(overlay)}
                        className="py-2 px-3 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                      >
                        <Settings2 className="w-3.5 h-3.5 text-blue-400" />
                        <span>Customize</span>
                      </button>

                      <button
                        onClick={() => setEmbedModalOverlay(overlay)}
                        className="py-2 px-3 bg-white/5 hover:bg-white/10 text-blue-300 border border-white/10 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                        title="Get Embed Code"
                      >
                        <Code className="w-3.5 h-3.5" />
                        <span>Embed</span>
                      </button>

                      <button
                        onClick={(e) => handleDuplicate(overlay, e)}
                        className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-xl border border-transparent hover:border-white/10 transition-colors cursor-pointer"
                        title="Duplicate Overlay"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={(e) => handleDelete(overlay.id, e)}
                        className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-colors cursor-pointer"
                        title="Delete Overlay"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          )}
        </div>
      )}

      {/* =========================================================================
          MODE 2: DEDICATED OVERLAY EDITOR
          ========================================================================= */}
      {activeMode === 'editor' && editingOverlay && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left Column: Form Settings (7 cols) */}
          <div className="lg:col-span-7 bg-slate-900/90 border border-white/10 rounded-2xl p-6 space-y-6 shadow-xl">
            
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div>
                <h2 className="text-lg font-bold text-white">Edit Overlay Settings</h2>
                <p className="text-xs text-slate-400">Configure trigger rules, conversion offer, and styling.</p>
              </div>
              <span className="text-xs px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-300 font-mono">
                {OVERLAY_TYPE_INFO[editingOverlay.type].name}
              </span>
            </div>

            {/* 1-Click Quick Presets */}
            <div className="p-4 rounded-xl bg-slate-950/60 border border-white/5 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                  <span>1-Click Preset Templates</span>
                </label>
                <span className="text-[10px] text-slate-400">Autofill offer, styling &amp; trigger rule</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {OVERLAY_PRESETS.map((tmpl) => (
                  <button
                    key={tmpl.name}
                    type="button"
                    onClick={() => {
                      const typeInfo = OVERLAY_TYPE_INFO[tmpl.type];
                      setEditingOverlay({
                        ...editingOverlay,
                        type: tmpl.type,
                        name: tmpl.name,
                        headline: tmpl.headline,
                        subheadline: tmpl.subheadline,
                        badgeText: tmpl.badgeText,
                        offerCode: tmpl.offerCode,
                        ctaText: tmpl.ctaText,
                        brandColor: tmpl.brandColor,
                        triggerType: tmpl.triggerType,
                        position: typeInfo.defaultPosition
                      });
                    }}
                    className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-850 border border-white/10 hover:border-blue-500/50 text-left transition-all cursor-pointer group shadow-sm"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: tmpl.brandColor }} />
                      <span className="text-xs font-bold text-slate-200 group-hover:text-blue-300 truncate">
                        {tmpl.name}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 line-clamp-1 mt-1">
                      {OVERLAY_TYPE_INFO[tmpl.type].name}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Format Selector */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300">Overlay Format Type</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(Object.keys(OVERLAY_TYPE_INFO) as OverlayType[]).map((type) => {
                  const info = OVERLAY_TYPE_INFO[type];
                  const Icon = info.icon;
                  const isSelected = editingOverlay.type === type;

                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setEditingOverlay({
                        ...editingOverlay,
                        type: type,
                        position: info.defaultPosition,
                        triggerType: type === 'popup_modal' ? 'exit_intent' : type === 'slider' ? 'scroll_depth' : 'immediate',
                        // Switching to an exit-intent format? Make sure mobile has its own trigger.
                        mobileTrigger: editingOverlay.mobileTrigger || defaultMobileTrigger(editingOverlay.triggerDelaySeconds, editingOverlay.triggerScrollPercent)
                      })}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? 'border-blue-500 bg-blue-500/10 text-white font-bold ring-1 ring-blue-500/30'
                          : 'border-white/10 bg-slate-950/60 text-slate-400 hover:border-white/20'
                      }`}
                    >
                      <FormatPreview type={type} brandColor={editingOverlay.brandColor} />
                      <div className="flex items-center gap-1.5">
                        <Icon className={`w-4 h-4 ${isSelected ? 'text-blue-400' : 'text-slate-500'}`} />
                        <span className="text-xs block leading-tight">{info.name}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Name & Status */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Overlay Campaign Name</label>
                <input data-no-emoji
                  type="text"
                  value={editingOverlay.name}
                  onChange={(e) => setEditingOverlay({ ...editingOverlay, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-xs text-white focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Campaign Status</label>
                <select
                  value={editingOverlay.status}
                  onChange={(e) => setEditingOverlay({ ...editingOverlay, status: e.target.value as any })}
                  className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-xs text-white focus:border-blue-500 focus:outline-none"
                >
                  <option value="active">Active (Showing to Visitors)</option>
                  <option value="paused">Paused</option>
                  <option value="draft">Draft</option>
                </select>
              </div>
            </div>

            {/* Trigger Behavior Rules */}
            <div className="space-y-4 p-4 rounded-xl bg-slate-950/60 border border-white/5">
              <div className="flex items-center gap-2 text-xs font-bold text-white">
                <Clock className="w-4 h-4 text-blue-400" />
                <span>Behavioral Trigger Rules</span>
              </div>

              {/* Desktop trigger — exit intent is desktop-only */}
              <div className="flex items-center gap-2 text-[11px] font-bold text-slate-300">
                <Monitor className="w-3.5 h-3.5 text-cyan-400" />
                <span>Desktop Trigger</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] text-slate-400">Trigger Event</label>
                  <select
                    value={editingOverlay.triggerType}
                    onChange={(e) => {
                      const next = e.target.value as OverlayTrigger;
                      setEditingOverlay({
                        ...editingOverlay,
                        triggerType: next,
                        // First time picking a desktop-only trigger? Give mobile its own trigger.
                        mobileTrigger: editingOverlay.mobileTrigger || (next === 'exit_intent'
                          ? defaultMobileTrigger(editingOverlay.triggerDelaySeconds, editingOverlay.triggerScrollPercent)
                          : undefined)
                      });
                    }}
                    className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-xs text-white focus:border-blue-500 focus:outline-none"
                  >
                    <option value="exit_intent">Exit Intent (cursor leaves page) — desktop only</option>
                    <option value="time_delay">Time Delay (Wait X seconds on page)</option>
                    <option value="scroll_depth">Scroll Depth (Scrolled X% of page)</option>
                    <option value="button_click">On Click (Attached to page button)</option>
                    <option value="immediate">Immediate (Show on page load)</option>
                  </select>
                </div>

                {editingOverlay.triggerType === 'exit_intent' && (
                  <div className="space-y-1.5">
                    <label className="text-[11px] text-slate-400">Mouse Sensitivity</label>
                    <select
                      value={editingOverlay.exitIntentSensitivity || 'medium'}
                      onChange={(e) => setEditingOverlay({ ...editingOverlay, exitIntentSensitivity: e.target.value as any })}
                      className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-xs text-white focus:border-blue-500 focus:outline-none"
                    >
                      <option value="high">High (Top 50px viewport exit)</option>
                      <option value="medium">Medium (Standard top bar departure)</option>
                      <option value="low">Low (Requires rapid mouse upward flick)</option>
                    </select>
                  </div>
                )}

                {editingOverlay.triggerType === 'time_delay' && (
                  <div className="space-y-1.5">
                    <label className="text-[11px] text-slate-400">Delay Seconds</label>
                    <input
                      type="number"
                      min="1"
                      max="60"
                      value={editingOverlay.triggerDelaySeconds}
                      onChange={(e) => setEditingOverlay({ ...editingOverlay, triggerDelaySeconds: parseInt(e.target.value) || 2 })}
                      className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-xs text-white focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                )}

                {editingOverlay.triggerType === 'scroll_depth' && (
                  <div className="space-y-1.5">
                    <label className="text-[11px] text-slate-400">Scroll Depth Percentage (%)</label>
                    <input
                      type="number"
                      min="10"
                      max="90"
                      step="5"
                      value={editingOverlay.triggerScrollPercent}
                      onChange={(e) => setEditingOverlay({ ...editingOverlay, triggerScrollPercent: parseInt(e.target.value) || 40 })}
                      className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-xs text-white focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                )}
              </div>

              {editingOverlay.triggerType === 'exit_intent' && (
                <p className="text-[11px] text-amber-300/90 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                  Exit intent is desktop-only (there's no cursor on phones). Mobile visitors use the mobile trigger below.
                </p>
              )}

              {/* Mobile trigger — phones get timed / scroll / click triggers, never exit intent */}
              <div className="space-y-3 pt-3 border-t border-white/5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[11px] font-bold text-slate-300">
                    <Smartphone className="w-3.5 h-3.5 text-violet-400" />
                    <span>Mobile Trigger</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const current = editingOverlay.mobileTrigger;
                      if (current?.enabled) {
                        updateMobileTrigger({ enabled: false });
                      } else {
                        updateMobileTrigger({ enabled: true });
                      }
                    }}
                    className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer ${
                      editingOverlay.mobileTrigger?.enabled !== false ? 'bg-violet-500' : 'bg-slate-700'
                    }`}
                    title="Toggle mobile trigger"
                  >
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${
                      editingOverlay.mobileTrigger?.enabled !== false ? 'left-4' : 'left-0.5'
                    }`} />
                  </button>
                </div>

                {editingOverlay.mobileTrigger?.enabled !== false ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[11px] text-slate-400">Mobile Trigger Event</label>
                      <select
                        value={editingOverlay.mobileTrigger?.triggerType || 'time_delay'}
                        onChange={(e) => updateMobileTrigger({ triggerType: e.target.value as MobileTriggerType })}
                        className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-xs text-white focus:border-violet-500 focus:outline-none"
                      >
                        {MOBILE_TRIGGER_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>

                    {(editingOverlay.mobileTrigger?.triggerType || 'time_delay') === 'time_delay' && (
                      <div className="space-y-1.5">
                        <label className="text-[11px] text-slate-400">Mobile Delay Seconds</label>
                        <input
                          type="number"
                          min="1"
                          max="60"
                          value={editingOverlay.mobileTrigger?.delaySeconds ?? editingOverlay.triggerDelaySeconds}
                          onChange={(e) => updateMobileTrigger({ delaySeconds: parseInt(e.target.value) || 2 })}
                          className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-xs text-white focus:border-violet-500 focus:outline-none"
                        />
                      </div>
                    )}

                    {editingOverlay.mobileTrigger?.triggerType === 'scroll_depth' && (
                      <div className="space-y-1.5">
                        <label className="text-[11px] text-slate-400">Mobile Scroll Depth (%)</label>
                        <input
                          type="number"
                          min="10"
                          max="90"
                          step="5"
                          value={editingOverlay.mobileTrigger?.scrollPercent ?? editingOverlay.triggerScrollPercent}
                          onChange={(e) => updateMobileTrigger({ scrollPercent: parseInt(e.target.value) || 40 })}
                          className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-xs text-white focus:border-violet-500 focus:outline-none"
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-500">
                    Off — mobile visitors follow the desktop trigger.{editingOverlay.triggerType === 'exit_intent' ? ' Exit intent falls back to a timed trigger on mobile.' : ''}
                  </p>
                )}
              </div>
            </div>

            {/* Display rules — frequency capping, page targeting, A/B test */}
            <div className="space-y-3 p-4 rounded-xl bg-slate-950/60 border border-white/5">
              <div className="flex items-center gap-2 text-[11px] font-bold text-slate-300">
                <Globe className="w-3.5 h-3.5 text-emerald-400" />
                <span>Display Rules</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] text-slate-400">Cooldown Between Shows (hours)</label>
                  <input
                    type="number"
                    min="0"
                    max="720"
                    value={editingOverlay.frequency?.cooldownHours ?? 24}
                    onChange={(e) => setEditingOverlay({
                      ...editingOverlay,
                      frequency: {
                        cooldownHours: Math.max(0, parseInt(e.target.value) || 0),
                        maxPerVisitor: editingOverlay.frequency?.maxPerVisitor ?? 0,
                      },
                    })}
                    className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-xs text-white focus:border-blue-500 focus:outline-none"
                  />
                  <p className="text-[10px] text-slate-500">0 = can show again on the next page load.</p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] text-slate-400">Max Shows Per Visitor</label>
                  <input
                    type="number"
                    min="0"
                    max="1000"
                    value={editingOverlay.frequency?.maxPerVisitor ?? 0}
                    onChange={(e) => setEditingOverlay({
                      ...editingOverlay,
                      frequency: {
                        cooldownHours: editingOverlay.frequency?.cooldownHours ?? 24,
                        maxPerVisitor: Math.max(0, parseInt(e.target.value) || 0),
                      },
                    })}
                    className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-xs text-white focus:border-blue-500 focus:outline-none"
                  />
                  <p className="text-[10px] text-slate-500">0 = unlimited. After this many shows the visitor never sees it again.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] text-slate-400">Page Targeting</label>
                  <select
                    value={editingOverlay.pageTargeting?.mode ?? 'all'}
                    onChange={(e) => setEditingOverlay({
                      ...editingOverlay,
                      pageTargeting: {
                        mode: e.target.value as 'all' | 'include' | 'exclude',
                        patterns: editingOverlay.pageTargeting?.patterns ?? [],
                      },
                    })}
                    className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-xs text-white focus:border-blue-500 focus:outline-none"
                  >
                    <option value="all">All pages</option>
                    <option value="include">Only these pages</option>
                    <option value="exclude">Everywhere except these pages</option>
                  </select>
                </div>

                {(editingOverlay.pageTargeting?.mode ?? 'all') !== 'all' && (
                  <div className="space-y-1.5">
                    <label className="text-[11px] text-slate-400">URL Patterns (one per line, * = wildcard)</label>
                    <textarea
                      rows={2}
                      value={(editingOverlay.pageTargeting?.patterns ?? []).join('\n')}
                      onChange={(e) => setEditingOverlay({
                        ...editingOverlay,
                        pageTargeting: {
                          mode: editingOverlay.pageTargeting?.mode ?? 'include',
                          patterns: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean),
                        },
                      })}
                      placeholder="/pricing*&#10;/blog/*"
                      className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-xs text-white font-mono focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-white/5">
                <div className="flex items-center gap-2 text-[11px] font-bold text-slate-300 mb-3">
                  <FlaskConical className="w-3.5 h-3.5 text-amber-400" />
                  <span>A/B Test</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] text-slate-400">Test Group Name</label>
                    <input
                      type="text"
                      value={editingOverlay.abGroup || ''}
                      onChange={(e) => setEditingOverlay({ ...editingOverlay, abGroup: e.target.value.trim() })}
                      placeholder="e.g. headline-test-1 (empty = no test)"
                      className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-xs text-white focus:border-blue-500 focus:outline-none"
                    />
                    <p className="text-[10px] text-slate-500">Overlays with the same group name compete — each visitor sees exactly one.</p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] text-slate-400">Traffic Weight (1–100)</label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={editingOverlay.abWeight ?? 50}
                      onChange={(e) => setEditingOverlay({
                        ...editingOverlay,
                        abWeight: Math.min(100, Math.max(1, parseInt(e.target.value) || 50)),
                      })}
                      className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-xs text-white focus:border-blue-500 focus:outline-none"
                    />
                    <p className="text-[10px] text-slate-500">Share of visitors in this group who see this variant. Sticky per visitor.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Offer Copy & Call to Action */}
            <div className="space-y-3 p-4 rounded-xl bg-slate-950/60 border border-white/5">
              <div className="flex items-center gap-2 text-xs font-bold text-white">
                <Tag className="w-4 h-4 text-blue-400" />
                <span>Headline, Copy &amp; Offer Details</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] text-slate-400">Badge Tagline</label>
                  <input
                    type="text"
                    value={editingOverlay.badgeText || ''}
                    onChange={(e) => setEditingOverlay({ ...editingOverlay, badgeText: e.target.value })}
                    placeholder="e.g. Limited Time Offer"
                    className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-xs text-white focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] text-slate-400">Voucher / Coupon Code (Optional)</label>
                  <input data-no-emoji
                    type="text"
                    value={editingOverlay.offerCode || ''}
                    onChange={(e) => setEditingOverlay({ ...editingOverlay, offerCode: e.target.value })}
                    placeholder="e.g. SAVE20NOW"
                    className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-xs text-white focus:border-blue-500 focus:outline-none uppercase font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] text-slate-400">Main Headline</label>
                <input
                  type="text"
                  value={editingOverlay.headline}
                  onChange={(e) => setEditingOverlay({ ...editingOverlay, headline: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-xs text-white focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] text-slate-400">Subheadline Description</label>
                  <EmojiPickerButton onPick={(e) => overlayEmoji.insert(e, editingOverlay.subheadline, (v) => setEditingOverlay({ ...editingOverlay, subheadline: v }))} placement="down" />
                </div>
                <textarea
                  rows={2}
                  ref={overlayEmoji.ref}
                  value={editingOverlay.subheadline}
                  onChange={(e) => setEditingOverlay({ ...editingOverlay, subheadline: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-xs text-white focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div className="space-y-1.5">
                  <label className="text-[11px] text-slate-400">CTA Button Text</label>
                  <div className="relative">
                    <input
                      type="text"
                      ref={overlayCtaEmoji.ref}
                      value={editingOverlay.ctaText}
                      onChange={(e) => setEditingOverlay({ ...editingOverlay, ctaText: e.target.value })}
                      className="w-full pl-3 pr-9 py-2 bg-slate-950 border border-white/10 rounded-xl text-xs text-white focus:border-blue-500 focus:outline-none"
                    />
                    <span className="absolute right-1 top-1/2 -translate-y-1/2">
                      <EmojiPickerButton onPick={(e) => overlayCtaEmoji.insert(e, editingOverlay.ctaText, (v) => setEditingOverlay({ ...editingOverlay, ctaText: v }))} placement="up" />
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] text-slate-400">Action On Click</label>
                  <select
                    value={editingOverlay.ctaAction}
                    onChange={(e) => setEditingOverlay({ ...editingOverlay, ctaAction: e.target.value as OverlayCtaAction })}
                    className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-xs text-white focus:border-blue-500 focus:outline-none"
                  >
                    <option value="open_bot">Open Conversational Bot</option>
                    <option value="open_url">Redirect to URL</option>
                    <option value="copy_code">Copy Voucher Code</option>
                    <option value="enter_contest">Enter Contest / Giveaway</option>
                    <option value="take_survey">Take Survey</option>
                  </select>
                </div>
              </div>

              {editingOverlay.ctaAction === 'open_url' && (
                <div className="space-y-1.5 pt-1">
                  <label className="text-[11px] text-slate-400">Destination Redirect URL</label>
                  <input
                    type="url"
                    value={editingOverlay.redirectUrl || ''}
                    onChange={(e) => setEditingOverlay({ ...editingOverlay, redirectUrl: e.target.value })}
                    placeholder="https://..."
                    className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-xs text-white focus:border-blue-500 focus:outline-none"
                  />
                </div>
              )}

              {editingOverlay.ctaAction === 'take_survey' && (
                <div className="space-y-2 pt-1">
                  <label className="text-[11px] text-slate-400 flex items-center gap-1.5">
                    <ClipboardList className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Survey to Show</span>
                  </label>
                  <select
                    value={editingOverlay.surveyId || ''}
                    onChange={(e) => {
                      const survey = surveyOptions.find(s => s.id === e.target.value);
                      setEditingOverlay({
                        ...editingOverlay,
                        surveyId: survey?.id || '',
                        surveyName: survey?.title || ''
                      });
                    }}
                    className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-xs text-white focus:border-cyan-500 focus:outline-none"
                  >
                    <option value="">Select a survey...</option>
                    {surveyOptions.filter(s => s.status === 'active').map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.title} ({s.questions.length} questions)
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-500 flex items-start gap-1.5">
                    <span>The survey opens inside the popup or slide in, and each answer lands in the contact variables you named in the survey builder.</span>
                  </p>
                  {surveyOptions.filter(s => s.status === 'active').length === 0 && (
                    <p className="text-[11px] text-amber-300">No active surveys yet. Build one in Growth Suite → Surveys and set it to Active.</p>
                  )}
                </div>
              )}
              {editingOverlay.ctaAction === 'enter_contest' && (
                <div className="space-y-2 pt-1">
                  <label className="text-[11px] text-slate-400 flex items-center gap-1.5">
                    <Trophy className="w-3.5 h-3.5 text-amber-400" />
                    <span>Contest to Enter</span>
                  </label>
                  <select
                    value={editingOverlay.contestId || ''}
                    onChange={(e) => {
                      const contest = STUB_CONTESTS.find(c => c.id === e.target.value);
                      setEditingOverlay({
                        ...editingOverlay,
                        contestId: contest?.id || '',
                        contestName: contest?.name || ''
                      });
                    }}
                    className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-xs text-white focus:border-amber-500 focus:outline-none"
                  >
                    <option value="">Select a contest...</option>
                    {STUB_CONTESTS.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} — {c.status === 'active' ? `${c.entriesCount.toLocaleString()} entries` : c.status}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-500 flex items-start gap-1.5">
                    <Gift className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-slate-500" />
                    <span>Stub list — real contests from the Contests module will appear here. Entering is the capture event: the entrant feeds referral tracking and the leaderboard.</span>
                  </p>
                </div>
              )}
            </div>

            {/* Colors & Appearance */}
            <div className="space-y-3 p-4 rounded-xl bg-slate-950/60 border border-white/5">
              <div className="flex items-center gap-2 text-xs font-bold text-white">
                <Palette className="w-4 h-4 text-blue-400" />
                <span>Colors &amp; Theme</span>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {COLOR_PRESETS.map((color) => (
                  <button
                    key={color.hex}
                    type="button"
                    onClick={() => setEditingOverlay({ ...editingOverlay, brandColor: color.hex })}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2 border transition-all cursor-pointer ${
                      editingOverlay.brandColor === color.hex 
                        ? 'border-white text-white font-bold bg-white/10' 
                        : 'border-white/10 text-slate-400 hover:border-white/20'
                    }`}
                  >
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: color.hex }} />
                    <span>{color.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Save Buttons */}
            <div className="pt-4 border-t border-white/10 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setEditingOverlay(null);
                  setActiveMode('list');
                }}
                className="px-4 py-2 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => handleSave(editingOverlay)}
                disabled={saving}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-wait"
              >
                <Check className="w-4 h-4" />
                <span>{saving ? 'Saving…' : 'Save Overlay'}</span>
              </button>
            </div>

          </div>

          {/* Right Column: Live Mockup Preview (5 cols) */}
          <div className="lg:col-span-5 sticky top-6 space-y-4">
            <div className="flex items-center justify-between text-xs text-slate-400 px-1">
              <span>Live Visual Mockup</span>
              <span className="text-[11px] text-blue-400 font-mono capitalize">{editingOverlay.type.replace('_', ' ')}</span>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-950 overflow-hidden shadow-2xl relative min-h-[520px] flex flex-col justify-between p-4">
              
              {/* Fake Background */}
              <div className="space-y-3 opacity-20 select-none pointer-events-none">
                <div className="h-4 w-32 bg-slate-700 rounded-full" />
                <div className="h-8 w-64 bg-slate-800 rounded-lg" />
                <div className="h-24 w-full bg-slate-900 rounded-xl" />
              </div>

              {/* Overlay Render in mockup */}
              {editingOverlay.type === 'popup_modal' && (
                <div className="my-auto mx-auto w-full max-w-sm rounded-2xl bg-slate-900 border border-white/15 p-5 shadow-2xl space-y-3 z-10 text-center animate-in zoom-in-95 duration-200">
                  {editingOverlay.badgeText && (
                    <span 
                      className="text-[10px] font-bold px-2.5 py-1 rounded-full border inline-block"
                      style={{ backgroundColor: `${editingOverlay.brandColor}20`, color: editingOverlay.brandColor, borderColor: `${editingOverlay.brandColor}40` }}
                    >
                      {editingOverlay.badgeText}
                    </span>
                  )}
                  <h4 className="text-base font-bold text-white">{editingOverlay.headline}</h4>
                  <p className="text-xs text-slate-300">{editingOverlay.subheadline}</p>
                  
                  {editingOverlay.offerCode && (
                    <div className="p-2 rounded-xl bg-slate-950 border border-dashed border-white/20 font-mono text-xs text-amber-300">
                      Use code: <span className="font-bold">{editingOverlay.offerCode}</span>
                    </div>
                  )}

                  <button 
                    className="w-full py-2.5 px-4 rounded-xl font-bold text-xs text-white shadow-lg cursor-pointer"
                    style={{ backgroundColor: editingOverlay.brandColor }}
                  >
                    <CtaLabel overlay={editingOverlay} />
                  </button>
                </div>
              )}

              {editingOverlay.type === 'slider' && (
                <div className="ml-auto w-full max-w-xs rounded-2xl bg-slate-900 border border-white/15 p-4 shadow-2xl space-y-3 z-10">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white/10 text-slate-200">
                      {editingOverlay.badgeText || 'Special Offer'}
                    </span>
                    <span className="text-xs text-slate-500">✕</span>
                  </div>
                  <h4 className="text-sm font-bold text-white">{editingOverlay.headline}</h4>
                  <p className="text-xs text-slate-300">{editingOverlay.subheadline}</p>
                  <button 
                    className="w-full py-2 px-3 rounded-xl font-bold text-xs text-white shadow-md cursor-pointer"
                    style={{ backgroundColor: editingOverlay.brandColor }}
                  >
                    <CtaLabel overlay={editingOverlay} />
                  </button>
                </div>
              )}

              {editingOverlay.type === 'sticky_bar' && (
                <div 
                  className="w-full rounded-xl p-3 flex items-center justify-between gap-3 text-white shadow-xl z-10"
                  style={{ backgroundColor: editingOverlay.brandColor }}
                >
                  <div className="min-w-0">
                    <p className="text-xs font-bold truncate">{editingOverlay.headline}</p>
                  </div>
                  <button className="px-3 py-1.5 rounded-lg bg-slate-950 text-white font-bold text-xs flex-shrink-0 cursor-pointer">
                    <CtaLabel overlay={editingOverlay} />
                  </button>
                </div>
              )}

              {editingOverlay.type === 'page_takeover' && (
                <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-xl flex flex-col items-center justify-center p-6 text-center space-y-4 z-20">
                  {editingOverlay.badgeText && (
                    <span 
                      className="text-xs font-bold px-3 py-1 rounded-full border inline-block"
                      style={{ backgroundColor: `${editingOverlay.brandColor}20`, color: editingOverlay.brandColor, borderColor: `${editingOverlay.brandColor}40` }}
                    >
                      {editingOverlay.badgeText}
                    </span>
                  )}
                  <h3 className="text-xl font-bold text-white max-w-md">{editingOverlay.headline}</h3>
                  <p className="text-xs text-slate-300 max-w-sm">{editingOverlay.subheadline}</p>
                  <button 
                    className="py-2.5 px-6 rounded-xl font-bold text-xs text-white shadow-xl cursor-pointer"
                    style={{ backgroundColor: editingOverlay.brandColor }}
                  >
                    <CtaLabel overlay={editingOverlay} />
                  </button>
                </div>
              )}

            </div>
          </div>

        </div>
      )}

      {/* =========================================================================
          MODE 3: INTERACTIVE SIMULATOR (TEST EXIT INTENT / SCROLL TRIGGERS)
          ========================================================================= */}
      {activeMode === 'preview' && currentOverlay && (
        <div className="space-y-4">
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 bg-slate-900 border border-white/10 rounded-2xl">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-xs text-slate-400">Testing Overlay:</span>
              <span className="text-xs font-bold text-white">{currentOverlay.name}</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-300 font-mono">
                Desktop: {currentOverlay.triggerType.replace('_', ' ')}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-300 font-mono">
                {describeMobileTrigger(currentOverlay)}
              </span>
            </div>

            {/* Trigger Simulation Controls */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Device toggle — shows which trigger fires per device */}
              <div className="flex rounded-xl overflow-hidden border border-white/10">
                <button
                  onClick={() => setSimDevice('desktop')}
                  className={`px-3 py-1.5 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
                    simDevice === 'desktop' ? 'bg-cyan-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-white'
                  }`}
                >
                  <Monitor className="w-3.5 h-3.5" />
                  <span>Desktop</span>
                </button>
                <button
                  onClick={() => setSimDevice('mobile')}
                  className={`px-3 py-1.5 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
                    simDevice === 'mobile' ? 'bg-violet-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-white'
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>Mobile</span>
                </button>
              </div>

              {simDevice === 'desktop' && (
              <button
                onClick={() => {
                  setSimOverlayActive(false);
                  setSimLeadSubmitted(false);
                  setSimTriggerStatus('Simulating mouse leaving browser window...');
                  setTimeout(() => {
                    setSimOverlayActive(true);
                    setSimTriggerStatus('Exit-intent triggered: cursor exited browser!');
                  }, 400);
                }}
                className="px-3 py-1.5 rounded-xl bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/30 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <MousePointer className="w-3.5 h-3.5" />
                <span>Simulate Exit Intent</span>
              </button>
              )}

              {simDevice === 'mobile' && (
                <span className="text-[11px] text-violet-300 bg-violet-500/10 border border-violet-500/20 rounded-xl px-3 py-1.5">
                  No cursor on mobile — firing on: {simEffTrigger.replace('_', ' ')}
                </span>
              )}

              <button
                onClick={() => {
                  setSimOverlayActive(false);
                  setSimLeadSubmitted(false);
                  setSimTriggerStatus(`Simulating visitor scrolling down ${simEffScroll}%...`);
                  setTimeout(() => {
                    setSimOverlayActive(true);
                    setSimTriggerStatus(`Scroll depth reached: ${simEffScroll}% down page!`);
                  }, 500);
                }}
                className="px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Simulate {simEffScroll}% Scroll</span>
              </button>

              <button
                onClick={() => {
                  setSimOverlayActive(false);
                  setSimLeadSubmitted(false);
                  setSimTriggerStatus(`Simulating ${simEffDelay}s page view delay...`);
                  setTimeout(() => {
                    setSimOverlayActive(true);
                    setSimTriggerStatus(`Time delay reached: ${simEffDelay}s elapsed!`);
                  }, 1200);
                }}
                className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Simulate Delay</span>
              </button>

              <button
                onClick={() => setEmbedModalOverlay(currentOverlay)}
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Code className="w-3.5 h-3.5" />
                <span>Embed</span>
              </button>
            </div>
          </div>

          {/* Trigger Status indicator pill */}
          {simTriggerStatus && (
            <div className="flex items-center justify-between px-4 py-2 rounded-xl bg-slate-900 border border-white/10 text-xs text-slate-300">
              <span className="font-mono text-cyan-400">{simTriggerStatus}</span>
              <button 
                onClick={() => setSimTriggerStatus(null)}
                className="text-slate-500 hover:text-white"
              >
                ✕
              </button>
            </div>
          )}

          {/* Interactive Mockup Container */}
          <div className="rounded-2xl border border-white/10 bg-slate-950 overflow-hidden shadow-2xl min-h-[560px] relative flex flex-col justify-center items-center p-6">
            
            {/* Fake Page Content */}
            <div className="max-w-xl w-full space-y-4 opacity-30 select-none pointer-events-none">
              <div className="h-6 w-48 bg-slate-700 rounded-full" />
              <div className="h-12 w-full bg-slate-800 rounded-xl" />
              <div className="h-32 w-full bg-slate-900 rounded-2xl" />
              <div className="grid grid-cols-2 gap-4">
                <div className="h-24 bg-slate-900 rounded-xl" />
                <div className="h-24 bg-slate-900 rounded-xl" />
              </div>
            </div>

            {/* If Overlay is hidden in simulator, show trigger prompt */}
            {!simOverlayActive && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center space-y-3 z-10 bg-slate-950/40">
                <div className="w-12 h-12 rounded-full bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <Zap className="w-6 h-6 animate-pulse" />
                </div>
                <h3 className="text-base font-bold text-white">Overlay is Waiting for Trigger</h3>
                <p className="text-xs text-slate-400 max-w-sm">Click one of the trigger simulation buttons above to preview how this overlay fires on your visitors.</p>
                <button
                  onClick={() => setSimOverlayActive(true)}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs cursor-pointer shadow-lg shadow-blue-500/20"
                >
                  Show Overlay Now
                </button>
              </div>
            )}

            {/* Rendered Overlay Simulator */}
            {simOverlayActive && (
              <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-30 animate-in fade-in zoom-in-95 duration-200">
                <div className="w-full max-w-md bg-slate-900 border border-white/15 rounded-2xl p-6 shadow-2xl relative space-y-4 text-center">
                  
                  <button
                    onClick={() => setSimOverlayActive(false)}
                    className="absolute top-4 right-4 text-slate-400 hover:text-white p-1"
                    title="Dismiss Overlay"
                  >
                    ✕
                  </button>

                  {currentOverlay.badgeText && (
                    <span 
                      className="text-[11px] font-bold px-3 py-1 rounded-full border inline-block"
                      style={{ backgroundColor: `${currentOverlay.brandColor}20`, color: currentOverlay.brandColor, borderColor: `${currentOverlay.brandColor}40` }}
                    >
                      {currentOverlay.badgeText}
                    </span>
                  )}

                  <h3 className="text-xl font-bold text-white">{currentOverlay.headline}</h3>
                  <p className="text-xs text-slate-300">{currentOverlay.subheadline}</p>

                  {currentOverlay.offerCode && (
                    <div className="p-3 rounded-xl bg-slate-950 border border-dashed border-white/20 font-mono text-sm text-amber-300">
                      Promo Code: <span className="font-bold">{currentOverlay.offerCode}</span>
                    </div>
                  )}

                  {simLeadSubmitted ? (
                    <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-bold space-y-1">
                      <CheckCircle2 className="w-6 h-6 mx-auto mb-1 text-emerald-400" />
                      <span>{currentOverlay.ctaAction === 'enter_contest' ? "🎉 You're entered! Contest entry recorded." : '🎉 Offer Claimed! Lead recorded in CRM.'}</span>
                    </div>
                  ) : (
                    <div className="space-y-2 pt-2">
                      {currentOverlay.requireEmailCapture && (
                        <input
                          type="email"
                          name="email"
                          autoComplete="email"
                          inputMode="email"
                          value={simEmail}
                          onChange={(e) => setSimEmail(e.target.value)}
                          placeholder="Enter your email to claim..."
                          className="w-full px-3.5 py-2.5 bg-slate-950 border border-white/10 rounded-xl text-xs text-white focus:border-blue-500 focus:outline-none text-center"
                        />
                      )}

                      <button
                        onClick={() => {
                          setSimLeadSubmitted(true);
                          const emailUsed = simEmail.trim() || 'visitor@example.com';
                          setLeadCapturedNotice(`Lead captured via ${currentOverlay.name} (${emailUsed})`);
                          setTimeout(() => setLeadCapturedNotice(null), 4000);
                          // Preview only: stats come from the live snippet via
                          // /__overlay/track, so nothing is written here.
                        }}
                        className="w-full py-3 px-4 rounded-xl font-bold text-xs text-white shadow-xl cursor-pointer hover:opacity-95 transition-opacity"
                        style={{ backgroundColor: currentOverlay.brandColor }}
                      >
                        <CtaLabel overlay={currentOverlay} />
                      </button>
                    </div>
                  )}

                </div>
              </div>
            )}

          </div>

        </div>
      )}

      {/* =========================================================================
          EMBED CODE MODAL
          ========================================================================= */}
      {embedModalOverlay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-xl bg-slate-900 border border-white/10 rounded-2xl p-6 shadow-2xl space-y-5">
            
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                  <Code className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Embed Website Overlay</h3>
                  <p className="text-xs text-slate-400">Add this script before the closing &lt;/body&gt; tag of your site or funnel.</p>
                </div>
              </div>

              <button
                onClick={() => setEmbedModalOverlay(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="relative">
              <pre className="p-4 rounded-xl bg-slate-950 border border-white/10 text-xs font-mono text-blue-300 overflow-x-auto whitespace-pre">
                {getEmbedCode(embedModalOverlay)}
              </pre>

              <button
                onClick={() => {
                  navigator.clipboard.writeText(getEmbedCode(embedModalOverlay));
                  setCopiedEmbed(true);
                  setTimeout(() => setCopiedEmbed(false), 2000);
                }}
                className="absolute top-3 right-3 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
              >
                {copiedEmbed ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedEmbed ? 'Copied!' : 'Copy Snippet'}</span>
              </button>
            </div>

            <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-slate-300">
              <span className="font-bold text-blue-300 block mb-1">One snippet, every overlay:</span>
              <p className="text-slate-400">
                Paste it once before the closing <span className="font-mono">&lt;/body&gt;</span> tag.
                It serves <span className="font-bold text-slate-200">all active overlays</span> in this
                workspace — publish a change here and it goes live on your site within seconds,
                no re-paste needed. Only <span className="font-mono text-cyan-300">active</span> overlays render.
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setEmbedModalOverlay(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-all cursor-pointer"
              >
                Done
              </button>
            </div>

          </div>
        </div>
      )}

      {limitModalOpen && (
        <UpgradePromptModal
          resourceName="capture tool"
          limit={captureToolLimit}
          unit="per workspace"
          onClose={() => setLimitModalOpen(false)}
        />
      )}

    </div>
  );
};
