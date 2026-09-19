/**
 * Google Sheets integration.
 *
 * OAuth: the workspace owner connects a Google account via Google's OAuth 2.0
 * flow. We request only the spreadsheets scope (read and write the user's
 * sheets) plus the email scope (to show which account is connected). We never
 * request Drive access: the workspace picks its sheet by pasting a link or ID.
 *
 * Tokens: the refresh token lives in Secret Manager under a per-workspace
 * secret (GOOGLE_SHEETS_TOKEN_WS_<SAFE_ID>) and is never written to Firestore
 * or logs. The Firestore doc workspaces/{ws}/integrations/google_sheets
 * carries only the connection metadata (email, spreadsheet id, status).
 *
 * BotMaps uses this two ways:
 *  - append a row: map captured variables / contact fields to column headers.
 *  - read rows: look up rows by matching a column value, so flows can
 *    personalize from sheet data.
 *
 * The MCP API exposes the same operations (sheets_append_row, sheets_read_rows)
 * so API users get everything the app can do.
 *
 * Console steps Karl must do once (Mac): create a Google OAuth 2.0 client in
 * Google Cloud Console, add https://app.chatmize.com/googleOAuthCallback as an
 * authorized redirect URI, then store the client id and secret:
 *   firebase functions:secrets:set GOOGLE_OAUTH_CLIENT_ID
 *   firebase functions:secrets:set GOOGLE_OAUTH_CLIENT_SECRET
 */
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { defineSecret } from "firebase-functions/params";

export const GOOGLE_OAUTH_CLIENT_ID = defineSecret("GOOGLE_OAUTH_CLIENT_ID");
export const GOOGLE_OAUTH_CLIENT_SECRET = defineSecret("GOOGLE_OAUTH_CLIENT_SECRET");

const db = () => getFirestore("chatmize-prod");
const PROJECT_ID = "gen-lang-client-0433776094";
const APP_RETURN_URL = "https://app.chatmize.com/";

export const GOOGLE_OAUTH_CALLBACK_URL = `${APP_RETURN_URL}googleOAuthCallback`;

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";
const SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";

// Only the scopes we need. No Drive: the workspace pastes the sheet link.
const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/userinfo.email",
];

const STATE_TTL_MS = 10 * 60 * 1000;
const SHEETS_TIMEOUT_MS = 15_000;

/** Secret Manager secret id for a workspace's Google refresh token. */
export function googleSheetsTokenSecretId(workspaceId: string): string {
  const safe = workspaceId.toUpperCase().replace(/[^A-Z0-9_]/g, "_").slice(0, 100);
  return `GOOGLE_SHEETS_TOKEN_WS_${safe}`;
}

export interface GoogleSheetsConnection {
  status?: "connected" | "token_invalid";
  email?: string;
  connectedAt?: unknown;
  connectedBy?: string;
  secretName?: string;
  spreadsheetId?: string;
  spreadsheetTitle?: string;
}

const connRef = (workspaceId: string) =>
  db().collection("workspaces").doc(workspaceId).collection("integrations").doc("google_sheets");

// ---------------------------------------------------------------------------
// Plumbing: GCP access token + Secret Manager + timed fetch
// ---------------------------------------------------------------------------

const gcpCache = new Map<string, { value: string; expiresAt: number }>();

function cacheGet(key: string): string | null {
  const hit = gcpCache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value;
  return null;
}

