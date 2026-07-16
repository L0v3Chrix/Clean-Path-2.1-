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
