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

The source files for those replaced versions were removed from this directory. Existing databases may have the old versions in their migration history; the consolidated baseline is not a migration to replay on them. Reconcile migration history with the database owner before applying pending migrations. No hosted database was changed as part of this squash.
