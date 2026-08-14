import { createClient } from '@supabase/supabase-js';
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

    async createRun(plan) {
      return assertResult(
        await client.from('migration_runs').insert({
          organization_id: plan.manifest.organizationId,
          source_system: plan.manifest.sourceSystem,
          source_manifest: { cutoffAt: plan.manifest.cutoffAt },
          source_sha256: plan.manifestSha256,
          status: 'importing',
          expected_counts: countPlan(plan),
          started_at: new Date().toISOString(),
        }).select('*').single(),
        'Unable to create migration run',
      );
    },

    async upsertTarget(table, payload) {
      assertResult(await client.from(table).upsert(payload, { onConflict: 'id' }), `Unable to import ${table}.${payload.id}`);
    },

    async uploadAttachment(runId, record) {
      const safeName = record.attachment.file_name.replace(/[^a-zA-Z0-9._-]/g, '-');
      const bucket = record.payload.storage_bucket || 'resident-documents';
      const path = `${record.payload.organization_id}/migrations/${runId}/${record.targetId}-${safeName}`;
      const content = await readFile(record.attachment.absolute_path);
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
        status: 'imported',
        normalized_payload: record.payload,
        imported_at: new Date().toISOString(),
      }), `Unable to record migration lineage for ${record.sourceEntity}.${record.sourceId}`);
    },

    async completeRun(runId, importedCounts) {
      assertResult(await client.from('migration_runs').update({
        status: 'completed', imported_counts: importedCounts, completed_at: new Date().toISOString(),
      }).eq('id', runId), 'Unable to complete migration run');
    },

    async failRun(runId, error) {
      assertResult(await client.from('migration_runs').update({
        status: 'failed',
        error_summary: [{ message: error.message }],
        completed_at: new Date().toISOString(),
      }).eq('id', runId), 'Unable to mark migration run failed');
    },

    async listRunRecords(runId) {
      return assertResult(
        await client.from('migration_source_records').select('*').eq('migration_run_id', runId),
        'Unable to read migration run records',
      ) || [];
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
