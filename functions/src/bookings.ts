/**
 * ChatMize native bookings app.
 *
 * Our own booking experience, not dependent on Calendly or any third party:
 * availability settings per workspace, an embeddable/shareable booking page,
 * booking records on the contact, automated calendar reminders over
 * email/SMS/chat (the no-show killer), contact-facing reschedule and cancel
 * links, BotMaps triggers and actions, and a serverless reminder sweep.
 *
 * Firestore layout:
 *   workspaces/{ws}/bookingSettings/config   availability + reminder rules
 *                                            (server-only signingKey for links)
 *   workspaces/{ws}/bookings/{id}            one booking per doc
 *   workspaces/{ws}/bookingLocks/slot_{ms}   one lock doc per taken slot;
 *                                            the transactional double-booking guard
 *   workspaces/{ws}/bookingEvents/{id}       append-only event log; the flow
 *                                            runtime consumes these to fire
 *                                            BotMaps booking triggers
 *
 * Serverless and cheap by design: one onSchedule sweep every 15 minutes runs
 * a single collection-group query for due reminders; everything else is
 * event driven. No idle servers, no per-seat cost.
 */
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { createHmac, randomBytes, timingSafeEqual } from "crypto";

const db = () => getFirestore("chatmize-prod");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BookingStatus = "confirmed" | "completed" | "cancelled" | "no_show";
export type BookingSource = "widget" | "embed" | "botmap" | "admin" | "mcp";
export type ReminderChannel = "email" | "sms" | "chat" | "push";

export interface BookingWorkingDay {
  day: number; // 0 = Sunday ... 6 = Saturday
  start: string; // "09:00"
  end: string; // "17:00"
  enabled: boolean;
}

export interface BookingReminderRule {
  id: string;
  offsetMinutes: number; // minutes before the booking starts
  channels: ReminderChannel[];
  enabled: boolean;
  /** Optional override; supports {{name}} {{event_name}} {{date}} {{time}} {{manage_link}} */
  message?: string;
}

export interface BookingSettings {
  enabled: boolean;
  eventName: string;
  eventDescription?: string;
  location?: string;
  timeZone: string; // IANA, default America/Phoenix
  workingHours: BookingWorkingDay[];
  slotMinutes: number;
  bufferMinutes: number;
  maxPerDay: number;
  minLeadHours: number;
  maxAdvanceDays: number;
  reminders: BookingReminderRule[];
  autoMarkNoShow: boolean;
  noShowGraceMinutes: number;
  /**
   * Server-only HMAC key used to sign contact-facing manage links.
   * Never sent to clients: the admin callable strips it, the public API
   * never includes it, and Firestore rules deny client reads of
   * bookingSettings entirely.
   */
  signingKey?: string;
  updatedAt?: Timestamp;
}

export interface BookingReminderAttempt {
  ruleId: string;
  channel: ReminderChannel;
  at: Timestamp;
  ok: boolean;
  error?: string;
}

export interface Booking {
  contactId?: string;
  name: string;
  email: string;
  phone?: string;
  startUtc: Timestamp;
  endUtc: Timestamp;
  status: BookingStatus;
  channel?: string;
  recipientId?: string;
  remindersSent: Record<string, boolean>;
  reminderLog: BookingReminderAttempt[];
  /** Confirmation message delivery record (email on creation). */
  confirmationSent?: { channel: string; at: Timestamp; ok: boolean; error?: string };
  source: BookingSource;
  variables?: Record<string, string>;
  notes?: string;
  smsConsent: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  cancelledAt?: Timestamp;
  completedAt?: Timestamp;
  noShowAt?: Timestamp;
}

export type BookingEventType =
  | "booking_created"
  | "booking_reminder_due"
  | "booking_completed"
  | "booking_no_show"
  | "booking_cancelled"
  | "booking_rescheduled";

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_TZ = "America/Phoenix";

function defaultWorkingHours(): BookingWorkingDay[] {
  return [0, 1, 2, 3, 4, 5, 6].map((day) => ({
    day,
    start: "09:00",
    end: "17:00",
    enabled: day >= 1 && day <= 5,
  }));
}

export function defaultBookingSettings(): BookingSettings {
  return {
    enabled: true,
    eventName: "Intro Call",
    eventDescription: "",
    location: "",
    timeZone: DEFAULT_TZ,
    workingHours: defaultWorkingHours(),
    slotMinutes: 30,
    bufferMinutes: 10,
    maxPerDay: 8,
    minLeadHours: 2,
    maxAdvanceDays: 30,
    reminders: [
      {
        id: "r24h",
        offsetMinutes: 24 * 60,
        channels: ["email", "sms", "chat"],
        enabled: true,
      },
      {
        id: "r1h",
        offsetMinutes: 60,
        channels: ["email", "sms", "chat"],
        enabled: true,
      },
    ],
    autoMarkNoShow: true,
    noShowGraceMinutes: 30,
  };
}

