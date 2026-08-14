import { createClient } from 'npm:@supabase/supabase-js@2';

const OPERATIONAL_ROLES = new Set([
  'platform_admin', 'owner', 'director', 'house_manager', 'peer_support', 'case_manager', 'staff', 'volunteer',
]);

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
  } });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return json(200, { ok: true });
  if (request.method !== 'POST') return json(405, { error: 'Method not allowed.' });
  try {
    const authorization = request.headers.get('Authorization');
    if (!authorization) return json(401, { error: 'Authentication required.' });
    const url = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: callerData } = await admin.auth.getUser(authorization.replace(/^Bearer\s+/i, ''));
    if (!callerData.user) return json(401, { error: 'Authentication required.' });

    const body = await request.json();
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const organizationId = typeof body.organization_id === 'string' ? body.organization_id : '';
    const role = typeof body.role === 'string' ? body.role : 'staff';
    const locationIds = Array.isArray(body.location_ids) ? [...new Set(body.location_ids)] : [];
    if (!email.includes('@') || !organizationId || !OPERATIONAL_ROLES.has(role)) {
      return json(422, { error: 'Email, organization, and a supported role are required.' });
    }

    const { data: callerMembership } = await admin.from('organization_members').select('role')
      .eq('organization_id', organizationId).eq('user_id', callerData.user.id)
      .eq('status', 'active').in('role', ['owner', 'admin']).maybeSingle();
    if (!callerMembership) return json(403, { error: 'Only organization administrators can invite staff.' });
    if (role === 'owner' && callerMembership.role !== 'owner') return json(403, { error: 'Only an owner can invite another owner.' });

    if (locationIds.length) {
      const { count } = await admin.from('locations').select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId).in('id', locationIds);
      if (count !== locationIds.length) return json(422, { error: 'One or more house assignments are invalid.' });
    }

    const fullName = `${body.first_name || ''} ${body.last_name || ''}`.trim();
    const redirectTo = Deno.env.get('STAFF_INVITE_REDIRECT_URL');
    const { data: invite, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { full_name: fullName },
      ...(redirectTo ? { redirectTo } : {}),
    });
    if (inviteError) throw inviteError;

    const membershipRole = role === 'owner' ? 'owner' : role === 'platform_admin' ? 'admin' : 'staff';
    const { data: membership, error: membershipError } = await admin.from('organization_members').upsert({
      organization_id: organizationId,
      user_id: invite.user.id,
      role: membershipRole,
      display_name: fullName || email,
      email,
      status: 'active',
    }, { onConflict: 'organization_id,user_id' }).select('id').single();
    if (membershipError) throw membershipError;

    const { error: profileError } = await admin.from('staff_profiles').upsert({
      organization_id: organizationId,
      user_id: invite.user.id,
      first_name: body.first_name,
      last_name: body.last_name,
      email,
      phone: body.phone || null,
      title: body.title || null,
      role,
      location_ids: locationIds,
      status: 'active',
    }, { onConflict: 'organization_id,user_id' });
    if (profileError) throw profileError;

    await admin.from('organization_member_locations').delete().eq('organization_member_id', membership.id);
    if (locationIds.length) {
      const { error: assignmentsError } = await admin.from('organization_member_locations').insert(
        locationIds.map((locationId) => ({
          organization_id: organizationId, organization_member_id: membership.id, location_id: locationId,
        })),
      );
      if (assignmentsError) throw assignmentsError;
    }
    return json(201, { ok: true, user_id: invite.user.id });
  } catch (error) {
    console.error('invite-staff failure', error);
    return json(500, { error: error.message || 'Unable to invite staff member.' });
  }
});
