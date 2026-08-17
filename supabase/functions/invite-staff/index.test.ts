import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const supabaseMock = vi.hoisted(() => ({ createClient: vi.fn() }));

vi.mock('npm:@supabase/supabase-js@2', () => ({
  createClient: supabaseMock.createClient,
}));

type StaffProfile = Record<string, unknown> & {
  id: string;
  organization_id: string;
  user_id: string | null;
  email: string;
};

type Filter = {
  column: string;
  kind: 'eq' | 'ilike' | 'in' | 'is';
  value: unknown;
};

type FailurePoint = 'membership-upsert' | 'profile-mutation' | 'location-reset'
  | 'assignments' | 'invitation-registration';

type HarnessOptions = {
  concurrentProfileUserId?: string;
  deleteError?: Error;
  deleteThrows?: Error;
  existingAuthUsers?: Array<Record<string, unknown>>;
  generateLinkError?: Error;
  generateLinkUser?: Record<string, unknown> | null;
  failAssignments?: boolean;
  failAt?: FailurePoint;
  failProfileCompensation?: boolean;
  inviteUser?: Record<string, unknown> | null;
  inviteError?: Error;
  listUsersError?: Error;
  revokeError?: Error;
};

function matchesIlike(value: string, pattern: string) {
  let source = '^';
  let escaped = false;
  for (const character of pattern) {
    if (escaped) {
      source += character.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      escaped = false;
    } else if (character === '\\') {
      escaped = true;
    } else if (character === '%') {
      source += '.*';
    } else if (character === '_') {
      source += '.';
    } else {
      source += character.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
  }
  if (escaped) source += '\\\\';
  return new RegExp(`${source}$`, 'i').test(value);
}

function createSupabaseHarness(
  seedProfiles: StaffProfile[],
  callerRole = 'owner',
  options: HarnessOptions = {},
) {
  const profiles = seedProfiles.map((profile) => ({ ...profile }));
  const authUsers = options.existingAuthUsers ?? [];
  const invitedEmails: string[] = [];
  const membershipStatuses: string[] = [];
  const listUsersCalls: Array<{ page: number; perPage: number }> = [];
  const callLog: string[] = [];
  let nextProfile = 1;

  class Query {
    private action: 'read' | 'select' | 'insert' | 'update' | 'upsert' | 'delete' = 'read';
    private filters: Filter[] = [];
    private payload: Record<string, unknown> | Record<string, unknown>[] | undefined;
    private selected = false;
    private selectOptions: { count?: string; head?: boolean } | undefined;
    private rowLimit: number | undefined;

    constructor(private table: string) {}

    select(_columns = '*', options?: { count?: string; head?: boolean }) {
      if (this.action === 'read') this.action = 'select';
      this.selected = true;
      this.selectOptions = options;
      return this;
    }

    insert(payload: Record<string, unknown> | Record<string, unknown>[]) {
      this.action = 'insert';
      this.payload = payload;
      return this;
    }

    update(payload: Record<string, unknown>) {
      this.action = 'update';
      this.payload = payload;
      return this;
    }

    upsert(payload: Record<string, unknown>) {
      this.action = 'upsert';
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

    ilike(column: string, value: string) {
      this.filters.push({ column, kind: 'ilike', value });
      return this;
    }

    in(column: string, value: unknown[]) {
      this.filters.push({ column, kind: 'in', value });
      return this;
    }

    is(column: string, value: unknown) {
      this.filters.push({ column, kind: 'is', value });
      return this;
    }

    limit(value: number) {
      this.rowLimit = value;
      return this;
    }

    maybeSingle() {
      return this.execute(true);
    }

    single() {
      return this.execute(true);
    }

    then<TResult1 = unknown, TResult2 = never>(
      onfulfilled?: ((value: unknown) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ) {
      return this.execute(false).then(onfulfilled, onrejected);
    }

    private matchingProfiles() {
      return profiles.filter((profile) => this.filters.every((filter) => {
        const actual = profile[filter.column];
        if (filter.kind === 'in') return (filter.value as unknown[]).includes(actual);
        if (filter.kind === 'is') return actual === filter.value;
        if (filter.kind === 'ilike') return matchesIlike(String(actual), String(filter.value));
        return actual === filter.value;
      }));
    }

    private async execute(single: boolean) {
      if (this.table === 'organization_members') {
        if (this.action === 'select') return { data: { role: callerRole }, error: null };
        if (this.action === 'upsert') {
          if (options.failAt === 'membership-upsert') {
            return { data: null, error: new Error('membership failed') };
          }
          callLog.push('membership-upsert');
          membershipStatuses.push(String((this.payload as Record<string, unknown>).status));
          return { data: { id: 'membership-1' }, error: null };
        }
        if (this.action === 'update') {
          callLog.push('membership-deactivation');
          membershipStatuses.push(String((this.payload as Record<string, unknown>).status));
          return { data: null, error: null };
        }
        if (this.action === 'delete') {
          callLog.push('membership-delete');
          return { data: null, error: null };
        }
      }

      if (this.table === 'locations') {
        const locationFilter = this.filters.find((filter) => filter.kind === 'in');
        return { data: null, error: null, count: (locationFilter?.value as unknown[] | undefined)?.length ?? 0 };
      }

      if (this.table === 'staff_profiles') {
        if (this.action === 'select') {
          const rows = this.matchingProfiles().slice(0, this.rowLimit);
          return { data: single ? rows[0] ?? null : rows, error: null };
        }
        if (this.action === 'update') {
          if ((this.payload as Record<string, unknown>).user_id === null
            && options.failProfileCompensation) {
            return { data: null, error: new Error('profile compensation failed') };
          }
          if ((this.payload as Record<string, unknown>).status === 'active'
            && options.failAt === 'profile-activation') {
            return { data: null, error: new Error('profile activation failed') };
          }
          if ((this.payload as Record<string, unknown>).status === 'inactive'
            && options.failAt === 'profile-mutation') {
            return { data: null, error: new Error('profile mutation failed') };
          }
          if ((this.payload as Record<string, unknown>).status === 'inactive'
            && options.concurrentProfileUserId) {
            const candidate = profiles.find((profile) => this.filters
              .filter((filter) => filter.kind === 'eq')
              .every((filter) => profile[filter.column] === filter.value));
            if (candidate) candidate.user_id = options.concurrentProfileUserId;
          }
          if ((this.payload as Record<string, unknown>).status === 'inactive') {
            callLog.push('profile-mutation');
          }
          if ((this.payload as Record<string, unknown>).status === 'active') {
            callLog.push('profile-activation');
          }
          const rows = this.matchingProfiles();
          rows.forEach((profile) => Object.assign(profile, this.payload));
          return { data: this.selected ? (single ? rows[0] ?? null : rows) : null, error: null };
        }
        if (this.action === 'insert') {
          if (options.failAt === 'profile-mutation') {
            return { data: null, error: new Error('profile mutation failed') };
          }
          callLog.push('profile-mutation');
          const values = Array.isArray(this.payload) ? this.payload : [this.payload!];
          const rows = values.map((value) => ({ id: `new-profile-${nextProfile++}`, ...value } as StaffProfile));
          profiles.push(...rows);
          return { data: this.selected ? (single ? rows[0] : rows) : null, error: null };
        }
        if (this.action === 'upsert') {
          const value = this.payload as Record<string, unknown>;
          const existing = profiles.find((profile) => profile.organization_id === value.organization_id
            && profile.user_id === value.user_id);
          const row = existing ?? ({ id: `new-profile-${nextProfile++}`, ...value } as StaffProfile);
          if (existing) Object.assign(existing, value);
          else profiles.push(row);
          return { data: this.selected ? (single ? row : [row]) : null, error: null };
        }
        if (this.action === 'delete') {
          if (options.failProfileCompensation) {
            return { data: null, error: new Error('profile compensation failed') };
          }
          const deletedProfiles = this.matchingProfiles();
          const matchingIds = new Set(deletedProfiles.map((profile) => profile.id));
          for (let index = profiles.length - 1; index >= 0; index -= 1) {
            if (matchingIds.has(profiles[index].id)) profiles.splice(index, 1);
          }
          return { data: this.selected ? (single ? deletedProfiles[0] ?? null : deletedProfiles) : null, error: null };
        }
      }

      if (this.table === 'organization_member_locations'
        && this.action === 'delete'
        && options.failAt === 'location-reset') {
        return { data: null, error: new Error('assignment reset failed') };
      }
      if (this.table === 'organization_member_locations' && this.action === 'delete') {
        callLog.push('location-reset');
      }
      if (this.table === 'organization_member_locations'
        && this.action === 'insert'
        && (options.failAssignments || options.failAt === 'assignments')) {
        return { data: null, error: new Error('assignment failed') };
      }
      if (this.table === 'organization_member_locations' && this.action === 'insert') {
        callLog.push('assignments');
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
            id: 'invited-user',
            user_metadata: { invite_operation_id: 'op-staff-1' },
          },
        },
      },
      error: null,
    };
  });
  const inviteUserByEmail = vi.fn(async (email: string, _options?: Record<string, unknown>) => {
    callLog.push('inviteUserByEmail');
    invitedEmails.push(email);
    if (options.inviteError) {
      return { data: { user: null }, error: options.inviteError };
    }
    return {
      data: {
        user: options.inviteUser ?? {
          id: 'invited-user',
          user_metadata: { invite_operation_id: 'op-staff-1' },
        },
      },
      error: null,
    };
  });
  const deleteUser = vi.fn(async (userId: string) => {
    if (options.deleteThrows) throw options.deleteThrows;
    return {
      data: { user: { id: userId } },
      error: options.deleteError ?? null,
    };
  });
  const rpc = vi.fn(async (name: string) => {
    if (name === 'register_pre_authorized_invitation') {
      callLog.push('invitation-registration');
      return options.failAt === 'invitation-registration'
        ? { data: null, error: new Error('registration failed') }
        : { data: { invitationId: 'invitation-1' }, error: null };
    }
    if (name === 'revoke_pre_authorized_invitation') {
      callLog.push('invitation-revocation');
      return { data: null, error: options.revokeError ?? null };
    }
    return { data: null, error: new Error('unexpected RPC') };
  });
  const client = {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: 'caller-user' } } })),
      admin: { deleteUser, generateLink, inviteUserByEmail, listUsers },
    },
    from: (table: string) => new Query(table),
    rpc,
  };

  return {
    client,
    deleteUser,
    generateLink,
    inviteUserByEmail,
    invitedEmails,
    listUsers,
    listUsersCalls,
    callLog,
    membershipStatuses,
    profiles,
    rpc,
  };
}

