# Six-House Migration Runbook

This runbook governs a single coordinated migration from Oath Track into ClearPath. Source exports, attachments, credentials, and generated reports belong under ignored `.migration-input/` and `.migration-output/` directories. Never commit resident data or secrets.

## Required Inputs

Do not begin a confirmed import until these items are complete:

- `[FILL: HOUSE_1_NAME]` through `[FILL: HOUSE_6_NAME]`, addresses, rooms/beds, status, and local settings.
- `[FILL: OATH_TRACK_EXPORT_FILES_AND_FORMATS]` and the matching data dictionary.
- `[FILL: SOURCE_COUNTS_BY_HOUSE_AND_ENTITY]` captured at the agreed cutoff.
- `[FILL: STAFF_USER_ROSTER_WITH_ROLE_AND_HOUSE_ASSIGNMENTS]`.
- `[FILL: DOCUMENT_AND_ATTACHMENT_ARCHIVE_WITH_SOURCE_IDS]`.
- `[FILL: RECORD_HISTORY_CUTOFF_AND_REQUIRED_HISTORICAL_DOMAINS]`.
- `[FILL: REQUIRED_FINANCIAL_BALANCES_AND_PAYMENT_HISTORY]`.
- `[FILL: BUSINESS_OWNED_SUPABASE_PROJECT]` with backups and restore access verified.

## Input Contract

Copy `migration-templates/manifest.example.json` into `.migration-input/manifest.json`. Each entity file must be CSV or JSON and must have a stable `source_id`. Relationships use `source_<entity>_id` columns; the importer converts them to deterministic target UUIDs.

Use the handoff templates before creating the final manifest:

- `locations.example.csv`: exactly six approved houses with source IDs, addresses, bed/room structure, program, status, and local settings.
- `source-counts.example.csv`: source totals and SHA-256 for every house/entity export. Add rows for every required historical domain.
- `staff-roster.example.csv`: email, approved role, and house assignments. Never include passwords.
- `attachments.csv`: attachment lineage. Copy it beside the source files and add one row per file.
- `cutover-approvals.example.csv`: Slade plus one representative for each house. Set approval only after acceptance and retain timestamps.

Copy the examples into ignored `.migration-input/`; do not fill or commit them in `migration-templates/`.

Supported entities are locations, staff profiles, residents, resident contacts, bed assignments, resident documents, care-plan goals/tasks, medications/logs, incidents, shifts, resident fees, and resident payments. Add an explicit transformer and tests before importing any additional Oath Track domain.

The optional attachment manifest is CSV or JSON with:

```text
source_entity,source_id,path,file_name,mime_type
resident_documents,oath-document-123,attachments/photo-id.pdf,photo-id.pdf,application/pdf
```

Attachment paths must stay inside the manifest directory. Every attachment is hashed before import, uploaded beneath an organization/run-owned storage path, recorded in lineage, and removed only by rollback of that run.

## Commands

Inspection and validation are offline:

```bash
npm run migration:inspect -- .migration-input/manifest.json --report .migration-output/inspect.json
npm run migration:validate -- .migration-input/manifest.json --report .migration-output/validation.json
npm run migration:import -- .migration-input/manifest.json --report .migration-output/dry-run.json
```

Confirmed database operations require server-only credentials. The signing key adds a verifiable HMAC to generated reports.

```bash
export SUPABASE_URL='[FILL: business Supabase URL]'
export SUPABASE_SERVICE_ROLE_KEY='[FILL: server-only service role key]'
export MIGRATION_REPORT_SIGNING_KEY='[FILL: migration report signing secret]'

npm run migration:import -- .migration-input/manifest.json --confirm --report .migration-output/import.json
npm run migration:reconcile -- .migration-input/manifest.json --run '[FILL: run UUID]' --report .migration-output/reconciliation.json
npm run migration:rollback -- --run '[FILL: run UUID]' --confirm --report .migration-output/rollback.json
```

An unchanged rerun skips previously imported source records. A changed row with the same source identity is a conflict and stops the run. Roll back the earlier run or correct the source identity; never bypass lineage manually.

## Cutover Gate

1. Reset an isolated Supabase database and apply all migrations.
2. Verify owner, manager, staff, resident, anonymous, and cross-house allow/deny cases.
3. Restore a backup into an isolated database and run reconciliation there.
4. Complete a scrubbed rehearsal using the final file layout and attachment manifest.
5. Freeze Oath Track edits at `[FILL: cutoff timestamp]` and record source totals.
6. Run one confirmed import for all six houses.
7. Require reconciliation with no missing rows, duplicate source IDs, orphaned references, failed files, or unexplained financial differences.
8. Provision users through staff invitations; do not migrate passwords.
9. Promote only the Git-backed Vercel preview built from the accepted commit.
10. Record approval from Slade and `[FILL: one representative per house]`.

## Backup And Recovery

Before cutover, create a provider backup and a logical database dump, then restore into an isolated project. Record the backup identifier, dump checksum, restore target, start/end time, operator, and reconciliation report under `.migration-output/`. A backup is not accepted until its restore has succeeded.

The restore target is destructive and must be an isolated database. The command refuses to run when the source and restore host/database identity match:

```bash
export SOURCE_DATABASE_URL='[FILL: source Postgres URL]'
export RESTORE_DATABASE_URL='[FILL: isolated restore Postgres URL]'
npm run operations:restore-drill -- \
  --dump .migration-output/clearpath-backup.dump \
  --reconciliation-report .migration-output/reconciliation.json \
  --report .migration-output/restore-drill.json
```

The report contains sanitized database identities, the dump SHA-256, timestamps, restored migration-run count, and reconciliation status. It never records database credentials.

## Release Health And Readiness

Deploy the `health` Supabase Edge Function, then verify both the Vercel application shell and database connectivity:

```bash
export CLEARPATH_APP_URL='[FILL: accepted Vercel deployment URL]'
export CLEARPATH_HEALTH_URL='[FILL: Supabase health function URL]'
export CLEARPATH_HEALTH_ANON_KEY='[FILL: publishable key, when required]'
npm run operations:health -- --report .migration-output/health.json
```

Copy `migration-templates/readiness-evidence.example.json` to `.migration-output/readiness-evidence.json` and replace every placeholder with observed evidence. The cutover command fails until all six houses, external inputs, technical gates, matching Git commits, restore proof, smoke check, and seven approvals are complete:

```bash
npm run readiness:check -- \
  .migration-output/readiness-evidence.json \
  --report .migration-output/readiness-result.json
```

Do not manually change a failed readiness result. Correct the underlying evidence and rerun the command.

## Dependency Decision

Production dependencies currently have no known high or critical audit finding. Two moderate React Router 6 advisories remain accepted for the beta branch because the available fix requires a React Router 7 major-version migration. Complete that upgrade in a separately tested pull request; rerun `npm audit --omit=dev` before cutover and reject any new high or critical runtime finding.

## External Gates

Email, background checks, payments, QuickBooks, Twilio, and AI extraction remain disabled unless an approved provider and credentials are supplied. Public intake records background-check consent only; it does not claim or initiate a screening.
