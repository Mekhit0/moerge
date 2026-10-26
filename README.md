# moarge

moarge is a booking and client-management app for beauty salons in Georgia. The dashboard and booking flow support Georgian and English.

## Current features

- Public booking with relational services, staff selection or any available staff, date limits, Turnstile protection, database-backed rate limits, and optional email.
- Staff schedules, breaks, time off, and service assignments drive public availability and dashboard booking. A database exclusion constraint prevents overlapping active appointments for one staff member or resource.
- Day and week staff calendars with quick booking, drag rescheduling, time blocks, and arrived, no-show, and canceled statuses.
- Salon appointment and client records, including client consent and archive controls.
- Owner, admin, and staff memberships. Settings and membership management are restricted to owners and admins.
- Email booking confirmations for eligible verified addresses, email reminders for completed epilation appointments, webhook status updates, and unsubscribe links.
- New salons receive a 14-day trial. Public bookings and reminder delivery are disabled after the trial expires unless the salon is active.

SMS reminders, resource administration, subscription payments, and reminders for non-epilation services are not implemented.

## Local development

Requirements: Node.js 20 or later and npm.

```bash
npm ci
cp .env.example .env.local
npx supabase start
npx supabase db reset
npm run dev
```

On PowerShell, copy the environment template with `Copy-Item .env.example .env.local`. Fill the required values in `.env.local` before using authenticated or email features. Do not commit `.env.local`.

The optional `supabase/seed.sql` contains synthetic local salon and client records. Run it only against a local development database, after migrations. It creates no auth users or credentials and must never be run in production.

## Environment variables

| Variable | Required | Used for | Exposure |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL | Browser and server |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Session-scoped Supabase access | Browser and server |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Privileged server routes and database rate limiting | Server only |
| `NEXT_PUBLIC_APP_URL` | Yes in deployed environments | Canonical links and email URLs | Browser and server |
| `RESEND_API_KEY` | Yes for live email | Platform email delivery | Server only |
| `RESEND_FROM_DOMAIN` | Yes for live email | Verified sender domain | Server only |
| `RESEND_WEBHOOK_SECRET` | Yes for webhook processing | Resend webhook signature validation | Server only |
| `CRON_SECRET` | Yes for reminder processing | Bearer authentication for the cron endpoint | Server only |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Yes for live public booking | Turnstile browser widget | Browser and server |
| `TURNSTILE_SECRET_KEY` | Yes for live public booking | Turnstile server verification | Server only |
| `EMAIL_DRY_RUN` | No | Simulate email delivery in development | Server only |
| `EMAIL_TEST_RECIPIENT` | No | Redirect non-production test email | Server only |
| `TEST_STAFF_EMAIL` | No | Supabase integration tests | Test environment only |
| `TEST_STAFF_PASSWORD` | No | Supabase integration tests | Test environment only |
| `TEST_STAFF_ROLE` | No | Enables the staff authorization integration test when set to `staff` | Test environment only |

Missing required server keys fail closed. Never put service, Resend, webhook, cron, or Turnstile secret values in a `NEXT_PUBLIC_` variable.

## Database migrations

The migrations directory has a clean baseline followed by the Phase 0 security migration and Phase 2 booking migrations. The baseline consolidates former versions `20261016000001` through `20261016000011`; the former Phase 0 source at `20261026104942` was replaced when the history was reordered. Phase 2 adds staff scheduling, relational services, appointment conflict protection, and removes the legacy JSONB service catalog. The replaced SQL files are listed in `supabase/migrations/README.md`.

Existing databases may already have the replaced versions recorded. Do not apply the new baseline to those databases as a fresh migration. The configured staging project (`oolsgizchxstiuvzveos`) has the current Phase 0 and Phase 2 migrations applied and was used for the booking integration test. Production was not changed. For other existing databases, reconcile migration history before applying only pending migrations.

## Deployment

Deploy the Next.js app through Vercel and configure the required environment variables above in the appropriate Vercel environments. Verify the Resend sending domain and configure the Resend webhook to call `/api/webhooks/resend`. Configure the Turnstile site for the deployed booking domain. Apply database changes to a confirmed staging project first, then follow the project's normal production release process.

## Reminder scheduler

For the normal schedule, enable Supabase `pg_cron` and `pg_net` and schedule a POST to `/api/cron/process-reminders` every 15 minutes. Send `Authorization: Bearer <CRON_SECRET>` and keep the value in Supabase Vault or another secret store. `vercel.json` retains a once-daily Vercel Cron as a fallback. The endpoint returns a server configuration error if `CRON_SECRET` is missing.

## Checks

The same commands run in GitHub Actions on pushes and pull requests:

```bash
npm ci
npx tsc --noEmit
npm run lint
npm test
```

Supabase integration tests are skipped unless the Supabase test URL/key are configured. The staff settings test also requires a dedicated test account with the `staff` membership role. The booking concurrency test runs only when `RUN_STAGING_BOOKING_TESTS=true` and the configured URL is the designated staging project; it creates and removes isolated fixture data.
