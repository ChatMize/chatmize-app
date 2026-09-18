import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { createHmac, timingSafeEqual } from "crypto";
import { onRequest, onCall, HttpsError } from "firebase-functions/v2/https";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions";
import {
  getBalance,
  ensureCreditAccount,
  grantCredits,
  spendCredits,
  resetAllMonthlyCredits,
  CreditReason,
} from "./credits";
import { aiComplete, projectTestCost, AI_SECRETS, ModelTier, ChatMessage } from "./ai/router";
import {
  META_APP_SECRET,
  META_VERIFY_TOKEN,
  META_PAGE_TOKEN_DEFAULT,
  WHATSAPP_TOKEN_DEFAULT,
  WHATSAPP_PHONE_NUMBER_ID,
  pageTokenSecretFor,
} from "./secrets";
import { verifyMetaSignature, verifyHandshake } from "./verify";
import {
  buildLoginUrl,
  consumeOAuthState,
  exchangeCodeForPages,
  storePendingPages,
  selectWorkspacePage,
  resolvePageToken,
  getPageSocialProfile,
  appReturnUrl,
} from "./metaOAuth";
import {
  buildInstagramLoginUrl,
  consumeInstagramOAuthState,
  isInstagramOAuthState,
  exchangeInstagramCode,
  connectInstagramAccount,
  getInstagramConnection,
  instagramAppReturnUrl,
} from "./instagramOAuth";
import { META_INSTAGRAM_APP_SECRET } from "./secrets";
import { normalizeEntry } from "./handlers";
import {
  persistInboundMessage,
  parkGlobalDeadLetter,
  recordOutboundMessage,
  Channel,
} from "./store";
import { CHANNEL_SENDERS } from "./send";
import {
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
} from "./secrets";
import {
  normalizePhone,
  calculateSegments,
  classifyKeyword,
  complianceReply,
  provisionTwilioNumber,
  twilioSendSms,
  getSmsConnection,
  saveSmsConnection,
  ensureAllowanceMonth,
  getOptIn,
  setOptIn,
  countOptIns,
  logSms,
  chargeForSend,
  persistInboundSms,
  persistOutboundSms,
  checkInboundThrottle,
  markComplianceReplySent,
  SMS_CREDITS_PER_SEGMENT,
  SmsConnection,
} from "./sms";

initializeApp();

const db = () => getFirestore("chatmize-prod");
const REGION = "us-west2";

/** Resolve and validate the workspace for an inbound webhook call. */
async function resolveWorkspace(workspaceId: unknown): Promise<string | null> {
  if (typeof workspaceId !== "string" || workspaceId.length === 0) return null;
  const snap = await db().collection("workspaces").doc(workspaceId).get();
  return snap.exists ? workspaceId : null;
}

/**
 * Route a webhook entry to its workspace by the receiving Meta account id.
 * Meta allows exactly one callback URL per app, so with many workspaces the
 * event itself must say where it belongs: entry.id is the Page id for
 * `page` events and the IG business account id for `instagram` events.
 * Matches only connections with status "connected".
 */
async function resolveWorkspaceByAccount(
  object: string,
  accountId: string,
): Promise<string | null> {
  if (!accountId) return null;
  const field =
    object === "instagram" ? "igUserId" : object === "page" ? "pageId" : null;
  if (!field) return null;
  const snap = await db()
    .collectionGroup("integrations")
    .where(field, "==", accountId)
    .limit(5)
    .get();
  for (const doc of snap.docs) {
    if ((doc.data() as { status?: string }).status === "connected") {
      return doc.ref.parent.parent?.id ?? null;
    }
  }
  return null;
}

/**
 * Throw unless the caller may act on the workspace (member or Super Admin).
 *
 * First-use provisioning: no code path ever created member docs, so the
 * first signed-in caller to touch an existing workspace is granted
 * membership automatically (the very first member becomes owner).
 * A workspace id with no workspace doc is still rejected.
 */
async function requireWorkspaceAccess(
  uid: string,
  workspaceId: string,
  token: Record<string, unknown> | undefined,
): Promise<void> {
  if (token?.superadmin === true) return;
  const membersCol = db()
    .collection("workspaces")
    .doc(workspaceId)
    .collection("members");
  const member = await membersCol.doc(uid).get();
  if (member.exists) return;
  const ws = await db().collection("workspaces").doc(workspaceId).get();
  if (!ws.exists) {
    throw new HttpsError("permission-denied", "Not a member of this workspace.");
  }
  const first = await membersCol.limit(1).get();
  await membersCol.doc(uid).set({
    uid,
    role: first.empty ? "owner" : "member",
    createdAt: new Date().toISOString(),
  });
}

/**
 * Meta webhook receiver: handles the verification handshake (GET) and
 * inbound Messenger / Instagram / WhatsApp events (POST).
 *
 * Configure in the Meta App Dashboard as:
 *   https://us-west2-<project>.cloudfunctions.net/metaWebhook?workspace=<workspaceId>
 */
