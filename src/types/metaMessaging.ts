// Meta Messaging Policy, 24-Hour Rules, Permissions, and Follow-Up API definitions

export type TriggerRuleType = 
  | 'fb_ad' 
  | 'ig_ad' 
  | 'inbound_dm' 
  | 'comment_reply' 
  | 'website_chat' 
  | 'referral_link' 
  | 'qr_code';

export type TriggerChannel = 'instagram' | 'messenger' | 'whatsapp' | 'web' | 'integrations';

export type TriggerType =
  // Instagram
  | 'ig_keyword'
  | 'ig_comments'
  | 'ig_story_mention'
  | 'ig_story_reply'
  | 'ig_ref_link'
  | 'ig_ad'
  | 'ig_live_comment'
  // Facebook Messenger
  | 'fb_keyword'
  | 'fb_comments'
  | 'fb_ref_url'
  | 'fb_ad'
  | 'fb_customer_chat'
  | 'fb_qr_code'
  | 'fb_checkbox'
  // WhatsApp
  | 'wa_keyword'
  | 'wa_link'
  | 'wa_ad'
  | 'wa_phone_form'
  // Web Growth Tools
  | 'web_modal'
  | 'web_bar'
  | 'web_slidein'
  | 'web_embed_form'
  | 'landing_page'
  // Integrations & Events
  | 'webhook'
  | 'shopify_trigger'
  | 'lead_form'
  // Bookings (native ChatMize bookings app)
  | 'booking_created'
  | 'booking_reminder_due'
  | 'booking_completed'
  | 'booking_no_show'
  | 'booking_cancelled';

export interface FlowTrigger {
  id: string;
  type: TriggerType;
  channel: TriggerChannel;
  title: string;
  enabled: boolean;
  description?: string;
  
  // Keyword & Trigger Phrase matching engine (Applies to ALL opt-in tools)
  keywords?: string[];
  matchRule?: 'contains' | 'exact' | 'starts_with';
  keywordMode?: 'keywords' | 'any';
  adPayloadKeyword?: string;

  // Specific trigger parameters
  postTitle?: string;
  postUrl?: string;
  commentMatchRule?: 'any' | 'contains' | 'exact';
  commentKeywords?: string[];
  publicCommentReply?: string;
  adCampaignName?: string;
  adCampaignId?: string;
  refPayload?: string;
  refUrl?: string;
  widgetHeadline?: string;
  widgetButtonText?: string;
  widgetDelaySeconds?: number;
  webhookUrl?: string;
  webhookSource?: string;
  waPhoneNumber?: string;
  waPreFillText?: string;
}

export interface TriggerTemplate {
  type: TriggerType;
  channel: TriggerChannel;
  category: 'instagram' | 'messenger' | 'whatsapp' | 'growth_tools' | 'integrations';
  title: string;
  description: string;
  badge: string;
  icon: string;
  popular?: boolean;
  defaultConfig: Partial<FlowTrigger>;
}

