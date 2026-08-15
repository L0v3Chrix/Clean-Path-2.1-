# Six-House Migration PDR Status

Status date: 2026-08-15

This file separates repository completion from cutover completion. A green build or deployment is not proof that source data, a production backend, reconciliation, restoration, or human approval exists.

## Observed Handoff State

- Draft PR: `L0v3Chrix/Clean-Path-2.1-#1` from `codex/six-house-migration-readiness`.
- Pull-request checks: application verification, clean-database verification, and Vercel preview build are configured.
- The verified application baseline is `6464099`; GitHub application, database/browser, and Vercel checks pass for that commit.
- Vercel Supabase resource `clearpath-production` is attached to `clearpath-rcl-mvp` Preview and Production. The accepted preview compiles the new Supabase project reference with both `VITE_AUTH_BYPASS=false` and `VITE_CLEARPATH_DEMO_MODE=false`.
- Live verification on 2026-08-15: all five migrations are applied; 49 public tables, 173 RLS policies, four private buckets, owner bootstrap, migration lineage, error audit, and export audit are present. The `health`, `public-intake`, and `invite-staff` Edge Functions are deployed with the intended anonymous/authenticated gateway boundaries.
- The health endpoint returns HTTP 200 with `database: ok`; anonymous public intake reaches application token validation; unauthenticated staff invitation is rejected at the gateway.
- Vercel production is still the older deployment. Production environment flags have been set to false, but no production promotion is allowed until the remaining cutover gates pass.
- The sibling public website labels six listings `RCL One` through `RCL Six`, but its two house-data files disagree on gender mix, capacity, occupancy, and pricing and provide no approved addresses or Oath Track counts. These are candidate display labels only, not an accepted migration roster.

## Repository-Owned Work

- [x] Canonical baseline preserved on a feature branch and divergent upstream left unmerged.
- [x] Supabase schema covers organization membership, house assignments, migration lineage, and public-intake tokens.
- [x] House- and resident-scoped RLS replaces broad organization-only access for beta workflows.
- [x] Staff invitation, role/profile setup, house assignments, and password recovery are implemented.
- [x] Public intake uses an opaque token, server-side validation, private attachments, and truthful background-check status.
- [x] Oath Track migration commands support inspect, validate, dry run, import, reconciliation, rerun idempotency, attachment lineage, and rollback.
- [x] Sensitive mutations, protected document access, and CSV exports are audited.
- [x] Operational exports exist for houses/beds, staff, residents/contacts, documents, medications/logs, incidents, schedules, and care plans.
- [x] Privacy-minimized application error events and a database-backed health endpoint are implemented.
- [x] Backup/restore and fail-closed cutover-readiness commands are implemented.
- [x] Pull-request CI runs tests, lint, type checking, production build, dependency threshold, clean database migrations, the RLS acceptance matrix, and real-browser operator workflows with both bypass flags disabled.
- [x] Synthetic migration import, unchanged rerun, reconciliation, rollback, and reimport have been exercised locally.
- [x] Local database tests cover owner, assigned staff, resident, anonymous, cross-house, core-workflow, audit, export, and cascading-delete behavior.
- [x] Playwright covers authenticated resident/contact creation, tenant-owned house creation/editing, shift creation/editing, care-plan goal/task creation and updates, bed assignment, medication dose logging, incident creation/status handling, private document access, authorized export, anonymous public-intake submission with a private attachment, consent, and signature, assigned-staff invitation, and sign-out against local Supabase with no console or page errors.

## External Cutover Gates

- [ ] `main`, accepted preview, and production are aligned to the same approved commit.
- [ ] Six named houses, addresses, beds/rooms, settings, and approved source counts are supplied.
- [ ] Complete Oath Track exports, data dictionary, attachment archive/manifest, history cutoff, and financial totals are supplied.
- [ ] Staff roster with roles and house assignments is approved.
- [x] Business-owned Vercel-managed Supabase project is provisioned; migrations, Auth, private Storage, and Edge Functions are deployed and structurally verified.
- [x] Accepted preview compiles `VITE_AUTH_BYPASS=false` and `VITE_CLEARPATH_DEMO_MODE=false` against the new Supabase project.
- [ ] Production is promoted from the accepted Git commit and both bypass flags are re-observed on that deployment.
- [ ] The first approved owner account is created and the organization-owner bootstrap succeeds.
- [ ] Scrubbed rehearsal using the final Oath Track package passes reconciliation and operator acceptance.
- [ ] Provider backup plus logical dump is restored into an isolated database and reconciled.
- [ ] Final freeze, all-six-house import, file reconciliation, user provisioning, and production smoke check pass.
- [ ] Slade and one representative from each of the six houses approve the cutover with timestamps.

The authoritative final answer is generated by `npm run readiness:check`; until it returns `ready: true`, ClearPath is not approved for the six-house cutover.
