import { mkdtemp, realpath, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadMigrationDataset } from './io.mjs';

describe('migration input loader', () => {
  it('loads CSV and JSON files using explicit column maps', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'clearpath-migration-'));
    await writeFile(join(directory, 'houses.csv'), 'House ID,House Name,Beds\nh-1,North House,12\n');
    await writeFile(join(directory, 'residents.json'), JSON.stringify([
      { id: 'r-1', house: 'h-1', first: 'Sample', last: 'Resident' },
    ]));
    await writeFile(join(directory, 'photo-id.png'), 'not-real-phi');
    await writeFile(join(directory, 'attachments.csv'), 'source_entity,source_id,path,mime_type\nresident_documents,d-1,photo-id.png,image/png\n');
    const manifestPath = join(directory, 'manifest.json');
    await writeFile(manifestPath, JSON.stringify({
      sourceSystem: 'oathtrack',
      organizationId: '10000000-0000-4000-8000-000000000001',
      cutoffAt: '2026-08-14T12:00:00.000Z',
      attachmentManifest: 'attachments.csv',
      files: [
        {
          entity: 'locations',
          path: 'houses.csv',
          columnMap: { 'House ID': 'source_id', 'House Name': 'name', Beds: 'total_beds' },
        },
        {
          entity: 'residents',
          path: 'residents.json',
          columnMap: { id: 'source_id', house: 'source_location_id', first: 'first_name', last: 'last_name' },
        },
      ],
    }));

    const result = await loadMigrationDataset(manifestPath);

    expect(result.entities.locations).toEqual([
      { source_id: 'h-1', name: 'North House', total_beds: '12' },
    ]);
    expect(result.entities.residents[0]).toMatchObject({
      source_id: 'r-1',
      source_location_id: 'h-1',
      first_name: 'Sample',
      last_name: 'Resident',
    });
    expect(result.sourceFiles).toHaveLength(2);
    expect(result.sourceFiles.every((file) => /^[a-f0-9]{64}$/.test(file.sha256))).toBe(true);
    expect(result.attachments[0]).toMatchObject({
      source_entity: 'resident_documents', source_id: 'd-1', file_name: 'photo-id.png', size: 12,
      real_path: await realpath(join(directory, 'photo-id.png')),
    });
    expect(result.attachments[0].sha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it('rejects attachment paths that escape the manifest directory', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'clearpath-migration-'));
    await writeFile(join(directory, 'houses.csv'), 'source_id,name\nh-1,North House\n');
    await writeFile(join(directory, 'attachments.csv'), 'source_entity,source_id,path\nresident_documents,d-1,../secret.pdf\n');
    const manifestPath = join(directory, 'manifest.json');
    await writeFile(manifestPath, JSON.stringify({
      sourceSystem: 'oathtrack', organizationId: '10000000-0000-4000-8000-000000000001',
      cutoffAt: '2026-08-14T12:00:00.000Z', attachmentManifest: 'attachments.csv',
      files: [{ entity: 'locations', path: 'houses.csv' }],
    }));

    await expect(loadMigrationDataset(manifestPath)).rejects.toThrow('must stay inside');
  });

  it('rejects paths that escape the manifest directory', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'clearpath-migration-'));
    const manifestPath = join(directory, 'manifest.json');
    await writeFile(manifestPath, JSON.stringify({
      sourceSystem: 'oathtrack',
      organizationId: '10000000-0000-4000-8000-000000000001',
      cutoffAt: '2026-08-14T12:00:00.000Z',
      files: [{ entity: 'locations', path: '../outside.csv' }],
    }));

    await expect(loadMigrationDataset(manifestPath)).rejects.toThrow('must stay inside');
  });

  it('rejects manifest source symlinks that escape the manifest directory', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'clearpath-migration-'));
    const outsideDirectory = await mkdtemp(join(tmpdir(), 'clearpath-migration-outside-'));
    const outsidePath = join(outsideDirectory, 'outside.csv');
    await writeFile(outsidePath, 'source_id,name\nh-1,North House\n');
    await symlink(outsidePath, join(directory, 'houses.csv'));
    const manifestPath = join(directory, 'manifest.json');
    await writeFile(manifestPath, JSON.stringify({
      sourceSystem: 'oathtrack',
      organizationId: '10000000-0000-4000-8000-000000000001',
      cutoffAt: '2026-08-14T12:00:00.000Z',
      files: [{ entity: 'locations', path: 'houses.csv' }],
    }));

    await expect(loadMigrationDataset(manifestPath)).rejects.toThrow('must stay inside');
  });

  it('rejects attachment symlinks that escape the manifest directory', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'clearpath-migration-'));
    const outsideDirectory = await mkdtemp(join(tmpdir(), 'clearpath-migration-outside-'));
    const outsidePath = join(outsideDirectory, 'secret.pdf');
    await writeFile(outsidePath, 'not-real-phi');
    await symlink(outsidePath, join(directory, 'resident-document.pdf'));
    await writeFile(join(directory, 'houses.csv'), 'source_id,name\nh-1,North House\n');
    await writeFile(
      join(directory, 'attachments.csv'),
      'source_entity,source_id,path\nresident_documents,d-1,resident-document.pdf\n',
    );
    const manifestPath = join(directory, 'manifest.json');
    await writeFile(manifestPath, JSON.stringify({
      sourceSystem: 'oathtrack',
      organizationId: '10000000-0000-4000-8000-000000000001',
      cutoffAt: '2026-08-14T12:00:00.000Z',
      attachmentManifest: 'attachments.csv',
      files: [{ entity: 'locations', path: 'houses.csv' }],
    }));

    await expect(loadMigrationDataset(manifestPath)).rejects.toThrow('must stay inside');
  });
});
