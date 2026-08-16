import { beforeEach, describe, expect, it, vi } from 'vitest';

const supabase = vi.hoisted(() => ({
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock('@/lib/supabaseClient', () => ({ supabase }));

import { appClient } from './appClient';

function createReadQuery(result) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    limit: vi.fn(() => query),
    maybeSingle: vi.fn().mockResolvedValue(result),
  };
  return query;
}

describe('staff access assignments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates role and house access through the transactional RPC only', async () => {
    const result = {
      ok: true,
      profileId: 'profile-1',
      role: 'house_manager',
      locationIds: ['house-1', 'house-2'],
    };
    supabase.rpc.mockResolvedValue({ data: result, error: null });

    await expect(appClient.staffAccess.updateAssignments({
      id: 'profile-1',
      organization_id: 'organization-1',
      user_id: 'user-2',
      role: 'house_manager',
      location_ids: ['house-1', 'house-2'],
    })).resolves.toEqual(result);

    expect(supabase.rpc).toHaveBeenCalledWith('update_staff_access', {
      p_profile_id: 'profile-1',
      p_role: 'house_manager',
      p_location_ids: ['house-1', 'house-2'],
    });
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('passes an empty house list and surfaces RPC errors', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: { message: 'Assignment denied' } });

    await expect(appClient.staffAccess.updateAssignments({
      id: 'profile-1',
      role: 'director',
    })).rejects.toThrow('Assignment denied');

    expect(supabase.rpc).toHaveBeenCalledWith('update_staff_access', {
      p_profile_id: 'profile-1',
      p_role: 'director',
      p_location_ids: [],
    });
  });
});

describe('authenticated staff role normalization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabase.auth.getUser.mockResolvedValue({
      data: {
        user: {
          id: 'user-1',
          email: 'person@example.com',
          user_metadata: {},
        },
      },
      error: null,
    });
  });

  it.each(['platform_admin', 'volunteer'])(
    'normalizes legacy %s staff profiles to effective staff access',
    async (legacyRole) => {
      const membershipQuery = createReadQuery({
        data: {
          organization_id: 'organization-1',
          role: 'staff',
          display_name: 'Legacy User',
          email: 'person@example.com',
        },
        error: null,
      });
      const profileQuery = createReadQuery({ data: { role: legacyRole }, error: null });
      supabase.from.mockImplementation((table) => (
        table === 'organization_members' ? membershipQuery : profileQuery
      ));

      await expect(appClient.auth.me()).resolves.toMatchObject({
        organization_id: 'organization-1',
        role: 'staff',
      });
    },
  );

  it('preserves canonical operational roles', async () => {
    const membershipQuery = createReadQuery({
      data: {
        organization_id: 'organization-1',
        role: 'staff',
        display_name: 'Case Manager',
        email: 'person@example.com',
      },
      error: null,
    });
    const profileQuery = createReadQuery({ data: { role: 'case_manager' }, error: null });
    supabase.from.mockImplementation((table) => (
      table === 'organization_members' ? membershipQuery : profileQuery
    ));

    await expect(appClient.auth.me()).resolves.toMatchObject({ role: 'case_manager' });
  });
});
