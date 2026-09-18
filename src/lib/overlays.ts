import { getApp } from "firebase/app";
import { getFunctions, httpsCallable } from "firebase/functions";
import { WebsiteOverlay } from "../types/growthTools";

const functions = getFunctions(getApp(), "us-west2");

/**
 * Website Overlays backend calls.
 *
 * The Cloud Function actions live folded inside the existing `metaOAuthStatus`
 * callable (creating new functions fails through the egress proxy; see
 * functions/src/overlays.ts). They are routed by the `action` param.
 */

interface OverlayListResult {
  overlays: WebsiteOverlay[];
}

interface OverlaySaveResult {
  overlay: WebsiteOverlay;
}

export async function fetchOverlays(workspaceId: string): Promise<WebsiteOverlay[]> {
  const fn = httpsCallable<{ workspaceId: string; action: string }, OverlayListResult>(
    functions,
    "metaOAuthStatus"
  );
  const res = await fn({ workspaceId, action: "overlayList" });
  return res.data.overlays ?? [];
}

export async function saveOverlay(
  workspaceId: string,
  overlay: WebsiteOverlay
): Promise<WebsiteOverlay> {
  const fn = httpsCallable<
    { workspaceId: string; action: string; overlay: WebsiteOverlay },
    OverlaySaveResult
  >(functions, "metaOAuthStatus");
  const res = await fn({ workspaceId, action: "overlaySave", overlay });
  return res.data.overlay;
}

export async function deleteOverlay(workspaceId: string, overlayId: string): Promise<void> {
  const fn = httpsCallable<{ workspaceId: string; action: string; overlayId: string }, { ok: boolean }>(
    functions,
    "metaOAuthStatus"
  );
  await fn({ workspaceId, action: "overlayDelete", overlayId });
}

export async function setOverlayStatus(
  workspaceId: string,
  overlayId: string,
  status: "active" | "paused" | "draft"
): Promise<void> {
  const fn = httpsCallable<
    { workspaceId: string; action: string; overlayId: string; status: string },
    { ok: boolean }
  >(functions, "metaOAuthStatus");
  await fn({ workspaceId, action: "overlaySetStatus", overlayId, status });
}

/** Canonical one-line embed snippet customers paste on their sites. */
export const OVERLAY_SDK_URL = "https://app.chatmize.com/overlays.js";

export function overlayEmbedCode(workspaceId: string): string {
  return `<!-- ChatMize Website Overlays -->\n<script src="${OVERLAY_SDK_URL}" data-workspace="${workspaceId}" async></script>`;
}
