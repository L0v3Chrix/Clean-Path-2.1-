import { describe, expect, it } from 'vitest';
import { parseMigrationArgs, signMigrationReport } from './cli.mjs';

describe('migration CLI arguments', () => {
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
});
