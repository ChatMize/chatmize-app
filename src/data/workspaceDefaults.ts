import { WorkspaceSilo, KanbanCard, KanbanColumn } from '../types/workspace';

export const DEFAULT_WORKSPACES: WorkspaceSilo[] = [
  {
    id: 'ws-chatmize-prod',
    name: 'Chatmize (Official Account)',
    slug: 'chatmize-official',
    businessType: 'saas',
    color: '#06b6d4',
    ownerName: 'Karl Schuckert',
    avatarUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=120&auto=format&fit=crop&q=80',
    connectedPage: {
      pageId: '102938475819203',
      pageName: 'Chatmize',
      pageCategory: 'Software & Marketing Tech',
      connectedAt: '2026-07-01',
      ownerName: 'Karl Schuckert',
      serviceStatus: 'active',
      avatarUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=120&auto=format&fit=crop&q=80',
      connectedIg: {
        username: '@chatmize',
        igId: '17841400018274',
        followersCount: 14850,
        connected: true,
        status: 'active'
      },
      connectedWhatsApp: {
        phoneNumber: '+1 (833) 734-6283',
        wabaId: 'waba_chatmize_hq',
        verified: true,
        connected: true,
        status: 'active'
      },
      connectedSms: {
        phoneNumber: '+1 (833) 734-6283',
        provider: 'twilio',
        status: 'active',
        connected: true,
        compliant10dlc: true,
        monthlyCredits: 25000,
        autoKeywords: ['STOP', 'START', 'HELP', 'CHATMIZE', 'DEMO']
      },
      connectedStandaloneChat: {
        enabled: true,
        status: 'active',
        botName: 'Chatmize AI Assistant',
        welcomeMessage: 'Hey there! Welcome to Chatmize. How can we help automate your business today?',
        primaryColor: '#06b6d4',
        hostedSlug: 'chatmize-official',
        embedSnippet: '<script src="https://chatmize.io/widget.js" data-workspace="chatmize-official" async></script>',
        allowedDomains: ['chatmize.com', '*.chatmize.com', 'app.chatmize.com'],
        businessAssets: ['Main Website (chatmize.com)', 'Marketing Blog', 'Customer Portal App'],
        bubblePosition: 'bottom-right',
        autoPopupSeconds: 5
      }
    },
    connectedSms: {
      phoneNumber: '+1 (833) 734-6283',
      provider: 'twilio',
      status: 'active',
      connected: true,
      compliant10dlc: true,
      monthlyCredits: 25000,
      autoKeywords: ['STOP', 'START', 'HELP', 'CHATMIZE', 'DEMO']
    },
    connectedStandaloneChat: {
      enabled: true,
      status: 'active',
      botName: 'Chatmize AI Assistant',
      welcomeMessage: 'Hey there! Welcome to Chatmize. How can we help automate your business today?',
      primaryColor: '#06b6d4',
      hostedSlug: 'chatmize-official',
      embedSnippet: '<script src="https://chatmize.io/widget.js" data-workspace="chatmize-official" async></script>',
      allowedDomains: ['chatmize.com', '*.chatmize.com', 'app.chatmize.com'],
      businessAssets: ['Main Website (chatmize.com)', 'Marketing Blog', 'Customer Portal App'],
      bubblePosition: 'bottom-right',
      autoPopupSeconds: 5
    },
    planTier: 'pro_unlimited',
    pricingModel: 'segmate_unlimited_pages',
    whitelabel: {
      enabled: true,
      brandName: 'Chatmize Automations',
      customDomain: 'chat.chatmize.com',
      hideChatMizeWatermark: true,
      clientRoleAccess: 'full_admin'
    },
    stats: {
      subscribers: 1312,
      botsCount: 18,
      toolsCount: 12,
      broadcastsCount: 42
    },
    createdAt: '2026-07-01'
  },
  {
    id: 'ws-biz-1',
    name: 'DentalCare Austin (Business 1)',
    slug: 'dentalcare-austin',
    businessType: 'local_business',
    color: '#00d2ff',
    ownerName: 'Karl Schuckert',
    connectedPage: {
      pageId: '109823749102831',
      pageName: 'DentalCare Austin Clinic',
      pageCategory: 'Medical & Dental Clinic',
      connectedAt: '2026-08-10',
      ownerName: 'Karl Schuckert',
      serviceStatus: 'active',
      connectedIg: {
        username: '@dentalcareaustin',
        igId: '17841400029381',
        followersCount: 3850,
        connected: true,
        status: 'active'
      },
      connectedWhatsApp: {
        phoneNumber: '+1 (512) 555-0199',
        wabaId: 'waba_austin_dental_99',
        verified: true,
        connected: true,
        status: 'active'
      },
      connectedSms: {
        phoneNumber: '+1 (512) 555-0199',
        provider: 'twilio',
        status: 'active',
        connected: true,
        compliant10dlc: true,
        monthlyCredits: 5000,
        autoKeywords: ['STOP', 'START', 'APPOINTMENT', 'CLEANING']
      },
      connectedStandaloneChat: {
        enabled: true,
        status: 'active',
        botName: 'SmileBot Virtual Concierge',
        welcomeMessage: 'Hi! Looking to book a cleaning or dental consult in Austin? I can check availability right now.',
        primaryColor: '#00d2ff',
        hostedSlug: 'dentalcare-austin',
        embedSnippet: '<script src="https://chatmize.io/widget.js" data-workspace="dentalcare-austin" async></script>',
        allowedDomains: ['dentalcareaustin.com', 'booking.dentalcareaustin.com'],
        businessAssets: ['Main Practice Website', 'Online Booking Funnel', 'New Patient Intake Page'],
        bubblePosition: 'bottom-right',
        autoPopupSeconds: 3
      }
    },
    connectedSms: {
      phoneNumber: '+1 (512) 555-0199',
      provider: 'twilio',
      status: 'active',
      connected: true,
      compliant10dlc: true,
      monthlyCredits: 5000,
      autoKeywords: ['STOP', 'START', 'APPOINTMENT', 'CLEANING']
    },
    connectedStandaloneChat: {
      enabled: true,
      status: 'active',
      botName: 'SmileBot Virtual Concierge',
      welcomeMessage: 'Hi! Looking to book a cleaning or dental consult in Austin? I can check availability right now.',
      primaryColor: '#00d2ff',
      hostedSlug: 'dentalcare-austin',
      embedSnippet: '<script src="https://chatmize.io/widget.js" data-workspace="dentalcare-austin" async></script>',
      allowedDomains: ['dentalcareaustin.com', 'booking.dentalcareaustin.com'],
      businessAssets: ['Main Practice Website', 'Online Booking Funnel', 'New Patient Intake Page'],
      bubblePosition: 'bottom-right',
      autoPopupSeconds: 3
    },
    planTier: 'standard_page',
    pricingModel: 'manychat_per_page',
    whitelabel: {
      enabled: false,
      hideChatMizeWatermark: false,
      clientRoleAccess: 'campaign_editor'
    },
    stats: {
      subscribers: 2840,
      botsCount: 6,
      toolsCount: 4,
      broadcastsCount: 12
    },
    createdAt: '2026-08-10'
  },
  {
    id: 'ws-sharkbites',
    name: 'SharkBites.TV & Mastermind',
    slug: 'sharkbites-tv',
    businessType: 'creator',
    color: '#3b82f6',
    ownerName: 'Karl Schuckert',
    connectedPage: {
      pageId: '778899001122334',
      pageName: 'Swim with Shark Mastermind',
      pageCategory: 'Entrepreneurship & Media',
      connectedAt: '2026-07-28',
      ownerName: 'Karl Schuckert',
      serviceStatus: 'active',
      connectedIg: {
        username: '@sharkbitestv',
        igId: '17841400049182',
        followersCount: 52100,
        connected: true,
        status: 'active'
      },
      connectedWhatsApp: {
        phoneNumber: '+1 (310) 555-7427',
        wabaId: 'waba_sharkbites_tv',
        verified: true,
        connected: true,
        status: 'active'
      },
      connectedSms: {
        phoneNumber: '+1 (310) 555-7427',
        provider: 'twilio',
        status: 'active',
        connected: true,
        compliant10dlc: true,
        monthlyCredits: 10000,
        autoKeywords: ['VIP', 'REPLAY', 'MASTERMIND', 'STOP']
      },
      connectedStandaloneChat: {
        enabled: true,
        status: 'active',
        botName: 'SharkBites VIP Host',
        welcomeMessage: 'Welcome to the Shark Mastermind. Grab backstage session links or apply for the next cohort below.',
        primaryColor: '#3b82f6',
        hostedSlug: 'sharkbites-tv',
        embedSnippet: '<script src="https://chatmize.io/widget.js" data-workspace="sharkbites-tv" async></script>',
        allowedDomains: ['sharkbites.tv', 'mastermind.sharkbites.tv'],
        businessAssets: ['SharkBites Video Portal', 'Private Mastermind Landing Page'],
        bubblePosition: 'bottom-right'
      }
    },
    connectedSms: {
      phoneNumber: '+1 (310) 555-7427',
      provider: 'twilio',
      status: 'active',
      connected: true,
      compliant10dlc: true,
      monthlyCredits: 10000,
      autoKeywords: ['VIP', 'REPLAY', 'MASTERMIND', 'STOP']
    },
    connectedStandaloneChat: {
      enabled: true,
      status: 'active',
      botName: 'SharkBites VIP Host',
      welcomeMessage: 'Welcome to the Shark Mastermind. Grab backstage session links or apply for the next cohort below.',
      primaryColor: '#3b82f6',
      hostedSlug: 'sharkbites-tv',
      embedSnippet: '<script src="https://chatmize.io/widget.js" data-workspace="sharkbites-tv" async></script>',
      allowedDomains: ['sharkbites.tv', 'mastermind.sharkbites.tv'],
      businessAssets: ['SharkBites Video Portal', 'Private Mastermind Landing Page'],
      bubblePosition: 'bottom-right'
    },
    planTier: 'pro_unlimited',
    pricingModel: 'segmate_unlimited_pages',
    whitelabel: {
      enabled: false,
      hideChatMizeWatermark: false,
      clientRoleAccess: 'campaign_editor'
    },
    stats: {
      subscribers: 1890,
      botsCount: 8,
      toolsCount: 6,
      broadcastsCount: 19
    },
    createdAt: '2026-07-28'
  },
  {
    id: 'ws-biz-2',
    name: 'Spark Apparel Co (Business 2)',
    slug: 'spark-apparel',
    businessType: 'ecommerce',
    color: '#a855f7',
    ownerName: 'Karl Schuckert',
    connectedPage: {
      pageId: '209384729103948',
      pageName: 'Spark Apparel Lifestyle',
      pageCategory: 'Clothing & E-Commerce',
      connectedAt: '2026-08-22',
      ownerName: 'Karl Schuckert',
      serviceStatus: 'active',
      connectedIg: {
        username: '@sparkapparel',
        igId: '17841400099482',
        followersCount: 28900,
        connected: true,
        status: 'active'
      },
      connectedWhatsApp: {
        phoneNumber: '+1 (415) 555-8821',
        wabaId: 'waba_spark_882',
        verified: true,
        connected: true,
        status: 'active'
      },
      connectedSms: {
        phoneNumber: '+1 (415) 555-8821',
        provider: 'twilio',
        status: 'active',
        connected: true,
        compliant10dlc: true,
        monthlyCredits: 15000,
        autoKeywords: ['DEALS', 'DROPS', 'CART', 'STOP']
      },
      connectedStandaloneChat: {
        enabled: true,
        status: 'active',
        botName: 'Spark Stylist AI',
        welcomeMessage: 'Need sizing help or exclusive drop access? Chat with our stylist bot 24/7.',
        primaryColor: '#a855f7',
        hostedSlug: 'spark-apparel',
        embedSnippet: '<script src="https://chatmize.io/widget.js" data-workspace="spark-apparel" async></script>',
        allowedDomains: ['sparkapparel.co', 'checkout.sparkapparel.co'],
        businessAssets: ['Shopify Storefront', 'Checkout Cart Drawer', 'VIP Lookbook Funnel'],
        bubblePosition: 'bottom-right'
      }
    },
    connectedSms: {
      phoneNumber: '+1 (415) 555-8821',
      provider: 'twilio',
      status: 'active',
      connected: true,
      compliant10dlc: true,
      monthlyCredits: 15000,
      autoKeywords: ['DEALS', 'DROPS', 'CART', 'STOP']
    },
    connectedStandaloneChat: {
      enabled: true,
      status: 'active',
      botName: 'Spark Stylist AI',
      welcomeMessage: 'Need sizing help or exclusive drop access? Chat with our stylist bot 24/7.',
      primaryColor: '#a855f7',
      hostedSlug: 'spark-apparel',
      embedSnippet: '<script src="https://chatmize.io/widget.js" data-workspace="spark-apparel" async></script>',
      allowedDomains: ['sparkapparel.co', 'checkout.sparkapparel.co'],
      businessAssets: ['Shopify Storefront', 'Checkout Cart Drawer', 'VIP Lookbook Funnel'],
      bubblePosition: 'bottom-right'
    },
    planTier: 'pro_unlimited',
    pricingModel: 'segmate_unlimited_pages',
    whitelabel: {
      enabled: true,
      customDomain: 'chat.sparkapparel.co',
      brandName: 'Spark Concierge',
      hideChatMizeWatermark: true,
      clientRoleAccess: 'full_admin'
    },
    stats: {
      subscribers: 11450,
      botsCount: 14,
      toolsCount: 8,
      broadcastsCount: 34
    },
    createdAt: '2026-08-22'
  },
  {
    id: 'ws-agency-hq',
    name: 'GrowthScale Agency HQ',
    slug: 'growthscale-hq',
    businessType: 'agency_client',
    color: '#f59e0b',
    ownerName: 'Karl Schuckert',
    connectedPage: {
      pageId: '394827102938471',
      pageName: 'GrowthScale Digital Marketing',
      pageCategory: 'Marketing Agency',
      connectedAt: '2026-07-15',
      ownerName: 'Karl Schuckert',
      serviceStatus: 'active',
      connectedIg: {
        username: '@growthscaleagency',
        igId: '17841400033109',
        followersCount: 14200,
        connected: true,
        status: 'active'
      },
      connectedWhatsApp: {
        phoneNumber: '+1 (800) 555-4400',
        wabaId: 'waba_growthscale_1',
        verified: true,
        connected: true,
        status: 'active'
      },
      connectedSms: {
        phoneNumber: '+1 (800) 555-4400',
        provider: 'telnyx',
        status: 'active',
        connected: true,
        compliant10dlc: true,
        monthlyCredits: 50000,
        autoKeywords: ['AUDIT', 'GROWTH', 'CLIENT', 'STOP']
      },
      connectedStandaloneChat: {
        enabled: true,
        status: 'active',
        botName: 'Agency Onboarding Bot',
        welcomeMessage: 'Want a custom demo of our omni-channel automation pipeline? Let us know your business size.',
        primaryColor: '#f59e0b',
        hostedSlug: 'growthscale-hq',
        embedSnippet: '<script src="https://chatmize.io/widget.js" data-workspace="growthscale-hq" async></script>',
        allowedDomains: ['growthscale.io', 'portal.growthscale.io'],
        businessAssets: ['Main Agency Site', 'Whitelabel Client Portal', 'Audit Application Form'],
        bubblePosition: 'bottom-right'
      }
    },
    connectedSms: {
      phoneNumber: '+1 (800) 555-4400',
      provider: 'telnyx',
      status: 'active',
      connected: true,
      compliant10dlc: true,
      monthlyCredits: 50000,
      autoKeywords: ['AUDIT', 'GROWTH', 'CLIENT', 'STOP']
    },
    connectedStandaloneChat: {
      enabled: true,
      status: 'active',
      botName: 'Agency Onboarding Bot',
      welcomeMessage: 'Want a custom demo of our omni-channel automation pipeline? Let us know your business size.',
      primaryColor: '#f59e0b',
      hostedSlug: 'growthscale-hq',
      embedSnippet: '<script src="https://chatmize.io/widget.js" data-workspace="growthscale-hq" async></script>',
      allowedDomains: ['growthscale.io', 'portal.growthscale.io'],
      businessAssets: ['Main Agency Site', 'Whitelabel Client Portal', 'Audit Application Form'],
      bubblePosition: 'bottom-right'
    },
    planTier: 'agency_bundle',
    pricingModel: 'segmate_unlimited_pages',
    whitelabel: {
      enabled: true,
      customDomain: 'portal.growthscale.io',
      brandName: 'GrowthScale Suite',
      hideChatMizeWatermark: true,
      clientRoleAccess: 'full_admin'
    },
    stats: {
      subscribers: 34900,
      botsCount: 28,
      toolsCount: 16,
      broadcastsCount: 89
    },
    createdAt: '2026-07-15'
  },
  {
    id: 'ws-chatmize-dev',
    name: 'Chatmize Dev Sandbox',
    slug: 'chatmize-dev',
    businessType: 'saas',
    color: '#64748b',
    ownerName: 'Karl Schuckert',
    connectedPage: {
      pageId: '998877665544332',
      pageName: 'Chatmize Dev',
      pageCategory: 'Developer Test Page',
      connectedAt: '2026-09-05',
      ownerName: 'Karl Schuckert',
      serviceStatus: 'deactivated',
      connectedIg: {
        username: '@chatmize.dev',
        igId: '17841400088219',
        followersCount: 12,
        connected: false,
        status: 'deactivated'
      },
      connectedWhatsApp: {
        phoneNumber: '',
        wabaId: '',
        verified: false,
        connected: false,
        status: 'deactivated'
      },
      connectedSms: {
        phoneNumber: '',
        provider: 'twilio',
        status: 'disabled',
        connected: false,
        compliant10dlc: false
      },
      connectedStandaloneChat: {
        enabled: false,
        status: 'deactivated',
        botName: 'Staging Test Bot',
        welcomeMessage: 'Sandbox dev test bot running in staging mode.',
        primaryColor: '#64748b',
        hostedSlug: 'chatmize-dev',
        embedSnippet: '<script src="https://chatmize.io/widget.js" data-workspace="chatmize-dev" async></script>',
        allowedDomains: ['localhost:3000'],
        businessAssets: ['Staging QA Environment'],
        bubblePosition: 'bottom-right'
      }
    },
    connectedSms: {
      phoneNumber: '',
      provider: 'twilio',
      status: 'disabled',
      connected: false,
      compliant10dlc: false
    },
    connectedStandaloneChat: {
      enabled: false,
      status: 'deactivated',
      botName: 'Staging Test Bot',
      welcomeMessage: 'Sandbox dev test bot running in staging mode.',
      primaryColor: '#64748b',
      hostedSlug: 'chatmize-dev',
      embedSnippet: '<script src="https://chatmize.io/widget.js" data-workspace="chatmize-dev" async></script>',
      allowedDomains: ['localhost:3000'],
      businessAssets: ['Staging QA Environment'],
      bubblePosition: 'bottom-right'
    },
    planTier: 'free_light',
    pricingModel: 'manychat_per_page',
    whitelabel: {
      enabled: false,
      hideChatMizeWatermark: false,
      clientRoleAccess: 'viewer_only'
    },
    stats: {
      subscribers: 0,
      botsCount: 1,
      toolsCount: 0,
      broadcastsCount: 0
    },
    createdAt: '2026-09-05'
  }
];

