export type NurtureToolType = 'support_widget' | 'popup_modal' | 'slider' | 'page_takeover' | 'sticky_bar';

export type NurturePosition = 'bottom_right' | 'bottom_left' | 'center' | 'top_bar' | 'bottom_bar';

export type NurtureTrigger = 'immediate' | 'time_delay' | 'exit_intent' | 'scroll_depth' | 'button_click';

export type NurtureAccessLevel = string;

export interface NurtureQuickReply {
  id: string;
  label: string;
  payload: string;
  botStepId?: string;
}

export interface NurtureTool {
  id: string;
  name: string;
  type: NurtureToolType;
  accessLevel: string; // Modular tier or Plan ID required
  planId?: string; // ID of the custom plan built in the Plan Builder
  status: 'active' | 'paused' | 'draft';
  headline: string;
  subheadline: string;
  welcomeMessage: string;
  brandColor: string;
  theme: 'dark' | 'light' | 'auto';
  position: NurturePosition;
  avatarUrl: string;
  botName: string;
  connectedBotId: string;
  triggerType: NurtureTrigger;
  triggerDelaySeconds: number;
  triggerScrollPercent: number;
  exitIntentEnabled: boolean;
  quickReplies: NurtureQuickReply[];
  requireEmailCapture: boolean;
  requireNameCapture: boolean;
  removeBranding?: boolean;
  metaPixelEvent: string;
  whitelistedDomains: string[];
  totalViews: number;
  totalConversations: number;
  totalLeads: number;
  createdAt: string;
  updatedAt: string;
}

// Flexible User-Built Plan Definition
export interface NurturePlan {
  id: string;
  name: string;
  description?: string;
  price?: string;
  color?: string;
  maxActiveTools: number | 'Unlimited';
  maxDomains?: number | 'Unlimited';
  includedToolTypes: NurtureToolType[];
  features: {
    exitIntent: boolean;
    pageTakeovers: boolean;
    cornerSliders: boolean;
    stickyBars: boolean;
    removeBranding: boolean;
    customCSS: boolean;
    metaPixelEvents: boolean;
    unlimitedDomains: boolean;
    aiAutonomousAgent: boolean;
    [key: string]: boolean;
  };
  createdAt?: string;
  updatedAt?: string;
}

// Backwards-compatible alias
export type NurturePackageTier = NurturePlan;

export const DEFAULT_NURTURE_PLANS: NurturePlan[] = [
  {
    id: 'plan-1',
    name: 'Plan 1',
    description: 'Customizable base plan for website support and basic engagement.',
    price: '$29/mo',
    color: '#00d2ff',
    maxActiveTools: 2,
    maxDomains: 1,
    includedToolTypes: ['support_widget'],
    features: {
      exitIntent: false,
      pageTakeovers: false,
      cornerSliders: false,
      stickyBars: false,
      removeBranding: false,
      customCSS: false,
      metaPixelEvents: false,
      unlimitedDomains: false,
      aiAutonomousAgent: true
    }
  },
  {
    id: 'plan-2',
    name: 'Plan 2',
    description: 'Customizable growth tier with popups, sliders, and announcement bars.',
    price: '$79/mo',
    color: '#10b981',
    maxActiveTools: 10,
    maxDomains: 5,
    includedToolTypes: ['support_widget', 'popup_modal', 'slider', 'sticky_bar'],
    features: {
      exitIntent: true,
      pageTakeovers: false,
      cornerSliders: true,
      stickyBars: true,
      removeBranding: true,
      customCSS: false,
      metaPixelEvents: true,
      unlimitedDomains: false,
      aiAutonomousAgent: true
    }
  },
  {
    id: 'plan-3',
    name: 'Plan 3',
    description: 'Customizable top-tier plan with fullscreen takeovers and all features.',
    price: '$199/mo',
    color: '#a855f7',
    maxActiveTools: 'Unlimited',
    maxDomains: 'Unlimited',
    includedToolTypes: ['support_widget', 'popup_modal', 'slider', 'page_takeover', 'sticky_bar'],
    features: {
      exitIntent: true,
      pageTakeovers: true,
      cornerSliders: true,
      stickyBars: true,
      removeBranding: true,
      customCSS: true,
      metaPixelEvents: true,
      unlimitedDomains: true,
      aiAutonomousAgent: true
    }
  }
];

export const DEFAULT_NURTURE_PACKAGES: Record<string, NurturePackageTier> = {
  starter: DEFAULT_NURTURE_PLANS[0],
  growth: DEFAULT_NURTURE_PLANS[1],
  agency: DEFAULT_NURTURE_PLANS[2],
  'plan-1': DEFAULT_NURTURE_PLANS[0],
  'plan-2': DEFAULT_NURTURE_PLANS[1],
  'plan-3': DEFAULT_NURTURE_PLANS[2]
};

// Backwards compatibility aliases
export type ConvertMateToolType = NurtureToolType;
export type ConvertMatePosition = NurturePosition;
export type ConvertMateTrigger = NurtureTrigger;
export type ConvertMateQuickReply = NurtureQuickReply;
export type ConvertMateTool = NurtureTool;
