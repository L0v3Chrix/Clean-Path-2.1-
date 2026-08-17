import { describe, expect, it, vi } from 'vitest';

import {
  clearStoredAccountClaim,
  clearStoredInvitationActivation,
  getAccountCompletionMode,
  getEmailLinkSessionFromUrl,
  getInvitationActivationFromUrl,
  getRecoverableAccountClaim,
  getRecoverableInvitationActivation,
  getAccountClaimFromUrl,
  getSanitizedInvitationPath,
  isPermanentAccountClaimError,
  validateInvitationPassword,
} from './inviteAcceptance';

describe('invitation acceptance', () => {
  it('distinguishes password recovery from invitation completion', () => {
    expect(getAccountCompletionMode(
      'https://clearpath.example/accept-invite?mode=recovery#access_token=secret',
    )).toBe('recovery');
    expect(getAccountCompletionMode('https://clearpath.example/accept-invite')).toBe('invitation');
    expect(getAccountCompletionMode(
      'https://clearpath.example/accept-invite?mode=unexpected',
    )).toBe('invitation');
  });

  it('requires both callback tokens before establishing an email-link session', () => {
    expect(getEmailLinkSessionFromUrl(
      'https://clearpath.example/accept-invite#claim=single-use-token#access_token=access&refresh_token=refresh&type=invite',
    )).toEqual({ access_token: 'access', refresh_token: 'refresh', type: 'invite' });
    expect(getEmailLinkSessionFromUrl(
      'https://clearpath.example/accept-invite#access_token=access',
    )).toBeNull();
    expect(getEmailLinkSessionFromUrl('https://clearpath.example/accept-invite')).toBeNull();
  });

  it('recovers an invite-only activation secret from a fragment without mixing it into the session', () => {
    const href = 'https://clearpath.example/accept-invite'
      + '#activation_token=single-use-activation'
      + '#access_token=access&refresh_token=refresh&type=invite';

    expect(getInvitationActivationFromUrl(href)).toBe('single-use-activation');
    expect(getEmailLinkSessionFromUrl(href)).toEqual({
      access_token: 'access',
      refresh_token: 'refresh',
      type: 'invite',
    });
  });

  it('keeps the activation secret in tab-scoped storage after sanitizing browser history', () => {
    const storage = {
      getItem: vi.fn().mockReturnValue(null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    };
    const href = 'https://clearpath.example/accept-invite'
      + '#activation_token=single-use-activation'
      + '#access_token=access&refresh_token=refresh&type=invite';

    expect(getRecoverableInvitationActivation(href, storage)).toBe('single-use-activation');
    expect(storage.setItem).toHaveBeenCalledWith(
      'clearpath:invitation-activation',
      'single-use-activation',
    );
    expect(getSanitizedInvitationPath(href)).toBe('/accept-invite');

    clearStoredInvitationActivation(storage);
    expect(storage.removeItem).toHaveBeenCalledWith('clearpath:invitation-activation');
  });

  it('reads a pre-authorized account claim only from the URL fragment', () => {
    expect(getAccountClaimFromUrl('https://clearpath.example/accept-invite#claim=single-use-token'))
      .toBe('single-use-token');
    expect(getAccountClaimFromUrl('https://clearpath.example/accept-invite?claim=must-not-be-read'))
      .toBeNull();
    expect(getAccountClaimFromUrl('https://clearpath.example/accept-invite')).toBeNull();
  });

  it('removes the captured claim and Supabase session fragment from browser history', () => {
    expect(getSanitizedInvitationPath(
      'https://clearpath.example/accept-invite?source=email#claim=single-use-token&access_token=secret&refresh_token=refresh&type=invite',
    )).toBe('/accept-invite?source=email');
  });

  it('keeps a new claim in tab-scoped storage so a transient failure can be retried', () => {
    const storage = {
      getItem: vi.fn().mockReturnValue(null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    };

    expect(getRecoverableAccountClaim(
      'https://clearpath.example/accept-invite#claim=single-use-token#access_token=access&refresh_token=refresh&type=invite',
      storage,
    )).toBe('single-use-token');
    expect(storage.setItem).toHaveBeenCalledWith(
      'clearpath:account-claim',
      'single-use-token',
    );
  });

  it('recovers a stored claim after the URL has been sanitized and clears it explicitly', () => {
    const storage = {
      getItem: vi.fn().mockReturnValue('stored-single-use-token'),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    };

    expect(getRecoverableAccountClaim(
      'https://clearpath.example/accept-invite',
      storage,
    )).toBe('stored-single-use-token');
    expect(storage.setItem).not.toHaveBeenCalled();

    clearStoredAccountClaim(storage);
    expect(storage.removeItem).toHaveBeenCalledWith('clearpath:account-claim');
  });

  it('fails closed when tab-scoped storage is unavailable', () => {
    const storage = {
      getItem: vi.fn(() => { throw new Error('blocked'); }),
      setItem: vi.fn(() => { throw new Error('blocked'); }),
      removeItem: vi.fn(() => { throw new Error('blocked'); }),
    };

    expect(getRecoverableAccountClaim(
      'https://clearpath.example/accept-invite#claim=url-token',
      storage,
    )).toBe('url-token');
    expect(getRecoverableAccountClaim('https://clearpath.example/accept-invite', storage)).toBeNull();
    expect(() => clearStoredAccountClaim(storage)).not.toThrow();
  });

  it('distinguishes permanent claim rejection from a retryable transport failure', () => {
    expect(isPermanentAccountClaimError(new Error('Account claim is invalid'))).toBe(true);
    expect(isPermanentAccountClaimError(new Error('Account claim is no longer pending'))).toBe(true);
    expect(isPermanentAccountClaimError(new Error(
      'Account claim email does not match the authenticated identity',
    ))).toBe(true);
    expect(isPermanentAccountClaimError(new Error('Failed to fetch'))).toBe(false);
    expect(isPermanentAccountClaimError(null)).toBe(false);
  });

  it('requires matching passwords of at least eight characters', () => {
    expect(validateInvitationPassword('short', 'short')).toBe('Use at least 8 characters.');
    expect(validateInvitationPassword('long-enough', 'different')).toBe('Passwords do not match.');
    expect(validateInvitationPassword('long-enough', 'long-enough')).toBeNull();
  });
});
