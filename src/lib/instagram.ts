import { getApp } from 'firebase/app';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { MetaOAuthStatus } from './meta';

const functions = getFunctions(getApp(), 'us-west2');

export interface InstagramOAuthStatus {
  connected: boolean;
  igUserId: string | null;
  username: string | null;
  pictureUrl: string | null;
  expiresAtMs: number | null;
}

/**
 * IG-only connection runs through the shared Meta OAuth functions:
 * metaOAuthStart with provider "instagram", and metaOAuthStatus carries the
 * IG-only anchor as `instagramOnly`.
 */

/** Step 1: get the Instagram Login URL and redirect the browser to it. */
export async function startInstagramOAuth(workspaceId: string, returnTo?: string): Promise<string> {
  const fn = httpsCallable<{ workspaceId: string; returnTo?: string; provider?: string }, { url: string }>(
    functions,
    'metaOAuthStart',
  );
  const res = await fn({ workspaceId, returnTo, provider: 'instagram' });
  return res.data.url;
}

export async function getInstagramOAuthStatus(workspaceId: string): Promise<InstagramOAuthStatus> {
  const fn = httpsCallable<{ workspaceId: string }, MetaOAuthStatus & { instagramOnly?: InstagramOAuthStatus }>(
    functions,
    'metaOAuthStatus',
  );
  const res = await fn({ workspaceId });
  const ig = res.data.instagramOnly;
  return {
    connected: ig?.connected ?? false,
    igUserId: ig?.igUserId ?? null,
    username: ig?.username ?? null,
    pictureUrl: ig?.pictureUrl ?? null,
    expiresAtMs: ig?.expiresAtMs ?? null,
  };
}
