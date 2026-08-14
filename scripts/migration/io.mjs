import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { basename, dirname, extname, relative, resolve } from 'node:path';
import { parse } from 'csv-parse/sync';
import { sha256 } from './migration.mjs';

function resolveInside(baseDirectory, requestedPath) {
  const absolute = resolve(baseDirectory, requestedPath);
  const relation = relative(baseDirectory, absolute);
  if (relation.startsWith('..') || relation === '' && absolute === baseDirectory) {
    throw new Error(`Migration source path must stay inside the manifest directory: ${requestedPath}`);
  }
  return absolute;
}

function parseSourceFile(path, content) {
  const extension = extname(path).toLowerCase();
  if (extension === '.csv') {
    return parse(content, {
      columns: true,
      bom: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: false,
    });
  }
  if (extension === '.json') {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) return parsed;
    if (Array.isArray(parsed.records)) return parsed.records;
    throw new Error(`JSON migration source must contain an array or { records: [] }: ${path}`);
  }
  throw new Error(`Unsupported migration source extension ${extension || '(none)'}: ${path}`);
}

function mapColumns(row, columnMap = {}) {
  if (!Object.keys(columnMap).length) return { ...row };
  const mapped = {};
  for (const [sourceColumn, value] of Object.entries(row)) {
    const targetColumn = columnMap[sourceColumn];
    if (targetColumn) mapped[targetColumn] = value;
  }
  return mapped;
}

export async function loadMigrationDataset(manifestPath) {
  const absoluteManifestPath = resolve(manifestPath);
  const baseDirectory = dirname(absoluteManifestPath);
  const manifestContent = await readFile(absoluteManifestPath, 'utf8');
  const manifest = JSON.parse(manifestContent);
  if (!Array.isArray(manifest.files) || manifest.files.length === 0) {
    throw new Error('Migration manifest must define at least one source file.');
  }

  const entities = {};
  const sourceFiles = [];
  for (const file of manifest.files) {
    if (!file.entity || !file.path) throw new Error('Every manifest file needs entity and path.');
    if (entities[file.entity]) throw new Error(`Manifest contains duplicate entity file: ${file.entity}`);
    const absolutePath = resolveInside(baseDirectory, file.path);
    const content = await readFile(absolutePath, 'utf8');
    const rows = parseSourceFile(absolutePath, content);
    entities[file.entity] = rows.map((row) => mapColumns(row, file.columnMap));
    sourceFiles.push({
      entity: file.entity,
      path: file.path,
      records: rows.length,
      sha256: sha256(content),
    });
  }

  const attachments = [];
  if (manifest.attachmentManifest) {
    const attachmentManifestPath = resolveInside(baseDirectory, manifest.attachmentManifest);
    const attachmentManifestContent = await readFile(attachmentManifestPath, 'utf8');
    const attachmentRows = parseSourceFile(attachmentManifestPath, attachmentManifestContent);
    for (const row of attachmentRows) {
      if (!row.source_entity || !row.source_id || !row.path) {
        throw new Error('Every attachment row needs source_entity, source_id, and path.');
      }
      const absolutePath = resolveInside(baseDirectory, row.path);
      const content = await readFile(absolutePath);
      attachments.push({
        ...row,
        absolute_path: absolutePath,
        file_name: row.file_name || basename(absolutePath),
        mime_type: row.mime_type || 'application/octet-stream',
        size: content.byteLength,
        sha256: createHash('sha256').update(content).digest('hex'),
      });
    }
  }

  return {
    manifest: {
      sourceSystem: manifest.sourceSystem,
      organizationId: manifest.organizationId,
      cutoffAt: manifest.cutoffAt,
      attachmentManifest: manifest.attachmentManifest || null,
    },
    entities,
    sourceFiles,
    attachments,
  };
}
