import { beforeEach, describe, expect, it, vi } from 'vitest';

const supabase = vi.hoisted(() => ({
  auth: {
    getUser: vi.fn(),
    setSession: vi.fn(),
    updateUser: vi.fn(),
  },
  from: vi.fn(),
  functions: {
    invoke: vi.fn(),
  },
  rpc: vi.fn(),
}));

vi.mock('@/lib/supabaseClient', () => ({ supabase }));

import { appClient } from './appClient';

function createProgressQuery(result) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    maybeSingle: vi.fn().mockResolvedValue(result),
    upsert: vi.fn(() => query),
    single: vi.fn().mockResolvedValue(result),
  };
  return query;
}

describe('onboarding access services', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not expose the legacy open owner bootstrap helper', () => {
    expect(appClient.auth).not.toHaveProperty('bootstrapOrganizationOwner');
  });

  it('reads only the requested user flow and version', async () => {
    const progress = {
      organization_id: 'organization-1',
      user_id: 'user-1',
      flow: 'owner',
      version: 1,
      status: 'in_progress',
    };
    const query = createProgressQuery({ data: progress, error: null });
    supabase.from.mockReturnValue(query);

    await expect(appClient.onboarding.get({
      organizationId: 'organization-1',
      userId: 'user-1',
      flow: 'owner',
      version: 1,
    })).resolves.toEqual(progress);

    expect(supabase.from).toHaveBeenCalledWith('user_onboarding_progress');
    expect(query.eq.mock.calls).toEqual([
      ['organization_id', 'organization-1'],
      ['user_id', 'user-1'],
      ['flow', 'owner'],
      ['version', 1],
    ]);
  });

  it('upserts normalized progress without using it as an authorization claim', async () => {
    const saved = { id: 'progress-1', status: 'in_progress' };
    const query = createProgressQuery({ data: saved, error: null });
    supabase.from.mockReturnValue(query);

    await expect(appClient.onboarding.save({
      organizationId: 'organization-1',
      userId: 'user-1',
      flow: 'resident',
      version: 2,
      currentStep: 'chores',
      completedSteps: ['profile', 'chores', 'chores'],
      status: 'in_progress',
      ignoredPrivilege: 'owner',
    })).resolves.toEqual(saved);

    expect(query.upsert).toHaveBeenCalledWith({
      organization_id: 'organization-1',
      user_id: 'user-1',
      flow: 'resident',
      version: 2,
      current_step: 'chores',
      completed_steps: ['profile', 'chores'],
      status: 'in_progress',
      completed_at: null,
    }, { onConflict: 'organization_id,user_id,flow,version' });
  });

  it('accepts an explicit pre-authorized claim through the narrow RPC', async () => {
    supabase.rpc.mockResolvedValue({ data: { role: 'owner' }, error: null });

    await expect(appClient.accountClaims.claim({
      token: 'claim-token',
      displayName: 'First Administrator',
    })).resolves.toEqual({ role: 'owner' });

    expect(supabase.rpc).toHaveBeenCalledWith('claim_pre_authorized_account', {
      p_token: 'claim-token',
      p_display_name: 'First Administrator',
    });
  });

  it('sets an invited user password without creating a public signup', async () => {
    supabase.auth.updateUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });

    await expect(appClient.auth.completeInvite('long-enough-password'))
      .resolves.toEqual({ id: 'user-1' });
    expect(supabase.auth.updateUser).toHaveBeenCalledWith({ password: 'long-enough-password' });
  });

  it('activates only through the server-verified invitation secret', async () => {
    supabase.rpc.mockResolvedValue({
      data: { role: 'staff', organizationId: 'organization-1' },
      error: null,
    });

    await expect(appClient.auth.acceptInvitation('single-use-activation'))
      .resolves.toEqual({ role: 'staff', organizationId: 'organization-1' });
    expect(supabase.rpc).toHaveBeenCalledWith('accept_pre_authorized_invitation', {
      p_activation_token: 'single-use-activation',
    });
  });

  it('never calls invitation activation without the server secret', async () => {
    await expect(appClient.auth.acceptInvitation('')).rejects.toThrow(/activation/i);
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it('establishes the exact emailed session before allowing account completion', async () => {
    const session = { access_token: 'emailed-access', refresh_token: 'emailed-refresh' };
    supabase.auth.setSession.mockResolvedValue({
      data: { user: { id: 'invited-user' } },
      error: null,
    });

    await expect(appClient.auth.establishEmailLinkSession(session))
      .resolves.toEqual({ id: 'invited-user' });
    expect(supabase.auth.setSession).toHaveBeenCalledWith(session);
  });

  it('rejects incomplete or failed email-link sessions', async () => {
    await expect(appClient.auth.establishEmailLinkSession({ access_token: 'only-access' }))
      .rejects.toThrow(/valid email-link session/i);
    expect(supabase.auth.setSession).not.toHaveBeenCalled();

    supabase.auth.setSession.mockResolvedValue({ data: { user: null }, error: new Error('expired') });
    await expect(appClient.auth.establishEmailLinkSession({
      access_token: 'expired-access',
      refresh_token: 'expired-refresh',
    })).rejects.toThrow('expired');
  });

  it('invokes the resident-specific invitation function', async () => {
    supabase.functions.invoke.mockResolvedValue({
      data: { ok: true, user_id: 'resident-user', resident_id: 'resident-1' },
      error: null,
    });

    await expect(appClient.residentAccess.invite({
      resident_id: 'resident-1',
      ignored_email: 'attacker-controlled@example.test',
    })).resolves.toMatchObject({ ok: true, resident_id: 'resident-1' });

    expect(supabase.functions.invoke).toHaveBeenCalledWith('invite-resident', {
      body: { resident_id: 'resident-1' },
    });
  });

  it('loads a resident portal profile only by the authenticated user id', async () => {
    supabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'resident-user', email: 'resident@example.test' } },
      error: null,
    });
    const resident = { id: 'resident-1', user_id: 'resident-user', status: 'active' };
    const query = createProgressQuery({ data: resident, error: null });
    supabase.from.mockReturnValue(query);

    await expect(appClient.residentAccess.me()).resolves.toEqual(resident);

    expect(supabase.from).toHaveBeenCalledWith('residents');
    expect(query.eq.mock.calls).toEqual([
      ['user_id', 'resident-user'],
      ['status', 'active'],
    ]);
  });
});
