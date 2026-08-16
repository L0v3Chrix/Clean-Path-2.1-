import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildRestorePlan,
  hashStorageEvidence,
  parseRestoreDrillArgs,
  sanitizeDatabaseUrl,
  validateDatabaseIsolation,
  validateRestoreEvidence,
} from './restore-drill.mjs';
import * as restoreDrill from './restore-drill.mjs';
import { signMigrationReport } from '../migration/report-integrity.mjs';

const runId = '11111111-1111-4111-8111-111111111111';
const signingKey = 'restore-test-secret';

function signReport(report) {
  return signMigrationReport(report, signingKey);
}

function resignReconciliation(evidence) {
  evidence.reconciliation = signReport(evidence.reconciliation);
  return evidence;
}

function validEvidence() {
  const reconciliation = {
    ok: true,
    runId,
    expected: { residents: 2, documents: 1 },
    imported: { residents: 2, documents: 1 },
    packageSha256: 'c'.repeat(64),
    missing: [],
    failed: [],
  };
  return {
    runId,
    reconciliation: signReport(reconciliation),
    database: {
      runId,
      status: 'completed',
      packageSha256: 'c'.repeat(64),
      expected: { residents: 2, documents: 1 },
      imported: { residents: 2, documents: 1 },
      lineage: { residents: 2, documents: 1 },
      referencedObjects: 1,
      restoredObjects: 1,
      objects: [{
        bucket: 'resident-documents',
        path: `org/migrations/${runId}/document.pdf`,
      }],
      records: [
        {
          sourceEntity: 'residents',
          sourceId: 'resident-1',
          targetTable: 'residents',
          targetId: 'resident-target-1',
          normalizedPayload: { id: 'resident-target-1', first_name: 'Ada', last_name: 'Example' },
          target: { id: 'resident-target-1', first_name: 'Ada', last_name: 'Example' },
        },
        {
          sourceEntity: 'residents',
          sourceId: 'resident-2',
          targetTable: 'residents',
          targetId: 'resident-target-2',
          normalizedPayload: { id: 'resident-target-2', first_name: 'Grace', last_name: 'Example' },
          target: { id: 'resident-target-2', first_name: 'Grace', last_name: 'Example' },
        },
        {
          sourceEntity: 'resident_documents',
          sourceId: 'document-1',
          targetTable: 'resident_documents',
          targetId: 'document-target-1',
          normalizedPayload: { id: 'document-target-1', document_type: 'agreement' },
          target: { id: 'document-target-1', document_type: 'agreement' },
        },
      ],
    },
    storageManifest: {
      runId,
      expectedTotal: 1,
      restoredTotal: 1,
      objects: [{
        bucket: 'resident-documents',
        path: `org/migrations/${runId}/document.pdf`,
        sourceSha256: 'a'.repeat(64),
        restoredSha256: 'a'.repeat(64),
      }],
    },
  };
}

