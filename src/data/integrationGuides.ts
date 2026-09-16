import { TRIGGER_KNOWLEDGE_GUIDES, TriggerKnowledgeGuide } from './triggerGuides';

export interface IntegrationGuide {
  appId: string;
  appName: string;
  category: string;
  section?: 'triggers' | 'integrations';
  channel?: 'instagram' | 'messenger' | 'whatsapp' | 'web' | 'integrations';
  authMethod: string;
  badge?: string;
  metaPolicyRules?: string;
  summary: string;
  howItWorks?: string;
  steps: {
    title: string;
    description: string;
    tip?: string;
  }[];
  howItWorksInFlows: string;
  examplePayload?: string;
  bestPractices?: string[];
  troubleshooting: string[];
}

const BASE_INTEGRATION_GUIDES: Record<string, IntegrationGuide> = {
  activecampaign: {
    appId: 'activecampaign',
    appName: 'ActiveCampaign',
    category: 'Email Autoresponders & CRM',
    authMethod: 'API URL & API Key',
    summary: 'Connect ActiveCampaign to automatically subscribe chat leads to lists, apply tags, and trigger follow-up automations when users provide their contact info in a conversational flow.',
    steps: [
      {
        title: 'Step 1: Log in to your ActiveCampaign account',
        description: 'Log into your ActiveCampaign dashboard with an administrator account.',
      },
      {
        title: 'Step 2: Access Developer Settings',
        description: 'Click on the gear icon (Settings) in the bottom-left navigation bar, then click "Developer".',
        tip: 'Both API URL and Key are located in the "API Access" section of this page.',
      },
      {
        title: 'Step 3: Copy your API URL and API Key',
        description: 'Copy the complete URL (e.g. https://youraccount.api-us1.com) and the 64-character API Key.',
      },
      {
        title: 'Step 4: Connect inside Chatmize',
        description: 'Paste both credentials into the Integration form, give your connection a nickname, and click "Save & Verify".',
      },
    ],
    howItWorksInFlows: 'In Flow Builder, add an Action block -> choose "ActiveCampaign" -> select your target List and choose whether to apply custom Tags upon completing user input capture.',
    troubleshooting: [
      'Ensure the API URL begins with https:// and has no trailing slash.',
      'If verification fails, verify that your ActiveCampaign user has Developer Access permissions.',
      'Check that the target list exists and is not archived in your ActiveCampaign portal.',
    ],
  },
  mailchimp: {
    appId: 'mailchimp',
    appName: 'Mailchimp',
    category: 'Email Autoresponders',
    authMethod: 'API Key',
    summary: 'Push new conversational subscribers directly into your Mailchimp Audiences and assign interest groups seamlessly.',
    steps: [
      {
        title: 'Step 1: Open Account Extras',
        description: 'Click on your profile avatar in the bottom left of Mailchimp, select "Account & Billing", then click the "Extras" tab.',
      },
      {
        title: 'Step 2: Generate an API Key',
        description: 'Click "API keys", scroll down to "Your API keys", and click "Create A Key". Name it "Chatmize Bot Integration".',
        tip: 'Mailchimp API keys look like md-xxxxxxxxxxxxxxxxxxxxxx-us19 (ending with your datacenter prefix).',
      },
      {
        title: 'Step 3: Save and test connection',
        description: 'Paste the key into the connection modal and click "Save Changes".',
      },
    ],
    howItWorksInFlows: 'After collecting email using a Free Type or Quick Reply input block, use the Mailchimp action to add the contact to your Audience with Double Opt-in optionally enabled or disabled.',
    troubleshooting: [
      'Make sure you include the full key suffix (e.g., -us19, -us20).',
      'Verify that your Audience does not have required custom fields that your bot flow is not sending.',
    ],
  },
  convertkit: {
    appId: 'convertkit',
    appName: 'ConvertKit (Kit)',
    category: 'Email & Creator Marketing',
    authMethod: 'API Key & API Secret',
    summary: 'Seamlessly add leads to ConvertKit Forms and Sequences, trigger broadcast funnels, and attach purchase tags.',
    steps: [
      {
        title: 'Step 1: Open Advanced Account Settings',
        description: 'In your Kit (ConvertKit) account, click your profile name at the top right and select "Settings".',
      },
      {
        title: 'Step 2: Access the Advanced tab',
        description: 'Scroll the left settings menu down to "Advanced". Here you will find both your API Key and API Secret.',
      },
      {
        title: 'Step 3: Reveal and copy credentials',
        description: 'Click "Show" next to the API Secret. Copy both the public API Key and Secret into Chatmize.',
      },
    ],
    howItWorksInFlows: 'Trigger sequence enrollment as soon as a lead confirms their email or phone number in Instagram DM or WhatsApp.',
    troubleshooting: [
      'ConvertKit requires both the Key and the Secret for full subscriber tag synchronization.',
      'Ensure the Form you select in your action step is published and active in Kit.',
    ],
  },
  getresponse: {
    appId: 'getresponse',
    appName: 'GetResponse',
    category: 'Email Marketing & Funnels',
    authMethod: 'API Key',
    summary: 'Push new contacts directly into specific GetResponse campaigns and trigger autoresponder cycle day 0.',
    steps: [
      {
        title: 'Step 1: Navigate to Integrations & API',
        description: 'Click the menu icon at the top left of GetResponse and choose "Integrations & API".',
      },
      {
        title: 'Step 2: Generate an API Key',
        description: 'Select the "API" tab and click "Generate API Key". Name it "Chatmize Integration" and copy the 32-character key.',
      },
      {
        title: 'Step 3: Save inside Settings',
        description: 'Paste the API key into Chatmize and confirm verification.',
      },
    ],
    howItWorksInFlows: 'Select target list name and specify whether the contact should enter day 0 of your autoresponder campaign.',
    troubleshooting: [
      'Confirm the key has not expired or been deleted in GetResponse.',
      'Ensure the target list in GetResponse has postal address and required company info configured.',
    ],
  },
  aweber: {
    appId: 'aweber',
    appName: 'AWeber',
    category: 'Email Autoresponders',
    authMethod: 'OAuth Authorization Code',
    summary: 'Connect your AWeber account to send verified subscriber emails directly into designated list campaigns.',
    steps: [
      {
        title: 'Step 1: Authorize Application',
        description: 'Click the AWeber authorization link to sign in and grant Chatmize read/write permissions to your subscriber lists.',
      },
      {
        title: 'Step 2: Copy the Authorization Code',
        description: 'AWeber will generate a secure one-time authorization string. Copy and paste it into the connection input.',
      },
      {
        title: 'Step 3: Verification',
        description: 'Click "Connect AWeber" to store the refreshed token securely.',
      },
    ],
    howItWorksInFlows: 'Tag subscribers with campaign source tags such as "instagram-dm" or "webinar-lead".',
    troubleshooting: [
      'Authorization codes expire after 10 minutes. If verification fails, re-generate a new code.',
    ],
  },
  sendgrid: {
    appId: 'sendgrid',
    appName: 'SendGrid (Twilio)',
    category: 'Transactional & Marketing Email',
    authMethod: 'API Key',
    summary: 'Send instant email notifications, receipts, or welcome packages directly through SendGrid’s high-deliverability cloud API.',
    steps: [
      {
        title: 'Step 1: Go to API Keys in SendGrid',
        description: 'In your SendGrid console, navigate to Settings > API Keys.',
      },
      {
        title: 'Step 2: Create a Key with Mail Send permissions',
        description: 'Click "Create API Key". Choose "Full Access" or "Restricted Access" with "Mail Send" and "Marketing Campaigns" enabled.',
      },
      {
        title: 'Step 3: Copy immediately',
        description: 'SendGrid only displays the API key once. Copy it directly into Chatmize.',
      },
    ],
    howItWorksInFlows: 'Fire transactional emails dynamically from bot nodes with variable replacement like {{contact.first_name}}.',
    troubleshooting: [
      'Ensure your Sender Identity is verified in SendGrid before triggering mail nodes.',
    ],
  },
  drip: {
    appId: 'drip',
    appName: 'Drip',
    category: 'E-commerce & CRM',
    authMethod: 'Account ID & API Token',
    summary: 'Trigger high-converting e-commerce follow-ups and log custom customer purchase intent events.',
    steps: [
      {
        title: 'Step 1: Find your Account ID',
        description: 'In Drip, go to Settings > Account. Copy your 7-digit Account ID.',
      },
      {
        title: 'Step 2: Get your User API Token',
        description: 'Go to User Settings > API Token and copy your private token.',
      },
    ],
    howItWorksInFlows: 'Record events like "Started Checkout from Instagram Story" or "Claimed Discount Code".',
    troubleshooting: ['Ensure both Account ID and API Token are provided without extraneous spaces.'],
  },
  sendlane: {
    appId: 'sendlane',
    appName: 'SendLane',
    category: 'Email & SMS Automation',
    authMethod: 'API Subdomain, API Key & Hash Key',
    summary: 'Coordinate multi-channel SMS and email retargeting based on chatbot interaction steps.',
    steps: [
      {
        title: 'Step 1: Open Account API settings',
        description: 'Log in to SendLane and visit Account > API.',
      },
      {
        title: 'Step 2: Copy Subdomain, API Key and Hash Key',
        description: 'SendLane requires your account subdomain, API Key, and secret Hash Key.',
      },
    ],
    howItWorksInFlows: 'Sync phone numbers collected via Quick Replies to automated SMS flash-sale lists.',
    troubleshooting: ['Confirm your subdomain matches your SendLane login URL prefix.'],
  },
  ontraport: {
    appId: 'ontraport',
    appName: 'Ontraport',
    category: 'CRM & Business Automation',
    authMethod: 'App ID & API Key',
    summary: 'Create contacts, update custom CRM fields, and trigger Ontraport automation maps.',
    steps: [
      {
        title: 'Step 1: Open Administration Settings',
        description: 'In Ontraport, navigate to Administration > Integrations > Ontraport API.',
      },
      {
        title: 'Step 2: Create API Key Pair',
        description: 'Click "New API Key", grant contact read/write privileges, and copy the App ID and Key.',
      },
    ],
    howItWorksInFlows: 'Assign dedicated account reps and advance deal stages in your sales pipeline.',
    troubleshooting: ['Verify API permissions include Contact Add/Edit access.'],
  },
  webinarjam: {
    appId: 'webinarjam',
    appName: 'WebinarJam & EverWebinar',
    category: 'Webinar Platforms',
    authMethod: 'Genesis API Key',
    summary: 'Instantly register users for live or automated evergreen webinars directly through messaging conversations.',
    steps: [
      {
        title: 'Step 1: Access Advanced Integrations',
        description: 'Log into WebinarJam or EverWebinar and navigate to Advanced > API Integrations.',
      },
      {
        title: 'Step 2: Copy your API Key',
        description: 'Copy the Genesis API Key displayed on the page.',
      },
    ],
    howItWorksInFlows: 'The bot registers the subscriber and immediately responds with their unique personalized webinar join link.',
    troubleshooting: ['Ensure the webinar status is published and has upcoming session schedules.'],
  },
  demio: {
    appId: 'demio',
    appName: 'Demio',
    category: 'Webinar Platforms',
    authMethod: 'API Key & API Secret',
    summary: '1-click webinar registration without making users leave Instagram DM or WhatsApp.',
    steps: [
      {
        title: 'Step 1: Open Demio Settings',
        description: 'Click your profile avatar in Demio and navigate to Settings > API.',
      },
      {
        title: 'Step 2: Copy API Key and API Secret',
        description: 'Copy both keys into the Chatmize integration form and save.',
      },
    ],
    howItWorksInFlows: 'Pass the lead name, email, and selected session time slot directly into Demio.',
    troubleshooting: ['Ensure registration is open and not set to restricted manual approvals.'],
  },
  gotowebinar: {
    appId: 'gotowebinar',
    appName: 'GoToWebinar',
    category: 'Webinar Platforms',
    authMethod: 'OAuth Access Token',
    summary: 'Enterprise webinar attendee sync for corporate presentations and team briefings.',
    steps: [
      {
        title: 'Step 1: Authorize GoTo account',
        description: 'Sign into the GoTo Developer center or click the OAuth prompt to grant attendee registration rights.',
      },
      {
        title: 'Step 2: Save Access Token',
        description: 'Confirm authorization to establish the webhook listener.',
      },
    ],
    howItWorksInFlows: 'Send attendees confirmation and reminder messages before the scheduled broadcast.',
    troubleshooting: ['OAuth tokens must be refreshed every 30 days if disconnected.'],
  },
  zapier: {
    appId: 'zapier',
    appName: 'Zapier',
    category: 'Automation & Webhooks',
    authMethod: 'Webhook URL & Header',
    summary: 'Connect your chatbot to 5,000+ business applications using Zapier Catch Hooks.',
    steps: [
      {
        title: 'Step 1: Create a new Zap in Zapier',
        description: 'In Zapier, click "Create Zap". Select "Webhooks by Zapier" as the trigger.',
      },
      {
        title: 'Step 2: Choose "Catch Hook"',
        description: 'Select the "Catch Hook" event and click Continue. Copy the custom webhook URL provided.',
      },
      {
        title: 'Step 3: Paste into Chatmize',
        description: 'Paste the Webhook URL into Chatmize Settings -> Integrations -> Zapier.',
      },
      {
        title: 'Step 4: Test the Trigger',
        description: 'Send a test payload from your bot flow or click "Send Test Event" to verify in Zapier.',
      },
    ],
    howItWorksInFlows: 'Add a Webhook Action node to fire custom JSON payloads whenever users click buttons, submit inputs, or complete flows.',
    troubleshooting: [
      'Ensure the webhook URL starts with https://hooks.zapier.com/.',
      'Test payloads include contact attributes, channel source, and recent conversation responses.',
    ],
  },
  integromat: {
    appId: 'integromat',
    appName: 'Make (Integromat)',
    category: 'Automation & Webhooks',
    authMethod: 'Custom Webhook URL',
    summary: 'Build advanced multi-branch automation scenarios triggered in real-time by bot conversations.',
    steps: [
      {
        title: 'Step 1: Create a Scenario in Make',
        description: 'Open Make.com and create a new scenario. Add a "Webhooks" module and select "Custom Webhook".',
      },
      {
        title: 'Step 2: Generate and copy Webhook address',
        description: 'Name your webhook and copy the generated URL.',
      },
      {
        title: 'Step 3: Link in Chatmize',
        description: 'Paste into Chatmize settings to enable scenario triggers.',
      },
    ],
    howItWorksInFlows: 'Trigger data enrichment, Notion database updates, or Google Sheets logging.',
    troubleshooting: ['Make scenarios must be turned "ON" to process incoming webhook events.'],
  },
  integrately: {
    appId: 'integrately',
    appName: 'Integrately',
    category: 'Automation & Workflows',
    authMethod: 'Webhook URL',
    summary: '1-click workflow automations for non-technical users to sync spreadsheet rows, Slack alerts, and CRM leads.',
    steps: [
      {
        title: 'Step 1: Select Chatmize / Webhook in Integrately',
        description: 'In Integrately, choose Webhook as the source app and choose your destination.',
      },
      {
        title: 'Step 2: Copy the Webhook endpoint',
        description: 'Copy the listener URL and save it in Chatmize.',
      },
    ],
    howItWorksInFlows: 'Push new contacts to Google Sheets or send instantaneous team alerts to Slack or Discord.',
    troubleshooting: ['Verify that the automation recipe is active in Integrately.'],
  },
  paykickstart: {
    appId: 'paykickstart',
    appName: 'PayKickStart',
    category: 'Checkout & Affiliates',
    authMethod: 'IPN Secret Key',
    summary: 'Automate customer onboarding messages, payment confirmations, and cart abandonment triggers.',
    steps: [
      {
        title: 'Step 1: Go to Platform Settings',
        description: 'In PayKickStart, go to Settings > Integrations > 3rd Party Integrations.',
      },
      {
        title: 'Step 2: Copy IPN Secret Key',
        description: 'Copy your secret key and enter it into Chatmize to authenticate purchase webhooks.',
      },
    ],
    howItWorksInFlows: 'Trigger customer success bot sequences immediately following successful checkouts.',
    troubleshooting: ['Ensure IPN URL in PayKickStart points to your Chatmize inbound endpoint.'],
  },
  perkzilla: {
    appId: 'perkzilla',
    appName: 'PerkZilla & LetSpinio',
    category: 'Contests & Viral Rewards',
    authMethod: 'Campaign UUID & API Key',
    summary: 'Award viral referral points, manage contest entries, and trigger automated prize announcements.',
    steps: [
      {
        title: 'Step 1: Open Campaign Settings',
        description: 'In PerkZilla, select your active giveaway campaign and find the Campaign UUID.',
      },
      {
        title: 'Step 2: Generate API Key',
        description: 'Copy your account API Key from your developer profile.',
      },
    ],
    howItWorksInFlows: 'Issue unique referral links to users inside Messenger or Instagram DM.',
    troubleshooting: ['Ensure the contest campaign end date has not passed.'],
  },
  everlesson: {
    appId: 'everlesson',
    appName: 'EverLesson',
    category: 'Membership & Courses',
    authMethod: 'Membership URL & API Key',
    summary: 'Grant course access and send login credentials automatically when contacts complete lead flows.',
    steps: [
      {
        title: 'Step 1: Copy your Membership Portal URL',
        description: 'Enter your custom EverLesson portal address (e.g., https://academy.everlesson.com).',
      },
      {
        title: 'Step 2: Copy the Member API Key',
        description: 'Find your API Key under EverLesson Settings > Developer Integrations.',
      },
    ],
    howItWorksInFlows: 'Unlock lesson modules and deliver instant magic login links inside chat.',
    troubleshooting: ['Verify membership level ID corresponds with an active course package.'],
  },
};

// Merged knowledge base combining all Flow Triggers & Entry Points with 3rd-party integration guides
export const KNOWLEDGE_BASE_GUIDES: Record<string, IntegrationGuide> = {
  ...TRIGGER_KNOWLEDGE_GUIDES,
  ...BASE_INTEGRATION_GUIDES,
};

export { TRIGGER_KNOWLEDGE_GUIDES };
