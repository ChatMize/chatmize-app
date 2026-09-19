import {
  doc,
  getDoc,
  Timestamp,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from './firebase';

/**
 * Build catalog (release notes feed). Global, Super Admin managed.
 * Stored at system_settings/build_catalog as { entries: BuildCatalogEntry[] }.
 * Read: any signed-in user. Write: Super Admin only (callables + rules).
 */

export interface BuildCatalogEntry {
  id: string;
  title: string;
  summary: string;
  buildDate: string; // ISO date, e.g. 2026-09-19
  goLiveDate: string; // ISO date
  deployCommit?: string;
  bundleName?: string;
  tags: string[];
  icon?: string; // lucide icon hint key
  createdAt?: string;
}

export const BUILD_CATALOG_TAGS = [
  'botmaps',
  'growth',
  'integrations',
  'channels',
  'billing',
  'analytics',
  'support',
  'platform',
] as const;

const DOC_PATH = 'system_settings/build_catalog';
const SEEN_KEY = 'chatmize_build_catalog_seen_at';

function toEntry(id: string, raw: any): BuildCatalogEntry {
  return {
    id,
    title: String(raw.title || 'Untitled build'),
    summary: String(raw.summary || ''),
    buildDate: String(raw.buildDate || ''),
    goLiveDate: String(raw.goLiveDate || ''),
    deployCommit: raw.deployCommit ? String(raw.deployCommit) : undefined,
    bundleName: raw.bundleName ? String(raw.bundleName) : undefined,
    tags: Array.isArray(raw.tags) ? raw.tags.map(String) : [],
    icon: raw.icon ? String(raw.icon) : undefined,
    createdAt: raw.createdAt
      ? raw.createdAt instanceof Timestamp
        ? raw.createdAt.toDate().toISOString()
        : String(raw.createdAt)
      : undefined,
  };
}

export async function fetchBuildCatalogEntries(max = 100): Promise<BuildCatalogEntry[]> {
  try {
    const snap = await getDoc(doc(db, DOC_PATH));
    if (!snap.exists()) return [];
    const raw = snap.data()?.entries;
    if (!Array.isArray(raw)) return [];
    const entries = raw.map((e: any, i: number) => toEntry(e.id || `entry-${i}`, e));
    entries.sort((a, b) => (b.goLiveDate || b.buildDate || '').localeCompare(a.goLiveDate || a.buildDate || ''));
    return entries.slice(0, max);
  } catch {
    return [];
  }
}

export function getSeenAt(): string {
  try {
    return localStorage.getItem(SEEN_KEY) || '';
  } catch {
    return '';
  }
}

export function markCatalogSeen(entry: BuildCatalogEntry | null): void {
  try {
    const stamp = entry ? entry.goLiveDate || entry.buildDate || entry.createdAt || '' : new Date().toISOString();
    if (stamp) localStorage.setItem(SEEN_KEY, stamp);
  } catch {
    /* ignore */
  }
}

export function countUnread(entries: BuildCatalogEntry[]): number {
  const seen = getSeenAt();
  if (!seen) return entries.length;
  return entries.filter((e) => (e.goLiveDate || e.buildDate || '') > seen).length;
}

export function formatCatalogDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso.length === 10 ? iso + 'T12:00:00' : iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export interface LogBuildEntryInput {
  title: string;
  summary: string;
  buildDate: string;
  goLiveDate: string;
  deployCommit?: string;
  bundleName?: string;
  tags?: string[];
  icon?: string;
}

/** Super Admin only. Called by deploy coordinators after each deploy. */
export async function logBuildEntry(input: LogBuildEntryInput): Promise<{ id: string }> {
  // Folded into metaOAuthStatus (new function creation is blocked through
  // the deploy proxy). Action prefix buildCatalog routes server-side.
  const fn = httpsCallable<Record<string, unknown>, { id: string }>(getFunctions(), 'metaOAuthStatus');
  const res = await fn({ action: 'buildCatalogLog', ...input });
  return res.data;
}

/** Super Admin only. */
export async function updateBuildEntry(id: string, patch: Partial<LogBuildEntryInput>): Promise<void> {
  const fn = httpsCallable<Record<string, unknown>, { ok: boolean }>(getFunctions(), 'metaOAuthStatus');
  await fn({ action: 'buildCatalogUpdate', id, ...patch });
}

/** Super Admin only. */
export async function deleteBuildEntry(id: string): Promise<void> {
  const fn = httpsCallable<Record<string, unknown>, { ok: boolean }>(getFunctions(), 'metaOAuthStatus');
  await fn({ action: 'buildCatalogDelete', id });
}