export async function getBookingSettings(workspaceId: string): Promise<BookingSettings> {
  const ref = db()
    .collection("workspaces")
    .doc(workspaceId)
    .collection("bookingSettings")
    .doc("config");
  const snap = await ref.get();
  if (!snap.exists) return defaultBookingSettings();
  const settings = { ...defaultBookingSettings(), ...(snap.data() as Partial<BookingSettings>) };
  // Lazy server-side key init: workspaces that never saved settings (or have
  // a pre-key document) get a key minted and persisted now, so manage links
  // and reminders work without the user pressing Save first. Never sent to
  // clients; callers must use clientSafeSettings().
  if (!settings.signingKey || settings.signingKey.length < 32) {
    settings.signingKey = randomBytes(32).toString("hex");
    await ref.set(
      { signingKey: settings.signingKey, updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    ).catch(() => {});
  }
  return settings;
}

function sanitizeSettings(input: Partial<BookingSettings>): BookingSettings {
  const d = defaultBookingSettings();
  const s: BookingSettings = {
    enabled: input.enabled !== false,
    eventName: String(input.eventName || d.eventName).slice(0, 80),
    eventDescription: String(input.eventDescription || "").slice(0, 500),
    location: String(input.location || "").slice(0, 200),
    timeZone: String(input.timeZone || d.timeZone).slice(0, 60),
    workingHours: Array.isArray(input.workingHours) ? input.workingHours.slice(0, 7).map((w, i) => ({
      day: Number.isFinite(w?.day) ? Math.max(0, Math.min(6, w.day | 0)) : i,
      start: /^\d{2}:\d{2}$/.test(w?.start || "") ? w.start : "09:00",
      end: /^\d{2}:\d{2}$/.test(w?.end || "") ? w.end : "17:00",
      enabled: w?.enabled === true,
    })) : d.workingHours,
    slotMinutes: Math.max(5, Math.min(480, Number(input.slotMinutes) || d.slotMinutes)),
    bufferMinutes: Math.max(0, Math.min(240, Number(input.bufferMinutes) || 0)),
    maxPerDay: Math.max(1, Math.min(100, Number(input.maxPerDay) || d.maxPerDay)),
    minLeadHours: Math.max(0, Math.min(720, Number(input.minLeadHours) || 0)),
    maxAdvanceDays: Math.max(1, Math.min(365, Number(input.maxAdvanceDays) || d.maxAdvanceDays)),
    reminders: Array.isArray(input.reminders) ? input.reminders.slice(0, 5).map((r, i) => ({
      id: String(r?.id || `r${i}`).slice(0, 20),
      offsetMinutes: Math.max(5, Math.min(7 * 24 * 60, Number(r?.offsetMinutes) || 60)),
      channels: (Array.isArray(r?.channels) ? r.channels : []).filter((c: string) =>
        c === "email" || c === "sms" || c === "chat" || c === "push",
      ) as ReminderChannel[],
      enabled: r?.enabled !== false,
      message: r?.message ? String(r.message).slice(0, 1000) : undefined,
    })) : d.reminders,
    autoMarkNoShow: input.autoMarkNoShow !== false,
    noShowGraceMinutes: Math.max(0, Math.min(1440, Number(input.noShowGraceMinutes) || 0)),
  };
  return s;
}

export async function saveBookingSettings(
  workspaceId: string,
  input: Partial<BookingSettings>,
): Promise<BookingSettings> {
  const settings = sanitizeSettings(input);
  // The signing key is server-only: never accept one from the client, keep
  // the existing key, and mint one on first save.
  const existing = await db()
    .collection("workspaces")
    .doc(workspaceId)
    .collection("bookingSettings")
    .doc("config")
    .get();
  const existingKey = (existing.data() as Partial<BookingSettings> | undefined)?.signingKey;
  settings.signingKey = existingKey && existingKey.length >= 32
    ? existingKey
    : randomBytes(32).toString("hex");
  await db()
    .collection("workspaces")
    .doc(workspaceId)
    .collection("bookingSettings")
    .doc("config")
    .set({ ...settings, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  return settings;
}

/**
 * Strip server-only fields before a settings object crosses to the client.
 * Callers (admin callable, public API) must use this.
 */
export function clientSafeSettings(s: BookingSettings): Omit<BookingSettings, "signingKey"> {
  const { signingKey: _omit, ...rest } = s;
  return rest;
}

// ---------------------------------------------------------------------------
// Manage links (contact-facing reschedule/cancel, no login required)
// ---------------------------------------------------------------------------
//
// Signed HMAC links instead of stored tokens: nothing secret is stored on the
// booking, links can expire, and the server can mint a valid link at any time
// (for example inside reminder messages). The signature covers
// workspaceId.bookingId.expiry with the workspace signing key.

const MANAGE_LINK_TTL_MS = 60 * 24 * 3600 * 1000; // 60 days

function ensureKey(settings: BookingSettings): string {
  if (!settings.signingKey || settings.signingKey.length < 32) {
    throw new Error("Booking signing key is not configured for this workspace.");
  }
  return settings.signingKey;
}

export function signManageLink(
  workspaceId: string,
  bookingId: string,
  settings: BookingSettings,
  ttlMs = MANAGE_LINK_TTL_MS,
): { sig: string; exp: number } {
  const exp = Date.now() + ttlMs;
  const sig = createHmac("sha256", ensureKey(settings))
    .update(`${workspaceId}.${bookingId}.${exp}`)
    .digest("hex");
  return { sig, exp };
}

export function verifyManageLink(
  workspaceId: string,
  bookingId: string,
  sig: string,
  exp: number,
  settings: BookingSettings,
): boolean {
  if (!sig || !Number.isFinite(exp) || Date.now() > exp) return false;
  const expected = createHmac("sha256", ensureKey(settings))
    .update(`${workspaceId}.${bookingId}.${exp}`)
    .digest("hex");
  if (sig.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(sig, "utf8"), Buffer.from(expected, "utf8"));
}

/** Public booking page URL for a workspace (also used by BotMaps booking blocks). */
export function bookingPageUrl(workspaceId: string): string {
  return `https://app.chatmize.com/?book=${encodeURIComponent(workspaceId)}`;
}

export function manageLinkFor(
  workspaceId: string,
  bookingId: string,
  settings: BookingSettings,
): string {
  const base = "https://app.chatmize.com";
  const { sig, exp } = signManageLink(workspaceId, bookingId, settings);
  return `${base}/?booking=${encodeURIComponent(workspaceId)}.${encodeURIComponent(bookingId)}&sig=${sig}&exp=${exp}`;
}

export interface BookingBlockContent {
  text: string;
  buttonText: string;
  buttonUrl: string;
}

/**
 * Convert a BotMaps booking block into real outbound content: intro text plus
 * a URL button that opens the workspace booking page. The channel send layer
 * renders this as a native URL button (Messenger/IG button template,
 * WhatsApp CTA, or plain link). When the contact books, booking_created
 * fires and the booking data lands on their contact automatically.
 */
export function bookingBlockContent(
  workspaceId: string,
  introText?: string,
  buttonText?: string,
): BookingBlockContent {
  return {
    text: (introText || "Pick a time that works for you:").slice(0, 1000),
    buttonText: (buttonText || "Book now").slice(0, 50),
    buttonUrl: bookingPageUrl(workspaceId),
  };
}

/**
 * Verify a contact's signed manage-link params and load the booking.
 * Returns null when the link is invalid, expired, or the booking is gone.
 */
export async function findBookingBySignedLink(
  workspaceId: string,
  bookingId: string,
  sig: string,
  exp: number,
): Promise<{ id: string; booking: Booking } | null> {
  if (!workspaceId || !bookingId || !sig) return null;
  const settings = await getBookingSettings(workspaceId);
  if (!verifyManageLink(workspaceId, bookingId, sig, exp, settings)) return null;
  const snap = await db()
    .collection("workspaces")
    .doc(workspaceId)
    .collection("bookings")
    .doc(bookingId)
    .get();
  if (!snap.exists) return null;
  return { id: snap.id, booking: snap.data() as Booking };
}

// ---------------------------------------------------------------------------
// Slot engine (pure, timezone aware)
// ---------------------------------------------------------------------------

export interface Slot {
  startUtc: string; // ISO
  endUtc: string; // ISO
}

function tzDateParts(date: Date, timeZone: string): { y: number; m: number; d: number; wd: number; hh: number; mm: number } {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts: Record<string, string> = {};
  for (const p of fmt.formatToParts(date)) parts[p.type] = p.value;
  const wdMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    y: Number(parts.year),
    m: Number(parts.month),
    d: Number(parts.day),
    wd: wdMap[parts.weekday] ?? 0,
    hh: Number(parts.hour) % 24,
    mm: Number(parts.minute),
  };
}

/**
 * Convert a wall-clock time in the workspace timezone to a UTC instant.
 * Handles DST transitions: the offset is resolved at the wall time itself
 * (refined twice, which converges for all real zones), and nonexistent
 * wall times (the lost hour on spring forward) are detectable by callers
 * via the round-trip check.
 */
export function tzWallToUtc(
  y: number, m: number, d: number, hh: number, mm: number, timeZone: string,
): number {
  const wallAsUtc = Date.UTC(y, m - 1, d, hh, mm, 0);
  let utc = wallAsUtc;
  for (let i = 0; i < 2; i++) {
    const p = tzDateParts(new Date(utc), timeZone);
    const backAsUtc = Date.UTC(p.y, p.m - 1, p.d, p.hh, p.mm, 0);
    utc = wallAsUtc - (backAsUtc - utc);
  }
  return utc;
}

/** True local midnight as a UTC instant (offset resolved at midnight). */
function tzMidnightUtc(y: number, m: number, d: number, timeZone: string): number {
  return tzWallToUtc(y, m, d, 0, 0, timeZone);
}

/** True when the wall time exists in the zone (false inside the spring-forward gap). */
function wallTimeExists(
  y: number, m: number, d: number, hh: number, mm: number, timeZone: string, utc: number,
): boolean {
  const p = tzDateParts(new Date(utc), timeZone);
  return p.y === y && p.m === m && p.d === d && p.hh === hh && p.mm === mm;
}

function parseHm(hm: string): number {
  const [h, m] = hm.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Compute open slots for a date range. `fromIso`/`toIso` are ISO date
 * strings (YYYY-MM-DD) in the workspace timezone.
 */
export function computeSlots(
  settings: BookingSettings,
  existing: { startUtc: number; endUtc: number }[],
  fromIso: string,
  toIso: string,
  nowMs = Date.now(),
): Slot[] {
  const slots: Slot[] = [];
  const tz = settings.timeZone || DEFAULT_TZ;
  const minStart = nowMs + settings.minLeadHours * 3600 * 1000;
  const maxStart = nowMs + settings.maxAdvanceDays * 24 * 3600 * 1000;

  const [fy, fm, fd] = fromIso.split("-").map(Number);
  const [ty, tm, td] = toIso.split("-").map(Number);
  if (!fy || !ty) return slots;

  // Walk calendar dates (in the workspace timezone's date frame), not fixed
  // 24h steps: DST transition days are 23 or 25 UTC hours long.
  const startDayUtc = Date.UTC(fy, fm - 1, fd);
  const endDayUtc = Date.UTC(ty, tm - 1, td);
  let guard = 0;

  for (let dUtc = startDayUtc; dUtc <= endDayUtc && guard++ < 400; dUtc += 24 * 3600 * 1000) {
    const dd = new Date(dUtc);
    const y = dd.getUTCFullYear();
    const m = dd.getUTCMonth() + 1;
    const d = dd.getUTCDate();
    const dayStartMs = tzMidnightUtc(y, m, d, tz);
    const nextDayStartMs = tzWallToUtc(y, m, d, 24, 0, tz); // true next midnight, DST-safe
    // Weekday from local noon (never ambiguous, even on transition days).
    const parts = tzDateParts(new Date(dayStartMs + 12 * 3600 * 1000), tz);
    const dayCfg = settings.workingHours.find((w) => w.day === parts.wd);
    if (dayCfg?.enabled) {
      const openMin = parseHm(dayCfg.start);
      const closeMin = parseHm(dayCfg.end);
      const dayBookings = existing
        .filter((b) => b.startUtc >= dayStartMs && b.startUtc < nextDayStartMs)
        .sort((a, b) => a.startUtc - b.startUtc);
      if (dayBookings.length < settings.maxPerDay && closeMin > openMin) {
        for (let s = openMin; s + settings.slotMinutes <= closeMin; s += settings.slotMinutes) {
          const hh = Math.floor(s / 60);
          const mm = s % 60;
          // Convert each slot from wall time: correct across DST changes.
          const slotStart = tzWallToUtc(y, m, d, hh, mm, tz);
          // Skip wall times that never happen (the lost hour on spring forward).
          if (!wallTimeExists(y, m, d, hh, mm, tz, slotStart)) continue;
          const slotEnd = slotStart + settings.slotMinutes * 60 * 1000;
          if (slotStart < minStart || slotStart > maxStart) continue;
          const buf = settings.bufferMinutes * 60 * 1000;
          const clash = dayBookings.some(
            (b) => slotStart < b.endUtc + buf && slotEnd > b.startUtc - buf,
          );
          if (clash) continue;
          slots.push({ startUtc: new Date(slotStart).toISOString(), endUtc: new Date(slotEnd).toISOString() });
        }
      }
    }
  }
  return slots;
}

async function confirmedBookingsInRange(
  workspaceId: string,
  fromMs: number,
  toMs: number,
): Promise<{ startUtc: number; endUtc: number }[]> {
  const snap = await db()
    .collection("workspaces")
    .doc(workspaceId)
    .collection("bookings")
    .where("status", "==", "confirmed")
    .where("startUtc", ">=", Timestamp.fromMillis(fromMs))
    .where("startUtc", "<=", Timestamp.fromMillis(toMs))
    .get();
  return snap.docs.map((d) => {
    const b = d.data() as Booking;
    return { startUtc: b.startUtc.toMillis(), endUtc: b.endUtc.toMillis() };
  });
}

// ---------------------------------------------------------------------------
// Booking CRUD
// ---------------------------------------------------------------------------

export interface CreateBookingInput {
  workspaceId: string;
  name: string;
  email: string;
  phone?: string;
  startUtc: string; // ISO
  contactId?: string;
  channel?: string;
  recipientId?: string;
  source: BookingSource;
  notes?: string;
  smsConsent?: boolean;
  variables?: Record<string, string>;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

export async function createBooking(
  input: CreateBookingInput,
): Promise<{ id: string; booking: Booking; manageLink: string }> {
  const settings = await getBookingSettings(input.workspaceId);
  if (!settings.enabled) throw new Error("Online booking is turned off for this workspace.");

  const name = String(input.name || "").trim().slice(0, 120);
  const email = String(input.email || "").trim().toLowerCase().slice(0, 200);
  if (!name) throw new Error("A name is required.");
  if (!isValidEmail(email)) throw new Error("A valid email address is required.");

  const startMs = new Date(input.startUtc).getTime();
  if (!Number.isFinite(startMs)) throw new Error("A valid start time is required.");
  const endMs = startMs + settings.slotMinutes * 60 * 1000;

  const wsRef = db().collection("workspaces").doc(input.workspaceId);
  const bookingsRef = wsRef.collection("bookings");
  const locksRef = wsRef.collection("bookingLocks");
  // Deterministic slot lock: one doc per slot start. The transaction below
  // makes the lock check and the booking write atomic, so two simultaneous
  // requests for the same slot cannot both succeed.
  const lockRef = locksRef.doc(`slot_${startMs}`);
  const bookingRef = bookingsRef.doc();

  const pad = (n: number) => String(n).padStart(2, "0");
  const parts = tzDateParts(new Date(startMs), settings.timeZone || DEFAULT_TZ);
  const dayIso = `${parts.y}-${pad(parts.m)}-${pad(parts.d)}`;
  const dayStart = startMs - (startMs % (24 * 3600 * 1000));

  const now = Timestamp.now();
  const booking: Booking = {
    name,
    email,
    phone: input.phone ? String(input.phone).slice(0, 40) : undefined,
    contactId: input.contactId,
    startUtc: Timestamp.fromMillis(startMs),
    endUtc: Timestamp.fromMillis(endMs),
    status: "confirmed",
    channel: input.channel,
    recipientId: input.recipientId,
    remindersSent: {},
    reminderLog: [],
    source: input.source,
    notes: input.notes ? String(input.notes).slice(0, 1000) : undefined,
    smsConsent: input.smsConsent === true,
    variables: input.variables,
    createdAt: now,
    updatedAt: now,
  };

  await db().runTransaction(async (txn) => {
    const lockSnap = await txn.get(lockRef);
    if (lockSnap.exists) throw new Error("That time was just taken. Please pick another slot.");
    // Re-check availability inside the transaction so the check and the
    // write are one atomic step.
    const q = bookingsRef
      .where("status", "==", "confirmed")
      .where("startUtc", ">=", Timestamp.fromMillis(dayStart - 24 * 3600 * 1000))
      .where("startUtc", "<=", Timestamp.fromMillis(dayStart + 2 * 24 * 3600 * 1000));
    const qsnap = await txn.get(q);
    const existing = qsnap.docs.map((d) => {
      const b = d.data() as Booking;
      return { startUtc: b.startUtc.toMillis(), endUtc: b.endUtc.toMillis() };
    });
    const open = computeSlots(settings, existing, dayIso, dayIso);
    const stillOpen = open.some((s) => new Date(s.startUtc).getTime() === startMs);
    if (!stillOpen) throw new Error("That time was just taken. Please pick another slot.");
    txn.set(lockRef, {
      bookingId: bookingRef.id,
      startUtc: Timestamp.fromMillis(startMs),
      createdAt: FieldValue.serverTimestamp(),
    });
    txn.set(bookingRef, booking);
  });

  const manageLink = manageLinkFor(input.workspaceId, bookingRef.id, settings);

  // Link booking data onto the contact as variables for personalization.
  if (input.contactId) {
    await linkBookingToContact(input.workspaceId, input.contactId, bookingRef.id, booking, settings).catch((e) =>
      logger.warn("Could not link booking to contact", { workspaceId: input.workspaceId, bookingId: bookingRef.id, err: String(e) }),
    );
  }

  // SMS consent: a checked "text me reminders" box counts as opt-in for
  // transactional reminders.
  if (booking.smsConsent && booking.phone) {
    try {
      const { setOptIn, normalizePhone } = await import("./sms.js");
      const e164 = normalizePhone(booking.phone);
      if (e164) await setOptIn(input.workspaceId, e164, true, "booking_reminder_consent");
    } catch (e) {
      logger.warn("Could not record SMS consent for booking", { err: String(e) });
    }
  }

  // Confirmation email: the contact gets the booking details plus their
  // signed manage link. Tracked on the booking; never fails the creation.
  if (booking.email) {
    try {
      const { sendNotificationEmail } = await import("./notifications.js");
      const link = manageLinkFor(input.workspaceId, bookingRef.id, settings);
      const start = booking.startUtc.toDate();
      const tz = settings.timeZone || DEFAULT_TZ;
      const dateStr = start.toLocaleDateString("en-US", { timeZone: tz, weekday: "long", month: "long", day: "numeric" });
      const timeStr = start.toLocaleTimeString("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" });
      const text =
        `Hi ${booking.name}, your ${settings.eventName} is booked for ${dateStr} at ${timeStr}` +
        `${settings.location ? ` (${settings.location})` : ""}. ` +
        `Need to change or cancel? ${link}`;
      const res = await sendNotificationEmail({
        workspaceId: input.workspaceId,
        type: "booking_confirmation",
        to: booking.email,
        subject: `Booked: ${settings.eventName} on ${dateStr}`,
        html: `<p>${escapeHtml(text).replace(/\n/g, "<br>")}</p>`,
        text,
        dedupeKey: `booking:${bookingRef.id}:confirmation:email`,
        cooldownMs: 7 * 24 * 3600 * 1000,
      });
      await bookingRef.set(
        { confirmationSent: { channel: "email", at: Timestamp.now(), ok: res.sent, ...(res.reason ? { error: res.reason } : {}) }, updatedAt: FieldValue.serverTimestamp() },
        { merge: true },
      );
    } catch (e) {
      logger.warn("Could not send booking confirmation", { workspaceId: input.workspaceId, bookingId: bookingRef.id, err: String(e) });
    }
  }

  await logBookingEvent(input.workspaceId, bookingRef.id, "booking_created", {
    name,
    email,
    startUtc: new Date(startMs).toISOString(),
    source: input.source,
    contactId: input.contactId,
  });

  return { id: bookingRef.id, booking, manageLink };
}

async function linkBookingToContact(
  workspaceId: string,
  contactId: string,
  bookingId: string,
  booking: Booking,
  settings: BookingSettings,
): Promise<void> {
  // Contacts live in the root `contacts` collection (the workspace
  // subcollection is not the canonical store; the UI and personalization
  // both read root).
  const ref = db().collection("contacts").doc(contactId);
  const snap = await ref.get();
  if (!snap.exists) return;
  const start = booking.startUtc.toDate();
  const dateStr = start.toLocaleDateString("en-US", { timeZone: settings.timeZone, month: "long", day: "numeric", year: "numeric" });
  const timeStr = start.toLocaleTimeString("en-US", { timeZone: settings.timeZone, hour: "numeric", minute: "2-digit" });
  const vars: Record<string, string> = {
    booking_id: bookingId,
    booking_event: settings.eventName,
    booking_date: dateStr,
    booking_time: timeStr,
    booking_status: booking.status,
    ...(booking.variables || {}),
  };
  const existing = (snap.data()?.customFields || {}) as Record<string, unknown>;
  await ref.set(
    {
      customFields: { ...existing, ...vars },
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}

export async function cancelBookingById(
  workspaceId: string,
  bookingId: string,
  reason?: string,
): Promise<void> {
  await updateBookingStatus(workspaceId, bookingId, "cancelled");
  await logBookingEvent(workspaceId, bookingId, "booking_cancelled", { reason: reason || "" });
}

/**
 * Change a booking's status transactionally, keeping the slot lock in sync:
 * cancelling releases the lock, and re-confirming a cancelled booking
 * re-checks the slot and re-acquires it.
 */
export async function setBookingStatus(
  workspaceId: string,
  bookingId: string,
  status: BookingStatus,
): Promise<void> {
  const ok: BookingStatus[] = ["confirmed", "completed", "cancelled", "no_show"];
  if (!ok.includes(status)) throw new Error("Invalid status.");
  const prevStatus = await updateBookingStatus(workspaceId, bookingId, status);
  const event: BookingEventType =
    status === "completed" ? "booking_completed" : status === "no_show" ? "booking_no_show" : "booking_cancelled";
  if (status !== "confirmed" || prevStatus !== "confirmed") {
    await logBookingEvent(workspaceId, bookingId, event, {});
  }
}

async function updateBookingStatus(
  workspaceId: string,
  bookingId: string,
  status: BookingStatus,
): Promise<BookingStatus> {
  const wsRef = db().collection("workspaces").doc(workspaceId);
  const ref = wsRef.collection("bookings").doc(bookingId);
  const locksRef = wsRef.collection("bookingLocks");

  let prevStatus: BookingStatus = "confirmed";
  let contactId: string | undefined;

  await db().runTransaction(async (txn) => {
    const snap = await txn.get(ref);
    if (!snap.exists) throw new Error("Booking not found.");
    const booking = snap.data() as Booking;
    prevStatus = booking.status;
    contactId = booking.contactId;
    if (prevStatus === status) return;

    const patch: Record<string, unknown> = { status, updatedAt: FieldValue.serverTimestamp() };
    if (status === "completed") patch.completedAt = FieldValue.serverTimestamp();
    if (status === "no_show") patch.noShowAt = FieldValue.serverTimestamp();
    if (status === "cancelled") patch.cancelledAt = FieldValue.serverTimestamp();

    if (status === "cancelled") {
      // Release the slot lock so the slot opens back up.
      txn.delete(locksRef.doc(`slot_${booking.startUtc.toMillis()}`));
    }
    if (status === "confirmed" && prevStatus === "cancelled") {
      // Re-confirming: the slot must still be free.
      const startMs = booking.startUtc.toMillis();
      const lockSnap = await txn.get(locksRef.doc(`slot_${startMs}`));
      if (lockSnap.exists) throw new Error("That slot was taken while the booking was cancelled.");
      txn.set(locksRef.doc(`slot_${startMs}`), {
        bookingId,
        startUtc: Timestamp.fromMillis(startMs),
        createdAt: FieldValue.serverTimestamp(),
      });
    }
    txn.set(ref, patch, { merge: true });
  });

  if (contactId) {
    await db().collection("contacts").doc(contactId).set(
      { customFields: { booking_status: status }, updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    ).catch(() => {});
  }
  return prevStatus;
}

export async function listBookings(
  workspaceId: string,
  opts: { fromIso?: string; toIso?: string; status?: BookingStatus; limit?: number } = {},
): Promise<{ id: string; booking: Booking }[]> {
  let q = db()
    .collection("workspaces")
    .doc(workspaceId)
    .collection("bookings")
    .orderBy("startUtc", "desc")
    .limit(Math.max(1, Math.min(200, opts.limit || 50)));
  if (opts.status) q = q.where("status", "==", opts.status) as typeof q;
  const snap = await q.get();
  let rows = snap.docs.map((d) => ({ id: d.id, booking: d.data() as Booking }));
  if (opts.fromIso) {
    const from = new Date(opts.fromIso).getTime();
    rows = rows.filter((r) => r.booking.startUtc.toMillis() >= from);
  }
  if (opts.toIso) {
    const to = new Date(opts.toIso).getTime();
    rows = rows.filter((r) => r.booking.startUtc.toMillis() <= to);
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Event log + BotMaps trigger dispatch
// ---------------------------------------------------------------------------

export async function logBookingEvent(
  workspaceId: string,
  bookingId: string,
  type: BookingEventType,
  payload: Record<string, unknown>,
): Promise<void> {
  const ref = db().collection("workspaces").doc(workspaceId).collection("bookingEvents").doc();
  let contactId: string | undefined;
  try {
    const b = await db().collection("workspaces").doc(workspaceId).collection("bookings").doc(bookingId).get();
    contactId = (b.data() as Booking | undefined)?.contactId;
  } catch {
    // event log must never fail the booking write
  }
  await ref.set({
    type,
    bookingId,
    contactId: contactId || null,
    payload,
    createdAt: FieldValue.serverTimestamp(),
  });
  // BotMaps triggers (booking_created, booking_reminder_due, booking_completed,
  // booking_no_show, booking_cancelled, booking_rescheduled) are matched by the
  // flow runtime off this event log. BotMap flow definitions live in the
  // builder client, so there is no server-side trigger query here: the
  // runtime consumes bookingEvents and starts the flows whose trigger type
  // matches, then executes any CreateBooking/CancelBooking action tags via
  // executeBookingAction().
}

// ---------------------------------------------------------------------------
// Reminder templates + sending
// ---------------------------------------------------------------------------

function renderTemplate(
  template: string,
  booking: Booking,
  settings: BookingSettings,
  manageLink: string,
): string {
  const start = booking.startUtc.toDate();
  const tz = settings.timeZone || DEFAULT_TZ;
  const dateStr = start.toLocaleDateString("en-US", { timeZone: tz, weekday: "long", month: "long", day: "numeric" });
  const timeStr = start.toLocaleTimeString("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" });
  return template
    .replace(/\{\{\s*name\s*\}\}/g, booking.name)
    .replace(/\{\{\s*event_name\s*\}\}/g, settings.eventName)
    .replace(/\{\{\s*date\s*\}\}/g, dateStr)
    .replace(/\{\{\s*time\s*\}\}/g, timeStr)
    .replace(/\{\{\s*location\s*\}\}/g, settings.location || "")
    .replace(/\{\{\s*manage_link\s*\}\}/g, manageLink);
}

function defaultReminderMessage(rule: BookingReminderRule, settings: BookingSettings): string {
  const when = rule.offsetMinutes >= 120
    ? `${Math.round(rule.offsetMinutes / 60)} hours`
    : `${rule.offsetMinutes} minutes`;
  return `Hi {{name}}, this is a friendly reminder that your ${settings.eventName} is in ${when} on {{date}} at {{time}}. Need to change it? {{manage_link}}`;
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function sendBookingReminder(
  workspaceId: string,
  bookingId: string,
  booking: Booking,
  settings: BookingSettings,
  rule: BookingReminderRule,
): Promise<void> {
  // Manage links are HMAC-signed server-side, so reminders carry a real
  // working reschedule/cancel link for the contact.
  const link = manageLinkFor(workspaceId, bookingId, settings);
  const template = rule.message || defaultReminderMessage(rule, settings);
  const text = renderTemplate(template, booking, settings, link);
  const results: BookingReminderAttempt[] = [];

  for (const channel of rule.channels) {
    try {
      if (channel === "email" && booking.email) {
        const { sendNotificationEmail } = await import("./notifications.js");
        const res = await sendNotificationEmail({
          workspaceId,
          type: "booking_reminder",
          to: booking.email,
          subject: `Reminder: ${settings.eventName} on ${booking.startUtc.toDate().toLocaleDateString("en-US", { timeZone: settings.timeZone })}`,
          html: `<p>${escapeHtml(text).replace(/\n/g, "<br>")}</p>`,
          text,
          dedupeKey: `booking:${bookingId}:${rule.id}:email`,
          cooldownMs: 7 * 24 * 3600 * 1000,
        });
        results.push({ ruleId: rule.id, channel, at: Timestamp.now(), ok: res.sent, error: res.reason });
      } else if (channel === "sms" && booking.phone) {
        const { sendSmsInternal } = await import("./smsSend.js");
        await sendSmsInternal(workspaceId, booking.phone, text);
        results.push({ ruleId: rule.id, channel, at: Timestamp.now(), ok: true });
      } else if (channel === "chat" && booking.channel && booking.recipientId) {
        const { sendChannelMessageInternal } = await import("./channelSend.js");
        await sendChannelMessageInternal(
          workspaceId,
          booking.channel as "messenger",
          booking.recipientId,
          text,
        );
        results.push({ ruleId: rule.id, channel, at: Timestamp.now(), ok: true });
      } else if (channel === "push" && booking.contactId) {
        const { sendPushToContact } = await import("./push.js");
        const ok = await sendPushToContact(workspaceId, booking.contactId, {
          title: `Reminder: ${settings.eventName}`,
          body: text,
          linkType: "website",
          linkValue: link,
        });
        results.push({ ruleId: rule.id, channel, at: Timestamp.now(), ok, error: ok ? undefined : "no-subscribers" });
      } else {
        results.push({ ruleId: rule.id, channel, at: Timestamp.now(), ok: false, error: "no-address" });
      }
    } catch (e) {
      results.push({ ruleId: rule.id, channel, at: Timestamp.now(), ok: false, error: String(e).slice(0, 200) });
    }
  }

  const okAny = results.some((r) => r.ok);
  // Mark the rule sent with an explicit nested map (never a dotted dynamic
  // key, which Firestore would store as a literal field name).
  const bookingRef = db()
    .collection("workspaces")
    .doc(workspaceId)
    .collection("bookings")
    .doc(bookingId);
  const curSnap = await bookingRef.get();
  const curSent = ((curSnap.data() as Booking | undefined)?.remindersSent || {}) as Record<string, boolean>;
  await bookingRef.set(
    {
      remindersSent: { ...curSent, [rule.id]: okAny },
      reminderLog: FieldValue.arrayUnion(...results.map((r) => ({ ...r }))),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  await logBookingEvent(workspaceId, bookingId, "booking_reminder_due", {
    ruleId: rule.id,
    results: results.map((r) => ({ channel: r.channel, ok: r.ok, error: r.error || "" })),
  });
}

// ---------------------------------------------------------------------------
// Reminder sweep (onSchedule every 15 minutes)
// ---------------------------------------------------------------------------

/**
 * Stopgap: run the reminder sweep at most once every 15 minutes when invoked
 * from public booking traffic. This keeps reminders working even if the
 * dedicated bookingReminderSweep schedule has not been deployed yet. Once the
 * schedule exists this is a harmless no-op (the throttle doc stays fresh).
 */
export async function runBookingSweepIfStale(): Promise<void> {
  const stateRef = db().collection("system").doc("bookingSweep");
  const snap = await stateRef.get();
  const lastRun = (snap.data() as { lastRunMs?: number } | undefined)?.lastRunMs || 0;
  if (Date.now() - lastRun < 15 * 60 * 1000) return;
  await stateRef.set({ lastRunMs: Date.now() }, { merge: true });
  await runBookingReminderSweep();
}

/**
 * Find confirmed bookings with a reminder due and send it. Also auto marks
 * no-shows past the grace period. One collection-group query, so cost stays
 * flat no matter how many workspaces exist.
 *
 * DEPLOY NOTE: the collection-group query (status == confirmed,
 * startUtc <= horizon) needs a composite index on the bookings collection
 * group: (status ASC, startUtc ASC). The deploy coordinator must create it.
 */
export async function runBookingReminderSweep(nowMs = Date.now()): Promise<{ reminders: number; noShows: number }> {
  let reminders = 0;
  let noShows = 0;
  const horizonMs = nowMs + 25 * 3600 * 1000;
  const snap = await db()
    .collectionGroup("bookings")
    .where("status", "==", "confirmed")
    .where("startUtc", "<=", Timestamp.fromMillis(horizonMs))
    .limit(500)
    .get();

  for (const doc of snap.docs) {
    const workspaceId = doc.ref.parent.parent?.id;
    if (!workspaceId) continue;
    const booking = doc.data() as Booking;
    const startMs = booking.startUtc.toMillis();
    try {
      const settings = await getBookingSettings(workspaceId);
      if (!settings.enabled) continue;

      // 1. Due reminders.
      for (const rule of settings.reminders) {
        if (!rule.enabled || booking.remindersSent?.[rule.id]) continue;
        const dueAt = startMs - rule.offsetMinutes * 60 * 1000;
        if (nowMs >= dueAt && nowMs < startMs) {
          await sendBookingReminder(workspaceId, doc.id, booking, settings, rule);
          reminders++;
        }
      }

      // 2. Auto no-show past grace.
      const endMs = booking.endUtc.toMillis();
      if (
        settings.autoMarkNoShow &&
        nowMs > endMs + settings.noShowGraceMinutes * 60 * 1000
      ) {
        await setBookingStatus(workspaceId, doc.id, "no_show");
        noShows++;
      }
    } catch (e) {
      logger.warn("Booking sweep item failed", { workspaceId, bookingId: doc.id, err: String(e) });
    }
  }
  logger.info("Booking reminder sweep done", { reminders, noShows, scanned: snap.size });
  return { reminders, noShows };
}

// ---------------------------------------------------------------------------
// BotMaps actions (called by the flow runtime / simulator)
// ---------------------------------------------------------------------------

export interface BookingActionInput {
  workspaceId: string;
  action: "create_booking" | "cancel_booking";
  contactId?: string;
  name?: string;
  email?: string;
  phone?: string;
  startUtc?: string;
  bookingId?: string;
  channel?: string;
  recipientId?: string;
  variables?: Record<string, string>;
}

export async function executeBookingAction(input: BookingActionInput): Promise<{ ok: boolean; bookingId?: string; error?: string }> {
  try {
    if (input.action === "create_booking") {
      if (!input.name || !input.email || !input.startUtc) {
        return { ok: false, error: "name, email, and startUtc are required to create a booking." };
      }
      const { id } = await createBooking({
        workspaceId: input.workspaceId,
        name: input.name,
        email: input.email,
        phone: input.phone,
        startUtc: input.startUtc,
        contactId: input.contactId,
        channel: input.channel,
        recipientId: input.recipientId,
        source: "botmap",
        variables: input.variables,
      });
      return { ok: true, bookingId: id };
    }
    if (input.action === "cancel_booking") {
      if (!input.bookingId) return { ok: false, error: "bookingId is required to cancel a booking." };
      await cancelBookingById(input.workspaceId, input.bookingId, "cancelled from BotMaps action");
      return { ok: true, bookingId: input.bookingId };
    }
    return { ok: false, error: `Unknown booking action: ${input.action}` };
  } catch (e) {
    return { ok: false, error: String(e).slice(0, 300) };
  }
}

// ---------------------------------------------------------------------------
// Public HTTP API (rides metaWebhook at /booking-api; unauthenticated)
// ---------------------------------------------------------------------------

interface PublicReq {
  method?: string;
  path?: string;
  query?: Record<string, string>;
  body?: Record<string, unknown>;
  ip?: string;
  headers?: Record<string, string>;
}
interface PublicRes {
  status: (code: number) => PublicRes;
  json: (obj: unknown) => void;
  send: (body: string) => void;
  setHeader: (k: string, v: string) => void;
}

const ipHits = new Map<string, { count: number; resetAt: number }>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = ipHits.get(ip);
  if (!entry || now > entry.resetAt) {
    ipHits.set(ip, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  entry.count++;
  return entry.count > 60;
}

function publicSettingsView(s: BookingSettings): Record<string, unknown> {
  return {
    eventName: s.eventName,
    eventDescription: s.eventDescription,
    location: s.location,
    timeZone: s.timeZone,
    slotMinutes: s.slotMinutes,
    maxAdvanceDays: s.maxAdvanceDays,
    minLeadHours: s.minLeadHours,
    workingDays: s.workingHours.filter((w) => w.enabled).map((w) => w.day),
  };
}

function err(res: PublicRes, code: number, message: string): void {
  res.status(code).json({ ok: false, error: message });
}

export async function handleBookingPublicRequest(req: PublicReq, res: PublicRes): Promise<void> {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if ((req.method || "GET").toUpperCase() === "OPTIONS") {
    res.status(200).send("");
    return;
  }
  const ip = req.ip || req.headers?.["x-forwarded-for"] || "unknown";
  if (rateLimited(String(ip))) {
    err(res, 429, "Too many requests. Please slow down.");
    return;
  }
  const q = req.query || {};
  const body = (req.body || {}) as Record<string, unknown>;
  const action = String(q.action || body.action || "");
  const workspaceId = String(q.workspaceId || body.workspaceId || "");

  try {
    if (action === "settings") {
      if (!workspaceId) return err(res, 400, "workspaceId is required.");
      const s = await getBookingSettings(workspaceId);
      if (!s.enabled) return err(res, 404, "Online booking is not enabled.");
      res.status(200).json({ ok: true, settings: publicSettingsView(s) });
      return;
    }

    if (action === "slots") {
      if (!workspaceId) return err(res, 400, "workspaceId is required.");
      const s = await getBookingSettings(workspaceId);
      if (!s.enabled) return err(res, 404, "Online booking is not enabled.");
      const from = String(q.from || body.from || "");
      const to = String(q.to || body.to || from);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(from)) return err(res, 400, "from (YYYY-MM-DD) is required.");
      const fromMs = new Date(`${from}T00:00:00Z`).getTime();
      const toMs = new Date(`${to}T00:00:00Z`).getTime();
      if (toMs < fromMs || toMs - fromMs > 62 * 24 * 3600 * 1000) return err(res, 400, "Date range too wide.");
      const existing = await confirmedBookingsInRange(workspaceId, fromMs - 24 * 3600 * 1000, toMs + 2 * 24 * 3600 * 1000);
      const slots = computeSlots(s, existing, from, to);
      res.status(200).json({ ok: true, slots, timeZone: s.timeZone });
      return;
    }

    if (action === "create") {
      if (!workspaceId) return err(res, 400, "workspaceId is required.");
      // Opportunistic sweep stopgap: if the scheduled bookingReminderSweep
      // function is not deployed yet, piggyback a throttled sweep on public
      // traffic so reminders still go out. No-op once the schedule exists.
      void runBookingSweepIfStale().catch(() => {});
      const { id, booking, manageLink } = await createBooking({
        workspaceId,
        name: String(body.name || ""),
        email: String(body.email || ""),
        phone: body.phone ? String(body.phone) : undefined,
        startUtc: String(body.startUtc || ""),
        source: body.embed === true ? "embed" : "widget",
        notes: body.notes ? String(body.notes) : undefined,
        smsConsent: body.smsConsent === true,
      });
      res.status(200).json({
        ok: true,
        bookingId: id,
        manageLink,
        startUtc: booking.startUtc.toDate().toISOString(),
      });
      return;
    }

    // Contact manage actions authenticate with the signed link params
    // (?booking=<ws>.<id>&sig=...&exp=...), minted at booking time and in
    // every reminder.
    const linkAuth = () => ({
      bookingId: String(q.bookingId || body.bookingId || q.booking?.toString().split(".")[1] || ""),
      sig: String(q.sig || body.sig || ""),
      exp: Number(q.exp || body.exp || 0),
    });

    if (action === "manage") {
      const { bookingId, sig, exp } = linkAuth();
      if (!workspaceId || !bookingId) return err(res, 400, "workspaceId and bookingId are required.");
      const found = await findBookingBySignedLink(workspaceId, bookingId, sig, exp);
      if (!found) return err(res, 404, "This link is invalid or has expired.");
      const s = await getBookingSettings(workspaceId);
      res.status(200).json({
        ok: true,
        booking: {
          id: found.id,
          name: found.booking.name,
          email: found.booking.email,
          phone: found.booking.phone || "",
          startUtc: found.booking.startUtc.toDate().toISOString(),
          endUtc: found.booking.endUtc.toDate().toISOString(),
          status: found.booking.status,
          eventName: s.eventName,
          location: s.location,
          timeZone: s.timeZone,
        },
      });
      return;
    }

    if (action === "reschedule") {
      const { bookingId, sig, exp } = linkAuth();
      const newStartUtc = String(body.newStartUtc || "");
      if (!workspaceId || !bookingId) return err(res, 400, "workspaceId and bookingId are required.");
      const found = await findBookingBySignedLink(workspaceId, bookingId, sig, exp);
      if (!found) return err(res, 404, "This link is invalid or has expired.");
      if (found.booking.status !== "confirmed") return err(res, 400, "Only confirmed bookings can be rescheduled.");
      const s = await getBookingSettings(workspaceId);
      const startMs = new Date(newStartUtc).getTime();
      if (!Number.isFinite(startMs)) return err(res, 400, "A valid new time is required.");
      const oldStartMs = found.booking.startUtc.toMillis();
      if (startMs === oldStartMs) {
        res.status(200).json({ ok: true, startUtc: new Date(startMs).toISOString() });
        return;
      }
      const pad = (n: number) => String(n).padStart(2, "0");
      const parts = tzDateParts(new Date(startMs), s.timeZone || DEFAULT_TZ);
      const dayIso = `${parts.y}-${pad(parts.m)}-${pad(parts.d)}`;
      const dayStart = startMs - (startMs % (24 * 3600 * 1000));

      const wsRef = db().collection("workspaces").doc(workspaceId);
      const bookingsRef = wsRef.collection("bookings");
      const locksRef = wsRef.collection("bookingLocks");
      const bookingRef = bookingsRef.doc(found.id);
      const newLockRef = locksRef.doc(`slot_${startMs}`);
      const oldLockRef = locksRef.doc(`slot_${oldStartMs}`);

      // Atomic slot move: the new lock, the release of the old lock, the
      // booking update, and the reminder reset happen in one transaction.
      await db().runTransaction(async (txn) => {
        const cur = await txn.get(bookingRef);
        if (!cur.exists) throw new Error("Booking not found.");
        const curBooking = cur.data() as Booking;
        if (curBooking.status !== "confirmed") throw new Error("Only confirmed bookings can be rescheduled.");
        const lockSnap = await txn.get(newLockRef);
        if (lockSnap.exists) throw new Error("That time was just taken. Please pick another slot.");
        const q = bookingsRef
          .where("status", "==", "confirmed")
          .where("startUtc", ">=", Timestamp.fromMillis(dayStart - 24 * 3600 * 1000))
          .where("startUtc", "<=", Timestamp.fromMillis(dayStart + 2 * 24 * 3600 * 1000));
        const qsnap = await txn.get(q);
        const existing = qsnap.docs
          .filter((d) => d.id !== found.id)
          .map((d) => {
            const b = d.data() as Booking;
            return { startUtc: b.startUtc.toMillis(), endUtc: b.endUtc.toMillis() };
          });
        const open = computeSlots(s, existing, dayIso, dayIso);
        const stillOpen = open.some((sl) => new Date(sl.startUtc).getTime() === startMs);
        if (!stillOpen) throw new Error("That time was just taken. Please pick another slot.");
        txn.set(newLockRef, {
          bookingId: found.id,
          startUtc: Timestamp.fromMillis(startMs),
          createdAt: FieldValue.serverTimestamp(),
        });
        txn.delete(oldLockRef);
        txn.set(
          bookingRef,
          {
            startUtc: Timestamp.fromMillis(startMs),
            endUtc: Timestamp.fromMillis(startMs + s.slotMinutes * 60 * 1000),
            remindersSent: {},
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
      });

      await logBookingEvent(workspaceId, found.id, "booking_rescheduled", {
        newStartUtc: new Date(startMs).toISOString(),
      });
      if (found.booking.contactId) {
        await linkBookingToContact(workspaceId, found.booking.contactId, found.id,
          { ...found.booking, startUtc: Timestamp.fromMillis(startMs), endUtc: Timestamp.fromMillis(startMs + s.slotMinutes * 60 * 1000) }, s)
          .catch(() => {});
      }
      res.status(200).json({ ok: true, startUtc: new Date(startMs).toISOString() });
      return;
    }

    if (action === "cancel") {
      const { bookingId, sig, exp } = linkAuth();
      if (!workspaceId || !bookingId) return err(res, 400, "workspaceId and bookingId are required.");
      const found = await findBookingBySignedLink(workspaceId, bookingId, sig, exp);
      if (!found) return err(res, 404, "This link is invalid or has expired.");
      await cancelBookingById(workspaceId, found.id, "cancelled by contact");
      res.status(200).json({ ok: true });
      return;
    }

    err(res, 400, "Unknown action.");
  } catch (e) {
    logger.warn("booking-api failed", { action, workspaceId, err: String(e).slice(0, 300) });
    err(res, 400, String(e instanceof Error ? e.message : e).slice(0, 300));
  }
}
