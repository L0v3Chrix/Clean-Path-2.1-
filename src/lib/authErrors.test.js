import { describe, expect, it } from 'vitest';
import { authSetupMessage, isMissingSupabaseSetupError, normalizeAuthError } from './authErrors';

describe('auth setup error helpers', () => {
  it('detects missing Supabase tables from PostgREST schema-cache errors', () => {
    const error = {
      code: 'PGRST205',
      message: "Could not find the table 'public.organizations' in the schema cache",
    };

    expect(isMissingSupabaseSetupError(error)).toBe(true);
    expect(authSetupMessage(error)).toContain('database setup is incomplete');
  });

  it('detects missing bootstrap RPC functions', () => {
    expect(isMissingSupabaseSetupError({
      code: 'PGRST202',
      message: 'Could not find the function public.bootstrap_organization_owner in the schema cache',
    })).toBe(true);
  });

  it('passes through ordinary auth failures', () => {
    const error = normalizeAuthError({ message: 'Invalid login credentials' });

    expect(isMissingSupabaseSetupError(error)).toBe(false);
    expect(authSetupMessage(error)).toBe('Invalid login credentials');
  });
});
