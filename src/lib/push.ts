import { getApp } from "firebase/app";
import { getFunctions, httpsCallable } from "firebase/functions";
import { getMessaging, getToken, onMessage, isSupported } from "firebase/messaging";

const functions = getFunctions(getApp(), "us-west2");

export interface PushStatus {
  configured: boolean;
  subscriberCount: number;
  isSuperAdmin: boolean;
}

export interface PushPublicConfig {
  configured: boolean;
  vapidPublicKey?: string;
  workspaceName?: string;
  prompt?: { headline: string; subtext: string; allowLabel: string; dismissLabel: string };
}

export async function getPushStatus(workspaceId: string): Promise<PushStatus> {
  const fn = httpsCallable<{ workspaceId: string }, PushStatus>(functions, "getPushStatus");
  return (await fn({ workspaceId })).data;
}

export async function getPushPublicConfig(workspaceId: string): Promise<PushPublicConfig> {
  const fn = httpsCallable<{ workspaceId: string }, PushPublicConfig>(functions, "getPushPublicConfig");
  return (await fn({ workspaceId })).data;
}

export async function setPushVapidKey(vapidPublicKey: string): Promise<{ ok: boolean }> {
  const fn = httpsCallable<{ vapidPublicKey: string }, { ok: boolean }>(functions, "setPushVapidKey");
  return (await fn({ vapidPublicKey })).data;
}

/** Super Admin only: whether a VAPID key is configured. Powers the Super Admin push section. */
export async function getPushVapidStatus(): Promise<{ configured: boolean }> {
  const fn = httpsCallable<Record<string, never>, { configured: boolean }>(functions, "getPushVapidStatus");
  return (await fn({})).data;
}

export async function setPushPromptCopy(
  workspaceId: string,
  copy: { headline: string; subtext: string; allowLabel: string; dismissLabel: string },
): Promise<{ ok: boolean }> {
  const fn = httpsCallable(functions, "setPushPromptCopy");
  return (await fn({ workspaceId, ...copy })).data as { ok: boolean };
}

export interface PushPromptCopy {
  headline: string; subtext: string; allowLabel: string; dismissLabel: string;
}

/** Member-guarded prompt copy for the in-app editor; works before VAPID setup. */
export async function getPushPromptCopy(workspaceId: string): Promise<PushPromptCopy> {
  const fn = httpsCallable<{ workspaceId: string }, PushPromptCopy>(functions, "getPushPromptCopy");
  return (await fn({ workspaceId })).data;
}

export async function subscribePushToken(args: {
  workspaceId: string; token: string; userAgent?: string; tags?: string[];
  contactId?: string; ownerUid?: string; channelSenderIds?: string[];
}): Promise<{ ok: boolean }> {
  const fn = httpsCallable(functions, "subscribePush");
  return (await fn(args)).data as { ok: boolean };
}

export async function unsubscribePushToken(workspaceId: string, token: string): Promise<{ ok: boolean }> {
  const fn = httpsCallable(functions, "unsubscribePush");
  return (await fn({ workspaceId, token })).data as { ok: boolean };
}

export async function trackPushEvent(
  workspaceId: string,
  event: "delivered" | "clicked",
): Promise<void> {
  try {
    const fn = httpsCallable(functions, "trackPushEvent");
    await fn({ workspaceId, event });
  } catch {
    // Tracking is best effort; never break the UX.
  }
}

export type PushLinkType = "messenger" | "onpage" | "website";

export interface SendPushArgs {
  workspaceId: string; title: string; body: string;
  linkType?: PushLinkType; linkValue?: string; image?: string;
  contactId?: string; tags?: string[];
}

export async function sendPush(args: SendPushArgs): Promise<{ ok: boolean; sent: number; failed: number }> {
  const fn = httpsCallable(functions, "sendPush");
  return (await fn(args)).data as { ok: boolean; sent: number; failed: number };
}

