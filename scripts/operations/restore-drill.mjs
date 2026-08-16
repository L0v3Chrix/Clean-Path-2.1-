import { createHash } from 'node:crypto';
import { readFile, realpath, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertMigrationReportIntegrity, signMigrationReport } from '../migration/report-integrity.mjs';

export function sanitizeDatabaseUrl(value) {
  const parsed = new URL(value);
  parsed.username = '';
  parsed.password = '';
  parsed.search = '';
  parsed.hash = '';
  return parsed.toString().replace(/\/$/, '');
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256_PATTERN = /^[a-f0-9]{64}$/i;
const TARGET_TABLES = [
  'locations', 'staff_profiles', 'residents', 'resident_contacts', 'bed_assignments',
  'resident_documents', 'care_plan_goals', 'care_plan_tasks', 'medications',
  'medication_logs', 'incident_reports', 'shifts', 'resident_fees', 'resident_payments',
];

function databaseIdentity(value) {
  const parsed = new URL(value);
  return `${parsed.hostname}:${parsed.port || '5432'}${parsed.pathname}`;
}

const DATABASE_IDENTITY_SQL = `
  select json_build_object(
    'serverIdentifier', (pg_control_system()).system_identifier::text,
    'databaseOid', oid::text,
    'databaseName', datname
  )
  from pg_database
  where datname = current_database();
`.replace(/\s+/g, ' ').trim();

function restoredEvidenceSql(runId) {
  const targetRows = TARGET_TABLES.map((table) => `
    select r.source_entity, r.source_id, r.target_table, r.target_id,
      r.normalized_payload, to_jsonb(t) as target
    from run_records r
    left join public.${table} t on t.id = r.target_id
    where r.target_table = '${table}'
  `).join(' union all ');
  return `
    with run_records as (
      select source_entity, source_id, target_table, target_id, normalized_payload
      from public.migration_source_records
      where migration_run_id = '${runId}' and status in ('imported', 'skipped')
    ), target_rows as (${targetRows}), object_refs as (
      select distinct normalized_payload->>'storage_bucket' as bucket,
        normalized_payload->>'storage_path' as path
      from run_records
      where normalized_payload->>'storage_bucket' is not null
        and normalized_payload->>'storage_path' is not null
    )
    select json_build_object(
      'runId', migration_runs.id,
      'status', migration_runs.status,
      'packageSha256', migration_runs.source_sha256,
      'completedMigrationRuns', (select count(*) from public.migration_runs where status = 'completed'),
      'expected', migration_runs.expected_counts,
      'imported', migration_runs.imported_counts,
      'lineage', coalesce((
        select jsonb_object_agg(source_entity, total)
        from (select source_entity, count(*) as total from run_records group by source_entity) counts
      ), '{}'::jsonb),
      'records', coalesce((
        select jsonb_agg(jsonb_build_object(
          'sourceEntity', source_entity, 'sourceId', source_id,
          'targetTable', target_table, 'targetId', target_id,
          'normalizedPayload', normalized_payload, 'target', target
        ) order by source_entity, source_id)
        from target_rows
      ), '[]'::jsonb),
      'referencedObjects', (select count(*) from object_refs),
      'objects', coalesce((
        select jsonb_agg(jsonb_build_object('bucket', bucket, 'path', path) order by bucket, path)
        from object_refs
      ), '[]'::jsonb),
      'restoredObjects', (
        select count(*) from object_refs
        join storage.objects on storage.objects.bucket_id = object_refs.bucket
          and storage.objects.name = object_refs.path
      )
    )
    from public.migration_runs
    where migration_runs.id = '${runId}';
  `.replace(/\s+/g, ' ').trim();
}

export function validateDatabaseIsolation(source, target) {
  for (const [label, identity] of [['Source', source], ['Restore target', target]]) {
    if (!identity?.serverIdentifier) throw new Error(`${label} server identity is unavailable.`);
    if (!identity?.databaseOid || !identity?.databaseName) throw new Error(`${label} database identity is unavailable.`);
  }
  if (source.serverIdentifier === target.serverIdentifier && source.databaseOid === target.databaseOid) {
    throw new Error('Source and restore target resolve to the same database. Refusing destructive restore.');
  }
  return { source, target };
}

export function buildRestorePlan({ sourceUrl, restoreUrl, dumpPath, runId }) {
  if (!sourceUrl || !restoreUrl || !dumpPath || !runId) {
    throw new Error('Source URL, restore URL, dump path, and migration run ID are required.');
  }
  if (!UUID_PATTERN.test(runId)) throw new Error('Migration run ID must be a UUID.');
  if (databaseIdentity(sourceUrl) === databaseIdentity(restoreUrl)) {
    throw new Error('Restore target must be an isolated database, never the source database.');
  }
  const restoreDatabase = new URL(restoreUrl).pathname.replace(/^\//, '');
  return {
    source: sanitizeDatabaseUrl(sourceUrl),
    target: sanitizeDatabaseUrl(restoreUrl),
    dump: { command: 'pg_dump', connection: 'source', args: ['--format=custom', '--no-owner', '--no-acl', '--file', resolve(dumpPath)] },
    restore: { command: 'pg_restore', connection: 'restore', args: ['--clean', '--if-exists', '--no-owner', '--no-acl', '--dbname', restoreDatabase, resolve(dumpPath)] },
    identifySource: { command: 'psql', connection: 'source', args: ['-v', 'ON_ERROR_STOP=1', '-Atc', DATABASE_IDENTITY_SQL] },
    identifyTarget: { command: 'psql', connection: 'restore', args: ['-v', 'ON_ERROR_STOP=1', '-Atc', DATABASE_IDENTITY_SQL] },
    verify: {
      command: 'psql',
      connection: 'restore',
      args: ['-v', 'ON_ERROR_STOP=1', '-Atc', restoredEvidenceSql(runId)],
    },
  };
}

function normalizedCounts(value, label) {
  if (!value || Array.isArray(value) || typeof value !== 'object') {
    throw new Error(`${label} must be an object of non-negative integer totals.`);
  }
  const entries = Object.entries(value).sort(([left], [right]) => left.localeCompare(right));
  for (const [entity, total] of entries) {
    if (!entity || !Number.isInteger(Number(total)) || Number(total) < 0) {
      throw new Error(`${label} must contain non-negative integer totals.`);
    }
  }
  return Object.fromEntries(entries.map(([entity, total]) => [entity, Number(total)]));
}

function sameCounts(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => [key, stableValue(nested)]));
  }
  return value;
}

