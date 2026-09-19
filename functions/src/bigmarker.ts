/**
 * BigMarker integration (webinar platform).
 *
 * A workspace connects with its BigMarker API key (found in BigMarker under
 * user settings, API Key section). The key is stored as the workspace's own
 * Secret Manager secret; only connection metadata reaches the client.
 *
 * Server side pieces:
 * - connectBigmarker / disconnectBigmarker / getBigmarkerConnection
 * - listBigmarkerWebinars (upcoming webinars for the BotMaps picker)
 * - registerBigmarkerContact (idempotent via register_or_update, so an
 *   already registered contact is a success, not an error)
 * - getBigmarkerRegistrantStatus / syncBigmarkerStatus (registered,
 *   attended_live, attended_replay, no_show, not_registered) written onto
 *   the contact record so flows can branch on it
 *
 * API notes (docs.bigmarker.com): auth goes in the `API-KEY` header, base
 * `https://www.bigmarker.com/api/v1` (accounts may have their own
 * subdomain base URL, stored per workspace). register_or_update is POST
 * with x-www-form-urlencoded body. Attendance comes from the reporting
 * endpoints: live_attendees, on_demand_attendees, no_shows.
 *
 * Safety: 15s timeout on every BigMarker call, no retries that could
 * double register anyone, errors are logged without the key, and the key
 * never leaves the server.
 */
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { HttpsError } from "firebase-functions/v2/https";

const PROJECT_ID = "gen-lang-client-0433776094";
const DEFAULT_BASE_URL = "https://www.bigmarker.com";
const BM_TIMEOUT_MS = 15_000;
/** One attendance list page is enough for typical webinars; very large ones
 * may need a resync after BigMarker. Documented on the kanban card. */
const ATTENDANCE_PAGE_SIZE = 100;

const db = () => getFirestore("chatmize-prod");

/** Secret Manager secret id for a workspace's BigMarker API key. */
export function bigmarkerSecretId(workspaceId: string): string {
  const safe = workspaceId
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, "_")
    .slice(0, 100);
  return `BIGMARKER_KEY_WS_${safe}`;
}

async function smToken(): Promise<string> {
  const { GoogleAuth } = await import("google-auth-library");
  const auth = new GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  });
  const client = await auth.getClient();
  const t = await client.getAccessToken();
  if (!t.token) throw new Error("Could not mint a Secret Manager access token.");
  return t.token;
}

