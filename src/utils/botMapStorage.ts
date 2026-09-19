import { FlowNode, FlowConnection } from '../views/FlowBuilder';

// Original demo nodes for (Ad) Build-A-Bot Invite (bot-1)
export const DEMO_INVITE_NODES: FlowNode[] = [
  { 
    id: 'trigger', 
    type: 'trigger', 
    title: 'Starting Step', 
    triggers: [
      {
        id: 'trig-1',
        type: 'fb_ad',
        channel: 'messenger',
        title: 'Click-to-Messenger Ad',
        enabled: true,
        adCampaignName: 'Build-A-Bot Live Workshop • VIP Training Ad',
        adCampaignId: 'act_29103849102',
        adPayloadKeyword: 'START_WORKSHOP',
        keywords: ['START', 'JOIN', 'WORKSHOP'],
        matchRule: 'contains',
        keywordMode: 'keywords',
        description: 'Meta Ads Manager CTM Ad Campaign #4102'
      },
      {
        id: 'trig-2',
        type: 'ig_keyword',
        channel: 'instagram',
        title: 'Instagram DM Keywords',
        enabled: true,
        keywords: ['START', 'MASTERCLASS', 'BOT', 'VIP'],
        matchRule: 'contains',
        keywordMode: 'keywords',
        description: 'User sends direct message with trigger keyword'
      },
      {
        id: 'trig-3',
        type: 'ig_comments',
        channel: 'instagram',
        title: 'Instagram Post Comments',
        enabled: true,
        postTitle: 'Build-A-Bot Live Workshop Announcement Post',
        postUrl: 'https://instagram.com/p/C8x9qL1vip',
        commentMatchRule: 'contains',
        commentKeywords: ['BOT', 'WORKSHOP', 'VIP', 'YES'],
        keywords: ['BOT', 'WORKSHOP', 'VIP', 'YES'],
        matchRule: 'contains',
        keywordMode: 'keywords',
        publicCommentReply: 'Check your DMs! Just sent you the invite link 🔥',
        description: 'User comments on Instagram Post or Reel'
      },
      {
        id: 'trig-4',
        type: 'fb_ref_url',
        channel: 'messenger',
        title: 'Messenger Referral URL (m.me)',
        enabled: true,
        refPayload: 'workshop_live_replay',
        keywords: ['WORKSHOP', 'REPLAY', 'LIVE'],
        matchRule: 'contains',
        keywordMode: 'keywords',
        refUrl: 'https://m.me/chatmize?ref=workshop_live_replay',
        description: 'Direct link in bio, email blasts, and QR codes'
      }
    ],
    triggerRuleType: 'fb_ad',
    triggerKeywords: ['START', 'MASTERCLASS', 'BOT'],
    triggerAdCampaignId: 'Build-A-Bot Live CTM Ad Campaign #4102',
    triggerAdName: 'Build-A-Bot Live Workshop • VIP Training Ad',
    policyWindowHours: 24,
    allowedChannels: ['messenger', 'instagram', 'whatsapp'],
    autoRenewOnReply: true,
    content: 'Multi-channel entry points for new leads and opt in subscribers', 
    x: 40, 
    y: 120, 
    iconType: 'workflow' 
  },
  { 
    id: 'step-1', 
    type: 'message', 
    title: 'Step 1: Welcome Masterclass', 
    content: 'Awesome! 🔥🔥🔥\n\n{{first_name}}, good to meet you! And excited to invite you to my next Build-A-Bot Workshop Masterclass! 🤖\n\nAre you ready to jump on and start building some bots *powered to build your customer base*?\n\nIf so then click the "Yes I AM" Button Below... 👇', 
    components: [
      {
        id: 'comp-1-type',
        type: 'typing',
        delaySeconds: 2,
      },
      {
        id: 'comp-1-img',
        type: 'image',
        imageUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80',
        imageCaption: 'Build-A-Bot Live Workshop • VIP Training Flyer',
      }
    ],
    buttons: ['? Yes I Am'],
    quickReplies: ['Tell me more', 'Not right now'],
    x: 380, 
    y: 90, 
    iconType: 'message' 
  },
  { 
    id: 'action-1', 
    type: 'action', 
    title: 'New Action: Tag & Sequence', 
    actionTags: ['AddTag: Evergreen BAB', 'SubscribeToSequence: 3hr Ad Follow up'],
    content: 'AddTag: Evergreen BAB\nSubscribeToSequence: 3hr Ad Follow up', 
    x: 780, 
    y: 130, 
    iconType: 'tag' 
  },
  { 
    id: 'step-2', 
    type: 'message', 
    title: 'Step 2: Confirmation & Room Link', 
    content: 'Great! All you have to do is click on your email below and {{first_name}} you\'ll be signed up. Pretty Easy!\n\nThen I will send you to the LIVE ROOM! ⚡', 
    components: [
      {
        id: 'comp-rn-optin',
        type: 'recurring_notification_optin',
        rnTopic: 'Weekly VIP Growth Hacks',
        rnFrequency: 'weekly',
        rnTitle: 'Get Weekly Bot Optimization Tips & Live Alerts',
        rnButtonText: 'Get Updates',
      }
    ],
    buttons: ['JOIN NOW! 🚀'],
    quickReplies: ['Use Other Email'],
    x: 780, 
    y: 420, 
    iconType: 'message' 
  },
  { 
    id: 'step-3', 
    type: 'message', 
    title: 'Step 3: Bot Reply', 
    content: 'Hey {{first_name}}! Thanks for confirming. What would you like to explore next?', 
    components: [
      {
        id: 'comp-3-typing',
        type: 'typing',
        delaySeconds: 3,
      },
      {
        id: 'comp-3-card',
        type: 'card',
        cardTitle: 'VIP Masterclass Pass & Template Bundle',
        cardSubtitle: 'Includes instant webinar replay recordings + 5 ready-to-deploy bot blueprints.',
        cardImageUrl: 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=600&auto=format&fit=crop&q=80',
        cardButtonLabel: 'Reserve VIP Spot Now',
        cardButtonUrl: 'https://chatmize.io/vip'
      }
    ],
    buttons: ['Explore Curriculum', 'Get Replay Access'],
    quickReplies: ['Need Help', 'Ask AI'],
    x: 1180, 
    y: 420, 
    iconType: 'message' 
  },
  { 
    id: 'delay-24h', 
    type: 'delay', 
    title: 'Smart Delay (Post-24h)', 
    delayText: 'Wait 2 days for live workshop date', 
    delayHours: 48,
    content: 'Wait 2 days before event broadcast', 
    x: 1180, 
    y: 130, 
    iconType: 'clock' 
  },
  { 
    id: 'step-post24h', 
    type: 'message', 
    title: 'Step 4: Event Reminder (Outside 24h)', 
    isPost24h: true,
    outsideRuleType: 'tag',
    messageTag: 'CONFIRMED_EVENT_UPDATE', 
    content: 'Reminder: {{first_name}}, the Build-A-Bot Live Workshop starts in 1 hour! Your seat in the main studio is ready.', 
    buttons: ['Enter Live Room 🔴'], 
    quickReplies: ['Can\'t make it', 'Send replay'],
    x: 1580, 
    y: 130, 
    iconType: 'message' 
  },
  { 
    id: 'ai-1', 
    type: 'ai', 
    title: 'AI Smart Assistant Fallback', 
    content: 'If customer asks any custom question, Antigravity AI agent answers using knowledge base docs.', 
    x: 380, 
    y: 620, 
    iconType: 'bot' 
  }
];

