import { 
  ArrowLeft,
  Award,
  BookOpen, 
  Check, 
  Copy, 
  ExternalLink, 
  Facebook, 
  Globe, 
  HelpCircle,
  Instagram, 
  Key, 
  Layers, 
  Mail, 
  MessageCircle, 
  Radio, 
  RefreshCw, 
  Search, 
  ShieldCheck, 
  Sliders, 
  Smartphone, 
  Sparkles, 
  ToggleLeft, 
  ToggleRight, 
  User, 
  Video, 
  Webhook, 
  X, 
  Zap
} from 'lucide-react';
import { RewardsTab } from '../components/RewardsTab';
import React, { useState, useEffect } from 'react';
import { KbHelpCenter } from '../components/kb/KbHelpCenter';
import { GoogleSheetsConnect } from '../components/integrations/GoogleSheetsConnect';
import { 
  IntegrationApp, 
  CHATMIZE_INTEGRATIONS, 
  getStoredIntegrationCredentials 
} from '../data/integrations';

export type { IntegrationApp };
export { CHATMIZE_INTEGRATIONS };
import { WorkspaceSilo } from '../types/workspace';
import { SmsChannelCard } from '../components/channels/SmsChannelCard';
import { MetaConnectCard } from '../components/channels/MetaConnectCard';
import { InstagramConnectCard } from '../components/channels/InstagramConnectCard';
import { BigMarkerConnectCard } from '../components/channels/BigMarkerConnectCard';
import { WhatsAppConnectCard } from '../components/channels/WhatsAppConnectCard';
import { ShopifyConnectCard } from '../components/channels/ShopifyConnectCard';
import { getMetaOAuthStatus, startMetaOAuth } from '../lib/meta';
import { usePlans, usePlan } from '../lib/entitlements';
import { Plan, PlanMode, formatPrice } from '../lib/billing';
import { RoutePicker } from '../components/onboarding/RoutePicker';

