# moarge

moarge is a booking and client-management app for beauty salons in Georgia. The dashboard and booking flow support Georgian and English.

## Current features

- Public booking with relational services, staff selection or any available staff, date limits, Turnstile protection, database-backed rate limits, and optional email.
- Staff schedules, breaks, time off, and service assignments drive public availability and dashboard booking. A database exclusion constraint prevents overlapping active appointments for one staff member or resource.
- Day and week staff calendars with quick booking, drag rescheduling, time blocks, and arrived, no-show, and canceled statuses.
- Salon appointment and client records, including client consent and archive controls.
- Owner, admin, and staff memberships. Settings and membership management are restricted to owners and admins.
- Settings, staff, and appointment changes are recorded in an audit log that stores changed field names, not prior or new values.
- A platform-owner dashboard summarizes salon trials, plan status, staff/branch counts, recent bookings, SMS volume/cost, and dashboard feedback.
- Dashboard feedback can be submitted from any signed-in salon workspace and is rate limited on the server.
- Consent-based notifications with salon templates in Georgian and English: booking confirmation, 24-hour and 2-hour reminders, cancel/reschedule confirmation, service-specific recall, and no-show follow-up.
- A retryable, idempotent notification outbox with per-channel consent, delivery log, email unsubscribe, SMS unsubscribe, and client self-service cancellation/rescheduling.
- New salons receive a 14-day trial. Public bookings and reminder delivery are disabled after the trial expires unless the salon is active.

