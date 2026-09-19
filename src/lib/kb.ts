/**
 * Knowledge Base data layer (Phase 1: Builder MVP).
 *
 * Per workspace data lives at workspaces/{wsId}/kb_articles/{articleId}.
 * Drafts are written straight from the client (workspace member rules cover
 * nested docs); publish, unpublish, and feedback counting run through
 * Cloud Functions so revisions and counters stay consistent. Step images go
 * to Cloud Storage at workspaces/{wsId}/kb_media/{articleId}/ and are
 * compressed in the browser before upload. Docs store the storage path, never
 * a public URL, so media can be revoked or reprocessed later.
 */

import { getApp } from 'firebase/app';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db, storage } from './firebase';

export type KbArticleStatus = 'draft' | 'published' | 'archived';

export interface KbStep {
  id: string;
  title: string;
  body: string;
  imagePath?: string;
  tip?: string;
  order: number;
}

export interface KbArticle {
  id: string;
  title: string;
  slug: string;
  category: string;
  tags: string[];
  status: KbArticleStatus;
  steps: KbStep[];
  source: 'manual';
  coverImagePath?: string;
  viewCount: number;
  helpfulYes: number;
  helpfulNo: number;
  needsReview: boolean;
  createdBy?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
  publishedAt?: unknown;
}

export const KB_CATEGORIES = ['Start here', 'Channels', 'Build', 'Grow', 'Reference'];

const functions = getFunctions(getApp(), 'us-west2');

function articlesCol(workspaceId: string) {
  return collection(db, 'workspaces', workspaceId, 'kb_articles');
}

export function kbDocToArticle(id: string, data: Record<string, unknown>): KbArticle {
  const steps = Array.isArray(data.steps) ? data.steps : [];
  return {
    id,
    title: typeof data.title === 'string' ? data.title : 'Untitled article',
    slug: typeof data.slug === 'string' ? data.slug : id,
    category: typeof data.category === 'string' ? data.category : 'Start here',
    tags: Array.isArray(data.tags) ? (data.tags as string[]) : [],
    status: data.status === 'published' ? 'published' : data.status === 'archived' ? 'archived' : 'draft',
    steps: steps
      .map((s: Record<string, unknown>, i: number) => ({
        id: typeof s.id === 'string' ? s.id : `step_${i}`,
        title: typeof s.title === 'string' ? s.title : '',
        body: typeof s.body === 'string' ? s.body : '',
        imagePath: typeof s.imagePath === 'string' ? s.imagePath : undefined,
        tip: typeof s.tip === 'string' ? s.tip : undefined,
        order: typeof s.order === 'number' ? s.order : i,
      }))
      .sort((a: KbStep, b: KbStep) => a.order - b.order),
    source: 'manual',
    coverImagePath: typeof data.coverImagePath === 'string' ? data.coverImagePath : undefined,
    viewCount: typeof data.viewCount === 'number' ? data.viewCount : 0,
    helpfulYes: typeof data.helpfulYes === 'number' ? data.helpfulYes : 0,
    helpfulNo: typeof data.helpfulNo === 'number' ? data.helpfulNo : 0,
    needsReview: data.needsReview === true,
    createdBy: typeof data.createdBy === 'string' ? data.createdBy : undefined,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    publishedAt: data.publishedAt,
  };
}

export function kbHelpfulness(article: KbArticle): number | null {
  const votes = article.helpfulYes + article.helpfulNo;
  if (votes === 0) return null;
  return Math.round((article.helpfulYes / votes) * 100);
}

/** List every article in the workspace, newest first. Bounded per workspace. */
export async function listKbArticles(workspaceId: string): Promise<KbArticle[]> {
  const snap = await getDocs(query(articlesCol(workspaceId), orderBy('updatedAt', 'desc')));
  return snap.docs.map(d => kbDocToArticle(d.id, d.data()));
}

/** Fetch one article. Returns null when it does not exist (no silent fallback). */
export async function getKbArticle(workspaceId: string, articleId: string): Promise<KbArticle | null> {
  const snap = await getDoc(doc(db, 'workspaces', workspaceId, 'kb_articles', articleId));
  if (!snap.exists()) return null;
  return kbDocToArticle(snap.id, snap.data());
}

export function makeSlug(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'article'
  );
}

