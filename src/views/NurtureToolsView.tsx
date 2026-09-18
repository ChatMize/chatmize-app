import React, { useState, useEffect } from 'react';
import { EmojiPickerButton, useEmojiTarget } from '../components/emoji';
import { 
  Sparkles, 
  MessageSquare, 
  Layout, 
  Layers, 
  Maximize2, 
  Code, 
  Plus, 
  Edit3, 
  Trash2, 
  Copy, 
  Check, 
  Eye, 
  Zap, 
  Globe, 
  ExternalLink,
  Settings, 
  Sliders, 
  Workflow, 
  TrendingUp, 
  Users, 
  Share2,
  X,
  Palette,
  MousePointer,
  Clock,
  ArrowRight,
  ShieldCheck,
  ChevronRight,
  Search,
  Monitor,
  Smartphone,
  HelpCircle,
  FileCode,
  CheckCircle,
  CheckCircle2,
  FolderOpen,
  Filter,
  Shield,
  Crown,
  Award,
  Lock,
  Unlock,
  PackageCheck,
  ChevronDown,
  Info,
  ArrowUpRight,
  RefreshCw,
  Box,
  SlidersHorizontal,
  Boxes,
  CheckSquare,
  Wand2,
  ArrowLeft
} from 'lucide-react';
import { 
  NurtureTool, 
  NurtureToolType, 
  NurturePosition, 
  NurtureTrigger, 
  NurtureAccessLevel,
  NurturePackageTier,
  NurturePlan,
  DEFAULT_NURTURE_PLANS,
  DEFAULT_NURTURE_PACKAGES 
} from '../types/nurture';
import { DEFAULT_NURTURE_TOOLS } from '../data/nurtureDefaults';
import { NurtureSimulator } from '../components/nurture/NurtureSimulator';
import { NurtureEmbedModal } from '../components/nurture/NurtureEmbedModal';
import { NurtureStepWizard } from '../components/nurture/NurtureStepWizard';

const COLOR_PRESETS = [
  { name: 'Electric Cyan', hex: '#00d2ff' },
  { name: 'Royal Blue', hex: '#3b82f6' },
  { name: 'Emerald Growth', hex: '#10b981' },
  { name: 'Purple Neon', hex: '#a855f7' },
  { name: 'Amber Sunset', hex: '#f59e0b' },
  { name: 'Rose Pink', hex: '#ec4899' },
  { name: 'Ruby Crimson', hex: '#ef4444' }
];

const ARCHETYPE_DETAILS: Record<NurtureToolType, {
  name: string;
  headline: string;
  desc: string;
  badge: string;
  color: string;
  bgLight: string;
  conversionTip: string;
  presets: Array<{ name: string; desc: string; headline: string; trigger: string }>;
}> = {
  support_widget: {
    name: 'Live Support Chat',
    headline: '24/7 Conversational Helpdesk & Triage',
    desc: 'Corner-floating live chat bubble that engages website visitors, answers product questions using your AI Agent, and captures leads for human follow-up.',
    badge: 'Popular',
    color: 'text-cyan-400',
    bgLight: 'bg-cyan-500/10 border-cyan-500/25',
    conversionTip: 'Place on homepage and product catalog pages. Responds immediately to pricing and FAQ inquiries.',
    presets: [
      { name: '24/7 AI FAQ Helpdesk', desc: 'Answers common questions and books calls', headline: 'Need Help or Have Questions?', trigger: 'Immediate (2s)' },
      { name: 'VIP Consultation Booking', desc: 'Collects visitor goals and schedules demo', headline: 'Schedule Your 1-on-1 Consultation', trigger: 'Delay (4s)' }
    ]
  },
  popup_modal: {
    name: 'Exit Popup Modal',
    headline: 'High-Converting Exit-Intent Lightbox',
    desc: 'Detects when a visitor moves their mouse towards the browser close button or presses back on mobile, triggering a lightbox to rescue abandoning carts.',
    badge: 'High Conversion',
    color: 'text-blue-400',
    bgLight: 'bg-blue-500/10 border-blue-500/25',
    conversionTip: 'Offer a time-limited 15% voucher or lead magnet before visitors leave to boost conversions by up to 25%.',
    presets: [
      { name: '15% Off Cart Voucher', desc: 'Exclusive promo code before checkout bounce', headline: 'Wait! Don\'t Leave Empty Handed 🎁', trigger: 'Exit Intent' },
      { name: 'VIP Playbook Lead Magnet', desc: 'Free guide in exchange for contact info', headline: 'Unlock Our Private 2026 Growth Playbook', trigger: 'Exit Intent' }
    ]
  },
  slider: {
    name: 'Corner Slider',
    headline: 'Interactive Scroll-Triggered Drawer',
    desc: 'Unobtrusive slide-out drawer triggered when visitors scroll down specific sections. Ideal for pricing plan comparisons, ROI calculators, and client proof.',
    badge: 'High Engagement',
    color: 'text-emerald-400',
    bgLight: 'bg-emerald-500/10 border-emerald-500/25',
    conversionTip: 'Triggers at 40-50% scroll depth on pricing and feature pages to answer purchase doubts without blocking navigation.',
    presets: [
      { name: 'Pricing & ROI Calculator', desc: 'Find your fit tier in 30 seconds', headline: 'Comparing Plans? Let\'s Find Your Fit', trigger: 'Scroll 40%' },
      { name: 'Client Proof & Case Study', desc: 'Verified 42% revenue increase breakdown', headline: 'See How DentalCare Grew Revenue +42%', trigger: 'Scroll 50%' }
    ]
  },
  page_takeover: {
    name: 'Page Takeover',
    headline: 'Fullscreen Immersive Launch Overlay',
    desc: 'Maximum-impact fullscreen overlay for major product launches, flash sales, seasonal events, or high-priority webinar registrations.',
    badge: 'Maximum Impact',
    color: 'text-pink-400',
    bgLight: 'bg-pink-500/10 border-pink-500/25',
    conversionTip: 'Use for time-sensitive product drops and live events where capturing 100% of visitor focus is critical.',
    presets: [
      { name: 'Product Drop 2.4 Release', desc: 'Interactive tour and early founder pricing', headline: 'Introducing ChatMize 2.4 — Live Now 🚀', trigger: 'Immediate (1s)' },
      { name: 'Live Masterclass RSVP', desc: 'Reserve free seat with 1-click registration', headline: 'Free Masterclass: Meta DM Automation', trigger: 'Delay (2s)' }
    ]
  },
  sticky_bar: {
    name: 'Sticky Bar',
    headline: 'Persistent Floating Header/Footer Banner',
    desc: 'Non-intrusive floating ribbon at the top or bottom of every page. Promotes shipping perks, flash announcements, and offers 1-tap live chat access.',
    badge: 'Non-Intrusive',
    color: 'text-amber-400',
    bgLight: 'bg-amber-500/10 border-amber-500/25',
    conversionTip: 'Remains sticky as users scroll. High visibility without blocking website navigation.',
    presets: [
      { name: 'Free Shipping Announcement', desc: 'Flash voucher with direct assistant chat', headline: '⚡ Flash Sale: Free shipping & live support today!', trigger: 'Immediate' },
      { name: 'System Notice / Live Alert', desc: 'Important company updates and live support', headline: 'Notice: New AI models deployed to all workspaces', trigger: 'Immediate' }
    ]
  }
};

interface NurtureToolsViewProps {
  onNavigateToFlows?: (botId?: string) => void;
  selectedCategory?: 'all' | NurtureToolType;
  onSelectCategory?: (category: 'all' | NurtureToolType) => void;
  initialChildTab?: string;
  onChildTabChange?: (tab: string) => void;
}

