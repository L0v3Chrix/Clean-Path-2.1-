import { createHash } from 'node:crypto';
import { readFile, realpath, writeFile } from 'node:fs/promises';
import { basename, dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateSourcePackage } from '../migration/source-package.mjs';

const REQUIRED_TECHNICAL_CHECKS = [
  'rls-role-cross-house',
  'private-storage-access',
  'public-intake',
  'staff-access',
  'automated-checks',
];

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256_PATTERN = /^[a-f0-9]{64}$/i;
const GIT_COMMIT_PATTERN = /^[a-f0-9]{40}$/i;

function completedText(value) {
  return typeof value === 'string'
    && value.trim().length > 0
    && !/\[(?:FILL|PENDING)(?::|\])/i.test(value);
}

function validTimestamp(value) {
  return completedText(value) && !Number.isNaN(Date.parse(value));
}

function validSourcePackage(validation) {
  return validation?.ok === true
    && Array.isArray(validation.blockers)
    && validation.blockers.length === 0
    && validTimestamp(validation.checkedAt)
    && /^[a-f0-9]{64}$/i.test(validation.manifestSha256 || '')
    && /^[a-f0-9]{64}$/i.test(validation.packageSha256 || '')
    && validation.counts?.houses === 6
    && validation.counts?.sourceFiles === validation.counts?.requiredSourceFiles
    && validation.counts?.requiredSourceFiles === 14
    && validation.counts?.sourceCountRows === 84
    && validation.counts?.financialHouses === 6
    && validation.counts?.dictionaryRows > 0
    && validation.counts?.staffUsers > 0;
}

function emptyIssues(value) {
  return Array.isArray(value) && value.length === 0;
}

function artifactMatches(name, declared, observed, blockers) {
  if (!completedText(declared?.path) || !SHA256_PATTERN.test(declared?.sha256 || '')) {
    blockers.push(`${name} artifact path and SHA-256 are required.`);
    return null;
  }
  if (!observed?.report || observed.sha256 !== declared.sha256.toLowerCase()) {
    blockers.push(`${name} artifact hash does not match its computed file hash.`);
    return null;
  }
  return observed.report;
}

function validateTechnicalVerification(evidence, observedArtifacts, blockers) {
  const report = artifactMatches(
    'technical verification',
    evidence.artifacts?.technicalVerification,
    observedArtifacts.technicalVerification,
    blockers,
  );
  if (!report) return { passed: 0, completedAt: Number.NaN };

  if (report.schemaVersion !== 1 || report.artifactType !== 'clearpath-technical-verification') {
    blockers.push('Technical verification schemaVersion 1 and artifact type are required.');
  }
  if (report.bindings?.canonicalCommit !== evidence.release?.canonicalCommit) {
    blockers.push('Technical verification canonical commit does not match readiness evidence.');
  }
  if (report.bindings?.projectRef !== evidence.target?.projectRef) {
    blockers.push('Technical verification backend target does not match readiness evidence.');
  }
  if (report.bindings?.packageSha256 !== evidence.migration?.packageSha256) {
    blockers.push('Technical verification package does not match readiness evidence.');
  }

  const checks = Array.isArray(report.checks) ? report.checks : [];
  const checkIds = checks.map((check) => check?.id);
  const exactIdentities = checks.length === REQUIRED_TECHNICAL_CHECKS.length
    && new Set(checkIds).size === REQUIRED_TECHNICAL_CHECKS.length
    && REQUIRED_TECHNICAL_CHECKS.every((id, index) => checkIds[index] === id);
  if (!exactIdentities) blockers.push('Technical verification must contain the exact required check identities in order, once each.');

  const passed = REQUIRED_TECHNICAL_CHECKS.filter((id) => (
    checks.some((check) => check?.id === id && check.result === 'passed')
  )).length;
  if (passed !== REQUIRED_TECHNICAL_CHECKS.length || checks.some((check) => check?.result !== 'passed')) {
    blockers.push('All required technical checks must pass.');
  }

  const startedAt = Date.parse(report.startedAt);
  const completedAt = Date.parse(report.completedAt);
  const packageValidatedAt = Date.parse(report.bindings?.packageValidatedAt);
  const checkedTimes = checks.map((check) => Date.parse(check?.checkedAt));
  const timestampsOrdered = !Number.isNaN(packageValidatedAt)
    && !Number.isNaN(startedAt)
    && !Number.isNaN(completedAt)
    && packageValidatedAt <= startedAt
    && startedAt <= completedAt
    && checkedTimes.every((checkedAt) => !Number.isNaN(checkedAt) && checkedAt >= startedAt && checkedAt <= completedAt)
    && checkedTimes.every((checkedAt, index) => index === 0 || checkedTimes[index - 1] <= checkedAt);
  if (!timestampsOrdered) blockers.push('Technical verification timestamps must be valid and ordered.');

  if (!Number.isNaN(packageValidatedAt) && !Number.isNaN(startedAt) && packageValidatedAt > startedAt) {
    blockers.push('Technical verification artifact is stale relative to source-package validation.');
  }

  return { passed: exactIdentities ? passed : 0, completedAt };
}

