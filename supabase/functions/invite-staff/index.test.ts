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
  options: { failAssignments?: boolean } = {},
) {
  const profiles = seedProfiles.map((profile) => ({ ...profile }));
  const invitedEmails: string[] = [];
  const membershipStatuses: string[] = [];
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
          membershipStatuses.push(String((this.payload as Record<string, unknown>).status));
          return { data: { id: 'membership-1' }, error: null };
        }
        if (this.action === 'update') {
          membershipStatuses.push(String((this.payload as Record<string, unknown>).status));
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
          const rows = this.matchingProfiles();
          rows.forEach((profile) => Object.assign(profile, this.payload));
          return { data: this.selected ? (single ? rows[0] ?? null : rows) : null, error: null };
        }
        if (this.action === 'insert') {
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
      }

      if (this.table === 'organization_member_locations'
        && this.action === 'insert'
        && options.failAssignments) {
        return { data: null, error: new Error('assignment failed') };
      }

      return { data: null, error: null };
    }
  }

  const client = {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: 'caller-user' } } })),
      admin: {
        inviteUserByEmail: vi.fn(async (email: string) => {
          invitedEmails.push(email);
          return { data: { user: { id: 'invited-user' } }, error: null };
        }),
      },
    },
    from: (table: string) => new Query(table),
  };

  return { client, invitedEmails, membershipStatuses, profiles };
}

let handler: (request: Request) => Promise<Response>;

beforeAll(async () => {
  vi.stubGlobal('Deno', {
    env: { get: (name: string) => name === 'STAFF_INVITE_REDIRECT_URL' ? undefined : 'test-value' },
    serve: (registeredHandler: typeof handler) => { handler = registeredHandler; },
  });
  await import('./index');
});

beforeEach(() => {
  supabaseMock.createClient.mockReset();
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
  it('allows only an owner to grant owner or admin access', async () => {
    const ownerHarness = createSupabaseHarness([]);
    const ownerResponse = await sendInvite(ownerHarness, { role: 'admin' });
    expect(ownerResponse.status).toBe(201);

    const adminHarness = createSupabaseHarness([], 'admin');
    const adminResponse = await sendInvite(adminHarness, { role: 'admin' });
    expect(adminResponse.status).toBe(403);
    expect(adminHarness.invitedEmails).toEqual([]);
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
    expect(harness.membershipStatuses).toEqual(['invited', 'active']);
  });

  it('does not activate organization access when house assignment fails', async () => {
    const harness = createSupabaseHarness([], 'owner', { failAssignments: true });

    const response = await sendInvite(harness);

    expect(response.status).toBe(500);
    expect(harness.membershipStatuses).toEqual(['invited']);
    expect(harness.profiles).toEqual([expect.objectContaining({ status: 'inactive' })]);
  });
});
