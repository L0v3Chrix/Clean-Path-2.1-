const ACCOUNT_CLAIM_STORAGE_KEY = 'clearpath:account-claim';
const INVITATION_ACTIVATION_STORAGE_KEY = 'clearpath:invitation-activation';

function getSessionStorage(storage) {
  if (storage) return storage;
  try {
    return globalThis.sessionStorage;
  } catch {
    return null;
  }
}

function getFragmentValue(href, key) {
  const fragment = new URL(href).hash.slice(1);
  for (const segment of fragment.split('#')) {
    const value = new URLSearchParams(segment).get(key);
    if (value) return value;
  }
  return null;
}

export function getAccountClaimFromUrl(href) {
  return getFragmentValue(href, 'claim');
}

export function getAccountCompletionMode(href) {
  return new URL(href).searchParams.get('mode') === 'recovery' ? 'recovery' : 'invitation';
}

export function getEmailLinkSessionFromUrl(href) {
  const accessToken = getFragmentValue(href, 'access_token');
  const refreshToken = getFragmentValue(href, 'refresh_token');
  if (!accessToken || !refreshToken) return null;
  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    type: getFragmentValue(href, 'type'),
  };
}

export function getInvitationActivationFromUrl(href) {
  return getFragmentValue(href, 'activation_token');
}

export function getRecoverableAccountClaim(href, storage) {
  const claimFromUrl = getAccountClaimFromUrl(href);
  const claimStorage = getSessionStorage(storage);

  if (claimFromUrl) {
    try {
      claimStorage?.setItem(ACCOUNT_CLAIM_STORAGE_KEY, claimFromUrl);
    } catch {
      // The URL token remains usable even when the browser blocks storage.
    }
    return claimFromUrl;
  }

  try {
    return claimStorage?.getItem(ACCOUNT_CLAIM_STORAGE_KEY) || null;
  } catch {
    return null;
  }
}

export function clearStoredAccountClaim(storage) {
  try {
    getSessionStorage(storage)?.removeItem(ACCOUNT_CLAIM_STORAGE_KEY);
  } catch {
    // Clearing a best-effort recovery token must not block invite completion.
  }
}

export function getRecoverableInvitationActivation(href, storage) {
  const activationFromUrl = getInvitationActivationFromUrl(href);
  const activationStorage = getSessionStorage(storage);

  if (activationFromUrl) {
    try {
      activationStorage?.setItem(INVITATION_ACTIVATION_STORAGE_KEY, activationFromUrl);
    } catch {
      // The fragment remains usable when tab-scoped storage is unavailable.
    }
    return activationFromUrl;
  }

  try {
    return activationStorage?.getItem(INVITATION_ACTIVATION_STORAGE_KEY) || null;
  } catch {
    return null;
  }
}

export function clearStoredInvitationActivation(storage) {
  try {
    getSessionStorage(storage)?.removeItem(INVITATION_ACTIVATION_STORAGE_KEY);
  } catch {
    // Clearing best-effort retry state must not block sign-out or navigation.
  }
}

export function getSanitizedInvitationPath(href) {
  const url = new URL(href);
  url.searchParams.delete('claim');
  const query = url.searchParams.toString();
  return `${url.pathname}${query ? `?${query}` : ''}`;
}

export function validateInvitationPassword(password, confirmation) {
  if (password.length < 8) return 'Use at least 8 characters.';
  if (password !== confirmation) return 'Passwords do not match.';
  return null;
}

export function isPermanentAccountClaimError(error) {
  const message = error?.message || '';
  return [
    'Account claim is invalid',
    'Account claim is no longer pending',
    'Account claim email does not match',
    'Claim organization not found',
    'Account claim completion is inconsistent',
    'Claim organization already has an active membership',
    'Authenticated user already has an active organization membership',
  ].some(pattern => message.includes(pattern));
}
