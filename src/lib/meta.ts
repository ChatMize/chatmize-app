import { getApp } from 'firebase/app';
import { getFunctions, httpsCallable } from 'firebase/functions';

const functions = getFunctions(getApp(), 'us-west2');

export interface MetaOAuthStatus {
  connected: boolean;
  pending: boolean;
  pageId: string | null;
  pageName: string | null;
  /** Facebook Page profile picture URL; null when unavailable. */
  pagePictureUrl: string | null;
  /** Instagram business/creator account linked to the page; null when none is linked. */
  instagram: { id: string; username: string; pictureUrl: string | null } | null;
  /** IG-only anchor (Instagram Login, no Facebook Page). Present when the backend ships it. */
  instagramOnly?: {
    connected: boolean;
    igUserId: string | null;
    username: string | null;
    pictureUrl: string | null;
    expiresAtMs: number | null;
  };
  /** WhatsApp anchor (customer's own number). Present when the backend ships it. */
  whatsappOnly?: {
    connected: boolean;
    pending: boolean;
    phoneNumberId: string | null;
    wabaId: string | null;
    displayName: string | null;
    verifiedName: string | null;
  };
}

export interface MetaPage {
  id: string;
  name: string;
}

/** Step 1: get the Facebook Login URL and redirect the browser to it. */
export async function startMetaOAuth(workspaceId: string, returnTo?: string): Promise<string> {
  const fn = httpsCallable<{ workspaceId: string; returnTo?: string }, { url: string }>(
    functions,
    'metaOAuthStart',
  );
  const res = await fn({ workspaceId, returnTo });
  return res.data.url;
}

export async function getMetaOAuthStatus(workspaceId: string): Promise<MetaOAuthStatus> {
  const fn = httpsCallable<{ workspaceId: string }, MetaOAuthStatus>(
    functions,
    'metaOAuthStatus',
  );
  const res = await fn({ workspaceId });
  return res.data;
}

export async function listMetaOAuthPages(
  workspaceId: string,
): Promise<{ pages: MetaPage[]; connectedAs?: string }> {
  const fn = httpsCallable<{ workspaceId: string }, { pages: MetaPage[]; connectedAs?: string }>(
    functions,
    'metaOAuthListPages',
  );
  const res = await fn({ workspaceId });
  return res.data;
}

export async function selectMetaOAuthPage(
  workspaceId: string,
  pageId: string,
): Promise<{ pageId: string; pageName: string }> {
  const fn = httpsCallable<
    { workspaceId: string; pageId: string },
    { pageId: string; pageName: string }
  >(functions, 'metaOAuthSelectPage');
  const res = await fn({ workspaceId, pageId });
  return res.data;
}
