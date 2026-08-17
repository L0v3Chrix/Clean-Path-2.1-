import { createClient } from 'npm:@supabase/supabase-js@2';

const REQUEST_FIELDS = new Set(['bucket', 'path', 'expires']);
const GENERIC_ACCESS_ERROR = 'Unable to access this secure document.';
const MAX_SIGNED_URL_TTL_SECONDS = 600;

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
    },
  });
}

function bearerToken(authorization: string | null) {
  const match = authorization?.match(/^Bearer (\S+)$/);
  return match?.[1] ?? null;
}

function isValidRequestBody(body: unknown) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return false;
  return Object.keys(body).every((field) => REQUEST_FIELDS.has(field));
}

function externallyReachableSignedUrl(value: string) {
  const signedUrl = new URL(value);
  if (signedUrl.hostname !== 'kong') return signedUrl.toString();

  const configuredPublicUrl = Deno.env.get('CLEARPATH_SUPABASE_PUBLIC_URL');
  if (!configuredPublicUrl) throw new Error('Missing public Supabase URL.');
  const publicUrl = new URL(configuredPublicUrl);
  const isLocalHttp = publicUrl.protocol === 'http:'
    && (publicUrl.hostname === '127.0.0.1' || publicUrl.hostname === 'localhost');
  if ((publicUrl.protocol !== 'https:' && !isLocalHttp)
    || publicUrl.username || publicUrl.password || publicUrl.search || publicUrl.hash) {
    throw new Error('Unexpected internal storage URL.');
  }
  signedUrl.protocol = publicUrl.protocol;
  signedUrl.hostname = publicUrl.hostname;
  signedUrl.port = publicUrl.port;
  return signedUrl.toString();
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return json(200, { ok: true });
  if (request.method !== 'POST') return json(405, { error: 'Method not allowed.' });

  try {
    const token = bearerToken(request.headers.get('Authorization'));
    if (!token) return json(401, { error: 'Authentication required.' });

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return json(400, { error: 'Invalid JSON.' });
    }

    if (!isValidRequestBody(body)) {
      return json(422, { error: 'Invalid document request.' });
    }

    const payload = body as Record<string, unknown>;
    const bucket = typeof payload.bucket === 'string' ? payload.bucket.trim() : '';
    const path = typeof payload.path === 'string' ? payload.path.trim() : '';
    const expires = payload.expires;

    if (!bucket || !path || /^https?:\/\//i.test(path) || /^data:/i.test(path)
      || !Number.isInteger(expires) || expires < 1 || expires > MAX_SIGNED_URL_TTL_SECONDS) {
      return json(422, { error: 'Invalid document request.' });
    }

    const url = Deno.env.get('SUPABASE_URL')!;
    const publishableKey = Deno.env.get('SUPABASE_ANON_KEY')
      ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const callerClient = createClient(url, publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: callerData, error: callerError } = await callerClient.auth.getUser(token);
    if (callerError || !callerData.user) {
      return json(401, { error: 'Authentication required.' });
    }

    const { data: authorization, error: auditError } = await callerClient.rpc('record_document_access', {
      p_bucket: bucket,
      p_path: path,
    });
    if (auditError
      || !authorization
      || typeof authorization !== 'object'
      || Array.isArray(authorization)
      || authorization.bucket !== bucket
      || authorization.path !== path) {
      return json(403, { error: GENERIC_ACCESS_ERROR });
    }

    const adminClient = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await adminClient.storage.from(bucket).createSignedUrl(path, expires);
    if (error || !data?.signedUrl) {
      throw error ?? new Error('Missing signed URL.');
    }

    return json(200, {
      signedUrl: externallyReachableSignedUrl(data.signedUrl),
    });
  } catch {
    return json(500, { error: GENERIC_ACCESS_ERROR });
  }
});
