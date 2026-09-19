import React, { useState, useMemo, useEffect } from 'react';
import { 
  Zap, 
  Plus, 
  Search, 
  Filter, 
  Play, 
  Pause, 
  Trash2, 
  Copy, 
  Edit3, 
  ExternalLink, 
  CheckCircle2, 
  Layers, 
  Workflow, 
  ArrowRight, 
  MessageSquare, 
  Sparkles,
  Bot,
  Grid,
  List,
  ChevronRight,
  ChevronDown,
  TrendingUp,
  Tag,
  Clock,
  Radio,
  Sliders,
  Check,
  X,
  Folder,
  FolderPlus,
  FolderOpen,
  LayoutGrid,
  MoreVertical,
  Edit2,
  Activity,
  Library,
  Share2
} from 'lucide-react';
import { getFreshStarterBotMap, loadBotMapData, saveBotMapData } from '../utils/botMapStorage';
import { ShareSnapshotModal } from '../components/snapshots/ShareSnapshotModal';

export interface BotGroup {
  id: string;
  name: string;
  color: 'blue' | 'cyan' | 'emerald' | 'purple' | 'amber' | 'pink' | 'indigo' | 'rose';
  description?: string;
  isDefault?: boolean;
}

export const DEFAULT_BOT_GROUPS: BotGroup[] = [
  { id: 'grp-meta-ads', name: 'Meta Ads', color: 'blue', description: 'Click-to-Messenger and Instagram keyword auto-responders for ad campaigns', isDefault: true },
  { id: 'grp-lead-gen', name: 'Lead Generation', color: 'cyan', description: 'Story mentions, freebies, lead magnets and subscriber opt-in funnels', isDefault: true },
  { id: 'grp-support', name: 'Customer Support', color: 'emerald', description: '24/7 automated FAQ routing, order lookups, and human live agent escalation', isDefault: true },
  { id: 'grp-ecommerce', name: 'E-Commerce', color: 'purple', description: 'Abandoned checkout recovery, flash sales, promo codes and store surveys', isDefault: true },
  { id: 'grp-webinars', name: 'Webinars & Live', color: 'amber', description: 'Live workshop invites, registration confirmation and broadcast reminders', isDefault: true }
];

export const GROUP_COLOR_CONFIG: Record<string, {
  bg: string;
  border: string;
  text: string;
  dot: string;
  activeBg: string;
  badge: string;
}> = {
  blue: {
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    text: 'text-blue-300',
    dot: 'bg-blue-400',
    activeBg: 'bg-blue-500/25 border-blue-400 text-blue-100 shadow-md shadow-blue-500/20',
    badge: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  },
  cyan: {
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/30',
    text: 'text-cyan-300',
    dot: 'bg-cyan-400',
    activeBg: 'bg-cyan-500/25 border-cyan-400 text-cyan-100 shadow-md shadow-cyan-500/20',
    badge: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
  },
  emerald: {
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    text: 'text-emerald-300',
    dot: 'bg-emerald-400',
    activeBg: 'bg-emerald-500/25 border-emerald-400 text-emerald-100 shadow-md shadow-emerald-500/20',
    badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  },
  purple: {
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/30',
    text: 'text-purple-300',
    dot: 'bg-purple-400',
    activeBg: 'bg-purple-500/25 border-purple-400 text-purple-100 shadow-md shadow-purple-500/20',
    badge: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
  },
  amber: {
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    text: 'text-amber-300',
    dot: 'bg-amber-400',
    activeBg: 'bg-amber-500/25 border-amber-400 text-amber-100 shadow-md shadow-amber-500/20',
    badge: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  },
  pink: {
    bg: 'bg-pink-500/10',
    border: 'border-pink-500/30',
    text: 'text-pink-300',
    dot: 'bg-pink-400',
    activeBg: 'bg-pink-500/25 border-pink-400 text-pink-100 shadow-md shadow-pink-500/20',
    badge: 'bg-pink-500/15 text-pink-300 border-pink-500/30',
  },
  indigo: {
    bg: 'bg-indigo-500/10',
    border: 'border-indigo-500/30',
    text: 'text-indigo-300',
    dot: 'bg-indigo-400',
    activeBg: 'bg-indigo-500/25 border-indigo-400 text-indigo-100 shadow-md shadow-indigo-500/20',
    badge: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
  },
  rose: {
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/30',
    text: 'text-rose-300',
    dot: 'bg-rose-400',
    activeBg: 'bg-rose-500/25 border-rose-400 text-rose-100 shadow-md shadow-rose-500/20',
    badge: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
  }
};

export function getGroupColor(colorName?: string) {
  return GROUP_COLOR_CONFIG[colorName || 'cyan'] || GROUP_COLOR_CONFIG['cyan'];
}

export interface BotMapRecord {
  id: string;
  name: string;
  description: string;
  status: 'live' | 'draft' | 'paused';
  channels: Array<'instagram' | 'messenger' | 'whatsapp' | 'webhook'>;
  nodeCount: number;
  triggerCount: number;
  triggersSummary: string[];
  totalRuns: number;
  optInRate: string;
  lastEdited: string;
  isTemplate?: boolean;
  group?: string;
}

