import { createHash, randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INVITE_OPERATION_METADATA_KEY = 'invite_operation_id';
const AUTH_LIST_USERS_PAGE_SIZE = 100;
const VALUE_OPTIONS = new Set([
  'organization-id',
  'email',
  'display-name',
  'expires-hours',
]);

class FirstAdminCliError extends Error {}

function argumentError(message) {
  return new FirstAdminCliError(`Invalid arguments: ${message}`);
}

export function parseFirstAdminOptions(argv) {
  const values = new Map();
  let send = false;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument.startsWith('--')) {
      throw argumentError('unexpected positional argument.');
    }

    const equalsIndex = argument.indexOf('=');
    const name = argument.slice(2, equalsIndex === -1 ? undefined : equalsIndex);
    const inlineValue = equalsIndex === -1 ? undefined : argument.slice(equalsIndex + 1);

    if (name === 'send') {
      if (inlineValue !== undefined) {
        throw argumentError('--send does not take a value.');
      }
      if (send) throw argumentError('--send may only be provided once.');
      send = true;
      continue;
    }

    if (!VALUE_OPTIONS.has(name)) {
      throw argumentError('unknown option.');
    }
    if (values.has(name)) {
      throw argumentError(`--${name} may only be provided once.`);
    }

    let value = inlineValue;
    if (value === undefined) {
      value = argv[index + 1];
      if (value === undefined || value.startsWith('--')) {
        throw argumentError(`--${name} requires a value.`);
      }
      index += 1;
    }
    values.set(name, value.trim());
  }

  const organizationId = values.get('organization-id') || '';
  if (!organizationId) throw argumentError('--organization-id is required.');
  if (!UUID_PATTERN.test(organizationId)) {
    throw argumentError('--organization-id must be a UUID.');
  }

  const email = (values.get('email') || '').toLowerCase();
  if (!EMAIL_PATTERN.test(email) || email.length > 320) {
    throw argumentError('--email must be a valid email address.');
  }

  const expiresValue = values.get('expires-hours');
  if (expiresValue !== undefined && !/^\d+$/.test(expiresValue)) {
    throw argumentError('--expires-hours must be an integer.');
  }
  const expiresHours = expiresValue === undefined ? 24 : Number(expiresValue);
  if (expiresHours < 1 || expiresHours > 72) {
    throw argumentError('--expires-hours must be between 1 and 72.');
  }

  const displayName = values.get('display-name') || '';
  if (displayName.length > 200) {
    throw argumentError('--display-name must not exceed 200 characters.');
  }

  return { organizationId, email, displayName, expiresHours, send };
}