function cacheSet(key: string, value: string, ttlMs: number): void {
  gcpCache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

async function gcpAccessToken(): Promise<string> {
  const cached = cacheGet("gcp_access_token");
  if (cached) return cached;
  const res = await fetch(
    "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token",
    { headers: { "Metadata-Flavor": "Google" } },
  );
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

/** Fetch with a hard timeout so a slow Google API never hangs a function. */
async function timedFetch(url: string, init: RequestInit, timeoutMs = SHEETS_TIMEOUT_MS): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

// ---------------------------------------------------------------------------
// OAuth: start + callback
// ---------------------------------------------------------------------------

const RETURN_TO_RE = /^[a-z]+:[a-z_]+$/;

function sanitizeReturnTo(value: unknown): string | undefined {
  if (typeof value !== "string" || !RETURN_TO_RE.test(value)) return undefined;
  return value;
}

interface GoogleOAuthState {
  workspaceId: string;
  uid: string;
  returnTo?: string;
  expiresAtMs: number;
}

/** Step 1: create a one-time state and return the Google consent URL. */
export async function buildGoogleSheetsLoginUrl(
  workspaceId: string,
  uid: string,
  returnTo?: unknown,
): Promise<string> {
  const clientId = GOOGLE_OAUTH_CLIENT_ID.value();
  if (!clientId) throw new Error("Google OAuth is not configured yet. Ask support to set it up.");
  const { randomUUID } = await import("crypto");
  const state = randomUUID().replace(/-/g, "");
  await db().collection("google_sheets_oauth_states").doc(state).set({
    workspaceId,
    uid,
    returnTo: sanitizeReturnTo(returnTo),
    createdAt: FieldValue.serverTimestamp(),
    expiresAtMs: Date.now() + STATE_TTL_MS,
  });
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: GOOGLE_OAUTH_CALLBACK_URL,
    response_type: "code",
    scope: GOOGLE_SCOPES.join(" "),
    state,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

/** Step 2: validate and consume the one-time state (single use). */
export async function consumeGoogleSheetsOAuthState(state: string): Promise<GoogleOAuthState> {
  const ref = db().collection("google_sheets_oauth_states").doc(state);
  const snap = await ref.get();
  if (!snap.exists) throw new Error("Login session not found. Please try again.");
  const data = snap.data() as GoogleOAuthState;
  await ref.delete();
  if (data.expiresAtMs < Date.now()) {
    throw new Error("Login session expired. Please try again.");
  }
  return data;
}

interface GoogleTokenSet {
  refresh_token?: string;
  access_token: string;
  expires_in: number;
}

/** Step 3: exchange the auth code for tokens. */
export async function exchangeGoogleSheetsCode(code: string): Promise<GoogleTokenSet> {
  const clientId = GOOGLE_OAUTH_CLIENT_ID.value();
  const clientSecret = GOOGLE_OAUTH_CLIENT_SECRET.value();
  const res = await timedFetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: GOOGLE_OAUTH_CALLBACK_URL,
      grant_type: "authorization_code",
    }).toString(),
  });
  const data = (await res.json()) as GoogleTokenSet & { error?: string; error_description?: string };
  if (!res.ok || !data.access_token) {
    logger.warn("Google token exchange failed", { status: res.status, error: data.error });
    throw new Error("Google did not approve the connection. Please try again.");
  }
  return data;
}

/** Persist the refresh token as a new Secret Manager version (create if needed). */
async function storeGoogleRefreshToken(workspaceId: string, payload: Record<string, unknown>): Promise<string> {
  const secretId = googleSheetsTokenSecretId(workspaceId);
  const create = await secretManager(
    "POST",
    `projects/${PROJECT_ID}/secrets?secretId=${encodeURIComponent(secretId)}`,
    { replication: { automatic: {} } },
  );
  if (create.status !== 200 && create.status !== 409) {
    logger.error("Secret Manager create failed", { workspaceId, status: create.status });
    throw new Error("Could not store the Google token securely. Please try again.");
  }
  const addVersion = await secretManager(
    "POST",
    `projects/${PROJECT_ID}/secrets/${secretId}:addVersion`,
    { payload: { data: Buffer.from(JSON.stringify(payload), "utf8").toString("base64") } },
  );
  if (addVersion.status !== 200) {
    logger.error("Secret Manager addVersion failed", { workspaceId, status: addVersion.status });
    throw new Error("Could not store the Google token securely. Please try again.");
  }
  return secretId;
}

/** Step 4: finalize the connection (called from the OAuth callback). */
export async function connectGoogleSheetsAccount(
  workspaceId: string,
  uid: string,
  tokens: GoogleTokenSet,
): Promise<{ email: string }> {
  if (!tokens.refresh_token) {
    // prompt=consent means Google always returns one, but guard anyway.
    throw new Error("Google did not return a refresh token. Please reconnect.");
  }
  const userRes = await timedFetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const user = (await userRes.json()) as { email?: string };
  const email = typeof user.email === "string" ? user.email : "unknown";
  const secretName = await storeGoogleRefreshToken(workspaceId, {
    refresh_token: tokens.refresh_token,
    access_token: tokens.access_token,
    expires_at_ms: Date.now() + tokens.expires_in * 1000,
    email,
    updated_at_ms: Date.now(),
  });
  await connRef(workspaceId).set(
    {
      status: "connected",
      email,
      connectedAt: FieldValue.serverTimestamp(),
      connectedBy: uid,
      secretName,
    },
    { merge: true },
  );
  return { email };
}

