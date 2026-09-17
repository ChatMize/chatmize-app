/**
 * Instagram Login for IG-only workspaces.
 *
 * Workspaces whose business lives on Instagram (no Facebook Page) connect
 * here through the ChatMize-IG Instagram app. The long-lived IG token is
 * stored as the workspace's own Secret Manager secret; only the IG user
 * id/username/picture reach the client.
 *
 * Flow: instagramOAuthStart (callable) -> Instagram authorize dialog ->
 * instagramOAuthCallback (HTTPS) exchanges the code for a long-lived token,
 * stores it, and redirects home with ?instagram_oauth=success|error.
 */
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { randomUUID } from "crypto";
import { META_INSTAGRAM_APP_SECRET } from "./secrets";

/** ChatMize-IG Instagram app id (public, from the Meta app dashboard). */
const INSTAGRAM_APP_ID = "4588030554806270";
/** Shared OAuth callback (also serves Instagram Login; routed by state). */
export const INSTAGRAM_OAUTH_CALLBACK_URL =
  "https://app.chatmize.com/metaOAuthCallback";
const APP_RETURN_URL = "https://app.chatmize.com/";

/** Permissions for IG DMs + comments via Instagram Login. */
const IG_OAUTH_SCOPES = [
  "instagram_business_basic",
  "instagram_business_manage_messages",
  "instagram_business_manage_comments",
];

const STATE_TTL_MS = 10 * 60 * 1000;
const RETURN_TO_RE = /^[a-z]+:[a-z_]+$/;
/** Refresh the long-lived token when fewer than 7 days remain. */
const REFRESH_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/** Firebase project id (mirrors the constant in metaOAuth.ts). */
const PROJECT_ID = "gen-lang-client-0433776094";

function db() {
  return getFirestore();
}

function sanitizeReturnTo(value: unknown): string | undefined {
  if (typeof value !== "string" || !RETURN_TO_RE.test(value)) return undefined;
  return value;
}

/** Secret Manager secret id for a workspace's IG token. */
export function workspaceIgTokenSecretId(workspaceId: string): string {
  const safe = workspaceId.toUpperCase().replace(/[^A-Z0-9_]/g, "_").slice(0, 100);
  return `IG_TOKEN_WS_${safe}`;
}