export const TRIGGER_CATALOG: TriggerTemplate[] = [
  // Instagram
  {
    type: 'ig_keyword',
    channel: 'instagram',
    category: 'instagram',
    title: 'Instagram DM Keywords',
    description: 'Trigger flow when a user sends a direct message containing specific keywords.',
    badge: 'Popular',
    icon: 'Instagram',
    popular: true,
    defaultConfig: {
      title: 'Instagram DM Keywords',
      keywords: ['START', 'BOT', 'WORKSHOP', 'VIP'],
      matchRule: 'contains',
      keywordMode: 'keywords'
    }
  },
  {
    type: 'ig_comments',
    channel: 'instagram',
    category: 'instagram',
    title: 'Instagram Comments Growth Tool',
    description: 'Automatically DM users who comment on your Posts, Reels, or Ads.',
    badge: 'Lead Gen',
    icon: 'MessageSquare',
    popular: true,
    defaultConfig: {
      title: 'Instagram Post Comments',
      postTitle: 'Latest Post / Reel',
      commentMatchRule: 'contains',
      commentKeywords: ['BOT', 'VIP', 'YES', 'LINK'],
      keywords: ['BOT', 'VIP', 'YES', 'LINK'],
      matchRule: 'contains',
      keywordMode: 'keywords',
      publicCommentReply: 'Check your DMs! Just sent you the invite link 🔥'
    }
  },
  {
    type: 'ig_story_mention',
    channel: 'instagram',
    category: 'instagram',
    title: 'Instagram Story Mention',
    description: 'Instant automated DM reply whenever someone tags your @handle in their Story.',
    badge: 'Viral Loop',
    icon: 'Sparkles',
    popular: true,
    defaultConfig: {
      title: 'Instagram Story Mention Reply',
      description: 'Triggered when user mentions your handle in their Story',
      keywords: ['VIP', 'DISCOUNT', 'REPLAY'],
      matchRule: 'contains',
      keywordMode: 'any'
    }
  },
  {
    type: 'ig_story_reply',
    channel: 'instagram',
    category: 'instagram',
    title: 'Instagram Story Reply',
    description: 'Trigger opt-in flow when a follower replies to your active Instagram Story.',
    badge: 'Engagement',
    icon: 'Play',
    defaultConfig: {
      title: 'Instagram Story Reply',
      description: 'Triggered on Story reply',
      keywords: ['VIP', 'LINK', 'INFO', 'PROMO', 'YES'],
      matchRule: 'contains',
      keywordMode: 'keywords'
    }
  },
  {
    type: 'ig_ref_link',
    channel: 'instagram',
    category: 'instagram',
    title: 'Instagram Referral Link (ig.me)',
    description: 'Direct ig.me/m/ link with custom parameter for Link-in-Bio, stories, or broadcast channels.',
    badge: 'Bio Link',
    icon: 'Link2',
    defaultConfig: {
      title: 'Instagram ig.me Bio Link',
      refPayload: 'bio_signup',
      keywords: ['BIO', 'SIGNUP', 'START'],
      matchRule: 'contains',
      keywordMode: 'keywords',
      refUrl: 'https://ig.me/m/chatmize?ref=bio_signup'
    }
  },
  {
    type: 'ig_ad',
    channel: 'instagram',
    category: 'instagram',
    title: 'Instagram Direct Ad',
    description: 'Connect Meta Ads Manager Click-to-Instagram Direct campaigns.',
    badge: 'Paid Ads',
    icon: 'Zap',
    defaultConfig: {
      title: 'Instagram Direct Ad',
      adCampaignName: 'Instagram Direct Lead Generation Ad',
      adCampaignId: 'act_ig_774910',
      adPayloadKeyword: 'GET_OFFER',
      keywords: ['GET_OFFER', 'START', 'CLAIM'],
      matchRule: 'contains',
      keywordMode: 'keywords'
    }
  },
  {
    type: 'ig_live_comment',
    channel: 'instagram',
    category: 'instagram',
    title: 'Instagram Live Comments',
    description: 'Automatically DM viewers during an Instagram Live broadcast when they comment keywords.',
    badge: 'Live Stream',
    icon: 'Radio',
    defaultConfig: {
      title: 'Instagram Live Comments',
      commentKeywords: ['REGISTER', 'BUY', 'LINK', 'VIP'],
      keywords: ['REGISTER', 'BUY', 'LINK', 'VIP'],
      commentMatchRule: 'contains',
      matchRule: 'contains',
      keywordMode: 'keywords'
    }
  },

  // Facebook Messenger
  {
    type: 'fb_ad',
    channel: 'messenger',
    category: 'messenger',
    title: 'Click-to-Messenger Ad',
    description: 'Meta Ads Manager Click-to-Messenger campaign that opens chat directly.',
    badge: 'High ROI',
    icon: 'Zap',
    popular: true,
    defaultConfig: {
      title: 'Facebook Click-to-Messenger Ad',
      adCampaignName: 'Build-A-Bot Live Workshop • VIP Training Ad',
      adCampaignId: 'act_29103849102',
      adPayloadKeyword: 'START_WORKSHOP',
      keywords: ['START', 'JOIN', 'WORKSHOP'],
      matchRule: 'contains',
      keywordMode: 'keywords'
    }
  },
  {
    type: 'fb_keyword',
    channel: 'messenger',
    category: 'messenger',
    title: 'Messenger Keywords',
    description: 'Trigger flow when a contact messages your Facebook Page with specific keywords.',
    badge: 'Standard',
    icon: 'MessageCircle',
    defaultConfig: {
      title: 'Messenger Keywords',
      keywords: ['HELP', 'REGISTER', 'PRICING', 'VIP'],
      matchRule: 'contains',
      keywordMode: 'keywords'
    }
  },
  {
    type: 'fb_comments',
    channel: 'messenger',
    category: 'messenger',
    title: 'Facebook Post Comments',
    description: 'Auto-reply in Messenger when users comment on your Page posts or Facebook Live.',
    badge: 'Growth Tool',
    icon: 'MessageSquare',
    defaultConfig: {
      title: 'Facebook Post Comments Growth Tool',
      postTitle: 'Featured Facebook Post',
      commentMatchRule: 'contains',
      commentKeywords: ['INFO', 'REPLY', 'LINK', 'DETAILS'],
      keywords: ['INFO', 'REPLY', 'LINK', 'DETAILS'],
      matchRule: 'contains',
      keywordMode: 'keywords',
      publicCommentReply: 'Sent you a private message with full details!'
    }
  },
  {
    type: 'fb_ref_url',
    channel: 'messenger',
    category: 'messenger',
    title: 'Messenger Referral URL (m.me)',
    description: 'Shareable direct link (m.me/page?ref=...) for emails, buttons, podcasts, and SMS.',
    badge: 'Universal',
    icon: 'Link2',
    popular: true,
    defaultConfig: {
      title: 'Messenger Referral URL (m.me)',
      refPayload: 'masterclass_lead',
      keywords: ['MASTERCLASS', 'LEAD', 'START'],
      matchRule: 'contains',
      keywordMode: 'keywords',
      refUrl: 'https://m.me/chatmize?ref=masterclass_lead'
    }
  },
  {
    type: 'fb_customer_chat',
    channel: 'messenger',
    category: 'messenger',
    title: 'Customer Chat Plugin (Website)',
    description: 'Floating chat bubble embedded on your website with seamless Messenger sync.',
    badge: 'Website',
    icon: 'Globe',
    defaultConfig: {
      title: 'Website Customer Chat Plugin',
      widgetHeadline: 'Hi there! Have a question about Build-A-Bot?',
      refPayload: 'website_customer_chat',
      keywords: ['HELLO', 'HELP', 'CHAT', 'START'],
      matchRule: 'contains',
      keywordMode: 'any'
    }
  },
  {
    type: 'fb_qr_code',
    channel: 'messenger',
    category: 'messenger',
    title: 'Messenger QR Code',
    description: 'Printable QR code for live stages, flyers, business cards, and packaging.',
    badge: 'Offline',
    icon: 'QrCode',
    defaultConfig: {
      title: 'Messenger QR Code',
      refPayload: 'event_qr_scan',
      keywords: ['EVENT', 'SCAN', 'WELCOME'],
      matchRule: 'contains',
      keywordMode: 'keywords'
    }
  },

  // WhatsApp
  {
    type: 'wa_keyword',
    channel: 'whatsapp',
    category: 'whatsapp',
    title: 'WhatsApp Inbound Keywords',
    description: 'Trigger flow when a contact messages your WhatsApp Business API number.',
    badge: 'WhatsApp API',
    icon: 'Smartphone',
    popular: true,
    defaultConfig: {
      title: 'WhatsApp Inbound Keywords',
      keywords: ['HELLO', 'PRICE', 'JOIN', 'INFO'],
      matchRule: 'contains',
      keywordMode: 'keywords',
      waPhoneNumber: '+1 (555) 019-2831'
    }
  },
  {
    type: 'wa_link',
    channel: 'whatsapp',
    category: 'whatsapp',
    title: 'WhatsApp Chat Link (wa.me) & QR',
    description: 'One-click wa.me link with pre-filled text and printable QR code.',
    badge: '1-Click',
    icon: 'Link2',
    defaultConfig: {
      title: 'WhatsApp wa.me Direct Link',
      waPreFillText: 'Hi, I want to join the Build-A-Bot VIP Workshop!',
      keywords: ['JOIN', 'WORKSHOP', 'VIP'],
      matchRule: 'contains',
      keywordMode: 'keywords',
      refUrl: 'https://wa.me/15550192831?text=Hi%2C%20I%20want%20to%20join'
    }
  },
  {
    type: 'wa_ad',
    channel: 'whatsapp',
    category: 'whatsapp',
    title: 'Click-to-WhatsApp Ad',
    description: 'Meta Ad driving traffic straight into an active WhatsApp Business conversation.',
    badge: 'Paid Ads',
    icon: 'Zap',
    defaultConfig: {
      title: 'Click-to-WhatsApp Ad Campaign',
      adCampaignName: 'WhatsApp VIP Funnel Ad #12',
      adCampaignId: 'act_wa_88192',
      adPayloadKeyword: 'WHATSAPP_OFFER',
      keywords: ['OFFER', 'CHAT', 'START'],
      matchRule: 'contains',
      keywordMode: 'keywords'
    }
  },
  {
    type: 'wa_phone_form',
    channel: 'whatsapp',
    category: 'whatsapp',
    title: 'Phone Number Opt-In Form',
    description: 'Opt-in lead capture when a phone number is entered on website or checkout.',
    badge: 'Opt-In',
    icon: 'UserCheck',
    defaultConfig: {
      title: 'WhatsApp Phone Number Opt-In',
      keywords: ['CONFIRM', 'OPTIN', 'YES'],
      matchRule: 'contains',
      keywordMode: 'keywords'
    }
  },

  // Web Growth Tools (Opt-in & Lead Capture)
  {
    type: 'web_modal',
    channel: 'web',
    category: 'growth_tools',
    title: 'Website Modal / Popup',
    description: 'High-converting modal triggered by time-on-page, scroll depth, or exit intent.',
    badge: 'Lead Capture',
    icon: 'Layout',
    popular: true,
    defaultConfig: {
      title: 'Website Lead Capture Modal',
      widgetHeadline: 'Get Instant Access to the Free Build-A-Bot Guide!',
      widgetButtonText: 'Send to Messenger',
      keywords: ['MODAL_OPTIN', 'GUIDE', 'START'],
      matchRule: 'contains',
      keywordMode: 'keywords',
      refPayload: 'web_modal_lead',
      widgetDelaySeconds: 5
    }
  },
  {
    type: 'web_bar',
    channel: 'web',
    category: 'growth_tools',
    title: 'Website Notification Bar / Slide-in',
    description: 'Sticky header banner or subtle bottom corner slide-in with instant opt-in CTA.',
    badge: 'Sticky Bar',
    icon: 'Layers',
    defaultConfig: {
      title: 'Top Notification Bar',
      widgetHeadline: '🚀 Next Masterclass Starts Thursday! Claim your VIP seat.',
      widgetButtonText: 'Claim Free Seat',
      keywords: ['BAR_OPTIN', 'CLAIM', 'VIP'],
      matchRule: 'contains',
      keywordMode: 'keywords',
      refPayload: 'top_bar_lead'
    }
  },
  {
    type: 'web_embed_form',
    channel: 'web',
    category: 'growth_tools',
    title: 'Embedded Opt-in Button / Widget',
    description: 'Embeddable HTML/React widget for blog articles, checkout pages, and docs.',
    badge: 'Embed',
    icon: 'ExternalLink',
    defaultConfig: {
      title: 'Embedded Messenger Button',
      widgetButtonText: 'Send to Messenger',
      keywords: ['EMBED_OPTIN', 'START', 'DOWNLOAD'],
      matchRule: 'contains',
      keywordMode: 'keywords',
      refPayload: 'embed_button'
    }
  },
  {
    type: 'landing_page',
    channel: 'web',
    category: 'growth_tools',
    title: 'Hosted Lead Magnet Landing Page',
    description: 'Fast standalone mobile-optimized page with hero image, bullets, and 1-click opt-in.',
    badge: 'Hosted Page',
    icon: 'Globe',
    defaultConfig: {
      title: 'Hosted Opt-in Landing Page',
      widgetHeadline: 'Build Your First AI Bot in Under 30 Minutes',
      widgetButtonText: 'Get Started in Messenger',
      keywords: ['LANDING_PAGE', 'START', 'REGISTER'],
      matchRule: 'contains',
      keywordMode: 'keywords',
      refPayload: 'hosted_landing'
    }
  },

  // Integrations & Events
  {
    type: 'webhook',
    channel: 'integrations',
    category: 'integrations',
    title: 'External Webhook / Zapier / Make',
    description: 'Trigger this flow when an external app (Stripe, Calendly, ClickFunnels, CRM) sends an event.',
    badge: 'API / Webhook',
    icon: 'Webhook',
    popular: true,
    defaultConfig: {
      title: 'External Webhook Trigger',
      webhookUrl: 'https://api.chatmize.io/v1/webhooks/inbound/wh_live_83910fbc',
      webhookSource: 'Zapier / Stripe Checkout',
      keywords: ['CHECKOUT_COMPLETED', 'NEW_LEAD', 'TAG_ADDED', 'PURCHASE'],
      matchRule: 'contains',
      keywordMode: 'keywords'
    }
  },
  {
    type: 'shopify_trigger',
    channel: 'integrations',
    category: 'integrations',
    title: 'Shopify Store Event',
    description: 'Trigger flow on Shopify Abandoned Checkout, Order Created, or Customer Created.',
    badge: 'E-Commerce',
    icon: 'Zap',
    defaultConfig: {
      title: 'Shopify Abandoned Checkout Recovery',
      description: 'Triggered when Shopify checkout is abandoned for > 15 mins',
      keywords: ['ABANDONED_CHECKOUT', 'ORDER_PAID', 'CART_RECOVERY'],
      matchRule: 'contains',
      keywordMode: 'keywords'
    }
  },
  {
    type: 'lead_form',
    channel: 'integrations',
    category: 'integrations',
    title: 'Meta Instant Form (Lead Ad)',
    description: 'Trigger flow when a user submits a native Meta Facebook/Instagram Instant Lead Form.',
    badge: 'Lead Ads',
    icon: 'FileText',
    defaultConfig: {
      title: 'Meta Instant Lead Form Submission',
      adCampaignName: 'VIP Masterclass Lead Gen Instant Form',
      keywords: ['LEAD_SUBMITTED', 'VIP_FORM', 'INSTANT_LEAD'],
      matchRule: 'contains',
      keywordMode: 'keywords'
    }
  },

  // Bookings (native ChatMize bookings app)
  {
    type: 'booking_created',
    channel: 'integrations',
    category: 'integrations',
    title: 'Booking Created',
    description: 'Trigger flow when someone books through your ChatMize booking page, embed, or a BotMaps booking action.',
    badge: 'Bookings',
    icon: 'Calendar',
    popular: true,
    defaultConfig: {
      title: 'New Booking',
      description: 'Fires when a booking is created',
      keywords: ['BOOKING_CREATED'],
      matchRule: 'contains',
      keywordMode: 'keywords'
    }
  },
  {
    type: 'booking_reminder_due',
    channel: 'integrations',
    category: 'integrations',
    title: 'Booking Reminder Due',
    description: 'Trigger flow when a booking reminder goes out. Add your own follow up steps around the automatic reminder.',
    badge: 'Bookings',
    icon: 'BellRing',
    defaultConfig: {
      title: 'Booking Reminder',
      description: 'Fires when a reminder is sent for a booking',
      keywords: ['BOOKING_REMINDER'],
      matchRule: 'contains',
      keywordMode: 'keywords'
    }
  },
  {
    type: 'booking_completed',
    channel: 'integrations',
    category: 'integrations',
    title: 'Booking Completed',
    description: 'Trigger flow when a booking is marked completed. Great for review requests and upsells.',
    badge: 'Bookings',
    icon: 'CheckCircle2',
    defaultConfig: {
      title: 'Booking Completed',
      description: 'Fires when a booking is marked completed',
      keywords: ['BOOKING_COMPLETED'],
      matchRule: 'contains',
      keywordMode: 'keywords'
    }
  },
  {
    type: 'booking_no_show',
    channel: 'integrations',
    category: 'integrations',
    title: 'Booking Missed',
    description: 'Trigger flow when a booking is marked as missed. Win them back automatically.',
    badge: 'Bookings',
    icon: 'CalendarX',
    defaultConfig: {
      title: 'Booking Missed',
      description: 'Fires when a booking is marked as missed',
      keywords: ['BOOKING_NO_SHOW'],
      matchRule: 'contains',
      keywordMode: 'keywords'
    }
  },
  {
    type: 'booking_cancelled',
    channel: 'integrations',
    category: 'integrations',
    title: 'Booking Cancelled',
    description: 'Trigger flow when a booking is cancelled. Offer a new time automatically.',
    badge: 'Bookings',
    icon: 'XCircle',
    defaultConfig: {
      title: 'Booking Cancelled',
      description: 'Fires when a booking is cancelled',
      keywords: ['BOOKING_CANCELLED'],
      matchRule: 'contains',
      keywordMode: 'keywords'
    }
  }
];

