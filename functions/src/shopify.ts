/**
 * Shopify integration: OAuth connect, webhook receiver, and BotMaps commerce
 * events (abandoned cart, order updates, product purchases).
 *
 * App model: one ChatMize Shopify app (custom app via the Partner dashboard).
 * Merchants install it through the standard OAuth flow; the offline access
 * token lands in Secret Manager as the workspace's own secret
 * (SHOPIFY_TOKEN_WS_<id>). Nothing secret ever reaches the browser or logs.
 *
 * Webhooks: registered at connect time against the public HTTPS endpoint
 * https://app.chatmize.com/shopifyWebhook (hosting rewrite -> shopifyWebhook).
 * Every delivery is HMAC verified with the app client secret before any
 * processing, and the 200 goes back fast (Shopify retries on slow replies).
 *
 * BotMaps wiring: webhook topics are normalized into pending commerce events
 * at workspaces/{ws}/shopify_events. The flow runtime (when it lands) picks
 * those up and fires the matching BotMap triggers; cart and order details
 * are attached as variables for personalization ({{cart_recovery_url}} etc).
 * Abandoned carts are detected by an hourly sweep: a checkout that stays
 * open past the workspace's abandonment window with no matching order.
 *
 * Serverless and cheap: no background workers, no retries that could double
 * send. Every Admin API call has a timeout and logs failures server side.
 */
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { createHmac, timingSafeEqual, randomUUID } from "crypto";
import { SHOPIFY_CLIENT_ID, SHOPIFY_CLIENT_SECRET } from "./secrets";

/** Latest stable Shopify Admin API version at build time (quarterly releases). */
export const SHOPIFY_API_VERSION = "2026-07";
/** Shared OAuth callback (hosting rewrite -> shopifyOAuthCallback). */
export const SHOPIFY_OAUTH_CALLBACK_URL =
  "https://app.chatmize.com/shopifyOAuthCallback";
/** Public webhook receiver (hosting rewrite -> shopifyWebhook). */
export const SHOPIFY_WEBHOOK_URL = "https://app.chatmize.com/shopifyWebhook";
const APP_RETURN_URL = "https://app.chatmize.com/";
const PROJECT_ID = "gen-lang-client-0433776094";

/**
 * Least-privilege scopes: read orders + fulfillments (order updates),
 * read customers (contact matching), read checkouts (cart recovery).
 * No write scopes; ChatMize never mutates the merchant's store.
 */
export const SHOPIFY_OAUTH_SCOPES = [
  "read_orders",
  "read_customers",
  "read_checkouts",
];

/** Webhook topics registered on the store at connect time. */
export const SHOPIFY_WEBHOOK_TOPICS = [
  "checkouts/create",
  "checkouts/update",
  "orders/create",
  "orders/paid",
  "orders/updated",
  "fulfillments/create",
  "fulfillments/update",
  "app/uninstalled",
] as const;

const STATE_TTL_MS = 10 * 60 * 1000;
const RETURN_TO_RE = /^[a-z]+:[a-z_]+$/;
/** Admin API timeout: fail fast, never hang a webhook or callable. */
const ADMIN_TIMEOUT_MS = 15000;
/** Default minutes an open checkout waits before it counts as abandoned. */
export const DEFAULT_ABANDONED_MINUTES = 60;

function db() {
  return getFirestore("chatmize-prod");
}

/** Tiny in-memory cache for tokens and GCP access tokens. */
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

async function secretManager(
  method: "POST" | "GET",
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
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

/** Secret Manager secret id for a workspace's Shopify token. */
export function workspaceShopifyTokenSecretId(workspaceId: string): string {
  const safe = workspaceId
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, "_")
    .slice(0, 100);
  return `SHOPIFY_TOKEN_WS_${safe}`;
}

function sanitizeReturnTo(value: unknown): string | undefined {
  if (typeof value !== "string" || !RETURN_TO_RE.test(value)) return undefined;
  return value;
}

/** Validate a merchant-supplied shop domain: must be *.myshopify.com. */
export function normalizeShopDomain(raw: string): string | null {
  const shop = raw.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(shop)) return null;
  return shop;
}

/** fetch with a hard timeout. No retries: callers decide what a failure means. */
async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = ADMIN_TIMEOUT_MS,
): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// OAuth
// ---------------------------------------------------------------------------

