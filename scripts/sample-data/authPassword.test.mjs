import { describe, expect, it } from 'vitest';
import { sampleAuthPassword } from './authPassword.mjs';

describe('sample auth password', () => {
  it('uses an explicit test-only password when configured', () => {
    expect(sampleAuthPassword({ SAMPLE_AUTH_PASSWORD: 'ClearPath-test-only-2026!' }))
      .toBe('ClearPath-test-only-2026!');
  });

  it('rejects short configured passwords', () => {
    expect(() => sampleAuthPassword({ SAMPLE_AUTH_PASSWORD: 'short' })).toThrow(/at least 12/i);
  });

  it('generates a non-deterministic password when no test password is configured', () => {
    expect(sampleAuthPassword({})).not.toBe(sampleAuthPassword({}));
  });
});
