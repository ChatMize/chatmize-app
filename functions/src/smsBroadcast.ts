/**
 * Shared SMS broadcast runner.
 *
 * The exact production pipeline previously embedded in the sendSmsBroadcast
 * callable: idempotent on a client key (retries resume or replay), recipient
 * resolution (explicit list or all opted-in numbers), per-recipient opt-in
 * re-check, per-recipient personalization, chunked sends with persisted
 * progress, billing stop-short-circuit, and a delivery report.
 *
 * Both the Firebase callable (index.ts) and the MCP server call this —
 * there is exactly one broadcast path.
 */
import { getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { resolvePersonalizationTags, getContactForPhone } from "./personalization";
import {
  normalizePhone,
  calculateSegments,
  sendSmsViaProvider,
  providerOf,
  ensureAllowanceMonth,
  getOptIn,
  logSms,
  chargeForSend,
  persistOutboundSms,
} from "./sms";
import { smsPlanAllowance } from "./smsSend";
import { trackBroadcastSent } from "./analytics";

const db = () => getFirestore("chatmize-prod");

export type SmsBroadcastErrorCode =
  | "invalid-argument"
  | "failed-precondition"
  | "permission-denied"
  | "resource-exhausted"
  | "internal";

/** Plain error (no Firebase dependency) so non-callable callers can use it. */
export class SmsBroadcastError extends Error {
  code: SmsBroadcastErrorCode;
  constructor(code: SmsBroadcastErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

/** Max recipients per broadcast run: sized so sequential sends fit the 540s timeout. */
export const BROADCAST_MAX_RECIPIENTS = 500;
/** Progress is persisted to the broadcast doc after each chunk (resumable). */
export const BROADCAST_CHUNK_SIZE = 50;

export interface BroadcastState {
  workspaceId: string;
  recipients: string[];
  status: "running" | "complete";
  processed: number;
  sent: number;
  failed: number;
  skipped: number;
  creditsCharged: number;
  errors: string[];
  stoppedEarly: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BroadcastReport {
  ok: boolean;
  broadcastId: string;
  replayed?: boolean;
  complete: boolean;
  sent: number;
  failed: number;
  skipped: number;
  creditsCharged: number;
  errors: string[];
}

/**
 * Run (or resume/replay) an SMS broadcast for a workspace.
 * Throws SmsBroadcastError on validation / connection failures.
 */
export async function runSmsBroadcastInternal(
  workspaceId: string,
  body: string,
  phones?: string[],
  idempotencyKey?: string,
): Promise<BroadcastReport> {
  if (!workspaceId || !body) {
    throw new SmsBroadcastError("invalid-argument", "workspaceId and body are required.");
  }
  if (body.length > 1600) {
    throw new SmsBroadcastError("invalid-argument", "Message is too long (max 1600 characters).");
  }
  await smsPlanAllowance(workspaceId);

  const conn = await ensureAllowanceMonth(workspaceId);
  if (!conn || conn.status !== "active") {
    throw new SmsBroadcastError("failed-precondition", "SMS is not enabled for this workspace yet.");
  }

  // Idempotency: retries with the same key resume (or replay the stored
  // result) instead of re-sending the broadcast.
  const key = (idempotencyKey ?? "").trim() || `bc_${Date.now().toString(36)}`;
  const bcastRef = db().collection("sms_broadcasts").doc(key);
  const broadcastId = key;

  let state: BroadcastState;
  const existing = await bcastRef.get();
  if (existing.exists) {
    const d = existing.data() as BroadcastState;
    if (d.status === "complete") {
      logger.info("SMS broadcast replayed from idempotency key", { workspaceId, broadcastId });
      return {
        ok: true, broadcastId, replayed: true, complete: true,
        sent: d.sent, failed: d.failed, skipped: d.skipped,
        creditsCharged: d.creditsCharged, errors: d.errors,
      };
    }
    if (d.workspaceId !== workspaceId) {
      throw new SmsBroadcastError("invalid-argument", "This idempotency key is already in use.");
    }
    state = d;
    logger.info("SMS broadcast resuming", { workspaceId, broadcastId, processed: d.processed });
  } else {
    let recipients: string[];
    if (phones && phones.length > 0) {
      recipients = [...new Set(phones.map((p) => normalizePhone(p)).filter((p): p is string => !!p))];
    } else {
      // Requires the composite index on sms_optins(workspaceId, optedIn);
      // see firestore.indexes.json.
      const snap = await db()
        .collection("sms_optins")
        .where("workspaceId", "==", workspaceId)
        .where("optedIn", "==", true)
        .get();
      recipients = snap.docs.map((doc) => (doc.data() as { phone: string }).phone);
    }
    if (recipients.length === 0) {
      throw new SmsBroadcastError("failed-precondition", "No opted-in recipients to send to.");
    }
    if (recipients.length > BROADCAST_MAX_RECIPIENTS) {
      throw new SmsBroadcastError(
        "invalid-argument",
        `Broadcasts are limited to ${BROADCAST_MAX_RECIPIENTS} recipients per run; split larger lists.`,
      );
    }
    const now = new Date().toISOString();
    state = {
      workspaceId,
      recipients,
      status: "running",
      processed: 0,
      sent: 0,
      failed: 0,
      skipped: 0,
      creditsCharged: 0,
      errors: [],
      stoppedEarly: false,
      createdAt: now,
      updatedAt: now,
    };
    try {
      // create() is atomic: it throws when the key already exists, so a
      // racing retry falls through to the resume path below.
      await bcastRef.create(state);
    } catch (e) {
      const code = (e as { code?: number }).code;
      const msg = e instanceof Error ? e.message : String(e);
      if (code !== 6 && !/already exists/i.test(msg)) throw e;
      const raced = await bcastRef.get();
      state = raced.data() as BroadcastState;
      if (state.workspaceId !== workspaceId) {
        throw new SmsBroadcastError("invalid-argument", "This idempotency key is already in use.");
      }
      logger.info("SMS broadcast lost create race; resuming", { workspaceId, broadcastId });
    }
  }

  let stoppedEarly = state.stoppedEarly;

  for (let i = state.processed; i < state.recipients.length; i += BROADCAST_CHUNK_SIZE) {
    const chunk = state.recipients.slice(i, i + BROADCAST_CHUNK_SIZE);
    for (const to of chunk) {
      const optIn = await getOptIn(workspaceId, to);
      if (!optIn?.optedIn) {
        state.skipped += 1;
        continue;
      }
      // Personalization: resolve {{tags}} per recipient against their
      // contact record so merge tags never go out as raw text. Segments
      // are recomputed per message because personalization changes length.
      const bcContact = await getContactForPhone(to);
      const personalBody = resolvePersonalizationTags(body, bcContact);
      if (personalBody.length > 1600) {
        state.skipped += 1;
        continue;
      }
      const personalSegments = calculateSegments(personalBody);
      try {
        const charged = await chargeForSend(workspaceId, personalSegments, `sms broadcast ${broadcastId}`);
        const messageId = await sendSmsViaProvider(providerOf(conn), conn.phoneNumber, to, personalBody);
        state.creditsCharged += charged.creditsCharged;
        state.sent += 1;
        await persistOutboundSms(workspaceId, conn.phoneNumber, to, personalBody, messageId);
        await logSms({
          workspaceId, direction: "outbound", to, from: conn.phoneNumber, body: personalBody,
          segments: personalSegments, creditsCharged: charged.creditsCharged, messageId, status: "sent", broadcastId,
        });
      } catch (err) {
        state.failed += 1;
        const message = err instanceof Error ? err.message : "send failed";
        if (state.errors.length < 5) state.errors.push(`${to}: ${message}`);
        await logSms({
          workspaceId, direction: "outbound", to, from: conn.phoneNumber, body: personalBody,
          segments: personalSegments, creditsCharged: 0, status: "failed", error: message, broadcastId,
        });
        if (message.includes("exhausted") || message.includes("insufficient credits")) {
          stoppedEarly = true;
          break; // stop burning through the list when billing is the problem
        }
      }
    }
    state.processed = Math.min(i + BROADCAST_CHUNK_SIZE, state.recipients.length);
    state.stoppedEarly = stoppedEarly;
    state.updatedAt = new Date().toISOString();
    await bcastRef.update({
      processed: state.processed,
      sent: state.sent,
      failed: state.failed,
      skipped: state.skipped,
      creditsCharged: state.creditsCharged,
      errors: state.errors,
      stoppedEarly,
      updatedAt: state.updatedAt,
    });
    if (stoppedEarly) break;
  }

  const complete = !stoppedEarly;
  if (complete) {
    await bcastRef.update({ status: "complete", updatedAt: new Date().toISOString() });
  }
  // Analytics: fold the broadcast run into today's counters (fire-and-forget).
  // Per-recipient SMS sends inside the run carry broadcastId and skip the
  // single-send counter, so this is the one place broadcast volume lands.
  trackBroadcastSent(
    workspaceId,
    {
      campaignId: broadcastId,
      name: body.length > 60 ? `SMS broadcast: ${body.slice(0, 57)}...` : `SMS broadcast: ${body}`,
      channel: "sms",
    },
    state.sent,
    state.failed,
  );
  logger.info("SMS broadcast finished", {
    workspaceId, broadcastId,
    sent: state.sent, failed: state.failed, skipped: state.skipped, complete,
  });
  return {
    ok: true, broadcastId, complete,
    sent: state.sent, failed: state.failed, skipped: state.skipped,
    creditsCharged: state.creditsCharged, errors: state.errors,
  };
}