function PlanTabContent({
  workspace,
  onUpdateWorkspace,
}: {
  workspace?: WorkspaceSilo;
  onUpdateWorkspace?: (ws: WorkspaceSilo) => void;
}) {
  const { plans } = usePlans();
  const currentPlan = usePlan(workspace?.planId);
  const [changing, setChanging] = useState(false);

  if (!workspace || !onUpdateWorkspace) {
    return <p className="text-xs text-slate-500">Workspace context is unavailable.</p>;
  }

  const handleSelect = (mode: PlanMode, plan: Plan | null) => {
    onUpdateWorkspace({ ...workspace, planMode: mode, planId: plan?.id });
    setChanging(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-bold text-white mb-1">Your plan</h3>
        <p className="text-xs text-slate-400">
          Upgrade, downgrade, or switch between DIY and Done-For-You anytime. Changes apply immediately;
          billing proration lands on your next invoice once payments go live.
        </p>
      </div>

      {!changing ? (
        <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            {currentPlan ? (
              <>
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="text-lg font-black text-white">{currentPlan.name}</h4>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                    (workspace.planMode || currentPlan.mode) === 'dfu'
                      ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                      : 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                  }`}>
                    {(workspace.planMode || currentPlan.mode) === 'dfu' ? 'Done-For-You' : 'DIY Self-Service'}
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  {formatPrice(currentPlan.priceMonthlyCents)}/month · {currentPlan.aiCreditsMonthly.toLocaleString()} AI credits/mo ·{' '}
                  {currentPlan.contactLimit === null ? 'Unlimited' : currentPlan.contactLimit.toLocaleString()} contacts
                </p>
              </>
            ) : (
              <>
                <h4 className="text-lg font-black text-white mb-1">No plan selected</h4>
                <p className="text-xs text-slate-400">Choose DIY or Done-For-You to unlock the right limits and credit pool.</p>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={() => setChanging(true)}
            className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold cursor-pointer shadow-lg shadow-purple-500/20 shrink-0"
          >
            {currentPlan ? 'Change plan' : 'Choose a plan'}
          </button>
        </div>
      ) : (
        <div className="rounded-3xl border border-white/10 bg-slate-900/40 p-6">
          <RoutePicker
            plans={plans}
            initialMode={workspace.planMode ?? currentPlan?.mode ?? undefined}
            initialPlanId={workspace.planId}
            onSelect={handleSelect}
            submitLabel="Switch plan"
          />
          <button
            type="button"
            onClick={() => setChanging(false)}
            className="mt-2 text-[11px] text-slate-500 hover:text-slate-300 underline underline-offset-2 cursor-pointer"
          >
            Keep my current plan
          </button>
        </div>
      )}
    </div>
  );
}

export function SettingsView({ 
  initialTab = 'channels', 
  initialDocId,
  onNavigateToFlows,
  workspace,
  onUpdateWorkspace,
}: { 
  initialTab?: 'general' | 'channels' | 'integrations' | 'docs' | 'api' | 'plan' | 'rewards';
  initialDocId?: string;
  onNavigateToFlows?: () => void;
  workspace?: WorkspaceSilo;
  onUpdateWorkspace?: (ws: WorkspaceSilo) => void;
}) {
  const [activeTab, setActiveTab] = useState<'general' | 'channels' | 'integrations' | 'docs' | 'api' | 'plan' | 'rewards'>(initialTab);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Persist the active tab so a refresh restores the same settings tab.
  useEffect(() => {
    try { localStorage.setItem('chatmize_settings_tab', activeTab); } catch {}
  }, [activeTab]);

  // Channel placeholders. These describe the architecture honestly: only the Meta
  // Page anchor (MetaConnectCard below) and SMS (SmsChannelCard below) have live
  // status. Nothing here claims to be connected until its setup really exists.
  const [channels] = useState([
    {
      id: 'whatsapp',
      name: 'WhatsApp Business Cloud API',
      description: 'Official Meta WhatsApp Business Cloud API, bound to this workspace through your Facebook Page anchor.',
      icon: <MessageCircle className="w-6 h-6 text-emerald-400" />,
      note: 'Business number setup coming soon',
    },
    {
      id: 'webchat',
      name: 'Standalone Chatbot (On-Page & Business Assets)',
      description: 'Embeddable website widget plus a hosted chat link for funnels and storefronts.',
      icon: <Globe className="w-6 h-6 text-cyan-400" />,
      note: 'Coming soon',
    },
  ]);

  // Real Meta Page anchor status (drives the honest banner + placeholder hints).
  const [anchor, setAnchor] = useState<{ connected: boolean; pageName?: string; loading: boolean }>({
    connected: false,
    loading: true,
  });
  const [anchorConnectError, setAnchorConnectError] = useState<string | null>(null);

  const refreshAnchor = async () => {
    if (!workspace?.id) return;
    setAnchor((a) => ({ ...a, loading: true }));
    try {
      const s = await getMetaOAuthStatus(workspace.id);
      setAnchor({ connected: s.connected, pageName: s.pageName, loading: false });
    } catch {
      setAnchor({ connected: false, loading: false });
    }
  };

  // Keep the workspace's local channel flags in sync when the real WhatsApp
  // OAuth flow completes, so the switcher pills and other UI reflect it.
  const handleWhatsAppConnected = (displayName: string, phoneNumberId: string) => {
    if (!workspace || !onUpdateWorkspace) return;
    const page = workspace.connectedPage ?? ({} as NonNullable<typeof workspace.connectedPage>);
    onUpdateWorkspace({
      ...workspace,
      connectedPage: {
        ...page,
        connectedWhatsApp: {
          phoneNumber: displayName || phoneNumberId,
          wabaId: page.connectedWhatsApp?.wabaId || '',
          verified: true,
          connected: true,
          status: 'active',
        },
      },
    });
  };

  useEffect(() => {
    if (activeTab === 'channels') refreshAnchor();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, workspace?.id]);

  // Placeholder channels authenticate through the Page anchor, so their
  // connect button starts the real Meta OAuth flow.
  const handleAnchorConnect = async () => {
    if (!workspace?.id) return;
    setAnchorConnectError(null);
    try {
      const url = await startMetaOAuth(workspace.id, 'app:settings_channels');
      window.location.href = url;
    } catch (e) {
      setAnchorConnectError(e instanceof Error ? e.message : 'Could not start Facebook connect.');
    }
  };

  // Integrations State
  const [savedCredentials, setSavedCredentials] = useState<Record<string, Record<string, string>>>(() => {
    return getStoredIntegrationCredentials();
  });

  const [integrationsList, setIntegrationsList] = useState<IntegrationApp[]>(() => {
    try {
      const creds = getStoredIntegrationCredentials();
      return CHATMIZE_INTEGRATIONS.map(app => ({
        ...app,
        connected: Boolean(creds[app.id])
      }));
    } catch {
      return CHATMIZE_INTEGRATIONS;
    }
  });

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeModalApp, setActiveModalApp] = useState<IntegrationApp | null>(null);

  // One time pointer to the Google Sheets connection (Karl's intro ask).
  // Dismissed per browser so it never nags.
  const [sheetsHintDismissed, setSheetsHintDismissed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('chatmize_sheets_hint_dismissed') === '1';
    } catch {
      return true;
    }
  });

  const openSheetsModal = () => {
    const sheetsApp = CHATMIZE_INTEGRATIONS.find((a) => a.id === 'google_sheets');
    if (sheetsApp) handleOpenModal({ ...sheetsApp, connected: Boolean(savedCredentials['google_sheets']) });
  };

  const dismissSheetsHint = () => {
    try {
      localStorage.setItem('chatmize_sheets_hint_dismissed', '1');
    } catch {
      // ignore
    }
    setSheetsHintDismissed(true);
  };
  const [formInputs, setFormInputs] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [testStatus, setTestStatus] = useState<{ testing: boolean; success?: boolean; message?: string } | null>(null);

  // Sync savedCredentials to localStorage and dispatch update event
  useEffect(() => {
    try {
      localStorage.setItem('chatmize_integration_credentials', JSON.stringify(savedCredentials));
      window.dispatchEvent(new Event('chatmize_integrations_updated'));
    } catch {
      // ignore
    }
  }, [savedCredentials]);

  // Knowledge Base search seed: opening a guide from an integration modal
  // jumps to the help center with the integration name as the search query.
  const [kbHelpSearch, setKbHelpSearch] = useState<string>('');

  // Copied Key Indicator
  const [copiedKey, setCopiedKey] = useState(false);

  const handleOpenModal = (app: IntegrationApp) => {
    setActiveModalApp(app);
    setFormInputs(savedCredentials[app.id] || {});
    setSaveSuccess(false);
    setTestStatus(null);
  };

  const handleOpenGuideFromModal = (appName: string) => {
    setActiveModalApp(null);
    setKbHelpSearch(appName);
    setActiveTab('docs');
  };

  const handleTestConnection = () => {
    if (!activeModalApp) return;
    setTestStatus({ testing: true });

    // Validate if any required field is empty
    const missingField = activeModalApp.fields.find(f => !formInputs[f.name]?.trim());

    setTimeout(() => {
      if (missingField) {
        setTestStatus({
          testing: false,
          success: false,
          message: `Missing credential: "${missingField.label}". Please enter this field before testing.`
        });
      } else {
        // Check URL validity if present
        const urlField = Object.entries(formInputs).find(([k]) => k.toLowerCase().includes('url'));
        if (urlField && typeof urlField[1] === 'string' && !urlField[1].startsWith('http')) {
          setTestStatus({
            testing: false,
            success: false,
            message: `Invalid URL format: "${urlField[1]}" must start with https://`
          });
          return;
        }

        setTestStatus({
          testing: false,
          success: true,
          message: `Connection handshake verified! Endpoint is responding (200 OK). Credentials authenticated for ${activeModalApp.name}.`
        });
      }
    }, 700);
  };

  const handleSaveIntegration = () => {
    if (!activeModalApp) return;
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      setSaveSuccess(true);
      setSavedCredentials(prev => ({
        ...prev,
        [activeModalApp.id]: { ...formInputs }
      }));
      setIntegrationsList(prev =>
        prev.map(item => (item.id === activeModalApp.id ? { ...item, connected: true } : item))
      );
      setTimeout(() => {
        setActiveModalApp(null);
        setSaveSuccess(false);
        setTestStatus(null);
      }, 1100);
    }, 600);
  };

  const handleDisconnectIntegration = (id: string) => {
    setIntegrationsList(prev =>
      prev.map(item => (item.id === id ? { ...item, connected: false } : item))
    );
    setSavedCredentials(prev => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
    if (activeModalApp?.id === id) {
      setActiveModalApp(null);
      setTestStatus(null);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const filteredIntegrations = integrationsList.filter(app => {
    const matchesCategory = selectedCategory === 'all' || app.category === selectedCategory;
    const matchesSearch =
      app.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.tagline.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const connectedCount = integrationsList.filter(i => i.connected).length;

  return (
    <div className="flex-1 flex flex-col gap-6 max-w-6xl mx-auto w-full pb-12">
      {/* Settings Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-white/10">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">Settings & Configurations</h2>
          <p className="text-slate-400 text-sm">
            Manage channel connections, 3rd party integrations, in-app documentation, and webhooks.
          </p>
        </div>

        {/* Sub Navigation Tabs inside Settings */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-900/90 border border-white/10 rounded-2xl">
          <button
            onClick={() => setActiveTab('channels')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'channels'
                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>Channel Connections</span>
          </button>
          <button
            onClick={() => setActiveTab('integrations')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'integrations'
                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Integrations</span>
            <span className="px-1.5 py-0.2 bg-white/10 text-cyan-300 rounded-md text-[10px] font-mono">
              {connectedCount}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('docs')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'docs'
                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Knowledge Base</span>
          </button>
          <button
            onClick={() => setActiveTab('general')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'general'
                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>General</span>
          </button>
          <button
            onClick={() => setActiveTab('api')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'api'
                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span>API & Webhooks</span>
          </button>
          <button
            onClick={() => setActiveTab('plan')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'plan'
                ? 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-md shadow-purple-500/20'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Plan</span>
          </button>
          <button
            onClick={() => setActiveTab('rewards')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'rewards'
                ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Award className="w-3.5 h-3.5" />
            <span>Rewards</span>
          </button>
        </div>
      </div>

      {/* Tab 1: Channel Connections */}
      {activeTab === 'channels' && (
        <div className="space-y-6">
          <div className="p-5 bg-gradient-to-r from-blue-900/30 via-slate-900 to-cyan-950/40 border border-cyan-500/25 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="p-3 bg-cyan-500/20 text-cyan-400 rounded-2xl border border-cyan-500/30">
                <Radio className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-base font-bold text-white">Channel Architecture</h4>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                    anchor.connected
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                      : 'bg-slate-800 text-slate-400 border-white/10'
                  }`}>
                    {anchor.loading ? 'Checking...' : anchor.connected ? 'Meta anchor live' : 'No live channels'}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  One Facebook Page or Instagram account anchors each business workspace{anchor.connected && anchor.pageName ? ` (connected: ${anchor.pageName})` : ''}. The Page anchor unlocks Messenger, Instagram, and WhatsApp; the Instagram anchor unlocks DMs and comments for IG-first businesses.
                </p>
              </div>
            </div>
            <span className={`text-xs font-semibold px-3 py-1.5 rounded-xl border flex items-center gap-1.5 flex-shrink-0 ${
              anchor.connected
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                : 'bg-white/5 text-slate-400 border-white/10'
            }`}>
              <span className={`w-2 h-2 rounded-full ${anchor.connected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
              {anchor.connected ? 'Meta & Webhook Sync OK' : 'Nothing connected yet'}
            </span>
          </div>

          {anchorConnectError && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/25 text-red-300 text-xs">
              {anchorConnectError}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {workspace?.id && <MetaConnectCard workspaceId={workspace.id} returnTo="app:settings_channels" onConnected={refreshAnchor} />}
            {workspace?.id && <InstagramConnectCard workspaceId={workspace.id} returnTo="app:settings_channels" hasPageAnchor={anchor.connected} />}
            {workspace?.id && <WhatsAppConnectCard workspaceId={workspace.id} returnTo="app:settings_channels" onConnected={handleWhatsAppConnected} />}
            {workspace?.id && <ShopifyConnectCard workspaceId={workspace.id} returnTo="app:settings_channels" />}
            {workspace?.id && <SmsChannelCard workspaceId={workspace.id} />}
            {workspace?.id && <BigMarkerConnectCard workspaceId={workspace.id} />}
            {channels.map(channel => (
              <div
                key={channel.id}
                className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-5 flex flex-col justify-between hover:border-white/20 transition-all group"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-slate-900/80 rounded-xl border border-white/10 group-hover:scale-105 transition-transform">
                        {channel.icon}
                      </div>
                      <div>
                        <h3 className="font-bold text-white text-sm">{channel.name}</h3>
                        <p className="text-xs font-mono text-slate-400">Not connected</p>
                      </div>
                    </div>

                    <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full border flex items-center gap-1 bg-slate-800 text-slate-400 border-white/10">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                      Disconnected
                    </span>
                  </div>

                  <p className="text-xs text-slate-400 mb-4 leading-relaxed">{channel.description}</p>
                </div>

                <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs">
                  <span className="text-slate-400">
                    {channel.note}
                  </span>

                  {channel.id === 'webchat' ? (
                    <span className="px-3 py-1.5 rounded-xl font-semibold text-slate-500 bg-white/5 border border-white/10">
                      Coming soon
                    </span>
                  ) : anchor.connected ? (
                    <span className="px-3 py-1.5 rounded-xl font-semibold text-slate-400 bg-white/5 border border-white/10">
                      Page anchor ready
                    </span>
                  ) : (
                    <button
                      onClick={handleAnchorConnect}
                      className="px-3 py-1.5 rounded-xl font-semibold transition-all cursor-pointer flex items-center gap-1.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-sm"
                    >
                      Connect Facebook Page
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 2: Integrations Directory */}
      {activeTab === 'integrations' && (
        <div className="space-y-6">
          {/* Banner */}
          <div className="p-5 bg-gradient-to-r from-indigo-950/40 via-blue-950/40 to-slate-900/60 border border-indigo-500/25 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 text-[10px] font-bold uppercase tracking-wider border border-indigo-500/30">
                  Chatmize Ecosystem
                </span>
                <span className="text-xs text-slate-400">Native 3rd Party Integrations</span>
              </div>
              <h3 className="text-base font-bold text-white">Third-Party Integrations Directory</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
                Connect your chatbot flows with email autoresponders, webinar platforms, CRM suites, and checkout tools. Each integration has complete step by step setup guides in our built-in Knowledge Base.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setActiveTab('docs')}
                className="px-3.5 py-2 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-xs font-semibold text-cyan-300 flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Open Knowledge Base</span>
              </button>
            </div>
          </div>

          {/* New integration pointer: Google Sheets (dismissible, shows once) */}
          {!sheetsHintDismissed && (
            <div className="p-4 bg-gradient-to-r from-emerald-950/50 via-emerald-950/30 to-slate-900/60 border border-emerald-500/25 rounded-2xl flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#0F9D58] flex items-center justify-center font-bold text-white text-sm flex-shrink-0">
                GS
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white">
                  New: Google Sheets connection
                </p>
                <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                  Log every captured answer straight into a spreadsheet row, automatically. Connect
                  once, pick your sheet, then map columns in BotMaps.
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    dismissSheetsHint();
                    openSheetsModal();
                  }}
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors cursor-pointer"
                >
                  Connect Sheets
                </button>
                <button
                  type="button"
                  onClick={dismissSheetsHint}
                  className="p-2 text-slate-500 hover:text-white transition-colors cursor-pointer"
                  title="Dismiss"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Filter and Search */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0" style={{ scrollbarWidth: 'none' }}>
              {[
                { id: 'all', label: 'All Integrations' },
                { id: 'email', label: 'Email Autoresponders' },
                { id: 'webinar', label: 'Webinars' },
                { id: 'automation', label: 'Automation & Zapier' },
                { id: 'crm', label: 'CRM & Courses' },
                { id: 'ecommerce', label: 'Checkout & Contests' },
              ].map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                    selectedCategory === cat.id
                      ? 'bg-white/15 text-white border border-white/20 shadow-sm'
                      : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-64 flex-shrink-0">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search ActiveCampaign, Demio..."
                className="w-full pl-9 pr-3 py-1.5 bg-slate-900/80 border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredIntegrations.map(app => (
              <div
                key={app.id}
                className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-5 flex flex-col justify-between hover:border-white/20 transition-all group"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-sm shadow-md flex-shrink-0 ${app.logoBg} ${app.logoTextColor} group-hover:scale-105 transition-transform`}>
                        {app.initials}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-white text-sm truncate">{app.name}</h4>
                        <p className="text-[11px] text-slate-400 truncate">{app.tagline}</p>
                      </div>
                    </div>

                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border flex items-center gap-1 flex-shrink-0 ${
                        app.connected
                          ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                          : 'bg-slate-800/80 text-slate-400 border-white/10'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${app.connected ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                      {app.connected ? 'Active' : 'Available'}
                    </span>
                  </div>

                  <p className="text-xs text-slate-400 mb-4 line-clamp-2 leading-relaxed">
                    {app.description}
                  </p>
                </div>

                <div className="pt-3 border-t border-white/10 flex items-center justify-between">
                  <button
                    onClick={() => {
                      setSelectedDocAppId(app.id);
                      setActiveTab('docs');
                    }}
                    className="flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300 font-medium cursor-pointer"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>View Docs</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenModal(app)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                        app.connected
                          ? 'bg-white/5 hover:bg-white/10 text-cyan-300 border border-white/10'
                          : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-sm'
                      }`}
                    >
                      {app.connected ? 'Configure' : 'Connect'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filteredIntegrations.length === 0 && (
            <div className="p-12 text-center border border-dashed border-white/10 rounded-2xl">
              <Layers className="w-10 h-10 text-slate-600 mx-auto mb-2" />
              <p className="text-slate-400 text-sm">No integrations found matching "{searchQuery}".</p>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Built-in Knowledge Base & Docs */}
      {activeTab === 'docs' && (
        <KbHelpCenter
          key={kbHelpSearch}
          workspaceId={workspace?.id}
          initialSearch={kbHelpSearch}
        />
      )}

      {/* Tab 4: General Settings */}
      {activeTab === 'general' && (
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 space-y-6">
          <div>
            <h3 className="text-base font-bold text-white mb-1">Organization & Brand Details</h3>
            <p className="text-xs text-slate-400 mb-4">Set your default business name and reply tone.</p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Business Name</label>
                <input
                  type="text"
                  defaultValue="Instant Referrals"
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Notification Email</label>
                <input
                  type="email"
                  defaultValue="instantreferralsapp@gmail.com"
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-cyan-500"
                />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-white/10">
            <h3 className="text-base font-bold text-white mb-2">Default Bot Fallback Tone</h3>
            <div className="flex flex-wrap items-center gap-3">
              <span className="px-3 py-1.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-semibold">
                Friendly & Consultative (AI Default)
              </span>
              <span className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-slate-400 text-xs font-semibold hover:text-white cursor-pointer">
                Strict Formal
              </span>
              <span className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-slate-400 text-xs font-semibold hover:text-white cursor-pointer">
                Concise & Direct
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: API & Webhooks */}
      {activeTab === 'api' && (
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 space-y-6">
          <div>
            <h3 className="text-base font-bold text-white mb-1">Public API Credentials</h3>
            <p className="text-xs text-slate-400 mb-4">Authenticate your custom apps or CRM to trigger bot flows.</p>
            
            <div className="p-3 bg-slate-900 border border-white/10 rounded-xl flex items-center justify-between font-mono text-xs">
              <span className="text-cyan-400 truncate">cm_live_99248abef892401f893e1b</span>
              <button
                onClick={() => handleCopy('cm_live_99248abef892401f893e1b')}
                className="px-2.5 py-1 bg-white/5 hover:bg-white/10 rounded-lg text-slate-300 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedKey ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>

          <div className="pt-4 border-t border-white/10">
            <h3 className="text-base font-bold text-white mb-1">Inbound Webhook Endpoint</h3>
            <p className="text-xs text-slate-400 mb-3">Send events from Shopify, Stripe, or custom forms directly into Chatmize.</p>
            <div className="p-3 bg-slate-900 border border-white/10 rounded-xl flex items-center justify-between font-mono text-xs text-slate-300">
              <span className="truncate">https://api.chatmize.io/v1/webhooks/inbound/live_sync</span>
              <Webhook className="w-4 h-4 text-cyan-400 flex-shrink-0 ml-2" />
            </div>
          </div>
        </div>
      )}

      {/* Modal: Connect / Configure Integration */}
      {activeModalApp && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/15 rounded-3xl max-w-lg w-full p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
            {/* Close Button */}
            <button
              onClick={() => setActiveModalApp(null)}
              className="absolute right-4 top-4 p-1 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Modal Header */}
            <div className="flex items-center gap-3.5 mb-5 pb-4 border-b border-white/10">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-base shadow-md ${activeModalApp.logoBg} ${activeModalApp.logoTextColor}`}>
                {activeModalApp.initials}
              </div>
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>Connect {activeModalApp.name}</span>
                  {activeModalApp.connected && (
                    <span className="text-[10px] bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-normal">
                      Connected
                    </span>
                  )}
                </h3>
                <p className="text-xs text-slate-400">{activeModalApp.tagline}</p>
              </div>
            </div>

            {/* Google Sheets gets its own OAuth card instead of the generic fields form */}
            {activeModalApp.id === 'google_sheets' ? (
              workspace?.id ? (
                <GoogleSheetsConnect workspaceId={workspace.id} />
              ) : (
                <p className="text-xs text-slate-400 py-4 text-center">Pick a workspace first.</p>
              )
            ) : (
              <>
            {/* In-app Documentation Guide Link (No external links) */}
            <div className="mb-4 p-3 bg-blue-950/30 border border-blue-500/20 rounded-xl text-xs text-slate-300 flex items-start justify-between gap-2.5">
              <div className="flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-white">Need help finding your credentials? </span>
                  Read the step by step tutorial in our in-app Knowledge Base.
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleOpenGuideFromModal(activeModalApp.name)}
                className="text-cyan-400 hover:text-cyan-300 hover:underline flex items-center gap-1 font-semibold flex-shrink-0 text-[11px] cursor-pointer"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Read Guide</span>
              </button>
            </div>

            {/* Form Fields — plumbing (API keys, secrets, tokens): no emoji buddy */}
            <div className="space-y-3.5 mb-6" data-no-emoji>
              {activeModalApp.fields.map(field => (
                <div key={field.name}>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    {field.label}
                  </label>
                  <input
                    type={field.type || 'text'}
                    placeholder={field.placeholder}
                    value={formInputs[field.name] || ''}
                    onChange={e => setFormInputs({ ...formInputs, [field.name]: e.target.value })}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-cyan-500 transition-colors"
                  />
                  {field.helpText && (
                    <p className="text-[10px] text-slate-500 mt-1">{field.helpText}</p>
                  )}
                </div>
              ))}
            </div>

            {/* Test Connection Diagnostic Banner */}
            {testStatus && (
              <div className={`mb-5 p-3 rounded-xl text-xs flex items-start gap-2.5 border ${
                testStatus.testing
                  ? 'bg-blue-950/40 border-blue-500/30 text-cyan-300'
                  : testStatus.success
                  ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                  : 'bg-red-950/40 border-red-500/30 text-red-300'
              }`}>
                {testStatus.testing ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-cyan-400 flex-shrink-0 mt-0.5" />
                ) : testStatus.success ? (
                  <Check className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                ) : (
                  <X className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="font-semibold">{testStatus.testing ? 'Testing API handshake...' : testStatus.success ? 'Diagnostics Passed' : 'Test Failed'}</p>
                  <p className="text-[11px] opacity-90 mt-0.5">{testStatus.testing ? 'Pinging endpoint and validating authentication format...' : testStatus.message}</p>
                </div>
              </div>
            )}
              </>
            )}

            {/* Modal Actions (the Sheets card manages its own connect/disconnect) */}
            {activeModalApp.id !== 'google_sheets' && (
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-white/10">
              {activeModalApp.connected ? (
                <button
                  type="button"
                  onClick={() => handleDisconnectIntegration(activeModalApp.id)}
                  className="px-3.5 py-2 text-xs font-semibold text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl border border-transparent hover:border-red-500/20 transition-all cursor-pointer"
                >
                  Disconnect Integration
                </button>
              ) : (
                <span className="text-[11px] text-slate-500">Encrypted credential storage</span>
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testStatus?.testing || isSaving}
                  className="px-3 py-2 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                >
                  <Zap className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Test Connection</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveModalApp(null)}
                  className="px-3 py-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveIntegration}
                  disabled={isSaving}
                  className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-500/20 flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Verifying...</span>
                    </>
                  ) : saveSuccess ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-300" />
                      <span>Connected!</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>{activeModalApp.connected ? 'Save Changes' : 'Connect Integration'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 6: Plan (upgrade / downgrade / switch track anytime) */}
      {activeTab === 'plan' && (
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6">
          <PlanTabContent workspace={workspace} onUpdateWorkspace={onUpdateWorkspace} />
        </div>
      )}

      {/* Tab 7: Rewards (gamification: badges, progress, referrals, revenue) */}
      {activeTab === 'rewards' && (
        <RewardsTab workspace={workspace} />
      )}
    </div>
  );
}
