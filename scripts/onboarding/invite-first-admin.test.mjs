import { describe, expect, it, vi } from 'vitest';

import {
  buildClaimRedirectUrl,
  createSingleUseToken,
  createSupabaseFirstAdminGateway,
  hashClaimToken,
  parseFirstAdminOptions,
  provisionFirstAdministrator,
  readFirstAdminRuntimeConfig,
  runFirstAdminCli,
  validateInviteBaseUrl,
} from './invite-first-admin.mjs';

const ORGANIZATION_ID = '10000000-0000-4000-8000-000000000001';
const CLAIM_ID = '20000000-0000-4000-8000-000000000001';
const INVITE_OPERATION_ID = 'op-first-admin-1';

describe('first-administrator input validation', () => {
  it('accepts required options and applies the 24-hour default', () => {
    expect(parseFirstAdminOptions([
      '--organization-id', ORGANIZATION_ID,
      '--email', 'Admin@Example.test',
    ])).toEqual({
      organizationId: ORGANIZATION_ID,
      email: 'admin@example.test',
      displayName: '',
      expiresHours: 24,
      send: false,
    });
  });

  it('accepts optional display name, expiry, and the explicit mutation flag', () => {
    expect(parseFirstAdminOptions([
      '--organization-id', ORGANIZATION_ID,
      '--email=admin@example.test',
      '--display-name', ' First Admin ',
      '--expires-hours', '72',
      '--send',
    ])).toEqual({
      organizationId: ORGANIZATION_ID,
      email: 'admin@example.test',
      displayName: 'First Admin',
      expiresHours: 72,
      send: true,
    });
  });

  it.each([
    [['--email', 'admin@example.test'], /organization-id/i],
    [['--organization-id', 'not-a-uuid', '--email', 'admin@example.test'], /uuid/i],
    [['--organization-id', ORGANIZATION_ID, '--email', 'not-an-email'], /email/i],
    [['--organization-id', ORGANIZATION_ID, '--email', 'admin@example.test', '--expires-hours', '0'], /1 and 72/i],
    [['--organization-id', ORGANIZATION_ID, '--email', 'admin@example.test', '--expires-hours', '73'], /1 and 72/i],
    [['--organization-id', ORGANIZATION_ID, '--email', 'admin@example.test', '--expires-hours', '1.5'], /integer/i],
    [['--organization-id', ORGANIZATION_ID, '--email', 'admin@example.test', '--unknown'], /unknown option/i],
    [['--organization-id', ORGANIZATION_ID, '--email', 'admin@example.test', '--send=yes'], /does not take a value/i],
  ])('rejects invalid arguments: %j', (argv, message) => {
    expect(() => parseFirstAdminOptions(argv)).toThrow(message);
  });

  it.each([
    'https://app.example.test/accept-invite',
    'http://localhost:5173/accept-invite',
    'http://127.0.0.1:4173/accept-invite',
  ])('accepts an exact invite URL: %s', (url) => {
    expect(validateInviteBaseUrl(url)).toBe(url);
  });

  it.each([
    '',
    'not-a-url',
    'http://app.example.test/accept-invite',
    'https://app.example.test/accept-invite/',
    'https://app.example.test/onboarding/accept-invite',
    'https://app.example.test/accept-invite?source=cli',
    'https://app.example.test/accept-invite#claim',
    'https://user:password@app.example.test/accept-invite',
  ])('rejects an unsafe or inexact invite URL: %s', (url) => {
    expect(() => validateInviteBaseUrl(url)).toThrow(/invite redirect url/i);
  });
});

