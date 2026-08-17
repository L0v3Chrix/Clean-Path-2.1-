# Six-House Migration PDR Status

Status date: 2026-08-16

This file separates repository completion from cutover completion. A green build or deployment is not proof that source data, a production backend, reconciliation, restoration, or human approval exists.

## Observed Handoff State

- Draft PR: `L0v3Chrix/Clean-Path-2.1-#1` from `codex/six-house-migration-readiness`.
- GitHub Actions run `31990268208` passes application verification, clean-database migrations, the database/browser acceptance matrix, and the Vercel preview build on implementation commit `6bfa01dbbd46959d2231efb621168a83c0690b2a`.
- The current local candidate passes 51 test files with 467 tests, lint, type checking, production build, a clean 15-migration database reset, all four role/house/audit/security/onboarding SQL suites, and 17 real-browser operator workflows. The refreshed production dependency audit reports zero high or critical findings and two accepted moderate React Router advisories.
- Vercel Supabase resource `clearpath-production` is attached to `clearpath-rcl-mvp` Preview and Production. Git-backed preview `clearpath-rcl-e5xvzncyu-enterweb-guru.vercel.app` is Ready, GitHub deployment `5938310508` binds to the exact implementation commit, renders the protected-workspace login, and compiles with both `VITE_AUTH_BYPASS=false` and `VITE_CLEARPATH_DEMO_MODE=false`.
- Live verification on 2026-08-16 confirms all 15 repository migrations through `20260817120000_resident_portal_access_hardening` in the Supabase ledger. The onboarding/claim/invitation tables, owner/admin capability split, RPC-only access-management writes, resident/location document binding, audited protected-document access, house and resident RLS, audit immutability, staff assignment transaction, resident-login uniqueness, terminal signature protection, and sample-cleanup safeguards are deployed.
- Six Edge Functions are deployed: `health`, `public-intake`, `invite-staff`, `invite-resident`, `document-access`, and `critical-incident-notify`. `invite-staff` was refreshed to the single-use activation flow; `invite-resident` and `document-access` were deployed with JWT verification enabled. Production-only redirect/public-URL settings are stored as Edge Function secrets, not in Git.
- The health endpoint returns HTTP 200 and public-intake preflight returns HTTP 200. Unauthenticated staff invitation, resident invitation, protected-document access, and incident notification POSTs each return HTTP 401.
- The production tenant still contains one organization, one Auth user, one active membership, and one active Owner, with zero account claims, zero user invitations, and no resident login bound. No invitation was sent and no user was provisioned during deployment.
- Supabase Auth uses the stable production URL and an explicit three-entry redirect allow list for production, the migration branch preview, and local development. Open email sign-up and anonymous sign-in are disabled; email confirmation remains required.
- Daily physical database backups dated 2026-08-15 and 2026-08-16 are available; the latest observed pre-hardening backup is `2026-08-16 11:55:11 UTC`. Supabase database backups exclude Storage objects, and an isolated restore plus separate object-backup proof is still required before cutover.
- Vercel production is still the older deployment. Production environment flags have been set to false, but no production promotion is allowed until the remaining cutover gates pass.
- The sibling public website labels six listings `RCL One` through `RCL Six`, but its two house-data files disagree on gender mix, capacity, occupancy, and pricing and provide no approved addresses or Oath Track counts. These are candidate display labels only, not an accepted migration roster.

## Repository-Owned Work

