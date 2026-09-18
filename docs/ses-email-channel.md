# SES Email Channel for ChatMize

Decision (2026-09-18, Karl): AWS SES instead of Resend for ChatMize email.

## Why

- Resend Pro: $20/mo for 50k emails (~$0.40 per 1,000). SES: $0.10 per 1,000.
  Same 50k costs $5 on SES. At 100k it's $90 vs $10. Roughly 4-9x cheaper.
- Free tier: AWS currently gives 3,000 emails/month free for the first 12
  months (the old 62,000 EC2 free tier was cut in 2023, and it only ever
  applied to sends originating from EC2, so it would not have covered our
  GCP functions anyway).
- Deliverability is excellent once DKIM/SPF/DMARC and bounce handling are
  set up. Resend's edge is developer experience, not inbox placement.

## Current AWS standing (verified read-only 2026-09-18, us-west-2)

- Production access: already enabled. No sandbox wait.
- Quota: 71,900 emails per 24h, 14 per second. Plenty for launch.
- Enforcement status: HEALTHY. Sending enabled.

## Architecture

- New callable `sendEmail(workspaceId, to, subject, html, text?, replyTo?)`.
- Sends through the SESv2 API from the Cloud Function (region us-west-2).
- Credentials: dedicated IAM user with only `ses:SendEmail` on the account.
  Access key lives in Secret Manager. Karl creates the IAM user; the key
  goes through the Secure Vault, never chat. The existing SES production
  access stays untouched.
- Cost: $0.10 per 1,000 emails + $0.12/GB of attachments. 10k emails/mo
  is about $1. No idle cost; fully serverless.

## Sending identities (two phases)

- Phase 1 (launch): one shared ChatMize verified domain for transactional
  mail (notifications, reconnect nudges, receipts). One DKIM setup, done.
- Phase 2: workspace custom domains. The owner adds 3 CNAME DKIM records
  in their DNS; the backend calls VerifyDomainIdentity and polls until the
  domain verifies. Status and the records to add show on the email channel
  card in Settings > Channels.

## Bounce and complaint handling (required)

SES suspends accounts over ~5% bounce rate or ~0.1% complaint rate, so this
is not optional:

- One SES configuration set with an SNS event destination pointing at an
  HTTPS webhook on our side (folded into an existing HTTP function; the
  proxy blocks creating new functions via API).
- Bounces and complaints land in Firestore at
  `workspaces/{ws}/emailSuppressions`.
- The send path checks suppression first and skips silently.

## Frontend

- Email channel card in Settings > Channels: status, domain verification
  state with the DKIM records to add, and a test-send button.
- Reuses the sticky-banner pattern if a workspace's domain ever fails
  verification.

## What Karl owns (console steps)

1. Create the scoped IAM user and hand over the key via the Secure Vault.
2. Pick the Phase 1 sending domain (suggestion: mail.chatmize.com) and add
   the DKIM records.

## Not building yet

- Open/click tracking via SES event publishing (Phase 2).
- Dedicated IPs ($24.95/mo each; only if shared-pool reputation ever
  becomes a problem, which it rarely does at our volumes).