interface ShopifyOAuthState {
  workspaceId: string;
  uid: string;
  shop: string;
  returnTo?: string;
  expiresAtMs: number;
}

/** Step 1: one-time state, then the merchant is sent to Shopify to approve. */
export async function buildShopifyLoginUrl(
  workspaceId: string,
  uid: string,
  shop: string,
  returnTo?: unknown,
): Promise<string> {
  const state = randomUUID().replace(/-/g, "");
  await db()
    .collection("shopify_oauth_states")
    .doc(state)
    .set({
      workspaceId,
      uid,
      shop,
      returnTo: sanitizeReturnTo(returnTo),
      createdAt: FieldValue.serverTimestamp(),
      expiresAtMs: Date.now() + STATE_TTL_MS,
    });
  const params = new URLSearchParams({
    client_id: SHOPIFY_CLIENT_ID.value(),
    scope: SHOPIFY_OAUTH_SCOPES.join(","),
    redirect_uri: SHOPIFY_OAUTH_CALLBACK_URL,
    state,
    "grant_options[]": "per-user",
  });
  // Offline (permanent) token: no grant_options online-access flag.
  return `https://${shop}/admin/oauth/authorize?${params.toString()}`;
}

/** Step 2a: consume the one-time state (single use, then deleted). */
export async function consumeShopifyOAuthState(
  state: string,
): Promise<ShopifyOAuthState> {
  const ref = db().collection("shopify_oauth_states").doc(state);
  const snap = await ref.get();
  if (!snap.exists) throw new Error("Invalid or expired login session. Please try again.");
  const data = snap.data() as ShopifyOAuthState;
  await ref.delete();
  if (data.expiresAtMs < Date.now()) {
    throw new Error("Login session expired. Please try again.");
  }
  return data;
}

/** Step 2b: authorization code -> permanent offline access token. */
export async function exchangeShopifyCode(
  shop: string,
  code: string,
): Promise<string> {
  const res = await fetchWithTimeout(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: SHOPIFY_CLIENT_ID.value(),
      client_secret: SHOPIFY_CLIENT_SECRET.value(),
      code,
    }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !data.access_token) {
    throw new Error(
      `Shopify token exchange failed: ${data.error_description ?? data.error ?? res.status}`,
    );
  }
  return data.access_token;
}

export interface ShopifyShopInfo {
  name: string;
  domain: string;
  email: string;
  currency: string;
}

/** Step 2c: confirm the token works and learn the store's name. */
export async function fetchShopInfo(
  shop: string,
  token: string,
): Promise<ShopifyShopInfo> {
  const { status, data } = await shopifyAdmin(shop, token, "/shop.json");
  if (status !== 200) throw new Error(`Could not read the store (HTTP ${status}).`);
  const s = (data as { shop?: Record<string, unknown> }).shop ?? {};
  return {
    name: String(s.name ?? shop),
    domain: shop,
    email: String(s.email ?? ""),
    currency: String(s.currency ?? "USD"),
  };
}