function validateArtifacts(evidence, observed, blockers) {
  const migration = evidence.migration || {};
  const target = evidence.target || {};
  const artifacts = evidence.artifacts || {};
  const observedArtifacts = observed.artifacts || {};
  if (!UUID_PATTERN.test(migration.runId || '')) blockers.push('Migration run ID must be a UUID.');
  if (!SHA256_PATTERN.test(migration.packageSha256 || '')) blockers.push('Migration package SHA-256 is required.');
  if (!completedText(target.projectRef) || !completedText(target.databaseServerIdentifier)
    || !completedText(target.appUrl) || !completedText(target.healthUrl)) {
    blockers.push('Production target project, database server, application URL, and health URL are required.');
  }

  const technical = validateTechnicalVerification(evidence, observedArtifacts, blockers);
  const reconciliation = artifactMatches('reconciliation', artifacts.reconciliation, observedArtifacts.reconciliation, blockers);
  const restore = artifactMatches('restore drill', artifacts.restore, observedArtifacts.restore, blockers);
  const health = artifactMatches('health', artifacts.health, observedArtifacts.health, blockers);

  if (reconciliation) {
    if (reconciliation.ok !== true || reconciliation.runId !== migration.runId) blockers.push('Reconciliation artifact run does not match readiness evidence.');
    if (reconciliation.packageSha256 !== migration.packageSha256) blockers.push('Reconciliation artifact package does not match readiness evidence.');
    if (reconciliation.target?.projectRef !== target.projectRef) blockers.push('Reconciliation artifact target does not match readiness evidence.');
    if (![reconciliation.missing, reconciliation.failed, reconciliation.runMismatches,
      reconciliation.duplicateLineage, reconciliation.extraLineage,
      reconciliation.lineageMismatches, reconciliation.targets?.missing, reconciliation.targets?.mismatched,
      reconciliation.attachments?.missing, reconciliation.attachments?.mismatched].every(emptyIssues)
      || !Object.values(reconciliation.financial?.variance || {}).every((value) => value === 0)) {
      blockers.push('Reconciliation artifact contains unresolved migration differences.');
    }
  }
  if (restore) {
    if (restore.ok !== true || restore.runId !== migration.runId) blockers.push('Restore drill artifact run does not match readiness evidence.');
    if (restore.packageSha256 !== migration.packageSha256) blockers.push('Restore drill artifact package does not match readiness evidence.');
    if (restore.databaseIdentity?.target?.serverIdentifier !== target.databaseServerIdentifier) blockers.push('Restore drill artifact target does not match readiness evidence.');
    if (restore.reconciliation?.ok !== true || restore.reconciliation?.runId !== migration.runId
      || restore.storage?.ok !== true || !SHA256_PATTERN.test(restore.storage?.manifestSha256 || '')) {
      blockers.push('Restore drill artifact lacks bound reconciliation or Storage proof.');
    }
  }
  if (health) {
    if (health.ok !== true || health.app?.url !== target.appUrl || health.health?.url !== target.healthUrl) {
      blockers.push('Health artifact target does not match readiness evidence.');
    }
    if (health.app?.status !== 200 || health.health?.status !== 200 || health.health?.database !== 'ok'
      || !emptyIssues(health.blockers)) blockers.push('Health artifact does not prove application smoke and backend health.');
  }

  const reconciliationAt = Date.parse(reconciliation?.checkedAt);
  const restoreStartedAt = Date.parse(restore?.startedAt);
  const restoreCompletedAt = Date.parse(restore?.completedAt);
  const healthAt = Date.parse(health?.checkedAt);
  if ([technical.completedAt, reconciliationAt, restoreStartedAt, restoreCompletedAt, healthAt].some(Number.isNaN)
    || technical.completedAt > reconciliationAt || reconciliationAt > restoreStartedAt
    || restoreStartedAt > restoreCompletedAt || restoreCompletedAt > healthAt) {
    blockers.push('Artifact timestamps must be valid and ordered technical verification, reconciliation, restore, then health.');
  }
  return technical.passed;
}

