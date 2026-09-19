import React, { useState } from 'react';
import { 
  AlertTriangle, 
  BellRing, 
  Bot, 
  Check, 
  CheckCircle2, 
  Clock, 
  ExternalLink, 
  Facebook, 
  Globe, 
  HelpCircle, 
  Info, 
  Instagram, 
  Lock, 
  Mail, 
  MessageCircle, 
  MessageSquare, 
  Phone, 
  Plus, 
  Send, 
  ShieldAlert, 
  ShieldCheck, 
  Sparkles, 
  Tag, 
  UserCheck, 
  Zap 
} from 'lucide-react';
import { META_MESSAGING_RULES, MetaPermissionRule } from '../types/metaMessaging';

export function Channels() {
  const [activeTab, setActiveTab] = useState<'channels' | 'meta_rules' | 'permissions'>('channels');
  const [selectedRule, setSelectedRule] = useState<MetaPermissionRule>(META_MESSAGING_RULES[0]);

  return (
    <div className="flex-1 flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-xl font-bold text-white">Connected Channels & Meta Messaging Policies</h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30">
              Meta Graph API v19.0
            </span>
          </div>
          <p className="text-slate-400 text-sm">
            Manage deployments, 24-hour messaging window compliance, Meta permission scopes, and post-24h follow-up APIs.
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-900 border border-white/10 rounded-2xl text-xs font-semibold self-start sm:self-auto">
          <button
            onClick={() => setActiveTab('channels')}
            className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
              activeTab === 'channels'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Channels
          </button>
          <button
            onClick={() => setActiveTab('meta_rules')}
            className={`px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'meta_rules'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>24h Rules & Follow-Up APIs</span>
          </button>
          <button
            onClick={() => setActiveTab('permissions')}
            className={`px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'permissions'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Lock className="w-3.5 h-3.5 text-amber-400" />
            <span>Graph API Permissions</span>
          </button>
        </div>
      </div>

      {/* TAB 1: CONNECTED CHANNELS */}
      {activeTab === 'channels' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <ChannelCard 
              name="Facebook Messenger" 
              channelKey="messenger"
              description="Automate Messenger conversations, live Click-to-Messenger Ads, and recurring notifications." 
              icon={<MessageSquare className="w-6 h-6 text-blue-500" />} 
              connected={true} 
              accountName="Chatmize Official Page"
              pageId="102948192039128"
              windowBadge="24-Hour Window Active"
            />
            <ChannelCard 
              name="Instagram Direct" 
              channelKey="instagram"
              description="Automate DMs, Story mentions, Reels reactions, and live comment-to-DM triggers on Instagram." 
              icon={<Instagram className="w-6 h-6 text-pink-500" />} 
              connected={true} 
              accountName="@chatmize"
              pageId="ig_9182749102938"
              windowBadge="24-Hour Window Active"
            />
            <ChannelCard 
              name="WhatsApp Cloud API" 
              channelKey="whatsapp"
              description="Official Meta WhatsApp Business Platform. Requires pre-approved templates for outside-24h messaging." 
              icon={<MessageCircle className="w-6 h-6 text-green-500" />} 
              connected={true} 
              accountName="+1 (800) 555-BOTS"
              pageId="waba_38192049182"
              windowBadge="Meta Templates Enabled"
            />
            <ChannelCard 
              name="Web Chat Widget" 
              channelKey="web"
              description="Embed a zero-latency standalone AI chat widget on any website or e-commerce store." 
              icon={<Globe className="w-6 h-6 text-cyan-400" />} 
              connected={true} 
              accountName="chatmize.io/embed"
              pageId="widget_prod_v3"
              windowBadge="No 24h Restriction (Free Web)"
            />
            <ChannelCard 
              name="SMS & Mobile Re-Engagement" 
              channelKey="sms"
              description="Twilio SMS integration to send fallback click-to-chat links when Meta 24-hour windows close." 
              icon={<Phone className="w-6 h-6 text-amber-400" />} 
              connected={true} 
              accountName="Toll-Free Verified 10DLC"
              pageId="+1 (833) 242-8649"
              windowBadge="TCPA & CTIA Compliant"
            />
            <ChannelCard 
              name="TikTok Direct Messages" 
              channelKey="tiktok"
              description="Automate TikTok Direct Messages and lead generation forms." 
              icon={<Facebook className="w-6 h-6 text-slate-300" />} 
              connected={false} 
              accountName="Not Connected"
              pageId=""
              windowBadge="Coming Soon"
              comingSoon={true}
            />
          </div>

          {/* Quick Meta Policy Overview Banner */}
          <div className="p-5 rounded-3xl bg-slate-900/80 border border-blue-500/20 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-2xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 flex-shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-sm text-white">Meta 24-Hour Standard Messaging Policy Active</h3>
                <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
                  Every user DM begins a 24-hour window where standard promotional and conversational messages are permitted. To follow up past 24 hours, ChatMize automatically orchestrates Meta Message Tags, Recurring Notifications (Marketing Messages), One-Time Notifications, or approved WhatsApp Templates.
                </p>
              </div>
            </div>

            <button
              onClick={() => setActiveTab('meta_rules')}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all cursor-pointer whitespace-nowrap shadow-lg shadow-blue-500/20"
            >
              Explore 24h+ Follow-Up APIs
            </button>
          </div>
        </div>
      )}

      {/* TAB 2: META 24H RULES & FOLLOW-UP APIS */}
      {activeTab === 'meta_rules' && (
        <div className="space-y-6">
          <div className="p-4 rounded-2xl bg-slate-900 border border-white/10 text-xs text-slate-300 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Clock className="w-4 h-4 text-blue-400 flex-shrink-0" />
              <span>
                <strong>Meta Developer Guidelines:</strong> Understanding how to legitimately respond, request opt in permissions, and re-engage users outside the 24-hour window.
              </span>
            </div>
            <a 
              href="https://developers.facebook.com/docs/messenger-platform/policy/policy-overview" 
              target="_blank" 
              rel="noreferrer"
              className="text-blue-400 hover:text-blue-300 flex items-center gap-1 font-semibold transition-colors"
            >
              <span>Meta Official Docs</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          {/* Master Grid of Meta APIs */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {META_MESSAGING_RULES.map((rule) => {
              const isSelected = selectedRule.id === rule.id;
              return (
                <div 
                  key={rule.id}
                  onClick={() => setSelectedRule(rule)}
                  className={`p-5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                    isSelected 
                      ? 'bg-slate-900 border-blue-500 ring-2 ring-blue-500/20 shadow-xl' 
                      : 'bg-slate-900/60 border-white/10 hover:border-white/20 hover:bg-slate-900'
                  }`}
                >
                  <div className="space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-sm text-white">{rule.name}</h4>
                        <span className="font-mono text-[10px] text-cyan-400 block mt-0.5">{rule.apiName}</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase whitespace-nowrap ${
                        rule.promotionalAllowed 
                          ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' 
                          : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                      }`}>
                        {rule.promotionalAllowed ? 'Promo OK' : 'Non-Promo'}
                      </span>
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed">{rule.description}</p>
                  </div>

                  <div className="pt-3 border-t border-white/5 space-y-1 text-[11px] mt-4">
                    <div className="flex justify-between text-slate-400">
                      <span>Window:</span>
                      <span className="text-slate-200 font-semibold">{rule.allowedWindow}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Opt In:</span>
                      <span className="text-slate-200 font-semibold">{rule.requiresUserOptIn ? 'Required' : 'Standard'}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Deep Dive on Selected Rule */}
          <div className="p-6 rounded-3xl bg-slate-900 border border-white/10 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">{selectedRule.name}</h3>
                  <span className="font-mono text-xs text-cyan-400">{selectedRule.apiName}</span>
                </div>
              </div>

              <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                selectedRule.promotionalAllowed 
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
              }`}>
                {selectedRule.promotionalAllowed ? 'Promotional Messages Allowed' : 'Strictly Non-Promotional Only'}
              </span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              {selectedRule.description}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-white/5 space-y-1">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Permitted Messaging Window</span>
                <span className="text-xs font-semibold text-white">{selectedRule.allowedWindow}</span>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-white/5 space-y-1">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Permission Scopes Required</span>
                <span className="text-xs font-mono text-blue-400 truncate block">{selectedRule.graphPermissionRequired}</span>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-white/5 space-y-1">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">User Opt In Requirement</span>
                <span className="text-xs font-semibold text-emerald-400">
                  {selectedRule.requiresUserOptIn ? 'User must tap explicit button' : 'Implicit (Initiated by transaction)'}
                </span>
              </div>
            </div>

            {/* Do's and Don'ts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 space-y-2 text-xs">
                <div className="font-bold text-emerald-300 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Permitted Under Meta Guidelines
                </div>
                <ul className="space-y-1 text-slate-300 list-disc pl-4 text-[11px] leading-relaxed">
                  <li>Sending automated reminders for webinars, appointments, or registered sessions.</li>
                  <li>Informing buyers of tracking numbers, receipts, and order progress.</li>
                  <li>Broadcasting weekly promos to contacts who explicitly clicked "Get Updates" via Recurring Notifications.</li>
                  <li>Answering complex customer queries with a live human within 7 days.</li>
                </ul>
              </div>

              <div className="p-4 rounded-2xl bg-red-500/5 border border-red-500/20 space-y-2 text-xs">
                <div className="font-bold text-red-300 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-red-400" /> Prohibited (Triggers Page Suspension)
                </div>
                <ul className="space-y-1 text-slate-300 list-disc pl-4 text-[11px] leading-relaxed">
                  <li>Including promo codes, discounts, sales, or checkout links inside Message Tags.</li>
                  <li>Sending unrequested marketing broadcasts past 24h without a Recurring Notification token.</li>
                  <li>Using automated bots under the HUMAN_AGENT tag (must be live agent).</li>
                  <li>Re-prompting users for Recurring Notification opt in more than once per week.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: GRAPH API PERMISSIONS */}
      {activeTab === 'permissions' && (
        <div className="space-y-6">
          <div className="p-5 rounded-3xl bg-slate-900 border border-white/10 space-y-4">
            <div>
              <h3 className="font-bold text-base text-white mb-1">Required Meta Graph API Permissions & App Review</h3>
              <p className="text-xs text-slate-400">
                To send automated responses, capture user profiles, and send follow-ups outside 24h, your Meta App requires the following approved permissions:
              </p>
            </div>

            <div className="space-y-3">
              {[
                {
                  permission: 'pages_messaging',
                  feature: 'Facebook Messenger Core Send/Receive',
                  description: 'Required to send and receive messages as a Facebook Page, including quick replies, carousels, and 24h window messages.',
                  status: 'Granted (Active)',
                },
                {
                  permission: 'instagram_manage_messages',
                  feature: 'Instagram Direct Messaging',
                  description: 'Required to automate DMs, Story replies, and comment-to-DM triggers on connected Instagram Business accounts.',
                  status: 'Granted (Active)',
                },
                {
                  permission: 'pages_messaging_subscriptions',
                  feature: 'Meta Recurring Notifications (Marketing Messages)',
                  description: 'Required to deliver daily, weekly, or monthly promotional messages outside the 24-hour window using user opt in tokens.',
                  status: 'Granted (Active)',
                },
                {
                  permission: 'human_agent',
                  feature: 'Human Agent 7-Day Extension Tag',
                  description: 'Permits live customer support agents to reply to user inquiries within 7 days (168 hours) instead of 24 hours.',
                  status: 'Granted (Active)',
                },
                {
                  permission: 'whatsapp_business_messaging',
                  feature: 'WhatsApp Cloud API Business Messaging',
                  description: 'Allows sending two-way customer support messages and pre-approved marketing/utility templates on WhatsApp.',
                  status: 'Granted (Active)',
                },
                {
                  permission: 'pages_read_engagement',
                  feature: 'Organic Post & Reel Comment Triggers',
                  description: 'Detects when an Instagram user or Facebook user comments on a post or Reel, triggering an instant DM follow-up.',
                  status: 'Granted (Active)',
                }
              ].map((item, idx) => (
                <div key={idx} className="p-4 rounded-2xl bg-slate-950/80 border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-cyan-300">{item.permission}</span>
                      <span className="text-slate-400 text-[11px]">— {item.feature}</span>
                    </div>
                    <p className="text-slate-400 text-[11px] leading-relaxed max-w-2xl">{item.description}</p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 whitespace-nowrap self-start sm:self-auto">
                    {item.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ChannelCard({ 
  name, 
  channelKey,
  description, 
  icon, 
  connected, 
  accountName,
  pageId,
  windowBadge,
  comingSoon = false
}: { 
  name: string;
  channelKey: string;
  description: string;
  icon: React.ReactNode;
  connected: boolean;
  accountName?: string;
  pageId?: string;
  windowBadge?: string;
  comingSoon?: boolean;
}) {
  return (
    <div className="bg-slate-900/80 border border-white/10 rounded-3xl p-5 flex flex-col justify-between hover:border-white/20 transition-all shadow-lg">
      <div className="space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-slate-950 rounded-2xl border border-white/10">
              {icon}
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">{name}</h3>
              {accountName && (
                <span className="text-[11px] text-slate-400 block font-mono">{accountName}</span>
              )}
            </div>
          </div>

          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
            comingSoon
              ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
              : connected 
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                : 'bg-slate-800 text-slate-400 border border-slate-700'
          }`}>
            {comingSoon ? 'Coming Soon' : connected ? 'Connected' : 'Disconnected'}
          </span>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed">{description}</p>

        {windowBadge && (
          <div className={`p-2 rounded-xl border flex items-center gap-1.5 text-[11px] font-medium ${
            comingSoon 
              ? 'bg-amber-500/10 border-amber-500/20 text-amber-300'
              : 'bg-blue-500/10 border-blue-500/20 text-blue-300'
          }`}>
            <Clock className={`w-3.5 h-3.5 flex-shrink-0 ${comingSoon ? 'text-amber-400' : 'text-blue-400'}`} />
            <span>{windowBadge}</span>
          </div>
        )}
      </div>

      <div className="pt-4 border-t border-white/5 mt-4">
        {comingSoon ? (
          <button 
            disabled 
            className="w-full py-2 rounded-xl font-semibold text-xs bg-slate-800/80 border border-slate-700/60 text-slate-400 cursor-not-allowed flex items-center justify-center gap-1.5"
          >
            <span>Coming Soon</span>
          </button>
        ) : (
          <button className={`w-full py-2 rounded-xl font-semibold text-xs transition-all cursor-pointer ${
            connected 
              ? 'bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200' 
              : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-md'
          }`}>
            {connected ? 'Channel Settings' : 'Connect Account'}
          </button>
        )}
      </div>
    </div>
  );
}
