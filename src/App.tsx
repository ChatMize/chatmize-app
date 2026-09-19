import {
  ArrowUpRight,
  BookOpen,
  Bot,
  LayoutDashboard,
  Layers,
  MessageSquare,
  Plus,
  Settings,
  Sparkles,
  Users,
  Zap,
  Radio,
  ChevronLeft,
  ChevronRight,
  BellRing,
  MessageSquareText,
  LogOut,
  ShieldCheck,
  ChevronDown,
  List,
  Workflow,
  Boxes,
  Globe,
  Layout,
  Sliders,
  Maximize2,
  Building2,
  Crown,
  FolderOpen,
  Link2,
  Share2,
  Eye,
  QrCode,
  Smartphone,
  Instagram,
  Trophy,
  X
} from 'lucide-react';
import React, { useState, useEffect } from 'react';

import { ChatMizeLogo } from './components/Logo';
import { Dashboard } from './views/Dashboard';
import { AIAgents } from './views/AIAgents';
import { FlowBuilder } from './views/FlowBuilder';
import { BotListView } from './views/BotListView';
import { SettingsView } from './views/SettingsView';
import { AudienceView } from './views/AudienceView';
import { LiveConversationsView } from './views/LiveConversationsView';
import { SuperAdminView } from './views/SuperAdminView';
import { WorkspacesView } from './views/WorkspacesView';
import { NurtureToolsView } from './views/NurtureToolsView';
import { SupportChatView } from './components/growth/SupportChatView';
import { WebsiteOverlaysView } from './components/growth/WebsiteOverlaysView';
import { GrowthLinksView } from './components/growth/GrowthLinksView';
import { GrowthSuiteHub } from './components/growth/GrowthSuiteHub';
import { ContestsView } from './components/growth/ContestsView';
import { KnowledgeBaseView } from './views/KnowledgeBaseView';
import { ContestEntryPage } from './components/growth/ContestEntryPage';
import { SurveyTakePage } from './components/growth/SurveyTakePage';
import { BookingWidgetPage } from './components/bookings/BookingWidgetPage';
import { ManageBookingPage } from './components/bookings/ManageBookingPage';
import { ManageLinkAuth, parseManageLinkAuth } from './lib/bookings';
import { NurtureToolType } from './types/nurture';
import { OverlayType } from './types/growthTools';
import { RecurringNotificationBroadcastHub } from './components/RecurringNotificationBroadcastHub';
import { AuthGateModal } from './components/AuthGateModal';
import { subscribeToAuthChanges, signOutUser, AppUser, db } from './lib/firebase';
import { WorkspaceSwitcher } from './components/navigation/WorkspaceSwitcher';
import { TopNavBar } from './components/navigation/TopNavBar';
import { CopilotGuide } from './components/CopilotGuide';
import GlobalEmojiBuddy from './components/emoji/GlobalEmojiBuddy';
import GlobalPersonalizationBuddy from './components/personalization/GlobalPersonalizationBuddy';
import { BadgeToast } from './components/BadgeToast';
import { MetaReconnectBanner } from './components/MetaReconnectBanner';
import { isWorkspaceOwner } from './lib/workspaceAccess';
import { OnboardingWizard } from './components/onboarding/OnboardingWizard';
import { SnapshotImportView } from './views/SnapshotImportView';
import { SnapshotLibraryView } from './views/SnapshotLibraryView';
import { SmsBroadcastView } from './views/SmsBroadcastView';
import { WorkspaceSilo } from './types/workspace';
import { DEFAULT_WORKSPACES } from './data/workspaceDefaults';

