import React, { useState } from 'react';
import { EmojiPickerButton, useEmojiTarget } from '../components/emoji';
import { 
  Building2, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  Facebook, 
  Instagram, 
  Phone, 
  Search, 
  Check, 
  X, 
  Crown, 
  ArrowRight,
  ExternalLink,
  Layers,
  Sparkles,
  ShieldCheck,
  Smartphone,
  Globe,
  Bot,
  RefreshCw,
  LogOut,
  MoreVertical,
  Copy,
  Send,
  MessageSquare,
  Code,
  Sliders,
  CheckCheck,
  AlertCircle,
  Pencil
} from 'lucide-react';
import { 
  Workspace, 
  BusinessType, 
  WorkspacePlanTier, 
  WorkspacePricingModel,
  SmsConnection,
  StandaloneChatbotConnection
} from '../types/workspace';

interface WorkspacesViewProps {
  workspaces: Workspace[];
  activeWorkspaceId: string;
  onSelectWorkspace: (id: string) => void;
  onUpdateWorkspaces: (workspaces: Workspace[]) => void;
}

export const WorkspacesView: React.FC<WorkspacesViewProps> = ({
  workspaces,
  activeWorkspaceId,
  onSelectWorkspace,
  onUpdateWorkspaces
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'whitelabeled' | 'active'>('all');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [entriesPerPage, setEntriesPerPage] = useState('10');
  
  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isPageSyncModalOpen, setIsPageSyncModalOpen] = useState(false);
  const [activeWhitelabelModalWs, setActiveWhitelabelModalWs] = useState<Workspace | null>(null);
  const [activeChatbotModalWs, setActiveChatbotModalWs] = useState<Workspace | null>(null);
  const wsWelcomeEmoji = useEmojiTarget<HTMLTextAreaElement>();
  const [activeSmsModalWs, setActiveSmsModalWs] = useState<Workspace | null>(null);
  const [editingWsId, setEditingWsId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Standalone Chatbot live preview test state
  const [previewChatInput, setPreviewChatInput] = useState('');
  const [previewMessages, setPreviewMessages] = useState<Array<{ sender: 'bot' | 'user'; text: string; time: string }>>([
    { sender: 'bot', text: 'Hey there! How can we help automate your business today?', time: 'Just now' }
  ]);
  const [newTargetAssetInput, setNewTargetAssetInput] = useState('');

  // Page Sync simulated state
  const [isSyncingPages, setIsSyncingPages] = useState(false);
  const [syncedPagesNotification, setSyncedPagesNotification] = useState(false);

  // New Workspace Form State
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [newBusinessType, setNewBusinessType] = useState<BusinessType>('local_business');
  const [newFbPageName, setNewFbPageName] = useState('');
  const [newIgUsername, setNewIgUsername] = useState('');
  const [newWhatsAppPhone, setNewWhatsAppPhone] = useState('');
  const [newSmsPhone, setNewSmsPhone] = useState('');
  const [newEnableChatbot, setNewEnableChatbot] = useState(true);
  const [newPlanTier, setNewPlanTier] = useState<WorkspacePlanTier>('standard_page');
  const [newPricingModel, setNewPricingModel] = useState<WorkspacePricingModel>('segmate_unlimited_pages');
  const [newWhitelabelEnabled, setNewWhitelabelEnabled] = useState(false);
  const [newCustomDomain, setNewCustomDomain] = useState('');
  const [newBrandName, setNewBrandName] = useState('');

  // Confirmation & Toast Modals (iframe-safe, no window.confirm/alert)
  const [deleteConfirmState, setDeleteConfirmState] = useState<{ id: string; name: string } | null>(null);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const filteredWorkspaces = workspaces.filter(ws => {
    if (ws.deleted) return false; // Hide soft-deleted from main list
    const matchesSearch = 
      ws.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ws.connectedPage.pageName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (ws.ownerName?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      (ws.connectedPage.connectedIg?.username.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      (ws.connectedSms?.phoneNumber?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      (ws.whitelabel.customDomain?.toLowerCase() || '').includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (filterType === 'whitelabeled') return ws.whitelabel.enabled;
    if (filterType === 'active') return ws.id === activeWorkspaceId;
    return true;
  });

  const deletedWorkspaces = workspaces.filter(ws => ws.deleted);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleSimulatedPageSync = () => {
    setIsSyncingPages(true);
    setTimeout(() => {
      setIsSyncingPages(false);
      setIsPageSyncModalOpen(false);
      setSyncedPagesNotification(true);
      setTimeout(() => setSyncedPagesNotification(false), 4000);
    }, 1200);
  };

  const handleSendPreviewMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!previewChatInput.trim()) return;

    const userText = previewChatInput.trim();
    setPreviewMessages(prev => [
      ...prev,
      { sender: 'user', text: userText, time: 'Now' }
    ]);
    setPreviewChatInput('');

    setTimeout(() => {
      setPreviewMessages(prev => [
        ...prev,
        {
          sender: 'bot',
          text: `Thanks for asking about "${userText}". Our standalone on-page assistant is connected directly to your workspace bot flows and contact audience!`,
          time: 'Now'
        }
      ]);
    }, 600);
  };

  const handleCreateWorkspace = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkspaceName.trim() || !newFbPageName.trim()) return;

    const newId = `ws-biz-${Date.now()}`;
    const cleanSlug = newWorkspaceName.toLowerCase().replace(/[^a-z0-9]/g, '-');

    const created: Workspace = {
      id: newId,
      name: newWorkspaceName.trim(),
      slug: cleanSlug,
      ownerName: 'Karl Schuckert',
      businessType: newBusinessType,
      color: ['#00d2ff', '#3b82f6', '#a855f7', '#10b981', '#f59e0b', '#ec4899'][Math.floor(Math.random() * 6)],
      connectedPage: {
        pageId: `fb_page_${Math.floor(100000000 + Math.random() * 900000000)}`,
        pageName: newFbPageName.trim(),
        pageCategory: newBusinessType === 'local_business' 
          ? 'Local Service & Clinic' 
          : newBusinessType === 'ecommerce' 
          ? 'E-Commerce Store' 
          : 'Marketing & Consulting',
        connectedAt: new Date().toISOString().split('T')[0],
        ownerName: 'Karl Schuckert',
        serviceStatus: 'active',
        connectedIg: newIgUsername.trim() ? {
          username: newIgUsername.startsWith('@') ? newIgUsername.trim() : `@${newIgUsername.trim()}`,
          igId: `ig_${Math.floor(100000000 + Math.random() * 900000000)}`,
          followersCount: 1500,
          connected: true,
          status: 'active'
        } : undefined,
        connectedWhatsApp: newWhatsAppPhone.trim() ? {
          phoneNumber: newWhatsAppPhone.trim(),
          wabaId: `waba_${Math.floor(100000 + Math.random() * 900000)}`,
          verified: true,
          connected: true,
          status: 'active'
        } : undefined
      },
      connectedSms: newSmsPhone.trim() ? {
        phoneNumber: newSmsPhone.trim(),
        provider: 'twilio',
        status: 'active',
        connected: true,
        compliant10dlc: true,
        monthlyCredits: 10000,
        autoKeywords: ['STOP', 'START', 'HELP']
      } : undefined,
      connectedStandaloneChat: newEnableChatbot ? {
        enabled: true,
        status: 'active',
        botName: `${newWorkspaceName.trim()} Assistant`,
        welcomeMessage: `Hi there! Welcome to ${newWorkspaceName.trim()}. How can we help?`,
        primaryColor: '#00d2ff',
        hostedSlug: cleanSlug,
        embedSnippet: `<script src="https://chatmize.io/widget.js" data-workspace="${cleanSlug}" async></script>`,
        allowedDomains: [`${cleanSlug}.com`],
        businessAssets: ['Main Website', 'Landing Funnel'],
        bubblePosition: 'bottom-right',
        autoPopupSeconds: 5
      } : undefined,
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

  const handleSaveWorkspaceName = (wsId: string) => {
    if (!editingName.trim()) {
      setEditingWsId(null);
      return;
    }
    const updated = workspaces.map(ws =>
      ws.id === wsId ? { ...ws, name: editingName.trim() } : ws
    );
    onUpdateWorkspaces(updated);
    setEditingWsId(null);
    setEditingName('');
  };

  const resetForm = () => {
    setNewWorkspaceName('');
    setNewBusinessType('local_business');
    setNewFbPageName('');
    setNewIgUsername('');
    setNewWhatsAppPhone('');
    setNewSmsPhone('');
    setNewEnableChatbot(true);
    setNewPlanTier('standard_page');
    setNewPricingModel('segmate_unlimited_pages');
    setNewWhitelabelEnabled(false);
    setNewCustomDomain('');
    setNewBrandName('');
  };

  const handleDeleteWorkspace = (id: string, name: string) => {
    if (workspaces.length <= 1) {
      setToastMessage('You must keep at least one active workspace.');
      setTimeout(() => setToastMessage(null), 3500);
      return;
    }
    setDeleteConfirmState({ id, name });
  };

  const handleConfirmDelete = () => {
    if (!deleteConfirmState) return;
    const { id } = deleteConfirmState;
    // Soft delete: mark as deleted with timestamp, retain for 90 days
    const updated = workspaces.map(ws =>
      ws.id === id
        ? { ...ws, deleted: true, deletedAt: new Date().toISOString() }
        : ws
    );
    onUpdateWorkspaces(updated);
    const remaining = updated.filter(ws => !ws.deleted);
    if (activeWorkspaceId === id && remaining.length > 0) {
      onSelectWorkspace(remaining[0].id);
    }
    setDeleteConfirmState(null);
    setToastMessage('Workspace moved to Recently Deleted. You have 90 days to restore it.');
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleRestoreWorkspace = (id: string) => {
    const updated = workspaces.map(ws =>
      ws.id === id
        ? { ...ws, deleted: false, deletedAt: undefined }
        : ws
    );
    onUpdateWorkspaces(updated);
    setToastMessage('Workspace restored successfully.');
    setTimeout(() => setToastMessage(null), 3500);
  };

  const getDaysRemaining = (deletedAt?: string): number => {
    if (!deletedAt) return 90;
    const deleted = new Date(deletedAt).getTime();
    const now = Date.now();
    const daysPassed = Math.floor((now - deleted) / (1000 * 60 * 60 * 24));
    return Math.max(0, 90 - daysPassed);
  };

  const handleSaveWhitelabel = (wsId: string, wlSettings: Workspace['whitelabel']) => {
    const updated = workspaces.map(ws => {
      if (ws.id === wsId) {
        return { ...ws, whitelabel: wlSettings };
      }
      return ws;
    });
    onUpdateWorkspaces(updated);
    setActiveWhitelabelModalWs(null);
  };

  const handleSaveChatbotSettings = (wsId: string, botSettings: StandaloneChatbotConnection) => {
    const updated = workspaces.map(ws => {
      if (ws.id === wsId) {
        return {
          ...ws,
          connectedStandaloneChat: botSettings,
          connectedPage: {
            ...ws.connectedPage,
            connectedStandaloneChat: botSettings
          }
        };
      }
      return ws;
    });
    onUpdateWorkspaces(updated);
    setActiveChatbotModalWs(null);
  };

  const handleSaveSmsSettings = (wsId: string, smsSettings: SmsConnection) => {
    const updated = workspaces.map(ws => {
      if (ws.id === wsId) {
        return {
          ...ws,
          connectedSms: smsSettings,
          connectedPage: {
            ...ws.connectedPage,
            connectedSms: smsSettings
          }
        };
      }
      return ws;
    });
    onUpdateWorkspaces(updated);
    setActiveSmsModalWs(null);
  };

  const whitelabelCount = workspaces.filter(w => w.whitelabel.enabled).length;

  return (
    <div className="flex-1 flex flex-col gap-6 max-w-7xl mx-auto w-full">
      {/* Top Banner Alert when pages are synced */}
      {syncedPagesNotification && (
        <div className="p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center justify-between shadow-lg shadow-emerald-500/10 animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Facebook Pages, linked Instagram accounts, and WhatsApp numbers synchronized successfully from Meta Graph API!</span>
          </div>
          <button onClick={() => setSyncedPagesNotification(false)} className="text-emerald-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Connections Header Card */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-cyan-950/40 border border-cyan-500/20 rounded-3xl p-5 sm:p-7 md:p-8 relative overflow-hidden shadow-xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 sm:gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[11px] font-bold text-cyan-400 uppercase tracking-widest">
                Enterprise Workspace Architecture + Omnichannel Expansion
              </span>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/20 flex-shrink-0">
                <Building2 className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-white tracking-tight">
                  Facebook, Instagram &amp; Omnichannel Connections
                </h1>
                <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                  1 Facebook Page anchors each business workspace, with linked Instagram &amp; WhatsApp, plus dedicated <strong>SMS (10DLC)</strong> and <strong>Standalone Chatbots for on-page &amp; business assets</strong>.
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons: Facebook Page Sync & FB Logout Buttons */}
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <button
              onClick={() => setIsPageSyncModalOpen(true)}
              className="px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wide shadow-lg shadow-emerald-600/30 transition-all flex items-center gap-2 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Facebook Page Sync</span>
            </button>

            <button
              onClick={() => setLogoutConfirmOpen(true)}
              className="px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs uppercase tracking-wide shadow-lg shadow-rose-600/30 transition-all flex items-center gap-2 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>FB Logout</span>
            </button>

            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs shadow-lg shadow-cyan-500/20 transition-all flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Connect New Workspace Asset</span>
            </button>
          </div>
        </div>

        {/* 5-Channel Architecture Breakdown Strip */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-2.5 pt-5 border-t border-slate-800/80 text-xs">
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-start gap-2.5">
            <Facebook className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-slate-200 block">1. FB Page Anchor</span>
              <span className="text-[11px] text-slate-400">Root Meta access token and Messenger flows.</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-start gap-2.5">
            <Instagram className="w-4 h-4 text-pink-400 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-slate-200 block">2. Instagram Direct</span>
              <span className="text-[11px] text-slate-400">Linked 1-to-1 via Facebook Page Professional account.</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-start gap-2.5">
            <Phone className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-slate-200 block">3. WhatsApp Cloud</span>
              <span className="text-[11px] text-slate-400">Official Meta WABA number attached to the business.</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/60 border border-amber-500/30 bg-amber-500/5 flex items-start gap-2.5">
            <Smartphone className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-amber-300 block flex items-center gap-1">
                4. SMS (10DLC) <span className="text-[9px] px-1.5 py-0.5 bg-amber-500/20 text-amber-300 rounded font-medium">Coming Soon</span>
              </span>
              <span className="text-[11px] text-slate-400">Dedicated phone line, 2-way bot &amp; outside-24h fallback.</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/60 border border-cyan-500/30 bg-cyan-500/5 flex items-start gap-2.5">
            <Globe className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-cyan-300 block flex items-center gap-1">
                5. On-Page Chatbot <span className="text-[9px] px-1.5 py-0.5 bg-cyan-500/20 text-cyan-300 rounded font-medium">Coming Soon</span>
              </span>
              <span className="text-[11px] text-slate-400">Embed script &amp; direct link for website/funnel assets.</span>
            </div>
          </div>
        </div>
      </div>

      {/* Control Bar: Entries Count, Search, View Mode Toggle */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-2.5 sm:gap-3 w-full md:w-auto flex-wrap sm:flex-nowrap">
          <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 shrink-0">
            <span>Show</span>
            <select
              value={entriesPerPage}
              onChange={(e) => setEntriesPerPage(e.target.value)}
              className="bg-transparent font-semibold text-white focus:outline-none cursor-pointer"
            >
              <option value="10" className="bg-slate-900">10</option>
              <option value="25" className="bg-slate-900">25</option>
              <option value="50" className="bg-slate-900">50</option>
            </select>
            <span>Entries</span>
          </div>

          <div className="relative flex-1 sm:w-80 min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search account title, owner, phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
            />
          </div>
        </div>

        {/* View Switcher & Filter Badges */}
        <div className="flex items-center gap-2 flex-wrap w-full md:w-auto justify-start md:justify-end">
          <div className="flex items-center p-1 rounded-xl bg-slate-900 border border-slate-800 text-xs">
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Table View
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                viewMode === 'cards'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Omnichannel Cards
            </button>
          </div>

          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              filterType === 'all'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            All ({workspaces.length})
          </button>
          <button
            onClick={() => setFilterType('active')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              filterType === 'active'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            Current Active
          </button>
          <button
            onClick={() => setFilterType('whitelabeled')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              filterType === 'whitelabeled'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            Whitelabeled ({whitelabelCount})
          </button>
        </div>
      </div>

      {/* VIEW 1: WORKSPACES CONNECTIONS TABLE */}
      {viewMode === 'table' ? (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/70 text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3.5 px-4 w-20">Picture</th>
                  <th className="py-3.5 px-4">Title / Account Name</th>
                  <th className="py-3.5 px-4">Service Name / Status</th>
                  <th className="py-3.5 px-4">Subscriber Count</th>
                  <th className="py-3.5 px-4">SMS &amp; Standalone Bot Assets</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {filteredWorkspaces.map((ws) => {
                  const isCurrent = ws.id === activeWorkspaceId;
                  const hasSms = Boolean(ws.connectedSms?.connected);
                  const hasBot = Boolean(ws.connectedStandaloneChat?.enabled);

                  return (
                    <tr 
                      key={ws.id}
                      className={`transition-colors hover:bg-slate-800/40 ${
                        isCurrent ? 'bg-cyan-500/5' : ''
                      }`}
                    >
                      {/* PICTURE / AVATAR */}
                      <td className="py-3.5 px-4">
                        <div className="relative">
                          {ws.avatarUrl ? (
                            <img 
                              src={ws.avatarUrl} 
                              alt={ws.name} 
                              className="w-10 h-10 rounded-xl object-cover border border-slate-700 shadow"
                            />
                          ) : (
                            <div 
                              className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs text-slate-950 shadow"
                              style={{ backgroundColor: ws.color }}
                            >
                              {ws.name.substring(0, 2).toUpperCase()}
                            </div>
                          )}
                          {isCurrent && (
                            <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-cyan-400 border-2 border-slate-900 flex items-center justify-center" title="Active Workspace">
                              <Check className="w-2 h-2 text-slate-950 font-bold" />
                            </span>
                          )}
                        </div>
                      </td>

                      {/* TITLE / ACCOUNT NAME */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          {editingWsId === ws.id ? (
                            <input
                              type="text"
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveWorkspaceName(ws.id);
                                if (e.key === 'Escape') setEditingWsId(null);
                              }}
                              onBlur={() => handleSaveWorkspaceName(ws.id)}
                              autoFocus
                              className="font-bold text-sm text-white bg-slate-800 border border-cyan-500/50 rounded px-2 py-1 outline-none w-48"
                            />
                          ) : (
                            <>
                              <span className="font-bold text-sm text-white hover:text-cyan-400 transition-colors">
                                {ws.name}
                              </span>
                              <button
                                onClick={() => {
                                  setEditingWsId(ws.id);
                                  setEditingName(ws.name);
                                }}
                                className="p-1 rounded hover:bg-slate-700/50 text-slate-500 hover:text-cyan-400 transition-colors"
                                title="Rename workspace"
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                            </>
                          )}
                          {ws.whitelabel.enabled && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[9px] font-bold">
                              Whitelabel
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-400 block mt-0.5">
                          {ws.ownerName || 'Karl Schuckert'} &bull; <span className="text-slate-500 capitalize">{ws.businessType.replace('_', ' ')}</span>
                        </span>
                        <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400">
                          <span className="text-blue-400 font-medium truncate max-w-[160px]">
                            {ws.connectedPage.pageName}
                          </span>
                          {ws.connectedPage.connectedIg?.username && (
                            <span className="text-pink-400 font-medium">
                              {ws.connectedPage.connectedIg.username}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* SERVICE NAME / STATUS (Facebook Messenger Active, etc.) */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-slate-300 font-semibold">Facebook Messenger</span>
                            {ws.connectedPage.serviceStatus === 'deactivated' ? (
                              <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 text-[10px] font-bold">
                                Deactivated
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">
                                Active
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 flex-wrap">
                            {ws.connectedPage.connectedIg?.connected && (
                              <span className="px-1.5 py-0.5 rounded bg-pink-500/10 text-pink-300 border border-pink-500/20 text-[10px] flex items-center gap-1">
                                <Instagram className="w-2.5 h-2.5" /> IG Linked
                              </span>
                            )}
                            {ws.connectedPage.connectedWhatsApp?.connected && (
                              <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-[10px] flex items-center gap-1">
                                <Phone className="w-2.5 h-2.5" /> WhatsApp WABA
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* SUBSCRIBER COUNT */}
                      <td className="py-3.5 px-4">
                        <span className="text-base font-bold text-white block">
                          {ws.stats.subscribers.toLocaleString()}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          Across all channels
                        </span>
                      </td>

                      {/* SMS & STANDALONE BOT ASSETS */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-1.5">
                          {/* Standalone Chatbot Asset */}
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => {
                                setActiveChatbotModalWs(ws);
                                setPreviewMessages([
                                  {
                                    sender: 'bot',
                                    text: ws.connectedStandaloneChat?.welcomeMessage || 'Hey there! How can we help automate your business today?',
                                    time: 'Just now'
                                  }
                                ]);
                              }}
                              className={`px-2 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                                hasBot
                                  ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/25'
                                  : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'
                              }`}
                              title="Configure Standalone Web Chatbot for on-page assets"
                            >
                              <Globe className="w-3 h-3 text-cyan-400" />
                              <span>{hasBot ? 'On-Page Bot Active' : '+ Add Web Bot'}</span>
                            </button>

                            {hasBot && ws.connectedStandaloneChat?.businessAssets?.[0] && (
                              <span className="text-[10px] text-slate-400 truncate max-w-[120px]" title={ws.connectedStandaloneChat.businessAssets.join(', ')}>
                                &bull; {ws.connectedStandaloneChat.businessAssets[0]}
                              </span>
                            )}
                          </div>

                          {/* SMS Phone Line */}
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => setActiveSmsModalWs(ws)}
                              className={`px-2 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                                hasSms
                                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25'
                                  : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'
                              }`}
                              title="Configure SMS 10DLC Number"
                            >
                              <Smartphone className="w-3 h-3 text-amber-400" />
                              <span>{hasSms ? ws.connectedSms?.phoneNumber : '+ Add SMS (10DLC)'}</span>
                            </button>
                            {hasSms && ws.connectedSms?.compliant10dlc && (
                              <span className="text-[9px] px-1 rounded bg-emerald-500/15 text-emerald-400 font-mono">10DLC</span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* ACTIONS */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {isCurrent ? (
                            <span className="px-3 py-1 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-[11px] font-bold flex items-center gap-1">
                              <Check className="w-3 h-3" /> Active
                            </span>
                          ) : (
                            <button
                              onClick={() => onSelectWorkspace(ws.id)}
                              className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-cyan-500 hover:text-slate-950 text-slate-200 font-semibold text-[11px] transition-all cursor-pointer"
                            >
                              Switch
                            </button>
                          )}

                          <button
                            onClick={() => setActiveWhitelabelModalWs(ws)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                            title="Whitelabel Portal"
                          >
                            <Crown className="w-3.5 h-3.5 text-amber-400" />
                          </button>

                          <button
                            onClick={() => handleDeleteWorkspace(ws.id, ws.name)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                            title="Delete Workspace"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* RECENTLY DELETED SECTION */}
          {deletedWorkspaces.length > 0 && (
            <div className="mt-8 rounded-2xl border border-amber-500/20 bg-amber-500/5 overflow-hidden">
              <div className="px-5 py-4 border-b border-amber-500/10 flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold text-amber-300">Recently Deleted</h3>
                <span className="text-[11px] text-slate-400">({deletedWorkspaces.length} workspace{deletedWorkspaces.length !== 1 ? 's' : ''} • auto-permanently deleted after 90 days)</span>
              </div>
              <div className="divide-y divide-amber-500/10">
                {deletedWorkspaces.map((ws) => {
                  const daysLeft = getDaysRemaining(ws.deletedAt);
                  return (
                    <div key={ws.id} className="px-5 py-3.5 flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <div className="font-bold text-sm text-slate-300">{ws.name}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Deleted {ws.deletedAt ? new Date(ws.deletedAt).toLocaleDateString() : 'recently'} •{' '}
                          <span className={daysLeft <= 7 ? 'text-rose-400 font-semibold' : 'text-amber-400'}>
                            {daysLeft} day{daysLeft !== 1 ? 's' : ''} left to restore
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRestoreWorkspace(ws.id)}
                        className="px-3.5 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 text-xs font-bold transition-colors flex-shrink-0 cursor-pointer"
                      >
                        Restore
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* VIEW 2: OMNICHANNEL CARDS VIEW */
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          {filteredWorkspaces.map((ws) => {
            const isActive = ws.id === activeWorkspaceId;
            const hasSms = Boolean(ws.connectedSms?.connected);
            const hasBot = Boolean(ws.connectedStandaloneChat?.enabled);

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
                      {ws.avatarUrl ? (
                        <img 
                          src={ws.avatarUrl} 
                          alt={ws.name} 
                          className="w-12 h-12 rounded-xl object-cover border border-slate-700 shadow-md"
                        />
                      ) : (
                        <div 
                          className="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg text-slate-950 shadow-md"
                          style={{ backgroundColor: ws.color }}
                        >
                          {ws.name.substring(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-bold text-white">{ws.name}</h3>
                          {isActive && (
                            <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                              <Check className="w-2.5 h-2.5" /> Active
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 capitalize">
                          {ws.ownerName || 'Karl Schuckert'} &bull; {ws.businessType.replace('_', ' ')}
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
                        {ws.pricingModel === 'segmate_unlimited_pages' ? 'Agency Unlimited' : 'Standard Tiered'}
                      </span>
                    </div>
                  </div>

                  {/* Connected Channels Stack: FB + IG + WA + SMS + Standalone Chatbot */}
                  <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3.5 space-y-2 mb-4">
                    <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                      <span>Connected Channel Matrix</span>
                      <span className="text-[10px] text-cyan-400/80">Meta Anchor + SMS &amp; Web Bot</span>
                    </div>

                    {/* 1. Facebook Page */}
                    <div className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded-lg bg-slate-900/60 border border-slate-800/60">
                      <div className="flex items-center gap-2 min-w-0">
                        <Facebook className="w-4 h-4 text-blue-400 flex-shrink-0" />
                        <span className="text-slate-200 font-medium truncate">{ws.connectedPage.pageName}</span>
                      </div>
                      <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1 flex-shrink-0">
                        <CheckCircle2 className="w-3 h-3" /> FB Page Anchor
                      </span>
                    </div>

                    {/* 2. Instagram */}
                    <div className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded-lg bg-slate-900/60 border border-slate-800/60">
                      <div className="flex items-center gap-2 min-w-0">
                        <Instagram className="w-4 h-4 text-pink-400 flex-shrink-0" />
                        <span className="text-slate-200 font-medium truncate">
                          {ws.connectedPage.connectedIg?.username || 'No Instagram Connected'}
                        </span>
                      </div>
                      {ws.connectedPage.connectedIg?.connected ? (
                        <span className="text-[10px] text-pink-400 font-mono flex items-center gap-1 flex-shrink-0">
                          <CheckCircle2 className="w-3 h-3" /> Linked via FB
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-500 font-mono flex-shrink-0">Unlinked</span>
                      )}
                    </div>

                    {/* 3. WhatsApp WABA */}
                    <div className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded-lg bg-slate-900/60 border border-slate-800/60">
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

                    {/* 4. SMS & Mobile */}
                    <div className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded-lg bg-slate-900/60 border border-amber-500/20 bg-amber-500/5">
                      <div className="flex items-center gap-2 min-w-0">
                        <Smartphone className="w-4 h-4 text-amber-400 flex-shrink-0" />
                        <span className="text-slate-200 font-medium truncate">
                          {hasSms ? ws.connectedSms?.phoneNumber : 'No SMS Number Configured'}
                        </span>
                      </div>
                      {hasSms ? (
                        <button
                          onClick={() => setActiveSmsModalWs(ws)}
                          className="text-[10px] text-amber-300 hover:text-white font-mono flex items-center gap-1 flex-shrink-0 cursor-pointer"
                        >
                          <CheckCircle2 className="w-3 h-3 text-amber-400" /> 10DLC Active
                        </button>
                      ) : (
                        <button
                          onClick={() => setActiveSmsModalWs(ws)}
                          className="text-[10px] text-amber-400 hover:underline font-medium cursor-pointer"
                        >
                          + Setup SMS
                        </button>
                      )}
                    </div>

                    {/* 5. Standalone Web Chatbot */}
                    <div className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded-lg bg-slate-900/60 border border-cyan-500/20 bg-cyan-500/5">
                      <div className="flex items-center gap-2 min-w-0">
                        <Globe className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                        <span className="text-slate-200 font-medium truncate">
                          {hasBot ? ws.connectedStandaloneChat?.botName : 'No Web Chatbot Asset'}
                        </span>
                      </div>
                      {hasBot ? (
                        <button
                          onClick={() => {
                            setActiveChatbotModalWs(ws);
                            setPreviewMessages([
                              {
                                sender: 'bot',
                                text: ws.connectedStandaloneChat?.welcomeMessage || 'Welcome!',
                                time: 'Just now'
                              }
                            ]);
                          }}
                          className="text-[10px] text-cyan-300 hover:text-white font-mono flex items-center gap-1 flex-shrink-0 cursor-pointer"
                        >
                          <CheckCircle2 className="w-3 h-3 text-cyan-400" /> On-Page Active
                        </button>
                      ) : (
                        <button
                          onClick={() => setActiveChatbotModalWs(ws)}
                          className="text-[10px] text-cyan-400 hover:underline font-medium cursor-pointer"
                        >
                          + Setup Web Bot
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Stats row */}
                  <div className="grid grid-cols-4 gap-2 text-center py-2 px-3 rounded-xl bg-slate-950/60 border border-slate-800 mb-4">
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

                {/* Card Actions */}
                <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-800">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setActiveChatbotModalWs(ws)}
                      className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                      title="Standalone Chatbot for on-page and business assets"
                    >
                      <Globe className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Web Bot</span>
                    </button>
                    <button
                      onClick={() => setActiveSmsModalWs(ws)}
                      className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                      title="SMS & 10DLC"
                    >
                      <Smartphone className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">SMS</span>
                    </button>
                    <button
                      onClick={() => setActiveWhitelabelModalWs(ws)}
                      className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors cursor-pointer"
                      title="Whitelabel Portal"
                    >
                      <Crown className="w-3.5 h-3.5 text-amber-400" />
                    </button>
                    <button
                      onClick={() => handleDeleteWorkspace(ws.id, ws.name)}
                      className="p-2 rounded-lg bg-slate-800/80 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 text-xs transition-colors cursor-pointer"
                      title="Delete Workspace"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {isActive ? (
                    <span className="px-4 py-2 rounded-xl bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 text-xs font-bold flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-cyan-400" /> Current Workspace
                    </span>
                  ) : (
                    <button
                      onClick={() => onSelectWorkspace(ws.id)}
                      className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-md shadow-cyan-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      Switch to Workspace
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL 1: FACEBOOK PAGE SYNC MODAL (Discovery of pages & linked IG/WhatsApp) */}
      {isPageSyncModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-emerald-500/40 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                  <RefreshCw className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Facebook Page Sync</h3>
                  <p className="text-xs text-slate-400">Scan Meta Business Account for Facebook Pages &amp; attached Instagram/WhatsApp.</p>
                </div>
              </div>
              <button
                onClick={() => setIsPageSyncModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-slate-300 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-white">Meta Authenticated Account:</span>
                <span className="font-mono text-cyan-400">Karl Schuckert (instantreferralsapp@gmail.com)</span>
              </div>
              <p className="text-slate-400 text-[11px]">
                In Chatmize, each Facebook Page anchors an isolated workspace. Chatmize automatically discovers your Facebook Pages and any Instagram Professional accounts or WhatsApp Business lines linked to them.
              </p>
            </div>

            {/* Discovered Pages List */}
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Discovered Facebook Pages &amp; Linked Assets
              </span>

              <div className="p-3 rounded-xl bg-slate-950/60 border border-emerald-500/30 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Facebook className="w-5 h-5 text-blue-400 flex-shrink-0" />
                  <div>
                    <span className="font-bold text-white text-xs block">Chatmize (Official Account)</span>
                    <span className="text-[10px] text-pink-400">↳ Linked Instagram: @chatmize</span>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                  Synced (1,312 Subs)
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Facebook className="w-5 h-5 text-blue-400 flex-shrink-0" />
                  <div>
                    <span className="font-bold text-white text-xs block">DentalCare Austin Clinic</span>
                    <span className="text-[10px] text-pink-400">↳ Linked Instagram: @dentalcareaustin</span>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                  Synced (2,840 Subs)
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Facebook className="w-5 h-5 text-blue-400 flex-shrink-0" />
                  <div>
                    <span className="font-bold text-white text-xs block">Swim with Shark Mastermind</span>
                    <span className="text-[10px] text-pink-400">↳ Linked Instagram: @sharkbitestv</span>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                  Synced (1,890 Subs)
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Facebook className="w-5 h-5 text-blue-400 flex-shrink-0" />
                  <div>
                    <span className="font-bold text-white text-xs block">Vice &amp; Grind</span>
                    <span className="text-[10px] text-slate-500">↳ No Instagram account linked</span>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px] font-mono">
                  Ready to Sync (6 Subs)
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsPageSyncModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-medium text-xs hover:bg-slate-700 cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                disabled={isSyncingPages}
                onClick={handleSimulatedPageSync}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wide shadow-lg shadow-emerald-600/30 transition-all flex items-center gap-2 cursor-pointer"
              >
                {isSyncingPages ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Syncing from Meta...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Run Full Sync Now</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: STANDALONE CHATBOT FOR ON-PAGE & BUSINESS ASSETS */}
      {activeChatbotModalWs && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-cyan-500/40 rounded-3xl max-w-4xl w-full p-6 sm:p-8 shadow-2xl space-y-6 my-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
                  <Globe className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-bold text-white">
                      Standalone Chatbot (On-Page &amp; Business Assets)
                    </h3>
                    <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[10px] font-bold">
                      Omnichannel Web Layer
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Deploy an AI chat widget directly on your website, funnels, Shopify store, or share via direct standalone link.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveChatbotModalWs(null)}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Embed code, Direct URL, and Business Assets */}
              <div className="lg:col-span-7 space-y-5 text-xs">
                {/* 1-Click Embed Snippet */}
                <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white flex items-center gap-1.5">
                      <Code className="w-4 h-4 text-cyan-400" />
                      Website Embed Code Snippet (On-Page Asset)
                    </span>
                    <button
                      onClick={() => handleCopy(
                        `<script src="https://chatmize.io/widget.js" data-workspace="${activeChatbotModalWs.slug}" async></script>`,
                        'embed'
                      )}
                      className="px-2.5 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 font-semibold text-[11px] flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      {copiedKey === 'embed' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedKey === 'embed' ? 'Copied!' : 'Copy Snippet'}</span>
                    </button>
                  </div>
                  <p className="text-slate-400 text-[11px]">
                    Paste before the closing <code>&lt;/body&gt;</code> tag on WordPress, Shopify, Webflow, ClickFunnels, or any HTML page.
                  </p>
                  <pre className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-[11px] font-mono text-cyan-300 overflow-x-auto select-all">
                    {`<script src="https://chatmize.io/widget.js" data-workspace="${activeChatbotModalWs.slug}" async></script>`}
                  </pre>
                </div>

                {/* Direct Standalone Chat URL */}
                <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white flex items-center gap-1.5">
                      <ExternalLink className="w-4 h-4 text-blue-400" />
                      Direct Standalone Chat URL
                    </span>
                    <button
                      onClick={() => handleCopy(`https://chatmize.io/chat/${activeChatbotModalWs.slug}`, 'link')}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-[11px] flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      {copiedKey === 'link' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedKey === 'link' ? 'Copied!' : 'Copy URL'}</span>
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={`https://chatmize.io/chat/${activeChatbotModalWs.slug}`}
                      className="flex-1 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 font-mono text-[11px]"
                    />
                    <a
                      href={`https://chatmize.io/chat/${activeChatbotModalWs.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center gap-1"
                    >
                      <span>Open</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>

                {/* Targeted Business Assets */}
                <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-white block">Connected Business Assets</span>
                      <span className="text-[11px] text-slate-400">Pages &amp; properties where this chatbot runs</span>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 text-[10px] font-mono">
                      {activeChatbotModalWs.connectedStandaloneChat?.businessAssets?.length || 2} Assets
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    {(activeChatbotModalWs.connectedStandaloneChat?.businessAssets || [
                      'Main Website (Homepage & Blog)',
                      'Checkout Funnel Landing Page'
                    ]).map((asset, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-slate-800 text-xs">
                        <span className="text-slate-200">{asset}</span>
                        <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                          <Check className="w-3 h-3" /> Deployed
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Add Asset field */}
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="text"
                      placeholder="e.g. shopify.mystore.com or Lead Funnel"
                      value={newTargetAssetInput}
                      onChange={(e) => setNewTargetAssetInput(e.target.value)}
                      className="flex-1 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 text-xs focus:outline-none focus:border-cyan-500"
                    />
                    <button
                      onClick={() => {
                        if (!newTargetAssetInput.trim()) return;
                        const currentAssets = activeChatbotModalWs.connectedStandaloneChat?.businessAssets || [];
                        const updatedAssets = [...currentAssets, newTargetAssetInput.trim()];
                        setActiveChatbotModalWs({
                          ...activeChatbotModalWs,
                          connectedStandaloneChat: {
                            ...(activeChatbotModalWs.connectedStandaloneChat || {
                              enabled: true,
                              status: 'active',
                              botName: `${activeChatbotModalWs.name} Assistant`,
                              welcomeMessage: 'Hello!',
                              primaryColor: '#00d2ff',
                              hostedSlug: activeChatbotModalWs.slug,
                              embedSnippet: '',
                              allowedDomains: [],
                              businessAssets: [],
                              bubblePosition: 'bottom-right'
                            }),
                            businessAssets: updatedAssets
                          }
                        });
                        setNewTargetAssetInput('');
                      }}
                      className="px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs cursor-pointer"
                    >
                      + Add Asset
                    </button>
                  </div>
                </div>

                {/* Customizer Settings */}
                <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
                  <span className="font-bold text-white block">Bot Appearance &amp; Greeting</span>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-400 text-[11px] mb-1">Bot Display Name</label>
                      <input
                        type="text"
                        value={activeChatbotModalWs.connectedStandaloneChat?.botName || `${activeChatbotModalWs.name} Assistant`}
                        onChange={(e) => setActiveChatbotModalWs({
                          ...activeChatbotModalWs,
                          connectedStandaloneChat: {
                            ...(activeChatbotModalWs.connectedStandaloneChat as any),
                            botName: e.target.value
                          }
                        })}
                        className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 text-[11px] mb-1">Brand Accent Color</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={activeChatbotModalWs.connectedStandaloneChat?.primaryColor || '#00d2ff'}
                          onChange={(e) => setActiveChatbotModalWs({
                            ...activeChatbotModalWs,
                            connectedStandaloneChat: {
                              ...(activeChatbotModalWs.connectedStandaloneChat as any),
                              primaryColor: e.target.value
                            }
                          })}
                          className="w-8 h-8 rounded-lg border-0 bg-transparent cursor-pointer"
                        />
                        <span className="text-slate-300 font-mono text-[11px]">
                          {activeChatbotModalWs.connectedStandaloneChat?.primaryColor || '#00d2ff'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-slate-400 text-[11px]">Welcome Greeting Prompt</label>
                      <EmojiPickerButton onPick={(e) => wsWelcomeEmoji.insert(e, activeChatbotModalWs.connectedStandaloneChat?.welcomeMessage || '', (v) => setActiveChatbotModalWs({
                        ...activeChatbotModalWs,
                        connectedStandaloneChat: {
                          ...(activeChatbotModalWs.connectedStandaloneChat as any),
                          welcomeMessage: v
                        }
                      }))} placement="up" />
                    </div>
                    <textarea
                      rows={2}
                      ref={wsWelcomeEmoji.ref}
                      value={activeChatbotModalWs.connectedStandaloneChat?.welcomeMessage || 'Hey there! How can we help automate your business today?'}
                      onChange={(e) => setActiveChatbotModalWs({
                        ...activeChatbotModalWs,
                        connectedStandaloneChat: {
                          ...(activeChatbotModalWs.connectedStandaloneChat as any),
                          welcomeMessage: e.target.value
                        }
                      })}
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Right Column: Live Interactive On-Page Chatbot Simulator */}
              <div className="lg:col-span-5 flex flex-col">
                <span className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  Live Interactive On-Page Widget Preview
                </span>

                {/* Simulated Webpage Asset Frame */}
                <div className="flex-1 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col overflow-hidden shadow-2xl relative min-h-[440px]">
                  {/* Browser Address Bar Header */}
                  <div className="p-2.5 bg-slate-900/90 border-b border-slate-800 flex items-center gap-2 text-[10px]">
                    <div className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                    </div>
                    <div className="flex-1 mx-2 px-2.5 py-1 rounded bg-slate-950 text-slate-400 font-mono text-[9px] truncate">
                      https://{activeChatbotModalWs.slug}.com
                    </div>
                  </div>

                  {/* Simulated Webpage Content Background */}
                  <div className="p-4 flex-1 flex flex-col justify-between relative bg-gradient-to-b from-slate-950 to-slate-900">
                    <div className="space-y-2 opacity-30 pointer-events-none">
                      <div className="h-3 w-1/3 bg-slate-700 rounded" />
                      <div className="h-6 w-3/4 bg-slate-600 rounded font-bold" />
                      <div className="h-2.5 w-full bg-slate-700 rounded" />
                      <div className="h-2.5 w-5/6 bg-slate-700 rounded" />
                    </div>

                    {/* Chatbot Bubble Launcher Floating at Bottom-Right */}
                    <div className="absolute inset-x-3 bottom-3 top-10 flex flex-col justify-end">
                      <div className="rounded-2xl bg-slate-900 border border-cyan-500/30 shadow-2xl flex flex-col h-[340px] overflow-hidden">
                        {/* Widget Header */}
                        <div 
                          className="p-3 flex items-center justify-between text-white"
                          style={{ backgroundColor: activeChatbotModalWs.connectedStandaloneChat?.primaryColor || '#00d2ff' }}
                        >
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-slate-950/20 flex items-center justify-center font-bold text-[10px]">
                              🤖
                            </div>
                            <div>
                              <span className="font-bold text-xs text-slate-950 block leading-tight">
                                {activeChatbotModalWs.connectedStandaloneChat?.botName || 'Chat Assistant'}
                              </span>
                              <span className="text-[9px] text-slate-900 font-medium">Online &bull; Instant Reply</span>
                            </div>
                          </div>
                          <span className="w-2 h-2 rounded-full bg-emerald-400" />
                        </div>

                        {/* Widget Messages Body */}
                        <div className="flex-1 p-3 overflow-y-auto space-y-2 text-xs">
                          {previewMessages.map((msg, i) => (
                            <div 
                              key={i} 
                              className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                              <div 
                                className={`p-2.5 rounded-xl max-w-[80%] leading-relaxed ${
                                  msg.sender === 'user'
                                    ? 'bg-cyan-500 text-slate-950 font-medium rounded-tr-none'
                                    : 'bg-slate-800 text-slate-200 border border-slate-700 rounded-tl-none'
                                }`}
                              >
                                <p className="text-[11px]">{msg.text}</p>
                                <span className="text-[8px] opacity-60 block text-right mt-0.5">{msg.time}</span>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Widget Input Bar */}
                        <form onSubmit={handleSendPreviewMessage} className="p-2 border-t border-slate-800 bg-slate-950 flex items-center gap-1.5">
                          <input
                            type="text"
                            placeholder="Type a test message..."
                            value={previewChatInput}
                            onChange={(e) => setPreviewChatInput(e.target.value)}
                            className="flex-1 px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 text-xs focus:outline-none focus:border-cyan-500"
                          />
                          <button
                            type="submit"
                            className="p-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 cursor-pointer"
                          >
                            <Send className="w-3.5 h-3.5" />
                          </button>
                        </form>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setActiveChatbotModalWs(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-medium text-xs hover:bg-slate-700 cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  if (activeChatbotModalWs.connectedStandaloneChat) {
                    handleSaveChatbotSettings(activeChatbotModalWs.id, activeChatbotModalWs.connectedStandaloneChat);
                  } else {
                    setActiveChatbotModalWs(null);
                  }
                }}
                className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/20 cursor-pointer"
              >
                Save Standalone Bot Settings
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: SMS & 10DLC CONNECTION MODAL */}
      {activeSmsModalWs && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-amber-500/40 rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">SMS Phone Line &amp; 10DLC Compliance</h3>
                  <p className="text-xs text-slate-400">{activeSmsModalWs.name}</p>
                </div>
              </div>
              <button
                onClick={() => setActiveSmsModalWs(null)}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 space-y-1">
                <span className="font-bold block">TCPA &amp; Meta 24-Hour Re-Engagement Policy</span>
                <p className="text-[11px] text-slate-300">
                  When a Meta 24-hour window expires on Messenger or Instagram, ChatMize can automatically trigger an SMS opt-in link to restart the live chat or confirm appointments.
                </p>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Dedicated Phone Number (Twilio / Carrier)</label>
                <input
                  type="text"
                  placeholder="+1 (833) 734-6283 or local +1 (512) 555-0199"
                  value={activeSmsModalWs.connectedSms?.phoneNumber || ''}
                  onChange={(e) => setActiveSmsModalWs({
                    ...activeSmsModalWs,
                    connectedSms: {
                      ...(activeSmsModalWs.connectedSms || {
                        provider: 'twilio',
                        status: 'active',
                        connected: true,
                        compliant10dlc: true
                      }),
                      phoneNumber: e.target.value
                    }
                  })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">SMS Provider</label>
                  <select
                    value={activeSmsModalWs.connectedSms?.provider || 'twilio'}
                    onChange={(e) => setActiveSmsModalWs({
                      ...activeSmsModalWs,
                      connectedSms: {
                        ...(activeSmsModalWs.connectedSms as any),
                        provider: e.target.value as any
                      }
                    })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
                  >
                    <option value="twilio">Twilio Messaging Service</option>
                    <option value="telnyx">Telnyx Cloud SMS</option>
                    <option value="bandwidth">Bandwidth.com</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">10DLC Registration Status</label>
                  <div className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-emerald-400 font-semibold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Verified &amp; Approved</span>
                  </div>
                </div>
              </div>

              {/* Automatic Keywords */}
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                <span className="font-bold text-slate-300 block">Automatic Compliance Keywords</span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300 font-mono text-[10px]">
                    STOP (Opt-out)
                  </span>
                  <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300 font-mono text-[10px]">
                    START (Re-subscribe)
                  </span>
                  <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300 font-mono text-[10px]">
                    HELP (Support Info)
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                onClick={() => setActiveSmsModalWs(null)}
                className="px-3.5 py-1.5 rounded-lg bg-slate-800 text-slate-300 font-medium text-xs hover:bg-slate-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (activeSmsModalWs.connectedSms) {
                    handleSaveSmsSettings(activeSmsModalWs.id, activeSmsModalWs.connectedSms);
                  } else {
                    setActiveSmsModalWs(null);
                  }
                }}
                className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs cursor-pointer"
              >
                Save SMS Line
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: CREATE NEW WORKSPACE MODAL */}
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
                  <p className="text-xs text-slate-400">Bind a Facebook Page with Instagram, WhatsApp, SMS &amp; Web Bot.</p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateWorkspace} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Workspace Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Austin Aesthetics (Business 1)"
                  value={newWorkspaceName}
                  onChange={(e) => setNewWorkspaceName(e.target.value)}
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
                    <option value="segmate_unlimited_pages">Agency Unlimited Model (Unlimited Pages)</option>
                    <option value="manychat_per_page">Standard Tiered Model (Per-Page)</option>
                    <option value="custom_retainer">Agency Custom Retainer</option>
                  </select>
                </div>
              </div>

              {/* Meta Asset Bindings */}
              <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
                <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider block">
                  Meta Anchor Channels (1 FB Page = 1 IG = 1 WhatsApp)
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

              {/* SMS & Standalone Chatbot Expansion Section */}
              <div className="p-4 rounded-xl bg-slate-950/70 border border-amber-500/20 space-y-3">
                <span className="text-xs font-bold text-amber-400 uppercase tracking-wider block">
                  Omnichannel Expansion (SMS &amp; Standalone Web Bot)
                </span>

                <div>
                  <label className="block text-xs text-slate-300 mb-1">SMS Phone Line (10DLC)</label>
                  <input
                    type="text"
                    placeholder="+1 (833) 734-6283 or local number"
                    value={newSmsPhone}
                    onChange={(e) => setNewSmsPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-200"
                  />
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div>
                    <span className="text-xs font-semibold text-white block">Deploy Standalone Web Chatbot</span>
                    <span className="text-[11px] text-slate-400">Generates script embed for on-page assets</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={newEnableChatbot}
                    onChange={(e) => setNewEnableChatbot(e.target.checked)}
                    className="w-4 h-4 rounded text-cyan-500"
                  />
                </div>
              </div>

              {/* Whitelabel Toggle */}
              <div className="p-3.5 rounded-xl bg-slate-950/50 border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-slate-200 block">Enable Whitelabel Client Portal</span>
                    <span className="text-[11px] text-slate-400">Give client custom domain &amp; hide ChatMize branding.</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={newWhitelabelEnabled}
                    onChange={(e) => setNewWhitelabelEnabled(e.target.checked)}
                    className="w-4 h-4 rounded text-cyan-500"
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

      {/* MODAL 5: WHITELABEL CONFIGURATION MODAL */}
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
                <X className="w-5 h-5" />
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
                  <span className="text-slate-400 text-[11px]">Removes all ChatMize branding from widgets &amp; popups</span>
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
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                onClick={() => setActiveWhitelabelModalWs(null)}
                className="px-3.5 py-1.5 rounded-lg bg-slate-800 text-slate-300 font-medium text-xs hover:bg-slate-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleSaveWhitelabel(activeWhitelabelModalWs.id, activeWhitelabelModalWs.whitelabel)}
                className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs cursor-pointer"
              >
                Save Whitelabel Settings
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RECENTLY DELETED SECTION (Cards View) */}
      {viewMode !== 'table' && deletedWorkspaces.length > 0 && (
        <div className="mt-8 rounded-2xl border border-amber-500/20 bg-amber-500/5 overflow-hidden">
          <div className="px-5 py-4 border-b border-amber-500/10 flex items-center gap-2">
            <Trash2 className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold text-amber-300">Recently Deleted</h3>
            <span className="text-[11px] text-slate-400">({deletedWorkspaces.length} workspace{deletedWorkspaces.length !== 1 ? 's' : ''} • auto-permanently deleted after 90 days)</span>
          </div>
          <div className="divide-y divide-amber-500/10">
            {deletedWorkspaces.map((ws) => {
              const daysLeft = getDaysRemaining(ws.deletedAt);
              return (
                <div key={ws.id} className="px-5 py-3.5 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="font-bold text-sm text-slate-300">{ws.name}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Deleted {ws.deletedAt ? new Date(ws.deletedAt).toLocaleDateString() : 'recently'} •{' '}
                      <span className={daysLeft <= 7 ? 'text-rose-400 font-semibold' : 'text-amber-400'}>
                        {daysLeft} day{daysLeft !== 1 ? 's' : ''} left to restore
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRestoreWorkspace(ws.id)}
                    className="px-3.5 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 text-xs font-bold transition-colors flex-shrink-0 cursor-pointer"
                  >
                    Restore
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* DELETE WORKSPACE CONFIRMATION MODAL */}
      {deleteConfirmState && (
        <DeleteWorkspaceModal
          workspaceName={deleteConfirmState.name}
          onCancel={() => setDeleteConfirmState(null)}
          onConfirm={handleConfirmDelete}
        />
      )}

      {/* FB LOGOUT CONFIRMATION MODAL */}
      {logoutConfirmOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
                <LogOut className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Log Out of Meta / Facebook?</h3>
                <p className="text-xs text-slate-400">Session disconnection confirmation</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 bg-slate-950/60 p-3 rounded-xl border border-slate-800 leading-relaxed">
              Are you sure you want to disconnect your active Facebook session? You will need to click <span className="text-emerald-400 font-semibold">Facebook Page Sync</span> to re-authenticate when discovering new assets.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setLogoutConfirmOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 cursor-pointer transition-colors"
              >
                Keep Logged In
              </button>
              <button
                type="button"
                onClick={() => {
                  setLogoutConfirmOpen(false);
                  setToastMessage('Facebook session disconnected. Click Facebook Page Sync to re-authenticate.');
                  setTimeout(() => setToastMessage(null), 4000);
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white shadow-lg shadow-rose-600/30 cursor-pointer transition-all"
              >
                Log Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST NOTIFICATION */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 border border-cyan-500/40 text-slate-200 px-4 py-3 rounded-2xl shadow-2xl shadow-cyan-950/80 flex items-center gap-3 animate-in slide-in-from-bottom-3 duration-200">
          <div className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
          <span className="text-xs font-medium">{toastMessage}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="text-slate-400 hover:text-white text-xs ml-2"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
};

// Hardened delete confirmation: requires typing DELETE + acknowledging data loss
const DeleteWorkspaceModal: React.FC<{
  workspaceName: string;
  onCancel: () => void;
  onConfirm: () => void;
}> = ({ workspaceName, onCancel, onConfirm }) => {
  const [confirmText, setConfirmText] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const canDelete = confirmText.trim().toLowerCase() === 'delete' && acknowledged;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-slate-900 border border-rose-500/30 w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
            <Trash2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Delete Workspace?</h3>
            <p className="text-xs text-slate-400">This action cannot be undone.</p>
          </div>
        </div>

        <div className="text-xs text-slate-300 bg-slate-950/60 p-3 rounded-xl border border-slate-800 leading-relaxed space-y-2">
          <p>
            You are about to delete <span className="font-bold text-white">"{workspaceName}"</span>.
          </p>
          <p className="text-emerald-300 font-medium">
            Your data is safe: we hold deleted workspaces for 90 days. You can restore everything from the Recently Deleted section on the Workspaces page.
          </p>
          <ul className="list-disc list-inside space-y-1 text-slate-400">
            <li>All bot flows and automations will be deactivated</li>
            <li>All connected accounts (Facebook, Instagram, WhatsApp, SMS) will be unlinked</li>
            <li>All audience contacts and conversation history will be archived</li>
            <li>All campaigns, broadcasts, and scheduled messages will be paused</li>
          </ul>
          <p className="text-slate-500">
            After 90 days the workspace and all its data will be permanently erased.
          </p>
        </div>

        <label className="flex items-start gap-2.5 cursor-pointer group">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
            className="mt-0.5 w-4 h-4 rounded accent-rose-500 cursor-pointer"
          />
          <span className="text-xs text-slate-300 group-hover:text-white transition-colors">
            I understand this workspace will be deactivated and held for 90 days before permanent deletion.
          </span>
        </label>

        <div>
          <label className="text-xs text-slate-400 block mb-1.5">
            Type <span className="font-mono font-bold text-rose-400">DELETE</span> to confirm:
          </label>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="DELETE"
            autoComplete="off"
            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 focus:border-rose-500/50 text-sm text-white placeholder:text-slate-600 outline-none font-mono"
          />
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 cursor-pointer transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!canDelete}
            className={`px-4 py-2 rounded-xl text-xs font-bold text-white shadow-lg transition-all ${
              canDelete
                ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/30 cursor-pointer'
                : 'bg-slate-700/50 text-slate-500 cursor-not-allowed shadow-none'
            }`}
          >
            Delete Workspace
          </button>
        </div>
      </div>
    </div>
  );
};
