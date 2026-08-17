# Session Notes

## Session: 2026-07-10

### Accomplished
- Diagnosed broken login on the live ClearPath demo (clearpath-rcl-mvp.vercel.app): the Supabase project backing auth (`nqwkvtlrfiblwlfhqrru.supabase.co`) no longer exists — DNS is NXDOMAIN and it is not in the connected Supabase account, so every sign-in call failed.
- Enabled the app's built-in demo mode for the production deployment: set `VITE_CLEARPATH_DEMO_MODE=true` on Vercel (was `false`).
- Fixed `src/pages/Login.jsx` so the sign-in form completes locally when demo mode / auth bypass is on (any email + password signs in as Slade/Owner); previously the form still called the dead Supabase directly.
- Deployed to Vercel production and verified the full flow live: /login → sign in → dashboard with seeded sample data.

### Decisions Made
- Used demo mode (client-side `localBypassStore` sample data) instead of recreating the Supabase backend. Recreating the project would require a new Supabase project (cost confirmation), re-running migrations, and re-seeding — unnecessary for a demo.
- Committed to main locally, not pushed (repo has no Vercel git integration; deploys go through `vercel deploy --prod`).

### Blockers/Issues
- Real multi-user auth is still dead. If the client demo converts into a live pilot, a new Supabase project is needed: run the three migrations in `supabase/migrations/`, seed via `npm run sample:seed`, update `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` in `.env.local` and Vercel, and set `VITE_CLEARPATH_DEMO_MODE=false`.

### Next Session
- Decide whether to rebuild the Supabase backend or keep the demo client-side only.
- Consider pushing the commit to `origin` (github.com/L0v3Chrix/Clean-Path-2.1-) for backup.

## Session: 2026-08-16

### Accomplished
- Verified implementation commit `6bfa01dbbd46959d2231efb621168a83c0690b2a` with GitHub Actions run `31990268208`; application, clean-database/browser, and exact Git-backed Vercel preview checks all passed.
- Verified Ready preview `clearpath-rcl-e5xvzncyu-enterweb-guru.vercel.app`, GitHub deployment `5938310508`, renders the protected ClearPath sign-in from the exact release-candidate commit.
- Applied and ledgered migrations `20260817100000` through `20260817120000`, bringing `clearpath-production` to all 15 repository migrations with zero direct-write RLS policies on membership, house-assignment, or staff-profile tables.
- Added production Edge Function secrets for the approved invite redirect and public Supabase URL, deployed `invite-resident` and `document-access`, and refreshed `invite-staff`; the live inventory now contains six functions.
- Verified health and public-intake preflight return HTTP 200, while unauthenticated staff invitation, resident invitation, document access, and incident notification return HTTP 401.
- Confirmed deployment did not send invitations or provision users: production remains at one organization, one Auth user, one active Owner, zero account claims, zero user invitations, and zero resident login bindings.
- Verified GitHub Actions run `31977223444` on commit `12eac7ae384294c71735c4c4a909e30ba8fcc7fd`: application and database/browser jobs plus the exact Git-backed Vercel preview all passed.
- Verified preview deployment `dpl_J2qAhyFjza8jzZcpjZzuRoH5r7g4` is Ready, Git-sourced from the exact commit, and publishes matching release metadata with both demo and auth bypass flags disabled against Supabase project `dcfldvtdrpukaojkpvzp`.
- Applied and ledgered migrations `20260816130000` through `20260816160000` on `clearpath-production`, bringing the live database to all 12 repository migrations.
- Refreshed the live `public-intake` and `invite-staff` Edge Functions to the hardened branch implementations and verified health/preflight HTTP 200 plus unauthenticated staff/incident HTTP 401 boundaries.
- Confirmed the current production tenant has one organization, one Auth user, one active Owner, no resident login binding, and a pre-change physical backup dated `2026-08-16 11:55:11 UTC`.
- Verified pull-request run 14 on implementation commit `7f3d481d447cace2754c4e3124cdf761a3eaa7b8`: application checks, clean database migrations, the RLS acceptance matrix, real-backend browser workflows, and the Vercel preview passed.
- Verified the Ready preview requires authentication, uses the Vercel-managed `clearpath-production` backend, and renders the protected-workspace login without console errors.
- Applied and recorded migration `20260816120000_private_esignature_document_access` in the production Supabase migration ledger.
- Verified eight migrations, 49 public tables, 177 public/Storage RLS policies, four private buckets, the signature-document trigger/index/access helpers, and zero malformed existing signature paths.
- Deployed `critical-incident-notify` as the fourth Edge Function with JWT verification enabled and verified that an unauthenticated request returns HTTP 401.
- Rechecked the database-backed health endpoint, dependency threshold, and Supabase Security Advisor: database health is `ok`, runtime audit has no high or critical findings, and the advisor has zero errors.

### Decisions Made
- Kept incident email delivery fail-closed because no provider has been approved; deployment is not treated as delivery proof.
- Kept the pull request in draft and did not promote the older Vercel production frontend.
- Kept cutover readiness fail-closed until the authoritative six-house Oath Track package, rehearsal, restore/reconciliation evidence, first-owner bootstrap, and all seven human approvals exist.

### Remaining Blockers
- `.migration-input/` is absent, so there is no authoritative roster, source export package, data dictionary, attachment archive, staff assignment file, cutoff evidence, or financial reconciliation to migrate.
- No scrubbed rehearsal, isolated restore, final import, production smoke test, or signed house acceptance has been completed.
