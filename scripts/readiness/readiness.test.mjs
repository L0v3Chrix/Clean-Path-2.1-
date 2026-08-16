import { describe, expect, it } from 'vitest';
import { signMigrationReport } from '../migration/report-integrity.mjs';
import { evaluateReadiness } from './readiness.mjs';

const signingKey = 'readiness-test-secret';

function signReport(report) {
  return signMigrationReport(report, signingKey);
}

function resignArtifact(observed, name) {
  observed.artifacts[name].report = signReport(observed.artifacts[name].report);
  return observed;
}

function resignReconciliation(observed) {
  return resignArtifact(observed, 'reconciliation');
}

function completeEvidence() {
  return {
    schemaVersion: 1,
    release: {
      canonicalCommit: 'a'.repeat(40),
    },
    migration: {
      runId: '11111111-1111-4111-8111-111111111111',
      packageSha256: 'b'.repeat(64),
    },
    target: {
      projectRef: 'clearpath-prod',
      vercelProjectId: 'prj_clearpath',
      vercelProjectName: 'clearpath-rcl-mvp',
      databaseServerIdentifier: 'restore-cluster',
      appUrl: 'https://clearpath.example',
      healthUrl: 'https://clearpath-prod.supabase.co/functions/v1/health',
    },
    inputs: {
      houses: Array.from({ length: 6 }, (_, index) => ({
        sourceId: `h-${index + 1}`,
        name: `House ${index + 1}`,
        address: `${index + 1} Main St`,
      })),
      sourcePackageManifest: '../.migration-input/manifest.json',
    },
    artifacts: {
      previewRelease: { path: 'preview-release.json', sha256: '7'.repeat(64) },
      productionRelease: { path: 'production-release.json', sha256: '8'.repeat(64) },
      technicalVerification: { path: 'technical-verification.json', sha256: '9'.repeat(64) },
      reconciliation: { path: 'reconciliation.json', sha256: 'c'.repeat(64) },
      restore: { path: 'restore-drill.json', sha256: 'd'.repeat(64) },
      health: { path: 'health.json', sha256: 'e'.repeat(64) },
      approvals: { path: 'cutover-approvals.json', sha256: 'f'.repeat(64) },
    },
  };
}

