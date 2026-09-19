import {
  collection,
  doc,
  addDoc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  updateDoc,
  query,
  where,
  orderBy,
} from 'firebase/firestore';
import { db, auth, prodDb } from './firebase';

export type SnapshotAssetKind =
  | 'botMaps'
  | 'botGroups'
  | 'nurtureTools'
  | 'growthLinks'
  | 'overlays'
  | 'supportWidgets';

export const SNAPSHOT_KIND_LABELS: Record<SnapshotAssetKind, string> = {
  botMaps: 'Bot maps',
  botGroups: 'Bot groups',
  nurtureTools: 'Nurture & drip tools',
  growthLinks: 'Growth links',
  overlays: 'Website overlays',
  supportWidgets: 'Support chat widgets',
};

export const ALL_SNAPSHOT_KINDS = Object.keys(SNAPSHOT_KIND_LABELS) as SnapshotAssetKind[];

/** The portable payload. Never includes workspace connections or secrets. */
export interface SnapshotPayload {
  botMaps?: Array<{ record: any; data: any | null }>;
  botGroups?: any[];
  nurtureTools?: any[];
  growthLinks?: SnapshotLinkItem[];
  overlays?: any[];
  supportWidgets?: any[];
}

/**
 * Growth link record carried in snapshot payloads. Mirrors the Firestore
 * `cloaked_links` contract (document ID `${workspaceSlug}_${slug}`).
 */
export interface SnapshotLinkItem {
  workspaceSlug: string;
  slug: string;
  fullShortUrl?: string;
  destinationUrl: string;
  destinationType: 'takeover' | 'messenger' | 'instagram' | 'url';
  cloakingMode: 'masked' | 'bridge' | 'direct';
  title?: string;
  description?: string;
  previewImage?: string;
  connectedBotId?: string;
  ref?: string;
  clickCount?: number;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
  status?: 'active' | 'paused';
}

export interface SnapshotDoc {
  id: string;
  name: string;
  description: string;
  niche?: string;
  createdByUid: string;
  createdByName?: string;
  createdAt: string;
  version: 1;
  /** Listed in the template library (curated repository). */
  isTemplate: boolean;
  /** Importable by anyone with the link. */
  public: boolean;
  /** 'free' = signup bonus, importable on any plan. 'subscriber' = gated by snapshot_library. */
  access: 'free' | 'subscriber';
  /** Featured as the free starter bonus for new signups. */
  starterBonus: boolean;
  counts: Record<SnapshotAssetKind, number>;
  payload: SnapshotPayload;
}

const snapshotsCol = () => collection(db, 'snapshots');
const MAX_PAYLOAD_BYTES = 900_000; // stay safely under the 1MB Firestore doc limit

/** Backfill defaults for snapshots written before the access fields existed. */
function normalize(d: { id: string; data: () => any }): SnapshotDoc {
  const data = d.data();
  return {
    id: d.id,
    ...data,
    access: data.access ?? 'subscriber',
    starterBonus: data.starterBonus ?? false,
  } as SnapshotDoc;
}

