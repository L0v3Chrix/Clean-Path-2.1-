import { createHash } from 'node:crypto';
import { readFile, realpath, writeFile } from 'node:fs/promises';
import { basename, dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyMigrationReport } from '../migration/report-integrity.mjs';
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
const HOUSE_METRIC_FIELDS = ['counts', 'statuses', 'attachments', 'financial'];
const FINANCIAL_FIELDS = ['fees', 'payments', 'balance'];
const NUMBER_EPSILON = 1e-9;

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

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function validCountMap(value) {
  return isRecord(value)
    && Object.values(value).every((count) => Number.isInteger(count) && count >= 0);
}

function validStatusMap(value) {
  return isRecord(value) && Object.values(value).every(validCountMap);
}

function validFinancial(value) {
  return isRecord(value)
    && hasExactKeys(value, FINANCIAL_FIELDS)
    && FINANCIAL_FIELDS.every((field) => Number.isFinite(value[field]));
}

function validHouseMetrics(value) {
  return isRecord(value)
    && hasExactKeys(value, HOUSE_METRIC_FIELDS)
    && validCountMap(value.counts)
    && validStatusMap(value.statuses)
    && Number.isInteger(value.attachments)
    && value.attachments >= 0
    && validFinancial(value.financial);
}

function hasExactKeys(value, expectedKeys) {
  if (!isRecord(value)) return false;
  const actualKeys = Object.keys(value);
  return actualKeys.length === expectedKeys.length
    && actualKeys.every((key) => expectedKeys.includes(key));
}

function validZeroVariance(expected, actual, variance) {
  if (typeof expected === 'number' || typeof actual === 'number' || typeof variance === 'number') {
    if (![expected, actual, variance].every(Number.isFinite)) return false;
    const recomputedVariance = actual - expected;
    return Math.abs(recomputedVariance - variance) <= NUMBER_EPSILON
      && Math.abs(recomputedVariance) <= NUMBER_EPSILON;
  }
  if (![expected, actual, variance].every(isRecord)) return false;
  const expectedKeys = Object.keys(expected);
  return hasExactKeys(actual, expectedKeys)
    && hasExactKeys(variance, expectedKeys)
    && expectedKeys.every((key) => validZeroVariance(expected[key], actual[key], variance[key]));
}