function sameValue(left, right) {
  return JSON.stringify(stableValue(left)) === JSON.stringify(stableValue(right));
}

async function readObjectInside(rootDirectory, bucket, path) {
  const root = await realpath(rootDirectory);
  const objectPath = await realpath(resolve(rootDirectory, bucket, path));
  const relation = relative(root, objectPath);
  if (relation.startsWith('..') || relation === '') {
    throw new Error(`Storage evidence path must stay inside its object tree: ${bucket}/${path}`);
  }
  return readFile(objectPath);
}

export async function hashStorageEvidence(storageManifest, sourceDirectory, restoredDirectory) {
  if (!storageManifest || !Array.isArray(storageManifest.objects)) throw new Error('Storage manifest must list objects.');
  const [sourceRoot, restoredRoot] = await Promise.all([realpath(sourceDirectory), realpath(restoredDirectory)]);
  if (sourceRoot === restoredRoot) throw new Error('Source and restored Storage evidence must use different directories.');
  const objects = await Promise.all(storageManifest.objects.map(async (object) => {
    if (!object.bucket || !object.path) throw new Error('Every Storage object needs bucket and path.');
    const [source, restored] = await Promise.all([
      readObjectInside(sourceRoot, object.bucket, object.path),
      readObjectInside(restoredRoot, object.bucket, object.path),
    ]);
    return {
      bucket: object.bucket,
      path: object.path,
      sourceSha256: createHash('sha256').update(source).digest('hex'),
      restoredSha256: createHash('sha256').update(restored).digest('hex'),
    };
  }));
  return { ...storageManifest, objects, expectedTotal: objects.length, restoredTotal: objects.length };
}

