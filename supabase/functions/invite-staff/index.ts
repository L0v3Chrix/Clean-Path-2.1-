import { createClient } from 'npm:@supabase/supabase-js@2';

const OPERATIONAL_ROLES = new Set([
  'owner', 'admin', 'director', 'house_manager', 'case_manager', 'peer_support', 'staff',
]);
const PRIVILEGED_ROLES = new Set(['owner', 'admin']);
const LOCATION_SCOPED_ROLES = new Set(['house_manager', 'case_manager', 'peer_support', 'staff']);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const INVITE_OPERATION_METADATA_KEY = 'invite_operation_id';
const AUTH_LIST_USERS_PAGE_SIZE = 100;

function escapeIlikePattern(value: string) {
  return value.replace(/[\\%_]/g, '\\$&');
}

function staffInviteRedirectUrl() {
  const staffRedirect = Deno.env.get('STAFF_INVITE_REDIRECT_URL');
  const configured = staffRedirect === undefined
    ? Deno.env.get('USER_INVITE_REDIRECT_URL')
    : staffRedirect;
  if (!configured) return null;

  const redirectTo = configured.trim();
  try {
    const parsed = new URL(redirectTo);
    const isLocalHttp = parsed.protocol === 'http:'
      && (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1');
    const isAllowedProtocol = parsed.protocol === 'https:' || isLocalHttp;
    const hasInvitePath = parsed.pathname === '/accept-invite'
      && !parsed.search
      && !parsed.hash;
    const hasCredentials = Boolean(parsed.username || parsed.password);
    return isAllowedProtocol && hasInvitePath && !hasCredentials ? redirectTo : null;
  } catch {
    return null;
  }
}

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
  } });
}

function inviteOperationMarker() {
  return crypto.randomUUID();
}

function inviteActivationSecret() {
  return crypto.randomUUID();
}

function redirectWithActivationSecret(redirectTo: string, activationSecret: string) {
  return `${redirectTo}#activation_token=${encodeURIComponent(activationSecret)}`;
}

function inviteOperationOwner(user: { id?: string; user_metadata?: Record<string, unknown>; app_metadata?: Record<string, unknown> } | null | undefined) {
  return user?.user_metadata?.[INVITE_OPERATION_METADATA_KEY]
    ?? user?.app_metadata?.[INVITE_OPERATION_METADATA_KEY];
}

function generatedLinkUser(
  link:
    | {
      user?: { id?: string; user_metadata?: Record<string, unknown>; app_metadata?: Record<string, unknown> };
      properties?: {
        user?: { id?: string; user_metadata?: Record<string, unknown>; app_metadata?: Record<string, unknown> };
      };
    }
    | null
    | undefined,
) {
  return link?.user ?? link?.properties?.user ?? null;
}