function validSixHouseReconciliation(reconciliation, expectedHouseIds) {
  const houses = reconciliation?.houses;
  if (!isRecord(houses) || expectedHouseIds.length !== 6 || new Set(expectedHouseIds).size !== 6) return false;
  const observedHouseIds = Object.keys(houses);
  if (observedHouseIds.length !== 6 || observedHouseIds.some((houseId) => !expectedHouseIds.includes(houseId))) return false;
  return expectedHouseIds.every((houseId) => {
    const house = houses[houseId];
    return isRecord(house)
      && validHouseMetrics(house.expected)
      && validHouseMetrics(house.actual)
      && isRecord(house.variance)
      && validZeroVariance(house.expected, house.actual, house.variance)
      && emptyIssues(house.scopeMismatches);
  });
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

function signedArtifact(name, declared, observed, blockers, signingKey) {
  const report = artifactMatches(name, declared, observed, blockers);
  if (report && !verifyMigrationReport(report, signingKey)) {
    blockers.push(`${name} artifact integrity verification failed.`);
    return null;
  }
  return report;
}

function normalizeSigningKeys(value) {
  if (typeof value === 'string') {
    return { migration: value, evidence: value, approvals: value };
  }
  return {
    migration: value?.migration || '',
    evidence: value?.evidence || '',
    approvals: value?.approvals || '',
  };
}

function validateTechnicalVerification(evidence, observedArtifacts, blockers, signingKey) {
  const report = signedArtifact(
    'technical verification',
    evidence.artifacts?.technicalVerification,
    observedArtifacts.technicalVerification,
    blockers,
    signingKey,
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

function validateReleaseEvidence(name, environment, evidence, observedArtifacts, blockers, signingKey) {
  const artifactName = environment === 'preview' ? 'previewRelease' : 'productionRelease';
  const report = signedArtifact(
    `${name} release`, evidence.artifacts?.[artifactName], observedArtifacts[artifactName], blockers,
    signingKey,
  );
  if (!report) return { checkedAt: Number.NaN, deploymentId: null };

  const deployment = report.deployment || {};
  const compiledRelease = report.release || {};
  const canonicalCommit = evidence.release?.canonicalCommit;
  const target = evidence.target || {};
  if (report.schemaVersion !== 1 || report.artifactType !== 'clearpath-release-evidence') {
    blockers.push(`${name} release evidence schemaVersion 1 and artifact type are required.`);
  }
  if (report.ok !== true || !emptyIssues(report.blockers)) {
    blockers.push(`${name} release evidence did not pass its deployment checks.`);
  }
  if (report.environment !== environment) {
    blockers.push(`${name} release evidence has the wrong deployment environment.`);
  }
  if (!validTimestamp(report.checkedAt)) {
    blockers.push(`${name} release evidence requires a valid checkedAt timestamp.`);
  }
  if (!completedText(deployment.id) || !completedText(deployment.url)
    || deployment.status !== 'READY' || deployment.source !== 'git') {
    blockers.push(`${name} release evidence must identify a READY Git deployment.`);
  }
  if (!GIT_COMMIT_PATTERN.test(canonicalCommit || '')
    || report.canonicalCommit !== canonicalCommit
    || deployment.gitSha !== canonicalCommit
    || compiledRelease.commit !== canonicalCommit) {
    blockers.push(`${name} release commit does not match the canonical Git commit.`);
  }
  if (deployment.projectId !== target.vercelProjectId
    || deployment.projectName !== target.vercelProjectName) {
    blockers.push(`${name} release Vercel project does not match the production target.`);
  }
  if (compiledRelease.schemaVersion !== 1 || compiledRelease.projectRef !== target.projectRef) {
    blockers.push(`${name} release backend does not match the production Supabase target.`);
  }
  if (compiledRelease.demoMode !== false) {
    blockers.push(`${name} release demo mode must be disabled.`);
  }
  if (compiledRelease.authBypass !== false) {
    blockers.push(`${name} release authentication bypass must be disabled.`);
  }
  return { checkedAt: Date.parse(report.checkedAt), deploymentId: deployment.id || null };
}

function validateArtifacts(evidence, observed, blockers, signingKeys) {
  const migration = evidence.migration || {};
  const target = evidence.target || {};
  const artifacts = evidence.artifacts || {};
  const observedArtifacts = observed?.artifacts || {};
  if (!UUID_PATTERN.test(migration.runId || '')) blockers.push('Migration run ID must be a UUID.');
  if (!SHA256_PATTERN.test(migration.packageSha256 || '')) blockers.push('Migration package SHA-256 is required.');
  if (!completedText(target.projectRef) || !completedText(target.databaseServerIdentifier)
    || !completedText(target.appUrl) || !completedText(target.healthUrl)) {
    blockers.push('Production target project, database server, application URL, and health URL are required.');
  }

  const previewRelease = validateReleaseEvidence(
    'Preview', 'preview', evidence, observedArtifacts, blockers, signingKeys.evidence,
  );
  const productionRelease = validateReleaseEvidence(
    'Production', 'production', evidence, observedArtifacts, blockers, signingKeys.evidence,
  );
  const technical = validateTechnicalVerification(
    evidence, observedArtifacts, blockers, signingKeys.evidence,
  );
  const reconciliationArtifact = artifactMatches(
    'reconciliation', artifacts.reconciliation, observedArtifacts.reconciliation, blockers,
  );
  const reconciliationIntegrityValid = verifyMigrationReport(reconciliationArtifact, signingKeys.migration);
  if (reconciliationArtifact && !reconciliationIntegrityValid) {
    blockers.push('Reconciliation artifact integrity verification failed.');
  }
  const reconciliation = reconciliationIntegrityValid ? reconciliationArtifact : null;
  const restore = signedArtifact(
    'restore drill', artifacts.restore, observedArtifacts.restore, blockers, signingKeys.evidence,
  );
  const health = signedArtifact(
    'health', artifacts.health, observedArtifacts.health, blockers, signingKeys.evidence,
  );

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
    const expectedHouseIds = (evidence.inputs?.houses || []).map((house) => house?.sourceId);
    if (!validSixHouseReconciliation(reconciliation, expectedHouseIds)) {
      blockers.push('Reconciliation artifact must contain an exact, zero-variance six-house reconciliation matrix.');
    }
  }
  if (restore) {
    if (restore.schemaVersion !== 1 || restore.artifactType !== 'clearpath-restore-drill') {
      blockers.push('Restore drill schemaVersion 1 and artifact type are required.');
    }
    if (restore.ok !== true || restore.runId !== migration.runId) blockers.push('Restore drill artifact run does not match readiness evidence.');
    if (restore.packageSha256 !== migration.packageSha256) blockers.push('Restore drill artifact package does not match readiness evidence.');
    if (restore.databaseIdentity?.target?.serverIdentifier !== target.databaseServerIdentifier) blockers.push('Restore drill artifact target does not match readiness evidence.');
    if (restore.reconciliation?.ok !== true || restore.reconciliation?.runId !== migration.runId
      || restore.storage?.ok !== true || !SHA256_PATTERN.test(restore.storage?.manifestSha256 || '')) {
      blockers.push('Restore drill artifact lacks bound reconciliation or Storage proof.');
    }
  }
  if (health) {
    if (health.schemaVersion !== 1 || health.artifactType !== 'clearpath-health-evidence') {
      blockers.push('Health schemaVersion 1 and artifact type are required.');
    }
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
  if ([previewRelease.checkedAt, technical.completedAt, reconciliationAt, restoreStartedAt,
    restoreCompletedAt, productionRelease.checkedAt, healthAt].some(Number.isNaN)
    || previewRelease.checkedAt > technical.completedAt
    || technical.completedAt > reconciliationAt || reconciliationAt > restoreStartedAt
    || restoreStartedAt > restoreCompletedAt || restoreCompletedAt > productionRelease.checkedAt
    || productionRelease.checkedAt > healthAt) {
    blockers.push('Artifact timestamps must be valid and ordered preview release, technical verification, reconciliation, restore, production release, then final health.');
  }
  return {
    passedTechnicalGates: technical.passed,
    healthAt,
    productionDeploymentId: productionRelease.deploymentId,
  };
}

function validateApprovals(evidence, observed, blockers, signingKey, artifactResult) {
  const approvals = signedArtifact(
    'cutover approvals',
    evidence.artifacts?.approvals,
    observed?.artifacts?.approvals,
    blockers,
    signingKey,
  );
  if (!approvals) return { houseApprovals: 0 };

  if (approvals.schemaVersion !== 1 || approvals.artifactType !== 'clearpath-cutover-approvals') {
    blockers.push('Cutover approvals schemaVersion 1 and artifact type are required.');
  }

  const expectedBindings = {
    canonicalCommit: evidence.release?.canonicalCommit,
    runId: evidence.migration?.runId,
    packageSha256: evidence.migration?.packageSha256,
    productionDeploymentId: artifactResult.productionDeploymentId,
  };
  if (!hasExactKeys(approvals.bindings, Object.keys(expectedBindings))
    || Object.entries(expectedBindings).some(([key, value]) => approvals.bindings?.[key] !== value)) {
    blockers.push('Cutover approvals are not bound to the accepted commit, migration package, run, and production deployment.');
  }

  const completedAt = Date.parse(approvals.completedAt);
  const slade = approvals.slade || {};
  if (!completedText(slade.name) || !completedText(slade.role)
    || slade.approved !== true || !validTimestamp(slade.approvedAt)) {
    blockers.push('Slade approval with identity, role, and timestamp is required.');
  }

  const houses = Array.isArray(evidence.inputs?.houses) ? evidence.inputs.houses : [];
  const representatives = Array.isArray(approvals.houseRepresentatives)
    ? approvals.houseRepresentatives
    : [];
  const expectedHouseIdentities = houses.map((house) => `${house?.sourceId}|${house?.name}`);
  const approvedHouseIdentities = representatives.map((approval) => `${approval?.sourceId}|${approval?.house}`);
  const exactRepresentatives = representatives.length === 6
    && new Set(expectedHouseIdentities).size === 6
    && new Set(approvedHouseIdentities).size === 6
    && approvedHouseIdentities.every((identity) => expectedHouseIdentities.includes(identity))
    && representatives.every((approval) => completedText(approval?.sourceId)
      && completedText(approval?.house)
      && completedText(approval?.name)
      && completedText(approval?.role)
      && approval?.approved === true
      && validTimestamp(approval?.approvedAt));
  if (!exactRepresentatives) {
    blockers.push('Approval with identity, role, and timestamp is required from one representative for each exact house.');
  }

  const approvalTimes = [slade.approvedAt, ...representatives.map((approval) => approval?.approvedAt)]
    .map((value) => Date.parse(value));
  if (Number.isNaN(completedAt)
    || Number.isNaN(artifactResult.healthAt)
    || approvalTimes.some(Number.isNaN)
    || approvalTimes.some((approvedAt) => approvedAt < artifactResult.healthAt || approvedAt > completedAt)
    || completedAt < artifactResult.healthAt) {
    blockers.push('Cutover approvals must be completed after final production health, with ordered valid timestamps.');
  }

  return {
    houseApprovals: exactRepresentatives
      ? representatives.filter((approval) => approval.approved === true).length
      : 0,
  };
}

export function evaluateReadiness(
  evidence = {},
  observed = {},
  signingKeys = {
    migration: process.env.MIGRATION_REPORT_SIGNING_KEY,
    evidence: process.env.CLEARPATH_EVIDENCE_SIGNING_KEY,
    approvals: process.env.CUTOVER_APPROVAL_SIGNING_KEY,
  },
) {
  const blockers = [];
  const release = evidence.release || {};
  const inputs = evidence.inputs || {};
  const houses = Array.isArray(inputs.houses) ? inputs.houses : [];
  const normalizedSigningKeys = normalizeSigningKeys(signingKeys);

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

  if (!GIT_COMMIT_PATTERN.test(release.canonicalCommit || '')) {
    blockers.push('A full canonical Git commit is required.');
  }

  const artifactResult = validateArtifacts(evidence, observed, blockers, normalizedSigningKeys);
  const approvalResult = validateApprovals(
    evidence,
    observed,
    blockers,
    normalizedSigningKeys.approvals,
    artifactResult,
  );

  return {
    ready: blockers.length === 0,
    checkedAt: new Date().toISOString(),
    blockers,
    bindings: {
      runId: evidence.migration?.runId || null,
      packageSha256: evidence.migration?.packageSha256 || null,
      projectRef: evidence.target?.projectRef || null,
      artifactSha256: {
        previewRelease: evidence.artifacts?.previewRelease?.sha256 || null,
        productionRelease: evidence.artifacts?.productionRelease?.sha256 || null,
        technicalVerification: evidence.artifacts?.technicalVerification?.sha256 || null,
        reconciliation: evidence.artifacts?.reconciliation?.sha256 || null,
        restore: evidence.artifacts?.restore?.sha256 || null,
        health: evidence.artifacts?.health?.sha256 || null,
        approvals: evidence.artifacts?.approvals?.sha256 || null,
      },
    },
    counts: {
      houses: houses.length,
      houseApprovals: approvalResult.houseApprovals,
      passedTechnicalGates: artifactResult.passedTechnicalGates,
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
  for (const name of [
    'previewRelease', 'productionRelease', 'technicalVerification', 'reconciliation', 'restore', 'health',
    'approvals',
  ]) {
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