function randomId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function newKbStep(order: number): KbStep {
  return { id: randomId('step'), title: '', body: '', order };
}

/** Create a fresh draft and return its id. */
export async function createKbArticle(
  workspaceId: string,
  input: { title: string; category: string; tags: string[] },
  uid?: string,
): Promise<string> {
  const existing = await listKbArticles(workspaceId);
  const taken = new Set(existing.map(a => a.slug));
  let slug = makeSlug(input.title);
  let n = 2;
  while (taken.has(slug)) {
    slug = `${makeSlug(input.title)}-${n}`;
    n += 1;
  }
  const id = randomId('kb');
  const now = serverTimestamp();
  await setDoc(doc(db, 'workspaces', workspaceId, 'kb_articles', id), {
    title: input.title.trim() || 'Untitled article',
    slug,
    category: input.category,
    tags: input.tags,
    status: 'draft',
    steps: [JSON.parse(JSON.stringify(newKbStep(0)))],
    source: 'manual',
    viewCount: 0,
    helpfulYes: 0,
    helpfulNo: 0,
    needsReview: false,
    createdBy: uid || '',
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

/** Save a draft (title, category, tags, steps, cover). Publish goes through the callable. */
export async function saveKbArticle(workspaceId: string, article: KbArticle): Promise<void> {
  const steps = article.steps.map((s, i) => ({
    id: s.id,
    title: s.title,
    body: s.body,
    order: i,
    ...(s.imagePath ? { imagePath: s.imagePath } : {}),
    ...(s.tip ? { tip: s.tip } : {}),
  }));
  await updateDoc(doc(db, 'workspaces', workspaceId, 'kb_articles', article.id), {
    title: article.title,
    category: article.category,
    tags: article.tags,
    steps,
    ...(article.coverImagePath ? { coverImagePath: article.coverImagePath } : { coverImagePath: '' }),
    updatedAt: serverTimestamp(),
  });
}

export async function deleteKbArticle(workspaceId: string, articleId: string): Promise<void> {
  await deleteDoc(doc(db, 'workspaces', workspaceId, 'kb_articles', articleId));
}

export async function archiveKbArticle(workspaceId: string, articleId: string): Promise<void> {
  await updateDoc(doc(db, 'workspaces', workspaceId, 'kb_articles', articleId), {
    status: 'archived',
    updatedAt: serverTimestamp(),
  });
}

/**
 * Upload a step or cover image: compressed in the browser, stored at
 * workspaces/{wsId}/kb_media/{articleId}/{stepId}.{ext}. Returns the storage
 * path (not a URL).
 */
export async function uploadKbImage(
  workspaceId: string,
  articleId: string,
  stepId: string,
  file: File,
): Promise<string> {
  const { validateImageFile, compressImage } = await import('./imageCompression');
  const validationError = validateImageFile(file);
  if (validationError) throw new Error(validationError);
  const compressed = await compressImage(file);
  const path = `workspaces/${workspaceId}/kb_media/${articleId}/${stepId}.${compressed.extension}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, compressed.blob, {
    contentType: compressed.extension === 'gif' ? 'image/gif' : `image/${compressed.extension}`,
  });
  return path;
}

/** Resolve a stored kb_media path to a download URL for display. */
export async function kbImageUrl(path: string): Promise<string> {
  return getDownloadURL(ref(storage, path));
}

export async function publishKbArticleFn(
  workspaceId: string,
  articleId: string,
  note?: string,
): Promise<{ revisionId: string }> {
  const fn = httpsCallable<{ workspaceId: string; articleId: string; note?: string }, { revisionId: string }>(
    functions,
    'publishKbArticle',
  );
  const res = await fn({ workspaceId, articleId, note });
  return res.data;
}

export async function unpublishKbArticleFn(workspaceId: string, articleId: string): Promise<void> {
  const fn = httpsCallable<{ workspaceId: string; articleId: string }, unknown>(functions, 'unpublishKbArticle');
  await fn({ workspaceId, articleId });
}

export async function kbFeedbackFn(
  workspaceId: string,
  articleId: string,
  kind: 'view' | 'yes' | 'no',
): Promise<void> {
  const fn = httpsCallable<{ workspaceId: string; articleId: string; kind: string }, unknown>(
    functions,
    'kbFeedback',
  );
  await fn({ workspaceId, articleId, kind });
}
