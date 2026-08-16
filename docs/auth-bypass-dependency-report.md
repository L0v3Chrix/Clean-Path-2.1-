# Auth Bypass and Dependency Report

## Scope

This report documents the temporary login bypass, the authentication findings, and the backend blockers discovered during the original local evaluation. The resolution status was refreshed on 2026-08-16.

## Authentication Findings

- The frontend calls Supabase Auth directly through `src/lib/supabaseClient.js`.
- The login form uses `supabase.auth.signInWithPassword`.
- The create-user form uses `supabase.auth.signUp`.
- Supabase public auth settings report email provider support as enabled.
- A password-login probe with a throwaway address returned `Invalid login credentials`, which means the password endpoint is reachable. It did not return an email-provider-disabled error.
- Supabase public auth settings report signups are not disabled.
- Email confirmation is not auto-confirmed, so new users may need a working confirmation-email flow before they can sign in.

## Temporary Bypass

The bypass is controlled by:

```bash
VITE_AUTH_BYPASS=true
```

The bypass only activates in Vite development mode and is explicitly disabled in test mode. It does three things:

- Skips the login screen.
- Uses a demo owner identity for local evaluation.
- Uses temporary in-memory demo records instead of requiring the hosted Supabase database to have the ClearPath schema already applied.

Keep this off in deployed environments:

```bash
VITE_AUTH_BYPASS=false
```

## Backend Blocker Resolution

- The original hosted project did not expose the ClearPath schema and returned `PGRST205` for application tables. That project is no longer the production target.
- Vercel-managed Supabase project `clearpath-production` now records all eight migrations and exposes the application schema, owner bootstrap, house-scoped RLS, and audit functions.
- The four required Storage buckets are deployed as private buckets.
- The `health`, `public-intake`, `invite-staff`, and `critical-incident-notify` Edge Functions are deployed. The incident function requires JWT authentication and cannot claim delivery without an approved provider.
- Vercel preview and production environment values do not enable either authentication bypass or demo mode; the accepted preview requires a real Supabase session.
- External integrations remain planning/config screens only.

## Ralph Loop Working Definition

No existing project-specific Ralph loop definition was found in this repository. For this debugging pass, the loop is treated as:

- Reproduce: trigger the failure and capture the observed behavior.
- Analyze: check auth settings, frontend flow, and backend responses.
- Localize: isolate whether the blocker is frontend auth, Supabase Auth config, schema, RLS, storage, or missing integration code.
- Patch: make the smallest reversible local change that exposes the next failure layer.
- Harden: run verification, document the dependency, and convert the finding into the next implementation task.

## Ralph Loop Results

- Reproduce: login screen blocked app evaluation.
- Analyze: email/password auth was reachable, but the original hosted target was missing the real schema.
- Localize: the original blank modules were caused by pages waiting on tables that did not exist in that retired target.
- Patch: added a development-only auth bypass and local in-memory data path.
- Harden: production code now defaults to real authentication, all migrations are applied to `clearpath-production`, and both bypass flags are disabled in the accepted preview.

## Remaining Acceptance Work

1. Create the first approved owner and run the one-time organization bootstrap.
2. Validate the approved staff roster, roles, and house assignments.
3. Complete the authoritative six-house source package, scrubbed rehearsal, restore drill, reconciliation, and approvals.
4. Promote only the accepted Git-backed Vercel deployment after `readiness:check` returns `ready: true`.
5. Keep external integrations disabled until each vendor is intentionally approved and verified.
