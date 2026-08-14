import { selectRollbackRecords } from './migration.mjs';

function increment(counts, key) {
  counts[key] = (counts[key] || 0) + 1;
}

export async function executeImport(plan, repository) {
  const conflicts = plan.records.filter((record) => record.action === 'conflict');
  if (conflicts.length) {
    throw new Error(
      `${conflicts.length} source record(s) changed since its previous import. Roll back the earlier run or use a new source id.`,
    );
  }

  const run = await repository.createRun(plan);
  const counts = {};
  let imported = 0;
  let skipped = 0;

  try {
    for (const record of plan.records) {
      if (record.action === 'skip') {
        skipped += 1;
        continue;
      }
      const importedRecord = record.attachment
        ? { ...record, payload: { ...record.payload, ...await repository.uploadAttachment(run.id, record) } }
        : record;
      await repository.upsertTarget(importedRecord.targetTable, importedRecord.payload);
      await repository.recordSource(run.id, importedRecord);
      increment(counts, record.sourceEntity);
      imported += 1;
    }
    await repository.completeRun(run.id, counts);
    return { runId: run.id, imported, skipped };
  } catch (error) {
    await repository.failRun(run.id, error);
    throw error;
  }
}

export async function executeRollback(runId, repository) {
  const sourceRecords = await repository.listRunRecords(runId);
  const targets = selectRollbackRecords(sourceRecords, runId);
  for (const record of sourceRecords) {
    const bucket = record.normalized_payload?.storage_bucket;
    const path = record.normalized_payload?.storage_path;
    if (bucket && path?.includes(`/migrations/${runId}/`)) {
      await repository.deleteAttachment(bucket, path);
    }
  }
  for (const target of targets) {
    await repository.deleteTarget(target.table, target.id);
  }
  await repository.markRunRolledBack(runId);
  return { runId, deleted: targets.length };
}
