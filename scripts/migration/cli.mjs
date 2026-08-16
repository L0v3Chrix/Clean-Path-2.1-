import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadMigrationDataset } from './io.mjs';
import { buildMigrationPlan, reconcilePlan, validateMigrationDataset } from './migration.mjs';
import { createSupabaseMigrationRepository } from './repository.mjs';
import { executeImport, executeRollback } from './runner.mjs';
import { signMigrationReport } from './report-integrity.mjs';
import { validateSourcePackage } from './source-package.mjs';

export { signMigrationReport } from './report-integrity.mjs';

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

export async function loadValidatedSourcePackage(manifestPath, validator = validateSourcePackage) {
  const validation = await validator(manifestPath);
  if (validation.ok && !validation.validatedDataset) {
    throw new Error('Source-package validator did not return its validated dataset snapshot.');
  }
  return { validation, dataset: validation.validatedDataset || null };
}

export function projectRefFromSupabaseUrl(value) {
  if (!value) return null;
  const hostname = new URL(value).hostname;
  return hostname.endsWith('.supabase.co') ? hostname.split('.')[0] : hostname;
}

async function emitReport(report, path) {
  const signedReport = signMigrationReport(report, process.env.MIGRATION_REPORT_SIGNING_KEY);
  const content = `${JSON.stringify(signedReport, null, 2)}\n`;
  if (path) await writeFile(resolve(path), content, { mode: 0o600 });
  process.stdout.write(content);
}

function requireReportSigningKey() {
  if (!process.env.MIGRATION_REPORT_SIGNING_KEY) {
    throw new Error('MIGRATION_REPORT_SIGNING_KEY is required for confirmed migration operations.');
  }
}

async function main(argv = process.argv.slice(2)) {
  const args = parseMigrationArgs(argv);
  if (!['inspect', 'validate', 'import', 'reconcile', 'rollback'].includes(args.command)) {
    throw new Error('Command must be inspect, validate, import, reconcile, or rollback.');
  }

  if (args.command === 'rollback') {
    if (!args.runId || !args.confirm) throw new Error('Rollback requires --run <id> and --confirm.');
    requireReportSigningKey();
    await emitReport(await executeRollback(args.runId, repositoryFromEnvironment()), args.reportPath);
    return;
  }
  if (!args.manifestPath) throw new Error(`${args.command} requires a manifest path.`);

  if ((args.command === 'import' && args.confirm) || args.command === 'reconcile') {
    requireReportSigningKey();
  }

  if (['inspect', 'validate'].includes(args.command)) {
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
    await emitReport({
      ...validation,
    }, args.reportPath);
    if (!validation.ok) process.exitCode = 1;
    return;
  }

  const { validation: sourcePackage, dataset } = await loadValidatedSourcePackage(args.manifestPath);
  if (!sourcePackage.ok) {
    await emitReport(sourcePackage, args.reportPath);
    process.exitCode = 1;
    return;
  }

  if (args.command === 'import' && !args.confirm) {
    const plan = buildMigrationPlan(dataset, [], sourcePackage.packageSha256);
      await emitReport({
        ok: true,
        dryRun: true,
        packageSha256: plan.packageSha256,
        datasetSha256: plan.datasetSha256,
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
  const plan = buildMigrationPlan(dataset, priorRecords, sourcePackage.packageSha256);

  if (args.command === 'import') {
    await emitReport(await executeImport(plan, repository), args.reportPath);
    return;
  }

  if (!args.runId) throw new Error('Reconcile requires --run <id>.');
  const migrationRun = await repository.getRun(args.runId);
  const runRecords = await repository.listRunRecords(args.runId);
  const report = {
    runId: args.runId,
    checkedAt: new Date().toISOString(),
    packageSha256: plan.packageSha256,
    target: { projectRef: projectRefFromSupabaseUrl(process.env.SUPABASE_URL) },
    ...reconcilePlan(plan, runRecords, migrationRun),
  };
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
