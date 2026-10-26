# Phase 5 security review

Reviewed 2026-10-26 against the route handlers under `src/app/api`, the public SECURITY DEFINER RPC catalog on staging, and Supabase security/performance advisors. The staging migrations `20261026170000`, `20261026173000`, and `20261026174000` were applied to project `oolsgizchxstiuvzveos`; production was not touched.

## Route review

- Authenticated salon routes resolve the salon from `getAuthenticatedSalonContext()` and use that salon ID in queries. Settings, staff, services, schedules, time off, branches, notification templates, billing, reports, client import/export, and audit history require owner/admin where they mutate or expose admin data.
- Appointment creation, rescheduling, status changes, client management, and reminder cancellation are available to authenticated salon members by design. Writes use the member's resolved salon; appointment creation/rescheduling use database RPCs and the exclusion constraint.
- Public booking and booking management are isolated in `/api/public/book` and `/api/public/manage-booking`; booking validates input, Turnstile, persistent rate limits, subscription status, service eligibility, and booking quotas. Resend webhooks validate their signature. Cron requires the configured Bearer secret and fails closed when unset. Unsubscribe and health routes disclose only minimal output.
- `/api/platform/overview` and `/platform` compare the authenticated user UUID to `PLATFORM_OWNER_USER_ID` before using the service-role client. The ID is never accepted from a request.
- Feedback writes derive salon and submitter from the signed-in context, validate content, and use a persistent server-side rate limit. Audit records store changed field names and actor IDs, not previous/new values or appointment notes/client details.

## RPC permissions

- `get_available_slots` and `get_public_salon_booking_info` now have EXECUTE only for `service_role`. Their public web flow continues through server routes using the service client.
- `ensure_user_salon` remains executable only by `authenticated` as required for session setup.
- Appointment, notification, webhook, rate-limit, unsubscribe, billing, and platform overview SECURITY DEFINER functions are restricted to service_role or are trigger-only. `capture_salon_audit` is trigger-only. The platform overview function also checks the JWT role claim for service_role.

## Open security findings

1. `ensure_user_salon(text)` is an authenticated-callable SECURITY DEFINER function and remains so for signup/session bootstrap. Its function body must continue binding writes to `auth.uid()` and not trust salon IDs from parameters. Supabase advisor finding: [security definer functions callable by authenticated](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).
2. `user_has_salon_access(uuid)` and `user_is_salon_admin(uuid)` are authenticated-callable SECURITY DEFINER helpers used by RLS policies. They return booleans for arbitrary salon UUIDs and can permit membership/admin-state probing. Replacing them requires policy-safe internal helpers or a different RLS design; evaluate before revoking their EXECUTE grant. Same advisor link as above.
3. Supabase reports four RLS-enabled tables with no user-facing policies: `booking_email_daily_limits`, `payment_provider_events`, `public_booking_rate_limit_counters`, and `public_booking_rate_limits`. They are intended for service-side access only. Confirm their table grants remain unavailable to `anon` and `authenticated` as the schema evolves. Advisor: [RLS enabled without policies](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).
4. Supabase still reports `btree_gist` installed in `public`. Moving an extension can affect existing exclusion and GiST indexes and should be planned as a separate migration. Advisor: [extensions in public](https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public).
5. Two existing policies on `user_profiles` and one on `salon_memberships` use auth expressions that Supabase says are reevaluated per row. Nine tables also have multiple permissive authenticated SELECT policies. These are performance advisories, not demonstrated authorization bypasses; consolidate/rewrite after reviewing existing policy semantics. Advisor: [RLS initialization plans](https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan), [multiple permissive policies](https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies).
6. Supabase reports 20 existing unindexed foreign keys. New Phase 5 indexes cover the audit actor, feedback salon/submitter, appointment creator/resource (including `(salon_id, resource_id)`), and notification log appointment/client lookups. Remaining findings are in existing email, billing, rate-limit, reminder, service-resource, staff-service, subscription, and client relationships. Advisor: [unindexed foreign keys](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys).
7. The authenticated client-list route still returns all matching client rows with no pagination. It is salon-scoped, but large salons can cause high memory/query cost. Add bounded pagination before pilot data grows.
8. Client create uses an in-memory rate limiter. This is an authenticated route, but its limit is per server process and should move to the database-backed limiter for consistent serverless behavior.

## Test and staging limits

The staging anon RLS/RPC integration suite ran with 8 passing tests, including direct HTTP/PostgREST permission-denied checks for revoked RPCs. Its two staff-auth tests were skipped because no dedicated staff credentials are configured. The staging concurrency test was not run: `.env.local` points at a different Supabase project, its service-role key was rejected by the confirmed staging project's read-only Auth admin endpoint, and `RUN_STAGING_BOOKING_TESTS` is not configured. No mutation-capable tests were run using those mismatched credentials.

The advisor snapshot was collected after the new migration and benchmark fixture cleanup. Security findings remaining: 4 RLS-no-policy informational notices, 1 extension-schema warning, and 3 authenticated SECURITY DEFINER warnings. The mutable search-path warning on `salon_set_updated_at` was fixed in the Phase 5 migration.
