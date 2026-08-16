import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { loadValidatedSourcePackage, parseMigrationArgs, signMigrationReport } from './cli.mjs';

const cliPath = fileURLToPath(new URL('./cli.mjs', import.meta.url));
const incompleteManifest = fileURLToPath(new URL('./fixtures/manifest.json', import.meta.url));

function runCli(args, { signingKey = '' } = {}) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    encoding: 'utf8',
    env: {
      ...process.env,
      SUPABASE_URL: '',
      SUPABASE_SERVICE_ROLE_KEY: '',
      MIGRATION_REPORT_SIGNING_KEY: signingKey,
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

  it('always signs the report with its integrity field removed', () => {
    const report = { ok: true, expected: { residents: 6 } };
    const signed = signMigrationReport(report, 'release-secret');
    const resigned = signMigrationReport({
      ...report,
      integrity: { algorithm: 'hmac-sha256', signature: '0'.repeat(64) },
    }, 'release-secret');

    expect(resigned).toEqual(signed);
  });

  it('signs equivalent report content independently of object key order', () => {
    const first = signMigrationReport({
      ok: true,
      nested: { residents: 6, houses: ['north', 'south'] },
    }, 'release-secret');
    const second = signMigrationReport({
      nested: { houses: ['north', 'south'], residents: 6 },
      ok: true,
    }, 'release-secret');

    expect(first.integrity.signature).toBe(second.integrity.signature);
  });

  it.each([
    ['confirmed import', ['import', incompleteManifest, '--confirm']],
    ['reconciliation', ['reconcile', incompleteManifest, '--run', '11111111-1111-4111-8111-111111111111']],
    ['confirmed rollback', ['rollback', '--run', '11111111-1111-4111-8111-111111111111', '--confirm']],
  ])('fails closed before %s when the report signing key is absent', (_label, args) => {
    const result = runCli(args);

    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toMatch(/MIGRATION_REPORT_SIGNING_KEY/);
  });

  it.each([
    ['import', [incompleteManifest, '--confirm']],
    ['reconcile', [incompleteManifest, '--run', '11111111-1111-4111-8111-111111111111']],
  ])('requires a passing six-house source package before %s', (command, args) => {
    const result = runCli([command, ...args], { signingKey: 'release-secret' });
    expect(result.stdout).not.toBe('');
    const report = JSON.parse(result.stdout);

    expect(result.status).toBe(1);
    expect(report.ok).toBe(false);
    expect(report.integrity).toMatchObject({ algorithm: 'hmac-sha256' });
    expect(report.blockers).toContain('Exactly six location records are required; found 1.');
    expect(result.stderr).not.toContain('SUPABASE_URL');
    expect(result.stdout).not.toContain('release-secret');
  });
});
