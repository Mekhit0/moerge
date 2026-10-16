# MOERGE — Salon Appointment Reminder & Intelligent Booking Platform

A modern, multi-tenant SaaS platform built with **Next.js 15 (App Router + TypeScript)**, **Tailwind CSS**, **Supabase (PostgreSQL + Auth + Row Level Security)**, and **Resend** designed for beauty salons and aesthetic clinics. Automatically sends personalized **email reminders** to clients for upcoming maintenance and follow-up treatments, eliminates double-bookings with smart scheduling buffers, and safeguards customer data through strict multi-tenant isolation.

> **Notification Channel Policy:** Email is the primary notification channel. Client phone numbers are optional for desk reference and are never spammed.

---

## 1. Architecture & Security Model

- **Multi-Tenant Row Level Security (RLS):**
  - All core tables (`salons`, `user_profiles`, `salon_memberships`, `salon_settings`, `clients`, `appointments`, `reminders`, `email_logs`, `public_booking_rate_limits`) are isolated by `salon_id` and verified using PostgreSQL RLS policies (`public.user_has_salon_access(salon_id)`).
  - Server endpoints resolve the authenticated staff member's `salon_id` via `getAuthenticatedSalonContext()` on the server and reject untrusted client IDs.
- **RPC Access Lockdown (Migration 11):**
  - Sensitive internal worker procedures (`claim_due_reminders`, `process_email_webhook_event`, `record_reminder_send_result`) have execution privileges revoked from `PUBLIC`, `anon`, and `authenticated`. They are strictly callable only by `service_role`.
  - Public RPCs (`get_public_salon_booking_info`, `get_salon_date_availability`, `submit_public_booking`, `unsubscribe_client_by_token`) are strictly parameterized and guarded against injection.
- **Resend API Key Protection:**
  - Column-level privileges revoke direct `SELECT` on `salon_settings.resend_api_key` for `anon` and `authenticated` roles.
  - Client-facing APIs and settings pages only see masked indicators (`"********"` or `null`). Real keys are accessed exclusively via backend service role clients.
- **Timing-Safe Cron & Webhook Secret Validation:**
  - Both `/api/cron/process-reminders` and `/api/webhooks/resend` enforce timing-safe secret comparisons (`crypto.timingSafeEqual`) to prevent timing attacks.
  - If `CRON_SECRET` or `SUPABASE_SERVICE_ROLE_KEY` is not configured, endpoints return clear `500` server errors without leaking data or falling back silently.
- **Public Booking DDoS & Spam Protection:**
  - **Cloudflare Turnstile:** Verifies bot challenge tokens when `TURNSTILE_SECRET_KEY` is present.
  - **DB-Level Rate Limiting:** Enforces a maximum of 5 bookings per hour per normalized email and per client IP via `public.public_booking_rate_limits`.
  - **Email Confirmation Throttling:** Throttles outgoing booking confirmation emails to a maximum of 3 emails per 10-minute window per recipient.
  - **Trusted Client IP Extraction:** Inspects `x-real-ip`, Next.js `request.ip`, and `x-forwarded-for` (first hop) securely.
- **Idempotent Background Email Worker (`src/lib/reminder-worker.ts`):**
  - Background workers utilize `FOR UPDATE SKIP LOCKED` inside `public.claim_due_reminders` to avoid race conditions or double-sending.
  - Passes deterministic `Idempotency-Key` headers to the Resend API.
  - Handles exponential backoff retries for transient errors (429/5xx) while stopping on permanent failures (invalid email, hard bounce).

---

## 2. Local Development Setup

### Prerequisites
- Node.js `v20+` (tested with Node `20+` / `24+`) and `npm`
- A Supabase project with PostgreSQL

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Configure Environment Variables
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```

Configure your environment variables:
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase publishable / anon key
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role key (required in production for cron worker, webhooks, and rate limits)
- `RESEND_API_KEY` — Resend API key (`re_...`)
- `RESEND_WEBHOOK_SECRET` — Resend Svix webhook signing secret (`whsec_...`)
- `CRON_SECRET` — Strong shared secret authenticating `/api/cron/process-reminders`
- `TURNSTILE_SECRET_KEY` — Cloudflare Turnstile secret key (optional in local dev)
- `EMAIL_DRY_RUN="true"` — Safe dry-run mode for development
- `TEST_STAFF_EMAIL` & `TEST_STAFF_PASSWORD` — Optional test credentials for authenticated RLS test suite

### Step 3: Apply Database Migrations
Apply the migrations in `supabase/migrations/` in numerical order:
1. `20261016000001_salon_reminder_schema.sql` — Core multi-tenant tables, types, and initial RLS policies.
2. `20261016000002_seed_initial_salon_and_staff.sql` — Initial schema helper seed data.
3. `20261016000003_cron_schedule_template.sql` — Helper RPC template for `pg_cron` setup.
4. `20261016000004_public_booking_ecosystem.sql` — Public booking info, slug resolution, and availability lookup.
5. `20261016000005_smart_availability_and_conflict_check.sql` — Dynamic time-slot conflict evaluation & buffer checks.
6. `20261016000006_moerge_production_booking_and_tbilisi_tz.sql` — Asia/Tbilisi timezone standard & returning client detection.
7. `20261016000007_moerge_multi_tenant_salon_registration.sql` — Multi-tenant self-service onboarding and salon creation RPCs.
8. `20261016000008_moerge_production_ready_live_delivery.sql` — Production email logging & live delivery statuses.
9. `20261016000009_smart_custom_services_and_templates.sql` — Dynamic salon services, procedures catalog & interval customization.
10. `20261016000010_add_client_created_by.sql` — Audit trail for client creation (`created_by`).
11. `20261016000011_security_hardening.sql` — Security lockdown: revokes internal RPCs to `service_role`, protects `resend_api_key` column, deactivates legacy demo user, adds `public_booking_rate_limits` table with hourly rate limits.

### Step 4: Run the Development Server & Test Suite
```bash
npm run dev
```
Open `http://localhost:3000` to access the application.

Run the test suite:
```bash
npm test
```
Run type-checking:
```bash
npx tsc --noEmit
```

---

## 3. Production Deployment & Human Configuration Checklist

Before activating live email delivery in production, complete the following configuration steps:

1. **Verify Sender Domain in Resend:**
   - Register your domain (e.g., `yourdomain.ge`) in Resend.
   - Add the required DKIM, SPF, and DMARC DNS records at your domain registrar.
2. **Set Production Secrets:**
   - In your hosting provider (e.g., Vercel), set:
     - `CRON_SECRET`: Generate a cryptographically random string (e.g., `openssl rand -hex 32`).
     - `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase project service role secret.
     - `RESEND_API_KEY`: Production Resend key (`re_...`).
     - `RESEND_WEBHOOK_SECRET`: Resend webhook signing secret (`whsec_...`).
     - `TURNSTILE_SECRET_KEY`: Turnstile secret key from Cloudflare.
3. **Configure Scheduled Cron:**
   - **Vercel Cron:** Automatically configured via `vercel.json` to trigger `/api/cron/process-reminders` every 15 minutes.
   - **Supabase Cron (`pg_cron`):** Alternatively configure via `SELECT public.configure_reminder_cron_job(...)`.
4. **Disable Dry-Run Mode:**
   - In production environment variables, set `EMAIL_DRY_RUN="false"`.
   - In `/settings`, ensure the **Verified Sender Email Address** matches your verified domain.
