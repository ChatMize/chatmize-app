# Workspace Membership Selector — Architecture Spec

**Status:** Spec (needs Karl's decisions before build)
**Date:** 2026-09-19
**Cards:** `card-bug-workspace-list-localstorage` (owner), `card-bug-push-save-403` (related)
**Repo:** chatmize-app, branch work merged to `origin/release/all-features`

---

## 1. The problem in plain language

Right now the workspace switcher in the app is a mirage. The list of workspaces comes
from the browser's localStorage (`chatmize_workspaces`), seeded from demo data in
`src/data/workspaceDefaults.ts` — fake businesses like "DentalCare Austin" with fake
page IDs, fake stats, and stock-photo avatars. Every new user sees the same demo list.

The real membership data — who belongs to which workspace — lives in Firestore under
`workspaces/{workspaceId}/members/{uid}`, but **nothing in the app ever reads it** to
build the list. There is also no list of "which workspaces do I belong to" anywhere.

To make the 403 bug go away, we added first-caller provisioning (commit `9d3deff`):
the first signed-in caller to touch a workspace ID that has no workspace document
gets that workspace created and becomes its **owner**. That fixed saves, but it opened
a security hole (see section 3).

**This spec answers:** how the selector becomes real, how demo data is handled, and
how the provisioning hole gets closed without re-breaking saves.

---

## 2. How it works today (verified in code)

### 2.1 Frontend — `src/App.tsx`

- `workspaces` state initializes from `localStorage['chatmize_workspaces']`, falling back
  to `DEFAULT_WORKSPACES` (demo seed). On every load, any defaults missing from the
  saved list are merged back in — demo workspaces can never be fully deleted.
- `activeWorkspaceId` initializes from `localStorage['chatmize_active_workspace_id']`
  or the hardcoded default `'ws-biz-1'`.
- All updates go through `handleUpdateWorkspaces`, which writes back to localStorage.
  No Firestore write ever happens for workspace list changes.
- One Firestore sync effect exists: it reads `workspaces/ws-chatmize-dev/integrations/*`
  (hardcoded ID) and patches the localStorage blob with live connection status.
  It syncs exactly one workspace, by ID, into the demo list.

### 2.2 Workspace creation — `src/views/WorkspacesView.tsx`

- `handleCreateWorkspace` creates the workspace **only in localStorage**.
- ID is `ws-biz-${Date.now()}` (millisecond timestamp — low entropy, and the
  creation time is visible in the UI).
- `ownerName` is hardcoded to `'Karl Schuckert'`, page IDs are random
  `fb_page_<9 digits>` placeholders, stats are fabricated.
- Creating a workspace does **not** create a Firestore workspace doc, does **not**
  create a member record, and does **not** call the backend.

### 2.3 Backend membership — `functions/src/index.ts`, `functions/src/push.ts`

- `requireWorkspaceAccess(uid, workspaceId, token)` (used by ~24 callables) and
  `requirePushWorkspaceAccess` (push callables) are the only backend guards.
- Membership = existence of `workspaces/{wsId}/members/{uid}`.
- Super Admin custom claim (`token.superadmin === true`) bypasses everything.
- **Auto-provisioning behavior (commit `9d3deff`):**
  1. If caller has a member doc → allow.
  2. Else if no workspace doc exists → **create it, grant caller `owner`, allow.**
  3. Else (workspace doc exists) → check members; **grant caller `member` (or `owner`
     if the members subcollection is empty), allow.**

### 2.4 Firestore rules — `firestore.rules`

- Client-direct reads of `workspaces/{id}` require membership or Super Admin.
- Nested collections (conversations, kb_articles, etc.) require membership.
- `workspaces/{id}` create/update/delete is Super-Admin-only from clients.
- So: a non-member cannot self-add via the client SDK — **but the callable path
  in 2.3 does it for them**, which makes the rules moot for anyone with a session.

### 2.5 What exists in chatmize-prod today

- `ws-chatmize-hq` (workspace doc, 2 owners) and `ws-qa-lab` exist.
- `ws-chatmize-dev` has subcollections (integrations) but **no parent workspace doc**
  — the ghost workspace. Any signed-in caller touching `ws-chatmize-dev` through a
  callable currently becomes its owner (path 2 above).
- No `userWorkspaces` reverse-index docs exist anywhere (only on the Mac stack as
  a pending approval).

---

## 3. Risk assessment — the provisioning hole

### 3.1 Finding 1 (HIGH): any authenticated caller can claim any unprovisioned workspace ID

Step 2 of `requireWorkspaceAccess` grants `owner` to the first caller for a
workspace ID with no document. Workspace IDs in this system are highly predictable:

- `ws-chatmize-hq`, `ws-chatmize-dev`, `ws-chatmize-prod` (hardcoded in the repo)
- `ws-biz-1` (the app's default active workspace ID, also hardcoded)
- `ws-biz-<timestamp>` (creation pattern; timestamp visible to anyone who saw the workspace)
- `ws-<slug>` (naming pattern used across fixtures)

An attacker with any signed-in session (including a free/trial account later) can
call any member-guarded callable — e.g. `getPushPromptCopy` — with a guessed ID and
become its owner before the real user ever touches it. Once owner, they can read
conversations, send messages as the business, and change settings.

### 3.2 Finding 2 (CRITICAL): any authenticated caller is auto-added as MEMBER to ANY existing workspace

Step 3 is worse than Finding 1. For a workspace doc that **already exists**, a
non-member caller is silently written into `members/{uid}` — `member` role, or
`owner` if the members subcollection happens to be empty. No invite, no billing
check, no owner approval.

Consequence: **knowing a workspace ID is sufficient for full member access.**
With that, the attacker gets client-SDK read/write on every nested collection
(conversations, contacts, broadcasts, KB, settings) and can invoke all ~24 guarded
callables as that workspace — sending messages as the business.

Exploit path is trivial from the browser console: set
`localStorage['chatmize_active_workspace_id']` to a guessed ID, then use any
feature — or call a callable directly. No special tooling needed.

### 3.3 Finding 3 (MEDIUM): ghost workspace is claimable right now

`ws-chatmize-dev` has live integrations (Instagram, Facebook Page, WhatsApp test
connections) but no parent doc. Today, the first authenticated caller to hit it via
a callable becomes its owner and inherits those connected channels. (This is also
why the support-rebuild is blocked on the ghost-workspace decision.)

### 3.4 Why we cannot just delete the auto-provisioning today

The 403 fix (`card-bug-push-save-403`) depends on it. Every real user's workspace
currently exists **only in their localStorage** — there is no workspace doc and no
member doc for them in Firestore. Removing auto-provisioning without a migration
would re-break every save for every user. The security fix and the migration must
ship together.

---

## 4. Target design

### 4.1 Data model

```
workspaces/{wsId}
  name: string
  slug: string
  planTier: string
  ownerUid: string            # set at creation, immutable-ish
  demo: boolean               # true = clearly-labeled demo/sandbox workspace
  createdBy: string (uid)
  createdAt: timestamp
  billingCustomerId?: string  # set when the billing flow owns the workspace

workspaces/{wsId}/members/{uid}
  uid: string
  role: "owner" | "admin" | "member"
  invitedBy?: string (uid)
  createdAt: timestamp

# Reverse index: "which workspaces do I belong to" — one doc per membership.
# Lets the selector list workspaces with a single indexed query, no collectionGroup scan.
users/{uid}/workspaceAccess/{wsId}
  wsId: string
  role: "owner" | "admin" | "member"
  workspaceName: string       # denormalized for list rendering without extra reads
  demo: boolean               # denormalized, lets UI badge demo workspaces
  joinedAt: timestamp
```

Why the reverse index instead of a `collectionGroup` query on `members`:
collectionGroup reads across all workspaces cost more, cannot be scoped by the
client without reading other workspaces' member lists (a privacy leak), and don't
play well with the existing per-workspace rules. The reverse index is written by
the backend (Admin SDK) at the same time as the member doc — always in a batch.

### 4.2 Backend changes

**New callable: `createWorkspace({ name, businessType })`**
- Requires signed-in user. (Whether creation is gated by plan — Karl decision 1.)
- Generates an **unguessable** ID: `ws_` + 16 bytes crypto-random hex
  (e.g. `ws_9f2c41ab77d04e88`). Never slug-derived, never timestamp-derived.
- In one Admin-SDK batch: creates `workspaces/{id}` (`demo: false`), creates
  `members/{uid}` with `role: "owner"`, creates `users/{uid}/workspaceAccess/{id}`.
- Returns the new workspace ID. No client-side ID invention.

**New callable: `inviteWorkspaceMember({ workspaceId, email, role })`**
- Caller must be `owner`/`admin` of the workspace.
- Writes an invite doc `workspaces/{wsId}/invites/{inviteId}` with a random claim
  token; the invited user accepts via `acceptWorkspaceInvite({ token })`, which
  creates the member doc + reverse index. (Team invites can ship after the core
  migration — Karl decision 4.)

**Harden `requireWorkspaceAccess` / `requirePushWorkspaceAccess`:**
- Step 2 (auto-create workspace + grant owner): **removed**. A missing workspace
  doc is a hard `permission-denied`.
- Step 3 (auto-add member): **removed**. A non-member caller on an existing
  workspace is a hard `permission-denied`.
- Behavior becomes: member doc exists → allow; superadmin claim → allow;
  otherwise deny. No writes, no provisioning, no side effects.
- Keep the two functions' duplicated logic in sync (they are intentionally
  duplicated today; the hardening must land in both, or better, extract one
  shared helper in `functions/src/workspaceAuth.ts` — recommended).

**Firestore rules changes:**
- `match /users/{uid}/workspaceAccess/{wsId}`: `allow read: if isSignedIn() &&
  request.auth.uid == uid; allow write: if false;` (backend-only writes).
- `match /workspaces/{workspaceId}/members/{memberId}`: tighten the broad nested
  grant — members subcollection becomes read-by-members, **write by backend only**:
  split it out of the generic `/{collectionId}/{docId}` rule with explicit
  `allow read: if isWorkspaceMember(...) || isSuperAdmin(); allow write: if false;`.
- `match /workspaces/{workspaceId}`: `allow create` stays Super-Admin-only for
  clients; the `createWorkspace` callable is the only user path.
- `demo: true` workspaces: same rules; the `demo` flag is a UI label, not a
  security boundary.

### 4.3 Frontend — the real selector

- `WorkspaceSwitcher` keeps its UI. Its data source changes: instead of
  `localStorage['chatmize_workspaces']`, App state subscribes to
  `users/{uid}/workspaceAccess` (onSnapshot) and renders from there.
- Demo handling: workspaces with `demo: true` render with a visible "Demo" badge.
  Demo workspaces are fully functional sandboxes (they can send test messages)
  but are visually unmistakable.
- localStorage keeps **only UI preferences**: last-selected workspace ID (validated
  against the real membership list on load; falls back to the first real
  workspace), active tab, dismissed nudges. It never again holds workspace data.
- Workspace creation UI calls the `createWorkspace` callable, then selects the
  returned ID. The `ws-biz-${Date.now()}` localStorage-only path is deleted.
- The hardcoded `ws-chatmize-dev` sync effect in App.tsx is deleted with the
  migration (it exists only because the selector is fake).

### 4.4 Migration path (must ship WITH the hardening — see 3.4)

For each signed-in user on first load after the migration build:

1. Read their `localStorage['chatmize_workspaces']` blob (if any).
2. For each local workspace, call `claimLocalWorkspace({ localId, name, ... })` —
   a **one-time, rate-limited** callable that:
   - Creates a real workspace via the same path as `createWorkspace`
     (unguessable ID, owner = caller, reverse index).
   - Copies the display name (sanitized) so the user's list looks familiar.
   - Marks the claim with a per-user idempotency key so re-runs are safe.
   - Does NOT copy fake page IDs, fake stats, or fake avatars — those stay
     behind. Integrations must be reconnected for real (they were never real).
3. After claiming, the localStorage blob is archived (kept under a new key for
   30 days for support debugging) and the live list comes from Firestore.
4. Users with no local blob (new users): get **one** `demo: true` sandbox
   workspace ("Demo Sandbox") they can play in, plus the normal create flow.
   (Whether new users get a demo sandbox at all — Karl decision 2.)

This closes the hole without breaking anyone's saves: by the time the hardened
`requireWorkspaceAccess` rejects unknown workspaces, every legitimate user has
real member docs.

### 4.5 What happens to the ghost `ws-chatmize-dev`

Options (Karl decision 5):
- **A.** Recreate it as a proper workspace doc with Karl as owner, keep the
  integrations subcollections (they survive — they're nested under the ID).
- **B.** Move the integrations to a new unguessable-ID workspace, delete the old
  subcollections.
Either way, after the decision the `ws-chatmize-dev` ID must get a real doc +
owner immediately so it is no longer claimable.

### 4.6 Super Admin visibility

Super Admins (custom claim) already bypass in rules and callables. Add a
read-only "all workspaces" view backed by a callable (paginated, Admin SDK) —
never a client-side collectionGroup over workspaces, which would leak member
lists.

---

## 5. Cost and performance notes (Karl cares about this)

- Selector reads: one indexed query on `users/{uid}/workspaceAccess` per user
  (typically 1–5 docs), plus one onSnapshot listener. Negligible.
- Reverse-index writes: 1 extra doc write per membership change, batched with the
  member write — no extra round trips.
- No collectionGroup queries anywhere in the design.
- `createWorkspace` / invite callables: run rarely; cold starts irrelevant.
- Removing the auto-provisioning reads actually **reduces** Firestore reads per
  callable (today's path does member-get + workspace-get + members-limit(1) on
  every first touch; hardened path does member-get only).

---

## 6. Decision points for Karl

1. **Who can create workspaces?** Any signed-in user (simplest), or gated by
   paid plan / invite? (Recommendation: any signed-in user; plan limits come
   later with billing. Keeps signup friction zero.)
2. **Demo workspaces: keep or kill?** Keep clearly-labeled demo sandboxes for new
   users (recommended — good for activation), or start every user with an empty
   list and a "create workspace" prompt?
3. **Cutover for auto-provisioning:** hard cut with the migration (recommended —
   the migration makes it safe), or a grace period where unknown IDs get a
   one-time claim window?
4. **Team invites in this build or later?** The data model supports them; the UI
   can wait. (Recommendation: data model now, invite UI later.)
5. **Ghost `ws-chatmize-dev`:** option A (recreate doc, keep integrations) or
   option B (move to new ID)? Also approve the additive `userWorkspaces`
   backfill for HQ and QA Lab members (already on the Mac stack).
6. **ID format:** `ws_` + 16 random hex bytes (recommended), or keep a
   human-readable prefix like `ws-<slug>-<rand4>`? Note: anything human-readable
   is partially guessable; the random suffix is what matters.

---

## 7. Build checklist (for the builder who picks this up)

- [ ] Extract shared `requireWorkspaceAccess` into `functions/src/workspaceAuth.ts`;
      harden both call sites (deny on missing doc, deny on non-member, no writes)
- [ ] New `createWorkspace` callable (unguessable IDs, batch: workspace + member +
      reverse index)
- [ ] `claimLocalWorkspace` one-time migration callable (idempotent per user)
- [ ] `inviteWorkspaceMember` / `acceptWorkspaceInvite` (data model now, UI later
      if Karl defers)
- [ ] Firestore rules: `workspaceAccess` read-own/write-never, members
      write-never-from-clients, split members out of the generic nested grant
- [ ] Frontend: selector reads `users/{uid}/workspaceAccess` via onSnapshot;
      delete localStorage workspace blob reads, `ws-biz-${Date.now()}` creation,
      and the hardcoded `ws-chatmize-dev` sync effect
- [ ] Demo badge UI + "Demo Sandbox" for new users (per Karl decision 2)
- [ ] Ghost `ws-chatmize-dev` resolution (per Karl decision 5)
- [ ] Regression: push prompt save (the original 403), send flows, all guarded
      callables return permission-denied for non-members (negative test)
- [ ] Merge to `release/all-features`; deploy via coordinator; two-phase QA

---

## 8. Open risks / non-goals

- This spec does not change billing/entitlement enforcement; plan-gating workspace
  creation is a later card.
- The `ownerName: 'Karl Schuckert'` hardcoding in demo data dies with the
  migration (it comes from the signed-in user going forward).
- Deep links or support tooling that reference `ws-chatmize-dev` / `ws-chatmize-hq`
  by ID keep working — IDs are preserved; only the auth around them changes.
