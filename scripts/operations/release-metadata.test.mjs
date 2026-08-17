import { describe, expect, it } from 'vitest';

let subject = {};
try {
  subject = await import('./release-metadata.mjs');
} catch {
  // The first TDD run intentionally exercises the not-yet-created module.
}

const { createReleaseMetadata, releaseMetadataPlugin } = subject;
const COMMIT = '0123456789abcdef0123456789abcdef01234567';
const PROJECT_REF = 'abcdefghijklmnopqrst';
const BASE_ENV = {
  VITE_SUPABASE_URL: `https://${PROJECT_REF}.supabase.co`,
  VITE_CLEARPATH_DEMO_MODE: 'false',
  VITE_AUTH_BYPASS: 'false',
};

function requireSubject(fn) {
  expect(fn).toBeTypeOf('function');
  return typeof fn === 'function';
}

describe('ClearPath release metadata', () => {
  it('creates the exact public schema for a full Git commit', () => {
    if (!requireSubject(createReleaseMetadata)) return;

    const metadata = createReleaseMetadata({
      commit: COMMIT,
      env: {
        ...BASE_ENV,
        VITE_SUPABASE_PUBLISHABLE_KEY: 'publishable-secret-value',
        SUPABASE_SERVICE_ROLE_KEY: 'service-role-secret-value',
      },
    });

    expect(metadata).toEqual({
      schemaVersion: 1,
      commit: COMMIT,
      demoMode: false,
      authBypass: false,
      projectRef: PROJECT_REF,
    });
    expect(JSON.stringify(metadata)).not.toMatch(/secret|key|service.role/i);
  });

  it('records enabled demo and auth bypass flags as booleans', () => {
    if (!requireSubject(createReleaseMetadata)) return;

    expect(createReleaseMetadata({
      commit: COMMIT,
      env: {
        ...BASE_ENV,
        VITE_CLEARPATH_DEMO_MODE: 'true',
        VITE_AUTH_BYPASS: 'true',
      },
    })).toEqual({
      schemaVersion: 1,
      commit: COMMIT,
      demoMode: true,
      authBypass: true,
      projectRef: PROJECT_REF,
    });
  });

  it.each([
    'not-a-url',
    'http://abcdefghijklmnopqrst.supabase.co',
    'https://example.com',
    'https://abcdefghijklmnopqrst.supabase.co.evil.example',
    'https://short.supabase.co',
    'https://abcdefghijklmnopqrst.supabase.co/rest/v1',
  ])('rejects malformed or non-public Supabase URL %s', (supabaseUrl) => {
    if (!requireSubject(createReleaseMetadata)) return;

    expect(() => createReleaseMetadata({
      commit: COMMIT,
      env: { ...BASE_ENV, VITE_SUPABASE_URL: supabaseUrl },
    })).toThrow(/public Supabase project URL/i);
  });

  it('emits an explicitly unconfigured backend marker when no URL is supplied', () => {
    if (!requireSubject(createReleaseMetadata)) return;

    expect(createReleaseMetadata({
      commit: COMMIT,
      env: { VITE_CLEARPATH_DEMO_MODE: 'false', VITE_AUTH_BYPASS: 'false' },
    })).toEqual({
      schemaVersion: 1,
      commit: COMMIT,
      demoMode: false,
      authBypass: false,
      projectRef: null,
    });
  });

  it('rejects anything other than an exact lowercase 40-character Git commit', () => {
    if (!requireSubject(createReleaseMetadata)) return;

    for (const commit of ['abc123', 'A'.repeat(40), `${COMMIT}0`]) {
      expect(() => createReleaseMetadata({ commit, env: BASE_ENV })).toThrow(/40-character Git commit/i);
    }
  });

  it('emits clearpath-release.json as a Vite root asset without environment secrets', async () => {
    if (!requireSubject(releaseMetadataPlugin)) return;

    const emitted = [];
    const plugin = releaseMetadataPlugin({
      commit: COMMIT,
      env: {
        ...BASE_ENV,
        VITE_SUPABASE_PUBLISHABLE_KEY: 'do-not-emit-this',
      },
    });
    await plugin.generateBundle.call({ emitFile: (asset) => emitted.push(asset) });

    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toMatchObject({ type: 'asset', fileName: 'clearpath-release.json' });
    expect(JSON.parse(emitted[0].source)).toEqual({
      schemaVersion: 1,
      commit: COMMIT,
      demoMode: false,
      authBypass: false,
      projectRef: PROJECT_REF,
    });
    expect(emitted[0].source).not.toContain('do-not-emit-this');
  });
});
