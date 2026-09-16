export type BusinessType = 'local_business' | 'ecommerce' | 'agency_client' | 'creator' | 'saas';

export type WorkspacePlanTier = 'free_light' | 'standard_page' | 'pro_unlimited' | 'agency_bundle';

export type WorkspacePricingModel = 'segmate_unlimited_pages' | 'manychat_per_page' | 'custom_retainer';

export interface SmsConnection {
  phoneNumber: string;
  provider: 'twilio' | 'telnyx' | 'bandwidth';
  status: 'active' | 'pending' | 'disabled';
  connected: boolean;
  compliant10dlc: boolean;
  monthlyCredits?: number;
  autoKeywords?: string[];
}

export interface StandaloneChatbotConnection {
  enabled: boolean;
  status: 'active' | 'deactivated';
  botName: string;
  welcomeMessage: string;
  primaryColor: string;
  avatarUrl?: string;
  hostedSlug: string;
  embedSnippet: string;
  allowedDomains: string[];
  businessAssets: string[];
  bubblePosition: 'bottom-right' | 'bottom-left';
  autoPopupSeconds?: number;
}

export interface MetaPageConnection {
  pageId: string;
  pageName: string;
  pageCategory: string;
  connectedAt: string;
  ownerName?: string;
  avatarUrl?: string;
  serviceStatus?: 'active' | 'deactivated';
  pageAccessToken?: string;
  connectedIg?: {
    username: string;
    igId: string;
    followersCount: number;
    connected: boolean;
    status?: 'active' | 'deactivated';
  };
  connectedWhatsApp?: {
    phoneNumber: string;
    wabaId: string;
    verified: boolean;
    connected: boolean;
    status?: 'active' | 'deactivated';
  };
  connectedSms?: SmsConnection;
  connectedStandaloneChat?: StandaloneChatbotConnection;
}

export interface WhitelabelSettings {
  enabled: boolean;
  customDomain?: string;
  brandName?: string;
  logoUrl?: string;
  hideChatMizeWatermark: boolean;
  customCss?: string;
  clientRoleAccess: 'full_admin' | 'campaign_editor' | 'viewer_only';
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  businessType: BusinessType;
  color: string;
  avatarUrl?: string;
  ownerName?: string;
  connectedPage: MetaPageConnection;
  connectedSms?: SmsConnection;
  connectedStandaloneChat?: StandaloneChatbotConnection;
  planTier: WorkspacePlanTier;
  pricingModel: WorkspacePricingModel;
  whitelabel: WhitelabelSettings;
  stats: {
    subscribers: number;
    botsCount: number;
    toolsCount: number;
    broadcastsCount: number;
  };
  createdAt: string;
}

// Backward-compatible alias
export type WorkspaceSilo = Workspace;

export type KanbanColumnId = 'backlog' | 'spec' | 'in_progress' | 'testing' | 'done';

export type KanbanCategory = 
  | 'Workspaces & Accounts' 
  | 'Billing & Pricing' 
  | 'Channels & Meta' 
  | 'White-label & Agency' 
  | 'Nurture Tools';

export type KanbanPriority = 'urgent' | 'high' | 'medium' | 'low';

export type KanbanQaStatus = 
  | 'ready_for_ai' 
  | 'revisions_requested' 
  | 'in_qa_review' 
  | 'qa_approved';

export interface KanbanChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface KanbanCard {
  id: string;
  title: string;
  description: string;
  columnId: KanbanColumnId;
  category: KanbanCategory;
  priority: KanbanPriority;
  tags: string[];
  estimatedEffort?: string;
  dueDate?: string; // ISO date (YYYY-MM-DD) deadline for the card
  checklist: KanbanChecklistItem[];
  assignee?: string;
  notes?: string;
  qaNotes?: string; // Dedicated note section for User/QA to communicate directives to the AI Agent
  qaStatus?: KanbanQaStatus;
  qaUpdatedAt?: string;
  createdAt: string;
}

export interface KanbanColumn {
  id: KanbanColumnId;
  title: string;
  badgeColor: string;
  headerBorder: string;
  description: string;
}
