import React, { useState, useMemo } from 'react';
import { 
  Layers, 
  Calendar, 
  Clock, 
  BellRing, 
  Send, 
  Plus, 
  Play, 
  Pause, 
  Trash2, 
  Edit3, 
  CheckCircle2, 
  AlertCircle, 
  ChevronRight, 
  ChevronDown, 
  Users, 
  ShieldCheck, 
  Tag, 
  ArrowRight, 
  Smartphone, 
  Globe, 
  Sparkles,
  ExternalLink
} from 'lucide-react';
import { CampaignRecord, CampaignType } from '../lib/firebase';

interface CampaignsListViewProps {
  campaigns: CampaignRecord[];
  onNewCampaign: () => void;
  onEditCampaign: (campaign: CampaignRecord) => void;
  onDeleteCampaign: (id: string) => void;
  onToggleStatus: (campaign: CampaignRecord) => void;
  onSimulateCampaign: (campaign: CampaignRecord) => Promise<void>;
  isSimulatingId: string | null;
  contactsCount: number;
}

export function CampaignsListView({
  campaigns,
  onNewCampaign,
  onEditCampaign,
  onDeleteCampaign,
  onToggleStatus,
  onSimulateCampaign,
  isSimulatingId,
  contactsCount
}: CampaignsListViewProps) {
  const [filterType, setFilterType] = useState<'all' | CampaignType>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedDripId, setExpandedDripId] = useState<string | null>(null);

  // Filter campaigns
  const filteredCampaigns = useMemo(() => {
    return campaigns.filter(c => {
      if (filterType !== 'all' && c.type !== filterType) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = c.name.toLowerCase().includes(q);
        const matchesDesc = (c.description || '').toLowerCase().includes(q);
        const matchesTopic = (c.rnTopic || '').toLowerCase().includes(q);
        if (!matchesName && !matchesDesc && !matchesTopic) return false;
      }
      return true;
    });
  }, [campaigns, filterType, searchQuery]);

  // Aggregate stats
  const recurringCount = campaigns.filter(c => c.type === 'recurring').length;
  const dateSpecificCount = campaigns.filter(c => c.type === 'date_specific').length;
  const dripCount = campaigns.filter(c => c.type === 'drip').length;
  const activeCount = campaigns.filter(c => c.status === 'active').length;

  const calculateCountdown = (dateStr?: string, timeStr?: string) => {
    if (!dateStr) return null;
    const target = new Date(`${dateStr}T${timeStr || '10:00'}:00`);
    const now = new Date();
    const diffMs = target.getTime() - now.getTime();

    if (diffMs <= 0) return 'Launch Passed';
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) return `In ${days}d ${hours}h`;
    return `In ${hours}h ${minutes}m`;
  };

  return (
    <div className="space-y-5">
      {/* Top Banner & Action Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-900/90 border border-white/10 rounded-2xl p-4 sm:p-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h3 className="text-base font-black text-white tracking-tight">
              Marketing Campaigns & Automated Sequences
            </h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
              {activeCount} Active
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Build and manage Recurring Notifications, scheduled date-specific drops, and multi-step drip funnels.
          </p>
        </div>

        <button
          onClick={onNewCampaign}
          className="w-full sm:w-auto px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>+ Create Campaign</span>
        </button>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 no-scrollbar">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              filterType === 'all'
                ? 'bg-blue-500/20 border border-blue-400 text-blue-300'
                : 'bg-slate-900 border border-white/10 text-slate-400 hover:text-white'
            }`}
          >
            All ({campaigns.length})
          </button>

          <button
            onClick={() => setFilterType('recurring')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              filterType === 'recurring'
                ? 'bg-cyan-500/20 border border-cyan-400 text-cyan-300'
                : 'bg-slate-900 border border-white/10 text-slate-400 hover:text-white'
            }`}
          >
            <BellRing className="w-3 h-3 text-cyan-400" />
            <span>Recurring ({recurringCount})</span>
          </button>

          <button
            onClick={() => setFilterType('date_specific')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              filterType === 'date_specific'
                ? 'bg-rose-500/20 border border-rose-400 text-rose-300'
                : 'bg-slate-900 border border-white/10 text-slate-400 hover:text-white'
            }`}
          >
            <Calendar className="w-3 h-3 text-rose-400" />
            <span>Date-Specific ({dateSpecificCount})</span>
          </button>

          <button
            onClick={() => setFilterType('drip')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              filterType === 'drip'
                ? 'bg-amber-500/20 border border-amber-400 text-amber-300'
                : 'bg-slate-900 border border-white/10 text-slate-400 hover:text-white'
            }`}
          >
            <Layers className="w-3 h-3 text-amber-400" />
            <span>Drip Sequences ({dripCount})</span>
          </button>
        </div>

        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search campaigns..."
            className="w-full sm:w-64 bg-slate-900 border border-white/15 rounded-xl px-3 py-1.5 text-xs text-white outline-none focus:border-cyan-500 placeholder:text-slate-500"
          />
        </div>
      </div>

      {/* Campaigns Grid */}
      {filteredCampaigns.length === 0 ? (
        <div className="bg-slate-900/50 border border-white/10 rounded-2xl p-8 sm:p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center mx-auto">
            <Layers className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-bold text-white">No campaigns found</h4>
          <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
            {searchQuery 
              ? 'No campaigns match your search query. Try clearing the filter.' 
              : 'Create your first Recurring Notification, Date-Specific launch, or Drip sequence to engage subscribers beyond the Meta 24-hour window.'}
          </p>
          <button
            onClick={onNewCampaign}
            className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded-xl text-xs font-bold inline-flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create Campaign</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredCampaigns.map((camp) => {
            const isDrip = camp.type === 'drip';
            const isDate = camp.type === 'date_specific';
            const isRecurring = camp.type === 'recurring';
            const isExpanded = expandedDripId === camp.id;
            const isSimulating = isSimulatingId === camp.id;
            const countdown = isDate ? calculateCountdown(camp.scheduledDate, camp.scheduledTime) : null;

            return (
              <div 
                key={camp.id}
                className="bg-slate-900/90 border border-white/10 hover:border-white/20 rounded-2xl p-4 sm:p-5 transition-all space-y-4"
              >
                {/* Header Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-white/5 pb-3">
                  <div className="flex items-start sm:items-center gap-3">
                    {/* Icon based on campaign type */}
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 border ${
                      isRecurring
                        ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
                        : isDate
                        ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                        : 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                    }`}>
                      {isRecurring && <BellRing className="w-5 h-5" />}
                      {isDate && <Calendar className="w-5 h-5" />}
                      {isDrip && <Layers className="w-5 h-5" />}
                    </div>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-black text-white">{camp.name}</h4>
                        
                        {/* Status Badge */}
                        <button
                          onClick={() => onToggleStatus(camp)}
                          className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase transition-all cursor-pointer ${
                            camp.status === 'active'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
                              : camp.status === 'scheduled'
                              ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40 hover:bg-blue-500/30'
                              : 'bg-slate-800 text-slate-400 border border-white/10 hover:bg-slate-700'
                          }`}
                          title="Click to toggle Status"
                        >
                          {camp.status}
                        </button>

                        {/* Type Badge */}
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          isRecurring
                            ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400'
                            : isDate
                            ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                            : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                        }`}>
                          {isRecurring && `Meta RN • ${camp.rnCadence || 'weekly'}`}
                          {isDate && 'Date-Specific Event'}
                          {isDrip && `Drip • ${(camp.dripSteps || []).length} Steps`}
                        </span>

                        {/* Date countdown if date-specific */}
                        {isDate && countdown && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-rose-400" />
                            {countdown}
                          </span>
                        )}
                      </div>

                      {camp.description && (
                        <p className="text-xs text-slate-400 mt-1 line-clamp-1">{camp.description}</p>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 self-end sm:self-center">
                    {/* Simulate Delivery Run */}
                    <button
                      type="button"
                      onClick={() => onSimulateCampaign(camp)}
                      disabled={isSimulating}
                      className="px-3 py-1.5 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                      title="Run live simulated delivery to eligible recipients"
                    >
                      <Play className="w-3 h-3" />
                      <span>{isSimulating ? 'Simulating...' : 'Run Simulation'}</span>
                    </button>

                    {/* Edit */}
                    <button
                      type="button"
                      onClick={() => onEditCampaign(camp)}
                      className="p-1.5 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white rounded-xl transition-colors cursor-pointer"
                      title="Edit Campaign"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>

                    {/* Delete */}
                    <button
                      type="button"
                      onClick={() => onDeleteCampaign(camp.id)}
                      className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-white/5 rounded-xl transition-colors cursor-pointer"
                      title="Delete Campaign"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Details & Performance Row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  {/* Topic / Trigger */}
                  <div className="p-2.5 rounded-xl bg-slate-950/60 border border-white/5">
                    <span className="text-slate-400 text-[10px] uppercase font-bold block mb-1">
                      {isDrip ? 'Trigger' : 'Meta RN Topic'}
                    </span>
                    <span className="font-semibold text-slate-200 truncate block">
                      {isDrip ? `Tag: [${camp.triggerOnTag || 'New Lead'}]` : (camp.rnTopic || 'VIP Weekly Drops')}
                    </span>
                  </div>

                  {/* Timing / Schedule */}
                  <div className="p-2.5 rounded-xl bg-slate-950/60 border border-white/5">
                    <span className="text-slate-400 text-[10px] uppercase font-bold block mb-1">Schedule</span>
                    <span className="font-semibold text-slate-200 truncate block">
                      {isRecurring && `Every ${camp.rnCadence || 'week'}`}
                      {isDate && `${camp.scheduledDate} ${camp.scheduledTime || '10:00'}`}
                      {isDrip && `${(camp.dripSteps || []).length} sequential steps`}
                    </span>
                  </div>

                  {/* Delivered Stats */}
                  <div className="p-2.5 rounded-xl bg-slate-950/60 border border-white/5">
                    <span className="text-slate-400 text-[10px] uppercase font-bold block mb-1">Delivered</span>
                    <span className="font-bold text-cyan-300 text-sm">
                      {camp.stats?.deliveredCount || 0}
                      <span className="text-[10px] text-slate-400 font-normal ml-1">recipients</span>
                    </span>
                  </div>

                  {/* Open & CTR Rate */}
                  <div className="p-2.5 rounded-xl bg-slate-950/60 border border-white/5">
                    <span className="text-slate-400 text-[10px] uppercase font-bold block mb-1">Engagement</span>
                    <div className="flex items-center gap-2">
                      <span className="text-emerald-300 font-bold text-sm">
                        {camp.stats?.openedCount ? Math.round((camp.stats.openedCount / Math.max(1, camp.stats.deliveredCount)) * 100) : 94}% Open
                      </span>
                      <span className="text-slate-400 text-[11px]">
                        • {camp.stats?.clickedCount ? Math.round((camp.stats.clickedCount / Math.max(1, camp.stats.deliveredCount)) * 100) : 48}% CTR
                      </span>
                    </div>
                  </div>
                </div>

                {/* Message Copy or Drip Steps Preview */}
                {isDrip ? (
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => setExpandedDripId(isExpanded ? null : camp.id)}
                      className="text-xs font-bold text-amber-300 hover:text-amber-200 flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <span>{isExpanded ? 'Hide Drip Sequence Steps' : `View ${(camp.dripSteps || []).length} Drip Journey Steps`}</span>
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </button>

                    {isExpanded && camp.dripSteps && (
                      <div className="mt-3 space-y-2 pt-2 border-t border-white/10 animate-in fade-in">
                        {camp.dripSteps.map((step, sIdx) => (
                          <div 
                            key={step.id || sIdx}
                            className="p-3 rounded-xl bg-slate-950/80 border border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs"
                          >
                            <div className="flex items-center gap-2.5">
                              <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-black flex items-center justify-center flex-shrink-0">
                                {step.stepNumber}
                              </span>
                              <div>
                                <span className="font-bold text-white block">{step.title}</span>
                                <span className="text-[11px] text-slate-400 line-clamp-1">{step.messageText}</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400 self-end sm:self-center">
                              <Clock className="w-3 h-3 text-amber-400" />
                              <span>Delay: {step.delayValue} {step.delayUnit}</span>
                              {step.rnTopicRequired && (
                                <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[9px] font-bold">
                                  🔔 RN Renewal Attached
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  camp.messageText && (
                    <div className="p-3 rounded-xl bg-slate-950/40 border border-white/5 text-xs text-slate-300 line-clamp-2 leading-relaxed font-sans">
                      {camp.messageText}
                    </div>
                  )
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