export const metaWebhook = onRequest(
  { region: REGION, secrets: [META_APP_SECRET, META_VERIFY_TOKEN] },
  async (req, res) => {
    // 1. Verification handshake
    if (req.method === "GET") {
      const { ok, challenge } = verifyHandshake(
        req.query["hub.mode"],
        req.query["hub.verify_token"],
        req.query["hub.challenge"],
        META_VERIFY_TOKEN.value(),
      );
      if (ok && challenge) {
        res.status(200).send(challenge);
      } else {
        logger.warn("Webhook verification failed");
        res.sendStatus(403);
      }
      return;
    }

    if (req.method !== "POST") {
      res.sendStatus(405);
      return;
    }

    // 2. Signature check: reject anything Meta did not sign.
    const rawBody: Buffer = (req as unknown as { rawBody?: Buffer }).rawBody ?? Buffer.from("");
    const signature = req.header("X-Hub-Signature-256");
    if (!verifyMetaSignature(rawBody, signature, META_APP_SECRET.value())) {
      logger.warn("Webhook rejected: invalid signature");
      res.sendStatus(401);
      return;
    }

    // 3. Route each entry to its workspace. Meta allows one callback URL
    //    per app, so the event's receiving account id decides — not the URL.
    //    ?workspace= remains as an explicit override (testing / WhatsApp).
    const overrideWorkspaceId = await resolveWorkspace(req.query.workspace);

    // 4. Normalize + persist. Always answer 200 fast so Meta does not retry
    //    storms; failures are parked in the dead-letter collection.
    try {
      const body = req.body as { object?: string; entry?: Array<Record<string, unknown>> };
      const object = body.object ?? "page";
      let received = 0;
      for (const entry of body.entry ?? []) {
        const accountId = typeof entry.id === "string" ? entry.id : "";
        const workspaceId =
          overrideWorkspaceId ?? (await resolveWorkspaceByAccount(object, accountId));
        if (!workspaceId) {
          logger.warn("Webhook entry unroutable: no workspace for account", {
            object,
            accountId,
          });
          await parkGlobalDeadLetter("unroutable_entry", {
            object,
            accountId,
            entry,
          }).catch(() => {});
          continue;
        }
        for (const msg of normalizeEntry(entry, object)) {
          await persistInboundMessage(workspaceId, msg);
          received += 1;
        }
      }
      logger.info("Webhook processed", { object, received });
      res.sendStatus(200);
    } catch (err) {
      logger.error("Webhook processing failed", { err });
      await parkGlobalDeadLetter("processing_error", req.body).catch(() => {});
      res.sendStatus(200); // still 200: the failure is recorded, not Meta's problem
    }
  },
);

interface SendMessageData {
  workspaceId?: string;
  channel?: Channel;
  recipientId?: string;
  text?: string;
}

/**
 * Authenticated callable: send a message on Messenger, Instagram, or WhatsApp.
 * The caller must be a member of the workspace (or Super Admin). Tokens come
 * from Secret Manager; the client never sees them.
 */
export const sendChannelMessage = onCall(
  { region: REGION, secrets: [WHATSAPP_TOKEN_DEFAULT, WHATSAPP_PHONE_NUMBER_ID, META_PAGE_TOKEN_DEFAULT] },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError("unauthenticated", "Sign in required.");
    }
    const { workspaceId, channel, recipientId, text } = (request.data ?? {}) as SendMessageData;
    if (!workspaceId || !channel || !recipientId || !text) {
      throw new HttpsError("invalid-argument", "workspaceId, channel, recipientId, and text are required.");
    }
    if (!["messenger", "instagram", "whatsapp"].includes(channel)) {
      throw new HttpsError("invalid-argument", `Unsupported channel: ${channel}`);
    }

    // Membership check (Super Admin claim bypasses).
    await requireWorkspaceAccess(uid, workspaceId, request.auth?.token);

    const sender = CHANNEL_SENDERS[channel];
    let result;
    if (channel === "whatsapp") {
      result = await sender(
        WHATSAPP_TOKEN_DEFAULT.value(),
        recipientId,
        text,
        WHATSAPP_PHONE_NUMBER_ID.value(),
      );
    } else {
      result = await sender(await resolvePageToken(workspaceId, META_PAGE_TOKEN_DEFAULT.value()), recipientId, text);
    }

    await recordOutboundMessage(
      workspaceId,
      channel,
      recipientId,
      text,
      result.metaMessageId,
      result.ok,
      result.error,
    );

    if (!result.ok) {
      logger.error("Outbound send failed", { workspaceId, channel, error: result.error });
      throw new HttpsError("internal", result.error ?? "Send failed.");
    }
    logger.info("Outbound send ok", { workspaceId, channel, metaMessageId: result.metaMessageId });
    return { ok: true, metaMessageId: result.metaMessageId };
  },
);

