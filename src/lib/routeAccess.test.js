import { describe, expect, it } from 'vitest';
import { canAccessRoute, navForRole } from './routeAccess';

describe('route access', () => {
  it('restricts residents to resident-facing pages', () => {
    expect(canAccessRoute('resident', '/my-profile')).toBe(true);
    expect(canAccessRoute('resident', '/residents')).toBe(false);
    expect(canAccessRoute('resident', '/settings')).toBe(false);
  });

  it('restricts staff from owner settings and finance', () => {
    expect(canAccessRoute('staff', '/residents')).toBe(true);
    expect(canAccessRoute('staff', '/settings')).toBe(false);
    expect(canAccessRoute('staff', '/finance')).toBe(false);
  });

  it('allows owners to access every operational route', () => {
    expect(canAccessRoute('owner', '/settings')).toBe(true);
    expect(canAccessRoute('owner', '/finance')).toBe(true);
    expect(navForRole('owner')).toContain('bed_capacity');
  });

  it('denies unknown roles instead of elevating them', () => {
    expect(canAccessRoute('unexpected-role', '/residents')).toBe(false);
    expect(navForRole('unexpected-role')).toEqual([]);
  });
});