const INITIAL_BOT_MAPS: BotMapRecord[] = [
  {
    id: 'bot-1',
    name: '(Ad) Build-A-Bot Invite',
    group: 'Meta Ads',
    description: 'High-converting Meta Ads Click-to-Messenger and Instagram keyword auto-responder for masterclass signups.',
    status: 'live',
    channels: ['messenger', 'instagram'],
    nodeCount: 8,
    triggerCount: 3,
    triggersSummary: ['Click-to-Messenger Ad', 'IG DM: #START, #BOT', 'Story Mentions'],
    totalRuns: 4280,
    optInRate: '68.4%',
    lastEdited: 'Just now'
  },
  {
    id: 'bot-2',
    name: 'Instagram Story Mention Lead Magnet',
    group: 'Lead Generation',
    description: 'Instantly DMs fans who tag your handle in their Story with a free VIP blueprint and discount code.',
    status: 'live',
    channels: ['instagram'],
    nodeCount: 6,
    triggerCount: 2,
    triggersSummary: ['IG Story Mention', 'DM Keyword: #BLUEPRINT'],
    totalRuns: 2950,
    optInRate: '74.2%',
    lastEdited: '2 hours ago'
  },
  {
    id: 'bot-3',
    name: 'WhatsApp 24/7 Support & FAQ Router',
    group: 'Customer Support',
    description: 'Automated greeting, order tracking lookup, FAQ answers, and human live agent escalation.',
    status: 'live',
    channels: ['whatsapp'],
    nodeCount: 11,
    triggerCount: 2,
    triggersSummary: ['Inbound WhatsApp Message', 'Keywords: HELP, ORDER, TRACK'],
    totalRuns: 6140,
    optInRate: '82.1%',
    lastEdited: '1 day ago'
  },
  {
    id: 'bot-4',
    name: 'VIP Abandoned Cart Recovery & Coupon',
    group: 'E-Commerce',
    description: 'Triggered via Shopify or Webhook when checkout is abandoned. Sends 10% flash discount within 15 minutes.',
    status: 'draft',
    channels: ['messenger', 'whatsapp'],
    nodeCount: 7,
    triggerCount: 1,
    triggersSummary: ['Webhook: checkout.abandoned'],
    totalRuns: 890,
    optInRate: '41.5%',
    lastEdited: '3 days ago'
  },
  {
    id: 'bot-5',
    name: 'Messenger Quiz & Product Recommender',
    group: 'Lead Generation',
    description: 'Interactive 3-question survey leading to personalized product recommendation and direct checkout link.',
    status: 'draft',
    channels: ['messenger'],
    nodeCount: 9,
    triggerCount: 1,
    triggersSummary: ['Messenger Referral: quiz_summer'],
    totalRuns: 512,
    optInRate: '59.0%',
    lastEdited: '5 days ago'
  }
];

interface BotListViewProps {
  onOpenBotMap: (bot: BotMapRecord) => void;
  onNewBotMap: (newBot: BotMapRecord) => void;
  triggerCreateModal?: number;
  onOpenLibrary?: () => void;
  /** Current workspace slug; used for Firestore-backed snapshot exports. */
  workspaceSlug?: string;
}

