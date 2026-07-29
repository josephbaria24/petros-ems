# Petrosphere TMS

Next.js App Router training management system with Supabase (`tms` schema) and SendLayer SMTP email delivery.

## Email status tracking (SendLayer webhooks)

Emails continue to send through the existing Nodemailer SMTP integration (`lib/send-smtp-mail.ts`). After each successful `sendMail`, the app stores a normalized `messageId` with status `sent`. SendLayer posts delivery lifecycle events to:

`https://YOUR_DOMAIN.com/api/webhooks/sendlayer`

Those events update `tracked_emails` / `email_events` (Supabase) or a local file fallback.

### Architecture

| Piece | Role |
| --- | --- |
| `lib/send-smtp-mail.ts` | SMTP send + capture `info.messageId` |
| `lib/email-tracking/*` | Store interface, status precedence, fingerprints |
| `app/api/webhooks/sendlayer` | Receive SendLayer POSTs |
| `app/api/email-status` | Protected list/filter API |
| `app/api/email-status/reconcile` | Pull missing events from SendLayer Events API |
| `app/admin/email-status` | Staff UI (session auth via AppShell) |
| `lib/sendlayer/*` | Payload validation + Events API client |

Status precedence keeps progression (`sent` → `delivered` → `opened` → `clicked`) and never downgrades. Terminal states (`bounced`, `unsubscribed`, `complained`) stay visible. Full history is stored in `email_events` with idempotent `event_fingerprint` values.

### Environment variables

Copy `.env.example` and fill values. Existing SMTP names are reused:

- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM_EMAIL`, …
- `SENDLAYER_API_KEY` — Events API / optional register script (never expose to the browser)
- `EMAIL_STATUS_ADMIN_TOKEN` — Bearer token for status/reconcile APIs
- `NEXT_PUBLIC_APP_URL` — public HTTPS origin for webhook URLs
- `EMAIL_TRACKING_STORE=file` — force `.data/email-events.json` (local only)

### Database setup (recommended)

Run `scripts/create-email-tracking-tables.sql` against your Supabase project (`tms` schema). If the tables are missing, the app falls back to `.data/email-events.json`.

**Production / Vercel warning:** the file store is not durable on serverless filesystems. Use Supabase tables in production.

### SendLayer dashboard setup

1. Deploy or tunnel an HTTPS endpoint.
2. In SendLayer → Webhooks, create **separate** webhooks for each event, all pointing to the same URL:
   - delivery
   - bounce
   - open
   - click
   - unsubscribe
   - complaint
3. URL: `https://YOUR_DOMAIN.com/api/webhooks/sendlayer`

Optional one-time registration (lists first, skips duplicates; does **not** run on startup):

```bash
npx tsx scripts/register-sendlayer-webhooks.ts
```

### SMTP Message-ID correlation

On send, Nodemailer returns `info.messageId`. We normalize with `normalizeMessageId` (strips `<>`) and match webhook `EventData.MessageID` the same way.

**Limitation:** provider-generated IDs can differ between SMTP response and webhook payloads. Validate with a real SendLayer send. Unmatched webhooks still return `200`, are stored as `unmatched`, and are logged — they do not fail delivery retries forever.

### Viewing statuses

- UI: `/admin/email-status` (logged-in staff)
- API: `GET /api/email-status?recipient=&status=&messageId=&limit=`
  - Auth: Supabase session cookie **or** `Authorization: Bearer $EMAIL_STATUS_ADMIN_TOKEN`
  - Token must never be passed as a query parameter

### Reconciliation

When webhooks were missed:

```bash
curl -X POST https://YOUR_DOMAIN.com/api/email-status/reconcile \
  -H "Authorization: Bearer $EMAIL_STATUS_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"messageId":"your-message-id"}'
```

Or use **Reconcile from SendLayer API** on the admin detail panel.

### Local webhook testing

1. `npm run dev`
2. Expose the app with [ngrok](https://ngrok.com/) or Cloudflare Tunnel
3. Register the public HTTPS URL in SendLayer
4. Send a test email through the app
5. Confirm `/admin/email-status` updates

### Webhook signature security note

Payloads include a `Signature` object, but SendLayer’s public docs do not document a verification algorithm for this project to implement. The endpoint validates JSON shape, accepts POST only, and should be served over HTTPS. Do not treat Signature fields as verified crypto, and do not compare them to `SENDLAYER_API_KEY`.

### Scripts / tests

```bash
npm test
npm run build
```

## Getting started

```bash
npm install
npm run dev
```
