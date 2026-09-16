export type OverlayType = 'popup_modal' | 'slider' | 'page_takeover' | 'sticky_bar';

export type OverlayTrigger = 'exit_intent' | 'time_delay' | 'scroll_depth' | 'button_click' | 'immediate';

export type OverlayPosition = 'center' | 'bottom_right' | 'bottom_left' | 'top_bar' | 'bottom_bar';

export interface WebsiteOverlay {
  id: string;
  name: string;
  type: OverlayType;
  status: 'active' | 'paused' | 'draft';
  headline: string;
  subheadline: string;
  badgeText?: string;
  offerCode?: string;
  ctaText: string;
  ctaAction: 'open_bot' | 'lead_form' | 'redirect_url';
  redirectUrl?: string;
  brandColor: string;
  theme: 'dark' | 'light';
  position: OverlayPosition;
  triggerType: OverlayTrigger;
  triggerDelaySeconds: number;
  triggerScrollPercent: number;
  exitIntentSensitivity?: 'medium' | 'high' | 'low';
  connectedBotId: string;
  botName: string;
  requireEmailCapture: boolean;
  requireNameCapture: boolean;
  removeBranding: boolean;
  whitelistedDomains: string[];
  totalViews: number;
  totalInteractions: number;
  totalLeads: number;
  createdAt: string;
  updatedAt: string;
}

export interface SupportChatWidgetConfig {
  id: string;
  name: string;
  status: 'active' | 'paused' | 'draft';
  headline: string;
  subheadline: string;
  welcomeMessage: string;
  brandColor: string;
  theme: 'dark' | 'light' | 'auto';
  position: 'bottom_right' | 'bottom_left';
  launcherIcon: 'chat' | 'sparkle' | 'headset' | 'bot';
  launcherText?: string;
  avatarUrl: string;
  botName: string;
  connectedBotId: string;
  quickReplies: Array<{ id: string; label: string; payload: string }>;
  requireEmailCapture: boolean;
  requireNameCapture: boolean;
  requirePhoneCapture: boolean;
  removeBranding: boolean;
  autoOpenDelaySeconds: number; // 0 for off
  whitelistedDomains: string[];
  totalViews: number;
  totalConversations: number;
  totalLeads: number;
  createdAt: string;
  updatedAt: string;
}

export type CloakedDestinationType = 'messenger' | 'instagram' | 'web_chat' | 'custom_url';

export type CloakingMode = 'bridge' | 'direct' | 'masked';

export interface SendChatCloakedLink {
  id: string;
  workspaceSlug: string;
  slug: string; // e.g. "summer-promo" => send.chat/workspace/summer-promo
  fullShortUrl: string;
  destinationType: CloakedDestinationType;
  destinationUrl: string;
  title: string; // OpenGraph Title
  description: string; // OpenGraph Description
  previewImage?: string; // OpenGraph Image
  cloakingMode: CloakingMode;
  connectedBotId?: string;
  refPayload?: string;
  status: 'active' | 'paused';
  totalClicks: number;
  totalConversions: number;
  createdAt: string;
  lastClickedAt?: string;
}

export interface MmeLinkConfig {
  pageId: string;
  pageUsername: string;
  refPayload: string;
  connectedBotId: string;
  botName?: string;
  generatedUrl: string;
  notes?: string;
}

export interface IgmeLinkConfig {
  instagramUsername: string;
  refPayload: string;
  starterMessage?: string;
  connectedBotId: string;
  botName?: string;
  generatedUrl: string;
  notes?: string;
}
