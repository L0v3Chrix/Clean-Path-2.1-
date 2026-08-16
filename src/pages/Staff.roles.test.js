import { describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  globalThis.window = { self: {}, top: {} };
});

vi.mock('@/services/appClient', () => ({ appClient: {} }));
import {
  canManageStaffAssignments,
  getAssignableStaffRoles,
  normalizeStaffFormRole,
  splitStaffEditPayload,
} from './Staff';

const nonPrivilegedRoles = [
  'director',
  'house_manager',
  'case_manager',
  'peer_support',
  'staff',
];

describe('staff role assignment options', () => {
  it('allows owners to assign every canonical management role', () => {
    expect(getAssignableStaffRoles('owner')).toEqual([
      'owner',
      'admin',
      ...nonPrivilegedRoles,
    ]);
  });

  it('limits admins to non-privileged roles', () => {
    expect(getAssignableStaffRoles('admin')).toEqual(nonPrivilegedRoles);
  });

  it('keeps staff assignment controls limited to owners and admins', () => {
    expect(canManageStaffAssignments('owner')).toBe(true);
    expect(canManageStaffAssignments('admin')).toBe(true);
    expect(canManageStaffAssignments('director')).toBe(false);
    expect(getAssignableStaffRoles('director')).toEqual([]);
  });

  it('never offers legacy platform admin or volunteer roles', () => {
    const offeredRoles = [
      ...getAssignableStaffRoles('owner'),
      ...getAssignableStaffRoles('admin'),
    ];

    expect(offeredRoles).not.toContain('platform_admin');
    expect(offeredRoles).not.toContain('volunteer');
  });
});

describe('staff edit payloads', () => {
  it('normalizes legacy profile roles to staff in the form', () => {
    expect(normalizeStaffFormRole('platform_admin')).toBe('staff');
    expect(normalizeStaffFormRole('volunteer')).toBe('staff');
    expect(normalizeStaffFormRole('director')).toBe('director');
  });

  it('keeps role and house access out of the ordinary profile update', () => {
    expect(splitStaffEditPayload({
      id: 'profile-1',
      organization_id: 'organization-1',
      user_id: 'user-1',
      first_name: 'Riley',
      role: 'house_manager',
      location_ids: ['house-1'],
    })).toEqual({
      profileFields: {
        organization_id: 'organization-1',
        user_id: 'user-1',
        first_name: 'Riley',
      },
      access: {
        id: 'profile-1',
        role: 'house_manager',
        location_ids: ['house-1'],
      },
    });
  });
});
