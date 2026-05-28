export function normalizeAuthError(error) {
  if (!error) return { message: 'Unknown authentication error.' };
  return {
    code: error.code,
    status: error.status,
    details: error.details,
    hint: error.hint,
    message: error.message || String(error),
  };
}

export function isMissingSupabaseSetupError(error) {
  const normalized = normalizeAuthError(error);
  const searchable = [
    normalized.code,
    normalized.message,
    normalized.details,
    normalized.hint,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return (
    searchable.includes('pgrst205') ||
    searchable.includes('pgrst202') ||
    searchable.includes('could not find the table') ||
    searchable.includes('could not find the function') ||
    searchable.includes('schema cache') ||
    searchable.includes('organization not found')
  );
}

export function authSetupMessage(error) {
  if (!isMissingSupabaseSetupError(error)) {
    return normalizeAuthError(error).message || 'Unable to sign in.';
  }

  return [
    'You are signed in, but ClearPath database setup is incomplete.',
    'The Supabase schema and seed data need to be applied before real login can open the workspace.',
    'For fake-data testing, use the ClearPath demo mode deployment.',
  ].join(' ');
}
