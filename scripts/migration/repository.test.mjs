import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as repositoryModule from './repository.mjs';

vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn() }));

function queryResult() {
  const query = { data: null, error: null };
  query.eq = vi.fn(() => query);
  query.in = vi.fn(() => query);
  return query;
}

function repositoryClient() {
  const sourceUpdate = vi.fn(() => queryResult());
  const sourceUpsert = vi.fn(() => queryResult());
  const runUpdate = vi.fn(() => queryResult());
  return {
    sourceUpdate,
    sourceUpsert,
    runUpdate,
    client: {
      from: vi.fn((table) => {
        if (table === 'migration_source_records') {
          return { update: sourceUpdate, upsert: sourceUpsert };
        }
        if (table === 'migration_runs') return { update: runUpdate };
        throw new Error(`Unexpected table ${table}`);
      }),
    },
  };
}

describe('migration repository boundaries', () => {
  beforeEach(() => vi.clearAllMocks());

  it('uses the validated package hash for migration_runs and keeps the dataset hash as metadata', () => {
    expect(typeof repositoryModule.migrationRunPayload).toBe('function');
    const payload = repositoryModule.migrationRunPayload({
      manifest: {
        organizationId: '10000000-0000-4000-8000-000000000001',
        sourceSystem: 'oathtrack',
        cutoffAt: '2026-08-14T12:00:00.000Z',
      },
      packageSha256: 'a'.repeat(64),
      datasetSha256: 'b'.repeat(64),
      records: [{ sourceEntity: 'locations' }],
    }, '2026-08-16T00:00:00.000Z');

    expect(payload.source_sha256).toBe('a'.repeat(64));
    expect(payload.source_manifest).toEqual({
      cutoffAt: '2026-08-14T12:00:00.000Z',
      datasetSha256: 'b'.repeat(64),
    });
  });

  it('reads canonical attachment bytes and rejects a digest changed since validation', async () => {
    expect(typeof repositoryModule.readVerifiedAttachment).toBe('function');
    const directory = await mkdtemp(join(tmpdir(), 'clearpath-attachment-'));
    const realPath = join(directory, 'document.pdf');
    await writeFile(realPath, 'validated bytes');
    const attachment = {
      real_path: realPath,
      absolute_path: join(directory, 'lexical-document.pdf'),
      sha256: '0'.repeat(64),
    };

    await expect(repositoryModule.readVerifiedAttachment(attachment))
      .rejects.toThrow(/changed after source-package validation/i);
  });

  it('keeps skipped lineage out of failed cleanup candidates', async () => {
    const fake = repositoryClient();
    createClient.mockReturnValue(fake.client);
    const repository = repositoryModule.createSupabaseMigrationRepository({
      url: 'https://example.supabase.co', serviceRoleKey: 'service-role-key',
    });
    const skippedRecord = {
      action: 'skip',
      payload: { organization_id: '10000000-0000-4000-8000-000000000001' },
      sourceSystem: 'oathtrack',
      sourceEntity: 'residents',
      sourceId: 'resident-1',
      sourceSha256: 'a'.repeat(64),
      targetTable: 'residents',
      targetId: 'resident-target',
    };

    await repository.failRun('run-1', new Error('completion failed'), skippedRecord);

    expect(fake.sourceUpdate.mock.results[0].value.eq).toHaveBeenCalledWith('status', 'imported');
    expect(fake.sourceUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'skipped', error_message: 'completion failed' }),
      { onConflict: 'migration_run_id,source_entity,source_id' },
    );
  });
});