export type OutsideRuleType = 
  | 'tag' 
  | 'otn' 
  | 'recurring_notification' 
  | 'whatsapp_template' 
  | 'sponsored_message';

export type MetaMessageTag = 
  | 'NONE'
  | 'CONFIRMED_EVENT_UPDATE'
  | 'POST_PURCHASE_UPDATE'
  | 'ACCOUNT_UPDATE'
  | 'HUMAN_AGENT';

export type MetaRecurringFrequency = 'daily' | 'weekly' | 'monthly';

export interface MetaRecurringNotificationConfig {
  topic: string;
  frequency: MetaRecurringFrequency;
  title: string;
  imageUrl?: string;
  optInButtonText: string;
  reOptInPromptDays: number; // e.g. prompt 7 days before token expires
}

export interface MetaOtnConfig {
  topic: string;
  title: string;
  optInButtonText: string;
}

export interface WhatsAppTemplateConfig {
  templateName: string;
  category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
  language: string;
  headerText?: string;
  bodyText: string;
  variables: string[]; // e.g. ['first_name', 'order_number']
  buttonLabel?: string;
}

export interface MetaPermissionRule {
  id: string;
  name: string;
  apiName: string;
  type: 'standard_24h' | 'message_tag' | 'recurring_notification' | 'one_time_notification' | 'human_agent' | 'whatsapp_template' | 'sponsored_message';
  description: string;
  allowedWindow: string;
  promotionalAllowed: boolean;
  requiresUserOptIn: boolean;
  graphPermissionRequired: string;
  documentationUrl?: string;
}

