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
- Vercel-managed Supabase project `clearpath-production` (`dcfldvtdrpukaojkpvzp`); daily database backup is observed, while isolated restore and Storage-object backup proof remain required.

## Input Contract

Copy `migration-templates/manifest.example.json` into `.migration-input/manifest.json`. Each entity file must be CSV or JSON and must have a stable `source_id`. Relationships use `source_<entity>_id` columns; the importer converts them to deterministic target UUIDs.

Use the handoff templates before creating the final manifest:

- `locations.example.csv`: exactly six approved houses with source IDs, addresses, bed/room structure, program, status, and local settings.
- `source-counts.example.csv`: source totals and SHA-256 for every house/entity export. Add rows for every required historical domain.
- `data-dictionary.example.csv`: Oath Track field meanings, formats, and coded values for every imported entity.
- `staff-roster.example.csv`: email, approved role, and house assignments. Never include passwords.
- `financial-totals.example.csv`: approved opening balance, charges, payments, adjustments, and closing balance for each house.
- `attachments.csv`: attachment lineage. Copy it beside the source files and add one row per file.
- `cutover-approvals.example.csv`: Slade plus one representative for each house. Set approval only after acceptance and retain timestamps.

Copy the examples into ignored `.migration-input/`; do not fill or commit them in `migration-templates/`.

Supported entities are locations, staff profiles, residents, resident contacts, bed assignments, resident documents, care-plan goals/tasks, medications/logs, incidents, shifts, resident fees, and resident payments. Add an explicit transformer and tests before importing any additional Oath Track domain.

The optional attachment manifest is CSV or JSON with:

```text
source_entity,source_id,path,file_name,mime_type
resident_documents,oath-document-123,attachments/photo-id.pdf,photo-id.pdf,application/pdf
```

Attachment paths must stay inside the manifest directory. Every attachment is hashed before import, and its stable identity, metadata, size, and checksum participate in the source record hash. Changing an attachment therefore conflicts with prior active lineage even when the CSV row is unchanged. Imported objects are uploaded beneath an organization/run-owned storage path, recorded in lineage, and removed only by rollback of that run.

## Commands

Inspection and validation are offline:

```bash
npm run migration:package-validate -- .migration-input/manifest.json --report .migration-output/source-package-validation.json
npm run migration:inspect -- .migration-input/manifest.json --report .migration-output/inspect.json
npm run migration:validate -- .migration-input/manifest.json --report .migration-output/validation.json
npm run migration:import -- .migration-input/manifest.json --report .migration-output/dry-run.json
```

The package-validation command independently reads the handoff and fails on altered checksums; missing required domains; blank or incorrect per-house/entity counts, including explicit zero counts; anything other than six mapped houses; incomplete field-level dictionary coverage; invalid staff assignments; missing document attachments; blank or unreconciled financial totals; or unapproved cutoff metadata. Confirmed import and reconciliation consume the exact in-memory dataset snapshot accepted by this validator. Its report proves package receipt only; it does not replace rehearsal reconciliation, restoration, production smoke testing, or human cutover approvals.

Confirmed database operations require server-only credentials. The signing key adds a verifiable HMAC to generated reports.

```bash
export SUPABASE_URL='[FILL: business Supabase URL]'
export SUPABASE_SERVICE_ROLE_KEY='[FILL: server-only service role key]'
export MIGRATION_REPORT_SIGNING_KEY='[FILL: migration report signing secret]'

npm run migration:import -- .migration-input/manifest.json --confirm --report .migration-output/import.json
npm run migration:reconcile -- .migration-input/manifest.json --run '[FILL: run UUID]' --report .migration-output/reconciliation.json
npm run migration:rollback -- --run '[FILL: run UUID]' --confirm --report .migration-output/rollback.json
```

An unchanged rerun skips previously imported source records. A changed row or attachment with the same source identity is a conflict and stops the run. New target rows use create-only inserts, so concurrent runs cannot both claim the same deterministic target ID and a failing run cannot compensate by deleting another run's row. Roll back the earlier run or correct the source identity; never bypass lineage manually.

## Cutover Gate

1. Reset an isolated Supabase database and apply all migrations.
2. Verify owner, manager, staff, resident, anonymous, and cross-house allow/deny cases.
3. Run the Playwright operator suite against that database with demo and authentication bypasses disabled.
4. Restore a backup into an isolated database and run reconciliation there.
5. Complete a scrubbed rehearsal using the final file layout and attachment manifest.
6. Freeze Oath Track edits at `[FILL: cutoff timestamp]` and record source totals.
7. Run one confirmed import for all six houses.
8. Require reconciliation with no missing rows, duplicate source IDs, orphaned references, failed files, or unexplained financial differences.
9. Provision users through staff invitations; do not migrate passwords.
10. Promote only the Git-backed Vercel preview built from the accepted commit.
11. Record approval from Slade and `[FILL: one representative per house]`.

## Backup And Recovery

Before cutover, create a provider backup and a logical database dump, then restore into an isolated project. Back up Storage objects separately because Supabase database backups contain Storage metadata but not the objects themselves. Record the database backup identifier, object-manifest checksum, dump checksum, restore target, start/end time, operator, and reconciliation report under `.migration-output/`. A backup is not accepted until its database and required objects have both been restored successfully.

