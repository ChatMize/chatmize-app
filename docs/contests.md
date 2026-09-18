# ChatMize Contest Engine

Viral contests / giveaways: public entry pages, server-side referral attribution, weighted leaderboards, approval-gated winner draws. Implements the mechanics from `~/workspace/chatmize/viral-contests-spec.md` (phase 2).

## Collections (top-level, `chatmize-prod` database)

Every doc carries `workspaceId`. All writes go through the backend (Admin SDK); clients get read-only rules.

```
contests/{contestId}
  workspaceId, title, description, heroImageUrl
  type: giveaway | leaderboard | milestones
  status: draft | active | closed | archived
  published: boolean                      # public entry page visible only when active+published
  startsAt, endsAt (ISO), timezone
  entryKeyword                            # chat entry keyword (future flow wiring)
  actions: [{ id, kind, label, points, tickets, verification, required }]
      kind: enter | referral | purchase | survey | follow | visit | share | other
      verification: verified | selfreported | unverifiable
      NOTE: kind=share can never carry points/tickets (enforced server-side)
  referralPoints, referralTickets         # awarded per credited referral
  tiers: [{ threshold, rewardKind, rewardValue, rewardLabel }]   # milestone auto-unlock
  prizes: [{ place, label, rewardKind, rewardValue, rewardNote }]
  draw: { mode: weighted | top_n | milestones, winnerCount, alternatesCount, claimWindowDays }
  counters: { entries, referrals, clicks, actionsCompleted }     # FieldValue.increment
  fraudConfig: { maxEntriesPerHour, maxReferralsPerHour, maxReferralsPerReferrer, prizeHoldHours }
  fraudFlags: [{ reason, at }]            # stealth velocity signals
  consentText: { contest, marketing }, rulesText, amoeText, announceAt
  createdByUid, createdAt, updatedAt

contest_participants/{participantId}      # id = "p_" + sha256(contest|channel|identity)[0:32]
  workspaceId, contestId
  channel: email | phone | messenger | instagram | sms
  channelIdentityHash                     # sha256 of normalized identity; email/phone also stored for CSV export
  email, phone, displayName, leaderboardAlias, showOnLeaderboard
  referralCode (8 chars, unambiguous alphabet), referredBy (immutable)
  points, tickets
  actionsCompleted: [{ actionId, at, verification }]
  tiersUnlocked: [threshold]
  rewardGrants: [{ kind, value, label, status, releaseAt, grantedAt, note }]
  status: active | flagged | banned | winner | disqualified
  referralsDisabled, riskScore, fraudFlags: [{ reason, at }]
  messageCount, lastActiveAt, consent: { contest, marketing, at }, enteredAt

contest_referrals/{referralId}            # id = "r_" + referee participant id (one credit max per referee)
  workspaceId, contestId, referrerId, referrerCode, refereeId
  credited, creditDeniedReason, createdAt, creditedAt

contest_draws/{drawId}
  workspaceId, contestId, mode, seed (hex, reproducible), winnerCount
  winners: [{ participantId, alias, place, pointsAtDraw, ticketsAtDraw }]
  alternates: [...], eligibleCount
  status: pending_approval | approved | announced
  createdByUid, createdAt, approvedByUid, approvedAt, announcedAt

contest_leaderboards/{contestId}          # single public doc per contest
  contestId, workspaceId
  top: [{ alias, points, referrals, rank }]   # top 100, aliases only
  totals: { entries, points }, updatedAt

contest_grants/{grantId}                 # AI-credit grants with hold periods
  workspaceId, contestId, participantId, kind, value, label
  status: held | released, releaseAt, createdAt, releasedAt

contest_rate_limits/{key}                # internal: per-IP hourly attempts, per-contest hourly velocity
```

## Indexes (`firestore.indexes.json`)

- `contests`: workspaceId ASC + createdAt DESC (admin list)
- `contest_participants`: contestId+status+points DESC (eligible leaderboard), contestId+referralCode (ref lookup), contestId+enteredAt DESC (entries list)
- `contest_referrals`: contestId+referrerId+createdAt DESC (tree/loop), contestId+credited+createdAt DESC
- `contest_draws`: contestId+createdAt DESC
- `contest_grants`: workspaceId+contestId+status+releaseAt ASC (due-release scan)

## Cloud Functions (folded into existing — proxy blocks new function creation)

