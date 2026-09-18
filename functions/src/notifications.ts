/**
 * ChatMize notification service (Phase 1): transactional email via AWS SES.
 *
 * Two event driven emails, both sent from support@chatmize.com on the shared
 * chatmize.com domain (domain is DKIM verified in SES, so any @chatmize.com
 * sender is accepted):
 *   1. Reconnect needed: when a channel integration flips to token_invalid,
 *      the workspace owner gets one email with a direct reconnect link.
 *   2. Human handoff: when a handoff doc is written to
 *      workspaces/{ws}/handoffs/{id}, the assignee (or owner) gets one email
 *      with a direct conversation link.
 *
 * Serverless and cheap by design: Firestore triggers do the work, SES costs
 * $0.10 per 1,000 emails, and sends are deduped plus suppression checked so
 * nobody ever gets spammed.
 *
 * Handoff doc contract (written by the app or a future agent pipeline):
 *   workspaces/{workspaceId}/handoffs/{handoffId} = {
 *     conversationId: string,   // required
 *     assigneeUid?: string,      // Firebase Auth uid; email looked up
 *     assigneeEmail?: string,    // used directly when present
 *     reason?: string,           // plain English, shown in the email
 *     requestedAt?: Timestamp
 *   }
 *
 * IMPORTANT: the onHandoffCreated trigger resource below is NOT deployed
 * (this VM's egress proxy blocks new function creation). Every writer of a
 * handoff doc must call handleHandoffCreated(workspaceId, handoffId, data)
 * right after creating the doc. Dedupe keeps both mechanisms from ever
 * double sending if the trigger is ever registered.
 */
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { onDocumentWritten, onDocumentCreated } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions";
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import { createHash } from "crypto";

const PROJECT_ID = "gen-lang-client-0433776094";
const REGION = "us-west2";
const SES_REGION = "us-west-2";
const SES_SECRET_NAME = "SES_SENDER_CREDENTIALS";
const FROM_ADDRESS = "support@chatmize.com";
const APP_BASE = "https://app.chatmize.com";
const RECONNECT_COOLDOWN_MS = 24 * 3600 * 1000;

const db = () => getFirestore("chatmize-prod");

