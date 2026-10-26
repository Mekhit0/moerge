# Migration history

`20261026112309_baseline.sql` consolidates the former versions below for fresh databases:

- `20261016000001`: initial schema and reminder RPCs
- `20261016000002`: removed demo-user seed; local demo records are in `supabase/seed.sql`
- `20261016000003`: cron schedule template
- `20261016000004`: public booking schema and RPCs
- `20261016000005`: availability and conflict handling
- `20261016000006`: timezone and delivery updates
- `20261016000007`: salon registration and membership updates
- `20261016000008`: live delivery updates
- `20261016000009`: custom services and templates
- `20261016000010`: client creation metadata
- `20261016000011`: previous security hardening

The former Phase 0 source version `20261026104942` was replaced by `20261026112314_phase0_security_hardening.sql` while the migration set was reordered.

Phase 2 booking migrations add the multi-staff relational model and booking RPCs:

- `20261026114009_restrict_cron_setup_rpc.sql`: restricts cron setup RPC access.
- `20261026114315_phase2_staff_booking_core.sql`: staff, services, schedules, resources, appointment snapshots, availability, and atomic appointment creation.
- `20261026115928_phase2_booking_rpc_access_fix.sql`: RPC access and public booking compatibility.
- `20261026145024_phase2_staff_admin_policies_dst.sql`: management policies and timezone-aware availability.
- `20261026145316_phase2_optional_email_consent.sql`: optional booking email consent.
- `20261026145630_phase2_signup_booking_defaults.sql`: starter staff, service, and schedules for new salons.
- `20261026145931_phase2_dst_duration_math.sql`: elapsed-time duration math across DST transitions.
- `20261026150216_phase2_drop_legacy_service_catalog.sql`: replaces JSONB catalog use and drops `salon_settings.custom_services`.

Phase 3 communications migrations add normalized phone identity and the notification outbox:

- `20261026151152_phase3_notifications_and_phone_identity.sql`: channel consent, templates, notification log/outbox, unsubscribe, client self-service and delivery worker RPCs.
- `20261026152927_phase3_service_role_booking_fix.sql`: removes an unreliable JWT claim check from the service-role booking RPC; execution remains restricted to `service_role`.
- `20261026153400_phase3_booking_digest_search_path.sql`: includes the `extensions` schema in the booking RPC search path for the email rate-limit hash function.

The source files for those replaced versions were removed from this directory. Existing databases may have the old versions in their migration history; the consolidated baseline is not a migration to replay on them. Reconcile migration history with the database owner before applying pending migrations. Phase 0, Phase 2, and Phase 3 migrations were applied to the explicitly designated staging project only; production was not changed.
