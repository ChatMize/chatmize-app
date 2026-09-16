import React, { useState } from 'react';
import { 
  Users, 
  ShieldAlert, 
  CreditCard, 
  DownloadCloud, 
  CheckCircle, 
  AlertTriangle, 
  ArrowRight, 
  Search, 
  Filter, 
  Sparkles, 
  Plus, 
  Edit3, 
  Trash2, 
  Database, 
  ExternalLink,
  Crown,
  FileSpreadsheet,
  Check,
  Layers,
  Calculator
} from 'lucide-react';
import { SuperAdminKanban } from '../components/admin/SuperAdminKanban';
import { PlanEditorModal } from '../components/admin/PlanEditorModal';
import { Plan, FEATURE_LABELS, formatPrice, deletePlan } from '../lib/billing';
import { usePlans } from '../lib/entitlements';

interface SuperAdminViewProps {
  initialTab?: 'kanban' | 'users' | 'plans' | 'migration';
}

interface UserRecord {
  id: string;
  name: string;
  email: string;
  role: 'Super Admin' | 'Admin' | 'Agency Owner' | 'Subscriber' | 'Legacy Account';
  status: 'Active' | 'Invited' | 'Pending Migration' | 'Suspended';
  plan: 'Enterprise VIP' | 'Pro Automation' | 'Growth Plan' | 'Starter' | 'Legacy Lifetime';
  contactsCount: number;
  flowsCount: number;
  migratedFromLegacy?: boolean;
  joinedDate: string;
}

const INITIAL_USERS: UserRecord[] = [
  {
    id: 'usr-1',
    name: 'Karl Schuckert',
    email: 'instantreferralsapp@gmail.com',
    role: 'Super Admin',
    status: 'Active',
    plan: 'Enterprise VIP',
    contactsCount: 14850,
    flowsCount: 42,
    migratedFromLegacy: true,
    joinedDate: 'Founding Member'
  },
  {
    id: 'usr-2',
    name: 'Marcus Sterling',
    email: 'marcus@growthscale.agency',
    role: 'Agency Owner',
    status: 'Active',
    plan: 'Enterprise VIP',
    contactsCount: 8420,
    flowsCount: 19,
    migratedFromLegacy: false,
    joinedDate: '2026-08-14'
  },
  {
    id: 'usr-3',
    name: 'Elena Rostova',
    email: 'elena@ecomspark.io',
    role: 'Subscriber',
    status: 'Active',
    plan: 'Pro Automation',
    contactsCount: 3120,
    flowsCount: 8,
    migratedFromLegacy: true,
    joinedDate: '2026-08-29'
  },
  {
    id: 'usr-4',
    name: 'David Vance',
    email: 'vance.funnels@gmail.com',
    role: 'Legacy Account',
    status: 'Pending Migration',
    plan: 'Legacy Lifetime',
    contactsCount: 6540,
    flowsCount: 12,
    migratedFromLegacy: true,
    joinedDate: 'Legacy Import'
  },
  {
    id: 'usr-5',
    name: 'Chloe Bennett',
    email: 'chloe@bennettsalon.com',
    role: 'Subscriber',
    status: 'Active',
    plan: 'Starter',
    contactsCount: 890,
    flowsCount: 3,
    migratedFromLegacy: false,
    joinedDate: '2026-09-02'
  }
];