/** Step 2d: token -> Secret Manager, connection doc, webhook registration. */
export async function connectShopifyStore(
  workspaceId: string,
  uid: string,
  shop: string,
  token: string,
  info: ShopifyShopInfo,
): Promise<void> {
  const secretId = workspaceShopifyTokenSecretId(workspaceId);
  const create = await secretManager(
    "POST",
    `projects/${PROJECT_ID}/secrets?secretId=${encodeURIComponent(secretId)}`,
    { replication: { automatic: {} } },
  );
  if (create.status !== 200 && create.status !== 409) {
    logger.error("Shopify secret create failed", { workspaceId, status: create.status });
    throw new Error("Could not store the Shopify token securely. Please try again.");
  }
  const addVersion = await secretManager(
    "POST",
    `projects/${PROJECT_ID}/secrets/${secretId}:addVersion`,
    { payload: { data: Buffer.from(token, "utf8").toString("base64") } },
  );
  if (addVersion.status !== 200) {
    logger.error("Shopify secret addVersion failed", { workspaceId, status: addVersion.status });
    throw new Error("Could not store the Shopify token securely. Please try again.");
  }

  const ref = db()
    .collection("workspaces")
    .doc(workspaceId)
    .collection("integrations")
    .doc("shopify");
  await ref.set(
    {
      status: "connected",
      shopDomain: info.domain,
      shopName: info.name,
      shopEmail: info.email,
      currency: info.currency,
      secretName: secretId,
      scopes: SHOPIFY_OAUTH_SCOPES,
      abandonedCartMinutes: DEFAULT_ABANDONED_MINUTES,
      connectedAt: FieldValue.serverTimestamp(),
      connectedBy: uid,
    },
    { merge: true },
  );
  cache.delete(`shopifytoken:${workspaceId}`);

  // Register webhooks. A failed topic is logged and recorded; the connection
  // itself is still good and the owner can retry from Settings.
  const failed: string[] = [];
  for (const topic of SHOPIFY_WEBHOOK_TOPICS) {
    try {
      await registerShopifyWebhook(shop, token, topic);
    } catch (err) {
      failed.push(topic);
      logger.error("Shopify webhook registration failed", {
        workspaceId,
        topic,
        error: err instanceof Error ? err.message : "unknown",
      });
    }
  }
  if (failed.length > 0) {
    await ref.set({ webhookFailures: failed, webhookFailedAt: FieldValue.serverTimestamp() }, { merge: true });
  } else {
    await ref.set(
      { webhookFailures: FieldValue.delete(), webhookFailedAt: FieldValue.delete() },
      { merge: true },
    );
  }
  logger.info("Shopify store connected", { workspaceId, shop, failedTopics: failed.length });
}

export function shopifyAppReturnUrl(
  outcome: "success" | "error",
  message?: string,
  returnTo?: string,
): string {
  const params = new URLSearchParams({ shopify_oauth: outcome });
  if (message) params.set("shopify_oauth_error", message.slice(0, 200));
  const safeReturnTo = sanitizeReturnTo(returnTo);
  if (safeReturnTo) params.set("return_to", safeReturnTo);
  return `${APP_RETURN_URL}?${params.toString()}`;
}

// ---------------------------------------------------------------------------
// Connection status / settings / disconnect
// ---------------------------------------------------------------------------

export interface ShopifyConnection {
  connected: boolean;
  shopName: string | null;
  shopDomain: string | null;
  currency: string | null;
  abandonedCartMinutes: number;
  webhookFailures: string[];
  connectedAt?: unknown;
}

export async function getShopifyConnection(
  workspaceId: string,
): Promise<ShopifyConnection> {
  const snap = await db()
    .collection("workspaces")
    .doc(workspaceId)
    .collection("integrations")
    .doc("shopify")
    .get();
  const d = (snap.data() ?? {}) as Record<string, unknown>;
  return {
    connected: d.status === "connected",
    shopName: (d.shopName as string) ?? null,
    shopDomain: (d.shopDomain as string) ?? null,
    currency: (d.currency as string) ?? null,
    abandonedCartMinutes:
      typeof d.abandonedCartMinutes === "number" ? d.abandonedCartMinutes : DEFAULT_ABANDONED_MINUTES,
    webhookFailures: Array.isArray(d.webhookFailures) ? (d.webhookFailures as string[]) : [],
    connectedAt: d.connectedAt,
  };
}

