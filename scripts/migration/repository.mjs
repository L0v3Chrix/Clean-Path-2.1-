import { createClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

function assertResult(result, context) {
  if (result.error) throw new Error(`${context}: ${result.error.message}`);
  return result.data;
}

function countPlan(plan) {
  return plan.records.reduce((counts, record) => {
    counts[record.sourceEntity] = (counts[record.sourceEntity] || 0) + 1;
    return counts;
  }, {});
}

export function migrationRunPayload(plan, startedAt = new Date().toISOString()) {
  return {
    organization_id: plan.manifest.organizationId,
    source_system: plan.manifest.sourceSystem,
    source_manifest: {
      cutoffAt: plan.manifest.cutoffAt,
      datasetSha256: plan.datasetSha256,
    },
    source_sha256: plan.packageSha256,
    status: 'importing',
    expected_counts: countPlan(plan),
    started_at: startedAt,
  };
}

export async function readVerifiedAttachment(attachment) {
  const content = await readFile(attachment.real_path);
  const actualSha256 = createHash('sha256').update(content).digest('hex');
  if (actualSha256 !== attachment.sha256) {
    throw new Error('Attachment changed after source-package validation.');
  }
  return content;
}

async function attachmentEvidence(client, target) {
  const bucket = target?.storage_bucket;
  const path = target?.storage_path;
  if (!bucket || !path) return { exists: false, sha256: null, bucket: bucket || null, path: path || null };

  const result = await client.storage.from(bucket).download(path);
  if (result.error) {
    return { exists: false, sha256: null, bucket, path, error: result.error.message };
  }
  const content = Buffer.from(await result.data.arrayBuffer());
  return { exists: true, sha256: createHash('sha256').update(content).digest('hex'), bucket, path };
}

export function createSupabaseMigrationRepository({ url, serviceRoleKey }) {
  if (!url || !serviceRoleKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for migration writes.');
  }
  const client = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return {
    async listPriorRecords(organizationId, sourceSystem) {
      return assertResult(
        await client.from('migration_source_records').select('*')
          .eq('organization_id', organizationId).eq('source_system', sourceSystem)
          .order('created_at', { ascending: true }),
        'Unable to read migration lineage',
      ) || [];
    },

    async getRun(runId) {
      return assertResult(
        await client.from('migration_runs').select('*').eq('id', runId).single(),
        `Unable to read migration run ${runId}`,
      );
    },

    async createRun(plan) {
      return assertResult(
        await client.from('migration_runs').insert(migrationRunPayload(plan)).select('*').single(),
        'Unable to create migration run',
      );
    },

    async insertTarget(table, payload) {
      assertResult(await client.from(table).insert(payload), `Unable to create ${table}.${payload.id}`);
    },

    async uploadAttachment(runId, record) {
      const safeName = record.attachment.file_name.replace(/[^a-zA-Z0-9._-]/g, '-');
      const bucket = record.payload.storage_bucket || 'resident-documents';
      const path = `${record.payload.organization_id}/migrations/${runId}/${record.targetId}-${safeName}`;
      const content = await readVerifiedAttachment(record.attachment);
      assertResult(await client.storage.from(bucket).upload(path, content, {
        contentType: record.attachment.mime_type,
        upsert: false,
      }), `Unable to upload attachment for ${record.sourceEntity}.${record.sourceId}`);
      return { storage_bucket: bucket, storage_path: path, file_url: null };
    },

    async recordSource(runId, record) {
      assertResult(await client.from('migration_source_records').insert({
        migration_run_id: runId,
        organization_id: record.payload.organization_id,
        source_system: record.sourceSystem,
        source_entity: record.sourceEntity,
        source_id: record.sourceId,
        source_sha256: record.sourceSha256,
        target_table: record.targetTable,
        target_id: record.targetId,
        status: record.action === 'skip' ? 'skipped' : 'imported',
        normalized_payload: record.payload,
        imported_at: new Date().toISOString(),
      }), `Unable to record migration lineage for ${record.sourceEntity}.${record.sourceId}`);
    },

    async completeRun(runId, importedCounts) {
      assertResult(await client.from('migration_runs').update({
        status: 'completed', imported_counts: importedCounts, completed_at: new Date().toISOString(),
      }).eq('id', runId), 'Unable to complete migration run');
    },

    async failRun(runId, error, failedRecord) {
      const auditErrors = [];
      const failedAt = new Date().toISOString();
      try {
        assertResult(
          await client.from('migration_source_records').update({
            status: 'failed', error_message: error.message,
          }).eq('migration_run_id', runId).eq('status', 'imported'),
          'Unable to mark migration lineage failed',
        );
      } catch (auditError) {
        auditErrors.push(auditError);
      }
      if (failedRecord) {
        try {
          assertResult(await client.from('migration_source_records').upsert({
            migration_run_id: runId,
            organization_id: failedRecord.payload.organization_id,
            source_system: failedRecord.sourceSystem,
            source_entity: failedRecord.sourceEntity,
            source_id: failedRecord.sourceId,
            source_sha256: failedRecord.sourceSha256,
            target_table: failedRecord.targetTable,
            target_id: failedRecord.targetId,
            status: failedRecord.action === 'skip' ? 'skipped' : 'failed',
            normalized_payload: failedRecord.payload,
            error_message: error.message,
            imported_at: null,
          }, { onConflict: 'migration_run_id,source_entity,source_id' }),
          `Unable to record failed migration lineage for ${failedRecord.sourceEntity}.${failedRecord.sourceId}`);
        } catch (auditError) {
          auditErrors.push(auditError);
        }
      }
      try {
        assertResult(await client.from('migration_runs').update({
          status: 'failed',
          error_summary: [{ message: error.message }],
          completed_at: failedAt,
        }).eq('id', runId), 'Unable to mark migration run failed');
      } catch (auditError) {
        auditErrors.push(auditError);
      }
      if (auditErrors.length) {
        throw new AggregateError(auditErrors, `${auditErrors.length} migration audit update(s) failed.`);
      }
    },

    async listRunRecords(runId, { includeEvidence = true } = {}) {
      const records = assertResult(
        await client.from('migration_source_records').select('*').eq('migration_run_id', runId),
        'Unable to read migration run records',
      ) || [];
      if (!includeEvidence) return records;
      return Promise.all(records.map(async (record) => {
        if (!record.target_table || !record.target_id) return { ...record, target: null };
        const target = assertResult(
          await client.from(record.target_table).select('*').eq('id', record.target_id).maybeSingle(),
          `Unable to reconcile ${record.target_table}.${record.target_id}`,
        );
        return {
          ...record,
          target,
          attachmentEvidence: target?.storage_path ? await attachmentEvidence(client, target) : undefined,
        };
      }));
    },

    async deleteTarget(table, id) {
      assertResult(await client.from(table).delete().eq('id', id), `Unable to roll back ${table}.${id}`);
    },

    async deleteAttachment(bucket, path) {
      assertResult(await client.storage.from(bucket).remove([path]), `Unable to roll back attachment ${bucket}/${path}`);
    },

    async markRunRolledBack(runId) {
      assertResult(await client.from('migration_source_records').update({ status: 'rolled_back' }).eq('migration_run_id', runId), 'Unable to mark source records rolled back');
      assertResult(await client.from('migration_runs').update({ status: 'rolled_back', completed_at: new Date().toISOString() }).eq('id', runId), 'Unable to mark migration run rolled back');
    },
  };
}
