import { getApp } from 'firebase/app';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { MetaOAuthStatus } from './meta';

const functions = getFunctions(getApp(), 'us-west2');

export interface WhatsAppOAuthStatus {
  connected: boolean;
  pending: boolean;
  phoneNumberId: string | null;
  wabaId: string | null;
  displayName: string | null;
  verifiedName: string | null;
}

export interface WhatsAppPhoneNumber {
  phoneNumberId: string;
  displayPhoneNumber: string;
  verifiedName: string | null;
}

export interface WhatsAppBusinessAccount {
  wabaId: string;
  wabaName: string;
  phoneNumbers: WhatsAppPhoneNumber[];
}

/**
 * WhatsApp connection rides the shared Meta OAuth functions:
 * metaOAuthStart with provider "whatsapp", and metaOAuthStatus carries the
 * WhatsApp anchor as `whatsappOnly`. Number selection has its own callables.
 */

/** Step 1: get the Facebook Login URL and redirect the browser to it. */
export async function startWhatsAppOAuth(workspaceId: string, returnTo?: string): Promise<string> {
  const fn = httpsCallable<{ workspaceId: string; returnTo?: string; provider?: string }, { url: string }>(
    functions,
    'metaOAuthStart',
  );
  const res = await fn({ workspaceId, returnTo, provider: 'whatsapp' });
  return res.data.url;
}

export async function getWhatsAppOAuthStatus(workspaceId: string): Promise<WhatsAppOAuthStatus> {
  const fn = httpsCallable<{ workspaceId: string }, MetaOAuthStatus>(
    functions,
    'metaOAuthStatus',
  );
  const res = await fn({ workspaceId });
  const wa = res.data.whatsappOnly;
  return {
    connected: wa?.connected ?? false,
    pending: wa?.pending ?? false,
    phoneNumberId: wa?.phoneNumberId ?? null,
    wabaId: wa?.wabaId ?? null,
    displayName: wa?.displayName ?? null,
    verifiedName: wa?.verifiedName ?? null,
  };
}

/** Step 3: list the customer's WhatsApp Business Accounts and phone numbers. */
export async function listWhatsAppAccounts(
  workspaceId: string,
): Promise<{ accounts: WhatsAppBusinessAccount[] }> {
  const fn = httpsCallable<
    { workspaceId: string; action: string },
    { accounts: WhatsAppBusinessAccount[] }
  >(functions, 'metaOAuthStatus');
  const res = await fn({ workspaceId, action: 'listWhatsAppAccounts' });
  return res.data;
}

/** Step 4: persist the chosen phone number for this workspace. */
export async function selectWhatsAppNumber(
  workspaceId: string,
  phoneNumberId: string,
): Promise<{ phoneNumberId: string; displayName: string }> {
  const fn = httpsCallable<
    { workspaceId: string; action: string; phoneNumberId: string },
    { phoneNumberId: string; displayName: string }
  >(functions, 'metaOAuthStatus');
  const res = await fn({ workspaceId, action: 'selectWhatsAppNumber', phoneNumberId });
  return res.data;
}
