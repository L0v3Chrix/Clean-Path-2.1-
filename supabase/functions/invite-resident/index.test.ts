import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const supabaseMock = vi.hoisted(() => ({ createClient: vi.fn() }));

vi.mock('npm:@supabase/supabase-js@2', () => ({
  createClient: supabaseMock.createClient,
}));

type Resident = {
  id: string;
  organization_id: string;
  status: string;
  user_id: string | null;
  first_name: string;
  last_name: string;
  email: string;
};

type Membership = {
  organization_id: string;
  user_id: string;
  status: string;
  role: string;
};

type Filter = {
  column: string;
  kind: 'eq' | 'in';
  value: unknown;
};

type HarnessOptions = {
  authenticated?: boolean;
  deleteError?: Error;
  deleteThrows?: Error;
  existingAuthUsers?: Array<Record<string, unknown>>;
  generateLinkError?: Error;
  generateLinkUser?: Record<string, unknown> | null;
  inviteError?: Error;
  inviteUser?: Record<string, unknown> | null;
  listUsersError?: Error;
  rpcOutcomes?: Array<{ error?: Error; throws?: Error }>;
  residents?: Resident[];
  memberships?: Membership[];
  residentCleanupError?: Error;
  membershipCleanupError?: Error;
  auditCleanupError?: Error;
  revokeError?: Error;
};

const organizationId = '11111111-1111-4111-8111-111111111111';
const otherOrganizationId = '22222222-2222-4222-8222-222222222222';
const residentId = '33333333-3333-4333-8333-333333333333';
const invitedUserId = '44444444-4444-4444-8444-444444444444';
const callerUserId = '55555555-5555-4555-8555-555555555555';

const activeResident: Resident = {
  id: residentId,
  organization_id: organizationId,
  status: 'active',
  user_id: null,
  first_name: '  Riley ',
  last_name: ' Resident  ',
  email: 'RILEY@example.com',
};

const ownerMembership: Membership = {
  organization_id: organizationId,
  user_id: callerUserId,
  status: 'active',
  role: 'owner',
};

const env: Record<string, string | undefined> = {};

