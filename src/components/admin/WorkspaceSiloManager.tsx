import React, { useState } from 'react';
import { 
  Building2, 
  Globe, 
  Plus, 
  Edit3, 
  Trash2, 
  CheckCircle2, 
  XCircle, 
  ExternalLink, 
  ShieldCheck, 
  Sliders, 
  Users, 
  MessageSquare, 
  Bot, 
  Zap, 
  HelpCircle,
  ArrowRight,
  Sparkles,
  Layers,
  Search,
  Check,
  X,
  Phone,
  Instagram,
  Facebook,
  Shield,
  Eye,
  Key,
  Crown
} from 'lucide-react';
import { WorkspaceSilo, BusinessType, WorkspacePlanTier, WorkspacePricingModel } from '../../types/workspace';

interface WorkspaceSiloManagerProps {
  workspaces: WorkspaceSilo[];
  activeWorkspaceId: string;
  onSelectWorkspace: (id: string) => void;
  onUpdateWorkspaces: (workspaces: WorkspaceSilo[]) => void;
}

export const WorkspaceSiloManager: React.FC<WorkspaceSiloManagerProps> = ({
  workspaces,
  activeWorkspaceId,
  onSelectWorkspace,
  onUpdateWorkspaces
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingWorkspace, setEditingWorkspace] = useState<WorkspaceSilo | null>(null);
  const [activeWhitelabelModalWs, setActiveWhitelabelModalWs] = useState<WorkspaceSilo | null>(null);

  // New Silo Form State
  const [newSiloName, setNewSiloName] = useState('');
  const [newBusinessType, setNewBusinessType] = useState<BusinessType>('local_business');
  const [newFbPageName, setNewFbPageName] = useState('');
  const [newIgUsername, setNewIgUsername] = useState('');
  const [newWhatsAppPhone, setNewWhatsAppPhone] = useState('');
  const [newPlanTier, setNewPlanTier] = useState<WorkspacePlanTier>('standard_page');
  const [newPricingModel, setNewPricingModel] = useState<WorkspacePricingModel>('manychat_per_page');
  const [newWhitelabelEnabled, setNewWhitelabelEnabled] = useState(false);
  const [newCustomDomain, setNewCustomDomain] = useState('');
  const [newBrandName, setNewBrandName] = useState('');

  const filteredWorkspaces = workspaces.filter(ws => 
    ws.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ws.connectedPage.pageName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (ws.connectedPage.connectedIg?.username.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
    ws.whitelabel.customDomain?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateSilo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSiloName.trim() || !newFbPageName.trim()) return;

    const newId = `ws-silo-${Date.now()}`;
    const cleanSlug = newSiloName.toLowerCase().replace(/[^a-z0-9]/g, '-');

    const created: WorkspaceSilo = {
      id: newId,
      name: newSiloName.trim(),
      slug: cleanSlug,
      businessType: newBusinessType,
      color: ['#00d2ff', '#3b82f6', '#a855f7', '#10b981', '#f59e0b'][Math.floor(Math.random() * 5)],
      connectedPage: {
        pageId: `fb_page_${Math.floor(100000000 + Math.random() * 900000000)}`,
        pageName: newFbPageName.trim(),
        pageCategory: newBusinessType === 'local_business' ? 'Local Service & Clinic' : newBusinessType === 'ecommerce' ? 'E-Commerce Store' : 'Marketing & Consulting',
        connectedAt: new Date().toISOString().split('T')[0],
        connectedIg: newIgUsername.trim() ? {
          username: newIgUsername.startsWith('@') ? newIgUsername.trim() : `@${newIgUsername.trim()}`,
          igId: `ig_${Math.floor(100000000 + Math.random() * 900000000)}`,
          followersCount: 1500,
          connected: true
        } : undefined,
        connectedWhatsApp: newWhatsAppPhone.trim() ? {
          phoneNumber: newWhatsAppPhone.trim(),
          wabaId: `waba_${Math.floor(100000 + Math.random() * 900000)}`,
          verified: true,
          connected: true
        } : undefined
      },
      planTier: newPlanTier,
      pricingModel: newPricingModel,
      whitelabel: {
        enabled: newWhitelabelEnabled,
        customDomain: newCustomDomain.trim() || undefined,
        brandName: newBrandName.trim() || undefined,
        hideChatMizeWatermark: newWhitelabelEnabled,
        clientRoleAccess: 'campaign_editor'
      },
      stats: {
        subscribers: 0,
        botsCount: 1,
        toolsCount: 1,
        broadcastsCount: 0
      },
      createdAt: new Date().toISOString().split('T')[0]
    };

    const updated = [created, ...workspaces];
    onUpdateWorkspaces(updated);
    setIsCreateModalOpen(false);
    resetForm();
    onSelectWorkspace(newId);
  };

  const resetForm = () => {
    setNewSiloName('');
    setNewBusinessType('local_business');
    setNewFbPageName('');
    setNewIgUsername('');
    setNewWhatsAppPhone('');
    setNewPlanTier('standard_page');
    setNewPricingModel('manychat_per_page');
    setNewWhitelabelEnabled(false);
    setNewCustomDomain('');
    setNewBrandName('');
  };

  const handleDeleteSilo = (id: string) => {
    if (workspaces.length <= 1) {
      alert('You must keep at least one active workspace silo.');
      return;
    }
    if (confirm('Are you sure you want to delete this workspace silo? All associated assets for this business page will be unlinked.')) {
      const updated = workspaces.filter(ws => ws.id !== id);
      onUpdateWorkspaces(updated);
      if (activeWorkspaceId === id) {
        onSelectWorkspace(updated[0].id);
      }
    }
  };

  const handleSaveWhitelabel = (wsId: string, wlSettings: WorkspaceSilo['whitelabel']) => {
    const updated = workspaces.map(ws => {
      if (ws.id === wsId) {
        return {
          ...ws,
          whitelabel: wlSettings
        };
      }
      return ws;
    });
    onUpdateWorkspaces(updated);
    setActiveWhitelabelModalWs(null);
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-cyan-950/40 border border-cyan-500/20 rounded-2xl p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/20">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
                  Business Workspaces
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-semibold uppercase tracking-wider">
                    Meta Page Isolation
                  </span>
                </h2>
                <p className="text-sm text-slate-400">
                  Architecture standard: Every Facebook Page operates as an isolated business workspace with exactly 1 linked Instagram account and 1 WhatsApp number.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold text-sm shadow-lg shadow-cyan-500/20 transition-all flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Connect New FB Page / Workspace
            </button>
          </div>
        </div>

        {/* Rule callout banner */}
        <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3 pt-5 border-t border-slate-800/80 text-xs">
          <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
            <Facebook className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-slate-200 block">1 FB Page Anchor</span>
              <span className="text-slate-400">Each silo anchors to a primary Facebook Page token.</span>
            </div>
          </div>
          <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
            <Instagram className="w-4 h-4 text-pink-400 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-slate-200 block">1 IG Account Limit</span>
              <span className="text-slate-400">Meta strictly limits 1 IG Professional account per FB page.</span>
            </div>
          </div>
          <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
            <Phone className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-slate-200 block">1 WhatsApp Cloud WABA</span>
              <span className="text-slate-400">All tools & bot flows isolate strictly inside this work area.</span>
            </div>
          </div>
        </div>
      </div>

      {/* Search & Stats Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search business silos, pages, IG handles..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
          />
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 font-mono text-cyan-400 font-bold">
            {workspaces.length} Total Workspaces
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 font-mono text-amber-400">
            {workspaces.filter(w => w.whitelabel.enabled).length} Whitelabeled
          </span>
        </div>
      </div>

      {/* Workspace Silos Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {filteredWorkspaces.map((ws) => {
          const isActive = ws.id === activeWorkspaceId;
          return (
            <div
              key={ws.id}
              className={`rounded-2xl transition-all border p-6 flex flex-col justify-between ${
                isActive
                  ? 'bg-slate-900/90 border-cyan-500/50 shadow-xl shadow-cyan-500/10 ring-1 ring-cyan-500/30'
                  : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div>
                {/* Header row */}
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg text-slate-950 shadow-md"
                      style={{ backgroundColor: ws.color }}
                    >
                      {ws.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-bold text-white">{ws.name}</h3>
                        {isActive && (
                          <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                            <Check className="w-2.5 h-2.5" /> Active Workspace
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 capitalize">
                        {ws.businessType.replace('_', ' ')} &bull; Created {ws.createdAt}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {ws.whitelabel.enabled && (
                      <span className="px-2 py-1 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/30 text-[10px] font-bold flex items-center gap-1">
                        <Crown className="w-3 h-3" /> Whitelabel
                      </span>
                    )}
                    <span className="px-2 py-1 rounded-lg bg-slate-800 text-slate-300 border border-slate-700 text-[10px] font-mono">
                      {ws.planTier.replace('_', ' ')}
                    </span>
                  </div>
                </div>

                {/* Meta Assets Triad: 1 FB Page + 1 IG + 1 WhatsApp */}
                <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3.5 space-y-2.5 mb-4">
                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                    <span>Connected Meta Channel Triad</span>
                    <span className="text-[10px] text-cyan-400/80">Strict Workspace Isolation</span>
                  </div>

                  {/* Facebook Page */}
                  <div className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-slate-900/60 border border-slate-800/60">
                    <div className="flex items-center gap-2 min-w-0">
                      <Facebook className="w-4 h-4 text-blue-400 flex-shrink-0" />
                      <span className="text-slate-200 font-medium truncate">{ws.connectedPage.pageName}</span>
                    </div>
                    <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1 flex-shrink-0">
                      <CheckCircle2 className="w-3 h-3" /> Linked (ID: {ws.connectedPage.pageId.slice(-6)})
                    </span>
                  </div>

                  {/* Instagram Professional */}
                  <div className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-slate-900/60 border border-slate-800/60">
                    <div className="flex items-center gap-2 min-w-0">
                      <Instagram className="w-4 h-4 text-pink-400 flex-shrink-0" />
                      <span className="text-slate-200 font-medium truncate">
                        {ws.connectedPage.connectedIg?.username || 'No Instagram Account Connected'}
                      </span>
                    </div>
                    {ws.connectedPage.connectedIg?.connected ? (
                      <span className="text-[10px] text-pink-400 font-mono flex items-center gap-1 flex-shrink-0">
                        <CheckCircle2 className="w-3 h-3" /> 1-to-1 Bound
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-500 font-mono flex-shrink-0">Unlinked</span>
                    )}
                  </div>

                  {/* WhatsApp WABA */}
                  <div className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-slate-900/60 border border-slate-800/60">
                    <div className="flex items-center gap-2 min-w-0">
                      <Phone className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <span className="text-slate-200 font-medium truncate">
                        {ws.connectedPage.connectedWhatsApp?.phoneNumber || 'No WhatsApp Cloud Number'}
                      </span>
                    </div>
                    {ws.connectedPage.connectedWhatsApp?.connected ? (
                      <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1 flex-shrink-0">
                        <CheckCircle2 className="w-3 h-3" /> WABA Verified
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-500 font-mono flex-shrink-0">Not Configured</span>
                    )}
                  </div>
                </div>

                {/* Whitelabel & Billing Strip */}
                <div className="grid grid-cols-2 gap-2 text-xs mb-4">
                  <div className="p-2.5 rounded-xl bg-slate-950/40 border border-slate-800">
                    <span className="text-slate-500 text-[10px] uppercase tracking-wider block">Billing Model</span>
                    <span className="font-semibold text-slate-300">
                      {ws.pricingModel === 'segmate_unlimited_pages' ? 'Agency Unlimited (Flat)' : 'Standard Tiered (Per-Page)'}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-950/40 border border-slate-800">
                    <span className="text-slate-500 text-[10px] uppercase tracking-wider block">Whitelabel Domain</span>
                    <span className="font-semibold text-slate-300 truncate block">
                      {ws.whitelabel.customDomain || 'Standard (chatmize.io)'}
                    </span>
                  </div>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-4 gap-2 text-center py-2 px-3 rounded-xl bg-slate-950/60 border border-slate-800 mb-5">
                  <div>
                    <span className="text-xs font-bold text-white">{ws.stats.subscribers.toLocaleString()}</span>
                    <span className="text-[10px] text-slate-500 block">Contacts</span>
                  </div>
                  <div>
                    <span className="text-xs font-bold text-white">{ws.stats.botsCount}</span>
                    <span className="text-[10px] text-slate-500 block">Bot Flows</span>
                  </div>
                  <div>
                    <span className="text-xs font-bold text-white">{ws.stats.toolsCount}</span>
                    <span className="text-[10px] text-slate-500 block">Nurture Tools</span>
                  </div>
                  <div>
                    <span className="text-xs font-bold text-white">{ws.stats.broadcastsCount}</span>
                    <span className="text-[10px] text-slate-500 block">Campaigns</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-800">
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setActiveWhitelabelModalWs(ws)}
                    className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                    title="Configure Whitelabel Portal"
                  >
                    <Crown className="w-3.5 h-3.5 text-amber-400" />
                    <span className="hidden sm:inline">Whitelabel</span>
                  </button>
                  <button
                    onClick={() => handleDeleteSilo(ws.id)}
                    className="p-2 rounded-lg bg-slate-800/80 hover:bg-red-500/20 text-slate-400 hover:text-red-400 text-xs transition-colors cursor-pointer"
                    title="Delete Workspace"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {isActive ? (
                  <span className="px-4 py-2 rounded-xl bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 text-xs font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-cyan-400" /> Currently Working In This Workspace
                  </span>
                ) : (
                  <button
                    onClick={() => onSelectWorkspace(ws.id)}
                    className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-md shadow-cyan-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    Switch to this Workspace
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* CREATE NEW SILO MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-cyan-500/30 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Create Business Workspace</h3>
                  <p className="text-xs text-slate-400">Bind a Facebook Page with 1 Instagram &amp; 1 WhatsApp line.</p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSilo} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Business / Workspace Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Austin Aesthetics (Business 1)"
                  value={newSiloName}
                  onChange={(e) => setNewSiloName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Business Type</label>
                  <select
                    value={newBusinessType}
                    onChange={(e) => setNewBusinessType(e.target.value as BusinessType)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-cyan-500"
                  >
                    <option value="local_business">Local Business / Clinic</option>
                    <option value="ecommerce">E-Commerce Brand</option>
                    <option value="agency_client">Agency Client</option>
                    <option value="creator">Creator / Influencer</option>
                    <option value="saas">SaaS / Software</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Pricing Model</label>
                  <select
                    value={newPricingModel}
                    onChange={(e) => setNewPricingModel(e.target.value as WorkspacePricingModel)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-cyan-500"
                  >
                    <option value="manychat_per_page">Standard Tiered Model (Per-Page)</option>
                    <option value="segmate_unlimited_pages">Agency Unlimited Model (Unlimited Pages)</option>
                    <option value="custom_retainer">Agency Custom Retainer</option>
                  </select>
                </div>
              </div>

              {/* Meta Asset Bindings */}
              <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
                <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider block">
                  Meta Channel Triad (Strict 1-to-1 Isolation)
                </span>

                <div>
                  <label className="block text-xs text-slate-300 mb-1">Facebook Page Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Austin Aesthetics Center"
                    value={newFbPageName}
                    onChange={(e) => setNewFbPageName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-300 mb-1">Instagram Handle</label>
                    <input
                      type="text"
                      placeholder="@austinaesthetics"
                      value={newIgUsername}
                      onChange={(e) => setNewIgUsername(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-300 mb-1">WhatsApp Cloud Number</label>
                    <input
                      type="text"
                      placeholder="+1 (512) 555-0100"
                      value={newWhatsAppPhone}
                      onChange={(e) => setNewWhatsAppPhone(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>
              </div>

              {/* Whitelabel Toggle */}
              <div className="p-3.5 rounded-xl bg-slate-950/50 border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-slate-200 block">Enable Whitelabel Client Portal</span>
                    <span className="text-[11px] text-slate-400">Give client custom domain & hide ChatMize branding.</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={newWhitelabelEnabled}
                    onChange={(e) => setNewWhitelabelEnabled(e.target.checked)}
                    className="w-4 h-4 rounded text-cyan-500 focus:ring-cyan-500 bg-slate-900 border-slate-700"
                  />
                </div>

                {newWhitelabelEnabled && (
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800">
                    <input
                      type="text"
                      placeholder="Custom Domain (chat.client.com)"
                      value={newCustomDomain}
                      onChange={(e) => setNewCustomDomain(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200"
                    />
                    <input
                      type="text"
                      placeholder="Brand Name (Client Concierge)"
                      value={newBrandName}
                      onChange={(e) => setNewBrandName(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200"
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-medium text-xs hover:bg-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/20 cursor-pointer"
                >
                  Create Workspace &amp; Connect Assets
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* WHITELABEL CONFIGURATION MODAL */}
      {activeWhitelabelModalWs && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-500/30 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <Crown className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="text-base font-bold text-white">Whitelabel Portal Settings</h3>
                  <p className="text-xs text-slate-400">{activeWhitelabelModalWs.name}</p>
                </div>
              </div>
              <button
                onClick={() => setActiveWhitelabelModalWs(null)}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
                <div>
                  <span className="font-semibold text-slate-200 block">Whitelabel Status</span>
                  <span className="text-slate-400 text-[11px]">Activate dedicated client portal</span>
                </div>
                <input
                  type="checkbox"
                  checked={activeWhitelabelModalWs.whitelabel.enabled}
                  onChange={(e) => setActiveWhitelabelModalWs({
                    ...activeWhitelabelModalWs,
                    whitelabel: {
                      ...activeWhitelabelModalWs.whitelabel,
                      enabled: e.target.checked
                    }
                  })}
                  className="w-4 h-4 rounded text-amber-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Custom CNAME Domain</label>
                <input
                  type="text"
                  placeholder="e.g. chat.dentalcareaustin.com"
                  value={activeWhitelabelModalWs.whitelabel.customDomain || ''}
                  onChange={(e) => setActiveWhitelabelModalWs({
                    ...activeWhitelabelModalWs,
                    whitelabel: {
                      ...activeWhitelabelModalWs.whitelabel,
                      customDomain: e.target.value
                    }
                  })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200"
                />
                <p className="text-[10px] text-slate-500 mt-1">Point CNAME record to: cname.chatmize.io</p>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Brand Name Display</label>
                <input
                  type="text"
                  placeholder="e.g. Austin Dental Assistant"
                  value={activeWhitelabelModalWs.whitelabel.brandName || ''}
                  onChange={(e) => setActiveWhitelabelModalWs({
                    ...activeWhitelabelModalWs,
                    whitelabel: {
                      ...activeWhitelabelModalWs.whitelabel,
                      brandName: e.target.value
                    }
                  })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200"
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
                <div>
                  <span className="font-semibold text-slate-200 block">Hide "Powered by ChatMize" Watermark</span>
                  <span className="text-slate-400 text-[11px]">Removes all ChatMize branding from widgets & popups</span>
                </div>
                <input
                  type="checkbox"
                  checked={activeWhitelabelModalWs.whitelabel.hideChatMizeWatermark}
                  onChange={(e) => setActiveWhitelabelModalWs({
                    ...activeWhitelabelModalWs,
                    whitelabel: {
                      ...activeWhitelabelModalWs.whitelabel,
                      hideChatMizeWatermark: e.target.checked
                    }
                  })}
                  className="w-4 h-4 rounded text-amber-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Client User Access Level</label>
                <select
                  value={activeWhitelabelModalWs.whitelabel.clientRoleAccess}
                  onChange={(e) => setActiveWhitelabelModalWs({
                    ...activeWhitelabelModalWs,
                    whitelabel: {
                      ...activeWhitelabelModalWs.whitelabel,
                      clientRoleAccess: e.target.value as any
                    }
                  })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200"
                >
                  <option value="full_admin">Full Admin (Can manage bot flows & settings)</option>
                  <option value="campaign_editor">Campaign Editor (Can launch blasts, edit messages)</option>
                  <option value="viewer_only">Viewer Only (Read-only analytics & inbox)</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                onClick={() => setActiveWhitelabelModalWs(null)}
                className="px-3.5 py-1.5 rounded-lg bg-slate-800 text-slate-300 font-medium text-xs hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={() => handleSaveWhitelabel(activeWhitelabelModalWs.id, activeWhitelabelModalWs.whitelabel)}
                className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs"
              >
                Save Whitelabel Settings
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
