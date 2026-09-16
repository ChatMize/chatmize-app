import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { onRequest, onCall, HttpsError } from "firebase-functions/v2/https";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions";
import {
  ALL_SECRETS,
  META_APP_SECRET,
  META_VERIFY_TOKEN,
  WHATSAPP_TOKEN_DEFAULT,
  WHATSAPP_PHONE_NUMBER_ID,
  pageTokenSecretFor,
} from "./secrets";
import { verifyMetaSignature, verifyHandshake } from "./verify";
import { normalizeEntry } from "./handlers";
import {
  persistInboundMessage,
  parkDeadLetter,
  recordOutboundMessage,
  Channel,
} from "./store";
import { CHANNEL_SENDERS } from "./send";

initializeApp();

const db = () => getFirestore();
const REGION = "us-west2";

/** Resolve and validate the workspace for an inbound webhook call. */
async function resolveWorkspace(workspaceId: unknown): Promise<string | null> {
  if (typeof workspaceId !== "string" || workspaceId.length === 0) return null;
  const snap = await db().collection("workspaces").doc(workspaceId).get();
  return snap.exists ? workspaceId : null;
}

/**
 * Meta webhook receiver: handles the verification handshake (GET) and
 * inbound Messenger / Instagram / WhatsApp events (POST).
 *
 * Configure in the Meta App Dashboard as:
 *   https://us-west2-<project>.cloudfunctions.net/metaWebhook?workspace=<workspaceId>
 */
export const metaWebhook = onRequest(
  { region: REGION, secrets: ALL_SECRETS },
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

    // 3. Route to the workspace carried on the callback URL.
    const workspaceId = await resolveWorkspace(req.query.workspace);
    if (!workspaceId) {
      logger.warn("Webhook rejected: unknown workspace", { query: req.query.workspace });
      res.sendStatus(400);
      return;
    }

    // 4. Normalize + persist. Always answer 200 fast so Meta does not retry
    //    storms; failures are parked in the dead-letter collection.
    try {
      const body = req.body as { object?: string; entry?: Array<Record<string, unknown>> };
      const object = body.object ?? "page";
      let received = 0;
      for (const entry of body.entry ?? []) {
        for (const msg of normalizeEntry(entry, object)) {
          await persistInboundMessage(workspaceId, msg);
          received += 1;
        }
      }
      logger.info("Webhook processed", { workspaceId, object, received });
      res.sendStatus(200);
    } catch (err) {
      logger.error("Webhook processing failed", { workspaceId, err });
      await parkDeadLetter(workspaceId, "processing_error", req.body).catch(() => {});
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
  { region: REGION, secrets: ALL_SECRETS },
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
    const isSuperAdmin = request.auth?.token?.superadmin === true;
    if (!isSuperAdmin) {
      const member = await db()
        .collection("workspaces")
        .doc(workspaceId)
        .collection("members")
        .doc(uid)
        .get();
      if (!member.exists) {
        throw new HttpsError("permission-denied", "Not a member of this workspace.");
      }
    }

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
      result = await sender(pageTokenSecretFor(workspaceId).value(), recipientId, text);
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
    document: "workspaces/{workspaceId}/conversations/{convoId}/messages/{messageId}",
  },
  async (event) => {
    const data = event.data?.data() as { direction?: string; text?: string; channel?: string } | undefined;
    if (!data || data.direction !== "inbound") return;
    logger.info("Inbound message ready for agent pipeline", {
      workspaceId: event.params.workspaceId,
      convoId: event.params.convoId,
      channel: data.channel,
      textLength: data.text?.length ?? 0,
    });
    // TODO(Phase 4): route through the AI agent with credit metering here.
  },
);