export const KANBAN_COLUMNS: KanbanColumn[] = [
  {
    id: 'backlog',
    title: 'Backlog & Concepts',
    badgeColor: 'bg-slate-500/10 text-slate-300 border-slate-500/30',
    headerBorder: 'border-slate-500/30',
    description: 'Ideas, market models, and feature candidate exploration'
  },
  {
    id: 'spec',
    title: 'Architecture & Spec',
    badgeColor: 'bg-blue-500/10 text-blue-300 border-blue-500/30',
    headerBorder: 'border-blue-500/30',
    description: 'Technical data models, pricing mechanics, and Meta API contracts'
  },
  {
    id: 'in_progress',
    title: 'In Development',
    badgeColor: 'bg-purple-500/10 text-purple-300 border-purple-500/30',
    headerBorder: 'border-purple-500/30',
    description: 'Actively engineered silo logic, UI builders, and token vaults'
  },
  {
    id: 'testing',
    title: 'Testing & Sandbox',
    badgeColor: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
    headerBorder: 'border-amber-500/30',
    description: 'Simulations, permission gating, and multi-tenant stress tests'
  },
  {
    id: 'done',
    title: 'Completed & Live',
    badgeColor: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
    headerBorder: 'border-emerald-500/30',
    description: 'Shipped to production in ChatMize platform'
  }
];

