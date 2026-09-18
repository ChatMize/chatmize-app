export type OverlayType = 'popup_modal' | 'slider' | 'page_takeover' | 'sticky_bar';

export type OverlayTrigger = 'exit_intent' | 'time_delay' | 'scroll_depth' | 'button_click' | 'immediate';

/**
 * Triggers that work on mobile. `exit_intent` is desktop-only (no cursor to
 * track); mobile overlays use timed, scroll-depth, click, or immediate triggers.
 */
export type MobileTriggerType = 'time_delay' | 'scroll_depth' | 'button_click' | 'immediate';

/**
 * Per-device trigger config. The overlay's top-level `triggerType` /
 * `triggerDelaySeconds` / `triggerScrollPercent` / `exitIntentSensitivity`
 * fields are the DESKTOP config. `mobileTrigger` overrides for mobile visitors.
 */
export interface MobileTriggerConfig {
  enabled: boolean;
  triggerType: MobileTriggerType;
  delaySeconds: number;
  scrollPercent: number;
}

export type OverlayCtaAction = 'open_bot' | 'lead_form' | 'redirect_url' | 'enter_contest';

/**
 * STUB — Contest entities don't exist yet (see viral-contests-spec.md).
 * This shape is the contract the overlay builder codes against; when the
 * Contests module ships, its real entities replace these stubs and the
 * overlay's `contestId` resolves against them. Entering a contest IS the
 * capture event: entry feeds referral tracking + the leaderboard.
 */
export interface ContestStub {
  id: string;
  name: string;
  status: 'active' | 'draft' | 'ended';
  entriesCount: number;
}

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
  ctaAction: OverlayCtaAction;
  redirectUrl?: string;
  /** Set when ctaAction === 'enter_contest'. Resolves against Contest entities once the Contests module ships. */
  contestId?: string;
  contestName?: string;
  brandColor: string;
  theme: 'dark' | 'light';
  position: OverlayPosition;
  /** Desktop trigger. `exit_intent` is desktop-only. */
  triggerType: OverlayTrigger;
  triggerDelaySeconds: number;
  triggerScrollPercent: number;
  exitIntentSensitivity?: 'medium' | 'high' | 'low';
  /** Mobile trigger override. Undefined = mirror desktop trigger on mobile (exit_intent falls back to time_delay). */
  mobileTrigger?: MobileTriggerConfig;
  connectedBotId: string;
  botName: string;
  requireEmailCapture: boolean;
  requireNameCapture: boolean;
  removeBranding: boolean;
  whitelistedDomains: string[];
  // EXTENSION POINTS (not yet implemented — see convertmate-comparison.md):
  // - page/URL targeting + frequency capping (display rules)
  // - A/B variant traffic splitting + per-variant stats
  // - real embed SDK runtime (overlays.js) + Firestore backend
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
  // Published BotMap snapshot consumed by the live visitor widget. Written on
  // save; the unauthenticated widget reads the widget doc directly, so this
  // travels with it rather than in a separate collection.
  publishedFlow?: unknown;
  publishedFlowBotId?: string | null;
}

export type CloakedDestinationType = 'takeover' | 'messenger' | 'instagram' | 'url';

export type CloakingMode = 'bridge' | 'direct' | 'masked';

/**
 * send.chat branded link record. Mirrors the Firestore `cloaked_links`
 * contract exactly: document ID `${workspaceSlug}_${slug}`, URL-safe lowercase.
 * Legacy localStorage-era fields (`refPayload`, `totalClicks`, `totalConversions`,
 * `lastClickedAt`) are optional aliases kept for the one-time migration and
 * existing in-memory previews.
 */
export interface SendChatCloakedLink {
  /** Firestore doc id is `${workspaceSlug}_${slug}`. `id` is the local list key. */
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
  /** Meta ref payload passed through to m.me / ig.me destinations. */
  ref?: string;
  /** Incremented by the hosted link resolver. Read-only in this UI. */
  clickCount: number;
  createdBy?: string;
  createdAt: string; // ISO 8601
  updatedAt?: string; // ISO 8601
  /** Frontend-only active toggle; persisted on the Firestore record. */
  status: 'active' | 'paused';
  /** @deprecated migrated to `ref` */
  refPayload?: string;
  /** @deprecated migrated to `clickCount` */
  totalClicks?: number;
  /** @deprecated legacy local analytics, kept for old records */
  totalConversions?: number;
  /** @deprecated legacy local analytics, kept for old records */
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
