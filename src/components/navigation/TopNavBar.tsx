import React, { useState, useRef, useEffect } from 'react';
import { 
  Building2, 
  Search, 
  Bell, 
  Sparkles, 
  Layers, 
  ShieldCheck, 
  LogOut, 
  ExternalLink, 
  Check, 
  Plus, 
  Menu,
  ChevronDown,
  Workflow,
  LayoutDashboard,
  MessageSquare,
  Users,
  Bot,
  Settings,
  HelpCircle
} from 'lucide-react';
import { WorkspaceSilo } from '../../types/workspace';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';
import { BuildCatalogBell } from './BuildCatalogBell';
import { AppUser, signOutUser, prodDb } from '../../lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';

interface TopNavBarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  workspaces: WorkspaceSilo[];
  activeWorkspaceId: string;
  onSelectWorkspace: (id: string) => void;
  currentUser: AppUser | null;
  onSignOut: () => void;
  onOpenCreateBotModal: () => void;
  isSidebarCollapsed: boolean;
  onToggleSidebar: () => void;
}

export const TopNavBar: React.FC<TopNavBarProps> = ({
  activeTab,
  setActiveTab,
  workspaces,
  activeWorkspaceId,
  onSelectWorkspace,
  currentUser,
  onSignOut,
  onOpenCreateBotModal,
  isSidebarCollapsed,
  onToggleSidebar
}) => {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const [isOg, setIsOg] = useState(false);

  // OG stamp: live badge state from the user's own profile doc.
  useEffect(() => {
    if (!currentUser?.uid) {
      setIsOg(false);
      return;
    }
    const unsub = onSnapshot(
      doc(prodDb, 'users', currentUser.uid),
      (snap) => {
        const badges = (snap.data() as { badges?: { id: string }[] } | undefined)?.badges ?? [];
        setIsOg(badges.some((b) => b.id === 'og_stamp'));
      },
      () => setIsOg(false),
    );
    return unsub;
  }, [currentUser?.uid]);

  const activeWorkspace = workspaces.find(w => w.id === activeWorkspaceId) || workspaces[0];

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard shortcut for Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(prev => !prev);
      }
      if (e.key === 'Escape') {
        setIsSearchOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Get current breadcrumb info
  const getViewDetails = () => {
    switch (activeTab) {
      case 'dashboard':
        return { title: 'Dashboard & Metrics', category: 'Overview', icon: LayoutDashboard };
      case 'bot-list':
        return { title: 'Bot Maps & Automation', category: 'Automation', icon: Workflow };
      case 'flows':
        return { title: 'Flow Builder Canvas', category: 'Canvas', icon: Workflow };
      case 'nurture':
      case 'convertmate':
        return { title: 'Nurture Website Tools', category: 'Conversion', icon: Sparkles };
      case 'agents':
        return { title: 'AI Autonomous Agents', category: 'Intelligence', icon: Bot };
      case 'audience':
        return { title: 'Audience & Contacts', category: 'CRM', icon: Users };
      case 'conversations':
        return { title: 'Omnichannel Live Chat', category: 'Inbox', icon: MessageSquare };
      case 'broadcasts':
        return { title: 'Recurring Broadcasts', category: 'Marketing', icon: Bell };
      case 'kanban':
      case 'kanban-roadmap':
        return { title: 'Architecture Kanban', category: 'Super Admin', icon: Layers };
      case 'workspaces':
      case 'silos':
        return { title: 'Workspaces', category: 'Management', icon: Building2 };
      case 'super-admin':
        return { title: 'Super Admin Operations', category: 'Control Center', icon: ShieldCheck };
      case 'settings':
      case 'channels':
        return { title: 'Workspace Settings', category: 'System', icon: Settings };
      case 'integrations':
        return { title: 'Meta & API Integrations', category: 'Connectivity', icon: Layers };
      case 'docs':
      case 'knowledge-base':
        return { title: 'Knowledge Base', category: 'Documentation', icon: HelpCircle };
      case 'whats-new':
        return { title: 'Build Catalog', category: 'Release Notes', icon: Sparkles };
      default:
        return { title: 'Platform Control', category: 'ChatMize', icon: LayoutDashboard };
    }
  };

  const view = getViewDetails();
  const IconComponent = view.icon;

  // Search items for command palette
  const searchableViews = [
    { label: 'Create New Bot Map...', tab: 'bot-list', action: onOpenCreateBotModal, category: 'Quick Action' },
    { label: 'Bot Maps & Flows', tab: 'bot-list', category: 'Automation' },
    { label: 'Architecture Kanban Board', tab: 'kanban', category: 'Roadmap & Specs' },
    { label: 'Workspaces (Facebook / IG / WA)', tab: 'workspaces', category: 'Management' },
    { label: 'Nurture Support Widget', tab: 'nurture', category: 'Nurture Tools' },
    { label: 'Audience Contacts', tab: 'audience', category: 'CRM' },
    { label: 'Super Admin Control Center', tab: 'super-admin', category: 'Operations' },
    { label: 'Meta Channel Connections', tab: 'channels', category: 'Settings' },
    { label: 'AI Autonomous Agents', tab: 'agents', category: 'AI' }
  ];

  const filteredSearch = searchQuery.trim() 
    ? searchableViews.filter(v => v.label.toLowerCase().includes(searchQuery.toLowerCase()) || v.category.toLowerCase().includes(searchQuery.toLowerCase()))
    : searchableViews;

  return (
    <>
      <header className="h-16 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl px-4 sm:px-6 flex items-center justify-between gap-4 z-20 flex-shrink-0 sticky top-0">
        
        {/* Left Section: Mobile Sidebar Toggle + Breadcrumb */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onToggleSidebar}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-900 border border-slate-800 transition-colors lg:hidden cursor-pointer"
            title="Toggle Sidebar"
          >
            <Menu className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex-shrink-0">
              <IconComponent className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                  {view.category}
                </span>
                <span className="text-slate-600 hidden sm:inline">•</span>
                <span className="text-xs sm:text-sm font-bold text-white truncate block">
                  {view.title}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Center / Search Trigger Bar */}
        <div className="hidden md:flex items-center flex-1 max-w-sm mx-4 min-w-0">
          <button
            onClick={() => setIsSearchOpen(true)}
            className="w-full flex items-center justify-between px-3.5 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200 transition-all cursor-pointer text-xs group shadow-inner min-w-0"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Search className="w-3.5 h-3.5 text-slate-500 group-hover:text-cyan-400 transition-colors flex-shrink-0" />
              <span className="truncate whitespace-nowrap">Jump to view, bot, or tool...</span>
            </div>
            <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px] text-slate-400 font-mono font-medium flex-shrink-0 ml-2">
              ⌘K
            </kbd>
          </button>
        </div>

        {/* Right Section: Workspace Silo Selector + Channels + Notifications + Profile */}
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          
          {/* Active Account Silo Switcher (Primary Home for Switching Silos) */}
          <WorkspaceSwitcher
            workspaces={workspaces}
            activeWorkspaceId={activeWorkspaceId}
            onSelectWorkspace={onSelectWorkspace}
            onOpenCreateModal={() => setActiveTab('workspaces')}
            onNavigateToSuperAdmin={() => setActiveTab('kanban')}
          />

          {/* Channel status lives in the workspace switcher dropdown (avoids header crowding as channels grow) */}

          {/* Notifications Trigger */}
          <BuildCatalogBell onOpenCatalog={() => setActiveTab('whats-new')} />
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => setShowNotifications(prev => !prev)}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-900 border border-slate-800 transition-colors cursor-pointer relative"
              title="Notifications"
            >
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-cyan-400 shadow-sm shadow-cyan-400/50" />
            </button>

            {/* Notifications Dropdown */}
            {showNotifications && (
              <div className="absolute right-0 mt-2 w-[calc(100vw-2rem)] max-w-xs sm:w-80 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl shadow-slate-950 p-3 z-50 animate-in fade-in zoom-in-95">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800 mb-2">
                  <span className="text-xs font-bold text-white">Workspace Notifications</span>
                  <span className="text-[10px] text-cyan-400 font-semibold">Mark read</span>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="p-2 rounded-xl bg-slate-800/60 border border-slate-700/50">
                    <p className="font-semibold text-slate-200">FB Page Workspace Synchronized</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {activeWorkspace?.connectedPage.pageName} webhook verified &amp; active.
                    </p>
                    <span className="text-[9px] text-slate-500 mt-1 block">2 mins ago</span>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-800/30 border border-slate-800">
                    <p className="font-semibold text-slate-300">Architecture Kanban Updated</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Whitelabeling specification moved to Testing &amp; Sandbox.
                    </p>
                    <span className="text-[9px] text-slate-500 mt-1 block">1 hour ago</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* User Profile Menu */}
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setShowUserMenu(prev => !prev)}
              className="flex items-center gap-2 p-1 pl-1.5 pr-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-800 transition-all cursor-pointer group"
            >
              <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white font-bold text-xs shadow-sm">
                {currentUser?.displayName ? currentUser.displayName.slice(0, 2).toUpperCase() : currentUser?.email ? currentUser.email.slice(0, 2).toUpperCase() : 'IR'}
              </div>
              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${showUserMenu ? 'rotate-180' : ''}`} />
            </button>

            {/* Profile Dropdown */}
            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl shadow-slate-950 p-2 z-50 animate-in fade-in zoom-in-95">
                <div className="p-2.5 pb-2 border-b border-slate-800 mb-1">
                  <p className="text-xs font-bold text-white truncate flex items-center gap-1.5">
                    {currentUser?.displayName || 'Master Administrator'}
                    {isOg && (
                      <img
                        src="/badges/og-stamp.webp"
                        alt="OG Stamp"
                        title="OG Stamp — original SegMate crew"
                        className="w-5 h-5 rounded-full object-cover shrink-0"
                      />
                    )}
                  </p>
                  <p className="text-[11px] text-slate-400 truncate">
                    {currentUser?.email || 'instantreferralsapp@gmail.com'}
                  </p>
                  <span className="inline-block mt-1.5 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold">
                    Super Admin
                  </span>
                </div>

                <div className="space-y-0.5 py-1 text-xs">
                  <button
                    onClick={() => {
                      setActiveTab('workspaces');
                      setShowUserMenu(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl hover:bg-white/5 text-slate-300 hover:text-white transition-colors cursor-pointer text-left"
                  >
                    <Building2 className="w-4 h-4 text-cyan-400" />
                    <span>Manage Workspaces ({workspaces.length})</span>
                  </button>
                  <button
                    onClick={() => {
                      setActiveTab('kanban');
                      setShowUserMenu(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl hover:bg-white/5 text-slate-300 hover:text-white transition-colors cursor-pointer text-left"
                  >
                    <Layers className="w-4 h-4 text-indigo-400" />
                    <span>Architecture Kanban Roadmap</span>
                  </button>
                  <button
                    onClick={() => {
                      setActiveTab('super-admin');
                      setShowUserMenu(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl hover:bg-white/5 text-slate-300 hover:text-white transition-colors cursor-pointer text-left"
                  >
                    <ShieldCheck className="w-4 h-4 text-amber-400" />
                    <span>Super Admin Control Center</span>
                  </button>
                  <button
                    onClick={() => {
                      setActiveTab('settings');
                      setShowUserMenu(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl hover:bg-white/5 text-slate-300 hover:text-white transition-colors cursor-pointer text-left"
                  >
                    <Settings className="w-4 h-4 text-slate-400" />
                    <span>Platform Settings</span>
                  </button>
                </div>

                <div className="pt-1 mt-1 border-t border-slate-800">
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      onSignOut();
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl hover:bg-red-500/10 text-red-400 transition-colors cursor-pointer text-xs"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Global Command / Jump-To Modal (Cmd+K) */}
      {isSearchOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-start justify-center pt-24 p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-3 border-b border-slate-800 flex items-center gap-3">
              <Search className="w-4 h-4 text-cyan-400 flex-shrink-0" />
              <input
                type="text"
                autoFocus
                placeholder="Search views, bots, silos, or tools..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent text-white placeholder-slate-500 text-sm focus:outline-none"
              />
              <button
                onClick={() => setIsSearchOpen(false)}
                className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px] text-slate-400 font-mono hover:text-white"
              >
                ESC
              </button>
            </div>

            <div className="max-h-72 overflow-y-auto p-2 space-y-1">
              {filteredSearch.map((item) => (
                <button
                  key={item.label}
                  onClick={() => {
                    if (item.action) {
                      item.action();
                    } else if (item.tab) {
                      setActiveTab(item.tab);
                    }
                    setIsSearchOpen(false);
                    setSearchQuery('');
                  }}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer text-left text-xs"
                >
                  <span className="font-semibold">{item.label}</span>
                  <span className="text-[10px] text-slate-500 font-mono">{item.category}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
