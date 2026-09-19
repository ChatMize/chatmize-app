/**
 * Build catalog (release notes feed) backend.
 *
 * Folded into metaOAuthStatus via handleBuildCatalogAction because creating
 * new Cloud Functions through the VM's egress proxy fails (known limitation).
 * All actions are Super Admin only (custom claim check, no workspace scope).
 *
 * Storage: system_settings/build_catalog document, { entries: [...] }.
 * Reads happen client-side via Firestore rules (signed-in read allowed).
 */
import { getFirestore } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";

const db = () => getFirestore("chatmize-prod");
const DOC = "system_settings/build_catalog";

export interface BuildCatalogEntryInput {
  title: string;
  summary: string;
  buildDate: string;
  goLiveDate: string;
  deployCommit?: string;
  bundleName?: string;
  tags?: string[];
  icon?: string;
}

function requireSuperAdmin(token: any): void {
  if (token?.superadmin !== true) {
    throw new HttpsError("permission-denied", "Super Admin only.");
  }
}

function cleanEntry(input: Record<string, unknown>): Record<string, unknown> {
  const title = String(input.title || "").trim();
  const buildDate = String(input.buildDate || "").trim();
  const goLiveDate = String(input.goLiveDate || "").trim();
  if (!title) throw new HttpsError("invalid-argument", "title is required.");
  if (!buildDate) throw new HttpsError("invalid-argument", "buildDate is required.");
  if (!goLiveDate) throw new HttpsError("invalid-argument", "goLiveDate is required.");
  const tags = Array.isArray(input.tags) ? input.tags.map(String).slice(0, 12) : [];
  return {
    id: `bc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    title: title.slice(0, 120),
    summary: String(input.summary || "").slice(0, 2000),
    buildDate: buildDate.slice(0, 10),
    goLiveDate: goLiveDate.slice(0, 10),
    deployCommit: input.deployCommit ? String(input.deployCommit).slice(0, 40) : "",
    bundleName: input.bundleName ? String(input.bundleName).slice(0, 120) : "",
    tags,
    icon: input.icon ? String(input.icon).slice(0, 40) : "",
    createdAt: new Date().toISOString(),
  };
}

async function readEntries(): Promise<Record<string, unknown>[]> {
  const snap = await db().doc(DOC).get();
  const raw = snap.data()?.entries;
  return Array.isArray(raw) ? raw : [];
}

/**
 * Deploy coordinators call this after every deploy. This is the wiring that
 * turns "we shipped X" into the bell message and the catalog entry.
 */
export async function handleBuildCatalogAction(
  action: string,
  data: Record<string, unknown>,
  token: any
): Promise<Record<string, unknown>> {
  requireSuperAdmin(token);
  const ref = db().doc(DOC);

  if (action === "buildCatalogLog") {
    const entry = cleanEntry(data);
    await db().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const entries = Array.isArray(snap.data()?.entries) ? (snap.data()!.entries as unknown[]) : [];
      tx.set(ref, { entries: [...entries, entry], updatedAt: new Date().toISOString() }, { merge: true });
    });
    return { ok: true, id: entry.id };
  }

  if (action === "buildCatalogUpdate") {
    const id = String(data.id || "");
    if (!id) throw new HttpsError("invalid-argument", "id is required.");
    const patch = cleanEntry({ ...data, id });
    await db().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const entries = (Array.isArray(snap.data()?.entries) ? snap.data()!.entries : []) as Record<string, unknown>[];
      const next = entries.map((e) => (e.id === id ? { ...patch, id, createdAt: e.createdAt } : e));
      tx.set(ref, { entries: next, updatedAt: new Date().toISOString() }, { merge: true });
    });
    return { ok: true };
  }

  if (action === "buildCatalogDelete") {
    const id = String(data.id || "");
    if (!id) throw new HttpsError("invalid-argument", "id is required.");
    await db().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const entries = (Array.isArray(snap.data()?.entries) ? snap.data()!.entries : []) as Record<string, unknown>[];
      tx.set(
        ref,
        { entries: entries.filter((e) => e.id !== id), updatedAt: new Date().toISOString() },
        { merge: true }
      );
    });
    return { ok: true };
  }

  throw new HttpsError("invalid-argument", `Unknown build catalog action: ${action}`);
}

export { readEntries };