function readJson(key: string): any {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// --- Growth links: Firestore cloaked_links -----------------------------------

const CLOAKED_LINKS_COLLECTION = 'cloaked_links';
const LEGACY_LINKS_KEY = 'chatmize_sendchat_links';

const cleanLinkSlug = (input: string): string =>
  input
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'link';

const linkDocId = (workspaceSlug: string, slug: string) => `${workspaceSlug}_${slug}`;

const normalizeDestType = (t: unknown): SnapshotLinkItem['destinationType'] => {
  if (t === 'messenger' || t === 'instagram' || t === 'takeover' || t === 'url') return t;
  if (t === 'web_chat') return 'takeover';
  return 'url';
};

/** Normalize a cloaked_links doc (or a legacy localStorage record) to the snapshot shape. */
function toSnapshotLink(data: any, workspaceSlug: string): SnapshotLinkItem {
  const slug = cleanLinkSlug(String(data?.slug || 'link'));
  return {
    workspaceSlug,
    slug,
    fullShortUrl: String(data?.fullShortUrl || `https://send.chat/${workspaceSlug}/${slug}`),
    destinationType: normalizeDestType(data?.destinationType),
    destinationUrl: String(data?.destinationUrl || ''),
    cloakingMode:
      data?.cloakingMode === 'direct' || data?.cloakingMode === 'masked' ? data.cloakingMode : 'bridge',
    title: String(data?.title || 'Untitled link'),
    description: String(data?.description || ''),
    ...(data?.previewImage ? { previewImage: String(data.previewImage) } : {}),
    ...(data?.connectedBotId ? { connectedBotId: String(data.connectedBotId) } : {}),
    ...(data?.ref || data?.refPayload ? { ref: String(data.ref || data.refPayload) } : {}),
    clickCount:
      typeof data?.clickCount === 'number'
        ? data.clickCount
        : typeof data?.totalClicks === 'number'
          ? data.totalClicks
          : 0,
    ...(data?.createdBy ? { createdBy: String(data.createdBy) } : {}),
    createdAt: String(data?.createdAt || new Date().toISOString()),
    ...(data?.updatedAt ? { updatedAt: String(data.updatedAt) } : {}),
    status: data?.status === 'paused' ? 'paused' : 'active',
  };
}

/**
 * One-time migration: move any legacy localStorage growth links into the
 * Firestore cloaked_links collection, then clear the key so nobody loses
 * links. Safe to call repeatedly; docs that already exist are skipped.
 */
export async function migrateLegacyLinksToFirestore(workspaceSlug: string): Promise<number> {
  const raw = readJson(LEGACY_LINKS_KEY);
  if (!Array.isArray(raw) || raw.length === 0) return 0;
  const ws = cleanLinkSlug(workspaceSlug) || 'workspace';
  const now = new Date().toISOString();
  let migrated = 0;
  for (const item of raw) {
    try {
      const link = toSnapshotLink(item, ws);
      const ref = doc(prodDb, CLOAKED_LINKS_COLLECTION, linkDocId(ws, link.slug));
      const existing = await getDoc(ref);
      if (!existing.exists()) {
        await setDoc(ref, {
          ...link,
          createdBy: 'snapshot-migration (migrated from browser storage)',
          updatedAt: now,
        });
        migrated++;
      }
    } catch {
      // Skip malformed records; keep going with the rest.
    }
  }
  try {
    localStorage.removeItem(LEGACY_LINKS_KEY);
  } catch {
    // storage unavailable
  }
  return migrated;
}

/** Read this workspace's growth links from Firestore (newest first). */
async function fetchWorkspaceLinks(workspaceSlug: string): Promise<SnapshotLinkItem[]> {
  const ws = cleanLinkSlug(workspaceSlug) || 'workspace';
  const q = query(collection(prodDb, CLOAKED_LINKS_COLLECTION), where('workspaceSlug', '==', ws));
  const snap = await getDocs(q);
  const links = snap.docs.map((d) => toSnapshotLink(d.data(), ws));
  links.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  return links;
}

/**
 * Write imported growth links into Firestore under the target workspace.
 * Slugs are remapped per import so they never collide with existing links.
 * Click counts are zeroed: analytics belong to the source workspace.
 */
async function importLinksToFirestore(
  workspaceSlug: string,
  items: SnapshotLinkItem[],
  stamp: string
): Promise<number> {
  const ws = cleanLinkSlug(workspaceSlug) || 'workspace';
  const now = new Date().toISOString();
  let count = 0;
  for (const item of items) {
    try {
      const link = toSnapshotLink(item, ws);
      const slug = cleanLinkSlug(`imp_${stamp}_${link.slug}`);
      const record: SnapshotLinkItem = {
        ...link,
        workspaceSlug: ws,
        slug,
        fullShortUrl: `https://send.chat/${ws}/${slug}`,
        clickCount: 0,
        createdBy: 'snapshot import',
        createdAt: now,
        updatedAt: now,
      };
      await setDoc(doc(prodDb, CLOAKED_LINKS_COLLECTION, linkDocId(ws, slug)), record);
      count++;
    } catch {
      // Skip malformed records; keep going with the rest.
    }
  }
  return count;
}

/** Build a snapshot payload from this workspace's data. */
export async function exportWorkspaceSnapshot(
  kinds: SnapshotAssetKind[],
  opts?: { workspaceSlug?: string }
): Promise<{
  payload: SnapshotPayload;
  counts: Record<SnapshotAssetKind, number>;
}> {
  const payload: SnapshotPayload = {};
  const counts = {
    botMaps: 0,
    botGroups: 0,
    nurtureTools: 0,
    growthLinks: 0,
    overlays: 0,
    supportWidgets: 0,
  };

  if (kinds.includes('botMaps')) {
    const list = readJson('chatmize_bot_maps_list');
    if (Array.isArray(list)) {
      payload.botMaps = list.map((record: any) => ({
        record,
        data: readJson(`chatmize_botmap_data_${record.id}`),
      }));
      counts.botMaps = list.length;
    }
  }
  if (kinds.includes('botGroups')) {
    const groups = readJson('chatmize_bot_groups');
    if (Array.isArray(groups)) {
      payload.botGroups = groups;
      counts.botGroups = groups.length;
    }
  }
  if (kinds.includes('nurtureTools')) {
    const tools = readJson('chatmize_nurture_tools') || readJson('chatmize_convertmate_tools');
    if (Array.isArray(tools)) {
      payload.nurtureTools = tools;
      counts.nurtureTools = tools.length;
    }
  }
  if (kinds.includes('growthLinks')) {
    const ws = opts?.workspaceSlug ? cleanLinkSlug(opts.workspaceSlug) : '';
    if (ws) {
      // Growth links live in Firestore now; pull in any stragglers left in
      // browser storage first so nobody loses links.
      await migrateLegacyLinksToFirestore(ws);
      const links = await fetchWorkspaceLinks(ws);
      payload.growthLinks = links;
      counts.growthLinks = links.length;
    } else {
      // No workspace context (legacy fallback): read the old browser key.
      const links = readJson(LEGACY_LINKS_KEY);
      if (Array.isArray(links)) {
        payload.growthLinks = links.map((l: any) => toSnapshotLink(l, 'workspace'));
        counts.growthLinks = links.length;
      }
    }
  }
  if (kinds.includes('overlays')) {
    const overlays = readJson('chatmize_website_overlays');
    if (Array.isArray(overlays)) {
      payload.overlays = overlays;
      counts.overlays = overlays.length;
    }
  }
  if (kinds.includes('supportWidgets')) {
    const widgets = readJson('chatmize_support_widgets');
    if (Array.isArray(widgets)) {
      payload.supportWidgets = widgets;
      counts.supportWidgets = widgets.length;
    }
  }

  return { payload, counts };
}

function remapId(oldId: string, stamp: string): string {
  return `imp_${stamp}_${String(oldId).replace(/^imp_[^_]+_/, '')}`;
}

/**
 * Merge a snapshot payload into this workspace's data.
 * Imported bots always land as drafts with zeroed stats so nothing goes
 * live by surprise. Returns per-kind import counts.
 */
export async function importSnapshotPayload(
  payload: SnapshotPayload,
  opts?: { workspaceSlug?: string }
): Promise<Record<SnapshotAssetKind, number>> {
  const stamp = Date.now().toString(36);
  const counts = {
    botMaps: 0,
    botGroups: 0,
    nurtureTools: 0,
    growthLinks: 0,
    overlays: 0,
    supportWidgets: 0,
  };

  const appendToList = (key: string, items: any[]): number => {
    if (!items.length) return 0;
    const existing = readJson(key);
    const list = Array.isArray(existing) ? existing : [];
    const remapped = items.map((item: any) =>
      item && typeof item.id === 'string' ? { ...item, id: remapId(item.id, stamp) } : item
    );
    try {
      localStorage.setItem(key, JSON.stringify([...remapped, ...list]));
    } catch {
      // storage unavailable
    }
    return remapped.length;
  };

  if (payload.botMaps?.length) {
    const existing = readJson('chatmize_bot_maps_list');
    const list = Array.isArray(existing) ? existing : [];
    const incoming = payload.botMaps.map(({ record, data }, i) => {
      const newId = `imp_${stamp}_${i}`;
      if (data) {
        try {
          localStorage.setItem(`chatmize_botmap_data_${newId}`, JSON.stringify(data));
        } catch {
          // storage unavailable
        }
      }
      return {
        ...record,
        id: newId,
        status: 'draft',
        totalRuns: 0,
        optInRate: '0%',
        lastEdited: 'Just now',
      };
    });
    try {
      localStorage.setItem('chatmize_bot_maps_list', JSON.stringify([...incoming, ...list]));
    } catch {
      // storage unavailable
    }
    counts.botMaps = incoming.length;

    // Merge groups by name so imported maps keep their grouping.
    const groupNames = new Set(
      payload.botMaps.map(({ record }) => record?.group).filter(Boolean)
    );
    const existingGroups = readJson('chatmize_bot_groups');
    const groups = Array.isArray(existingGroups) ? existingGroups : [];
    const haveNames = new Set(groups.map((g: any) => g?.name));
    const toAdd = [...groupNames]
      .filter((n) => !haveNames.has(n))
      .map((name, i) => ({
        id: `imp_${stamp}_grp${i}`,
        name,
        color: 'cyan' as const,
      }));
    if (toAdd.length) {
      try {
        localStorage.setItem('chatmize_bot_groups', JSON.stringify([...toAdd, ...groups]));
      } catch {
        // storage unavailable
      }
    }
  }

  if (payload.botGroups?.length) {
    const existingGroups = readJson('chatmize_bot_groups');
    const groups = Array.isArray(existingGroups) ? existingGroups : [];
    const haveNames = new Set(groups.map((g: any) => g?.name));
    const fresh = payload.botGroups.filter((g: any) => g?.name && !haveNames.has(g.name));
    counts.botGroups = appendToList('chatmize_bot_groups', fresh);
  }
  if (payload.nurtureTools?.length) {
    counts.nurtureTools = appendToList('chatmize_nurture_tools', payload.nurtureTools);
  }
  if (payload.growthLinks?.length) {
    const ws = opts?.workspaceSlug ? cleanLinkSlug(opts.workspaceSlug) : '';
    if (ws) {
      counts.growthLinks = await importLinksToFirestore(ws, payload.growthLinks, stamp);
    } else {
      // No workspace context (legacy fallback): append to the old browser key.
      counts.growthLinks = appendToList(LEGACY_LINKS_KEY, payload.growthLinks);
    }
  }
  if (payload.overlays?.length) {
    counts.overlays = appendToList('chatmize_website_overlays', payload.overlays);
  }
  if (payload.supportWidgets?.length) {
    counts.supportWidgets = appendToList('chatmize_support_widgets', payload.supportWidgets);
  }

  return counts;
}

// --- Firestore ---------------------------------------------------------------

export async function createSnapshot(input: {
  name: string;
  description: string;
  niche?: string;
  payload: SnapshotPayload;
  counts: Record<SnapshotAssetKind, number>;
  isTemplate?: boolean;
}): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error('You must be signed in to share a snapshot.');
  const bytes = new Blob([JSON.stringify(input.payload)]).size;
  if (bytes > MAX_PAYLOAD_BYTES) {
    throw new Error('This snapshot is too large to share (over ~900KB). Try sharing fewer items.');
  }
  const ref = await addDoc(snapshotsCol(), {
    name: input.name,
    description: input.description,
    niche: input.niche || '',
    createdByUid: user.uid,
    createdByName: user.displayName || user.email || '',
    createdAt: new Date().toISOString(),
    version: 1,
    isTemplate: input.isTemplate ?? false,
    public: true,
    access: 'subscriber',
    starterBonus: false,
    counts: input.counts,
    payload: input.payload,
  });
  return ref.id;
}

