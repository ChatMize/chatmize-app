/**
 * BotMaps webhook action: push collected variables to a third party.
 *
 * A BotMaps action node can carry a webhook action (URL + optional variable
 * allowlist, configured in the builder and stored on the flow document —
 * never hardcoded). Executing it POSTs the contact's variables as JSON to
 * that URL. Also exposed through the MCP API so integrations can push
 * variables on demand.
 *
 * Safety: HTTPS only, the hostname is DNS-resolved and private/loopback
 * ranges are rejected (SSRF guard), 10s timeout, no retries (a retry could
 * double-send into the third party), and every outcome is logged.
 */
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { promises as dns } from "dns";
import { isIP } from "net";

const db = () => getFirestore("chatmize-prod");

const WEBHOOK_TIMEOUT_MS = 10_000;

export interface WebhookActionResult {
  ok: boolean;
  status: number | null;
  error?: string;
}

/** True when the IP is private, loopback, or link-local (v4 or v6). */
function isPrivateIp(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) {
    const p = ip.split(".").map(Number);
    return (
      p[0] === 10 ||
      p[0] === 127 ||
      (p[0] === 172 && p[1] >= 16 && p[1] <= 31) ||
      (p[0] === 192 && p[1] === 168) ||
      (p[0] === 169 && p[1] === 254) ||
      p[0] === 0
    );
  }
  if (v === 6) {
    const low = ip.toLowerCase();
    return (
      low === "::1" ||
      low.startsWith("fc") ||
      low.startsWith("fd") ||
      low.startsWith("fe80") ||
      low === "::"
    );
  }
  return true; // not an IP at all: treat as unsafe
}

/**
 * Validate the target URL: HTTPS only, resolvable, and not pointing at
 * private infrastructure. Throws on any failure.
 */
async function assertSafeWebhookUrl(rawUrl: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("Webhook URL is not a valid URL.");
  }
  if (url.protocol !== "https:") {
    throw new Error("Webhook URL must use https.");
  }
  if (!url.hostname) throw new Error("Webhook URL has no host.");
  let addresses: string[];
  try {
    addresses = await dns.resolve4(url.hostname).catch(() => []);
    const v6 = await dns.resolve6(url.hostname).catch(() => []);
    addresses = [...addresses, ...v6];
  } catch {
    throw new Error("Webhook host could not be resolved.");
  }
  if (addresses.length === 0) throw new Error("Webhook host could not be resolved.");
  if (addresses.some(isPrivateIp)) {
    throw new Error("Webhook URL resolves to a private address. Refusing to send.");
  }
  return url;
}

export interface WebhookPayload {
  contactId: string;
  workspaceId: string;
  variables: Record<string, string | number | boolean>;
  sentAt: string;
}

/**
 * POST the contact's variables to the URL. variableNames limits the push
 * to named variables; omit it to send every variable on the contact.
 * No retries. Never throws for transport failures — they are returned
 * as { ok: false } and logged; validation errors throw.
 */
export async function executeWebhookAction(
  workspaceId: string,
  contactId: string,
  rawUrl: string,
  variableNames?: string[] | null,
): Promise<WebhookActionResult> {
  if (!workspaceId || !contactId) throw new Error("workspaceId and contactId are required.");
  const url = await assertSafeWebhookUrl(rawUrl);

  const snap = await db().collection("contacts").doc(contactId).get();
  if (!snap.exists) throw new Error("Contact not found.");
  const data = snap.data() as {
    variables?: Record<string, unknown>;
    customFields?: Record<string, unknown>;
  };
  const all: Record<string, string | number | boolean> = {};
  for (const src of [data.variables, data.customFields]) {
    if (src && typeof src === "object") {
      for (const [k, v] of Object.entries(src)) {
        if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
          all[k] = v;
        }
      }
    }
  }
  const variables: Record<string, string | number | boolean> =
    variableNames && variableNames.length > 0
      ? Object.fromEntries(variableNames.filter((n) => n in all).map((n) => [n, all[n]]))
      : all;

  const payload: WebhookPayload = {
    contactId,
    workspaceId,
    variables,
    sentAt: new Date().toISOString(),
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);
  try {
    const res = await fetch(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const ok = res.status >= 200 && res.status < 300;
    logger.info("Webhook action fired", {
      workspaceId,
      contactId,
      host: url.hostname,
      status: res.status,
      variableCount: Object.keys(variables).length,
    });
    // Delivery audit on the contact, fire-and-forget.
    void db()
      .collection("contacts")
      .doc(contactId)
      .set(
        {
          lastWebhookPush: {
            host: url.hostname,
            status: res.status,
            ok,
            at: FieldValue.serverTimestamp(),
          },
        },
        { merge: true },
      )
      .catch((e) => logger.warn("Webhook audit write failed", { err: String(e) }));
    return { ok, status: res.status, error: ok ? undefined : `Third party returned ${res.status}.` };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn("Webhook action failed", { workspaceId, contactId, host: url.hostname, err: message });
    return { ok: false, status: null, error: message };
  } finally {
    clearTimeout(timer);
  }
}
