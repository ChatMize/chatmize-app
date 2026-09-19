import { useEffect, useState } from 'react';
import { getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { collection, getDocs, onSnapshot } from 'firebase/firestore';
import { db, type AppUser } from './firebase';

// Workspace membership hardening: the server owns memberships. Clients read
// their own users/{uid}/workspaceAccess docs (backend callables maintain
// them); they can never write them. This module is the frontend half:
// membership subscription, the one-time localStorage migration, and the
// create-workspace callable wrappers.

const functions = getFunctions(getApp(), 'us-west2');

export interface WorkspaceMembership {
  wsId: string;
  role: 'owner' | 'admin' | 'member';
  workspaceName: string;
  demo: boolean;
  claimedFromLocalId?: string;
}

/**
 * Live subscription to the signed-in user's workspace memberships.
 * Returns the membership list plus a loading flag (true until the first
 * snapshot arrives or the user signs out).
 */
export function useWorkspaceMemberships(
  user: AppUser | null,
): { memberships: WorkspaceMembership[]; loading: boolean } {
  const [memberships, setMemberships] = useState<WorkspaceMembership[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setMemberships([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const ref = collection(db, 'users', user.uid, 'workspaceAccess');
    const unsubscribe = onSnapshot(
      ref,
      (snap) => {
        const list: WorkspaceMembership[] = [];
        snap.forEach((docSnap) => {
          const data = docSnap.data() as Partial<WorkspaceMembership> & { wsId?: string };
          list.push({
            wsId: typeof data.wsId === 'string' && data.wsId ? data.wsId : docSnap.id,
            role: data.role === 'owner' || data.role === 'admin' || data.role === 'member' ? data.role : 'member',
            workspaceName: typeof data.workspaceName === 'string' && data.workspaceName ? data.workspaceName : 'Workspace',
            demo: data.demo === true,
            claimedFromLocalId: typeof data.claimedFromLocalId === 'string' ? data.claimedFromLocalId : undefined,
          });
        });
        list.sort((a, b) => a.workspaceName.localeCompare(b.workspaceName));
        setMemberships(list);
        setLoading(false);
      },
      () => setLoading(false),
    );
    return () => unsubscribe();
  }, [user?.uid]);

  return { memberships, loading };
}

const LEGACY_BLOB_KEY = 'chatmize_workspaces';
const ARCHIVE_KEY = 'chatmize_workspaces_archived_v1';
const DEMO_SEEDED_KEY = 'chatmize_demo_seeded_v1';

interface LegacyWorkspaceEntry {
  id?: unknown;
  name?: unknown;
}

/**
 * One-time migration: claim every localStorage-only workspace into the real
 * membership system via the claimLocalWorkspace callable. Safe to call
 * multiple times: entries whose localId already has a matching
 * claimedFromLocalId membership are skipped (the backend's per-user
 * idempotency is the backstop). After all claims settle, the blob is archived
 * under a new key (kept for 30-day support debugging) and removed.
 */
export async function claimLocalWorkspaces(): Promise<void> {
  let blob: string | null = null;
  try {
    blob = localStorage.getItem(LEGACY_BLOB_KEY);
  } catch {
    return;
  }
  if (!blob) return; // Nothing to migrate.

  let entries: LegacyWorkspaceEntry[] = [];
  try {
    const parsed: unknown = JSON.parse(blob);
    entries = Array.isArray(parsed) ? (parsed as LegacyWorkspaceEntry[]) : [];
  } catch {
    entries = [];
  }

  // Local ids already claimed: skip them without calling the backend.
  const claimedLocalIds = new Set<string>();
  try {
    const uid = getAuth().currentUser?.uid;
    if (uid) {
      const snap = await getDocs(collection(db, 'users', uid, 'workspaceAccess'));
      snap.forEach((docSnap) => {
        const claimed = (docSnap.data() as { claimedFromLocalId?: unknown }).claimedFromLocalId;
        if (typeof claimed === 'string' && claimed) claimedLocalIds.add(claimed);
      });
    }
  } catch {
    // Best effort: the callable is idempotent per user+localId anyway.
  }

  const claim = httpsCallable<{ localId: string; name: string }, { workspaceId: string; claimed: boolean }>(
    functions,
    'claimLocalWorkspace',
  );
  await Promise.allSettled(
    entries.map((entry) => {
      const localId = typeof entry.id === 'string' ? entry.id : '';
      if (!localId || claimedLocalIds.has(localId)) return Promise.resolve();
      const name = typeof entry.name === 'string' && entry.name.trim() ? entry.name.trim() : 'My Workspace';
      return claim({ localId, name });
    }),
  );

  try {
    localStorage.setItem(ARCHIVE_KEY, blob);
    localStorage.removeItem(LEGACY_BLOB_KEY);
  } catch {
    // Storage unavailable: the migration flag still prevents re-runs.
  }
}

/**
 * For brand-new users (no local blob ever, zero memberships), create a single
 * "Demo Sandbox" workspace. Runs at most once per browser, tracked by the
 * chatmize_demo_seeded_v1 flag.
 */
export async function ensureDemoSandbox(user: AppUser | null, accessList: WorkspaceMembership[]): Promise<void> {
  if (!user) return;
  const markSeeded = () => {
    try {
      localStorage.setItem(DEMO_SEEDED_KEY, '1');
    } catch {
      // ignore
    }
  };
  try {
    if (localStorage.getItem(DEMO_SEEDED_KEY) === '1') return;
  } catch {
    return;
  }
  let hadLocalBlob = false;
  try {
    hadLocalBlob =
      localStorage.getItem(LEGACY_BLOB_KEY) !== null || localStorage.getItem(ARCHIVE_KEY) !== null;
  } catch {
    // ignore
  }
  if (hadLocalBlob || accessList.length > 0) {
    markSeeded();
    return;
  }
  try {
    await createWorkspaceRemote('Demo Sandbox', undefined, { demo: true });
  } catch {
    // Best effort: a failed seed must not block the app. The flag still
    // prevents hammering the callable on every load.
  }
  markSeeded();
}

/** Create a real workspace through the backend; returns the new workspace ID. */
export async function createWorkspaceRemote(
  name: string,
  businessType?: string,
  opts?: { demo?: boolean },
): Promise<string> {
  const fn = httpsCallable<{ name: string; businessType?: string; demo?: boolean }, { workspaceId: string }>(
    functions,
    'createWorkspace',
  );
  const result = await fn({ name, businessType, demo: opts?.demo === true });
  return result.data.workspaceId;
}