/**
 * Fires on every persisted inbound message. v1 records structured telemetry;
 * the AI agent auto-reply pipeline plugs in here (Phase 4: Copilot/agents).
 */
export const onInboundMessageCreated = onDocumentCreated(
  {
    region: REGION,
    database: "chatmize-prod",
    document: "workspaces/{workspaceId}/conversations/{convoId}/messages/{messageId}",
  },
  async (event) => {
    const data = event.data?.data() as
      | { direction?: string; via?: string; agentProcessed?: boolean; text?: string; channel?: string }
      | undefined;
    if (!data || data.direction !== "inbound") return;
    // Recursion guard for the Phase 4 agent pipeline: never process the
    // agent's own output. Agent replies must be written with direction
    // "outbound" (or via:"agent"), but if one ever lands here marked
    // inbound, skip it instead of triggering an infinite AI-spend loop.
    if (data.via === "agent" || data.agentProcessed === true) return;
    logger.info("Inbound message ready for agent pipeline", {
      workspaceId: event.params.workspaceId,
      convoId: event.params.convoId,
      channel: data.channel,
      textLength: data.text?.length ?? 0,
    });
    // TODO(Phase 4): route through the AI agent with credit metering here.
  },
);

// ---------------------------------------------------------------------------
// AI credits
// ---------------------------------------------------------------------------

/** Authenticated callable: read a workspace's credit balance + ledger-ready account. */
export const getCreditBalance = onCall(
  { region: REGION },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError("unauthenticated", "Sign in required.");
    }
    const { workspaceId } = (request.data ?? {}) as { workspaceId?: string };
    if (!workspaceId) {
      throw new HttpsError("invalid-argument", "workspaceId is required.");
    }
    await requireWorkspaceAccess(uid, workspaceId, request.auth?.token);
    return ensureCreditAccount(workspaceId);
  },
);

interface AdjustCreditsData {
  workspaceId?: string;
  /** Positive = grant, negative = deduct. */
  delta?: number;
  reason?: CreditReason;
  note?: string;
}

/**
 * One-time bootstrap: grants the Super Admin claim to the first caller.
 * After one account holds it, this permanently refuses. The claim unlocks
 * superadmin-gated rules (plans writes, system_settings writes) and the
 * superadmin bypass in the callables. Run once from the account that
 * should own the system, then it can never be claimed again.
 */
export const bootstrapSuperAdmin = onCall({ region: REGION }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in required.");
  const flagRef = db().collection("system_settings").doc("superadmin_bootstrap");
  const first = await db().runTransaction(async (tx) => {
    const snap = await tx.get(flagRef);
    if (snap.exists) return false;
    tx.set(flagRef, { superAdminUid: uid, claimedAt: new Date().toISOString() });
    return true;
  });
  if (!first) {
    throw new HttpsError("failed-precondition", "Super Admin has already been claimed.");
  }
  await getAuth().setCustomUserClaims(uid, { superadmin: true });
  logger.info("Super Admin bootstrapped", { uid });
  return { ok: true };
});

/**
 * Super Admin only: grant or deduct credits (top-ups, corrections).
 * Every adjustment is written to the immutable ledger.
 */
export const adjustCredits = onCall(
  { region: REGION },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError("unauthenticated", "Sign in required.");
    }
    if (request.auth?.token?.superadmin !== true) {
      throw new HttpsError("permission-denied", "Super Admin only.");
    }
    const { workspaceId, delta, reason, note } = (request.data ?? {}) as AdjustCreditsData;
    if (!workspaceId || !delta || delta === 0) {
      throw new HttpsError("invalid-argument", "workspaceId and a non-zero delta are required.");
    }
    if (delta > 0) {
      if (reason !== "topup_purchase" && reason !== "admin_adjust" && reason !== "monthly_grant") {
        throw new HttpsError("invalid-argument", "Invalid grant reason.");
      }
      return grantCredits(workspaceId, delta, reason, note);
    }
    return spendCredits(workspaceId, -delta, "admin_adjust", note ?? "super admin deduction");
  },
);

/** Monthly reset: every workspace balance returns to its plan allowance. */
export const resetMonthlyCredits = onSchedule(
  {
    region: REGION,
    schedule: "0 0 1 * *",
    timeZone: "America/Phoenix",
    timeoutSeconds: 540,
  },
  async () => {
    await resetAllMonthlyCredits();
  },
);

// ---------------------------------------------------------------------------
// SMS via Twilio (ChatMize-owned account; billed via allowance then credits)
// ---------------------------------------------------------------------------

/**
 * Resolve the workspace's SMS plan entitlement. Workspaces without an
 * assigned plan are grandfathered in (allowed, zero allowance, pay per
 * segment in credits). A plan without the `sms` feature is denied.
 */