function completeObserved() {
  const runId = '11111111-1111-4111-8111-111111111111';
  const packageSha256 = 'b'.repeat(64);
  const reconciliation = {
    ok: true,
    checkedAt: '2026-08-16T10:00:00Z',
    runId,
    packageSha256,
    target: { projectRef: 'clearpath-prod' },
    runMismatches: [],
    duplicateLineage: [],
    extraLineage: [],
    lineageMismatches: [],
    missing: [],
    failed: [],
    targets: { missing: [], mismatched: [] },
    attachments: { missing: [], mismatched: [] },
    financial: { variance: { fees: 0, payments: 0, balance: 0 } },
    houses: Object.fromEntries(Array.from({ length: 6 }, (_, index) => [
      `h-${index + 1}`,
      {
        expected: {
          counts: { locations: 1 },
          statuses: { locations: { active: 1 } },
          attachments: 0,
          financial: { fees: 0, payments: 0, balance: 0 },
        },
        actual: {
          counts: { locations: 1 },
          statuses: { locations: { active: 1 } },
          attachments: 0,
          financial: { fees: 0, payments: 0, balance: 0 },
        },
        variance: {
          counts: { locations: 0 },
          statuses: { locations: { active: 0 } },
          attachments: 0,
          financial: { fees: 0, payments: 0, balance: 0 },
        },
        scopeMismatches: [],
      },
    ])),
  };
  const observed = {
    sourcePackageValidation: {
        ok: true,
        checkedAt: '2026-08-14T12:00:00Z',
        manifestSha256: 'a'.repeat(64),
        packageSha256: 'b'.repeat(64),
        houses: Array.from({ length: 6 }, (_, index) => ({
          sourceId: `h-${index + 1}`,
          name: `House ${index + 1}`,
          address: `${index + 1} Main St`,
        })),
        counts: {
          houses: 6,
          sourceFiles: 14,
          requiredSourceFiles: 14,
          sourceCountRows: 84,
          dictionaryRows: 100,
          staffUsers: 12,
          financialHouses: 6,
        },
        blockers: [],
      },
    artifacts: {
      previewRelease: {
        path: '/evidence/preview-release.json',
        sha256: '7'.repeat(64),
        report: {
          schemaVersion: 1,
          artifactType: 'clearpath-release-evidence',
          checkedAt: '2026-08-16T08:40:00Z',
          environment: 'preview',
          canonicalCommit: 'a'.repeat(40),
          deployment: {
            id: 'dpl_preview',
            url: 'https://preview.clearpath.example',
            projectId: 'prj_clearpath',
            projectName: 'clearpath-rcl-mvp',
            status: 'READY',
            source: 'git',
            gitSha: 'a'.repeat(40),
          },
          release: {
            schemaVersion: 1,
            commit: 'a'.repeat(40),
            demoMode: false,
            authBypass: false,
            projectRef: 'clearpath-prod',
          },
          ok: true,
          blockers: [],
        },
      },
      productionRelease: {
        path: '/evidence/production-release.json',
        sha256: '8'.repeat(64),
        report: {
          schemaVersion: 1,
          artifactType: 'clearpath-release-evidence',
          checkedAt: '2026-08-16T10:15:00Z',
          environment: 'production',
          canonicalCommit: 'a'.repeat(40),
          deployment: {
            id: 'dpl_production',
            url: 'https://clearpath.example',
            projectId: 'prj_clearpath',
            projectName: 'clearpath-rcl-mvp',
            status: 'READY',
            source: 'git',
            gitSha: 'a'.repeat(40),
          },
          release: {
            schemaVersion: 1,
            commit: 'a'.repeat(40),
            demoMode: false,
            authBypass: false,
            projectRef: 'clearpath-prod',
          },
          ok: true,
          blockers: [],
        },
      },
      technicalVerification: {
        path: '/evidence/technical-verification.json',
        sha256: '9'.repeat(64),
        report: {
          schemaVersion: 1,
          artifactType: 'clearpath-technical-verification',
          startedAt: '2026-08-16T09:00:00Z',
          completedAt: '2026-08-16T09:10:00Z',
          bindings: {
            canonicalCommit: 'a'.repeat(40),
            projectRef: 'clearpath-prod',
            packageSha256,
            packageValidatedAt: '2026-08-16T08:55:00Z',
          },
          checks: [
            { id: 'rls-role-cross-house', result: 'passed', checkedAt: '2026-08-16T09:01:00Z' },
            { id: 'private-storage-access', result: 'passed', checkedAt: '2026-08-16T09:03:00Z' },
            { id: 'public-intake', result: 'passed', checkedAt: '2026-08-16T09:05:00Z' },
            { id: 'staff-access', result: 'passed', checkedAt: '2026-08-16T09:07:00Z' },
            { id: 'automated-checks', result: 'passed', checkedAt: '2026-08-16T09:09:00Z' },
          ],
        },
      },
      reconciliation: {
        path: '/evidence/reconciliation.json',
        sha256: 'c'.repeat(64),
        report: signReport(reconciliation),
      },
      restore: {
        path: '/evidence/restore-drill.json',
        sha256: 'd'.repeat(64),
        report: {
          schemaVersion: 1,
          artifactType: 'clearpath-restore-drill',
          ok: true,
          runId,
          packageSha256,
          startedAt: '2026-08-16T10:05:00Z',
          completedAt: '2026-08-16T10:10:00Z',
          restoreTarget: 'postgresql://restore.example/postgres',
          databaseIdentity: { target: { serverIdentifier: 'restore-cluster', databaseOid: '16384' } },
          reconciliation: { ok: true, runId },
          storage: { ok: true, manifestSha256: 'f'.repeat(64) },
        },
      },
      health: {
        path: '/evidence/health.json',
        sha256: 'e'.repeat(64),
        report: {
          schemaVersion: 1,
          artifactType: 'clearpath-health-evidence',
          ok: true,
          checkedAt: '2026-08-16T10:20:00Z',
          app: { url: 'https://clearpath.example', status: 200 },
          health: {
            url: 'https://clearpath-prod.supabase.co/functions/v1/health',
            status: 200,
            database: 'ok',
          },
          blockers: [],
        },
      },
      approvals: {
        path: '/evidence/cutover-approvals.json',
        sha256: 'f'.repeat(64),
        report: {
          schemaVersion: 1,
          artifactType: 'clearpath-cutover-approvals',
          bindings: {
            canonicalCommit: 'a'.repeat(40),
            runId,
            packageSha256,
            productionDeploymentId: 'dpl_production',
          },
          completedAt: '2026-08-16T10:40:00Z',
          slade: {
            name: 'Slade',
            role: 'Product and data owner',
            approved: true,
            approvedAt: '2026-08-16T10:30:00Z',
          },
          houseRepresentatives: Array.from({ length: 6 }, (_, index) => ({
            sourceId: `h-${index + 1}`,
            house: `House ${index + 1}`,
            name: `Representative ${index + 1}`,
            role: 'House representative',
            approved: true,
            approvedAt: '2026-08-16T10:35:00Z',
          })),
        },
      },
    },
  };
  for (const name of ['previewRelease', 'productionRelease', 'technicalVerification', 'restore', 'health', 'approvals']) {
    resignArtifact(observed, name);
  }
  return observed;
}