/** Read the latest version of a Secret Manager secret. Null on any failure. */
async function readSecretPayload(secretName: string): Promise<string | null> {
  try {
    const { GoogleAuth } = await import("google-auth-library");
    const auth = new GoogleAuth({
      scopes: ["https://www.googleapis.com/auth/cloud-platform"],
    });
    const client = await auth.getClient();
    const gtoken = await client.getAccessToken();
    const res = await fetch(
      `https://secretmanager.googleapis.com/v1/projects/${PROJECT_ID}/secrets/${secretName}/versions/latest:access`,
      { headers: { Authorization: `Bearer ${gtoken.token}` } },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { payload?: { data?: string } };
    const payload = data.payload?.data;
    if (!payload) return null;
    return Buffer.from(payload, "base64").toString("utf8");
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// SES client (lazy, module scoped)
// ---------------------------------------------------------------------------

let sesClient: SESv2Client | null = null;

async function getSesClient(): Promise<SESv2Client | null> {
  if (sesClient) return sesClient;
  const payload = await readSecretPayload(SES_SECRET_NAME);
  if (!payload) {
    logger.error("SES credentials secret unreadable; skipping email send");
    return null;
  }
  let creds: { accessKeyId?: string; secretAccessKey?: string };
  try {
    creds = JSON.parse(payload) as typeof creds;
  } catch {
    logger.error("SES credentials secret is not valid JSON");
    return null;
  }
  if (!creds.accessKeyId || !creds.secretAccessKey) {
    logger.error("SES credentials secret is missing fields");
    return null;
  }
  sesClient = new SESv2Client({
    region: SES_REGION,
    credentials: {
      accessKeyId: creds.accessKeyId,
      secretAccessKey: creds.secretAccessKey,
    },
    // The tightly scoped IAM user can only call SendEmail/SendRawEmail, so
    // skip the SDK's default credential chain entirely.
  });
  return sesClient;
}

// ---------------------------------------------------------------------------
// Suppression list (app level; SES account level suppression stays on too)
// ---------------------------------------------------------------------------

function hashEmail(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}

/** True when this address asked out, hard bounced, or complained. */
export async function isEmailSuppressed(workspaceId: string, email: string): Promise<boolean> {
  const snap = await db()
    .collection("workspaces")
    .doc(workspaceId)
    .collection("emailSuppressions")
    .doc(hashEmail(email))
    .get();
  return snap.exists;
}

/** Record a suppression (unsubscribed, bounced, complained). */
export async function recordEmailSuppression(
  workspaceId: string,
  email: string,
  reason: "unsubscribed" | "bounced" | "complained",
): Promise<void> {
  await db()
    .collection("workspaces")
    .doc(workspaceId)
    .collection("emailSuppressions")
    .doc(hashEmail(email))
    .set(
      {
        reason,
        suppressedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
}

// ---------------------------------------------------------------------------
// Dedupe (idempotency keys with a cooldown)
// ---------------------------------------------------------------------------

/**
 * Atomically claim a send slot. Returns true when this caller owns the send.
 * A slot claimed longer ago than cooldownMs is claimable again, so a real
 * state change (new tokenInvalidAt, new handoff) always gets a fresh key.
 */
async function claimSendSlot(
  workspaceId: string,
  key: string,
  cooldownMs: number,
  meta: Record<string, unknown>,
): Promise<boolean> {
  const ref = db().collection("workspaces").doc(workspaceId).collection("notificationSends").doc(key);
  return db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists) {
      const sentAtMs = (snap.data()?.sentAtMs as number | undefined) ?? 0;
      if (Date.now() - sentAtMs < cooldownMs) return false;
    }
    tx.set(ref, { ...meta, sentAtMs: Date.now() }, { merge: true });
    return true;
  });
}

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

async function logEmailSend(entry: {
  workspaceId: string;
  type: string;
  to: string;
  subject: string;
  dedupeKey: string;
  ok: boolean;
  messageId?: string;
  error?: string;
  skipped?: string;
}): Promise<void> {
  await db()
    .collection("workspaces")
    .doc(entry.workspaceId)
    .collection("emailLogs")
    .add({
      type: entry.type,
      to: entry.to,
      subject: entry.subject,
      dedupeKey: entry.dedupeKey,
      ok: entry.ok,
      messageId: entry.messageId ?? null,
      error: entry.error ?? null,
      skipped: entry.skipped ?? null,
      at: FieldValue.serverTimestamp(),
    });
}

// ---------------------------------------------------------------------------
// Core send
// ---------------------------------------------------------------------------

export interface NotifyOptions {
  workspaceId: string;
  type: "reconnect" | "handoff";
  to: string;
  subject: string;
  html: string;
  text: string;
  dedupeKey: string;
  cooldownMs: number;
}

export async function sendNotificationEmail(
  opts: NotifyOptions,
): Promise<{ sent: boolean; reason?: string; messageId?: string }> {
  const { workspaceId, type, to, dedupeKey, cooldownMs } = opts;

  if (await isEmailSuppressed(workspaceId, to)) {
    await logEmailSend({ ...opts, ok: false, skipped: "suppressed" });
    logger.info("Notification email skipped: recipient suppressed", { workspaceId, type });
    return { sent: false, reason: "suppressed" };
  }

  const claimed = await claimSendSlot(workspaceId, dedupeKey, cooldownMs, { type, to });
  if (!claimed) {
    await logEmailSend({ ...opts, ok: false, skipped: "duplicate" });
    logger.info("Notification email skipped: duplicate within cooldown", { workspaceId, type, dedupeKey });
    return { sent: false, reason: "duplicate" };
  }

  const client = await getSesClient();
  if (!client) {
    await logEmailSend({ ...opts, ok: false, error: "ses-credentials-unavailable" });
    return { sent: false, reason: "ses-credentials-unavailable" };
  }

  try {
    const res = await client.send(
      new SendEmailCommand({
        FromEmailAddress: FROM_ADDRESS,
        Destination: { ToAddresses: [to] },
        Content: {
          Simple: {
            Subject: { Data: opts.subject, Charset: "UTF-8" },
            Body: {
              Text: { Data: opts.text, Charset: "UTF-8" },
              Html: { Data: opts.html, Charset: "UTF-8" },
            },
          },
        },
      }),
    );
    await logEmailSend({ ...opts, ok: true, messageId: res.MessageId });
    logger.info("Notification email sent", { workspaceId, type, messageId: res.MessageId });
    return { sent: true, messageId: res.MessageId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await logEmailSend({ ...opts, ok: false, error: message });
    logger.error("Notification email failed", { workspaceId, type, error: message });
    return { sent: false, reason: "ses-error" };
  }
}

// ---------------------------------------------------------------------------
// Workspace owner lookup
// ---------------------------------------------------------------------------

async function getWorkspaceOwnerEmail(workspaceId: string): Promise<string | null> {
  const wsSnap = await db().collection("workspaces").doc(workspaceId).get();
  const ownerUidFromDoc = wsSnap.data()?.ownerUid as string | undefined;

  const membersSnap = await db().collection("workspaces").doc(workspaceId).collection("members").get();
  let ownerUid: string | null = ownerUidFromDoc ?? null;
  let firstUid: string | null = null;
  membersSnap.forEach((m) => {
    if (!firstUid) firstUid = m.id;
    if (!ownerUid && m.data()?.role === "owner") ownerUid = m.id;
  });
  const uid = ownerUid ?? firstUid;
  if (!uid) return null;
  try {
    const user = await getAuth().getUser(uid);
    return user.email ?? null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Email copy (plain English, no jargon, no dashes)
// ---------------------------------------------------------------------------

function emailShell(title: string, bodyHtml: string, ctaLabel: string, ctaUrl: string): string {
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f6f7f9;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
<div style="max-width:560px;margin:0 auto;padding:32px 24px;">
<div style="background:#ffffff;border-radius:12px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
<h1 style="font-size:20px;margin:0 0 16px;color:#111827;">${title}</h1>
<div style="font-size:15px;line-height:1.6;color:#374151;">${bodyHtml}</div>
<div style="margin:24px 0;">
<a href="${ctaUrl}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 28px;border-radius:8px;">${ctaLabel}</a>
</div>
<p style="font-size:13px;color:#6b7280;">If the button does not work, paste this link into your browser:<br><span style="word-break:break-all;">${ctaUrl}</span></p>
</div>
<p style="font-size:12px;color:#9ca3af;text-align:center;margin-top:16px;">Sent by ChatMize because this workspace asked for these alerts.</p>
</div></body></html>`;
}

function reconnectCopy(label: string, reconnectUrl: string): { subject: string; html: string; text: string } {
  const subject = `Your ${label} connection in ChatMize needs attention`;
  const title = `${label} stopped talking to ChatMize`;
  const bodyHtml = `<p>Hi,</p>
<p>The connection between ChatMize and your ${label} account stopped working, so new messages may not send until you reconnect it.</p>
<p>Reconnecting takes less than a minute. Tap the button below and follow the steps.</p>`;
  const text = `Hi,\n\nThe connection between ChatMize and your ${label} account stopped working, so new messages may not send until you reconnect it.\n\nReconnecting takes less than a minute. Open this link and follow the steps:\n${reconnectUrl}\n\nWe will remind you again tomorrow if it is still broken.`;
  return { subject, html: emailShell(title, bodyHtml, "Reconnect now", reconnectUrl), text };
}

function handoffCopy(
  conversationUrl: string,
  reason?: string,
): { subject: string; html: string; text: string } {
  const subject = "Someone needs a human in ChatMize";
  const title = "A conversation needs a person";
  const reasonLine = reason ? `<p>Why: ${reason}</p>` : "";
  const bodyHtml = `<p>Hi,</p>
<p>A visitor asked for a human, or an automation decided this one needs a person.</p>
${reasonLine}
<p>Tap the button to open the conversation and take it from here.</p>`;
  const text = `Hi,\n\nA visitor asked for a human, or an automation decided this conversation needs a person.\n${reason ? `Why: ${reason}\n` : ""}\nOpen the conversation here:\n${conversationUrl}`;
  return { subject, html: emailShell(title, bodyHtml, "Open the conversation", conversationUrl), text };
}

// ---------------------------------------------------------------------------
// Synchronous hook: call right after an integration is flagged token_invalid.
// (The Firestore triggers below are the long term path; they need their
// Cloud Function resources created, which this VM's egress proxy blocks, so
// the invalidation code paths call this directly for now. Dedupe keeps both
// mechanisms from ever double sending.)
// ---------------------------------------------------------------------------

export async function notifyOwnerReconnect(
  workspaceId: string,
  integrationId: "meta" | "instagram",
): Promise<void> {
  try {
    const label = integrationId === "meta" ? "Facebook" : "Instagram";
    const ownerEmail = await getWorkspaceOwnerEmail(workspaceId);
    if (!ownerEmail) {
      logger.warn("Reconnect email skipped: no owner email found", { workspaceId, integrationId });
      return;
    }
    const reconnectUrl = `${APP_BASE}/?reconnect=${integrationId}`;
    const copy = reconnectCopy(label, reconnectUrl);
    await sendNotificationEmail({
      workspaceId,
      type: "reconnect",
      to: ownerEmail,
      subject: copy.subject,
      html: copy.html,
      text: copy.text,
      // One email per integration per break: minute bucketed so the several
      // invalidation sites firing for one break collapse into a single send,
      // and the 24h cooldown caps repeats while it stays broken.
      dedupeKey: `reconnect:${integrationId}:${Math.floor(Date.now() / 60000)}`,
      cooldownMs: RECONNECT_COOLDOWN_MS,
    });
  } catch (err) {
    // Notifications must never break the send or token health path.
    logger.warn("notifyOwnerReconnect failed", {
      workspaceId,
      integrationId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

// ---------------------------------------------------------------------------
// Trigger 1: channel connection died -> email the owner once
// ---------------------------------------------------------------------------

export const onIntegrationInvalidated = onDocumentWritten(
  {
    region: REGION,
    database: "chatmize-prod",
    document: "workspaces/{workspaceId}/integrations/{integrationId}",
  },
  async (event) => {
    const before = event.data?.before?.data() as { status?: string } | undefined;
    const after = event.data?.after?.data() as
      | { status?: string; tokenInvalidAt?: { toMillis?: () => number } }
      | undefined;
    if (!after || after.status !== "token_invalid") return;
    if (before?.status === "token_invalid") return; // not a new break

    const { workspaceId, integrationId } = event.params as {
      workspaceId: string;
      integrationId: string;
    };
    if (integrationId !== "meta" && integrationId !== "instagram") return;

    const label = integrationId === "meta" ? "Facebook" : "Instagram";
    const ownerEmail = await getWorkspaceOwnerEmail(workspaceId);
    if (!ownerEmail) {
      logger.warn("Reconnect email skipped: no owner email found", { workspaceId, integrationId });
      return;
    }

    // The owner reconnect popup already opens on its own when the session is
    // invalid, so the deep link just needs to land them in the app. The
    // reconnect query param is a hook the frontend can adopt later.
    const reconnectUrl = `${APP_BASE}/?reconnect=${integrationId}`;
    const copy = reconnectCopy(label, reconnectUrl);
    const invalidAtMs = after.tokenInvalidAt?.toMillis?.() ?? 0;
    await sendNotificationEmail({
      workspaceId,
      type: "reconnect",
      to: ownerEmail,
      subject: copy.subject,
      html: copy.html,
      text: copy.text,
      dedupeKey: `reconnect:${integrationId}:${invalidAtMs}`,
      cooldownMs: RECONNECT_COOLDOWN_MS,
    });
  },
);

// ---------------------------------------------------------------------------
// Handoff email. Call handleHandoffCreated right after a handoff record is
// created. (The Firestore trigger below is the long term path; its Cloud
// Function resource cannot be created through this VM's egress proxy, so
// every writer of workspaces/{ws}/handoffs/{id} calls this directly instead.
// Dedupe keeps both mechanisms from ever double sending.)
// ---------------------------------------------------------------------------

export interface HandoffRecord {
  conversationId?: string;
  assigneeUid?: string;
  assigneeEmail?: string;
  reason?: string;
}

/** Send the human handoff email for a newly created handoff record. */
export async function handleHandoffCreated(
  workspaceId: string,
  handoffId: string,
  data: HandoffRecord | undefined,
): Promise<void> {
  if (!data?.conversationId) return;

  let to: string | null = data.assigneeEmail?.trim() || null;
  if (!to && data.assigneeUid) {
    try {
      to = (await getAuth().getUser(data.assigneeUid)).email ?? null;
    } catch {
      to = null;
    }
  }
  if (!to) to = await getWorkspaceOwnerEmail(workspaceId);
  if (!to) {
    logger.warn("Handoff email skipped: no recipient email found", { workspaceId, handoffId });
    return;
  }

  const conversationUrl = `${APP_BASE}/?workspace=${encodeURIComponent(
    workspaceId,
  )}&conversation=${encodeURIComponent(data.conversationId)}`;
  const copy = handoffCopy(conversationUrl, data.reason);
  await sendNotificationEmail({
    workspaceId,
    type: "handoff",
    to,
    subject: copy.subject,
    html: copy.html,
    text: copy.text,
    dedupeKey: `handoff:${handoffId}`,
    cooldownMs: 7 * 24 * 3600 * 1000,
  });
}

// Trigger 2 (long term path; resource not yet created): human handoff
// requested -> email the assignee (or owner) once
// ---------------------------------------------------------------------------

export const onHandoffCreated = onDocumentCreated(
  {
    region: REGION,
    database: "chatmize-prod",
    document: "workspaces/{workspaceId}/handoffs/{handoffId}",
  },
  async (event) => {
    const data = event.data?.data() as HandoffRecord | undefined;
    const { workspaceId, handoffId } = event.params as {
      workspaceId: string;
      handoffId: string;
    };
    await handleHandoffCreated(workspaceId, handoffId, data);
  },
);
