import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { loadValidatedSourcePackage, parseMigrationArgs, signMigrationReport } from './cli.mjs';

const cliPath = fileURLToPath(new URL('./cli.mjs', import.meta.url));
const incompleteManifest = fileURLToPath(new URL('./fixtures/manifest.json', import.meta.url));

function runCli(args) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    encoding: 'utf8',
    env: {
      ...process.env,
      SUPABASE_URL: '',
      SUPABASE_SERVICE_ROLE_KEY: '',
    },
  });
}

describe('migration CLI arguments', () => {
  it('uses the exact in-memory dataset snapshot accepted by package validation', async () => {
    const snapshot = { manifest: { sourceSystem: 'oathtrack' }, entities: {} };
    const validation = {
      ok: true,
      packageSha256: 'a'.repeat(64),
      datasetSha256: 'b'.repeat(64),
      validatedDataset: snapshot,
      blockers: [],
    };

    const loaded = await loadValidatedSourcePackage('/input/manifest.json', async () => validation);

    expect(loaded.dataset).toBe(snapshot);
    expect(loaded.validation).toBe(validation);
  });

  it('parses manifest, run id, confirmation, and report path', () => {
    expect(parseMigrationArgs([
      'import', './input/manifest.json', '--run', 'run-1', '--confirm', '--report', './report.json',
    ])).toEqual({
      command: 'import',
      manifestPath: './input/manifest.json',
      runId: 'run-1',
      confirm: true,
      reportPath: './report.json',
    });
  });

  it('rejects unknown flags', () => {
    expect(() => parseMigrationArgs(['validate', 'manifest.json', '--force'])).toThrow('Unknown option');
  });

  it('parses rollback without requiring a manifest placeholder', () => {
    expect(parseMigrationArgs(['rollback', '--run', 'run-1', '--confirm'])).toEqual({
      command: 'rollback', manifestPath: null, runId: 'run-1', confirm: true, reportPath: null,
    });
  });

  it('adds a verifiable HMAC without exposing the signing key', () => {
    const signed = signMigrationReport({ ok: true, expected: { residents: 6 } }, 'release-secret');
    expect(signed.integrity.algorithm).toBe('hmac-sha256');
    expect(signed.integrity.signature).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(signed)).not.toContain('release-secret');
  });

  it.each([
    ['import', [incompleteManifest, '--confirm']],
    ['reconcile', [incompleteManifest, '--run', '11111111-1111-4111-8111-111111111111']],
  ])('requires a passing six-house source package before %s', (command, args) => {
    const result = runCli([command, ...args]);
    expect(result.stdout).not.toBe('');
    const report = JSON.parse(result.stdout);

    expect(result.status).toBe(1);
    expect(report.ok).toBe(false);
    expect(report.blockers).toContain('Exactly six location records are required; found 1.');
    expect(result.stderr).not.toContain('SUPABASE_URL');
  });
});
