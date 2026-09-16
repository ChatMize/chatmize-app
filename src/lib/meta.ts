import { getApp } from 'firebase/app';
import { getFunctions, httpsCallable } from 'firebase/functions';

const functions = getFunctions(getApp(), 'us-west2');

export interface MetaOAuthStatus {
  connected: boolean;
  pending: boolean;
  pageId: string | null;
  pageName: string | null;
}

export interface MetaPage {
  id: string;
  name: string;
}

/** Step 1: get the Facebook Login URL and redirect the browser to it. */
export async function startMetaOAuth(workspaceId: string): Promise<string> {
  const fn = httpsCallable<{ workspaceId: string }, { url: string }>(
    functions,
    'metaOAuthStart',
  );
  const res = await fn({ workspaceId });
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

export async function listMetaOAuthPages(workspaceId: string): Promise<MetaPage[]> {
  const fn = httpsCallable<{ workspaceId: string }, { pages: MetaPage[] }>(
    functions,
    'metaOAuthListPages',
  );
  const res = await fn({ workspaceId });
  return res.data.pages;
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