- [x] Canonical baseline preserved on a feature branch and divergent upstream left unmerged.
- [x] Supabase schema covers organization membership, house assignments, migration lineage, and public-intake tokens.
- [x] House- and resident-scoped RLS replaces broad organization-only access for beta workflows.
- [x] Staff invitation links imported staff profiles by organization-scoped email or explicit profile ID, assigns roles/houses, and supports password recovery without migrating passwords.
- [x] Owner/Admin privilege tiers, operational roles, house assignments, resident routes, resident self-service capabilities, chat, chores, and audit immutability have database allow/deny coverage in the local candidate.
- [x] Exited or deactivated residents lose linked read/write access, one Auth user cannot bind to multiple residents, and terminal signature responses cannot be rewritten.
- [x] Only an Owner may grant Owner access; Admins may grant peer Admin access, and operational role and house changes use one transactional server operation.
- [x] Pre-authorized first-administrator account claim for a new empty organization plus versioned, resumable role-specific walkthrough UI and progress persistence are implemented in the local candidate; completing the underlying setup actions remains an external acceptance gate.
- [x] Resident invitations bind one login to one approved resident record and start a resident-specific walkthrough in the local candidate.
- [x] Public intake uses an opaque token, server-side validation, private attachments, and truthful background-check status.
- [x] Oath Track migration commands support inspect, validate, dry run, import, reconciliation, rerun idempotency, attachment lineage, and rollback.
- [x] Source-package validation independently verifies six houses, source counts, SHA-256 checksums, dictionary coverage, staff assignments, attachment paths, and cutoff metadata before rehearsal.
- [x] Source-package acceptance requires all 14 beta domains, explicit per-house zero counts, field-level dictionary coverage, approved financial reconciliation, and live revalidation at the cutover gate.
- [x] Migration reconciliation verifies rerun lineage, target-row values, attachment existence/checksums, fee/payment totals, and an exact zero-variance matrix for all six source house IDs rather than trusting organization-wide counts alone.
- [x] Migration, release, technical, restore, final-health, and human-approval artifacts require canonical HMACs; readiness rejects unsigned, invalid, stale, or tampered evidence.
- [x] Restore drills compare database-reported server/database identities, restored target-row values, run/package-bound reconciliation, and restored Storage identities/checksums; a database-only, stale, or bare-success report fails closed.
- [x] Unconfigured email, AI, extraction, and provider integrations cannot report delivery, generated output, or a verified connection.
- [x] Critical-incident alerts are organization/location scoped, omit incident details, and deep-link only to an incident already returned by authorized RLS queries.
- [x] Sensitive browser speech transcription is disabled and private e-signature documents use expiring audited URLs.
- [x] Confirmed imports use the validator's exact dataset snapshot, create targets without overwrite semantics, and compensate only rows/objects proven to be created by that run while retaining failed audit evidence.
- [x] Sensitive mutations, protected document access, and CSV exports are audited.
- [x] Operational exports exist for houses/beds, staff, residents/contacts, documents, medications/logs, incidents, schedules, and care plans.
- [x] Privacy-minimized application error events and a database-backed health endpoint are implemented.
- [x] Backup/restore and fail-closed cutover-readiness commands bind computed artifact hashes, signed machine-derived preview/production Vercel deployment evidence, exact commit/backend/package identity, run identity where applicable, fixed check identities/results, final production health, and signed house-specific approvals in order.
- [x] RLS, private Storage, public intake, staff access, and automated-check gates ignore caller-edited booleans and require a schema-versioned technical verification artifact whose bytes match the declared SHA-256.
- [x] Pull-request CI runs tests, lint, type checking, production build, dependency threshold, clean database migrations, the RLS acceptance matrix, and real-browser operator workflows with both bypass flags disabled.
- [x] Synthetic migration import, unchanged rerun, reconciliation, rollback, and reimport have been exercised locally.
- [x] Local database tests cover owner, assigned staff, resident, anonymous, cross-house, core-workflow, audit, export, and cascading-delete behavior.
- [x] Playwright covers invitation-only account entry, persisted desktop/mobile onboarding, authenticated resident/contact creation, tenant-owned house creation/editing, shift creation/editing, care-plan goal/task creation and updates, bed assignment, medication dose logging, incident creation/status handling, private staff and resident document access, authorized export, anonymous public-intake submission with a private attachment, consent, and signature, real emailed resident account acceptance, staff password recovery, resident route boundaries, and sign-out against local Supabase with no console or page errors.

## External Cutover Gates

- [ ] `main`, accepted preview, and production are aligned to the same approved commit.
- [ ] Six named houses, addresses, beds/rooms, settings, and approved source counts are supplied.
- [ ] Complete Oath Track exports, data dictionary, attachment archive/manifest, history cutoff, and financial totals are supplied.
- [ ] Staff roster with roles and house assignments is approved.
- [x] Business-owned Vercel-managed Supabase project is provisioned; all 15 repository migrations, Auth, private Storage, and six Edge Functions are deployed and structurally verified.
- [x] Production tenant, migration ledger, and authentication URL allow list are verified.
- [x] The release candidate's empty-account first-administrator claim, onboarding progress, peer-Admin, resident-access, and audited document-access migrations/functions are deployed and verified live without sending an invitation. The current production organization already has an Owner, so its empty-account claim path is intentionally ineligible.
- [x] Accepted preview compiles `VITE_AUTH_BYPASS=false` and `VITE_CLEARPATH_DEMO_MODE=false` against the new Supabase project.
- [ ] Production is promoted from the accepted Git commit and both bypass flags are re-observed on that deployment.
- [ ] A fresh technical verification artifact for the exact accepted 40-character commit, production Supabase project, and final source-package SHA-256 records all five required checks passing in order.
- [ ] The existing approved Owner completes Owner onboarding, invites the first approved Account Admin through the staff invitation flow, and that Admin completes onboarding before either account invites the remaining approved management team with accepted roles and house assignments.
- [ ] Approved residents receive separately bound portal invitations and pass resident capability acceptance.
- [ ] Scrubbed rehearsal using the final Oath Track package passes reconciliation and operator acceptance.
- [ ] Provider backup plus logical dump is restored into an isolated database and reconciled.
- [ ] Final freeze, all-six-house import, file reconciliation, user provisioning, and production smoke check pass.
- [ ] Slade and one named representative from each exact source house approve after final health in the signed cutover-approval artifact.

The authoritative final answer is generated by `npm run readiness:check`; until it returns `ready: true`, ClearPath is not approved for the six-house cutover.
