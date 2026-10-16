# Lumière Studio — Salon Epilation Appointment Reminder System

A full-stack, multi-tenant-ready web application built with **Next.js (App Router + TypeScript)**, **Tailwind CSS**, **Supabase (PostgreSQL + Auth + Row Level Security)**, and **Resend** that automatically reminds beauty salon clients by **email** to book their next epilation appointment **21 calendar days** after a completed treatment.

> **Important Channel Policy:** Email is the sole notification channel. Phone numbers are optional on client profiles for desk reference only and are never used for SMS, WhatsApp, or push notifications.

---

## 1. Architecture & Core Features

- **Authentication & Multi-Tenant Authorization:**
  - Powered by **Supabase Auth** (`@supabase/ssr`) and Next.js Middleware (`src/middleware.ts`).
  - All 8 tables (`salons`, `user_profiles`, `salon_memberships`, `salon_settings`, `clients`, `appointments`, `reminders`, `email_logs`) are scoped by `salon_id` and protected by PostgreSQL **Row Level Security (RLS)** (`public.user_has_salon_access(salon_id)`).
  - Server endpoints resolve the staff user's authorized `salon_id` on the server (`getAuthenticatedSalonContext()`) and never trust client-supplied salon IDs.
- **21-Day Precision Reminder Scheduling (`src/lib/scheduling.ts`):**
  - Only **completed epilation** treatments (`epilation`, `laser_epilation`, `wax_epilation`, `sugaring_epilation`) for active, consented clients trigger a reminder.
  - Calculates the target date as `treatment_date + 21 calendar days` (or the salon's configured interval) and converts `09:00` local salon time in the salon's IANA time zone (e.g., `America/New_York`, `Europe/Paris`, `Asia/Tbilisi`) to an exact UTC `scheduled_send_at` timestamp, accurately accounting for Daylight Saving Time (DST) transitions.
  - Editing, rescheduling, or canceling an appointment reconciles the existing reminder in-place (`planReminderReconciliation`) and enforces a partial unique index (`idx_unique_active_reminder_per_appointment`) so duplicate active reminders are impossible.
- **Idempotent Background Email Worker & Safe Retry (`src/lib/reminder-worker.ts`):**
  - Uses `FOR UPDATE SKIP LOCKED` inside `public.claim_due_reminders` so concurrent cron runs never double-claim or double-send the same reminder.
  - Passes a deterministic `Idempotency-Key` header (`rem:<salon_id>:<appointment_id>:<scheduled_date>:attempt:<n>`) to the Resend API.
  - Separately tracks API acceptance (`status = 'sent'`, `event_type = 'api_accepted'`) vs. actual webhook-confirmed delivery (`status = 'delivered'`, `event_type = 'delivered'`) vs. bounces (`status = 'bounced'`).
  - Retries temporary failures (429 / 5xx / network timeouts) using exponential backoff (`15m`, `60m`, `240m`, up to 3 attempts) while immediately halting on permanent failures (4xx / invalid recipient / unverified domain / hard bounce).
- **Privacy, Consent & One-Click Unsubscribe:**
  - Every reminder email includes `List-Unsubscribe` headers and a personalized `/unsubscribe?token=<uuid>` link that opts the client out and cancels any pending scheduled reminders.

---

## 2. Local Development Setup

### Prerequisites
- Node.js `v20+` (tested with `v24.14.0`) and `npm`
- A Supabase project (migrations are located in `supabase/migrations/`)

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Configure Environment Variables
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```
Fill in your environment variables in `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL` — Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Your Supabase publishable/anon key
- `SUPABASE_SERVICE_ROLE_KEY` — Server-only service role key (optional locally when using the built-in `SECURITY DEFINER` RPCs, recommended for production)
- `RESEND_API_KEY` — Your Resend API key (`re_...`)
- `RESEND_WEBHOOK_SECRET` — Your Resend Svix webhook signing secret (`whsec_...`)
- `CRON_SECRET` — Shared secret authenticating `/api/cron/process-reminders`
- `EMAIL_DRY_RUN="true"` — Keeps development safe by simulating sends without emailing real clients

### Step 3: Apply Database Migrations
Apply the SQL files in `supabase/migrations/` in order via the Supabase CLI (`supabase db push`) or the Supabase SQL Editor:
1. `supabase/migrations/20261016000001_salon_reminder_schema.sql`
2. `supabase/migrations/20261016000002_seed_initial_salon_and_staff.sql`
3. `supabase/migrations/20261016000003_cron_schedule_template.sql`

### Step 4: Run the Development Server & Tests
```bash
npm run dev
```
Open `http://localhost:3000`. You can log in immediately using the pre-seeded salon staff account:
- **Email:** `staff@lumieresalon.com`
- **Password:** `SalonStaff2026!`

Run the automated test suite at any time:
```bash
npm test
```

---

## 3. Configuring Resend & Verifying Your Sender Domain

1. Create an account at [https://resend.com](https://resend.com) and navigate to **Domains** &rarr; **Add Domain** (e.g., `lumieresalon.com`).
2. Add the provided **SPF**, **DKIM**, and **DMARC** DNS records to your domain registrar and click **Verify DNS Records**.
3. Navigate to **API Keys** &rarr; **Create API Key** (Sending access) and set `RESEND_API_KEY="re_..."` in `.env.local` and your production hosting environment.
4. Navigate to **Webhooks** &rarr; **Add Webhook** in Resend:
   - **Endpoint URL:** `https://your-production-domain.com/api/webhooks/resend`
   - **Events to subscribe to:** `email.sent`, `email.delivered`, `email.delivery_delayed`, `email.bounced`, `email.complained`
   - Copy the **Signing Secret** (`whsec_...`) and set `RESEND_WEBHOOK_SECRET` in your environment variables.
5. In the application **Settings** page (`/settings`), set your **Verified Sender Email Address** (e.g., `reminders@lumieresalon.com`), uncheck **Dry-Run Mode**, and click **Save Salon Settings**.

---

## 4. Configuring the Scheduled Reminder Job (Cron)

Reminders are processed automatically in the background by `/api/cron/process-reminders` without requiring any staff member to have a browser tab open. Two scheduling options are supported out of the box:

### Option A: Vercel Cron (Automatic on Vercel Deployment)
The included `vercel.json` configures Vercel Cron to invoke `/api/cron/process-reminders` every 15 minutes (`*/15 * * * *`). When `CRON_SECRET` is configured in Vercel Environment Variables, Vercel automatically sends `Authorization: Bearer <CRON_SECRET>`.

### Option B: Supabase Cron (`pg_cron` + `pg_net`)
1. In the Supabase Dashboard, go to **Database** &rarr; **Extensions** and enable `pg_cron` and `pg_net`.
2. In the Supabase **SQL Editor**, generate and run the schedule command using the included helper function:
```sql
SELECT public.configure_reminder_cron_job(
  'https://your-production-domain.com',
  'your-cron-secret'
);
```
Copy and execute the returned `SELECT cron.schedule(...)` SQL statement to trigger `/api/cron/process-reminders` every 15 minutes directly from Supabase PostgreSQL.

---

## 5. Deployment Instructions (Vercel)

1. Push this repository to GitHub / GitLab / Bitbucket.
2. Import the project into [Vercel](https://vercel.com/new).
3. Configure the environment variables from `.env.example` in the Vercel Project Settings.
4. Deploy. Vercel will build the Next.js application and register the `/api/cron/process-reminders` cron schedule defined in `vercel.json`.

---

## 6. Remaining Tasks Requiring Human Configuration

Before switching from **Dry-Run Mode** to live client emailing in production, a human administrator must complete the following external steps:
1. **Verify Sender Domain in Resend:** Add DNS records (DKIM/SPF) in your domain provider for your salon's sender domain and verify it in Resend.
2. **Provide Live Resend Credentials:** Set a real `RESEND_API_KEY` (`re_...`) and `RESEND_WEBHOOK_SECRET` (`whsec_...`) in your production environment variables.
3. **Set Production `CRON_SECRET` & `SUPABASE_SERVICE_ROLE_KEY`:** Replace `CRON_SECRET` with a strong random secret and add `SUPABASE_SERVICE_ROLE_KEY` in production environment variables.
4. **Disable Dry-Run Mode:** In `/settings` (and `.env` `EMAIL_DRY_RUN="false"`), disable Dry-Run Mode once your sender domain is verified.