function createSupabaseHarness(options: HarnessOptions = {}) {
  const residents = options.residents ?? [activeResident];
  const memberships = options.memberships ?? [ownerMembership];
  const authUsers = options.existingAuthUsers ?? [];
  const listUsersCalls: Array<{ page: number; perPage: number }> = [];
  const callLog: string[] = [];
  const residentRows = residents.map((resident) => ({ ...resident }));

  class Query {
    private filters: Filter[] = [];
    private action: 'select' | 'update' | 'delete' = 'select';
    private payload: Record<string, unknown> | undefined;

    constructor(private table: string) {}

    select(_columns: string) {
      return this;
    }

    update(payload: Record<string, unknown>) {
      this.action = 'update';
      this.payload = payload;
      return this;
    }

    delete() {
      this.action = 'delete';
      return this;
    }

    eq(column: string, value: unknown) {
      this.filters.push({ column, kind: 'eq', value });
      return this;
    }

    in(column: string, value: unknown[]) {
      this.filters.push({ column, kind: 'in', value });
      return this;
    }

    async maybeSingle() {
      const rows: Array<Record<string, unknown>> = this.table === 'residents'
        ? residentRows
        : this.table === 'organization_members'
        ? memberships
        : [];
      if (this.table === 'residents' && this.action === 'update') {
        callLog.push('resident-cleanup');
        if (options.residentCleanupError) {
          return { data: null, error: options.residentCleanupError };
        }
        const matches = rows.filter((row) => this.filters.every((filter) => {
          const actual = row[filter.column];
          return filter.kind === 'in'
            ? (filter.value as unknown[]).includes(actual)
            : actual === filter.value;
        }));
        matches.forEach((row) => Object.assign(row, this.payload));
        return { data: matches[0] ?? null, error: null };
      }
      const matches = rows.filter((row) => this.filters.every((filter) => {
        const actual = row[filter.column];
        return filter.kind === 'in'
          ? (filter.value as unknown[]).includes(actual)
          : actual === filter.value;
      }));
      return { data: matches[0] ?? null, error: null };
    }

    then<TResult1 = unknown, TResult2 = never>(
      onfulfilled?: ((value: unknown) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ) {
      return this.execute().then(onfulfilled, onrejected);
    }

    private async execute() {
      if (this.table === 'organization_members' && this.action === 'update') {
        callLog.push('membership-deactivation');
        return { data: null, error: options.membershipCleanupError ?? null };
      }
      if (this.table === 'organization_members' && this.action === 'delete') {
        callLog.push('membership-cleanup');
        return { data: null, error: options.membershipCleanupError ?? null };
      }
      if (this.table === 'audit_logs' && this.action === 'delete') {
        callLog.push('audit-cleanup');
        return { data: null, error: options.auditCleanupError ?? null };
      }
      return { data: null, error: null };
    }
  }

  const listUsers = vi.fn(async ({ page, perPage }: { page: number; perPage: number }) => {
    listUsersCalls.push({ page, perPage });
    if (options.listUsersError) {
      return { data: { users: [] }, error: options.listUsersError };
    }
    const start = (page - 1) * perPage;
    return {
      data: { users: authUsers.slice(start, start + perPage) },
      error: null,
    };
  });
  const generateLink = vi.fn(async () => {
    callLog.push('generateLink');
    if (options.generateLinkError) {
      return { data: { user: null }, error: options.generateLinkError };
    }
    return {
      data: {
        properties: {
          user: options.generateLinkUser ?? {
            id: invitedUserId,
            user_metadata: { invite_operation_id: 'op-resident-1' },
          },
        },
      },
      error: null,
    };
  });
  const inviteUserByEmail = vi.fn(async () => options.inviteError
    ? (callLog.push('inviteUserByEmail'), { data: { user: null }, error: options.inviteError })
    : (callLog.push('inviteUserByEmail'), {
      data: {
        user: options.inviteUser ?? {
          id: invitedUserId,
          user_metadata: { invite_operation_id: 'op-resident-1' },
        },
      },
      error: null,
    }));
  const deleteUser = vi.fn(async () => {
    callLog.push('deleteUser');
    if (options.deleteThrows) throw options.deleteThrows;
    return { data: null, error: options.deleteError ?? null };
  });
  let rpcAttempt = 0;
  const rpc = vi.fn(async (name: string, _payload?: Record<string, unknown>) => {
    if (name === 'revoke_pre_authorized_invitation') {
      callLog.push('invitation-revocation');
      return { data: null, error: options.revokeError ?? null };
    }
    callLog.push('finalize');
    const outcome = options.rpcOutcomes?.[rpcAttempt] ?? {};
    rpcAttempt += 1;
    if (outcome.throws) throw outcome.throws;
    return {
      data: { membershipId: 'resident-membership-1', invitationId: 'resident-invitation-1' },
      error: outcome.error ?? null,
    };
  });
  const client = {
    auth: {
      getUser: vi.fn(async () => options.authenticated === false
        ? { data: { user: null }, error: new Error('invalid token') }
        : { data: { user: { id: callerUserId } }, error: null }),
      admin: { generateLink, inviteUserByEmail, deleteUser, listUsers },
    },
    from: (table: string) => new Query(table),
    rpc,
  };

  return {
    client,
    deleteUser,
    generateLink,
    inviteUserByEmail,
    listUsers,
    listUsersCalls,
    rpc,
    callLog,
    residentRows,
  };
}

let handler: (request: Request) => Promise<Response>;

beforeAll(async () => {
  vi.stubGlobal('Deno', {
    env: { get: (name: string) => env[name] },
    serve: (registeredHandler: typeof handler) => { handler = registeredHandler; },
  });
  await import('./index');
});

beforeEach(() => {
  supabaseMock.createClient.mockReset();
  let randomCall = 0;
  vi.stubGlobal('crypto', {
    randomUUID: vi.fn(() => (randomCall++ % 2 === 0
      ? 'op-resident-1'
      : 'activation-resident-1')),
  });
  env.SUPABASE_URL = 'https://supabase.example.test';
  env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test-value';
  env.RESIDENT_INVITE_REDIRECT_URL = 'https://app.example.test/accept-invite';
  env.USER_INVITE_REDIRECT_URL = undefined;
});

async function sendInvite(
  harness: ReturnType<typeof createSupabaseHarness>,
  body: Record<string, unknown> = { resident_id: residentId },
  headers: Record<string, string> = {
    Authorization: 'Bearer caller-token',
    'Content-Type': 'application/json',
  },
) {
  supabaseMock.createClient.mockReturnValue(harness.client);
  return handler(new Request('http://localhost/invite-resident', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  }));
}

