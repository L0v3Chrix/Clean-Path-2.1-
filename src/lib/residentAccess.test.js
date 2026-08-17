import { describe, expect, it } from 'vitest';

import {
  applyResidentAccountLink,
  getResidentInvitationEligibility,
  getResidentPortalLoadState,
} from './residentAccess';

describe('resident invitation eligibility', () => {
  it.each(['owner', 'admin'])('allows %s to invite an active unlinked resident with email', (role) => {
    expect(getResidentInvitationEligibility(role, {
      status: 'active',
      user_id: null,
      email: 'resident@example.test',
    })).toEqual({ eligible: true, reason: null });
  });

  it.each([
    ['staff', { status: 'active', user_id: null, email: 'resident@example.test' }, 'Only owners and administrators can invite residents.'],
    ['owner', { status: 'exited', user_id: null, email: 'resident@example.test' }, 'Only active residents can receive account invitations.'],
    ['owner', { status: 'active', user_id: 'linked-user', email: 'resident@example.test' }, 'This resident already has a linked account.'],
    ['owner', { status: 'active', user_id: null, email: '' }, 'Add an email address to the resident profile before inviting them.'],
  ])('rejects ineligible resident access', (role, resident, reason) => {
    expect(getResidentInvitationEligibility(role, resident)).toEqual({ eligible: false, reason });
  });
});

describe('resident account link state', () => {
  it('adds the invited user id only to the matching resident', () => {
    const resident = { id: 'resident-1', user_id: null, first_name: 'Riley' };

    expect(applyResidentAccountLink(resident, {
      resident_id: 'resident-1',
      user_id: 'user-1',
    })).toEqual({ ...resident, user_id: 'user-1' });
    expect(applyResidentAccountLink(resident, {
      resident_id: 'resident-2',
      user_id: 'user-2',
    })).toBe(resident);
  });

  it.each([
    [{ loading: true, error: null, resident: null }, 'loading'],
    [{ loading: false, error: new Error('network'), resident: null }, 'error'],
    [{ loading: false, error: null, resident: null }, 'unlinked'],
    [{ loading: false, error: null, resident: { id: 'resident-1' } }, 'ready'],
  ])('classifies portal state without treating load failures as unlinked', (input, expected) => {
    expect(getResidentPortalLoadState(input)).toBe(expected);
  });
});
