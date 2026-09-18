/**
 * WhatsApp customer connection flow.
 *
 * Workspaces connect their own WhatsApp Business number through Facebook
 * Login for Business on the main ChatMize Meta app. The long-lived user
 * token is stored as the workspace's own Secret Manager secret; only the
 * phone number id / WABA id / display name reach the client.
 *
 * Flow: metaOAuthStart (provider "whatsapp") -> Facebook authorize dialog ->
 * metaOAuthCallback (routed by state) exchanges the code, fetches the user's
 * WhatsApp Business Accounts + phone numbers, stores them as a pending
 * connection -> client lists them via whatsappOAuthListAccounts ->
 * whatsappOAuthSelectNumber persists the chosen number and the token.
 */
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { META_APP_ID, OAUTH_CALLBACK_URL } from "./metaOAuth";
import { META_APP_SECRET } from "./secrets";

const GRAPH_VERSION = "v21.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;
const APP_RETURN_URL = "https://app.chatmize.com/";

/** Permissions to manage the customer's WhatsApp Business messaging. */
const WHATSAPP_OAUTH_SCOPES = [
  "whatsapp_business_management",
  "whatsapp_business_messaging",
  "business_management",
];

const STATE_TTL_MS = 10 * 60 * 1000;
const RETURN_TO_RE = /^[a-z]+:[a-z_]+$/;

/** Firebase project id (mirrors the constant in metaOAuth.ts). */
const PROJECT_ID = "gen-lang-client-0433776094";

function db() {
  return getFirestore("chatmize-prod");
}

function sanitizeReturnTo(value: unknown): string | undefined {
  if (typeof value !== "string" || !RETURN_TO_RE.test(value)) return undefined;
  return value;
}

