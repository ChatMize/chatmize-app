import { getFunctions, httpsCallable } from 'firebase/functions';

export type BookingStatus = 'confirmed' | 'completed' | 'cancelled' | 'no_show';
export type ReminderChannel = 'email' | 'sms' | 'chat';

export interface BookingWorkingDay {
  day: number;
  start: string;
  end: string;
  enabled: boolean;
}

export interface BookingReminderRule {
  id: string;
  offsetMinutes: number;
  channels: ReminderChannel[];
  enabled: boolean;
  message?: string;
}

export interface BookingSettings {
  enabled: boolean;
  eventName: string;
  eventDescription?: string;
  location?: string;
  timeZone: string;
  workingHours: BookingWorkingDay[];
  slotMinutes: number;
  bufferMinutes: number;
  maxPerDay: number;
  minLeadHours: number;
  maxAdvanceDays: number;
  reminders: BookingReminderRule[];
  autoMarkNoShow: boolean;
  noShowGraceMinutes: number;
}

export interface BookingRow {
  id: string;
  name: string;
  email: string;
  phone: string;
  startUtc: string;
  endUtc: string;
  status: BookingStatus;
  source: string;
  remindersSent: Record<string, boolean>;
}

export interface PublicBookingSettings {
  eventName: string;
  eventDescription?: string;
  location?: string;
  timeZone: string;
  slotMinutes: number;
  maxAdvanceDays: number;
  minLeadHours: number;
  workingDays: number[];
}

export interface Slot {
  startUtc: string;
  endUtc: string;
}

// ---------------------------------------------------------------------------
// Admin: callable actions (folded into metaOAuthStatus; auth + workspace
// membership enforced by the host)
// ---------------------------------------------------------------------------

async function callBooking(workspaceId: string, action: string, extra: Record<string, unknown> = {}) {
  const functions = getFunctions();
  const fn = httpsCallable<Record<string, unknown>, unknown>(functions, 'metaOAuthStatus');
  const res = await fn({ workspaceId, action, ...extra });
  return res.data as any;
}

export async function getBookingSettings(workspaceId: string): Promise<BookingSettings> {
  const res = await callBooking(workspaceId, 'bookingGetSettings');
  return res.settings as BookingSettings;
}

export async function saveBookingSettings(workspaceId: string, settings: Partial<BookingSettings>): Promise<BookingSettings> {
  const res = await callBooking(workspaceId, 'bookingSaveSettings', { settings });
  return res.settings as BookingSettings;
}

export async function listBookings(
  workspaceId: string,
  opts: { fromIso?: string; toIso?: string; status?: BookingStatus; limit?: number } = {},
): Promise<BookingRow[]> {
  const res = await callBooking(workspaceId, 'bookingList', opts);
  return (res.bookings || []) as BookingRow[];
}

export async function adminCreateBooking(
  workspaceId: string,
  input: { name: string; email: string; phone?: string; startUtc: string; contactId?: string; notes?: string },
): Promise<{ bookingId: string; manageLink: string }> {
  return callBooking(workspaceId, 'bookingCreate', input);
}

export async function adminSetBookingStatus(workspaceId: string, bookingId: string, status: BookingStatus): Promise<void> {
  await callBooking(workspaceId, 'bookingSetStatus', { bookingId, status });
}

export async function adminCancelBooking(workspaceId: string, bookingId: string): Promise<void> {
  await callBooking(workspaceId, 'bookingCancel', { bookingId });
}

// ---------------------------------------------------------------------------
// Public API (/booking-api -> metaWebhook onRequest; no auth)
// ---------------------------------------------------------------------------

