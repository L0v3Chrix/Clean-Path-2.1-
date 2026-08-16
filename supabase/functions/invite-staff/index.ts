import { createClient } from 'npm:@supabase/supabase-js@2';

const OPERATIONAL_ROLES = new Set([
  'owner', 'admin', 'director', 'house_manager', 'case_manager', 'peer_support', 'staff',
]);
const PRIVILEGED_ROLES = new Set(['owner', 'admin']);
const LOCATION_SCOPED_ROLES = new Set(['house_manager', 'case_manager', 'peer_support', 'staff']);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function escapeIlikePattern(value: string) {
  return value.replace(/[\\%_]/g, '\\$&');
}

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
    const profileId = typeof body.profile_id === 'string' ? body.profile_id.trim() : '';
    if (!email.includes('@') || !organizationId || !OPERATIONAL_ROLES.has(role)) {
      return json(422, { error: 'Email, organization, and a supported role are required.' });
    }
    if (body.profile_id !== undefined && body.profile_id !== null && !UUID_PATTERN.test(profileId)) {
      return json(422, { error: 'Profile id must be a UUID.' });
    }

    const { data: callerMembership } = await admin.from('organization_members').select('role')
      .eq('organization_id', organizationId).eq('user_id', callerData.user.id)
      .eq('status', 'active').in('role', ['owner', 'admin']).maybeSingle();
    if (!callerMembership) return json(403, { error: 'Only organization administrators can invite staff.' });
    if (PRIVILEGED_ROLES.has(role) && callerMembership.role !== 'owner') {
      return json(403, { error: 'Only an owner can grant owner or admin access.' });
    }
    if (LOCATION_SCOPED_ROLES.has(role) && locationIds.length === 0) {
      return json(422, { error: 'At least one house assignment is required for this role.' });
    }

    if (locationIds.length) {
      const { count, error: locationsError } = await admin.from('locations').select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId).eq('status', 'active').in('id', locationIds);
      if (locationsError) throw locationsError;
      if (count !== locationIds.length) return json(422, { error: 'One or more house assignments are invalid.' });
    }

    let profileQuery = admin.from('staff_profiles').select('id, user_id, email')
      .eq('organization_id', organizationId);
    profileQuery = profileId
      ? profileQuery.eq('id', profileId)
      : profileQuery.ilike('email', escapeIlikePattern(email));
    const { data: profileMatches, error: profileLookupError } = await profileQuery.limit(2);
    if (profileLookupError) throw profileLookupError;
    if (profileId && !profileMatches?.length) {
      return json(404, { error: 'Staff profile not found in this organization.' });
    }
    if ((profileMatches?.length || 0) > 1) {
      return json(409, { error: 'Multiple staff profiles match this invitation.' });
    }
    const existingProfile = profileMatches?.[0];
    if (existingProfile?.user_id) {
      return json(409, { error: 'Staff profile is already linked to a user.' });
    }

    const fullName = `${body.first_name || ''} ${body.last_name || ''}`.trim();
    const redirectTo = Deno.env.get('STAFF_INVITE_REDIRECT_URL');
    const { data: invite, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { full_name: fullName },
      ...(redirectTo ? { redirectTo } : {}),
    });
    if (inviteError) throw inviteError;

    const membershipRole = PRIVILEGED_ROLES.has(role) ? role : 'staff';
    const { data: membership, error: membershipError } = await admin.from('organization_members').upsert({
      organization_id: organizationId,
      user_id: invite.user.id,
      role: membershipRole,
      display_name: fullName || email,
      email,
      status: 'invited',
    }, { onConflict: 'organization_id,user_id' }).select('id').single();
    if (membershipError) throw membershipError;

    const profile = {
      organization_id: organizationId,
      user_id: invite.user.id,
      first_name: body.first_name,
      last_name: body.last_name,
      email,
      phone: body.phone || null,
      title: body.title || null,
      role,
      location_ids: locationIds,
      status: 'inactive',
    };
    const profileMutation = existingProfile
      ? admin.from('staff_profiles').update(profile)
        .eq('id', existingProfile.id).eq('organization_id', organizationId).is('user_id', null)
        .select('id').maybeSingle()
      : admin.from('staff_profiles').insert(profile).select('id').single();
    const { data: linkedProfile, error: profileError } = await profileMutation;
    if (profileError) throw profileError;
    if (existingProfile && !linkedProfile) {
      return json(409, { error: 'Staff profile was linked by another invitation.' });
    }

    await admin.from('organization_member_locations').delete().eq('organization_member_id', membership.id);
    if (locationIds.length) {
      const { error: assignmentsError } = await admin.from('organization_member_locations').insert(
        locationIds.map((locationId) => ({
          organization_id: organizationId, organization_member_id: membership.id, location_id: locationId,
        })),
      );
      if (assignmentsError) throw assignmentsError;
    }
    const { error: profileActivationError } = await admin.from('staff_profiles')
      .update({ status: 'active' }).eq('id', existingProfile?.id || linkedProfile?.id)
      .eq('organization_id', organizationId);
    if (profileActivationError) throw profileActivationError;

    const { error: membershipActivationError } = await admin.from('organization_members')
      .update({ status: 'active' }).eq('id', membership.id).eq('status', 'invited');
    if (membershipActivationError) throw membershipActivationError;
    return json(201, { ok: true, user_id: invite.user.id });
  } catch (error) {
    console.error('invite-staff failure', error);
    return json(500, { error: error.message || 'Unable to invite staff member.' });
  }
});
