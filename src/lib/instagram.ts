import { getApp } from 'firebase/app';
import { getFunctions, httpsCallable } from 'firebase/functions';

const functions = getFunctions(getApp(), 'us-west2');

export interface InstagramOAuthStatus {
  connected: boolean;
  igUserId: string | null;
  username: string | null;
  pictureUrl: string | null;
  expiresAtMs: number | null;
}

/** Step 1: get the Instagram Login URL and redirect the browser to it. */
export async function startInstagramOAuth(workspaceId: string, returnTo?: string): Promise<string> {
  const fn = httpsCallable<{ workspaceId: string; returnTo?: string }, { url: string }>(
    functions,
    'instagramOAuthStart',
  );
  const res = await fn({ workspaceId, returnTo });
  return res.data.url;
}

export async function getInstagramOAuthStatus(workspaceId: string): Promise<InstagramOAuthStatus> {
  const fn = httpsCallable<{ workspaceId: string }, InstagramOAuthStatus>(
    functions,
    'instagramOAuthStatus',
  );
  const res = await fn({ workspaceId });
  return res.data;
}
