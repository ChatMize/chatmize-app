import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  deleteDoc,
  updateDoc,
  query,
  where,
  orderBy,
} from 'firebase/firestore';
import { db, auth } from './firebase';

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
  growthLinks?: any[];
  overlays?: any[];
  supportWidgets?: any[];
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
  counts: Record<SnapshotAssetKind, number>;
  payload: SnapshotPayload;
}

const snapshotsCol = () => collection(db, 'snapshots');
const MAX_PAYLOAD_BYTES = 900_000; // stay safely under the 1MB Firestore doc limit

function readJson(key: string): any {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** Build a snapshot payload from this browser's local workspace data. */
export function exportWorkspaceSnapshot(kinds: SnapshotAssetKind[]): {
  payload: SnapshotPayload;
  counts: Record<SnapshotAssetKind, number>;
} {
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
    const links = readJson('chatmize_sendchat_links');
    if (Array.isArray(links)) {
      payload.growthLinks = links;
      counts.growthLinks = links.length;
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
 * Merge a snapshot payload into this browser's local workspace data.
 * Imported bots always land as drafts with zeroed stats so nothing goes
 * live by surprise. Returns per-kind import counts.
 */
export function importSnapshotPayload(payload: SnapshotPayload): Record<SnapshotAssetKind, number> {
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
    counts.growthLinks = appendToList('chatmize_sendchat_links', payload.growthLinks);
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
    counts: input.counts,
    payload: input.payload,
  });
  return ref.id;
}

export async function getSnapshot(id: string): Promise<SnapshotDoc | null> {
  const snap = await getDoc(doc(db, 'snapshots', id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<SnapshotDoc, 'id'>) };
}

export async function listTemplates(): Promise<SnapshotDoc[]> {
  const q = query(snapshotsCol(), where('isTemplate', '==', true), orderBy('createdAt', 'desc'));
  const res = await getDocs(q);
  return res.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SnapshotDoc, 'id'>) }));
}

/** Super Admin: every snapshot on the platform, newest first. */
export async function listAllSnapshots(): Promise<SnapshotDoc[]> {
  const q = query(snapshotsCol(), orderBy('createdAt', 'desc'));
  const res = await getDocs(q);
  return res.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SnapshotDoc, 'id'>) }));
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
  return res.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SnapshotDoc, 'id'>) }));
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

/** Shareable import link for a snapshot id. */
export function snapshotShareUrl(id: string): string {
  return `${window.location.origin}${window.location.pathname}?snapshot=${id}`;
}
