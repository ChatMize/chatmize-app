import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
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
import {
  recordMessageHandled,
  recordClientEvent,
  logRevenue as logGamificationRevenue,
  getGamificationState,
  getReferralCode,
  applyReferral,
} from "./gamification";
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
  getPriorConnectedPageId,
  storePendingPages,
  selectWorkspacePage,
  resolvePageToken,
  ensureFreshPageToken,
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
  getIgToken,
  ensureFreshIgToken,
  markIgTokenInvalid,
} from "./instagramOAuth";
import {
  buildWhatsAppLoginUrl,
  isWhatsAppOAuthState,
  consumeWhatsAppOAuthState,
  exchangeWhatsAppCode,
  storePendingWhatsAppAccounts,
  getWhatsAppConnection,
  listPendingWhatsAppAccounts,
  selectWhatsAppNumber,
  whatsappAppReturnUrl,
} from "./whatsappOAuth";
import { META_INSTAGRAM_APP_SECRET } from "./secrets";
import { normalizeEntry } from "./handlers";
import {
  publishKbArticleHandler,
  unpublishKbArticleHandler,
  kbFeedbackHandler,
  PublishKbInput,
  KbFeedbackKind,
} from "./kb";
import { handleCloakerRequest, CloakerReq, CloakerRes } from "./cloaker";
import { isWaitlistRequest, handleWaitlistRequest } from "./waitlist";
import {
  overlayList,
  overlaySave,
  overlayDelete,
  overlaySetStatus,
  handleOverlayTrackRequest,
  OverlayTrackReq,
  OverlayTrackRes,
} from "./overlays";
import { handleContestAdminAction, handleContestPublicRequest } from "./contest.js";
import { handleMigrationAction } from "./migration";
import {
  resolvePersonalizationTags,
  getContactForRecipient,
  getContactForPhone,
} from "./personalization";
import {
  persistInboundMessage,
  parkGlobalDeadLetter,
  recordOutboundMessage,
  Channel,
} from "./store";
import {
  CHANNEL_SENDERS,
  sendInstagramMessage,
  sendInstagramDirectMessage,
} from "./send";
import { sendChannelMessageInternal, ChannelSendError } from "./channelSend";
import { sendSmsInternal, SmsSendError, smsPlanAllowance } from "./smsSend";
import { runSmsBroadcastInternal, SmsBroadcastError } from "./smsBroadcast";
import {
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TELNYX_API_KEY,
  TELNYX_PUBLIC_KEY,
  BANDWIDTH_ACCOUNT_ID,
  BANDWIDTH_API_TOKEN,
  BANDWIDTH_API_SECRET,
} from "./secrets";
import {
  normalizePhone,
  calculateSegments,
  classifyKeyword,
  complianceReply,
  provisionTwilioNumber,
  sendSmsViaProvider,
  providerOf,
  parseTelnyxWebhook,
  parseBandwidthWebhook,
  verifyTelnyxSignature,
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
  SMS_PROVIDERS,
  SmsConnection,
  SmsProvider,
  ParsedInboundSms,
} from "./sms";

/** All SMS provider secrets, for functions that may send via any provider. */
const SMS_SECRETS = [
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TELNYX_API_KEY,
  TELNYX_PUBLIC_KEY,
  BANDWIDTH_ACCOUNT_ID,
  BANDWIDTH_API_TOKEN,
  BANDWIDTH_API_SECRET,
];

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
 * `page` events, the IG business account id for `instagram` events, and the
 * phone number id (from the change metadata) for `whatsapp_business_account`
 * events. Matches only connections with status "connected".
 */