export function validateInviteBaseUrl(value) {
  const redirectTo = typeof value === 'string' ? value.trim() : '';
  let parsed;
  try {
    parsed = new URL(redirectTo);
  } catch {
    throw new FirstAdminCliError('Invite redirect URL must be an exact, absolute accept-invite URL.');
  }

  const isLocalHttp = parsed.protocol === 'http:'
    && (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1');
  const allowedProtocol = parsed.protocol === 'https:' || isLocalHttp;
  const hasCredentials = Boolean(parsed.username || parsed.password)
    || /^[a-z][a-z\d+.-]*:\/\/[^/]*@/i.test(redirectTo);
  const exactPath = parsed.pathname === '/accept-invite';
  const hasQueryOrHash = redirectTo.includes('?') || redirectTo.includes('#');

  if (!allowedProtocol || hasCredentials || !exactPath || hasQueryOrHash) {
    throw new FirstAdminCliError('Invite redirect URL must be an exact, absolute accept-invite URL.');
  }
  return redirectTo;
}

export function buildClaimRedirectUrl(inviteBaseUrl, token) {
  const redirectTo = validateInviteBaseUrl(inviteBaseUrl);
  return `${redirectTo}#claim=${encodeURIComponent(token)}`;
}

export function createInviteOperationMarker() {
  return randomBytes(16).toString('hex');
}

function inviteOperationOwner(user) {
  return user?.user_metadata?.[INVITE_OPERATION_METADATA_KEY]
    ?? user?.app_metadata?.[INVITE_OPERATION_METADATA_KEY];
}

function isOwnedInviteUser(user, inviteOperationMarker) {
  return Boolean(
    user?.id
      && inviteOperationOwner(user) === inviteOperationMarker,
  );
}

function appendFailureDetail(message, detail) {
  return `${message.replace(/\.$/, '')} ${detail}`;
}

async function deleteOwnedUserOrThrow(dependencies, user, failureMessage) {
  if (!user?.id) {
    throw new FirstAdminCliError(failureMessage);
  }
  try {
    await dependencies.gateway.deleteUser(user.id);
  } catch {
    throw new FirstAdminCliError(
      appendFailureDetail(
        failureMessage,
        'and pending Auth user cleanup could not be confirmed.',
      ),
    );
  }
  throw new FirstAdminCliError(failureMessage);
}

async function revokeClaimAndDeleteOwnedUserOrThrow(
  dependencies,
  claimId,
  user,
  revocationReason,
  failureMessage,
) {
  let claimRevoked = false;
  try {
    await dependencies.gateway.revokeClaim(claimId, {
      revoked_at: dependencies.now().toISOString(),
      revocation_reason: revocationReason,
    });
    claimRevoked = true;
  } catch {
    // Auth cleanup must still run when database compensation is uncertain.
  }

  let authUserRemoved = false;
  if (user?.id) {
    try {
      await dependencies.gateway.deleteUser(user.id);
      authUserRemoved = true;
    } catch {
      // Report only the cleanup outcome; provider errors may contain secrets.
    }
  }

  if (claimRevoked && authUserRemoved) {
    throw new FirstAdminCliError(failureMessage);
  }

  const operationFailure = failureMessage.replace(
    /; the new account claim was revoked\.$/,
    '',
  );
  if (!claimRevoked && authUserRemoved) {
    throw new FirstAdminCliError(
      `${operationFailure}; account claim revocation could not be confirmed, but the pending Auth user was removed.`,
    );
  }
  if (claimRevoked) {
    throw new FirstAdminCliError(
      `${operationFailure}; the new account claim was revoked and pending Auth user cleanup could not be confirmed.`,
    );
  }
  throw new FirstAdminCliError(
    `${operationFailure}; account claim revocation and pending Auth user cleanup could not be confirmed.`,
  );
}

export async function provisionFirstAdministrator(options, dependencies) {
  const { gateway } = dependencies;
  let organizationExists;
  try {
    organizationExists = await gateway.organizationExists(options.organizationId);
  } catch {
    throw new FirstAdminCliError('Unable to verify the target organization.');
  }
  if (!organizationExists) {
    throw new FirstAdminCliError('The target organization was not found.');
  }

  let activeMemberCount;
  try {
    activeMemberCount = await gateway.countActiveMembers(options.organizationId);
  } catch {
    throw new FirstAdminCliError('Unable to verify active organization membership.');
  }
  if (activeMemberCount !== 0) {
    throw new FirstAdminCliError('The target organization already has an active member.');
  }

  if (!options.send) {
    return {
      mode: 'dry-run',
      organizationId: options.organizationId,
      expiresHours: options.expiresHours,
      invited: false,
    };
  }

  const startedAt = dependencies.now();
  const expiresAt = new Date(
    startedAt.getTime() + (options.expiresHours * 60 * 60 * 1000),
  ).toISOString();

  let authUserExists;
  try {
    authUserExists = await gateway.authUserExistsByEmail(options.email);
  } catch {
    throw new FirstAdminCliError('Unable to verify whether the first administrator already has an Auth identity.');
  }
  if (authUserExists) {
    throw new FirstAdminCliError('Unable to invite the first administrator.');
  }

  let token;
  let tokenHash;
  let redirectTo;
  let inviteOperationMarker;
  let inviteOptions;
  try {
    token = dependencies.createToken();
    tokenHash = dependencies.hashToken(token);
    redirectTo = buildClaimRedirectUrl(dependencies.inviteBaseUrl, token);
    inviteOperationMarker = dependencies.createInviteOperationMarker();
    inviteOptions = {
      redirectTo,
      data: {
        full_name: options.displayName,
        [INVITE_OPERATION_METADATA_KEY]: inviteOperationMarker,
      },
    };
  } catch {
    throw new FirstAdminCliError('Unable to prepare a secure account claim.');
  }

  let pendingUser;
  try {
    pendingUser = await gateway.generatePendingInviteUser(options.email, inviteOptions);
  } catch {
    throw new FirstAdminCliError('Unable to reserve the pending Auth invitation.');
  }
  if (!isOwnedInviteUser(pendingUser, inviteOperationMarker)) {
    throw new FirstAdminCliError('Unable to verify the pending Auth invitation reservation.');
  }

  let claim;
  try {
    claim = await gateway.insertClaim({
      organization_id: options.organizationId,
      token_hash: tokenHash,
      email: options.email,
      expires_at: expiresAt,
    });
  } catch {
    await deleteOwnedUserOrThrow(
      dependencies,
      pendingUser,
      'Unable to create the account claim.',
    );
  }
  if (!claim?.id) {
    await deleteOwnedUserOrThrow(
      dependencies,
      pendingUser,
      'Unable to create the account claim.',
    );
  }

  let invitedUser;
  try {
    invitedUser = await gateway.sendInviteUser(options.email, inviteOptions);
  } catch {
    await revokeClaimAndDeleteOwnedUserOrThrow(
      dependencies,
      claim.id,
      pendingUser,
      'auth_invite_failed',
      'Auth invitation failed; the new account claim was revoked.',
    );
  }

  if (
    !isOwnedInviteUser(invitedUser, inviteOperationMarker)
    || invitedUser.id !== pendingUser.id
  ) {
    await revokeClaimAndDeleteOwnedUserOrThrow(
      dependencies,
      claim.id,
      pendingUser,
      'auth_user_marker_mismatch',
      'Auth invitation could not be verified; the new account claim was revoked.',
    );
  }

  return {
    mode: 'sent',
    organizationId: options.organizationId,
    claimId: claim.id,
    expiresAt: claim.expiresAt || expiresAt,
    invited: true,
  };
}

export function createSingleUseToken() {
  return randomBytes(32).toString('base64url');
}

export function hashClaimToken(token) {
  return `\\x${createHash('sha256').update(token, 'utf8').digest('hex')}`;
}

export function readFirstAdminRuntimeConfig(env) {
  const supabaseUrl = env.SUPABASE_URL?.trim();
  if (!supabaseUrl) {
    throw new FirstAdminCliError('SUPABASE_URL is required.');
  }

  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY;
  if (!serviceKey) {
    throw new FirstAdminCliError(
      'SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY is required.',
    );
  }

  const configuredRedirect = env.FIRST_ADMIN_INVITE_REDIRECT_URL
    ?? env.USER_INVITE_REDIRECT_URL;
  const inviteBaseUrl = validateInviteBaseUrl(configuredRedirect);
  return { supabaseUrl, serviceKey, inviteBaseUrl };
}

export function createSupabaseFirstAdminGateway(client) {
  return {
    async organizationExists(organizationId) {
      const { data, error } = await client
        .from('organizations')
        .select('id')
        .eq('id', organizationId)
        .maybeSingle();
      if (error) throw error;
      return Boolean(data);
    },

    async countActiveMembers(organizationId) {
      const { count, error } = await client
        .from('organization_members')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('status', 'active');
      if (error || typeof count !== 'number') {
        throw error || new Error('Missing exact membership count.');
      }
      return count;
    },

    async authUserExistsByEmail(email) {
      let page = 1;
      while (true) {
        const { data, error } = await client.auth.admin.listUsers({
          page,
          perPage: AUTH_LIST_USERS_PAGE_SIZE,
        });
        if (error) throw error;
        const users = Array.isArray(data?.users) ? data.users : [];
        if (users.some((user) => typeof user.email === 'string' && user.email.trim().toLowerCase() === email)) {
          return true;
        }
        const nextPage = typeof data?.nextPage === 'number' ? data.nextPage : null;
        if (nextPage) {
          page = nextPage;
          continue;
        }
        if (users.length < AUTH_LIST_USERS_PAGE_SIZE) {
          return false;
        }
        page += 1;
      }
    },

    async insertClaim(payload) {
      const { data, error } = await client
        .from('account_claims')
        .insert(payload)
        .select('id, expires_at')
        .single();
      if (error) throw error;
      return { id: data?.id, expiresAt: data?.expires_at };
    },

    async generatePendingInviteUser(email, options) {
      const { data, error } = await client.auth.admin.generateLink({
        type: 'invite',
        email,
        options,
      });
      if (error) throw error;
      return data?.user;
    },

    async sendInviteUser(email, options) {
      const { data, error } = await client.auth.admin.inviteUserByEmail(email, options);
      if (error) throw error;
      return data?.user;
    },

    async revokeClaim(claimId, revocation) {
      const { data, error } = await client
        .from('account_claims')
        .update(revocation)
        .eq('id', claimId)
        .is('used_at', null)
        .is('revoked_at', null)
        .select('id')
        .maybeSingle();
      if (error || !data) throw error || new Error('Claim was not revoked.');
    },

    async deleteUser(userId) {
      const { error } = await client.auth.admin.deleteUser(userId);
      if (error) throw error;
    },
  };
}

async function createRuntimeGateway({ supabaseUrl, serviceKey }) {
  const { createClient } = await import('@supabase/supabase-js');
  const client = createClient(supabaseUrl, serviceKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
  return createSupabaseFirstAdminGateway(client);
}

export async function runFirstAdminCli({
  argv = process.argv.slice(2),
  env = process.env,
  stdout = process.stdout,
  createGateway = createRuntimeGateway,
  createToken = createSingleUseToken,
  hashToken = hashClaimToken,
  createInviteOperationMarker: createMarker = createInviteOperationMarker,
  now = () => new Date(),
} = {}) {
  const options = parseFirstAdminOptions(argv);
  const config = readFirstAdminRuntimeConfig(env);
  let gateway;
  try {
    gateway = await createGateway({
      supabaseUrl: config.supabaseUrl,
      serviceKey: config.serviceKey,
    });
  } catch {
    throw new FirstAdminCliError('Unable to initialize Supabase administrator access.');
  }

  const result = await provisionFirstAdministrator(options, {
    gateway,
    inviteBaseUrl: config.inviteBaseUrl,
    createToken,
    hashToken,
    createInviteOperationMarker: createMarker,
    now,
  });
  stdout.write(`${JSON.stringify(result)}\n`);
  return result;
}

const isDirectRun = process.argv[1]
  && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  runFirstAdminCli().catch((error) => {
    const message = error instanceof FirstAdminCliError
      ? error.message
      : 'Unexpected first-administrator provisioning failure.';
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
