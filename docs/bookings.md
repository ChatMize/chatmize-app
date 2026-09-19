# ChatMize Native Bookings

Status: BUILT 2026-09-19 (branch feat/bookings, merged to release/all-features).

Our own booking experience, no Calendly or third party needed. Each workspace
gets a shareable booking page and an embeddable widget, automated calendar
reminders over email, SMS, and chat, contact-facing reschedule and cancel
links that need no login, and BotMaps triggers and actions so bookings can
start and react inside flows.

## Where it lives

Settings > Bookings tab in the workspace. One card holds everything:
availability, reminders, the shareable link, the embed snippet, the booking
list, and manual booking creation.

## Setup

1. Open Settings > Bookings and turn booking on.
2. Name the event, add a description and location, pick the workspace time
   zone (defaults to America/Phoenix).
3. Set slot length, buffer between bookings, max bookings per day, minimum
   lead time, and how far ahead people can book.
4. Set working hours per day of the week.
5. Add reminder rules: how long before the booking, which channels (email,
   SMS, chat), and the message. Two defaults ship: 24 hours and 1 hour
   before. Messages support {{name}}, {{event_name}}, {{date}}, {{time}},
   {{location}}, and {{manage_link}}.
6. Decide whether missed bookings are marked automatically and how long
   after the booking ends the grace period runs.

## Sharing and embedding

- Booking link: `https://app.chatmize.com/?book=<workspaceId>`. Share it
  anywhere.
- Embed: copy the iframe snippet from the Bookings tab and paste it on the
  workspace website. The widget renders in embedded mode automatically.

## The booking flow for contacts

1. The contact picks a day and time from live availability.
2. They enter name, email, phone, and notes, and can opt in to SMS
   reminders (a checked box counts as opt-in for transactional reminders).
3. They get a confirmation with a manage link. The link is signed and
   expires after 60 days. No login needed.
4. From the manage link they can reschedule (availability is re-checked and
   the slot moves atomically) or cancel.

Double booking is impossible: every slot has a lock document and the lock
check and the booking write happen in one Firestore transaction. Cancelling
releases the slot. Rescheduling moves the lock to the new slot and resets
reminders so the new time gets its own reminders.

## Reminders

A scheduled sweep runs every 15 minutes, finds confirmed bookings with a
reminder due, and sends each enabled channel. Each channel is tracked
separately in the reminder log on the booking, so a failed SMS does not
falsely mark the email as sent. Public booking traffic also triggers a
throttled sweep as a stopgap, so reminders work even before the scheduled
function is deployed.

Missed appointments: when a booking ends and the grace period passes, it is
marked missed automatically (if enabled), which fires the booking missed
trigger.

## BotMaps integration

Triggers (Settings > BotMaps > trigger selector, Integrations & Webhooks):

- Booking created: someone books through the page, embed, or a BotMaps
  booking action.
- Booking reminder due: a reminder goes out.
- Booking completed: a booking is marked completed. Great for review
  requests and upsells.
- Booking missed: a booking is marked missed. Win them back automatically.
- Booking cancelled: a booking is cancelled. Offer a new time.

Actions (action node > Bookings section):

- Create Booking: books the contact into a slot. The runtime passes name,
  email, start time, and the contact id.
- Cancel Booking: cancels the contact's latest upcoming booking.

Blocks (message node > Book component):

- Adds a booking button inside a flow message. The button opens the
  workspace booking page. When the contact books, the booking date, time,
  and status land on their contact automatically.

Booking variables on the contact: booking_id, booking_event, booking_date,
booking_time, booking_status. They are available in the personalization
picker, so any message can say "see you {{booking_date}} at {{booking_time}}".

## Costs

One collection-group query per sweep run, flat no matter how many workspaces
exist. Everything else is event driven. No idle servers, no per-seat cost.

## Deploy notes for the coordinator

- New scheduled function `bookingReminderSweep` (every 15 minutes) must be
  created through the CLI or the API create path; the proxy blocks the
  normal create call. Confirm it reaches ACTIVE.
- New composite index needed for the sweep query: collection group
  `bookings`, fields `status` ASC + `startUtc` ASC.
- New hosting rewrite `/booking-api` -> `metaWebhook` (us-west2) is in
  firebase.json.
- Firestore rules deny client reads/writes on `bookings`, `bookingSettings`,
  `bookingLocks`, and `bookingEvents`. All access goes through callables and
  the public API. The settings signing key is stripped server-side before
  anything reaches the client.