describe('invite-resident', () => {
  it('answers CORS preflight and rejects non-POST methods', async () => {
    const optionsResponse = await handler(new Request('http://localhost/invite-resident', {
      method: 'OPTIONS',
    }));
    expect(optionsResponse.status).toBe(200);
    expect(optionsResponse.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(optionsResponse.headers.get('Access-Control-Allow-Headers')).toBe('authorization, apikey, content-type');

    const getResponse = await handler(new Request('http://localhost/invite-resident'));
    expect(getResponse.status).toBe(405);
    expect(await getResponse.json()).toEqual({ error: 'Method not allowed.' });
    expect(getResponse.headers.get('Content-Type')).toBe('application/json');
  });

  it('requires a valid bearer-authenticated caller', async () => {
    const harness = createSupabaseHarness();

    const missingResponse = await sendInvite(harness, undefined, { 'Content-Type': 'application/json' });
    expect(missingResponse.status).toBe(401);

    const malformedResponse = await sendInvite(harness, undefined, {
      Authorization: 'Basic caller-token',
      'Content-Type': 'application/json',
    });
    expect(malformedResponse.status).toBe(401);

    const invalidHarness = createSupabaseHarness({ authenticated: false });
    const invalidResponse = await sendInvite(invalidHarness);
    expect(invalidResponse.status).toBe(401);
    expect(invalidHarness.inviteUserByEmail).not.toHaveBeenCalled();
  });

  it.each([
    ['an invalid resident id', { resident_id: 'not-a-uuid' }],
    ['a client-supplied email', { resident_id: residentId, email: 'attacker@example.test' }],
    ['an extra field', { resident_id: residentId, organization_id: otherOrganizationId }],
  ])('rejects %s before inviting', async (_description, body) => {
    const harness = createSupabaseHarness();
    const response = await sendInvite(harness, body);

    expect(response.status).toBe(422);
    expect(harness.inviteUserByEmail).not.toHaveBeenCalled();
    expect(harness.rpc).not.toHaveBeenCalled();
  });

  it.each(['owner', 'admin'])('allows an active %s in the resident organization', async (role) => {
    const harness = createSupabaseHarness({
      memberships: [{ ...ownerMembership, role }],
    });
    const response = await sendInvite(harness);

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      ok: true,
      user_id: invitedUserId,
      resident_id: residentId,
    });
    expect(supabaseMock.createClient).toHaveBeenCalledWith(
      'https://supabase.example.test',
      'service-role-test-value',
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    expect(harness.client.auth.getUser).toHaveBeenCalledWith('caller-token');
  });

  it('returns 403 for an active same-organization non-admin before resident eligibility details', async () => {
    const harness = createSupabaseHarness({
      residents: [{ ...activeResident, status: 'exited' }],
      memberships: [{ ...ownerMembership, role: 'director' }],
    });
    const response = await sendInvite(harness);

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: 'Only organization administrators can invite residents.',
    });
    expect(harness.inviteUserByEmail).not.toHaveBeenCalled();
    expect(harness.rpc).not.toHaveBeenCalled();
  });

  it.each([
    ['no membership', []],
    ['a cross-organization owner', [{ ...ownerMembership, organization_id: otherOrganizationId }]],
    ['an inactive same-organization admin', [{ ...ownerMembership, role: 'admin', status: 'inactive' }]],
  ])('returns 404 for %s before resident eligibility details', async (_description, memberships) => {
    const harness = createSupabaseHarness({
      residents: [{
        ...activeResident,
        status: 'exited',
        user_id: '66666666-6666-4666-8666-666666666666',
        email: 'not-an-email',
      }],
      memberships,
    });
    const response = await sendInvite(harness);

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Resident not found.' });
    expect(harness.inviteUserByEmail).not.toHaveBeenCalled();
    expect(harness.rpc).not.toHaveBeenCalled();
  });

  it.each([
    ['inactive', { ...activeResident, status: 'exited' }],
    ['already linked', { ...activeResident, user_id: '66666666-6666-4666-8666-666666666666' }],
  ])('rejects an %s resident before inviting', async (_description, resident) => {
    const harness = createSupabaseHarness({ residents: [resident] });
    const response = await sendInvite(harness);

    expect(response.status).toBe(409);
    expect(harness.inviteUserByEmail).not.toHaveBeenCalled();
    expect(harness.rpc).not.toHaveBeenCalled();
  });

  it('uses resident metadata and prefers the resident redirect URL', async () => {
    env.RESIDENT_INVITE_REDIRECT_URL = 'https://residents.example.test/accept-invite';
    env.USER_INVITE_REDIRECT_URL = 'https://users.example.test/accept-invite';
    const harness = createSupabaseHarness();

    const response = await sendInvite(harness);

    expect(response.status).toBe(201);
    expect(harness.listUsersCalls).toEqual([{ page: 1, perPage: 100 }]);
    expect(harness.generateLink).toHaveBeenCalledWith({
      type: 'invite',
      email: 'riley@example.com',
      options: {
        data: { full_name: 'Riley Resident', invite_operation_id: 'op-resident-1' },
        redirectTo: 'https://residents.example.test/accept-invite#activation_token=activation-resident-1',
      },
    });
    expect(harness.inviteUserByEmail).toHaveBeenCalledWith('riley@example.com', {
      data: { full_name: 'Riley Resident', invite_operation_id: 'op-resident-1' },
      redirectTo: 'https://residents.example.test/accept-invite#activation_token=activation-resident-1',
    });
  });

  it('falls back to the general user redirect URL', async () => {
    env.RESIDENT_INVITE_REDIRECT_URL = undefined;
    env.USER_INVITE_REDIRECT_URL = 'https://users.example.test/accept-invite';
    const harness = createSupabaseHarness();

    const response = await sendInvite(harness);

    expect(response.status).toBe(201);
    expect(harness.inviteUserByEmail).toHaveBeenCalledWith('riley@example.com', {
      data: { full_name: 'Riley Resident', invite_operation_id: 'op-resident-1' },
      redirectTo: 'https://users.example.test/accept-invite#activation_token=activation-resident-1',
    });
  });

  it.each([
    'http://localhost:5173/accept-invite',
    'http://127.0.0.1:4173/accept-invite',
  ])('allows the local development redirect %s', async (redirectTo) => {
    env.RESIDENT_INVITE_REDIRECT_URL = redirectTo;
    const harness = createSupabaseHarness();

    const response = await sendInvite(harness);

    expect(response.status).toBe(201);
    expect(harness.inviteUserByEmail).toHaveBeenCalledWith('riley@example.com', {
      data: { full_name: 'Riley Resident', invite_operation_id: 'op-resident-1' },
      redirectTo: `${redirectTo}#activation_token=activation-resident-1`,
    });
  });

  it('refuses before sending when Auth already has the resident email on a later listUsers page', async () => {
    const harness = createSupabaseHarness({
      existingAuthUsers: Array.from({ length: 100 }, (_, index) => ({
        id: `other-user-${index}`,
        email: `other-${index}@example.com`,
      })).concat([{ id: 'pending-user', email: 'riley@EXAMPLE.com' }]),
    });

    const response = await sendInvite(harness);

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'Unable to invite resident.' });
    expect(harness.listUsersCalls).toEqual([
      { page: 1, perPage: 100 },
      { page: 2, perPage: 100 },
    ]);
    expect(harness.inviteUserByEmail).not.toHaveBeenCalled();
    expect(harness.rpc).not.toHaveBeenCalled();
    expect(harness.deleteUser).not.toHaveBeenCalled();
  });

  it('fails without finalization or deletion when generateLink returns a user without this operation marker', async () => {
    const harness = createSupabaseHarness({
      generateLinkUser: {
        id: invitedUserId,
        user_metadata: { invite_operation_id: 'someone-else' },
      },
    });

    const response = await sendInvite(harness);

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'Unable to invite resident.' });
    expect(harness.rpc).not.toHaveBeenCalled();
    expect(harness.deleteUser).not.toHaveBeenCalled();
  });

  it.each([
    ['is not configured', undefined],
    ['is malformed', 'not-a-url/accept-invite'],
    ['uses non-local HTTP', 'http://app.example.test/accept-invite'],
    ['has the wrong path', 'https://app.example.test/welcome'],
    ['has a nested invite path', 'https://app.example.test/onboarding/accept-invite'],
    ['has a trailing slash', 'https://app.example.test/accept-invite/'],
  ])('returns a generic error before sending email when the redirect %s', async (_description, redirectTo) => {
    env.RESIDENT_INVITE_REDIRECT_URL = redirectTo;
    const harness = createSupabaseHarness();

    const response = await sendInvite(harness);

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Unable to invite resident.' });
    expect(harness.inviteUserByEmail).not.toHaveBeenCalled();
    expect(harness.rpc).not.toHaveBeenCalled();
  });

  it('does not fall back when the resident-specific redirect is configured but invalid', async () => {
    env.RESIDENT_INVITE_REDIRECT_URL = 'http://app.example.test/accept-invite';
    env.USER_INVITE_REDIRECT_URL = 'https://users.example.test/accept-invite';
    const harness = createSupabaseHarness();

    const response = await sendInvite(harness);

    expect(response.status).toBe(500);
    expect(harness.inviteUserByEmail).not.toHaveBeenCalled();
  });

  it('preauthorizes the exact resident without binding or activating it', async () => {
    const harness = createSupabaseHarness();
    const response = await sendInvite(harness);

    expect(response.status).toBe(201);
    expect(harness.rpc).toHaveBeenCalledWith('finalize_resident_invitation', {
      p_organization_id: organizationId,
      p_resident_id: residentId,
      p_user_id: invitedUserId,
      p_email: 'riley@example.com',
      p_invited_by_user_id: callerUserId,
      p_operation_marker: 'op-resident-1',
      p_activation_token: 'activation-resident-1',
    });
    expect(harness.residentRows[0].user_id).toBeNull();
    expect(harness.deleteUser).not.toHaveBeenCalled();
  });

  it('does not send the email when DB finalization fails', async () => {
    const harness = createSupabaseHarness({
      rpcOutcomes: [{ error: new Error('finalization failed') }],
    });
    const response = await sendInvite(harness);

    expect(response.status).toBe(500);
    expect(harness.inviteUserByEmail).not.toHaveBeenCalled();
    expect(harness.deleteUser).toHaveBeenCalledWith(invitedUserId);
  });

  it('finalizes DB state before sending the email', async () => {
    const harness = createSupabaseHarness();
    const response = await sendInvite(harness);

    expect(response.status).toBe(201);
    expect(harness.callLog).toEqual([
      'generateLink',
      'finalize',
      'inviteUserByEmail',
    ]);
  });

  it('deletes only the newly invited Auth user for an explicit finalization error result', async () => {
    const harness = createSupabaseHarness({
      rpcOutcomes: [{ error: new Error('finalization failed') }],
    });
    const response = await sendInvite(harness);

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Unable to invite resident.' });
    expect(harness.rpc.mock.calls.filter(([name]) => name === 'finalize_resident_invitation'))
      .toHaveLength(1);
    expect(harness.deleteUser).toHaveBeenCalledTimes(1);
    expect(harness.deleteUser).toHaveBeenCalledWith(invitedUserId);
  });

  it.each([
    ['reports an error', { deleteError: new Error('cleanup failed') }],
    ['throws an error', { deleteThrows: new Error('cleanup threw') }],
  ])('returns a generic 503 when cleanup %s', async (_description, cleanupFailure) => {
    const harness = createSupabaseHarness({
      rpcOutcomes: [{ error: new Error('finalization failed') }],
      ...cleanupFailure,
    });
    const response = await sendInvite(harness);

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'Unable to invite resident.' });
    expect(harness.deleteUser).toHaveBeenCalledTimes(1);
    expect(harness.deleteUser).toHaveBeenCalledWith(invitedUserId);
    expect(harness.callLog).toContain('invitation-revocation');
    expect(harness.callLog).toContain('membership-deactivation');
    expect(harness.callLog).toContain('membership-cleanup');
    expect(harness.residentRows[0].user_id).toBeNull();
  });

  it('retries once when the finalization RPC throws and succeeds on retry', async () => {
    const harness = createSupabaseHarness({
      rpcOutcomes: [{ throws: new Error('network failure') }, {}],
    });

    const response = await sendInvite(harness);

    expect(response.status).toBe(201);
    expect(harness.rpc.mock.calls.filter(([name]) => name === 'finalize_resident_invitation'))
      .toHaveLength(2);
    expect(harness.deleteUser).not.toHaveBeenCalled();
  });

  it('compensates and deletes the marker-owned Auth user when both RPC attempts throw', async () => {
    const harness = createSupabaseHarness({
      rpcOutcomes: [
        { throws: new Error('first network failure') },
        { throws: new Error('second network failure') },
      ],
    });

    const response = await sendInvite(harness);

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Unable to invite resident.' });
    expect(harness.rpc.mock.calls.filter(([name]) => name === 'finalize_resident_invitation'))
      .toHaveLength(2);
    expect(harness.deleteUser).toHaveBeenCalledWith(invitedUserId);
  });

  it('cleans up after a retry returns an explicit finalization error', async () => {
    const harness = createSupabaseHarness({
      rpcOutcomes: [
        { throws: new Error('network failure') },
        { error: new Error('finalization failed') },
      ],
    });

    const response = await sendInvite(harness);

    expect(response.status).toBe(500);
    expect(harness.rpc.mock.calls.filter(([name]) => name === 'finalize_resident_invitation'))
      .toHaveLength(2);
    expect(harness.deleteUser).toHaveBeenCalledWith(invitedUserId);
  });

  it('compensates and deletes the marker-owned Auth user when delivery fails', async () => {
    const harness = createSupabaseHarness({ inviteError: new Error('invite failed') });
    const response = await sendInvite(harness);

    expect(response.status).toBe(500);
    expect(harness.rpc.mock.calls.filter(([name]) => name === 'finalize_resident_invitation'))
      .toHaveLength(1);
    expect(harness.deleteUser).toHaveBeenCalledWith(invitedUserId);
  });

  it('does not log token or resident email details from failures', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const harness = createSupabaseHarness({
      inviteError: new Error('caller-token riley@example.com'),
    });

    try {
      const response = await sendInvite(harness);

      expect(response.status).toBe(500);
      const logged = consoleError.mock.calls.flat().map(String).join(' ');
      expect(logged).not.toContain('caller-token');
      expect(logged).not.toContain('riley@example.com');
    } finally {
      consoleError.mockRestore();
    }
  });
});
