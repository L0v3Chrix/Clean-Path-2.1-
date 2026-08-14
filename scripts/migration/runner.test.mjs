import { describe, expect, it, vi } from 'vitest';
import { buildMigrationPlan } from './migration.mjs';
import { executeImport, executeRollback } from './runner.mjs';

const input = {
  manifest: {
    sourceSystem: 'oathtrack',
    organizationId: '10000000-0000-4000-8000-000000000001',
    cutoffAt: '2026-08-14T12:00:00.000Z',
  },
  entities: {
    locations: [{ source_id: 'house-1', name: 'North House' }],
    residents: [{ source_id: 'resident-1', source_location_id: 'house-1', first_name: 'A', last_name: 'Resident' }],
  },
};

describe('migration runner', () => {
  it('imports records in dependency order and records lineage', async () => {
    const repository = {
      createRun: vi.fn().mockResolvedValue({ id: 'run-1' }),
      upsertTarget: vi.fn().mockResolvedValue(undefined),
      recordSource: vi.fn().mockResolvedValue(undefined),
      completeRun: vi.fn().mockResolvedValue(undefined),
      failRun: vi.fn().mockResolvedValue(undefined),
    };

    const result = await executeImport(buildMigrationPlan(input), repository);

    expect(result).toEqual({ runId: 'run-1', imported: 2, skipped: 0 });
    expect(repository.upsertTarget.mock.calls.map(([table]) => table)).toEqual(['locations', 'residents']);
    expect(repository.recordSource).toHaveBeenCalledTimes(2);
    expect(repository.completeRun).toHaveBeenCalledWith('run-1', { locations: 1, residents: 1 });
    expect(repository.failRun).not.toHaveBeenCalled();
  });

  it('uploads a migration-owned attachment and records its storage path', async () => {
    const withDocument = structuredClone(input);
    withDocument.entities.resident_documents = [{
      source_id: 'document-1', source_resident_id: 'resident-1', document_type: 'photo_id',
    }];
    withDocument.attachments = [{
      source_entity: 'resident_documents', source_id: 'document-1', absolute_path: '/safe/id.png',
      file_name: 'id.png', mime_type: 'image/png', sha256: 'hash', size: 10,
    }];
    const repository = {
      createRun: vi.fn().mockResolvedValue({ id: 'run-1' }),
      uploadAttachment: vi.fn().mockResolvedValue({ storage_bucket: 'resident-documents', storage_path: 'org/migrations/run-1/id.png' }),
      upsertTarget: vi.fn().mockResolvedValue(undefined),
      recordSource: vi.fn().mockResolvedValue(undefined),
      completeRun: vi.fn().mockResolvedValue(undefined),
      failRun: vi.fn().mockResolvedValue(undefined),
    };

    await executeImport(buildMigrationPlan(withDocument), repository);

    expect(repository.uploadAttachment).toHaveBeenCalledTimes(1);
    expect(repository.upsertTarget).toHaveBeenLastCalledWith('resident_documents', expect.objectContaining({
      storage_bucket: 'resident-documents', storage_path: 'org/migrations/run-1/id.png',
    }));
    expect(repository.recordSource).toHaveBeenLastCalledWith('run-1', expect.objectContaining({
      payload: expect.objectContaining({ storage_path: 'org/migrations/run-1/id.png' }),
    }));
  });

  it('refuses a plan with changed-source conflicts', async () => {
    const plan = buildMigrationPlan(input);
    plan.records[0].action = 'conflict';

    await expect(executeImport(plan, {})).rejects.toThrow('changed since its previous import');
  });

  it('rolls back only lineage records returned for the selected run', async () => {
    const repository = {
      listRunRecords: vi.fn().mockResolvedValue([
        { migration_run_id: 'run-1', target_table: 'residents', target_id: 'resident-1', status: 'imported' },
        { migration_run_id: 'run-1', target_table: 'resident_documents', target_id: 'document-1', status: 'imported', normalized_payload: { storage_bucket: 'resident-documents', storage_path: 'org/migrations/run-1/id.png' } },
      ]),
      deleteAttachment: vi.fn().mockResolvedValue(undefined),
      deleteTarget: vi.fn().mockResolvedValue(undefined),
      markRunRolledBack: vi.fn().mockResolvedValue(undefined),
    };

    const result = await executeRollback('run-1', repository);

    expect(repository.deleteTarget.mock.calls).toEqual([
      ['resident_documents', 'document-1'],
      ['residents', 'resident-1'],
    ]);
    expect(repository.deleteAttachment).toHaveBeenCalledWith('resident-documents', 'org/migrations/run-1/id.png');
    expect(repository.markRunRolledBack).toHaveBeenCalledWith('run-1');
    expect(result).toEqual({ runId: 'run-1', deleted: 2 });
  });
});