async function smsPlanAllowance(workspaceId: string): Promise<number> {
  const ws = await db().collection("workspaces").doc(workspaceId).get();
  const planId = ws.data()?.planId as string | undefined;
  if (!planId) {
    logger.info("SMS: workspace has no plan; grandfathered with zero allowance", { workspaceId });
    return 0;
  }
  const plan = await db().collection("plans").doc(planId).get();
  const data = plan.data() as { features?: string[]; smsAllowanceMonthly?: number } | undefined;
  if (!data?.features?.includes("sms")) {
    throw new HttpsError("permission-denied", "Your plan does not include SMS.");
  }
  return data.smsAllowanceMonthly ?? 0;
}

/** Authenticated callable: real SMS connection state for the Settings UI. */
export const getSmsStatus = onCall({ region: REGION }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in required.");
  const { workspaceId } = (request.data ?? {}) as { workspaceId?: string };
  if (!workspaceId) throw new HttpsError("invalid-argument", "workspaceId is required.");
  await requireWorkspaceAccess(uid, workspaceId, request.auth?.token);
  const conn = await ensureAllowanceMonth(workspaceId);
  const optedIn = await countOptIns(workspaceId);
  if (!conn) {
    return { connected: false as const, optedIn };
  }
  return {
    connected: true as const,
    phoneNumber: conn.phoneNumber,
    status: conn.status,
    tenDlc: conn.compliance.tenDlc,
    complianceNote: conn.compliance.note,
    monthlyAllowance: conn.monthlyAllowance,
    usedThisMonth: conn.usedThisMonth,
    optedIn,
  };
});

interface ProvisionSmsData {
  workspaceId?: string;
  /** Optional NANP area code for a local long-code number. Omit for toll-free. */
  areaCode?: string;
}

/**
 * Authenticated callable: provision the workspace's Twilio number.
 * One number per workspace; re-running returns the existing one.
 */
export const provisionSmsNumber = onCall(
  { region: REGION, secrets: [TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN] },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Sign in required.");
    const { workspaceId, areaCode } = (request.data ?? {}) as ProvisionSmsData;
    if (!workspaceId) throw new HttpsError("invalid-argument", "workspaceId is required.");
    await requireWorkspaceAccess(uid, workspaceId, request.auth?.token);

    const existing = await getSmsConnection(workspaceId);
    if (existing && existing.status === "active") {
      return { phoneNumber: existing.phoneNumber, alreadyProvisioned: true };
    }

    const allowance = await smsPlanAllowance(workspaceId);
    const projectId = process.env.GCLOUD_PROJECT ?? process.env.GCP_PROJECT ?? "";
    const webhookUrl = `https://us-west2-${projectId}.cloudfunctions.net/smsWebhook?workspace=${workspaceId}`;
    const { phoneNumber, sid } = await provisionTwilioNumber(workspaceId, webhookUrl, areaCode);

    const conn: SmsConnection = {
      workspaceId,
      phoneNumber,
      twilioSid: sid,
      status: "active",
      compliance: areaCode
        ? {
            tenDlc: "pending",
            note: "Number active. 10DLC brand/campaign registration is completed by the ChatMize team before high-volume sending.",
          }
        : {
            tenDlc: "not_required",
            note: "Toll-free number: no 10DLC registration required. Toll-free verification is handled by the ChatMize team.",
          },
      monthlyAllowance: allowance,
      usedThisMonth: 0,
      usageMonth: new Date().toISOString().slice(0, 7),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await saveSmsConnection(conn);
    logger.info("SMS number provisioned for workspace", { workspaceId, phoneNumber });
    return { phoneNumber, alreadyProvisioned: false };
  },
);

interface SetSmsOptInData {
  workspaceId?: string;
  phone?: string;
  optedIn?: boolean;
  source?: string;
}

/** Authenticated callable: record a contact's SMS opt-in/out (phone capture in flows). */
export const setSmsOptIn = onCall({ region: REGION }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in required.");
  const { workspaceId, phone, optedIn, source } = (request.data ?? {}) as SetSmsOptInData;
  if (!workspaceId || !phone || typeof optedIn !== "boolean") {
    throw new HttpsError("invalid-argument", "workspaceId, phone, and optedIn are required.");
  }
  await requireWorkspaceAccess(uid, workspaceId, request.auth?.token);
  const e164 = normalizePhone(phone);
  if (!e164) throw new HttpsError("invalid-argument", "That phone number is not valid.");
  await setOptIn(workspaceId, e164, optedIn, source ?? "manual");
  return { ok: true, phone: e164, optedIn };
});

interface SendSmsData {
  workspaceId?: string;
  to?: string;
  body?: string;
  broadcastId?: string;
}

/**
 * Authenticated callable: send one SMS. Requires an active number, an
 * opted-in recipient, and either allowance or credits to cover the segments.
 */
