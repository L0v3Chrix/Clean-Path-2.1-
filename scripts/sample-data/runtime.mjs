import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

export const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export function parseArgs(argv = process.argv.slice(2)) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith('--')) continue;
    const [rawKey, inlineValue] = arg.slice(2).split('=');
    const next = argv[index + 1];
    if (inlineValue !== undefined) {
      args[rawKey] = inlineValue;
    } else if (next && !next.startsWith('--')) {
      args[rawKey] = next;
      index += 1;
    } else {
      args[rawKey] = true;
    }
  }
  return args;
}

function parseEnvLine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return null;
  const separator = trimmed.indexOf('=');
  if (separator === -1) return null;
  const key = trimmed.slice(0, separator).trim();
  let value = trimmed.slice(separator + 1).trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  return [key, value];
}

export function loadEnvFiles() {
  for (const filename of ['.env.local', '.env.sample-data.local']) {
    const envPath = path.join(projectRoot, filename);
    if (!fs.existsSync(envPath)) continue;
    const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      const parsed = parseEnvLine(line);
      if (!parsed) continue;
      const [key, value] = parsed;
      if (process.env[key] === undefined) process.env[key] = value;
    }
  }
}

export function getSupabaseAdminEnv() {
  loadEnvFiles();
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

  if (!url) {
    throw new Error('Missing SUPABASE_URL or VITE_SUPABASE_URL.');
  }
  if (!serviceKey) {
    throw new Error(
      'Missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY. Put it in .env.sample-data.local, never in a browser VITE_ variable.',
    );
  }

  return { url, serviceKey };
}

export function createSupabaseAdminClient() {
  const { url, serviceKey } = getSupabaseAdminEnv();
  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function resolveBatchId(supabase, requestedBatch = 'latest') {
  if (requestedBatch && requestedBatch !== 'latest') return requestedBatch;

  const { data, error } = await supabase
    .from('sample_data_batches')
    .select('id, created_at')
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) throw new Error(`Unable to resolve latest sample batch: ${error.message}`);
  const batchId = data?.[0]?.id;
  if (!batchId) throw new Error('No sample data batch exists.');
  return batchId;
}

export async function upsertTableRows(supabase, table, rows) {
  if (!rows.length) return [];
  const { data, error } = await supabase.from(table).upsert(rows, { onConflict: 'id' }).select('id');
  if (error) throw new Error(`Failed to upsert ${table}: ${error.message}`);
  return data || [];
}

export async function deleteTableRowsByBatch(supabase, table, batchId) {
  const query = supabase.from(table).delete().eq('is_sample_data', true);
  const { error } = batchId ? await query.eq('sample_data_batch_id', batchId) : await query;
  if (error) throw new Error(`Failed to delete ${table}: ${error.message}`);
}

export function groupBy(items, keyFn) {
  return items.reduce((groups, item) => {
    const key = keyFn(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
    return groups;
  }, new Map());
}

export function logStep(message) {
  console.log(`[sample-data] ${message}`);
}