let handler: (request: Request) => Promise<Response>;
const env: Record<string, string | undefined> = {};

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
      ? 'op-staff-1'
      : 'activation-staff-1')),
  });
  env.SUPABASE_URL = 'https://supabase.example.test';
  env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test-value';
  env.STAFF_INVITE_REDIRECT_URL = undefined;
  env.USER_INVITE_REDIRECT_URL = 'https://app.example.test/accept-invite';
});

const organizationId = '11111111-1111-4111-8111-111111111111';
const profileId = '22222222-2222-4222-8222-222222222222';
const secondProfileId = '33333333-3333-4333-8333-333333333333';

const validInvite = {
  organization_id: organizationId,
  email: 'imported.staff@example.com',
  first_name: 'Updated',
  last_name: 'Person',
  phone: '555-0100',
  title: 'House Manager',
  role: 'house_manager',
  location_ids: ['44444444-4444-4444-8444-444444444444'],
};

async function sendInvite(
  harness: ReturnType<typeof createSupabaseHarness>,
  body: Record<string, unknown> = {},
) {
  supabaseMock.createClient.mockReturnValue(harness.client);
  return handler(new Request('http://localhost/invite-staff', {
    method: 'POST',
    headers: { Authorization: 'Bearer caller-token', 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...validInvite, ...body }),
  }));
}

