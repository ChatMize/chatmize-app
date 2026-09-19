/**
 * Knowledge Base data layer (Phase 1: Builder MVP).
 *
 * Per workspace data lives at workspaces/{wsId}/kb_articles/{articleId}.
 * Drafts are written straight from the client (workspace member rules cover
 * nested docs). Publish, unpublish, and feedback counting run as client side
 * Firestore transactions (deploy 4 note: the Cloud Functions API create path
 * is blocked by the egress proxy, so the three KB callables ship as
 * transactions instead; same validation, same revision snapshots, same
 * counter logic). Step images go to Cloud Storage at
 * workspaces/{wsId}/kb_media/{articleId}/ and are compressed in the browser
 * before upload. Step and cover videos go to the same directory, stored raw
 * (no compression) as MP4 or WebM. Docs store the storage path, never a
 * public URL, so media can be revoked or reprocessed later.
 */

import { getAuth } from 'firebase/auth';
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
  runTransaction,
  increment,
} from 'firebase/firestore';
import { db, storage } from './firebase';

export type KbArticleStatus = 'draft' | 'published' | 'archived';

export interface KbStep {
  id: string;
  title: string;
  body: string;
  imagePath?: string;
  videoPath?: string;
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
  coverVideoPath?: string;
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

function articlesCol(workspaceId: string) {
  return collection(db, 'workspaces', workspaceId, 'kb_articles');
}

function revisionsCol(workspaceId: string) {
  return collection(db, 'workspaces', workspaceId, 'kb_revisions');
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
        videoPath: typeof s.videoPath === 'string' ? s.videoPath : undefined,
        tip: typeof s.tip === 'string' ? s.tip : undefined,
        order: typeof s.order === 'number' ? s.order : i,
      }))
      .sort((a: KbStep, b: KbStep) => a.order - b.order),
    source: 'manual',
    coverImagePath: typeof data.coverImagePath === 'string' ? data.coverImagePath : undefined,
    coverVideoPath: typeof data.coverVideoPath === 'string' ? data.coverVideoPath : undefined,
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
    ...(s.videoPath ? { videoPath: s.videoPath } : {}),
    ...(s.tip ? { tip: s.tip } : {}),
  }));
  await updateDoc(doc(db, 'workspaces', workspaceId, 'kb_articles', article.id), {
    title: article.title,
    category: article.category,
    tags: article.tags,
    steps,
    ...(article.coverImagePath ? { coverImagePath: article.coverImagePath } : { coverImagePath: '' }),
    ...(article.coverVideoPath ? { coverVideoPath: article.coverVideoPath } : { coverVideoPath: '' }),
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

/** Raw video cap. Videos are stored as uploaded, so the cap stays generous. */
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

export const ACCEPTED_VIDEO_TYPES = ['video/mp4', 'video/webm'];

const ACCEPTED_VIDEO_EXTENSIONS = ['mp4', 'webm'];

/** Returns a plain English error, or null when the file is fine. */
export function validateVideoFile(file: File): string | null {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  const typeOk = ACCEPTED_VIDEO_TYPES.includes(file.type);
  if (!typeOk && !ACCEPTED_VIDEO_EXTENSIONS.includes(ext)) {
    return 'That file is not a video. Please choose an MP4 or WebM file.';
  }
  if (file.size > MAX_VIDEO_BYTES) {
    return 'That video is too large. Please choose a file under 100 MB.';
  }
  return null;
}

/**
 * Upload a step or cover video: stored raw (no compression) at
 * workspaces/{wsId}/kb_media/{articleId}/{stepId}.{ext}. Returns the storage
 * path (not a URL).
 */
export async function uploadKbVideo(
  workspaceId: string,
  articleId: string,
  stepId: string,
  file: File,
): Promise<string> {
  const validationError = validateVideoFile(file);
  if (validationError) throw new Error(validationError);
  const nameExt = file.name.split('.').pop()?.toLowerCase() || '';
  const ext = file.type === 'video/webm' || nameExt === 'webm' ? 'webm' : 'mp4';
  const path = `workspaces/${workspaceId}/kb_media/${articleId}/${stepId}.${ext}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file, {
    contentType: ext === 'webm' ? 'video/webm' : 'video/mp4',
  });
  return path;
}

/** Flag articles with real traffic but poor helpful ratings for a rewrite. */
function computeNeedsReview(viewCount: number, helpfulYes: number, helpfulNo: number): boolean {
  const votes = helpfulYes + helpfulNo;
  if (viewCount < 50 || votes < 5) return false;
  return helpfulYes / votes < 0.4;
}

export async function publishKbArticleFn(
  workspaceId: string,
  articleId: string,
  note?: string,
): Promise<{ revisionId: string }> {
  const uid = getAuth().currentUser?.uid;
  if (!uid) throw new Error('Sign in required.');
  const articleRef = doc(articlesCol(workspaceId), articleId);
  const snap = await getDoc(articleRef);
  if (!snap.exists()) throw new Error('That article does not exist.');
  const data = snap.data() as Record<string, unknown>;
  const title = typeof data.title === 'string' ? data.title.trim() : '';
  const steps = Array.isArray(data.steps) ? data.steps : [];
  if (!title) throw new Error('Give the article a title before publishing.');
  if (steps.length === 0) throw new Error('Add at least one step before publishing.');

  const viewCount = typeof data.viewCount === 'number' ? data.viewCount : 0;
  const helpfulYes = typeof data.helpfulYes === 'number' ? data.helpfulYes : 0;
  const helpfulNo = typeof data.helpfulNo === 'number' ? data.helpfulNo : 0;
  const revisionRef = doc(revisionsCol(workspaceId));

  await runTransaction(db, async (tx) => {
    tx.set(revisionRef, {
      articleId,
      snapshot: { ...data, id: articleId },
      publishedBy: uid,
      publishedAt: serverTimestamp(),
      note: typeof note === 'string' ? note.slice(0, 500) : '',
    });
    tx.update(articleRef, {
      status: 'published',
      publishedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      needsReview: computeNeedsReview(viewCount, helpfulYes, helpfulNo),
      lastReviewedAt: serverTimestamp(),
    });
  });
  return { revisionId: revisionRef.id };
}

export async function unpublishKbArticleFn(workspaceId: string, articleId: string): Promise<void> {
  const uid = getAuth().currentUser?.uid;
  if (!uid) throw new Error('Sign in required.');
  const articleRef = doc(articlesCol(workspaceId), articleId);
  const snap = await getDoc(articleRef);
  if (!snap.exists()) throw new Error('That article does not exist.');
  await updateDoc(articleRef, {
    status: 'draft',
    updatedAt: serverTimestamp(),
  });
}

export async function kbFeedbackFn(
  workspaceId: string,
  articleId: string,
  kind: 'view' | 'yes' | 'no',
): Promise<void> {
  if (kind !== 'view' && kind !== 'yes' && kind !== 'no') {
    throw new Error('Feedback must be view, yes, or no.');
  }
  const articleRef = doc(articlesCol(workspaceId), articleId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(articleRef);
    if (!snap.exists()) throw new Error('That article does not exist.');
    const data = snap.data() as Record<string, unknown>;
    const updates: Record<string, unknown> = {};
    if (kind === 'view') updates.viewCount = increment(1);
    if (kind === 'yes') updates.helpfulYes = increment(1);
    if (kind === 'no') updates.helpfulNo = increment(1);
    const viewCount = (typeof data.viewCount === 'number' ? data.viewCount : 0) + (kind === 'view' ? 1 : 0);
    const helpfulYes = (typeof data.helpfulYes === 'number' ? data.helpfulYes : 0) + (kind === 'yes' ? 1 : 0);
    const helpfulNo = (typeof data.helpfulNo === 'number' ? data.helpfulNo : 0) + (kind === 'no' ? 1 : 0);
    updates.needsReview = computeNeedsReview(viewCount, helpfulYes, helpfulNo);
    tx.update(articleRef, updates);
  });
}
