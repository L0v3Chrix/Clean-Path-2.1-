import {
  MVP_FEATURE_COVERAGE,
  buildSampleDataset,
  createStorageObjectPlan,
  insertOrder,
  validateDatasetShape,
} from './sampleDataset.mjs';
import {
  createSupabaseAdminClient,
  logStep,
  parseArgs,
  resolveBatchId,
} from './runtime.mjs';

async function countRows(supabase, table, batchId) {
  const query = supabase
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq('is_sample_data', true);

  const { count, error } = batchId ? await query.eq('sample_data_batch_id', batchId) : await query;
  if (error) throw new Error(`Unable to count ${table}: ${error.message}`);
  return count || 0;
}

async function validateExpectedData(supabase, batchId) {
  const dataset = buildSampleDataset();
  const shape = validateDatasetShape(dataset);
  const errors = [...shape.errors];

  const { data: batch, error: batchError } = await supabase
    .from('sample_data_batches')
    .select('id, organization_id, label')
    .eq('id', batchId)
    .maybeSingle();

  if (batchError) errors.push(`Unable to read sample batch: ${batchError.message}`);
  if (!batch) errors.push(`Sample batch ${batchId} does not exist.`);

  for (const [feature, tables] of Object.entries(MVP_FEATURE_COVERAGE)) {
    for (const table of tables) {
      const count = await countRows(supabase, table, batchId);
      if (count === 0) errors.push(`${feature} has zero sample rows in ${table}.`);
    }
  }

  const { count: registryCount, error: registryError } = await supabase
    .from('sample_data_registry')
    .select('id', { count: 'exact', head: true })
    .eq('batch_id', batchId);
  if (registryError) errors.push(`Unable to read sample registry: ${registryError.message}`);
  if (!registryCount) errors.push(`Sample batch ${batchId} has no registry rows.`);

  for (const object of createStorageObjectPlan(dataset)) {
    const { error } = await supabase.storage.from(object.bucket).createSignedUrl(object.path, 60);
    if (error) errors.push(`Missing sample storage object ${object.bucket}/${object.path}: ${error.message}`);
  }

  return errors;
}

async function validateEmpty(supabase) {
  const errors = [];

  for (const table of insertOrder) {
    const count = await countRows(supabase, table);
    if (count > 0) errors.push(`${table} still has ${count} sample row(s).`);
  }

  const { count: batchCount, error: batchError } = await supabase
    .from('sample_data_batches')
    .select('id', { count: 'exact', head: true });
  if (batchError) errors.push(`Unable to count sample batches: ${batchError.message}`);
  if (batchCount > 0) errors.push(`${batchCount} sample batch record(s) still exist.`);

  const dataset = buildSampleDataset();
  for (const object of createStorageObjectPlan(dataset)) {
    const { data, error } = await supabase.storage.from(object.bucket).createSignedUrl(object.path, 60);
    if (!error && data?.signedUrl) {
      errors.push(`Sample storage object still exists: ${object.bucket}/${object.path}`);
    }
  }

  return errors;
}

async function main() {
  const args = parseArgs();
  const supabase = createSupabaseAdminClient();

  const errors = args['expect-empty']
    ? await validateEmpty(supabase)
    : await validateExpectedData(supabase, await resolveBatchId(supabase, args.batch || 'latest'));

  if (errors.length) {
    console.error(errors.map((error) => `- ${error}`).join('\n'));
    process.exitCode = 1;
    return;
  }

  logStep(args['expect-empty'] ? 'No sample data remains.' : 'Sample data coverage verified.');
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
