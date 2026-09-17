export interface IntegrationApp {
  id: string;
  name: string;
  category: 'email' | 'webinar' | 'crm' | 'automation' | 'ecommerce' | 'contest';
  tagline: string;
  description: string;
  logoBg: string;
  logoTextColor: string;
  initials: string;
  connected: boolean;
  fields: { name: string; label: string; placeholder: string; type?: string; helpText?: string }[];
  authType: 'API Key' | 'OAuth / API Token' | 'Webhook & Key';
}

export const CHATMIZE_INTEGRATIONS: IntegrationApp[] = [
  // Email Autoresponders
  {
    id: 'activecampaign',
    name: 'ActiveCampaign',
    category: 'email',
    tagline: 'Email marketing, automation & CRM',
    description: 'Sync leads, subscribe contacts to automated follow-up sequences, and apply dynamic customer tags.',
    logoBg: 'bg-[#356AE6]',
    logoTextColor: 'text-white',
    initials: 'AC',
    connected: true,
    authType: 'API Key',
    fields: [
      { name: 'apiUrl', label: 'API URL', placeholder: 'https://youraccount.api-us1.com', helpText: 'ActiveCampaign > Settings > Developer > API Access > URL' },
      { name: 'apiKey', label: 'API Key', placeholder: 'Enter your 64-character API Key', type: 'password', helpText: 'ActiveCampaign > Settings > Developer > API Access > Key' },
    ],
  },
  {
    id: 'mailchimp',
    name: 'Mailchimp',
    category: 'email',
    tagline: 'Marketing platform & email automation',
    description: 'Add subscriber emails collected from chatbot flows directly to your Mailchimp Audiences and groups.',
    logoBg: 'bg-[#FFE01B]',
    logoTextColor: 'text-black',
    initials: 'MC',
    connected: false,
    authType: 'API Key',
    fields: [
      { name: 'apiKey', label: 'Mailchimp API Key', placeholder: 'md-xxxxxxxxxxxxxxxxxxxxxx-us19', type: 'password', helpText: 'Account & Billing > Extras > API Keys' },
    ],
  },
  {
    id: 'convertkit',
    name: 'ConvertKit (Kit)',
    category: 'email',
    tagline: 'Creator marketing & email broadcasts',
    description: 'Add subscribers to forms, trigger automated creator sequences, and track purchase tags.',
    logoBg: 'bg-[#FB6970]',
    logoTextColor: 'text-white',
    initials: 'CK',
    connected: false,
    authType: 'API Key',
    fields: [
      { name: 'apiKey', label: 'ConvertKit API Key', placeholder: 'Enter public API key', helpText: 'Account Settings > Advanced > API Key' },
      { name: 'apiSecret', label: 'API Secret', placeholder: 'Enter API secret', type: 'password', helpText: 'Account Settings > Advanced > API Secret' },
    ],
  },
  {
    id: 'getresponse',
    name: 'GetResponse',
    category: 'email',
    tagline: 'Email marketing & funnel automation',
    description: 'Push chatbot contacts to targeted campaigns and trigger autoresponders on day 0.',
    logoBg: 'bg-[#00BAFF]',
    logoTextColor: 'text-white',
    initials: 'GR',
    connected: false,
    authType: 'API Key',
    fields: [
      { name: 'apiKey', label: 'GetResponse API Key', placeholder: '32-character hexadecimal key', type: 'password', helpText: 'Integrations & API > API > Generate Key' },
    ],
  },
  {
    id: 'aweber',
    name: 'AWeber',
    category: 'email',
    tagline: 'Reliable email delivery & subscriber lists',
    description: 'Instantly add new conversational leads into AWeber subscriber lists with custom tags.',
    logoBg: 'bg-[#245CA6]',
    logoTextColor: 'text-white',
    initials: 'AW',
    connected: false,
    authType: 'OAuth / API Token',
    fields: [
      { name: 'authCode', label: 'AWeber Authorization Code', placeholder: 'Paste AWeber OAuth authorization code', type: 'password', helpText: 'Sign into AWeber to grant access and copy code' },
    ],
  },
  {
    id: 'sendgrid',
    name: 'SendGrid (Twilio)',
    category: 'email',
    tagline: 'Transactional & marketing email API',
    description: 'Trigger high-deliverability transactional emails and password resets directly from chatbot nodes.',
    logoBg: 'bg-[#1A82E2]',
    logoTextColor: 'text-white',
    initials: 'SG',
    connected: false,
    authType: 'API Key',
    fields: [
      { name: 'apiKey', label: 'SendGrid API Key (Mail Send access)', placeholder: 'SG.xxxxxxxxxxxxxxxxxx', type: 'password', helpText: 'Settings > API Keys > Create API Key' },
    ],
  },
  {
    id: 'drip',
    name: 'Drip',
    category: 'email',
    tagline: 'E-commerce marketing engine',
    description: 'Trigger personalized drip campaigns and record revenue-generating conversational events.',
    logoBg: 'bg-[#FF0055]',
    logoTextColor: 'text-white',
    initials: 'DP',
    connected: false,
    authType: 'API Key',
    fields: [
      { name: 'accountId', label: 'Drip Account ID', placeholder: '7-digit Account ID', helpText: 'Settings > Account > Account ID' },
      { name: 'apiToken', label: 'Drip API Token', placeholder: 'Enter User API Token', type: 'password', helpText: 'User Settings > API Token' },
    ],
  },
  {
    id: 'sendlane',
    name: 'SendLane',
    category: 'email',
    tagline: 'Behavior-based email & SMS automation',
    description: 'Sync customer phone numbers and emails to multi-channel customer journeys.',
    logoBg: 'bg-[#5B3CF5]',
    logoTextColor: 'text-white',
    initials: 'SL',
    connected: false,
    authType: 'API Key',
    fields: [
      { name: 'apiSubdomain', label: 'SendLane Subdomain', placeholder: 'yourdomain', helpText: 'Account URL subdomain prefix' },
      { name: 'apiKey', label: 'SendLane API Key', placeholder: 'Enter API Key', type: 'password' },
      { name: 'hashKey', label: 'SendLane Hash Key', placeholder: 'Enter Hash Key', type: 'password' },
    ],
  },
  {
    id: 'moosend',
    name: 'Moosend',
    category: 'email',
    tagline: 'Email marketing & automation',
    description: 'Subscribe chatbot leads to Moosend mailing lists and trigger automated campaigns.',
    logoBg: 'bg-[#2F80ED]',
    logoTextColor: 'text-white',
    initials: 'MS',
    connected: false,
    authType: 'API Key',
    fields: [
      { name: 'apiKey', label: 'Moosend API Key', placeholder: 'Enter your Moosend API key', type: 'password', helpText: 'Moosend > Settings (top-right menu) > API Key' },
    ],
  },
  {
    id: 'ontraport',
    name: 'Ontraport',
    category: 'crm',
    tagline: 'All-in-one CRM & business automation',
    description: 'Create contacts, update custom CRM objects, and trigger Ontraport business campaigns.',
    logoBg: 'bg-[#FF5A00]',
    logoTextColor: 'text-white',
    initials: 'OP',
    connected: false,
    authType: 'API Key',
    fields: [
      { name: 'appId', label: 'Ontraport App ID', placeholder: 'Enter App ID', helpText: 'Administration > Integrations > Ontraport API' },
      { name: 'apiKey', label: 'Ontraport API Key', placeholder: 'Enter API Key', type: 'password' },
    ],
  },

  // Webinar Platforms
  {
    id: 'webinarjam',
    name: 'WebinarJam & EverWebinar',
    category: 'webinar',
    tagline: 'Live & automated evergreen webinars',
    description: 'Register attendees automatically via chat flows, send calendar confirmations, and pass webinar URLs.',
    logoBg: 'bg-[#E53935]',
    logoTextColor: 'text-white',
    initials: 'WJ',
    connected: false,
    authType: 'API Key',
    fields: [
      { name: 'apiKey', label: 'Genesis API Key', placeholder: 'Enter Genesis API Key', type: 'password', helpText: 'Advanced > API Integrations' },
    ],
  },
  {
    id: 'demio',
    name: 'Demio',
    category: 'webinar',
    tagline: 'Smart webinar software for marketing',
    description: 'Instant one-click registrations directly from Instagram DM and Messenger conversation triggers.',
    logoBg: 'bg-[#4B6FFF]',
    logoTextColor: 'text-white',
    initials: 'DM',
    connected: false,
    authType: 'API Key',
    fields: [
      { name: 'apiKey', label: 'Demio API Key', placeholder: 'Enter API Key', type: 'password', helpText: 'Settings > API' },
      { name: 'apiSecret', label: 'Demio API Secret', placeholder: 'Enter API Secret', type: 'password' },
    ],
  },
  {
    id: 'gotowebinar',
    name: 'GoToWebinar',
    category: 'webinar',
    tagline: 'Enterprise webinar and conference platform',
    description: 'Register qualified enterprise leads into upcoming GoToWebinar broadcast sessions.',
    logoBg: 'bg-[#FF9800]',
    logoTextColor: 'text-white',
    initials: 'GT',
    connected: false,
    authType: 'OAuth / API Token',
    fields: [
      { name: 'accessToken', label: 'OAuth Access Token', placeholder: 'Enter GoTo developer token', type: 'password' },
    ],
  },

  // General Automation & Workflows
  {
    id: 'zapier',
    name: 'Zapier',
    category: 'automation',
    tagline: 'Connect with 5,000+ business applications',
    description: 'Fire custom trigger events on bot step completion, form submission, or tag application.',
    logoBg: 'bg-[#FF4A00]',
    logoTextColor: 'text-white',
    initials: 'ZP',
    connected: true,
    authType: 'Webhook & Key',
    fields: [
      { name: 'webhookUrl', label: 'Zapier Catch Webhook URL', placeholder: 'https://hooks.zapier.com/hooks/catch/...', helpText: 'Create a Zap with "Webhooks by Zapier" -> Catch Hook' },
      { name: 'secretKey', label: 'Optional Secret Header', placeholder: 'Bearer secret_token_optional', type: 'password' },
    ],
  },
  {
    id: 'integromat',
    name: 'Make (Integromat)',
    category: 'automation',
    tagline: 'Visual automation builder & scenario router',
    description: 'Real-time two-way data sync between your bot flows and complex Make multi-step scenarios.',
    logoBg: 'bg-[#6F3FF5]',
    logoTextColor: 'text-white',
    initials: 'MK',
    connected: false,
    authType: 'Webhook & Key',
    fields: [
      { name: 'webhookUrl', label: 'Make Custom Webhook URL', placeholder: 'https://hook.eu1.make.com/...', helpText: 'Add a "Custom Webhook" module in your Make scenario' },
    ],
  },
  {
    id: 'integrately',
    name: 'Integrately',
    category: 'automation',
    tagline: '1-click automations for non-techies',
    description: 'Connect your chatbot contacts to Google Sheets, Notion, Airtable, and Slack in 1 click.',
    logoBg: 'bg-[#00D09C]',
    logoTextColor: 'text-white',
    initials: 'IG',
    connected: false,
    authType: 'Webhook & Key',
    fields: [
      { name: 'webhookUrl', label: 'Integrately Webhook URL', placeholder: 'https://webhooks.integrately.com/a/webhooks/...', helpText: 'Copy from your active automation recipe' },
    ],
  },

  // Affiliate & E-commerce & Contests
  {
    id: 'paykickstart',
    name: 'PayKickStart',
    category: 'ecommerce',
    tagline: 'Subscription billing & affiliate management',
    description: 'Automate post-purchase onboarding messages, failed rebill notifications, and affiliate tracking.',
    logoBg: 'bg-[#2196F3]',
    logoTextColor: 'text-white',
    initials: 'PK',
    connected: false,
    authType: 'API Key',
    fields: [
      { name: 'apiSecret', label: 'PayKickStart IPN Secret', placeholder: 'Enter IPN secret key', type: 'password', helpText: 'Settings > Integrations > IPN Secret' },
    ],
  },
  {
    id: 'perkzilla',
    name: 'PerkZilla & LetSpinio',
    category: 'contest',
    tagline: 'Viral rewards, giveaways & spin wheels',
    description: 'Award contest points, track viral referral links, and trigger gamified bot prize messages.',
    logoBg: 'bg-[#E91E63]',
    logoTextColor: 'text-white',
    initials: 'PZ',
    connected: false,
    authType: 'API Key',
    fields: [
      { name: 'campaignId', label: 'Campaign UUID', placeholder: 'Enter campaign ID from PerkZilla' },
      { name: 'apiKey', label: 'PerkZilla API Key', placeholder: 'Enter API Key', type: 'password' },
    ],
  },
  {
    id: 'everlesson',
    name: 'EverLesson',
    category: 'crm',
    tagline: 'Membership site & course platform',
    description: 'Grant course access and membership login credentials automatically upon completing a lead flow.',
    logoBg: 'bg-[#009688]',
    logoTextColor: 'text-white',
    initials: 'EL',
    connected: false,
    authType: 'API Key',
    fields: [
      { name: 'membershipUrl', label: 'Membership URL', placeholder: 'https://yourmembership.everlesson.com' },
      { name: 'apiKey', label: 'EverLesson API Key', placeholder: 'Enter API Key', type: 'password' },
    ],
  },
];