async function authUserExistsByEmail(
  admin: ReturnType<typeof createClient>,
  email: string,
) {
  let page = 1;
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: AUTH_LIST_USERS_PAGE_SIZE,
    });
    if (error) throw error;
    const users = Array.isArray(data?.users) ? data.users : [];
    if (users.some((user) => typeof user.email === 'string' && user.email.trim().toLowerCase() === email)) {
      return true;
    }
    const nextPage = typeof data?.nextPage === 'number' ? data.nextPage : null;
    if (nextPage) {
      page = nextPage;
      continue;
    }
    if (users.length < AUTH_LIST_USERS_PAGE_SIZE) return false;
    page += 1;
  }
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
    if (role === 'owner' && callerMembership.role !== 'owner') {
      return json(403, { error: 'Only an owner can grant owner access.' });
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

    let profileQuery = admin.from('staff_profiles').select('*')
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
    const existingProfileSnapshot = existingProfile ? { ...existingProfile } : null;
    if (existingProfile?.user_id) {
      return json(409, { error: 'Staff profile is already linked to a user.' });
    }
    if (await authUserExistsByEmail(admin, email)) {
      return json(409, { error: 'Unable to invite staff member.' });
    }

    const fullName = `${body.first_name || ''} ${body.last_name || ''}`.trim();
    const redirectTo = staffInviteRedirectUrl();
    if (!redirectTo) {
      return json(503, { error: 'Staff invitations are not configured.' });
    }
    const operationMarker = inviteOperationMarker();
    const activationSecret = inviteActivationSecret();
    const invitationRedirectTo = redirectWithActivationSecret(redirectTo, activationSecret);
    const { data: link, error: linkError } = await admin.auth.admin.generateLink({
      type: 'invite',
      email,
      options: {
        data: { full_name: fullName, [INVITE_OPERATION_METADATA_KEY]: operationMarker },
        redirectTo: invitationRedirectTo,
      },
    });
    if (linkError) throw linkError;
    const invitedUser = generatedLinkUser(link);
    const invitedUserId = invitedUser?.id;
    if (!invitedUserId) {
      return json(503, { error: 'Unable to invite staff member.' });
    }
    if (inviteOperationOwner(invitedUser) !== operationMarker) {
      return json(409, { error: 'Unable to invite staff member.' });
    }

    let rollbackProfile: (() => Promise<boolean>) | null = null;
    let membershipId: string | null = null;
    const failAfterFinalization = async () => {
      console.error('invite-staff finalization failure');
      let authorizationCleanupSucceeded = true;
      try {
        const { error: revokeError } = await admin.rpc('revoke_pre_authorized_invitation', {
          p_user_id: invitedUserId,
          p_operation_marker: operationMarker,
        });
        if (revokeError) authorizationCleanupSucceeded = false;
      } catch {
        authorizationCleanupSucceeded = false;
      }

      if (membershipId) {
        try {
          const { error: deactivateError } = await admin.from('organization_members')
            .update({ status: 'inactive' })
            .eq('id', membershipId)
            .eq('organization_id', organizationId)
            .eq('user_id', invitedUserId);
          if (deactivateError) authorizationCleanupSucceeded = false;
        } catch {
          authorizationCleanupSucceeded = false;
        }
        try {
          const { error: assignmentCleanupError } = await admin.from('organization_member_locations')
            .delete().eq('organization_member_id', membershipId);
          if (assignmentCleanupError) authorizationCleanupSucceeded = false;
        } catch {
          authorizationCleanupSucceeded = false;
        }
        try {
          const { error: membershipCleanupError } = await admin.from('organization_members')
            .delete()
            .eq('id', membershipId)
            .eq('organization_id', organizationId)
            .eq('user_id', invitedUserId);
          if (membershipCleanupError) authorizationCleanupSucceeded = false;
        } catch {
          authorizationCleanupSucceeded = false;
        }
      }

      let profileCleanupSucceeded = true;
      if (rollbackProfile) {
        try {
          profileCleanupSucceeded = await rollbackProfile();
        } catch {
          profileCleanupSucceeded = false;
        }
      }

      let authCleanupSucceeded = true;
      try {
        const { error: cleanupError } = await admin.auth.admin.deleteUser(invitedUserId);
        if (cleanupError) {
          authCleanupSucceeded = false;
        }
      } catch {
        authCleanupSucceeded = false;
      }
      if (!authorizationCleanupSucceeded || !profileCleanupSucceeded || !authCleanupSucceeded) {
        console.error('invite-staff cleanup failure');
        return json(503, { error: 'Unable to invite staff member.' });
      }
      return json(500, { error: 'Unable to invite staff member.' });
    };

    try {
      const membershipRole = PRIVILEGED_ROLES.has(role) ? role : 'staff';
      const { data: membership, error: membershipError } = await admin.from('organization_members').upsert({
        organization_id: organizationId,
        user_id: invitedUserId,
        role: membershipRole,
        display_name: fullName || email,
        email,
        status: 'invited',
      }, { onConflict: 'organization_id,user_id' }).select('id').single();
      if (membershipError) throw membershipError;
      membershipId = membership.id;

      const profile = {
        organization_id: organizationId,
        user_id: invitedUserId,
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
      if (!linkedProfile?.id) {
        throw new Error('Staff profile link changed during invitation.');
      }
      if (existingProfileSnapshot) {
        const { id, organization_id: priorOrganizationId, created_at, updated_at, ...priorProfile } = existingProfileSnapshot;
        rollbackProfile = async () => {
          const { data: restoredProfile, error: restoreError } = await admin.from('staff_profiles')
            .update(priorProfile).eq('id', id).eq('organization_id', priorOrganizationId)
            .eq('user_id', invitedUserId).select('id').maybeSingle();
          return !restoreError && restoredProfile?.id === id;
        };
      } else {
        const insertedProfileId = linkedProfile.id;
        rollbackProfile = async () => {
          const { data: deletedProfile, error: deleteProfileError } = await admin.from('staff_profiles')
            .delete().eq('id', insertedProfileId).eq('organization_id', organizationId)
            .eq('user_id', invitedUserId).select('id').maybeSingle();
          return !deleteProfileError && deletedProfile?.id === insertedProfileId;
        };
      }

      const { error: assignmentResetError } = await admin.from('organization_member_locations')
        .delete().eq('organization_member_id', membership.id);
      if (assignmentResetError) throw assignmentResetError;
      if (locationIds.length) {
        const { error: assignmentsError } = await admin.from('organization_member_locations').insert(
          locationIds.map((locationId) => ({
            organization_id: organizationId, organization_member_id: membership.id, location_id: locationId,
          })),
        );
        if (assignmentsError) throw assignmentsError;
      }
      const { error: registrationError } = await admin.rpc('register_pre_authorized_invitation', {
        p_organization_id: organizationId,
        p_user_id: invitedUserId,
        p_membership_id: membership.id,
        p_staff_profile_id: linkedProfile.id,
        p_email: email,
        p_invited_by_user_id: callerData.user.id,
        p_operation_marker: operationMarker,
        p_activation_token: activationSecret,
      });
      if (registrationError) throw registrationError;

      const { data: invite, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
        data: { full_name: fullName, [INVITE_OPERATION_METADATA_KEY]: operationMarker },
        redirectTo: invitationRedirectTo,
      });
      if (inviteError) throw inviteError;
      if (!invite.user?.id || invite.user.id !== invitedUserId) {
        throw new Error('Staff invite delivery returned an unexpected user.');
      }
      if (inviteOperationOwner(invite.user) !== operationMarker) {
        throw new Error('Staff invite delivery returned an unexpected marker.');
      }
      return json(201, { ok: true, user_id: invitedUserId });
    } catch {
      return failAfterFinalization();
    }
  } catch {
    console.error('invite-staff failure');
    return json(500, { error: 'Unable to invite staff member.' });
  }
});
