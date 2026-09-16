# ChatMize deployment

Three environments, one promotion path:

```
dev branch  ->  development environment  ->  dev Firebase project
staging branch  ->  staging environment  ->  staging Firebase project
main branch  ->  production environment  ->  gen-lang-client-0433776094 (chatmize-prod database)
```

Push to `dev` to ship to dev. Open a PR `dev -> staging` to promote.
Open a PR `staging -> main` to promote to production.

## One-time setup (Karl)

### 1. Firebase projects for dev and staging

The production project already exists: `gen-lang-client-0433776094`.
Create two more Firebase projects (or reuse existing ones) for dev and
staging, then put their project ids in `.firebaserc` (replace
`REPLACE_WITH_DEV_PROJECT_ID` / `REPLACE_WITH_STAGING_PROJECT_ID`).

In each project:
- Enable Firestore (create database; production uses `chatmize-prod`)
- Enable Firebase Authentication (Email/Password + Google providers)
- Enable Cloud Functions (2nd gen needs billing enabled)
- Create the secrets in **each** project's Secret Manager
  (or set once and grant access):
  `META_APP_SECRET`, `META_VERIFY_TOKEN`, `META_PAGE_TOKEN_DEFAULT`,
  `WHATSAPP_TOKEN_DEFAULT`, `WHATSAPP_PHONE_NUMBER_ID`

### 2. GitHub Environments

Repo Settings -> Environments -> create three environments:
`development`, `staging`, `production`.

Each environment gets these **Variables**:
- `FIREBASE_PROJECT_ID` (that env's project id)
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_MEASUREMENT_ID` (may be empty)
- `VITE_FIRESTORE_DATABASE_ID` (production: `chatmize-prod`)

On the `production` environment, add Karl as a **required reviewer**.
Nothing deploys to prod until he approves the run.

### 3. Firebase CI token (repo secret)

On a machine logged into Firebase (`firebase login`), run:

```bash
firebase login:ci
```

Copy the token into a repo secret named `FIREBASE_TOKEN`
(Repo Settings -> Secrets and variables -> Actions).

### 4. Branch protection on `main`

Repo Settings -> Branches -> add rule for `main`:
- Require pull request before merging
- Require CI (`CI` workflow) to pass
- Do not allow bypassing (applies to everyone incl. admins,
  or allow Flint's bot account if preferred)

### 5. First deploy

```bash
git push origin dev      # ships to the dev environment
```

Watch it in the Actions tab. Promote with PRs: `dev -> staging`,
`staging -> main` (production run waits for Karl's approval).

## What deploys

Each deploy ships, to that environment's project:
- **Hosting**: the Vite production build (`dist/`) as a single-page app
- **Functions**: `metaWebhook`, `sendChannelMessage`, `onInboundMessageCreated`
- **Firestore**: `firestore.rules` + `firestore.indexes.json`

## Manual deploy (emergency)

```bash
firebase use production
firebase deploy --only hosting,functions,firestore
```