export const INTEGRATION_ACTION_TEMPLATES: Record<string, { label: string; action: string }[]> = {
  activecampaign: [
    { label: 'Add Tag: VIP Lead', action: 'ActiveCampaign: Add Tag [VIP Lead]' },
    { label: 'Add Tag: Webinar Registered', action: 'ActiveCampaign: Add Tag [Webinar Registered]' },
    { label: 'Subscribe: 3hr Follow-up Sequence', action: 'ActiveCampaign: SubscribeToSequence [3hr Ad Follow up]' },
    { label: 'Remove Tag: Prospect', action: 'ActiveCampaign: Remove Tag [Prospect]' },
  ],
  mailchimp: [
    { label: 'Subscribe: Newsletter Audience', action: 'Mailchimp: Subscribe [Newsletter]' },
    { label: 'Add Tag: Chatbot Lead', action: 'Mailchimp: Add Tag [Chatbot Lead]' },
    { label: 'Add Tag: VIP Customer', action: 'Mailchimp: Add Tag [VIP Customer]' },
    { label: 'Unsubscribe Contact', action: 'Mailchimp: Unsubscribe Contact' },
  ],
  convertkit: [
    { label: 'Add Tag: Ebook Download', action: 'ConvertKit: Add Tag [Ebook]' },
    { label: 'Subscribe to Form: Lead Magnet', action: 'ConvertKit: Subscribe to Form [Lead Magnet]' },
    { label: 'Add to Sequence: Onboarding', action: 'ConvertKit: Add to Sequence [Onboarding]' },
  ],
  getresponse: [
    { label: 'Add Contact to List: Leads', action: 'GetResponse: Add to List [Chat Leads]' },
    { label: 'Apply Tag: Engaged Customer', action: 'GetResponse: Apply Tag [Engaged]' },
  ],
  aweber: [
    { label: 'Add Subscriber to List', action: 'AWeber: Add Subscriber [Main List]' },
    { label: 'Apply Tag: Webinar Signup', action: 'AWeber: Apply Tag [Webinar Signup]' },
  ],
  sendgrid: [
    { label: 'Add Contact to Marketing List', action: 'SendGrid: Add Contact [Marketing List]' },
    { label: 'Trigger Transactional Welcome Email', action: 'SendGrid: Send Template [Welcome Email]' },
  ],
  drip: [
    { label: 'Record Event: Bot Conversation', action: 'Drip: Record Event [Bot Conversation]' },
    { label: 'Apply Tag: VIP Prospect', action: 'Drip: Apply Tag [VIP Prospect]' },
  ],
  sendlane: [
    { label: 'Add Contact to List', action: 'Sendlane: Add to List [Subscribers]' },
    { label: 'Apply Tag: Messenger Lead', action: 'Sendlane: Apply Tag [Messenger Lead]' },
  ],
  ontraport: [
    { label: 'Add Contact with Tag: Lead', action: 'Ontraport: Add Contact [Tag: Inbound Lead]' },
    { label: 'Trigger Campaign: Welcome Sequence', action: 'Ontraport: Trigger Campaign [Welcome]' },
  ],
  webinarjam: [
    { label: 'Register Attendee for Upcoming Live', action: 'WebinarJam: Register Attendee [Live Session]' },
  ],
  demio: [
    { label: 'Register Attendee for Webinar', action: 'Demio: Register for Webinar [Masterclass]' },
  ],
  gotowebinar: [
    { label: 'Register Attendee for Broadcast', action: 'GoToWebinar: Register Attendee [Broadcast]' },
  ],
  zapier: [
    { label: 'Trigger Catch Hook: New Lead', action: 'Zapier: Trigger Webhook [New Lead]' },
    { label: 'Trigger Webhook: Custom Event', action: 'Zapier: Trigger Webhook [Custom Event]' },
  ],
  integromat: [
    { label: 'Send Webhook Payload (Make)', action: 'Make: Send Webhook Payload [Lead Created]' },
  ],
  integrately: [
    { label: 'Post Webhook Event', action: 'Integrately: Post Webhook Event [Flow Completed]' },
  ],
  paykickstart: [
    { label: 'Verify Customer License', action: 'PayKickstart: Verify License' },
  ],
  perkzilla: [
    { label: 'Register Referral Participant', action: 'PerkZilla: Register Referral Participant' },
  ],
  everlesson: [
    { label: 'Grant Membership Course Access', action: 'Everlesson: Grant Course Access' },
  ],
};

