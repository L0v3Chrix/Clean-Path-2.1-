import { describe, expect, it } from 'vitest';
import {
  buildMigrationPlan,
  deterministicTargetId,
  reconcilePlan,
  selectRollbackRecords,
  validateMigrationDataset,
} from './migration.mjs';

const organizationId = '10000000-0000-4000-8000-000000000001';

function dataset(overrides = {}) {
  return {
    manifest: {
      sourceSystem: 'oathtrack',
      organizationId,
      cutoffAt: '2026-08-14T12:00:00.000Z',
    },
    entities: {
      locations: [
        { source_id: 'house-1', name: 'North House', total_beds: '12', status: 'active' },
      ],
      residents: [
        {
          source_id: 'resident-1',
          source_location_id: 'house-1',
          first_name: 'Sample',
          last_name: 'Resident',
          status: 'active',
        },
      ],
    },
    ...overrides,
  };
}

function planCounts(plan) {
  return plan.records.reduce((counts, record) => ({
    ...counts,
    [record.sourceEntity]: (counts[record.sourceEntity] || 0) + 1,
  }), {});
}

function completedRun(plan, overrides = {}) {
  const counts = planCounts(plan);
  return {
    id: 'run-1',
    organization_id: plan.manifest.organizationId,
    source_system: plan.manifest.sourceSystem,
    source_sha256: plan.packageSha256,
    status: 'completed',
    expected_counts: counts,
    imported_counts: counts,
    ...overrides,
  };
}

function acceptedLineage(plan, status = 'imported') {
  return plan.records.map((record) => ({
    migration_run_id: 'run-1',
    organization_id: plan.manifest.organizationId,
    source_system: plan.manifest.sourceSystem,
    source_entity: record.sourceEntity,
    source_id: record.sourceId,
    source_sha256: record.sourceSha256,
    target_table: record.targetTable,
    target_id: record.targetId,
    status,
    target: record.payload,
  }));
}

