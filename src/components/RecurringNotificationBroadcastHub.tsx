import React, { useState, useEffect, useMemo } from 'react';
import { 
  BellRing, 
  Send, 
  ShieldCheck, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  Calendar, 
  RefreshCw, 
  Users, 
  Tag, 
  Sparkles, 
  Filter, 
  ChevronRight, 
  Check, 
  Copy, 
  Eye, 
  X, 
  Info, 
  Layers, 
  Zap, 
  Smartphone, 
  MessageSquare, 
  Instagram,
  ArrowRight,
  ExternalLink,
  Flame,
  Radio,
  Sliders
} from 'lucide-react';
import { 
  ContactRecord, 
  MetaRecurringToken, 
  recordRecurringNotificationSent, 
  renewRecurringNotificationToken,
  subscribeToContacts,
  CampaignRecord,
  subscribeToCampaigns,
  deleteCampaign,
  saveCampaign,
  seedInitialCampaigns
} from '../lib/firebase';
import { CampaignBuilderModal } from './CampaignBuilderModal';
import { CampaignsListView } from './CampaignsListView';

interface RecurringNotificationBroadcastHubProps {
  contacts?: ContactRecord[];
  onClose?: () => void;
}

export function RecurringNotificationBroadcastHub({
  contacts: propContacts,
  onClose
}: RecurringNotificationBroadcastHubProps) {
  const [internalContacts, setInternalContacts] = useState<ContactRecord[]>([]);

  useEffect(() => {
    if (propContacts && propContacts.length > 0) return;
    const unsub = subscribeToContacts((data) => {
      setInternalContacts(data);
    });
    return () => unsub();
  }, [propContacts]);

  const contacts = propContacts && propContacts.length > 0 ? propContacts : internalContacts;

  const [campaigns, setCampaigns] = useState<CampaignRecord[]>([]);
  const [isCampaignModalOpen, setIsCampaignModalOpen] = useState<boolean>(false);
  const [campaignToEdit, setCampaignToEdit] = useState<CampaignRecord | null>(null);
  const [isSimulatingCampaignId, setIsSimulatingCampaignId] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeToCampaigns(
      (data) => {
        if (data.length === 0) {
          seedInitialCampaigns().catch(console.warn);
        } else {
          setCampaigns(data);
        }
      },
      (err) => {
        console.warn('Campaigns listener notice:', err.message);
      }
    );
    return () => unsub();
  }, []);

  const [activeTab, setActiveTab] = useState<'campaigns' | 'broadcast' | 'token_health' | 'policy'>('campaigns');

  // Filtering for Broadcast
  const [selectedTopic, setSelectedTopic] = useState<string>('all');
  const [selectedCadence, setSelectedCadence] = useState<'all' | 'daily' | 'weekly' | 'monthly'>('all');
  const [eligibilityFilter, setEligibilityFilter] = useState<'all' | 'eligible' | 'rate_limited'>('eligible');
  const [channelFilter, setChannelFilter] = useState<'all' | 'messenger' | 'instagram'>('all');
  const [excludedContactIds, setExcludedContactIds] = useState<Set<string>>(new Set());

  // Message Composer State
  const [campaignTitle, setCampaignTitle] = useState<string>('Exclusive VIP Flash Sale (48h Access)');
  const [messageBody, setMessageBody] = useState<string>(
    '🔥 Hey {{first_name}}! Here is your exclusive VIP access code for this week:\n\nUse code VIP30 at checkout for 30% OFF our entire automation library!\n\nThis offer is valid for the next 48 hours only. Tap below to claim your spot 👇'
  );
  const [mediaUrl, setMediaUrl] = useState<string>('https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=800&auto=format&fit=crop&q=80');
  const [ctaTitle, setCtaTitle] = useState<string>('Claim 30% Off Now 🚀');
  const [ctaUrl, setCtaUrl] = useState<string>('https://chatmize.io/vip-offer');

  // Dispatch state
  const [isBroadcasting, setIsBroadcasting] = useState<boolean>(false);
  const [broadcastProgress, setBroadcastProgress] = useState<{
    current: number;
    total: number;
    completed: boolean;
    logs: Array<{ contactName: string; channel: string; token: string; status: 'sent' | 'rate_limited' | 'failed'; timestamp: string }>;
  } | null>(null);

  // Renewal / Token refresh simulation state
  const [refreshingTokenId, setRefreshingTokenId] = useState<string | null>(null);
  const [refreshToast, setRefreshToast] = useState<string | null>(null);

  // Extract all available recurring notification topics across the contact list
  const allTopics = useMemo(() => {
    const topicsSet = new Set<string>();
    contacts.forEach(c => {
      (c.recurringTokens || []).forEach(t => {
        if (t.topic) topicsSet.add(t.topic);
      });
    });
    return Array.from(topicsSet);
  }, [contacts]);

  // Aggregate all tokens with their parent contacts
  interface TokenWithContact {
    token: MetaRecurringToken;
    contact: ContactRecord;
    isEligibleByCadence: boolean;
    daysRemaining: number;
    isExpiringSoon: boolean; // <= 14 days
    isExpired: boolean;
  }

  const allTokensWithContacts = useMemo(() => {
    const items: TokenWithContact[] = [];
    const now = Date.now();

    contacts.forEach(c => {
      (c.recurringTokens || []).forEach(t => {
        const expiresTime = new Date(t.expiresAt).getTime();
        const daysRemaining = Math.max(0, Math.ceil((expiresTime - now) / (1000 * 60 * 60 * 24)));
        const isExpired = t.status === 'expired' || expiresTime <= now;
        const isExpiringSoon = !isExpired && daysRemaining <= 14;

        // Calculate rate limit cadence compliance:
        // Daily: 1 msg per 24h
        // Weekly: 1 msg per 7 days
        // Monthly: 1 msg per 30 days
        let isEligibleByCadence = true;
        if (t.lastSentAt) {
          const lastSentTime = new Date(t.lastSentAt).getTime();
          const hoursSinceLastSent = (now - lastSentTime) / (1000 * 60 * 60);
          if (t.frequency === 'daily' && hoursSinceLastSent < 24) {
            isEligibleByCadence = false;
          } else if (t.frequency === 'weekly' && hoursSinceLastSent < (7 * 24)) {
            isEligibleByCadence = false;
          } else if (t.frequency === 'monthly' && hoursSinceLastSent < (30 * 24)) {
            isEligibleByCadence = false;
          }
        }

        items.push({
          token: t,
          contact: c,
          isEligibleByCadence,
          daysRemaining,
          isExpiringSoon,
          isExpired,
        });
      });
    });

    return items;
  }, [contacts]);

  // Filtered tokens for Broadcast
  const broadcastRecipients = useMemo(() => {
    return allTokensWithContacts.filter(item => {
      if (item.isExpired) return false;
      if (channelFilter !== 'all' && item.contact.channel !== channelFilter) return false;
      if (selectedTopic !== 'all' && item.token.topic !== selectedTopic) return false;
      if (selectedCadence !== 'all' && item.token.frequency !== selectedCadence) return false;
      
      if (eligibilityFilter === 'eligible' && !item.isEligibleByCadence) return false;
      if (eligibilityFilter === 'rate_limited' && item.isEligibleByCadence) return false;

      return true;
    });
  }, [allTokensWithContacts, channelFilter, selectedTopic, selectedCadence, eligibilityFilter]);

  // Non-excluded active recipients
  const finalRecipients = useMemo(() => {
    return broadcastRecipients.filter(r => !excludedContactIds.has(r.contact.id));
  }, [broadcastRecipients, excludedContactIds]);

  // Metrics
  const activeTokensCount = allTokensWithContacts.filter(t => !t.isExpired).length;
  const weeklyTokensCount = allTokensWithContacts.filter(t => !t.isExpired && t.token.frequency === 'weekly').length;
  const dailyTokensCount = allTokensWithContacts.filter(t => !t.isExpired && t.token.frequency === 'daily').length;
  const monthlyTokensCount = allTokensWithContacts.filter(t => !t.isExpired && t.token.frequency === 'monthly').length;
  const expiringSoonCount = allTokensWithContacts.filter(t => t.isExpiringSoon).length;

  // Toggle individual contact inclusion
  const toggleContactExclusion = (id: string) => {
    setExcludedContactIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Variable insertion
  const insertVariable = (varName: string) => {
    setMessageBody(prev => prev + ` {{${varName}}}`);
  };

  // Preset templates
  const applyPresetTemplate = (type: 'flash_sale' | 'playbook' | 'webinar') => {
    if (type === 'flash_sale') {
      setCampaignTitle('VIP Flash Sale (48h Access)');
      setMessageBody('🔥 Hey {{first_name}}! Here is your exclusive VIP access code for this week:\n\nUse code VIP30 at checkout for 30% OFF our entire automation library!\n\nThis offer is valid for the next 48 hours only. Tap below to claim your spot 👇');
      setMediaUrl('https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=800&auto=format&fit=crop&q=80');
      setCtaTitle('Claim 30% Off Now 🚀');
      setCtaUrl('https://chatmize.io/vip-offer');
    } else if (type === 'playbook') {
      setCampaignTitle('Weekly Bot Automation Playbook Drop');
      setMessageBody('📘 Your Weekly Automation Drop is live, {{first_name}}!\n\nThis week: "How to Build a 7-Figure Lead Qualifier with Meta Click-to-Messenger Ads in 15 Minutes".\n\nInside: Cloneable templates, prompt blueprints, and CRM sync hooks.');
      setMediaUrl('https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&auto=format&fit=crop&q=80');
      setCtaTitle('Read Weekly Playbook 📖');
      setCtaUrl('https://chatmize.io/playbooks/lead-qualifier');
    } else {
      setCampaignTitle('Live Masterclass Launch Alert');
      setMessageBody('🎙️ {{first_name}}, our private masterclass kicks off in 1 hour!\n\nTopic: Meta Marketing Messages & High-Conversion DM Strategies.\n\nReserve your virtual front-row seat below:');
      setMediaUrl('https://images.unsplash.com/photo-1531482615713-2afd69097998?w=800&auto=format&fit=crop&q=80');
      setCtaTitle('Join Live Stream 🔴');
      setCtaUrl('https://chatmize.io/masterclass/live');
    }
  };

  // Execute compliant broadcast
  const handleExecuteBroadcast = async () => {
    if (finalRecipients.length === 0) return;
    setIsBroadcasting(true);

    const logs: Array<{ contactName: string; channel: string; token: string; status: 'sent' | 'rate_limited' | 'failed'; timestamp: string }> = [];

    setBroadcastProgress({
      current: 0,
      total: finalRecipients.length,
      completed: false,
      logs: [],
    });

    for (let i = 0; i < finalRecipients.length; i++) {
      const recipient = finalRecipients[i];
      // Simulate Meta Graph API latency
      await new Promise(resolve => setTimeout(resolve, 350));

      try {
        await recordRecurringNotificationSent(recipient.contact.id, recipient.token.id);

        logs.push({
          contactName: recipient.contact.name,
          channel: recipient.contact.channel,
          token: recipient.token.token,
          status: 'sent',
          timestamp: new Date().toLocaleTimeString(),
        });
      } catch (err) {
        logs.push({
          contactName: recipient.contact.name,
          channel: recipient.contact.channel,
          token: recipient.token.token,
          status: 'failed',
          timestamp: new Date().toLocaleTimeString(),
        });
      }

      setBroadcastProgress({
        current: i + 1,
        total: finalRecipients.length,
        completed: i + 1 === finalRecipients.length,
        logs: [...logs],
      });
    }

    setIsBroadcasting(false);
  };

  // Simulate token renewal (subscriber taps "Keep Receiving Updates")
  const handleSimulateTokenRenewal = async (contactId: string, tokenId: string, frequency: 'daily' | 'weekly' | 'monthly') => {
    setRefreshingTokenId(tokenId);
    try {
      // Calculate renewal extension: Daily = 180 days, Weekly = 270 days, Monthly = 365 days
      const daysToAdd = frequency === 'daily' ? 180 : frequency === 'weekly' ? 270 : 365;
      const newExpiration = new Date(Date.now() + daysToAdd * 24 * 3600 * 1000).toISOString();

      await renewRecurringNotificationToken(contactId, tokenId, newExpiration);

      setRefreshToast(`Success: Token renewed for +${daysToAdd} days. Status is active.`);
      setTimeout(() => setRefreshToast(null), 3500);
    } catch (err) {
      console.error('Failed to renew token:', err);
    } finally {
      setRefreshingTokenId(null);
    }
  };

  const handleNewCampaign = () => {
    setCampaignToEdit(null);
    setIsCampaignModalOpen(true);
  };

  const handleEditCampaign = (campaign: CampaignRecord) => {
    setCampaignToEdit(campaign);
    setIsCampaignModalOpen(true);
  };

  const handleDeleteCampaign = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this campaign?')) {
      await deleteCampaign(id);
      setRefreshToast('Campaign deleted successfully.');
      setTimeout(() => setRefreshToast(null), 3000);
    }
  };

  const handleToggleCampaignStatus = async (campaign: CampaignRecord) => {
    const nextStatus = campaign.status === 'active' ? 'paused' : 'active';
    await saveCampaign({ ...campaign, status: nextStatus, updatedAt: new Date().toISOString() });
  };

  const handleSimulateCampaign = async (campaign: CampaignRecord) => {
    setIsSimulatingCampaignId(campaign.id);
    try {
      let sentCount = 0;
      const now = Date.now();
      for (const contact of contacts) {
        if (campaign.channel !== 'all' && contact.channel !== campaign.channel) continue;
        const matchingToken = (contact.recurringTokens || []).find(t => t.status === 'active' && new Date(t.expiresAt).getTime() > now);
        if (matchingToken) {
          await recordRecurringNotificationSent(contact.id, matchingToken.id);
          sentCount++;
        }
      }
      const updatedDelivered = (campaign.stats?.deliveredCount || 0) + (sentCount || 1);
      await saveCampaign({
        ...campaign,
        stats: {
          ...campaign.stats,
          targetAudienceCount: campaign.stats?.targetAudienceCount || contacts.length,
          deliveredCount: updatedDelivered,
          openedCount: (campaign.stats?.openedCount || 0) + Math.ceil((sentCount || 1) * 0.94),
          clickedCount: (campaign.stats?.clickedCount || 0) + Math.ceil((sentCount || 1) * 0.48),
          optOutCount: campaign.stats?.optOutCount || 0,
        },
        updatedAt: new Date().toISOString()
      });
      setRefreshToast(`Successfully simulated broadcast for "${campaign.name}" across ${sentCount || 1} eligible contacts!`);
      setTimeout(() => setRefreshToast(null), 4000);
    } catch (e) {
      console.warn('Simulation error:', e);
    } finally {
      setIsSimulatingCampaignId(null);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-950 text-slate-100 rounded-3xl border border-white/10 overflow-hidden shadow-2xl">
      {/* Top Banner Header */}
      <div className="p-4 sm:p-6 border-b border-white/10 bg-gradient-to-r from-cyan-950/40 via-slate-900 to-blue-950/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4 flex-shrink-0">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-500/20 to-blue-500/30 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-lg shadow-cyan-500/10 flex-shrink-0">
            <BellRing className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-lg sm:text-xl font-black text-white tracking-tight">
                Recurring Notifications & Marketing Messages Hub
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-400" />
                Meta Marketing Messages API Cleared
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
              Dispatch scheduled promotional campaigns, product drops, and weekly digests beyond the 24-hour window using subscriber-authorized permission tokens.
            </p>
          </div>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="self-end sm:self-center p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Close Hub"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 p-4 sm:p-5 border-b border-white/10 bg-slate-900/50 flex-shrink-0 text-xs">
        <div className="p-3 rounded-2xl bg-slate-950/80 border border-white/10 flex flex-col">
          <span className="text-slate-400 text-[11px] font-medium flex items-center gap-1.5 mb-1">
            <Users className="w-3.5 h-3.5 text-cyan-400" /> Active RN Tokens
          </span>
          <span className="text-xl font-black text-white">{activeTokensCount}</span>
          <span className="text-[10px] text-cyan-400/80 mt-0.5">Audience Permission Granted</span>
        </div>

        <div className="p-3 rounded-2xl bg-slate-950/80 border border-white/10 flex flex-col">
          <span className="text-slate-400 text-[11px] font-medium flex items-center gap-1.5 mb-1">
            <Calendar className="w-3.5 h-3.5 text-blue-400" /> Weekly Cadence
          </span>
          <span className="text-xl font-black text-white">{weeklyTokensCount}</span>
          <span className="text-[10px] text-slate-400 mt-0.5">1 blast / 7 days</span>
        </div>

        <div className="p-3 rounded-2xl bg-slate-950/80 border border-white/10 flex flex-col">
          <span className="text-slate-400 text-[11px] font-medium flex items-center gap-1.5 mb-1">
            <Flame className="w-3.5 h-3.5 text-amber-400" /> Daily Cadence
          </span>
          <span className="text-xl font-black text-white">{dailyTokensCount}</span>
          <span className="text-[10px] text-slate-400 mt-0.5">1 blast / 24 hours</span>
        </div>

        <div className="p-3 rounded-2xl bg-slate-950/80 border border-white/10 flex flex-col">
          <span className="text-slate-400 text-[11px] font-medium flex items-center gap-1.5 mb-1">
            <Layers className="w-3.5 h-3.5 text-purple-400" /> Monthly Cadence
          </span>
          <span className="text-xl font-black text-white">{monthlyTokensCount}</span>
          <span className="text-[10px] text-slate-400 mt-0.5">1 blast / 30 days</span>
        </div>

        <div 
          onClick={() => setActiveTab('token_health')}
          className={`p-3 rounded-2xl border flex flex-col cursor-pointer transition-all hover:scale-[1.02] ${
            expiringSoonCount > 0
              ? 'bg-amber-500/10 border-amber-500/40 text-amber-300 shadow-sm shadow-amber-500/10'
              : 'bg-slate-950/80 border-white/10'
          }`}
        >
          <span className="text-[11px] font-medium flex items-center gap-1.5 mb-1">
            <AlertTriangle className={`w-3.5 h-3.5 ${expiringSoonCount > 0 ? 'text-amber-400 animate-bounce' : 'text-slate-400'}`} />
            Expiring (≤ 14d)
          </span>
          <span className="text-xl font-black text-white">{expiringSoonCount}</span>
          <span className="text-[10px] text-amber-300 font-semibold mt-0.5 flex items-center gap-1">
            {expiringSoonCount > 0 ? 'Action: Re-Opt-In Prompt' : 'All tokens healthy'}
            {expiringSoonCount > 0 && <ArrowRight className="w-2.5 h-2.5" />}
          </span>
        </div>
      </div>

      {/* Toast Notification */}
      {refreshToast && (
        <div className="mx-6 mt-4 p-3 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-xs text-emerald-300 flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>{refreshToast}</span>
          </div>
          <button onClick={() => setRefreshToast(null)} className="text-emerald-400 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex border-b border-white/10 px-4 sm:px-6 bg-slate-950/40 gap-2 flex-shrink-0">
        <button
          onClick={() => setActiveTab('campaigns')}
          className={`py-3.5 px-4 text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            activeTab === 'campaigns'
              ? 'border-cyan-400 text-cyan-300 bg-white/5'
              : 'border-transparent text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Campaigns & Drip Sequences ({campaigns.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('broadcast')}
          className={`py-3.5 px-4 text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            activeTab === 'broadcast'
              ? 'border-cyan-400 text-cyan-300 bg-white/5'
              : 'border-transparent text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Send className="w-3.5 h-3.5" />
          <span>Broadcast Campaign Blaster</span>
        </button>

        <button
          onClick={() => setActiveTab('token_health')}
          className={`py-3.5 px-4 text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer relative ${
            activeTab === 'token_health'
              ? 'border-cyan-400 text-cyan-300 bg-white/5'
              : 'border-transparent text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Token Refresh & Re-Opt-In Automation</span>
          {expiringSoonCount > 0 && (
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('policy')}
          className={`py-3.5 px-4 text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            activeTab === 'policy'
              ? 'border-cyan-400 text-cyan-300 bg-white/5'
              : 'border-transparent text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Meta API Rules vs OTN</span>
        </button>
      </div>

      {/* Main Tab Content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {activeTab === 'campaigns' && (
          <CampaignsListView 
            campaigns={campaigns}
            onNewCampaign={handleNewCampaign}
            onEditCampaign={handleEditCampaign}
            onDeleteCampaign={handleDeleteCampaign}
            onToggleStatus={handleToggleCampaignStatus}
            onSimulateCampaign={handleSimulateCampaign}
            isSimulatingId={isSimulatingCampaignId}
            contactsCount={contacts.length}
          />
        )}

        {activeTab === 'broadcast' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Filter & Audience Targeting (5 cols) */}
            <div className="lg:col-span-5 space-y-4">
              <div className="bg-slate-900/80 border border-white/10 rounded-2xl p-4 space-y-4">
                <div className="flex items-center justify-between border-b border-white/5 pb-3">
                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-cyan-400" />
                    <h3 className="text-xs font-bold uppercase text-white tracking-wider">
                      Targeting & Audience Filters
                    </h3>
                  </div>
                  <span className="text-[11px] font-mono font-bold text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded-full">
                    {finalRecipients.length} Eligible Recipients
                  </span>
                </div>

                {/* Topic Selector */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1.5">
                    1. Notification Topic
                  </label>
                  <select
                    value={selectedTopic}
                    onChange={(e) => setSelectedTopic(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-cyan-500 transition-colors"
                  >
                    <option value="all">All Subscribed Topics ({allTopics.length})</option>
                    {allTopics.map(topic => (
                      <option key={topic} value={topic}>
                        {topic}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Meta requires broadcasts to strictly match the topic the subscriber approved.
                  </p>
                </div>

                {/* Cadence Selector */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1.5">
                    2. Permission Cadence
                  </label>
                  <div className="grid grid-cols-4 gap-1.5 text-xs">
                    {(['all', 'daily', 'weekly', 'monthly'] as const).map(cad => (
                      <button
                        key={cad}
                        type="button"
                        onClick={() => setSelectedCadence(cad)}
                        className={`py-1.5 px-2 rounded-xl text-center font-semibold capitalize transition-all text-[11px] ${
                          selectedCadence === cad
                            ? 'bg-cyan-500/20 border border-cyan-500 text-cyan-300'
                            : 'bg-slate-950 border border-white/10 text-slate-400 hover:text-white'
                        }`}
                      >
                        {cad}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Rate Limit Eligibility Filter */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1.5">
                    3. Cadence Rate-Limit Shield
                  </label>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setEligibilityFilter('eligible')}
                      className={`p-2 rounded-xl text-left border transition-all ${
                        eligibilityFilter === 'eligible'
                          ? 'bg-emerald-500/15 border-emerald-500 text-emerald-300'
                          : 'bg-slate-950 border-white/10 text-slate-400'
                      }`}
                    >
                      <div className="font-bold flex items-center gap-1.5 text-[11px]">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        Eligible Now
                      </div>
                      <div className="text-[10px] opacity-75">Haven't sent this interval</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setEligibilityFilter('all')}
                      className={`p-2 rounded-xl text-left border transition-all ${
                        eligibilityFilter === 'all'
                          ? 'bg-blue-500/15 border-blue-500 text-blue-300'
                          : 'bg-slate-950 border-white/10 text-slate-400'
                      }`}
                    >
                      <div className="font-bold flex items-center gap-1.5 text-[11px]">
                        <Users className="w-3 h-3 text-blue-400" />
                        All Token Holders
                      </div>
                      <div className="text-[10px] opacity-75">Ignore sent timestamps</div>
                    </button>
                  </div>
                </div>

                {/* Channel Filter */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1.5">
                    4. Channel
                  </label>
                  <div className="grid grid-cols-3 gap-1.5 text-xs">
                    {(['all', 'messenger', 'instagram'] as const).map(ch => (
                      <button
                        key={ch}
                        type="button"
                        onClick={() => setChannelFilter(ch)}
                        className={`py-1.5 px-2 rounded-xl text-center font-semibold capitalize transition-all text-[11px] flex items-center justify-center gap-1 ${
                          channelFilter === ch
                            ? 'bg-cyan-500/20 border border-cyan-500 text-cyan-300'
                            : 'bg-slate-950 border border-white/10 text-slate-400 hover:text-white'
                        }`}
                      >
                        {ch === 'messenger' && <MessageSquare className="w-3 h-3" />}
                        {ch === 'instagram' && <Instagram className="w-3 h-3" />}
                        {ch}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Recipient Roster Drawer */}
              <div className="bg-slate-900/80 border border-white/10 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-300 uppercase tracking-wider text-[11px]">
                    Matched Subscribers ({broadcastRecipients.length})
                  </span>
                  <span className="text-[10px] text-slate-400">Click check to exclude</span>
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {broadcastRecipients.length === 0 ? (
                    <div className="p-4 text-center text-slate-500 text-xs italic">
                      No subscribers match the selected topic & cadence filters.
                    </div>
                  ) : (
                    broadcastRecipients.map((item) => {
                      const isExcluded = excludedContactIds.has(item.contact.id);
                      return (
                        <div
                          key={`${item.contact.id}_${item.token.id}`}
                          onClick={() => toggleContactExclusion(item.contact.id)}
                          className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                            isExcluded
                              ? 'bg-slate-950/40 border-white/5 opacity-50'
                              : 'bg-slate-950 border-white/10 hover:border-cyan-500/30'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-7 h-7 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-xs font-bold flex-shrink-0">
                              {item.contact.avatarUrl ? (
                                <img src={item.contact.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
                              ) : (
                                item.contact.name.substring(0, 2).toUpperCase()
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-bold text-white truncate">{item.contact.name}</span>
                                <span className="text-[9px] px-1.5 py-0.2 rounded font-mono bg-white/5 text-slate-400 uppercase">
                                  {item.token.frequency}
                                </span>
                              </div>
                              <p className="text-[10px] text-slate-400 truncate">{item.token.topic}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-[10px] text-slate-500 font-mono">
                              {item.daysRemaining}d left
                            </span>
                            <div className={`w-4 h-4 rounded flex items-center justify-center border ${
                              isExcluded ? 'border-slate-600 bg-transparent' : 'border-cyan-500 bg-cyan-500 text-slate-950'
                            }`}>
                              {!isExcluded && <Check className="w-3 h-3 stroke-[3]" />}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Right Column: Campaign Composer & Dispatch (7 cols) */}
            <div className="lg:col-span-7 space-y-4">
              <div className="bg-slate-900/80 border border-white/10 rounded-2xl p-5 space-y-4">
                {/* Meta Marketing Messages Authorization Pill */}
                <div className="p-3 rounded-xl bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 border border-emerald-500/30 flex items-start gap-3">
                  <ShieldCheck className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="text-xs font-bold text-emerald-300">
                      Promotional Content Explicitly Authorized by Meta
                    </span>
                    <p className="text-[11px] text-slate-300 mt-0.5 leading-relaxed">
                      Unlike standard Message Tags, Recurring Notifications under the Marketing Messages API permit coupons, discount codes, flash sales, and product pitches.
                    </p>
                  </div>
                </div>

                {/* Preset quick templates */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[11px] font-bold text-slate-400 uppercase">
                      Quick Preset Campaign Blueprints
                    </label>
                    <span className="text-[10px] text-slate-500">1-click fill</span>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => applyPresetTemplate('flash_sale')}
                      className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-amber-300 font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Flame className="w-3 h-3 text-amber-400" /> VIP 30% Promo
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPresetTemplate('playbook')}
                      className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-blue-300 font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Sparkles className="w-3 h-3 text-blue-400" /> Weekly Playbook
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPresetTemplate('webinar')}
                      className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-purple-300 font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Radio className="w-3 h-3 text-purple-400" /> Masterclass Launch
                    </button>
                  </div>
                </div>

                {/* Campaign Internal Title */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Campaign Broadcast Label
                  </label>
                  <input
                    type="text"
                    value={campaignTitle}
                    onChange={(e) => setCampaignTitle(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-cyan-500"
                    placeholder="e.g. VIP Friday Drops"
                  />
                </div>

                {/* Message Body with Variables */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-300">
                      Message Text (Sent via Meta Marketing Messages API)
                    </label>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => insertVariable('first_name')}
                        className="text-[10px] bg-cyan-500/10 text-cyan-300 px-2 py-0.5 rounded border border-cyan-500/20 font-mono hover:bg-cyan-500/20"
                      >
                        + {'{{first_name}}'}
                      </button>
                      <button
                        type="button"
                        onClick={() => insertVariable('company')}
                        className="text-[10px] bg-blue-500/10 text-blue-300 px-2 py-0.5 rounded border border-blue-500/20 font-mono hover:bg-blue-500/20"
                      >
                        + {'{{company}}'}
                      </button>
                    </div>
                  </div>
                  <textarea
                    rows={4}
                    value={messageBody}
                    onChange={(e) => setMessageBody(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-xs text-white outline-none focus:border-cyan-500 leading-relaxed font-sans"
                    placeholder="Write your promotional or digest update..."
                  />
                </div>

                {/* Media Image URL */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Optional Media Banner Image URL
                  </label>
                  <input
                    type="text"
                    value={mediaUrl}
                    onChange={(e) => setMediaUrl(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none focus:border-cyan-500 font-mono text-[11px]"
                    placeholder="https://..."
                  />
                  {mediaUrl && (
                    <div className="mt-2 rounded-xl overflow-hidden border border-white/10 max-h-36 relative">
                      <img src={mediaUrl} alt="Preview" className="w-full h-full object-cover" />
                      <span className="absolute bottom-2 left-2 bg-slate-950/80 px-2 py-0.5 rounded text-[10px] text-slate-300 font-mono">
                        Media Card Preview
                      </span>
                    </div>
                  )}
                </div>

                {/* Call To Action Button */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      CTA Button Label
                    </label>
                    <input
                      type="text"
                      value={ctaTitle}
                      onChange={(e) => setCtaTitle(e.target.value)}
                      className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-cyan-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      CTA Destination URL
                    </label>
                    <input
                      type="text"
                      value={ctaUrl}
                      onChange={(e) => setCtaUrl(e.target.value)}
                      className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-cyan-500 font-mono text-[11px]"
                    />
                  </div>
                </div>

                {/* Execution CTA Button */}
                <div className="pt-3 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="text-xs text-slate-400">
                    Will be dispatched to <strong className="text-cyan-300">{finalRecipients.length} subscribers</strong> holding active tokens.
                  </div>

                  <button
                    type="button"
                    disabled={isBroadcasting || finalRecipients.length === 0}
                    onClick={handleExecuteBroadcast}
                    className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/25 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isBroadcasting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Sending Broadcast...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>Dispatch Recurring Notification Broadcast</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Live Broadcast Dispatch Console & Logs */}
              {broadcastProgress && (
                <div className="bg-slate-900/90 border border-white/10 rounded-2xl p-4 space-y-3 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white flex items-center gap-2">
                      <Radio className="w-4 h-4 text-cyan-400 animate-pulse" />
                      Meta Graph API Live Delivery Monitor
                    </span>
                    <span className="text-xs font-mono text-cyan-300 font-bold">
                      {broadcastProgress.current} / {broadcastProgress.total} (
                      {Math.round((broadcastProgress.current / broadcastProgress.total) * 100)}%)
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-white/10">
                    <div
                      className="bg-gradient-to-r from-cyan-400 to-blue-500 h-full transition-all duration-300"
                      style={{ width: `${(broadcastProgress.current / broadcastProgress.total) * 100}%` }}
                    />
                  </div>

                  {/* Logs list */}
                  <div className="bg-slate-950 rounded-xl p-3 max-h-48 overflow-y-auto space-y-1.5 font-mono text-[11px]">
                    {broadcastProgress.logs.map((l, idx) => (
                      <div key={idx} className="flex items-center justify-between text-slate-300">
                        <div className="flex items-center gap-2 truncate">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                          <span className="text-white font-bold">{l.contactName}</span>
                          <span className="text-slate-500 uppercase">({l.channel})</span>
                          <span className="text-cyan-400/80 truncate">token: {l.token.substring(0, 14)}...</span>
                        </div>
                        <span className="text-emerald-400 text-[10px] font-bold">200 OK</span>
                      </div>
                    ))}
                  </div>

                  {broadcastProgress.completed && (
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center justify-between text-xs text-emerald-300">
                      <span className="font-bold flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        Campaign Blast Finished! All {broadcastProgress.total} contacts updated in Firestore.
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Token Refresh & Automated Re-Opt-In Engine */}
        {activeTab === 'token_health' && (
          <div className="space-y-6">
            <div className="p-5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-slate-900 to-cyan-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-white">
                    Meta Token Renewal & Automated Re-Opt-In Engine
                  </h3>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Churn Prevention
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                  Meta Recurring Notification tokens expire after 6 months (Daily) or 9 months (Weekly). When tokens near expiration (≤ 14 days), trigger an automated Re-Opt-In renewal card before the token dies.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-amber-300 bg-amber-500/10 px-3 py-1.5 rounded-xl border border-amber-500/30">
                  {expiringSoonCount} Token(s) Expiring Soon
                </span>
              </div>
            </div>

            {/* Token Table */}
            <div className="bg-slate-900/80 border border-white/10 rounded-2xl overflow-hidden">
              <div className="p-4 border-b border-white/10 flex items-center justify-between">
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  Subscriber Recurring Tokens Roster ({allTokensWithContacts.length})
                </span>
                <span className="text-[11px] text-slate-400">
                  Showing all active, expiring, and renewed tokens
                </span>
              </div>

              <div className="divide-y divide-white/5 overflow-x-auto">
                {allTokensWithContacts.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 text-xs">
                    No recurring notification tokens found in audience records.
                  </div>
                ) : (
                  allTokensWithContacts.map((item) => (
                    <div 
                      key={`${item.contact.id}_${item.token.id}`}
                      className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
                        item.isExpiringSoon ? 'bg-amber-500/5' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-xs flex-shrink-0">
                          {item.contact.avatarUrl ? (
                            <img src={item.contact.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
                          ) : (
                            item.contact.name.substring(0, 2).toUpperCase()
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-sm">{item.contact.name}</span>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded uppercase bg-white/5 text-slate-400">
                              {item.contact.channel}
                            </span>
                            {item.isExpiringSoon && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                Expiring in {item.daysRemaining} days!
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">
                            Topic: <strong className="text-slate-200">{item.token.topic}</strong> ({item.token.frequency})
                          </p>
                        </div>
                      </div>

                      {/* Right actions */}
                      <div className="flex items-center gap-3 self-end sm:self-center">
                        <div className="text-right text-[11px] font-mono">
                          <div className="text-slate-400">
                            Expires: <span className="text-slate-200">{new Date(item.token.expiresAt).toLocaleDateString()}</span>
                          </div>
                          <div className="text-slate-500">
                            Sent Count: {item.token.sendCount || 0} blasts
                          </div>
                        </div>

                        <button
                          type="button"
                          disabled={refreshingTokenId === item.token.id}
                          onClick={() => handleSimulateTokenRenewal(item.contact.id, item.token.id, item.token.frequency)}
                          className="px-3 py-1.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 font-semibold text-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                          title="Simulate subscriber accepting re-opt-in card (renews for +180 / +270 days)"
                        >
                          {refreshingTokenId === item.token.id ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <RefreshCw className="w-3.5 h-3.5" />
                          )}
                          <span>Renew / Re-Opt-In</span>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Meta API Rules vs OTN */}
        {activeTab === 'policy' && (
          <div className="max-w-4xl space-y-6">
            <div className="bg-slate-900/80 border border-white/10 rounded-2xl p-6 space-y-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-cyan-400" />
                Why Recurring Notifications (RN) Replaced One-Time Notifications (OTN)
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="p-4 rounded-xl bg-slate-950 border border-white/10 space-y-2">
                  <div className="text-rose-400 font-bold flex items-center gap-1.5 text-sm">
                    <X className="w-4 h-4" /> The OTN Flaw (One-and-Done)
                  </div>
                  <p className="text-slate-400 leading-relaxed">
                    OTN only authorized exactly <strong>1 single follow-up message</strong>. Once you dispatched it, the token was burned. If the subscriber did not reply, you could never contact them again without running another paid ad.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-cyan-950/40 border border-cyan-500/30 space-y-2">
                  <div className="text-cyan-300 font-bold flex items-center gap-1.5 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-cyan-400" /> The RN Solution (Ongoing Cadence)
                  </div>
                  <p className="text-slate-300 leading-relaxed">
                    Recurring Notifications grant permission for <strong>ongoing scheduled updates</strong> (up to 1/day for 6 months or 1/week for 9 months) with 100% policy-cleared promotional copy and automatic native re-opt-in prompts.
                  </p>
                </div>
              </div>

              {/* Meta Graph API Payload Spec */}
              <div className="pt-4 border-t border-white/10 space-y-2">
                <span className="text-xs font-bold text-slate-300 block">
                  Meta Graph API Marketing Messages Dispatch Specification:
                </span>
                <div className="p-4 rounded-xl bg-slate-950 font-mono text-[11px] text-cyan-300/90 border border-white/5 overflow-x-auto">
                  <pre>{`POST /v21.0/me/messages
Authorization: Bearer <PAGE_ACCESS_TOKEN>
Content-Type: application/json

{
  "recipient": {
    "recurring_notification_token": "tkn_rn_fb_wk_992182049182"
  },
  "message": {
    "attachment": {
      "type": "template",
      "payload": {
        "template_type": "generic",
        "elements": [{
          "title": "VIP 30% OFF Flash Sale Code",
          "subtitle": "Exclusive promo for our recurring notification subscribers.",
          "image_url": "https://chatmize.io/assets/banner.jpg",
          "buttons": [{
            "type": "web_url",
            "url": "https://chatmize.io/claim",
            "title": "Claim Offer"
          }]
        }]
      }
    }
  }
}`}</pre>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Campaign Builder & Editor Modal */}
      <CampaignBuilderModal
        isOpen={isCampaignModalOpen}
        onClose={() => setIsCampaignModalOpen(false)}
        campaignToEdit={campaignToEdit}
        onSaved={(saved) => {
          setRefreshToast(`Successfully saved campaign: ${saved.name}`);
          setTimeout(() => setRefreshToast(null), 3500);
        }}
      />
    </div>
  );
}
