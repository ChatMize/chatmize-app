# Push Notifications (Web Push via FCM)

Native browser push for ChatMize. Primarily a **blasting channel** (Push Blasts view), and a
chain step inside **BotMaps** escalation flows. Serverless and scale to zero: Firebase Cloud
Messaging for delivery, one scheduled sweep function for delayed sends, Firestore for state.

## Setup (one time, Super Admin)

1. Firebase Console > Project Settings > Cloud Messaging > Web configuration: get the VAPID public key.
2. Settings > Channels > Push: paste the key and save. (The key is stored in Firestore
   `system_settings/push_config`; never printed or logged.)
3. Share the subscribe link (`?push=<workspaceId>`) or embed the opt-in prompt on the business site.

## How subscribers join

- Public page `?push=<workspaceId>` renders standalone with no login; `&embed=1` renders a compact embed.
- `PushOptinBuilder` (Settings > Channels) builds a soft-ask prompt with custom copy.
- Each browser token is stored at `workspaces/{ws}/push_subscribers/{sha256(token)}`.
  The raw token never appears in a document ID or a log.
- Public subscribe/unsubscribe calls are throttled per IP. Dead tokens are pruned automatically
  on the next send (FCM unregistered / invalid errors).

## Push Blasts (the primary use)

Sidebar > Push Blasts:

- Audience: all subscribers or one tag segment.
- Title, body, optional image (https only).
- Tap link, three types:
  - **Messenger**: a Page username, Page ID, or m.me link becomes `https://m.me/<page>`.
  - **On page chat**: the business page URL; we append `?chatmize_chat=open` so the on-site
    ChatMize widget opens the chat on tap.
  - **Website**: a plain full https URL for sales messages and promos.
- Send now (idempotent broadcast, 5,000 recipients per run cap) or schedule for later.
- A scheduled blast can carry the **no-reply gate**: at send time we check whether the contact
  replied on any channel inside the window; a reply cancels that send.

## BotMaps: the push node as an escalation step

The push action node carries three chain fields:

- **Wait before sending** (minutes): "send push in X minutes/hours".
- **Only send when there is no reply** (toggle).
- **No reply within** (minutes): the silence window.

The intended chain, built from ordinary nodes:

1. Message step: Messenger message.
2. Delay step: 30 minutes.
3. Action step: SMS follow-up.
4. Delay step: 2 hours.
5. Action step: Push ("only send when there is no reply within 150 minutes").
6. (Later) Email step: final follow-up.

Each step stands down the moment the contact answers anywhere, because the no-reply check
queries **inbound messages across all of the contact's conversations** (Messenger, Instagram,
WhatsApp, web), not just the channel of the step.

### The no-reply condition node

Condition nodes have a "No reply within X" preset (15 min to 24 h, plus a custom value).
It sets `conditionType: 'no_reply'` and `conditionValue: '<minutes>'`, and renders the branch
label on the canvas. The BotMap runtime evaluates it with the shared helper
`contactRepliedSince(workspaceId, contactId, sinceMs)` exported from `functions/src/push.ts`.

### Delayed push plumbing

- `schedulePush` (callable, members only): creates `workspaces/{ws}/push_scheduled/{idempotencyKey}`.
- `cancelScheduledPush` (callable, members only): cancels before it fires.
- `pushScheduleSweep` (every 10 minutes): claims due docs with a transaction (no double send),
  applies the no-reply gate, fans out, and records `sent` / `skipped_replied` / `failed`.
- For the no-reply check to find a contact's conversations, subscribe calls accept
  `channelSenderIds` (e.g. `["messenger_12345"]`), stored on the subscriber doc.

## Email: the future hook

The chain is designed so email drops in as one more step. When the email channel lands:

- Add an email action node with the same three fields (delay, no-reply toggle, window).
- Reuse `contactRepliedSince` for its gate and the `push_scheduled` pattern (or a shared
  scheduled-send collection) for its delay.
- Nothing in the push implementation needs to change.

## On-site widget contract (chatmize_chat=open)

The ChatMize website widget SDK must honor `?chatmize_chat=open` in the page URL by opening
the chat widget on load. The push backend only appends the parameter; the widget owns the
receiving behavior. (SDK follow-up, external to this repo.)

## Analytics

Sent, delivered, and clicked events roll into the daily counters the analytics dashboard reads.
Delivered/clicked are tracked from the service worker via the public `trackPushEvent` callable.

## Functions

| Function | Type | Who |
|---|---|---|
| getPushPublicConfig | callable (public) | Subscribe page config + VAPID key |
| getPushStatus | callable (member) | Subscriber count, setup state |
| setPushVapidKey | callable (super admin) | Store VAPID key |
| setPushPromptCopy | callable (member) | Custom opt-in prompt copy |
| subscribePush / unsubscribePush | callable (public, throttled) | Token lifecycle |
| sendPush | callable (member) | One-off send, up to 5,000 recipients |
| sendPushBroadcast | callable (member) | Idempotent blast |
| schedulePush / cancelScheduledPush | callable (member) | Delayed send + no-reply gate |
| pushScheduleSweep | scheduled (10 min) | Fire due scheduled pushes |
| trackPushEvent | callable (public) | delivered / clicked counters |

Shared helpers for other modules: `sendPushToContact`, `sendOwnerPushAlert`, `contactRepliedSince`.

## Firestore

- `workspaces/{ws}/push_subscribers/{tokenHash}`: token, subscribed, role, tags, contactId,
  channelSenderIds, ownerUid, userAgent, timestamps.
- `workspaces/{ws}/push_scheduled/{id}`: title, body, linkType, linkValue, image, contactId,
  tags, sendAt, onlyIfNoReply, noReplyWindowMinutes, status, idempotencyKey, result.
- `system_settings/push_config`: vapidPublicKey (super admin only).
- `workspaces/{ws}/push_prompt_copy`: headline, subtext, allowLabel, dismissLabel.

Composite indexes (firestore.indexes.json): `push_scheduled` collection group on
(status, sendAt) for the sweep; `messages` on (direction, timestampMs) for the no-reply check.

## Limits and safety

- 5,000 recipients per send run; broadcasts resume across runs.
- Scheduled sends cap at 30 days out.
- Member-only sends; public endpoints are throttled and validated.
- No-reply windows cap at 7 days.