export function googleSheetsReturnUrl(outcome: "success" | "error", message?: string, returnTo?: string): string {
  const params = new URLSearchParams({ google_sheets: outcome });
  if (message) params.set("google_sheets_error", message.slice(0, 200));
  if (returnTo) params.set("return_to", returnTo);
  return `${APP_RETURN_URL}?${params.toString()}`;
}

// ---------------------------------------------------------------------------
// Workspace-facing operations (called from the onCall dispatcher in index.ts)
// ---------------------------------------------------------------------------

export interface GoogleSheetsStatus {
  connected: boolean;
  tokenInvalid: boolean;
  email: string | null;
  spreadsheetId: string | null;
  spreadsheetTitle: string | null;
}

/** Connection status for the client (no tokens leave the server). */
export async function getGoogleSheetsStatus(workspaceId: string): Promise<GoogleSheetsStatus> {
  const snap = await connRef(workspaceId).get();
  const conn = snap.data() as GoogleSheetsConnection | undefined;
  if (!conn || conn.status !== "connected") {
    return {
      connected: false,
      tokenInvalid: conn?.status === "token_invalid",
      email: null,
      spreadsheetId: null,
      spreadsheetTitle: null,
    };
  }
  return {
    connected: true,
    tokenInvalid: false,
    email: conn.email ?? null,
    spreadsheetId: conn.spreadsheetId ?? null,
    spreadsheetTitle: conn.spreadsheetTitle ?? null,
  };
}

/** Disconnect: revoke at Google, destroy the stored token, clear the doc. */
export async function disconnectGoogleSheets(workspaceId: string): Promise<{ ok: true }> {
  const snap = await connRef(workspaceId).get();
  const conn = snap.data() as GoogleSheetsConnection | undefined;
  // Best effort revoke at Google so the grant dies even if we kept a copy.
  try {
    const stored = conn?.secretName
      ? await readStoredToken(workspaceId, conn.secretName)
      : null;
    if (stored?.refresh_token) {
      await timedFetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(stored.refresh_token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });
    }
  } catch {
    // Revoke is best effort; the secret is destroyed below regardless.
  }
  if (conn?.secretName) {
    await secretManager("DELETE", `projects/${PROJECT_ID}/secrets/${conn.secretName}`);
    gcpCache.delete(`gsheets:${workspaceId}`);
  }
  await connRef(workspaceId).delete();
  logger.info("Google Sheets disconnected", { workspaceId });
  return { ok: true };
}

/**
 * Pick the workspace spreadsheet: accept a pasted link or id, verify Google
 * can open it, then store the id + title.
 */
export async function setGoogleSheetsSpreadsheet(
  workspaceId: string,
  input: string,
): Promise<{ spreadsheetId: string; title: string }> {
  const spreadsheetId = extractSpreadsheetId(input);
  const meta = (await sheetsApi(
    workspaceId,
    "GET",
    `/${encodeURIComponent(spreadsheetId)}?fields=properties.title`,
  )) as { properties?: { title?: string } };
  const title = meta.properties?.title ?? "Untitled spreadsheet";
  await connRef(workspaceId).set(
    { spreadsheetId, spreadsheetTitle: title },
    { merge: true },
  );
  logger.info("Google Sheets spreadsheet set", { workspaceId, title });
  return { spreadsheetId, title };
}

// ---------------------------------------------------------------------------
// Token resolution (refresh when expired) + Sheets API calls
// ---------------------------------------------------------------------------

interface StoredGoogleToken {
  refresh_token: string;
  access_token: string;
  expires_at_ms: number;
  email: string;
}