export async function getSnapshot(id: string): Promise<SnapshotDoc | null> {
  const snap = await getDoc(doc(db, 'snapshots', id));
  if (!snap.exists()) return null;
  return normalize({ id: snap.id, data: () => snap.data() });
}

export async function listTemplates(): Promise<SnapshotDoc[]> {
  const q = query(snapshotsCol(), where('isTemplate', '==', true), orderBy('createdAt', 'desc'));
  const res = await getDocs(q);
  return res.docs.map((d) => normalize(d));
}

/** Free starter-bonus snapshots every new account gets. */
export async function listStarterBonuses(): Promise<SnapshotDoc[]> {
  const q = query(
    snapshotsCol(),
    where('starterBonus', '==', true),
    orderBy('createdAt', 'desc')
  );
  const res = await getDocs(q);
  return res.docs.map((d) => normalize(d));
}

/** Super Admin: every snapshot on the platform, newest first. */
export async function listAllSnapshots(): Promise<SnapshotDoc[]> {
  const q = query(snapshotsCol(), orderBy('createdAt', 'desc'));
  const res = await getDocs(q);
  return res.docs.map((d) => normalize(d));
}

export async function listMySnapshots(): Promise<SnapshotDoc[]> {
  const user = auth.currentUser;
  if (!user) return [];
  const q = query(
    snapshotsCol(),
    where('createdByUid', '==', user.uid),
    orderBy('createdAt', 'desc')
  );
  const res = await getDocs(q);
  return res.docs.map((d) => normalize(d));
}

export async function deleteSnapshot(id: string): Promise<void> {
  await deleteDoc(doc(db, 'snapshots', id));
}

export async function setSnapshotTemplate(id: string, isTemplate: boolean, niche?: string): Promise<void> {
  await updateDoc(doc(db, 'snapshots', id), {
    isTemplate,
    ...(niche !== undefined ? { niche } : {}),
  });
}

export async function setSnapshotAccess(
  id: string,
  patch: { access?: 'free' | 'subscriber'; starterBonus?: boolean }
): Promise<void> {
  await updateDoc(doc(db, 'snapshots', id), { ...patch });
}

/** Shareable import link for a snapshot id. */
export function snapshotShareUrl(id: string): string {
  return `${window.location.origin}${window.location.pathname}?snapshot=${id}`;
}