export const DEMO_INVITE_CONNECTIONS: FlowConnection[] = [
  {
    id: 'conn-1',
    sourceNodeId: 'trigger',
    sourceHandleId: 'output',
    targetNodeId: 'step-1',
    color: '#10b981',
    dashed: false,
  },
  {
    id: 'conn-2',
    sourceNodeId: 'step-1',
    sourceHandleId: 'btn-0',
    targetNodeId: 'action-1',
    color: '#3b82f6',
    dashed: false,
  },
  {
    id: 'conn-3',
    sourceNodeId: 'action-1',
    sourceHandleId: 'output',
    targetNodeId: 'step-2',
    color: '#fb923c',
    dashed: false,
  },
  {
    id: 'conn-4',
    sourceNodeId: 'step-2',
    sourceHandleId: 'btn-0',
    targetNodeId: 'step-3',
    color: '#3b82f6',
    dashed: false,
  },
  {
    id: 'conn-post-1',
    sourceNodeId: 'action-1',
    sourceHandleId: 'output',
    targetNodeId: 'delay-24h',
    color: '#a855f7',
    dashed: true,
  },
  {
    id: 'conn-post-2',
    sourceNodeId: 'delay-24h',
    sourceHandleId: 'output',
    targetNodeId: 'step-post24h',
    color: '#06b6d4',
    dashed: false,
  },
  {
    id: 'conn-5',
    sourceNodeId: 'trigger',
    sourceHandleId: 'output',
    targetNodeId: 'ai-1',
    color: '#06b6d4',
    dashed: true,
  }
];

