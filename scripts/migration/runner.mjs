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
  let attemptedRecord = null;
  const writtenTargets = [];
  const writtenAttachments = [];

  try {
    for (const record of plan.records) {
      attemptedRecord = record;
      if (record.action === 'skip') {
        await repository.recordSource(run.id, {
          ...record,
          payload: record.priorPayload || record.payload,
        });
        increment(counts, record.sourceEntity);
        skipped += 1;
        continue;
      }
      let importedRecord = record;
      if (record.attachment) {
        const attachmentWrite = await repository.uploadAttachment(run.id, record);
        writtenAttachments.push(attachmentWrite);
        importedRecord = { ...record, payload: { ...record.payload, ...attachmentWrite } };
        attemptedRecord = importedRecord;
      }
      await repository.insertTarget(importedRecord.targetTable, importedRecord.payload);
      writtenTargets.push({ table: importedRecord.targetTable, id: importedRecord.targetId });
      await repository.recordSource(run.id, importedRecord);
      increment(counts, record.sourceEntity);
      imported += 1;
    }
    await repository.completeRun(run.id, counts);
    return { runId: run.id, imported, skipped };
  } catch (error) {
    const secondaryErrors = [];
    try {
      await repository.failRun(run.id, error, attemptedRecord);
    } catch (auditError) {
      secondaryErrors.push(auditError);
    }
    for (const target of [...writtenTargets].reverse()) {
      try {
        await repository.deleteTarget(target.table, target.id);
      } catch (compensationError) {
        secondaryErrors.push(compensationError);
      }
    }
    for (const attachment of [...writtenAttachments].reverse()) {
      try {
        await repository.deleteAttachment(attachment.storage_bucket, attachment.storage_path);
      } catch (compensationError) {
        secondaryErrors.push(compensationError);
      }
    }
    if (secondaryErrors.length) {
      throw new AggregateError(
        [error, ...secondaryErrors],
        `${error.message}; ${secondaryErrors.length} audit or compensation operation(s) also failed.`,
      );
    }
    throw error;
  }
}

export async function executeRollback(runId, repository) {
  const sourceRecords = await repository.listRunRecords(runId, { includeEvidence: false });
  const targets = selectRollbackRecords(sourceRecords, runId);
  const cleanupErrors = [];
  for (const record of sourceRecords) {
    const bucket = record.normalized_payload?.storage_bucket;
    const path = record.normalized_payload?.storage_path;
    if (bucket && path?.includes(`/migrations/${runId}/`)) {
      try {
        await repository.deleteAttachment(bucket, path);
      } catch (error) {
        cleanupErrors.push(error);
      }
    }
  }
  for (const target of targets) {
    try {
      await repository.deleteTarget(target.table, target.id);
    } catch (error) {
      cleanupErrors.push(error);
    }
  }
  if (cleanupErrors.length) {
    throw new AggregateError(
      cleanupErrors,
      `${cleanupErrors.length} rollback cleanup operation(s) failed: ${cleanupErrors.map((error) => error.message).join('; ')}`,
    );
  }
  await repository.markRunRolledBack(runId);
  return { runId, deleted: targets.length };
}
