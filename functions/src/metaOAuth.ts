/**
 * Facebook Login for Business — lets a workspace owner connect their own
 * Facebook Page (the Meta anchor for Messenger + Instagram messaging).
 *
 * Flow:
 *   1. Client calls `metaOAuthStart` (callable, authed) -> gets the
 *      facebook.com dialog URL -> full-page redirect.
 *   2. Meta redirects to `metaOAuthCallback` (public HTTPS) with ?code&state.
 *      The callback validates the one-time state, exchanges the code for a
 *      long-lived user token, fetches the user's pages, and stores them as a
 *      short-lived pending connection. Page access tokens never leave the
 *      server. Then it redirects back to the app.
 *   3. Client calls `metaOAuthListPages` -> shows a picker (id + name only).
 *   4. Client calls `metaOAuthSelectPage` -> the chosen page token is stored
 *      as its own Secret Manager secret scoped to the workspace, and the
 *      connection is marked active.
 *
 * No Meta secret or page token is ever committed, logged, or sent to the
 * client. The app secret stays in Secret Manager; only page id/name reach
 * the browser.
 */
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { META_APP_SECRET } from "./secrets";

const db = () => getFirestore("chatmize-prod");

export const META_APP_ID = "1830921644775678";
const GRAPH_VERSION = "v21.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;
const PROJECT_ID = "gen-lang-client-0433776094";

export const OAUTH_CALLBACK_URL =
  "https://us-west2-gen-lang-client-0433776094.cloudfunctions.net/metaOAuthCallback";
const APP_RETURN_URL = "https://app.chatmize.com/";

/** Scopes needed for Messenger + Instagram messaging on the customer's page. */
const OAUTH_SCOPES = [
  "pages_show_list",
  "pages_messaging",
  "pages_read_engagement",
  "pages_manage_metadata",
  "instagram_basic",
  "instagram_manage_messages",
];

const STATE_TTL_MS = 10 * 60 * 1000;

/** In-memory cache for Secret Manager access tokens + page tokens. */
const cache = new Map<string, { value: string; expiresAt: number }>();

function cacheGet(key: string): string | null {
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value;
  cache.delete(key);
  return null;
}