export function evaluateReadiness(evidence = {}, observed = {}) {
  const blockers = [];
  const release = evidence.release || {};
  const inputs = evidence.inputs || {};
  const approvals = evidence.approvals || {};
  const houses = Array.isArray(inputs.houses) ? inputs.houses : [];

  if (evidence.schemaVersion !== 1) blockers.push('Evidence schemaVersion must be 1.');
  if (houses.length !== 6 || houses.some((house) => !completedText(house?.sourceId) || !completedText(house?.name) || !completedText(house?.address))) {
    blockers.push('Exactly six houses must have source IDs, names, and addresses.');
  }
  const sourcePackage = observed.sourcePackageValidation;
  if (!validSourcePackage(sourcePackage)) {
    blockers.push('Live validation of the complete source package is required.');
  } else {
    const evidenceHouses = new Set(houses.map((house) => `${house.sourceId}|${house.name}|${house.address}`));
    const packageHouses = new Set(sourcePackage.houses.map((house) => `${house.sourceId}|${house.name}|${house.address}`));
    if (evidenceHouses.size !== 6 || packageHouses.size !== 6 || [...evidenceHouses].some((house) => !packageHouses.has(house))) {
      blockers.push('Readiness houses must exactly match the live source package.');
    }
  }
  if (sourcePackage?.packageSha256 && sourcePackage.packageSha256 !== evidence.migration?.packageSha256) {
    blockers.push('Migration package SHA-256 must match live source-package validation.');
  }

  if (!GIT_COMMIT_PATTERN.test(release.canonicalCommit || '')
    || release.canonicalCommit !== release.previewCommit || release.canonicalCommit !== release.productionCommit) {
    blockers.push('Canonical, preview, and production commit evidence must match.');
  }
  if (release.demoMode !== false) blockers.push('Production demo mode must be disabled.');
  if (release.authBypass !== false) blockers.push('Production authentication bypass must be disabled.');

  const passedTechnicalGates = validateArtifacts(evidence, observed, blockers);

  if (approvals.slade?.approved !== true || !validTimestamp(approvals.slade?.approvedAt)) {
    blockers.push('Slade approval with timestamp is required.');
  }
  const representatives = Array.isArray(approvals.houseRepresentatives) ? approvals.houseRepresentatives : [];
  const houseNames = new Set(houses.map((house) => house?.name));
  const approvedHouseNames = new Set(representatives.map((approval) => approval?.house));
  if (representatives.length !== 6
      || approvedHouseNames.size !== 6
      || [...approvedHouseNames].some((house) => !houseNames.has(house))
      || representatives.some((approval) => !completedText(approval?.house) || approval.approved !== true || !validTimestamp(approval.approvedAt))) {
    blockers.push('Approval with timestamp is required from one representative for each of the six houses.');
  }

  return {
    ready: blockers.length === 0,
    checkedAt: new Date().toISOString(),
    blockers,
    bindings: {
      runId: evidence.migration?.runId || null,
      packageSha256: evidence.migration?.packageSha256 || null,
      projectRef: evidence.target?.projectRef || null,
      artifactSha256: {
        technicalVerification: evidence.artifacts?.technicalVerification?.sha256 || null,
        reconciliation: evidence.artifacts?.reconciliation?.sha256 || null,
        restore: evidence.artifacts?.restore?.sha256 || null,
        health: evidence.artifacts?.health?.sha256 || null,
      },
    },
    counts: {
      houses: houses.length,
      houseApprovals: representatives.filter((approval) => approval?.approved === true).length,
      passedTechnicalGates,
      requiredTechnicalGates: REQUIRED_TECHNICAL_CHECKS.length,
      sourcePackageFiles: sourcePackage?.counts?.sourceFiles || 0,
    },
  };
}

async function observeSourcePackage(evidence, evidencePath) {
  const manifestReference = evidence?.inputs?.sourcePackageManifest;
  if (typeof manifestReference !== 'string') return { sourcePackageValidation: null };
  try {
    const manifestPath = await realpath(resolve(dirname(resolve(evidencePath)), manifestReference));
    if (basename(dirname(manifestPath)) !== '.migration-input') throw new Error('Source manifest must be inside .migration-input.');
    return { sourcePackageValidation: await validateSourcePackage(manifestPath) };
  } catch (error) {
    return { sourcePackageValidation: { ok: false, blockers: [`Unable to validate source package: ${error.message}`] } };
  }
}

async function observeArtifact(reference, evidencePath) {
  if (!completedText(reference?.path)) return null;
  const evidenceDirectory = await realpath(dirname(resolve(evidencePath)));
  const artifactPath = await realpath(resolve(evidenceDirectory, reference.path));
  const relation = relative(evidenceDirectory, artifactPath);
  if (relation.startsWith('..') || relation === '') throw new Error('Artifact path must stay inside the readiness evidence directory.');
  const content = await readFile(artifactPath);
  return {
    path: artifactPath,
    sha256: createHash('sha256').update(content).digest('hex'),
    report: JSON.parse(content.toString('utf8')),
  };
}

async function observeArtifacts(evidence, evidencePath) {
  const artifacts = {};
  for (const name of ['technicalVerification', 'reconciliation', 'restore', 'health']) {
    try {
      artifacts[name] = await observeArtifact(evidence?.artifacts?.[name], evidencePath);
    } catch (error) {
      artifacts[name] = { error: error.message };
    }
  }
  return { artifacts };
}

async function main(argv = process.argv.slice(2)) {
  const [evidencePath, reportFlag, reportPath] = argv;
  if (!evidencePath || (reportFlag && reportFlag !== '--report') || (reportFlag === '--report' && !reportPath)) {
    throw new Error('Usage: readiness:check <evidence.json> [--report <report.json>]');
  }
  const evidence = JSON.parse(await readFile(resolve(evidencePath), 'utf8'));
  const observed = {
    ...await observeSourcePackage(evidence, evidencePath),
    ...await observeArtifacts(evidence, evidencePath),
  };
  const result = evaluateReadiness(evidence, observed);
  const output = `${JSON.stringify(result, null, 2)}\n`;
  if (reportPath) await writeFile(resolve(reportPath), output, { mode: 0o600 });
  process.stdout.write(output);
  if (!result.ready) process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
