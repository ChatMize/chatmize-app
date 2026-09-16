export interface TriggerKnowledgeGuide {
  appId: string;
  appName: string;
  category: string;
  section: 'triggers' | 'integrations';
  channel: 'instagram' | 'messenger' | 'whatsapp' | 'web' | 'integrations';
  authMethod: string;
  badge: string;
  metaPolicyRules: string;
  summary: string;
  howItWorks: string;
  steps: {
    title: string;
    description: string;
    tip?: string;
  }[];
  howItWorksInFlows: string;
  examplePayload?: string;
  bestPractices: string[];
  troubleshooting: string[];
}

export const TRIGGER_KNOWLEDGE_GUIDES: Record<string, TriggerKnowledgeGuide> = {
  // 1. INSTAGRAM TRIGGERS
  guide_ig_keyword: {
    appId: 'guide_ig_keyword',
    appName: 'Instagram DM Keywords Trigger',
    category: 'Instagram Triggers',
    section: 'triggers',
    channel: 'instagram',
    authMethod: 'Instagram Messaging Graph API',
    badge: 'Standard Inbound',
    metaPolicyRules: 'Fully Compliant • Customer-Initiated: Any inbound message sent by a user opens the official Meta 24-Hour Standard Messaging Window. Within this 24-hour window, you can send automated sequences, buttons, images, and sales offers without requiring message tags.',
    summary: 'Trigger conversational flows automatically whenever a user sends a direct message to your Instagram account containing specific keywords (e.g., "VIP", "WORKSHOP", "PRICE", "GUIDE").',
    howItWorks: 'When an Instagram user sends a DM, Meta dispatches a messages webhook event to Chatmize in real time. Chatmize scans the message text against your configured keywords and matching rule ("Contains" or "Exact Match"). If a match occurs, the contact is registered in your Audience CRM and the connected Starting Step executes instantly.',
    steps: [
      {
        title: 'Step 1: Ensure Instagram Account is Connected',
        description: 'Navigate to Settings > Channels and ensure your Instagram Business or Creator account is connected with "Allow Access to Messages" enabled.',
        tip: 'Check your Instagram mobile app: Settings > Privacy > Messages > Connected Tools > Allow Access to Messages = ON.',
      },
      {
        title: 'Step 2: Add Trigger in Flow Builder',
        description: 'In Flow Builder, select the Starting Step card, click "+ Add Trigger", and choose "Instagram DM Keywords".',
      },
      {
        title: 'Step 3: Define Trigger Keywords',
        description: 'Enter your trigger keywords (e.g., "START", "VIP", "PROMO"). Multiple keywords can trigger the same flow.',
        tip: 'Use uppercase keywords for clarity, but Chatmize matching is case-insensitive so "vip", "VIP", and "Vip" all match.',
      },
      {
        title: 'Step 4: Select Match Rule (Contains vs. Exact)',
        description: 'Choose "Contains" if the keyword can be part of a longer sentence (e.g. "I want the VIP pass"), or "Exact" if the user must send only the single keyword.',
      },
      {
        title: 'Step 5: Publish and Test Live',
        description: 'Click "Publish Flow" in the top bar. Open Instagram and DM your business account with the keyword to test the instant response.',
      },
    ],
    howItWorksInFlows: 'In Flow Builder, the Starting Step receives the contact ID, Instagram handle, and full name. The contact is assigned the tag "ig_dm_keyword" and automatically passes to your first message block.',
    examplePayload: `// Inbound Meta Webhook Event (Parsed by Chatmize)
{
  "object": "instagram",
  "entry": [{
    "id": "17841400291823901",
    "time": 1726148000,
    "messaging": [{
      "sender": { "id": "91827364510" },
      "recipient": { "id": "17841400291823901" },
      "message": {
        "mid": "m_18293849102",
        "text": "VIP"
      }
    }]
  }]
}`,
    bestPractices: [
      'Keep your promotional call-to-actions short: "DM me the word VIP for the free checklist".',
      'Avoid common single letters or frequent greetings like "Hi" or "Hey" with Contains matching to prevent false triggers.',
      'Always include an immediate value delivery in the first message node within 3 seconds of triggering.',
      'Set an action tag like "source:ig_keyword_vip" right after the trigger to track campaign performance.',
    ],
    troubleshooting: [
      'If DMs are not triggering, ensure your Instagram account is linked to your Facebook Page in Meta Business Suite.',
      'Verify that Instagram "Allow Access to Messages" is toggled ON under Account Privacy.',
      'Check if the user is in your Message Requests folder; Instagram bots only auto-reply once message permission is established.',
    ],
  },

  guide_ig_comments: {
    appId: 'guide_ig_comments',
    appName: 'Instagram Comments Growth Tool (Posts, Reels & Ads)',
    category: 'Instagram Triggers',
    section: 'triggers',
    channel: 'instagram',
    authMethod: 'Meta Graph Webhook (feed / comments)',
    badge: 'Viral Lead Generation',
    metaPolicyRules: 'Meta Comment Reply Policy: Chatmize sends 1 private direct message to the commenter. That 1 message contains your CTA or button. Once the commenter taps the button or replies in DM, the official 24-Hour Standard Messaging Window opens!',
    summary: 'Automatically send private DMs and public comment replies whenever users comment on your Instagram feed posts, Reels, or Instagram Feed Ads.',
    howItWorks: 'When someone comments on your post, Meta sends a webhook containing the comment text, commenter ID, and post ID. Chatmize checks if the comment satisfies your rule ("Any comment" or "Specific keywords"). If valid, Chatmize immediately leaves an automated public reply on the comment and sends a private DM to the commenter.',
    steps: [
      {
        title: 'Step 1: Select Post or Reel Target',
        description: 'Choose "Specific Post or Reel" by pasting its Instagram URL, or select "Any active post" to run the automation across all content.',
      },
      {
        title: 'Step 2: Configure Comment Match Rule',
        description: 'Set whether to trigger on any comment, or require specific keywords like "BOT", "SEND", "LINK", or "WORKSHOP".',
        tip: 'Asking followers to comment a single specific keyword increases conversion and boosts Instagram algorithm engagement rank.',
      },
      {
        title: 'Step 3: Craft Public Comment Auto-Reply',
        description: 'Enter a public comment reply such as "Check your DMs! Just sent you the access link 🔥".',
        tip: 'Use varied auto-replies so multiple comments on the same post get naturally varied public responses.',
      },
      {
        title: 'Step 4: Design the Private Opener DM',
        description: 'Connect the trigger to a Message node that delivers the promised resource. Include a button so the user clicks and opens the 24-hour window.',
      },
    ],
    howItWorksInFlows: 'When a user comments, the flow initializes with the user\'s public Instagram profile, creates a lead record in Audience, and triggers the starting node.',
    examplePayload: `// Comment Webhook Event
{
  "field": "comments",
  "value": {
    "id": "1802938491029384",
    "text": "Send me the VIP workshop link please!",
    "from": { "id": "17841499201928", "username": "sarah_growth" },
    "media": { "id": "17992019283019", "media_product_type": "REELS" }
  }
}`,
    bestPractices: [
      'In your Reel caption, write: "Comment VIP below and my bot will DM you the template instantly!".',
      'Include an emoji in your public auto-reply to look friendly and authentic.',
      'Deliver the resource link directly in the first DM button so the lead gets immediate gratification.',
      'Auto-hide offensive comments by enabling sentiment filtering in Settings > Channels.',
    ],
    troubleshooting: [
      'Meta only allows automated comment replies on Instagram Creator and Business accounts, not personal profiles.',
      'If the user has their Instagram DM privacy set to "Do not allow message requests from anyone", Instagram may block the private message.',
      'Public comment replies must follow Instagram Community Guidelines; avoid repetitive links in public comments.',
    ],
  },

  guide_ig_story_mention: {
    appId: 'guide_ig_story_mention',
    appName: 'Instagram Story Mention Trigger',
    category: 'Instagram Triggers',
    section: 'triggers',
    channel: 'instagram',
    authMethod: 'Instagram Story Mentions Webhook',
    badge: 'Viral Loop & UGC',
    metaPolicyRules: 'Fully Compliant • User-Initiated: A Story mention where the user tags your @handle counts as a direct inbound contact, opening the 24-hour standard messaging window immediately.',
    summary: 'Instantly send an automated DM reply whenever someone tags your @handle in their Instagram Story, turning user-generated content into active conversations.',
    howItWorks: 'Meta pushes a story_mention event to Chatmize with the tagging user\'s ID and Story media reference. Chatmize fires an automated message within 5 seconds thanking the user and delivering a special discount code or lead magnet.',
    steps: [
      {
        title: 'Step 1: Add Story Mention Trigger',
        description: 'Add the "Instagram Story Mention" trigger to your Starting Step in Flow Builder.',
      },
      {
        title: 'Step 2: Compose Thank You Greeting',
        description: 'Create a warm opener: "Thanks so much for the shoutout, {{first_name}}! Here is your exclusive 15% VIP discount:".',
      },
      {
        title: 'Step 3: Add Action Tag',
        description: 'Add an Action block to tag the contact with "story_advocate" to build a list of brand champions.',
      },
    ],
    howItWorksInFlows: 'Creates a contact record with custom field "last_story_mention_at" and starts the attached sequence.',
    bestPractices: [
      'Run a contest: "Share our post to your Story and tag us for an instant 20% off voucher".',
      'Respond within seconds while the user is still actively on Instagram looking at their Story views.',
      'Ask a question in your DM to prompt a reply, deepening follower engagement.',
    ],
    troubleshooting: [
      'If the mentioning user has a private profile, Instagram does not share the Story thumbnail image for privacy, but the text DM is delivered normally.',
      'Mentions in Stories that have already expired (after 24h) cannot be retroactively triggered.',
    ],
  },

  guide_ig_story_reply: {
    appId: 'guide_ig_story_reply',
    appName: 'Instagram Story Reply Trigger',
    category: 'Instagram Triggers',
    section: 'triggers',
    channel: 'instagram',
    authMethod: 'Instagram Direct Webhook',
    badge: 'Story Engagement',
    metaPolicyRules: 'User-Initiated: Replying to an active Instagram Story opens the full 24-hour standard messaging window.',
    summary: 'Trigger automated flows when followers reply to your active Instagram Stories, allowing interactive polls, quiz follow-ups, and sticker responses.',
    howItWorks: 'When someone views your Instagram Story and sends a reply message or reacts to an interactive prompt, Meta routes the reply as an inbound DM linked to the Story media ID. Chatmize parses the response and continues the flow.',
    steps: [
      {
        title: 'Step 1: Add Story Reply Trigger',
        description: 'Select "Instagram Story Reply" in your Flow Starting Step.',
      },
      {
        title: 'Step 2: Post a Story with a Reply Call to Action',
        description: 'Post a Story on Instagram asking viewers: "Reply to this story with YES to get our new case study".',
      },
      {
        title: 'Step 3: Connect Value Sequence',
        description: 'Attach the Starting Step to a Message Node containing the PDF download card and a calendar booking link.',
      },
    ],
    howItWorksInFlows: 'Detects the story reply context and branches into your conversational sequence.',
    bestPractices: [
      'Use interactive sticker overlays on your Story with text pointing to the DM reply box.',
      'Personalize the opening message with {{first_name}}.',
    ],
    troubleshooting: [
      'Ensure the Story is posted from the connected Instagram Professional account.',
      'Check that Story replies are enabled in your Instagram mobile settings: Settings > Comments and Replies.',
    ],
  },

  guide_ig_ref_link: {
    appId: 'guide_ig_ref_link',
    appName: 'Instagram Referral Link (ig.me)',
    category: 'Instagram Triggers',
    section: 'triggers',
    channel: 'instagram',
    authMethod: 'ig.me URL Protocol',
    badge: 'Bio & Stories Link',
    metaPolicyRules: 'User-Initiated: Clicking the link opens Instagram Direct with a "Get Started" button. Tapping the button opens the 24-hour window.',
    summary: 'Generate branded ig.me direct links with custom ref parameters for your Link-in-Bio, Stories link stickers, emails, and external websites.',
    howItWorks: 'An ig.me URL (e.g. https://ig.me/m/chatmize?ref=bio_workshop) is Meta\'s official universal deep-link for Instagram. On mobile devices, it opens the Instagram app directly into your DM chat. On desktop, it opens Instagram Web.',
    steps: [
      {
        title: 'Step 1: Enter Custom Ref Payload',
        description: 'In the trigger editor, specify a unique ref slug (e.g. "bio_lead", "podcast_ep24", "youtube_cta").',
      },
      {
        title: 'Step 2: Copy the Branded ig.me Link',
        description: 'Click "Copy" to copy your generated link: https://ig.me/m/chatmize?ref=your_payload.',
      },
      {
        title: 'Step 3: Place Link in Desired Channel',
        description: 'Add the link to your Instagram bio, Linktree, YouTube description, or email broadcast.',
      },
    ],
    howItWorksInFlows: 'When a lead enters through this link, Chatmize stores the ref payload in the contact\'s `meta.referralRef` attribute and tags them accordingly.',
    bestPractices: [
      'Use specific ref tags for each marketing channel (e.g. ig_bio, youtube_desc, email_blast) to measure ROI per channel.',
      'Add a Link sticker to your Instagram Story pointing to this ig.me link for high-conversion swipe-ups.',
    ],
    troubleshooting: [
      'Only lowercase alphanumeric characters and underscores are allowed in ref parameters.',
      'Users who have never messaged your account before will see a "Get Started" button before the flow triggers.',
    ],
  },

  guide_ig_ad: {
    appId: 'guide_ig_ad',
    appName: 'Click-to-Instagram Direct Ads',
    category: 'Instagram Triggers',
    section: 'triggers',
    channel: 'instagram',
    authMethod: 'Meta Ads Manager Partner Sync',
    badge: 'Paid Acquisition',
    metaPolicyRules: 'Compliant Paid Entry Point: When a user clicks your Instagram Ad, Meta opens a 24-hour standard messaging window. No template fees apply.',
    summary: 'Connect Meta Ads Manager Click-to-Instagram Direct campaigns to qualify leads, answer product questions, and book sales calls automatically.',
    howItWorks: 'When someone clicks "Send Message" on your sponsored Instagram feed or Reels ad, Meta transmits the ad ID, campaign ID, and ad creative title to Chatmize. Chatmize delivers your automated greeting and questionnaire.',
    steps: [
      {
        title: 'Step 1: Create Ad Campaign in Meta Ads Manager',
        description: 'Set Campaign Objective to "Engagement" -> "Messaging Apps" -> select your Instagram account.',
      },
      {
        title: 'Step 2: Copy JSON Setup Payload from Chatmize',
        description: 'In Chatmize Flow Builder, select the "Instagram Direct Ad" trigger and click "Copy Meta Ads JSON Setup Payload".',
      },
      {
        title: 'Step 3: Paste into Meta Ads Manager',
        description: 'Under Ad Setup > Message Template, click "Partner App" or "Edit JSON", and paste the Chatmize payload.',
      },
    ],
    howItWorksInFlows: 'Automatically maps ad ID, campaign ID, and ad name to the contact\'s profile in Firestore for complete ROAS tracking.',
    bestPractices: [
      'Ensure the first message directly acknowledges the specific offer shown in the ad image or video.',
      'Include Quick Reply options like "Yes, show me pricing" or "Book a 15-min call" to reduce drop-off.',
    ],
    troubleshooting: [
      'Verify that the Instagram account selected in the ad matches the account connected to Chatmize.',
      'Check that your ad account has permission to message on behalf of your connected Instagram handle.',
    ],
  },

  guide_ig_live_comment: {
    appId: 'guide_ig_live_comment',
    appName: 'Instagram Live Comments Automation',
    category: 'Instagram Triggers',
    section: 'triggers',
    channel: 'instagram',
    authMethod: 'Instagram Live Graph API',
    badge: 'Live Broadcast',
    metaPolicyRules: 'User-Initiated: Commenting during an Instagram Live session opens the 24-hour standard messaging window.',
    summary: 'Send instant DMs with product links or workshop resources to viewers who comment during your live Instagram broadcasts.',
    howItWorks: 'During a live broadcast, Chatmize listens to the real-time live comments stream. When a viewer comments your designated keyword (e.g., "BUY", "REGISTER", "SLIDES"), Chatmize immediately sends them the link in their DMs.',
    steps: [
      {
        title: 'Step 1: Set Live Comment Keywords',
        description: 'Add "Instagram Live Comments" trigger and define your target keywords (e.g. "SLIDES", "VIP").',
      },
      {
        title: 'Step 2: Announce during your Live Broadcast',
        description: 'Say on camera: "Drop the word SLIDES in the chat right now, and my bot will DM you the presentation deck instantly!".',
      },
      {
        title: 'Step 3: Automatic DM Delivery',
        description: 'Viewers comment and receive the link without ever having to leave your live stream.',
      },
    ],
    howItWorksInFlows: 'Captures viewer profile and delivers the message sequence while tracking live attribution.',
    bestPractices: [
      'Remind viewers multiple times during the live broadcast to comment the trigger word.',
      'Pin a comment on your live stream showing the trigger keyword for new joiners.',
    ],
    troubleshooting: [
      'Instagram Live comments API is only active while the live stream is in broadcast mode.',
    ],
  },

  // 2. FACEBOOK MESSENGER TRIGGERS
  guide_fb_keyword: {
    appId: 'guide_fb_keyword',
    appName: 'Facebook Messenger Keywords Trigger',
    category: 'Facebook Messenger Triggers',
    section: 'triggers',
    channel: 'messenger',
    authMethod: 'Messenger Platform Webhook',
    badge: 'Inbound Standard',
    metaPolicyRules: '24-Hour Policy Window: Customer-initiated inbound messages open the official 24-hour standard window for promotional & transactional messaging.',
    summary: 'Trigger conversational bot flows when a customer sends a message to your Facebook Page matching specific keywords or phrases.',
    howItWorks: 'Meta dispatches an inbound message event to Chatmize with the user\'s PSID (Page-Scoped ID) and text. Chatmize matches against your keywords and executes the connected flow.',
    steps: [
      {
        title: 'Step 1: Connect Facebook Page',
        description: 'Ensure your Facebook Business Page is connected under Settings > Channels.',
      },
      {
        title: 'Step 2: Add Messenger Keywords Trigger',
        description: 'In Flow Builder, add "Messenger Keywords" to the Starting Step.',
      },
      {
        title: 'Step 3: Enter Keywords & Match Rule',
        description: 'Enter keywords (e.g. "HELP", "PRICING", "DEMO", "SCHEDULE") and select "Contains" or "Exact".',
      },
    ],
    howItWorksInFlows: 'Matches PSID, updates contact record in Firestore, and starts the sequence.',
    bestPractices: [
      'Create dedicated flows for high-intent keywords like "PRICING", "REFUND", and "AGENT".',
      'Use an Action node to route leads to human agents if they send keywords like "HUMAN" or "TALK TO PERSON".',
    ],
    troubleshooting: [
      'Verify Page Messaging permissions in Meta Business Suite.',
    ],
  },

  guide_fb_comments: {
    appId: 'guide_fb_comments',
    appName: 'Facebook Post Comments Growth Tool',
    category: 'Facebook Messenger Triggers',
    section: 'triggers',
    channel: 'messenger',
    authMethod: 'Facebook Graph API (feed / comments)',
    badge: 'Organic Viral',
    metaPolicyRules: 'Meta 1-Message Comment Rule: Sends 1 private message in Messenger. When the user taps a button or responds, the 24-hour window opens.',
    summary: 'Turn Facebook Page post comments into Messenger subscribers by automatically replying publicly and privately.',
    howItWorks: 'When someone comments on your Facebook post, Chatmize posts an automated public reply to their comment and sends a private Messenger message containing your call-to-action.',
    steps: [
      {
        title: 'Step 1: Choose Post Target',
        description: 'Select "Any post" or paste a specific Facebook post URL.',
      },
      {
        title: 'Step 2: Configure Comment Match Keywords',
        description: 'Set keywords (e.g. "INFO", "YES", "SEND") or trigger on all comments.',
      },
      {
        title: 'Step 3: Set Public and Private Messages',
        description: 'Configure public reply and private message with a high-converting button.',
      },
    ],
    howItWorksInFlows: 'Creates contact in CRM with channel "messenger" and executes Starting Step.',
    bestPractices: [
      'Offer a free download or coupon code in exchange for commenting.',
      'Use varied public comment replies to keep conversations authentic.',
    ],
    troubleshooting: [
      'Automation only works on Facebook Business Pages, not personal profiles or private Facebook Groups.',
    ],
  },

  guide_fb_ref_url: {
    appId: 'guide_fb_ref_url',
    appName: 'Messenger Referral URL (m.me)',
    category: 'Facebook Messenger Triggers',
    section: 'triggers',
    channel: 'messenger',
    authMethod: 'm.me Deep Link Protocol',
    badge: 'Universal Link',
    metaPolicyRules: 'User-Initiated: Clicking the m.me link and tapping "Get Started" opens the 24-hour messaging window.',
    summary: 'Shareable direct link (https://m.me/yourpage?ref=payload) for email signatures, buttons, podcasts, YouTube descriptions, and SMS.',
    howItWorks: 'An m.me link is Meta\'s direct deep-link to your Facebook Page in Messenger. Any text after ?ref= is passed directly into Chatmize as a custom referral payload.',
    steps: [
      {
        title: 'Step 1: Set Custom Ref Slug',
        description: 'Enter your ref identifier (e.g. "email_welcome", "webinar_thankyou").',
      },
      {
        title: 'Step 2: Copy and Share Link',
        description: 'Copy the generated m.me URL and place it in your marketing campaigns.',
      },
    ],
    howItWorksInFlows: 'Passes referral parameter into contact data for attribution and segmentation.',
    bestPractices: [
      'Use distinct ref slugs for each campaign or traffic source.',
      'Shorten with custom domain (e.g. yourbrand.com/chat) for offline media.',
    ],
    troubleshooting: [
      'Ref parameter must contain only lowercase letters, numbers, hyphens, and underscores.',
    ],
  },

  guide_fb_ad: {
    appId: 'guide_fb_ad',
    appName: 'Click-to-Messenger Ads Trigger',
    category: 'Facebook Messenger Triggers',
    section: 'triggers',
    channel: 'messenger',
    authMethod: 'Meta Ads Manager Partner Integration',
    badge: 'High ROAS',
    metaPolicyRules: 'Compliant Paid Entry Point: Ad clicks open the 24-hour standard messaging window.',
    summary: 'Run high-converting Facebook Click-to-Messenger ads that qualify leads, collect emails and phone numbers, and schedule appointments.',
    howItWorks: 'When a user clicks "Send Message" on your Facebook ad, Meta passes the ad campaign ID and opens Messenger. Chatmize delivers your interactive questions and captures contact info.',
    steps: [
      {
        title: 'Step 1: Create Messenger Ad in Ads Manager',
        description: 'Select Campaign Objective "Engagement" or "Leads" -> Destination "Messenger".',
      },
      {
        title: 'Step 2: Copy Setup JSON from Chatmize',
        description: 'Click "Copy Meta Ads JSON Setup Payload" in the trigger editor.',
      },
      {
        title: 'Step 3: Paste into Ad Template',
        description: 'Paste into Ads Manager > Message Template > JSON tab.',
      },
    ],
    howItWorksInFlows: 'Stores ad ID, ad title, and campaign details on the lead\'s contact profile in Firestore.',
    bestPractices: [
      'Use quick replies to let users answer multiple-choice qualification questions in 1 tap.',
      'Send collected lead info directly to your CRM via an Action block.',
    ],
    troubleshooting: [
      'Ensure the Page associated with the ad is connected to Chatmize.',
    ],
  },

  guide_fb_customer_chat: {
    appId: 'guide_fb_customer_chat',
    appName: 'Website Customer Chat Plugin (Messenger)',
    category: 'Facebook Messenger Triggers',
    section: 'triggers',
    channel: 'messenger',
    authMethod: 'Meta Customer Chat SDK',
    badge: 'Website Widget',
    metaPolicyRules: 'User-Initiated: Visitors who start a chat in the website plugin open the standard 24-hour messaging window with their Facebook profile.',
    summary: 'Embed a floating chat bubble on your website that syncs conversations to Facebook Messenger so you can continue the chat even after they leave your site.',
    howItWorks: 'Loads Meta\'s official chat plugin on your website. When visitors send a message or click your welcome button, the conversation is connected to their personal Messenger account.',
    steps: [
      {
        title: 'Step 1: Configure Greeting Text',
        description: 'Set your welcome greeting headline and initial prompt in Chatmize.',
      },
      {
        title: 'Step 2: Whitelist Website Domain',
        description: 'Add your domain (e.g. https://yourwebsite.com) to Meta Whitelisted Domains in Page Settings.',
      },
      {
        title: 'Step 3: Embed Script Tag',
        description: 'Copy the Chatmize embed snippet and paste before the closing </body> tag of your website.',
      },
    ],
    howItWorksInFlows: 'Starts the flow as a Messenger conversation tagged with "source:website_customer_chat".',
    bestPractices: [
      'Greet visitors based on the page they are viewing (e.g. pricing page vs. homepage).',
    ],
    troubleshooting: [
      'Ensure your website uses HTTPS; Meta requires secure origins for the chat plugin.',
    ],
  },

  guide_fb_qr_code: {
    appId: 'guide_fb_qr_code',
    appName: 'Messenger QR Code & Offline Opt-Ins',
    category: 'Facebook Messenger Triggers',
    section: 'triggers',
    channel: 'messenger',
    authMethod: 'm.me QR Deep Link',
    badge: 'Offline & Print',
    metaPolicyRules: 'User-Initiated: Scanning the QR code opens Messenger on mobile and opens the 24-hour window upon tapping Get Started.',
    summary: 'Generate high-resolution printable QR codes for event banners, table tents, flyers, product packaging, and business cards.',
    howItWorks: 'Generates a scannable QR code encoding your custom m.me referral link. When scanned with any smartphone camera, it launches Messenger directly into your bot flow.',
    steps: [
      {
        title: 'Step 1: Set Custom QR Ref Slug',
        description: 'Enter your ref identifier (e.g. "event_stage_qr", "flyer_q3").',
      },
      {
        title: 'Step 2: Download High-Res QR Code',
        description: 'Click "Download QR Code" to save the SVG or PNG file for print production.',
      },
      {
        title: 'Step 3: Print and Test Scan',
        description: 'Scan the printed code with your phone camera to confirm it opens Messenger.',
      },
    ],
    howItWorksInFlows: 'Tags contact with "source:qr_code" and ref parameter for offline attribution.',
    bestPractices: [
      'Place a clear CTA above the QR code: "Scan with your phone to get the PDF checklist".',
      'Test print size: ensure the QR code is at least 1 x 1 inch (2.5 x 2.5 cm) for easy scanning.',
    ],
    troubleshooting: [
      'Ensure sufficient contrast: dark QR code on a light background scans best.',
    ],
  },

  guide_fb_checkbox: {
    appId: 'guide_fb_checkbox',
    appName: 'Website Opt-In Checkbox Plugin',
    category: 'Facebook Messenger Triggers',
    section: 'triggers',
    channel: 'messenger',
    authMethod: 'Messenger Checkbox Plugin',
    badge: 'Checkout Opt-in',
    metaPolicyRules: 'Compliant Opt-in: User checks the box and submits your form, authorizing your Page to send updates.',
    summary: 'Add an official Messenger opt-in checkbox to your checkout, contact, or registration forms to send order updates and receipts.',
    howItWorks: 'Renders a secure Meta checkbox widget on your website form. When the user submits the form, your website confirms the opt-in and triggers the connected flow.',
    steps: [
      {
        title: 'Step 1: Configure Checkbox Trigger',
        description: 'Add "Website Checkbox Plugin" to your Starting Step in Flow Builder.',
      },
      {
        title: 'Step 2: Embed on Your Form',
        description: 'Place the checkbox HTML container inside your form right before the submit button.',
      },
      {
        title: 'Step 3: Confirm on Submit',
        description: 'Call the Chatmize confirmation function inside your form onSubmit handler.',
      },
    ],
    howItWorksInFlows: 'Initializes contact and sends the order receipt or welcome sequence.',
    bestPractices: [
      'Pre-check the box where permitted by local privacy laws.',
      'Clearly explain what updates will be sent (e.g. "Send tracking link to Messenger").',
    ],
    troubleshooting: [
      'The user must be logged into Facebook in their browser to see the checkbox.',
    ],
  },

  // 3. WHATSAPP TRIGGERS
  guide_wa_keyword: {
    appId: 'guide_wa_keyword',
    appName: 'WhatsApp Inbound Keywords Trigger',
    category: 'WhatsApp Triggers',
    section: 'triggers',
    channel: 'whatsapp',
    authMethod: 'Meta WhatsApp Business Cloud API',
    badge: 'WhatsApp Cloud API',
    metaPolicyRules: 'Customer Service Window: Any inbound message from a customer opens a 24-hour Customer Service Window. You can send free-form messages, images, documents, and interactive lists with ZERO template approval fees.',
    summary: 'Trigger conversational flows when customers message your verified WhatsApp Business phone number with specific keywords.',
    howItWorks: 'Meta routes incoming WhatsApp messages to Chatmize via the Cloud API webhook. Chatmize matches the message against your keywords and initiates the response sequence.',
    steps: [
      {
        title: 'Step 1: Connect WhatsApp Business Phone Number',
        description: 'In Settings > Channels, connect your WhatsApp Business number via Meta Cloud API.',
      },
      {
        title: 'Step 2: Add WhatsApp Keywords Trigger',
        description: 'Add "WhatsApp Inbound Keywords" to the Starting Step in Flow Builder.',
      },
      {
        title: 'Step 3: Define Trigger Keywords',
        description: 'Enter keywords (e.g. "MENU", "JOIN", "PRICE", "SUPPORT").',
      },
    ],
    howItWorksInFlows: 'Registers contact phone number, sets channel to "whatsapp", and starts flow execution.',
    bestPractices: [
      'Keep trigger words simple: "Send HELLO to get started".',
      'Provide interactive WhatsApp List messages or Quick Reply buttons for quick navigation.',
    ],
    troubleshooting: [
      'Make sure your WhatsApp Business number is verified and active in Meta Business Manager.',
    ],
  },

  guide_wa_link: {
    appId: 'guide_wa_link',
    appName: 'WhatsApp Chat Links (wa.me) & QR Codes',
    category: 'WhatsApp Triggers',
    section: 'triggers',
    channel: 'whatsapp',
    authMethod: 'wa.me Universal Deep Link',
    badge: '1-Click WhatsApp',
    metaPolicyRules: 'Customer-Initiated: Clicking wa.me opens WhatsApp with a pre-filled message. When the user taps send, the 24-hour Customer Service Window opens.',
    summary: 'Create 1-click wa.me direct links and QR codes with pre-filled inquiry text for website buttons, flyers, and social media bios.',
    howItWorks: 'Generates a link like https://wa.me/15550192831?text=Hi%2C%20I%20want%20to%20join. When tapped, it opens WhatsApp on the user\'s phone with the message ready to send.',
    steps: [
      {
        title: 'Step 1: Enter Pre-Filled Text',
        description: 'Specify the default message text (e.g. "Hi, I would like to book a consultation").',
      },
      {
        title: 'Step 2: Copy Link or Download QR',
        description: 'Copy the generated wa.me URL or download the high-resolution QR code.',
      },
    ],
    howItWorksInFlows: 'When the pre-filled text is sent, Chatmize matches it and begins the onboarding sequence.',
    bestPractices: [
      'Use natural phrasing for the pre-filled message so users feel comfortable sending it.',
    ],
    troubleshooting: [
      'Ensure the phone number includes full international country code without plus signs or dashes in the URL.',
    ],
  },

  guide_wa_ad: {
    appId: 'guide_wa_ad',
    appName: 'Click-to-WhatsApp Ads Trigger',
    category: 'WhatsApp Triggers',
    section: 'triggers',
    channel: 'whatsapp',
    authMethod: 'Meta Ads Manager WhatsApp Sync',
    badge: 'Paid Acquisition',
    metaPolicyRules: 'Customer-Initiated Paid Entry: When a user clicks your Click-to-WhatsApp ad and sends the first message, a 72-HOUR free messaging window opens (extended by Meta for ads)!',
    summary: 'Run Meta Ads on Facebook and Instagram that drive interested shoppers straight into a WhatsApp conversation.',
    howItWorks: 'Users click "Send WhatsApp Message" on your ad, opening WhatsApp with a pre-filled greeting. Sending the message opens a 72-hour messaging window with full ad attribution.',
    steps: [
      {
        title: 'Step 1: Set Up Click-to-WhatsApp Ad',
        description: 'In Ads Manager, select "Engagement" objective and choose WhatsApp as the destination.',
      },
      {
        title: 'Step 2: Link Campaign in Chatmize',
        description: 'Enter your Campaign Name or Ad ID in the trigger settings.',
      },
    ],
    howItWorksInFlows: 'Attaches ad ID and campaign name to the contact and executes the VIP funnel.',
    bestPractices: [
      'Leverage the 72-hour window to nurture leads and offer appointment slots.',
    ],
    troubleshooting: [
      'Your WhatsApp Business account must be linked to your Meta Business Manager.',
    ],
  },

  guide_wa_phone_form: {
    appId: 'guide_wa_phone_form',
    appName: 'Phone Number Opt-In Form (WhatsApp)',
    category: 'WhatsApp Triggers',
    section: 'triggers',
    channel: 'whatsapp',
    authMethod: 'Meta Template Message API',
    badge: 'Opt-in Capture',
    metaPolicyRules: 'Outbound Template Requirement: To initiate a conversation with a phone number captured on an external form, you MUST send an approved Meta WhatsApp Template message to initiate the opt-in.',
    summary: 'Capture phone numbers on your website or checkout and automatically send an approved WhatsApp opt-in message to initiate the flow.',
    howItWorks: 'When a visitor submits their phone number on your website, Chatmize dispatches an approved Meta WhatsApp Template message. Once the user replies, the 24-hour free-form window opens.',
    steps: [
      {
        title: 'Step 1: Choose Approved Meta Template',
        description: 'Select an approved WhatsApp Utility or Marketing template in your sequence.',
      },
      {
        title: 'Step 2: Embed Phone Capture Form',
        description: 'Use the Chatmize phone capture widget or connect your existing website form via Webhook.',
      },
    ],
    howItWorksInFlows: 'Dispatches template message, tracks delivery status, and awaits customer reply.',
    bestPractices: [
      'Include a clear checkbox on your form: "I consent to receive WhatsApp updates".',
    ],
    troubleshooting: [
      'Outbound business-initiated messages require an approved WhatsApp template in Meta Business Manager.',
    ],
  },

  // 4. GROWTH TOOLS & WEB TRIGGERS
  guide_web_modal: {
    appId: 'guide_web_modal',
    appName: 'Website Pop-up Modal / Exit Intent',
    category: 'Growth Tools & Web',
    section: 'triggers',
    channel: 'web',
    authMethod: 'Chatmize Web SDK',
    badge: 'Lead Capture',
    metaPolicyRules: 'User-Initiated: Tapping the modal CTA launches Messenger or WhatsApp, opening the standard 24-hour messaging window.',
    summary: 'High-converting pop-up modal on your website triggered by time on page, scroll percentage, or exit intent.',
    howItWorks: 'The Chatmize Web SDK monitors user behavior on your site. When the trigger condition is met (e.g. 5 seconds elapsed or cursor moves to exit), the modal displays an interactive CTA connecting to Messenger.',
    steps: [
      {
        title: 'Step 1: Configure Modal Copy',
        description: 'Set your headline, subtitle, and CTA button text (e.g. "Send to Messenger").',
      },
      {
        title: 'Step 2: Set Trigger Timing',
        description: 'Set delay in seconds, scroll depth, or enable Exit Intent detection.',
      },
      {
        title: 'Step 3: Embed Script on Your Site',
        description: 'Paste the snippet in your website header or Google Tag Manager.',
      },
    ],
    howItWorksInFlows: 'Launches the flow and tags contact with "source:website_modal".',
    bestPractices: [
      'Offer a compelling incentive (discount code, checklist, cheat sheet) in the modal headline.',
    ],
    troubleshooting: [
      'Ensure pop-up blockers are not preventing modal rendering.',
    ],
  },

  guide_web_bar: {
    appId: 'guide_web_bar',
    appName: 'Website Sticky Bar & Slide-in Widget',
    category: 'Growth Tools & Web',
    section: 'triggers',
    channel: 'web',
    authMethod: 'Chatmize Web SDK',
    badge: 'Sticky Banner',
    metaPolicyRules: 'User-Initiated: Visitor clicks the banner CTA button to open the messaging window.',
    summary: 'Sticky top notification bar or bottom corner slide-in with an instant one-click messaging opt-in button.',
    howItWorks: 'Renders a sleek non-intrusive banner on your website with an action button that immediately launches the conversational flow in Messenger or WhatsApp.',
    steps: [
      {
        title: 'Step 1: Customize Headline & Button',
        description: 'Set your announcement message and action button label.',
      },
      {
        title: 'Step 2: Choose Position (Top Bar vs. Bottom Slide-in)',
        description: 'Select whether the widget pins to the top of the viewport or floats in the corner.',
      },
    ],
    howItWorksInFlows: 'Connects to your Starting Step with custom referral tracking.',
    bestPractices: [
      'Use for time-sensitive announcements like webinar dates or flash sales.',
    ],
    troubleshooting: [
      'Check z-index if your website header obscures the top bar.',
    ],
  },

  guide_web_embed_form: {
    appId: 'guide_web_embed_form',
    appName: 'Embedded Opt-in Button / Widget',
    category: 'Growth Tools & Web',
    section: 'triggers',
    channel: 'web',
    authMethod: 'HTML / React Embed Snippet',
    badge: 'Inline Embed',
    metaPolicyRules: 'User-Initiated: Clicking the embedded button starts the conversation and opens the 24-hour window.',
    summary: 'Embeddable HTML/React widget for blog articles, checkout pages, help centers, and documentation.',
    howItWorks: 'Provides a copy-and-paste HTML snippet with an interactive "Send to Messenger" or "Chat on WhatsApp" button that can be embedded anywhere on any web page.',
    steps: [
      {
        title: 'Step 1: Customize Button Label & Style',
        description: 'Choose color scheme, size, and label text.',
      },
      {
        title: 'Step 2: Copy Embed HTML Snippet',
        description: 'Click "Copy Embed Code" to get the HTML / JS code.',
      },
      {
        title: 'Step 3: Paste into Your Website CMS',
        description: 'Paste into WordPress, Webflow, Shopify, or React codebase.',
      },
    ],
    howItWorksInFlows: 'Fires Starting Step upon button click.',
    bestPractices: [
      'Place at the conclusion of popular blog posts to convert organic readers into subscribers.',
    ],
    troubleshooting: [
      'Ensure JavaScript execution is permitted in your CMS editor.',
    ],
  },

  guide_landing_page: {
    appId: 'guide_landing_page',
    appName: 'Hosted Lead Magnet Landing Page',
    category: 'Growth Tools & Web',
    section: 'triggers',
    channel: 'web',
    authMethod: 'Hosted Chatmize Web Page',
    badge: 'Hosted Page',
    metaPolicyRules: 'User-Initiated: Tapping the CTA button opens the conversation in Messenger or WhatsApp.',
    summary: 'Fast standalone mobile-optimized landing page hosted on Chatmize with zero external website required.',
    howItWorks: 'Chatmize hosts a dedicated high-converting landing page with your headline, bullets, and one-click messaging button. Converts at 60%+ by removing form friction.',
    steps: [
      {
        title: 'Step 1: Customize Page Content',
        description: 'Set your headline, description, bullet points, and hero media.',
      },
      {
        title: 'Step 2: Copy Hosted Public URL',
        description: 'Copy the shareable URL (e.g. https://chatmize.page/bot-blueprint).',
      },
      {
        title: 'Step 3: Drive Traffic',
        description: 'Use the link as the destination for social media bio links, ads, or emails.',
      },
    ],
    howItWorksInFlows: 'Redirects visitor to Messenger/WhatsApp and immediately begins the sequence.',
    bestPractices: [
      'Keep copy focused on a single clear offer.',
    ],
    troubleshooting: [
      'Ensure the flow is published for the hosted page to be live.',
    ],
  },

  // 5. WEBHOOKS & INTEGRATIONS TRIGGERS
  guide_webhook: {
    appId: 'guide_webhook',
    appName: 'External Inbound Webhook / Zapier / Make',
    category: 'Webhooks & Integrations',
    section: 'triggers',
    channel: 'integrations',
    authMethod: 'REST API HTTP POST Webhook',
    badge: 'API Endpoint',
    metaPolicyRules: 'Messaging Policy Notice: If triggering an outbound message to a contact via webhook outside the 24-hour window, use an approved Meta Message Tag (CONFIRMED_EVENT_UPDATE, POST_PURCHASE_UPDATE, ACCOUNT_UPDATE) or an approved WhatsApp Template.',
    summary: 'Trigger this flow when an external application (Stripe, Calendly, ClickFunnels, custom CRM) sends an HTTP POST event to Chatmize.',
    howItWorks: 'Chatmize provides a unique inbound endpoint URL (e.g. https://api.chatmize.io/v1/webhook/wh_...). External services post JSON data with contact info. Chatmize parses variables, creates or updates the contact in Firestore, and executes the flow.',
    steps: [
      {
        title: 'Step 1: Copy Inbound Webhook URL',
        description: 'Select "External Webhook" trigger and copy your unique webhook endpoint URL.',
      },
      {
        title: 'Step 2: Paste into External App',
        description: 'In Zapier, Make, Stripe, or your custom CRM, add a Webhook action and paste the URL.',
      },
      {
        title: 'Step 3: Test Inbound Payload',
        description: 'Click "Simulate Inbound Webhook Event" in Chatmize to test field mapping.',
      },
    ],
    howItWorksInFlows: 'Maps incoming JSON keys (email, first_name, phone, order_id) into contact variables.',
    examplePayload: `// Sample Inbound Webhook Payload
{
  "event": "checkout_completed",
  "email": "alex.vance@example.com",
  "first_name": "Alex",
  "phone": "+15550192834",
  "order_id": "ORD-92841",
  "order_total": 197.00,
  "product_name": "Build-A-Bot VIP Workshop"
}`,
    bestPractices: [
      'Always pass standard fields like "email" and "phone" to enable multi-channel matching.',
      'Use an Action node right after the webhook to tag the source (e.g. "source:stripe_checkout").',
    ],
    troubleshooting: [
      'Webhook endpoints accept POST requests with Content-Type: application/json.',
    ],
  },

  guide_shopify_trigger: {
    appId: 'guide_shopify_trigger',
    appName: 'Shopify Store Event Trigger',
    category: 'Webhooks & Integrations',
    section: 'triggers',
    channel: 'integrations',
    authMethod: 'Shopify App Webhook Sync',
    badge: 'E-Commerce',
    metaPolicyRules: 'Post-Purchase & Cart Recovery: Sends order receipts and abandoned checkout recovery using Meta Post-Purchase Update tag or WhatsApp Utility template.',
    summary: 'Trigger conversational flows on Shopify events like Abandoned Checkout, Order Created, or Fulfillment Shipped.',
    howItWorks: 'Shopify webhooks notify Chatmize whenever a checkout is abandoned or an order is placed. Chatmize automatically schedules follow-up messages with custom checkout recovery links.',
    steps: [
      {
        title: 'Step 1: Select Shopify Event Type',
        description: 'Choose "Abandoned Checkout", "Order Created", or "Fulfillment Update".',
      },
      {
        title: 'Step 2: Set Delay Timer',
        description: 'For abandoned checkouts, set follow-up delay (recommended: 15-30 minutes).',
      },
      {
        title: 'Step 3: Connect Recovery Offer',
        description: 'Deliver dynamic checkout link and personalized discount code.',
      },
    ],
    howItWorksInFlows: 'Injects Shopify variables {{cart_recovery_url}}, {{order_number}}, and {{cart_total}}.',
    bestPractices: [
      'Include an image of the abandoned product in the message card.',
    ],
    troubleshooting: [
      'Ensure customer phone number or email is captured during the initial checkout step.',
    ],
  },

  guide_lead_form: {
    appId: 'guide_lead_form',
    appName: 'Meta Instant Form (Native Lead Ads)',
    category: 'Webhooks & Integrations',
    section: 'triggers',
    channel: 'integrations',
    authMethod: 'Meta Lead Gen Webhook',
    badge: 'Native Lead Ads',
    metaPolicyRules: 'Lead Follow-up: Submitting a Meta Lead Ad authorizes automated follow-up via Messenger or WhatsApp within the 24-hour window.',
    summary: 'Trigger flows immediately when a user submits a native Facebook or Instagram Instant Form without leaving the feed.',
    howItWorks: 'When a user completes your in-feed Lead Form on Facebook or Instagram, Meta sends the lead data directly to Chatmize. Chatmize initiates an automated messaging sequence within 5 seconds.',
    steps: [
      {
        title: 'Step 1: Select Meta Lead Form',
        description: 'Select your published Lead Form from your connected Facebook Page.',
      },
      {
        title: 'Step 2: Map Custom Form Questions',
        description: 'Map form questions into Chatmize contact custom fields (e.g. Budget, Timeline).',
      },
      {
        title: 'Step 3: Immediate Follow-up Message',
        description: 'Deliver instant confirmation and schedule appointment while the lead is hot.',
      },
    ],
    howItWorksInFlows: 'Creates new lead in Audience CRM and triggers onboarding sequence.',
    bestPractices: [
      'Speed to lead: follow up within 60 seconds of form submission for 7x higher conversion.',
    ],
    troubleshooting: [
      'Ensure Meta Lead Access Manager permissions are assigned to your Page in Business Manager.',
    ],
  },
};