export const sendSms = onCall(
  { region: REGION, secrets: [TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN] },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Sign in required.");
    const { workspaceId, to, body, broadcastId } = (request.data ?? {}) as SendSmsData;
    if (!workspaceId || !to || !body) {
      throw new HttpsError("invalid-argument", "workspaceId, to, and body are required.");
    }
    if (body.length > 1600) {
      throw new HttpsError("invalid-argument", "Message is too long (max 1600 characters).");
    }
    await requireWorkspaceAccess(uid, workspaceId, request.auth?.token);
    await smsPlanAllowance(workspaceId);

    const conn = await ensureAllowanceMonth(workspaceId);
    if (!conn || conn.status !== "active") {
      throw new HttpsError("failed-precondition", "SMS is not enabled for this workspace yet.");
    }
    const e164 = normalizePhone(to);
    if (!e164) throw new HttpsError("invalid-argument", "That recipient number is not valid.");
    const optIn = await getOptIn(workspaceId, e164);
    if (!optIn?.optedIn) {
      throw new HttpsError(
        "failed-precondition",
        "This contact has not opted in to SMS. Collect consent before sending.",
      );
    }

    const segments = calculateSegments(body);
    let charged: { chargedTo: "allowance" | "credits"; creditsCharged: number } =
      { chargedTo: "allowance", creditsCharged: 0 };
    try {
      charged = await chargeForSend(workspaceId, segments, broadcastId ? `sms broadcast ${broadcastId}` : "sms send");
    } catch (err) {
      throw new HttpsError(
        "resource-exhausted",
        "SMS allowance and credits are exhausted. Top up credits to keep sending.",
      );
    }

    try {
      const twilioSid = await twilioSendSms(conn.phoneNumber, e164, body);
      await persistOutboundSms(workspaceId, conn.phoneNumber, e164, body, twilioSid);
      await logSms({
        workspaceId,
        direction: "outbound",
        to: e164,
        from: conn.phoneNumber,
        body,
        segments,
        creditsCharged: charged.creditsCharged,
        twilioSid,
        status: "sent",
        broadcastId,
      });
      return { ok: true, twilioSid, segments, chargedTo: charged.chargedTo };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Twilio send failed.";
      // Compensating refund: the workspace was charged before Twilio sent,
      // and Twilio never billed for this message, so give the charge back.
      if (charged.chargedTo === "credits" && charged.creditsCharged > 0) {
        await grantCredits(
          workspaceId,
          charged.creditsCharged,
          "admin_adjust",
          `refund: twilio send failed (${message})`,
        ).catch((refundErr) =>
          logger.error("SMS refund failed", { workspaceId, refundErr }),
        );
      } else if (charged.chargedTo === "allowance") {
        const conn = await getSmsConnection(workspaceId);
        if (conn) {
          conn.usedThisMonth = Math.max(0, conn.usedThisMonth - segments);
          await saveSmsConnection(conn);
        }
      }
      await logSms({
        workspaceId,
        direction: "outbound",
        to: e164,
        from: conn.phoneNumber,
        body,
        segments,
        creditsCharged: 0,
        status: "failed",
        error: message,
        broadcastId,
      });
      logger.error("SMS send failed", { workspaceId, error: message });
      throw new HttpsError("internal", message);
    }
  },
);

interface SendSmsBroadcastData {
  workspaceId?: string;
  body?: string;
  /** Explicit recipients. When omitted, broadcasts to every opted-in number. */
  phones?: string[];
  /**
   * Client-generated idempotency key. Retries with the same key resume (or
   * return the completed result) instead of re-sending the broadcast.
   */
  idempotencyKey?: string;
}

/**
 * Authenticated callable: broadcast to opted-in numbers. Idempotent on a
 * client-generated key and resumable in chunks: progress is persisted after
 * every chunk, so a client retry (or a timeout) resumes where the run left
 * off instead of re-sending. Per-recipient opt-in is re-checked at send
 * time; returns a delivery report.
 */
/** Max recipients per broadcast run: sized so sequential sends fit the 540s timeout. */
const BROADCAST_MAX_RECIPIENTS = 500;
/** Progress is persisted to the broadcast doc after each chunk (resumable). */
const BROADCAST_CHUNK_SIZE = 50;

interface BroadcastState {
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

export const sendSmsBroadcast = onCall(
  { region: REGION, secrets: [TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN], timeoutSeconds: 540 },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Sign in required.");
    const { workspaceId, body, phones, idempotencyKey } = (request.data ?? {}) as SendSmsBroadcastData;
    if (!workspaceId || !body) {
      throw new HttpsError("invalid-argument", "workspaceId and body are required.");
    }
    if (body.length > 1600) {
      throw new HttpsError("invalid-argument", "Message is too long (max 1600 characters).");
    }
    await requireWorkspaceAccess(uid, workspaceId, request.auth?.token);
    await smsPlanAllowance(workspaceId);

    const conn = await ensureAllowanceMonth(workspaceId);
    if (!conn || conn.status !== "active") {
      throw new HttpsError("failed-precondition", "SMS is not enabled for this workspace yet.");
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
        throw new HttpsError("invalid-argument", "This idempotency key is already in use.");
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
        recipients = snap.docs.map((d) => (d.data() as { phone: string }).phone);
      }
      if (recipients.length === 0) {
        throw new HttpsError("failed-precondition", "No opted-in recipients to send to.");
      }
      if (recipients.length > BROADCAST_MAX_RECIPIENTS) {
        throw new HttpsError(
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
          throw new HttpsError("invalid-argument", "This idempotency key is already in use.");
        }
        logger.info("SMS broadcast lost create race; resuming", { workspaceId, broadcastId });
      }
    }

