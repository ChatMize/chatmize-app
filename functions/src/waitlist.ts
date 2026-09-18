/**
 * Production waitlist capture (folded into the metaWebhook onRequest function;
 * creating new Cloud Functions via the API is blocked through this VM's
 * egress proxy, so public HTTP surface rides the existing function).
 *
 * Endpoints (routed by the ?wl= query param):
 *   POST ?wl=signup   { name, email, source?, segmateUser?, consentText, consentAt }
 *   GET  ?wl=confirm&token=<hex>
 *
 * Data model (chatmize-prod):
 *   waitlist_signups/{sha256(emailLower)} = {
 *     name, email, emailLower, source, segmateUser,
 *     status: "pending" | "confirmed",
 *     consentText, consentAt,
 *     confirmToken, confirmTokenExpiresAt,
 *     createdAt, updatedAt, confirmedAt?,
 *     ipHash
 *   }
 *   waitlist_rate_limits/{ipHash_hourBucket} = { count, expiresAt }
 *
 * Double opt-in: signup writes a pending doc and emails a confirm link from
 * notifications@chatmize.com via SES. Same email signing up again updates the
 * record and resends the confirm email (never a duplicate doc). Tokens expire
 * after 7 days; unconfirmed signups stay pending and are simply never mailed
 * to again except on re-signup.
 */
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import { createHash, randomBytes } from "crypto";
import { logger } from "firebase-functions";
import { sendWaitlistConfirmationEmail } from "./notifications";

const PROJECT_ID = "gen-lang-client-0433776094";
const FUNCTION_URL = `https://us-west2-${PROJECT_ID}.cloudfunctions.net/metaWebhook`;
const CONFIRM_TOKEN_TTL_MS = 7 * 24 * 3600 * 1000;
const RATE_LIMIT_PER_HOUR = 10;

const db = () => getFirestore("chatmize-prod");

type Req = {
  method: string;
  path?: string;
  query: Record<string, unknown>;
  body?: unknown;
  ip?: string;
  header: (name: string) => string | undefined;
};
type Res = {
  status: (code: number) => Res;
  send: (body: string) => void;
  set: (field: string, value: string) => void;
  sendStatus: (code: number) => void;
};

function cors(res: Res) {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");
}

/** True when this request is aimed at the waitlist surface. */
export function isWaitlistRequest(req: { query: Record<string, unknown>; path?: string }): boolean {
  const wl = req.query?.wl;
  if (wl === "signup" || wl === "confirm") return true;
  return (req.path || "").startsWith("/waitlist");
}

function clientIp(req: Req): string {
  const fwd = req.header("x-forwarded-for");
  const raw = (fwd ? fwd.split(",")[0] : req.ip || "unknown").trim().toLowerCase();
  return createHash("sha256").update(raw).digest("hex").slice(0, 32);
}

/** Simple per-IP hourly throttle so the public endpoint cannot be sprayed. */
async function checkRateLimit(ipHash: string): Promise<boolean> {
  const bucket = new Date().toISOString().slice(0, 13).replace(/[^0-9]/g, "");
  const ref = db().collection("waitlist_rate_limits").doc(`${ipHash}_${bucket}`);
  try {
    const allowed = await db().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const count = (snap.data()?.count as number) ?? 0;
      if (count >= RATE_LIMIT_PER_HOUR) return false;
      tx.set(
        ref,
        {
          count: count + 1,
          expiresAt: Timestamp.fromMillis(Date.now() + 3600 * 1000),
        },
        { merge: true },
      );
      return true;
    });
    return allowed;
  } catch (err) {
    logger.warn("Waitlist rate limit check failed open", { err });
    return true;
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Format + basic sanity check. Returns the normalized email or null. */
function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const email = raw.trim().toLowerCase();
  if (email.length < 5 || email.length > 254) return null;
  if (!EMAIL_RE.test(email)) return null;
  if (email.includes("..")) return null;
  const [local, domain] = email.split("@");
  if (!local || local.length > 64 || !domain || domain.length > 253) return null;
  if (domain.startsWith(".") || domain.startsWith("-") || domain.endsWith("-")) return null;
  return email;
}

function docIdFor(emailLower: string): string {
  return createHash("sha256").update(emailLower).digest("hex");
}

