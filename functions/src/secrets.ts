import { defineSecret } from "firebase-functions/params";

// All secrets live in Google Secret Manager. Nothing secret is ever committed
// to the repo or baked into the client bundle. Create them with:
//   firebase functions:secrets:set META_APP_SECRET
// (same for each name below)

export const META_APP_SECRET = defineSecret("META_APP_SECRET");
export const META_VERIFY_TOKEN = defineSecret("META_VERIFY_TOKEN");

// Instagram Login (IG-only workspaces): the ChatMize-IG app's secret, used
// server-side to exchange the Instagram OAuth code for a token.
export const META_INSTAGRAM_APP_SECRET = defineSecret("META_INSTAGRAM_APP_SECRET");
export const TWILIO_ACCOUNT_SID = defineSecret("TWILIO_ACCOUNT_SID");
export const TWILIO_AUTH_TOKEN = defineSecret("TWILIO_AUTH_TOKEN");

// Telnyx (ChatMize-owned account; workspaces connect their own Telnyx number).
export const TELNYX_API_KEY = defineSecret("TELNYX_API_KEY");
export const TELNYX_PUBLIC_KEY = defineSecret("TELNYX_PUBLIC_KEY");

// Bandwidth (ChatMize-owned account; workspaces connect their own Bandwidth number).
export const BANDWIDTH_ACCOUNT_ID = defineSecret("BANDWIDTH_ACCOUNT_ID");
export const BANDWIDTH_API_TOKEN = defineSecret("BANDWIDTH_API_TOKEN");
export const BANDWIDTH_API_SECRET = defineSecret("BANDWIDTH_API_SECRET");

// Page-scoped access tokens are stored per workspace so each tenant's Meta
// assets stay isolated. The secret name maps 1:1 to a workspace id; the
// default workspace uses META_PAGE_TOKEN_DEFAULT.
export const META_PAGE_TOKEN_DEFAULT = defineSecret("META_PAGE_TOKEN_DEFAULT");
export const WHATSAPP_TOKEN_DEFAULT = defineSecret("WHATSAPP_TOKEN_DEFAULT");
export const WHATSAPP_PHONE_NUMBER_ID = defineSecret("WHATSAPP_PHONE_NUMBER_ID");

// NOTE: there is intentionally no ALL_SECRETS bundle. Each function declares
// only the secrets it actually reads (least privilege, and avoids mounting
// placeholder values where they are not needed).

/** Resolve the page token secret for a workspace (defaults when unmapped). */
export function pageTokenSecretFor(_workspaceId: string) {
  // Per-workspace token mapping lands with Phase 3 tenancy UI; until then the
  // default token serves the single provisioned workspace.
  return META_PAGE_TOKEN_DEFAULT;
}