export const META_MESSAGING_RULES: MetaPermissionRule[] = [
  {
    id: 'standard_24h',
    name: 'Standard 24-Hour Messaging Window',
    apiName: 'Send API (Default)',
    type: 'standard_24h',
    description: 'Businesses can respond with free-form promotional and non-promotional messages within 24 hours of a user-initiated message.',
    allowedWindow: '24 hours from last user interaction',
    promotionalAllowed: true,
    requiresUserOptIn: false,
    graphPermissionRequired: 'pages_messaging / instagram_manage_messages',
  },
  {
    id: 'confirmed_event_update',
    name: 'Confirmed Event Update Tag',
    apiName: 'CONFIRMED_EVENT_UPDATE',
    type: 'message_tag',
    description: 'Send reminders, confirmations, or schedule updates for an event the user has previously registered for (e.g. webinar, appointment, reservation).',
    allowedWindow: 'Past 24 hours (Prior to and during event)',
    promotionalAllowed: false,
    requiresUserOptIn: true,
    graphPermissionRequired: 'pages_messaging',
  },
  {
    id: 'post_purchase_update',
    name: 'Post-Purchase Update Tag',
    apiName: 'POST_PURCHASE_UPDATE',
    type: 'message_tag',
    description: 'Notify users of order confirmations, invoices, receipts, shipment tracking, or delivery status updates for an existing transaction.',
    allowedWindow: 'Past 24 hours (As transaction events occur)',
    promotionalAllowed: false,
    requiresUserOptIn: false,
    graphPermissionRequired: 'pages_messaging',
  },
  {
    id: 'account_update',
    name: 'Account Update Tag',
    apiName: 'ACCOUNT_UPDATE',
    type: 'message_tag',
    description: 'Alert users of non-recurring changes to their application, account status, security alerts, or form submissions.',
    allowedWindow: 'Past 24 hours (When account event triggers)',
    promotionalAllowed: false,
    requiresUserOptIn: false,
    graphPermissionRequired: 'pages_messaging',
  },
  {
    id: 'human_agent',
    name: 'Human Agent Tag (7-Day Extension)',
    apiName: 'HUMAN_AGENT',
    type: 'human_agent',
    description: 'Allows human live agents to reply to user inquiries within 7 days (168 hours) instead of 24 hours for complex support issues that cannot be resolved in 24 hours.',
    allowedWindow: '7 days (168 hours) from user message',
    promotionalAllowed: false,
    requiresUserOptIn: false,
    graphPermissionRequired: 'pages_messaging (Human Agent Permission)',
  },
  {
    id: 'recurring_notification',
    name: 'Recurring Notifications (Marketing Messages API)',
    apiName: 'notification_messages',
    type: 'recurring_notification',
    description: "Meta's flagship API to send scheduled PROMOTIONAL and marketing updates outside the 24-hour window. Requires explicit user opt-in during active conversation.",
    allowedWindow: 'Daily (6 months), Weekly (9 months), Monthly (12 months)',
    promotionalAllowed: true,
    requiresUserOptIn: true,
    graphPermissionRequired: 'pages_messaging_subscriptions / recurring_notifications',
  },
  {
    id: 'one_time_notification',
    name: 'One-Time Notification (OTN)',
    apiName: 'one_time_notif_req',
    type: 'one_time_notification',
    description: 'Request permission to send 1 single follow-up message when an item is back in stock, registration opens, or a specific event occurs.',
    allowedWindow: 'Past 24 hours (1 message per granted token, up to 1 year)',
    promotionalAllowed: true,
    requiresUserOptIn: true,
    graphPermissionRequired: 'pages_messaging (OTN Feature)',
  },
  {
    id: 'whatsapp_template',
    name: 'WhatsApp Pre-Approved Templates',
    apiName: 'messages (Template Object)',
    type: 'whatsapp_template',
    description: 'To initiate conversations or follow up past 24 hours on WhatsApp, businesses must use Meta-reviewed and approved templates (Marketing, Utility, Authentication).',
    allowedWindow: 'Anytime (Subject to Meta template category rates & opt-in)',
    promotionalAllowed: true, // Only in MARKETING category
    requiresUserOptIn: true,
    graphPermissionRequired: 'whatsapp_business_messaging',
  },
  {
    id: 'sponsored_message',
    name: 'Sponsored Messages (Paid Meta Ads API)',
    apiName: 'send_sponsored_message',
    type: 'sponsored_message',
    description: 'Paid re-engagement messages delivered directly into user Messenger inboxes who have an existing open thread with your Page.',
    allowedWindow: 'Anytime (Delivered as paid sponsored message)',
    promotionalAllowed: true,
    requiresUserOptIn: false,
    graphPermissionRequired: 'ads_management',
  }
];

export const BANNED_PROMO_KEYWORDS_FOR_TAGS = [
  'discount', 'coupon', 'promo', 'code', 'sale', 'off', '% off', 
  'buy now', 'special offer', 'limited time', 'deal', 'save', 'price', 
  'shop now', 'black friday', 'cyber monday', 'checkout', 'exclusive offer'
];

export function validateMessageTagCompliance(text: string, tag: MetaMessageTag): { compliant: boolean; flaggedWords: string[]; message?: string } {
  if (!tag || tag === 'NONE') {
    return { compliant: true, flaggedWords: [] };
  }

  const lower = text.toLowerCase();
  const flagged = BANNED_PROMO_KEYWORDS_FOR_TAGS.filter(word => lower.includes(word));

  if (flagged.length > 0) {
    return {
      compliant: false,
      flaggedWords: flagged,
      message: `Meta Policy Warning: The tag "${tag}" is strictly non-promotional. Promotional terms detected: [${flagged.join(', ')}]. Meta may revoke your Page messaging permissions if promotional content is sent under this tag. Use Recurring Notifications or Sponsored Messages instead.`
    };
  }

  return { compliant: true, flaggedWords: [] };
}