describe('invite-staff profile linking', () => {
  it('uses the shared invite acceptance URL when no staff override is set', async () => {
    const harness = createSupabaseHarness([]);

    const response = await sendInvite(harness);

    expect(response.status).toBe(201);
    expect(harness.listUsersCalls).toEqual([{ page: 1, perPage: 100 }]);
    expect(harness.generateLink).toHaveBeenCalledWith({
      type: 'invite',
      email: 'imported.staff@example.com',
      options: {
        data: { full_name: 'Updated Person', invite_operation_id: 'op-staff-1' },
        redirectTo: 'https://app.example.test/accept-invite#activation_token=activation-staff-1',
      },
    });
    expect(harness.inviteUserByEmail).toHaveBeenCalledWith('imported.staff@example.com', {
      data: { full_name: 'Updated Person', invite_operation_id: 'op-staff-1' },
      redirectTo: 'https://app.example.test/accept-invite#activation_token=activation-staff-1',
    });
  });

  it('refuses before sending when Auth already has the email on a later listUsers page', async () => {
    const harness = createSupabaseHarness([], 'owner', {
      existingAuthUsers: Array.from({ length: 100 }, (_, index) => ({
        id: `other-user-${index}`,
        email: `other-${index}@example.com`,
      })).concat([{ id: 'pending-user', email: 'IMPORTED.STAFF@example.com' }]),
    });

    const response = await sendInvite(harness);

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'Unable to invite staff member.' });
    expect(harness.listUsersCalls).toEqual([
      { page: 1, perPage: 100 },
      { page: 2, perPage: 100 },
    ]);
    expect(harness.inviteUserByEmail).not.toHaveBeenCalled();
    expect(harness.profiles).toEqual([]);
  });

  it('fails without finalization or deletion when generateLink returns a user without this operation marker', async () => {
    const harness = createSupabaseHarness([], 'owner', {
      generateLinkUser: {
        id: 'pending-user',
        user_metadata: { invite_operation_id: 'someone-else' },
      },
    });

    const response = await sendInvite(harness);

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'Unable to invite staff member.' });
    expect(harness.deleteUser).not.toHaveBeenCalled();
    expect(harness.membershipStatuses).toEqual([]);
    expect(harness.profiles).toEqual([]);
  });

  it.each([
    ['is not configured', undefined],
    ['is malformed', 'not-a-url/accept-invite'],
    ['uses non-local HTTP', 'http://app.example.test/accept-invite'],
    ['has the wrong path', 'https://app.example.test/welcome'],
    ['has a nested invite path', 'https://app.example.test/onboarding/accept-invite'],
    ['has a trailing slash', 'https://app.example.test/accept-invite/'],
    ['has a query string', 'https://app.example.test/accept-invite?source=test'],
  ])('fails closed before sending email when the invite redirect %s', async (_description, redirectTo) => {
    env.USER_INVITE_REDIRECT_URL = redirectTo;
    const harness = createSupabaseHarness([]);

    const response = await sendInvite(harness);

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'Staff invitations are not configured.' });
    expect(harness.inviteUserByEmail).not.toHaveBeenCalled();
  });

  it('does not fall back when the staff-specific redirect is configured but invalid', async () => {
    env.STAFF_INVITE_REDIRECT_URL = 'http://app.example.test/accept-invite';
    const harness = createSupabaseHarness([]);

    const response = await sendInvite(harness);

    expect(response.status).toBe(503);
    expect(harness.inviteUserByEmail).not.toHaveBeenCalled();
  });

  it('allows admins to grant admin access but reserves owner access for owners', async () => {
    const ownerHarness = createSupabaseHarness([]);
    const ownerResponse = await sendInvite(ownerHarness, { role: 'owner' });
    expect(ownerResponse.status).toBe(201);

    const adminHarness = createSupabaseHarness([], 'admin');
    const adminResponse = await sendInvite(adminHarness, { role: 'admin' });
    expect(adminResponse.status).toBe(201);

    const deniedHarness = createSupabaseHarness([], 'admin');
    const deniedResponse = await sendInvite(deniedHarness, { role: 'owner' });
    expect(deniedResponse.status).toBe(403);
    expect(deniedHarness.invitedEmails).toEqual([]);
  });

  it('requires a house assignment for location-scoped roles', async () => {
    const harness = createSupabaseHarness([]);
    const response = await sendInvite(harness, { role: 'staff', location_ids: [] });
    expect(response.status).toBe(422);
    expect(harness.invitedEmails).toEqual([]);
  });

  it('links a case-insensitive email match instead of creating a duplicate profile', async () => {
    const harness = createSupabaseHarness([{
      id: profileId,
      organization_id: organizationId,
      user_id: null,
      email: 'Imported.Staff@Example.com',
      first_name: 'Imported',
      last_name: 'Staff',
      role: 'staff',
      status: 'active',
    }]);
    const response = await sendInvite(harness);

    expect(response.status).toBe(201);
    expect(harness.profiles).toEqual([expect.objectContaining({
      id: profileId,
      organization_id: organizationId,
      user_id: 'invited-user',
      email: 'imported.staff@example.com',
      first_name: 'Updated',
      last_name: 'Person',
      role: 'house_manager',
    })]);
  });

  it('treats email wildcard characters literally when locating a profile', async () => {
    const exactProfile = {
      id: profileId,
      organization_id: organizationId,
      user_id: null,
      email: 'imported_staff@example.com',
      first_name: 'Exact',
      last_name: 'Match',
      role: 'staff',
    };
    const wildcardOnlyProfile = {
      ...exactProfile,
      id: secondProfileId,
      email: 'importedXstaff@example.com',
      first_name: 'Other',
    };
    const harness = createSupabaseHarness([exactProfile, wildcardOnlyProfile]);

    const response = await sendInvite(harness, { email: 'IMPORTED_STAFF@example.com' });

    expect(response.status).toBe(201);
    expect(harness.profiles).toHaveLength(2);
    expect(harness.profiles.find((profile) => profile.id === profileId)?.user_id).toBe('invited-user');
    expect(harness.profiles.find((profile) => profile.id === secondProfileId)?.user_id).toBeNull();
  });

  it('rejects ambiguous case-insensitive email matches before sending an invitation', async () => {
    const harness = createSupabaseHarness([
      {
        id: profileId,
        organization_id: organizationId,
        user_id: null,
        email: 'Imported.Staff@Example.com',
      },
      {
        id: secondProfileId,
        organization_id: organizationId,
        user_id: null,
        email: 'imported.staff@example.com',
      },
    ]);

    const response = await sendInvite(harness);

    expect(response.status).toBe(409);
    expect(harness.invitedEmails).toEqual([]);
    expect(harness.profiles).toHaveLength(2);
  });

  it('rejects a matching profile that is already linked to a user', async () => {
    const harness = createSupabaseHarness([{
      id: profileId,
      organization_id: organizationId,
      user_id: 'different-user',
      email: 'imported.staff@example.com',
    }]);

    const response = await sendInvite(harness);

    expect(response.status).toBe(409);
    expect(harness.invitedEmails).toEqual([]);
    expect(harness.profiles).toHaveLength(1);
    expect(harness.profiles[0].user_id).toBe('different-user');
  });

  it('uses a valid explicit profile id within the requested organization', async () => {
    const harness = createSupabaseHarness([{
      id: profileId,
      organization_id: organizationId,
      user_id: null,
      email: 'old-address@example.com',
    }]);

    const response = await sendInvite(harness, { profile_id: profileId });

    expect(response.status).toBe(201);
    expect(harness.profiles).toEqual([expect.objectContaining({
      id: profileId,
      organization_id: organizationId,
      user_id: 'invited-user',
      email: 'imported.staff@example.com',
    })]);
  });

  it('rejects a malformed explicit profile id before sending an invitation', async () => {
    const harness = createSupabaseHarness([]);

    const response = await sendInvite(harness, { profile_id: 'not-a-uuid' });

    expect(response.status).toBe(422);
    expect(harness.invitedEmails).toEqual([]);
    expect(harness.profiles).toEqual([]);
  });

  it('creates a profile only when no email match exists', async () => {
    const harness = createSupabaseHarness([]);

    const response = await sendInvite(harness);

    expect(response.status).toBe(201);
    expect(harness.profiles).toEqual([expect.objectContaining({
      organization_id: organizationId,
      user_id: 'invited-user',
      email: 'imported.staff@example.com',
    })]);
    expect(harness.membershipStatuses).toEqual(['invited']);
    expect(harness.profiles[0].status).toBe('inactive');
    expect(harness.rpc).toHaveBeenCalledWith('register_pre_authorized_invitation', {
      p_organization_id: organizationId,
      p_user_id: 'invited-user',
      p_membership_id: 'membership-1',
      p_staff_profile_id: 'new-profile-1',
      p_email: 'imported.staff@example.com',
      p_invited_by_user_id: 'caller-user',
      p_operation_marker: 'op-staff-1',
      p_activation_token: 'activation-staff-1',
    });
  });

  it('does not send the email when DB finalization fails', async () => {
    const harness = createSupabaseHarness([], 'owner', { failAt: 'assignments' });

    const response = await sendInvite(harness);

    expect(response.status).toBe(500);
    expect(harness.generateLink).toHaveBeenCalledTimes(1);
    expect(harness.inviteUserByEmail).not.toHaveBeenCalled();
    expect(harness.deleteUser).toHaveBeenCalledWith('invited-user');
  });

  it('finalizes DB state before sending the email', async () => {
    const harness = createSupabaseHarness([]);

    const response = await sendInvite(harness);

    expect(response.status).toBe(201);
    expect(harness.callLog).toEqual([
      'generateLink',
      'membership-upsert',
      'profile-mutation',
      'location-reset',
      'assignments',
      'invitation-registration',
      'inviteUserByEmail',
    ]);
  });

  it('does not activate organization access when house assignment fails', async () => {
    const harness = createSupabaseHarness([], 'owner', { failAssignments: true });

    const response = await sendInvite(harness);

    expect(response.status).toBe(500);
    expect(harness.membershipStatuses).toEqual(['invited', 'inactive']);
    expect(harness.profiles).toEqual([]);
  });

  it('restores an unlinked profile to its previous data when downstream finalization fails', async () => {
    const originalProfile = {
      id: profileId,
      organization_id: organizationId,
      user_id: null,
      email: 'imported.staff@example.com',
      first_name: 'Imported',
      last_name: 'Staff',
      phone: '555-0199',
      title: 'Peer Support',
      role: 'peer_support',
      location_ids: ['55555555-5555-4555-8555-555555555555'],
      status: 'inactive',
    };
    const harness = createSupabaseHarness([originalProfile], 'owner', { failAt: 'assignments' });

    const response = await sendInvite(harness);

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Unable to invite staff member.' });
    expect(harness.profiles).toEqual([originalProfile]);
    expect(harness.deleteUser).toHaveBeenCalledWith('invited-user');
  });

  it.each([
    ['deleting a newly inserted profile', [], { failProfileCompensation: true }],
    ['restoring a pre-existing profile', [{
      id: profileId,
      organization_id: organizationId,
      user_id: null,
      email: 'imported.staff@example.com',
      status: 'inactive',
    }], { failProfileCompensation: true }],
  ] as const)('returns 503 when profile compensation fails while %s', async (
    _description,
    profiles,
    compensationOptions,
  ) => {
    const harness = createSupabaseHarness(profiles, 'owner', {
      failAt: 'assignments',
      ...compensationOptions,
    });

    const response = await sendInvite(harness);

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'Unable to invite staff member.' });
    expect(harness.deleteUser).toHaveBeenCalledWith('invited-user');
  });

  it.each([
    ['membership creation', 'membership-upsert', 500],
    ['profile mutation', 'profile-mutation', 500],
    ['house assignment reset', 'location-reset', 503],
    ['house assignment creation', 'assignments', 500],
    ['invitation registration', 'invitation-registration', 500],
  ] as const)('removes the newly invited Auth user when %s fails', async (
    _description,
    failAt,
    expectedStatus,
  ) => {
    const harness = createSupabaseHarness([], 'owner', { failAt });

    const response = await sendInvite(harness);

    expect(response.status).toBe(expectedStatus);
    expect(await response.json()).toEqual({ error: 'Unable to invite staff member.' });
    expect(harness.deleteUser).toHaveBeenCalledTimes(1);
    expect(harness.deleteUser).toHaveBeenCalledWith('invited-user');
  });

  it('keeps a profile linked by a concurrent invitation and deletes only this invitation user', async () => {
    const harness = createSupabaseHarness([{
      id: profileId,
      organization_id: organizationId,
      user_id: null,
      email: 'imported.staff@example.com',
    }], 'owner', { concurrentProfileUserId: 'pre-existing-user' });

    const response = await sendInvite(harness);

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Unable to invite staff member.' });
    expect(harness.deleteUser).toHaveBeenCalledTimes(1);
    expect(harness.deleteUser).toHaveBeenCalledWith('invited-user');
    expect(harness.profiles).toEqual([expect.objectContaining({
      id: profileId,
      user_id: 'pre-existing-user',
    })]);
  });

  it('compensates and deletes the marker-owned Auth user when delivery is rejected', async () => {
    const harness = createSupabaseHarness([], 'owner', {
      inviteError: new Error('User already registered: imported.staff@example.com'),
    });

    const response = await sendInvite(harness);

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Unable to invite staff member.' });
    expect(harness.deleteUser).toHaveBeenCalledWith('invited-user');
  });

  it('does not remove unrelated pre-existing profiles during compensation', async () => {
    const unrelatedProfile = {
      id: secondProfileId,
      organization_id: organizationId,
      user_id: 'unrelated-user',
      email: 'unrelated.staff@example.com',
      first_name: 'Unrelated',
      last_name: 'Staff',
    };
    const harness = createSupabaseHarness([unrelatedProfile], 'owner', { failAt: 'assignments' });

    const response = await sendInvite(harness);

    expect(response.status).toBe(500);
    expect(harness.deleteUser).toHaveBeenCalledWith('invited-user');
    expect(harness.profiles.find((profile) => profile.id === secondProfileId)).toEqual(unrelatedProfile);
  });

  it.each([
    ['returns an error', { deleteError: new Error('cleanup failed') }],
    ['throws', { deleteThrows: new Error('cleanup failed') }],
  ])('returns 503 when Auth cleanup %s', async (_description, cleanupOptions) => {
    const harness = createSupabaseHarness([], 'owner', {
      failAt: 'assignments',
      ...cleanupOptions,
    });

    const response = await sendInvite(harness);

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'Unable to invite staff member.' });
    expect(harness.deleteUser).toHaveBeenCalledTimes(1);
    expect(harness.deleteUser).toHaveBeenCalledWith('invited-user');
    expect(harness.callLog).toContain('invitation-revocation');
    expect(harness.callLog).toContain('membership-deactivation');
    expect(harness.callLog).toContain('membership-delete');
  });
});