    const segments = calculateSegments(body);
    let stoppedEarly = state.stoppedEarly;

    for (let i = state.processed; i < state.recipients.length; i += BROADCAST_CHUNK_SIZE) {
      const chunk = state.recipients.slice(i, i + BROADCAST_CHUNK_SIZE);
      for (const to of chunk) {
        const optIn = await getOptIn(workspaceId, to);
        if (!optIn?.optedIn) {
          state.skipped += 1;
          continue;
        }
        try {
          const charged = await chargeForSend(workspaceId, segments, `sms broadcast ${broadcastId}`);
          const twilioSid = await twilioSendSms(conn.phoneNumber, to, body);
          state.creditsCharged += charged.creditsCharged;
          state.sent += 1;
          await persistOutboundSms(workspaceId, conn.phoneNumber, to, body, twilioSid);
          await logSms({
            workspaceId, direction: "outbound", to, from: conn.phoneNumber, body,
            segments, creditsCharged: charged.creditsCharged, twilioSid, status: "sent", broadcastId,
          });
        } catch (err) {
          state.failed += 1;
          const message = err instanceof Error ? err.message : "send failed";
          if (state.errors.length < 5) state.errors.push(`${to}: ${message}`);
          await logSms({
            workspaceId, direction: "outbound", to, from: conn.phoneNumber, body,
            segments, creditsCharged: 0, status: "failed", error: message, broadcastId,
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
    logger.info("SMS broadcast finished", {
      workspaceId, broadcastId,
      sent: state.sent, failed: state.failed, skipped: state.skipped, complete,
    });
    return {
      ok: true, broadcastId, complete,
      sent: state.sent, failed: state.failed, skipped: state.skipped,
      creditsCharged: state.creditsCharged, errors: state.errors,
    };
  },
);

/** Verify the X-Twilio-Signature header for an inbound webhook request. */
function verifyTwilioSignature(req: {
  headers: Record<string, string | string[] | undefined>;
  originalUrl: string;
  body: Record<string, string>;
}): boolean {
  const signature = req.headers["x-twilio-signature"];
  if (typeof signature !== "string") return false;
  const proto = (req.headers["x-forwarded-proto"] as string) || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const url = `${proto}://${host}${req.originalUrl}`;
  const authToken = TWILIO_AUTH_TOKEN.value();
  const data =
    url +
    Object.keys(req.body)
      .sort()
      .map((k) => k + req.body[k])
      .join("");
  const expected = createHmac("sha1", authToken).update(data, "utf8").digest("base64");
  if (expected.length !== signature.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

/**
 * Twilio inbound webhook: replies land in the conversation thread;
 * STOP/START/HELP keywords are handled for TCPA compliance.
 *
 * Configure as the number's SmsUrl:
 *   https://us-west2-<project>.cloudfunctions.net/smsWebhook?workspace=<workspaceId>
 */
export const smsWebhook = onRequest(
  { region: REGION, secrets: [TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN] },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).send("Method not allowed");
      return;
    }
    const workspaceId = req.query.workspace as string | undefined;
    if (!workspaceId || !(await resolveWorkspace(workspaceId))) {
      res.status(400).send("Unknown workspace");
      return;
    }
    if (!verifyTwilioSignature(req as any)) {
      logger.warn("SMS webhook: invalid Twilio signature", { workspaceId });
      res.status(403).send("Forbidden");
      return;
    }

    const from = normalizePhone(String(req.body.From ?? ""));
    const to = String(req.body.To ?? "");
    const body = String(req.body.Body ?? "");
    const twilioSid = String(req.body.MessageSid ?? "");
    if (!from) {
      res.status(200).send("<Response/>");
      return;
    }

    try {
      // Throttle before doing any paid work: >20 inbound/hour from one
      // number is dropped, and compliance replies go out at most once
      // per number per 24h.
      const keyword = classifyKeyword(body);
      const throttle = await checkInboundThrottle(workspaceId, from, keyword);
      if (!throttle.allowed) {
        res.status(200).set("Content-Type", "text/xml").send("<Response/>");
        return;
      }

      await persistInboundSms(workspaceId, from, to, body, twilioSid || `in_${Date.now()}`);
      await logSms({
        workspaceId, direction: "inbound", to: from, from: to, body,
        segments: calculateSegments(body), creditsCharged: 0, twilioSid, status: "received",
      });

      if (keyword) {
        const conn = await getSmsConnection(workspaceId);
        if (keyword === "opt_out") {
          await setOptIn(workspaceId, from, false, "keyword_stop");
        } else if (keyword === "opt_in") {
          await setOptIn(workspaceId, from, true, "keyword_start");
        }
        if (conn && throttle.complianceDue) {
          // Compliance replies are carrier-required and free to the workspace.
          await twilioSendSms(conn.phoneNumber, from, complianceReply(keyword));
          await markComplianceReplySent(workspaceId, from);
        }
      }
    } catch (err) {
      logger.error("SMS webhook handling failed", {
        workspaceId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
    res.status(200).set("Content-Type", "text/xml").send("<Response/>");
  },
);

// ---------------------------------------------------------------------------
// AI router
// ---------------------------------------------------------------------------

interface TestRouterData {
  tier?: ModelTier;
  prompt?: string;
}

/** Max router tests per admin per day: each test is real provider spend. */
const ROUTER_TESTS_PER_DAY = 10;

async function checkRouterTestQuota(uid: string): Promise<void> {
  const day = new Date().toISOString().slice(0, 10);
  const ref = db().collection("ai_router_tests").doc(`${uid}_${day}`);
  await db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const count = (snap.data() as { count?: number } | undefined)?.count ?? 0;
    if (count >= ROUTER_TESTS_PER_DAY) {
      throw new HttpsError(
        "resource-exhausted",
        `Router test quota exceeded (${ROUTER_TESTS_PER_DAY} per day).`,
      );
    }
    tx.set(ref, { uid, day, count: count + 1, updatedAt: new Date().toISOString() });
  });
}

/**
 * Super Admin only: verify provider keys and routing with a dry-run
 * completion. No credits are spent, but the dry run still makes a REAL
 * paid provider call, so the response leads with a projected cost estimate
 * and tests are capped per admin per day.
 */
export const testAiRouter = onCall(
  { region: REGION, secrets: AI_SECRETS },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid || request.auth?.token?.superadmin !== true) {
      throw new HttpsError("permission-denied", "Super Admin only.");
    }
    const { tier, prompt } = (request.data ?? {}) as TestRouterData;
    if (tier !== "fast" && tier !== "balanced" && tier !== "smart") {
      throw new HttpsError("invalid-argument", "tier must be fast, balanced, or smart.");
    }
    if (!prompt || prompt.trim().length === 0) {
      throw new HttpsError("invalid-argument", "prompt is required.");
    }
    const estimate = projectTestCost(tier, prompt, 128);
    await checkRouterTestQuota(uid);
    const messages: ChatMessage[] = [
      { role: "system", content: "Reply in one short sentence." },
      { role: "user", content: prompt },
    ];
    const result = await aiComplete({
      workspaceId: "dry_run",
      tier,
      messages,
      reason: "ai_reply",
      maxOutputTokens: 128,
      note: "super admin router test",
      dryRun: true,
    });
    return { estimate, result };
  },
);

// ---------------------------------------------------------------------------
// Facebook Login for Business (workspace Meta connections)
// ---------------------------------------------------------------------------

/** Step 1: return the Facebook Login URL for this workspace (authed). */
export const metaOAuthStart = onCall({ region: REGION }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in required.");
  const { workspaceId, returnTo, provider } = (request.data ?? {}) as {
    workspaceId?: string;
    returnTo?: string;
    provider?: string;
  };
  if (!workspaceId) throw new HttpsError("invalid-argument", "workspaceId is required.");
  await requireWorkspaceAccess(uid, workspaceId, request.auth?.token);
  // IG-only path: Instagram Login via the ChatMize-IG app (no Facebook Page needed).
  if (provider === "instagram") {
    const url = await buildInstagramLoginUrl(workspaceId, uid, returnTo);
    logger.info("Instagram OAuth started", { workspaceId, uid });
    return { url };
  }
  const url = await buildLoginUrl(workspaceId, uid, returnTo);
  logger.info("Meta OAuth started", { workspaceId, uid });
  return { url };
});

/** Step 2: Meta redirects here with ?code&state. Public; state is single-use. */
export const metaOAuthCallback = onRequest(
  { region: REGION, secrets: [META_APP_SECRET, META_INSTAGRAM_APP_SECRET] },
  async (req, res) => {
    const code = req.query["code"];
    const state = req.query["state"];
    // Capture routing info before the one-time state is consumed, so the
    // error path below can still route back to the right place afterwards.
    let isIg = false;
    let returnTo: string | undefined;
    try {
      if (typeof code !== "string" || typeof state !== "string") {
        throw new Error("Missing code or state.");
      }
      // Route by state: Instagram Login states live in their own collection.
      if (await isInstagramOAuthState(state)) {
        isIg = true;
        const consumed = await consumeInstagramOAuthState(state);
        returnTo = consumed.returnTo;
        const profile = await exchangeInstagramCode(code);
        await connectInstagramAccount(consumed.workspaceId, consumed.uid, profile);
        logger.info("Instagram OAuth callback ok", {
          workspaceId: consumed.workspaceId,
          igUserId: profile.id,
          username: profile.username,
        });
        res.redirect(302, instagramAppReturnUrl("success", undefined, returnTo));
        return;
      }
      const fb = await consumeOAuthState(state);
      const workspaceId = fb.workspaceId;
      const uid = fb.uid;
      returnTo = fb.returnTo;
      const result = await exchangeCodeForPages(code);
      if (result.pages.length === 0) {
        throw new Error("No Facebook Pages found on this account.");
      }
      await storePendingPages(workspaceId, uid, result);
      logger.info("Meta OAuth callback ok", {
        workspaceId,
        pageCount: result.pages.length,
        fbUser: result.user.name || result.user.id,
      });
      res.redirect(302, appReturnUrl("success", undefined, returnTo));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Login failed.";
      logger.warn("Meta OAuth callback failed", { message });
      // isIg and returnTo were captured before the one-time state was
      // consumed, so the error still routes back to the right place.
      const url = isIg
        ? instagramAppReturnUrl("error", message, returnTo)
        : appReturnUrl("error", message, returnTo);
      res.redirect(302, url);
    }
  },
);

/** Connection status for the client (no tokens leave the server). */
export const metaOAuthStatus = onCall({ region: REGION }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in required.");
  const { workspaceId } = (request.data ?? {}) as { workspaceId?: string };
  if (!workspaceId) throw new HttpsError("invalid-argument", "workspaceId is required.");
  await requireWorkspaceAccess(uid, workspaceId, request.auth?.token);
  const snap = await db()
    .collection("workspaces")
    .doc(workspaceId)
    .collection("integrations")
    .doc("meta")
    .get();
  const conn = (snap.data() ?? {}) as {
    status?: string;
    pageId?: string;
    pageName?: string;
    pagePictureUrl?: string | null;
    instagram?: { id: string; username: string; pictureUrl: string | null } | null;
  };
  let instagram: { id: string; username: string; pictureUrl: string | null } | null =
    conn.instagram ?? null;
  let pagePictureUrl: string | null = conn.pagePictureUrl ?? null;
  if (
    conn.status === "connected" &&
    conn.pageId &&
    (conn.instagram === undefined || conn.pagePictureUrl == null)
  ) {
    // Backfill for pages connected before social-profile detection shipped,
    // or where the picture lookup failed at connect time (a null picture is
    // retried; a page with genuinely no picture just resolves null again).
    const token = await resolvePageToken(workspaceId, "");
    if (token) {
      const social = await getPageSocialProfile(conn.pageId, token);
      instagram = social.instagram;
      pagePictureUrl = social.pictureUrl;
      await snap.ref.set({ instagram, pagePictureUrl }, { merge: true });
    }
  }
  return {
    connected: conn.status === "connected",
    pending: conn.status === "pending",
    pageId: conn.pageId ?? null,
    pageName: conn.pageName ?? null,
    pagePictureUrl,
    instagram,
    // IG-only anchor (Instagram Login, no Facebook Page required).
    instagramOnly: await getInstagramConnection(workspaceId),
  };
});

