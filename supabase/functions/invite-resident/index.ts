import { createClient } from 'npm:@supabase/supabase-js@2';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REQUEST_FIELDS = new Set(['resident_id']);
const INVITE_OPERATION_METADATA_KEY = 'invite_operation_id';
const AUTH_LIST_USERS_PAGE_SIZE = 100;

type ResidentRecord = {
  id: string;
  organization_id: string;
  status: string;
  user_id: string | null;
  first_name: string;
  last_name: string;
  email: string;
};

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
  const match = authorization?.match(/^Bearer\s+(\S+)$/i);
  return match?.[1] ?? null;
}

function residentInviteRedirectUrl() {
  const configured = Deno.env.get('RESIDENT_INVITE_REDIRECT_URL')
    || Deno.env.get('USER_INVITE_REDIRECT_URL');
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

function inviteOperationMarker() {
  return crypto.randomUUID();
}

function inviteActivationSecret() {
  return crypto.randomUUID();
}

function redirectWithActivationSecret(redirectTo: string, activationSecret: string) {
  return `${redirectTo}#activation_token=${encodeURIComponent(activationSecret)}`;
}

function inviteOperationOwner(user: { user_metadata?: Record<string, unknown>; app_metadata?: Record<string, unknown> } | null | undefined) {
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
    const token = bearerToken(request.headers.get('Authorization'));
    if (!token) return json(401, { error: 'Authentication required.' });

    const url = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: callerData, error: callerError } = await admin.auth.getUser(token);
    if (callerError || !callerData.user) return json(401, { error: 'Authentication required.' });

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return json(400, { error: 'Invalid JSON.' });
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)
      || Object.keys(body).some((field) => !REQUEST_FIELDS.has(field))) {
      return json(422, { error: 'Resident id is required.' });
    }

    const payload = body as Record<string, unknown>;
    const residentId = typeof payload.resident_id === 'string' ? payload.resident_id.trim() : '';
    if (!UUID_PATTERN.test(residentId)) {
      return json(422, { error: 'Resident id is required.' });
    }

    const { data: residentData, error: residentError } = await admin
      .from('residents')
      .select('id, organization_id, status, user_id, first_name, last_name, email')
      .eq('id', residentId)
      .maybeSingle();
    if (residentError) throw residentError;
    const resident = residentData as ResidentRecord | null;
    if (!resident) return json(404, { error: 'Resident not found.' });

    const { data: callerMembership, error: membershipError } = await admin
      .from('organization_members')
      .select('role')
      .eq('organization_id', resident.organization_id)
      .eq('user_id', callerData.user.id)
      .eq('status', 'active')
      .maybeSingle();
    if (membershipError) throw membershipError;
    if (!callerMembership) return json(404, { error: 'Resident not found.' });
    if (!['owner', 'admin'].includes(callerMembership.role)) {
      return json(403, { error: 'Only organization administrators can invite residents.' });
    }

    if (resident.status !== 'active' || resident.user_id !== null) {
      return json(409, { error: 'Resident is not eligible for invitation.' });
    }
    const email = resident.email?.trim().toLowerCase() || '';
    if (!EMAIL_PATTERN.test(email)) {
      return json(409, { error: 'Resident must have a valid email before invitation.' });
    }
    if (await authUserExistsByEmail(admin, email)) {
      return json(409, { error: 'Unable to invite resident.' });
    }

    const fullName = `${resident.first_name || ''} ${resident.last_name || ''}`
      .trim()
      .replace(/\s+/g, ' ');
    const redirectTo = residentInviteRedirectUrl();
    if (!redirectTo) return json(500, { error: 'Unable to invite resident.' });
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
    if (!invitedUser?.id) throw new Error('Invitation did not return a user.');
    if (inviteOperationOwner(invitedUser) !== operationMarker) {
      return json(409, { error: 'Unable to invite resident.' });
    }

    const compensateAndDeletePendingUser = async () => {
      let authorizationCleanupSucceeded = true;
      let residentCleanupSucceeded = true;
      let membershipCleanupSucceeded = true;

      try {
        const { error: revokeError } = await admin.rpc('revoke_pre_authorized_invitation', {
          p_user_id: invitedUser.id,
          p_operation_marker: operationMarker,
        });
        if (revokeError) authorizationCleanupSucceeded = false;
      } catch {
        authorizationCleanupSucceeded = false;
      }

      try {
        const { error: residentCleanupError } = await admin
          .from('residents')
          .update({ user_id: null })
          .eq('id', resident.id)
          .eq('organization_id', resident.organization_id)
          .eq('user_id', invitedUser.id);
        if (residentCleanupError) residentCleanupSucceeded = false;
      } catch {
        residentCleanupSucceeded = false;
      }

      try {
        const { error: membershipDeactivationError } = await admin
          .from('organization_members')
          .update({ status: 'inactive' })
          .eq('organization_id', resident.organization_id)
          .eq('user_id', invitedUser.id)
          .eq('role', 'resident');
        if (membershipDeactivationError) membershipCleanupSucceeded = false;

        const { error: membershipCleanupError } = await admin
          .from('organization_members')
          .delete()
          .eq('organization_id', resident.organization_id)
          .eq('user_id', invitedUser.id)
          .eq('role', 'resident');
        if (membershipCleanupError) {
          membershipCleanupSucceeded = false;
        }
      } catch {
        membershipCleanupSucceeded = false;
      }

      let authCleanupSucceeded = true;
      try {
        const { error: cleanupError } = await admin.auth.admin.deleteUser(invitedUser.id);
        if (cleanupError) {
          authCleanupSucceeded = false;
        }
      } catch {
        authCleanupSucceeded = false;
      }

      if (!authorizationCleanupSucceeded || !residentCleanupSucceeded
        || !membershipCleanupSucceeded || !authCleanupSucceeded) {
        return json(503, { error: 'Unable to invite resident.' });
      }
      return json(500, { error: 'Unable to invite resident.' });
    };

    const finalizePayload = {
      p_organization_id: resident.organization_id,
      p_resident_id: resident.id,
      p_user_id: invitedUser.id,
      p_email: email,
      p_invited_by_user_id: callerData.user.id,
      p_operation_marker: operationMarker,
      p_activation_token: activationSecret,
    };
    let finalizeResult: { error: unknown };
    try {
      finalizeResult = await admin.rpc('finalize_resident_invitation', finalizePayload);
    } catch {
      try {
        finalizeResult = await admin.rpc('finalize_resident_invitation', finalizePayload);
      } catch {
        return compensateAndDeletePendingUser();
      }
    }
    if (finalizeResult.error) {
      return compensateAndDeletePendingUser();
    }

    const { data: invite, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { full_name: fullName, [INVITE_OPERATION_METADATA_KEY]: operationMarker },
      redirectTo: invitationRedirectTo,
    });
    if (inviteError) {
      return compensateAndDeletePendingUser();
    }
    if (!invite.user?.id || invite.user.id !== invitedUser.id) {
      return compensateAndDeletePendingUser();
    }
    if (inviteOperationOwner(invite.user) !== operationMarker) {
      return compensateAndDeletePendingUser();
    }

    return json(201, { ok: true, user_id: invitedUser.id, resident_id: resident.id });
  } catch {
    return json(500, { error: 'Unable to invite resident.' });
  }
});
