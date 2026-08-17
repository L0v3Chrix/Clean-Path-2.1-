import { createClient } from 'npm:@supabase/supabase-js@2';

const INCIDENT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ORGANIZATION_WIDE_ROLES = new Set(['platform_admin', 'owner', 'director']);

type StaffProfile = {
  user_id: string | null;
  email: string | null;
  role: string;
  location_ids: string[] | null;
};

type OrganizationMember = {
  id: string;
  user_id: string;
  email: string | null;
  role: string;
};

type LocationAssignment = {
  organization_member_id: string;
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

function normalizedEmail(value: unknown) {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

function resolveRecipients(
  profiles: StaffProfile[],
  members: OrganizationMember[],
  assignments: LocationAssignment[],
  locationId: string | null,
) {
  const recipients = new Set<string>();
  const assignedMemberIds = new Set(assignments.map((assignment) => assignment.organization_member_id));
  const assignedUserIds = new Set(
    members.filter((member) => assignedMemberIds.has(member.id)).map((member) => member.user_id),
  );

  for (const profile of profiles) {
    const isOrganizationWide = ORGANIZATION_WIDE_ROLES.has(profile.role);
    const isLocationResponder = Boolean(
      (locationId && profile.location_ids?.includes(locationId))
      || (profile.user_id && assignedUserIds.has(profile.user_id)),
    );
    const email = normalizedEmail(profile.email);
    if (email && (isOrganizationWide || isLocationResponder)) recipients.add(email);
  }

  for (const member of members) {
    const isOrganizationWide = member.role === 'owner' || member.role === 'admin';
    const email = normalizedEmail(member.email);
    if (email && (isOrganizationWide || assignedMemberIds.has(member.id))) recipients.add(email);
  }

  return [...recipients];
}

function secureIncidentUrl() {
  const configuredUrl = Deno.env.get('CLEARPATH_APP_URL') || Deno.env.get('SITE_URL');
  if (!configuredUrl) return null;

  try {
    const url = new URL(configuredUrl);
    if (url.protocol !== 'https:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') return null;
    url.pathname = '/incidents';
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
}

async function sendAlert(email: string, apiKey: string, from: string, incidentUrl: string | null) {
  const reviewLink = incidentUrl
    ? `<p><a href="${incidentUrl}">Sign in to ClearPath</a> to review the incident securely.</p>`
    : '<p>Sign in to ClearPath to review the incident securely.</p>';
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject: 'Critical incident alert',
      html: `<p><strong>Critical incident logged.</strong></p><p>Immediate attention may be required.</p>${reviewLink}`,
    }),
  });

  if (!response.ok) throw new Error(`Email provider returned ${response.status}.`);
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return json(200, { ok: true });
  if (request.method !== 'POST') return json(405, { error: 'Method not allowed.' });

  try {
    const authorization = request.headers.get('Authorization');
    if (!authorization) return json(401, { error: 'Authentication required.' });

    const body = await request.json();
    const incidentId = typeof body.incident_id === 'string' ? body.incident_id : '';
    if (!INCIDENT_ID_PATTERN.test(incidentId)) return json(422, { error: 'A valid incident id is required.' });

    const url = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: callerData, error: callerError } = await admin.auth.getUser(
      authorization.replace(/^Bearer\s+/i, ''),
    );
    if (callerError || !callerData.user) return json(401, { error: 'Authentication required.' });

    const { data: incident, error: incidentError } = await admin
      .from('incident_reports')
      .select('id, organization_id, location_id, severity')
      .eq('id', incidentId)
      .maybeSingle();
    if (incidentError) throw incidentError;
    if (!incident || incident.severity !== 'critical') return json(404, { error: 'Critical incident not found.' });

    const { data: callerMembership, error: membershipError } = await admin
      .from('organization_members')
      .select('id, role')
      .eq('organization_id', incident.organization_id)
      .eq('user_id', callerData.user.id)
      .eq('status', 'active')
      .in('role', ['owner', 'admin', 'staff'])
      .maybeSingle();
    if (membershipError) throw membershipError;
    if (!callerMembership) return json(403, { error: 'Not authorized to notify for this incident.' });

    if (callerMembership.role === 'staff') {
      const [{ data: callerProfile, error: profileError }, { data: assignment, error: assignmentError }] = await Promise.all([
        admin.from('staff_profiles').select('role, location_ids').eq('organization_id', incident.organization_id)
          .eq('user_id', callerData.user.id).eq('status', 'active').maybeSingle(),
        incident.location_id
          ? admin.from('organization_member_locations').select('id').eq('organization_id', incident.organization_id)
            .eq('organization_member_id', callerMembership.id).eq('location_id', incident.location_id).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ]);
      if (profileError) throw profileError;
      if (assignmentError) throw assignmentError;

      const hasOrganizationWideRole = Boolean(callerProfile && ORGANIZATION_WIDE_ROLES.has(callerProfile.role));
      const hasProfileAssignment = Boolean(
        incident.location_id && callerProfile?.location_ids?.includes(incident.location_id),
      );
      if (!hasOrganizationWideRole && !hasProfileAssignment && !assignment) {
        return json(403, { error: 'Not authorized to notify for this incident.' });
      }
    }

    const [
      { data: profiles, error: profilesError },
      { data: members, error: membersError },
      { data: assignments, error: assignmentsError },
    ] = await Promise.all([
      admin.from('staff_profiles').select('user_id, email, role, location_ids')
        .eq('organization_id', incident.organization_id).eq('status', 'active'),
      admin.from('organization_members').select('id, user_id, email, role')
        .eq('organization_id', incident.organization_id).eq('status', 'active')
        .in('role', ['owner', 'admin', 'staff']),
      incident.location_id
        ? admin.from('organization_member_locations').select('organization_member_id')
          .eq('organization_id', incident.organization_id).eq('location_id', incident.location_id)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (profilesError) throw profilesError;
    if (membersError) throw membersError;
    if (assignmentsError) throw assignmentsError;

    const recipients = resolveRecipients(profiles || [], members || [], assignments || [], incident.location_id);
    const apiKey = Deno.env.get('RESEND_API_KEY');
    const from = Deno.env.get('CRITICAL_INCIDENT_FROM_EMAIL') || Deno.env.get('RESEND_FROM_EMAIL');
    const providerConfigured = Boolean(apiKey && from);

    if (!providerConfigured) {
      return json(200, {
        ok: true,
        eligibleRecipientCount: recipients.length,
        deliveredCount: 0,
        failedCount: recipients.length,
        providerConfigured: false,
      });
    }

    const results = await Promise.allSettled(
      recipients.map((email) => sendAlert(email, apiKey!, from!, secureIncidentUrl())),
    );
    const deliveredCount = results.filter((result) => result.status === 'fulfilled').length;

    return json(200, {
      ok: true,
      eligibleRecipientCount: recipients.length,
      deliveredCount,
      failedCount: recipients.length - deliveredCount,
      providerConfigured: true,
    });
  } catch (error) {
    console.error('critical-incident-notify failure', error instanceof Error ? error.message : 'unknown error');
    return json(500, { error: 'Unable to send critical incident alerts.' });
  }
});
