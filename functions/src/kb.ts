/**
 * Knowledge Base (Phase 1: Builder MVP).
 *
 * Server side pieces for the native KB system. Client writes article drafts
 * directly to Firestore (workspace member rules); publish, unpublish, and
 * feedback counting run here so revision snapshots and counters stay
 * consistent. No AI/RAG in Phase 1 (no embeddings, no kbRetrieve).
 */

import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";

const kbDb = () => getFirestore("chatmize-prod");

const articlesCol = (workspaceId: string) =>
  kbDb().collection("workspaces").doc(workspaceId).collection("kb_articles");

const revisionsCol = (workspaceId: string) =>
  kbDb().collection("workspaces").doc(workspaceId).collection("kb_revisions");

export interface PublishKbInput {
  workspaceId: string;
  articleId: string;
  note?: string;
}

/** Flag articles with real traffic but poor helpful ratings for a rewrite. */
function computeNeedsReview(viewCount: number, helpfulYes: number, helpfulNo: number): boolean {
  const votes = helpfulYes + helpfulNo;
  if (viewCount < 50 || votes < 5) return false;
  return helpfulYes / votes < 0.4;
}

/**
 * Publish a draft: validates the article, snapshots a full revision, marks it
 * published. Republishing a live article writes a fresh revision too.
 */
export async function publishKbArticleHandler(
  workspaceId: string,
  articleId: string,
  uid: string,
  note?: string,
): Promise<{ articleId: string; revisionId: string; status: string }> {
  const articleRef = articlesCol(workspaceId).doc(articleId);
  const snap = await articleRef.get();
  if (!snap.exists) {
    throw new HttpsError("not-found", "That article does not exist.");
  }
  const data = snap.data() as Record<string, unknown>;
  const title = typeof data.title === "string" ? data.title.trim() : "";
  const steps = Array.isArray(data.steps) ? data.steps : [];
  if (!title) {
    throw new HttpsError("invalid-argument", "Give the article a title before publishing.");
  }
  if (steps.length === 0) {
    throw new HttpsError("invalid-argument", "Add at least one step before publishing.");
  }

  const viewCount = typeof data.viewCount === "number" ? data.viewCount : 0;
  const helpfulYes = typeof data.helpfulYes === "number" ? data.helpfulYes : 0;
  const helpfulNo = typeof data.helpfulNo === "number" ? data.helpfulNo : 0;

  const revisionRef = revisionsCol(workspaceId).doc();
  const now = FieldValue.serverTimestamp();
  await kbDb().runTransaction(async (tx) => {
    tx.set(revisionRef, {
      articleId,
      snapshot: { ...data, id: articleId },
      publishedBy: uid,
      publishedAt: now,
      note: typeof note === "string" ? note.slice(0, 500) : "",
    });
    tx.update(articleRef, {
      status: "published",
      publishedAt: now,
      updatedAt: now,
      needsReview: computeNeedsReview(viewCount, helpfulYes, helpfulNo),
      lastReviewedAt: now,
    });
  });

  return { articleId, revisionId: revisionRef.id, status: "published" };
}

/** Send a published article back to draft. Revisions are kept as history. */
export async function unpublishKbArticleHandler(
  workspaceId: string,
  articleId: string,
): Promise<{ articleId: string; status: string }> {
  const articleRef = articlesCol(workspaceId).doc(articleId);
  const snap = await articleRef.get();
  if (!snap.exists) {
    throw new HttpsError("not-found", "That article does not exist.");
  }
  await articleRef.update({
    status: "draft",
    updatedAt: FieldValue.serverTimestamp(),
  });
  return { articleId, status: "draft" };
}

export type KbFeedbackKind = "view" | "yes" | "no";

/**
 * Record a view or a helpful/not helpful vote. Counters use increments so
 * concurrent readers never clobber each other; the needs review flag is
 * recomputed in the same transaction.
 */
export async function kbFeedbackHandler(
  workspaceId: string,
  articleId: string,
  kind: KbFeedbackKind,
): Promise<{ ok: true }> {
  if (kind !== "view" && kind !== "yes" && kind !== "no") {
    throw new HttpsError("invalid-argument", "Feedback must be view, yes, or no.");
  }
  const articleRef = articlesCol(workspaceId).doc(articleId);
  await kbDb().runTransaction(async (tx) => {
    const snap = await tx.get(articleRef);
    if (!snap.exists) {
      throw new HttpsError("not-found", "That article does not exist.");
    }
    const data = snap.data() as Record<string, unknown>;
    const inc = FieldValue.increment(1);
    const updates: Record<string, FieldValue | number | boolean> = {};
    if (kind === "view") updates.viewCount = inc;
    if (kind === "yes") updates.helpfulYes = inc;
    if (kind === "no") updates.helpfulNo = inc;
    const viewCount = (typeof data.viewCount === "number" ? data.viewCount : 0) + (kind === "view" ? 1 : 0);
    const helpfulYes = (typeof data.helpfulYes === "number" ? data.helpfulYes : 0) + (kind === "yes" ? 1 : 0);
    const helpfulNo = (typeof data.helpfulNo === "number" ? data.helpfulNo : 0) + (kind === "no" ? 1 : 0);
    updates.needsReview = computeNeedsReview(viewCount, helpfulYes, helpfulNo);
    tx.update(articleRef, updates);
  });
  return { ok: true };
}
