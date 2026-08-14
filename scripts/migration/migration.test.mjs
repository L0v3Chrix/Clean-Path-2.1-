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

describe('ClearPath migration engine', () => {
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

  it('reconciles expected and imported counts by entity', () => {
    const plan = buildMigrationPlan(dataset());
    const imported = plan.records.map((record) => ({
      source_entity: record.sourceEntity,
      source_id: record.sourceId,
      target_id: record.targetId,
      status: 'imported',
    }));

    expect(reconcilePlan(plan, imported)).toEqual({
      ok: true,
      expected: { locations: 1, residents: 1 },
      imported: { locations: 1, residents: 1 },
      missing: [],
      failed: [],
    });
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
});
