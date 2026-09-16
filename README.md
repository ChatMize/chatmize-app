# ChatMize

AI-powered messaging and marketing automation. Build chatbots for Messenger, Instagram, WhatsApp, and SMS with a visual flow builder, run broadcasts, manage conversations live, and grow with an AI copilot, a snapshot library, and usage-based plans and credits.

## Project structure

- `src/` — React 19 + Vite client application
- `functions/` — Firebase Cloud Functions backend (Meta webhooks, outbound messaging, SMS via Twilio, AI metering and credits)
- `firestore.rules` / `firestore.indexes.json` — Firestore security rules and composite indexes
- `firebase.json` — Firebase project configuration
- `.github/workflows/` — CI and deploy pipelines

## Run locally

**Client**

```bash
npm install
npm run dev
```

Serves the app at `http://localhost:3000`.

**Backend**

```bash
cd functions
npm install
npm run serve
```

Runs the Cloud Functions emulators.

## Branches

- `main` — production
- `staging` — pre-production verification
- `dev` — active development

## CI / Deploy

Every push runs CI (`tsc --noEmit` lint and `vite build` for the client, lint and build for functions). The deploy workflow deploys each branch to its Firebase environment and requires the GitHub environment secrets to be configured.

Live production URL will be added here after the first production deploy.