function cacheSet(key: string, value: string, ttlMs: number) {
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

/** Service-account access token via the metadata server (Cloud Run/Functions). */
async function gcpAccessToken(): Promise<string> {
  const cached = cacheGet("gcp_access_token");
  if (cached) return cached;
  const res = await fetch(
    "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token",
    { headers: { "Metadata-Flavor": "Google" } },
  );
  if (!res.ok) throw new Error(`metadata token HTTP ${res.status}`);
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cacheSet("gcp_access_token", data.access_token, (data.expires_in - 60) * 1000);
  return data.access_token;
}

async function secretManager(
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; data: unknown }> {
  const token = await gcpAccessToken();
  const res = await fetch(`https://secretmanager.googleapis.com/v1/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: res.status, data };
}

/** Secret Manager secret id for a workspace's page token. */
export function workspacePageTokenSecretId(workspaceId: string): string {
  const safe = workspaceId.toUpperCase().replace(/[^A-Z0-9_]/g, "_").slice(0, 100);
  return `META_PAGE_TOKEN_WS_${safe}`;
}

/**
 * Resolve the Meta page access token for a workspace.
 * Prefers the workspace's own OAuth-connected secret; falls back to the
 * provisioned default token (static env mount).
 */
export async function resolvePageToken(
  workspaceId: string,
  defaultToken: string,
): Promise<string> {
  const snap = await db()
    .collection("workspaces")
    .doc(workspaceId)
    .collection("integrations")
    .doc("meta")
    .get();
  const conn = snap.data() as
    | { status?: string; secretName?: string }
    | undefined;
  if (conn?.status === "connected" && conn.secretName) {
    const cached = cacheGet(`pagetoken:${workspaceId}`);
    if (cached) return cached;
    const { status, data } = await secretManager(
      "GET",
      `projects/${PROJECT_ID}/secrets/${conn.secretName}/versions/latest:access`,
    );
    if (status === 200) {
      const payload = (data as { payload?: { data?: string } }).payload?.data;
      if (payload) {
        const token = Buffer.from(payload, "base64").toString("utf8");
        cacheSet(`pagetoken:${workspaceId}`, token, 5 * 60 * 1000);
        return token;
      }
    }
    logger.warn("Workspace page token unreadable, falling back to default", {
      workspaceId,
      secretStatus: status,
    });
  }
  return defaultToken;
}

/** Step 1: create a one-time state and return the Facebook Login URL. */
export async function buildLoginUrl(
  workspaceId: string,
  uid: string,
): Promise<string> {
  const { randomUUID } = await import("crypto");
  const state = randomUUID().replace(/-/g, "");
  const now = Date.now();
  await db().collection("meta_oauth_states").doc(state).set({
    workspaceId,
    uid,
    createdAt: FieldValue.serverTimestamp(),
    expiresAtMs: now + STATE_TTL_MS,
    used: false,
  });
  const params = new URLSearchParams({
    client_id: META_APP_ID,
    redirect_uri: OAUTH_CALLBACK_URL,
    scope: OAUTH_SCOPES.join(","),
    state,
    response_type: "code",
  });
  return `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth?${params.toString()}`;
}

interface OAuthState {
  workspaceId: string;
  uid: string;
  expiresAtMs: number;
  used?: boolean;
}

/** Step 2a: validate the one-time state (single use). */
export async function consumeOAuthState(state: string): Promise<OAuthState> {
  const ref = db().collection("meta_oauth_states").doc(state);
  const snap = await ref.get();
  if (!snap.exists) throw new Error("Invalid or expired login session. Please try again.");
  const data = snap.data() as OAuthState;
  // Single-use: delete first so a replayed callback can't be reused.
  await ref.delete();
  if (data.used || data.expiresAtMs < Date.now()) {
    throw new Error("Login session expired. Please try again.");
  }
  return data;
}

async function graphGet(path: string, accessToken: string): Promise<unknown> {
  const sep = path.includes("?") ? "&" : "?";
  const res = await fetch(`${GRAPH_BASE}${path}${sep}access_token=${encodeURIComponent(accessToken)}`);
  const data = await res.json();
  if (!res.ok) {
    const msg = (data as { error?: { message?: string } }).error?.message ?? `Graph HTTP ${res.status}`;
    throw new Error(`Meta API error: ${msg}`);
  }
  return data;
}

export interface OAuthPage {
  id: string;
  name: string;
  token: string;
}

/** Step 2b: code -> short-lived user token -> long-lived user token -> pages. */
export async function exchangeCodeForPages(code: string): Promise<OAuthPage[]> {
  const appSecret = META_APP_SECRET.value();
  // Short-lived user token
  const shortParams = new URLSearchParams({
    client_id: META_APP_ID,
    redirect_uri: OAUTH_CALLBACK_URL,
    client_secret: appSecret,
    code,
  });
  const shortRes = await fetch(`${GRAPH_BASE}/oauth/access_token?${shortParams.toString()}`);
  const shortData = (await shortRes.json()) as {
    access_token?: string;
    error?: { message?: string };
  };
  if (!shortRes.ok || !shortData.access_token) {
    throw new Error(`Token exchange failed: ${shortData.error?.message ?? shortRes.status}`);
  }
  // Long-lived user token (~60 days)
  const longParams = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: META_APP_ID,
    client_secret: appSecret,
    fb_exchange_token: shortData.access_token,
  });
  const longRes = await fetch(`${GRAPH_BASE}/oauth/access_token?${longParams.toString()}`);
  const longData = (await longRes.json()) as {
    access_token?: string;
    error?: { message?: string };
  };
  if (!longRes.ok || !longData.access_token) {
    throw new Error(`Long-lived token exchange failed: ${longData.error?.message ?? longRes.status}`);
  }
  // Pages with their (non-expiring) page access tokens
  const accounts = (await graphGet(
    "/me/accounts?fields=id,name,access_token&limit=50",
    longData.access_token,
  )) as { data?: Array<{ id: string; name: string; access_token: string }> };
  return (accounts.data ?? []).map((p) => ({ id: p.id, name: p.name, token: p.access_token }));
}

/** Step 2c: stash the pages as a short-lived pending connection (server only). */
export async function storePendingPages(
  workspaceId: string,
  uid: string,
  pages: OAuthPage[],
): Promise<void> {
  await db()
    .collection("workspaces")
    .doc(workspaceId)
    .collection("integrations")
    .doc("meta")
    .set(
      {
        status: "pending",
        pages,
        oauthBy: uid,
        pendingAt: FieldValue.serverTimestamp(),
        pendingExpiresAtMs: Date.now() + STATE_TTL_MS,
      },
      { merge: true },
    );
}

export function appReturnUrl(outcome: "success" | "error", message?: string): string {
  const params = new URLSearchParams({ meta_oauth: outcome });
  if (message) params.set("meta_oauth_error", message.slice(0, 200));
  return `${APP_RETURN_URL}?${params.toString()}`;
}

/** Step 4: persist the chosen page token as the workspace's own secret. */
export async function selectWorkspacePage(
  workspaceId: string,
  uid: string,
  pageId: string,
): Promise<{ pageId: string; pageName: string }> {
  const ref = db().collection("workspaces").doc(workspaceId).collection("integrations").doc("meta");
  const snap = await ref.get();
  const conn = snap.data() as
    | { status?: string; pages?: OAuthPage[]; pendingExpiresAtMs?: number }
    | undefined;
  if (!conn || conn.status !== "pending" || !conn.pages) {
    throw new Error("No pending Facebook connection. Please connect again.");
  }
  if ((conn.pendingExpiresAtMs ?? 0) < Date.now()) {
    throw new Error("Pending connection expired. Please connect again.");
  }
  const page = conn.pages.find((p) => p.id === pageId);
  if (!page) throw new Error("Page not found in this connection.");

  const secretId = workspacePageTokenSecretId(workspaceId);
  // Create the secret if needed (409 = already exists is fine).
  const create = await secretManager("POST", `projects/${PROJECT_ID}/secrets`, {
    secretId,
    replication: { automatic: {} },
  });
  if (create.status !== 200 && create.status !== 409) {
    logger.error("Secret Manager create failed", { workspaceId, status: create.status });
    throw new Error("Could not store the page token securely. Please try again.");
  }
  const addVersion = await secretManager(
    "POST",
    `projects/${PROJECT_ID}/secrets/${secretId}:addVersion`,
    { payload: { data: Buffer.from(page.token, "utf8").toString("base64") } },
  );
  if (addVersion.status !== 200) {
    logger.error("Secret Manager addVersion failed", { workspaceId, status: addVersion.status });
    throw new Error("Could not store the page token securely. Please try again.");
  }

  await ref.set({
    status: "connected",
    pageId: page.id,
    pageName: page.name,
    secretName: secretId,
    connectedAt: FieldValue.serverTimestamp(),
    connectedBy: uid,
    // Drop the raw tokens now that the chosen one lives in Secret Manager.
    pages: FieldValue.delete(),
    pendingExpiresAtMs: FieldValue.delete(),
  });
  cache.delete(`pagetoken:${workspaceId}`);
  return { pageId: page.id, pageName: page.name };
}