export function validateRestoreEvidence(
  { runId, reconciliation, database, storageManifest },
  signingKey = process.env.MIGRATION_REPORT_SIGNING_KEY,
) {
  if (!UUID_PATTERN.test(runId || '')) throw new Error('Migration run ID must be a UUID.');
  assertMigrationReportIntegrity(reconciliation, signingKey);
  if (!reconciliation || reconciliation.ok !== true) throw new Error('Reconciliation report did not pass.');
  if (!Array.isArray(reconciliation.missing) || reconciliation.missing.length > 0
    || !Array.isArray(reconciliation.failed) || reconciliation.failed.length > 0) {
    throw new Error('Reconciliation report contains missing or failed records.');
  }
  if (reconciliation.runId !== runId) {
    throw new Error('Reconciliation report does not identify the requested migration run.');
  }
  if (!SHA256_PATTERN.test(reconciliation.packageSha256 || '')
    || reconciliation.packageSha256 !== database?.packageSha256) {
    throw new Error('Reconciliation source package does not match the restored migration run.');
  }
  if (!database || database.runId !== runId) {
    throw new Error('Restored database evidence does not match the requested migration run.');
  }
  if (database.status !== 'completed') throw new Error('Requested migration run is not completed on the restored target.');

  const expected = normalizedCounts(database.expected, 'Restored database expected counts');
  const imported = normalizedCounts(database.imported, 'Restored database imported counts');
  const lineage = normalizedCounts(database.lineage, 'Restored database lineage counts');
  const reconciledExpected = normalizedCounts(reconciliation.expected, 'Reconciliation expected counts');
  const reconciledImported = normalizedCounts(reconciliation.imported, 'Reconciliation imported counts');
  if (![imported, lineage, reconciledExpected, reconciledImported].every((counts) => sameCounts(expected, counts))) {
    throw new Error('Reconciliation and restored database totals do not match.');
  }

  if (!Array.isArray(database.records)) throw new Error('Restored target row evidence is missing.');
  const expectedRecordTotal = Object.values(expected).reduce((sum, total) => sum + total, 0);
  if (database.records.length !== expectedRecordTotal || database.records.some((record) => !record.target)) {
    throw new Error('Restored target rows do not match the completed migration run.');
  }
  for (const record of database.records) {
    const normalizedPayload = record.normalizedPayload;
    if (!normalizedPayload || typeof normalizedPayload !== 'object' || Array.isArray(normalizedPayload)) {
      throw new Error('Restored target normalized values are unavailable.');
    }
    const mismatched = Object.entries(normalizedPayload).some(([field, value]) => !sameValue(record.target[field], value));
    if (mismatched) throw new Error(`Restored target values differ from lineage for ${record.sourceEntity}.${record.sourceId}.`);
  }

  if (!storageManifest || storageManifest.runId !== runId || !Array.isArray(storageManifest.objects)) {
    throw new Error('Storage object manifest must identify the requested migration run and list its objects.');
  }
  const expectedTotal = Number(storageManifest.expectedTotal);
  const restoredTotal = Number(storageManifest.restoredTotal);
  if (!Number.isInteger(expectedTotal) || expectedTotal < 0
    || !Number.isInteger(restoredTotal) || restoredTotal < 0) {
    throw new Error('Storage object manifest totals must be non-negative integers.');
  }

  const identities = new Set();
  for (const object of storageManifest.objects) {
    const identity = `${object.bucket}/${object.path}`;
    if (!object.bucket || !object.path || !object.path.includes('/migrations/') || identities.has(identity)) {
      throw new Error('Storage object manifest contains an invalid, duplicate, or unbound object.');
    }
    identities.add(identity);
    if (!SHA256_PATTERN.test(object.sourceSha256 || '')
      || !SHA256_PATTERN.test(object.restoredSha256 || '')
      || object.sourceSha256.toLowerCase() !== object.restoredSha256.toLowerCase()) {
      throw new Error(`Storage checksum verification failed for ${identity}.`);
    }
  }

  const manifestTotal = storageManifest.objects.length;
  const databaseIdentities = new Set((database.objects || []).map((object) => `${object.bucket}/${object.path}`));
  if (databaseIdentities.size !== identities.size || [...identities].some((identity) => !databaseIdentities.has(identity))) {
    throw new Error('Storage object identities do not match restored database references.');
  }
  const referencedObjects = Number(database.referencedObjects);
  const restoredObjects = Number(database.restoredObjects);
  if (expectedTotal !== manifestTotal || restoredTotal !== manifestTotal
    || referencedObjects !== manifestTotal || restoredObjects !== manifestTotal) {
    throw new Error('Storage object totals do not match the manifest and restored target.');
  }
  return { databaseTotals: expected, objectTotal: manifestTotal };
}

export function buildRestoreReport({
  plan, dumpPath, dumpSha256, startedAt, completedAt, runId, database, evidence,
  reconciliation, storageManifestPath, storageManifest, databaseIdentity: identities,
}) {
  return {
    schemaVersion: 1,
    artifactType: 'clearpath-restore-drill',
    ok: true,
    source: plan.source,
    restoreTarget: plan.target,
    dumpPath: resolve(dumpPath),
    dumpSha256,
    startedAt,
    completedAt,
    runId,
    packageSha256: database.packageSha256,
    databaseIdentity: identities,
    completedMigrationRuns: Number(database.completedMigrationRuns),
    databaseTotals: evidence.databaseTotals,
    reconciliation: {
      ok: true,
      runId,
      packageSha256: reconciliation.packageSha256,
      expected: reconciliation.expected,
      imported: reconciliation.imported,
    },
    storage: {
      ok: true,
      objectTotal: evidence.objectTotal,
      manifestPath: resolve(storageManifestPath),
      manifestSha256: createHash('sha256').update(JSON.stringify(storageManifest)).digest('hex'),
    },
  };
}