export default function App() {
  const [activeTab, setActiveTab] = useState(() => {
    // Restore the last viewed tab so refresh keeps you on the same page
    try {
      return localStorage.getItem('chatmize_activeTab') || 'bot-list';
    } catch {
      return 'bot-list';
    }
  });
  const [activeBotId, setActiveBotId] = useState<string>('bot-1');
  const [activeBotTitle, setActiveBotTitle] = useState<string>('(Ad) Build-A-Bot Invite');
  const [isBotsExpanded, setIsBotsExpanded] = useState<boolean>(true);
  const [isCaptureExpanded, setIsCaptureExpanded] = useState<boolean>(true);
  const [overlayFilter, setOverlayFilter] = useState<OverlayType | 'all'>('all');
  const [linksSubTab, setLinksSubTab] = useState<'cloaker' | 'mme' | 'igme'>('cloaker');
  const [nurtureCategory, setNurtureCategory] = useState<'all' | NurtureToolType>('all');
  const [nurtureSubTab, setNurtureSubTab] = useState<string>('saved');
  const [createModalTrigger, setCreateModalTrigger] = useState<number>(0);
  const [selectedDocId, setSelectedDocId] = useState<string | undefined>();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    return typeof window !== 'undefined' ? window.innerWidth < 1024 : false;
  });

  // Account Silos / Workspaces State
  const [workspaces, setWorkspaces] = useState<WorkspaceSilo[]>(() => {
    try {
      const saved = localStorage.getItem('chatmize_workspaces');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          let hasLegacyNames = false;
          const cleaned = parsed.map((ws: WorkspaceSilo) => {
            let updated = { ...ws };
            if (updated.name && /segmate|manychat/i.test(updated.name)) {
              updated.name = updated.name.replace(/segmate|manychat/gi, 'Chatmize');
              hasLegacyNames = true;
            }
            if (updated.connectedPage?.pageName && /segmate|manychat/i.test(updated.connectedPage.pageName)) {
              updated.connectedPage = {
                ...updated.connectedPage,
                pageName: updated.connectedPage.pageName.replace(/segmate|manychat/gi, 'Chatmize')
              };
              hasLegacyNames = true;
            }
            if (updated.whitelabel?.brandName && /segmate|manychat/i.test(updated.whitelabel.brandName)) {
              updated.whitelabel = {
                ...updated.whitelabel,
                brandName: updated.whitelabel.brandName.replace(/segmate|manychat/gi, 'Chatmize')
              };
              hasLegacyNames = true;
            }
            return updated;
          });
          if (hasLegacyNames) {
            localStorage.setItem('chatmize_workspaces', JSON.stringify(cleaned));
          }
          // Merge in any default workspaces missing from the saved list
          // (e.g. the live ws-chatmize-hq added after the first seed).
          const existingIds = new Set(cleaned.map((w: WorkspaceSilo) => w.id));
          const missing = DEFAULT_WORKSPACES.filter((w) => !existingIds.has(w.id));
          const merged = missing.length > 0 ? [...missing, ...cleaned] : cleaned;
          if (missing.length > 0) {
            localStorage.setItem('chatmize_workspaces', JSON.stringify(merged));
          }
          return merged;
        }
      }
    } catch (e) {
      console.error(e);
    }
    return DEFAULT_WORKSPACES;
  });

  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>(() => {
    return localStorage.getItem('chatmize_active_workspace_id') || 'ws-biz-1';
  });

  const handleUpdateWorkspaces = (newWorkspaces: WorkspaceSilo[]) => {
    setWorkspaces(newWorkspaces);
    localStorage.setItem('chatmize_workspaces', JSON.stringify(newWorkspaces));
  };

  const handleUpdateWorkspace = (updated: WorkspaceSilo) => {
    handleUpdateWorkspaces(workspaces.map((w) => (w.id === updated.id ? updated : w)));
  };

  const handleSelectWorkspace = (id: string) => {
    setActiveWorkspaceId(id);
    localStorage.setItem('chatmize_active_workspace_id', id);
  };

  const activeWorkspace = workspaces.find(w => w.id === activeWorkspaceId) || workspaces[0];

  // Authentication State & Gating
  // The Firebase Auth session is the single source of truth. There is no
  // localStorage bypass: a signed-out user sees the auth gate, period.
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [settingsInitialTab, setSettingsInitialTab] = useState<'general' | 'channels' | 'integrations' | 'docs' | 'api' | 'plan'>(() => {
    try {
      return (localStorage.getItem('chatmize_settings_tab') as 'general' | 'channels' | 'integrations' | 'docs' | 'api' | 'plan') || 'general';
    } catch { return 'general'; }
  });

  useEffect(() => {
    const unsubscribe = subscribeToAuthChanges((user) => {
      setCurrentUser(user);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Persist the active tab so a browser refresh keeps you on the same page.
  useEffect(() => {
    try {
      localStorage.setItem('chatmize_activeTab', activeTab);
    } catch {
      // storage unavailable; ignore
    }
  }, [activeTab]);

  // Sync real Firestore integration status into the workspace object.
  // The localStorage workspace data is stale demo data; this pulls the live
  // connection state (FB Page, Instagram, WhatsApp) from Firestore.
  useEffect(() => {
    const syncIntegrations = async () => {
      try {
        const { doc, getDoc } = await import('firebase/firestore');
        // Map UI workspace to Firestore workspace (Dev Sandbox -> ws-chatmize-dev)
        const ws = workspaces.find(w => w.id === activeWorkspaceId);
        if (!ws) return;
        // Sync the active workspace with the real Firestore data (ws-chatmize-dev)
        // Note: was name-based ('dev sandbox'), now syncs any active workspace since
        // there's only one real Firestore workspace until multi-workspace is built.

        const firestoreWsId = 'ws-chatmize-dev';
        const metaSnap = await getDoc(doc(db, 'workspaces', firestoreWsId, 'integrations', 'meta'));
        const igSnap = await getDoc(doc(db, 'workspaces', firestoreWsId, 'integrations', 'instagram'));

        let updated = { ...ws };
        let changed = false;

        if (metaSnap.exists()) {
          const metaData = metaSnap.data();
          if (metaData.status === 'connected' && metaData.pageId) {
            updated.connectedPage = {
              ...updated.connectedPage,
              pageId: metaData.pageId,
              pageName: metaData.pageName || updated.connectedPage.pageName,
              serviceStatus: 'active',
            };
            // Use the Facebook Page profile image as the workspace avatar
            if (metaData.pagePictureUrl) {
              updated.avatarUrl = metaData.pagePictureUrl;
              updated.connectedPage.avatarUrl = metaData.pagePictureUrl;
            }
            changed = true;
          }
        }

        if (igSnap.exists()) {
          const igData = igSnap.data();
          if (igData.status === 'connected' && igData.igUserId) {
            updated.connectedPage = {
              ...updated.connectedPage,
              connectedIg: {
                username: igData.username || '',
                igId: igData.igUserId,
                followersCount: 0,
                connected: true,
                status: 'active',
              },
            };
            changed = true;
          }
        }

        if (changed) {
          const newWorkspaces = workspaces.map(w => w.id === ws.id ? updated : w);
          setWorkspaces(newWorkspaces);
          try {
            localStorage.setItem('chatmize_workspaces', JSON.stringify(newWorkspaces));
          } catch { /* ignore */ }
        }
      } catch (e) {
        console.warn('Failed to sync integrations:', e);
      }
    };

    syncIntegrations();
  }, [activeWorkspaceId]);

  // Deep link: ?snapshot=<id> opens the snapshot import view.
  const [deepSnapshotId, setDeepSnapshotId] = useState<string | null>(null);
  useEffect(() => {
    try {
      const id = new URLSearchParams(window.location.search).get('snapshot');
      if (id) {
        setDeepSnapshotId(id);
        setActiveTab('snapshot');
        window.history.replaceState({}, '', window.location.pathname);
      }
    } catch {
      // ignore malformed URLs
    }
  }, []);

  // OAuth round-trip return: ?return_to=<area:detail> restores where the user
  // was when they started connecting (set by MetaConnectCard via the backend
  // OAuth state). Read once during first render so the onboarding wizard can
  // start on the right step; the meta_oauth params are left for the card.
  const [oauthReturnTo] = useState<string | null>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      // Primary: explicit return address from the OAuth round trip.
      const rt = params.get('return_to');
      if (rt) return rt;
      // Fallback: a successful OAuth without a return address still means the
      // user was mid-connect in onboarding, so land them on the connect step.
      if (params.get('meta_oauth') === 'success' || params.get('instagram_oauth') === 'success') return 'onboarding:connect';
      return null;
    } catch {
      return null;
    }
  });
  useEffect(() => {
    if (!oauthReturnTo) return;
    if (oauthReturnTo === 'app:settings_channels') {
      setSettingsInitialTab('channels');
      setActiveTab('settings');
    }
    try {
      const params = new URLSearchParams(window.location.search);
      params.delete('return_to');
      const rest = params.toString();
      window.history.replaceState({}, '', window.location.pathname + (rest ? `?${rest}` : ''));
    } catch {
      // ignore malformed URLs
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
      case 'analytics':
        return <Dashboard title="Main Dashboard Overview" workspaceId={activeWorkspace?.id} />;
      case 'bot-list':
        return (
          <BotListView 
            triggerCreateModal={createModalTrigger}
            workspaceSlug={activeWorkspace?.slug}
            onOpenLibrary={() => setActiveTab('snapshot-library')}
            onOpenBotMap={(bot) => {
              setActiveBotId(bot.id);
              setActiveBotTitle(bot.name);
              setActiveTab('flows');
            }}
            onNewBotMap={(newBot) => {
              setActiveBotId(newBot.id);
              setActiveBotTitle(newBot.name);
              setActiveTab('flows');
            }}
          />
        );
      case 'snapshot-library':
        return (
          <SnapshotLibraryView
            workspace={activeWorkspace}
            onImported={() => setActiveTab('bot-list')}
            onUpgrade={() => { setSettingsInitialTab('plan'); setActiveTab('settings'); }}
          />
        );
      case 'snapshot':
        return deepSnapshotId ? (
          <SnapshotImportView
            snapshotId={deepSnapshotId}
            workspaceName={activeWorkspace?.name || 'your workspace'}
            workspaceSlug={activeWorkspace?.slug}
            onBack={() => setActiveTab('bot-list')}
            onImported={() => setActiveTab('bot-list')}
          />
        ) : null;
      case 'flows':
        return (
          <FlowBuilder 
            activeBotId={activeBotId}
            activeBotTitle={activeBotTitle}
            onUpdateBotTitle={(title) => setActiveBotTitle(title)}
            onBackToBotList={() => setActiveTab('bot-list')}
            workspaceId={activeWorkspace?.id}
            onNavigateToIntegrations={() => setActiveTab('integrations')} 
            onNavigateToDocs={(docId?: string) => {
              if (docId) setSelectedDocId(docId);
              setActiveTab('docs');
            }} 
          />
        );
      case 'agents':
        return <AIAgents />;
      case 'audience':
        return <AudienceView workspaceId={activeWorkspace?.id} />;
      case 'conversations':
        return (
          <LiveConversationsView
            workspaceId={activeWorkspace?.id}
            workspaceName={activeWorkspace?.name}
            ownerName={activeWorkspace?.ownerName}
            isOwner={isWorkspaceOwner(activeWorkspace, currentUser)}
            onNavigateToAudience={(contactId) => {
              setActiveTab('audience');
            }}
            onNavigateToFlows={(botId) => {
              if (botId) setActiveBotId(botId);
              setActiveTab('flows');
            }}
          />
        );
      case 'settings':
        return (
          <SettingsView
            initialTab={settingsInitialTab}
            onNavigateToFlows={() => setActiveTab('flows')}
            workspace={activeWorkspace}
            onUpdateWorkspace={handleUpdateWorkspace}
          />
        );
      case 'support-chat':
      case 'support_widget':
        return (
          <SupportChatView 
            onNavigateToFlows={(botId) => {
              if (botId) setActiveBotId(botId);
              setActiveTab('flows');
            }}
          />
        );
      case 'overlays':
      case 'website-overlays':
      case 'popup_modal':
      case 'slider':
      case 'page_takeover':
      case 'sticky_bar':
        return (
          <WebsiteOverlaysView 
            initialFilter={['popup_modal', 'slider', 'page_takeover', 'sticky_bar'].includes(activeTab) ? (activeTab as any) : overlayFilter}
            onNavigateToFlows={(botId) => {
              if (botId) setActiveBotId(botId);
              setActiveTab('flows');
            }}
          />
        );
      case 'growth-links':
      case 'links':
      case 'send-chat':
      case 'mme':
      case 'igme':
        return (
          <GrowthLinksView 
            workspaceName={activeWorkspace?.name || 'Apex Marketing'}
            workspaceSlug={activeWorkspace?.slug || 'apex-marketing'}
            initialSubTab={activeTab === 'mme' ? 'mme' : activeTab === 'igme' ? 'igme' : linksSubTab}
            onNavigateToFlows={(botId) => {
              if (botId) setActiveBotId(botId);
              setActiveTab('flows');
            }}
          />
        );
      case 'contests':
        return <ContestsView workspaceId={activeWorkspace?.id} />;
      case 'knowledge-base':
        return <KnowledgeBaseView workspaceId={activeWorkspace?.id} />;
      case 'capture-tools':
      case 'capture':
      case 'nurture':
      case 'convertmate':
        return (
          <GrowthSuiteHub 
            initialTab={
              nurtureSubTab === 'support_widget' 
                ? 'support_chat' 
                : ['popup_modal', 'slider', 'page_takeover', 'sticky_bar'].includes(nurtureSubTab)
                ? 'overlays'
                : nurtureSubTab === 'links' || nurtureSubTab === 'cloaker'
                ? 'growth_links'
                : 'support_chat'
            }
            workspaceId={activeWorkspace?.id}
            initialOverlayFilter={
              ['popup_modal', 'slider', 'page_takeover', 'sticky_bar'].includes(nurtureSubTab)
                ? (nurtureSubTab as any)
                : overlayFilter
            }
            workspaceName={activeWorkspace?.name || 'Apex Marketing'}
            workspaceSlug={activeWorkspace?.slug || 'apex-marketing'}
            workspacePlanId={activeWorkspace?.planId}
            onNavigateToFlows={(botId) => {
              if (botId) setActiveBotId(botId);
              setActiveTab('flows');
            }} 
          />
        );
      case 'broadcasts':
        return <RecurringNotificationBroadcastHub />;
      case 'sms-broadcast':
        return (
          <SmsBroadcastView
            workspace={activeWorkspace}
            onEnableSms={() => setActiveTab('settings')}
          />
        );
      case 'super-admin':
        return (
          <SuperAdminView 
            initialTab="users"
          />
        );
      case 'kanban':
      case 'kanban-roadmap':
        return (
          <SuperAdminView 
            initialTab="kanban"
          />
        );
      case 'workspaces':
      case 'silos':
        return (
          <WorkspacesView 
            workspaces={workspaces}
            activeWorkspaceId={activeWorkspaceId}
            onSelectWorkspace={handleSelectWorkspace}
            onUpdateWorkspaces={handleUpdateWorkspaces}
          />
        );
      case 'channels':
        return (
          <SettingsView
            initialTab="channels"
            onNavigateToFlows={() => setActiveTab('flows')}
            workspace={activeWorkspace}
            onUpdateWorkspace={handleUpdateWorkspace}
          />
        );
      case 'integrations':
        return (
          <SettingsView
            initialTab="integrations"
            onNavigateToFlows={() => setActiveTab('flows')}
            workspace={activeWorkspace}
            onUpdateWorkspace={handleUpdateWorkspace}
          />
        );
      case 'docs':
        return (
          <SettingsView
            initialTab="docs"
            initialDocId={selectedDocId}
            onNavigateToFlows={() => setActiveTab('flows')}
            workspace={activeWorkspace}
            onUpdateWorkspace={handleUpdateWorkspace}
          />
        );
      default:
        return (
          <FlowBuilder 
            workspaceId={activeWorkspace?.id}
            onNavigateToIntegrations={() => setActiveTab('integrations')} 
            onNavigateToDocs={(docId?: string) => {
              if (docId) setSelectedDocId(docId);
              setActiveTab('docs');
            }} 
          />
        );
    }
  };

  const isFlows = activeTab === 'flows';

  // Plan nudge: dismissible per workspace, persisted.
  // NOTE: these hooks must stay above the onboarding gate's early return.
  const planNudgeKey = `chatmize_plan_nudge_dismissed_${activeWorkspaceId}`;
  const [planNudgeDismissed, setPlanNudgeDismissed] = useState(() => {
    try { return localStorage.getItem(planNudgeKey) === '1'; } catch { return false; }
  });
  const dismissPlanNudge = () => {
    try { localStorage.setItem(planNudgeKey, '1'); } catch { /* ignore */ }
    setPlanNudgeDismissed(true);
  };

  // Copilot setup guide: shows once after onboarding until permanently dismissed
  const guideKey = `chatmize_guide_dismissed_${activeWorkspaceId}`;
  const [guideDismissed, setGuideDismissed] = useState(() => {
    try { return localStorage.getItem(guideKey) === '1'; } catch { return false; }
  });
  const dismissGuide = () => {
    try { localStorage.setItem(guideKey, '1'); } catch { /* ignore */ }
    setGuideDismissed(true);
  };
  // Re-read dismissal flags when switching workspaces
  useEffect(() => {
    try {
      setPlanNudgeDismissed(localStorage.getItem(planNudgeKey) === '1');
      setGuideDismissed(localStorage.getItem(guideKey) === '1');
    } catch { /* ignore */ }
  }, [activeWorkspaceId]);

  // Public contest entry page: /enter/:contestId renders without auth.
  // The hosting rewrite sends every path to index.html, so the SPA owns
  // this route. Placed after all hooks (same pattern as the onboarding gate).
  const [publicContestId] = useState<string | null>(() => {
    try {
      const m = window.location.pathname.match(/^\/enter\/([A-Za-z0-9_-]+)/);
      return m ? m[1] : null;
    } catch {
      return null;
    }
  });

  // Public survey page: /survey/:surveyId renders without auth (same pattern).
  const [publicSurveyId] = useState<string | null>(() => {
    try {
      const m = window.location.pathname.match(/^\/survey\/([A-Za-z0-9_-]+)/);
      return m ? m[1] : null;
    } catch {
      return null;
    }
  });

  // Public booking widget: ?book=<workspaceId> renders without auth.
  // ?booking=<workspaceId>.<bookingId>&sig=...&exp=... renders the manage
  // (reschedule/cancel) page with a server-signed link.
  const [publicBook] = useState<{ workspaceId: string; embed: boolean } | null>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const ws = params.get('book');
      return ws ? { workspaceId: ws, embed: params.get('embed') === '1' } : null;
    } catch {
      return null;
    }
  });
  const [publicManage] = useState<ManageLinkAuth | null>(() => {
    try {
      return parseManageLinkAuth(new URLSearchParams(window.location.search));
    } catch {
      return null;
    }
  });

  // Onboarding gate: a signed-in user whose workspace hasn't finished onboarding
  // goes through the wizard (connect accounts -> choose DIY/DFU route -> tier).
  if (!authLoading && currentUser && activeWorkspace && !activeWorkspace.onboardingComplete) {
    return (
      <OnboardingWizard
        workspace={activeWorkspace}
        onUpdateWorkspace={handleUpdateWorkspace}
        onComplete={() => {}}
        initialStep={oauthReturnTo === 'onboarding:connect' ? 'connect' : undefined}
      />
    );
  }

  if (publicContestId) {
    return <ContestEntryPage contestId={publicContestId} />;
  }

  if (publicSurveyId) {
    return <SurveyTakePage surveyId={publicSurveyId} />;
  }

  if (publicBook) {
    return <BookingWidgetPage workspaceId={publicBook.workspaceId} embed={publicBook.embed} />;
  }

  if (publicManage) {
    return <ManageBookingPage auth={publicManage} />;
  }

  const showGuide = Boolean(
    currentUser && activeWorkspace?.onboardingComplete && !guideDismissed
  );

  const showPlanNudge = Boolean(
    activeWorkspace?.onboardingComplete && !activeWorkspace.planId && !planNudgeDismissed
  );

  return (
    <div className="h-screen w-screen bg-slate-950 text-slate-50 flex overflow-hidden font-sans relative selection:bg-blue-500/30">
      {/* Background Glows (Matching Logo Colors) */}
      <div className="absolute -top-48 -left-48 w-96 h-96 bg-cyan-600/15 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute top-1/2 -right-48 w-96 h-96 bg-blue-600/15 rounded-full blur-[120px] pointer-events-none"></div>

      {/* Mobile Drawer Overlay Backdrop */}
      {!isSidebarCollapsed && (
        <div 
          onClick={() => setIsSidebarCollapsed(true)} 
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-30 lg:hidden cursor-pointer"
          title="Close Navigation"
        />
      )}

      {/* Sidebar - Responsive Drawer on Mobile, Persistent on Desktop */}
      <aside className={`h-screen flex-shrink-0 bg-slate-950/95 backdrop-blur-2xl border-r border-slate-800/80 flex flex-col p-3 transition-all duration-300 fixed lg:relative inset-y-0 left-0 z-40 shadow-2xl lg:shadow-none ${
        isSidebarCollapsed 
          ? '-translate-x-full lg:translate-x-0 lg:w-20 lg:items-center' 
          : 'translate-x-0 w-64'
      }`}>
        
        {/* Top Logo and Header */}
        <div className={`flex items-center gap-3 mb-3 relative ${isSidebarCollapsed ? 'justify-center' : 'px-1'}`}>
          <ChatMizeLogo className="w-9 h-9 drop-shadow-[0_4px_12px_rgba(37,99,235,0.4)] flex-shrink-0" />
          {!isSidebarCollapsed && (
            <div className="flex items-center justify-between flex-1 min-w-0">
              <span className="text-2xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-500 whitespace-nowrap">
                Chatmize
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-500/10 text-cyan-400 border border-blue-500/20 font-bold">
                v2.4
              </span>
            </div>
          )}
        </div>

        {/* Collapse Toggle Button */}
        <button 
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          className="absolute -right-3 top-6 bg-slate-900 border border-slate-700 p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors z-40 shadow-md cursor-pointer"
          title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isSidebarCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>

        {/* Primary Creation Action: New Bot Map */}
        {isSidebarCollapsed ? (
          <button 
            onClick={() => {
              setActiveTab('bot-list');
              setCreateModalTrigger(prev => prev + 1);
            }}
            className="w-10 h-10 mb-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20 transition-all cursor-pointer flex-shrink-0"
            title="Create New Bot Map"
          >
            <Plus className="w-5 h-5" />
          </button>
        ) : (
          <button 
            onClick={() => {
              setActiveTab('bot-list');
              setCreateModalTrigger(prev => prev + 1);
            }}
            className="w-full py-2.5 px-3 mb-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-md shadow-blue-500/20 transition-all cursor-pointer flex-shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>New Bot Map</span>
          </button>
        )}

        {/* Navigation Items (Organized into Clean Sections) */}
        <nav className="space-y-4 flex-1 w-full overflow-y-auto pr-0.5" style={{ scrollbarWidth: 'none' }}>
          
          {/* SECTION 1: BUILD & AUTOMATE */}
          <div className="space-y-1">
            {!isSidebarCollapsed && (
              <p className="px-3 text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1">
                Automation
              </p>
            )}
            
            <NavItem 
              icon={<LayoutDashboard className="w-4 h-4" />} 
              label="Dashboard" 
              active={activeTab === 'dashboard' || activeTab === 'analytics'} 
              onClick={() => setActiveTab('dashboard')} 
              collapsed={isSidebarCollapsed} 
            />
            
            {/* Bots Parent Item */}
            {isSidebarCollapsed ? (
              <button
                onClick={() => setActiveTab('bot-list')}
                title="Bot Maps & Flows"
                className={`w-full p-2.5 rounded-xl transition-all flex items-center justify-center cursor-pointer ${
                  activeTab === 'bot-list' || activeTab === 'flows' || activeTab === 'agents'
                    ? 'bg-gradient-to-r from-cyan-500/15 to-blue-500/15 text-cyan-300 border border-cyan-500/30'
                    : 'text-slate-400 hover:bg-white/5 hover:text-slate-200 border border-transparent'
                }`}
              >
                <Workflow className="w-4 h-4 text-cyan-400" />
              </button>
            ) : (
              <div className="space-y-0.5">
                <button
                  onClick={() => {
                    setIsBotsExpanded(prev => !prev);
                    if (activeTab !== 'bot-list' && activeTab !== 'flows' && activeTab !== 'agents') {
                      setActiveTab('bot-list');
                    }
                  }}
                  className={`w-full text-left py-2 px-3 rounded-xl transition-all flex items-center justify-between gap-2 cursor-pointer ${
                    activeTab === 'bot-list' || activeTab === 'flows' || activeTab === 'agents'
                      ? 'bg-gradient-to-r from-cyan-500/15 to-blue-500/15 text-cyan-300 border border-cyan-500/30 font-semibold'
                      : 'text-slate-400 hover:bg-white/5 hover:text-slate-200 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Workflow className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                    <span className="text-xs font-medium truncate">Bot Maps</span>
                  </div>
                  <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isBotsExpanded ? 'rotate-180 text-cyan-400' : ''}`} />
                </button>

                {isBotsExpanded && (
                  <div className="pl-6 pr-1 py-0.5 space-y-0.5 border-l border-cyan-500/20 ml-4 my-1">
                    <button
                      onClick={() => setActiveTab('bot-list')}
                      className={`w-full text-left py-1.5 px-2 rounded-lg text-xs font-medium transition-all flex items-center justify-between cursor-pointer ${
                        activeTab === 'bot-list'
                          ? 'bg-cyan-500/20 text-cyan-300 font-bold'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <List className="w-3.5 h-3.5 text-cyan-400" />
                        <span>All Maps</span>
                      </div>
                    </button>

                    <button
                      onClick={() => setActiveTab('flows')}
                      className={`w-full text-left py-1.5 px-2 rounded-lg text-xs font-medium transition-all flex items-center justify-between cursor-pointer ${
                        activeTab === 'flows'
                          ? 'bg-cyan-500/20 text-cyan-300 font-bold'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Zap className="w-3.5 h-3.5 text-blue-400" />
                        <span>Canvas</span>
                      </div>
                    </button>

                    <button
                      onClick={() => setActiveTab('agents')}
                      className={`w-full text-left py-1.5 px-2 rounded-lg text-xs font-medium transition-all flex items-center justify-between cursor-pointer ${
                        activeTab === 'agents'
                          ? 'bg-cyan-500/20 text-cyan-300 font-bold'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Bot className="w-3.5 h-3.5 text-purple-400" />
                        <span>AI Agents</span>
                      </div>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* CAPTURE TOOLS DROPDOWN (Dedicated tools grouped neatly under a single expandable dropdown) */}
            {(() => {
              const isCaptureActive = [
                'capture-tools',
                'support-chat',
                'support_widget',
                'knowledge-base',
                'overlays',
                'website-overlays',
                'popup_modal',
                'slider',
                'page_takeover',
                'sticky_bar',
                'growth-links',
                'links',
                'send-chat',
                'mme',
                'igme',
                'contests',
                'nurture',
                'convertmate'
              ].includes(activeTab);

              return isSidebarCollapsed ? (
                <button
                  onClick={() => {
                    if (!isCaptureActive) {
                      setActiveTab('support-chat');
                    }
                  }}
                  title="Capture Tools (Support Chat, Knowledge Base, Overlays, Growth Links, Contests)"
                  className={`w-full p-2.5 rounded-xl transition-all flex items-center justify-center cursor-pointer ${
                    isCaptureActive
                      ? 'bg-gradient-to-r from-cyan-500/15 to-blue-500/15 text-cyan-300 border border-cyan-500/30'
                      : 'text-slate-400 hover:bg-white/5 hover:text-slate-200 border border-transparent'
                  }`}
                >
                  <Globe className="w-4 h-4 text-cyan-400" />
                </button>
              ) : (
                <div className="space-y-0.5">
                  {/* Capture Tools Dropdown Header */}
                  <button
                    onClick={() => {
                      setIsCaptureExpanded(prev => !prev);
                      if (!isCaptureActive) {
                        setActiveTab('support-chat');
                      }
                    }}
                    className={`w-full text-left py-2 px-3 rounded-xl transition-all flex items-center justify-between gap-2 cursor-pointer ${
                      isCaptureActive
                        ? 'bg-gradient-to-r from-cyan-500/15 to-blue-500/15 text-cyan-300 border border-cyan-500/30 font-semibold'
                        : 'text-slate-400 hover:bg-white/5 hover:text-slate-200 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Globe className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                      <span className="text-xs font-medium truncate">Capture Tools</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-mono font-bold">
                        5 Tools
                      </span>
                      <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isCaptureExpanded ? 'rotate-180 text-cyan-400' : ''}`} />
                    </div>
                  </button>

                  {/* Dropdown Child Items */}
                  {isCaptureExpanded && (
                    <div className="pl-6 pr-1 py-0.5 space-y-0.5 border-l border-cyan-500/20 ml-4 my-1">
                      {/* Child 1: Support Chat */}
                      <button
                        onClick={() => setActiveTab('support-chat')}
                        className={`w-full text-left py-1.5 px-2 rounded-lg text-xs font-medium transition-all flex items-center justify-between cursor-pointer ${
                          activeTab === 'support-chat' || activeTab === 'support_widget'
                            ? 'bg-cyan-500/20 text-cyan-300 font-bold'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <MessageSquare className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Support Chat</span>
                        </div>
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 font-mono">24/7 AI</span>
                      </button>

                      {/* Child 2: Knowledge Base */}
                      <button
                        onClick={() => setActiveTab('knowledge-base')}
                        className={`w-full text-left py-1.5 px-2 rounded-lg text-xs font-medium transition-all flex items-center justify-between cursor-pointer ${
                          activeTab === 'knowledge-base'
                            ? 'bg-cyan-500/20 text-cyan-300 font-bold'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <BookOpen className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Knowledge Base</span>
                        </div>
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 font-mono">Guides</span>
                      </button>

                      {/* Child 3: Website Overlays */}
                      <button
                        onClick={() => {
                          setActiveTab('overlays');
                          setOverlayFilter('all');
                        }}
                        className={`w-full text-left py-1.5 px-2 rounded-lg text-xs font-medium transition-all flex items-center justify-between cursor-pointer ${
                          activeTab === 'overlays' || activeTab === 'website-overlays' || ['popup_modal', 'slider', 'page_takeover', 'sticky_bar'].includes(activeTab)
                            ? 'bg-blue-500/20 text-blue-300 font-bold'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Layout className="w-3.5 h-3.5 text-blue-400" />
                          <span>Website Overlays</span>
                        </div>
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300 font-mono">Pops &amp; Sliders</span>
                      </button>

                      {/* Child 3: Growth Links */}
                      <button
                        onClick={() => {
                          setActiveTab('growth-links');
                          setLinksSubTab('cloaker');
                        }}
                        className={`w-full text-left py-1.5 px-2 rounded-lg text-xs font-medium transition-all flex items-center justify-between cursor-pointer ${
                          activeTab === 'growth-links' || activeTab === 'send-chat' || activeTab === 'mme' || activeTab === 'igme'
                            ? 'bg-purple-500/20 text-purple-300 font-bold'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Link2 className="w-3.5 h-3.5 text-purple-400" />
                          <span>Growth Links</span>
                        </div>
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 font-mono">send.chat</span>
                      </button>

                      {/* Child 4: Contests */}
                      <button
                        onClick={() => setActiveTab('contests')}
                        className={`w-full text-left py-1.5 px-2 rounded-lg text-xs font-medium transition-all flex items-center justify-between cursor-pointer ${
                          activeTab === 'contests'
                            ? 'bg-amber-500/20 text-amber-300 font-bold'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Trophy className="w-3.5 h-3.5 text-amber-400" />
                          <span>Contests</span>
                        </div>
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-mono">viral</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          {/* SECTION 2: ENGAGE & CRM */}
          <div className="space-y-1">
            {!isSidebarCollapsed && (
              <p className="px-3 text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1">
                CRM &amp; Messaging
              </p>
            )}

            <NavItem 
              icon={<Users className="w-4 h-4" />} 
              label="Audience" 
              active={activeTab === 'audience'} 
              onClick={() => setActiveTab('audience')} 
              collapsed={isSidebarCollapsed} 
            />

            <NavItem 
              icon={<MessageSquare className="w-4 h-4" />} 
              label="Conversations" 
              active={activeTab === 'conversations'} 
              onClick={() => setActiveTab('conversations')} 
              collapsed={isSidebarCollapsed} 
            />

            <NavItem 
              icon={<BellRing className="w-4 h-4 text-cyan-400" />} 
              label="Broadcasts" 
              badge="Meta RN" 
              active={activeTab === 'broadcasts'} 
              onClick={() => setActiveTab('broadcasts')} 
              collapsed={isSidebarCollapsed} 
            />

            <NavItem 
              icon={<MessageSquareText className="w-4 h-4 text-amber-400" />} 
              label="SMS Blasts" 
              active={activeTab === 'sms-broadcast'} 
              onClick={() => setActiveTab('sms-broadcast')} 
              collapsed={isSidebarCollapsed} 
            />
          </div>

          {/* SECTION 3: OPERATIONS & SYSTEM */}
          <div className="space-y-1">
            {!isSidebarCollapsed && (
              <p className="px-3 text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1">
                Operations &amp; System
              </p>
            )}

            <NavItem 
              icon={<Building2 className="w-4 h-4 text-cyan-400" />} 
              label="Workspaces" 
              badge={`${workspaces.length}`}
              active={activeTab === 'workspaces' || activeTab === 'silos'} 
              onClick={() => setActiveTab('workspaces')} 
              collapsed={isSidebarCollapsed} 
            />

            <NavItem 
              icon={<ShieldCheck className="w-4 h-4 text-amber-400" />} 
              label="Super Admin" 
              badge="Owner"
              active={activeTab === 'super-admin' || activeTab === 'kanban' || activeTab === 'kanban-roadmap'} 
              onClick={() => setActiveTab('super-admin')} 
              collapsed={isSidebarCollapsed} 
            />

            <NavItem 
              icon={<Layers className="w-4 h-4" />} 
              label="Integrations" 
              active={activeTab === 'integrations'} 
              onClick={() => setActiveTab('integrations')} 
              collapsed={isSidebarCollapsed} 
            />

            <NavItem 
              icon={<BookOpen className="w-4 h-4" />} 
              label="Knowledge Base" 
              active={activeTab === 'docs' || activeTab === 'knowledge-base'} 
              onClick={() => setActiveTab('docs')} 
              collapsed={isSidebarCollapsed} 
            />

            <NavItem 
              icon={<Settings className="w-4 h-4" />} 
              label="Settings" 
              active={activeTab === 'settings' || activeTab === 'channels'} 
              onClick={() => { setSettingsInitialTab('general'); setActiveTab('settings'); }}               collapsed={isSidebarCollapsed} 
            />
          </div>

        </nav>

        {/* Bottom Pinned Area: Pro Plan Status */}
        <div className="mt-auto pt-2.5 border-t border-slate-800/80 w-full space-y-2 flex-shrink-0">
          {!isSidebarCollapsed ? (
            <div className="p-2.5 rounded-xl bg-gradient-to-r from-blue-950/30 to-indigo-950/30 border border-blue-500/20 flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
                <div className="min-w-0">
                  <span className="text-xs font-semibold text-white block truncate leading-tight">Pro Workspaces</span>
                  <span className="text-[10px] text-slate-400 block truncate">Meta Cloud Ready</span>
                </div>
              </div>
              <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/15 px-1.5 py-0.5 rounded border border-emerald-500/30 flex-shrink-0">
                Active
              </span>
            </div>
          ) : (
            <button 
              onClick={() => setActiveTab('dashboard')}
              className="w-10 h-10 mx-auto rounded-xl bg-blue-900/30 border border-blue-500/30 flex items-center justify-center text-cyan-400 hover:text-white transition-all cursor-pointer"
              title="Pro Workspaces Active"
            >
              <Sparkles className="w-4 h-4" />
            </button>
          )}
        </div>
      </aside>

      {/* Main Content Area with Unified Top Navigation */}
      <div className="flex-1 min-w-0 h-screen flex flex-col z-10 relative overflow-hidden">
        {/* Unified Top Navigation Bar */}
        {!isFlows && (
          <TopNavBar
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            workspaces={workspaces}
            activeWorkspaceId={activeWorkspaceId}
            onSelectWorkspace={handleSelectWorkspace}
            currentUser={currentUser}
            onSignOut={() => {
              signOutUser();
              setCurrentUser(null);
            }}
            onOpenCreateBotModal={() => {
              setActiveTab('bot-list');
              setCreateModalTrigger(prev => prev + 1);
            }}
            isSidebarCollapsed={isSidebarCollapsed}
            onToggleSidebar={() => setIsSidebarCollapsed(prev => !prev)}
          />
        )}

        {/* View Viewport */}
        <main className={`flex-1 min-w-0 flex flex-col relative ${isFlows || activeTab === 'conversations' ? 'overflow-hidden p-0 h-full' : 'overflow-y-auto p-3.5 sm:p-5 md:p-6 lg:p-8'}`}>
          {activeWorkspace?.id && (
            <MetaReconnectBanner
              workspaceId={activeWorkspace.id}
              workspaceName={activeWorkspace.name}
            />
          )}
          {showPlanNudge && (
            <div className="mb-4 w-full px-4 py-3 rounded-2xl bg-gradient-to-r from-purple-600/15 to-indigo-600/15 border border-purple-500/30 flex items-center justify-between gap-3">
              <button
                onClick={() => { setSettingsInitialTab('plan'); setActiveTab('settings'); }}
                className="flex-1 text-left flex items-center justify-between gap-3 hover:border-purple-500/50 transition-all cursor-pointer min-w-0"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Sparkles className="w-4 h-4 text-purple-300 shrink-0" />
                  <p className="text-xs text-slate-200 truncate">
                    <span className="font-bold text-white">Choose your route:</span> DIY self-service or Done-For-You. You can switch anytime.
                  </p>
                </div>
                <span className="text-[11px] font-bold text-purple-200 bg-purple-500/20 px-2.5 py-1 rounded-lg shrink-0">Pick a plan</span>
              </button>
              <button
                type="button"
                onClick={dismissPlanNudge}
                title="Dismiss"
                className="p-1 text-slate-500 hover:text-white shrink-0 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          {renderContent()}
        </main>
      </div>

      {/* Auth Gate: Require login for all visitors */}
      {!authLoading && !currentUser && (
        <AuthGateModal onSuccess={() => {}} />
      )}

      {/* Copilot setup guide: walks new users through remaining setup */}
      {showGuide && activeWorkspace && (
        <CopilotGuide
          workspace={activeWorkspace}
          onGoToPlan={() => { setSettingsInitialTab('plan'); setActiveTab('settings'); }}
          onGoToChannels={() => { setSettingsInitialTab('channels'); setActiveTab('settings'); }}
          onGoToIntegrations={() => { setSettingsInitialTab('integrations'); setActiveTab('settings'); }}
          onGoToFlows={() => setActiveTab('bot-list')}
          onDismiss={dismissGuide}
        />
      )}
      <GlobalEmojiBuddy />
      <GlobalPersonalizationBuddy />
      {/* Gamification: badge-earned toasts */}
      {currentUser && <BadgeToast currentUser={currentUser} workspaceId={activeWorkspace?.id} />}
    </div>
  );
}

function NavItem({
  icon,
  label,
  badge,
  active = false,
  collapsed = false,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  badge?: string;
  active?: boolean;
  collapsed?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={collapsed ? (badge ? `${label} (${badge})` : label) : undefined}
      className={`w-full text-left py-2 px-3 rounded-xl transition-all flex items-center justify-between gap-2.5 cursor-pointer relative group ${collapsed ? 'justify-center p-2.5' : ''} ${
        active
          ? 'bg-gradient-to-r from-cyan-500/15 via-blue-500/10 to-transparent text-cyan-300 font-semibold border border-cyan-500/25 shadow-sm'
          : 'text-slate-400 hover:bg-white/5 hover:text-slate-200 border border-transparent'
      }`}
    >
      {/* Active Glowing Indicator Bar */}
      {active && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r bg-gradient-to-b from-cyan-400 to-blue-500 shadow-sm shadow-cyan-500/50" />
      )}

      <div className="flex items-center gap-2.5 min-w-0">
        <div className={`${active ? 'text-cyan-400' : 'opacity-70 group-hover:opacity-100'} flex-shrink-0 transition-opacity`}>
          {icon}
        </div>
        {!collapsed && <span className="text-xs whitespace-nowrap overflow-hidden truncate">{label}</span>}
      </div>
      
      {!collapsed && badge && (
        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider flex-shrink-0 ${
          badge === 'Roadmap' 
            ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
            : badge === 'Owner'
            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
            : 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
        }`}>
          {badge}
        </span>
      )}
    </button>
  );
}
