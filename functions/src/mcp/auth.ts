/**
 * ChatMize MCP API key auth (v1).
 *
 * Keys are bearer tokens of the form cm_live_<random> / cm_test_<random>.
 * Only the SHA-256 hash is stored in Firestore (collection `api_keys`).
 * Every tool call resolves the workspace from the key; nothing outside that
 * workspace is reachable. OAuth-based auth is planned for a later version.
 */
import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const db = () => getFirestore("chatmize-prod");

export interface ApiKeyRecord {
  keyId: string;
  keyHash: string;
  keyPrefix: string;
  workspaceId: string;
  name: string;
  scopes: string[];
  perMinuteLimit: number;
  isTest: boolean;
  createdAt: unknown;
  lastUsedAt: unknown;
  revokedAt: unknown;
}

export interface VerifiedKey {
  keyId: string;
  workspaceId: string;
  name: string;
  scopes: string[];
  perMinuteLimit: number;
  isTest: boolean;
}

function sha256Hex(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

// In-memory cache of verified keys: hash -> { verified, expiresAt }.
// Short TTL keeps revocation effective while avoiding a Firestore read
// on every request.
const keyCache = new Map<string, { verified: VerifiedKey; expiresAt: number }>();
const KEY_CACHE_TTL_MS = 60_000;

function cacheGet(hash: string): VerifiedKey | null {
  const hit = keyCache.get(hash);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    keyCache.delete(hash);
    return null;
  }
  return hit.verified;
}

function cacheSet(hash: string, verified: VerifiedKey): void {
  // Bound the cache size; simplest eviction is fine for a serverless instance.
  if (keyCache.size > 500) keyCache.clear();
  keyCache.set(hash, { verified, expiresAt: Date.now() + KEY_CACHE_TTL_MS });
}

export function cacheInvalidate(hash: string): void {
  keyCache.delete(hash);
}

export class McpAuthError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/**
 * Verify a raw bearer API key. Returns the workspace it belongs to.
 * Throws McpAuthError(401) when invalid/revoked.
 */
export async function verifyApiKey(rawKey: string): Promise<VerifiedKey> {
  if (!rawKey || typeof rawKey !== "string") {
    throw new McpAuthError(401, "Missing API key. Pass Authorization: Bearer <key>.");
  }
  const trimmed = rawKey.trim();
  if (!trimmed.startsWith("cm_live_") && !trimmed.startsWith("cm_test_")) {
    throw new McpAuthError(401, "Invalid API key format.");
  }
  const hash = sha256Hex(trimmed);
  const cached = cacheGet(hash);
  if (cached) return cached;

  const snap = await db().collection("api_keys").where("keyHash", "==", hash).limit(1).get();
  if (snap.empty) {
    throw new McpAuthError(401, "Invalid API key.");
  }
  const doc = snap.docs[0];
  const data = doc.data() as Partial<ApiKeyRecord>;
  if (data.revokedAt) {
    cacheInvalidate(hash);
    throw new McpAuthError(401, "This API key has been revoked.");
  }
  // Constant-time compare against the stored hash (defense in depth; the
  // Firestore equality check already matched, but this is cheap).
  if (!data.keyHash || !safeEqual(data.keyHash, hash)) {
    throw new McpAuthError(401, "Invalid API key.");
  }
  const verified: VerifiedKey = {
    keyId: doc.id,
    workspaceId: String(data.workspaceId ?? ""),
    name: String(data.name ?? ""),
    scopes: Array.isArray(data.scopes) ? data.scopes.map(String) : [],
    perMinuteLimit: Number(data.perMinuteLimit ?? 60) || 60,
    isTest: Boolean(data.isTest),
  };
  if (!verified.workspaceId) {
    throw new McpAuthError(401, "API key is not bound to a workspace.");
  }
  cacheSet(hash, verified);
  // Fire-and-forget usage stamp (do not block the request on it).
  doc.ref.update({ lastUsedAt: FieldValue.serverTimestamp() }).catch(() => {});
  return verified;
}

/**
 * Fixed-window per-key rate limiter backed by Firestore so it works across
 * serverless instances. Default 60 requests/minute per key.
 * Throws McpAuthError(429) when the limit is exceeded.
 */
export async function checkRateLimit(key: VerifiedKey): Promise<void> {
  const limit = key.perMinuteLimit > 0 ? key.perMinuteLimit : 60;
  const now = new Date();
  const windowId = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}${String(
    now.getUTCDate(),
  ).padStart(2, "0")}${String(now.getUTCHours()).padStart(2, "0")}${String(
    now.getUTCMinutes(),
  ).padStart(2, "0")}`;
  const ref = db().collection("api_key_usage").doc(`${key.keyId}_${windowId}`);
  const exceeded = await db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const count = snap.exists ? Number((snap.data() as { count?: unknown }).count ?? 0) : 0;
    if (count >= limit) return true;
    tx.set(
      ref,
      { keyId: key.keyId, workspaceId: key.workspaceId, windowId, count: count + 1, updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
    return false;
  });
  if (exceeded) {
    throw new McpAuthError(429, `Rate limit exceeded (${limit} requests/minute for this key).`);
  }
}

/**
 * Mint a new API key for a workspace. Returns the raw key ONCE — it is
 * never stored and cannot be recovered. Only the hash is persisted.
 * Intended for admin/test tooling, not exposed over MCP itself.
 */
export async function mintApiKey(opts: {
  workspaceId: string;
  name: string;
  isTest?: boolean;
  perMinuteLimit?: number;
  scopes?: string[];
}): Promise<{ keyId: string; rawKey: string; keyPrefix: string }> {
  const isTest = opts.isTest ?? true;
  const rawKey = `cm_${isTest ? "test" : "live"}_${randomBytes(24).toString("hex")}`;
  const keyPrefix = rawKey.slice(0, 12);
  const ref = db().collection("api_keys").doc();
  await ref.set({
    keyHash: sha256Hex(rawKey),
    keyPrefix,
    workspaceId: opts.workspaceId,
    name: opts.name,
    scopes: opts.scopes ?? ["*"],
    perMinuteLimit: opts.perMinuteLimit ?? 60,
    isTest,
    createdAt: FieldValue.serverTimestamp(),
    lastUsedAt: null,
    revokedAt: null,
  });
  return { keyId: ref.id, rawKey, keyPrefix };
}

/**
 * Revoke a key by id. Also invalidates the in-memory cache entry when the
 * raw key is supplied.
 */
export async function revokeApiKey(keyId: string, rawKey?: string): Promise<void> {
  await db().collection("api_keys").doc(keyId).update({
    revokedAt: FieldValue.serverTimestamp(),
  });
  if (rawKey) cacheInvalidate(sha256Hex(rawKey.trim()));
}