describe('first-administrator preflight', () => {
  it('keeps dry-run read-only and returns a privacy-minimized plan', async () => {
    const gateway = {
      organizationExists: vi.fn(async () => true),
      countActiveMembers: vi.fn(async () => 0),
      insertClaim: vi.fn(),
      inviteUser: vi.fn(),
      revokeClaim: vi.fn(),
    };
    const createToken = vi.fn();
    const hashToken = vi.fn();

    const result = await provisionFirstAdministrator({
      organizationId: ORGANIZATION_ID,
      email: 'admin@example.test',
      displayName: 'First Admin',
      expiresHours: 24,
      send: false,
    }, {
      gateway,
      createToken,
      hashToken,
      now: () => new Date('2026-08-16T12:00:00.000Z'),
    });

    expect(gateway.organizationExists).toHaveBeenCalledWith(ORGANIZATION_ID);
    expect(gateway.countActiveMembers).toHaveBeenCalledWith(ORGANIZATION_ID);
    expect(createToken).not.toHaveBeenCalled();
    expect(hashToken).not.toHaveBeenCalled();
    expect(gateway.insertClaim).not.toHaveBeenCalled();
    expect(gateway.inviteUser).not.toHaveBeenCalled();
    expect(gateway.revokeClaim).not.toHaveBeenCalled();
    expect(result).toEqual({
      mode: 'dry-run',
      organizationId: ORGANIZATION_ID,
      expiresHours: 24,
      invited: false,
    });
    expect(JSON.stringify(result)).not.toContain('admin@example.test');
  });

  it('stops when the organization does not exist', async () => {
    const gateway = {
      organizationExists: vi.fn(async () => false),
      countActiveMembers: vi.fn(),
    };

    await expect(provisionFirstAdministrator({
      organizationId: ORGANIZATION_ID,
      email: 'admin@example.test',
      displayName: '',
      expiresHours: 24,
      send: false,
    }, { gateway })).rejects.toThrow(/organization was not found/i);
    expect(gateway.countActiveMembers).not.toHaveBeenCalled();
  });

  it('stops when the organization already has an active member', async () => {
    const gateway = {
      organizationExists: vi.fn(async () => true),
      countActiveMembers: vi.fn(async () => 1),
    };

    await expect(provisionFirstAdministrator({
      organizationId: ORGANIZATION_ID,
      email: 'admin@example.test',
      displayName: '',
      expiresHours: 24,
      send: false,
    }, { gateway })).rejects.toThrow(/already has an active member/i);
  });
});