**Admin callable** — actions ride `metaOAuthStatus` (`action: "contest*"`), after its auth + `requireWorkspaceAccess` check:

| action | what it does |
|---|---|
| `contestUpsert` | create/update contest; validates schema server-side; publishing requires rules text + real title; share actions rejected if they carry points |
| `contestDraw` | closes contest, runs weighted (seeded PRNG, tickets) or top-N (points, earliest-entered tiebreak) selection; writes `contest_draws` as `pending_approval` |
| `contestApproveDraw` | revalidates each winner's status, marks winners, releases prizes (AI credits via `grantCredits(..., "contest_reward")` honoring hold period; business prizes recorded for manual fulfillment) |
| `contestSetParticipantStatus` | flag/ban/disqualify/reinstate; ban invalidates the referral tree (past credits revoked + points clawed back, future referrals through their code not credited) |
| `contestRecordAction` | record a verified bonus action (purchase/booking/survey) — points come from contest config, never the client |
| `contestChatEnter` | chat-identity entry (PSID/IGSID) for the future flow-engine wiring |

**Public API** — `POST /contest-api` rides `metaWebhook` (hosting rewrite → metaWebhook, path-routed before the cloaker/Meta logic). No auth:

| action | what it does |
|---|---|
| `get` | sanitized public contest (active+published only) |
| `click` | increments `counters.clicks` (informational, never rewarded) |
| `enter` | full entry transaction (see below) |
| `leaderboard` | public leaderboard doc (cold-start computes once) |

## Entry flow (one transaction)

1. Contest must be active + published + within dates.
2. Deterministic participant id → duplicate entries impossible (idempotent re-entry returns the existing referral code).
3. Per-IP hourly attempt counter (best-effort; hard block at 50/hr).
4. Contest hourly velocity vs `fraudConfig.maxEntriesPerHour` → stealth flag on the contest (never auto-ban).
5. New participant: entry action points/tickets, unique 8-char referral code, `referredBy` immutable.
6. Referral credit (only when referee completes entry): referrer lookup by code, self-referral impossible, per-referrer cap enforced (excess → `credited:false`, referee still enters), referrer points/tickets increment, `contest_referrals` audit doc, milestone tier check.
7. Post-transaction: leaderboard snapshot refresh (≤1 write/min/contest, only when top-100 order changed), tier evaluation.

Anti-fraud summary: one entry per identity by construction; referral-must-convert; share never rewarded; velocity flags (not bans); ban poisons the whole referral tree; winner revalidation at approval.

## Winner flow

`Run draw` (admin) → contest closes, seeded draw written as `pending_approval` → `Approve winners` (admin, sees flags inline) → winners marked, AI-credit prizes granted to the workspace ledger with `contest_reward` reason (hold period respected; due grants release lazily on admin contest actions), business prizes recorded `pending_fulfillment` for manual fulfillment.

## Rewards note

AI credits in this codebase are workspace-level (the business's AI budget). Contest AI-credit rewards top up the workspace balance with a ledger note naming the contest and winner. Per-entrant credit wallets do not exist yet — that is queued work.

## Frontend

- `src/lib/contests.ts` — callable wrappers, public API client, Firestore readers, link builders.
- `src/components/growth/ContestsView.tsx` — admin UI (Capture Tools → Contests): list, full editor (basics, actions/weights, tiers, prizes, draw, anti-gaming, trust checklist), detail with entries table + fraud review (flag/ban/disqualify/reinstate), live leaderboard, referral audit, draws with approve gate.
- `src/components/growth/ContestEntryPage.tsx` — public page at `/enter/:contestId?ref=CODE`: hero + countdown, entry form (name + email/phone, consent checkboxes), referral link + share on success, live top-10 leaderboard, rules/AMOE.
- `App.tsx` — `/enter/:contestId` renders the entry page before the auth gate; Contests added to the Capture Tools nav.

## Queued / not in v1

- Auto-close + auto-release scheduler (needs a new `onSchedule` function; blocked by the proxy constraint — manual close/draw + lazy grant release for now).
- Comment-to-enter and chat keyword entry wiring into the inbound webhook / flow engine (`contestChatEnter` backend is ready).
- Contest nudges via the drip/nurture engine; winner/loser chat flows and public announcement broadcast.
- Per-entrant AI credit wallets; SMS OTP + carrier lookup for high-value contests; conversation-depth legitimacy signal.