/** Create (or reuse) the per-workspace secret and store the key as a new version. */
async function storeApiKey(secretId: string, apiKey: string): Promise<void> {
  const token = await smToken();
  const base = `https://secretmanager.googleapis.com/v1/projects/${PROJECT_ID}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
  // secretId is a query param on create; 409 means the secret already exists.
  const createRes = await fetch(`${base}/secrets?secretId=${encodeURIComponent(secretId)}`, {
    method: "POST",
    headers,
    body: JSON.stringify({ replication: { automatic: {} } }),
  });
  if (createRes.status !== 200 && createRes.status !== 409) {
    const body = await createRes.text().catch(() => "");
    throw new Error(`Could not create the API key vault (${createRes.status}). ${body.slice(0, 200)}`);
  }
  const verRes = await fetch(`${base}/secrets/${secretId}:addVersion`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      payload: { data: Buffer.from(apiKey, "utf8").toString("base64") },
    }),
  });
  if (!verRes.ok) {
    const body = await verRes.text().catch(() => "");
    throw new Error(`Could not save the API key (${verRes.status}). ${body.slice(0, 200)}`);
  }
}

/** Read the latest secret version. Null on any failure; never logs the key. */
async function readApiKey(secretId: string): Promise<string | null> {
  try {
    const token = await smToken();
    const res = await fetch(
      `https://secretmanager.googleapis.com/v1/projects/${PROJECT_ID}/secrets/${secretId}/versions/latest:access`,
      { headers: { Authorization: `Bearer ${token}` } },
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

/** Best effort secret deletion on disconnect. */
async function deleteSecret(secretId: string): Promise<void> {
  try {
    const token = await smToken();
    await fetch(
      `https://secretmanager.googleapis.com/v1/projects/${PROJECT_ID}/secrets/${secretId}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      },
    );
  } catch (e) {
    logger.warn("BigMarker secret delete failed", { err: String(e) });
  }
}

/** Brief in-memory key cache (mirrors the IG token pattern). */
const keyCache = new Map<string, { value: string; baseUrl: string; expiresAt: number }>();

interface BigmarkerConnDoc {
  status?: string;
  secretName?: string;
  baseUrl?: string;
  connectedAtMs?: number;
}

const connRef = (workspaceId: string) =>
  db().collection("workspaces").doc(workspaceId).collection("integrations").doc("bigmarker");

async function getConn(workspaceId: string): Promise<BigmarkerConnDoc> {
  const snap = await connRef(workspaceId).get();
  return (snap.data() ?? {}) as BigmarkerConnDoc;
}

interface ResolvedKey {
  key: string;
  baseUrl: string;
}

/** Resolve the workspace key (cached 5 minutes). Null when not connected. */
async function resolveKey(workspaceId: string): Promise<ResolvedKey | null> {
  const hit = keyCache.get(workspaceId);
  if (hit && hit.expiresAt > Date.now()) return { key: hit.value, baseUrl: hit.baseUrl };
  keyCache.delete(workspaceId);
  const conn = await getConn(workspaceId);
  if (conn.status !== "connected" || !conn.secretName) return null;
  const key = await readApiKey(conn.secretName);
  if (!key) {
    logger.warn("Workspace BigMarker key unreadable, failing soft", { workspaceId });
    return null;
  }
  const baseUrl = conn.baseUrl || DEFAULT_BASE_URL;
  keyCache.set(workspaceId, { value: key, baseUrl, expiresAt: Date.now() + 5 * 60 * 1000 });
  return { key, baseUrl };
}

async function markKeyInvalid(workspaceId: string): Promise<void> {
  keyCache.delete(workspaceId);
  await connRef(workspaceId).set({ status: "key_invalid" }, { merge: true });
}

interface BmResponse {
  ok: boolean;
  status: number;
  data: unknown;
}

/** Single BigMarker API call. Throws on network failure, returns the parsed body otherwise. */
async function bmFetch(
  baseUrl: string,
  key: string,
  method: "GET" | "POST",
  path: string,
  body?: URLSearchParams,
): Promise<BmResponse> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), BM_TIMEOUT_MS);
  try {
    const res = await fetch(`${baseUrl}/api/v1${path}`, {
      method,
      headers: {
        "API-KEY": key,
        ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
      },
      body: body ? body.toString() : undefined,
      signal: ctrl.signal,
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } catch (e) {
    const reason = (e as Error).name === "AbortError" ? "timed out" : (e as Error).message;
    throw new Error(`BigMarker request failed: ${reason}`);
  } finally {
    clearTimeout(timer);
  }
}

/** Throw a friendly HttpsError when BigMarker rejects the call outright. */
function throwForStatus(res: BmResponse, workspaceId: string): void {
  if (res.ok) return;
  const err = (res.data as { error?: string })?.error ?? "";
  if (res.status === 401) {
    void markKeyInvalid(workspaceId).catch(() => undefined);
    throw new HttpsError(
      "failed-precondition",
      "BigMarker rejected the API key. Reconnect with a fresh key from your BigMarker settings.",
    );
  }
  throw new HttpsError(
    "unavailable",
    `BigMarker returned ${res.status}${err ? `: ${err}` : ""}. Please try again.`,
  );
}

export interface BigmarkerConnection {
  connected: boolean;
  keyInvalid: boolean;
  baseUrl: string | null;
  connectedAtMs: number | null;
}

/** Connection metadata for the client. The key never leaves the server. */
export async function getBigmarkerConnection(workspaceId: string): Promise<BigmarkerConnection> {
  const conn = await getConn(workspaceId);
  return {
    connected: conn.status === "connected",
    keyInvalid: conn.status === "key_invalid",
    baseUrl: conn.baseUrl ?? null,
    connectedAtMs: conn.connectedAtMs ?? null,
  };
}

function normalizeBaseUrl(raw: string | undefined): string {
  if (!raw || !raw.trim()) return DEFAULT_BASE_URL;
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new HttpsError("invalid-argument", "The BigMarker base URL is not a valid URL.");
  }
  if (url.protocol !== "https:") {
    throw new HttpsError("invalid-argument", "The BigMarker base URL must use https.");
  }
  return url.toString().replace(/\/+$/, "");
}

/** Validate the key against BigMarker, then vault it and mark the workspace connected. */
export async function connectBigmarker(
  workspaceId: string,
  apiKey: string,
  baseUrlRaw?: string,
): Promise<{ ok: true }> {
  const key = (apiKey || "").trim();
  if (!key) throw new HttpsError("invalid-argument", "Paste your BigMarker API key first.");
  const baseUrl = normalizeBaseUrl(baseUrlRaw);
  // Validate before storing: a bad key must never be saved.
  const probe = await bmFetch(baseUrl, key, "GET", "/conferences/?per_page=1&type=all");
  if (probe.status === 401) {
    throw new HttpsError(
      "invalid-argument",
      "BigMarker rejected that API key. Check it in your BigMarker settings under API Key and try again.",
    );
  }
  if (!probe.ok) {
    throw new HttpsError("unavailable", `BigMarker returned ${probe.status}. Please try again.`);
  }
  const secretId = bigmarkerSecretId(workspaceId);
  await storeApiKey(secretId, key);
  keyCache.delete(workspaceId);
  await connRef(workspaceId).set(
    {
      status: "connected",
      secretName: secretId,
      baseUrl,
      connectedAtMs: Date.now(),
    },
    { merge: true },
  );
  logger.info("BigMarker connected", { workspaceId, baseUrl });
  return { ok: true };
}

/** Disconnect: stop using the key and delete the vaulted copy. */
export async function disconnectBigmarker(workspaceId: string): Promise<{ ok: true }> {
  const conn = await getConn(workspaceId);
  await connRef(workspaceId).set({ status: "disconnected" }, { merge: true });
  keyCache.delete(workspaceId);
  if (conn.secretName) await deleteSecret(conn.secretName);
  logger.info("BigMarker disconnected", { workspaceId });
  return { ok: true };
}

export interface BigmarkerWebinar {
  id: string;
  title: string;
  startTime: string | null;
  conferenceAddress: string | null;
  type: string | null;
}

/** Upcoming webinars for the BotMaps picker. Client-side title filter. */
export async function listBigmarkerWebinars(
  workspaceId: string,
  query?: string,
): Promise<{ webinars: BigmarkerWebinar[] }> {
  const resolved = await resolveKey(workspaceId);
  if (!resolved) throw new HttpsError("failed-precondition", "Connect BigMarker first.");
  const params = new URLSearchParams({ type: "future", per_page: "50" });
  const res = await bmFetch(resolved.baseUrl, resolved.key, "GET", `/conferences/?${params.toString()}`);
  throwForStatus(res, workspaceId);
  const list = ((res.data as { conferences?: unknown[] }).conferences ?? []) as Array<{
    id?: string;
    title?: string;
    start_time?: string;
    conference_address?: string;
    type?: string;
  }>;
  const q = (query || "").trim().toLowerCase();
  const webinars: BigmarkerWebinar[] = [];
  for (const c of list) {
    if (!c.id || !c.title) continue;
    if (q && !c.title.toLowerCase().includes(q)) continue;
    webinars.push({
      id: c.id,
      title: c.title,
      startTime: c.start_time ?? null,
      conferenceAddress: c.conference_address ?? null,
      type: c.type ?? null,
    });
  }
  return { webinars };
}

interface ContactDoc {
  email?: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  tags?: string[];
  bigmarker?: Record<string, { status?: string; conferenceTitle?: string; syncedAtMs?: number }>;
}

function splitName(c: ContactDoc): { first: string; last: string } {
  const first = (c.firstName || "").trim();
  const last = (c.lastName || "").trim();
  if (first || last) return { first: first || "Guest", last: last || "Guest" };
  const parts = (c.name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: "Guest", last: "Guest" };
  if (parts.length === 1) return { first: parts[0], last: "Guest" };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

/** Tag applied on registration so broadcasts can target webinar registrants. */
export function bigmarkerTagFor(title: string): string {
  const clean = title.trim().replace(/\s+/g, " ");
  return `Webinar: ${clean}`.slice(0, 60);
}

/**
 * Register a contact for a webinar. Uses register_or_update, so a contact
 * who is already registered is simply refreshed: duplicates are a success,
 * never an error. Tags the contact for reminder broadcasts and records the
 * registration on the contact.
 */
export async function registerBigmarkerContact(
  workspaceId: string,
  conferenceId: string,
  contactId: string,
  conferenceTitle?: string,
): Promise<{ ok: true; conferenceUrl: string | null }> {
  if (!conferenceId) throw new HttpsError("invalid-argument", "conferenceId is required.");
  if (!contactId) throw new HttpsError("invalid-argument", "contactId is required.");
  const resolved = await resolveKey(workspaceId);
  if (!resolved) throw new HttpsError("failed-precondition", "Connect BigMarker first.");
  const ref = db().collection("contacts").doc(contactId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Contact not found.");
  const contact = snap.data() as ContactDoc;
  const email = (contact.email || "").trim();
  if (!email) {
    throw new HttpsError("invalid-argument", "This contact has no email address, so they cannot be registered.");
  }
  const { first, last } = splitName(contact);
  const body = new URLSearchParams({
    id: conferenceId,
    email,
    first_name: first,
    last_name: last,
    custom_user_id: contactId,
    utm_bmcr_source: "chatmize",
  });
  const res = await bmFetch(resolved.baseUrl, resolved.key, "POST", "/conferences/register_or_update", body);
  throwForStatus(res, workspaceId);
  const conferenceUrl = (res.data as { conference_url?: string }).conference_url ?? null;

  const title = (conferenceTitle || "").trim() || "BigMarker webinar";
  const tag = bigmarkerTagFor(title);
  const tags = Array.isArray(contact.tags) ? [...contact.tags] : [];
  if (!tags.includes(tag)) tags.push(tag);
  await ref.set(
    {
      tags,
      bigmarker: {
        ...(contact.bigmarker ?? {}),
        [conferenceId]: {
          status: "registered",
          conferenceTitle: title,
          syncedAtMs: Date.now(),
        },
      },
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  logger.info("BigMarker registration", { workspaceId, conferenceId, contactId });
  return { ok: true, conferenceUrl };
}

export type BigmarkerRegistrantStatus =
  | "registered"
  | "attended_live"
  | "attended_replay"
  | "no_show"
  | "not_registered";

async function emailInList(
  resolved: ResolvedKey,
  workspaceId: string,
  conferenceId: string,
  list: "live_attendees" | "on_demand_attendees" | "no_shows",
  email: string,
): Promise<boolean> {
  const params = new URLSearchParams({ per_page: String(ATTENDANCE_PAGE_SIZE) });
  const res = await bmFetch(
    resolved.baseUrl,
    resolved.key,
    "GET",
    `/reporting/conferences/${list}/${encodeURIComponent(conferenceId)}?${params.toString()}`,
  );
  if (!res.ok) {
    logger.warn("BigMarker attendance list failed", {
      workspaceId,
      conferenceId,
      list,
      status: res.status,
    });
    return false;
  }
  const data = res.data as {
    attendees?: Array<{ email?: string }>;
    registrations?: Array<{ email?: string }>;
  };
  const rows = data.attendees ?? data.registrations ?? [];
  const want = email.toLowerCase();
  return rows.some((r) => (r.email || "").toLowerCase() === want);
}

/**
 * Resolve one registrant's status: attended live, watched the replay,
 * no-show, registered, or not registered. Reads the reporting endpoints
 * BigMarker documents for exactly this.
 */
export async function getBigmarkerRegistrantStatus(
  workspaceId: string,
  conferenceId: string,
  email: string,
): Promise<BigmarkerRegistrantStatus> {
  if (!conferenceId) throw new HttpsError("invalid-argument", "conferenceId is required.");
  if (!email) throw new HttpsError("invalid-argument", "email is required.");
  const resolved = await resolveKey(workspaceId);
  if (!resolved) throw new HttpsError("failed-precondition", "Connect BigMarker first.");
  const check = await bmFetch(
    resolved.baseUrl,
    resolved.key,
    "GET",
    `/conferences/${encodeURIComponent(conferenceId)}/check_registration_status?email=${encodeURIComponent(email)}`,
  );
  if (check.status === 404) return "not_registered";
  throwForStatus(check, workspaceId);
  const regStatus = (check.data as { registration_status?: string }).registration_status;
  if (regStatus && regStatus !== "registered") return "not_registered";
  if (await emailInList(resolved, workspaceId, conferenceId, "live_attendees", email)) {
    return "attended_live";
  }
  if (await emailInList(resolved, workspaceId, conferenceId, "on_demand_attendees", email)) {
    return "attended_replay";
  }
  if (await emailInList(resolved, workspaceId, conferenceId, "no_shows", email)) {
    return "no_show";
  }
  return "registered";
}

/** Pull the latest status onto the contact record so flows can branch on it. */
export async function syncBigmarkerStatus(
  workspaceId: string,
  conferenceId: string,
  contactId: string,
  conferenceTitle?: string,
): Promise<{ ok: true; status: BigmarkerRegistrantStatus }> {
  if (!contactId) throw new HttpsError("invalid-argument", "contactId is required.");
  const ref = db().collection("contacts").doc(contactId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Contact not found.");
  const contact = snap.data() as ContactDoc;
  const email = (contact.email || "").trim();
  if (!email) throw new HttpsError("invalid-argument", "This contact has no email address.");
  const status = await getBigmarkerRegistrantStatus(workspaceId, conferenceId, email);
  const title = (conferenceTitle || "").trim() || contact.bigmarker?.[conferenceId]?.conferenceTitle || "BigMarker webinar";
  await ref.set(
    {
      bigmarker: {
        ...(contact.bigmarker ?? {}),
        [conferenceId]: { status, conferenceTitle: title, syncedAtMs: Date.now() },
      },
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  return { ok: true, status };
}

/**
 * Action router, folded into the shared admin callable (new Cloud Functions
 * cannot be created through the deploy proxy). Called after workspace
 * access is verified by the caller.
 */
export async function handleBigmarkerAction(
  action: string,
  data: Record<string, unknown>,
  workspaceId: string,
): Promise<unknown> {
  switch (action) {
    case "bigmarkerStatus":
      return getBigmarkerConnection(workspaceId);
    case "bigmarkerConnect":
      return connectBigmarker(
        workspaceId,
        String(data.apiKey ?? ""),
        typeof data.baseUrl === "string" ? data.baseUrl : undefined,
      );
    case "bigmarkerDisconnect":
      return disconnectBigmarker(workspaceId);
    case "bigmarkerListWebinars":
      return listBigmarkerWebinars(
        workspaceId,
        typeof data.query === "string" ? data.query : undefined,
      );
    case "bigmarkerRegister":
      return registerBigmarkerContact(
        workspaceId,
        String(data.conferenceId ?? ""),
        String(data.contactId ?? ""),
        typeof data.conferenceTitle === "string" ? data.conferenceTitle : undefined,
      );
    case "bigmarkerSyncStatus":
      return syncBigmarkerStatus(
        workspaceId,
        String(data.conferenceId ?? ""),
        String(data.contactId ?? ""),
        typeof data.conferenceTitle === "string" ? data.conferenceTitle : undefined,
      );
    default:
      throw new HttpsError("invalid-argument", `Unknown BigMarker action: ${action}`);
  }
}