Resource administration and subscription payments are not implemented. uBill is the SMS provider; configure its credentials and an authorized brand to enable live SMS. See the [uBill API guide](https://ubill.ge/en/api-docs) for account and brand setup.

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
| `NEXT_PUBLIC_APP_URL` | Yes | Canonical site URL (for example `https://www.moarge.com`) for SEO metadata, sitemap, booking links, email links and signup confirmation. The build and server fail if it is missing | Browser and server |
| `RESEND_API_KEY` | Yes for live email | Platform email delivery | Server only |
| `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` | Optional | Server/client error reporting | Server / public DSN |
| `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` | Optional for releases | Sentry source map upload | Build only |
| `RESEND_FROM_DOMAIN` | Yes for live email | Verified sender domain | Server only |
| `PAYMENT_PROVIDER` | No | Set to `fake` for local or staging billing-flow tests only | Server only |
| `UBILL_API_KEY` | Yes for live SMS | uBill API authentication | Server only |
| `UBILL_BRAND_ID` | Yes for live SMS | Authorized uBill sender brand | Server only |
| `NOTIFICATION_PROVIDER` | No | Set to `fake` to simulate delivery | Server only |
| `RESEND_WEBHOOK_SECRET` | Yes for webhook processing | Resend webhook signature validation | Server only |
| `CRON_SECRET` | Yes for reminder processing | Bearer authentication for the cron endpoint | Server only |
| `PLATFORM_OWNER_USER_ID` | Yes to enable the owner dashboard | Supabase Auth user UUID allowed to access `/platform` and the platform overview API | Server only |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | No | Optional Turnstile widget; booking also uses the database-backed limiter and hidden honeypot field | Browser |
| `TURNSTILE_SECRET_KEY` | No | Optional Turnstile verification | Server only |
| `EMAIL_DRY_RUN` | No | Simulate email delivery in development | Server only |
| `EMAIL_TEST_RECIPIENT` | No | Redirect non-production test email | Server only |
| `TEST_STAFF_EMAIL` | No | Supabase integration tests | Test environment only |
| `TEST_STAFF_PASSWORD` | No | Supabase integration tests | Test environment only |
| `TEST_STAFF_ROLE` | No | Enables the staff authorization integration test when set to `staff` | Test environment only |
| `RUN_STAGING_BOOKING_TESTS` | No | Set to `true` to enable concurrency tests with a matching staging URL and service-role key | Test environment only |

Missing required server keys fail closed. Never put service, Resend, webhook, cron, or Turnstile secret values in a `NEXT_PUBLIC_` variable.

## Database migrations

The migrations directory has a clean baseline followed by the Phase 0 security migration and Phase 2 through Phase 5 migrations. The baseline consolidates former versions `20261016000001` through `20261016000011`; the former Phase 0 source at `20261026104942` was replaced when the history was reordered. Phase 2 adds staff scheduling and relational services. Phase 3 adds normalized phone identity, channel consent, templates, notification queue, and self-service booking management. Phase 4 adds onboarding and the provider-agnostic billing ledger. Phase 5 adds audit history, feedback, platform overview, and performance indexes.

Existing databases may already have the replaced versions recorded. Do not apply the new baseline to those databases as a fresh migration. The configured staging project (`oolsgizchxstiuvzveos`) has the Phase 0 and Phase 2 through Phase 5 migrations applied. Production was not changed. For other existing databases, reconcile migration history before applying only pending migrations.

Phase 5 adds audit history, dashboard feedback, a platform-owner overview, and calendar/availability indexes. Its migrations were applied to staging only. Configure `PLATFORM_OWNER_USER_ID` with the platform operator's Supabase Auth user UUID in the deployment environment; the ID is checked server-side and never accepted from a request.

## Deployment

Deploy the Next.js app through Vercel and configure the required environment variables above in the appropriate Vercel environments. Verify the Resend sending domain and configure the Resend webhook to call `/api/webhooks/resend`. Configure the Turnstile site for the deployed booking domain. For SMS, add the uBill API key and authorized brand ID. Apply database changes to a confirmed staging project first, then follow the project's normal production release process.

## Payments

Billing currently uses a provider-agnostic ledger and fake checkout for local or staging flow tests. Do not enable fake payments in production. The owner selected Flitt, but a real adapter is not implemented until the owner supplies and confirms the recurring or invoice API documentation. Plans and rates are centralized in `src/lib/billing-plans.ts`; the billing UI reads the config through the server API. Trial salons receive 14 days without a card, with email only and no SMS. An expired trial or a plan invoice beyond its seven-day grace period is intended to pause booking and reminders and leave data read-only; records are never deleted automatically. Unpaid usage invoices pause SMS after seven days while bookings and email continue.

## Daily backup procedure

1. In Supabase Dashboard, open **Database → Backups** and confirm the latest scheduled backup completed within the last day. Paid Supabase projects create daily backups; projects without managed daily backups need an encrypted daily `supabase db dump` export stored outside the project.
2. Check that the backup covers the database and Auth records needed for recovery. Supabase database backups do not include Storage objects, so back up Storage objects separately if the app begins storing client files.
3. Once a month, restore the latest backup into a separate staging project and verify migrations, sign-in, salons, clients, and bookings. Record the restore date and any failures in the operations log.
4. For an incident, select the latest backup from before the data loss in the Supabase dashboard, announce expected downtime, restore, then verify the app before reopening booking. Supabase documents the daily backup retention and restore flow in its [backup guide](https://supabase.com/docs/guides/platform/backups).

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

Vitest reads its environment from the process and does not automatically load `.env.local`. The Supabase RLS/RPC tests require the confirmed staging URL and its matching anon key. The two staff membership tests also require a dedicated test account with an active `staff` role. The concurrency test additionally requires the matching staging service-role key and `RUN_STAGING_BOOKING_TESTS=true`; it creates and removes isolated fixture data. Do not run these integration tests against production.

## Phase 5 performance and security review

On staging, a generated fixture of 6,000 appointments across five staff and 30 days was used for `EXPLAIN (ANALYZE, BUFFERS)`. A one-week calendar range used `appointments_calendar_range_idx` and returned 500 rows in 0.846 ms execution time (503 shared buffer hits). The availability RPC completed in 15.8 ms on a fully booked fixture day (2,352 buffer hits). The fixture was deleted after measurement. These are staging observations, not production latency guarantees.

The security review and unresolved advisory list are in [`docs/phase5-security-review.md`](docs/phase5-security-review.md). Public booking availability RPCs are service-role-only and called through server routes; `ensure_user_salon` remains authenticated-only. Remaining items include callable membership helper RPCs, restricted service-only tables with no user RLS policy, and Supabase advisor recommendations that need a separate migration or operational decision.
