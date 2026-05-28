# ClearPath MVP Sample Data

ClearPath uses a tagged sample dataset for UI/UX testing. Every sample row has:

- `is_sample_data = true`
- `sample_data_batch_id`
- a registry row in `sample_data_registry`

Sample files are stored under:

```text
<organization_id>/sample/<sample_data_batch_id>/
```

## Setup

Create a server-only env file from the example:

```bash
cp .env.sample-data.example .env.sample-data.local
```

Fill in:

```bash
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-server-side-service-role-or-secret-key
```

Never place the service role or secret key in a `VITE_` variable.

## Seed

```bash
npm run sample:seed
npm run sample:validate
```

The seed creates fake users, one fake organization, two fake locations, residents, emergency contacts, care plans, medications, dose logs, incidents, tasks, training, documents, compliance records, bed assignments, inventory records, and future integration placeholders.

To attach an existing Supabase Auth test user to the latest sample organization:

```bash
npm run sample:attach-user -- --email cricks@the1322.com --role owner --batch latest
```

This creates removable sample-tagged membership/profile rows only. It does not delete or recreate the real auth user.

## UI Smoke Check

Start the app first:

```bash
npm run dev
```

Then run:

```bash
npm run test:ui:sample
```

Use a custom URL if Vite is on another port:

```bash
npm run test:ui:sample -- --url http://localhost:5174
```

## Removal Before Compliance Certification

Run the single cleanup command:

```bash
npm run sample:remove -- --confirm --batch latest
npm run sample:validate -- --expect-empty
```

The removal script deletes sample storage objects, sample public-table rows, sample batch/registry rows, and sample auth users created by the seed script.

Do not enter real PHI into the sample organization. If real data is mixed into the sample organization, cleanup should be reviewed manually before certification.