export function parseRestoreDrillArgs(argv) {
  const result = {
    dumpPath: '.migration-output/clearpath-backup.dump',
    reportPath: '.migration-output/restore-drill.json',
    reconciliationPath: null,
    storageManifestPath: null,
    sourceStorageDirectory: null,
    restoredStorageDirectory: null,
    runId: null,
  };
  const options = new Map([
    ['--dump', 'dumpPath'],
    ['--report', 'reportPath'],
    ['--reconciliation-report', 'reconciliationPath'],
    ['--storage-manifest', 'storageManifestPath'],
    ['--source-storage-dir', 'sourceStorageDirectory'],
    ['--restored-storage-dir', 'restoredStorageDirectory'],
    ['--run', 'runId'],
  ]);
  for (let index = 0; index < argv.length; index += 1) {
    const key = options.get(argv[index]);
    if (!key) throw new Error(`Unknown option: ${argv[index]}`);
    const value = argv[++index];
    if (!value || value.startsWith('--')) throw new Error(`${argv[index - 1]} requires a value.`);
    result[key] = value;
  }
  if (!result.runId) throw new Error('--run <migration-run-uuid> is required.');
  if (!UUID_PATTERN.test(result.runId)) throw new Error('--run must be a UUID.');
  if (!result.reconciliationPath) throw new Error('--reconciliation-report <path> is required.');
  if (!result.storageManifestPath) throw new Error('--storage-manifest <path> is required.');
  if (!result.sourceStorageDirectory) throw new Error('--source-storage-dir <path> is required.');
  if (!result.restoredStorageDirectory) throw new Error('--restored-storage-dir <path> is required.');
  return result;
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
  const {
    dumpPath, reportPath, reconciliationPath, storageManifestPath, sourceStorageDirectory,
    restoredStorageDirectory, runId,
  } = parseRestoreDrillArgs(argv);
  const sourceUrl = process.env.SOURCE_DATABASE_URL;
  const restoreUrl = process.env.RESTORE_DATABASE_URL;
  const evidenceSigningKey = process.env.CLEARPATH_EVIDENCE_SIGNING_KEY;
  if (!evidenceSigningKey) throw new Error('CLEARPATH_EVIDENCE_SIGNING_KEY is required.');
  const plan = buildRestorePlan({ sourceUrl, restoreUrl, dumpPath, runId });
  const startedAt = new Date().toISOString();
  const connections = { source: sourceUrl, restore: restoreUrl };
  const reconciliation = JSON.parse(await readFile(resolve(reconciliationPath), 'utf8'));
  assertMigrationReportIntegrity(reconciliation, process.env.MIGRATION_REPORT_SIGNING_KEY);
  const storageManifestContent = await readFile(resolve(storageManifestPath), 'utf8');
  const declaredStorageManifest = JSON.parse(storageManifestContent);

  const identities = validateDatabaseIsolation(
    JSON.parse(execute(plan.identifySource, connections)),
    JSON.parse(execute(plan.identifyTarget, connections)),
  );
  execute(plan.dump, connections);
  const dump = await readFile(resolve(dumpPath));
  const dumpSha256 = createHash('sha256').update(dump).digest('hex');
  execute(plan.restore, connections);
  const databaseOutput = execute(plan.verify, connections);
  if (!databaseOutput) throw new Error('Requested migration run was not found on the restored target.');
  const database = JSON.parse(databaseOutput);
  const storageManifest = await hashStorageEvidence(
    declaredStorageManifest,
    sourceStorageDirectory,
    restoredStorageDirectory,
  );
  const evidence = validateRestoreEvidence({ runId, reconciliation, database, storageManifest });

  const report = signMigrationReport(buildRestoreReport({
    plan, dumpPath, dumpSha256, startedAt, completedAt: new Date().toISOString(), runId,
    database, evidence, reconciliation, storageManifestPath, storageManifest,
    databaseIdentity: identities,
  }), evidenceSigningKey);
  await writeFile(resolve(reportPath), `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