/** Secret Manager secret id for a workspace's WhatsApp token. */
export function workspaceWhatsAppTokenSecretId(workspaceId: string): string {
  const safe = workspaceId.toUpperCase().replace(/[^A-Z0-9_]/g, "_").slice(0, 100);
  return `WHATSAPP_TOKEN_WS_${safe}`;
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

/** Step 1: build the Facebook Login URL for WhatsApp and stash a one-time state. */
export async function buildWhatsAppLoginUrl(
  workspaceId: string,
  uid: string,
  returnTo?: string,
): Promise<string> {
  const { randomUUID } = await import("crypto");
  const state = randomUUID().replace(/-/g, "");
  const now = Date.now();
  await db().collection("whatsapp_oauth_states").doc(state).set({
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
    scope: WHATSAPP_OAUTH_SCOPES.join(","),
    response_type: "code",
    state,
    auth_type: "rerequest",
  });
  return `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth?${params.toString()}`;
}

/** Peek whether a state belongs to the WhatsApp flow (no consume). */
export async function isWhatsAppOAuthState(state: string): Promise<boolean> {
  try {
    const snap = await db().collection("whatsapp_oauth_states").doc(state).get();
    return snap.exists;
  } catch {
    return false;
  }
}

interface WhatsAppOAuthState {
  workspaceId: string;
  uid: string;
  returnTo?: string;
  expiresAtMs: number;
  used?: boolean;
}

/** Step 2a: validate the one-time state (single use). */
export async function consumeWhatsAppOAuthState(state: string): Promise<WhatsAppOAuthState> {
  const ref = db().collection("whatsapp_oauth_states").doc(state);
  const snap = await ref.get();
  if (!snap.exists) throw new Error("Invalid or expired login session. Please try again.");
  const data = snap.data() as WhatsAppOAuthState;
  await ref.delete();
  if (data.used || data.expiresAtMs < Date.now()) {
    throw new Error("Login session expired. Please try again.");
  }
  return data;
}

export function whatsappAppReturnUrl(
  outcome: "success" | "error",
  message?: string,
  returnTo?: string,
): string {
  const params = new URLSearchParams({ whatsapp_oauth: outcome });
  if (message) params.set("whatsapp_oauth_error", message.slice(0, 200));
  const safeReturnTo = sanitizeReturnTo(returnTo);
  if (safeReturnTo) params.set("return_to", safeReturnTo);
  return `${APP_RETURN_URL}?${params.toString()}`;
}

export interface WhatsAppPhoneNumber {
  phoneNumberId: string;
  displayPhoneNumber: string;
  verifiedName: string | null;
}

export interface WhatsAppBusinessAccount {
  wabaId: string;
  wabaName: string;
  phoneNumbers: WhatsAppPhoneNumber[];
}

interface WhatsAppConnectResult {
  accounts: WhatsAppBusinessAccount[];
  /** Long-lived user token (server only; persisted to Secret Manager on select). */
  token: string;
}

async function graphGet(path: string, accessToken: string): Promise<unknown> {
  const sep = path.includes("?") ? "&" : "?";
  const res = await fetch(
    `${GRAPH_BASE}${path}${sep}access_token=${encodeURIComponent(accessToken)}`,
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (data as { error?: { message?: string } }).error?.message ?? `HTTP ${res.status}`;
    throw new Error(`Graph request failed: ${msg}`);
  }
  return data;
}

/**
 * Step 2b: code -> short-lived user token -> long-lived user token, then
 * fetch the user's WhatsApp Business Accounts and their phone numbers.
 * The token never leaves the server.
 */
export async function exchangeWhatsAppCode(code: string): Promise<WhatsAppConnectResult> {
  const appSecret = META_APP_SECRET.value();

  // 1) Code -> short-lived user token.
  const shortParams = new URLSearchParams({
    client_id: META_APP_ID,
    redirect_uri: OAUTH_CALLBACK_URL,
    client_secret: appSecret,
    code,
  });
  const shortRes = await fetch(`${GRAPH_BASE}/oauth/access_token?${shortParams.toString()}`);
  const shortData = (await shortRes.json().catch(() => ({}))) as {
    access_token?: string;
    error?: { message?: string };
  };
  if (!shortRes.ok || !shortData.access_token) {
    throw new Error(
      `Token exchange failed: ${shortData.error?.message ?? `HTTP ${shortRes.status}`}`,
    );
  }

  // 2) Short-lived -> long-lived user token (~60 days).
  const longParams = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: META_APP_ID,
    client_secret: appSecret,
    fb_exchange_token: shortData.access_token,
  });
  const longRes = await fetch(`${GRAPH_BASE}/oauth/access_token?${longParams.toString()}`);
  const longData = (await longRes.json().catch(() => ({}))) as {
    access_token?: string;
    error?: { message?: string };
  };
  if (!longRes.ok || !longData.access_token) {
    throw new Error(
      `Long-lived token exchange failed: ${longData.error?.message ?? `HTTP ${longRes.status}`}`,
    );
  }
  const token = longData.access_token;

  // Diagnostic: check what permissions the token actually has.
  try {
    const debugRes = await fetch(
      `${GRAPH_BASE}/debug_token?input_token=${token}&access_token=${META_APP_ID}%7C${appSecret}`,
    );
    const debugData = (await debugRes.json().catch(() => ({}))) as {
      data?: { scopes?: string[] };
    };
    const scopes = debugData.data?.scopes ?? [];
    logger.info("WhatsApp token scopes", { scopes });
    if (!scopes.includes("business_management")) {
      throw new Error(
        `Token missing business_management permission. Granted scopes: ${scopes.join(", ") || "none"}. Please remove the app from your Facebook settings and reconnect.`,
      );
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes("business_management")) throw e;
    logger.warn("Token debug failed", { error: e instanceof Error ? e.message : "unknown" });
  }

  // 3) WhatsApp Business Accounts: go through the user's Businesses.
  // (There is no /me/whatsapp_business_accounts edge; WABAs are owned by Businesses.)
  const businesses = (await graphGet("/me/businesses?fields=id,name&limit=50", token)) as {
    data?: Array<{ id: string; name: string }>;
  };
  const accounts: WhatsAppBusinessAccount[] = [];
  for (const biz of businesses.data ?? []) {
    const wabas = (await graphGet(
      `/${biz.id}/owned_whatsapp_business_accounts?fields=id,name&limit=50`,
      token,
    )) as {
      data?: Array<{ id: string; name: string }>;
    };
    for (const waba of wabas.data ?? []) {
      const numbers = (await graphGet(
        `/${waba.id}/phone_numbers?fields=id,display_phone_number,verified_name&limit=100`,
        token,
      )) as {
        data?: Array<{ id: string; display_phone_number: string; verified_name?: string }>;
      };
      accounts.push({
        wabaId: waba.id,
        wabaName: waba.name ?? waba.id,
        phoneNumbers: (numbers.data ?? []).map((n) => ({
          phoneNumberId: n.id,
          displayPhoneNumber: n.display_phone_number ?? n.id,
          verifiedName: n.verified_name ?? null,
        })),
      });
    }
  }

  return { accounts, token };
}

/** Step 2c: stash the accounts as a short-lived pending connection (server only). */
export async function storePendingWhatsAppAccounts(
  workspaceId: string,
  uid: string,
  result: WhatsAppConnectResult,
): Promise<void> {
  await db()
    .collection("workspaces")
    .doc(workspaceId)
    .collection("integrations")
    .doc("whatsapp")
    .set(
      {
        status: "pending",
        accounts: result.accounts,
        token: result.token,
        oauthBy: uid,
        pendingAt: FieldValue.serverTimestamp(),
        pendingExpiresAtMs: Date.now() + STATE_TTL_MS,
      },
      { merge: true },
    );
}

export interface WhatsAppConnection {
  connected: boolean;
  pending: boolean;
  phoneNumberId: string | null;
  wabaId: string | null;
  displayName: string | null;
  verifiedName: string | null;
}