export const SuperAdminView: React.FC<SuperAdminViewProps> = ({
  initialTab = 'kanban'
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'kanban' | 'users' | 'plans' | 'migration'>(initialTab);
  const [users, setUsers] = useState<UserRecord[]>(INITIAL_USERS);
  const [searchQuery, setSearchQuery] = useState('');
  const { plans, loading: plansLoading } = usePlans();
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [isCreatingPlan, setIsCreatingPlan] = useState(false);
  
  // Platform Migration Simulation State
  const [legacyApiKey, setLegacyApiKey] = useState('');
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationLogs, setMigrationLogs] = useState<string[]>([]);
  const [migrationStep, setMigrationStep] = useState<'idle' | 'scanning' | 'converting' | 'completed'>('idle');

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleStartPlatformMigration = () => {
    setIsMigrating(true);
    setMigrationStep('scanning');
    setMigrationLogs(['Connecting to legacy platform export API...', 'Authenticating account token...']);

    setTimeout(() => {
      setMigrationStep('converting');
      setMigrationLogs(prev => [
        ...prev,
        'Found 1,280 contacts from legacy broadcast lists.',
        'Found 14 conversation bot flows and menus.',
        'Converting legacy JSON node triggers to Chatmize Next-Gen format...',
        'Mapping Meta PSIDs & Page subscription tokens...'
      ]);

      setTimeout(() => {
        setMigrationStep('completed');
        setIsMigrating(false);
        setMigrationLogs(prev => [
          ...prev,
          '✓ Successfully imported 1,280 Contacts into Audience View.',
          '✓ Successfully recreated 14 Flows in Flow Builder.',
          '✓ Tagged accounts with "Imported Account" badge.',
          'Migration completed with 0 errors.'
        ]);
        
        // Add new imported test user
        setUsers(prev => [
          ...prev,
          {
            id: `usr-${Date.now()}`,
            name: 'Legacy Imported Account',
            email: 'migrated.client@example.com',
            role: 'Subscriber',
            status: 'Active',
            plan: 'Pro Automation',
            contactsCount: 1280,
            flowsCount: 14,
            migratedFromLegacy: true,
            joinedDate: 'Just Now (Migration)'
          }
        ]);
      }, 2000);
    }, 1800);
  };

  return (
    <div className="flex-1 flex flex-col gap-6 max-w-7xl mx-auto w-full">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-purple-500/20 rounded-3xl p-6 shadow-xl">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Crown className="w-4 h-4" />
            </span>
            <span className="text-xs uppercase font-bold tracking-wider text-amber-400">Master Control Center</span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">Super Admin & Platform Operations</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Manage platform users, commercial pricing tiers, and migration bridges.
          </p>
        </div>

        {/* Sub-Tabs Selector */}
        <div className="flex items-center bg-slate-950/80 p-1.5 rounded-2xl border border-white/10 shrink-0 flex-wrap gap-1">
          <button
            onClick={() => setActiveSubTab('kanban')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeSubTab === 'kanban'
                ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md shadow-indigo-500/25'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Layers className="w-4 h-4 text-indigo-300" />
            <span>Architecture Kanban</span>
          </button>
          <button
            onClick={() => setActiveSubTab('users')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeSubTab === 'users'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Users &amp; Access ({users.length})</span>
          </button>
          <button
            onClick={() => setActiveSubTab('plans')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeSubTab === 'plans'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-500/25'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>Plans for Sale</span>
          </button>
          <button
            onClick={() => setActiveSubTab('migration')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeSubTab === 'migration'
                ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/25'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <DownloadCloud className="w-4 h-4" />
            <span>Platform Migration Bridge</span>
          </button>
        </div>
      </div>

      {/* TAB: ARCHITECTURE KANBAN */}
      {activeSubTab === 'kanban' && (
        <SuperAdminKanban />
      )}

      {/* TAB 1: USERS MANAGEMENT */}
      {activeSubTab === 'users' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search user by name, email, or role..."
                className="w-full pl-9 pr-4 py-2 bg-slate-900/80 border border-white/10 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              />
            </div>

            <div className="flex items-center gap-2">
              <button 
                onClick={() => {
                  const name = prompt('Enter user full name:');
                  const email = prompt('Enter user email:');
                  if (name && email) {
                    setUsers(prev => [
                      {
                        id: `usr-${Date.now()}`,
                        name,
                        email,
                        role: 'Subscriber',
                        status: 'Invited',
                        plan: 'Pro Automation',
                        contactsCount: 0,
                        flowsCount: 0,
                        joinedDate: 'Just Now'
                      },
                      ...prev
                    ]);
                  }
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-blue-500/20 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Invite New User</span>
              </button>
            </div>
          </div>

          {/* Users Table */}
          <div className="bg-slate-900/60 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-md">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-[11px] font-bold text-slate-400 uppercase tracking-wider bg-white/[0.02]">
                    <th className="py-3 px-4">User</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Commercial Plan</th>
                    <th className="py-3 px-4">Usage Stats</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-sm">
                  {filteredUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                            {u.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-white flex items-center gap-2">
                              <span>{u.name}</span>
                              {u.migratedFromLegacy && (
                                <span className="text-[10px] bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 px-1.5 py-0.2 rounded font-medium">
                                  Imported
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-400">{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                          u.role === 'Super Admin'
                            ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                            : u.role === 'Agency Owner'
                            ? 'bg-purple-500/15 text-purple-300 border border-purple-500/30'
                            : 'bg-blue-500/15 text-blue-300 border border-blue-500/30'
                        }`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="text-slate-300 font-medium text-xs">
                          {u.plan}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="text-xs text-slate-300 font-medium">
                          {u.contactsCount.toLocaleString()} Contacts
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {u.flowsCount} Active Flows
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                          u.status === 'Active' ? 'text-emerald-400' : 'text-amber-400'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            u.status === 'Active' ? 'bg-emerald-400' : 'bg-amber-400'
                          }`} />
                          {u.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button 
                            onClick={() => alert(`Viewing details for ${u.name}`)}
                            title="Edit User" 
                            className="p-1.5 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          {u.role !== 'Super Admin' && (
                            <button 
                              onClick={() => {
                                if (confirm(`Remove user ${u.name}?`)) {
                                  setUsers(prev => prev.filter(item => item.id !== u.id));
                                }
                              }}
                              title="Delete User" 
                              className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PLANS FOR SALE */}
      {activeSubTab === 'plans' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white">Commercial Tier Configuration</h2>
              <p className="text-xs text-slate-400">Plans are live data: edits here update every pricing surface immediately, no deploy needed.</p>
            </div>
            <button
              onClick={() => setIsCreatingPlan(true)}
              className="px-3.5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-lg shadow-purple-500/20"
            >
              <Plus className="w-4 h-4" />
              <span>Create New Tier</span>
            </button>
          </div>

          {plansLoading ? (
            <div className="text-center py-12 text-slate-400 text-sm">Loading plans...</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {plans.map((plan) => (
                <div
                  key={plan.id}
                  className={`bg-slate-900/80 border rounded-3xl p-6 relative flex flex-col justify-between backdrop-blur-md shadow-xl ${plan.color || 'border-white/10'}`}
                >
                  {plan.badge && (
                    <span className="absolute -top-3 right-6 px-3 py-1 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-[10px] font-extrabold uppercase tracking-wider rounded-full shadow-md">
                      {plan.badge}
                    </span>
                  )}
                  {!plan.isPublic && (
                    <span className="absolute -top-3 left-6 px-3 py-1 bg-slate-700 text-slate-300 text-[10px] font-extrabold uppercase tracking-wider rounded-full shadow-md">
                      Hidden
                    </span>
                  )}

                  <div>
                    <h3 className="text-xl font-bold text-white mb-1">{plan.name}</h3>
                    {plan.tagline && <p className="text-xs text-slate-500 mb-1">{plan.tagline}</p>}
                    <div className="flex items-baseline gap-1 my-3">
                      <span className="text-3xl font-black text-white">{formatPrice(plan.priceMonthlyCents)}</span>
                      <span className="text-xs text-slate-400">/month</span>
                    </div>
                    <div className="text-xs text-slate-400 mb-1 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      <span>{plan.subscribersCount} active paying subscribers</span>
                    </div>
                    <div className="text-xs text-slate-400 mb-4 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-cyan-400" />
                      <span>
                        {plan.contactLimit === null ? 'Unlimited' : plan.contactLimit.toLocaleString()} contacts
                        {' · '}{plan.aiCreditsMonthly.toLocaleString()} AI credits/mo
                      </span>
                    </div>

                    <div className="space-y-2.5 mb-6 border-t border-white/10 pt-4">
                      {plan.features.map((feat) => (
                        <div key={feat} className="flex items-start gap-2 text-xs text-slate-300">
                          <Check className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                          <span>{FEATURE_LABELS[feat]}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-white/10 flex items-center gap-2">
                    <button
                      onClick={() => setEditingPlan(plan)}
                      className="flex-1 py-2.5 bg-white/10 hover:bg-white/15 text-white rounded-xl text-xs font-bold transition-all text-center cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit Tier & Limits</span>
                    </button>
                    <button
                      onClick={async () => {
                        if (window.confirm(`Delete the "${plan.name}" tier? Workspaces on it keep their subscription record but resolve to no plan.`)) {
                          try {
                            await deletePlan(plan.id);
                          } catch (e) {
                            alert(e instanceof Error ? e.message : 'Failed to delete plan.');
                          }
                        }
                      }}
                      title="Delete tier"
                      className="p-2.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 rounded-xl transition-all cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {(editingPlan || isCreatingPlan) && (
            <PlanEditorModal
              plan={editingPlan}
              onClose={() => {
                setEditingPlan(null);
                setIsCreatingPlan(false);
              }}
              onSaved={() => {}}
            />
          )}
        </div>
      )}

      {/* TAB 3: PLATFORM MIGRATION BRIDGE */}
      {activeSubTab === 'migration' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 bg-slate-900/80 border border-white/10 rounded-3xl p-6 space-y-5 backdrop-blur-md">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="p-1 rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                  <Database className="w-4 h-4" />
                </span>
                <h3 className="text-lg font-bold text-white">1-Click Platform Migration Pipeline</h3>
              </div>
              <p className="text-xs text-slate-400">
                Move bots, flows, tags, and audience subscribers seamlessly from your legacy chatbot account into Chatmize with complete Meta compliance mapping.
              </p>
            </div>

            {/* Migration Strategy Steps */}
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl">
                <div className="font-bold text-white mb-1">1. Audience Import</div>
                <div className="text-slate-400 text-[11px]">Syncs FB/IG PSIDs, custom tags, and subscriber phone numbers.</div>
              </div>
              <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl">
                <div className="font-bold text-white mb-1">2. Flow Converter</div>
                <div className="text-slate-400 text-[11px]">Transforms legacy JSON block logic into modern visual canvas cards.</div>
              </div>
              <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl">
                <div className="font-bold text-white mb-1">3. Meta Policy Upgrade</div>
                <div className="text-slate-400 text-[11px]">Upgrades old broadcasts to 2026 Meta Recurring Notification opt-in tokens.</div>
              </div>
            </div>

            {/* API / CSV Migration Form */}
            <div className="space-y-3 pt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Platform Export API Token or Webhook URL
                </label>
                <input
                  type="text"
                  value={legacyApiKey}
                  onChange={(e) => setLegacyApiKey(e.target.value)}
                  placeholder="e.g. platform_live_sec_9938b827f71a99..."
                  className="w-full px-3.5 py-2.5 bg-slate-800 border border-white/10 rounded-xl text-white placeholder-slate-500 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
                />
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={isMigrating}
                  onClick={handleStartPlatformMigration}
                  className="flex-1 py-3 px-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 transition-all"
                >
                  {isMigrating ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Migrating Account Data...</span>
                    </>
                  ) : (
                    <>
                      <DownloadCloud className="w-4 h-4" />
                      <span>Execute Migration Pipeline</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => alert('Opening CSV import parser for subscriber spreadsheets.')}
                  className="py-3 px-4 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                  <span>Upload CSV Export</span>
                </button>
              </div>
            </div>
          </div>

          {/* Console Output & Real-time Status */}
          <div className="lg:col-span-5 bg-slate-950 border border-white/10 rounded-3xl p-5 flex flex-col justify-between font-mono text-xs">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-3">
                <span className="text-slate-400 text-[11px] font-bold uppercase tracking-wider">Migration Terminal</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  migrationStep === 'completed'
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                    : migrationStep === 'scanning' || migrationStep === 'converting'
                    ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 animate-pulse'
                    : 'bg-slate-800 text-slate-400'
                }`}>
                  {migrationStep === 'idle' && 'Standby'}
                  {migrationStep === 'scanning' && 'Scanning API'}
                  {migrationStep === 'converting' && 'Transforming'}
                  {migrationStep === 'completed' && 'Migration Ready'}
                </span>
              </div>

              <div className="space-y-2 text-slate-300 max-h-72 overflow-y-auto">
                {migrationLogs.length === 0 ? (
                  <p className="text-slate-600 italic">No migration initiated yet. Click "Execute Migration Pipeline" or upload a CSV export.</p>
                ) : (
                  migrationLogs.map((log, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <span className="text-cyan-400 select-none">&gt;</span>
                      <span className={log.startsWith('✓') ? 'text-emerald-400 font-bold' : ''}>{log}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-white/10 text-[11px] text-slate-500 flex items-center justify-between">
              <span>Chatmize Bridge v2.4</span>
              <span>100% Lossless Flow Guarantee</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
