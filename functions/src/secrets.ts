import { defineSecret } from "firebase-functions/params";

// All secrets live in Google Secret Manager. Nothing secret is ever committed
// to the repo or baked into the client bundle. Create them with:
//   firebase functions:secrets:set META_APP_SECRET
// (same for each name below)

export const META_APP_SECRET = defineSecret("META_APP_SECRET");
export const META_VERIFY_TOKEN = defineSecret("META_VERIFY_TOKEN");

// Page-scoped access tokens are stored per workspace so each tenant's Meta
// assets stay isolated. The secret name maps 1:1 to a workspace id; the
// default workspace uses META_PAGE_TOKEN_DEFAULT.
export const META_PAGE_TOKEN_DEFAULT = defineSecret("META_PAGE_TOKEN_DEFAULT");
export const WHATSAPP_TOKEN_DEFAULT = defineSecret("WHATSAPP_TOKEN_DEFAULT");
export const WHATSAPP_PHONE_NUMBER_ID = defineSecret("WHATSAPP_PHONE_NUMBER_ID");

export const ALL_SECRETS = [
  META_APP_SECRET,
  META_VERIFY_TOKEN,
  META_PAGE_TOKEN_DEFAULT,
  WHATSAPP_TOKEN_DEFAULT,
  WHATSAPP_PHONE_NUMBER_ID,
];

/** Resolve the page token secret for a workspace (defaults when unmapped). */
export function pageTokenSecretFor(_workspaceId: string) {
  // Per-workspace token mapping lands with Phase 3 tenancy UI; until then the
  // default token serves the single provisioned workspace.
  return META_PAGE_TOKEN_DEFAULT;
}