export async function sendPushBroadcast(args: SendPushArgs & { idempotencyKey?: string }): Promise<{
  ok: boolean; broadcastId: string; sent: number; failed: number;
}> {
  const fn = httpsCallable(functions, "sendPushBroadcast");
  return (await fn(args)).data as { ok: boolean; broadcastId: string; sent: number; failed: number };
}

export interface SchedulePushArgs extends SendPushArgs {
  sendAt: string; // ISO
  onlyIfNoReply?: boolean;
  noReplyWindowMinutes?: number;
  idempotencyKey?: string;
}

export async function schedulePush(args: SchedulePushArgs): Promise<{ ok: boolean; scheduleId: string }> {
  const fn = httpsCallable(functions, "schedulePush");
  return (await fn(args)).data as { ok: boolean; scheduleId: string };
}

export async function cancelScheduledPush(workspaceId: string, scheduleId: string): Promise<{ ok: boolean }> {
  const fn = httpsCallable(functions, "cancelScheduledPush");
  return (await fn({ workspaceId, scheduleId })).data as { ok: boolean };
}

// ---------------------------------------------------------------------------
// Browser FCM helpers (used by the subscribe page and the app itself)
// ---------------------------------------------------------------------------

const TOKEN_STORAGE_KEY = "chatmize_push_token";

export function getStoredPushToken(): string | null {
  try { return localStorage.getItem(TOKEN_STORAGE_KEY); } catch { return null; }
}

function storePushToken(token: string) {
  try { localStorage.setItem(TOKEN_STORAGE_KEY, token); } catch { /* ignore */ }
}

export function clearStoredPushToken() {
  try { localStorage.removeItem(TOKEN_STORAGE_KEY); } catch { /* ignore */ }
}

async function messagingSupported(): Promise<boolean> {
  try {
    return "Notification" in window && "serviceWorker" in navigator && await isSupported();
  } catch {
    return false;
  }
}

/**
 * Full subscribe flow for the current browser: soft state -> permission ->
 * FCM token -> backend subscribe. Returns the outcome for UI rendering.
 */
export async function enableBrowserPush(args: {
  workspaceId: string; vapidPublicKey: string; tags?: string[]; contactId?: string; ownerUid?: string;
}): Promise<{ status: "subscribed" | "denied" | "blocked" | "unsupported" | "error"; message?: string }> {
  if (!(await messagingSupported())) return { status: "unsupported" };
  if (Notification.permission === "denied") return { status: "blocked" };
  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return { status: "denied" };
    const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
    await navigator.serviceWorker.ready;
    const messaging = getMessaging();
    const token = await getToken(messaging, {
      vapidKey: args.vapidPublicKey,
      serviceWorkerRegistration: registration,
    });
    if (!token) return { status: "error", message: "Could not get a push token. Try again." };
    await subscribePushToken({
      workspaceId: args.workspaceId,
      token,
      userAgent: navigator.userAgent,
      tags: args.tags,
      contactId: args.contactId,
      ownerUid: args.ownerUid,
    });
    storePushToken(token);
    return { status: "subscribed" };
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : "Something went wrong." };
  }
}

/** Foreground message listener for the app itself. */
export function listenForForegroundPush(
  onPush: (payload: { title: string; body: string; link?: string }) => void,
): () => void {
  let unsub: (() => void) | null = null;
  (async () => {
    try {
      if (!(await messagingSupported())) return;
      const messaging = getMessaging();
      unsub = onMessage(messaging, (msg) => {
        const data = (msg.data ?? {}) as Record<string, string>;
        onPush({
          title: msg.notification?.title ?? "New update",
          body: msg.notification?.body ?? "",
          link: data.link || undefined,
        });
        if (data.workspaceId) void trackPushEvent(data.workspaceId, "delivered");
      });
    } catch { /* ignore */ }
  })();
  return () => { if (unsub) unsub(); };
}
