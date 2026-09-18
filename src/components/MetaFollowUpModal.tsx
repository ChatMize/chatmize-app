import React, { useState } from 'react';
import { EmojiPickerButton, useEmojiTargetMap } from './emoji';
import { PersonalizationPickerButton, usePersonalizationTargetMap } from './personalization';
import { 
  AlertCircle, 
  AlertTriangle, 
  ArrowRight, 
  BellRing, 
  Check, 
  CheckCircle2, 
  Clock, 
  DollarSign, 
  ExternalLink, 
  HelpCircle, 
  Info, 
  Lock, 
  Mail, 
  MessageCircle, 
  MessageSquare, 
  Phone, 
  Send, 
  ShieldAlert, 
  ShieldCheck, 
  Sparkles, 
  Tag, 
  User, 
  UserCheck, 
  X, 
  Zap 
} from 'lucide-react';
import { ContactRecord, updateContactField } from '../lib/firebase';
import { sendSms, setSmsOptIn } from '../lib/sms';
import { 
  MetaMessageTag, 
  validateMessageTagCompliance, 
  META_MESSAGING_RULES 
} from '../types/metaMessaging';

interface MetaFollowUpModalProps {
  contact: ContactRecord;
  workspaceId?: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export function MetaFollowUpModal({ contact, workspaceId, onClose, onSuccess }: MetaFollowUpModalProps) {
  const now = Date.now();
  const windowExpiryTime = contact.messagingWindowExpiresAt ? new Date(contact.messagingWindowExpiresAt).getTime() : 0;
  const is24hActive = windowExpiryTime > now;
  const hoursRemaining = Math.max(0, Math.round((windowExpiryTime - now) / (1000 * 60 * 60)));

  const humanAgentExpiry = contact.humanAgentExpiresAt ? new Date(contact.humanAgentExpiresAt).getTime() : 0;
  const isHumanAgentActive = humanAgentExpiry > now;
  const humanAgentDaysRemaining = Math.max(0, Math.round((humanAgentExpiry - now) / (1000 * 60 * 60 * 24)));

  const activeRNTokens = (contact.recurringTokens || []).filter(t => t.status === 'active' && new Date(t.expiresAt).getTime() > now);
  const availableOTNTokens = (contact.otnTokens || []).filter(t => t.status === 'available');

  // Follow-up API mode selection
  const [selectedMode, setSelectedMode] = useState<
    'standard' | 'message_tag' | 'recurring_notification' | 'otn' | 'whatsapp_template' | 'sponsored' | 'cross_channel'
  >(is24hActive ? 'standard' : activeRNTokens.length > 0 ? 'recurring_notification' : 'message_tag');

  // Fields for Message Tag
  const [selectedTag, setSelectedTag] = useState<MetaMessageTag>('CONFIRMED_EVENT_UPDATE');
  const pz = usePersonalizationTargetMap<HTMLTextAreaElement>();
  const [messageBody, setMessageBody] = useState<string>(() => {
    if (is24hActive) {
      return `Hey ${contact.firstName || contact.name}! Here is the workshop replay link we promised.`;
    }
    return `Reminder: Your registered workshop session with ${contact.firstName || contact.name} starts in 2 hours. See you there!`;
  });

  // Fields for Recurring Notification
  const [selectedRNTokenId, setSelectedRNTokenId] = useState<string>(activeRNTokens[0]?.id || '');
  const [rnPromoText, setRnPromoText] = useState<string>(
    `Special Offer for ${contact.firstName || contact.name}: VIP Masterclass Pass is now 50% off for the next 24 hours! Tap below to claim your discount.`
  );

  // Fields for OTN
  const [selectedOTNTokenId, setSelectedOTNTokenId] = useState<string>(availableOTNTokens[0]?.id || '');
  const [otnText, setOtnText] = useState<string>(
    `Good news ${contact.firstName || contact.name}! You asked to be notified: VIP Workshop tickets are now live!`
  );

  // Fields for WhatsApp Template
  const [waTemplateCategory, setWaTemplateCategory] = useState<'MARKETING' | 'UTILITY' | 'AUTHENTICATION'>('UTILITY');
  const [waTemplateName, setWaTemplateName] = useState('workshop_confirmation_v2');
  const [waParam1, setWaParam1] = useState(contact.firstName || 'there');
  const [waParam2, setWaParam2] = useState('Tomorrow 2:00 PM EST');

  // Fields for Cross-Channel Fallback
  const [fallbackChannel, setFallbackChannel] = useState<'sms' | 'email'>('sms');
  const [fallbackText, setFallbackText] = useState(
    `Hey ${contact.firstName || contact.name}, we responded to your bot question! Tap here to reopen Messenger and view your reply: https://m.me/chatmize?ref=reopen_window`
  );

  // Sending state
  const [isSending, setIsSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const followEmoji = useEmojiTargetMap<HTMLTextAreaElement>();

  // Policy validation for Message Tag
  const tagValidation = validateMessageTagCompliance(messageBody, selectedTag);

  const handleSend = async () => {
    setIsSending(true);
    setSendError(null);

    try {
      // Cross-channel SMS fallback sends for real through the backend
      // (Twilio number, opt-in enforcement, credit billing).
      if (selectedMode === 'cross_channel' && fallbackChannel === 'sms') {
        if (!workspaceId) throw new Error('Workspace is not available for SMS sending.');
        if (!contact.phone) throw new Error('This contact has no phone number on file.');
        if (contact.smsConsent) {
          await setSmsOptIn(workspaceId, contact.phone, true, 'contact_record');
        }
        await sendSms(workspaceId, contact.phone, fallbackText);
      } else {
        // Simulate real Meta Graph API call to /v19.0/me/messages with appropriate payload
        await new Promise(r => setTimeout(r, 600));
      }

      // Update contact in Firestore
      const updates: Partial<ContactRecord> = {
        lastInteractionAt: new Date().toISOString(),
      };

      // If OTN was used, mark token as consumed
      if (selectedMode === 'otn' && selectedOTNTokenId) {
        const updatedTokens = (contact.otnTokens || []).map(t => 
          t.id === selectedOTNTokenId ? { ...t, status: 'consumed' as const } : t
        );
        updates.otnTokens = updatedTokens;
      }

      await updateContactField(contact.id, updates);

      setSendSuccess(true);
      setTimeout(() => {
        if (onSuccess) onSuccess();
        onClose();
      }, 1200);
    } catch (err) {
      console.error('Failed to dispatch follow-up:', err);
      const message = err instanceof Error ? err.message : 'Send failed.';
      // Callable errors come through as "FirebaseError: ..."; surface the human part.
      setSendError(message.replace(/^.*?\]\s*/, '').replace(/^FirebaseError:\s*/, ''));
      setIsSending(false);
    }
  };

  return (
    <div 
      data-modal="true"
      className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
      onClick={onClose}
    >
      <div 
        className="bg-slate-900 border border-white/10 rounded-3xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-white/10 flex items-center justify-between bg-slate-950/70 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white">Meta Compliant Follow-Up Dispatcher</h2>
              </div>
              <p className="text-xs text-slate-400">
                Recipient: <span className="text-slate-200 font-semibold">{contact.name}</span> ({contact.channel.toUpperCase()})
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

        {/* 24-Hour Policy Banner */}
        <div className={`p-4 border-b text-xs flex items-center justify-between flex-shrink-0 ${
          is24hActive 
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
            : 'bg-amber-500/10 border-amber-500/20 text-amber-300'
        }`}>
          <div className="flex items-center gap-2.5">
            <Clock className="w-4 h-4 flex-shrink-0" />
            <div>
              <span className="font-bold">
                {is24hActive ? 'Standard 24-Hour Window: ACTIVE' : 'Standard 24-Hour Window: EXPIRED'}
              </span>
              <p className="text-[11px] opacity-85">
                {is24hActive 
                  ? `User messaged recently. ${hoursRemaining}h remaining in standard window (all message types permitted).`
                  : 'User has not messaged in the last 24h. Standard free-form messages are blocked by Meta. Select an authorized API below.'}
              </p>
            </div>
          </div>

          <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase whitespace-nowrap ${
            is24hActive ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
          }`}>
            {is24hActive ? `${hoursRemaining}h Left` : 'Window Closed'}
          </span>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* API Selector Tabs */}
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-2">
              Select Authorized Meta Delivery Protocol
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
              {is24hActive && (
                <button
                  type="button"
                  onClick={() => setSelectedMode('standard')}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    selectedMode === 'standard'
                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 ring-2 ring-emerald-500/20'
                      : 'bg-slate-950 border-white/10 text-slate-400 hover:text-white'
                  }`}
                >
                  <div className="font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Standard 24h
                  </div>
                  <div className="text-[10px] opacity-75 mt-0.5">Free-form / Promo OK</div>
                </button>
              )}

              <button
                type="button"
                onClick={() => setSelectedMode('recurring_notification')}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer relative ${
                  selectedMode === 'recurring_notification'
                    ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 ring-2 ring-cyan-500/20'
                    : 'bg-slate-950 border-white/10 text-slate-400 hover:text-white'
                }`}
              >
                {activeRNTokens.length > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-cyan-400"></span>
                )}
                <div className="font-bold flex items-center gap-1.5">
                  <BellRing className="w-3.5 h-3.5" /> Recurring Opt-In
                </div>
                <div className="text-[10px] opacity-75 mt-0.5">
                  {activeRNTokens.length > 0 ? `${activeRNTokens.length} Active Token` : 'No Token Opt-In'}
                </div>
              </button>

              <button
                type="button"
                onClick={() => setSelectedMode('message_tag')}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  selectedMode === 'message_tag'
                    ? 'bg-blue-500/20 border-blue-500 text-blue-300 ring-2 ring-blue-500/20'
                    : 'bg-slate-950 border-white/10 text-slate-400 hover:text-white'
                }`}
              >
                <div className="font-bold flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5" /> Message Tag
                </div>
                <div className="text-[10px] opacity-75 mt-0.5">Non-Promo (Event/Order)</div>
              </button>

              <button
                type="button"
                onClick={() => setSelectedMode('otn')}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  selectedMode === 'otn'
                    ? 'bg-purple-500/20 border-purple-500 text-purple-300 ring-2 ring-purple-500/20'
                    : 'bg-slate-950 border-white/10 text-slate-400 hover:text-white'
                }`}
              >
                <div className="font-bold flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5" /> One-Time Notif
                </div>
                <div className="text-[10px] opacity-75 mt-0.5">
                  {availableOTNTokens.length > 0 ? `${availableOTNTokens.length} Token Avail` : 'No Token'}
                </div>
              </button>

              {contact.channel === 'whatsapp' && (
                <button
                  type="button"
                  onClick={() => setSelectedMode('whatsapp_template')}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    selectedMode === 'whatsapp_template'
                      ? 'bg-green-500/20 border-green-500 text-green-300 ring-2 ring-green-500/20'
                      : 'bg-slate-950 border-white/10 text-slate-400 hover:text-white'
                  }`}
                >
                  <div className="font-bold flex items-center gap-1.5">
                    <MessageCircle className="w-3.5 h-3.5" /> WhatsApp Tmpl
                  </div>
                  <div className="text-[10px] opacity-75 mt-0.5">Meta Approved</div>
                </button>
              )}

              <button
                type="button"
                onClick={() => setSelectedMode('cross_channel')}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  selectedMode === 'cross_channel'
                    ? 'bg-amber-500/20 border-amber-500 text-amber-300 ring-2 ring-amber-500/20'
                    : 'bg-slate-950 border-white/10 text-slate-400 hover:text-white'
                }`}
              >
                <div className="font-bold flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5" /> Cross-Channel
                </div>
                <div className="text-[10px] opacity-75 mt-0.5">SMS / Email Fallback</div>
              </button>
            </div>
          </div>

          {/* Form specific to selected Mode */}
          {selectedMode === 'recurring_notification' && (
            <div className="space-y-4 p-4 rounded-2xl bg-cyan-500/5 border border-cyan-500/20 text-xs">
              <div className="flex items-center justify-between">
                <div className="font-bold text-cyan-300 flex items-center gap-1.5">
                  <BellRing className="w-4 h-4" /> Meta Marketing Messages / Recurring Notifications API
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300">
                  Promotions Allowed!
                </span>
              </div>

              {activeRNTokens.length === 0 ? (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 space-y-1">
                  <div className="font-bold flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" /> No active Recurring Notification token found for this contact.
                  </div>
                  <p className="text-[11px] opacity-85">
                    To send promotional broadcasts past 24h, you must first ask the user to tap "Get Updates" via a Recurring Notification Opt-In Card inside an active conversation.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                      Active User Opt-In Token
                    </label>
                    <select
                      value={selectedRNTokenId}
                      onChange={(e) => setSelectedRNTokenId(e.target.value)}
                      className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white outline-none focus:border-cyan-500 font-mono text-xs"
                    >
                      {activeRNTokens.map(tok => (
                        <option key={tok.id} value={tok.id}>
                          Topic: {tok.topic} ({tok.frequency.toUpperCase()} - Expires {new Date(tok.expiresAt).toLocaleDateString()})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-semibold text-slate-300 block">
                        Promotional Broadcast Copy (Marketing Allowed)
                      </label>
                      <div className="flex items-center gap-1">
                        <EmojiPickerButton onPick={(e) => followEmoji.insert('rnPromo', e, rnPromoText, setRnPromoText)} placement="up" />
                        <PersonalizationPickerButton
                          onPick={(t) => pz.insert('rnPromoText', t, rnPromoText, setRnPromoText)}
                          placement="up"
                          title="Insert personalization"
                        />
                      </div>
                    </div>
                    <textarea
                      rows={3}
                      ref={(el) => { followEmoji.setRef('rnPromo')(el); pz.setRef('rnPromoText')(el); }}
                      value={rnPromoText}
                      onChange={(e) => setRnPromoText(e.target.value)}
                      className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 pr-10 text-white outline-none focus:border-cyan-500 leading-relaxed"
                    />
                  </div>

                  <p className="text-[11px] text-slate-400">
                    Dispatched using Meta endpoint: <code className="text-cyan-400 font-mono">POST /v19.0/me/messages (recipient.notification_messages_token)</code>
                  </p>
                </div>
              )}
            </div>
          )}

          {selectedMode === 'message_tag' && (
            <div className="space-y-4 p-4 rounded-2xl bg-blue-500/5 border border-blue-500/20 text-xs">
              <div className="flex items-center justify-between">
                <div className="font-bold text-blue-300 flex items-center gap-1.5">
                  <Tag className="w-4 h-4" /> Meta Approved Message Tag (Non-Promotional 1:1)
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300">
                  Strictly Non-Promo
                </span>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                  Select Meta Approved Tag
                </label>
                <select
                  value={selectedTag}
                  onChange={(e) => setSelectedTag(e.target.value as MetaMessageTag)}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white outline-none focus:border-blue-500 text-xs"
                >
                  <option value="CONFIRMED_EVENT_UPDATE">CONFIRMED_EVENT_UPDATE - Registered Webinar / Event Reminder</option>
                  <option value="POST_PURCHASE_UPDATE">POST_PURCHASE_UPDATE - Order Invoice, Receipt, or Shipment Update</option>
                  <option value="ACCOUNT_UPDATE">ACCOUNT_UPDATE - Account security or application status</option>
                  <option value="HUMAN_AGENT">HUMAN_AGENT - 7-Day Live Agent Customer Support Response</option>
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-semibold text-slate-300 block">
                    Message Content (Non-Promotional Copy Only)
                  </label>
                  <div className="flex items-center gap-1">
                    <EmojiPickerButton onPick={(e) => followEmoji.insert('tagBody', e, messageBody, setMessageBody)} placement="up" />
                    <PersonalizationPickerButton
                      onPick={(t) => pz.insert('messageBody:tag', t, messageBody, setMessageBody)}
                      placement="up"
                      title="Insert personalization"
                    />
                  </div>
                </div>
                <textarea
                  rows={3}
                  ref={(el) => { followEmoji.setRef('tagBody')(el); pz.setRef('messageBody:tag')(el); }}
                  value={messageBody}
                  onChange={(e) => setMessageBody(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-white outline-none focus:border-blue-500 leading-relaxed"
                />
              </div>

              {/* Tag Policy Checker */}
              <div className={`p-3 rounded-xl border text-[11px] ${
                tagValidation.compliant 
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' 
                  : 'bg-red-500/10 border-red-500/20 text-red-300'
              }`}>
                {tagValidation.compliant ? (
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Compliant with Meta {selectedTag} policy guidelines.</span>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 font-bold">
                      <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                      <span>{tagValidation.message}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {selectedMode === 'otn' && (
            <div className="space-y-4 p-4 rounded-2xl bg-purple-500/5 border border-purple-500/20 text-xs">
              <div className="flex items-center justify-between">
                <div className="font-bold text-purple-300 flex items-center gap-1.5">
                  <Zap className="w-4 h-4" /> Meta One-Time Notification (OTN API)
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300">
                  1-Time Follow-Up
                </span>
              </div>

              {availableOTNTokens.length === 0 ? (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 space-y-1">
                  <div className="font-bold flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" /> No available OTN tokens for this contact.
                  </div>
                  <p className="text-[11px] opacity-85">
                    User must first click an OTN "Notify Me" card in the bot flow before you can send a one-time alert outside 24h.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                      Available User One-Time Token
                    </label>
                    <select
                      value={selectedOTNTokenId}
                      onChange={(e) => setSelectedOTNTokenId(e.target.value)}
                      className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white outline-none focus:border-purple-500 font-mono text-xs"
                    >
                      {availableOTNTokens.map(tok => (
                        <option key={tok.id} value={tok.id}>
                          Topic: {tok.topic} (Granted {new Date(tok.optedInAt).toLocaleDateString()})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-semibold text-slate-300 block">
                        Notification Body
                      </label>
                      <div className="flex items-center gap-1">
                        <EmojiPickerButton onPick={(e) => followEmoji.insert('otn', e, otnText, setOtnText)} placement="up" />
                        <PersonalizationPickerButton
                          onPick={(t) => pz.insert('otnText', t, otnText, setOtnText)}
                          placement="up"
                          title="Insert personalization"
                        />
                      </div>
                    </div>
                    <textarea
                      rows={3}
                      ref={(el) => { followEmoji.setRef('otn')(el); pz.setRef('otnText')(el); }}
                      value={otnText}
                      onChange={(e) => setOtnText(e.target.value)}
                      className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-white outline-none focus:border-purple-500 leading-relaxed"
                    />
                      value={otnText}
                      onChange={(e) => setOtnText(e.target.value)}
                      className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 pr-10 text-white outline-none focus:border-purple-500 leading-relaxed"
                    />
                    <span className="absolute right-2 bottom-2">
                      <PersonalizationPickerButton
                        onPick={(t) => pz.insert('otnText', t, otnText, setOtnText)}
                        placement="up"
                        title="Insert personalization"
                      />
                    </span>
                  </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {selectedMode === 'cross_channel' && (
            <div className="space-y-4 p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20 text-xs">
              <div className="flex items-center justify-between">
                <div className="font-bold text-amber-300 flex items-center gap-1.5">
                  <Phone className="w-4 h-4" /> Multi-Channel Fallback with Meta Re-Opening Link
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300">
                  Window Re-Opener
                </span>
              </div>

              <p className="text-[11px] text-slate-400">
                When Meta 24h window is closed, send an SMS or Email containing a direct <code className="text-cyan-400 font-mono">m.me</code> or <code className="text-pink-400 font-mono">ig.me</code> link. When user clicks and sends a reply, their 24-hour Meta window reopens immediately!
              </p>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setFallbackChannel('sms')}
                  className={`px-3 py-1.5 rounded-lg font-medium text-xs cursor-pointer ${
                    fallbackChannel === 'sms' ? 'bg-amber-600 text-white' : 'bg-slate-950 border border-white/10 text-slate-400'
                  }`}
                >
                  SMS (Twilio) to {contact.phone || 'No Phone'}
                </button>
                <button
                  type="button"
                  onClick={() => setFallbackChannel('email')}
                  className={`px-3 py-1.5 rounded-lg font-medium text-xs cursor-pointer ${
                    fallbackChannel === 'email' ? 'bg-amber-600 text-white' : 'bg-slate-950 border border-white/10 text-slate-400'
                  }`}
                >
                  Email (SendGrid) to {contact.email || 'No Email'}
                </button>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-semibold text-slate-300 block">
                    Message with Click-to-Chat Link
                  </label>
                  <div className="flex items-center gap-1">
                    <EmojiPickerButton onPick={(e) => followEmoji.insert('fallback', e, fallbackText, setFallbackText)} placement="up" />
                    <PersonalizationPickerButton
                      onPick={(t) => pz.insert('fallbackText', t, fallbackText, setFallbackText)}
                      placement="up"
                      title="Insert personalization"
                    />
                  </div>
                </div>
                <textarea
                  rows={3}
                  ref={(el) => { followEmoji.setRef('fallback')(el); pz.setRef('fallbackText')(el); }}
                  value={fallbackText}
                  onChange={(e) => setFallbackText(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-white outline-none focus:border-amber-500 leading-relaxed font-mono text-[11px]"
                />
                  value={fallbackText}
                  onChange={(e) => setFallbackText(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 pr-10 text-white outline-none focus:border-amber-500 leading-relaxed font-mono text-[11px]"
                />
                <span className="absolute right-2 bottom-2">
                  <PersonalizationPickerButton
                    onPick={(t) => pz.insert('fallbackText', t, fallbackText, setFallbackText)}
                    placement="up"
                    title="Insert personalization"
                  />
                </span>
              </div>
              </div>
            </div>
          )}

          {selectedMode === 'standard' && (
            <div className="space-y-4 p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 text-xs">
              <div className="flex items-center justify-between">
                <div className="font-bold text-emerald-300 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> Standard 24h Messenger / Instagram Send API
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300">
                  Any Content Permitted
                </span>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-semibold text-slate-300 block">
                    Message Copy
                  </label>
                  <div className="flex items-center gap-1">
                    <EmojiPickerButton onPick={(e) => followEmoji.insert('stdBody', e, messageBody, setMessageBody)} placement="up" />
                    <PersonalizationPickerButton
                      onPick={(t) => pz.insert('messageBody:standard', t, messageBody, setMessageBody)}
                      placement="up"
                      title="Insert personalization"
                    />
                  </div>
                </div>
                <textarea
                  rows={3}
                  ref={(el) => { followEmoji.setRef('stdBody')(el); pz.setRef('messageBody:standard')(el); }}
                  value={messageBody}
                  onChange={(e) => setMessageBody(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-white outline-none focus:border-emerald-500 leading-relaxed"
                />
                  value={messageBody}
                  onChange={(e) => setMessageBody(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 pr-10 text-white outline-none focus:border-emerald-500 leading-relaxed"
                />
                <span className="absolute right-2 bottom-2">
                  <PersonalizationPickerButton
                    onPick={(t) => pz.insert('messageBody:standard', t, messageBody, setMessageBody)}
                    placement="up"
                    title="Insert personalization"
                  />
                </span>
              </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-white/10 bg-slate-950/80 flex items-center justify-between text-xs flex-shrink-0">
          <div className="text-slate-400 text-[11px]">
            {selectedMode === 'message_tag' && !tagValidation.compliant ? (
              <span className="text-red-400 font-semibold flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" /> Cannot send: Remove promo words first
              </span>
            ) : (
              <span className="text-emerald-400 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" /> Compliant with Meta Graph Policy
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              disabled={isSending}
              className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-slate-300 font-medium transition-colors cursor-pointer"
            >
              Cancel
            </button>

            {sendError && (
              <p className="text-[11px] text-red-400 max-w-[220px] leading-snug">{sendError}</p>
            )}

            <button
              onClick={handleSend}
              disabled={
                isSending || 
                (selectedMode === 'message_tag' && !tagValidation.compliant) ||
                (selectedMode === 'recurring_notification' && activeRNTokens.length === 0) ||
                (selectedMode === 'otn' && availableOTNTokens.length === 0)
              }
              className={`px-5 py-2 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg cursor-pointer ${
                sendSuccess
                  ? 'bg-emerald-600 text-white shadow-emerald-500/25'
                  : selectedMode === 'message_tag' && !tagValidation.compliant
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-white/5'
                  : 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white shadow-blue-500/25'
              }`}
            >
              {isSending ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  <span>Dispatching via Meta API...</span>
                </>
              ) : sendSuccess ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Message Sent Successfully!</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Send Meta Follow-Up</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