export const NurtureToolsView: React.FC<NurtureToolsViewProps> = ({ 
  onNavigateToFlows,
  selectedCategory = 'all',
  onSelectCategory,
  initialChildTab = 'saved',
  onChildTabChange
}) => {
  // 1. Persistent Tools State (stored under modern chatmize_nurture_tools with fallback)
  const [tools, setTools] = useState<NurtureTool[]>(() => {
    try {
      const saved = localStorage.getItem('chatmize_nurture_tools') || localStorage.getItem('chatmize_convertmate_tools');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // ensure accessLevel is set
          return parsed.map((item: any) => ({
            ...item,
            accessLevel: item.accessLevel || (
              item.type === 'page_takeover' ? 'agency' : 
              (item.type === 'support_widget' ? 'starter' : 'growth')
            )
          }));
        }
      }
    } catch (e) {
      console.warn('Could not read saved nurture tools:', e);
    }
    return DEFAULT_NURTURE_TOOLS;
  });

  // Save changes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('chatmize_nurture_tools', JSON.stringify(tools));
      // Also sync backwards compatibility key
      localStorage.setItem('chatmize_convertmate_tools', JSON.stringify(tools));
    } catch (e) {
      console.warn('Could not save nurture tools:', e);
    }
  }, [tools]);

  // 2. Flexible Custom Plan Builder State (No hardcoded assumptions - user builds their own plans)
  const [plans, setPlans] = useState<NurturePlan[]>(() => {
    try {
      const saved = localStorage.getItem('chatmize_nurture_custom_plans');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('Could not load custom nurture plans:', e);
    }
    return DEFAULT_NURTURE_PLANS;
  });

  useEffect(() => {
    try {
      localStorage.setItem('chatmize_nurture_custom_plans', JSON.stringify(plans));
    } catch (e) {
      console.warn('Could not save custom nurture plans:', e);
    }
  }, [plans]);

  // Current simulated account plan ('all_access' or a specific plan ID)
  const [currentAccountPlanId, setCurrentAccountPlanId] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('chatmize_nurture_active_plan_id');
      if (saved) return saved;
    } catch (e) {}
    return 'all_access'; // default to all_access for testing everything
  });

  const handleSetAccountPlan = (planId: string) => {
    setCurrentAccountPlanId(planId);
    try {
      localStorage.setItem('chatmize_nurture_active_plan_id', planId);
    } catch (e) {}
  };

  // Plan Builder Modal & Form State
  const [isPlanModalOpen, setIsPlanModalOpen] = useState<boolean>(false);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [planForm, setPlanForm] = useState<NurturePlan>({
    id: 'plan-1',
    name: 'New Custom Plan',
    description: '',
    price: '',
    color: '#00d2ff',
    maxActiveTools: 5,
    maxDomains: 1,
    includedToolTypes: ['support_widget', 'popup_modal'],
    features: {
      exitIntent: true,
      pageTakeovers: false,
      cornerSliders: false,
      stickyBars: false,
      removeBranding: false,
      customCSS: false,
      metaPixelEvents: true,
      unlimitedDomains: false,
      aiAutonomousAgent: true
    }
  });

  // Open modal to build a new plan
  const handleOpenCreatePlan = () => {
    setEditingPlanId(null);
    setPlanForm({
      id: `plan-custom-${Date.now().toString().slice(-4)}`,
      name: `Custom Plan ${plans.length + 1}`,
      description: 'Custom client plan built via Plan Builder',
      price: '',
      color: '#00d2ff',
      maxActiveTools: 5,
      maxDomains: 1,
      includedToolTypes: ['support_widget', 'popup_modal'],
      features: {
        exitIntent: true,
        pageTakeovers: false,
        cornerSliders: false,
        stickyBars: false,
        removeBranding: false,
        customCSS: false,
        metaPixelEvents: true,
        unlimitedDomains: false,
        aiAutonomousAgent: true
      }
    });
    setIsPlanModalOpen(true);
  };

  // Open modal to edit existing plan
  const handleOpenEditPlan = (plan: NurturePlan) => {
    setEditingPlanId(plan.id);
    setPlanForm({ 
      ...plan, 
      features: { ...plan.features },
      includedToolTypes: [...plan.includedToolTypes]
    });
    setIsPlanModalOpen(true);
  };

  // Clone an existing plan
  const handleDuplicatePlan = (planToClone: NurturePlan) => {
    const newId = `plan-${Date.now().toString().slice(-4)}`;
    const cloned: NurturePlan = {
      ...planToClone,
      id: newId,
      name: `${planToClone.name} (Copy)`,
      includedToolTypes: [...planToClone.includedToolTypes],
      features: { ...planToClone.features },
      createdAt: new Date().toISOString()
    };
    setPlans(prev => [...prev, cloned]);
    showToast(`Duplicated plan as "${cloned.name}"`);
  };

  // Delete plan
  const handleDeletePlan = (planId: string) => {
    if (plans.length <= 1) {
      alert('You must keep at least one plan in your workspace.');
      return;
    }
    const targetPlan = plans.find(p => p.id === planId);
    if (confirm(`Are you sure you want to delete the plan "${targetPlan?.name || planId}"? Any tools assigned to this plan will be safely reassigned.`)) {
      const remainingPlans = plans.filter(p => p.id !== planId);
      setPlans(remainingPlans);
      // Reassign tools if they used this plan
      setTools(prev => prev.map(t => {
        if (t.planId === planId || t.accessLevel === planId) {
          return { ...t, planId: remainingPlans[0].id, accessLevel: remainingPlans[0].id };
        }
        return t;
      }));
      if (currentAccountPlanId === planId) {
        handleSetAccountPlan('all_access');
      }
      showToast('Plan deleted');
    }
  };

  // Save new or edited plan
  const handleSavePlan = () => {
    if (!planForm.name.trim()) {
      alert('Please provide a name for this plan.');
      return;
    }
    if (planForm.includedToolTypes.length === 0) {
      alert('Please select at least one included Nurture Tool archetype for this plan.');
      return;
    }

    if (editingPlanId) {
      setPlans(prev => prev.map(p => p.id === editingPlanId ? { ...planForm, updatedAt: new Date().toISOString() } : p));
      showToast(`Updated plan "${planForm.name}"`);
    } else {
      setPlans(prev => [...prev, { ...planForm, createdAt: new Date().toISOString() }]);
      showToast(`Created new plan "${planForm.name}"`);
    }
    setIsPlanModalOpen(false);
  };

  // Available Bot Maps for connecting
  const [availableBots, setAvailableBots] = useState<Array<{ id: string; name: string }>>([
    { id: 'bot-customer-support-faq', name: '24/7 Customer Support FAQ Bot' },
    { id: 'bot-lead-magnet-optin', name: 'High-Converting Lead Magnet Flow' },
    { id: 'bot-webinar-registration', name: 'Webinar & Event Registration Bot' },
    { id: 'bot-abandoned-cart-recovery', name: 'Abandoned Cart & Voucher Flow' },
    { id: 'ai-omni-support-agent', name: 'Omnichannel AI Support Specialist' }
  ]);

  useEffect(() => {
    try {
      const savedBots = localStorage.getItem('chatmize_bot_maps_list');
      if (savedBots) {
        const parsed = JSON.parse(savedBots);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const list = parsed.map((b: any) => ({ id: b.id, name: b.name }));
          setAvailableBots(prev => {
            const map = new Map();
            [...prev, ...list].forEach(item => map.set(item.id, item));
            return Array.from(map.values());
          });
        }
      }
    } catch (e) {
      console.warn('Could not load custom bot maps for nurture tools:', e);
    }
  }, []);

  // Child Tab Navigation:
  // 'saved' = The Central Repository where all Nurture Tools are saved
  // 'support_widget' = Live Support Chat (dedicated workspace & saved list)
  // 'popup_modal' = Exit Popups (dedicated workspace & saved list)
  // 'slider' = Corner Sliders (dedicated workspace & saved list)
  // 'page_takeover' = Page Takeovers (dedicated workspace & saved list)
  // 'sticky_bar' = Sticky Bars (dedicated workspace & saved list)
  // 'setup_wizard' = Step-by-Step Setup Wizard
  // 'editor' = Fullscreen Studio editor to customize selected tool
  // 'preview' = Dedicated Interactive Simulator test lab
  // 'packages' = Modular Access Levels & Package Builder
  const [activeChildTab, setActiveChildTab] = useState<string>(initialChildTab || 'saved');
  const [activeViewMode, setActiveViewMode] = useState<'hub' | 'editor' | 'preview' | 'packages'>('hub');
  const [wizardArchetype, setWizardArchetype] = useState<NurtureToolType>('support_widget');
  const [wizardEditingTool, setWizardEditingTool] = useState<NurtureTool | null>(null);

  // Sync child tab prop if updated from sidebar or parent
  useEffect(() => {
    if (initialChildTab && initialChildTab !== activeChildTab) {
      setActiveChildTab(initialChildTab);
      if (['support_widget', 'popup_modal', 'slider', 'page_takeover', 'sticky_bar'].includes(initialChildTab)) {
        setSelectedType(initialChildTab as any);
      } else if (initialChildTab === 'saved') {
        setSelectedType('all');
      }
    }
  }, [initialChildTab]);

  const handleSwitchChildTab = (tab: string) => {
    setActiveChildTab(tab);
    if (onChildTabChange) {
      onChildTabChange(tab);
    }
    if (tab === 'saved') {
      handleSelectCategory('all');
      setActiveViewMode('hub');
    } else if (['support_widget', 'popup_modal', 'slider', 'page_takeover', 'sticky_bar'].includes(tab)) {
      handleSelectCategory(tab as any);
    } else if (tab === 'editor') {
      setActiveViewMode('editor');
    } else if (tab === 'preview' || tab === 'simulator') {
      setActiveViewMode('preview');
    } else if (tab === 'packages') {
      setActiveViewMode('packages');
    }
  };

  const handleOpenStepByStep = (archetype?: NurtureToolType, toolToEdit?: NurtureTool) => {
    if (toolToEdit) {
      setWizardEditingTool(toolToEdit);
      setWizardArchetype(toolToEdit.type);
    } else {
      setWizardEditingTool(null);
      if (archetype) {
        setWizardArchetype(archetype);
      }
    }
    handleSwitchChildTab('setup_wizard');
  };

  const handleSaveFromWizard = (savedTool: NurtureTool) => {
    setTools(prev => {
      const exists = prev.some(t => t.id === savedTool.id);
      if (exists) {
        return prev.map(t => t.id === savedTool.id ? { ...savedTool, updatedAt: new Date().toISOString() } : t);
      } else {
        return [{ ...savedTool, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, ...prev];
      }
    });
    setSelectedToolId(savedTool.id);
    setDraftTool(savedTool);
    showToast(`Saved "${savedTool.name}" to library!`);
    handleSwitchChildTab('saved');
  };

  // Filtering & Selection
  const [selectedType, setSelectedType] = useState<'all' | NurtureToolType>(selectedCategory);
  const [selectedTierFilter, setSelectedTierFilter] = useState<'all' | NurtureAccessLevel>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'all' | 'active' | 'paused'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedToolId, setSelectedToolId] = useState<string>(tools[0]?.id || 'nurture-support-widget-1');
  
  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [embedModalTool, setEmbedModalTool] = useState<NurtureTool | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  // Sync category prop if updated from sidebar
  useEffect(() => {
    if (selectedCategory && selectedCategory !== selectedType) {
      setSelectedType(selectedCategory);
    }
  }, [selectedCategory]);

  const handleSelectCategory = (type: 'all' | NurtureToolType) => {
    setSelectedType(type);
    if (onSelectCategory) {
      onSelectCategory(type);
    }
  };

  // Selected tool object
  const activeTool = tools.find(t => t.id === selectedToolId) || tools[0] || DEFAULT_NURTURE_TOOLS[0];
  
  // Editor draft state
  const [draftTool, setDraftTool] = useState<NurtureTool>(activeTool);
  const toolEmoji = useEmojiTarget<HTMLTextAreaElement>();

  useEffect(() => {
    if (activeTool) {
      setDraftTool(activeTool);
    }
  }, [activeTool?.id]);

  // Find assigned plan for any tool
  const getToolAssignedPlan = (tool: NurtureTool): NurturePlan => {
    return plans.find(p => p.id === tool.planId || p.id === tool.accessLevel) || 
      plans.find(p => p.includedToolTypes.includes(tool.type)) || 
      plans[0] || 
      DEFAULT_NURTURE_PLANS[0];
  };

  // Helper for Plan Badge
  const getPlanBadge = (levelOrPlanId: string) => {
    const plan = plans.find(p => p.id === levelOrPlanId) || 
      (DEFAULT_NURTURE_PACKAGES[levelOrPlanId] as NurturePlan) || 
      plans[0] || 
      DEFAULT_NURTURE_PLANS[0];

    return {
      name: plan.name,
      price: plan.price || '',
      color: plan.color || '#00d2ff',
      icon: <Boxes className="w-3 h-3" />
    };
  };

  // Filtered tools in the Hub
  const filteredTools = tools.filter(t => {
    const matchesCategory = selectedType === 'all' || t.type === selectedType;
    const assignedPlan = getToolAssignedPlan(t);
    const matchesPlan = selectedTierFilter === 'all' || assignedPlan.id === selectedTierFilter || t.accessLevel === selectedTierFilter || t.planId === selectedTierFilter;
    const matchesStatus = selectedStatusFilter === 'all' || t.status === selectedStatusFilter;
    const matchesSearch = searchQuery.trim() === '' || 
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      t.headline.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.id.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesPlan && matchesStatus && matchesSearch;
  });

  // Aggregated Performance Stats
  const totalImpressions = tools.reduce((sum, t) => sum + (t.totalViews || 0), 0);
  const totalChats = tools.reduce((sum, t) => sum + (t.totalConversations || 0), 0);
  const totalLeads = tools.reduce((sum, t) => sum + (t.totalLeads || 0), 0);
  const activeToolsCount = tools.filter(t => t.status === 'active').length;
  const overallConversion = totalImpressions > 0 ? ((totalLeads / totalImpressions) * 100).toFixed(1) : '0';

  // Toggle active/paused status
  const handleToggleStatus = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setTools(prev => prev.map(t => {
      if (t.id === id) {
        const nextStatus = t.status === 'active' ? 'paused' : 'active';
        return { ...t, status: nextStatus, updatedAt: new Date().toISOString() };
      }
      return t;
    }));
    showToast('Tool status updated');
  };

  // Duplicate / Clone tool
  const handleDuplicateTool = (toolToClone: NurtureTool, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const cloned: NurtureTool = {
      ...toolToClone,
      id: `nurture-${toolToClone.type.replace('_', '-')}-${Date.now().toString().slice(-4)}`,
      name: `${toolToClone.name} (Copy)`,
      totalViews: 0,
      totalConversations: 0,
      totalLeads: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    setTools(prev => [cloned, ...prev]);
    setSelectedToolId(cloned.id);
    showToast(`Duplicated as "${cloned.name}"`);
  };

  // Delete tool
  const handleDeleteTool = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (tools.length <= 1) {
      alert('You must keep at least one Nurture Tool in your workspace.');
      return;
    }
    if (confirm('Are you sure you want to delete this Nurture Tool? This will disconnect any active embeds.')) {
      const nextTools = tools.filter(t => t.id !== id);
      setTools(nextTools);
      if (selectedToolId === id) {
        setSelectedToolId(nextTools[0].id);
      }
      showToast('Tool deleted');
    }
  };

  // Create new tool from archetype with assigned tier
  const handleCreateArchetype = (type: NurtureToolType) => {
    const defaultTitles: Record<NurtureToolType, string> = {
      support_widget: '24/7 Live Support Chat Bubble',
      popup_modal: 'Exit-Intent Special Offer Lightbox',
      slider: 'Product Page Assistant Drawer',
      page_takeover: 'Product Launch Fullscreen Takeover',
      sticky_bar: 'Top Announcement & Promo Bar'
    };

    const levelForType: Record<NurtureToolType, NurtureAccessLevel> = {
      support_widget: 'starter',
      popup_modal: 'growth',
      slider: 'growth',
      sticky_bar: 'growth',
      page_takeover: 'agency'
    };

    const newTool: NurtureTool = {
      id: `nurture-${type.replace('_', '-')}-${Date.now().toString().slice(-5)}`,
      name: defaultTitles[type] || 'New Nurture Growth Tool',
      type,
      accessLevel: levelForType[type] || 'growth',
      status: 'active',
      headline: type === 'popup_modal' 
        ? 'Wait! Get 15% off your first order' 
        : type === 'sticky_bar' 
        ? 'Flash Sale: Free shipping & live concierge support today!' 
        : 'Hi there! How can we assist your business today?',
      subheadline: 'Chat directly with our automated AI assistant or request a team callback.',
      welcomeMessage: 'Hello! I am your AI assistant. What questions can I answer for you today?',
      brandColor: type === 'support_widget' ? '#00d2ff' : type === 'popup_modal' ? '#3b82f6' : type === 'slider' ? '#10b981' : type === 'page_takeover' ? '#ec4899' : '#f59e0b',
      theme: 'dark',
      position: type === 'support_widget' || type === 'slider' ? 'bottom_right' : type === 'sticky_bar' ? 'top_bar' : 'center',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
      botName: 'Support Concierge',
      connectedBotId: availableBots[0]?.id || 'bot-customer-support-faq',
      triggerType: type === 'popup_modal' ? 'exit_intent' : type === 'slider' ? 'scroll_depth' : 'immediate',
      triggerDelaySeconds: 3,
      triggerScrollPercent: 50,
      exitIntentEnabled: type === 'popup_modal',
      quickReplies: [
        { id: 'qr-new-1', label: '👋 General Question', payload: 'QUESTION' },
        { id: 'qr-new-2', label: '🚀 Schedule Demo', payload: 'DEMO' },
        { id: 'qr-new-3', label: '💰 Pricing Info', payload: 'PRICING' }
      ],
      requireEmailCapture: true,
      requireNameCapture: true,
      removeBranding: levelForType[type] !== 'starter',
      metaPixelEvent: 'Lead',
      whitelistedDomains: ['yourbrand.com'],
      totalViews: 0,
      totalConversations: 0,
      totalLeads: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    setTools(prev => [newTool, ...prev]);
    setSelectedToolId(newTool.id);
    setDraftTool(newTool);
    setIsCreateModalOpen(false);
    setActiveViewMode('editor');
    showToast(`Created new ${defaultTitles[type]}!`);
  };

  // Save changes from editor
  const handleSaveDraft = (returnToHub: boolean = false) => {
    setTools(prev => prev.map(t => t.id === draftTool.id ? { ...draftTool, updatedAt: new Date().toISOString() } : t));
    showToast('Changes saved successfully');
    if (returnToHub) {
      handleSwitchChildTab('saved');
    }
  };

  // Helper for Archetype Badges
  const getToolTypeBadge = (type: NurtureToolType) => {
    switch (type) {
      case 'support_widget':
        return { label: 'Live Support Chat', icon: <MessageSquare className="w-3.5 h-3.5 text-cyan-400" />, color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20' };
      case 'popup_modal':
        return { label: 'Exit Popup Modal', icon: <Layout className="w-3.5 h-3.5 text-blue-400" />, color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' };
      case 'slider':
        return { label: 'Corner Slider', icon: <Sliders className="w-3.5 h-3.5 text-emerald-400" />, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' };
      case 'page_takeover':
        return { label: 'Page Takeover', icon: <Maximize2 className="w-3.5 h-3.5 text-pink-400" />, color: 'text-pink-400 bg-pink-500/10 border-pink-500/20' };
      case 'sticky_bar':
        return { label: 'Sticky Bar', icon: <Layers className="w-3.5 h-3.5 text-amber-400" />, color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' };
    }
  };

  // Helper for Archetype Icon Component (returns component, not JSX literal)
  const getToolTypeComponent = (type: NurtureToolType) => {
    switch (type) {
      case 'support_widget':
        return MessageSquare;
      case 'popup_modal':
        return Layout;
      case 'slider':
        return Sliders;
      case 'page_takeover':
        return Maximize2;
      case 'sticky_bar':
        return Layers;
      default:
        return MessageSquare;
    }
  };

  // Helper for Plan/Tier Badge
  const getTierBadge = (level: string) => {
    const plan = plans.find(p => p.id === level) || 
      (DEFAULT_NURTURE_PACKAGES[level as NurtureAccessLevel] as NurturePlan) || 
      plans[0];

    const label = plan ? plan.name : (level.charAt(0).toUpperCase() + level.slice(1));
    const color = plan?.color === '#10b981' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' :
      (plan?.color === '#a855f7' ? 'text-purple-400 bg-purple-500/10 border-purple-500/30' :
      'text-cyan-400 bg-cyan-500/10 border-cyan-500/30');

    return { 
      label, 
      color, 
      icon: <Shield className="w-3 h-3" /> 
    };
  };

  // Check if a tool is unlocked for the currently simulated account plan
  const isToolUnlockedForAccount = (toolOrType: NurtureTool | NurtureToolType | string) => {
    if (currentAccountPlanId === 'all_access') return true;
    const currentPlan = plans.find(p => p.id === currentAccountPlanId);
    if (!currentPlan) return true;
    
    // If passed a tool object
    if (typeof toolOrType === 'object' && toolOrType !== null && 'type' in toolOrType) {
      return currentPlan.includedToolTypes.includes(toolOrType.type);
    }
    // If passed a tool archetype string
    if (['support_widget', 'popup_modal', 'slider', 'page_takeover', 'sticky_bar'].includes(toolOrType as string)) {
      return currentPlan.includedToolTypes.includes(toolOrType as NurtureToolType);
    }
    return true;
  };

  return (
    <div className="flex-1 flex flex-col gap-5 overflow-y-auto pb-12 pr-1" style={{ scrollbarWidth: 'thin' }}>
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 border border-cyan-500/40 text-cyan-300 px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 text-xs font-semibold animate-in fade-in slide-in-from-bottom-3 duration-200">
          <CheckCircle className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header & Metrics Strip for Saved Tools Hub */}
      {activeChildTab === 'saved' && (
        <>
          {/* Top Main Header Card */}
          <div className="bg-slate-900/90 border border-white/10 rounded-2xl p-5 shadow-lg relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-cyan-400 text-xs font-mono font-bold tracking-wider uppercase flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  Nurture Tools™ Suite
                </span>
                <span className="text-slate-600">·</span>
                <span className="text-slate-400 text-xs font-medium">
                  Website Lead Generation &amp; Automated Engagement
                </span>
              </div>

              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-3">
                Nurture Tools
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 font-mono">
                  {tools.length} Built
                </span>
              </h1>
              <p className="text-xs text-slate-400 mt-1 max-w-2xl">
                The dedicated home where all your website Nurture Tools live once created. Edit messaging, customize triggers, test live simulators, and package features across access levels.
              </p>
            </div>

            {/* Access Level Selector & Main CTAs */}
            <div className="flex items-center gap-2.5 flex-wrap flex-shrink-0">
              {/* Account Tier / Plan Quick Switcher */}
              <div className="flex items-center gap-1.5 bg-slate-950/80 border border-white/10 px-2.5 py-1.5 rounded-xl text-xs">
                <span className="text-slate-400 text-[11px] font-medium hidden sm:inline">Simulated Plan:</span>
                <select
                  value={currentAccountPlanId}
                  onChange={(e) => handleSetAccountPlan(e.target.value)}
                  className="bg-transparent text-xs font-bold text-cyan-300 focus:outline-none cursor-pointer border-0 p-0"
                  title="Switch user access level or custom plan to test packaging & entitlements"
                >
                  <option value="all_access" className="bg-slate-900 text-slate-200">★ All-Access Sandbox</option>
                  {plans.map(p => (
                    <option key={p.id} value={p.id} className="bg-slate-900 text-slate-200">
                      {p.name} {p.price ? `(${p.price})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={() => handleOpenStepByStep()}
                className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-cyan-500/20 flex items-center gap-2 transition-all cursor-pointer"
              >
                <Wand2 className="w-4 h-4" />
                <span>+ New Nurture Tool</span>
              </button>
            </div>
          </div>

          {/* Metrics Summary Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-white/5 flex items-center justify-between">
              <div>
                <span className="text-[11px] text-slate-400 font-medium">Active Tools Built</span>
                <h4 className="text-lg font-bold text-white mt-0.5">{activeToolsCount} <span className="text-xs text-slate-500 font-normal">/ {tools.length} total</span></h4>
              </div>
              <div className="w-8 h-8 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center">
                <PackageCheck className="w-4 h-4" />
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-white/5 flex items-center justify-between">
              <div>
                <span className="text-[11px] text-slate-400 font-medium">Total Website Impressions</span>
                <h4 className="text-lg font-bold text-white mt-0.5">{totalImpressions.toLocaleString()}</h4>
              </div>
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
                <Eye className="w-4 h-4" />
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-white/5 flex items-center justify-between">
              <div>
                <span className="text-[11px] text-slate-400 font-medium">Captured Leads</span>
                <h4 className="text-lg font-bold text-emerald-400 mt-0.5">{totalLeads.toLocaleString()}</h4>
              </div>
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-white/5 flex items-center justify-between">
              <div>
                <span className="text-[11px] text-slate-400 font-medium">Avg Conversion Rate</span>
                <h4 className="text-lg font-bold text-cyan-300 mt-0.5">{overallConversion}%</h4>
              </div>
              <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
          </div>
        </>
      )}

      {/* =========================================================================
          CHILD TAB: STEP-BY-STEP SETUP WIZARD
          ========================================================================= */}
      {activeChildTab === 'setup_wizard' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <button
              onClick={() => handleSwitchChildTab('saved')}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold border border-white/10 transition-all cursor-pointer shadow-sm"
            >
              <ArrowLeft className="w-4 h-4 text-cyan-400" />
              <span>Back to Saved Tools</span>
            </button>
            <span className="text-xs text-slate-400 font-mono">Step-by-Step Setup Wizard</span>
          </div>

          <NurtureStepWizard
            initialArchetype={wizardArchetype}
            editingTool={wizardEditingTool}
            availableBots={availableBots}
            plans={plans}
            onSave={handleSaveFromWizard}
            onCancel={() => handleSwitchChildTab('saved')}
            onTestLive={(tool) => {
              setSelectedToolId(tool.id);
              setDraftTool(tool);
              handleSwitchChildTab('preview');
            }}
          />
        </div>
      )}

      {/* =========================================================================
          CHILD TAB: DEDICATED NURTURE TOOL ARCHETYPE WORKSPACES
          ========================================================================= */}
      {['support_widget', 'popup_modal', 'slider', 'page_takeover', 'sticky_bar'].includes(activeChildTab) && (
        <div className="space-y-5 animate-in fade-in duration-200">
          {(() => {
            const type = activeChildTab as NurtureToolType;
            const meta = ARCHETYPE_DETAILS[type] || ARCHETYPE_DETAILS['support_widget'];
            const toolsInType = tools.filter(t => t.type === type);
            const activeInType = toolsInType.filter(t => t.status === 'active').length;
            const typeLeads = toolsInType.reduce((acc, t) => acc + (t.totalLeads || 0), 0);
            const typeImpressions = toolsInType.reduce((acc, t) => acc + (t.totalViews || 0), 0);
            const ArchetypeIconComponent = getToolTypeComponent(type);

            return (
              <div className="space-y-5">
                {/* Back Navigation Bar */}
                <div className="flex items-center justify-between gap-3">
                  <button
                    onClick={() => handleSwitchChildTab('saved')}
                    className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold border border-white/10 transition-all cursor-pointer shadow-sm"
                  >
                    <ArrowLeft className="w-4 h-4 text-cyan-400" />
                    <span>Back to All Saved Tools</span>
                  </button>

                  {/* Account Tier / Plan Quick Switcher */}
                  <div className="flex items-center gap-2 bg-slate-950/80 border border-white/10 px-3 py-1.5 rounded-xl text-xs">
                    <span className="text-slate-400 text-[11px] font-medium hidden sm:inline">Simulated Plan:</span>
                    <select
                      value={currentAccountPlanId}
                      onChange={(e) => handleSetAccountPlan(e.target.value)}
                      className="bg-transparent text-xs font-bold text-cyan-300 focus:outline-none cursor-pointer border-0 p-0"
                      title="Switch user access level or custom plan to test packaging & entitlements"
                    >
                      <option value="all_access" className="bg-slate-900 text-slate-200">★ All-Access Sandbox</option>
                      {plans.map(p => (
                        <option key={p.id} value={p.id} className="bg-slate-900 text-slate-200">
                          {p.name} {p.price ? `(${p.price})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Main Top Header Banner */}
                <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/90 to-slate-950 border border-white/10 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
                  
                  <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
                    <div className="flex items-start gap-4">
                      <div className={`w-14 h-14 rounded-2xl ${meta.bgLight} border flex items-center justify-center flex-shrink-0 shadow-lg`}>
                        <ArchetypeIconComponent className={`w-7 h-7 ${meta.color}`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 uppercase tracking-wider">
                            {meta.badge}
                          </span>
                          <span className="text-xs text-slate-400 font-mono">
                            {toolsInType.length} Saved in Workspace ({activeInType} Live)
                          </span>
                        </div>
                        <h2 className="text-xl font-bold text-white tracking-tight">{meta.name}: {meta.headline}</h2>
                        <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">{meta.desc}</p>
                        
                        {/* Conversion Playbook */}
                        <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-slate-300">
                          <Sparkles className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                          <span><strong className="text-white">Conversion Playbook:</strong> {meta.conversionTip}</span>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <button
                        onClick={() => handleOpenStepByStep(type)}
                        className="px-4 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-cyan-500/25 flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap"
                      >
                        <Wand2 className="w-4 h-4" />
                        <span>Set Up New {meta.name} (Step-by-Step)</span>
                      </button>
                    </div>
                  </div>

                  {/* Quick Metrics Bar */}
                  <div className="mt-6 pt-4 border-t border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                      <span className="text-[10px] text-slate-400 block font-medium">Tools Saved</span>
                      <span className="text-base font-bold text-white">{toolsInType.length}</span>
                    </div>
                    <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                      <span className="text-[10px] text-slate-400 block font-medium">Active Live</span>
                      <span className="text-base font-bold text-cyan-300">{activeInType}</span>
                    </div>
                    <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                      <span className="text-[10px] text-slate-400 block font-medium">Total Impressions</span>
                      <span className="text-base font-bold text-blue-400">{typeImpressions.toLocaleString()}</span>
                    </div>
                    <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                      <span className="text-[10px] text-slate-400 block font-medium">Captured Leads</span>
                      <span className="text-base font-bold text-emerald-400">{typeLeads.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* Quick-Start Conversion Presets */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <Zap className="w-4 h-4 text-cyan-400" />
                        <span>Recommended Starter Presets for {meta.name}</span>
                      </h3>
                      <p className="text-xs text-slate-400">Launch a high-performing configuration in 1-click using the step-by-step wizard</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {meta.presets.map((preset, idx) => (
                      <div 
                        key={idx}
                        className="p-4 rounded-2xl bg-slate-900/80 border border-white/10 hover:border-cyan-500/40 transition-all flex flex-col justify-between group"
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-white group-hover:text-cyan-300 transition-colors flex items-center gap-1.5">
                              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                              {preset.name}
                            </span>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/5 text-slate-300 border border-white/10">
                              Trigger: {preset.trigger}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400">{preset.desc}</p>
                          <div className="p-2 rounded-xl bg-slate-950/60 border border-white/5 text-[11px] text-slate-300">
                            <span className="text-slate-500 block text-[10px]">Pre-filled Headline:</span>
                            "{preset.headline}"
                          </div>
                        </div>

                        <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between">
                          <span className="text-[11px] text-slate-400">Ready to customize &amp; publish</span>
                          <button
                            onClick={() => handleOpenStepByStep(type)}
                            className="px-3 py-1.5 bg-cyan-500/10 hover:bg-cyan-500 text-cyan-300 hover:text-slate-950 font-bold text-xs rounded-xl border border-cyan-500/25 transition-all cursor-pointer flex items-center gap-1.5"
                          >
                            <Wand2 className="w-3.5 h-3.5" />
                            <span>Use Template in Wizard</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Saved Tools of this Archetype */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <FolderOpen className="w-4 h-4 text-cyan-400" />
                        <span>Saved {meta.name} Instances ({toolsInType.length})</span>
                      </h3>
                      <p className="text-xs text-slate-400">All tools of this type configured and saved in your workspace</p>
                    </div>

                    <button
                      onClick={() => handleOpenStepByStep(type)}
                      className="px-3.5 py-1.5 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-semibold border border-white/10 transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Add {meta.name}</span>
                    </button>
                  </div>

                  {/* Grid of Saved Tools of this Type */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {toolsInType.map(tool => {
                      const assignedPlan = plans.find(p => p.id === tool.accessLevel) || plans[0];
                      const isUnlocked = isToolUnlockedForAccount(tool);

                      return (
                        <div
                          key={tool.id}
                          className={`rounded-2xl p-5 border transition-all duration-200 flex flex-col justify-between ${
                            selectedToolId === tool.id
                              ? 'bg-slate-900 border-cyan-500/50 shadow-xl shadow-cyan-500/5 ring-1 ring-cyan-500/30'
                              : 'bg-slate-900/70 border-white/10 hover:border-white/20 hover:bg-slate-900'
                          }`}
                        >
                          <div>
                            {/* Top Header */}
                            <div className="flex items-start justify-between gap-3 mb-3">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div 
                                  className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                                  style={{ backgroundColor: `${tool.brandColor || '#00d2ff'}20`, color: tool.brandColor || '#00d2ff' }}
                                >
                                  {React.createElement(getToolTypeComponent(tool.type), { className: 'w-4.5 h-4.5' })}
                                </div>
                                <div className="min-w-0">
                                  <h4 className="text-sm font-bold text-white leading-tight truncate">{tool.name}</h4>
                                  <div className="flex items-center gap-1.5 mt-0.5">
                                    <span className="text-[10px] font-mono text-slate-400 capitalize">
                                      {tool.triggerType.replace('_', ' ')}
                                    </span>
                                    <span className="text-slate-600">•</span>
                                    <span className="text-[10px] text-slate-400 capitalize">
                                      {tool.position.replace('-', ' ')}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Status Toggle Button */}
                              <button
                                onClick={() => handleToggleStatus(tool.id)}
                                className={`px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center gap-1.5 cursor-pointer transition-colors flex-shrink-0 ${
                                  tool.status === 'active' 
                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30' 
                                    : 'bg-slate-800 text-slate-400 border border-white/10 hover:bg-slate-700'
                                }`}
                                title={tool.status === 'active' ? 'Click to Pause' : 'Click to Activate'}
                              >
                                <span className={`w-1.5 h-1.5 rounded-full ${tool.status === 'active' ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                                <span>{tool.status === 'active' ? 'Active' : 'Paused'}</span>
                              </button>
                            </div>

                            {/* Headline / Message Preview */}
                            <p className="text-xs text-slate-300 mb-3.5 line-clamp-2 bg-slate-950/70 p-2.5 rounded-xl border border-white/5 italic">
                              "{tool.headline}"
                            </p>

                            {/* Metrics Strip */}
                            <div className="grid grid-cols-3 gap-2 text-center mb-3.5">
                              <div className="p-2 rounded-xl bg-slate-950/60 border border-white/5">
                                <span className="text-[10px] text-slate-500 block">Views</span>
                                <span className="text-xs font-bold text-white">{(tool.totalViews || 0).toLocaleString()}</span>
                              </div>
                              <div className="p-2 rounded-xl bg-slate-950/60 border border-white/5">
                                <span className="text-[10px] text-slate-500 block">Chats</span>
                                <span className="text-xs font-bold text-cyan-300">{(tool.totalConversations || 0).toLocaleString()}</span>
                              </div>
                              <div className="p-2 rounded-xl bg-slate-950/60 border border-white/5">
                                <span className="text-[10px] text-slate-500 block">Leads</span>
                                <span className="text-xs font-bold text-emerald-400">{(tool.totalLeads || 0).toLocaleString()}</span>
                              </div>
                            </div>

                            {/* Entitlement Lock Notice */}
                            {!isUnlocked && (
                              <div className="mb-3 p-2 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-between text-[11px] text-amber-300">
                                <div className="flex items-center gap-1.5">
                                  <Lock className="w-3.5 h-3.5 text-amber-400" />
                                  <span>Included in {assignedPlan.name}</span>
                                </div>
                                <button
                                  onClick={() => handleSetAccountPlan(assignedPlan.id)}
                                  className="font-bold text-amber-400 hover:underline cursor-pointer"
                                >
                                  Simulate Plan
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Card Actions */}
                          <div className="mt-2 pt-3 border-t border-white/10 flex items-center justify-between gap-2">
                            <button
                              onClick={() => handleOpenStepByStep(tool.type, tool)}
                              className="flex-1 py-1.5 px-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm shadow-cyan-500/20"
                              title="Edit using Step-by-Step Setup Wizard"
                            >
                              <Wand2 className="w-3.5 h-3.5" />
                              <span>Edit Setup</span>
                            </button>

                            <button
                              onClick={() => {
                                setSelectedToolId(tool.id);
                                handleSwitchChildTab('preview');
                              }}
                              className="p-2 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                              title="Test in Interactive Simulator"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => setEmbedModalTool(tool)}
                              className="p-2 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-cyan-300 border border-white/10 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                              title="Get Website Embed Code"
                            >
                              <Code className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={(e) => handleDuplicateTool(tool, e)}
                              className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-xl border border-transparent hover:border-white/10 transition-colors cursor-pointer"
                              title="Duplicate this tool"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={(e) => handleDeleteTool(tool.id, e)}
                              className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-colors cursor-pointer"
                              title="Delete tool"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {toolsInType.length === 0 && (
                      <div className="col-span-full p-10 rounded-2xl bg-white/5 border border-white/10 text-center space-y-3">
                        <div className={`w-12 h-12 mx-auto rounded-2xl ${meta.bgLight} border flex items-center justify-center`}>
                          <ArchetypeIconComponent className={`w-6 h-6 ${meta.color}`} />
                        </div>
                        <h4 className="text-sm font-bold text-white">No {meta.name} tools created yet</h4>
                        <p className="text-xs text-slate-400 max-w-md mx-auto">
                          {meta.desc}
                        </p>
                        <button
                          onClick={() => handleOpenStepByStep(type)}
                          className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-cyan-500/20 inline-flex items-center gap-2 cursor-pointer"
                        >
                          <Wand2 className="w-4 h-4" />
                          <span>Set Up Your First {meta.name}</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* =========================================================================
          VIEW MODE 1: ALL NURTURE TOOLS (THE CENTRAL REPOSITORY / HUB / SAVED TOOLS)
          ========================================================================= */}
      {(activeChildTab === 'saved' || (activeViewMode === 'hub' && !['setup_wizard', 'support_widget', 'popup_modal', 'slider', 'page_takeover', 'sticky_bar', 'editor', 'preview', 'simulator', 'packages'].includes(activeChildTab))) && (
        <div className="space-y-4 animate-in fade-in duration-200">
          
          {/* Sub-Filters: Category Pills, Level Filter, Status Filter & Search */}
          <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
            
            {/* Category Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 scrollbar-none">
              {[
                { id: 'all', label: 'All Archetypes', count: tools.length },
                { id: 'support_widget', label: 'Support Chat', count: tools.filter(t => t.type === 'support_widget').length },
                { id: 'popup_modal', label: 'Exit Popups', count: tools.filter(t => t.type === 'popup_modal').length },
                { id: 'slider', label: 'Corner Sliders', count: tools.filter(t => t.type === 'slider').length },
                { id: 'page_takeover', label: 'Page Takeovers', count: tools.filter(t => t.type === 'page_takeover').length },
                { id: 'sticky_bar', label: 'Sticky Bars', count: tools.filter(t => t.type === 'sticky_bar').length },
              ].map(cat => (
                <button
                  key={cat.id}
                  onClick={() => handleSelectCategory(cat.id as any)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                    selectedType === cat.id
                      ? 'bg-cyan-500 text-slate-950 font-bold'
                      : 'bg-white/5 hover:bg-white/10 text-slate-300'
                  }`}
                >
                  <span>{cat.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    selectedType === cat.id ? 'bg-slate-950/30 text-slate-950' : 'bg-white/10 text-slate-400'
                  }`}>
                    {cat.count}
                  </span>
                </button>
              ))}
            </div>

            {/* Dropdown Filters: Level + Status + Search */}
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              
              {/* Access Level / Plan Filter */}
              <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-slate-300">
                <Boxes className="w-3.5 h-3.5 text-cyan-400" />
                <select
                  value={selectedTierFilter}
                  onChange={(e) => setSelectedTierFilter(e.target.value as any)}
                  className="bg-transparent text-xs text-white focus:outline-none cursor-pointer"
                >
                  <option value="all" className="bg-slate-900">All Plans &amp; Levels</option>
                  {plans.map(p => (
                    <option key={p.id} value={p.id} className="bg-slate-900">{p.name}</option>
                  ))}
                </select>
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-slate-300">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={selectedStatusFilter}
                  onChange={(e) => setSelectedStatusFilter(e.target.value as any)}
                  className="bg-transparent text-xs text-white focus:outline-none cursor-pointer"
                >
                  <option value="all" className="bg-slate-900">All Status</option>
                  <option value="active" className="bg-slate-900">Active Only</option>
                  <option value="paused" className="bg-slate-900">Paused Only</option>
                </select>
              </div>

              {/* Search Bar */}
              <div className="relative w-full sm:w-56">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search built tools..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition-colors"
                />
              </div>

            </div>

          </div>

          {/* Tools Grid: Where all built tools live */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTools.map((tool) => {
              const badge = getToolTypeBadge(tool.type);
              const assignedPlan = getToolAssignedPlan(tool);
              const isUnlocked = isToolUnlockedForAccount(tool);
              const isSelected = tool.id === activeTool.id;

              return (
                <div
                  key={tool.id}
                  className={`bg-slate-900/80 border rounded-2xl p-5 transition-all duration-200 flex flex-col justify-between relative group ${
                    isSelected 
                      ? 'border-cyan-500/50 shadow-xl shadow-cyan-500/10 ring-1 ring-cyan-500/30' 
                      : 'border-white/10 hover:border-white/20 hover:bg-slate-900'
                  }`}
                >
                  {/* Card Top Row: Archetype Badge + Status Toggle */}
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border flex items-center gap-1.5 ${badge.color}`}>
                          {badge.icon}
                          <span>{badge.label}</span>
                        </span>

                        <span 
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1"
                          style={{
                            borderColor: `${assignedPlan.color}40`,
                            backgroundColor: `${assignedPlan.color}15`,
                            color: assignedPlan.color
                          }}
                          title={`Assigned Plan: ${assignedPlan.name}${assignedPlan.price ? ` (${assignedPlan.price})` : ''}`}
                        >
                          <Boxes className="w-3 h-3" />
                          <span>{assignedPlan.name}</span>
                        </span>
                      </div>

                      {/* Status Toggle */}
                      <button
                        onClick={(e) => handleToggleStatus(tool.id, e)}
                        className={`text-[10px] font-bold px-2.5 py-1 rounded-full border flex items-center gap-1.5 transition-colors cursor-pointer flex-shrink-0 ${
                          tool.status === 'active'
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/30'
                            : 'bg-slate-800 text-slate-400 border-white/10 hover:bg-slate-700'
                        }`}
                        title={tool.status === 'active' ? 'Click to Pause' : 'Click to Activate'}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${tool.status === 'active' ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`}></span>
                        <span className="capitalize">{tool.status}</span>
                      </button>
                    </div>

                    {/* Tool Name & Headline */}
                    <h3 className="text-sm font-bold text-white group-hover:text-cyan-300 transition-colors line-clamp-1">
                      {tool.name}
                    </h3>
                    <p className="text-xs text-slate-300 line-clamp-2 mt-2 p-2.5 rounded-xl bg-slate-950/70 border border-white/5 italic min-h-[38px]">
                      "{tool.headline}"
                    </p>

                    {/* Connected Bot & Trigger info */}
                    <div className="mt-3 p-2 rounded-xl bg-white/5 border border-white/5 text-[11px] space-y-1.5">
                      <div className="flex items-center justify-between text-slate-300">
                        <span className="text-slate-400 flex items-center gap-1">
                          <Workflow className="w-3 h-3 text-cyan-400" />
                          <span>Connected Bot:</span>
                        </span>
                        <strong className="text-cyan-300 truncate max-w-[140px]">
                          {availableBots.find(b => b.id === tool.connectedBotId)?.name || tool.connectedBotId}
                        </strong>
                      </div>
                      <div className="flex items-center justify-between text-slate-300">
                        <span className="text-slate-400 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-blue-400" />
                          <span>Trigger:</span>
                        </span>
                        <span className="capitalize text-slate-200">
                          {tool.triggerType.replace('_', ' ')} {tool.triggerDelaySeconds > 0 ? `(${tool.triggerDelaySeconds}s)` : ''}
                        </span>
                      </div>
                    </div>

                    {/* Performance mini strip */}
                    <div className="grid grid-cols-3 gap-2 text-center mt-3">
                      <div className="p-2 rounded-xl bg-slate-950/60 border border-white/5">
                        <span className="text-[10px] text-slate-500 block">Views</span>
                        <span className="text-xs font-bold text-white">{(tool.totalViews || 0).toLocaleString()}</span>
                      </div>
                      <div className="p-2 rounded-xl bg-slate-950/60 border border-white/5">
                        <span className="text-[10px] text-slate-500 block">Chats</span>
                        <span className="text-xs font-bold text-cyan-300">{(tool.totalConversations || 0).toLocaleString()}</span>
                      </div>
                      <div className="p-2 rounded-xl bg-slate-950/60 border border-white/5">
                        <span className="text-[10px] text-slate-500 block">Leads</span>
                        <span className="text-xs font-bold text-emerald-400">{(tool.totalLeads || 0).toLocaleString()}</span>
                      </div>
                    </div>

                    {/* Entitlement Lock Notice if account tier is below tool tier */}
                    {!isUnlocked && (
                      <div className="mt-3 p-2 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-between text-[11px] text-amber-300">
                        <div className="flex items-center gap-1.5">
                          <Lock className="w-3.5 h-3.5 text-amber-400" />
                          <span>Included in {assignedPlan.name}</span>
                        </div>
                        <button
                          onClick={() => handleSetAccountPlan(assignedPlan.id)}
                          className="font-bold text-amber-400 hover:underline cursor-pointer"
                        >
                          Simulate Plan
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Card Bottom Actions */}
                  <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between gap-2">
                    
                    {/* Step-by-Step Setup Edit Button */}
                    <button
                      onClick={() => handleOpenStepByStep(tool.type, tool)}
                      className="flex-1 py-1.5 px-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm shadow-cyan-500/20"
                      title="Edit with Step-by-Step Setup Wizard"
                    >
                      <Wand2 className="w-3.5 h-3.5" />
                      <span>Edit Setup</span>
                    </button>

                    {/* Live Preview Button */}
                    <button
                      onClick={() => {
                        setSelectedToolId(tool.id);
                        handleSwitchChildTab('preview');
                      }}
                      className="p-2 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                      title="Test in Interactive Simulator"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>

                    {/* Embed Code Modal Button */}
                    <button
                      onClick={() => setEmbedModalTool(tool)}
                      className="p-2 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-cyan-300 border border-white/10 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                      title="Get Website Embed Code"
                    >
                      <Code className="w-3.5 h-3.5" />
                    </button>

                    {/* Duplicate Clone Button */}
                    <button
                      onClick={(e) => handleDuplicateTool(tool, e)}
                      className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-xl border border-transparent hover:border-white/10 transition-colors cursor-pointer"
                      title="Duplicate this tool"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>

                    {/* Delete Button */}
                    <button
                      onClick={(e) => handleDeleteTool(tool.id, e)}
                      className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-colors cursor-pointer"
                      title="Delete tool"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>

                  </div>

                </div>
              );
            })}

            {/* Empty State */}
            {filteredTools.length === 0 && (
              <div className="col-span-full p-12 rounded-2xl bg-white/5 border border-white/10 text-center space-y-3">
                <div className="w-12 h-12 mx-auto rounded-2xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center">
                  <Sparkles className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-white">No Nurture Tools matched your filter</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Try clearing your search query or archetype filters, or build a brand new tool to expand your website engagement.
                </p>
                <button
                  onClick={() => setIsCreateModalOpen(true)}
                  className="px-4 py-2 bg-cyan-500 text-slate-950 font-bold text-xs rounded-xl transition-all cursor-pointer inline-flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Build New Tool</span>
                </button>
              </div>
            )}
          </div>

          {/* Quick Bottom Banner: Build More Tools */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-900/20 via-cyan-900/20 to-purple-900/20 border border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center flex-shrink-0">
                <Workflow className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">Need another customer touchpoint?</h4>
                <p className="text-[11px] text-slate-400">Launch exit-intent offers, sticky header banners, or multi-page support widgets in seconds.</p>
              </div>
            </div>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-xl border border-white/15 transition-all cursor-pointer whitespace-nowrap"
            >
              + Add Another Nurture Tool
            </button>
          </div>

        </div>
      )}

      {/* =========================================================================
          VIEW MODE 2: NURTURE STUDIO (FULL CUSTOMIZATION & RULES EDITOR)
          ========================================================================= */}
      {(activeChildTab === 'editor' || (activeViewMode === 'editor' && !['setup_wizard', 'support_widget', 'popup_modal', 'slider', 'page_takeover', 'sticky_bar', 'saved', 'preview', 'simulator', 'packages'].includes(activeChildTab))) && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <button
              onClick={() => handleSwitchChildTab('saved')}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold border border-white/10 transition-all cursor-pointer shadow-sm"
            >
              <ArrowLeft className="w-4 h-4 text-cyan-400" />
              <span>Back to Saved Tools</span>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          
          {/* Left Column: Comprehensive Settings Form (7 cols) */}
          <div className="lg:col-span-7 bg-slate-900/90 border border-white/10 rounded-2xl p-5 space-y-5 shadow-xl">
            
            {/* Top Editor Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    Editing: {draftTool.name}
                  </h2>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getTierBadge(draftTool.accessLevel).color}`}>
                    {getTierBadge(draftTool.accessLevel).label}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">Customize messaging, bot maps, triggers, and branding rules.</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleSaveDraft(true)}
                  className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Save &amp; Back to Hub
                </button>
                <button
                  onClick={() => handleSaveDraft(false)}
                  className="px-4 py-1.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold rounded-xl text-xs shadow-md shadow-cyan-500/20 cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Save Changes</span>
                </button>
              </div>
            </div>

            {/* Section 1: Identity & Modular Access Level */}
            <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
              <span className="font-bold text-white text-xs flex items-center gap-1.5 text-cyan-300">
                <MessageSquare className="w-3.5 h-3.5 text-cyan-400" />
                1. Identity, Archetype &amp; Modular Level
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Tool Internal Name</label>
                  <input data-no-emoji 
                    type="text"
                    value={draftTool.name}
                    onChange={(e) => setDraftTool({ ...draftTool, name: e.target.value })}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Archetype Format</label>
                  <select
                    value={draftTool.type}
                    onChange={(e) => {
                      const nextType = e.target.value as NurtureToolType;
                      setDraftTool({ 
                        ...draftTool, 
                        type: nextType,
                        accessLevel: nextType === 'page_takeover' ? 'agency' : (nextType === 'support_widget' ? 'starter' : 'growth')
                      });
                    }}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-400"
                  >
                    <option value="support_widget">💬 24/7 Live Support Chat Bubble (Level 1)</option>
                    <option value="popup_modal">🪟 Exit-Intent &amp; Delay Popup Modal (Level 2)</option>
                    <option value="slider">📐 Corner Interactive Slider (Level 2)</option>
                    <option value="page_takeover">⚡ Fullscreen Page Takeover (Level 3)</option>
                    <option value="sticky_bar">📌 Sticky Announcement Bar (Level 2)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Primary Display Headline</label>
                  <input 
                    type="text"
                    value={draftTool.headline}
                    onChange={(e) => setDraftTool({ ...draftTool, headline: e.target.value })}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Subheadline / Context</label>
                  <input 
                    type="text"
                    value={draftTool.subheadline}
                    onChange={(e) => setDraftTool({ ...draftTool, subheadline: e.target.value })}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              <div className="text-xs">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-slate-400 font-semibold">Initial Greeting Message</label>
                  <EmojiPickerButton onPick={(e) => toolEmoji.insert(e, draftTool.welcomeMessage, (v) => setDraftTool({ ...draftTool, welcomeMessage: v }))} placement="down" />
                </div>
                <textarea 
                  rows={2}
                  ref={toolEmoji.ref}
                  value={draftTool.welcomeMessage}
                  onChange={(e) => setDraftTool({ ...draftTool, welcomeMessage: e.target.value })}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-400 resize-none"
                />
              </div>

              {/* Modular Plan & Access Level Selection */}
              <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs">
                <div>
                  <label className="block text-slate-400 font-semibold mb-0.5">Assigned Plan &amp; Access Tier</label>
                  <span className="text-[11px] text-slate-500">Defines which client plan or entitlement package this tool belongs to.</span>
                </div>
                <select
                  value={draftTool.planId || draftTool.accessLevel}
                  onChange={(e) => {
                    const selectedPlanId = e.target.value;
                    setDraftTool({ ...draftTool, planId: selectedPlanId, accessLevel: selectedPlanId as any });
                  }}
                  className="bg-slate-950 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-cyan-300 font-bold focus:outline-none"
                >
                  {plans.map(p => (
                    <option key={p.id} value={p.id}>{p.name} {p.price ? `(${p.price})` : ''}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Section 2: Automation & Connected Bot Map */}
            <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
              <span className="font-bold text-white text-xs flex items-center gap-1.5 text-blue-300">
                <Workflow className="w-3.5 h-3.5 text-blue-400" />
                2. Connected Bot Map &amp; Lead Capture
              </span>

              <div className="text-xs space-y-2">
                <label className="block text-slate-400 font-semibold">Active Bot Map Flow</label>
                <div className="flex items-center gap-2">
                  <select
                    value={draftTool.connectedBotId}
                    onChange={(e) => setDraftTool({ ...draftTool, connectedBotId: e.target.value })}
                    className="flex-1 bg-slate-950 border border-cyan-500/30 rounded-xl px-3 py-2 text-cyan-300 font-medium focus:outline-none focus:border-cyan-400"
                  >
                    {availableBots.map(bot => (
                      <option key={bot.id} value={bot.id}>
                        🤖 {bot.name} ({bot.id})
                      </option>
                    ))}
                  </select>

                  {onNavigateToFlows && (
                    <button
                      type="button"
                      onClick={() => onNavigateToFlows(draftTool.connectedBotId)}
                      className="px-3 py-2 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-semibold text-xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Open Bot Canvas</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Pre-chat lead capture toggles */}
              <div className="pt-2 border-t border-white/5 flex items-center gap-6 text-xs text-slate-300 flex-wrap">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="checkbox"
                    checked={draftTool.requireEmailCapture}
                    onChange={(e) => setDraftTool({ ...draftTool, requireEmailCapture: e.target.checked })}
                    className="rounded accent-cyan-500"
                  />
                  <span>Capture Email before initiating chat</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="checkbox"
                    checked={draftTool.requireNameCapture}
                    onChange={(e) => setDraftTool({ ...draftTool, requireNameCapture: e.target.checked })}
                    className="rounded accent-cyan-500"
                  />
                  <span>Ask for First Name</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="checkbox"
                    checked={draftTool.removeBranding || false}
                    onChange={(e) => setDraftTool({ ...draftTool, removeBranding: e.target.checked })}
                    className="rounded accent-cyan-500"
                  />
                  <span>Remove ChatMize Watermark (Whitelabel)</span>
                </label>
              </div>
            </div>

            {/* Section 3: Trigger Rules & Appearance */}
            <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
              <span className="font-bold text-white text-xs flex items-center gap-1.5 text-emerald-300">
                <Sliders className="w-3.5 h-3.5 text-emerald-400" />
                3. Trigger Timing &amp; Appearance
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="block text-slate-400 mb-1">Trigger Type</label>
                  <select
                    value={draftTool.triggerType}
                    onChange={(e) => setDraftTool({ ...draftTool, triggerType: e.target.value as any })}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-2.5 py-2 text-white focus:outline-none"
                  >
                    <option value="immediate">Immediate on Load</option>
                    <option value="time_delay">Time Delay (Seconds)</option>
                    <option value="exit_intent">Exit-Intent (Mouse Leave)</option>
                    <option value="scroll_depth">Scroll Depth (%)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Delay (Seconds)</label>
                  <input 
                    type="number"
                    min={0}
                    max={60}
                    value={draftTool.triggerDelaySeconds}
                    onChange={(e) => setDraftTool({ ...draftTool, triggerDelaySeconds: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-2.5 py-2 text-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Screen Position</label>
                  <select
                    value={draftTool.position}
                    onChange={(e) => setDraftTool({ ...draftTool, position: e.target.value as any })}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-2.5 py-2 text-white focus:outline-none"
                  >
                    <option value="bottom_right">Bottom Right</option>
                    <option value="bottom_left">Bottom Left</option>
                    <option value="center">Centered Lightbox</option>
                    <option value="top_bar">Top Sticky Bar</option>
                  </select>
                </div>
              </div>

              {/* Color Presets */}
              <div className="text-xs pt-2">
                <label className="block text-slate-400 mb-1.5">Brand Accent Color</label>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    {COLOR_PRESETS.map((preset) => (
                      <button
                        key={preset.hex}
                        type="button"
                        onClick={() => setDraftTool({ ...draftTool, brandColor: preset.hex })}
                        style={{ backgroundColor: preset.hex }}
                        className={`w-6 h-6 rounded-full transition-transform cursor-pointer ${
                          draftTool.brandColor.toLowerCase() === preset.hex.toLowerCase() ? 'scale-125 ring-2 ring-white shadow-lg' : 'hover:scale-110'
                        }`}
                        title={preset.name}
                      />
                    ))}
                  </div>
                  <div className="flex items-center gap-1.5 ml-3 bg-slate-950 border border-white/10 px-2 py-1 rounded-xl">
                    <input 
                      type="color"
                      value={draftTool.brandColor}
                      onChange={(e) => setDraftTool({ ...draftTool, brandColor: e.target.value })}
                      className="w-5 h-5 rounded cursor-pointer bg-transparent border-0"
                    />
                    <span className="font-mono text-xs text-slate-300">{draftTool.brandColor}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Action Row */}
            <div className="pt-2 flex items-center justify-end gap-2 border-t border-white/10">
              <button
                onClick={() => setActiveViewMode('hub')}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Back to All Tools
              </button>
              <button
                onClick={() => handleSaveDraft(false)}
                className="px-6 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 font-bold rounded-xl text-xs shadow-lg shadow-cyan-500/20 cursor-pointer hover:brightness-110 flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Save Changes</span>
              </button>
            </div>

          </div>

          {/* Right Column: Live Interactive Device Preview (5 cols) */}
          <div className="lg:col-span-5 space-y-2 sticky top-4">
            <div className="flex items-center justify-between px-3 py-2 bg-white/5 rounded-xl text-xs border border-white/5 text-slate-300">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>Real-Time Device Simulator</span>
              </div>
              <button
                onClick={() => setEmbedModalTool(draftTool)}
                className="text-cyan-300 hover:underline flex items-center gap-1 text-[11px] font-semibold cursor-pointer"
              >
                <Code className="w-3 h-3" />
                <span>Get Embed Code</span>
              </button>
            </div>

            <div className="h-[620px]">
              <NurtureSimulator 
                tool={draftTool} 
                onLeadCaptured={(name, email) => {
                  setTools(prev => prev.map(t => {
                    if (t.id === draftTool.id) {
                      return { ...t, totalLeads: (t.totalLeads || 0) + 1 };
                    }
                    return t;
                  }));
                  showToast(`Simulated lead captured: ${name} (${email})`);
                }}
              />
            </div>
          </div>

        </div>
        </div>
      )}

      {/* =========================================================================
          VIEW MODE 3: DEDICATED LIVE SIMULATOR
          ========================================================================= */}
      {(activeChildTab === 'preview' || activeChildTab === 'simulator' || (activeViewMode === 'preview' && !['setup_wizard', 'support_widget', 'popup_modal', 'slider', 'page_takeover', 'sticky_bar', 'saved', 'editor', 'packages'].includes(activeChildTab))) && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <button
              onClick={() => handleSwitchChildTab('saved')}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold border border-white/10 transition-all cursor-pointer shadow-sm"
            >
              <ArrowLeft className="w-4 h-4 text-cyan-400" />
              <span>Back to Saved Tools</span>
            </button>
          </div>

          <div className="flex items-center justify-between p-3 bg-slate-900 border border-white/10 rounded-2xl">
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-400">Testing Tool:</span>
              <select
                value={selectedToolId}
                onChange={(e) => setSelectedToolId(e.target.value)}
                className="bg-slate-950 border border-cyan-500/30 rounded-xl px-3 py-1.5 text-xs text-cyan-300 font-bold focus:outline-none"
              >
                {tools.map(t => (
                  <option key={t.id} value={t.id}>{t.name} ({getToolTypeBadge(t.type).label})</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setDraftTool(activeTool);
                  setActiveViewMode('editor');
                }}
                className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-cyan-300 rounded-xl text-xs font-semibold flex items-center gap-1 cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit This Tool</span>
              </button>
              <button
                onClick={() => setEmbedModalTool(activeTool)}
                className="px-3.5 py-1.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-md shadow-cyan-500/20"
              >
                <Code className="w-3.5 h-3.5" />
                <span>Embed Code</span>
              </button>
            </div>
          </div>

          <div className="h-[680px]">
            <NurtureSimulator 
              tool={activeTool} 
              onLeadCaptured={(name, email) => {
                setTools(prev => prev.map(t => {
                  if (t.id === activeTool.id) {
                    return { ...t, totalLeads: (t.totalLeads || 0) + 1 };
                  }
                  return t;
                }));
                showToast(`Simulated lead captured: ${name} (${email})`);
              }}
            />
          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW MODE 4: MODULAR PLANS & PACKAGING BUILDER
          ========================================================================= */}
      {(activeChildTab === 'packages' || (activeViewMode === 'packages' && !['setup_wizard', 'support_widget', 'popup_modal', 'slider', 'page_takeover', 'sticky_bar', 'saved', 'editor', 'preview', 'simulator'].includes(activeChildTab))) && (
        <div className="space-y-6 animate-in fade-in duration-200">
          
          <div className="flex items-center justify-between">
            <button
              onClick={() => handleSwitchChildTab('saved')}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold border border-white/10 transition-all cursor-pointer shadow-sm"
            >
              <ArrowLeft className="w-4 h-4 text-cyan-400" />
              <span>Back to Saved Tools</span>
            </button>
          </div>

          {/* Header Description & Main Builder Trigger */}
          <div className="p-5 rounded-2xl bg-gradient-to-r from-purple-900/30 via-slate-900 to-blue-900/30 border border-purple-500/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Crown className="w-4 h-4 text-purple-400" />
                <span className="text-purple-300 text-xs font-mono font-bold tracking-wider uppercase">
                  Modular Plan Builder &amp; Packaging
                </span>
              </div>
              <h2 className="text-lg font-bold text-white">Dynamic Packaging &amp; Entitlement Levels</h2>
              <p className="text-xs text-slate-300 mt-1 max-w-2xl">
                Build and customize modular client tiers without hardcoded limits. Choose which Nurture Tool archetypes are unlocked, configure quotas, set pricing, and test entitlements in real-time.
              </p>
            </div>

            <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
              {/* Current Account Simulation Switcher */}
              <div className="p-3 rounded-xl bg-slate-950/80 border border-white/10 flex items-center gap-2.5">
                <div>
                  <span className="text-[10px] text-slate-400 block font-medium">Simulated Plan:</span>
                  <span className="text-xs font-bold text-cyan-300 capitalize">
                    {currentAccountPlanId === 'all_access' ? 'All-Access Sandbox' : (plans.find(p => p.id === currentAccountPlanId)?.name || currentAccountPlanId)}
                  </span>
                </div>
                <select
                  value={currentAccountPlanId}
                  onChange={(e) => handleSetAccountPlan(e.target.value)}
                  className="bg-white/10 border border-white/15 rounded-lg px-2.5 py-1 text-xs text-white font-semibold focus:outline-none cursor-pointer"
                >
                  <option value="all_access" className="bg-slate-900">★ All-Access Sandbox</option>
                  {plans.map(p => (
                    <option key={p.id} value={p.id} className="bg-slate-900">{p.name}</option>
                  ))}
                </select>
              </div>

              {/* Build Plan CTA */}
              <button
                onClick={handleOpenCreatePlan}
                className="px-4 py-2.5 bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-400 hover:to-pink-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-purple-500/20 flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                <span>Build New Plan</span>
              </button>
            </div>
          </div>

          {/* Dynamic Plans Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {plans.map((plan) => {
              const isCurrent = currentAccountPlanId === plan.id;
              const toolsInPlan = tools.filter(t => t.planId === plan.id || t.accessLevel === plan.id);
              const planColor = plan.color || '#00d2ff';

              return (
                <div
                  key={plan.id}
                  className={`rounded-2xl p-5 border transition-all relative flex flex-col justify-between ${
                    isCurrent 
                      ? 'bg-slate-900 shadow-xl ring-1' 
                      : 'bg-slate-900/60 border-white/10 hover:border-white/20'
                  }`}
                  style={{
                    borderColor: isCurrent ? planColor : undefined,
                    boxShadow: isCurrent ? `0 10px 25px -5px ${planColor}20` : undefined
                  }}
                >
                  <div>
                    {/* Top Row: Plan Name, Active Badge & Actions */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span 
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: planColor }}
                        />
                        <span 
                          className="text-[11px] font-bold px-2.5 py-0.5 rounded-full border"
                          style={{
                            borderColor: `${planColor}50`,
                            backgroundColor: `${planColor}15`,
                            color: planColor
                          }}
                        >
                          {plan.name}
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        {isCurrent && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                            Active
                          </span>
                        )}
                        <button
                          onClick={() => handleOpenEditPlan(plan)}
                          className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
                          title="Edit Plan Configuration"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDuplicatePlan(plan)}
                          className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
                          title="Duplicate Plan"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        {plans.length > 1 && (
                          <button
                            onClick={() => handleDeletePlan(plan.id)}
                            className="p-1 rounded-lg hover:bg-red-500/20 text-slate-400 hover:text-red-300 transition-colors cursor-pointer"
                            title="Delete Plan"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Pricing */}
                    <div className="flex items-baseline gap-1.5 my-2">
                      <span className="text-2xl font-bold text-white">
                        {plan.price && plan.price.trim() !== '' ? plan.price : 'Custom Tier'}
                      </span>
                      {plan.price && plan.price.includes('/') ? null : (
                        <span className="text-xs text-slate-400">/ license</span>
                      )}
                    </div>

                    <p className="text-xs text-slate-400 mb-4 min-h-[36px] line-clamp-2">
                      {plan.description || 'Configured via Plan Builder with tailored entitlements.'}
                    </p>

                    {/* Modular Quotas */}
                    <div className="p-3 rounded-xl bg-white/5 border border-white/5 space-y-2 text-xs mb-4">
                      <div className="flex items-center justify-between text-slate-300">
                        <span className="text-slate-400">Active Tools Limit:</span>
                        <strong className="text-white font-mono">
                          {plan.maxActiveTools === -1 ? 'Unlimited' : `${plan.maxActiveTools} active`}
                        </strong>
                      </div>
                      <div className="flex items-center justify-between text-slate-300">
                        <span className="text-slate-400">Allowed Domains:</span>
                        <strong className="text-white font-mono">
                          {plan.maxDomains === -1 ? 'Unlimited' : (plan.maxDomains === 1 ? '1 Domain' : `${plan.maxDomains} Domains`)}
                        </strong>
                      </div>
                      <div className="flex items-center justify-between text-slate-300 pt-1 border-t border-white/5">
                        <span className="text-slate-400">Tools on this Plan:</span>
                        <strong className="text-cyan-300 font-mono font-bold">
                          {toolsInPlan.length} {toolsInPlan.length === 1 ? 'tool' : 'tools'}
                        </strong>
                      </div>
                    </div>

                    {/* Unlocked Tool Archetypes */}
                    <div className="space-y-1.5 mb-4">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                        Included Archetypes ({plan.includedToolTypes.length}/5)
                      </span>
                      
                      {[
                        { type: 'support_widget', label: 'Support Chat Bubble' },
                        { type: 'popup_modal', label: 'Exit Popups & Modals' },
                        { type: 'slider', label: 'Corner Sliders' },
                        { type: 'sticky_bar', label: 'Sticky Announcement Bars' },
                        { type: 'page_takeover', label: 'Fullscreen Takeovers' }
                      ].map(item => {
                        const isAllowed = plan.includedToolTypes.includes(item.type as any);
                        return (
                          <div key={item.type} className="flex items-center justify-between text-xs py-1 px-1.5 rounded hover:bg-white/5">
                            <span className={isAllowed ? 'text-slate-200' : 'text-slate-500 line-through'}>
                              {item.label}
                            </span>
                            {isAllowed ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Lock className="w-3.5 h-3.5 text-slate-600" />
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Advanced Modular Feature Toggles */}
                    <div className="pt-3 border-t border-white/5 space-y-1.5">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                        Modular Capabilities
                      </span>

                      {[
                        { label: 'Exit-Intent Triggering', enabled: plan.features?.exitIntent },
                        { label: 'Meta Pixel Conversion Events', enabled: plan.features?.metaPixelEvents },
                        { label: 'Remove ChatMize Watermark', enabled: plan.features?.removeBranding },
                        { label: 'Autonomous AI Voice Bot', enabled: plan.features?.aiAutonomousAgent },
                        { label: 'Unlimited Domains Whitelist', enabled: plan.features?.unlimitedDomains }
                      ].map((feat, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs py-0.5">
                          <span className={feat.enabled ? 'text-slate-300' : 'text-slate-500'}>
                            {feat.label}
                          </span>
                          {feat.enabled ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
                          ) : (
                            <span className="text-[10px] text-slate-600 font-mono">No</span>
                          )}
                        </div>
                      ))}
                    </div>

                  </div>

                  {/* Plan Simulation CTA */}
                  <div className="mt-5 pt-3 border-t border-white/10 flex items-center gap-2">
                    <button
                      onClick={() => {
                        handleSetAccountPlan(plan.id);
                        showToast(`Switched simulated account to ${plan.name}`);
                      }}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        isCurrent 
                          ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20' 
                          : 'bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10'
                      }`}
                    >
                      {isCurrent ? 'Currently Simulated' : `Simulate ${plan.name}`}
                    </button>
                    <button
                      onClick={() => handleOpenEditPlan(plan)}
                      className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 text-xs font-semibold cursor-pointer"
                      title="Edit Plan"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                </div>
              );
            })}

            {/* Add New Plan Card */}
            <div
              onClick={handleOpenCreatePlan}
              className="rounded-2xl p-6 border-2 border-dashed border-white/15 hover:border-purple-500/50 bg-slate-900/30 hover:bg-purple-950/10 transition-all flex flex-col items-center justify-center text-center cursor-pointer min-h-[360px] group"
            >
              <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/30 text-purple-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <Plus className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-white group-hover:text-purple-300 transition-colors">
                Build Another Plan
              </h3>
              <p className="text-xs text-slate-400 mt-1 max-w-xs">
                Create a bespoke package tier with custom archetype allowances, tool quotas, and pricing rules.
              </p>
              <span className="mt-4 px-3 py-1.5 rounded-xl bg-purple-500/20 text-purple-300 text-xs font-semibold border border-purple-500/30">
                + Open Plan Builder
              </span>
            </div>
          </div>

          {/* Modular Packaging Architecture Explanation */}
          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2">
            <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
              <Info className="w-4 h-4 text-cyan-400" />
              How Modular Plans &amp; Archetype Entitlements Work
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Every Nurture Tool belongs to a modular plan or tier. You can design any number of plans with custom quotas (active tool limits, domain counts) and select specifically which of the 5 Nurture Tool archetypes (Chat Bubbles, Exit Popups, Sliders, Sticky Bars, Takeovers) are included. When testing in the simulator or preview, switching the active simulated plan tests how tool access gates behave.
            </p>
          </div>

        </div>
      )}

      {/* =========================================================================
          CREATE TOOL MODAL (ARCHETYPE SELECTION WITH LEVEL BADGES)
          ========================================================================= */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/15 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200">
            
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-cyan-400" />
                  Select Nurture Tool Archetype
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Choose a high-converting format to engage website visitors and capture qualified leads.
                </p>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[460px] overflow-y-auto pr-1">
              
              {/* Option 1: Live Support Widget */}
              <div
                onClick={() => handleCreateArchetype('support_widget')}
                className="p-4 rounded-xl border border-white/10 hover:border-cyan-500/50 bg-slate-950/60 hover:bg-slate-950 transition-all cursor-pointer space-y-2 group"
              >
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center">
                    <MessageSquare className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                    Level 1: Starter
                  </span>
                </div>
                <h4 className="text-sm font-bold text-white group-hover:text-cyan-300 transition-colors">
                  24/7 Live Support Chat Bubble
                </h4>
                <p className="text-xs text-slate-400">
                  Floating bottom-corner chat widget that resolves questions and connects seamlessly to your Bot Maps.
                </p>
              </div>

              {/* Option 2: Exit-Intent Popup */}
              <div
                onClick={() => handleCreateArchetype('popup_modal')}
                className="p-4 rounded-xl border border-white/10 hover:border-blue-500/50 bg-slate-950/60 hover:bg-slate-950 transition-all cursor-pointer space-y-2 group"
              >
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
                    <Layout className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                    Level 2: Growth
                  </span>
                </div>
                <h4 className="text-sm font-bold text-white group-hover:text-blue-300 transition-colors">
                  Exit-Intent &amp; Delay Popup
                </h4>
                <p className="text-xs text-slate-400">
                  Captures abandoning visitors when their cursor leaves the window or after browsing for X seconds.
                </p>
              </div>

              {/* Option 3: Corner Slider */}
              <div
                onClick={() => handleCreateArchetype('slider')}
                className="p-4 rounded-xl border border-white/10 hover:border-emerald-500/50 bg-slate-950/60 hover:bg-slate-950 transition-all cursor-pointer space-y-2 group"
              >
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                    <Sliders className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                    Level 2: Growth
                  </span>
                </div>
                <h4 className="text-sm font-bold text-white group-hover:text-emerald-300 transition-colors">
                  Corner Interactive Slider
                </h4>
                <p className="text-xs text-slate-400">
                  Subtle slide-in drawer that pops up at specific scroll depths to help visitors compare pricing or options.
                </p>
              </div>

              {/* Option 4: Sticky Notification Bar */}
              <div
                onClick={() => handleCreateArchetype('sticky_bar')}
                className="p-4 rounded-xl border border-white/10 hover:border-amber-500/50 bg-slate-950/60 hover:bg-slate-950 transition-all cursor-pointer space-y-2 group"
              >
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
                    <Layers className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                    Level 2: Growth
                  </span>
                </div>
                <h4 className="text-sm font-bold text-white group-hover:text-amber-300 transition-colors">
                  Sticky Announcement &amp; Promo Bar
                </h4>
                <p className="text-xs text-slate-400">
                  Fixed top or bottom banner that grabs visitor attention with flash sales and 1-click bot triggers.
                </p>
              </div>

              {/* Option 5: Page Takeover */}
              <div
                onClick={() => handleCreateArchetype('page_takeover')}
                className="p-4 rounded-xl border border-white/10 hover:border-pink-500/50 bg-slate-950/60 hover:bg-slate-950 transition-all cursor-pointer space-y-2 group sm:col-span-2"
              >
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-lg bg-pink-500/10 text-pink-400 flex items-center justify-center">
                    <Maximize2 className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/30">
                    Level 3: Agency &amp; Enterprise
                  </span>
                </div>
                <h4 className="text-sm font-bold text-white group-hover:text-pink-300 transition-colors">
                  Fullscreen Product Launch Takeover
                </h4>
                <p className="text-xs text-slate-400">
                  High-impact fullscreen overlay designed for major product releases, webinars, and VIP invite portals.
                </p>
              </div>

            </div>

            <div className="pt-2 flex items-center justify-end border-t border-white/10">
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
            </div>

          </div>
        </div>
      )}

      {/* =========================================================================
          PLAN BUILDER MODAL (CREATE & EDIT MODULAR PLANS)
          ========================================================================= */}
      {isPlanModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-white/15 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200 my-8">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Crown className="w-5 h-5 text-purple-400" />
                  <span>{editingPlanId ? 'Edit Nurture Plan' : 'Build Custom Nurture Plan'}</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Define plan name, pricing, quotas, archetype inclusions, and modular capabilities.
                </p>
              </div>
              <button
                onClick={() => setIsPlanModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form Content */}
            <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
              
              {/* Row 1: Name & Price */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Plan Name *</label>
                  <input data-no-emoji
                    type="text"
                    value={planForm.name}
                    onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
                    placeholder="e.g. Starter, Growth, VIP Retainer"
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-400"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Display Price (Optional)</label>
                  <input data-no-emoji
                    type="text"
                    value={planForm.price || ''}
                    onChange={(e) => setPlanForm({ ...planForm, price: e.target.value })}
                    placeholder="e.g. $49/mo, Free, or leave blank"
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-400"
                  />
                </div>
              </div>

              {/* Row 2: Description */}
              <div className="text-xs">
                <label className="block text-slate-300 font-semibold mb-1">Plan Description</label>
                <textarea
                  data-no-emoji
                  rows={2}
                  value={planForm.description || ''}
                  onChange={(e) => setPlanForm({ ...planForm, description: e.target.value })}
                  placeholder="Summary of who this plan is intended for and what value it delivers..."
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-400 resize-none"
                />
              </div>

              {/* Row 3: Accent Color Selector */}
              <div className="text-xs space-y-1.5">
                <label className="block text-slate-300 font-semibold">Accent Color Theme</label>
                <div className="flex items-center gap-2 flex-wrap">
                  {COLOR_PRESETS.map((preset) => (
                    <button
                      key={preset.hex}
                      type="button"
                      onClick={() => setPlanForm({ ...planForm, color: preset.hex })}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition-all cursor-pointer ${
                        planForm.color === preset.hex 
                          ? 'border-white text-white bg-white/10 shadow-sm' 
                          : 'border-white/10 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: preset.hex }} />
                      <span>{preset.name}</span>
                    </button>
                  ))}
                  <input
                    type="color"
                    value={planForm.color || '#00d2ff'}
                    onChange={(e) => setPlanForm({ ...planForm, color: e.target.value })}
                    className="w-7 h-7 rounded border border-white/10 bg-transparent cursor-pointer p-0.5"
                    title="Choose custom color"
                  />
                </div>
              </div>

              {/* Row 4: Quotas & Limits */}
              <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 space-y-3">
                <span className="font-bold text-white text-xs flex items-center gap-1.5 text-cyan-300">
                  <Shield className="w-3.5 h-3.5 text-cyan-400" />
                  Plan Limits &amp; Quotas
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-slate-300 font-semibold">Max Active Tools</label>
                      <label className="flex items-center gap-1 text-[11px] text-slate-400 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={planForm.maxActiveTools === -1}
                          onChange={(e) => setPlanForm({ ...planForm, maxActiveTools: e.target.checked ? -1 : 5 })}
                          className="rounded border-white/20 text-cyan-400 focus:ring-0"
                        />
                        <span>Unlimited</span>
                      </label>
                    </div>
                    {planForm.maxActiveTools !== -1 ? (
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={planForm.maxActiveTools}
                        onChange={(e) => setPlanForm({ ...planForm, maxActiveTools: Math.max(1, parseInt(e.target.value) || 1) })}
                        className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-1.5 text-white focus:outline-none focus:border-cyan-400"
                      />
                    ) : (
                      <div className="w-full bg-slate-950/60 border border-white/5 rounded-xl px-3 py-1.5 text-slate-500 font-mono text-xs">
                        Unlimited active tools
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-slate-300 font-semibold">Domain Whitelist Limit</label>
                      <label className="flex items-center gap-1 text-[11px] text-slate-400 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={planForm.maxDomains === -1}
                          onChange={(e) => setPlanForm({ ...planForm, maxDomains: e.target.checked ? -1 : 1 })}
                          className="rounded border-white/20 text-cyan-400 focus:ring-0"
                        />
                        <span>Unlimited</span>
                      </label>
                    </div>
                    {planForm.maxDomains !== -1 ? (
                      <input
                        type="number"
                        min="1"
                        max="50"
                        value={planForm.maxDomains}
                        onChange={(e) => setPlanForm({ ...planForm, maxDomains: Math.max(1, parseInt(e.target.value) || 1) })}
                        className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-1.5 text-white focus:outline-none focus:border-cyan-400"
                      />
                    ) : (
                      <div className="w-full bg-slate-950/60 border border-white/5 rounded-xl px-3 py-1.5 text-slate-500 font-mono text-xs">
                        Unlimited domains
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Row 5: Included Nurture Tool Archetypes */}
              <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white text-xs flex items-center gap-1.5 text-purple-300">
                    <Boxes className="w-3.5 h-3.5 text-purple-400" />
                    Included Tool Archetypes ({planForm.includedToolTypes.length}/5)
                  </span>
                  <div className="flex items-center gap-2 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setPlanForm({
                        ...planForm,
                        includedToolTypes: ['support_widget', 'popup_modal', 'slider', 'sticky_bar', 'page_takeover']
                      })}
                      className="text-cyan-400 hover:underline cursor-pointer"
                    >
                      Select All
                    </button>
                    <span className="text-slate-600">•</span>
                    <button
                      type="button"
                      onClick={() => setPlanForm({
                        ...planForm,
                        includedToolTypes: ['support_widget']
                      })}
                      className="text-slate-400 hover:underline cursor-pointer"
                    >
                      Reset to Basic
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  {[
                    { type: 'support_widget', label: '24/7 Live Support Chat Bubble', desc: 'Corner chat bubble with automated FAQ & Bot Map routing' },
                    { type: 'popup_modal', label: 'Exit-Intent & Delay Popup Modal', desc: 'Triggered when cursor leaves screen or after delay' },
                    { type: 'slider', label: 'Corner Interactive Slider Drawer', desc: 'Slide-out engagement drawer triggered by scroll or click' },
                    { type: 'sticky_bar', label: 'Sticky Announcement & Promo Bar', desc: 'Fixed top or bottom notification banner with CTA button' },
                    { type: 'page_takeover', label: 'Fullscreen Product Launch Takeover', desc: 'High-impact full-screen modal for campaigns and product drops' }
                  ].map((archetype) => {
                    const isSelected = planForm.includedToolTypes.includes(archetype.type as NurtureToolType);
                    return (
                      <div
                        key={archetype.type}
                        onClick={() => {
                          const exists = planForm.includedToolTypes.includes(archetype.type as NurtureToolType);
                          const next = exists 
                            ? planForm.includedToolTypes.filter(t => t !== archetype.type)
                            : [...planForm.includedToolTypes, archetype.type as NurtureToolType];
                          setPlanForm({ ...planForm, includedToolTypes: next });
                        }}
                        className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                          isSelected 
                            ? 'bg-purple-950/30 border-purple-500/40 text-white' 
                            : 'bg-slate-950/40 border-white/5 text-slate-400 hover:bg-white/5'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}} // handled by parent div
                            className="rounded border-white/20 text-purple-500 focus:ring-0 cursor-pointer"
                          />
                          <div>
                            <span className="text-xs font-semibold block">{archetype.label}</span>
                            <span className="text-[11px] text-slate-400 block">{archetype.desc}</span>
                          </div>
                        </div>
                        {isSelected ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                            Included
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-600 font-mono">
                            Excluded
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Row 6: Modular Capabilities Toggles */}
              <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 space-y-3">
                <span className="font-bold text-white text-xs flex items-center gap-1.5 text-blue-300">
                  <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                  Modular Capabilities &amp; Feature Flags
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {[
                    { key: 'exitIntent', label: 'Exit-Intent Triggering', desc: 'Detect cursor leaving window' },
                    { key: 'removeBranding', label: 'Remove Branding / Watermark', desc: 'White-label embeds for client sites' },
                    { key: 'metaPixelEvents', label: 'Meta Pixel Conversion Sync', desc: 'Dispatch Lead/Contact events to Pixel' },
                    { key: 'aiAutonomousAgent', label: 'Autonomous AI Voice Bot', desc: 'Conversational LLM response engine' },
                    { key: 'customCSS', label: 'Custom CSS & Font Overrides', desc: 'Allow custom style injections' },
                    { key: 'unlimitedDomains', label: 'Unlimited Domains License', desc: 'Deploy across infinite client URLs' }
                  ].map((feat) => {
                    const isEnabled = (planForm.features as any)?.[feat.key] || false;
                    return (
                      <label
                        key={feat.key}
                        className={`p-2.5 rounded-xl border flex items-start justify-between gap-2 cursor-pointer transition-all ${
                          isEnabled 
                            ? 'bg-blue-950/20 border-blue-500/30 text-white' 
                            : 'bg-slate-950/40 border-white/5 text-slate-400'
                        }`}
                      >
                        <div>
                          <span className="font-semibold block">{feat.label}</span>
                          <span className="text-[10px] text-slate-500 block">{feat.desc}</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={isEnabled}
                          onChange={(e) => {
                            setPlanForm({
                              ...planForm,
                              features: {
                                ...planForm.features,
                                [feat.key]: e.target.checked
                              }
                            });
                          }}
                          className="mt-0.5 rounded border-white/20 text-cyan-400 focus:ring-0 cursor-pointer"
                        />
                      </label>
                    );
                  })}
                </div>
              </div>

            </div>

            {/* Modal Actions */}
            <div className="pt-3 flex items-center justify-between border-t border-white/10">
              <button
                type="button"
                onClick={() => setIsPlanModalOpen(false)}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleSavePlan}
                className="px-5 py-2 bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-400 hover:to-cyan-400 text-slate-950 font-bold rounded-xl text-xs shadow-md shadow-purple-500/20 cursor-pointer flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{editingPlanId ? 'Save Plan Changes' : 'Create Custom Plan'}</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* =========================================================================
          EMBED CODE MODAL
          ========================================================================= */}
      {embedModalTool && (
        <NurtureEmbedModal 
          tool={embedModalTool} 
          onClose={() => setEmbedModalTool(null)} 
        />
      )}

    </div>
  );
};

// Also export as ConvertMateView for backwards compatibility
export const ConvertMateView = NurtureToolsView;
