import { describe, expect, it } from 'vitest';
import { verifyMigrationReport } from '../migration/report-integrity.mjs';
import { parseSignEvidenceArgs, signEvidence } from './sign-evidence.mjs';

describe('signed operational evidence', () => {
  it('signs an artifact and invalidates later edits', () => {
    const signed = signEvidence({ artifactType: 'test-evidence', ok: true }, 'test-key');
    expect(verifyMigrationReport(signed, 'test-key')).toBe(true);
    expect(verifyMigrationReport({ ...signed, ok: false }, 'test-key')).toBe(false);
  });

  it('replaces a stale integrity field when resigning', () => {
    const signed = signEvidence({ artifactType: 'test-evidence', integrity: { signature: 'stale' } }, 'test-key');
    expect(verifyMigrationReport(signed, 'test-key')).toBe(true);
  });

  it('requires an input, output, and signing key', () => {
    expect(parseSignEvidenceArgs(['input.json', '--report', 'signed.json'])).toEqual({
      inputPath: 'input.json',
      reportPath: 'signed.json',
      keyEnv: 'CLEARPATH_EVIDENCE_SIGNING_KEY',
    });
    expect(() => parseSignEvidenceArgs(['input.json'])).toThrow(/Usage/);
    expect(() => signEvidence({}, '')).toThrow(/signing key/i);
  });
});
