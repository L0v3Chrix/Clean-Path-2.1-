import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers });
  if (request.method !== 'GET' && request.method !== 'POST') {
    return new Response(JSON.stringify({ ok: false }), { status: 405, headers });
  }

  try {
    const client = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { error } = await client.from('organizations').select('id', { head: true, count: 'exact' }).limit(1);
    if (error) throw error;
    return new Response(JSON.stringify({
      ok: true,
      service: 'clearpath-api',
      checks: { database: 'ok' },
      checkedAt: new Date().toISOString(),
    }), { status: 200, headers });
  } catch {
    return new Response(JSON.stringify({
      ok: false,
      service: 'clearpath-api',
      checks: { database: 'failed' },
      checkedAt: new Date().toISOString(),
    }), { status: 503, headers });
  }
});
