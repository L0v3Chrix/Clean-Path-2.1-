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

function importRepository(overrides = {}) {
  return {
    createRun: vi.fn().mockResolvedValue({ id: 'run-1' }),
    uploadAttachment: vi.fn().mockResolvedValue({
      storage_bucket: 'resident-documents', storage_path: 'org/migrations/run-1/id.png',
    }),
    insertTarget: vi.fn().mockResolvedValue(undefined),
    recordSource: vi.fn().mockResolvedValue(undefined),
    completeRun: vi.fn().mockResolvedValue(undefined),
    failRun: vi.fn().mockResolvedValue(undefined),
    deleteTarget: vi.fn().mockResolvedValue(undefined),
    deleteAttachment: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function inputWithDocument() {
  const value = structuredClone(input);
  value.entities.resident_documents = [{
    source_id: 'document-1', source_resident_id: 'resident-1', document_type: 'photo_id',
  }];
  value.attachments = [{
    source_entity: 'resident_documents', source_id: 'document-1', absolute_path: '/safe/id.png',
    file_name: 'id.png', mime_type: 'image/png', sha256: 'hash', size: 10,
  }];
  return value;
}

describe('migration runner', () => {
  it('allows only one concurrent run to create deterministic targets and preserves the winner', async () => {
    const targets = new Map();
    const repositories = ['run-1', 'run-2'].map((runId) => ({
      createRun: vi.fn().mockResolvedValue({ id: runId }),
      insertTarget: vi.fn(async (table, payload) => {
        const key = `${table}:${payload.id}`;
        if (targets.has(key)) throw new Error('duplicate target');
        targets.set(key, { ...payload, owner: runId });
        await new Promise((resolve) => setTimeout(resolve, 1));
      }),
      recordSource: vi.fn().mockResolvedValue(undefined),
      completeRun: vi.fn().mockResolvedValue(undefined),
      failRun: vi.fn().mockResolvedValue(undefined),
      deleteTarget: vi.fn(async (table, id) => targets.delete(`${table}:${id}`)),
      deleteAttachment: vi.fn().mockResolvedValue(undefined),
    }));

    const results = await Promise.allSettled(repositories.map((repository) => (
      executeImport(buildMigrationPlan(input), repository)
    )));

    expect(results.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);
    expect(results.filter(({ status }) => status === 'rejected')).toHaveLength(1);
    expect(targets.size).toBe(2);
    expect(new Set([...targets.values()].map(({ owner }) => owner)).size).toBe(1);
  });

  it('imports records in dependency order and records lineage', async () => {
    const repository = {
      createRun: vi.fn().mockResolvedValue({ id: 'run-1' }),
      insertTarget: vi.fn().mockResolvedValue(undefined),
      recordSource: vi.fn().mockResolvedValue(undefined),
      completeRun: vi.fn().mockResolvedValue(undefined),
      failRun: vi.fn().mockResolvedValue(undefined),
    };

    const result = await executeImport(buildMigrationPlan(input), repository);

    expect(result).toEqual({ runId: 'run-1', imported: 2, skipped: 0 });
    expect(repository.insertTarget.mock.calls.map(([table]) => table)).toEqual(['locations', 'residents']);
    expect(repository.recordSource).toHaveBeenCalledTimes(2);
    expect(repository.completeRun).toHaveBeenCalledWith('run-1', { locations: 1, residents: 1 });
    expect(repository.failRun).not.toHaveBeenCalled();
  });

  it('uploads a migration-owned attachment and records its storage path', async () => {
    const withDocument = inputWithDocument();
    const repository = {
      createRun: vi.fn().mockResolvedValue({ id: 'run-1' }),
      uploadAttachment: vi.fn().mockResolvedValue({ storage_bucket: 'resident-documents', storage_path: 'org/migrations/run-1/id.png' }),
      insertTarget: vi.fn().mockResolvedValue(undefined),
      recordSource: vi.fn().mockResolvedValue(undefined),
      completeRun: vi.fn().mockResolvedValue(undefined),
      failRun: vi.fn().mockResolvedValue(undefined),
    };

    await executeImport(buildMigrationPlan(withDocument), repository);

    expect(repository.uploadAttachment).toHaveBeenCalledTimes(1);
    expect(repository.insertTarget).toHaveBeenLastCalledWith('resident_documents', expect.objectContaining({
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

  it('records run-scoped lineage for every record on an unchanged rerun', async () => {
    const firstPlan = buildMigrationPlan(input);
    const priorRecords = firstPlan.records.map((record) => ({
      source_entity: record.sourceEntity,
      source_id: record.sourceId,
      source_sha256: record.sourceSha256,
      target_table: record.targetTable,
      target_id: record.targetId,
      status: 'imported',
      normalized_payload: record.payload,
    }));
    const repository = {
      createRun: vi.fn().mockResolvedValue({ id: 'run-2' }),
      insertTarget: vi.fn().mockResolvedValue(undefined),
      recordSource: vi.fn().mockResolvedValue(undefined),
      completeRun: vi.fn().mockResolvedValue(undefined),
      failRun: vi.fn().mockResolvedValue(undefined),
    };

    const result = await executeImport(buildMigrationPlan(input, priorRecords), repository);

    expect(result).toEqual({ runId: 'run-2', imported: 0, skipped: 2 });
    expect(repository.insertTarget).not.toHaveBeenCalled();
    expect(repository.recordSource).toHaveBeenCalledTimes(2);
    expect(repository.recordSource.mock.calls.every(([runId, record]) => (
      runId === 'run-2' && record.action === 'skip' && record.payload.id === record.targetId
    ))).toBe(true);
    expect(repository.completeRun).toHaveBeenCalledWith('run-2', { locations: 1, residents: 1 });
  });

  it('compensates a Storage object when target upsert fails after upload', async () => {
    const repository = importRepository({
      insertTarget: vi.fn(async (table) => {
        if (table === 'resident_documents') throw new Error('target write failed');
      }),
    });

    await expect(executeImport(buildMigrationPlan(inputWithDocument()), repository))
      .rejects.toThrow('target write failed');

    expect(repository.deleteAttachment).toHaveBeenCalledWith(
      'resident-documents', 'org/migrations/run-1/id.png',
    );
    expect(repository.deleteTarget).toHaveBeenCalledTimes(2);
    expect(repository.failRun).toHaveBeenCalledWith(
      'run-1', expect.objectContaining({ message: 'target write failed' }),
      expect.objectContaining({ sourceEntity: 'resident_documents' }),
    );
  });

  it('compensates a target when lineage insertion fails after upsert', async () => {
    const repository = importRepository({
      recordSource: vi.fn(async (_runId, record) => {
        if (record.sourceEntity === 'residents') throw new Error('lineage write failed');
      }),
    });
    const plan = buildMigrationPlan(input);

    await expect(executeImport(plan, repository)).rejects.toThrow('lineage write failed');

    expect(repository.deleteTarget.mock.calls).toEqual([
      ['residents', plan.records[1].targetId],
      ['locations', plan.records[0].targetId],
    ]);
    expect(repository.failRun).toHaveBeenCalledWith(
      'run-1', expect.objectContaining({ message: 'lineage write failed' }),
      expect.objectContaining({ sourceEntity: 'residents' }),
    );
  });

  it('compensates all targets when run completion fails after lineage inserts', async () => {
    const repository = importRepository({
      completeRun: vi.fn().mockRejectedValue(new Error('completion failed')),
    });
    const plan = buildMigrationPlan(input);

    await expect(executeImport(plan, repository)).rejects.toThrow('completion failed');

    expect(repository.deleteTarget.mock.calls).toEqual([
      ['residents', plan.records[1].targetId],
      ['locations', plan.records[0].targetId],
    ]);
    expect(repository.failRun).toHaveBeenCalledWith(
      'run-1', expect.objectContaining({ message: 'completion failed' }),
      expect.objectContaining({ sourceEntity: 'residents' }),
    );
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

    expect(repository.listRunRecords).toHaveBeenCalledWith('run-1', { includeEvidence: false });
    expect(repository.deleteTarget.mock.calls).toEqual([
      ['resident_documents', 'document-1'],
      ['residents', 'resident-1'],
    ]);
    expect(repository.deleteAttachment).toHaveBeenCalledWith('resident-documents', 'org/migrations/run-1/id.png');
    expect(repository.markRunRolledBack).toHaveBeenCalledWith('run-1');
    expect(result).toEqual({ runId: 'run-1', deleted: 2 });
  });

  it('does not mark a run rolled back when attachment cleanup fails', async () => {
    const repository = {
      listRunRecords: vi.fn().mockResolvedValue([{
        migration_run_id: 'run-1',
        target_table: 'resident_documents',
        target_id: 'document-1',
        status: 'failed',
        normalized_payload: {
          storage_bucket: 'resident-documents',
          storage_path: 'org/migrations/run-1/id.png',
        },
      }]),
      deleteAttachment: vi.fn().mockRejectedValue(new Error('storage cleanup failed')),
      deleteTarget: vi.fn().mockResolvedValue(undefined),
      markRunRolledBack: vi.fn().mockResolvedValue(undefined),
    };

    await expect(executeRollback('run-1', repository)).rejects.toThrow('storage cleanup failed');
    expect(repository.deleteTarget).toHaveBeenCalledWith('resident_documents', 'document-1');
    expect(repository.markRunRolledBack).not.toHaveBeenCalled();
  });
});