async function secretManager(
  method: "POST",
  path: string,
  body?: unknown,
): Promise<{ status: number; data: unknown }> {
  const { GoogleAuth } = await import("google-auth-library");
  const auth = new GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  });
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  const res = await fetch(`https://secretmanager.googleapis.com/v1/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token.token}`,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

/** Step 1: build the Instagram authorize URL and stash a one-time state. */
export async function buildInstagramLoginUrl(
  workspaceId: string,
  uid: string,
  returnTo?: string,
): Promise<string> {
  const state = randomUUID().replace(/-/g, "");
  const now = Date.now();
  await db().collection("instagram_oauth_states").doc(state).set({
    workspaceId,
    uid,
    returnTo: sanitizeReturnTo(returnTo),
    createdAt: FieldValue.serverTimestamp(),
    expiresAtMs: now + STATE_TTL_MS,
    used: false,
  });
  const params = new URLSearchParams({
    client_id: INSTAGRAM_APP_ID,
    redirect_uri: INSTAGRAM_OAUTH_CALLBACK_URL,
    scope: IG_OAUTH_SCOPES.join(","),
    response_type: "code",
    state,
  });
  return `https://www.instagram.com/oauth/authorize?${params.toString()}`;
}

/** Peek whether a state belongs to the Instagram Login flow (no consume). */
export async function isInstagramOAuthState(state: string): Promise<boolean> {
  try {
    const snap = await db().collection("instagram_oauth_states").doc(state).get();
    return snap.exists;
  } catch {
    return false;
  }
}

interface InstagramOAuthState {
  workspaceId: string;
  uid: string;
  returnTo?: string;
  expiresAtMs: number;
  used?: boolean;
}

/** Step 2a: validate the one-time state (single use). */
export async function consumeInstagramOAuthState(
  state: string,
): Promise<InstagramOAuthState> {
  const ref = db().collection("instagram_oauth_states").doc(state);
  const snap = await ref.get();
  if (!snap.exists) throw new Error("Invalid or expired login session. Please try again.");
  const data = snap.data() as InstagramOAuthState;
  await ref.delete();
  if (data.used || data.expiresAtMs < Date.now()) {
    throw new Error("Login session expired. Please try again.");
  }
  return data;
}

export function instagramAppReturnUrl(
  outcome: "success" | "error",
  message?: string,
  returnTo?: string,
): string {
  const params = new URLSearchParams({ instagram_oauth: outcome });
  if (message) params.set("instagram_oauth_error", message.slice(0, 200));
  const safeReturnTo = sanitizeReturnTo(returnTo);
  if (safeReturnTo) params.set("return_to", safeReturnTo);
  return `${APP_RETURN_URL}?${params.toString()}`;
}

interface IgProfile {
  id: string;
  username: string;
  pictureUrl: string | null;
  token: string;
  expiresAtMs: number;
}

/**
 * Step 2b: exchange the code for a short-lived token, then a long-lived
 * token (~60 days), then fetch the IG profile. Never logs the token.
 */
export async function exchangeInstagramCode(code: string): Promise<IgProfile> {
  const appSecret = META_INSTAGRAM_APP_SECRET.value();

  // 1) Code -> short-lived token.
  const form = new URLSearchParams({
    client_id: INSTAGRAM_APP_ID,
    client_secret: appSecret,
    grant_type: "authorization_code",
    redirect_uri: INSTAGRAM_OAUTH_CALLBACK_URL,
    code,
  });
  const shortRes = await fetch("https://api.instagram.com/oauth/access_token", {
    method: "POST",
    body: form,
  });
  const shortData = (await shortRes.json().catch(() => ({}))) as {
    access_token?: string;
    user_id?: number;
    error_message?: string;
  };
  if (!shortRes.ok || !shortData.access_token) {
    throw new Error(
      `Instagram token exchange failed: ${shortData.error_message ?? `HTTP ${shortRes.status}`}`,
    );
  }

  // 2) Short-lived -> long-lived token (~60 days).
  const llParams = new URLSearchParams({
    grant_type: "ig_exchange_token",
    client_secret: appSecret,
    access_token: shortData.access_token,
  });
  const llRes = await fetch(`https://graph.instagram.com/access_token?${llParams.toString()}`);
  const llData = (await llRes.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
    error?: { message?: string };
  };
  if (!llRes.ok || !llData.access_token) {
    throw new Error(
      `Instagram long-lived token failed: ${llData.error?.message ?? `HTTP ${llRes.status}`}`,
    );
  }

  // 3) Profile.
  const meParams = new URLSearchParams({
    fields: "id,username,profile_picture_url",
    access_token: llData.access_token,
  });
  const meRes = await fetch(`https://graph.instagram.com/me?${meParams.toString()}`);
  const meData = (await meRes.json().catch(() => ({}))) as {
    id?: string;
    username?: string;
    profile_picture_url?: string;
    error?: { message?: string };
  };
  if (!meRes.ok || !meData.id) {
    throw new Error(
      `Instagram profile fetch failed: ${meData.error?.message ?? `HTTP ${meRes.status}`}`,
    );
  }

  return {
    id: meData.id,
    username: meData.username ?? meData.id,
    pictureUrl: meData.profile_picture_url ?? null,
    token: llData.access_token,
    expiresAtMs: Date.now() + (llData.expires_in ?? 5184000) * 1000,
  };
}

/** Refresh a long-lived token when it is near expiry. Best effort. */
export async function refreshIgTokenIfNeeded(
  workspaceId: string,
  conn: { secretName?: string; expiresAtMs?: number; igUserId?: string },
): Promise<void> {
  if (!conn.secretName || !conn.expiresAtMs) return;
  if (conn.expiresAtMs - Date.now() > REFRESH_WINDOW_MS) return;
  try {
    const { GoogleAuth } = await import("google-auth-library");
    const auth = new GoogleAuth({
      scopes: ["https://www.googleapis.com/auth/cloud-platform"],
    });
    const client = await auth.getClient();
    const gtoken = await client.getAccessToken();
    const res = await fetch(
      `https://secretmanager.googleapis.com/v1/projects/${PROJECT_ID}/secrets/${conn.secretName}/versions/latest:access`,
      { headers: { Authorization: `Bearer ${gtoken.token}` } },
    );
    if (!res.ok) return;
    const data = (await res.json()) as { payload?: { data?: string } };
    const payload = data.payload?.data;
    if (!payload) return;
    const oldToken = Buffer.from(payload, "base64").toString("utf8");

    const params = new URLSearchParams({
      grant_type: "ig_refresh_token",
      access_token: oldToken,
    });
    const rr = await fetch(`https://graph.instagram.com/refresh_access_token?${params.toString()}`);
    const rdata = (await rr.json().catch(() => ({}))) as {
      access_token?: string;
      expires_in?: number;
    };
    if (!rr.ok || !rdata.access_token) return;

    await secretManager("POST", `projects/${PROJECT_ID}/secrets/${conn.secretName}:addVersion`, {
      payload: { data: Buffer.from(rdata.access_token, "utf8").toString("base64") },
    });
    await db()
      .collection("workspaces")
      .doc(workspaceId)
      .collection("integrations")
      .doc("instagram")
      .set(
        { expiresAtMs: Date.now() + (rdata.expires_in ?? 5184000) * 1000 },
        { merge: true },
      );
    logger.info("IG token refreshed", { workspaceId, igUserId: conn.igUserId });
  } catch (e) {
    logger.warn("IG token refresh failed", {
      workspaceId,
      err: (e as Error).message,
    });
  }
}

export interface InstagramConnection {
  connected: boolean;
  igUserId: string | null;
  username: string | null;
  pictureUrl: string | null;
  expiresAtMs: number | null;
}

/** Read the IG-only connection doc (no tokens leave the server). */
export async function getInstagramConnection(workspaceId: string): Promise<InstagramConnection> {
  const snap = await db()
    .collection("workspaces")
    .doc(workspaceId)
    .collection("integrations")
    .doc("instagram")
    .get();
  const conn = (snap.data() ?? {}) as {
    status?: string;
    igUserId?: string;
    username?: string;
    pictureUrl?: string | null;
    secretName?: string;
    expiresAtMs?: number;
  };
  const connected = conn.status === "connected" && !!conn.igUserId;
  if (connected) {
    // Keep the long-lived token alive while the user keeps the app open.
    await refreshIgTokenIfNeeded(workspaceId, conn).catch(() => undefined);
  }
  return {
    connected,
    igUserId: conn.igUserId ?? null,
    username: conn.username ?? null,
    pictureUrl: conn.pictureUrl ?? null,
    expiresAtMs: conn.expiresAtMs ?? null,
  };
}

/** Step 3: persist the IG token as the workspace's own secret + connection doc. */
export async function connectInstagramAccount(
  workspaceId: string,
  uid: string,
  profile: IgProfile,
): Promise<{ igUserId: string; username: string }> {
  const secretId = workspaceIgTokenSecretId(workspaceId);
  const create = await secretManager(
    "POST",
    `projects/${PROJECT_ID}/secrets?secretId=${encodeURIComponent(secretId)}`,
    { replication: { automatic: {} } },
  );
  if (create.status !== 200 && create.status !== 409) {
    logger.error("Secret Manager create failed (IG)", { workspaceId, status: create.status });
    throw new Error("Could not store the Instagram token securely. Please try again.");
  }
  const addVersion = await secretManager(
    "POST",
    `projects/${PROJECT_ID}/secrets/${secretId}:addVersion`,
    { payload: { data: Buffer.from(profile.token, "utf8").toString("base64") } },
  );
  if (addVersion.status !== 200) {
    logger.error("Secret Manager addVersion failed (IG)", { workspaceId, status: addVersion.status });
    throw new Error("Could not store the Instagram token securely. Please try again.");
  }

  await db()
    .collection("workspaces")
    .doc(workspaceId)
    .collection("integrations")
    .doc("instagram")
    .set(
      {
        status: "connected",
        igUserId: profile.id,
        username: profile.username,
        pictureUrl: profile.pictureUrl,
        secretName: secretId,
        expiresAtMs: profile.expiresAtMs,
        connectedAt: FieldValue.serverTimestamp(),
        connectedBy: uid,
      },
      { merge: true },
    );
  return { igUserId: profile.id, username: profile.username };
}