async function readStoredToken(workspaceId: string, secretName: string): Promise<StoredGoogleToken | null> {
  const { status, data } = await secretManager(
    "GET",
    `projects/${PROJECT_ID}/secrets/${secretName}/versions/latest:access`,
  );
  if (status !== 200) return null;
  const payload = (data as { payload?: { data?: string } }).payload?.data;
  if (!payload) return null;
  try {
    return JSON.parse(Buffer.from(payload, "base64").toString("utf8")) as StoredGoogleToken;
  } catch {
    return null;
  }
}

/**
 * Resolve a live Google access token for the workspace, refreshing the
 * offline grant when it is close to expiry. Throws when not connected or
 * when Google revoked the grant (caller flags the integration token_invalid).
 */
export async function resolveGoogleAccessToken(workspaceId: string): Promise<string> {
  const snap = await connRef(workspaceId).get();
  const conn = snap.data() as GoogleSheetsConnection | undefined;
  if (conn?.status !== "connected" || !conn.secretName) {
    throw new Error("Google Sheets is not connected for this workspace.");
  }
  const cached = cacheGet(`gsheets:${workspaceId}`);
  if (cached) return cached;
  const stored = await readStoredToken(workspaceId, conn.secretName);
  if (!stored) {
    throw new Error("Could not read the stored Google token.");
  }
  if (stored.expires_at_ms - Date.now() > 60_000) {
    cacheSet(`gsheets:${workspaceId}`, stored.access_token, 50 * 60 * 1000);
    return stored.access_token;
  }
  // Refresh the grant.
  const res = await timedFetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_OAUTH_CLIENT_ID.value(),
      client_secret: GOOGLE_OAUTH_CLIENT_SECRET.value(),
      refresh_token: stored.refresh_token,
      grant_type: "refresh_token",
    }).toString(),
  });
  const data = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
  };
  if (!res.ok || !data.access_token) {
    logger.warn("Google token refresh failed", { workspaceId, status: res.status, error: data.error });
    await connRef(workspaceId).set({ status: "token_invalid" }, { merge: true });
    gcpCache.delete(`gsheets:${workspaceId}`);
    throw new Error("Google revoked access. Reconnect Google Sheets in Settings.");
  }
  const next: StoredGoogleToken = {
    refresh_token: stored.refresh_token,
    access_token: data.access_token,
    expires_at_ms: Date.now() + (data.expires_in ?? 3600) * 1000,
    email: stored.email,
  };
  await secretManager(
    "POST",
    `projects/${PROJECT_ID}/secrets/${conn.secretName}:addVersion`,
    { payload: { data: Buffer.from(JSON.stringify(next), "utf8").toString("base64") } },
  );
  cacheSet(`gsheets:${workspaceId}`, next.access_token, 50 * 60 * 1000);
  return next.access_token;
}

export interface SheetsApiError extends Error {
  status: number | null;
}