async function resolveWorkspaceByAccount(
  object: string,
  accountId: string,
  fallbackAccountId?: string,
): Promise<string | null> {
  if (!accountId) return null;
  const field =
    object === "instagram"
      ? "igUserId"
      : object === "page"
        ? "pageId"
        : object === "whatsapp_business_account"
          ? "phoneNumberId"
          : null;
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
  // WhatsApp: entry.id is the WABA id, which we also store on the doc, so a
  // phone-number-id miss falls back to the WABA id.
  if (object === "whatsapp_business_account" && fallbackAccountId && fallbackAccountId !== accountId) {
    const wabaSnap = await db()
      .collectionGroup("integrations")
      .where("wabaId", "==", fallbackAccountId)
      .limit(5)
      .get();
    for (const doc of wabaSnap.docs) {
      if ((doc.data() as { status?: string }).status === "connected") {
        return doc.ref.parent.parent?.id ?? null;
      }
    }
  }
  return null;
}

/**
 * For whatsapp_business_account events, entry.id is the WABA id; the phone
 * number that received the message lives in each change's metadata.
 */
function whatsAppPhoneNumberId(entry: Record<string, unknown>): string | null {
  const changes = (entry as { changes?: Array<{ value?: { metadata?: { phone_number_id?: unknown } } }> })
    .changes;
  for (const change of changes ?? []) {
    const id = change?.value?.metadata?.phone_number_id;
    if (typeof id === "string" && id.length > 0) return id;
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
  { region: REGION, secrets: [META_APP_SECRET, META_INSTAGRAM_APP_SECRET, META_VERIFY_TOKEN] },
  async (req, res) => {
    // 0. Contest engine public API (folded in: proxy blocks new function
    //    creation). Unauthenticated by design — the entry page and referral
    //    links hit POST /contest-api (hosting rewrite -> this function).
    //    Anti-fraud (dedupe, rate limits, velocity flags) runs inside.
    const reqPath = (req.path || "") as string;
    if (reqPath === "/contest-api" || reqPath.endsWith("/contest-api")) {
      await handleContestPublicRequest(
        req as unknown as Parameters<typeof handleContestPublicRequest>[0],
        res as unknown as Parameters<typeof handleContestPublicRequest>[1],
      );
      return;
    }

    // 0b. send.chat link cloaker: host-based routing takes precedence over
    //    the Meta webhook logic. Non-send.chat hosts fall through untouched.
    if (await handleCloakerRequest(req as unknown as CloakerReq, res as unknown as CloakerRes)) {
      return;
    }

    // 0b. Public waitlist capture: folded into this function because creating
    //     new Cloud Functions via the API is blocked through this VM's egress
    //     proxy. Routed on the ?wl= query param (or a /waitlist path prefix).
    if (isWaitlistRequest(req)) {
      await handleWaitlistRequest(
        req as unknown as Parameters<typeof handleWaitlistRequest>[0],
        res as unknown as Parameters<typeof handleWaitlistRequest>[1],
      );
      return;
    }

    // 0c. Website Overlays SDK tracking: POST /__overlay/track (batched
    //     impression/click/lead events from overlays.js). Folded in here
    //     because creating new functions fails through the egress proxy.
    if (
      await handleOverlayTrackRequest(req as unknown as OverlayTrackReq, res as unknown as OverlayTrackRes)
    ) {
      return;
    }

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

    // 2. Signature check: reject anything Meta did not sign. Events may be
    //    signed by either the main Meta app or the ChatMize-IG app (Instagram
    //    Login), so a signature valid against either secret is accepted.
    const rawBody: Buffer = (req as unknown as { rawBody?: Buffer }).rawBody ?? Buffer.from("");
    const signature = req.header("X-Hub-Signature-256");
    const signatureOk =
      verifyMetaSignature(rawBody, signature, META_APP_SECRET.value()) ||
      verifyMetaSignature(rawBody, signature, META_INSTAGRAM_APP_SECRET.value());
    if (!signatureOk) {
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
        const entryId = typeof entry.id === "string" ? entry.id : "";
        // WhatsApp events carry the WABA id in entry.id; route by the phone
        // number id in the change metadata (WABA id as fallback).
        const phoneNumberId =
          object === "whatsapp_business_account" ? whatsAppPhoneNumberId(entry) : null;
        const accountId = phoneNumberId ?? entryId;
        const workspaceId =
          overrideWorkspaceId ??
          (await resolveWorkspaceByAccount(object, accountId, entryId));
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
  /** Optional media attachment (bot builder video/audio/image). */
  mediaUrl?: string;
  mediaType?: "video" | "audio" | "image";
  /** Optional quick replies. Meta text-first rule: always sent with the text message, never the media. */
  quickReplies?: string[];
  /** Frontend's optimistic message id, echoed back as clientId on the
   * persisted doc so the UI can reconcile instead of duplicating. */
  clientMessageId?: string;
}
/**
 * Authenticated callable: send a message on Messenger, Instagram, or WhatsApp.
 * The caller must be a member of the workspace (or Super Admin). Tokens come
 * from Secret Manager; the client never sees them.
 */
export const sendChannelMessage = onCall(
  { region: REGION, secrets: [WHATSAPP_TOKEN_DEFAULT, WHATSAPP_PHONE_NUMBER_ID, META_PAGE_TOKEN_DEFAULT, META_APP_SECRET] },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError("unauthenticated", "Sign in required.");
    }
    const { workspaceId, channel, recipientId, text, mediaUrl, mediaType, quickReplies, clientMessageId } = (request.data ?? {}) as SendMessageData;
    if (!workspaceId || !channel || !recipientId) {
      throw new HttpsError("invalid-argument", "workspaceId, channel, and recipientId are required.");
    }
    if (!text && !mediaUrl) {
      throw new HttpsError("invalid-argument", "Provide message text, a media attachment, or both.");
    }
    if (mediaUrl && !["video", "audio", "image"].includes(mediaType ?? "")) {
      throw new HttpsError("invalid-argument", "mediaType must be video, audio, or image.");
    }
    if (quickReplies !== undefined && (!Array.isArray(quickReplies) || quickReplies.some((q) => typeof q !== "string"))) {
      throw new HttpsError("invalid-argument", "quickReplies must be an array of strings.");
    }

    // Membership check (Super Admin claim bypasses).
    await requireWorkspaceAccess(uid, workspaceId, request.auth?.token);

    // The shared send pipeline (channelSend.ts) also serves the MCP server.
    try {
      const sendResult = await sendChannelMessageInternal(
        workspaceId,
        channel,
        recipientId,
        text ?? "",
        clientMessageId ?? null,
        mediaUrl ? { url: mediaUrl, type: mediaType as "video" | "audio" | "image" } : null,
        quickReplies ?? null,
      );
      // Gamification: count the handled outbound message (fire-and-forget).
      recordMessageHandled(workspaceId, uid).catch((err) =>
        logger.error("Gamification record failed (outbound)", { workspaceId, err }),
      );
      return sendResult;
    } catch (err) {
      if (err instanceof ChannelSendError) {
        throw new HttpsError(err.code, err.message);
      }
      throw err;
    }
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
    // Gamification: count the handled message + touch the streak. Never
    // breaks the pipeline; badge evaluation rides on this write.
    recordMessageHandled(event.params.workspaceId).catch((err) =>
      logger.error("Gamification record failed (inbound)", {
        workspaceId: event.params.workspaceId,
        err,
      }),
    );
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
      if (
        reason !== "topup_purchase" &&
        reason !== "admin_adjust" &&
        reason !== "monthly_grant" &&
        reason !== "badge_reward" &&
        reason !== "referral_reward" &&
        reason !== "contest_reward"
      ) {
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
    provider: providerOf(conn),
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
  /** SMS provider. Defaults to twilio. For telnyx/bandwidth, phoneNumber is required. */
  provider?: string;
  /** E.164 number to connect (telnyx/bandwidth only; twilio auto-provisions). */
  phoneNumber?: string;
}

/**
 * Authenticated callable: provision the workspace's Twilio number.
 * One number per workspace; re-running returns the existing one.
 */
export const provisionSmsNumber = onCall(
  { region: REGION, secrets: SMS_SECRETS },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Sign in required.");
    const { workspaceId, areaCode, provider, phoneNumber } = (request.data ?? {}) as ProvisionSmsData;
    if (!workspaceId) throw new HttpsError("invalid-argument", "workspaceId is required.");
    await requireWorkspaceAccess(uid, workspaceId, request.auth?.token);

    const existing = await getSmsConnection(workspaceId);
    if (existing && existing.status === "active") {
      return { phoneNumber: existing.phoneNumber, alreadyProvisioned: true };
    }

    const chosen: SmsProvider = provider === "telnyx" || provider === "bandwidth" ? provider : "twilio";
    const allowance = await smsPlanAllowance(workspaceId);
    const projectId = process.env.GCLOUD_PROJECT ?? process.env.GCP_PROJECT ?? "";
    const webhookUrl = `https://us-west2-${projectId}.cloudfunctions.net/smsWebhook?workspace=${workspaceId}`;
    const now = new Date().toISOString();

    let conn: SmsConnection;
    if (chosen === "twilio") {
      const { phoneNumber: num, sid } = await provisionTwilioNumber(workspaceId, webhookUrl, areaCode);
      conn = {
        workspaceId,
        phoneNumber: num,
        provider: "twilio",
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
        usageMonth: now.slice(0, 7),
        createdAt: now,
        updatedAt: now,
      };
    } else {
      // Telnyx/Bandwidth: workspace connects their own number. They configure
      // the webhook URL in their provider dashboard (returned to the UI).
      const e164 = phoneNumber ? normalizePhone(phoneNumber) : null;
      if (!e164) {
        throw new HttpsError(
          "invalid-argument",
          `A valid phone number is required to connect ${chosen}.`,
        );
      }
      conn = {
        workspaceId,
        phoneNumber: e164,
        provider: chosen,
        status: "active",
        compliance: {
          tenDlc: "not_required",
          note: `Connected via ${chosen}. Carrier registration and compliance are managed in your ${chosen} account. Point your number's inbound webhook at the URL shown.`,
        },
        monthlyAllowance: allowance,
        usedThisMonth: 0,
        usageMonth: now.slice(0, 7),
        createdAt: now,
        updatedAt: now,
      };
    }
    await saveSmsConnection(conn);
    logger.info("SMS number provisioned for workspace", {
      workspaceId,
      phoneNumber: conn.phoneNumber,
      provider: chosen,
    });
    return { phoneNumber: conn.phoneNumber, alreadyProvisioned: false, webhookUrl, provider: chosen };
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
  { region: REGION, secrets: SMS_SECRETS },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Sign in required.");
    const { workspaceId, to, body, broadcastId } = (request.data ?? {}) as SendSmsData;
    if (!workspaceId || !to || !body) {
      throw new HttpsError("invalid-argument", "workspaceId, to, and body are required.");
    }
    await requireWorkspaceAccess(uid, workspaceId, request.auth?.token);
    // The shared SMS runner (smsSend.ts) also serves the MCP server.
    try {
      const smsResult = await sendSmsInternal(workspaceId, to, body, broadcastId);
      // Gamification: count the handled outbound message (fire-and-forget).
      recordMessageHandled(workspaceId, uid).catch((err) =>
        logger.error("Gamification record failed (sms)", { workspaceId, err }),
      );
      return smsResult;
    } catch (err) {
      if (err instanceof SmsSendError) {
        throw new HttpsError(err.code, err.message);
      }
      throw err;
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
/**
 * Authenticated callable: broadcast to opted-in numbers. Idempotent on a
 * client-generated key and resumable in chunks: progress is persisted after
 * every chunk, so a client retry (or a timeout) resumes where the run left
 * off instead of re-sending. Per-recipient opt-in is re-checked at send
 * time; returns a delivery report.
 */
export const sendSmsBroadcast = onCall(
  { region: REGION, secrets: SMS_SECRETS, timeoutSeconds: 540 },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Sign in required.");
    const { workspaceId, body, phones, idempotencyKey } = (request.data ?? {}) as SendSmsBroadcastData;
    if (!workspaceId || !body) {
      throw new HttpsError("invalid-argument", "workspaceId and body are required.");
    }
    await requireWorkspaceAccess(uid, workspaceId, request.auth?.token);
    // The shared broadcast runner (smsBroadcast.ts) also serves the MCP server.
    try {
      return await runSmsBroadcastInternal(workspaceId, body, phones, idempotencyKey);
    } catch (err) {
      if (err instanceof SmsBroadcastError) {
        throw new HttpsError(err.code, err.message);
      }
      throw err;
    }

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
 * Multi-provider inbound SMS webhook: replies land in the conversation thread;
 * STOP/START/HELP keywords are handled for TCPA compliance.
 *
 * Provider detection:
 * - Twilio: application/x-www-form-urlencoded body with MessageSid
 * - Telnyx: JSON body with data.event_type (verified via Ed25519 signature)
 * - Bandwidth: JSON body with type field
 *
 * Configure as the number's webhook URL:
 *   https://us-west2-<project>.cloudfunctions.net/smsWebhook?workspace=<workspaceId>
 */
export const smsWebhook = onRequest(
  { region: REGION, secrets: SMS_SECRETS },
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

    const contentType = String(req.headers["content-type"] ?? "");
    const isFormEncoded = contentType.includes("application/x-www-form-urlencoded");
    let parsed: ParsedInboundSms | null = null;
    let isTwilio = false;

    if (isFormEncoded || req.body?.MessageSid) {
      // ---- Twilio ----
      isTwilio = true;
      if (!verifyTwilioSignature(req as any)) {
        logger.warn("SMS webhook: invalid Twilio signature", { workspaceId });
        res.status(403).send("Forbidden");
        return;
      }
      const from = normalizePhone(String(req.body.From ?? ""));
      const to = String(req.body.To ?? "");
      const body = String(req.body.Body ?? "");
      const sid = String(req.body.MessageSid ?? "");
      if (from) {
        parsed = { from, to, body, externalId: sid || `in_${Date.now()}` };
      }
    } else {
      // ---- Telnyx / Bandwidth (JSON) ----
      const rawBody =
        typeof (req as any).rawBody === "string"
          ? (req as any).rawBody
          : JSON.stringify(req.body ?? {});
      const telnyxSig = req.headers["telnyx-signature-ed25519"];
      const telnyxTs = req.headers["telnyx-timestamp"];
      if (typeof telnyxSig === "string" && typeof telnyxTs === "string") {
        if (!verifyTelnyxSignature(rawBody, telnyxSig, telnyxTs)) {
          logger.warn("SMS webhook: invalid Telnyx signature", { workspaceId });
          res.status(403).send("Forbidden");
          return;
        }
        parsed = parseTelnyxWebhook(req.body);
      } else {
        // Bandwidth (no signature scheme; workspace-scoped URL + id dedup).
        // For production hardening, configure HTTP basic auth on the
        // Bandwidth webhook and check it here.
        parsed = parseTelnyxWebhook(req.body) ?? parseBandwidthWebhook(req.body);
      }
    }

    if (!parsed) {
      // Not a message event we handle (e.g. delivery receipts) — ack quietly.
      res.status(200).send(isTwilio ? "<Response/>" : "ok");
      return;
    }

    const { from, to, body, externalId } = parsed;

    try {
      // Throttle before doing any paid work: >20 inbound/hour from one
      // number is dropped, and compliance replies go out at most once
      // per number per 24h.
      const keyword = classifyKeyword(body);
      const throttle = await checkInboundThrottle(workspaceId, from, keyword);
      if (!throttle.allowed) {
        res.status(200).send(isTwilio ? "<Response/>" : "ok");
        return;
      }

      await persistInboundSms(workspaceId, from, to, body, externalId);
      await logSms({
        workspaceId, direction: "inbound", to: from, from: to, body,
        segments: calculateSegments(body), creditsCharged: 0, messageId: externalId, status: "received",
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
          await sendSmsViaProvider(providerOf(conn), conn.phoneNumber, from, complianceReply(keyword));
          await markComplianceReplySent(workspaceId, from);
        }
      }
    } catch (err) {
      logger.error("SMS webhook handling failed", {
        workspaceId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
    res.status(200).send(isTwilio ? "<Response/>" : "ok");
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
  // WhatsApp path: Facebook Login for Business on the main ChatMize app.
  if (provider === "whatsapp") {
    const url = await buildWhatsAppLoginUrl(workspaceId, uid, returnTo);
    logger.info("WhatsApp OAuth started", { workspaceId, uid });
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
    let isWa = false;
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
      // WhatsApp states live in their own collection.
      if (await isWhatsAppOAuthState(state)) {
        isWa = true;
        const consumed = await consumeWhatsAppOAuthState(state);
        returnTo = consumed.returnTo;
        const result = await exchangeWhatsAppCode(code);
        await storePendingWhatsAppAccounts(consumed.workspaceId, consumed.uid, result);
        logger.info("WhatsApp OAuth callback ok", {
          workspaceId: consumed.workspaceId,
          accountCount: result.accounts.length,
        });
        res.redirect(302, whatsappAppReturnUrl("success", undefined, returnTo));
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
      // Reconnect shortcut: if this workspace already had a page connected
      // and the fresh OAuth grant still includes it, reselect it
      // automatically so the owner isn't asked to pick the page twice.
      const priorPageId = await getPriorConnectedPageId(workspaceId);
      await storePendingPages(workspaceId, uid, result);
      if (priorPageId && result.pages.some((p) => p.id === priorPageId)) {
        await selectWorkspacePage(workspaceId, uid, priorPageId);
        logger.info("Meta OAuth reconnect auto-reselected prior page", {
          workspaceId,
          pageId: priorPageId,
        });
      } else {
        logger.info("Meta OAuth callback ok", {
          workspaceId,
          pageCount: result.pages.length,
          fbUser: result.user.name || result.user.id,
        });
      }
      res.redirect(302, appReturnUrl("success", undefined, returnTo));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Login failed.";
      logger.warn("Meta OAuth callback failed", { message });
      // isIg/isWa and returnTo were captured before the one-time state was
      // consumed, so the error still routes back to the right place afterwards.
      const url = isIg
        ? instagramAppReturnUrl("error", message, returnTo)
        : isWa
          ? whatsappAppReturnUrl("error", message, returnTo)
          : appReturnUrl("error", message, returnTo);
      res.redirect(302, url);
    }
  },
);

/** Connection status for the client (no tokens leave the server). */
export const metaOAuthStatus = onCall({ region: REGION }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in required.");
  const { workspaceId, action, phoneNumberId } = (request.data ?? {}) as {
    workspaceId?: string;
    action?: string;
    phoneNumberId?: string;
  };
  // SegMate migration importer (folded in: proxy blocks new function
  // creation). Super Admin only, not workspace-scoped — routed before the
  // workspaceId requirement. Logic lives in ./migration so it can split out.
  if (typeof action === "string" && action.startsWith("migration")) {
    return handleMigrationAction(action, (request.data ?? {}) as Record<string, unknown>, uid, request.auth?.token);
  }
  if (!workspaceId) throw new HttpsError("invalid-argument", "workspaceId is required.");
  await requireWorkspaceAccess(uid, workspaceId, request.auth?.token);
  // Contest engine admin actions (folded in: proxy blocks new function
  // creation). All contest mutations go through ./contest.js; reads happen
  // client-side via Firestore security rules.
  if (typeof action === "string" && action.startsWith("contest")) {
    return handleContestAdminAction(action, (request.data ?? {}) as Record<string, unknown>, uid);
  }
  // WhatsApp actions (folded in: proxy blocks new function creation)
  if (action === "listWhatsAppAccounts") {
    return listPendingWhatsAppAccounts(workspaceId);
  }
  if (action === "selectWhatsAppNumber") {
    if (!phoneNumberId) throw new HttpsError("invalid-argument", "phoneNumberId is required.");
    const result = await selectWhatsAppNumber(workspaceId, uid, phoneNumberId);
    logger.info("WhatsApp number connected", { workspaceId, phoneNumberId: result.phoneNumberId });
    return result;
  }
  // Website Overlays SDK actions (folded in: proxy blocks new function
  // creation; logic lives in ./overlays so it can split out later).
  if (action === "overlayList") {
    return overlayList(workspaceId);
  }
  if (action === "overlaySave") {
    return overlaySave(workspaceId, uid, (request.data as Record<string, unknown>).overlay);
  }
  if (action === "overlayDelete") {
    return overlayDelete(workspaceId, (request.data as Record<string, unknown>).overlayId);
  }
  if (action === "overlaySetStatus") {
    const data = request.data as Record<string, unknown>;
    return overlaySetStatus(workspaceId, data.overlayId, data.status);
  }
  // Gamification actions (folded in: proxy blocks new function creation)
  if (action === "gamificationGet") {
    return getGamificationState(workspaceId, uid);
  }
  if (action === "gamificationEvent") {
    const { event } = (request.data ?? {}) as { event?: string };
    if (event !== "flow_published" && event !== "broadcast_sent") {
      throw new HttpsError("invalid-argument", "event must be flow_published or broadcast_sent.");
    }
    const newBadges = await recordClientEvent(workspaceId, uid, event);
    return { ok: true, newBadges };
  }
  if (action === "logRevenue") {
    const { amountDollars, note, source } = (request.data ?? {}) as {
      amountDollars?: number;
      note?: string;
      source?: string;
    };
    if (!Number.isFinite(amountDollars) || (amountDollars as number) <= 0) {
      throw new HttpsError("invalid-argument", "A positive dollar amount is required.");
    }
    const result = await logGamificationRevenue(
      workspaceId,
      uid,
      Math.round((amountDollars as number) * 100),
      note ?? "",
      source === "flow_action" ? "flow_action" : "manual",
    );
    return { ok: true, ...result };
  }
  if (action === "getReferralCode") {
    return { code: await getReferralCode(uid) };
  }
  if (action === "applyReferral") {
    const { code } = (request.data ?? {}) as { code?: string };
    return applyReferral(uid, code ?? "", workspaceId);
  }
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
    /** The page token died (Meta error 190). Nothing auto-revives it; the
     * owner must reconnect. Surfaces as a "session expired" flag in Settings. */
    tokenInvalid: conn.status === "token_invalid",
    pageId: conn.pageId ?? null,
    pageName: conn.pageName ?? null,
    pagePictureUrl,
    instagram,
    // IG-only anchor (Instagram Login, no Facebook Page required).
    instagramOnly: await getInstagramConnection(workspaceId),
    // WhatsApp anchor (Facebook Login for Business, customer's own number).
    whatsappOnly: await getWhatsAppConnection(workspaceId),
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

// ---------------------------------------------------------------------------
// WhatsApp connection (customer's own number)
// ---------------------------------------------------------------------------

/** WhatsApp Business Accounts awaiting number selection (no tokens reach the client). */
export const whatsappOAuthListAccounts = onCall({ region: REGION }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in required.");
  const { workspaceId } = (request.data ?? {}) as { workspaceId?: string };
  if (!workspaceId) throw new HttpsError("invalid-argument", "workspaceId is required.");
  await requireWorkspaceAccess(uid, workspaceId, request.auth?.token);
  return listPendingWhatsAppAccounts(workspaceId);
});

/** Persist the chosen WhatsApp phone number for this workspace. */
export const whatsappOAuthSelectNumber = onCall({ region: REGION }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in required.");
  const { workspaceId, phoneNumberId } = (request.data ?? {}) as {
    workspaceId?: string;
    phoneNumberId?: string;
  };
  if (!workspaceId || !phoneNumberId) {
    throw new HttpsError("invalid-argument", "workspaceId and phoneNumberId are required.");
  }
  await requireWorkspaceAccess(uid, workspaceId, request.auth?.token);
  const result = await selectWhatsAppNumber(workspaceId, uid, phoneNumberId);
  logger.info("WhatsApp number connected", { workspaceId, phoneNumberId: result.phoneNumberId });
  return result;
});

/**
 * Phase 1 SES notification triggers (see notifications.ts): owner reconnect
 * emails on token invalidation, and human handoff emails.
 */
export { onIntegrationInvalidated, onHandoffCreated } from "./notifications";

// ---------------------------------------------------------------------------
// ChatMize MCP API server (v1, BETA) — "bring your own bots".
//
// Standard MCP over Streamable HTTP, authenticated with per-workspace API
// keys (one key per workspace, managed in the agency dashboard). Stateless
// transport: scales to zero between calls. OAuth-based auth is planned
// for a later version.
// ---------------------------------------------------------------------------
export const mcpApi = onRequest(
  {
    region: REGION,
    timeoutSeconds: 540,
    secrets: [
      WHATSAPP_TOKEN_DEFAULT,
      WHATSAPP_PHONE_NUMBER_ID,
      META_PAGE_TOKEN_DEFAULT,
      META_APP_SECRET,
      ...SMS_SECRETS,
    ],
  },
  async (req, res) => {
    const { handleMcpRequest } = await import("./mcp/handler.js");
    await handleMcpRequest(req, res);
  },
);

// ---------------------------------------------------------------------------
// Knowledge Base (Phase 1: Builder MVP)
// ---------------------------------------------------------------------------

/** Publish a KB draft: validates, snapshots a revision, marks published. */
export const publishKbArticle = onCall({ region: REGION }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "Sign in required.");
  }
  const { workspaceId, articleId, note } = (request.data ?? {}) as PublishKbInput;
  if (!workspaceId || !articleId) {
    throw new HttpsError("invalid-argument", "workspaceId and articleId are required.");
  }
  await requireWorkspaceAccess(uid, workspaceId, request.auth?.token);
  return publishKbArticleHandler(workspaceId, articleId, uid, note);
});

/** Send a published KB article back to draft. Revisions are kept as history. */
export const unpublishKbArticle = onCall({ region: REGION }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "Sign in required.");
  }
  const { workspaceId, articleId } = (request.data ?? {}) as PublishKbInput;
  if (!workspaceId || !articleId) {
    throw new HttpsError("invalid-argument", "workspaceId and articleId are required.");
  }
  await requireWorkspaceAccess(uid, workspaceId, request.auth?.token);
  return unpublishKbArticleHandler(workspaceId, articleId);
});

/** Record a KB article view or a helpful / not helpful vote. */
export const kbFeedback = onCall({ region: REGION }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "Sign in required.");
  }
  const { workspaceId, articleId, kind } = (request.data ?? {}) as {
    workspaceId: string;
    articleId: string;
    kind: KbFeedbackKind;
  };
  if (!workspaceId || !articleId || !kind) {
    throw new HttpsError("invalid-argument", "workspaceId, articleId, and kind are required.");
  }
  await requireWorkspaceAccess(uid, workspaceId, request.auth?.token);
  return kbFeedbackHandler(workspaceId, articleId, kind);
});
