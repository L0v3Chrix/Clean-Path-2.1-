import { describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  globalThis.window = { self: {}, top: {} };
});

vi.mock('@/services/appClient', () => ({ appClient: {} }));
import {
  canManageStaffAssignments,
  buildStaffEditPayload,
  getAssignableStaffRoles,
  normalizeStaffFormRole,
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

  it('lets admins build the management team without granting owner access', () => {
    expect(getAssignableStaffRoles('admin')).toEqual(['admin', ...nonPrivilegedRoles]);
    expect(getAssignableStaffRoles('admin')).not.toContain('owner');
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

  it('whitelists the fields accepted by the atomic staff update', () => {
    expect(buildStaffEditPayload({
      id: 'profile-1',
      organization_id: 'organization-1',
      user_id: 'user-1',
      first_name: 'Riley',
      last_name: 'Morgan',
      email: 'immutable@example.test',
      role: 'house_manager',
      location_ids: ['house-1'],
    })).toEqual({
      id: 'profile-1',
      first_name: 'Riley',
      last_name: 'Morgan',
      phone: null,
      title: null,
      hire_date: null,
      status: undefined,
      lived_experience: false,
      notes: null,
      role: 'house_manager',
      location_ids: ['house-1'],
    });
  });
});