export const INITIAL_KANBAN_CARDS: KanbanCard[] = [
  {
    id: 'card-1',
    title: 'Facebook Page Silo Model (1 FB Page = 1 IG = 1 WhatsApp)',
    description: 'Enforce Meta API constraint: An Instagram Professional account and WhatsApp WABA are strictly tied to a single Facebook Page. Each workspace acts as an isolated silo for that business asset cluster.',
    columnId: 'done',
    category: 'Channels & Meta',
    priority: 'urgent',
    tags: ['Meta Graph API', 'SegMate Paradigm', 'Token Isolation'],
    estimatedEffort: 'Completed',
    assignee: 'Core Arch',
    createdAt: '2026-09-10',
    qaNotes: 'QA Verified: Token isolation between silos confirmed working during multi-page stress test.',
    qaStatus: 'qa_approved',
    qaUpdatedAt: '2026-09-11',
    checklist: [
      { id: 'c1-1', text: 'Bind Page Access Token strictly to Workspace Silo', done: true },
      { id: 'c1-2', text: 'Isolate connected IG Professional account per FB page', done: true },
      { id: 'c1-3', text: 'Isolate connected WhatsApp Cloud WABA per FB page', done: true },
      { id: 'c1-4', text: 'Cross-talk prevention between different business silos', done: true }
    ]
  },
  {
    id: 'card-2',
    title: 'SegMate Unlimited Pages vs. ManyChat Per-Page Pricing Plan',
    description: 'Plan the business model: SegMate allows connecting unlimited FB pages for one flat membership, whereas ManyChat bills per connected page with contact tiering. Design a hybrid tiering structure for ChatMize.',
    columnId: 'in_progress',
    category: 'Billing & Pricing',
    priority: 'high',
    tags: ['Pricing Strategy', 'ManyChat Comparison', 'SegMate Model'],
    estimatedEffort: '3 days',
    assignee: 'Karl / Exec',
    createdAt: '2026-09-11',
    qaNotes: 'AI Agent Directive: Double-check that the pricing matrix displays real-time margin calculations when comparing the $299 agency flat unlimited package against the per-page ManyChat-style tier.',
    qaStatus: 'ready_for_ai',
    qaUpdatedAt: '2026-09-13',
    checklist: [
      { id: 'c2-1', text: 'Model ManyChat-style Free Light tier (500 contacts, 1 page)', done: true },
      { id: 'c2-2', text: 'Model SegMate-style Agency Unlimited Page bundle ($299/mo)', done: true },
      { id: 'c2-3', text: 'Build interactive pricing calculator in Super Admin', done: false },
      { id: 'c2-4', text: 'Define add-on page pricing ($19/mo per extra standalone page)', done: false }
    ]
  },
  {
    id: 'card-3',
    title: 'Agency Multi-Tenant Workspaces (Workspace for Business 1 & 2)',
    description: 'Agencies need to manage distinct clients in dedicated workspaces (e.g. Workspace for Business 1, Business 2) with instant switching, independent flow maps, and isolated contact audiences.',
    columnId: 'in_progress',
    category: 'Workspaces & Accounts',
    priority: 'urgent',
    tags: ['Workspaces', 'Multi-Tenant', 'Agency Scaling'],
    estimatedEffort: '2 days',
    assignee: 'UI/UX Lead',
    createdAt: '2026-09-12',
    checklist: [
      { id: 'c3-1', text: 'Global Workspace Silo Switcher in top navigation', done: true },
      { id: 'c3-2', text: 'Independent bot flows and audiences per workspace silo', done: true },
      { id: 'c3-3', text: 'One-click Create New Business Silo wizard', done: true },
      { id: 'c3-4', text: 'Simulate switching between client silos in real-time', done: true }
    ]
  },
  {
    id: 'card-4',
    title: 'White-Label Portal & Custom CNAME Subdomains',
    description: 'Allow agencies to provide their clients with white-label access to their specific workspace silo with custom domain, custom logo, hidden ChatMize watermarks, and restricted permissions.',
    columnId: 'spec',
    category: 'White-label & Agency',
    priority: 'high',
    tags: ['Whitelabel', 'Custom Domains', 'Client Permissions'],
    estimatedEffort: '4 days',
    assignee: 'Fullstack Eng',
    createdAt: '2026-09-12',
    qaNotes: 'QA Directive: Please ensure that for "Viewer Only" client roles, the global billing menus and Meta connection token inputs are strictly hidden or rendered read-only.',
    qaStatus: 'revisions_requested',
    qaUpdatedAt: '2026-09-13',
    checklist: [
      { id: 'c4-1', text: 'Whitelabel settings per workspace (domain, branding, logo)', done: true },
      { id: 'c4-2', text: 'Client role levels: Full Admin, Campaign Editor, Viewer Only', done: true },
      { id: 'c4-3', text: 'Hide Super Admin and platform billing from client roles', done: false },
      { id: 'c4-4', text: 'Automated SSL provisioning for agency custom domains', done: false }
    ]
  },
  {
    id: 'card-5',
    title: 'ManyChat Free Light Account Tier Limits & Upgrade Triggers',
    description: 'Create an entry-level Free Light account with 500 contacts, 1 connected FB page, basic support chat, and mandatory watermark, triggering upgrade prompts when hitting subscriber ceilings.',
    columnId: 'backlog',
    category: 'Billing & Pricing',
    priority: 'medium',
    tags: ['Freemium', 'Growth Loop', 'Upgrade Prompts'],
    estimatedEffort: '2 days',
    assignee: 'Growth Product',
    createdAt: '2026-09-12',
    checklist: [
      { id: 'c5-1', text: '500 contact hard limit on Free Light silo', done: false },
      { id: 'c5-2', text: 'Disabled Meta Recurring Notification blasts on Free', done: true },
      { id: 'c5-3', text: 'In-app upgrade banner when approaching contact threshold', done: false }
    ]
  },
  {
    id: 'card-6',
    title: 'Nurture Tools Auto-Scoping to Active Workspace Silo',
    description: 'Ensure all Nurture Tools created (Chat Bubbles, Exit Popups, Sliders, Sticky Bars, Page Takeovers) are tagged with the active Workspace Silo ID and route leads into that silo’s Bot Maps.',
    columnId: 'done',
    category: 'Nurture Tools',
    priority: 'high',
    tags: ['Nurture Tools', 'Lead Ingestion', 'Silo Binding'],
    estimatedEffort: 'Completed',
    assignee: 'Frontend Eng',
    createdAt: '2026-09-11',
    checklist: [
      { id: 'c6-1', text: 'Tag embed snippet with silo workspace_id attribute', done: true },
      { id: 'c6-2', text: 'Route widget submissions into workspace Bot Map trigger', done: true },
      { id: 'c6-3', text: 'Respect workspace whitelabel watermark suppression', done: true }
    ]
  },
  {
    id: 'card-7',
    title: 'Meta Webhook Ingestion & Page ID Payload Demux',
    description: 'Incoming Meta Webhooks from Facebook Messenger, Instagram DM, and WhatsApp Cloud API inspect the target page_id to route events cleanly to the corresponding business silo.',
    columnId: 'testing',
    category: 'Channels & Meta',
    priority: 'high',
    tags: ['Webhooks', 'Meta Messaging', 'Demux Router'],
    estimatedEffort: '3 days',
    assignee: 'Backend Team',
    createdAt: '2026-09-12',
    checklist: [
      { id: 'c7-1', text: 'Parse entry[0].id (FB Page ID) on webhook ingress', done: true },
      { id: 'c7-2', text: 'Match page ID to active workspace silo database record', done: true },
      { id: 'c7-3', text: 'Dispatch event to workspace-specific flow execution runner', done: true },
      { id: 'c7-4', text: 'Simulate high-concurrency multi-silo message test', done: false }
    ]
  }
];