/**
 * Creates a brand new, clean starter canvas for any new Bot Map.
 * Does NOT copy or open the existing Build-A-Bot demo nodes.
 */
export function getFreshStarterBotMap(
  botId: string, 
  botTitle: string, 
  template: 'blank' | 'lead_gen' | 'support' | 'ecommerce' = 'blank',
  channels: Array<'instagram' | 'messenger' | 'whatsapp' | 'webhook'> = ['instagram']
): { nodes: FlowNode[]; connections: FlowConnection[]; isLive: boolean } {
  const primaryChannel = channels[0] || 'instagram';

  // Lead Gen Template
  if (template === 'lead_gen') {
    const nodes: FlowNode[] = [
      {
        id: 'trigger',
        type: 'trigger',
        title: 'Starting Step',
        triggers: [
          {
            id: 'trig-lead-1',
            type: 'ig_keyword',
            channel: 'instagram',
            title: 'Instagram DM Keyword',
            enabled: true,
            keywords: ['LEAD', 'VIP', 'BLUEPRINT'],
            matchRule: 'contains',
            description: 'User sends direct message with trigger keyword'
          },
          {
            id: 'trig-lead-2',
            type: 'ig_comments',
            channel: 'instagram',
            title: 'Story Mention Trigger',
            enabled: true,
            description: 'Triggers when contact tags your account in a Story'
          }
        ],
        policyWindowHours: 24,
        allowedChannels: ['instagram', 'messenger'],
        autoRenewOnReply: true,
        content: 'Entry points for Story mentions & VIP lead keyword inquiries',
        x: 80,
        y: 180,
        iconType: 'workflow'
      },
      {
        id: 'step-1',
        type: 'message',
        title: 'Step 1: Deliver Free Resource',
        content: `🎉 Awesome {{first_name}}! Thanks for reaching out.\n\nHere is the free VIP guide you requested. Click below to access the download:`,
        buttons: ['Download Free Guide 📥'],
        quickReplies: ['Ask Question', 'Learn More'],
        x: 480,
        y: 180,
        iconType: 'message'
      },
      {
        id: 'action-1',
        type: 'action',
        title: 'Tag Contact & Sync CRM',
        actionTags: ['AddTag: VIP Lead Magnet', 'AddTag: Opt in Confirmed'],
        content: 'AddTag: VIP Lead Magnet\nAddTag: Opt in Confirmed',
        x: 880,
        y: 180,
        iconType: 'tag'
      }
    ];

    const connections: FlowConnection[] = [
      {
        id: 'conn-init-1',
        sourceNodeId: 'trigger',
        sourceHandleId: 'output',
        targetNodeId: 'step-1',
        color: '#10b981',
        dashed: false
      },
      {
        id: 'conn-init-2',
        sourceNodeId: 'step-1',
        sourceHandleId: 'btn-0',
        targetNodeId: 'action-1',
        color: '#3b82f6',
        dashed: false
      }
    ];

    return { nodes, connections, isLive: false };
  }

  // 24/7 Support Bot Template
  if (template === 'support') {
    const nodes: FlowNode[] = [
      {
        id: 'trigger',
        type: 'trigger',
        title: 'Starting Step',
        triggers: [
          {
            id: 'trig-sup-1',
            type: 'wa_keyword',
            channel: 'whatsapp',
            title: 'WhatsApp Inbound Support',
            enabled: true,
            keywords: ['HELP', 'SUPPORT', 'AGENT', 'HELLO'],
            matchRule: 'contains',
            description: 'Triggers when a customer messages asking for assistance'
          }
        ],
        policyWindowHours: 24,
        allowedChannels: ['whatsapp', 'messenger'],
        autoRenewOnReply: true,
        content: 'Customer service & FAQ automated routing entry point',
        x: 80,
        y: 180,
        iconType: 'workflow'
      },
      {
        id: 'step-1',
        type: 'message',
        title: 'Step 1: Support Menu',
        content: `👋 Hi {{first_name}}! Welcome to 24/7 Support.\n\nHow can we help you today? Please choose an option below:`,
        buttons: ['Track Order 📦', 'FAQ & Returns 🔄', 'Speak with Human 💬'],
        quickReplies: ['Store Hours', 'Pricing'],
        x: 480,
        y: 180,
        iconType: 'message'
      },
      {
        id: 'ai-1',
        type: 'ai',
        title: 'AI Smart Support Assistant',
        content: 'Uses verified knowledge base documentation to provide instant answers to custom inquiries.',
        x: 880,
        y: 200,
        iconType: 'bot'
      }
    ];

    const connections: FlowConnection[] = [
      {
        id: 'conn-sup-1',
        sourceNodeId: 'trigger',
        sourceHandleId: 'output',
        targetNodeId: 'step-1',
        color: '#10b981',
        dashed: false
      },
      {
        id: 'conn-sup-2',
        sourceNodeId: 'step-1',
        sourceHandleId: 'btn-2',
        targetNodeId: 'ai-1',
        color: '#06b6d4',
        dashed: true
      }
    ];

    return { nodes, connections, isLive: false };
  }

  // Abandoned Cart Recovery Template
  if (template === 'ecommerce') {
    const nodes: FlowNode[] = [
      {
        id: 'trigger',
        type: 'trigger',
        title: 'Starting Step',
        triggers: [
          {
            id: 'trig-cart-1',
            type: 'webhook',
            channel: 'integrations',
            title: 'Cart Abandoned Webhook',
            enabled: true,
            description: 'Triggered when a checkout is incomplete for 15+ minutes'
          }
        ],
        policyWindowHours: 24,
        allowedChannels: ['messenger', 'whatsapp'],
        autoRenewOnReply: true,
        content: 'E-commerce recovery event trigger',
        x: 80,
        y: 180,
        iconType: 'workflow'
      },
      {
        id: 'step-1',
        type: 'message',
        title: 'Step 1: Cart Recovery Offer',
        content: `🛒 Hey {{first_name}}, we noticed you left items in your shopping cart!\n\nAs a special gift, take 10% off your order with code SAVE10:`,
        buttons: ['Complete My Order 🛍️'],
        quickReplies: ['Need Help', 'Decline'],
        x: 480,
        y: 180,
        iconType: 'message'
      }
    ];

    const connections: FlowConnection[] = [
      {
        id: 'conn-cart-1',
        sourceNodeId: 'trigger',
        sourceHandleId: 'output',
        targetNodeId: 'step-1',
        color: '#10b981',
        dashed: false
      }
    ];

    return { nodes, connections, isLive: false };
  }

  // Default Clean Blank Canvas
  const triggerType = primaryChannel === 'whatsapp' 
    ? 'wa_keyword' 
    : primaryChannel === 'messenger' 
    ? 'fb_ad' 
    : primaryChannel === 'webhook'
    ? 'webhook'
    : 'ig_keyword';

  const triggerTitle = primaryChannel === 'whatsapp'
    ? 'WhatsApp Inbound Message'
    : primaryChannel === 'messenger'
    ? 'Click-to-Messenger Trigger'
    : primaryChannel === 'webhook'
    ? 'Inbound Webhook Trigger'
    : 'Instagram DM Keywords';

  const channelForTrigger = primaryChannel === 'webhook' ? 'integrations' : primaryChannel;
  const allowedChannels: ('messenger' | 'instagram' | 'whatsapp')[] = 
    primaryChannel === 'webhook' ? ['messenger', 'instagram'] : [primaryChannel];

  const defaultNodes: FlowNode[] = [
    {
      id: 'trigger',
      type: 'trigger',
      title: 'Starting Step',
      triggers: [
        {
          id: `trig-${Date.now()}`,
          type: triggerType,
          channel: channelForTrigger,
          title: triggerTitle,
          enabled: true,
          keywords: ['START', 'HELLO', 'INFO'],
          matchRule: 'contains',
          description: `Triggers when user initiates conversation on ${primaryChannel}`
        }
      ],
      policyWindowHours: 24,
      allowedChannels,
      autoRenewOnReply: true,
      content: `Omnichannel entry point configured for ${botTitle}`,
      x: 120,
      y: 200,
      iconType: 'workflow'
    },
    {
      id: 'step-1',
      type: 'message',
      title: 'Welcome Message',
      content: `👋 Hello {{first_name}}! Thanks for reaching out to ${botTitle}.\n\nHow can we help you today?`,
      buttons: ['Get Started', 'Learn More'],
      quickReplies: ['Pricing', 'Speak with Support'],
      x: 520,
      y: 200,
      iconType: 'message'
    }
  ];

  const defaultConnections: FlowConnection[] = [
    {
      id: `conn-init-${Date.now()}`,
      sourceNodeId: 'trigger',
      sourceHandleId: 'output',
      targetNodeId: 'step-1',
      color: '#10b981',
      dashed: false
    }
  ];

  return {
    nodes: defaultNodes,
    connections: defaultConnections,
    isLive: false
  };
}

