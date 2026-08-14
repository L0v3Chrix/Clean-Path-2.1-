import { writeFile } from 'node:fs/promises';
import { createHmac } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadMigrationDataset } from './io.mjs';
import { buildMigrationPlan, reconcilePlan, validateMigrationDataset } from './migration.mjs';
import { createSupabaseMigrationRepository } from './repository.mjs';
import { executeImport, executeRollback } from './runner.mjs';

export function parseMigrationArgs(argv) {
  const [command, ...options] = argv;
  const result = { command, manifestPath: null, runId: null, confirm: false, reportPath: null };
  for (let index = 0; index < options.length; index += 1) {
    const option = options[index];
    if (option === '--confirm') result.confirm = true;
    else if (option === '--run') result.runId = options[++index];
    else if (option === '--report') result.reportPath = options[++index];
    else if (!option.startsWith('--') && !result.manifestPath) result.manifestPath = option;
    else throw new Error(`Unknown option: ${option}`);
  }
  return result;
}

function repositoryFromEnvironment() {
  return createSupabaseMigrationRepository({
    url: process.env.SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });
}

export function signMigrationReport(report, signingKey) {
  if (!signingKey) return report;
  const signature = createHmac('sha256', signingKey).update(JSON.stringify(report)).digest('hex');
  return { ...report, integrity: { algorithm: 'hmac-sha256', signature } };
}

async function emitReport(report, path) {
  const signedReport = signMigrationReport(report, process.env.MIGRATION_REPORT_SIGNING_KEY);
  const content = `${JSON.stringify(signedReport, null, 2)}\n`;
  if (path) await writeFile(resolve(path), content, { mode: 0o600 });
  process.stdout.write(content);
}

async function main(argv = process.argv.slice(2)) {
  const args = parseMigrationArgs(argv);
  if (!['inspect', 'validate', 'import', 'reconcile', 'rollback'].includes(args.command)) {
    throw new Error('Command must be inspect, validate, import, reconcile, or rollback.');
  }

  if (args.command === 'rollback') {
    if (!args.runId || !args.confirm) throw new Error('Rollback requires --run <id> and --confirm.');
    await emitReport(await executeRollback(args.runId, repositoryFromEnvironment()), args.reportPath);
    return;
  }
  if (!args.manifestPath) throw new Error(`${args.command} requires a manifest path.`);

  const dataset = await loadMigrationDataset(args.manifestPath);
  const validation = validateMigrationDataset(dataset);
  if (args.command === 'inspect') {
    await emitReport({
      ok: validation.ok,
      sourceSystem: dataset.manifest.sourceSystem,
      organizationId: dataset.manifest.organizationId,
      cutoffAt: dataset.manifest.cutoffAt,
      files: dataset.sourceFiles,
      validationErrors: validation.errors,
    }, args.reportPath);
    return;
  }
  if (!validation.ok) {
    await emitReport(validation, args.reportPath);
    process.exitCode = 1;
    return;
  }
  if (args.command === 'validate') {
    await emitReport(validation, args.reportPath);
    return;
  }

  if (args.command === 'import' && !args.confirm) {
    const plan = buildMigrationPlan(dataset);
      await emitReport({
        ok: true,
        dryRun: true,
        manifestSha256: plan.manifestSha256,
        actions: plan.records.reduce((counts, record) => {
          counts[record.action] = (counts[record.action] || 0) + 1;
          return counts;
        }, {}),
      }, args.reportPath);
    return;
  }

  const repository = repositoryFromEnvironment();
  const priorRecords = await repository.listPriorRecords(
    dataset.manifest.organizationId,
    dataset.manifest.sourceSystem,
  );
  const plan = buildMigrationPlan(dataset, priorRecords);

  if (args.command === 'import') {
    await emitReport(await executeImport(plan, repository), args.reportPath);
    return;
  }

  if (!args.runId) throw new Error('Reconcile requires --run <id>.');
  const runRecords = await repository.listRunRecords(args.runId);
  const report = reconcilePlan(plan, runRecords);
  await emitReport(report, args.reportPath);
  if (!report.ok) process.exitCode = 1;
}

const isDirectRun = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
