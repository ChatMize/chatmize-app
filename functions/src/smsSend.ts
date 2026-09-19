/**
 * Shared SMS send pipeline.
 *
 * The exact production pipeline previously embedded in the sendSms callable:
 * plan allowance, connection + monthly rollover, E.164 normalization, opt in
 * enforcement, personalization tag resolution, segment calculation, charge
 * (allowance then credits), provider send, persistence + logging, and a
 * compensating refund when the provider send fails after charging.
 *
 * Both the Firebase callable (index.ts) and the MCP server call this —
 * there is exactly one SMS send path.
 */
import { getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { grantCredits } from "./credits";
import { trackAnalytics } from "./analytics";
import { resolvePersonalizationTags, getContactForPhone } from "./personalization";
import {
  normalizePhone,
  calculateSegments,
  sendSmsViaProvider,
  providerOf,
  getSmsConnection,
  saveSmsConnection,
  ensureAllowanceMonth,
  getOptIn,
  logSms,
  chargeForSend,
  persistOutboundSms,
} from "./sms";

const db = () => getFirestore("chatmize-prod");

export type SmsSendErrorCode =
  | "invalid-argument"
  | "failed-precondition"
  | "permission-denied"
  | "resource-exhausted"
  | "internal";

/** Plain error (no Firebase dependency) so non-callable callers can use it. */
export class SmsSendError extends Error {
  code: SmsSendErrorCode;
  constructor(code: SmsSendErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

/**
 * Resolve the workspace's SMS plan entitlement. Workspaces without an
 * assigned plan are grandfathered in (allowed, zero allowance, pay per
 * segment in credits). A plan without the `sms` feature is denied.
 */
export async function smsPlanAllowance(workspaceId: string): Promise<number> {
  const ws = await db().collection("workspaces").doc(workspaceId).get();
  const planId = ws.data()?.planId as string | undefined;
  if (!planId) {
    logger.info("SMS: workspace has no plan; grandfathered with zero allowance", { workspaceId });
    return 0;
  }
  const plan = await db().collection("plans").doc(planId).get();
  const data = plan.data() as { features?: string[]; smsAllowanceMonthly?: number } | undefined;
  if (!data?.features?.includes("sms")) {
    throw new SmsSendError("permission-denied", "Your plan does not include SMS.");
  }
  return data.smsAllowanceMonthly ?? 0;
}

export interface SmsSendResult {
  ok: boolean;
  messageId: string;
  segments: number;
  chargedTo: "allowance" | "credits";
}

/**
 * Send one SMS through the workspace's SMS connection.
 * Throws SmsSendError on validation / connection / provider failures.
 */
export async function sendSmsInternal(
  workspaceId: string,
  to: string,
  body: string,
  broadcastId?: string,
): Promise<SmsSendResult> {
  if (!workspaceId || !to || !body) {
    throw new SmsSendError("invalid-argument", "workspaceId, to, and body are required.");
  }
  if (body.length > 1600) {
    throw new SmsSendError("invalid-argument", "Message is too long (max 1600 characters).");
  }
  await smsPlanAllowance(workspaceId);

  const conn = await ensureAllowanceMonth(workspaceId);
  if (!conn || conn.status !== "active") {
    throw new SmsSendError("failed-precondition", "SMS is not enabled for this workspace yet.");
  }
  const e164 = normalizePhone(to);
  if (!e164) throw new SmsSendError("invalid-argument", "That recipient number is not valid.");
  const optIn = await getOptIn(workspaceId, e164);
  if (!optIn?.optedIn) {
    throw new SmsSendError(
      "failed-precondition",
      "This contact has not opted in to SMS. Collect consent before sending.",
    );
  }

  // Personalization: resolve {{tags}} against the recipient's contact
  // record so merge tags never go out as raw text.
  const smsContact = await getContactForPhone(e164);
  const resolvedBody = resolvePersonalizationTags(body, smsContact);
  if (resolvedBody.length > 1600) {
    throw new SmsSendError("invalid-argument", "Message is too long (max 1600 characters).");
  }
  const segments = calculateSegments(resolvedBody);
  let charged: { chargedTo: "allowance" | "credits"; creditsCharged: number } = {
    chargedTo: "allowance",
    creditsCharged: 0,
  };
  try {
    charged = await chargeForSend(
      workspaceId,
      segments,
      broadcastId ? `sms broadcast ${broadcastId}` : "sms send",
    );
  } catch {
    throw new SmsSendError(
      "resource-exhausted",
      "SMS allowance and credits are exhausted. Top up credits to keep sending.",
    );
  }

  try {
    const provider = providerOf(conn);
    const messageId = await sendSmsViaProvider(provider, conn.phoneNumber, e164, resolvedBody);
    await persistOutboundSms(workspaceId, conn.phoneNumber, e164, resolvedBody, messageId);
    await logSms({
      workspaceId,
      direction: "outbound",
      to: e164,
      from: conn.phoneNumber,
      body: resolvedBody,
      segments,
      creditsCharged: charged.creditsCharged,
      messageId,
      status: "sent",
      broadcastId,
    });
    // Analytics: fold the outbound SMS into today's counters (fire-and-forget).
    // Broadcasts aggregate separately in runSmsBroadcastInternal; single sends
    // count here. broadcastId marks sends that belong to a broadcast run.
    if (!broadcastId) {
      trackAnalytics(workspaceId, { "sent.sms": 1 });
    }
    return { ok: true, messageId, segments, chargedTo: charged.chargedTo };
  } catch (err) {
    const message = err instanceof Error ? err.message : "SMS send failed.";
    // Compensating refund: the workspace was charged before the provider sent,
    // and the provider never billed for this message, so give the charge back.
    if (charged.chargedTo === "credits" && charged.creditsCharged > 0) {
      await grantCredits(
        workspaceId,
        charged.creditsCharged,
        "admin_adjust",
        `refund: sms send failed (${message})`,
      ).catch((refundErr) => logger.error("SMS refund failed", { workspaceId, refundErr }));
    } else if (charged.chargedTo === "allowance") {
      const cur = await getSmsConnection(workspaceId);
      if (cur) {
        cur.usedThisMonth = Math.max(0, cur.usedThisMonth - segments);
        await saveSmsConnection(cur);
      }
    }
    await logSms({
      workspaceId,
      direction: "outbound",
      to: e164,
      from: conn.phoneNumber,
      body: resolvedBody,
      segments,
      creditsCharged: 0,
      status: "failed",
      error: message,
      broadcastId,
    });
    logger.error("SMS send failed", { workspaceId, error: message });
    throw new SmsSendError("internal", message);
  }
}