export function BotListView({ onOpenBotMap, onNewBotMap, triggerCreateModal, onOpenLibrary, workspaceSlug }: BotListViewProps) {
  // Groups State & Persistence
  const [groups, setGroups] = useState<BotGroup[]>(() => {
    try {
      const saved = localStorage.getItem('chatmize_bot_groups');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // fallback
    }
    return DEFAULT_BOT_GROUPS;
  });

  const persistGroups = (list: BotGroup[]) => {
    setGroups(list);
    try {
      localStorage.setItem('chatmize_bot_groups', JSON.stringify(list));
    } catch {
      // storage unavailable
    }
  };

  const [botMaps, setBotMaps] = useState<BotMapRecord[]>(() => {
    const defaultGroupsMap: Record<string, string> = {
      'bot-1': 'Meta Ads',
      'bot-2': 'Lead Generation',
      'bot-3': 'Customer Support',
      'bot-4': 'E-Commerce',
      'bot-5': 'Lead Generation'
    };
    try {
      const saved = localStorage.getItem('chatmize_bot_maps_list');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((b: any) => ({
            ...b,
            group: b.group || defaultGroupsMap[b.id] || 'Lead Generation'
          }));
        }
      }
    } catch {
      // fallback
    }
    return INITIAL_BOT_MAPS;
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [selectedChannel, setSelectedChannel] = useState<'all' | 'instagram' | 'messenger' | 'whatsapp' | 'webhook'>('all');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'live' | 'draft' | 'paused'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'grouped' | 'table'>('grid');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [openGroupMenuBotId, setOpenGroupMenuBotId] = useState<string | null>(null);

  // Group modals
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [showManageGroupsModal, setShowManageGroupsModal] = useState(false);
  const [createGroupName, setCreateGroupName] = useState('');
  const [createGroupColor, setCreateGroupColor] = useState<BotGroup['color']>('blue');
  const [createGroupDesc, setCreateGroupDesc] = useState('');

  // Manage Group edit inline state
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingGroupName, setEditingGroupName] = useState('');
  const [editingGroupColor, setEditingGroupColor] = useState<BotGroup['color']>('cyan');

  // Close dropdown on click outside
  useEffect(() => {
    const handleDocClick = () => {
      setOpenGroupMenuBotId(null);
    };
    window.addEventListener('click', handleDocClick);
    return () => window.removeEventListener('click', handleDocClick);
  }, []);

  useEffect(() => {
    if (triggerCreateModal && triggerCreateModal > 0) {
      setShowCreateModal(true);
    }
  }, [triggerCreateModal]);

  // New Bot Form State
  const [newBotName, setNewBotName] = useState('');
  const [newBotDescription, setNewBotDescription] = useState('');
  const [newBotGroup, setNewBotGroup] = useState<string>('Lead Generation');
  const [newBotChannels, setNewBotChannels] = useState<Array<'instagram' | 'messenger' | 'whatsapp' | 'webhook'>>(['instagram']);
  const [newBotTemplate, setNewBotTemplate] = useState<'blank' | 'lead_gen' | 'support' | 'ecommerce'>('blank');

  // Save to localStorage
  const persistBotMaps = (list: BotMapRecord[]) => {
    setBotMaps(list);
    try {
      localStorage.setItem('chatmize_bot_maps_list', JSON.stringify(list));
    } catch {
      // storage unavailable
    }
  };

  // Move bot to group
  const handleMoveBotToGroup = (botId: string, groupName: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const updated = botMaps.map(b => {
      if (b.id === botId) {
        return { ...b, group: groupName, lastEdited: 'Just now' };
      }
      return b;
    });
    persistBotMaps(updated);
    setOpenGroupMenuBotId(null);
  };

  // Create Group Submit
  const handleCreateGroupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!createGroupName.trim()) return;
    const newGroup: BotGroup = {
      id: `grp-${Date.now()}`,
      name: createGroupName.trim(),
      color: createGroupColor,
      description: createGroupDesc.trim() || undefined
    };
    const updated = [...groups, newGroup];
    persistGroups(updated);
    setCreateGroupName('');
    setCreateGroupDesc('');
    setCreateGroupColor('blue');
    setShowCreateGroupModal(false);
  };

  // Delete Group
  const handleDeleteGroup = (groupId: string, groupName: string) => {
    if (confirm(`Are you sure you want to delete the "${groupName}" group? Any bot maps currently in this group will be moved to "Unassigned".`)) {
      const updatedGroups = groups.filter(g => g.id !== groupId);
      persistGroups(updatedGroups);
      // Reassign affected bots
      const updatedBots = botMaps.map(b => {
        if (b.group === groupName) {
          return { ...b, group: 'Unassigned', lastEdited: 'Just now' };
        }
        return b;
      });
      persistBotMaps(updatedBots);
      if (selectedGroup === groupName) {
        setSelectedGroup('all');
      }
    }
  };

  // Save Group Rename / Edit
  const handleSaveGroupEdit = (groupId: string) => {
    const targetGroup = groups.find(g => g.id === groupId);
    if (!targetGroup || !editingGroupName.trim()) {
      setEditingGroupId(null);
      return;
    }
    const oldName = targetGroup.name;
    const newName = editingGroupName.trim();

    const updatedGroups = groups.map(g => {
      if (g.id === groupId) {
        return { ...g, name: newName, color: editingGroupColor };
      }
      return g;
    });
    persistGroups(updatedGroups);

    // If name changed, update all bots that used this group name
    if (oldName !== newName) {
      const updatedBots = botMaps.map(b => {
        if (b.group === oldName) {
          return { ...b, group: newName };
        }
        return b;
      });
      persistBotMaps(updatedBots);
      if (selectedGroup === oldName) {
        setSelectedGroup(newName);
      }
    }
    setEditingGroupId(null);
  };

  // Toggle Collapse Group in Grouped View
  const toggleCollapseGroup = (groupName: string) => {
    setCollapsedGroups(prev => ({
      ...prev,
      [groupName]: !prev[groupName]
    }));
  };

  // Toggle status
  const handleToggleStatus = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = botMaps.map(b => {
      if (b.id === id) {
        const nextStatus: 'live' | 'draft' = b.status === 'live' ? 'draft' : 'live';
        return { ...b, status: nextStatus, lastEdited: 'Just now' };
      }
      return b;
    });
    persistBotMaps(updated);
  };

  // Duplicate
  const handleDuplicate = (bot: BotMapRecord, e: React.MouseEvent) => {
    e.stopPropagation();
    const newId = `bot-${Date.now()}`;
    const duplicated: BotMapRecord = {
      ...bot,
      id: newId,
      name: `${bot.name} (Copy)`,
      group: bot.group || 'Lead Generation',
      status: 'draft',
      totalRuns: 0,
      lastEdited: 'Just now'
    };

    // Copy canvas data into the new slot
    const sourceData = loadBotMapData(bot.id, bot.name);
    saveBotMapData(newId, {
      nodes: sourceData.nodes,
      connections: sourceData.connections,
      isLive: false,
      flowTitle: duplicated.name
    });

    const updated = [duplicated, ...botMaps];
    persistBotMaps(updated);
  };

  // Delete
  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this Bot Map?')) {
      const updated = botMaps.filter(b => b.id !== id);
      persistBotMaps(updated);
    }
  };

  // Create Submit
  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBotName.trim()) return;

    let nodeCount = 2;
    let triggerCount = 1;
    let triggersSummary = ['Inbound Trigger'];

    if (newBotTemplate === 'lead_gen') {
      nodeCount = 3;
      triggerCount = 2;
      triggersSummary = ['IG Story Mention', 'Keyword: #LEAD'];
    } else if (newBotTemplate === 'support') {
      nodeCount = 3;
      triggerCount = 1;
      triggersSummary = ['WhatsApp Inbound', 'AI Assistant'];
    } else if (newBotTemplate === 'ecommerce') {
      nodeCount = 2;
      triggerCount = 1;
      triggersSummary = ['Cart Abandoned Webhook'];
    }

    const newBotId = `bot-${Date.now()}`;
    const channels = newBotChannels.length > 0 ? newBotChannels : ['instagram'];

    // Generate brand new, clean starter canvas specific to this new bot (never opening existing bot map)
    const freshStarter = getFreshStarterBotMap(
      newBotId,
      newBotName.trim(),
      newBotTemplate,
      channels
    );

    // Save newly created canvas into its unique storage
    saveBotMapData(newBotId, {
      nodes: freshStarter.nodes,
      connections: freshStarter.connections,
      isLive: false,
      flowTitle: newBotName.trim()
    });

    const created: BotMapRecord = {
      id: newBotId,
      name: newBotName.trim(),
      group: newBotGroup.trim() || 'Lead Generation',
      description: newBotDescription.trim() || 'Custom visual automation bot map.',
      status: 'draft',
      channels,
      nodeCount,
      triggerCount,
      triggersSummary,
      totalRuns: 0,
      optInRate: '0%',
      lastEdited: 'Just now'
    };

    const updated = [created, ...botMaps];
    persistBotMaps(updated);
    setShowCreateModal(false);
    setNewBotName('');
    setNewBotDescription('');
    setNewBotChannels(['instagram']);
    setNewBotTemplate('blank');

    // Launch directly into builder with this brand new bot
    onNewBotMap(created);
  };

  // Filtered List
  const filteredBots = useMemo(() => {
    return botMaps.filter(b => {
      if (selectedStatus !== 'all' && b.status !== selectedStatus) return false;
      if (selectedChannel !== 'all' && !b.channels.includes(selectedChannel)) return false;
      if (selectedGroup !== 'all' && (b.group || 'Unassigned') !== selectedGroup) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = b.name.toLowerCase().includes(q);
        const matchesDesc = b.description.toLowerCase().includes(q);
        const matchesTrig = b.triggersSummary.some(t => t.toLowerCase().includes(q));
        const matchesGroup = (b.group || 'Unassigned').toLowerCase().includes(q);
        if (!matchesName && !matchesDesc && !matchesTrig && !matchesGroup) return false;
      }
      return true;
    });
  }, [botMaps, selectedStatus, selectedChannel, selectedGroup, searchQuery]);

  const totalBots = botMaps.length;
  const liveBots = botMaps.filter(b => b.status === 'live').length;
  const draftBots = botMaps.filter(b => b.status === 'draft').length;
  const totalRunsSum = botMaps.reduce((acc, curr) => acc + curr.totalRuns, 0);

  const unassignedCount = useMemo(() => {
    return botMaps.filter(b => !b.group || b.group === 'Unassigned').length;
  }, [botMaps]);

  return (
    <div className="flex-1 w-full flex flex-col gap-6 max-w-7xl mx-auto pb-12">
      
      {/* Top Header & Quick Stats */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900/90 via-slate-900/70 to-blue-950/40 border border-white/10 rounded-3xl p-6 backdrop-blur-xl shadow-xl">
        <div>
          <div className="flex items-center gap-3 mb-1.5">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-inner">
              <Workflow className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
                Bot List & Bot Maps
                <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  {totalBots} Total
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-400">
                All visual automated Bot Maps connected to Instagram, Messenger, WhatsApp & Webhooks.
              </p>
            </div>
          </div>
        </div>

        {/* Primary Action Button */}
        <div className="flex items-center gap-2.5">
          {onOpenLibrary && (
            <button
              onClick={onOpenLibrary}
              title="Browse the snapshot template library"
              className="px-4 py-2.5 bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-purple-200 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer"
            >
              <Library className="w-4 h-4" />
              <span className="hidden sm:inline">Library</span>
            </button>
          )}
          <button
            onClick={() => setShowShareModal(true)}
            title="Share this workspace setup as a snapshot link"
            className="px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer"
          >
            <Share2 className="w-4 h-4" />
            <span className="hidden sm:inline">Share</span>
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 shadow-lg shadow-cyan-500/20 transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            <span>New Bot Map</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-2xl bg-slate-900/70 border border-white/10 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Total Bot Maps</span>
            <div className="text-xl font-black text-white mt-0.5">{totalBots}</div>
          </div>
          <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center border border-blue-500/20">
            <Bot className="w-4 h-4" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/70 border border-white/10 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">Live & Active</span>
            <div className="text-xl font-black text-emerald-300 mt-0.5">{liveBots}</div>
          </div>
          <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
            <Radio className="w-4 h-4 animate-pulse" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/70 border border-white/10 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider">Draft / Editing</span>
            <div className="text-xl font-black text-amber-300 mt-0.5">{draftBots}</div>
          </div>
          <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20">
            <Clock className="w-4 h-4" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/70 border border-white/10 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-purple-400 uppercase tracking-wider">Bot Groups</span>
            <div className="text-xl font-black text-purple-300 mt-0.5">{groups.length}</div>
          </div>
          <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center border border-purple-500/20">
            <Folder className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Bot Groups Filter Bar */}
      <div className="bg-slate-900/80 border border-white/10 rounded-2xl p-4 shadow-md space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-white/5">
          <div className="flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-cyan-400" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">Bot Groups & Categories</h2>
            <span className="text-[10px] text-slate-500 hidden sm:inline">• Organize and quickly filter your automation funnels</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCreateGroupModal(true)}
              className="px-2.5 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/20 text-[11px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <FolderPlus className="w-3.5 h-3.5" />
              <span>New Group</span>
            </button>
            <button
              onClick={() => setShowManageGroupsModal(true)}
              className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 text-[11px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Sliders className="w-3.5 h-3.5 text-slate-400" />
              <span>Manage</span>
            </button>
          </div>
        </div>

        {/* Groups Pills List */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            onClick={() => setSelectedGroup('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer border ${
              selectedGroup === 'all'
                ? 'bg-white/15 text-white border-white/30 shadow-md shadow-white/5'
                : 'bg-slate-950/60 text-slate-400 border-white/5 hover:border-white/15 hover:text-slate-200'
            }`}
          >
            <span>All Bot Maps</span>
            <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono ${
              selectedGroup === 'all' ? 'bg-white/20 text-white' : 'bg-white/5 text-slate-400'
            }`}>
              {totalBots}
            </span>
          </button>

          {groups.map(grp => {
            const count = botMaps.filter(b => (b.group || 'Unassigned') === grp.name).length;
            const colorCfg = getGroupColor(grp.color);
            const isSelected = selectedGroup === grp.name;
            return (
              <button
                key={grp.id}
                onClick={() => setSelectedGroup(isSelected ? 'all' : grp.name)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer border ${
                  isSelected
                    ? colorCfg.activeBg
                    : `${colorCfg.bg} ${colorCfg.text} ${colorCfg.border} hover:brightness-125`
                }`}
                title={grp.description || grp.name}
              >
                <span className={`w-2 h-2 rounded-full ${colorCfg.dot}`} />
                <span>{grp.name}</span>
                <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono bg-black/20 ${
                  isSelected ? 'text-white' : 'opacity-80'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}

          {unassignedCount > 0 && (
            <button
              onClick={() => setSelectedGroup(selectedGroup === 'Unassigned' ? 'all' : 'Unassigned')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer border ${
                selectedGroup === 'Unassigned'
                  ? 'bg-slate-700/60 text-white border-slate-500'
                  : 'bg-slate-950/60 text-slate-400 border-white/5 hover:border-white/15 hover:text-slate-200'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-slate-500" />
              <span>Unassigned</span>
              <span className="px-1.5 py-0.2 rounded-md text-[10px] font-mono bg-white/5 text-slate-400">
                {unassignedCount}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search Controls */}
      <div className="bg-slate-900/80 border border-white/10 rounded-2xl p-3.5 sm:p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shadow-md">
        
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by title, keyword, trigger, or group..."
            className="w-full bg-slate-950/80 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 transition-colors"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white text-xs"
            >
              Clear
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-2">
          
          {/* Status Select */}
          <div className="flex items-center bg-slate-950/80 border border-white/10 rounded-xl p-1 text-xs">
            {(['all', 'live', 'draft'] as const).map(status => (
              <button
                key={status}
                onClick={() => setSelectedStatus(status)}
                className={`px-2.5 py-1 rounded-lg capitalize font-medium transition-colors cursor-pointer ${
                  selectedStatus === status 
                    ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {status}
              </button>
            ))}
          </div>

          {/* Channel Select */}
          <div className="flex items-center bg-slate-950/80 border border-white/10 rounded-xl p-1 text-xs">
            {(['all', 'instagram', 'whatsapp', 'messenger'] as const).map(channel => (
              <button
                key={channel}
                onClick={() => setSelectedChannel(channel)}
                className={`px-2.5 py-1 rounded-lg capitalize font-medium transition-colors cursor-pointer ${
                  selectedChannel === channel 
                    ? 'bg-blue-500/20 text-blue-300 font-bold border border-blue-500/30' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {channel === 'all' ? 'All Channels' : channel}
              </button>
            ))}
          </div>

          {/* View Mode Toggle: Grid, Grouped Folders, Table */}
          <div className="flex items-center bg-slate-950/80 border border-white/10 rounded-xl p-1 text-xs ml-auto">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                viewMode === 'grid' ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'
              }`}
              title="Grid View"
            >
              <Grid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('grouped')}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1 ${
                viewMode === 'grouped' ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'
              }`}
              title="Grouped Folders View"
            >
              <Folder className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                viewMode === 'table' ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'
              }`}
              title="Table View"
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>

        </div>
      </div>

      {/* Bot Maps Listing */}
      {(() => {
        // Group Badge & Quick Move Dropdown Menu
        const renderGroupBadgeAndMenu = (bot: BotMapRecord) => {
          const currentGroupObj = groups.find(g => g.name === (bot.group || 'Unassigned'));
          const colorCfg = getGroupColor(currentGroupObj?.color);
          const isOpen = openGroupMenuBotId === bot.id;

          return (
            <div className="relative inline-block" onClick={e => e.stopPropagation()}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenGroupMenuBotId(isOpen ? null : bot.id);
                }}
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${colorCfg.badge} hover:brightness-125`}
                title="Click to change group folder"
              >
                <span className={`w-1.5 h-1.5 rounded-full ${colorCfg.dot}`} />
                <span className="truncate max-w-[110px]">{bot.group || 'Unassigned'}</span>
                <ChevronDown className="w-2.5 h-2.5 opacity-60 ml-0.5" />
              </button>

              {isOpen && (
                <div 
                  className="absolute left-0 top-full mt-1.5 z-40 w-48 bg-slate-900 border border-white/15 rounded-xl shadow-2xl p-1.5 animate-in fade-in zoom-in-95 duration-150 backdrop-blur-xl"
                  onClick={e => e.stopPropagation()}
                >
                  <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-white/10 mb-1 flex items-center justify-between">
                    <span>Move to Group</span>
                    <Tag className="w-3 h-3 text-slate-500" />
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-0.5">
                    {groups.map(grp => {
                      const grpColor = getGroupColor(grp.color);
                      const isCurrent = (bot.group || 'Unassigned') === grp.name;
                      return (
                        <button
                          key={grp.id}
                          type="button"
                          onClick={(e) => handleMoveBotToGroup(bot.id, grp.name, e)}
                          className={`w-full text-left px-2 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between transition-colors cursor-pointer ${
                            isCurrent 
                              ? 'bg-white/10 text-white font-bold' 
                              : 'text-slate-300 hover:bg-white/5 hover:text-white'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${grpColor.dot}`} />
                            <span className="truncate">{grp.name}</span>
                          </div>
                          {isCurrent && <Check className="w-3 h-3 text-cyan-400 flex-shrink-0" />}
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={(e) => handleMoveBotToGroup(bot.id, 'Unassigned', e)}
                      className={`w-full text-left px-2 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between transition-colors cursor-pointer ${
                        bot.group === 'Unassigned' 
                          ? 'bg-white/10 text-white font-bold' 
                          : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="w-2 h-2 rounded-full bg-slate-500 flex-shrink-0" />
                        <span className="truncate">Unassigned</span>
                      </div>
                      {bot.group === 'Unassigned' && <Check className="w-3 h-3 text-cyan-400 flex-shrink-0" />}
                    </button>
                  </div>
                  <div className="pt-1 mt-1 border-t border-white/10">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenGroupMenuBotId(null);
                        setShowCreateGroupModal(true);
                      }}
                      className="w-full text-left px-2 py-1 rounded-lg text-[11px] text-cyan-400 hover:bg-cyan-500/10 font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <FolderPlus className="w-3 h-3" />
                      <span>+ New Group...</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        };

        // Shared Clean Bot Card View
        const renderBotCard = (bot: BotMapRecord) => {
          return (
            <div 
              key={bot.id}
              onClick={() => onOpenBotMap(bot)}
              className="group bg-slate-900/80 hover:bg-slate-900 border border-white/10 hover:border-cyan-500/40 rounded-2xl p-4.5 flex flex-col justify-between transition-all duration-200 cursor-pointer shadow-md hover:shadow-cyan-500/10 hover:-translate-y-0.5 relative overflow-hidden gap-3.5"
            >
              {/* Subtle top accent highlight glow */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

              {/* Main Content */}
              <div className="space-y-3">
                {/* Header: Group Pill + Status Toggle */}
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    {renderGroupBadgeAndMenu(bot)}
                  </div>

                  <button
                    type="button"
                    onClick={(e) => handleToggleStatus(bot.id, e)}
                    className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase transition-all cursor-pointer flex-shrink-0 ${
                      bot.status === 'live'
                        ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25 shadow-sm shadow-emerald-500/10'
                        : 'bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25'
                    }`}
                    title={`Click to switch to ${bot.status === 'live' ? 'Draft' : 'Live'}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${bot.status === 'live' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                    <span>{bot.status}</span>
                  </button>
                </div>

                {/* Title & Description */}
                <div>
                  <h3 className="font-bold text-base text-white group-hover:text-cyan-300 transition-colors line-clamp-1 leading-snug">
                    {bot.name}
                  </h3>
                  <p className="text-xs text-slate-400 line-clamp-1 leading-relaxed mt-0.5">
                    {bot.description || 'Automated multi-step conversational sequence.'}
                  </p>
                </div>

                {/* Channels & Steps Row */}
                <div className="flex items-center justify-between gap-2 pt-0.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {bot.channels.map(ch => (
                      <span 
                        key={ch}
                        className="px-2 py-0.5 rounded-md bg-slate-800/80 text-slate-300 border border-white/10 text-[10px] font-semibold capitalize flex items-center gap-1.5"
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          ch === 'instagram' ? 'bg-pink-500' :
                          ch === 'whatsapp' ? 'bg-emerald-500' :
                          ch === 'messenger' ? 'bg-blue-500' : 'bg-purple-500'
                        }`} />
                        <span>{ch}</span>
                      </span>
                    ))}
                  </div>

                  <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1 flex-shrink-0">
                    <Layers className="w-3 h-3 text-slate-500" />
                    <span>{bot.nodeCount} {bot.nodeCount === 1 ? 'Step' : 'Steps'}</span>
                  </span>
                </div>

                {/* Triggers: Compact inline row */}
                <div className="flex items-center gap-1.5 text-xs text-slate-400 min-w-0 pt-0.5">
                  <Zap className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
                  <div className="flex items-center gap-1 overflow-hidden truncate">
                    {bot.triggersSummary.length > 0 ? (
                      bot.triggersSummary.map((trig, idx) => (
                        <span 
                          key={idx} 
                          className="text-[10px] font-medium bg-white/5 border border-white/10 text-slate-300 px-1.5 py-0.5 rounded truncate max-w-[130px]"
                          title={trig}
                        >
                          {trig}
                        </span>
                      ))
                    ) : (
                      <span className="text-[11px] text-slate-500 italic">No triggers</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Bottom Section: Metrics Strip & Actions */}
              <div className="space-y-2.5 pt-1">
                {/* Metric Strip (2-column grid so numbers never wrap) */}
                <div className="grid grid-cols-2 gap-2 py-1.5 px-3 bg-slate-950/60 border border-white/5 rounded-xl text-xs font-mono">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-sans text-slate-500 uppercase tracking-wider font-semibold">Runs:</span>
                    <strong className="text-white font-semibold">{bot.totalRuns.toLocaleString()}</strong>
                  </div>
                  <div className="flex items-center justify-end gap-1.5">
                    <span className="text-[10px] font-sans text-slate-500 uppercase tracking-wider font-semibold">Opt-In:</span>
                    <strong className="text-cyan-400 font-semibold">{bot.optInRate}</strong>
                  </div>
                </div>

                {/* Card Action Controls */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={(e) => handleDuplicate(bot, e)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                      title="Duplicate Bot Map"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleDelete(bot.id, e)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-white/10 transition-colors cursor-pointer"
                      title="Delete Bot Map"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => onOpenBotMap(bot)}
                    className="px-3.5 py-1.5 bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all group-hover:border-cyan-400 cursor-pointer shadow-sm"
                  >
                    <span>Open Map</span>
                    <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                </div>
              </div>
            </div>
          );
        };

        if (filteredBots.length === 0) {
          return (
            <div className="bg-slate-900/40 border border-white/10 border-dashed rounded-3xl p-12 text-center flex flex-col items-center justify-center">
              <div className="w-14 h-14 rounded-2xl bg-slate-800/80 border border-white/10 flex items-center justify-center text-slate-400 mb-3">
                <Workflow className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-white mb-1">No Bot Maps match your filters</h3>
              <p className="text-xs text-slate-400 max-w-sm mb-4">
                Try adjusting your search terms, group folders, or channel filters, or create a brand new Bot Map from scratch.
              </p>
              <button
                onClick={() => { setSearchQuery(''); setSelectedChannel('all'); setSelectedStatus('all'); setSelectedGroup('all'); }}
                className="px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-slate-300 border border-white/10 transition-colors"
              >
                Reset Filters
              </button>
            </div>
          );
        }

        // 1. Grid View
        if (viewMode === 'grid') {
          return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredBots.map((bot) => renderBotCard(bot))}
            </div>
          );
        }

        // 2. Grouped Folders View
        if (viewMode === 'grouped') {
          // Determine the list of group containers to show
          const groupsToShow: Array<{ id: string; name: string; color: string; description?: string }> = [];
          
          if (selectedGroup !== 'all') {
            const grp = groups.find(g => g.name === selectedGroup);
            if (grp) {
              groupsToShow.push(grp);
            } else if (selectedGroup === 'Unassigned') {
              groupsToShow.push({ id: 'grp-unassigned', name: 'Unassigned', color: 'cyan', description: 'Bot maps not yet organized into a specific group' });
            }
          } else {
            groupsToShow.push(...groups);
            if (unassignedCount > 0) {
              groupsToShow.push({ id: 'grp-unassigned', name: 'Unassigned', color: 'cyan', description: 'Bot maps not yet organized into a specific group' });
            }
          }

          return (
            <div className="space-y-6">
              {groupsToShow.map((grp) => {
                const colorCfg = getGroupColor(grp.color);
                const isCollapsed = collapsedGroups[grp.name];
                const botsInGroup = filteredBots.filter(b => (b.group || 'Unassigned') === grp.name);
                const allBotsInThisGroupCount = botMaps.filter(b => (b.group || 'Unassigned') === grp.name).length;
                const liveCount = botsInGroup.filter(b => b.status === 'live').length;

                return (
                  <div 
                    key={grp.id}
                    className="bg-slate-900/60 border border-white/10 rounded-3xl overflow-hidden shadow-lg transition-all"
                  >
                    {/* Group Header Banner */}
                    <div 
                      onClick={() => toggleCollapseGroup(grp.name)}
                      className={`p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer select-none transition-colors border-b ${
                        isCollapsed ? 'border-transparent hover:bg-white/5' : 'border-white/10 bg-slate-950/40'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center border ${colorCfg.badge} flex-shrink-0`}>
                          <Folder className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-base font-bold text-white flex items-center gap-2">
                              <span>{grp.name}</span>
                              <span className={`w-2 h-2 rounded-full ${colorCfg.dot}`} />
                            </h3>
                            <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-slate-300">
                              {botsInGroup.length} {botsInGroup.length === 1 ? 'Bot Map' : 'Bot Maps'}
                            </span>
                            {liveCount > 0 && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                {liveCount} Live
                              </span>
                            )}
                          </div>
                          {grp.description && (
                            <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{grp.description}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center" onClick={e => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setNewBotGroup(grp.name);
                            setShowCreateModal(true);
                          }}
                          className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 border border-white/10 transition-colors cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add to Group</span>
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleCollapseGroup(grp.name);
                          }}
                          className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                          title={isCollapsed ? 'Expand group' : 'Collapse group'}
                        >
                          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Group Content Body */}
                    {!isCollapsed && (
                      <div className="p-4 sm:p-5">
                        {botsInGroup.length === 0 ? (
                          <div className="p-8 border border-dashed border-white/10 rounded-2xl text-center bg-slate-950/20">
                            <p className="text-xs text-slate-400 mb-2">
                              {allBotsInThisGroupCount === 0 
                                ? `No bot maps in this group yet.` 
                                : `No bot maps in this group match your active filters.`}
                            </p>
                            <button
                              type="button"
                              onClick={() => {
                                setNewBotGroup(grp.name);
                                setShowCreateModal(true);
                              }}
                              className="px-3 py-1.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/20 text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Create First Bot Map in {grp.name}</span>
                            </button>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {botsInGroup.map(bot => renderBotCard(bot))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        }

        // 3. Table View
        return (
          <div className="bg-slate-900/80 border border-white/10 rounded-3xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/80 border-b border-white/10 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3.5 px-4">Bot Map Name</th>
                    <th className="py-3.5 px-4">Group</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Channels</th>
                    <th className="py-3.5 px-4">Triggers</th>
                    <th className="py-3.5 px-4">Steps</th>
                    <th className="py-3.5 px-4">Executions</th>
                    <th className="py-3.5 px-4">Opt-In</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredBots.map((bot) => (
                    <tr 
                      key={bot.id}
                      onClick={() => onOpenBotMap(bot)}
                      className="hover:bg-white/5 transition-colors cursor-pointer group"
                    >
                      <td className="py-3 px-4 font-bold text-white group-hover:text-cyan-300">
                        <div className="flex items-center gap-2">
                          <Workflow className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                          <span className="truncate max-w-[200px]">{bot.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {renderGroupBadgeAndMenu(bot)}
                      </td>
                      <td className="py-3 px-4">
                        <button
                          onClick={(e) => handleToggleStatus(bot.id, e)}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            bot.status === 'live'
                              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                              : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${bot.status === 'live' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                          <span>{bot.status}</span>
                        </button>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1">
                          {bot.channels.map(ch => (
                            <span key={ch} className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-slate-300 capitalize border border-white/10">
                              {ch}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-300">
                        {bot.triggerCount} Triggers
                      </td>
                      <td className="py-3 px-4 text-slate-300">
                        {bot.nodeCount}
                      </td>
                      <td className="py-3 px-4 font-mono text-white">
                        {bot.totalRuns.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 font-mono text-cyan-400 font-bold">
                        {bot.optInRate}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={(e) => handleDuplicate(bot, e)}
                            className="p-1 rounded text-slate-400 hover:text-white"
                            title="Duplicate"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => handleDelete(bot.id, e)}
                            className="p-1 rounded text-slate-400 hover:text-red-400"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onOpenBotMap(bot)}
                            className="px-2.5 py-1 bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 border border-cyan-500/30 rounded-lg text-xs font-bold inline-flex items-center gap-1"
                          >
                            Open Map
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* Modal: Create New Bot Map */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/15 rounded-3xl max-w-lg w-full p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center border border-cyan-500/30">
                  <Workflow className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Create New Bot Map</h3>
                  <p className="text-xs text-slate-400">Design a new automated multi-step chatbot sequence</p>
                </div>
              </div>
              <button 
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Bot Map Name *
                </label>
                <input data-no-emoji 
                  type="text"
                  required
                  value={newBotName}
                  onChange={(e) => setNewBotName(e.target.value)}
                  placeholder="e.g., Summer Giveaway DM Auto-Responder"
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              {/* Group Selection */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-300">
                    Bot Group / Folder
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowCreateGroupModal(true)}
                    className="text-[11px] text-cyan-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <FolderPlus className="w-3 h-3" />
                    <span>+ New Group</span>
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {groups.map(grp => {
                    const isSelected = newBotGroup === grp.name;
                    const colorCfg = getGroupColor(grp.color);
                    return (
                      <button
                        type="button"
                        key={grp.id}
                        onClick={() => setNewBotGroup(grp.name)}
                        className={`p-2 rounded-xl border text-xs font-semibold flex items-center gap-2 cursor-pointer transition-colors ${
                          isSelected
                            ? `${colorCfg.badge} border-cyan-400 font-bold shadow-sm`
                            : 'bg-slate-950 border-white/10 text-slate-400 hover:text-white'
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${colorCfg.dot}`} />
                        <span className="truncate">{grp.name}</span>
                        {isSelected && <Check className="w-3 h-3 text-cyan-400 ml-auto" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Description / Objective
                </label>
                <textarea 
                  rows={2}
                  value={newBotDescription}
                  onChange={(e) => setNewBotDescription(e.target.value)}
                  placeholder="What is the goal of this bot map? (e.g., collect email, qualify leads, give coupon)"
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Target Channels
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(['instagram', 'messenger', 'whatsapp', 'webhook'] as const).map(ch => {
                    const isSelected = newBotChannels.includes(ch);
                    return (
                      <button
                        type="button"
                        key={ch}
                        onClick={() => {
                          if (isSelected) {
                            if (newBotChannels.length > 1) {
                              setNewBotChannels(newBotChannels.filter(c => c !== ch));
                            }
                          } else {
                            setNewBotChannels([...newBotChannels, ch]);
                          }
                        }}
                        className={`p-2 rounded-xl border text-xs font-semibold capitalize flex items-center justify-between cursor-pointer transition-colors ${
                          isSelected 
                            ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300' 
                            : 'bg-slate-950 border-white/10 text-slate-400 hover:text-white'
                        }`}
                      >
                        <span>{ch}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Starting Template
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'blank', title: 'Blank Canvas', desc: 'Start with an empty starting trigger step' },
                    { id: 'lead_gen', title: 'Story Lead Magnet', desc: 'Story mention + DM email opt-in' },
                    { id: 'support', title: '24/7 Support Bot', desc: 'FAQ menu + live agent handoff' },
                    { id: 'ecommerce', title: 'Cart Recovery', desc: 'Abandoned cart coupon sequence' }
                  ].map(tmpl => (
                    <div
                      key={tmpl.id}
                      onClick={() => setNewBotTemplate(tmpl.id as any)}
                      className={`p-2.5 rounded-xl border cursor-pointer transition-all ${
                        newBotTemplate === tmpl.id
                          ? 'bg-blue-600/20 border-blue-500 text-white'
                          : 'bg-slate-950/60 border-white/10 text-slate-400 hover:border-white/20'
                      }`}
                    >
                      <div className="text-xs font-bold text-white mb-0.5">{tmpl.title}</div>
                      <div className="text-[10px] text-slate-400 leading-tight">{tmpl.desc}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-bold shadow-md shadow-cyan-500/20 cursor-pointer"
                >
                  Create & Launch Builder
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Modal: Create New Group */}
      {showCreateGroupModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/15 rounded-3xl max-w-md w-full p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center border border-cyan-500/30">
                  <FolderPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">New Bot Group</h3>
                  <p className="text-xs text-slate-400">Categorize bot maps for quick retrieval</p>
                </div>
              </div>
              <button 
                onClick={() => setShowCreateGroupModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateGroupSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Group Name *
                </label>
                <input data-no-emoji 
                  type="text"
                  required
                  value={createGroupName}
                  onChange={(e) => setCreateGroupName(e.target.value)}
                  placeholder="e.g., Black Friday 2026, VIP Onboarding"
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Folder Theme Color
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(['blue', 'cyan', 'emerald', 'purple', 'amber', 'pink', 'indigo', 'rose'] as const).map(c => {
                    const isSelected = createGroupColor === c;
                    const cfg = GROUP_COLOR_CONFIG[c];
                    return (
                      <button
                        type="button"
                        key={c}
                        onClick={() => setCreateGroupColor(c)}
                        className={`p-2 rounded-xl border text-xs font-bold capitalize flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                          isSelected ? `${cfg.badge} border-white/40 ring-2 ring-white/20` : `${cfg.bg} ${cfg.text} ${cfg.border} hover:brightness-125`
                        }`}
                      >
                        <span className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`} />
                        <span>{c}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Description / Purpose (Optional)
                </label>
                <input 
                  type="text"
                  value={createGroupDesc}
                  onChange={(e) => setCreateGroupDesc(e.target.value)}
                  placeholder="e.g., Seasonal campaign flows and promotional DMs"
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowCreateGroupModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-bold shadow-md shadow-cyan-500/20 cursor-pointer"
                >
                  Create Group
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Manage Groups */}
      {showManageGroupsModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/15 rounded-3xl max-w-xl w-full p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center border border-purple-500/30">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Manage Bot Groups</h3>
                  <p className="text-xs text-slate-400">Rename, recolor, or delete existing groups</p>
                </div>
              </div>
              <button 
                onClick={() => {
                  setEditingGroupId(null);
                  setShowManageGroupsModal(false);
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5 mb-5">
              {groups.map((grp) => {
                const isEditing = editingGroupId === grp.id;
                const colorCfg = getGroupColor(grp.color);
                const count = botMaps.filter(b => (b.group || 'Unassigned') === grp.name).length;

                if (isEditing) {
                  return (
                    <div key={grp.id} className="p-3 rounded-2xl bg-slate-950 border border-cyan-500/40 space-y-3">
                      <div className="flex items-center gap-2">
                        <input data-no-emoji
                          type="text"
                          value={editingGroupName}
                          onChange={(e) => setEditingGroupName(e.target.value)}
                          className="flex-1 bg-slate-900 border border-white/15 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-400"
                        />
                        <button
                          onClick={() => handleSaveGroupEdit(grp.id)}
                          className="px-3 py-1.5 rounded-xl bg-cyan-500 text-white text-xs font-bold hover:bg-cyan-400 cursor-pointer"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingGroupId(null)}
                          className="px-2.5 py-1.5 rounded-xl bg-white/5 text-slate-400 hover:text-white text-xs"
                        >
                          Cancel
                        </button>
                      </div>
                      <div className="grid grid-cols-4 gap-1.5">
                        {(['blue', 'cyan', 'emerald', 'purple', 'amber', 'pink', 'indigo', 'rose'] as const).map(c => (
                          <button
                            type="button"
                            key={c}
                            onClick={() => setEditingGroupColor(c)}
                            className={`px-2 py-1 rounded-lg text-[10px] font-bold capitalize flex items-center justify-center gap-1 cursor-pointer ${
                              editingGroupColor === c ? 'bg-white/20 text-white border border-white/30' : 'bg-slate-900 text-slate-400 hover:text-white'
                            }`}
                          >
                            <span className={`w-2 h-2 rounded-full ${GROUP_COLOR_CONFIG[c].dot}`} />
                            <span>{c}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                }

                return (
                  <div 
                    key={grp.id}
                    className="p-3 rounded-2xl bg-slate-950/60 border border-white/10 flex items-center justify-between gap-3 hover:border-white/20 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center border ${colorCfg.badge} flex-shrink-0`}>
                        <Folder className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-white truncate">{grp.name}</span>
                          <span className={`w-2 h-2 rounded-full ${colorCfg.dot}`} />
                        </div>
                        <span className="text-[10px] text-slate-400">
                          {count} {count === 1 ? 'bot map' : 'bot maps'} attached
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          setEditingGroupId(grp.id);
                          setEditingGroupName(grp.name);
                          setEditingGroupColor(grp.color);
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                        title="Edit group"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteGroup(grp.id, grp.name)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-white/5 transition-colors cursor-pointer"
                        title="Delete group"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => {
                  setShowManageGroupsModal(false);
                  setShowCreateGroupModal(true);
                }}
                className="px-3.5 py-2 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/20 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <FolderPlus className="w-3.5 h-3.5" />
                <span>Add Another Group</span>
              </button>

              <button
                type="button"
                onClick={() => setShowManageGroupsModal(false)}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Share Workspace Snapshot */}
      {showShareModal && <ShareSnapshotModal onClose={() => setShowShareModal(false)} workspaceSlug={workspaceSlug} />}

    </div>
  );
}
