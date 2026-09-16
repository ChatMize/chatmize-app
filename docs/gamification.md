# ChatMize Gamification: Badges and Incentives

Status: draft for Karl's review. Nothing here is built yet.

## Idea

Turn usage into a game. Reward the behaviors that make accounts sticky
(flows built, messages handled, contacts grown) and give SegMate migrants
a permanent identity: the OG stamp.

## Pillars

### 1. OG stamp

- One time, permanent badge for everyone who migrates from SegMate.
- Never earnable any other way. Scarcity is the point.
- Shown next to the profile name everywhere: app header, team lists,
  comments, leaderboard.
- Seeded at migration: the importer flags `isSegMateMigrant: true` and the
  stamp is granted automatically. The landing page waitlist already captures
  this with an "I was a SegMate user" checkbox.

### 2. Usage badges

Tiered milestones, grouped so early wins come fast and late ones stay
aspirational.

Getting started (first week energy):
- First flow published
- First AI agent trained
- First broadcast sent
- First 100 conversations handled

Volume (the grind):
- 1K / 10K / 100K messages handled
- 500 / 5K contacts in workspace
- 10 / 50 flows live at once

Streaks (retention):
- 7 day active streak
- 30 day active streak

Money (the point of the tool):
- First booking or sale attributed to a flow
- $1K pipeline attributed

### 3. Incentive program

Badges unlock real value, not just pixels. Draft ladder:

- Early badges: AI credit bonuses (cheap for us, exciting for them)
- Mid badges: plan discounts, founding member pricing locks
- Top badges: leaderboard placement, "power user" spotlight, revenue share
  on referrals

Referrals deserve their own track: give credits for every referred workspace
that activates. This is the cheapest growth channel we have.

## Mechanics

- Per workspace usage counters in Firestore (`usageCounters`), incremented
  on the existing write path. No new reads per event.
- A Cloud Function evaluates badge rules when counters cross thresholds.
  Batched and debounced. This must stay serverless cheap: no scheduled
  scans, no per message function storms. Evaluation piggybacks on writes
  that already happen.
- Badges live on the user profile (`badges: [{id, earnedAt}]`).
- OG flag is set once at signup or migration and is immutable.
- UI: badge shelf on the profile page, toast notification on earn,
  badge next to name in shared surfaces.

## Cost guardrails

Badge evaluation rides on existing invocations. Counter increments are
single field updates inside writes we already do. No polling, no cron
sweeps. If a rule cannot be evaluated for under ~1 extra write, it gets
redesigned.

## Open questions for Karl

1. What do badges unlock? Credit bonuses and discounts are the draft.
   Anything off limits?
2. Leaderboard: public and opt in, or account private only?
3. Tone: playful badge names ("Conversation Machine") or professional
   ("10K Club")?
4. Referral rewards: credits only, or cash/revenue share at the top tier?
5. Should agencies see their clients' badges (social proof for reselling)?