export interface IntegrationConnectionData {
  listLabel: string;
  lists: { id: string; name: string }[];
  supportsTags: boolean;
  availableTags?: string[];
}

export const INTEGRATION_PLATFORM_DATA: Record<string, IntegrationConnectionData> = {
  activecampaign: {
    listLabel: 'Select List',
    lists: [
      { id: 'master-leads', name: 'Master Lead List (Main)' },
      { id: 'workshop-registrants', name: 'Build-A-Bot Workshop Registrants' },
      { id: 'newsletter', name: 'Weekly Growth Newsletter' },
      { id: 'vip-buyers', name: 'VIP Buyers & Clients' },
    ],
    supportsTags: true,
    availableTags: [
      'VIP Lead',
      'Webinar Registered',
      'Workshop Attendee',
      'High Intent Prospect',
      'Ebook Downloaded',
      '3hr Follow-up Needed',
      'Customer Onboarded',
    ],
  },
  mailchimp: {
    listLabel: 'Select Audience / List',
    lists: [
      { id: 'main-audience', name: 'ChatMize Primary Audience' },
      { id: 'newsletter-subscribers', name: 'Newsletter Subscribers' },
      { id: 'ecommerce-buyers', name: 'E-Commerce Customers' },
      { id: 'beta-testers', name: 'Beta Launch List' },
    ],
    supportsTags: true,
    availableTags: [
      'Chatbot Lead',
      'VIP Customer',
      'Promo Engaged',
      'Cart Abandoner',
      'Newsletter Subscriber',
      'Flash Sale Interest',
    ],
  },
  convertkit: {
    listLabel: 'Select Form / Sequence',
    lists: [
      { id: 'lead-magnet-form', name: 'Free Bot Playbook (Form)' },
      { id: 'webinar-signup-form', name: 'Masterclass Live Access (Form)' },
      { id: '7day-nurture-seq', name: '7-Day Conversational Nurture (Sequence)' },
      { id: 'vip-client-seq', name: 'VIP Client Onboarding (Sequence)' },
    ],
    supportsTags: true,
    availableTags: [
      'Ebook Downloaded',
      'Bot Qualified',
      'Masterclass Registered',
      'Agency Owner',
      'High Value Lead',
    ],
  },
  getresponse: {
    listLabel: 'Select Contact List',
    lists: [
      { id: 'gr-leads', name: 'Messenger & DM Inbound Leads' },
      { id: 'gr-workshop', name: 'Webinar Masterclass Campaign' },
      { id: 'gr-newsletter', name: 'Weekly Newsletter Broadcasts' },
    ],
    supportsTags: true,
    availableTags: [
      'Hot Lead',
      'Engaged Customer',
      'Follow-up Required',
      'Webinar Registered',
    ],
  },
  aweber: {
    listLabel: 'Select Subscriber List',
    lists: [
      { id: 'aw-primary', name: 'ChatMize Main Broadcast List' },
      { id: 'aw-workshop', name: 'Live Masterclass Registrants' },
      { id: 'aw-buyers', name: 'Product Purchasers' },
    ],
    supportsTags: true,
    availableTags: [
      'Messenger Lead',
      'Webinar Signup',
      'VIP Prospect',
      'Demo Requested',
    ],
  },
  sendgrid: {
    listLabel: 'Select Marketing List',
    lists: [
      { id: 'sg-marketing', name: 'Main Marketing Contacts' },
      { id: 'sg-onboarding', name: 'Product Onboarding List' },
      { id: 'sg-vip', name: 'Key Enterprise Accounts' },
    ],
    supportsTags: false,
  },
  drip: {
    listLabel: 'Select Campaign / Account',
    lists: [
      { id: 'drip-main', name: 'Default Customer Journey' },
      { id: 'drip-high-intent', name: 'High-Intent Inbound Pipeline' },
    ],
    supportsTags: true,
    availableTags: [
      'Bot Conversation',
      'VIP Prospect',
      'Trial Started',
      'Demo Completed',
    ],
  },
  sendlane: {
    listLabel: 'Select List',
    lists: [
      { id: 'sl-subscribers', name: 'SMS & Email Omnichannel List' },
      { id: 'sl-launch', name: 'Product Launch VIPs' },
    ],
    supportsTags: true,
    availableTags: [
      'Messenger Lead',
      'VIP Customer',
      'SMS Opted-in',
    ],
  },
  ontraport: {
    listLabel: 'Select Campaign / Sequence',
    lists: [
      { id: 'op-welcome', name: 'Inbound Welcome & Nurture' },
      { id: 'op-sales', name: 'Sales Pipeline Follow-up' },
    ],
    supportsTags: true,
    availableTags: [
      'Inbound Lead',
      'Masterclass Attendee',
      'Decision Maker',
    ],
  },
  demio: {
    listLabel: 'Select Webinar Session',
    lists: [
      { id: 'demio-live', name: 'Build-A-Bot Live Workshop (Thursday 2PM EST)' },
      { id: 'demio-replay', name: 'Automated Evergreen Masterclass (Instant Access)' },
      { id: 'demio-vip', name: 'VIP Agency Q&A Intensive' },
    ],
    supportsTags: false,
  },
  webinarjam: {
    listLabel: 'Select Webinar Event',
    lists: [
      { id: 'wj-main', name: 'Next Live Masterclass Broadcast' },
      { id: 'wj-evergreen', name: 'EverWebinar Automated Funnel' },
    ],
    supportsTags: false,
  },
  gotowebinar: {
    listLabel: 'Select Scheduled Webinar',
    lists: [
      { id: 'gt-enterprise', name: 'Enterprise Automation Summit' },
      { id: 'gt-demo', name: 'Weekly Live Product Demo' },
    ],
    supportsTags: false,
  },
  zapier: {
    listLabel: 'Select Zap Catch Hook',
    lists: [
      { id: 'zap-new-lead', name: 'Catch Hook: Sync New Lead to CRM (Zap #102)' },
      { id: 'zap-slack-alert', name: 'Catch Hook: Send Instant Slack Alert (Zap #103)' },
      { id: 'zap-sheets-export', name: 'Catch Hook: Append Row to Google Sheets (Zap #104)' },
    ],
    supportsTags: true,
    availableTags: [
      'New Lead',
      'High Priority',
      'Demo Request',
      'Trigger Sequence',
    ],
  },
  integromat: {
    listLabel: 'Select Make Webhook',
    lists: [
      { id: 'make-lead-flow', name: 'Webhook: Lead Ingestion Scenario' },
      { id: 'make-crm-router', name: 'Webhook: Multi-CRM Data Router' },
    ],
    supportsTags: false,
  },
  integrately: {
    listLabel: 'Select Automation Recipe',
    lists: [
      { id: 'ig-sheets-recipe', name: 'ChatMize to Google Sheets & Slack' },
      { id: 'ig-hubspot-recipe', name: 'ChatMize to HubSpot CRM' },
    ],
    supportsTags: false,
  },
  paykickstart: {
    listLabel: 'Select Product / Plan',
    lists: [
      { id: 'pk-pro', name: 'Build-A-Bot Pro Annual License' },
      { id: 'pk-agency', name: 'Agency Unlimited Tier' },
    ],
    supportsTags: true,
    availableTags: [
      'License Verified',
      'Active Subscriber',
      'Trial Member',
    ],
  },
  perkzilla: {
    listLabel: 'Select Referral Campaign',
    lists: [
      { id: 'pz-viral-giveaway', name: 'Summer Viral Bot Giveaway' },
      { id: 'pz-vip-referral', name: 'VIP Ambassador Rewards Program' },
    ],
    supportsTags: true,
    availableTags: [
      'Registered Referral',
      'Prize Winner',
      'Milestone Reached',
    ],
  },
  everlesson: {
    listLabel: 'Select Membership Portal',
    lists: [
      { id: 'el-mastery', name: 'Chatbot Marketing Mastery Academy' },
      { id: 'el-vip-coaching', name: 'Inner Circle VIP Coaching' },
    ],
    supportsTags: false,
  },
};

export function getStoredIntegrationCredentials(): Record<string, Record<string, string>> {
  try {
    const raw = localStorage.getItem('chatmize_integration_credentials');
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {
    // ignore
  }
  // Default seeded credentials for active integrations in the demo
  return {
    activecampaign: {
      apiUrl: 'https://instantreferrals.api-us1.com',
      apiKey: 'ac_live_89104fae892b490cebf',
    },
    mailchimp: {
      apiKey: 'mc_live_7891240981b2401f-us6',
    },
    zapier: {
      webhookUrl: 'https://hooks.zapier.com/hooks/catch/1928401/bq9182a/',
    }
  };
}

export function getActiveConnectedIntegrations(): IntegrationApp[] {
  const creds = getStoredIntegrationCredentials();
  const activeIds = new Set(Object.keys(creds));
  return CHATMIZE_INTEGRATIONS.filter(app => activeIds.has(app.id));
}
