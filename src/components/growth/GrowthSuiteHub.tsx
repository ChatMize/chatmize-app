import React, { useState, useEffect } from 'react';
import { 
  MessageSquare, 
  Layout, 
  Link2, 
  Globe, 
  Sliders, 
  Layers, 
  Maximize2,
  Sparkles,
  Zap,
  CheckCircle2,
  ShieldCheck
} from 'lucide-react';
import { SupportChatView } from './SupportChatView';
import { WebsiteOverlaysView } from './WebsiteOverlaysView';
import { GrowthLinksView } from './GrowthLinksView';
import { OverlayType } from '../../types/growthTools';

export type GrowthSuiteTab = 'support_chat' | 'overlays' | 'growth_links';

interface GrowthSuiteHubProps {
  initialTab?: GrowthSuiteTab;
  initialOverlayFilter?: OverlayType | 'all';
  availableBots?: Array<{ id: string; name: string }>;
  onNavigateToFlows?: (botId?: string) => void;
  workspaceId: string;
  workspaceName?: string;
  workspaceSlug?: string;
  onTabChange?: (tab: GrowthSuiteTab) => void;
}

const GROWTH_TAB_KEY = 'chatmize_growth_tab';

export const GrowthSuiteHub: React.FC<GrowthSuiteHubProps> = ({
  initialTab,
  initialOverlayFilter = 'all',
  availableBots,
  onNavigateToFlows,
  workspaceId,
  workspaceName = 'Apex Marketing',
  workspaceSlug = 'apex-marketing',
  onTabChange
}) => {
  // Tab persists across refreshes (task: page selection survives reload).
  const [activeTab, setActiveTab] = useState<GrowthSuiteTab>(() => {
    if (initialTab) return initialTab;
    const saved = localStorage.getItem(GROWTH_TAB_KEY);
    return saved === 'overlays' || saved === 'growth_links' ? saved : 'support_chat';
  });
  const [overlayFilter, setOverlayFilter] = useState<OverlayType | 'all'>(initialOverlayFilter);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  useEffect(() => {
    if (initialOverlayFilter) {
      setOverlayFilter(initialOverlayFilter);
    }
  }, [initialOverlayFilter]);

  const handleTabSwitch = (tab: GrowthSuiteTab) => {
    setActiveTab(tab);
    try { localStorage.setItem(GROWTH_TAB_KEY, tab); } catch { /* ignore */ }
    onTabChange?.(tab);
  };

  return (
    <div className="space-y-6">
      
      {/* Top Main Navigation Bar for Separated Growth Tools */}
      <div className="bg-slate-900/90 border border-white/10 rounded-2xl p-2 shadow-lg backdrop-blur-md">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          
          {/* Tool 1: Live Support Chat */}
          <button
            onClick={() => handleTabSwitch('support_chat')}
            className={`p-3 rounded-xl transition-all cursor-pointer flex items-center gap-3 text-left ${
              activeTab === 'support_chat'
                ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-white border border-cyan-500/40 shadow-md ring-1 ring-cyan-500/30'
                : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
              activeTab === 'support_chat' ? 'bg-cyan-500 text-slate-950 font-bold' : 'bg-slate-800 text-cyan-400'
            }`}>
              <MessageSquare className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold truncate">Live Support Chat</span>
                <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-cyan-500/20 text-cyan-300 font-mono">
                  Isolated Tool
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate">Dedicated 24/7 AI chat widget</p>
            </div>
          </button>

          {/* Tool 2: Website Overlays */}
          <button
            onClick={() => handleTabSwitch('overlays')}
            className={`p-3 rounded-xl transition-all cursor-pointer flex items-center gap-3 text-left ${
              activeTab === 'overlays'
                ? 'bg-gradient-to-r from-blue-500/20 to-indigo-500/20 text-white border border-blue-500/40 shadow-md ring-1 ring-blue-500/30'
                : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
              activeTab === 'overlays' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-blue-400'
            }`}>
              <Layout className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold truncate">Website Overlays</span>
                <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-blue-500/20 text-blue-300 font-mono">
                  4 Formats
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate">Exit Pops, Sliders, Takeovers, Bars</p>
            </div>
          </button>

          {/* Tool 3: Growth Links & send.chat Cloaker */}
          <button
            onClick={() => handleTabSwitch('growth_links')}
            className={`p-3 rounded-xl transition-all cursor-pointer flex items-center gap-3 text-left ${
              activeTab === 'growth_links'
                ? 'bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-white border border-purple-500/40 shadow-md ring-1 ring-purple-500/30'
                : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
              activeTab === 'growth_links' ? 'bg-purple-600 text-white' : 'bg-slate-800 text-purple-400'
            }`}>
              <Link2 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold truncate">Growth Links</span>
                <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-purple-500/20 text-purple-300 font-mono">
                  send.chat
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate">send.chat Cloaker, m.me, ig.me</p>
            </div>
          </button>

        </div>
      </div>

      {/* Render the Active Isolated Tool */}
      {activeTab === 'support_chat' && (
        <SupportChatView
          availableBots={availableBots}
          onNavigateToFlows={onNavigateToFlows}
          workspaceId={workspaceId}
        />
      )}

      {activeTab === 'overlays' && (
        <WebsiteOverlaysView 
          availableBots={availableBots}
          onNavigateToFlows={onNavigateToFlows}
          initialFilter={overlayFilter}
        />
      )}

      {activeTab === 'growth_links' && (
        <GrowthLinksView 
          workspaceName={workspaceName}
          workspaceSlug={workspaceSlug}
          availableBots={availableBots}
          onNavigateToFlows={onNavigateToFlows}
        />
      )}

    </div>
  );
};