/**
 * Loads bot map data from localStorage. If not found or if creating a new bot,
 * returns the appropriate clean starter or the demo map for bot-1.
 */
export function loadBotMapData(
  botId: string, 
  defaultTitle?: string
): { nodes: FlowNode[]; connections: FlowConnection[]; isLive: boolean } {
  try {
    const saved = localStorage.getItem(`chatmize_botmap_data_${botId}`);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && Array.isArray(parsed.nodes) && parsed.nodes.length > 0) {
        return {
          nodes: parsed.nodes,
          connections: Array.isArray(parsed.connections) ? parsed.connections : [],
          isLive: Boolean(parsed.isLive)
        };
      }
    }
  } catch (e) {
    console.error(`Failed to load bot map data for ${botId}:`, e);
  }

  // bot-1 is the initial demo bot map
  if (botId === 'bot-1') {
    return {
      nodes: DEMO_INVITE_NODES,
      connections: DEMO_INVITE_CONNECTIONS,
      isLive: true
    };
  }

  // Any other bot map gets a fresh, clean canvas
  return getFreshStarterBotMap(botId, defaultTitle || 'New Bot Map');
}

/**
 * Saves current bot map nodes, connections, and live state to localStorage.
 */
export function saveBotMapData(
  botId: string, 
  data: { 
    nodes: FlowNode[]; 
    connections: FlowConnection[]; 
    isLive: boolean; 
    flowTitle?: string; 
  }
): void {
  if (!botId) return;
  try {
    localStorage.setItem(`chatmize_botmap_data_${botId}`, JSON.stringify(data));
  } catch (e) {
    console.error(`Failed to save bot map data for ${botId}:`, e);
  }
}
