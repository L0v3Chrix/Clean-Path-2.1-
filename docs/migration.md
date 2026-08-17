# Six-House Migration Runbook

This runbook governs a single coordinated migration from Oath Track into ClearPath. Source exports, attachments, credentials, and generated reports belong under ignored `.migration-input/` and `.migration-output/` directories. Never commit resident data or secrets.

## Required Inputs

Do not begin a confirmed import until these items are complete:

- `[FILL: HOUSE_1_NAME]` through `[FILL: HOUSE_6_NAME]`, addresses, rooms/beds, status, and local settings.
- `[FILL: OATH_TRACK_EXPORT_FILES_AND_FORMATS]` and the matching data dictionary.
- `[FILL: SOURCE_COUNTS_BY_HOUSE_AND_ENTITY]` captured at the agreed cutoff.
- `[FILL: STAFF_USER_ROSTER_WITH_ROLE_AND_HOUSE_ASSIGNMENTS]`.
- `[FILL: APPROVED_FIRST_ADMIN_EMAIL_AND_ACCOUNT_CLAIM]`.
- `[FILL: RESIDENT_PORTAL_INVITATION_ROSTER]`, with one approved user identity per resident record.
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

## Account Onboarding And Roles

The approved onboarding contract is invitation-only. A single-use, expiring, pre-authorized account claim creates the first account user as `admin` by default; public sign-up cannot claim an empty organization. The first administrator is guided through organization details, the six houses, management invitations, roles, and house assignments as part of the versioned role walkthrough. Completion of the underlying business setup is verified separately at the cutover gate; viewing a walkthrough step is not evidence that its action occurred. An explicitly authorized business provisioning operation may still create an initial `owner`, but no browser workflow can grant that role implicitly.

The canonical internal roles are `owner`, `admin`, `director`, `house_manager`, `case_manager`, `peer_support`, and `staff`. Only an Owner may grant or manage `owner`; an Admin may grant peer `admin` access and manage non-owner users. Location-scoped roles require at least one assigned house. Resident access is provisioned separately and binds the invited user to exactly one approved `residents.user_id`; it is never created through the Staff invitation workflow.

Resident capability is limited to the resident portal, the home-house schedule, permitted house chat, assigned chores, personal reflections, assigned signatures, read-only self records, and resident documents explicitly marked `resident_and_staff`. Residents cannot modify clinical, medication, financial, incident, secure-document, staff-review, staff-assignment, storage-object, or other residents' records.

| Role | Effective scope and capability |
|---|---|
| Owner | Organization-wide operations, account administration, peer Owners and Admins, and the protected Owner boundary |
| Admin | Organization-wide operations, team invitations, peer Admins, operational role assignment, and house assignment; cannot create or manage Owners |
| Director | Organization-wide operational data and workflows; no Owner or Admin identity authority |
| House Manager | Operational management for explicitly assigned houses |
| Case Manager | Resident care and documentation for explicitly assigned houses |
| Peer Support | Limited resident support, chat, and training for explicitly assigned houses |
| Staff | Standard operational access for explicitly assigned houses |
| Resident | One linked resident record and the bounded resident-facing capabilities above |

The required first-account operating sequence is:

1. Validate a single-use, expiring, pre-authorized account claim for the named organization and email address; create the first membership as `admin` only after the claim succeeds.
2. Capture the organization profile and require the six approved houses, including names, addresses, status, and room/bed structure.
3. Invite the management team, choosing one canonical role per person and explicit house assignments for every location-scoped role.
4. Review organization-wide users, house-scoped users, pending invitations, and the capabilities each role receives; record the first administrator's confirmation in the cutover acceptance evidence.
5. Use the versioned, resumable guided walkthrough tailored to the signed-in role. Progress is stored per user, can be dismissed and replayed, and never grants access or reports an action merely because a walkthrough step was viewed.

The implemented versioned walkthroughs are:

- Owner/Admin: organization and houses, bed capacity, team invitations and access review, resident intake, medication/document/incident safeguards, exports, and audit review.
- Director: organization-wide operational dashboard, houses, residents, staffing, compliance, incidents, outcomes, and exports without identity-administration authority.
- House Manager/Case Manager/Peer Support/Staff: assigned-house dashboard, shift handoff, resident workflow, chores, care plans, medications, incidents, and document boundaries according to role.
- Resident: personal portal, assigned chores, permitted house chat, reflections, signatures, and the boundary between self-service and staff-managed records.