describe('ClearPath migration engine', () => {
  it('binds the plan to the complete validated source package hash', () => {
    const packageSha256 = 'a'.repeat(64);
    const plan = buildMigrationPlan(dataset(), [], packageSha256);

    expect(plan.packageSha256).toBe(packageSha256);
    expect(plan.datasetSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(plan.datasetSha256).not.toBe(packageSha256);
  });

  it('builds stable target ids and resolves source references', () => {
    const plan = buildMigrationPlan(dataset());
    const location = plan.records.find((record) => record.sourceEntity === 'locations');
    const resident = plan.records.find((record) => record.sourceEntity === 'residents');

    expect(location.targetId).toBe(deterministicTargetId(organizationId, 'oathtrack', 'locations', 'house-1'));
    expect(location.sourceSystem).toBe('oathtrack');
    expect(resident.payload.location_id).toBe(location.targetId);
    expect(resident.payload.organization_id).toBe(organizationId);
    expect(resident.payload.source_location_id).toBeUndefined();
  });

  it('rejects missing required fields and unresolved references', () => {
    const invalid = dataset({
      entities: {
        locations: [{ source_id: 'house-1', name: '' }],
        residents: [{ source_id: 'resident-1', source_location_id: 'missing', first_name: 'A' }],
      },
    });

    const result = validateMigrationDataset(invalid);

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ entity: 'locations', sourceId: 'house-1', field: 'name' }),
      expect.objectContaining({ entity: 'residents', sourceId: 'resident-1', field: 'last_name' }),
      expect.objectContaining({ entity: 'residents', sourceId: 'resident-1', field: 'source_location_id' }),
    ]));
  });

  it('marks unchanged records as skipped and changed source rows as conflicts', () => {
    const first = buildMigrationPlan(dataset());
    const prior = first.records.map((record) => ({
      source_entity: record.sourceEntity,
      source_id: record.sourceId,
      source_sha256: record.sourceSha256,
      target_id: record.targetId,
      status: 'imported',
    }));

    const unchanged = buildMigrationPlan(dataset(), prior);
    expect(unchanged.records.every((record) => record.action === 'skip')).toBe(true);

    const changedDataset = dataset();
    changedDataset.entities.residents[0].last_name = 'Changed';
    const changed = buildMigrationPlan(changedDataset, prior);
    expect(changed.records.find((record) => record.sourceEntity === 'residents').action).toBe('conflict');
  });

  it('treats a changed attachment checksum as a changed source record', () => {
    const withDocument = dataset({
      entities: {
        ...dataset().entities,
        resident_documents: [
          { source_id: 'document-1', source_resident_id: 'resident-1', document_type: 'agreement' },
        ],
      },
      attachments: [{
        source_entity: 'resident_documents', source_id: 'document-1',
        file_name: 'agreement.pdf', mime_type: 'application/pdf', size: 100, sha256: 'a'.repeat(64),
      }],
    });
    const first = buildMigrationPlan(withDocument);
    const prior = first.records.map((record) => ({
      source_entity: record.sourceEntity,
      source_id: record.sourceId,
      source_sha256: record.sourceSha256,
      status: 'imported',
      normalized_payload: record.payload,
    }));
    withDocument.attachments[0].sha256 = 'b'.repeat(64);

    const rerun = buildMigrationPlan(withDocument, prior);

    expect(rerun.records.find((record) => record.sourceEntity === 'resident_documents').action).toBe('conflict');
  });

  it('allows a source record to be imported again after its prior run was rolled back', () => {
    const first = buildMigrationPlan(dataset());
    const rolledBack = first.records.map((record) => ({
      source_entity: record.sourceEntity,
      source_id: record.sourceId,
      source_sha256: record.sourceSha256,
      target_id: record.targetId,
      status: 'rolled_back',
    }));

    expect(buildMigrationPlan(dataset(), rolledBack).records.every((record) => record.action === 'import')).toBe(true);
  });

  it('uses active imported lineage when a newer unchanged run was recorded as skipped', () => {
    const first = buildMigrationPlan(dataset());
    const prior = first.records.flatMap((record) => ([
      {
        source_entity: record.sourceEntity,
        source_id: record.sourceId,
        source_sha256: record.sourceSha256,
        target_table: record.targetTable,
        target_id: record.targetId,
        status: 'imported',
        normalized_payload: record.payload,
      },
      {
        source_entity: record.sourceEntity,
        source_id: record.sourceId,
        source_sha256: record.sourceSha256,
        target_table: record.targetTable,
        target_id: record.targetId,
        status: 'skipped',
        normalized_payload: record.payload,
      },
    ]));

    const thirdRun = buildMigrationPlan(dataset(), prior);

    expect(thirdRun.records.every((record) => record.action === 'skip')).toBe(true);
    expect(thirdRun.records.every((record) => record.priorPayload.id === record.targetId)).toBe(true);
  });

  it('reconciles an unchanged rerun from its skipped run-scoped lineage', () => {
    const first = buildMigrationPlan(dataset());
    const prior = first.records.map((record) => ({
      source_entity: record.sourceEntity,
      source_id: record.sourceId,
      source_sha256: record.sourceSha256,
      target_table: record.targetTable,
      target_id: record.targetId,
      status: 'imported',
      normalized_payload: record.payload,
    }));
    const rerun = buildMigrationPlan(dataset(), prior);
    const rerunLineage = acceptedLineage(rerun, 'skipped').map((record, index) => ({
      ...record, target: rerun.records[index].priorPayload,
    }));

    const report = reconcilePlan(rerun, rerunLineage, completedRun(rerun));

    expect(report.ok).toBe(true);
    expect(report.recorded).toEqual({ locations: 1, residents: 1 });
    expect(report.statuses).toEqual({ imported: {}, skipped: { locations: 1, residents: 1 } });
  });

  it('reconciles expected and imported counts by entity', () => {
    const plan = buildMigrationPlan(dataset());
    const imported = acceptedLineage(plan);

    const report = reconcilePlan(plan, imported, completedRun(plan));

    expect(report.ok).toBe(true);
    expect(report.expected).toEqual({ locations: 1, residents: 1 });
    expect(report.recorded).toEqual({ locations: 1, residents: 1 });
    expect(report.imported).toEqual(report.recorded);
    expect(report.runId).toBe('run-1');
    expect(report.missingLineage).toEqual([]);
    expect(report.missing).toEqual(report.missingLineage);
    expect(report.targets).toEqual({ missing: [], mismatched: [] });
  });

  it('detects missing and content-mismatched target rows', () => {
    const plan = buildMigrationPlan(dataset());
    const [, resident] = plan.records;
    const runRecords = acceptedLineage(plan, 'skipped');
    runRecords[0].target = null;
    runRecords[1].target = { ...resident.payload, last_name: 'Wrong' };

    const report = reconcilePlan(plan, runRecords, completedRun(plan));

    expect(report.ok).toBe(false);
    expect(report.targets.missing).toEqual([expect.objectContaining({ entity: 'locations', sourceId: 'house-1' })]);
    expect(report.targets.mismatched).toEqual([
      expect.objectContaining({ entity: 'residents', sourceId: 'resident-1', fields: ['last_name'] }),
    ]);
  });

  it('detects missing and hash-mismatched attachments', () => {
    const withDocuments = dataset({
      entities: {
        ...dataset().entities,
        resident_documents: [
          { source_id: 'document-1', source_resident_id: 'resident-1', document_type: 'photo_id' },
          { source_id: 'document-2', source_resident_id: 'resident-1', document_type: 'agreement' },
        ],
      },
      attachments: [
        { source_entity: 'resident_documents', source_id: 'document-1', sha256: 'expected-one' },
        { source_entity: 'resident_documents', source_id: 'document-2', sha256: 'expected-two' },
      ],
    });
    const plan = buildMigrationPlan(withDocuments);
    const runRecords = acceptedLineage(plan).map((record) => ({
      ...record,
      attachmentEvidence: record.source_id === 'document-1'
        ? { exists: false, sha256: null }
        : record.source_id === 'document-2'
          ? { exists: true, sha256: 'wrong-two' }
          : undefined,
    }));

    const report = reconcilePlan(plan, runRecords, completedRun(plan));

    expect(report.ok).toBe(false);
    expect(report.attachments.missing).toEqual([
      expect.objectContaining({ entity: 'resident_documents', sourceId: 'document-1' }),
    ]);
    expect(report.attachments.mismatched).toEqual([
      expect.objectContaining({ entity: 'resident_documents', sourceId: 'document-2', expectedSha256: 'expected-two', actualSha256: 'wrong-two' }),
    ]);
  });

  it('requires attachment bucket and path evidence to match lineage payload', () => {
    const withDocument = dataset({
      entities: {
        ...dataset().entities,
        resident_documents: [
          { source_id: 'document-1', source_resident_id: 'resident-1', document_type: 'photo_id' },
        ],
      },
      attachments: [
        { source_entity: 'resident_documents', source_id: 'document-1', sha256: 'expected-hash' },
      ],
    });
    const plan = buildMigrationPlan(withDocument, [], 'b'.repeat(64));
    const runRecords = acceptedLineage(plan).map((record) => {
      if (record.source_id !== 'document-1') return record;
      return {
        ...record,
        normalized_payload: {
          ...record.target,
          storage_bucket: 'resident-documents',
          storage_path: 'org/migrations/run-1/document-1.pdf',
        },
        attachmentEvidence: {
          exists: true,
          sha256: 'expected-hash',
          bucket: 'resident-documents',
          path: 'org/migrations/run-1/different.pdf',
        },
      };
    });

    const report = reconcilePlan(plan, runRecords, completedRun(plan));

    expect(report.ok).toBe(false);
    expect(report.attachments.mismatched).toEqual([
      expect.objectContaining({ entity: 'resident_documents', sourceId: 'document-1', fields: ['path'] }),
    ]);
  });

  it('reconciles fee, payment, and balance aggregates', () => {
    const financialDataset = dataset({
      entities: {
        ...dataset().entities,
        resident_fees: [
          { source_id: 'fee-1', source_resident_id: 'resident-1', label: 'August', amount: '100.25' },
        ],
        resident_payments: [
          { source_id: 'payment-1', source_resident_id: 'resident-1', source_fee_id: 'fee-1', amount: '40.10', payment_date: '2026-08-01' },
        ],
      },
    });
    const plan = buildMigrationPlan(financialDataset);
    const runRecords = acceptedLineage(plan);

    expect(reconcilePlan(plan, runRecords, completedRun(plan)).financial).toEqual({
      expected: { fees: 100.25, payments: 40.1, balance: 60.15 },
      actual: { fees: 100.25, payments: 40.1, balance: 60.15 },
      variance: { fees: 0, payments: 0, balance: 0 },
    });
  });

  it('binds reconciliation to the completed run identity and manifest hash', () => {
    const plan = buildMigrationPlan(dataset());
    const report = reconcilePlan(plan, acceptedLineage(plan), completedRun(plan, {
      status: 'failed',
      organization_id: '20000000-0000-4000-8000-000000000002',
      source_system: 'other-system',
      source_sha256: 'wrong-manifest-hash',
    }));

    expect(report.ok).toBe(false);
    expect(report.runMismatches.map(({ field }) => field)).toEqual([
      'status', 'organization_id', 'source_system', 'source_sha256',
    ]);
  });

  it('rejects extra and duplicate accepted lineage', () => {
    const plan = buildMigrationPlan(dataset());
    const lineage = acceptedLineage(plan);
    lineage.push({ ...lineage[0] });
    lineage.push({
      ...lineage[1], source_id: 'extra-resident', target_id: 'extra-target',
    });

    const report = reconcilePlan(plan, lineage, completedRun(plan));

    expect(report.ok).toBe(false);
    expect(report.duplicateLineage).toEqual([
      { entity: 'locations', sourceId: 'house-1', count: 2 },
    ]);
    expect(report.extraLineage).toEqual([
      { entity: 'residents', sourceId: 'extra-resident' },
    ]);
  });

  it('rejects migration run expected and imported count drift', () => {
    const plan = buildMigrationPlan(dataset());
    const report = reconcilePlan(plan, acceptedLineage(plan), completedRun(plan, {
      expected_counts: { locations: 1, residents: 2 },
      imported_counts: { locations: 1, residents: 0 },
    }));

    expect(report.ok).toBe(false);
    expect(report.runMismatches.map(({ field }) => field)).toEqual([
      'expected_counts', 'imported_counts',
    ]);
  });

  it('selects rollback targets only for the requested run in dependency order', () => {
    const records = [
      { migration_run_id: 'run-1', target_table: 'residents', target_id: 'resident-target', status: 'imported' },
      { migration_run_id: 'run-1', target_table: 'resident_documents', target_id: 'doc-target', status: 'imported' },
      { migration_run_id: 'run-2', target_table: 'residents', target_id: 'other-target', status: 'imported' },
    ];

    expect(selectRollbackRecords(records, 'run-1')).toEqual([
      { table: 'resident_documents', id: 'doc-target' },
      { table: 'residents', id: 'resident-target' },
    ]);
  });

  it('selects failed lineage with a target for confirmed rollback cleanup', () => {
    const records = [
      { migration_run_id: 'run-1', target_table: 'residents', target_id: 'failed-target', status: 'failed' },
      { migration_run_id: 'run-1', target_table: 'locations', target_id: 'skipped-target', status: 'skipped' },
    ];

    expect(selectRollbackRecords(records, 'run-1')).toEqual([
      { table: 'residents', id: 'failed-target' },
    ]);
  });
});
