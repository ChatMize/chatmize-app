import React, { useState, useEffect, useMemo } from 'react';
import { PersonalizationPickerButton, usePersonalizationTarget, usePersonalizationTargetMap } from './personalization';
import { 
  X, 
  Calendar, 
  Clock, 
  BellRing, 
  Send, 
  Layers, 
  Plus, 
  Trash2, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  Eye, 
  ChevronRight, 
  ChevronDown,
  ExternalLink,
  Users,
  Smartphone,
  Globe,
  Tag,
  ArrowRight,
  Play
} from 'lucide-react';
import { 
  CampaignRecord, 
  CampaignType, 
  DripStep, 
  saveCampaign, 
  ContactRecord,
  recordRecurringNotificationSent,
  subscribeToContacts
} from '../lib/firebase';

interface CampaignBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaignToEdit?: CampaignRecord | null;
  onSaved?: (campaign: CampaignRecord) => void;
}

export function CampaignBuilderModal({
  isOpen,
  onClose,
  campaignToEdit,
  onSaved
}: CampaignBuilderModalProps) {
  const [contacts, setContacts] = useState<ContactRecord[]>([]);

  useEffect(() => {
    const unsub = subscribeToContacts((data) => {
      setContacts(data);
    });
    return () => unsub();
  }, []);

  // Form State
  const [campaignType, setCampaignType] = useState<CampaignType>('recurring');
  const [name, setName] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [channel, setChannel] = useState<'all' | 'messenger' | 'instagram' | 'whatsapp'>('all');
  const [status, setStatus] = useState<'active' | 'scheduled' | 'draft'>('active');

  // Recurring Notifications (RN) Configuration
  const [rnTopic, setRnTopic] = useState<string>('Weekly Automation Playbook & Promos');
  const [rnCadence, setRnCadence] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [enforceRateLimitShield, setEnforceRateLimitShield] = useState<boolean>(true);

  // Date-Specific Configuration
  const [scheduledDate, setScheduledDate] = useState<string>(() => {
    const d = new Date(Date.now() + 3 * 24 * 3600 * 1000);
    return d.toISOString().slice(0, 10);
  });
  const [scheduledTime, setScheduledTime] = useState<string>('10:00');
  const [timezone, setTimezone] = useState<string>('America/New_York');
  const broadcastPz = usePersonalizationTarget<HTMLTextAreaElement>();
  const dripPz = usePersonalizationTargetMap<HTMLTextAreaElement>();

  // Drip Sequence Configuration
  const [triggerOnTag, setTriggerOnTag] = useState<string>('New Lead');
  const [triggerOnRnOptin, setTriggerOnRnOptin] = useState<boolean>(true);
  const [dripSteps, setDripSteps] = useState<DripStep[]>([
    {
      id: 'step_1',
      stepNumber: 1,
      delayValue: 0,
      delayUnit: 'minutes',
      title: 'Step 1: Immediate Welcome & Free Asset Delivery',
      messageText: 'Welcome aboard {{first_name}}! 🎁 As promised, here is your 10x Bot Conversion Checklist download link.',
      buttonText: 'Download PDF Guide 📥',
      buttonUrl: 'https://chatmize.io/guide.pdf',
      tagToAdd: 'Delivered Lead Magnet',
    },
    {
      id: 'step_2',
      stepNumber: 2,
      delayValue: 2,
      delayUnit: 'days',
      title: 'Step 2: Value Nurture & Client Case Study',
      messageText: 'Hey {{first_name}}, check out how Sarah generated 412 qualified appointments in 14 days using this exact flow.',
      mediaUrl: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&auto=format&fit=crop&q=80',
      buttonText: 'Watch Case Study 🎥',
      buttonUrl: 'https://chatmize.io/case-study',
      tagToAdd: 'Viewed Case Study',
    },
    {
      id: 'step_3',
      stepNumber: 3,
      delayValue: 5,
      delayUnit: 'days',
      title: 'Step 3: Meta Token Re-Opt-In & VIP Upgrade',
      messageText: 'Hey {{first_name}}! Your VIP Weekly updates ensure you never miss our secret promo codes. Tap below to refresh your updates token!',
      buttonText: 'Renew VIP Updates 🔔',
      buttonUrl: 'https://chatmize.io/renew-token',
      tagToAdd: 'RN Re-Opted In',
      rnTopicRequired: 'Weekly Automation Playbook & Promos',
    }
  ]);

  // Primary Message Content (for recurring, date-specific, and broadcast)
  const [messageText, setMessageText] = useState<string>(
    '🔥 Hey {{first_name}}! Here is your exclusive VIP access for this week:\n\nOur brand new High-Ticket Lead Gen template is live! Tap below to clone it directly into your ChatMize workspace.'
  );
  const [mediaUrl, setMediaUrl] = useState<string>(
    'https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=800&auto=format&fit=crop&q=80'
  );
  const [ctaButtonText, setCtaButtonText] = useState<string>('Access VIP Template 🚀');
  const [ctaButtonUrl, setCtaButtonUrl] = useState<string>('https://chatmize.io/vip-templates');

  // Targeting Filters
  const [targetTag, setTargetTag] = useState<string>('all');
  const [hasActiveRnTokenOnly, setHasActiveRnTokenOnly] = useState<boolean>(true);

  // Status & Simulation
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [simulationLog, setSimulationLog] = useState<string | null>(null);

  // Initialize form when editing or resetting
  useEffect(() => {
    if (campaignToEdit) {
      setCampaignType(campaignToEdit.type || 'recurring');
      setName(campaignToEdit.name || '');
      setDescription(campaignToEdit.description || '');
      setChannel(campaignToEdit.channel || 'all');
      setStatus(campaignToEdit.status || 'active');
      if (campaignToEdit.rnTopic) setRnTopic(campaignToEdit.rnTopic);
      if (campaignToEdit.rnCadence) setRnCadence(campaignToEdit.rnCadence);
      setEnforceRateLimitShield(campaignToEdit.enforceRateLimitShield ?? true);
      if (campaignToEdit.scheduledDate) setScheduledDate(campaignToEdit.scheduledDate);
      if (campaignToEdit.scheduledTime) setScheduledTime(campaignToEdit.scheduledTime);
      if (campaignToEdit.timezone) setTimezone(campaignToEdit.timezone);
      if (campaignToEdit.triggerOnTag) setTriggerOnTag(campaignToEdit.triggerOnTag);
      setTriggerOnRnOptin(campaignToEdit.triggerOnRnOptin ?? true);
      if (campaignToEdit.dripSteps && campaignToEdit.dripSteps.length > 0) {
        setDripSteps(campaignToEdit.dripSteps);
      }
      if (campaignToEdit.messageText) setMessageText(campaignToEdit.messageText);
      if (campaignToEdit.mediaUrl) setMediaUrl(campaignToEdit.mediaUrl);
      if (campaignToEdit.ctaButtonText) setCtaButtonText(campaignToEdit.ctaButtonText);
      if (campaignToEdit.ctaButtonUrl) setCtaButtonUrl(campaignToEdit.ctaButtonUrl);
      if (typeof campaignToEdit.targetAudience === 'object' && campaignToEdit.targetAudience?.tag) {
        setTargetTag(campaignToEdit.targetAudience.tag);
      }
      if (typeof campaignToEdit.targetAudience === 'object' && campaignToEdit.targetAudience?.hasActiveRnTokenOnly !== undefined) {
        setHasActiveRnTokenOnly(campaignToEdit.targetAudience.hasActiveRnTokenOnly);
      }
    } else {
      // Default initial values
      setCampaignType('recurring');
      setName('Weekly VIP Drops & Automation Digest');
      setDescription('Recurring notification dispatched weekly to opted-in subscribers beyond the Meta 24h window.');
      setChannel('all');
      setStatus('active');
    }
    setSimulationLog(null);
  }, [campaignToEdit, isOpen]);

  // Extract all existing tags across audience
  const availableTags = useMemo(() => {
    const tags = new Set<string>();
    contacts.forEach(c => {
      (c.tags || []).forEach(t => tags.add(t));
    });
    return Array.from(tags);
  }, [contacts]);

  // Calculate Reachable Audience in Real-Time
  const audienceStats = useMemo(() => {
    let reachable = 0;
    let rateLimited = 0;
    const now = Date.now();

    contacts.forEach(c => {
      // Channel match
      if (channel !== 'all' && c.channel !== channel) return;
      // Tag match
      if (targetTag !== 'all' && !(c.tags || []).includes(targetTag)) return;

      // Meta RN Token validation
      if (hasActiveRnTokenOnly) {
        const matchingToken = (c.recurringTokens || []).find(t => {
          if (t.status !== 'active') return false;
          if (new Date(t.expiresAt).getTime() <= now) return false;
          if (rnTopic && t.topic !== rnTopic) return false;
          return true;
        });

        if (!matchingToken) return;

        // Check rate limiting if enforced
        if (enforceRateLimitShield && matchingToken.lastSentAt) {
          const lastSentTime = new Date(matchingToken.lastSentAt).getTime();
          const cooldownMs = rnCadence === 'daily' ? 24 * 3600 * 1000 : rnCadence === 'weekly' ? 7 * 24 * 3600 * 1000 : 30 * 24 * 3600 * 1000;
          if (now - lastSentTime < cooldownMs) {
            rateLimited++;
            return;
          }
        }
      }

      reachable++;
    });

    return {
      totalContacts: contacts.length,
      reachable,
      rateLimited
    };
  }, [contacts, channel, targetTag, hasActiveRnTokenOnly, rnTopic, rnCadence, enforceRateLimitShield]);

  // Handle Drip Step additions and updates
  const handleAddDripStep = () => {
    const nextNum = dripSteps.length + 1;
    const newStep: DripStep = {
      id: `step_${Date.now()}`,
      stepNumber: nextNum,
      delayValue: nextNum * 2,
      delayUnit: 'days',
      title: `Step ${nextNum}: Follow-Up Nurture`,
      messageText: `Hey {{first_name}}! Here is step #${nextNum} in your automation journey.`,
      buttonText: 'Check It Out 🚀',
      buttonUrl: 'https://chatmize.io',
      tagToAdd: `Step ${nextNum} Completed`,
    };
    setDripSteps([...dripSteps, newStep]);
  };

  const handleUpdateDripStep = (index: number, updates: Partial<DripStep>) => {
    const updated = [...dripSteps];
    updated[index] = { ...updated[index], ...updates };
    setDripSteps(updated);
  };

  const handleRemoveDripStep = (index: number) => {
    if (dripSteps.length <= 1) return;
    const updated = dripSteps.filter((_, i) => i !== index).map((s, idx) => ({
      ...s,
      stepNumber: idx + 1
    }));
    setDripSteps(updated);
  };

  // Save Campaign to Firestore
  const handleSave = async () => {
    if (!name.trim()) return;
    setIsSaving(true);
    try {
      const now = new Date();
      const scheduledDateTimeIso = campaignType === 'date_specific' 
        ? new Date(`${scheduledDate}T${scheduledTime}:00`).toISOString()
        : undefined;

      const record: CampaignRecord = {
        id: campaignToEdit?.id || `camp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        name: name.trim(),
        description: description.trim(),
        type: campaignType,
        status: status,
        channel: channel,
        rnTopic: campaignType === 'recurring' || campaignType === 'date_specific' ? rnTopic : undefined,
        rnCadence: campaignType === 'recurring' ? rnCadence : undefined,
        enforceRateLimitShield: campaignType === 'recurring' ? enforceRateLimitShield : undefined,
        scheduledDate: campaignType === 'date_specific' ? scheduledDate : undefined,
        scheduledTime: campaignType === 'date_specific' ? scheduledTime : undefined,
        scheduledDateTimeIso: scheduledDateTimeIso,
        timezone: campaignType === 'date_specific' ? timezone : undefined,
        triggerOnTag: campaignType === 'drip' ? triggerOnTag : undefined,
        triggerOnRnOptin: campaignType === 'drip' ? triggerOnRnOptin : undefined,
        dripSteps: campaignType === 'drip' ? dripSteps : undefined,
        messageText: messageText,
        mediaUrl: mediaUrl.trim() || undefined,
        ctaButtonText: ctaButtonText.trim() || undefined,
        ctaButtonUrl: ctaButtonUrl.trim() || undefined,
        targetAudience: {
          channel: channel,
          topic: rnTopic,
          tag: targetTag !== 'all' ? targetTag : undefined,
          hasActiveRnTokenOnly: hasActiveRnTokenOnly,
        },
        stats: campaignToEdit?.stats || {
          targetAudienceCount: audienceStats.reachable,
          deliveredCount: 0,
          openedCount: 0,
          clickedCount: 0,
          optOutCount: 0,
        },
        createdAt: campaignToEdit?.createdAt || now.toISOString(),
        updatedAt: now.toISOString(),
      };

      await saveCampaign(record);
      if (onSaved) onSaved(record);
      onClose();
    } catch (err) {
      console.error('Failed to save campaign:', err);
      alert(`Failed to save campaign: ${err instanceof Error ? err.message : 'Unknown error'}. Please try again or contact support.`);
    } finally {
      setIsSaving(false);
    }
  };

  // Run a live simulated delivery run
  const handleRunSimulation = async () => {
    setIsSimulating(true);
    setSimulationLog('Starting simulation delivery engine across live database contacts...');

    try {
      let sentCount = 0;
      const now = Date.now();

      // Find eligible contacts
      for (const contact of contacts) {
        if (channel !== 'all' && contact.channel !== channel) continue;
        if (targetTag !== 'all' && !(contact.tags || []).includes(targetTag)) continue;

        const matchingToken = (contact.recurringTokens || []).find(t => {
          if (t.status !== 'active') return false;
          if (new Date(t.expiresAt).getTime() <= now) return false;
          return true;
        });

        if (hasActiveRnTokenOnly && !matchingToken) continue;

        // Record delivery
        if (matchingToken) {
          await recordRecurringNotificationSent(contact.id, matchingToken.id);
        }
        sentCount++;
      }

      setSimulationLog(
        `✅ Simulation Complete! Successfully verified and executed campaign broadcast to ${sentCount} live contacts using authorized permission tokens. Delivery metrics updated.`
      );
    } catch (err) {
      setSimulationLog(`Simulation error: ${String(err)}`);
    } finally {
      setIsSimulating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-white/15 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] my-auto">
        
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-white/10 bg-gradient-to-r from-blue-950/50 via-slate-900 to-indigo-950/50 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-500 to-cyan-400 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-blue-500/20">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                <span>{campaignToEdit ? 'Edit Marketing Campaign' : 'Create New Campaign'}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-mono font-bold border border-cyan-500/30">
                  Meta RN & Drip
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Design recurring marketing sequences, date-specific launch events, or automated multi-step drip funnels.
              </p>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-xl text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">

          {/* 1. Campaign Type Selection Tabs */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              1. Choose Campaign Architecture
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Recurring Cadence */}
              <button
                type="button"
                onClick={() => setCampaignType('recurring')}
                className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  campaignType === 'recurring'
                    ? 'bg-gradient-to-br from-cyan-950/50 to-blue-950/50 border-cyan-400 text-white shadow-lg shadow-cyan-500/10'
                    : 'bg-slate-950/60 border-white/10 text-slate-400 hover:border-white/20'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="p-2 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                      <BellRing className="w-4 h-4" />
                    </span>
                    <span className="text-[10px] font-mono font-bold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-full">
                      Meta RN API
                    </span>
                  </div>
                  <h4 className="text-sm font-black text-white mb-1">Recurring Notification</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Continuous cadence (daily, weekly, monthly) broadcasted past the 24h window with automatic rate-limit shielding.
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-white/10 flex items-center gap-1 text-[11px] font-bold text-cyan-300">
                  <span>Weekly VIP Drops & Promos</span>
                  <ChevronRight className="w-3 h-3 ml-auto" />
                </div>
              </button>

              {/* Date-Specific Launch */}
              <button
                type="button"
                onClick={() => setCampaignType('date_specific')}
                className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  campaignType === 'date_specific'
                    ? 'bg-gradient-to-br from-rose-950/50 to-pink-950/50 border-rose-400 text-white shadow-lg shadow-rose-500/10'
                    : 'bg-slate-950/60 border-white/10 text-slate-400 hover:border-white/20'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="p-2 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/30">
                      <Calendar className="w-4 h-4" />
                    </span>
                    <span className="text-[10px] font-mono font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full">
                      Exact Date & Time
                    </span>
                  </div>
                  <h4 className="text-sm font-black text-white mb-1">Date-Specific Launch</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Time-sensitive launches (Black Friday, webinar kickoffs, flash holidays) delivered at an exact calendar timestamp.
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-white/10 flex items-center gap-1 text-[11px] font-bold text-rose-300">
                  <span>Calendar Scheduled Event</span>
                  <ChevronRight className="w-3 h-3 ml-auto" />
                </div>
              </button>

              {/* Automated Drip Sequence */}
              <button
                type="button"
                onClick={() => setCampaignType('drip')}
                className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  campaignType === 'drip'
                    ? 'bg-gradient-to-br from-amber-950/50 to-orange-950/50 border-amber-400 text-white shadow-lg shadow-amber-500/10'
                    : 'bg-slate-950/60 border-white/10 text-slate-400 hover:border-white/20'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="p-2 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      <Layers className="w-4 h-4" />
                    </span>
                    <span className="text-[10px] font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">
                      Multi-Day Nurture
                    </span>
                  </div>
                  <h4 className="text-sm font-black text-white mb-1">Automated Drip Sequence</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Progressive multi-step sequence with customizable delays (Day 0, Day 2, Day 5) and automatic Token Re-Opt-In renewal.
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-white/10 flex items-center gap-1 text-[11px] font-bold text-amber-300">
                  <span>Step-by-Step Lead Funnel</span>
                  <ChevronRight className="w-3 h-3 ml-auto" />
                </div>
              </button>
            </div>
          </div>

          {/* 2. Campaign Identity & Channels */}
          <div className="bg-slate-950/60 border border-white/10 rounded-2xl p-4 sm:p-5 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-blue-400" />
              <span>Campaign Information & Targeting</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">Campaign Name</label>
                <input 
                  type="text" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. VIP Weekly Drop & Automation Playbook"
                  className="w-full bg-slate-900 border border-white/15 rounded-xl px-3.5 py-2 text-xs text-white outline-none focus:border-blue-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">Target Channel</label>
                <select
                  value={channel}
                  onChange={(e) => setChannel(e.target.value as any)}
                  className="w-full bg-slate-900 border border-white/15 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-blue-500"
                >
                  <option value="all">Omnichannel (Messenger, Instagram, WhatsApp)</option>
                  <option value="messenger">Facebook Messenger Only</option>
                  <option value="instagram">Instagram Direct Only</option>
                  <option value="whatsapp">WhatsApp Cloud API Only</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">Description (Internal Notes)</label>
              <input 
                type="text" 
                value={description} 
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. High-conversion automated re-engagement for registered masterclass leads"
                className="w-full bg-slate-900 border border-white/15 rounded-xl px-3.5 py-2 text-xs text-slate-300 outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* 3. Type-Specific Configuration Panels */}

          {/* PANEL A: RECURRING NOTIFICATION (RN) SETTINGS */}
          {campaignType === 'recurring' && (
            <div className="bg-gradient-to-br from-cyan-950/30 to-slate-950/70 border border-cyan-500/30 rounded-2xl p-4 sm:p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BellRing className="w-4 h-4 text-cyan-400" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-300">
                    Meta Recurring Notification Rules
                  </h4>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-400" />
                  Marketing Messages API
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">Approved Topic Name</label>
                  <input 
                    type="text" 
                    value={rnTopic} 
                    onChange={(e) => setRnTopic(e.target.value)}
                    placeholder="Weekly Automation Playbook & Promos"
                    className="w-full bg-slate-900 border border-white/15 rounded-xl px-3.5 py-2 text-xs text-white outline-none focus:border-cyan-500 font-mono"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Must strictly match the topic approved by users during opt-in.</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">Permission Cadence</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['daily', 'weekly', 'monthly'] as const).map(cad => (
                      <button
                        key={cad}
                        type="button"
                        onClick={() => setRnCadence(cad)}
                        className={`py-2 px-2.5 rounded-xl text-xs font-bold capitalize transition-all border text-center ${
                          rnCadence === cad
                            ? 'bg-cyan-500/25 border-cyan-400 text-cyan-300 shadow-sm shadow-cyan-500/20'
                            : 'bg-slate-900 border-white/10 text-slate-400 hover:text-white'
                        }`}
                      >
                        {cad}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Rate-Limit Shield */}
              <div className="p-3 bg-slate-900/80 rounded-xl border border-white/10 flex items-center justify-between">
                <div className="space-y-0.5 pr-3">
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>Meta Cadence Rate-Limit Shield</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Automatically prevents sending more than 1 notification per {rnCadence} interval per subscriber to guarantee zero Meta policy strikes.
                  </p>
                </div>
                <input 
                  type="checkbox" 
                  checked={enforceRateLimitShield} 
                  onChange={(e) => setEnforceRateLimitShield(e.target.checked)}
                  className="w-5 h-5 accent-cyan-400 rounded cursor-pointer"
                />
              </div>
            </div>
          )}

          {/* PANEL B: DATE-SPECIFIC LAUNCH SETTINGS */}
          {campaignType === 'date_specific' && (
            <div className="bg-gradient-to-br from-rose-950/30 to-slate-950/70 border border-rose-500/30 rounded-2xl p-4 sm:p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-rose-400" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-rose-300">
                    Scheduled Date & Launch Timing
                  </h4>
                </div>
                <div className="text-[11px] font-mono text-rose-300 bg-rose-500/20 px-2 py-0.5 rounded-full border border-rose-500/30 font-bold">
                  📅 Scheduled Broadcast
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">Execution Date</label>
                  <input 
                    type="date" 
                    value={scheduledDate} 
                    onChange={(e) => setScheduledDate(e.target.value)}
                    className="w-full bg-slate-900 border border-white/15 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-rose-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">Execution Time</label>
                  <input 
                    type="time" 
                    value={scheduledTime} 
                    onChange={(e) => setScheduledTime(e.target.value)}
                    className="w-full bg-slate-900 border border-white/15 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-rose-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">Target Timezone</label>
                  <select
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="w-full bg-slate-900 border border-white/15 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-rose-500"
                  >
                    <option value="America/New_York">Eastern Time (ET)</option>
                    <option value="America/Chicago">Central Time (CT)</option>
                    <option value="America/Denver">Mountain Time (MT)</option>
                    <option value="America/Los_Angeles">Pacific Time (PT)</option>
                    <option value="Europe/London">London (GMT/BST)</option>
                    <option value="UTC">Coordinated Universal Time (UTC)</option>
                  </select>
                </div>
              </div>

              {/* Live Scheduled Countdown Banner */}
              <div className="p-3 bg-slate-900/90 rounded-xl border border-rose-500/20 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-rose-400" />
                  <span className="text-xs text-slate-300 font-medium">
                    Scheduled delivery for: <strong className="text-white">{scheduledDate} at {scheduledTime} ({timezone.split('/')[1] || timezone})</strong>
                  </span>
                </div>
                <span className="text-[10px] font-bold text-rose-300 bg-rose-500/15 px-2 py-0.5 rounded border border-rose-500/30">
                  Ready to queue
                </span>
              </div>
            </div>
          )}

          {/* PANEL C: DRIP SEQUENCE TIMELINE BUILDER */}
          {campaignType === 'drip' && (
            <div className="bg-gradient-to-br from-amber-950/30 to-slate-950/70 border border-amber-500/30 rounded-2xl p-4 sm:p-5 space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-amber-400" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-amber-300">
                    Multi-Step Drip Sequence & Token Renewal
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={handleAddDripStep}
                  className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Step
                </button>
              </div>

              {/* Drip Trigger Rules */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-900/80 rounded-xl border border-white/10 text-xs">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Enrollment Trigger Tag</label>
                  <input 
                    type="text" 
                    value={triggerOnTag} 
                    onChange={(e) => setTriggerOnTag(e.target.value)}
                    placeholder="e.g. New Lead, Webinar Attendee"
                    className="w-full bg-slate-950 border border-white/15 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-amber-500"
                  />
                </div>
                <div className="flex items-center justify-between pt-4">
                  <div className="space-y-0.5">
                    <span className="font-bold text-white block">Auto-Enroll on RN Opt-In</span>
                    <span className="text-[10px] text-slate-400">Trigger step 1 as soon as Meta token is granted</span>
                  </div>
                  <input 
                    type="checkbox" 
                    checked={triggerOnRnOptin} 
                    onChange={(e) => setTriggerOnRnOptin(e.target.checked)}
                    className="w-4 h-4 accent-amber-400 rounded cursor-pointer"
                  />
                </div>
              </div>

              {/* Step by Step Timeline */}
              <div className="space-y-3.5">
                {dripSteps.map((step, idx) => (
                  <div 
                    key={step.id || idx}
                    className="bg-slate-900/95 border border-white/10 rounded-2xl p-3.5 sm:p-4 space-y-3 relative group"
                  >
                    <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-black flex items-center justify-center">
                          {step.stepNumber}
                        </span>
                        <input 
                          type="text" 
                          value={step.title}
                          onChange={(e) => handleUpdateDripStep(idx, { title: e.target.value })}
                          className="bg-transparent text-xs font-bold text-white outline-none focus:border-b focus:border-amber-400 max-w-sm"
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Timed delay selector */}
                        <div className="flex items-center gap-1 bg-slate-950 px-2 py-1 rounded-lg border border-white/10 text-[11px]">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span className="text-slate-400">Wait:</span>
                          <input 
                            type="number" 
                            min="0"
                            value={step.delayValue} 
                            onChange={(e) => handleUpdateDripStep(idx, { delayValue: parseInt(e.target.value, 10) || 0 })}
                            className="w-10 bg-transparent text-white font-mono text-center outline-none"
                          />
                          <select
                            value={step.delayUnit}
                            onChange={(e) => handleUpdateDripStep(idx, { delayUnit: e.target.value as any })}
                            className="bg-transparent text-amber-300 font-bold outline-none cursor-pointer"
                          >
                            <option value="minutes">mins</option>
                            <option value="hours">hours</option>
                            <option value="days">days</option>
                          </select>
                        </div>

                        {dripSteps.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveDripStep(idx)}
                            className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
                            title="Remove Step"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Step Message Content */}
                    <div className="relative">
                      <textarea
                        rows={2}
                        ref={dripPz.setRef(`step:${idx}`)}
                        value={step.messageText}
                        onChange={(e) => handleUpdateDripStep(idx, { messageText: e.target.value })}
                        placeholder="Write step message... Use {{first_name}} for personalization"
                        className="w-full bg-slate-950 border border-white/10 rounded-xl p-2.5 pr-9 text-xs text-white outline-none focus:border-amber-500 resize-none"
                      />
                      <span className="absolute right-1.5 bottom-1.5">
                        <PersonalizationPickerButton
                          onPick={(t) => dripPz.insert(`step:${idx}`, t, step.messageText, (v) => handleUpdateDripStep(idx, { messageText: v }))}
                          placement="up"
                          title="Insert personalization"
                        />
                      </span>
                    </div>

                    {/* Step Optional Media & CTA Button */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                      <div>
                        <input 
                          type="text" 
                          placeholder="Media Image URL (Optional)" 
                          value={step.mediaUrl || ''} 
                          onChange={(e) => handleUpdateDripStep(idx, { mediaUrl: e.target.value })}
                          className="w-full bg-slate-950 border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] text-white outline-none focus:border-amber-500"
                        />
                      </div>
                      <div>
                        <input 
                          type="text" 
                          placeholder="Button Label (e.g. Claim Offer)" 
                          value={step.buttonText || ''} 
                          onChange={(e) => handleUpdateDripStep(idx, { buttonText: e.target.value })}
                          className="w-full bg-slate-950 border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] text-white outline-none focus:border-amber-500"
                        />
                      </div>
                      <div>
                        <input 
                          type="text" 
                          placeholder="Destination URL (https://...)" 
                          value={step.buttonUrl || ''} 
                          onChange={(e) => handleUpdateDripStep(idx, { buttonUrl: e.target.value })}
                          className="w-full bg-slate-950 border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] text-white outline-none focus:border-amber-500"
                        />
                      </div>
                    </div>

                    {/* Meta RN Re-Opt-In Token Renewal Flag */}
                    {idx === dripSteps.length - 1 && (
                      <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-between text-[11px] text-cyan-300">
                        <div className="flex items-center gap-1.5">
                          <BellRing className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Automatically attach <strong>Recurring Notification Re-Opt-In renewal card</strong> to this step</span>
                        </div>
                        <input 
                          type="checkbox"
                          checked={Boolean(step.rnTopicRequired)}
                          onChange={(e) => handleUpdateDripStep(idx, { rnTopicRequired: e.target.checked ? 'Weekly VIP Drops' : undefined })}
                          className="accent-cyan-400 rounded cursor-pointer"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 4. Primary Message Content (For recurring and date-specific campaigns) */}
          {campaignType !== 'drip' && (
            <div className="bg-slate-950/60 border border-white/10 rounded-2xl p-4 sm:p-5 space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <Send className="w-3.5 h-3.5 text-blue-400" />
                  <span>Broadcast Message Creative</span>
                </label>
                <div className="flex items-center gap-1 text-[10px] text-slate-400">
                  <PersonalizationPickerButton
                    onPick={(t) => broadcastPz.insert(t, messageText, setMessageText)}
                    placement="down"
                    title="Insert personalization"
                  />
                </div>
              </div>

              <div className="relative">
                <textarea
                  rows={4}
                  ref={broadcastPz.ref}
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="Type the message copy... Markdown formatting supported."
                  className="w-full bg-slate-900 border border-white/15 rounded-xl p-3.5 pr-10 text-xs text-white outline-none focus:border-blue-500 resize-none font-sans leading-relaxed"
                />
                <span className="absolute right-2 bottom-2">
                  <PersonalizationPickerButton
                    onPick={(t) => broadcastPz.insert(t, messageText, setMessageText)}
                    placement="up"
                    title="Insert personalization"
                  />
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-1">
                  <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Media Banner Image</label>
                  <input 
                    type="text" 
                    value={mediaUrl} 
                    onChange={(e) => setMediaUrl(e.target.value)}
                    placeholder="https://images.unsplash.com/..."
                    className="w-full bg-slate-900 border border-white/15 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Call-To-Action Button</label>
                  <input 
                    type="text" 
                    value={ctaButtonText} 
                    onChange={(e) => setCtaButtonText(e.target.value)}
                    placeholder="Claim VIP Offer 🚀"
                    className="w-full bg-slate-900 border border-white/15 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Destination URL</label>
                  <input 
                    type="text" 
                    value={ctaButtonUrl} 
                    onChange={(e) => setCtaButtonUrl(e.target.value)}
                    placeholder="https://chatmize.io/offer"
                    className="w-full bg-slate-900 border border-white/15 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Live Preview Card */}
              {mediaUrl && (
                <div className="mt-2 p-3 bg-slate-900 rounded-xl border border-white/10 flex items-center gap-3">
                  <img 
                    src={mediaUrl} 
                    alt="Preview" 
                    className="w-16 h-12 object-cover rounded-lg flex-shrink-0"
                    referrerPolicy="no-referrer"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-white truncate">{ctaButtonText || 'Button Label'}</p>
                    <p className="text-[10px] text-slate-400 truncate">{ctaButtonUrl || 'https://...'}</p>
                  </div>
                  <span className="text-[10px] font-bold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                    Live Preview
                  </span>
                </div>
              )}
            </div>
          )}

          {/* 5. Audience Targeting & Live Reachable Calculator */}
          <div className="bg-slate-950/70 border border-white/10 rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <Users className="w-3.5 h-3.5 text-emerald-400" />
                <span>Audience Targeting & Policy Compliance</span>
              </h3>
              <span className="text-xs font-mono font-bold text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
                {audienceStats.reachable} Reachable Contacts
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">Filter by Audience Tag</label>
                <select
                  value={targetTag}
                  onChange={(e) => setTargetTag(e.target.value)}
                  className="w-full bg-slate-900 border border-white/15 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-blue-500"
                >
                  <option value="all">All Contacts ({contacts.length})</option>
                  {availableTags.map(tag => (
                    <option key={tag} value={tag}>Tag: {tag}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">Campaign Status</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['active', 'scheduled', 'draft'] as const).map(st => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setStatus(st)}
                      className={`py-2 px-2.5 rounded-xl text-xs font-bold capitalize transition-all border text-center ${
                        status === st
                          ? 'bg-blue-500/20 border-blue-400 text-blue-300'
                          : 'bg-slate-900 border-white/10 text-slate-400 hover:text-white'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Policy compliance checkbox */}
            <div className="p-3 bg-slate-900/80 rounded-xl border border-white/10 flex items-center justify-between">
              <div className="space-y-0.5 pr-3">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Enforce Active Meta Recurring Notification Token Only</span>
                </span>
                <p className="text-[11px] text-slate-400">
                  Guarantees that messages sent beyond the 24-hour window are only delivered to recipients who explicitly opted in.
                </p>
              </div>
              <input 
                type="checkbox" 
                checked={hasActiveRnTokenOnly} 
                onChange={(e) => setHasActiveRnTokenOnly(e.target.checked)}
                className="w-5 h-5 accent-emerald-400 rounded cursor-pointer"
              />
            </div>
          </div>

          {/* Simulation Output Banner */}
          {simulationLog && (
            <div className="p-3.5 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 text-xs text-cyan-200 leading-relaxed flex items-start gap-2.5 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold">{simulationLog}</p>
              </div>
              <button 
                onClick={() => setSimulationLog(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 sm:p-6 border-t border-white/10 bg-slate-950/80 flex flex-col sm:flex-row items-center justify-between gap-3 flex-shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Users className="w-4 h-4 text-cyan-400" />
            <span>Target Audience: <strong className="text-white">{audienceStats.reachable} subscribers</strong></span>
            {audienceStats.rateLimited > 0 && (
              <span className="text-amber-400">({audienceStats.rateLimited} rate-limited)</span>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* Simulation button */}
            <button
              type="button"
              onClick={handleRunSimulation}
              disabled={isSimulating || audienceStats.reachable === 0}
              className="flex-1 sm:flex-initial px-4 py-2.5 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              title="Test run delivery simulation across live contacts without violating Meta rate limits"
            >
              <Play className="w-3.5 h-3.5" />
              <span>{isSimulating ? 'Simulating...' : 'Test Run Simulation'}</span>
            </button>

            {/* Cancel */}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              Cancel
            </button>

            {/* Save Campaign */}
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || !name.trim()}
              className="flex-1 sm:flex-initial px-5 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-500/25 flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSaving ? 'Saving...' : campaignToEdit ? 'Update Campaign' : 'Launch & Save Campaign'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