/** Call the Sheets v4 API for a connected workspace. Throws on any failure. */
export async function sheetsApi(
  workspaceId: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<unknown> {
  const accessToken = await resolveGoogleAccessToken(workspaceId);
  let res: Response;
  try {
    res = await timedFetch(`${SHEETS_API}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    logger.warn("Sheets API call timed out or failed", { workspaceId, path });
    const e = new Error("Google Sheets did not respond in time. Please try again.") as SheetsApiError;
    e.status = null;
    throw e;
  }
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const msg = (data as { error?: { message?: string } })?.error?.message;
    logger.warn("Sheets API error", { workspaceId, path, status: res.status, msg });
    const e = new Error(
      res.status === 404
        ? "That spreadsheet or tab was not found. Check the link and sharing."
        : res.status === 403
          ? "Google says no: make sure the sheet is shared with the connected account."
          : `Google Sheets error (${res.status}). ${msg ?? "Please try again."}`,
    ) as SheetsApiError;
    e.status = res.status;
    throw e;
  }
  return data;
}

/** Accept a full docs.google.com URL or a raw spreadsheet id. */
export function extractSpreadsheetId(input: string): string {
  const trimmed = input.trim();
  const m = /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/.exec(trimmed);
  if (m) return m[1];
  if (/^[a-zA-Z0-9-_]{20,}$/.test(trimmed)) return trimmed;
  throw new Error("That does not look like a Google Sheet link or id.");
}

export interface SheetTab {
  title: string;
  headers: string[];
}

/** Tabs + first-row headers for the column mapping UI. */
export async function listSheetsTabs(workspaceId: string, spreadsheetId: string): Promise<SheetTab[]> {
  const meta = (await sheetsApi(
    workspaceId,
    "GET",
    `/${encodeURIComponent(spreadsheetId)}?fields=sheets.properties.title`,
  )) as { sheets?: Array<{ properties?: { title?: string } }> };
  const titles = (meta.sheets ?? [])
    .map((s) => s.properties?.title)
    .filter((t): t is string => !!t);
  const out: SheetTab[] = [];
  for (const title of titles.slice(0, 25)) {
    try {
      const vals = (await sheetsApi(
        workspaceId,
        "GET",
        `/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(title)}!1:1`,
      )) as { values?: string[][] };
      out.push({ title, headers: (vals.values?.[0] ?? []).map(String) });
    } catch {
      out.push({ title, headers: [] });
    }
  }
  return out;
}

/** The workspace's chosen spreadsheet (falls back to the explicit id). */
export async function resolveSpreadsheetId(
  workspaceId: string,
  explicitId?: string,
): Promise<string> {
  if (explicitId) return explicitId;
  const snap = await connRef(workspaceId).get();
  const conn = snap.data() as GoogleSheetsConnection | undefined;
  if (!conn?.spreadsheetId) {
    throw new Error("Pick a spreadsheet in Settings > Integrations > Google Sheets first.");
  }
  return conn.spreadsheetId;
}

export interface SheetsRow {
  [header: string]: string;
}

/**
 * Read rows from a tab. The first row is treated as headers; every row comes
 * back keyed by header. Optionally keep only rows where a column matches.
 */
export async function readSheetsRows(
  workspaceId: string,
  opts: { spreadsheetId?: string; tab: string; matchHeader?: string; matchValue?: string; limit?: number },
): Promise<{ headers: string[]; rows: SheetsRow[] }> {
  const spreadsheetId = await resolveSpreadsheetId(workspaceId, opts.spreadsheetId);
  if (!opts.tab) throw new Error("A tab name is required.");
  const data = (await sheetsApi(
    workspaceId,
    "GET",
    `/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(opts.tab)}`,
  )) as { values?: string[][] };
  const values = data.values ?? [];
  const headers = values.length > 0 ? values[0].map(String) : [];
  const limit = Math.min(Math.max(opts.limit ?? 100, 1), 500);
  const rows: SheetsRow[] = [];
  for (const raw of values.slice(1)) {
    const row: SheetsRow = {};
    headers.forEach((h, i) => {
      row[h] = raw[i] ?? "";
    });
    if (opts.matchHeader && opts.matchValue !== undefined) {
      if (String(row[opts.matchHeader] ?? "") !== opts.matchValue) continue;
    }
    rows.push(row);
    if (rows.length >= limit) break;
  }
  return { headers, rows };
}

/**
 * Append one row to a tab. `values` maps column header -> cell value; cells
 * land under the matching header, unknown headers are ignored.
 */
export async function appendSheetsRow(
  workspaceId: string,
  opts: { spreadsheetId?: string; tab: string; values: Record<string, string> },
): Promise<{ updatedRange: string | null }> {
  const spreadsheetId = await resolveSpreadsheetId(workspaceId, opts.spreadsheetId);
  if (!opts.tab) throw new Error("A tab name is required.");
  const headerData = (await sheetsApi(
    workspaceId,
    "GET",
    `/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(opts.tab)}!1:1`,
  )) as { values?: string[][] };
  const headers = (headerData.values?.[0] ?? []).map(String);
  if (headers.length === 0) {
    throw new Error("The tab has no header row. Put column names in row 1 first.");
  }
  const row = headers.map((h) => opts.values[h] ?? "");
  const data = (await sheetsApi(
    workspaceId,
    "POST",
    `/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(opts.tab)}:append` +
      `?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    { values: [row] },
  )) as { updates?: { updatedRange?: string } };
  logger.info("Sheets row appended", { workspaceId, tab: opts.tab });
  return { updatedRange: data.updates?.updatedRange ?? null };
}