/** Read the WhatsApp connection doc (no tokens leave the server). */
export async function getWhatsAppConnection(workspaceId: string): Promise<WhatsAppConnection> {
  const snap = await db()
    .collection("workspaces")
    .doc(workspaceId)
    .collection("integrations")
    .doc("whatsapp")
    .get();
  const conn = (snap.data() ?? {}) as {
    status?: string;
    phoneNumberId?: string;
    wabaId?: string;
    displayName?: string;
    verifiedName?: string | null;
  };
  return {
    connected: conn.status === "connected" && !!conn.phoneNumberId,
    pending: conn.status === "pending",
    phoneNumberId: conn.phoneNumberId ?? null,
    wabaId: conn.wabaId ?? null,
    displayName: conn.displayName ?? null,
    verifiedName: conn.verifiedName ?? null,
  };
}

/** Pending accounts awaiting number selection (ids and names only). */
export async function listPendingWhatsAppAccounts(
  workspaceId: string,
): Promise<{ accounts: WhatsAppBusinessAccount[] }> {
  const snap = await db()
    .collection("workspaces")
    .doc(workspaceId)
    .collection("integrations")
    .doc("whatsapp")
    .get();
  const conn = (snap.data() ?? {}) as {
    status?: string;
    accounts?: WhatsAppBusinessAccount[];
    pendingExpiresAtMs?: number;
  };
  if (!conn || conn.status !== "pending" || !conn.accounts) {
    throw new Error("No pending WhatsApp connection. Please connect again.");
  }
  if ((conn.pendingExpiresAtMs ?? 0) < Date.now()) {
    throw new Error("Pending connection expired. Please connect again.");
  }
  return {
    accounts: conn.accounts.map((a) => ({
      wabaId: a.wabaId,
      wabaName: a.wabaName,
      phoneNumbers: (a.phoneNumbers ?? []).map((p) => ({
        phoneNumberId: p.phoneNumberId,
        displayPhoneNumber: p.displayPhoneNumber,
        verifiedName: p.verifiedName ?? null,
      })),
    })),
  };
}

/**
 * Step 4: persist the chosen phone number. The long-lived user token is
 * stored as the workspace's own Secret Manager secret; the connection doc
 * keeps the routing fields the webhook needs (phoneNumberId for
 * whatsapp_business_account events).
 */
export async function selectWhatsAppNumber(
  workspaceId: string,
  uid: string,
  phoneNumberId: string,
): Promise<{ phoneNumberId: string; displayName: string }> {
  const ref = db().collection("workspaces").doc(workspaceId).collection("integrations").doc("whatsapp");
  const snap = await ref.get();
  const conn = snap.data() as
    | {
        status?: string;
        accounts?: WhatsAppBusinessAccount[];
        token?: string;
        pendingExpiresAtMs?: number;
      }
    | undefined;
  if (!conn || conn.status !== "pending" || !conn.accounts || !conn.token) {
    throw new Error("No pending WhatsApp connection. Please connect again.");
  }
  if ((conn.pendingExpiresAtMs ?? 0) < Date.now()) {
    throw new Error("Pending connection expired. Please connect again.");
  }
  let match: { account: WhatsAppBusinessAccount; number: WhatsAppPhoneNumber } | null = null;
  for (const account of conn.accounts) {
    const number = (account.phoneNumbers ?? []).find((p) => p.phoneNumberId === phoneNumberId);
    if (number) {
      match = { account, number };
      break;
    }
  }
  if (!match) throw new Error("Phone number not found in this connection.");

  const secretId = workspaceWhatsAppTokenSecretId(workspaceId);
  const create = await secretManager(
    "POST",
    `projects/${PROJECT_ID}/secrets?secretId=${encodeURIComponent(secretId)}`,
    { replication: { automatic: {} } },
  );
  if (create.status !== 200 && create.status !== 409) {
    logger.error("Secret Manager create failed (WhatsApp)", { workspaceId, status: create.status });
    throw new Error("Could not store the WhatsApp token securely. Please try again.");
  }
  const addVersion = await secretManager("POST", `projects/${PROJECT_ID}/secrets/${secretId}:addVersion`, {
    payload: { data: Buffer.from(conn.token, "utf8").toString("base64") },
  });
  if (addVersion.status !== 200) {
    logger.error("Secret Manager addVersion failed (WhatsApp)", { workspaceId, status: addVersion.status });
    throw new Error("Could not store the WhatsApp token securely. Please try again.");
  }

  await ref.set(
    {
      status: "connected",
      phoneNumberId: match.number.phoneNumberId,
      wabaId: match.account.wabaId,
      displayName: match.number.displayPhoneNumber,
      verifiedName: match.number.verifiedName,
      secretName: secretId,
      connectedAt: FieldValue.serverTimestamp(),
      connectedBy: uid,
    },
    { merge: true },
  );
  // Drop the pending payload (including the token copy) now that the secret holds it.
  await ref.update({ accounts: FieldValue.delete(), token: FieldValue.delete() }).catch(() => undefined);
  return { phoneNumberId: match.number.phoneNumberId, displayName: match.number.displayPhoneNumber };
}
