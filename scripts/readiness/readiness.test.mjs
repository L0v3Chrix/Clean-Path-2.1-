import { describe, expect, it } from 'vitest';
import { evaluateReadiness } from './readiness.mjs';

function completeEvidence() {
  return {
    schemaVersion: 1,
    release: {
      canonicalCommit: 'a'.repeat(40),
      previewCommit: 'a'.repeat(40),
      productionCommit: 'a'.repeat(40),
      demoMode: false,
      authBypass: false,
    },
    migration: {
      runId: '11111111-1111-4111-8111-111111111111',
      packageSha256: 'b'.repeat(64),
    },
    target: {
      projectRef: 'clearpath-prod',
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
      technicalVerification: { path: 'technical-verification.json', sha256: '9'.repeat(64) },
      reconciliation: { path: 'reconciliation.json', sha256: 'c'.repeat(64) },
      restore: { path: 'restore-drill.json', sha256: 'd'.repeat(64) },
      health: { path: 'health.json', sha256: 'e'.repeat(64) },
    },
    approvals: {
      slade: { approved: true, approvedAt: '2026-08-14T12:00:00Z' },
      houseRepresentatives: Array.from({ length: 6 }, (_, index) => ({
        house: `House ${index + 1}`,
        approved: true,
        approvedAt: '2026-08-14T12:00:00Z',
      })),
    },
  };
}

function completeObserved() {
  const runId = '11111111-1111-4111-8111-111111111111';
  const packageSha256 = 'b'.repeat(64);
  return {
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
        report: {
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
        },
      },
      restore: {
        path: '/evidence/restore-drill.json',
        sha256: 'd'.repeat(64),
        report: {
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
          ok: true,
          checkedAt: '2026-08-16T10:15:00Z',
          app: { url: 'https://clearpath.example', status: 200 },
          health: {
            url: 'https://clearpath-prod.supabase.co/functions/v1/health',
            status: 200,
            database: 'ok',
          },
          blockers: [],
        },
      },
    },
  };
}

describe('cutover readiness evaluation', () => {
  it('passes only complete evidence with matching commits and six approvals', () => {
    const result = evaluateReadiness(completeEvidence(), completeObserved());
    expect(result.ready).toBe(true);
    expect(result.blockers).toEqual([]);
    expect(result.bindings).toEqual({
      runId: '11111111-1111-4111-8111-111111111111',
      packageSha256: 'b'.repeat(64),
      projectRef: 'clearpath-prod',
      artifactSha256: {
        technicalVerification: '9'.repeat(64),
        reconciliation: 'c'.repeat(64),
        restore: 'd'.repeat(64),
        health: 'e'.repeat(64),
      },
    });
  });

  it('fails closed when external inputs, restore proof, or approvals are missing', () => {
    const evidence = completeEvidence();
    evidence.inputs.houses = evidence.inputs.houses.slice(0, 5);
    delete evidence.artifacts.restore;
    evidence.approvals.slade.approved = false;

    const result = evaluateReadiness(evidence, completeObserved());
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

    const result = evaluateReadiness(evidence, observed);

    expect(result.ready).toBe(false);
    expect(result.blockers.join('\n')).toMatch(/reconciliation artifact hash/i);
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

    const result = evaluateReadiness(evidence, observed);

    expect(result.ready).toBe(false);
    expect(result.blockers.join('\n')).toMatch(/technical verification artifact path and SHA-256/i);
    expect(result.counts.passedTechnicalGates).toBe(0);
  });

  it('rejects a tampered technical verification artifact', () => {
    const evidence = completeEvidence();
    const observed = completeObserved();
    observed.artifacts.technicalVerification.sha256 = '0'.repeat(64);

    const result = evaluateReadiness(evidence, observed);

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

    const result = evaluateReadiness(evidence, observed);

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

    const result = evaluateReadiness(evidence, observed);

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

    const result = evaluateReadiness(evidence, observed);

    expect(result.ready).toBe(false);
    expect(result.blockers.join('\n')).toMatch(/exact required check identities in order/i);
  });

  it('rejects stale technical verification that predates its source package validation', () => {
    const evidence = completeEvidence();
    const observed = completeObserved();
    observed.artifacts.technicalVerification.report.bindings.packageValidatedAt = '2026-08-16T09:11:00Z';

    const result = evaluateReadiness(evidence, observed);

    expect(result.ready).toBe(false);
    expect(result.blockers.join('\n')).toMatch(/technical verification artifact is stale/i);
  });

  it('rejects artifact reports for another run, package, or target', () => {
    const evidence = completeEvidence();
    const observed = completeObserved();
    observed.artifacts.reconciliation.report.runId = '22222222-2222-4222-8222-222222222222';
    observed.artifacts.restore.report.packageSha256 = '0'.repeat(64);
    observed.artifacts.health.report.health.url = 'https://other.supabase.co/functions/v1/health';

    const result = evaluateReadiness(evidence, observed);

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

    const result = evaluateReadiness(evidence, observed);

    expect(result.ready).toBe(false);
    expect(result.blockers.join('\n')).toMatch(/artifact timestamp/i);
  });

  it('rejects reconciliation that claims success while listing failed records', () => {
    const evidence = completeEvidence();
    const observed = completeObserved();
    observed.artifacts.reconciliation.report.failed = [{ entity: 'residents', sourceId: 'r-1' }];

    const result = evaluateReadiness(evidence, observed);

    expect(result.ready).toBe(false);
    expect(result.blockers.join('\n')).toMatch(/unresolved migration differences/i);
  });

  it('rejects demo mode and release commit drift', () => {
    const evidence = completeEvidence();
    evidence.release.demoMode = true;
    evidence.release.productionCommit = 'different';

    const result = evaluateReadiness(evidence, completeObserved());
    expect(result.ready).toBe(false);
    expect(result.blockers.join('\n')).toMatch(/demo mode/i);
    expect(result.blockers.join('\n')).toMatch(/commit/i);
  });

  it('rejects evidence without live source-package validation', () => {
    const evidence = completeEvidence();

    const result = evaluateReadiness(evidence);
    expect(result.ready).toBe(false);
    expect(result.blockers.join('\n')).toMatch(/live validation/i);
  });

  it('rejects readiness houses that differ from the validated package', () => {
    const evidence = completeEvidence();
    evidence.inputs.houses[0].address = 'Different address';
    const result = evaluateReadiness(evidence, completeObserved());
    expect(result.ready).toBe(false);
    expect(result.blockers.join('\n')).toMatch(/exactly match/i);
  });

  it('rejects untouched placeholders and approvals for the wrong houses', () => {
    const evidence = completeEvidence();
    evidence.inputs.houses[0].name = '[PENDING: HOUSE_1_NAME]';
    evidence.approvals.houseRepresentatives[0].house = 'Unlisted House';

    const result = evaluateReadiness(evidence, completeObserved());
    expect(result.ready).toBe(false);
    expect(result.blockers.join('\n')).toMatch(/six houses/i);
    expect(result.blockers.join('\n')).toMatch(/representative/i);
  });
});
