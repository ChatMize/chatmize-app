# ChatMize Cloud Functions (backend)

Firebase Cloud Functions (2nd gen, Node 20, region `us-west2`). This is the
real backend: Meta webhooks land here, outbound messages go out from here,
and every secret lives in Secret Manager.

## Functions

| Function | Trigger | Purpose |
|---|---|---|
| `metaWebhook` | HTTPS `onRequest` | Meta verification handshake (GET) + inbound Messenger / Instagram / WhatsApp events (POST) |
| `sendChannelMessage` | Callable `onCall` | Authenticated outbound send on any channel; checks workspace membership, uses Secret Manager tokens, records the result |
| `onInboundMessageCreated` | Firestore `onDocumentCreated` | Telemetry hook per inbound message; the AI agent auto-reply pipeline plugs in here (Phase 4) |
| `getCreditBalance` | Callable `onCall` | Member/Super Admin: read (and lazily create) a workspace's AI credit balance |
| `adjustCredits` | Callable `onCall` | Super Admin only: grant or deduct AI credits; every adjustment hits the immutable ledger |
| `resetMonthlyCredits` | Scheduled (monthly, 1st) | Reset every workspace balance to its plan allowance |

## Webhook URL

Configure one callback URL per workspace in the Meta App Dashboard:

```
https://us-west2-<project>.cloudfunctions.net/metaWebhook?workspace=<workspaceId>
```

## Secrets (Google Secret Manager, never in the repo)

```bash
firebase functions:secrets:set META_APP_SECRET        # Meta App Secret (signature verification)
firebase functions:secrets:set META_VERIFY_TOKEN      # your chosen verify token for the handshake
firebase functions:secrets:set META_PAGE_TOKEN_DEFAULT
firebase functions:secrets:set WHATSAPP_TOKEN_DEFAULT
firebase functions:secrets:set WHATSAPP_PHONE_NUMBER_ID
firebase functions:secrets:set ANTHROPIC_API_KEY          # Claude models
firebase functions:secrets:set OPENAI_API_KEY              # GPT models
firebase functions:secrets:set GEMINI_API_KEY             # Gemini models
firebase functions:secrets:set META_API_KEY               # Meta Llama API
```

## AI router (`src/ai/router.ts`)

Three tiers route to the cheapest capable model across Karl's four
providers (Anthropic, OpenAI, Google, Meta), with automatic fallback when
a provider errors:

- `fast` — classification, intent, short replies (Gemini Flash first)
- `balanced` — drafting, lead qualification (Claude Sonnet first)
- `smart` — Copilot flow building, hard reasoning (Claude Opus first)

`MODEL_CATALOG` is the single source of truth for routing AND cost:
every call meters real tokens through the credit ledger at
(cost x 3 margin). `testAiRouter` (Super Admin only, dry-run) verifies
keys and routing without spending credits.

## Firestore layout (written by these functions)

```
workspaces/{workspaceId}/conversations/{channel}_{senderId}/messages/{externalId}
workspaces/{workspaceId}/webhook_dead_letter/{autoId}   # failed events, pending_retry
credit_balances/{workspaceId}                          # AI credit balance (server-write only)
credit_ledger/{workspaceId}/entries/{autoId}           # immutable credit ledger (server-write only)
plans/{planId}                                         # commercial tiers (Super Admin managed)
```

Message document ids are the Meta message id, so duplicate webhook
deliveries are naturally idempotent.

## Local dev

```bash
cd functions
npm install
npm run serve   # builds and starts the functions emulator
```