describe('cutover readiness evaluation', () => {
  it('passes only complete evidence with matching commits and six approvals', () => {
    const result = evaluateReadiness(completeEvidence(), completeObserved(), signingKey);
    expect(result.ready).toBe(true);
    expect(result.blockers).toEqual([]);
    expect(result.bindings).toEqual({
      runId: '11111111-1111-4111-8111-111111111111',
      packageSha256: 'b'.repeat(64),
      projectRef: 'clearpath-prod',
      artifactSha256: {
        previewRelease: '7'.repeat(64),
        productionRelease: '8'.repeat(64),
        technicalVerification: '9'.repeat(64),
        reconciliation: 'c'.repeat(64),
        restore: 'd'.repeat(64),
        health: 'e'.repeat(64),
        approvals: 'f'.repeat(64),
      },
    });
  });

  it('fails closed when external inputs, restore proof, or approvals are missing', () => {
    const evidence = completeEvidence();
    evidence.inputs.houses = evidence.inputs.houses.slice(0, 5);
    delete evidence.artifacts.restore;
    const observed = completeObserved();
    observed.artifacts.approvals.report.slade.approved = false;
    resignArtifact(observed, 'approvals');

    const result = evaluateReadiness(evidence, observed, signingKey);
    expect(result.ready).toBe(false);
    expect(result.blockers).toEqual(expect.arrayContaining([
      expect.stringContaining('six houses'),
      expect.stringContaining('restore drill'),
      expect.stringContaining('Slade approval'),
    ]));
  });

  it('rejects artifact content whose computed hash differs from readiness evidence', () => {
    const evidence = completeEvidence();
    const observed = completeObserved();
    observed.artifacts.reconciliation.sha256 = '0'.repeat(64);

    const result = evaluateReadiness(evidence, observed, signingKey);

    expect(result.ready).toBe(false);
    expect(result.blockers.join('\n')).toMatch(/reconciliation artifact hash/i);
  });

  it('rejects unsigned reconciliation even when its file hash and fields match', () => {
    const evidence = completeEvidence();
    const observed = completeObserved();
    delete observed.artifacts.reconciliation.report.integrity;

    const result = evaluateReadiness(evidence, observed, signingKey);

    expect(result.ready).toBe(false);
    expect(result.blockers.join('\n')).toMatch(/reconciliation.*integrity/i);
  });

  it('rejects an invalid reconciliation HMAC even when its file hash and fields match', () => {
    const evidence = completeEvidence();
    const observed = completeObserved();
    observed.artifacts.reconciliation.report.integrity.signature = '0'.repeat(64);

    const result = evaluateReadiness(evidence, observed, signingKey);

    expect(result.ready).toBe(false);
    expect(result.blockers.join('\n')).toMatch(/reconciliation.*integrity/i);
  });

  it('fails closed when the reconciliation signing key is unavailable', () => {
    const result = evaluateReadiness(completeEvidence(), completeObserved(), '');

    expect(result.ready).toBe(false);
    expect(result.blockers.join('\n')).toMatch(/reconciliation.*integrity/i);
  });

  it.each(['previewRelease', 'productionRelease', 'technicalVerification', 'restore', 'health'])(
    'rejects an unsigned %s operational artifact',
    (name) => {
      const observed = completeObserved();
      delete observed.artifacts[name].report.integrity;

      const result = evaluateReadiness(completeEvidence(), observed, signingKey);

      expect(result.ready).toBe(false);
      expect(result.blockers.join('\n')).toMatch(/artifact integrity verification failed/i);
    },
  );

  it('rejects unsigned or tampered cutover approvals', () => {
    const unsigned = completeObserved();
    delete unsigned.artifacts.approvals.report.integrity;
    const unsignedResult = evaluateReadiness(completeEvidence(), unsigned, signingKey);

    const tampered = completeObserved();
    tampered.artifacts.approvals.report.integrity.signature = '0'.repeat(64);
    const tamperedResult = evaluateReadiness(completeEvidence(), tampered, signingKey);

    expect(unsignedResult.ready).toBe(false);
    expect(unsignedResult.blockers.join('\n')).toMatch(/cutover approvals.*integrity/i);
    expect(tamperedResult.ready).toBe(false);
    expect(tamperedResult.blockers.join('\n')).toMatch(/cutover approvals.*integrity/i);
  });

  it('rejects approvals that predate final production health', () => {
    const observed = completeObserved();
    observed.artifacts.approvals.report.slade.approvedAt = '2026-08-16T10:19:00Z';
    resignArtifact(observed, 'approvals');

    const result = evaluateReadiness(completeEvidence(), observed, signingKey);

    expect(result.ready).toBe(false);
    expect(result.blockers.join('\n')).toMatch(/after final production health/i);
  });

  it('rejects approvals with drifted bindings or house identities', () => {
    const observed = completeObserved();
    observed.artifacts.approvals.report.bindings.productionDeploymentId = 'dpl_other';
    observed.artifacts.approvals.report.houseRepresentatives[0].sourceId = 'h-other';
    resignArtifact(observed, 'approvals');

    const result = evaluateReadiness(completeEvidence(), observed, signingKey);

    expect(result.ready).toBe(false);
    expect(result.blockers.join('\n')).toMatch(/not bound to the accepted commit.*production deployment/i);
    expect(result.blockers.join('\n')).toMatch(/representative for each exact house/i);
  });

  it('rejects reconciliation without an exact six-house matrix', () => {
    const evidence = completeEvidence();
    const observed = completeObserved();
    delete observed.artifacts.reconciliation.report.houses['h-6'];
    resignReconciliation(observed);

    const result = evaluateReadiness(evidence, observed, signingKey);

    expect(result.ready).toBe(false);
    expect(result.blockers.join('\n')).toMatch(/six-house reconciliation/i);
  });

  it('rejects any nonzero per-house reconciliation variance', () => {
    const evidence = completeEvidence();
    const observed = completeObserved();
    observed.artifacts.reconciliation.report.houses['h-3'].variance.counts.residents = -1;
    resignReconciliation(observed);

    const result = evaluateReadiness(evidence, observed, signingKey);

    expect(result.ready).toBe(false);
    expect(result.blockers.join('\n')).toMatch(/six-house reconciliation/i);
  });

  it('recomputes reconciliation variance instead of trusting an empty declared variance', () => {
    const evidence = completeEvidence();
    const observed = completeObserved();
    const house = observed.artifacts.reconciliation.report.houses['h-3'];
    house.expected.counts.residents = 10;
    house.actual.counts.residents = 9;
    house.variance = {};
    resignReconciliation(observed);

    const result = evaluateReadiness(evidence, observed, signingKey);

    expect(result.ready).toBe(false);
    expect(result.blockers.join('\n')).toMatch(/six-house reconciliation/i);
  });

  it.each([
    {
      label: 'extra entity',
      mutate(house) {
        house.actual.counts.residents = 0;
        house.variance.counts.residents = 0;
      },
    },
    {
      label: 'missing status',
      mutate(house) {
        delete house.variance.statuses.locations.active;
      },
    },
    {
      label: 'missing attachment variance',
      mutate(house) {
        delete house.variance.attachments;
      },
    },
    {
      label: 'extra financial field',
      mutate(house) {
        house.expected.financial.credits = 0;
        house.actual.financial.credits = 0;
        house.variance.financial.credits = 0;
      },
    },
  ])('rejects $label keys in a house reconciliation matrix', ({ mutate }) => {
    const evidence = completeEvidence();
    const observed = completeObserved();
    mutate(observed.artifacts.reconciliation.report.houses['h-2']);
    resignReconciliation(observed);

    const result = evaluateReadiness(evidence, observed, signingKey);

    expect(result.ready).toBe(false);
    expect(result.blockers.join('\n')).toMatch(/six-house reconciliation/i);
  });

  it('rejects caller-edited technical booleans without a verification artifact', () => {
    const evidence = completeEvidence();
    evidence.technical = {
      rlsVerified: true,
      storageVerified: true,
      publicIntakeVerified: true,
      staffAccessVerified: true,
      automatedChecksPassed: true,
    };
    delete evidence.artifacts.technicalVerification;
    const observed = completeObserved();
    delete observed.artifacts.technicalVerification;

    const result = evaluateReadiness(evidence, observed, signingKey);

    expect(result.ready).toBe(false);
    expect(result.blockers.join('\n')).toMatch(/technical verification artifact path and SHA-256/i);
    expect(result.counts.passedTechnicalGates).toBe(0);
  });

  it('rejects a tampered technical verification artifact', () => {
    const evidence = completeEvidence();
    const observed = completeObserved();
    observed.artifacts.technicalVerification.sha256 = '0'.repeat(64);

    const result = evaluateReadiness(evidence, observed, signingKey);

    expect(result.ready).toBe(false);
    expect(result.blockers.join('\n')).toMatch(/technical verification artifact hash/i);
  });

  it('rejects technical verification for a different commit, backend, or package', () => {
    const evidence = completeEvidence();
    const observed = completeObserved();
    observed.artifacts.technicalVerification.report.bindings = {
      canonicalCommit: 'f'.repeat(40),
      projectRef: 'other-project',
      packageSha256: '0'.repeat(64),
    };
    resignArtifact(observed, 'technicalVerification');

    const result = evaluateReadiness(evidence, observed, signingKey);

    expect(result.ready).toBe(false);
    expect(result.blockers.join('\n')).toMatch(/technical verification.*commit/i);
    expect(result.blockers.join('\n')).toMatch(/technical verification.*backend/i);
    expect(result.blockers.join('\n')).toMatch(/technical verification.*package/i);
  });

  it('rejects malformed, failed, duplicate, missing, or out-of-order technical checks', () => {
    const evidence = completeEvidence();
    const observed = completeObserved();
    const report = observed.artifacts.technicalVerification.report;
    report.schemaVersion = 2;
    report.checks[1].result = 'failed';
    report.checks[2].id = 'rls-role-cross-house';
    report.checks[3].checkedAt = '2026-08-16T08:00:00Z';
    resignArtifact(observed, 'technicalVerification');

    const result = evaluateReadiness(evidence, observed, signingKey);

    expect(result.ready).toBe(false);
    expect(result.blockers.join('\n')).toMatch(/technical verification schema/i);
    expect(result.blockers.join('\n')).toMatch(/exact required check identities/i);
    expect(result.blockers.join('\n')).toMatch(/all required technical checks must pass/i);
    expect(result.blockers.join('\n')).toMatch(/technical verification timestamps/i);
  });

  it('rejects technical check identities in a noncanonical order', () => {
    const evidence = completeEvidence();
    const observed = completeObserved();
    const checks = observed.artifacts.technicalVerification.report.checks;
    [checks[0].id, checks[1].id] = [checks[1].id, checks[0].id];
    resignArtifact(observed, 'technicalVerification');

    const result = evaluateReadiness(evidence, observed, signingKey);

    expect(result.ready).toBe(false);
    expect(result.blockers.join('\n')).toMatch(/exact required check identities in order/i);
  });

  it('rejects stale technical verification that predates its source package validation', () => {
    const evidence = completeEvidence();
    const observed = completeObserved();
    observed.artifacts.technicalVerification.report.bindings.packageValidatedAt = '2026-08-16T09:11:00Z';
    resignArtifact(observed, 'technicalVerification');

    const result = evaluateReadiness(evidence, observed, signingKey);

    expect(result.ready).toBe(false);
    expect(result.blockers.join('\n')).toMatch(/technical verification artifact is stale/i);
  });

  it('rejects artifact reports for another run, package, or target', () => {
    const evidence = completeEvidence();
    const observed = completeObserved();
    observed.artifacts.reconciliation.report.runId = '22222222-2222-4222-8222-222222222222';
    observed.artifacts.restore.report.packageSha256 = '0'.repeat(64);
    observed.artifacts.health.report.health.url = 'https://other.supabase.co/functions/v1/health';

    resignReconciliation(observed);
    resignArtifact(observed, 'restore');
    resignArtifact(observed, 'health');
    const result = evaluateReadiness(evidence, observed, signingKey);

    expect(result.ready).toBe(false);
    expect(result.blockers.join('\n')).toMatch(/reconciliation.*run/i);
    expect(result.blockers.join('\n')).toMatch(/restore.*package/i);
    expect(result.blockers.join('\n')).toMatch(/health.*target/i);
  });

  it('rejects malformed or chronologically impossible artifact timestamps', () => {
    const evidence = completeEvidence();
    const observed = completeObserved();
    observed.artifacts.reconciliation.report.checkedAt = 'not-a-time';
    observed.artifacts.restore.report.startedAt = '2026-08-16T10:20:00Z';
    observed.artifacts.restore.report.completedAt = '2026-08-16T10:10:00Z';

    resignReconciliation(observed);
    resignArtifact(observed, 'restore');
    const result = evaluateReadiness(evidence, observed, signingKey);

    expect(result.ready).toBe(false);
    expect(result.blockers.join('\n')).toMatch(/artifact timestamp/i);
  });

  it('rejects final health evidence collected before the production release', () => {
    const observed = completeObserved();
    observed.artifacts.health.report.checkedAt = '2026-08-16T10:14:00Z';
    resignArtifact(observed, 'health');

    const result = evaluateReadiness(completeEvidence(), observed, signingKey);

    expect(result.ready).toBe(false);
    expect(result.blockers.join('\n')).toMatch(/production release, then final health/i);
  });

  it('rejects reconciliation that claims success while listing failed records', () => {
    const evidence = completeEvidence();
    const observed = completeObserved();
    observed.artifacts.reconciliation.report.failed = [{ entity: 'residents', sourceId: 'r-1' }];
    resignReconciliation(observed);

    const result = evaluateReadiness(evidence, observed, signingKey);

    expect(result.ready).toBe(false);
    expect(result.blockers.join('\n')).toMatch(/unresolved migration differences/i);
  });

  it('rejects demo mode and release commit drift from machine-derived artifacts', () => {
    const evidence = completeEvidence();
    const observed = completeObserved();
    observed.artifacts.productionRelease.report.release.demoMode = true;
    observed.artifacts.productionRelease.report.deployment.gitSha = 'f'.repeat(40);
    resignArtifact(observed, 'productionRelease');

    const result = evaluateReadiness(evidence, observed, signingKey);
    expect(result.ready).toBe(false);
    expect(result.blockers.join('\n')).toMatch(/demo mode/i);
    expect(result.blockers.join('\n')).toMatch(/commit/i);
  });

  it('rejects caller-edited release claims without both hashed deployment artifacts', () => {
    const evidence = completeEvidence();
    const observed = completeObserved();
    evidence.release.previewCommit = 'a'.repeat(40);
    evidence.release.productionCommit = 'a'.repeat(40);
    evidence.release.demoMode = false;
    evidence.release.authBypass = false;
    delete evidence.artifacts.productionRelease;
    delete observed.artifacts.productionRelease;

    const result = evaluateReadiness(evidence, observed, signingKey);

    expect(result.ready).toBe(false);
    expect(result.blockers.join('\n')).toMatch(/production release artifact/i);
  });

  it('rejects release evidence for a different Vercel project or Supabase backend', () => {
    const evidence = completeEvidence();
    const observed = completeObserved();
    observed.artifacts.previewRelease.report.deployment.projectId = 'prj_other';
    observed.artifacts.productionRelease.report.release.projectRef = 'other-backend';
    resignArtifact(observed, 'previewRelease');
    resignArtifact(observed, 'productionRelease');

    const result = evaluateReadiness(evidence, observed, signingKey);

    expect(result.ready).toBe(false);
    expect(result.blockers.join('\n')).toMatch(/Vercel project/i);
    expect(result.blockers.join('\n')).toMatch(/backend/i);
  });

  it('rejects evidence without live source-package validation', () => {
    const evidence = completeEvidence();

    const result = evaluateReadiness(evidence, undefined, signingKey);
    expect(result.ready).toBe(false);
    expect(result.blockers.join('\n')).toMatch(/live validation/i);
  });

  it('rejects readiness houses that differ from the validated package', () => {
    const evidence = completeEvidence();
    evidence.inputs.houses[0].address = 'Different address';
    const result = evaluateReadiness(evidence, completeObserved(), signingKey);
    expect(result.ready).toBe(false);
    expect(result.blockers.join('\n')).toMatch(/exactly match/i);
  });

  it('rejects untouched placeholders and approvals for the wrong houses', () => {
    const evidence = completeEvidence();
    evidence.inputs.houses[0].name = '[PENDING: HOUSE_1_NAME]';
    const observed = completeObserved();
    observed.artifacts.approvals.report.houseRepresentatives[0].house = 'Unlisted House';
    resignArtifact(observed, 'approvals');

    const result = evaluateReadiness(evidence, observed, signingKey);
    expect(result.ready).toBe(false);
    expect(result.blockers.join('\n')).toMatch(/six houses/i);
    expect(result.blockers.join('\n')).toMatch(/representative/i);
  });
});