describe('first-administrator invitation', () => {
  it('URL-encodes the claim in the fragment so it never reaches the application host', () => {
    expect(buildClaimRedirectUrl(
      'https://app.example.test/accept-invite',
      'raw token+/=?&',
    )).toBe(
      'https://app.example.test/accept-invite#claim=raw%20token%2B%2F%3D%3F%26',
    );
  });

  it('stores only the token digest, relies on the admin default, and sends the invite', async () => {
    const rawToken = 'sensitive-single-use-token';
    const tokenHash = `\\x${'ab'.repeat(32)}`;
    const events = [];
    const gateway = {
      organizationExists: vi.fn(async () => true),
      countActiveMembers: vi.fn(async () => 0),
      authUserExistsByEmail: vi.fn(async () => false),
      generatePendingInviteUser: vi.fn(async () => {
        events.push('generatePendingInviteUser');
        return {
          id: 'pending-user',
          user_metadata: { invite_operation_id: INVITE_OPERATION_ID },
        };
      }),
      insertClaim: vi.fn(async (payload) => {
        events.push('insertClaim');
        return ({
        id: CLAIM_ID,
        expiresAt: payload.expires_at,
      });
      }),
      sendInviteUser: vi.fn(async () => {
        events.push('sendInviteUser');
        return {
          id: 'pending-user',
          user_metadata: { invite_operation_id: INVITE_OPERATION_ID },
        };
      }),
      revokeClaim: vi.fn(),
      deleteUser: vi.fn(),
    };

    const result = await provisionFirstAdministrator({
      organizationId: ORGANIZATION_ID,
      email: 'admin@example.test',
      displayName: 'First Admin',
      expiresHours: 36,
      send: true,
    }, {
      gateway,
      inviteBaseUrl: 'https://app.example.test/accept-invite',
      createToken: vi.fn(() => rawToken),
      hashToken: vi.fn(() => tokenHash),
      createInviteOperationMarker: vi.fn(() => INVITE_OPERATION_ID),
      now: () => new Date('2026-08-16T12:00:00.000Z'),
    });

    expect(gateway.authUserExistsByEmail).toHaveBeenCalledWith('admin@example.test');
    expect(gateway.generatePendingInviteUser).toHaveBeenCalledWith('admin@example.test', {
      redirectTo: 'https://app.example.test/accept-invite#claim=sensitive-single-use-token',
      data: { full_name: 'First Admin', invite_operation_id: INVITE_OPERATION_ID },
    });
    expect(gateway.insertClaim).toHaveBeenCalledOnce();
    const insertedClaim = gateway.insertClaim.mock.calls[0][0];
    expect(insertedClaim).toEqual({
      organization_id: ORGANIZATION_ID,
      token_hash: tokenHash,
      email: 'admin@example.test',
      expires_at: '2026-08-18T00:00:00.000Z',
    });
    expect(insertedClaim).not.toHaveProperty('initial_role');
    expect(JSON.stringify(insertedClaim)).not.toContain(rawToken);
    expect(gateway.sendInviteUser).toHaveBeenCalledWith('admin@example.test', {
      redirectTo: 'https://app.example.test/accept-invite#claim=sensitive-single-use-token',
      data: { full_name: 'First Admin', invite_operation_id: INVITE_OPERATION_ID },
    });
    expect(gateway.revokeClaim).not.toHaveBeenCalled();
    expect(gateway.deleteUser).not.toHaveBeenCalled();
    expect(events).toEqual([
      'generatePendingInviteUser',
      'insertClaim',
      'sendInviteUser',
    ]);
    expect(result).toEqual({
      mode: 'sent',
      organizationId: ORGANIZATION_ID,
      claimId: CLAIM_ID,
      expiresAt: '2026-08-18T00:00:00.000Z',
      invited: true,
    });
    expect(JSON.stringify(result)).not.toContain(rawToken);
    expect(JSON.stringify(result)).not.toContain('admin@example.test');
  });

  it('refuses before claim creation or email send when Auth already has the normalized email', async () => {
    const gateway = {
      organizationExists: vi.fn(async () => true),
      countActiveMembers: vi.fn(async () => 0),
      authUserExistsByEmail: vi.fn(async () => true),
      insertClaim: vi.fn(),
      generatePendingInviteUser: vi.fn(),
      sendInviteUser: vi.fn(),
      revokeClaim: vi.fn(),
      deleteUser: vi.fn(),
    };

    await expect(provisionFirstAdministrator({
      organizationId: ORGANIZATION_ID,
      email: 'admin@example.test',
      displayName: 'First Admin',
      expiresHours: 24,
      send: true,
    }, {
      gateway,
      inviteBaseUrl: 'https://app.example.test/accept-invite',
      createToken: vi.fn(() => 'unused-token'),
      hashToken: vi.fn(() => `\\x${'aa'.repeat(32)}`),
      createInviteOperationMarker: vi.fn(() => INVITE_OPERATION_ID),
      now: () => new Date('2026-08-16T12:00:00.000Z'),
    })).rejects.toThrow('Unable to invite the first administrator.');

    expect(gateway.generatePendingInviteUser).not.toHaveBeenCalled();
    expect(gateway.insertClaim).not.toHaveBeenCalled();
    expect(gateway.sendInviteUser).not.toHaveBeenCalled();
    expect(gateway.revokeClaim).not.toHaveBeenCalled();
    expect(gateway.deleteUser).not.toHaveBeenCalled();
  });

  it('deletes the owned pending Auth user and never sends email when claim creation fails', async () => {
    const rawToken = 'marker-check-token';
    const gateway = {
      organizationExists: vi.fn(async () => true),
      countActiveMembers: vi.fn(async () => 0),
      authUserExistsByEmail: vi.fn(async () => false),
      generatePendingInviteUser: vi.fn(async () => ({
        id: 'pending-user',
        user_metadata: { invite_operation_id: INVITE_OPERATION_ID },
      })),
      insertClaim: vi.fn(async () => {
        throw new Error('duplicate claim');
      }),
      sendInviteUser: vi.fn(),
      revokeClaim: vi.fn(),
      deleteUser: vi.fn(async () => undefined),
    };

    await expect(provisionFirstAdministrator({
      organizationId: ORGANIZATION_ID,
      email: 'admin@example.test',
      displayName: '',
      expiresHours: 24,
      send: true,
    }, {
      gateway,
      inviteBaseUrl: 'https://app.example.test/accept-invite',
      createToken: () => rawToken,
      hashToken: () => `\\x${'11'.repeat(32)}`,
      createInviteOperationMarker: () => INVITE_OPERATION_ID,
      now: () => new Date('2026-08-16T12:00:00.000Z'),
    })).rejects.toThrow('Unable to create the account claim.');

    expect(gateway.sendInviteUser).not.toHaveBeenCalled();
    expect(gateway.revokeClaim).not.toHaveBeenCalled();
    expect(gateway.deleteUser).toHaveBeenCalledWith('pending-user');
  });

  it('fails closed when deleting the owned pending Auth user after claim creation failure cannot be confirmed', async () => {
    const rawToken = 'marker-check-token';
    const gateway = {
      organizationExists: vi.fn(async () => true),
      countActiveMembers: vi.fn(async () => 0),
      authUserExistsByEmail: vi.fn(async () => false),
      generatePendingInviteUser: vi.fn(async () => ({
        id: 'pending-user',
        user_metadata: { invite_operation_id: INVITE_OPERATION_ID },
      })),
      insertClaim: vi.fn(async () => {
        throw new Error('duplicate claim');
      }),
      sendInviteUser: vi.fn(),
      revokeClaim: vi.fn(),
      deleteUser: vi.fn(async () => {
        throw new Error('provider cleanup failed');
      }),
    };

    await expect(provisionFirstAdministrator({
      organizationId: ORGANIZATION_ID,
      email: 'admin@example.test',
      displayName: '',
      expiresHours: 24,
      send: true,
    }, {
      gateway,
      inviteBaseUrl: 'https://app.example.test/accept-invite',
      createToken: () => rawToken,
      hashToken: () => `\\x${'11'.repeat(32)}`,
      createInviteOperationMarker: () => INVITE_OPERATION_ID,
      now: () => new Date('2026-08-16T12:00:00.000Z'),
    })).rejects.toThrow(
      'Unable to create the account claim and pending Auth user cleanup could not be confirmed.',
    );

    expect(gateway.sendInviteUser).not.toHaveBeenCalled();
    expect(gateway.revokeClaim).not.toHaveBeenCalled();
    expect(gateway.deleteUser).toHaveBeenCalledWith('pending-user');
  });

  it('revokes the new claim and deletes the owned pending Auth user when the sent Auth user marker mismatches', async () => {
    const rawToken = 'marker-check-token';
    const gateway = {
      organizationExists: vi.fn(async () => true),
      countActiveMembers: vi.fn(async () => 0),
      authUserExistsByEmail: vi.fn(async () => false),
      generatePendingInviteUser: vi.fn(async () => ({
        id: 'pending-user',
        user_metadata: { invite_operation_id: INVITE_OPERATION_ID },
      })),
      insertClaim: vi.fn(async () => ({
        id: CLAIM_ID,
        expiresAt: '2026-08-17T12:00:00.000Z',
      })),
      sendInviteUser: vi.fn(async () => ({
        id: 'other-pending-user',
        user_metadata: { invite_operation_id: 'someone-else' },
      })),
      revokeClaim: vi.fn(async () => undefined),
      deleteUser: vi.fn(async () => undefined),
    };

    let failure;
    try {
      await provisionFirstAdministrator({
        organizationId: ORGANIZATION_ID,
        email: 'admin@example.test',
        displayName: '',
        expiresHours: 24,
        send: true,
      }, {
        gateway,
        inviteBaseUrl: 'https://app.example.test/accept-invite',
        createToken: () => rawToken,
        hashToken: () => `\\x${'11'.repeat(32)}`,
        createInviteOperationMarker: () => INVITE_OPERATION_ID,
        now: () => new Date('2026-08-16T12:00:00.000Z'),
      });
    } catch (error) {
      failure = error;
    }

    expect(failure).toBeInstanceOf(Error);
    expect(failure.message).toBe('Auth invitation could not be verified; the new account claim was revoked.');
    expect(failure.message).not.toContain(rawToken);
    expect(failure.message).not.toContain('someone-else');
    expect(gateway.revokeClaim).toHaveBeenCalledWith(CLAIM_ID, {
      revoked_at: '2026-08-16T12:00:00.000Z',
      revocation_reason: 'auth_user_marker_mismatch',
    });
    expect(gateway.deleteUser).toHaveBeenCalledWith('pending-user');
  });

  it('revokes the new claim and hides provider details when the invite fails', async () => {
    const rawToken = 'never-print-this-token';
    const providerError = new Error(`provider rejected ${rawToken} with bearer material`);
    const gateway = {
      organizationExists: vi.fn(async () => true),
      countActiveMembers: vi.fn(async () => 0),
      authUserExistsByEmail: vi.fn(async () => false),
      generatePendingInviteUser: vi.fn(async () => ({
        id: 'pending-user',
        user_metadata: { invite_operation_id: INVITE_OPERATION_ID },
      })),
      insertClaim: vi.fn(async () => ({
        id: CLAIM_ID,
        expiresAt: '2026-08-17T12:00:00.000Z',
      })),
      sendInviteUser: vi.fn(async () => { throw providerError; }),
      revokeClaim: vi.fn(async () => undefined),
      deleteUser: vi.fn(async () => undefined),
    };

    let failure;
    try {
      await provisionFirstAdministrator({
        organizationId: ORGANIZATION_ID,
        email: 'admin@example.test',
        displayName: '',
        expiresHours: 24,
        send: true,
      }, {
        gateway,
        inviteBaseUrl: 'https://app.example.test/accept-invite',
        createToken: () => rawToken,
        hashToken: () => `\\x${'cd'.repeat(32)}`,
        createInviteOperationMarker: () => INVITE_OPERATION_ID,
        now: () => new Date('2026-08-16T12:00:00.000Z'),
      });
    } catch (error) {
      failure = error;
    }

    expect(failure).toBeInstanceOf(Error);
    expect(failure.message).toBe('Auth invitation failed; the new account claim was revoked.');
    expect(failure.message).not.toContain(rawToken);
    expect(failure.message).not.toContain(providerError.message);
    expect(gateway.revokeClaim).toHaveBeenCalledWith(CLAIM_ID, {
      revoked_at: '2026-08-16T12:00:00.000Z',
      revocation_reason: 'auth_invite_failed',
    });
    expect(gateway.deleteUser).toHaveBeenCalledWith('pending-user');
  });

  it('still deletes the pending Auth user when claim revocation cannot be confirmed', async () => {
    const rawToken = 'never-print-this-token';
    const providerError = new Error(`provider rejected ${rawToken} with bearer material`);
    const cleanupEvents = [];
    const gateway = {
      organizationExists: vi.fn(async () => true),
      countActiveMembers: vi.fn(async () => 0),
      authUserExistsByEmail: vi.fn(async () => false),
      generatePendingInviteUser: vi.fn(async () => ({
        id: 'pending-user',
        user_metadata: { invite_operation_id: INVITE_OPERATION_ID },
      })),
      insertClaim: vi.fn(async () => ({
        id: CLAIM_ID,
        expiresAt: '2026-08-17T12:00:00.000Z',
      })),
      sendInviteUser: vi.fn(async () => { throw providerError; }),
      revokeClaim: vi.fn(async () => {
        cleanupEvents.push('revokeClaim');
        throw new Error(`revocation failed for ${rawToken}`);
      }),
      deleteUser: vi.fn(async () => {
        cleanupEvents.push('deleteUser');
      }),
    };

    let failure;
    try {
      await provisionFirstAdministrator({
        organizationId: ORGANIZATION_ID,
        email: 'admin@example.test',
        displayName: '',
        expiresHours: 24,
        send: true,
      }, {
        gateway,
        inviteBaseUrl: 'https://app.example.test/accept-invite',
        createToken: () => rawToken,
        hashToken: () => `\\x${'cd'.repeat(32)}`,
        createInviteOperationMarker: () => INVITE_OPERATION_ID,
        now: () => new Date('2026-08-16T12:00:00.000Z'),
      });
    } catch (error) {
      failure = error;
    }

    expect(failure).toBeInstanceOf(Error);
    expect(failure.message).toBe(
      'Auth invitation failed; account claim revocation could not be confirmed, but the pending Auth user was removed.',
    );
    expect(failure.message).not.toContain(rawToken);
    expect(failure.message).not.toContain(providerError.message);
    expect(failure.message).not.toContain('revocation failed');
    expect(cleanupEvents).toEqual(['revokeClaim', 'deleteUser']);
    expect(gateway.deleteUser).toHaveBeenCalledWith('pending-user');
  });

  it('reports only Auth cleanup uncertainty when claim revocation succeeds', async () => {
    const rawToken = 'never-print-this-token';
    const providerError = new Error(`provider rejected ${rawToken} with bearer material`);
    const gateway = {
      organizationExists: vi.fn(async () => true),
      countActiveMembers: vi.fn(async () => 0),
      authUserExistsByEmail: vi.fn(async () => false),
      generatePendingInviteUser: vi.fn(async () => ({
        id: 'pending-user',
        user_metadata: { invite_operation_id: INVITE_OPERATION_ID },
      })),
      insertClaim: vi.fn(async () => ({
        id: CLAIM_ID,
        expiresAt: '2026-08-17T12:00:00.000Z',
      })),
      sendInviteUser: vi.fn(async () => { throw providerError; }),
      revokeClaim: vi.fn(async () => undefined),
      deleteUser: vi.fn(async () => {
        throw new Error('cleanup-provider-error');
      }),
    };

    let failure;
    try {
      await provisionFirstAdministrator({
        organizationId: ORGANIZATION_ID,
        email: 'admin@example.test',
        displayName: '',
        expiresHours: 24,
        send: true,
      }, {
        gateway,
        inviteBaseUrl: 'https://app.example.test/accept-invite',
        createToken: () => rawToken,
        hashToken: () => `\\x${'cd'.repeat(32)}`,
        createInviteOperationMarker: () => INVITE_OPERATION_ID,
        now: () => new Date('2026-08-16T12:00:00.000Z'),
      });
    } catch (error) {
      failure = error;
    }

    expect(failure).toBeInstanceOf(Error);
    expect(failure.message).toBe(
      'Auth invitation failed; the new account claim was revoked and pending Auth user cleanup could not be confirmed.',
    );
    expect(failure.message).not.toContain(rawToken);
    expect(failure.message).not.toContain(providerError.message);
    expect(gateway.revokeClaim).toHaveBeenCalledWith(CLAIM_ID, {
      revoked_at: '2026-08-16T12:00:00.000Z',
      revocation_reason: 'auth_invite_failed',
    });
    expect(gateway.deleteUser).toHaveBeenCalledWith('pending-user');
  });

  it('attempts both cleanup operations and reports both uncertainties without leaking secrets', async () => {
    const rawToken = 'never-print-this-token';
    const providerError = new Error(`provider rejected ${rawToken} with bearer material`);
    const cleanupEvents = [];
    const gateway = {
      organizationExists: vi.fn(async () => true),
      countActiveMembers: vi.fn(async () => 0),
      authUserExistsByEmail: vi.fn(async () => false),
      generatePendingInviteUser: vi.fn(async () => ({
        id: 'pending-user',
        user_metadata: { invite_operation_id: INVITE_OPERATION_ID },
      })),
      insertClaim: vi.fn(async () => ({
        id: CLAIM_ID,
        expiresAt: '2026-08-17T12:00:00.000Z',
      })),
      sendInviteUser: vi.fn(async () => { throw providerError; }),
      revokeClaim: vi.fn(async () => {
        cleanupEvents.push('revokeClaim');
        throw new Error(`revocation failed for ${rawToken}`);
      }),
      deleteUser: vi.fn(async () => {
        cleanupEvents.push('deleteUser');
        throw new Error(`Auth deletion failed for ${rawToken}`);
      }),
    };

    let failure;
    try {
      await provisionFirstAdministrator({
        organizationId: ORGANIZATION_ID,
        email: 'admin@example.test',
        displayName: '',
        expiresHours: 24,
        send: true,
      }, {
        gateway,
        inviteBaseUrl: 'https://app.example.test/accept-invite',
        createToken: () => rawToken,
        hashToken: () => `\\x${'cd'.repeat(32)}`,
        createInviteOperationMarker: () => INVITE_OPERATION_ID,
        now: () => new Date('2026-08-16T12:00:00.000Z'),
      });
    } catch (error) {
      failure = error;
    }

    expect(failure).toBeInstanceOf(Error);
    expect(failure.message).toBe(
      'Auth invitation failed; account claim revocation and pending Auth user cleanup could not be confirmed.',
    );
    expect(failure.message).not.toContain(rawToken);
    expect(failure.message).not.toContain(providerError.message);
    expect(failure.message).not.toContain('revocation failed');
    expect(failure.message).not.toContain('Auth deletion failed');
    expect(cleanupEvents).toEqual(['revokeClaim', 'deleteUser']);
    expect(gateway.deleteUser).toHaveBeenCalledWith('pending-user');
  });
});

