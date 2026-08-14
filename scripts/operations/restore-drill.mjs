import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function sanitizeDatabaseUrl(value) {
  const parsed = new URL(value);
  parsed.username = '';
  parsed.password = '';
  parsed.search = '';
  parsed.hash = '';
  return parsed.toString().replace(/\/$/, '');
}

function databaseIdentity(value) {
  const parsed = new URL(value);
  return `${parsed.hostname}:${parsed.port || '5432'}${parsed.pathname}`;
}

export function buildRestorePlan({ sourceUrl, restoreUrl, dumpPath }) {
  if (!sourceUrl || !restoreUrl || !dumpPath) throw new Error('Source URL, restore URL, and dump path are required.');
  if (databaseIdentity(sourceUrl) === databaseIdentity(restoreUrl)) {
    throw new Error('Restore target must be an isolated database, never the source database.');
  }
  const restoreDatabase = new URL(restoreUrl).pathname.replace(/^\//, '');
  return {
    source: sanitizeDatabaseUrl(sourceUrl),
    target: sanitizeDatabaseUrl(restoreUrl),
    dump: { command: 'pg_dump', connection: 'source', args: ['--format=custom', '--no-owner', '--no-acl', '--file', resolve(dumpPath)] },
    restore: { command: 'pg_restore', connection: 'restore', args: ['--clean', '--if-exists', '--no-owner', '--no-acl', '--dbname', restoreDatabase, resolve(dumpPath)] },
    verify: { command: 'psql', connection: 'restore', args: ['-v', 'ON_ERROR_STOP=1', '-Atc', "select count(*) from public.migration_runs where status = 'completed';"] },
  };
}

function postgresEnvironment(databaseUrl) {
  const parsed = new URL(databaseUrl);
  const sslmode = parsed.searchParams.get('sslmode');
  return {
    ...process.env,
    PGHOST: parsed.hostname,
    PGPORT: parsed.port || '5432',
    PGDATABASE: parsed.pathname.replace(/^\//, ''),
    PGUSER: decodeURIComponent(parsed.username),
    PGPASSWORD: decodeURIComponent(parsed.password),
    ...(sslmode ? { PGSSLMODE: sslmode } : {}),
  };
}

function execute(step, connections) {
  const result = spawnSync(step.command, step.args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: postgresEnvironment(connections[step.connection]),
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${step.command} failed: ${result.stderr.trim() || `exit ${result.status}`}`);
  return result.stdout.trim();
}

async function main(argv = process.argv.slice(2)) {
  const dumpIndex = argv.indexOf('--dump');
  const reportIndex = argv.indexOf('--report');
  const reconciliationIndex = argv.indexOf('--reconciliation-report');
  const dumpPath = dumpIndex >= 0 ? argv[dumpIndex + 1] : '.migration-output/clearpath-backup.dump';
  const reportPath = reportIndex >= 0 ? argv[reportIndex + 1] : '.migration-output/restore-drill.json';
  const reconciliationPath = reconciliationIndex >= 0 ? argv[reconciliationIndex + 1] : null;
  const sourceUrl = process.env.SOURCE_DATABASE_URL;
  const restoreUrl = process.env.RESTORE_DATABASE_URL;
  const plan = buildRestorePlan({ sourceUrl, restoreUrl, dumpPath });
  const startedAt = new Date().toISOString();
  const connections = { source: sourceUrl, restore: restoreUrl };

  execute(plan.dump, connections);
  const dump = await readFile(resolve(dumpPath));
  const dumpSha256 = createHash('sha256').update(dump).digest('hex');
  execute(plan.restore, connections);
  const completedMigrationRuns = Number(execute(plan.verify, connections));

  let reconciliation = null;
  if (reconciliationPath) {
    reconciliation = JSON.parse(await readFile(resolve(reconciliationPath), 'utf8'));
    if (reconciliation.ok !== true) throw new Error('Reconciliation report did not pass.');
  }

  const report = {
    ok: true,
    source: plan.source,
    restoreTarget: plan.target,
    dumpPath: resolve(dumpPath),
    dumpSha256,
    startedAt,
    completedAt: new Date().toISOString(),
    completedMigrationRuns,
    reconciliation: reconciliation ? { ok: true, runId: reconciliation.runId || null } : { ok: null, note: 'No reconciliation report supplied.' },
  };
  await writeFile(resolve(reportPath), `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
