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
```

## Firestore layout (written by these functions)

```
workspaces/{workspaceId}/conversations/{channel}_{senderId}/messages/{externalId}
workspaces/{workspaceId}/webhook_dead_letter/{autoId}   # failed events, pending_retry
```

Message document ids are the Meta message id, so duplicate webhook
deliveries are naturally idempotent.

## Local dev

```bash
cd functions
npm install
npm run serve   # builds and starts the functions emulator
```