describe('first-administrator runtime boundary', () => {
  it('reads the secret-key fallback and validated redirect only when called', () => {
    const config = readFirstAdminRuntimeConfig({
      SUPABASE_URL: 'https://project.supabase.co',
      SUPABASE_SECRET_KEY: 'runtime-secret',
      USER_INVITE_REDIRECT_URL: 'https://app.example.test/accept-invite',
    });

    expect(config).toEqual({
      supabaseUrl: 'https://project.supabase.co',
      serviceKey: 'runtime-secret',
      inviteBaseUrl: 'https://app.example.test/accept-invite',
    });
  });

  it('prefers the first-administrator redirect and service-role key', () => {
    const config = readFirstAdminRuntimeConfig({
      SUPABASE_URL: 'https://project.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
      SUPABASE_SECRET_KEY: 'secret-key-fallback',
      FIRST_ADMIN_INVITE_REDIRECT_URL: 'https://admin.example.test/accept-invite',
      USER_INVITE_REDIRECT_URL: 'https://users.example.test/accept-invite',
    });

    expect(config.serviceKey).toBe('service-role-key');
    expect(config.inviteBaseUrl).toBe('https://admin.example.test/accept-invite');
  });

  it('creates random URL-safe tokens and SHA-256 bytea digests', () => {
    const first = createSingleUseToken();
    const second = createSingleUseToken();

    expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(second).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(second).not.toBe(first);
    expect(hashClaimToken('hello')).toBe(
      '\\x2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824',
    );
  });

  it('runs an injected dry-run and emits no email or secret material', async () => {
    const gateway = {
      organizationExists: vi.fn(async () => true),
      countActiveMembers: vi.fn(async () => 0),
    };
    const createGateway = vi.fn(async () => gateway);
    const stdout = { write: vi.fn() };
    const result = await runFirstAdminCli({
      argv: ['--organization-id', ORGANIZATION_ID, '--email', 'admin@example.test'],
      env: {
        SUPABASE_URL: 'https://project.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'do-not-print-service-key',
        FIRST_ADMIN_INVITE_REDIRECT_URL: 'https://app.example.test/accept-invite',
      },
      createGateway,
      stdout,
    });

    expect(result.mode).toBe('dry-run');
    expect(createGateway).toHaveBeenCalledWith({
      supabaseUrl: 'https://project.supabase.co',
      serviceKey: 'do-not-print-service-key',
    });
    const output = stdout.write.mock.calls[0][0];
    expect(JSON.parse(output)).toEqual(result);
    expect(output).not.toContain('admin@example.test');
    expect(output).not.toContain('do-not-print-service-key');
  });

  it('maps the bounded Supabase reads and mutations to the expected API calls', async () => {
    const organizationMaybeSingle = vi.fn(async () => ({ data: { id: ORGANIZATION_ID }, error: null }));
    const organizationIdEq = vi.fn(() => ({ maybeSingle: organizationMaybeSingle }));
    const organizationSelect = vi.fn(() => ({ eq: organizationIdEq }));

    const memberStatusEq = vi.fn(async () => ({ count: 0, error: null }));
    const memberOrganizationEq = vi.fn(() => ({ eq: memberStatusEq }));
    const memberSelect = vi.fn(() => ({ eq: memberOrganizationEq }));

    const claimSingle = vi.fn(async () => ({
      data: { id: CLAIM_ID, expires_at: '2026-08-17T12:00:00.000Z' },
      error: null,
    }));
    const claimInsertSelect = vi.fn(() => ({ single: claimSingle }));
    const claimInsert = vi.fn(() => ({ select: claimInsertSelect }));

    const revokeMaybeSingle = vi.fn(async () => ({ data: { id: CLAIM_ID }, error: null }));
    const revokeSelect = vi.fn(() => ({ maybeSingle: revokeMaybeSingle }));
    const revokeIsRevoked = vi.fn(() => ({ select: revokeSelect }));
    const revokeIsUsed = vi.fn(() => ({ is: revokeIsRevoked }));
    const revokeIdEq = vi.fn(() => ({ is: revokeIsUsed }));
    const claimUpdate = vi.fn(() => ({ eq: revokeIdEq }));
    const listUsersCalls = [];
    const listUsers = vi.fn(async ({ page, perPage }) => {
      listUsersCalls.push({ page, perPage });
      const users = page === 1
        ? Array.from({ length: 100 }, (_, index) => ({
          id: `other-user-${index}`,
          email: `other-${index}@example.com`,
        }))
        : [{ id: 'pending-user', email: 'ADMIN@example.test' }];
      return { data: { users }, error: null };
    });
    const generateLink = vi.fn(async () => ({
      data: { user: { id: 'pending-user', app_metadata: { invite_operation_id: INVITE_OPERATION_ID } } },
      error: null,
    }));
    const inviteUserByEmail = vi.fn(async () => ({
      data: { user: { id: 'pending-user', app_metadata: { invite_operation_id: INVITE_OPERATION_ID } } },
      error: null,
    }));
    const deleteUser = vi.fn(async () => ({
      data: { user: { id: 'pending-user' } },
      error: null,
    }));

    const client = {
      from: vi.fn((table) => {
        if (table === 'organizations') return { select: organizationSelect };
        if (table === 'organization_members') return { select: memberSelect };
        if (table === 'account_claims') return { insert: claimInsert, update: claimUpdate };
        throw new Error('unexpected table');
      }),
      auth: { admin: { deleteUser, generateLink, inviteUserByEmail, listUsers } },
    };
    const gateway = createSupabaseFirstAdminGateway(client);
    const claimPayload = {
      organization_id: ORGANIZATION_ID,
      token_hash: `\\x${'ef'.repeat(32)}`,
      email: 'admin@example.test',
      expires_at: '2026-08-17T12:00:00.000Z',
    };
    const revocation = {
      revoked_at: '2026-08-16T12:00:00.000Z',
      revocation_reason: 'auth_invite_failed',
    };

    await expect(gateway.organizationExists(ORGANIZATION_ID)).resolves.toBe(true);
    await expect(gateway.countActiveMembers(ORGANIZATION_ID)).resolves.toBe(0);
    await expect(gateway.authUserExistsByEmail('admin@example.test')).resolves.toBe(true);
    await expect(gateway.insertClaim(claimPayload)).resolves.toEqual({
      id: CLAIM_ID,
      expiresAt: '2026-08-17T12:00:00.000Z',
    });
    await expect(gateway.generatePendingInviteUser('admin@example.test', {
      redirectTo: 'https://app.example.test/accept-invite#claim=token',
      data: { full_name: 'First Admin', invite_operation_id: INVITE_OPERATION_ID },
    })).resolves.toEqual({
      id: 'pending-user',
      app_metadata: { invite_operation_id: INVITE_OPERATION_ID },
    });
    await expect(gateway.sendInviteUser('admin@example.test', {
      redirectTo: 'https://app.example.test/accept-invite#claim=token',
      data: { full_name: 'First Admin', invite_operation_id: INVITE_OPERATION_ID },
    })).resolves.toEqual({
      id: 'pending-user',
      app_metadata: { invite_operation_id: INVITE_OPERATION_ID },
    });
    await gateway.revokeClaim(CLAIM_ID, revocation);
    await expect(gateway.deleteUser('pending-user')).resolves.toBeUndefined();

    expect(organizationSelect).toHaveBeenCalledWith('id');
    expect(memberSelect).toHaveBeenCalledWith('id', { count: 'exact', head: true });
    expect(memberOrganizationEq).toHaveBeenCalledWith('organization_id', ORGANIZATION_ID);
    expect(memberStatusEq).toHaveBeenCalledWith('status', 'active');
    expect(listUsersCalls).toEqual([
      { page: 1, perPage: 100 },
      { page: 2, perPage: 100 },
    ]);
    expect(claimInsert).toHaveBeenCalledWith(claimPayload);
    expect(claimPayload).not.toHaveProperty('initial_role');
    expect(generateLink).toHaveBeenCalledWith({
      type: 'invite',
      email: 'admin@example.test',
      options: {
        redirectTo: 'https://app.example.test/accept-invite#claim=token',
        data: { full_name: 'First Admin', invite_operation_id: INVITE_OPERATION_ID },
      },
    });
    expect(inviteUserByEmail).toHaveBeenCalledWith('admin@example.test', {
      redirectTo: 'https://app.example.test/accept-invite#claim=token',
      data: { full_name: 'First Admin', invite_operation_id: INVITE_OPERATION_ID },
    });
    expect(claimUpdate).toHaveBeenCalledWith(revocation);
    expect(revokeIdEq).toHaveBeenCalledWith('id', CLAIM_ID);
    expect(revokeIsUsed).toHaveBeenCalledWith('used_at', null);
    expect(revokeIsRevoked).toHaveBeenCalledWith('revoked_at', null);
    expect(deleteUser).toHaveBeenCalledWith('pending-user');
  });
});
