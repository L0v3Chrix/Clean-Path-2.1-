import { createClient } from 'npm:@supabase/supabase-js@2';
import { normalizePublicIntake } from '../_shared/publicIntake.ts';

const allowedOrigins = (Deno.env.get('PUBLIC_INTAKE_ALLOWED_ORIGINS') || '*')
  .split(',').map((value) => value.trim()).filter(Boolean);

function corsHeaders(request: Request) {
  const origin = request.headers.get('origin') || '';
  const allowed = allowedOrigins.includes('*') || allowedOrigins.includes(origin) ? (origin || '*') : 'null';
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

function response(request: Request, status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(request), 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function decodeDataUrl(dataUrl: unknown, maximumBytes: number) {
  if (typeof dataUrl !== 'string') throw new Error('Missing document data.');
  if (dataUrl.length > Math.ceil(maximumBytes * 1.4) + 200) throw new Error('A submitted file exceeds the size limit.');
  const match = dataUrl.match(/^data:(application\/pdf|image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) throw new Error('Only PDF, PNG, JPEG, and WebP documents are accepted.');
  const binary = atob(match[2]);
  if (binary.length > maximumBytes) throw new Error('A submitted file exceeds the size limit.');
  return { mimeType: match[1], bytes: Uint8Array.from(binary, (character) => character.charCodeAt(0)) };
}

function safeFileName(value: unknown) {
  const name = typeof value === 'string' ? value : 'document';
  return name.replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 180) || 'document';
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(request) });
  if (request.method !== 'POST') return response(request, 405, { error: 'Method not allowed.' });
  if (corsHeaders(request)['Access-Control-Allow-Origin'] === 'null') return response(request, 403, { error: 'Origin not allowed.' });

  try {
    const body = await request.json();
    const token = typeof body.token === 'string' ? body.token.trim() : '';
    if (token.length < 32) return response(request, 401, { error: 'This intake link is invalid or expired.' });

    const client = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const tokenHash = await sha256(token);
    const { data: tokenRecord, error: tokenError } = await client
      .from('public_intake_tokens')
      .select('id, organization_id, expires_at')
      .eq('token_hash', tokenHash).eq('is_active', true).maybeSingle();
    if (tokenError) throw tokenError;
    if (!tokenRecord || (tokenRecord.expires_at && new Date(tokenRecord.expires_at) <= new Date())) {
      return response(request, 401, { error: 'This intake link is invalid or expired.' });
    }

    const organizationId = tokenRecord.organization_id;
    if (body.action === 'configuration') {
      const [{ data: organization, error: orgError }, { data: locations, error: locationsError }] = await Promise.all([
        client.from('organizations').select('name, house_rules').eq('id', organizationId).single(),
        client.from('locations').select('id, name, city, state').eq('organization_id', organizationId).eq('status', 'active').order('name'),
      ]);
      if (orgError) throw orgError;
      if (locationsError) throw locationsError;
      return response(request, 200, { organization, locations: locations || [] });
    }

    if (body.action !== 'submit') return response(request, 400, { error: 'Unknown public-intake action.' });
    const normalized = normalizePublicIntake(body.application);
    if (!normalized.ok) return response(request, 422, { error: normalized.errors.join(' ') });

    if (normalized.resident.location_id) {
      const { data: location } = await client.from('locations').select('id')
        .eq('id', normalized.resident.location_id).eq('organization_id', organizationId).eq('status', 'active').maybeSingle();
      if (!location) return response(request, 422, { error: 'The selected location is unavailable.' });
    }

    const documents = Array.isArray(body.documents) ? body.documents.slice(0, 8) : [];
    if (!documents.some((document) => document?.key === 'photo_id')) {
      return response(request, 422, { error: 'A government-issued photo ID is required.' });
    }

    const { data: resident, error: residentError } = await client.from('residents').insert({
      ...normalized.resident,
      organization_id: organizationId,
    }).select('id').single();
    if (residentError) throw residentError;

    const uploadedPaths: string[] = [];
    try {
      if (normalized.emergencyContact) {
        const { error } = await client.from('resident_contacts').insert({
          ...normalized.emergencyContact, organization_id: organizationId, resident_id: resident.id,
        });
        if (error) throw error;
      }

      const documentRows: Record<string, unknown>[] = [];
      const allDocuments = [
        ...documents,
        { key: 'resident_agreement', file_name: 'resident-agreement-signature.png', data_url: body.signature_data_url },
      ];
      for (const document of allDocuments) {
        const decoded = decodeDataUrl(document.data_url, document.key === 'resident_agreement' ? 1_500_000 : 10_000_000);
        const path = `${organizationId}/public-intake/${resident.id}/${crypto.randomUUID()}-${safeFileName(document.file_name)}`;
        const { error: uploadError } = await client.storage.from('intake-attachments').upload(path, decoded.bytes, {
          contentType: decoded.mimeType, upsert: false,
        });
        if (uploadError) throw uploadError;
        uploadedPaths.push(path);
        documentRows.push({
          organization_id: organizationId,
          resident_id: resident.id,
          location_id: normalized.resident.location_id || null,
          title: safeFileName(document.file_name),
          label: document.key === 'resident_agreement' ? 'House Rules E-Signature' : safeFileName(document.file_name),
          document_type: document.key,
          storage_bucket: 'intake-attachments',
          storage_path: path,
          status: 'current',
          visibility_scope: 'staff_and_admin',
          signed_at: document.key === 'resident_agreement' ? new Date().toISOString() : null,
        });
      }
      const { error: documentsError } = await client.from('resident_documents').insert(documentRows);
      if (documentsError) throw documentsError;
      const { error: auditError } = await client.rpc('record_public_intake_submission_audit', {
        requested_organization_id: organizationId,
        requested_resident_id: resident.id,
      });
      if (auditError) throw auditError;
      await client.from('public_intake_tokens').update({ last_used_at: new Date().toISOString() }).eq('id', tokenRecord.id);
      return response(request, 201, { ok: true, application_id: resident.id });
    } catch (error) {
      if (uploadedPaths.length) await client.storage.from('intake-attachments').remove(uploadedPaths);
      await client.from('residents').delete().eq('id', resident.id);
      throw error;
    }
  } catch (error) {
    console.error('public-intake failure', error);
    return response(request, 500, { error: 'The application could not be submitted. Please contact the housing office.' });
  }
});
