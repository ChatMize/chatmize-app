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
  "https://app.chatmize.com/metaOAuthCallback";
const APP_RETURN_URL = "https://app.chatmize.com/";

/**
 * Scopes for Facebook Login for Business (use-case based app).
 * NOTE 2026-09-16: Meta's business login dialog rejects pages_read_engagement,
 * instagram_basic, and instagram_manage_messages as invalid scopes in this
 * flow ("This message is only shown to developers"). Instagram messaging
 * coverage comes from the "Manage messaging & content on Instagram" use case
 * configured in the app dashboard, not from OAuth scope strings. Keep this
 * list to exactly what the dialog accepts; re-test in the dialog before
 * adding more.
 */
const OAUTH_SCOPES = [
  "pages_show_list",
  "pages_messaging",
  "pages_manage_metadata",
  // Lets /me/accounts include pages whose access comes via a Business
  // portfolio, not just direct page roles. (SegMate's older app sees those;
  // without this scope the new granular model filters them out.)
  "business_management",
];
// NOTE (2026-09-17): instagram_basic + instagram_manage_messages were requested
// here but Facebook's login dialog rejects them as "Invalid Scopes" for this
// app (they must first be enabled under App Review > Permissions and Features).
// Reverted to keep login working; IG DMs need the dashboard step before the
// scopes can be re-added.

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

/** Result of a proactive page-token health check. */
export type PageTokenHealth = "ok" | "invalid" | "unconnected";

/**
 * Proactive token self-heal, called on the send path before resolving the
 * page token. The health result is cached 24h per workspace so the check
 * costs nothing on steady traffic.
 *
 * - Token valid and not near expiry -> "ok".
 * - Token valid but expiring within 7 days -> exchanged for a fresh
 *   long-lived token via fb_exchange_token and stored as a new secret
 *   version (Meta only allows the exchange while the old token is alive).
 * - Token dead (Meta error 190: password change, security reset, revoked) ->
 *   the integration is flagged `token_invalid` and "invalid" is returned.
 *   A dead token cannot be revived via API; the owner must re-run OAuth.
 */
export async function ensureFreshPageToken(workspaceId: string): Promise<PageTokenHealth> {
  const ref = db()
    .collection("workspaces")
    .doc(workspaceId)
    .collection("integrations")
    .doc("meta");
  const snap = await ref.get();
  const conn = snap.data() as { status?: string; secretName?: string } | undefined;
  if (!conn || !conn.secretName) return "unconnected";
  if (conn.status === "token_invalid") return "invalid";
  if (conn.status !== "connected") return "unconnected";

  const healthKey = `pagetokenhealth:${workspaceId}`;
  if (cacheGet(healthKey)) return "ok";

  const { status: smStatus, data: smData } = await secretManager(
    "GET",
    `projects/${PROJECT_ID}/secrets/${conn.secretName}/versions/latest:access`,
  );
  if (smStatus !== 200) {
    // Transient Secret Manager hiccup: never block a send on the health
    // check itself; the send will surface a real failure if the token is bad.
    logger.warn("Page token unreadable during health check", { workspaceId, smStatus });
    return "ok";
  }
  const token = Buffer.from(
    (smData as { payload?: { data?: string } }).payload?.data ?? "",
    "base64",
  ).toString("utf8");
  if (!token) return "ok";

  const appToken = `${META_APP_ID}|${META_APP_SECRET.value()}`;
  let dbg: {
    data?: { is_valid?: boolean; expires_at?: number; error?: { code?: number; message?: string } };
    error?: { code?: number; message?: string };
  } = {};
  try {
    const dbgRes = await fetch(
      `${GRAPH_BASE}/debug_token?input_token=${encodeURIComponent(token)}&access_token=${encodeURIComponent(appToken)}`,
    );
    dbg = (await dbgRes.json()) as typeof dbg;
    const errCode = dbg.error?.code ?? dbg.data?.error?.code;
    if (!dbgRes.ok || errCode || dbg.data?.is_valid === false) throw new Error("invalid");
  } catch {
    const reason = dbg.error?.message ?? dbg.data?.error?.message ?? "token rejected by Meta";
    await ref.set(
      {
        status: "token_invalid",
        tokenInvalidAt: FieldValue.serverTimestamp(),
        tokenInvalidReason: reason,
      },
      { merge: true },
    );
    cache.delete(`pagetoken:${workspaceId}`);
    logger.warn("Meta page token invalid, flagged for reconnect", { workspaceId, reason });
    return "invalid";
  }

  // Page tokens minted from a long-lived user token report expires_at = 0
  // (never); only short-lived leftovers need the exchange below.
  const expiresAt = dbg.data?.expires_at ?? 0;
  if (expiresAt > 0 && expiresAt - Date.now() / 1000 < 7 * 24 * 3600) {
    const exParams = new URLSearchParams({
      grant_type: "fb_exchange_token",
      client_id: META_APP_ID,
      client_secret: META_APP_SECRET.value(),
      fb_exchange_token: token,
    });
    try {
      const exRes = await fetch(`${GRAPH_BASE}/oauth/access_token?${exParams.toString()}`);
      const exData = (await exRes.json()) as { access_token?: string; error?: { message?: string } };
      if (exRes.ok && exData.access_token) {
        const add = await secretManager(
          "POST",
          `projects/${PROJECT_ID}/secrets/${conn.secretName}:addVersion`,
          { payload: { data: Buffer.from(exData.access_token, "utf8").toString("base64") } },
        );
        if (add.status === 200) {
          cache.delete(`pagetoken:${workspaceId}`);
          logger.info("Meta page token auto-refreshed", { workspaceId });
        } else {
          logger.error("Token refresh addVersion failed", { workspaceId, status: add.status });
        }
      } else {
        logger.warn("Token refresh exchange failed", { workspaceId, error: exData.error?.message });
      }
    } catch (err) {
      logger.warn("Token refresh threw, keeping current token", {
        workspaceId,
        error: err instanceof Error ? err.message : "unknown",
      });
    }
  }

  cacheSet(healthKey, "1", 24 * 3600 * 1000);
  return "ok";
}