The walkthrough implementation is accepted only when the claim is auditable, refresh/resume works, invitation and role changes pass database allow/deny tests, no open signup can create or seize an organization, and each role's walkthrough is browser-tested at desktop and mobile widths. The six-house setup and management access review remain separate human cutover gates.

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

Confirmed database operations require server-only credentials. `MIGRATION_REPORT_SIGNING_KEY` is mandatory for confirmed imports, reconciliation, and rollback. `CLEARPATH_EVIDENCE_SIGNING_KEY` signs release, technical-verification, restore, and final-health evidence. `CUTOVER_APPROVAL_SIGNING_KEY` separately signs the final human acceptance record. Generate and store all three outside Git; each report receives a canonical HMAC so field-order changes do not alter the signature and later tampering fails cutover validation.

```bash
export SUPABASE_URL='[FILL: business Supabase URL]'
export SUPABASE_SERVICE_ROLE_KEY='[FILL: server-only service role key]'
export MIGRATION_REPORT_SIGNING_KEY='[FILL: migration report signing secret]'
export CLEARPATH_EVIDENCE_SIGNING_KEY='[FILL: operational evidence signing secret]'
export CUTOVER_APPROVAL_SIGNING_KEY='[FILL: cutover approval signing secret]'

npm run migration:import -- .migration-input/manifest.json --confirm --report .migration-output/import.json
npm run migration:reconcile -- .migration-input/manifest.json --run '[FILL: run UUID]' --report .migration-output/reconciliation.json
npm run migration:rollback -- --run '[FILL: run UUID]' --confirm --report .migration-output/rollback.json
```

An unchanged rerun skips previously imported source records. A changed row or attachment with the same source identity is a conflict and stops the run. New target rows use create-only inserts, so concurrent runs cannot both claim the same deterministic target ID and a failing run cannot compensate by deleting another run's row. Roll back the earlier run or correct the source identity; never bypass lineage manually. Reconciliation reports include an exact matrix for the six source house IDs with expected, actual, and variance counts by entity and status, attachment totals, fee/payment/balance totals, and house-scope mismatches. Any nonzero variance or scope mismatch fails the run.

## Cutover Gate

1. Reset an isolated Supabase database and apply all migrations.
2. Verify owner, manager, staff, resident, anonymous, and cross-house allow/deny cases.
3. Run the Playwright operator suite against that database with demo and authentication bypasses disabled.
4. Restore a backup into an isolated database and run reconciliation there.
5. Complete a scrubbed rehearsal using the final file layout and attachment manifest.
6. Freeze Oath Track edits at `[FILL: cutoff timestamp]` and record source totals.
7. Run one confirmed import for all six houses.
8. Require both organization-wide and per-house reconciliation with no missing rows, duplicate source IDs, orphaned references, failed files, scope mismatches, attachment differences, or unexplained financial differences.
9. Provision the approved Owner, management/staff invitations, and separately bound resident invitations; do not migrate passwords.
10. Promote only the Git-backed Vercel preview built from the accepted commit.
11. Collect signed production-release evidence, then run the final application/backend health check.
12. Record signed approval from Slade and `[FILL: one representative per house]` only after final health passes.

## Backup And Recovery

Before cutover, create a provider backup and a logical database dump, then restore into an isolated project. Back up Storage objects separately because Supabase database backups contain Storage metadata but not the objects themselves. Record the database backup identifier, object-manifest checksum, dump checksum, restore target, start/end time, operator, and reconciliation report under `.migration-output/`. A backup is not accepted until its database and required objects have both been restored successfully.

The restore target is destructive and must be an isolated database. Before `pg_dump` or `pg_restore`, the command queries both databases for PostgreSQL's server system identifier and database OID. It refuses the operation when those database-reported identities match, including when direct and pooler URLs use different hosts:

```bash
export SOURCE_DATABASE_URL='[FILL: source Postgres URL]'
export RESTORE_DATABASE_URL='[FILL: isolated restore Postgres URL]'
export CLEARPATH_EVIDENCE_SIGNING_KEY='[FILL: operational evidence signing secret]'
npm run operations:restore-drill -- \
  --run '[FILL: completed migration run UUID]' \
  --dump .migration-output/clearpath-backup.dump \
  --reconciliation-report .migration-output/reconciliation.json \
  --storage-manifest .migration-output/storage-restore-manifest.json \
  --source-storage-dir .migration-output/source-storage \
  --restored-storage-dir .migration-output/restored-storage \
  --report .migration-output/restore-drill.json
```