describe('restore drill planning', () => {
  it('builds a destructive-target-safe logical backup and restore plan', () => {
    const plan = buildRestorePlan({
      sourceUrl: 'postgresql://source-user:secret@source.example/db',
      restoreUrl: 'postgresql://restore-user:other@restore.example/db',
      dumpPath: '/tmp/clearpath.dump',
      runId,
    });

    expect(plan.dump.command).toBe('pg_dump');
    expect(plan.restore.command).toBe('pg_restore');
    expect(plan.restore.args).toContain('--clean');
    expect(JSON.stringify(plan)).not.toContain('secret');
    expect(JSON.stringify(plan)).not.toContain('other');
  });

  it('refuses to restore over the source database', () => {
    expect(() => buildRestorePlan({
      sourceUrl: 'postgresql://user:secret@example/db',
      restoreUrl: 'postgresql://user:different@example/db',
      dumpPath: '/tmp/clearpath.dump',
      runId,
    })).toThrow(/isolated database/i);
  });

  it('refuses the same database reached through direct and pooler URLs', () => {
    const sourceIdentity = {
      serverIdentifier: '7312345678901234567', databaseOid: '16384', databaseName: 'postgres',
    };
    const restoredIdentity = { ...sourceIdentity };

    expect(() => validateDatabaseIsolation(sourceIdentity, restoredIdentity)).toThrow(/same database/i);
  });

  it('accepts a restore target only when database-reported identity differs', () => {
    expect(validateDatabaseIsolation(
      { serverIdentifier: 'source-cluster', databaseOid: '16384', databaseName: 'postgres' },
      { serverIdentifier: 'restore-cluster', databaseOid: '16384', databaseName: 'postgres' },
    )).toEqual({
      source: { serverIdentifier: 'source-cluster', databaseOid: '16384', databaseName: 'postgres' },
      target: { serverIdentifier: 'restore-cluster', databaseOid: '16384', databaseName: 'postgres' },
    });
  });

  it('fails closed when database-reported identity is unavailable', () => {
    expect(() => validateDatabaseIsolation(
      { databaseOid: '16384', databaseName: 'postgres' },
      { serverIdentifier: 'restore-cluster', databaseOid: '16384', databaseName: 'postgres' },
    )).toThrow(/server identity/i);
  });

  it('removes credentials from recorded database URLs', () => {
    expect(sanitizeDatabaseUrl('postgresql://user:secret@example/db'))
      .toBe('postgresql://example/db');
  });

  it('requires a run, reconciliation report, and Storage manifest', () => {
    expect(() => parseRestoreDrillArgs([])).toThrow(/--run/);
    expect(() => parseRestoreDrillArgs(['--run', runId])).toThrow(/--reconciliation-report/);
    expect(() => parseRestoreDrillArgs([
      '--run', runId,
      '--reconciliation-report', 'reconciliation.json',
    ])).toThrow(/--storage-manifest/);
    expect(() => parseRestoreDrillArgs([
      '--run', runId,
      '--reconciliation-report', 'reconciliation.json',
      '--storage-manifest', 'storage.json',
    ])).toThrow(/--source-storage-dir/);
  });

  it('computes Storage checksums from separate source and restored object trees', async () => {
    const source = await mkdtemp(join(tmpdir(), 'clearpath-source-storage-'));
    const restored = await mkdtemp(join(tmpdir(), 'clearpath-restored-storage-'));
    const objectPath = `org/migrations/${runId}/document.pdf`;
    for (const root of [source, restored]) {
      const directory = join(root, 'resident-documents', `org/migrations/${runId}`);
      await mkdir(directory, { recursive: true });
      await writeFile(join(root, 'resident-documents', objectPath), 'verified-object-bytes');
    }

    const evidence = await hashStorageEvidence({
      runId,
      objects: [{ bucket: 'resident-documents', path: objectPath }],
    }, source, restored);

    expect(evidence.objects[0].sourceSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(evidence.objects[0].restoredSha256).toBe(evidence.objects[0].sourceSha256);
    expect(evidence).toMatchObject({ expectedTotal: 1, restoredTotal: 1 });
  });

  it('accepts reconciliation and object evidence tied to the restored run', () => {
    expect(validateRestoreEvidence(validEvidence(), signingKey)).toEqual({
      databaseTotals: { residents: 2, documents: 1 },
      objectTotal: 1,
    });
  });

  it('rejects an unsigned reconciliation report', () => {
    const evidence = validEvidence();
    delete evidence.reconciliation.integrity;

    expect(() => validateRestoreEvidence(evidence, signingKey)).toThrow(/integrity/i);
  });

  it('rejects a reconciliation report with an invalid HMAC before trusting its fields', () => {
    const evidence = validEvidence();
    evidence.reconciliation.integrity.signature = '0'.repeat(64);

    expect(() => validateRestoreEvidence(evidence, signingKey)).toThrow(/integrity/i);
  });

  it('fails closed when reconciliation totals do not match the restored database', () => {
    const evidence = validEvidence();
    evidence.reconciliation.imported.residents = 1;
    resignReconciliation(evidence);

    expect(() => validateRestoreEvidence(evidence, signingKey)).toThrow(/database totals do not match/i);
  });

  it('rejects reconciliation for a different validated source package', () => {
    const evidence = validEvidence();
    evidence.reconciliation.packageSha256 = 'd'.repeat(64);
    resignReconciliation(evidence);

    expect(() => validateRestoreEvidence(evidence, signingKey)).toThrow(/package/i);
  });

  it('rejects a restored target row whose normalized values differ from lineage', () => {
    const evidence = validEvidence();
    evidence.database.records[0].target.last_name = 'Stale';

    expect(() => validateRestoreEvidence(evidence, signingKey)).toThrow(/restored target values/i);
  });

  it('rejects missing restored target rows even when the stale reconciliation report passed', () => {
    const evidence = validEvidence();
    evidence.database.records[0].target = null;

    expect(() => validateRestoreEvidence(evidence, signingKey)).toThrow(/restored target rows/i);
  });

  it('rejects an arbitrary ok reconciliation report without count evidence', () => {
    const evidence = validEvidence();
    evidence.reconciliation = signReport({ ok: true, missing: [], failed: [] });

    expect(() => validateRestoreEvidence(evidence, signingKey)).toThrow(/requested migration run|expected counts/i);
  });

  it('fails closed when the restored database run differs from the requested run', () => {
    const evidence = validEvidence();
    evidence.database.runId = '22222222-2222-4222-8222-222222222222';

    expect(() => validateRestoreEvidence(evidence, signingKey)).toThrow(/requested migration run/i);
  });

  it('rejects reconciliation evidence for a different migration run', () => {
    const evidence = validEvidence();
    evidence.reconciliation.runId = '22222222-2222-4222-8222-222222222222';
    resignReconciliation(evidence);

    expect(() => validateRestoreEvidence(evidence, signingKey)).toThrow(/reconciliation.*requested migration run/i);
  });

  it('fails closed when Storage object totals do not match', () => {
    const evidence = validEvidence();
    evidence.database.restoredObjects = 0;

    expect(() => validateRestoreEvidence(evidence, signingKey)).toThrow(/Storage object (identities|totals) do not match/i);
  });

  it('rejects a Storage manifest for objects other than restored database references', () => {
    const evidence = validEvidence();
    evidence.storageManifest.objects[0].path = `org/migrations/${runId}/other.pdf`;

    expect(() => validateRestoreEvidence(evidence, signingKey)).toThrow(/identities do not match/i);
  });

  it('requires matching source and restored checksums for every Storage object', () => {
    const evidence = validEvidence();
    evidence.storageManifest.objects[0].restoredSha256 = 'b'.repeat(64);

    expect(() => validateRestoreEvidence(evidence, signingKey)).toThrow(/checksum verification failed/i);
  });

  it('allows a truly zero-object restore when every source of object evidence is zero', () => {
    const evidence = validEvidence();
    evidence.storageManifest.objects = [];
    evidence.storageManifest.expectedTotal = 0;
    evidence.storageManifest.restoredTotal = 0;
    evidence.database.referencedObjects = 0;
    evidence.database.restoredObjects = 0;
    evidence.database.objects = [];

    expect(validateRestoreEvidence(evidence, signingKey)).toEqual({
      databaseTotals: { residents: 2, documents: 1 },
      objectTotal: 0,
    });
  });

  it('rejects empty object evidence when restored database references expect objects', () => {
    const evidence = validEvidence();
    evidence.storageManifest.objects = [];
    evidence.storageManifest.expectedTotal = 0;
    evidence.storageManifest.restoredTotal = 0;
    evidence.database.restoredObjects = 0;

    expect(() => validateRestoreEvidence(evidence, signingKey)).toThrow(/Storage object (identities|totals) do not match/i);
  });

  it('builds a versioned restore report with compatibility fields', () => {
    expect(typeof restoreDrill.buildRestoreReport).toBe('function');
    const report = restoreDrill.buildRestoreReport({
      plan: { source: 'postgresql://source/db', target: 'postgresql://restore/db' },
      dumpPath: '/tmp/clearpath.dump',
      dumpSha256: 'a'.repeat(64),
      startedAt: '2026-08-16T00:00:00.000Z',
      completedAt: '2026-08-16T00:10:00.000Z',
      runId,
      database: { completedMigrationRuns: 3 },
      evidence: { databaseTotals: { residents: 2 }, objectTotal: 0 },
      reconciliation: { expected: { residents: 2 }, imported: { residents: 2 } },
      storageManifestPath: '/tmp/storage.json',
      storageManifest: { runId, objects: [] },
    });

    expect(report.schemaVersion).toBe(1);
    expect(report.completedMigrationRuns).toBe(3);
    expect(report.reconciliation.runId).toBe(runId);
  });
});
