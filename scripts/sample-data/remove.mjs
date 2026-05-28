import { deleteOrder } from './sampleDataset.mjs';
import {
  createSupabaseAdminClient,
  groupBy,
  logStep,
  parseArgs,
  resolveBatchId,
} from './runtime.mjs';

async function getRegistryRows(supabase, batchId) {
  const { data, error } = await supabase
    .from('sample_data_registry')
    .select('*')
    .eq('batch_id', batchId);
  if (error) throw new Error(`Unable to read sample registry: ${error.message}`);
  return data || [];
}

async function removeStorageObjects(supabase, registryRows) {
  const storageRows = registryRows.filter((row) => row.resource_type === 'storage_object' && row.storage_bucket && row.storage_path);
  const grouped = groupBy(storageRows, (row) => row.storage_bucket);

  for (const [bucket, rows] of grouped.entries()) {
    const paths = rows.map((row) => row.storage_path);
    const { error } = await supabase.storage.from(bucket).remove(paths);
    if (error) throw new Error(`Unable to remove sample files from ${bucket}: ${error.message}`);
    logStep(`Removed ${paths.length} sample file(s) from ${bucket}.`);
  }
}

async function removeSampleRows(supabase, batchId) {
  const { data, error } = await supabase.rpc('clear_sample_data', { p_batch_id: batchId });
  if (error) throw new Error(`Unable to clear sample rows: ${error.message}`);
  logStep(`Database cleanup complete: ${JSON.stringify(data)}`);
}

async function removeAuthUsers(supabase, registryRows) {
  const authRows = registryRows.filter((row) => row.resource_type === 'auth_user' && row.record_id);
  for (const row of authRows) {
    const { error } = await supabase.auth.admin.deleteUser(row.record_id);
    if (error && !/not found/i.test(error.message)) {
      throw new Error(`Unable to delete sample auth user ${row.external_id || row.record_id}: ${error.message}`);
    }
  }
  if (authRows.length) logStep(`Removed ${authRows.length} sample auth user(s).`);
}

async function assertNoSampleRowsRemain(supabase) {
  const leftovers = [];
  for (const table of deleteOrder) {
    const { count, error } = await supabase
      .from(table)
      .select('id', { count: 'exact', head: true })
      .eq('is_sample_data', true);
    if (error) throw new Error(`Unable to verify ${table}: ${error.message}`);
    if (count > 0) leftovers.push(`${table}: ${count}`);
  }
  if (leftovers.length) throw new Error(`Sample rows remain after cleanup:\n${leftovers.join('\n')}`);
}

async function main() {
  const args = parseArgs();
  if (!args.confirm) {
    throw new Error('Refusing to remove sample data without --confirm. Use: npm run sample:remove -- --confirm --batch latest');
  }

  const supabase = createSupabaseAdminClient();
  const batchId = await resolveBatchId(supabase, args.batch || 'latest');
  logStep(`Removing sample batch ${batchId}.`);

  const registryRows = await getRegistryRows(supabase, batchId);
  await removeStorageObjects(supabase, registryRows);
  await removeSampleRows(supabase, batchId);
  await removeAuthUsers(supabase, registryRows);
  await assertNoSampleRowsRemain(supabase);

  logStep('Sample data removal verified.');
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
