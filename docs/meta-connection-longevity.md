# Meta Connection Longevity

Goal: keep every workspace's Facebook/Instagram connection alive as long as
possible, and when it does break, get the owner reconnected in one click.

## Why tokens die (most common first)

1. The connecting admin changes their Facebook password or hits a security
   checkpoint. This kills their user session, which kills the page token.
   This is the #1 cause across the industry.
2. The admin is removed from the page or their role is downgraded.
3. The admin removes ChatMize under Facebook > Business Integrations.
4. Timer expiry (only if we fail to exchange in time; we exchange proactively).
5. Meta platform-level revocation (rare).

Key platform fact: Meta issues no refresh tokens. A dead human session can
only be replaced by a human going through Facebook Login again. No app on the
platform (ManyChat included) can silently revive one.

## What exists today

- **Proactive exchange.** Before any send, tokens within 7 days of expiry are
  exchanged server-side for fresh long-lived tokens. No user involved.
- **Death detection.** Meta error 190 marks the workspace `token_invalid` and
  every later send fails with a clear "reconnect" reason instead of a
  generic error.
- **Sticky reconnect banner.** App-wide, always visible until reconnected.
  One button: runs OAuth and returns to Channels so the owner sees it land.
- **Settings card flag.** The Meta card in Channels shows "Session expired"
  with a reconnect button. Inbound messages and entry points keep working
  throughout; only outbound sending is paused.

## Layer 1: multi-admin failover (recommended next)

How it works: a workspace can hold page tokens from more than one page
admin. The send path tries the primary token; on error 190 it automatically
fails over to the next admin's token, marks the dead one, and keeps sending.
The owner only sees the reconnect banner when ALL stored tokens are dead.

- Biggest reconnect reduction for teams and agencies, where 2+ admins is
  normal. Directly answers cause #1 and #2 above.
- Cost: one extra secret per admin per workspace (pennies), plus a small
  send-path change. Serverless, no new infrastructure.
- UX: after connecting, show "Add a backup admin (optional, keeps your
  connection alive if your Facebook session ever resets)". Settings shows
  "2 admins connected".
- This is the same pattern Sprout Social uses.

## Layer 2: system-user tokens (Karl's own assets)

Meta lets a business create a "system user": a non-human identity whose
token is not tied to any person's login. It never expires by default and
survives password changes, 2FA resets, and personal account lockouts.

- Best fit for ChatMize-owned pages (official account, Karl's businesses):
  one-time ~10 minute setup in Business Settings per portfolio, then it
  simply never dies from cause #1.
- Limitation: a system user belongs to one business portfolio, so this
  cannot be the default for customers connecting their own pages. Meta's
  model for SaaS is per-customer OAuth.
- Could later be offered as an "advanced connection" for agency/whitelabel
  accounts that own their clients' portfolios.
- Still dies if the system user is deleted or the app is removed, so the
  banner remains the backstop.

## Layer 3: scheduled health sweeps (later, if needed)

A daily job that checks every workspace token and flags dead ones before
the owner tries to send. Cost grows with workspace count (one Graph call
per workspace per day), so only worth it at scale. The on-send check plus
the banner already covers the failure visibly; this layer just moves
detection earlier.

## Recommended order

1. Proactive exchange (done)
2. Death detection + sticky banner + card flag (done)
3. Multi-admin failover (next build)
4. System-user tokens for ChatMize-owned pages (one-time setup, no code)
5. Scheduled sweeps (only if scale demands it)

## Decisions for Karl

- Should the connect flow nudge the owner to add a second admin as backup?
- Which ChatMize-owned pages should move to system-user tokens?
