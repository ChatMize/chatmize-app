/**
 * Workspace membership — the single shared guard for every callable.
 *
 * Hardened model (2026-09-19, card-bug-workspace-list-localstorage):
 * - A caller may act on a workspace only if a member doc exists at
 *   `workspaces/{wsId}/members/{uid}`, or they carry the Super Admin claim.
 * - A missing workspace doc is a hard permission-denied (no auto-create).
 * - A non-member caller is a hard permission-denied (no auto-add).
 * - This function performs ZERO writes. Provisioning happens only through the
 *   explicit `createWorkspace` / `claimLocalWorkspace` callables below, which
 *   write the workspace doc, the member doc, and the reverse index
 *   (`users/{uid}/workspaceAccess/{wsId}`) in one Admin-SDK batch.
 *
 * This replaces the old first-use provisioning (commit 9d3deff), which let
 * any authenticated caller claim ownership of any unprovisioned workspace ID
 * and silently join themselves to any existing workspace. With no users in
 * production yet, the migration is safe to ship as a hard cut.
 */
import { randomBytes } from "crypto";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";

const db = () => getFirestore("chatmize-prod");

export type WorkspaceRole = "owner" | "admin" | "member";

/** Throw unless the caller may act on the workspace. No writes, no provisioning. */
export async function requireWorkspaceAccess(
  uid: string,
  workspaceId: string,
  token: Record<string, unknown> | { superadmin?: boolean } | undefined,
): Promise<void> {
  if ((token as { superadmin?: boolean } | undefined)?.superadmin === true) return;
  if (!workspaceId || typeof workspaceId !== "string") {
    throw new HttpsError("invalid-argument", "workspaceId is required.");
  }
  const member = await db()
    .collection("workspaces")
    .doc(workspaceId)
    .collection("members")
    .doc(uid)
    .get();
  if (member.exists) return;
  throw new HttpsError(
    "permission-denied",
    "You are not a member of this workspace.",
  );
}

/** Unguessable workspace IDs: `ws_` + 16 crypto-random hex bytes. Never slug- or timestamp-derived. */
export function randomWorkspaceId(): string {
  return `ws_${randomBytes(16).toString("hex")}`;
}

/** Fetch the caller's role for a workspace, or null if not a member. */
export async function getWorkspaceRole(
  uid: string,
  workspaceId: string,
): Promise<WorkspaceRole | null> {
  const snap = await db()
    .collection("workspaces")
    .doc(workspaceId)
    .collection("members")
    .doc(uid)
    .get();
  if (!snap.exists) return null;
  const role = (snap.data() as { role?: string }).role;
  return role === "owner" || role === "admin" || role === "member" ? role : null;
}

export interface CreateWorkspaceInput {
  name: string;
  businessType?: string;
  /** Demo/sandbox workspaces are fully functional but clearly labeled in the UI. */
  demo?: boolean;
}

/**
 * Create a real workspace: doc + owner member record + reverse index, in one
 * batch. Any signed-in user may create workspaces (plan gating is a later card).
 */
export async function createWorkspaceCore(
  uid: string,
  input: CreateWorkspaceInput,
): Promise<string> {
  const name = String(input.name ?? "").trim().slice(0, 80);
  if (!name) {
    throw new HttpsError("invalid-argument", "A workspace name is required.");
  }
  const workspaceId = randomWorkspaceId();
  const now = FieldValue.serverTimestamp();
  const batch = db().batch();
  batch.set(db().collection("workspaces").doc(workspaceId), {
    name,
    slug: "",
    planTier: "standard_page",
    ownerUid: uid,
    demo: input.demo === true,
    businessType: String(input.businessType ?? "").slice(0, 40) || null,
    createdBy: uid,
    createdAt: now,
  });
  batch.set(db().collection("workspaces").doc(workspaceId).collection("members").doc(uid), {
    uid,
    role: "owner",
    createdAt: now,
  });
  batch.set(db().collection("users").doc(uid).collection("workspaceAccess").doc(workspaceId), {
    wsId: workspaceId,
    role: "owner",
    workspaceName: name,
    demo: input.demo === true,
    joinedAt: now,
  });
  await batch.commit();
  return workspaceId;
}

const MAX_CLAIMS_PER_USER = 25;

export interface ClaimLocalWorkspaceInput {
  /** The localStorage-era ID (e.g. `ws-biz-1`, `ws-biz-<timestamp>`). Never reused as a real ID. */
  localId: string;
  name: string;
}

/**
 * One-time migration for localStorage-only workspaces: creates a real
 * workspace via the same path as `createWorkspace` and links it to the old
 * local ID. Idempotent per (uid, localId): re-runs return the existing
 * workspace instead of creating a duplicate. Display names are carried over;
 * fake page IDs / stats / avatars are NOT (they were never real).
 */
