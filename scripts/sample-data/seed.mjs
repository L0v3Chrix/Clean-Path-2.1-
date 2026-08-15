import { Buffer } from 'node:buffer';
import {
  buildSampleDataset,
  createStorageObjectPlan,
  insertOrder,
  validateDatasetShape,
} from './sampleDataset.mjs';
import {
  createSupabaseAdminClient,
  logStep,
  upsertTableRows,
} from './runtime.mjs';
import { sampleAuthPassword } from './authPassword.mjs';

async function listAllUsers(supabase) {
  const users = [];
  let page = 1;
  const perPage = 1000;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(`Unable to list auth users: ${error.message}`);
    users.push(...(data?.users || []));
    if (!data?.users || data.users.length < perPage) break;
    page += 1;
  }

  return users;
}

async function upsertSampleAuthUsers(supabase, authUsers) {
  const existingUsers = await listAllUsers(supabase);
  const idsByKey = {};

  for (const sampleUser of authUsers) {
    const existing = existingUsers.find((user) => user.email?.toLowerCase() === sampleUser.email.toLowerCase());
    if (existing) {
      if (process.env.SAMPLE_AUTH_PASSWORD) {
        const { error } = await supabase.auth.admin.updateUserById(existing.id, {
          password: sampleAuthPassword(),
        });
        if (error) throw new Error(`Unable to set test password for ${sampleUser.email}: ${error.message}`);
      }
      idsByKey[sampleUser.key] = existing.id;
      continue;
    }

    const { data, error } = await supabase.auth.admin.createUser({
      email: sampleUser.email,
      password: sampleAuthPassword(),
      email_confirm: true,
      user_metadata: {
        full_name: sampleUser.fullName,
        role: sampleUser.role,
        is_sample_data: true,
      },
    });

    if (error) throw new Error(`Unable to create sample auth user ${sampleUser.email}: ${error.message}`);
    idsByKey[sampleUser.key] = data.user.id;
  }

  return idsByKey;
}

async function uploadSampleObjects(supabase, objects) {
  for (const object of objects) {
    const body = Buffer.from(object.body, object.encoding);
    const { error } = await supabase.storage.from(object.bucket).upload(object.path, body, {
      contentType: object.contentType,
      upsert: true,
    });
    if (error) throw new Error(`Unable to upload ${object.bucket}/${object.path}: ${error.message}`);
  }
}

function buildRegistryRows(dataset, storageObjects, authUserIds) {
  const tableRows = Object.entries(dataset.tables).flatMap(([table, rows]) =>
    rows.map((row) => ({
      batch_id: dataset.batch.id,
      organization_id: dataset.batch.organization_id,
      resource_type: 'table_row',
      table_name: table,
      record_id: row.id,
      record_label: row.title || row.name || row.email || row.first_name || table,
    })),
  );

  const storageRows = storageObjects.map((object) => ({
    batch_id: dataset.batch.id,
    organization_id: dataset.batch.organization_id,
    resource_type: 'storage_object',
    storage_bucket: object.bucket,
    storage_path: object.path,
    record_label: `${object.bucket}/${object.path}`,
  }));

  const authRows = dataset.authUsers.map((user) => ({
    batch_id: dataset.batch.id,
    organization_id: dataset.batch.organization_id,
    resource_type: 'auth_user',
    table_name: 'auth.users',
    record_id: authUserIds[user.key],
    external_id: user.email,
    record_label: user.fullName,
  }));

  return [...tableRows, ...storageRows, ...authRows];
}

async function main() {
  const supabase = createSupabaseAdminClient();

  logStep('Creating or reusing sample auth users.');
  const authUserIds = await upsertSampleAuthUsers(supabase, buildSampleDataset().authUsers);
  const dataset = buildSampleDataset({ authUserIds });
  const shape = validateDatasetShape(dataset);
  if (!shape.ok) {
    throw new Error(`Sample dataset is invalid:\n${shape.errors.join('\n')}`);
  }

  logStep(`Upserting sample batch ${dataset.batch.id}.`);
  await upsertTableRows(supabase, 'sample_data_batches', [dataset.batch]);

  for (const table of insertOrder) {
    const rows = dataset.tables[table] || [];
    if (!rows.length) continue;
    logStep(`Upserting ${rows.length} ${table} row(s).`);
    await upsertTableRows(supabase, table, rows);
  }

  const storageObjects = createStorageObjectPlan(dataset);
  logStep(`Uploading ${storageObjects.length} sample storage object(s).`);
  await uploadSampleObjects(supabase, storageObjects);

  logStep('Refreshing sample registry.');
  await supabase.from('sample_data_registry').delete().eq('batch_id', dataset.batch.id);
  await upsertTableRows(supabase, 'sample_data_registry', buildRegistryRows(dataset, storageObjects, authUserIds));

  logStep('Sample data seed complete. Run npm run sample:validate to verify coverage.');
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
