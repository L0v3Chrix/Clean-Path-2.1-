# Auth Bypass and Dependency Report

## Scope

This report documents the temporary login bypass, the authentication findings, and the current dependency blockers discovered while evaluating ClearPath locally.

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

## Dependency Blockers Found

- The hosted Supabase project does not currently expose the ClearPath application tables in the public REST schema.
- REST probes returned `PGRST205 Could not find the table ... in the schema cache` for the app tables.
- Until the migration is applied, real Supabase-backed data operations cannot work.
- The `bootstrap_organization_owner` RPC also depends on the migration being applied.
- Storage buckets for resident documents, secure documents, medication photos, and intake attachments also depend on the migration.
- Supabase CLI was not available locally during setup, so the migration was documented but not applied from this machine.
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
- Analyze: email/password auth endpoint is reachable, but the real schema is missing from the hosted Supabase project.
- Localize: the blank modules were caused by pages waiting on tables that do not exist yet.
- Patch: added a development-only auth bypass and local in-memory data path.
- Harden: main routes can now be inspected locally while the real Supabase migration remains pending.

## Next Implementation Loops

1. Apply the Supabase migration to the hosted project.
2. Turn `VITE_AUTH_BYPASS=false`.
3. Create the first real user.
4. Confirm email delivery or temporarily configure confirmation behavior in Supabase Auth settings.
5. Use the first real user to run the owner bootstrap flow.
6. Re-run route audit against live Supabase tables.
7. Replace any remaining in-memory-only behavior with verified Supabase-backed behavior.
8. Keep external integrations as placeholders until each vendor is intentionally selected.