/** Pages awaiting selection (id + name only; tokens never reach the client). */
export const metaOAuthListPages = onCall({ region: REGION }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in required.");
  const { workspaceId } = (request.data ?? {}) as { workspaceId?: string };
  if (!workspaceId) throw new HttpsError("invalid-argument", "workspaceId is required.");
  await requireWorkspaceAccess(uid, workspaceId, request.auth?.token);
  const snap = await db()
    .collection("workspaces")
    .doc(workspaceId)
    .collection("integrations")
    .doc("meta")
    .get();
  const conn = (snap.data() ?? {}) as {
    status?: string;
    pages?: Array<{ id: string; name: string }>;
    oauthUser?: { id: string; name: string };
    pendingExpiresAtMs?: number;
  };
  if (conn.status !== "pending" || !conn.pages || (conn.pendingExpiresAtMs ?? 0) < Date.now()) {
    return { pages: [] };
  }
  return {
    pages: conn.pages.map((p) => ({ id: p.id, name: p.name })),
    connectedAs: conn.oauthUser?.name || conn.oauthUser?.id || undefined,
  };
});

/** Step 4: store the chosen page token as the workspace's own secret. */
export const metaOAuthSelectPage = onCall({ region: REGION }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in required.");
  const { workspaceId, pageId } = (request.data ?? {}) as {
    workspaceId?: string;
    pageId?: string;
  };
  if (!workspaceId || !pageId) {
    throw new HttpsError("invalid-argument", "workspaceId and pageId are required.");
  }
  await requireWorkspaceAccess(uid, workspaceId, request.auth?.token);
  const result = await selectWorkspacePage(workspaceId, uid, pageId);
  logger.info("Meta page connected", { workspaceId, pageId: result.pageId });
  return result;
});