The signed reconciliation report is mandatory. It must include a valid HMAC made with `MIGRATION_REPORT_SIGNING_KEY`, `runId`, and `packageSha256` for the same requested run and validated source package. Its expected and imported totals must match the completed run's recorded totals and imported lineage on the restored database identified by `RESTORE_DATABASE_URL`. The drill independently reads every restored target row across all supported migration tables and compares each normalized field to restored lineage; a missing/invalid signature, stale report, missing row, or changed value fails even when counts match. A bare `{ "ok": true }` report is rejected.

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

Deploy the `health` and `critical-incident-notify` Supabase Edge Functions. Run this final health collection only after the accepted Git deployment has been promoted to production; it verifies the production application shell, database connectivity, and the incident function's anonymous-access boundary:

```bash
export CLEARPATH_APP_URL='[FILL: accepted Vercel deployment URL]'
export CLEARPATH_HEALTH_URL='[FILL: Supabase health function URL]'
export CLEARPATH_HEALTH_ANON_KEY='[FILL: publishable key, when required]'
export CLEARPATH_EVIDENCE_SIGNING_KEY='[FILL: operational evidence signing secret]'
npm run operations:health -- --report .migration-output/health.json

test "$(curl -sS -o /dev/null -w '%{http_code}' \
  -X POST 'https://dcfldvtdrpukaojkpvzp.supabase.co/functions/v1/critical-incident-notify' \
  -H 'Content-Type: application/json' \
  --data '{"incident_id":"00000000-0000-4000-8000-000000000000"}')" = "401"
```

Keep JWT verification enabled. Without an approved email provider, an authorized request must report `providerConfigured: false`, `deliveredCount: 0`, and no resident or incident details; deployment alone is not evidence that an alert was delivered.

Every Vite deployment emits `/clearpath-release.json` with the exact Git commit, compiled demo/auth flags, and public Supabase project ref. From a clean checkout of the accepted commit, collect preview evidence first and production evidence only after promotion:

```bash
export CLEARPATH_EVIDENCE_SIGNING_KEY='[FILL: operational evidence signing secret]'
npm run release:evidence -- --preview --report .migration-output/preview-release.json
npm run release:evidence -- --report .migration-output/production-release.json
```

The command queries the bound Vercel project, selects the latest deployment for the explicit environment, requires `READY` Git metadata for the current full `HEAD`, reads the exact deployment's protected release file through Vercel, and signs the report. Preview inspection requires `--preview`; production is the fail-closed default. A dirty worktree, wrong project or commit, non-ready deployment, malformed release file, missing backend identity, or unavailable signing key fails without printing raw Vercel metadata or account details. Readiness independently hashes and verifies both reports; handwritten preview/production commit or flag fields have no authority.

Copy `migration-templates/readiness-evidence.example.json` to `.migration-output/readiness-evidence.json` and replace every placeholder with observed evidence. Keep `sourcePackageManifest` pointed at the manifest inside `.migration-input`. Keep the preview release, technical verification, reconciliation, restore, production release, final health, and cutover approval reports beside the readiness file, record their exact SHA-256 values, and use relative paths that remain inside that directory. The cutover command recomputes each artifact hash, verifies every HMAC, reopens and validates the live package, and binds all seven reports to one full 40-character canonical commit, Vercel project, migration package hash, Supabase backend target, migration run where applicable, application/health URLs, production deployment, and ordered timestamps.

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

Sign the completed technical artifact with the operational evidence key:

```bash
npm run evidence:sign -- \
  .migration-output/technical-verification.unsigned.json \
  --report .migration-output/technical-verification.json
```

All five identities must appear exactly once, in the listed order, and pass. `packageValidatedAt` must precede the artifact start; check timestamps must be valid, monotonic, and inside the artifact start/completion interval. The full artifact order is preview release, technical verification, reconciliation, isolated restore, production release, final health, then cutover approvals. Complete `migration-templates/cutover-approvals.example.json` only after final health, then sign it separately:

```bash
npm run evidence:sign -- \
  .migration-output/cutover-approvals.unsigned.json \
  --report .migration-output/cutover-approvals.json \
  --key-env CUTOVER_APPROVAL_SIGNING_KEY
```

The approvals report must identify Slade and exactly one named representative for each source house, bind the accepted commit, migration run/package, and production deployment ID, and contain approval times no earlier than final health. The readiness command revalidates the package at runtime and requires the recomputed package SHA-256 to match the artifact binding, rather than incorrectly requiring a previously written artifact to follow that new runtime timestamp. A missing file, changed byte, invalid HMAC, stale timestamp, failed/renamed/duplicate/reordered check, short or mismatched commit, Vercel project drift, backend mismatch, package mismatch, wrong approval identity, or wrong schema fails closed.

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
