import React, { useState } from 'react';
import { 
  X, 
  Search, 
  Plus, 
  Zap, 
  Sparkles, 
  MessageSquare, 
  MessageCircle, 
  Instagram, 
  Smartphone, 
  Globe, 
  Link2, 
  QrCode, 
  Layout, 
  Layers, 
  ExternalLink, 
  Webhook, 
  FileText, 
  Radio, 
  Play, 
  UserCheck,
  Check,
  BookOpen,
  ArrowRight,
  ClipboardList
} from 'lucide-react';
import { 
  TriggerChannel, 
  TriggerTemplate, 
  TRIGGER_CATALOG 
} from '../types/metaMessaging';
import { sanitizeBrandText } from '../utils/brandGuard';

interface TriggerSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTrigger: (template: TriggerTemplate) => void;
  onOpenGuide?: (guideId: string) => void;
}

export function TriggerSelectorModal({
  isOpen,
  onClose,
  onSelectTrigger,
  onOpenGuide
}: TriggerSelectorModalProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  if (!isOpen) return null;

  const categories = [
    { id: 'all', label: 'All Entry Points', count: TRIGGER_CATALOG.length },
    { id: 'instagram', label: 'Instagram', count: TRIGGER_CATALOG.filter(t => t.category === 'instagram').length, icon: <Instagram className="w-3.5 h-3.5" /> },
    { id: 'messenger', label: 'Messenger', count: TRIGGER_CATALOG.filter(t => t.category === 'messenger').length, icon: <MessageCircle className="w-3.5 h-3.5" /> },
    { id: 'whatsapp', label: 'WhatsApp', count: TRIGGER_CATALOG.filter(t => t.category === 'whatsapp').length, icon: <Smartphone className="w-3.5 h-3.5" /> },
    { id: 'growth_tools', label: 'Growth Tools & Web', count: TRIGGER_CATALOG.filter(t => t.category === 'growth_tools').length, icon: <Globe className="w-3.5 h-3.5" /> },
    { id: 'integrations', label: 'Integrations & Webhooks', count: TRIGGER_CATALOG.filter(t => t.category === 'integrations').length, icon: <Webhook className="w-3.5 h-3.5" /> },
  ];

  const filteredTriggers = TRIGGER_CATALOG.filter(trigger => {
    const matchesCategory = selectedCategory === 'all' || trigger.category === selectedCategory;
    const query = searchQuery.toLowerCase().trim();
    const matchesQuery = !query || 
      trigger.title.toLowerCase().includes(query) ||
      trigger.description.toLowerCase().includes(query) ||
      trigger.badge.toLowerCase().includes(query) ||
      trigger.channel.toLowerCase().includes(query);
    return matchesCategory && matchesQuery;
  });

  const getChannelStyle = (channel: TriggerChannel) => {
    switch (channel) {
      case 'instagram':
        return {
          badgeBg: 'bg-pink-500/15 border-pink-500/30 text-pink-300',
          iconBg: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
          channelName: 'Instagram',
          icon: <Instagram className="w-4 h-4" />
        };
      case 'whatsapp':
        return {
          badgeBg: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300',
          iconBg: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
          channelName: 'WhatsApp',
          icon: <Smartphone className="w-4 h-4" />
        };
      case 'web':
        return {
          badgeBg: 'bg-cyan-500/15 border-cyan-500/30 text-cyan-300',
          iconBg: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
          channelName: 'Growth Tool',
          icon: <Globe className="w-4 h-4" />
        };
      case 'integrations':
        return {
          badgeBg: 'bg-amber-500/15 border-amber-500/30 text-amber-300',
          iconBg: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
          channelName: 'API / Webhook',
          icon: <Webhook className="w-4 h-4" />
        };
      default:
        return {
          badgeBg: 'bg-blue-500/15 border-blue-500/30 text-blue-300',
          iconBg: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
          channelName: 'Messenger',
          icon: <MessageCircle className="w-4 h-4" />
        };
    }
  };

  const renderTriggerIcon = (iconName: string, channel: TriggerChannel) => {
    switch (iconName) {
      case 'Instagram': return <Instagram className="w-4 h-4" />;
      case 'MessageSquare': return <MessageSquare className="w-4 h-4" />;
      case 'MessageCircle': return <MessageCircle className="w-4 h-4" />;
      case 'Sparkles': return <Sparkles className="w-4 h-4" />;
      case 'Play': return <Play className="w-4 h-4" />;
      case 'Link2': return <Link2 className="w-4 h-4" />;
      case 'Zap': return <Zap className="w-4 h-4" />;
      case 'Radio': return <Radio className="w-4 h-4" />;
      case 'Globe': return <Globe className="w-4 h-4" />;
      case 'QrCode': return <QrCode className="w-4 h-4" />;
      case 'Smartphone': return <Smartphone className="w-4 h-4" />;
      case 'UserCheck': return <UserCheck className="w-4 h-4" />;
      case 'Layout': return <Layout className="w-4 h-4" />;
      case 'Layers': return <Layers className="w-4 h-4" />;
      case 'ExternalLink': return <ExternalLink className="w-4 h-4" />;
      case 'Webhook': return <Webhook className="w-4 h-4" />;
      case 'FileText': return <FileText className="w-4 h-4" />;
      case 'ClipboardList': return <ClipboardList className="w-4 h-4" />;
      default: return getChannelStyle(channel).icon;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md">
      <div className="bg-slate-900 border border-white/10 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-5 sm:px-6 py-4 border-b border-white/10 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-cyan-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white">Choose a Trigger / Entry Point</h2>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  Chatmize Omnichannel Engine
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Unified multi-channel opt-in triggers. Every inbound subscriber interaction automatically activates the Meta 24-hour standard messaging window.
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

        {/* Quick Launch High-Converting Presets */}
        <div className="px-5 sm:px-6 py-2.5 bg-gradient-to-r from-blue-950/30 via-slate-900 to-cyan-950/30 border-b border-white/5 flex items-center gap-2 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-300 flex-shrink-0">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>1-Click Presets:</span>
          </div>
          {[
            { 
              label: '🔥 Reel / Post Auto-DM', 
              type: 'ig_comment_to_dm',
              desc: 'Auto-replies to comments with a private DM link'
            },
            { 
              label: '🎁 Story Mention Voucher', 
              type: 'ig_story_reply',
              desc: 'Rewards story tags with a coupon code'
            },
            { 
              label: '🔗 Bio / Ref Link', 
              type: 'ig_ref_link',
              desc: 'High-converting direct DM referral URL'
            },
            { 
              label: '💬 WhatsApp Direct Lead', 
              type: 'wa_link',
              desc: 'Click-to-WhatsApp with pre-filled prompt'
            },
          ].map(preset => {
            const match = TRIGGER_CATALOG.find(t => t.type === preset.type);
            if (!match) return null;
            return (
              <button
                key={preset.type}
                onClick={() => onSelectTrigger(match)}
                title={preset.desc}
                className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-200 border border-white/10 hover:border-cyan-500/30 text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1 whitespace-nowrap"
              >
                <span>{preset.label}</span>
                <ArrowRight className="w-3 h-3 text-slate-400" />
              </button>
            );
          })}
        </div>

        {/* Search & Category Tabs */}
        <div className="p-4 sm:p-5 border-b border-white/5 space-y-3 bg-slate-900/50">
          {/* Search Bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search triggers (e.g. keywords, comments, ads, modal popup, referral link, qr code, webhook)..."
              className="w-full bg-slate-950 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-cyan-500 transition-colors"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
              >
                Clear
              </button>
            )}
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {categories.map((cat) => {
              const active = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer ${
                    active 
                      ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-white shadow-md shadow-emerald-500/20' 
                      : 'bg-slate-950/60 text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-white/5'
                  }`}
                >
                  {cat.icon && <span className="opacity-80">{cat.icon}</span>}
                  <span>{cat.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${active ? 'bg-white/20 text-white' : 'bg-white/10 text-slate-400'}`}>
                    {cat.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Trigger Catalog Grid */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {filteredTriggers.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Search className="w-8 h-8 mx-auto mb-2 text-slate-600" />
              <p className="text-sm font-semibold">No triggers found matching "{searchQuery}"</p>
              <p className="text-xs text-slate-600 mt-1">Try searching for keywords, comments, ad, or popup</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              {filteredTriggers.map((trigger) => {
                const style = getChannelStyle(trigger.channel);
                return (
                  <div
                    key={trigger.type}
                    onClick={() => onSelectTrigger(trigger)}
                    className="p-4 rounded-2xl bg-slate-950/60 border border-white/10 hover:border-cyan-500/50 hover:bg-slate-950 hover:shadow-lg hover:shadow-cyan-500/5 transition-all cursor-pointer group flex flex-col justify-between text-left"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2.5">
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center border ${style.iconBg}`}>
                            {renderTriggerIcon(trigger.icon, trigger.channel)}
                          </div>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border uppercase tracking-wider ${style.badgeBg}`}>
                            {style.channelName}
                          </span>
                        </div>

                        {trigger.badge && (
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-white/10 text-slate-300 border border-white/10">
                            {trigger.badge}
                          </span>
                        )}
                      </div>

                      <h3 className="text-sm font-bold text-white group-hover:text-cyan-300 transition-colors mb-1">
                        {trigger.title}
                      </h3>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        {trigger.description}
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between gap-2">
                      <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" />
                        <span>Opens Meta 24h Window</span>
                      </span>

                      <div className="flex items-center gap-1.5">
                        {onOpenGuide && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const guideKey = trigger.type.startsWith('guide_') ? trigger.type : `guide_${trigger.type}`;
                              onOpenGuide(guideKey);
                            }}
                            className="px-2 py-1 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer"
                            title="Read complete trigger documentation"
                          >
                            <BookOpen className="w-3 h-3 text-cyan-400" />
                            <span>Guide</span>
                          </button>
                        )}
                        <span className="px-2.5 py-1 bg-cyan-500/10 group-hover:bg-cyan-500 text-cyan-300 group-hover:text-slate-950 rounded-lg text-xs font-bold flex items-center gap-1 transition-all">
                          <Plus className="w-3 h-3" />
                          <span>Add to Flow</span>
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Policy Reassurance */}
        <div className="px-6 py-3.5 border-t border-white/10 bg-slate-950/80 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Multiple entry points can be active simultaneously on a single Starting Step.</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl font-semibold transition-colors cursor-pointer text-xs"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
}