/** Update workspace-level Shopify settings (abandonment window). */
export async function updateShopifySettings(
  workspaceId: string,
  settings: { abandonedCartMinutes?: number },
): Promise<void> {
  const minutes = settings.abandonedCartMinutes;
  if (minutes !== undefined && (!Number.isFinite(minutes) || minutes < 15 || minutes > 4320)) {
    throw new Error("Abandonment window must be between 15 minutes and 3 days.");
  }
  await db()
    .collection("workspaces")
    .doc(workspaceId)
    .collection("integrations")
    .doc("shopify")
    .set(
      {
        ...(minutes !== undefined ? { abandonedCartMinutes: Math.round(minutes) } : {}),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
}

/** Resolve the workspace's Shopify token (cached 5 minutes). */
export async function resolveShopifyToken(workspaceId: string): Promise<string | null> {
  const cached = cacheGet(`shopifytoken:${workspaceId}`);
  if (cached) return cached;
  const snap = await db()
    .collection("workspaces")
    .doc(workspaceId)
    .collection("integrations")
    .doc("shopify")
    .get();
  const conn = snap.data() as { status?: string; secretName?: string } | undefined;
  if (conn?.status !== "connected" || !conn.secretName) return null;
  const { status, data } = await secretManager(
    "GET",
    `projects/${PROJECT_ID}/secrets/${conn.secretName}/versions/latest:access`,
  );
  if (status !== 200) {
    logger.warn("Shopify token unreadable", { workspaceId, secretStatus: status });
    return null;
  }
  const payload = (data as { payload?: { data?: string } }).payload?.data;
  if (!payload) return null;
  const token = Buffer.from(payload, "base64").toString("utf8");
  cacheSet(`shopifytoken:${workspaceId}`, token, 5 * 60 * 1000);
  return token;
}

/** Disconnect: remove webhooks, disable the secret, mark the doc. */
export async function disconnectShopify(workspaceId: string): Promise<void> {
  const conn = await getShopifyConnection(workspaceId);
  const token = await resolveShopifyToken(workspaceId);
  if (conn.connected && conn.shopDomain && token) {
    try {
      await unregisterShopifyWebhooks(conn.shopDomain, token);
    } catch (err) {
      // Webhook cleanup is best effort; the disconnect still proceeds.
      logger.warn("Shopify webhook cleanup failed on disconnect", {
        workspaceId,
        error: err instanceof Error ? err.message : "unknown",
      });
    }
  }
  const snap = await db()
    .collection("workspaces")
    .doc(workspaceId)
    .collection("integrations")
    .doc("shopify")
    .get();
  const secretName = (snap.data() as { secretName?: string } | undefined)?.secretName;
  if (secretName) {
    // Disable rather than destroy: keeps history, stops all access.
    const { status } = await secretManager(
      "POST",
      `projects/${PROJECT_ID}/secrets/${secretName}:disable`,
      {},
    );
    if (status !== 200) {
      logger.warn("Shopify secret disable failed", { workspaceId, status });
    }
  }
  await snap.ref.set(
    {
      status: "disconnected",
      disconnectedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  cache.delete(`shopifytoken:${workspaceId}`);
  logger.info("Shopify store disconnected", { workspaceId });
}

// ---------------------------------------------------------------------------
// Shopify Admin API (server side, timeouts, no retries)
// ---------------------------------------------------------------------------

/**
 * Call the Shopify Admin API for a workspace's store. Every call has a hard
 * timeout; failures are logged server side and surfaced as thrown errors.
 * No automatic retries: retrying a send-adjacent call could double deliver.
 */
export async function shopifyAdmin(
  shop: string,
  token: string,
  path: string,
  opts: { method?: string; body?: unknown } = {},
): Promise<{ status: number; data: unknown }> {
  const method = opts.method ?? "GET";
  let res: Response;
  try {
    res = await fetchWithTimeout(`https://${shop}/admin/api/${SHOPIFY_API_VERSION}${path}`, {
      method,
      headers: {
        "X-Shopify-Access-Token": token,
        "Content-Type": "application/json",
      },
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });
  } catch (err) {
    const reason = err instanceof Error ? err.name : "unknown";
    logger.error("Shopify Admin API network failure", { shop, path, method, reason });
    throw new Error(`Shopify request failed (${reason}).`);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const errors = (data as { errors?: unknown }).errors;
    logger.error("Shopify Admin API error", {
      shop,
      path,
      method,
      status: res.status,
      errors: typeof errors === "string" ? errors.slice(0, 300) : errors,
    });
    throw new Error(`Shopify API error (HTTP ${res.status}).`);
  }
  return { status: res.status, data };
}

async function registerShopifyWebhook(
  shop: string,
  token: string,
  topic: string,
): Promise<void> {
  await shopifyAdmin(shop, token, "/webhooks.json", {
    method: "POST",
    body: {
      webhook: { topic, address: SHOPIFY_WEBHOOK_URL, format: "json" },
    },
  });
}

async function unregisterShopifyWebhooks(shop: string, token: string): Promise<void> {
  const { data } = await shopifyAdmin(shop, token, "/webhooks.json?limit=250");
  const webhooks = ((data as { webhooks?: Array<{ id: number; address?: string }> }).webhooks ?? []).filter(
    (w) => (w.address ?? "").includes("shopifyWebhook"),
  );
  for (const w of webhooks) {
    try {
      await shopifyAdmin(shop, token, `/webhooks/${w.id}.json`, { method: "DELETE" });
    } catch (err) {
      logger.warn("Shopify webhook delete failed", {
        shop,
        webhookId: w.id,
        error: err instanceof Error ? err.message : "unknown",
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Webhook verification + routing
// ---------------------------------------------------------------------------

/**
 * Verify the X-Shopify-Hmac-Sha256 header over the raw request body using
 * the app client secret. Rejects anything unsigned so attackers cannot
 * inject fake commerce events.
 */
export function verifyShopifyHmac(
  rawBody: Buffer,
  signatureHeader: string | undefined,
  clientSecret: string,
): boolean {
  if (!signatureHeader || !clientSecret || rawBody.length === 0) return false;
  const expected = createHmac("sha256", clientSecret).update(rawBody).digest("base64");
  const a = Buffer.from(signatureHeader);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Find the workspace whose Shopify connection matches this shop domain. */
export async function findWorkspaceByShop(shop: string): Promise<string | null> {
  const snap = await db()
    .collectionGroup("integrations")
    .where("shopDomain", "==", shop)
    .limit(5)
    .get();
  for (const doc of snap.docs) {
    if (doc.id !== "shopify") continue;
    const d = doc.data() as { status?: string };
    if (d.status !== "connected") continue;
    const wsRef = doc.ref.parent.parent;
    if (wsRef) return wsRef.id;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Contact matching
// ---------------------------------------------------------------------------

/**
 * Match a Shopify customer (email, then phone) to a ChatMize contact that
 * has a conversation in this workspace. Returns the contact doc id or null.
 * Never throws: a missed match just leaves the event unattached.
 */
export async function matchShopifyContact(
  workspaceId: string,
  email: string | null,
  phone: string | null,
): Promise<string | null> {
  try {
    const candidates: string[] = [];
    if (email) {
      const snap = await db()
        .collection("contacts")
        .where("email", "==", email.trim().toLowerCase())
        .limit(10)
        .get();
      for (const d of snap.docs) candidates.push(d.id);
    }
    if (candidates.length === 0 && phone) {
      const digits = phone.replace(/\D/g, "");
      if (digits.length >= 7) {
        const snap = await db()
          .collection("contacts")
          .where("phone", "==", phone.trim())
          .limit(10)
          .get();
        for (const d of snap.docs) candidates.push(d.id);
      }
    }
    for (const contactId of candidates) {
      // contact_<channel>_<senderId> -> conversation doc <channel>_<senderId>
      const convoId = contactId.replace(/^contact_/, "");
      const convo = await db()
        .collection("workspaces")
        .doc(workspaceId)
        .collection("conversations")
        .doc(convoId)
        .get();
      if (convo.exists) return contactId;
    }
    return null;
  } catch (err) {
    logger.warn("Shopify contact match failed", {
      workspaceId,
      error: err instanceof Error ? err.message : "unknown",
    });
    return null;
  }
}

// ---------------------------------------------------------------------------
// Commerce events -> BotMaps triggers
// ---------------------------------------------------------------------------

export type ShopifyTriggerType =
  | "shopify_cart_abandoned"
  | "shopify_order_created"
  | "shopify_order_shipped"
  | "shopify_order_delivered"
  | "shopify_product_purchased";

export interface CommerceEvent {
  triggerType: ShopifyTriggerType;
  /** Idempotency key: duplicate webhook deliveries collapse onto one doc. */
  eventId: string;
  shopDomain: string;
  topic: string;
  shopifyId: string;
  contactId: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  customerFirstName: string | null;
  variables: Record<string, string>;
}

/** Store the event idempotently; a redelivered webhook is a no-op. */
export async function emitCommerceEvent(
  workspaceId: string,
  event: CommerceEvent,
): Promise<boolean> {
  const ref = db()
    .collection("workspaces")
    .doc(workspaceId)
    .collection("shopify_events")
    .doc(event.eventId);
  const existing = await ref.get();
  if (existing.exists) return false;
  await ref.set(
    {
      triggerType: event.triggerType,
      shopDomain: event.shopDomain,
      topic: event.topic,
      shopifyId: event.shopifyId,
      contactId: event.contactId,
      customerEmail: event.customerEmail,
      customerPhone: event.customerPhone,
      customerFirstName: event.customerFirstName,
      variables: event.variables,
      status: "pending",
      createdAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  logger.info("Shopify commerce event recorded", {
    workspaceId,
    triggerType: event.triggerType,
    eventId: event.eventId,
  });
  return true;
}

type AnyObj = Record<string, unknown>;
const str = (v: unknown): string => (typeof v === "string" ? v : "");
const num = (v: unknown): number => (typeof v === "number" ? v : Number(v) || 0);

function money(amount: unknown, currency: string): string {
  const n = num(amount);
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);
  } catch {
    return `${currency} ${n.toFixed(2)}`;
  }
}

function lineItemSummary(items: AnyObj[]): string {
  return items
    .slice(0, 10)
    .map((i) => {
      const qty = num(i.quantity) || 1;
      return `${qty} x ${str(i.title)}${i.variant_title ? ` (${str(i.variant_title)})` : ""}`;
    })
    .join(", ");
}

function customerName(payload: AnyObj): string | null {
  const customer = (payload.customer ?? {}) as AnyObj;
  const first =
    str(customer.first_name) ||
    str(payload.customer_first_name) ||
    str((payload.billing_address as AnyObj | undefined)?.first_name) ||
    str((payload.shipping_address as AnyObj | undefined)?.first_name);
  return first || null;
}

function customerEmailOf(payload: AnyObj): string | null {
  const customer = (payload.customer ?? {}) as AnyObj;
  const email = str(payload.email) || str(customer.email);
  return email || null;
}

function customerPhoneOf(payload: AnyObj): string | null {
  const customer = (payload.customer ?? {}) as AnyObj;
  const phone =
    str(payload.phone) ||
    str(customer.phone) ||
    str((payload.billing_address as AnyObj | undefined)?.phone) ||
    str((payload.shipping_address as AnyObj | undefined)?.phone);
  return phone || null;
}

/**
 * Route one verified webhook delivery to commerce events.
 * Returns the number of new events recorded (0 when deduped or unmapped).
 * Never throws: every failure is logged and the 200 already went back.
 */
export async function routeShopifyWebhook(
  shop: string,
  topic: string,
  payload: AnyObj,
): Promise<number> {
  try {
    if (topic === "app/uninstalled") {
      await handleAppUninstalled(shop);
      return 0;
    }
    const workspaceId = await findWorkspaceByShop(shop);
    if (!workspaceId) {
      logger.warn("Shopify webhook for unknown shop", { shop, topic });
      return 0;
    }

    if (topic === "checkouts/create" || topic === "checkouts/update") {
      await recordCheckoutSnapshot(workspaceId, payload);
      return 0;
    }

    const email = customerEmailOf(payload);
    const phone = customerPhoneOf(payload);
    const contactId = await matchShopifyContact(workspaceId, email, phone);
    const firstName = customerName(payload);
    let created = 0;

    if (topic === "orders/create" || topic === "orders/paid") {
      const order = payload as AnyObj;
      const orderId = String(order.id ?? "");
      const currency = str(order.currency) || "USD";
      const items = (Array.isArray(order.line_items) ? order.line_items : []) as AnyObj[];
      const vars: Record<string, string> = {
        order_name: str(order.name),
        order_id: orderId,
        order_total: money(order.total_price, currency),
        order_currency: currency,
        order_item_count: String(items.reduce((n, i) => n + (num(i.quantity) || 1), 0)),
        order_items: lineItemSummary(items),
        order_status_url: str(order.order_status_url),
        customer_first_name: firstName ?? "",
        customer_email: email ?? "",
      };
      const eventId = `shopify_order_created_${orderId}`;
      if (
        await emitCommerceEvent(workspaceId, {
          triggerType: "shopify_order_created",
          eventId,
          shopDomain: shop,
          topic,
          shopifyId: orderId,
          contactId,
          customerEmail: email,
          customerPhone: phone,
          customerFirstName: firstName,
          variables: vars,
        })
      ) {
        created += 1;
      }
      // One product-purchased event per line item (bounded by item count).
      for (const item of items.slice(0, 50)) {
        const productId = String(item.product_id ?? "");
        if (!productId) continue;
        const pVars: Record<string, string> = {
          product_title: str(item.title),
          product_id: productId,
          variant_title: str(item.variant_title),
          quantity: String(num(item.quantity) || 1),
          price: money(item.price, currency),
          order_name: str(order.name),
          order_id: orderId,
          customer_first_name: firstName ?? "",
          customer_email: email ?? "",
        };
        if (
          await emitCommerceEvent(workspaceId, {
            triggerType: "shopify_product_purchased",
            eventId: `shopify_product_purchased_${orderId}_${productId}`,
            shopDomain: shop,
            topic,
            shopifyId: `${orderId}:${productId}`,
            contactId,
            customerEmail: email,
            customerPhone: phone,
            customerFirstName: firstName,
            variables: pVars,
          })
        ) {
          created += 1;
        }
      }
      // Link the order back to its checkout so the abandonment sweep stands down.
      const checkoutToken = str(order.checkout_token);
      if (checkoutToken) {
        await markCheckoutCompleted(workspaceId, checkoutToken, orderId);
      }
      return created;
    }

    if (topic === "fulfillments/create") {
      const f = payload as AnyObj;
      const orderId = String(f.order_id ?? "");
      const tracking = (Array.isArray(f.tracking_numbers) ? f.tracking_numbers : []) as unknown[];
      const vars: Record<string, string> = {
        order_name: str(f.name) || str((f.order as AnyObj | undefined)?.name),
        order_id: orderId,
        tracking_number: tracking.map(String).join(", "),
        tracking_company: str(f.tracking_company),
        tracking_url: tracking.length > 0 ? str((f.tracking_urls as unknown[] | undefined)?.[0] ?? "") : "",
        customer_first_name: firstName ?? "",
        customer_email: email ?? "",
      };
      if (
        await emitCommerceEvent(workspaceId, {
          triggerType: "shopify_order_shipped",
          eventId: `shopify_order_shipped_${String(f.id ?? orderId)}`,
          shopDomain: shop,
          topic,
          shopifyId: String(f.id ?? orderId),
          contactId,
          customerEmail: email,
          customerPhone: phone,
          customerFirstName: firstName,
          variables: vars,
        })
      ) {
        created += 1;
      }
      return created;
    }

    if (topic === "fulfillments/update") {
      const f = payload as AnyObj;
      if (str(f.shipment_status) !== "delivered") return 0;
      const orderId = String(f.order_id ?? "");
      const vars: Record<string, string> = {
        order_name: str(f.name) || str((f.order as AnyObj | undefined)?.name),
        order_id: orderId,
        customer_first_name: firstName ?? "",
        customer_email: email ?? "",
      };
      if (
        await emitCommerceEvent(workspaceId, {
          triggerType: "shopify_order_delivered",
          eventId: `shopify_order_delivered_${String(f.id ?? orderId)}`,
          shopDomain: shop,
          topic,
          shopifyId: String(f.id ?? orderId),
          contactId,
          customerEmail: email,
          customerPhone: phone,
          customerFirstName: firstName,
          variables: vars,
        })
      ) {
        created += 1;
      }
      return created;
    }

    // orders/updated and anything else: no commerce event in v1.
    return created;
  } catch (err) {
    logger.error("Shopify webhook routing failed", {
      shop,
      topic,
      error: err instanceof Error ? err.message : "unknown",
    });
    return 0;
  }
}

/** Merchant uninstalled the app: stand the connection down, keep history. */
async function handleAppUninstalled(shop: string): Promise<void> {
  const workspaceId = await findWorkspaceByShop(shop);
  if (!workspaceId) {
    logger.warn("Shopify app/uninstalled for unknown shop", { shop });
    return;
  }
  await db()
    .collection("workspaces")
    .doc(workspaceId)
    .collection("integrations")
    .doc("shopify")
    .set(
      {
        status: "disconnected",
        disconnectedAt: FieldValue.serverTimestamp(),
        disconnectReason: "app_uninstalled",
      },
      { merge: true },
    );
  cache.delete(`shopifytoken:${workspaceId}`);
  logger.info("Shopify app uninstalled, connection stood down", { workspaceId, shop });
}

// ---------------------------------------------------------------------------
// Abandoned checkout tracking + hourly sweep
// ---------------------------------------------------------------------------

/** Snapshot every open checkout so the sweep can age it. Idempotent by token. */
async function recordCheckoutSnapshot(workspaceId: string, payload: AnyObj): Promise<void> {
  const token = str(payload.token);
  if (!token) return;
  if (payload.completed_at) {
    await markCheckoutCompleted(workspaceId, token, null);
    return;
  }
  const email = customerEmailOf(payload);
  const currency = str(payload.currency) || "USD";
  const items = (Array.isArray(payload.line_items) ? payload.line_items : []) as AnyObj[];
  await db()
    .collection("workspaces")
    .doc(workspaceId)
    .collection("shopify_checkouts")
    .doc(token)
    .set(
      {
        status: "open",
        shopDomain: str(payload.shop_domain ?? ""),
        email,
        phone: customerPhoneOf(payload),
        firstName: customerName(payload),
        total: money(payload.total_price, currency),
        currency,
        itemCount: items.reduce((n, i) => n + (num(i.quantity) || 1), 0),
        items: lineItemSummary(items),
        recoveryUrl: str(payload.abandoned_checkout_url),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
}

async function markCheckoutCompleted(
  workspaceId: string,
  checkoutToken: string,
  orderId: string | null,
): Promise<void> {
  const ref = db()
    .collection("workspaces")
    .doc(workspaceId)
    .collection("shopify_checkouts")
    .doc(checkoutToken);
  const snap = await ref.get();
  if (!snap.exists) return;
  await ref.set(
    {
      status: "completed",
      completedOrderId: orderId,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}

/**
 * Hourly sweep: open checkouts older than the workspace's abandonment window
 * become shopify_cart_abandoned events, once each. Called by the scheduled
 * function; bounded and cheap by design.
 */
export async function sweepAbandonedCheckouts(): Promise<{ workspaces: number; fired: number }> {
  const cutoffGlobal = Date.now() - 15 * 60 * 1000;
  const integrations = await db()
    .collectionGroup("integrations")
    .where("status", "==", "connected")
    .limit(200)
    .get();
  let workspaces = 0;
  let fired = 0;
  for (const doc of integrations.docs) {
    if (doc.id !== "shopify") continue;
    const wsRef = doc.ref.parent.parent;
    if (!wsRef) continue;
    const workspaceId = wsRef.id;
    const d = doc.data() as { abandonedCartMinutes?: number };
    const windowMs =
      (typeof d.abandonedCartMinutes === "number" ? d.abandonedCartMinutes : DEFAULT_ABANDONED_MINUTES) *
      60 * 1000;
    // Only look at checkouts updated before the window (and at least 15 min old).
    const cutoff = new Date(Math.min(Date.now() - windowMs, cutoffGlobal));
    const stale = await wsRef
      .collection("shopify_checkouts")
      .where("status", "==", "open")
      .where("updatedAt", "<", cutoff)
      .limit(50)
      .get();
    if (stale.empty) continue;
    workspaces += 1;
    for (const c of stale.docs) {
      const cd = c.data() as Record<string, unknown>;
      const email = (cd.email as string) ?? null;
      const contactId = await matchShopifyContact(
        workspaceId,
        email,
        (cd.phone as string) ?? null,
      );
      const vars: Record<string, string> = {
        cart_total: String(cd.total ?? ""),
        cart_currency: String(cd.currency ?? "USD"),
        cart_item_count: String(cd.itemCount ?? 0),
        cart_items: String(cd.items ?? ""),
        cart_recovery_url: String(cd.recoveryUrl ?? ""),
        customer_first_name: String(cd.firstName ?? ""),
        customer_email: email ?? "",
      };
      const isNew = await emitCommerceEvent(workspaceId, {
        triggerType: "shopify_cart_abandoned",
        eventId: `shopify_cart_abandoned_${c.id}`,
        shopDomain: String(cd.shopDomain ?? ""),
        topic: "sweep",
        shopifyId: c.id,
        contactId,
        customerEmail: email,
        customerPhone: (cd.phone as string) ?? null,
        customerFirstName: (cd.firstName as string) ?? null,
        variables: vars,
      });
      await c.ref.set(
        { status: isNew ? "abandoned_fired" : "open", updatedAt: FieldValue.serverTimestamp() },
        { merge: true },
      );
      if (isNew) fired += 1;
    }
  }
  if (fired > 0) logger.info("Shopify abandoned cart sweep fired", { workspaces, fired });
  return { workspaces, fired };
}