async function handleSignup(req: Req, res: Res): Promise<void> {
  const body = (req.body || {}) as Record<string, unknown>;
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 100) : "";
  const email = normalizeEmail(body.email);
  const source = typeof body.source === "string" ? body.source.trim().slice(0, 80) : "app-waitlist-page";
  const segmateUser = body.segmateUser === true;
  const consentText = typeof body.consentText === "string" ? body.consentText.trim().slice(0, 500) : "";
  const consentAt = typeof body.consentAt === "string" ? body.consentAt.trim().slice(0, 40) : "";

  if (!name) {
    res.status(400).send(JSON.stringify({ ok: false, error: "Please enter your name." }));
    return;
  }
  if (!email) {
    res.status(400).send(JSON.stringify({ ok: false, error: "That email address does not look valid." }));
    return;
  }
  if (!consentText || !consentAt) {
    res.status(400).send(JSON.stringify({ ok: false, error: "Please accept the email consent to join the waitlist." }));
    return;
  }

  const ipHash = clientIp(req);
  if (!(await checkRateLimit(ipHash))) {
    res.status(429).send(JSON.stringify({ ok: false, error: "Too many signups from this address. Try again later." }));
    return;
  }

  const docId = docIdFor(email);
  const ref = db().collection("waitlist_signups").doc(docId);
  const existing = await ref.get();
  const existingData = existing.exists ? existing.data() : null;
  if (existingData?.status === "confirmed") {
    res.status(200).send(JSON.stringify({ ok: true, status: "already_confirmed" }));
    return;
  }

  const confirmToken = randomBytes(32).toString("hex");
  const now = FieldValue.serverTimestamp();
  const record = {
    name,
    email,
    emailLower: email,
    source,
    segmateUser,
    status: "pending",
    consentText,
    consentAt,
    confirmToken,
    confirmTokenExpiresAt: Timestamp.fromMillis(Date.now() + CONFIRM_TOKEN_TTL_MS),
    ipHash,
    createdAt: existingData?.createdAt ?? now,
    updatedAt: now,
    confirmedAt: null,
  };
  await ref.set(record, { merge: true });

  const confirmUrl = `${FUNCTION_URL}?wl=confirm&token=${confirmToken}`;
  const emailRes = await sendWaitlistConfirmationEmail(email, name, confirmUrl);
  if (!emailRes.sent) {
    logger.error("Waitlist confirmation email failed", { email, reason: emailRes.reason });
    // The signup is stored; the visitor can re-submit to trigger a resend.
    res.status(202).send(
      JSON.stringify({
        ok: true,
        status: "pending_email_failed",
        message: "Saved, but the confirmation email could not be sent. Please try again in a few minutes.",
      }),
    );
    return;
  }

  logger.info("Waitlist signup", { email, source, segmateUser, resent: !!existingData });
  res.status(200).send(JSON.stringify({ ok: true, status: "pending" }));
}

function confirmPageHtml(ok: boolean, heading: string, message: string): string {
  const accent = ok ? "#059669" : "#dc2626";
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${heading} | ChatMize</title></head>
<body style="margin:0;background:#0f172a;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#e2e8f0;">
<div style="max-width:520px;margin:0 auto;padding:64px 24px;text-align:center;">
<div style="font-size:28px;font-weight:800;letter-spacing:-0.5px;margin-bottom:8px;"><span style="color:#22d3ee;">Chat</span><span style="color:#ffffff;">Mize</span></div>
<div style="background:#1e293b;border:1px solid #334155;border-radius:16px;padding:40px 32px;margin-top:24px;">
<div style="width:56px;height:56px;border-radius:50%;background:${accent}22;border:2px solid ${accent};margin:0 auto 20px;display:flex;align-items:center;justify-content:center;font-size:26px;color:${accent};">${ok ? "&#10003;" : "!"}</div>
<h1 style="font-size:22px;margin:0 0 12px;color:#ffffff;">${heading}</h1>
<p style="font-size:15px;line-height:1.6;color:#94a3b8;margin:0;">${message}</p>
</div>
<p style="font-size:12px;color:#475569;margin-top:24px;">ChatMize &middot; chatmize.com</p>
</div></body></html>`;
}

async function handleConfirm(req: Req, res: Res): Promise<void> {
  const token = req.query?.token;
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token)) {
    res.status(400).send(confirmPageHtml(false, "Link not valid", "This confirmation link is malformed. Please use the exact link from your email."));
    return;
  }
  const snap = await db().collection("waitlist_signups").where("confirmToken", "==", token).limit(1).get();
  if (snap.empty) {
    res.status(410).send(confirmPageHtml(false, "Link expired or used", "This confirmation link is no longer valid. Sign up again on the waitlist page and we will send you a fresh one."));
    return;
  }
  const doc = snap.docs[0];
  const data = doc.data();
  const expiresAt = data.confirmTokenExpiresAt as Timestamp | undefined;
  if (!expiresAt || expiresAt.toMillis() < Date.now()) {
    res.status(410).send(confirmPageHtml(false, "Link expired", "This confirmation link expired after 7 days. Sign up again on the waitlist page and we will send you a fresh one."));
    return;
  }
  await doc.ref.update({
    status: "confirmed",
    confirmedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    confirmToken: FieldValue.delete(),
    confirmTokenExpiresAt: FieldValue.delete(),
  });
  logger.info("Waitlist confirmed", { email: data.emailLower });
  res.status(200).send(
    confirmPageHtml(true, "You are on the list", "Your email is confirmed. We will write to you the moment your ChatMize invite is ready."),
  );
}

/** Entry point, called from the metaWebhook onRequest handler. */
export async function handleWaitlistRequest(req: Req, res: Res): Promise<void> {
  cors(res);
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  const wl = req.query?.wl;
  try {
    if (req.method === "POST" && wl === "signup") {
      await handleSignup(req, res);
      return;
    }
    if (req.method === "GET" && wl === "confirm") {
      res.set("Content-Type", "text/html; charset=utf-8");
      await handleConfirm(req, res);
      return;
    }
    res.status(404).send(JSON.stringify({ ok: false, error: "Not found." }));
  } catch (err) {
    logger.error("Waitlist request failed", { err, wl });
    if (wl === "confirm") {
      res.set("Content-Type", "text/html; charset=utf-8");
      res.status(500).send(confirmPageHtml(false, "Something went wrong", "Please try the link again in a few minutes."));
    } else {
      res.status(500).send(JSON.stringify({ ok: false, error: "Something went wrong. Please try again." }));
    }
  }
}