/** Where to send the user after the OAuth round-trip. Opaque descriptor like
 *  "onboarding:connect" or "app:settings_channels" — validated strictly so the
 *  callback can't be turned into an open redirect. */
const RETURN_TO_RE = /^[a-z]+:[a-z_]+$/;

function sanitizeReturnTo(value: unknown): string | undefined {
  if (typeof value !== "string" || !RETURN_TO_RE.test(value)) return undefined;
  return value;
}

/** Step 1: create a one-time state and return the Facebook Login URL. */
export async function buildLoginUrl(
  workspaceId: string,
  uid: string,
  returnTo?: unknown,
): Promise<string> {
  const { randomUUID } = await import("crypto");
  const state = randomUUID().replace(/-/g, "");
  const now = Date.now();
  await db().collection("meta_oauth_states").doc(state).set({
    workspaceId,
    uid,
    returnTo: sanitizeReturnTo(returnTo),
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
  returnTo?: string;
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

/** Instagram business/creator account linked to a Page (null when none). */
export interface LinkedInstagram {
  id: string;
  username: string;
  pictureUrl: string | null;
}

/** Page profile picture + linked Instagram, captured at connect time. */
export interface PageSocialProfile {
  pictureUrl: string | null;
  instagram: LinkedInstagram | null;
}

/**
 * Fetch a Page's profile picture and its linked Instagram business/creator
 * account (with the IG profile picture). Never throws: missing pieces come
 * back null so a failed lookup can never break page connection.
 */
export async function getPageSocialProfile(
  pageId: string,
  pageToken: string,
): Promise<PageSocialProfile> {
  // Page profile pictures are public. The token-authenticated picture lookup
  // needs the pages_read_engagement permission, which our OAuth scopes do not
  // request, so it fails with (#100). Use the public picture endpoint instead:
  // it 302-redirects to the CDN image, needs no token, and never expires.
  let pictureUrl: string | null =
    `https://graph.facebook.com/v21.0/${pageId}/picture?width=200&height=200`;
  let instagram: LinkedInstagram | null = null;
  try {
    const data = (await graphGet(
      `/${pageId}?fields=instagram_business_account{id,username}`,
      pageToken,
    )) as {
      instagram_business_account?: { id?: string; username?: string };
    };
    const ig = data.instagram_business_account;
    if (ig?.id) {
      let igPic: string | null = null;
      try {
        const igData = (await graphGet(`/${ig.id}?fields=profile_picture_url`, pageToken)) as {
          profile_picture_url?: string;
        };
        igPic = igData.profile_picture_url ?? null;
      } catch {
        // IG picture is a nice-to-have; the link itself is what matters.
      }
      instagram = { id: ig.id, username: ig.username ?? ig.id, pictureUrl: igPic };
    }
  } catch (e) {
    logger.warn("Page social profile lookup failed", {
      pageId,
      err: (e as Error).message,
    });
  }
  return { pictureUrl, instagram };
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
export async function exchangeCodeForPages(
  code: string,
): Promise<{ user: { id: string; name: string }; pages: OAuthPage[] }> {
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
  // Who logged in (surfaced in the picker so a wrong FB account is obvious).
  const me = (await graphGet("/me?fields=id,name", longData.access_token)) as {
    id?: string;
    name?: string;
  };
  const user = { id: me.id ?? "", name: me.name ?? "" };
  // Pages with their (non-expiring) page access tokens. Follow paging so
  // accounts past the first 50 are not silently dropped.
  const pages: OAuthPage[] = [];
  let path: string | null = "/me/accounts?fields=id,name,access_token&limit=100";
  while (path) {
    const accounts = (await graphGet(path, longData.access_token)) as {
      data?: Array<{ id: string; name: string; access_token: string }>;
      paging?: { next?: string };
    };
    for (const p of accounts.data ?? []) {
      pages.push({ id: p.id, name: p.name, token: p.access_token });
    }
    // paging.next is a full URL; strip back to a path for graphGet.
    const next: string | undefined = accounts.paging?.next;
    path = next ? next.replace(GRAPH_BASE, "") : null;
  }
  return { user, pages };
}

/** The page id this workspace had connected before this OAuth run, if any.
 * Used by the callback to auto-reselect on reconnect. Only returns an id
 * when the previous connection was established (connected or token_invalid),
 * never mid-flow (pending) so a double-started OAuth can't lock in a stale pick. */
export async function getPriorConnectedPageId(workspaceId: string): Promise<string | null> {
  const snap = await db()
    .collection("workspaces")
    .doc(workspaceId)
    .collection("integrations")
    .doc("meta")
    .get();
  const d = snap.data() as { pageId?: string; status?: string } | undefined;
  if (!d?.pageId) return null;
  if (d.status !== "connected" && d.status !== "token_invalid") return null;
  return d.pageId;
}

/** Step 2c: stash the pages as a short-lived pending connection (server only). */
export async function storePendingPages(
  workspaceId: string,
  uid: string,
  result: { user: { id: string; name: string }; pages: OAuthPage[] },
): Promise<void> {
  await db()
    .collection("workspaces")
    .doc(workspaceId)
    .collection("integrations")
    .doc("meta")
    .set(
      {
        status: "pending",
        pages: result.pages,
        oauthUser: result.user,
        oauthBy: uid,
        pendingAt: FieldValue.serverTimestamp(),
        pendingExpiresAtMs: Date.now() + STATE_TTL_MS,
      },
      { merge: true },
    );
}

export function appReturnUrl(outcome: "success" | "error", message?: string, returnTo?: string): string {
  const params = new URLSearchParams({ meta_oauth: outcome });
  if (message) params.set("meta_oauth_error", message.slice(0, 200));
  const safeReturnTo = sanitizeReturnTo(returnTo);
  if (safeReturnTo) params.set("return_to", safeReturnTo);
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
  // NOTE: secretId is a query parameter on secrets.create, not a body field.
  const create = await secretManager(
    "POST",
    `projects/${PROJECT_ID}/secrets?secretId=${encodeURIComponent(secretId)}`,
    {
      replication: { automatic: {} },
    },
  );
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

  // Detect the page's profile picture and linked Instagram account
  // (nulls when missing). Never blocks the connection.
  const social = await getPageSocialProfile(page.id, page.token);

  await ref.set(
    {
      status: "connected",
      pageId: page.id,
      pageName: page.name,
      secretName: secretId,
      pagePictureUrl: social.pictureUrl,
      instagram: social.instagram,
      connectedAt: FieldValue.serverTimestamp(),
      connectedBy: uid,
      // Drop the raw tokens now that the chosen one lives in Secret Manager.
      pages: FieldValue.delete(),
      pendingExpiresAtMs: FieldValue.delete(),
    },
    // merge:true is required for FieldValue.delete() sentinels in set().
    { merge: true }
  );

  // Subscribe the app to the page so Messenger inbound webhooks flow.
  // (Instagram DMs arrive via the app-level Instagram webhook subscription
  // in the Meta app dashboard for the linked IG account.)
  const subRes = await fetch(`${GRAPH_BASE}/${page.id}/subscribed_apps`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      access_token: page.token,
      subscribed_fields: "messages,messaging_postbacks,message_deliveries,message_reads",
    }),
  });
  if (!subRes.ok) {
    const errText = await subRes.text().catch(() => "");
    logger.error("Page app subscription failed", {
      workspaceId,
      pageId: page.id,
      status: subRes.status,
      err: errText.slice(0, 300),
    });
    throw new Error(
      "Page connected, but Meta refused the message subscription. " +
        "Inbound messages won't arrive. Please try selecting the page again."
    );
  }
  logger.info("Page app subscribed", { workspaceId, pageId: page.id });

  cache.delete(`pagetoken:${workspaceId}`);
  return { pageId: page.id, pageName: page.name };
}