export async function claimLocalWorkspaceCore(
  uid: string,
  input: ClaimLocalWorkspaceInput,
): Promise<{ workspaceId: string; claimed: boolean }> {
  const localId = String(input.localId ?? "").trim().slice(0, 64);
  if (!localId) {
    throw new HttpsError("invalid-argument", "localId is required.");
  }
  const accessCol = db().collection("users").doc(uid).collection("workspaceAccess");
  // Idempotency: has this local ID already been claimed by this user?
  const prior = await accessCol.where("claimedFromLocalId", "==", localId).limit(1).get();
  if (!prior.empty) {
    return { workspaceId: prior.docs[0].id, claimed: false };
  }
  const existing = await accessCol.limit(MAX_CLAIMS_PER_USER + 1).get();
  if (existing.size > MAX_CLAIMS_PER_USER) {
    throw new HttpsError(
      "resource-exhausted",
      "Too many workspaces to migrate. Contact support.",
    );
  }
  const workspaceId = randomWorkspaceId();
  const now = FieldValue.serverTimestamp();
  const name = String(input.name ?? "").trim().slice(0, 80) || "My Workspace";
  const batch = db().batch();
  batch.set(db().collection("workspaces").doc(workspaceId), {
    name,
    slug: "",
    planTier: "standard_page",
    ownerUid: uid,
    demo: false,
    migratedFromLocal: true,
    createdBy: uid,
    createdAt: now,
  });
  batch.set(db().collection("workspaces").doc(workspaceId).collection("members").doc(uid), {
    uid,
    role: "owner",
    createdAt: now,
  });
  batch.set(accessCol.doc(workspaceId), {
    wsId: workspaceId,
    role: "owner",
    workspaceName: name,
    demo: false,
    claimedFromLocalId: localId,
    joinedAt: now,
  });
  await batch.commit();
  return { workspaceId, claimed: true };
}

export interface InviteMemberInput {
  workspaceId: string;
  email: string;
  role?: "admin" | "member";
}

/**
 * Invite a team member: caller must be owner/admin. Writes an invite doc with
 * a random claim token; the invited user accepts via `acceptWorkspaceInvite`.
 * (Data model now; invite UI ships later per Karl decision 4.)
 */
export async function inviteWorkspaceMemberCore(
  uid: string,
  input: InviteMemberInput,
): Promise<{ inviteId: string }> {
  const { workspaceId } = input;
  const role = await getWorkspaceRole(uid, workspaceId);
  if (role !== "owner" && role !== "admin") {
    throw new HttpsError("permission-denied", "Only owners and admins can invite members.");
  }
  const email = String(input.email ?? "").trim().toLowerCase().slice(0, 160);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpsError("invalid-argument", "A valid email address is required.");
  }
  const memberRole: WorkspaceRole = input.role === "admin" ? "admin" : "member";
  const inviteId = randomBytes(12).toString("hex");
  const claimToken = randomBytes(24).toString("hex");
  await db()
    .collection("workspaces")
    .doc(workspaceId)
    .collection("invites")
    .doc(inviteId)
    .set({
      email,
      role: memberRole,
      claimToken,
      invitedBy: uid,
      status: "pending",
      createdAt: FieldValue.serverTimestamp(),
    });
  return { inviteId };
}

/**
 * Accept a workspace invite with its claim token. Creates the member doc and
 * the reverse index in one batch, then marks the invite accepted.
 */
export async function acceptWorkspaceInviteCore(
  uid: string,
  workspaceId: string,
  claimToken: string,
): Promise<{ workspaceId: string }> {
  const token = String(claimToken ?? "").trim();
  if (!workspaceId) {
    throw new HttpsError("invalid-argument", "workspaceId is required.");
  }
  if (!token) {
    throw new HttpsError("invalid-argument", "Invite token is required.");
  }
  const found = await db()
    .collection("workspaces")
    .doc(workspaceId)
    .collection("invites")
    .where("claimToken", "==", token)
    .where("status", "==", "pending")
    .limit(1)
    .get();
  if (found.empty) {
    throw new HttpsError("not-found", "This invite is invalid or has already been used.");
  }
  const inviteDoc = found.docs[0];
  const data = inviteDoc.data() as { role?: string; email?: string };
  const role: WorkspaceRole = data.role === "admin" ? "admin" : "member";
  const now = FieldValue.serverTimestamp();
  const batch = db().batch();
  batch.set(db().collection("workspaces").doc(workspaceId).collection("members").doc(uid), {
    uid,
    role,
    invitedBy: (data as { invitedBy?: string }).invitedBy ?? null,
    email: data.email ?? null,
    createdAt: now,
  });
  batch.set(db().collection("users").doc(uid).collection("workspaceAccess").doc(workspaceId), {
    wsId: workspaceId,
    role,
    workspaceName: "",
    demo: false,
    joinedAt: now,
  });
  batch.update(inviteDoc.ref, { status: "accepted", acceptedBy: uid, acceptedAt: now });
  await batch.commit();
  return { workspaceId };
}
