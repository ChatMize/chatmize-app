import { collection, getDocs } from 'firebase/firestore';
import { prodDb } from './firebase';

export const ACTIVE_WORKSPACE_STORAGE_KEY = 'chatmize_active_workspace_id';

/**
 * Single source of truth for "the real current workspace".
 *
 * Resolution order:
 * 1. Stored selection — but ONLY if that workspace document actually exists
 *    in the chatmize-prod database (prevents stale/demo selections leaking in).
 * 2. First workspace document visible in the chatmize-prod workspaces collection.
 * 3. null when nothing is resolvable — callers must render an empty/onboarding
 *    state rather than inventing an id.
 *
 * There are NO hardcoded workspace ids anywhere in this resolver.
 */
export async function resolveActiveWorkspaceId(
  _user?: { uid: string; email?: string | null } | null
): Promise<string | null> {
  try {
    const snap = await getDocs(collection(prodDb, 'workspaces'));
    const docs = snap.docs.map((d) => d.id);
    if (docs.length === 0) return null;

    const stored = safeGet(ACTIVE_WORKSPACE_STORAGE_KEY);
    if (stored && docs.includes(stored)) return stored;

    return docs[0];
  } catch (err) {
    // Offline / permission errors: trust only a stored value. Never invent an id.
    return safeGet(ACTIVE_WORKSPACE_STORAGE_KEY);
  }
}

/** Persist an explicit workspace selection (workspace switcher). */
export function persistActiveWorkspaceId(id: string): void {
  try {
    window.localStorage.setItem(ACTIVE_WORKSPACE_STORAGE_KEY, id);
  } catch {
    /* storage unavailable */
  }
}

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
