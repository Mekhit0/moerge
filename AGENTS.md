# AGENTS.md: moarge

Put this file in the repo root. Codex reads it before every task.

## Product

moarge is a multi-tenant SaaS for beauty salons, aesthetic centers and (later) dental clinics in Georgia.
Core: online booking, staff schedules, client base, SMS and email reminders.
Product name is **moarge** (lowercase in code and URLs, "moarge" in UI). Remove deprecated brand identifiers and former demo business names except in clearly marked demo data.

## Stack

Next.js 15 App Router, TypeScript, Tailwind 4, Supabase (Postgres, Auth, RLS), Resend, Vercel, vitest, zod.
Default timezone Asia/Tbilisi. Primary UI language Georgian (ka), secondary English (en). Every user-facing string must exist in both.

## Hard rules

1. Never write secrets, keys or default secret fallbacks in code, SQL, README or tests. Read them from env only. If an env var is missing, fail loudly, never fall back.
2. Never commit `.env*`. Never print env values in logs or output.
3. Database changes only through new migration files in `supabase/migrations/` with the next timestamp. Never edit an already applied migration.
4. Run migrations only against a staging Supabase project, never production. If you cannot tell which project is configured, stop and ask.
5. Every table has `salon_id` and RLS. Any new SECURITY DEFINER function must `REVOKE EXECUTE ... FROM PUBLIC, anon, authenticated` and grant only to the roles that need it.
6. Never trust a client supplied `salon_id`. Resolve it on the server from the session.
7. Public endpoints need validation, rate limiting that works on serverless (not in memory), and abuse protection.
8. Georgian copy: clean and minimal, no em dashes, no heavy punctuation.
9. Do not claim a feature exists in UI copy, landing page or README until it is implemented and tested.
10. After every task run `npx tsc --noEmit`, `npm run lint` and `npm test`. Fix failures before continuing. Commit in small steps with clear messages.

## Security baseline

Phase 0 security controls are implemented in the current source and migrations. The Phase 0 migration has not been applied to a hosted project. Confirm staging before applying it, then run the gated Supabase integration tests.

## Working style

Work phase by phase from `docs/ROADMAP.md`. At the end of each phase stop, summarize what changed, what you could not verify, and what the owner must do manually. Do not start the next phase until told.