The restore target is destructive and must be an isolated database. Before `pg_dump` or `pg_restore`, the command queries both databases for PostgreSQL's server system identifier and database OID. It refuses the operation when those database-reported identities match, including when direct and pooler URLs use different hosts:

```bash
export SOURCE_DATABASE_URL='[FILL: source Postgres URL]'
export RESTORE_DATABASE_URL='[FILL: isolated restore Postgres URL]'
npm run operations:restore-drill -- \
  --run '[FILL: completed migration run UUID]' \
  --dump .migration-output/clearpath-backup.dump \
  --reconciliation-report .migration-output/reconciliation.json \
  --storage-manifest .migration-output/storage-restore-manifest.json \
  --source-storage-dir .migration-output/source-storage \
  --restored-storage-dir .migration-output/restored-storage \
  --report .migration-output/restore-drill.json
```

The reconciliation report is mandatory. It must include `runId` and `packageSha256` for the same requested run and validated source package. Its expected and imported totals must match the completed run's recorded totals and imported lineage on the restored database identified by `RESTORE_DATABASE_URL`. The drill independently reads every restored target row across all supported migration tables and compares each normalized field to restored lineage; a stale report, missing row, or changed value fails even when counts match. A bare `{ "ok": true }` report is rejected.

The Storage restore manifest is also mandatory and must list exact database object identities. Place the authoritative backed-up objects and separately downloaded restored objects beneath the two supplied directories using `<bucket>/<storage path>`. The command reads both trees and computes their SHA-256 values itself; do not put caller-supplied checksums in the manifest.

```json
{
  "runId": "[FILL: same migration run UUID]",
  "objects": [
    {
      "bucket": "resident-documents",
      "path": "[FILL: organization]/migrations/[FILL: original import run UUID]/[FILL: object]"
    }
  ]
}
```

The drill fails unless the manifest identities exactly match the requested run's active database references, every independently read source/restored byte hash matches, and the object totals equal both the run references and `storage.objects` rows on the restored target. The report contains sanitized URLs, database-reported source/target identities, the validated package hash, dump SHA-256, timestamps, exact database/object totals, and computed evidence checksums. It never records database credentials.

## Release Health And Readiness

Deploy the `health` Supabase Edge Function, then verify both the Vercel application shell and database connectivity:

```bash
export CLEARPATH_APP_URL='[FILL: accepted Vercel deployment URL]'
export CLEARPATH_HEALTH_URL='[FILL: Supabase health function URL]'
export CLEARPATH_HEALTH_ANON_KEY='[FILL: publishable key, when required]'
npm run operations:health -- --report .migration-output/health.json
```

Copy `migration-templates/readiness-evidence.example.json` to `.migration-output/readiness-evidence.json` and replace every placeholder with observed evidence. Keep `sourcePackageManifest` pointed at the manifest inside `.migration-input`. Keep the technical verification, reconciliation, restore, and health reports beside the readiness file, record their exact SHA-256 values, and use relative paths that remain inside that directory. The cutover command recomputes each artifact hash, reopens and validates the live package, and binds all four reports to one full 40-character canonical commit, migration package hash, Supabase backend target, migration run where applicable, application/health URLs, and ordered timestamps.

RLS, private Storage, public intake, staff access, and automated checks are accepted only from `technical-verification.json`; fields such as `technical.rlsVerified: true` have no authority. Build the artifact from the exact accepted check outputs using schema version 1 and this fixed contract:

```json
{
  "schemaVersion": 1,
  "artifactType": "clearpath-technical-verification",
  "startedAt": "[FILL: ISO-8601 start after source-package validation]",
  "completedAt": "[FILL: ISO-8601 completion before reconciliation]",
  "bindings": {
    "canonicalCommit": "[FILL: exact 40-character accepted Git commit]",
    "projectRef": "[FILL: exact business-owned Supabase project ref]",
    "packageSha256": "[FILL: exact validated migration package SHA-256]",
    "packageValidatedAt": "[FILL: checkedAt from the accepted package-validation report]"
  },
  "checks": [
    { "id": "rls-role-cross-house", "result": "passed", "checkedAt": "[FILL: ISO-8601]" },
    { "id": "private-storage-access", "result": "passed", "checkedAt": "[FILL: ISO-8601]" },
    { "id": "public-intake", "result": "passed", "checkedAt": "[FILL: ISO-8601]" },
    { "id": "staff-access", "result": "passed", "checkedAt": "[FILL: ISO-8601]" },
    { "id": "automated-checks", "result": "passed", "checkedAt": "[FILL: ISO-8601]" }
  ]
}
```

All five identities must appear exactly once, in the listed order, and pass. `packageValidatedAt` must precede the artifact start; check timestamps must be valid, monotonic, and inside the artifact start/completion interval; and technical verification must precede reconciliation. The readiness command revalidates the package at runtime and requires the recomputed package SHA-256 to match the artifact binding, rather than incorrectly requiring a previously written artifact to follow that new runtime timestamp. A missing file, changed byte, stale timestamp, failed/renamed/duplicate/reordered check, short or mismatched commit, backend mismatch, package mismatch, or wrong schema fails closed.

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