async function publicCall(action: string, params: Record<string, unknown> = {}, method: 'GET' | 'POST' = 'GET') {
  const qs = method === 'GET' ? `?action=${action}&` + new URLSearchParams(params as Record<string, string>).toString() : '';
  const res = await fetch(`/booking-api${qs}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: method === 'POST' ? JSON.stringify({ action, ...params }) : undefined,
  });
  const data = (await res.json()) as any;
  if (!data.ok) throw new Error(data.error || 'Booking request failed.');
  return data;
}

export async function getPublicBookingSettings(workspaceId: string): Promise<PublicBookingSettings> {
  const data = await publicCall('settings', { workspaceId });
  return data.settings as PublicBookingSettings;
}

export async function getBookingSlots(workspaceId: string, from: string, to: string): Promise<{ slots: Slot[]; timeZone: string }> {
  const data = await publicCall('slots', { workspaceId, from, to });
  return { slots: data.slots as Slot[], timeZone: data.timeZone as string };
}

export async function createPublicBooking(input: {
  workspaceId: string;
  name: string;
  email: string;
  phone?: string;
  startUtc: string;
  notes?: string;
  smsConsent?: boolean;
  embed?: boolean;
}): Promise<{ bookingId: string; manageLink: string; startUtc: string }> {
  return publicCall('create', input, 'POST');
}

export interface ManagedBooking {
  id: string;
  name: string;
  email: string;
  phone: string;
  startUtc: string;
  endUtc: string;
  status: BookingStatus;
  eventName: string;
  location: string;
  timeZone: string;
}

/**
 * Signed manage-link params, minted by the server at booking time and in
 * every reminder (?booking=<ws>.<id>&sig=...&exp=...).
 */
export interface ManageLinkAuth {
  workspaceId: string;
  bookingId: string;
  sig: string;
  exp: number;
}

export function parseManageLinkAuth(search: URLSearchParams): ManageLinkAuth | null {
  const raw = search.get('booking');
  if (!raw) return null;
  const dot = raw.indexOf('.');
  if (dot < 0) return null;
  const workspaceId = raw.slice(0, dot);
  const bookingId = raw.slice(dot + 1);
  const sig = search.get('sig') || '';
  const exp = Number(search.get('exp') || 0);
  if (!workspaceId || !bookingId || !sig || !Number.isFinite(exp)) return null;
  return { workspaceId, bookingId, sig, exp };
}

export async function getManagedBooking(auth: ManageLinkAuth): Promise<ManagedBooking> {
  const data = await publicCall('manage', {
    workspaceId: auth.workspaceId,
    bookingId: auth.bookingId,
    sig: auth.sig,
    exp: String(auth.exp),
  });
  return data.booking as ManagedBooking;
}

export async function rescheduleBooking(auth: ManageLinkAuth, newStartUtc: string): Promise<{ startUtc: string }> {
  return publicCall('reschedule', {
    workspaceId: auth.workspaceId,
    bookingId: auth.bookingId,
    sig: auth.sig,
    exp: String(auth.exp),
    newStartUtc,
  }, 'POST');
}

export async function cancelPublicBooking(auth: ManageLinkAuth): Promise<void> {
  await publicCall('cancel', {
    workspaceId: auth.workspaceId,
    bookingId: auth.bookingId,
    sig: auth.sig,
    exp: String(auth.exp),
  }, 'POST');
}

// ---------------------------------------------------------------------------
// Links
// ---------------------------------------------------------------------------

/** Shareable booking page for this workspace. */
export function bookingPageUrl(workspaceId: string): string {
  return `${window.location.origin}/?book=${encodeURIComponent(workspaceId)}`;
}

/** Iframe embed snippet for the workspace website. */
export function bookingEmbedSnippet(workspaceId: string): string {
  const src = `${window.location.origin}/?book=${encodeURIComponent(workspaceId)}&embed=1`;
  return `<iframe src="${src}" width="100%" height="640" style="border:0;border-radius:12px" title="Book now"></iframe>`;
}

export const BOOKING_TRIGGER_TYPES = [
  'booking_created',
  'booking_reminder_due',
  'booking_completed',
  'booking_no_show',
  'booking_cancelled',
] as const;

export type BookingTriggerType = (typeof BOOKING_TRIGGER_TYPES)[number];
