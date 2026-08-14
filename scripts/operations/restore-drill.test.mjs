import { describe, expect, it } from 'vitest';
import { buildRestorePlan, sanitizeDatabaseUrl } from './restore-drill.mjs';

describe('restore drill planning', () => {
  it('builds a destructive-target-safe logical backup and restore plan', () => {
    const plan = buildRestorePlan({
      sourceUrl: 'postgresql://source-user:secret@source.example/db',
      restoreUrl: 'postgresql://restore-user:other@restore.example/db',
      dumpPath: '/tmp/clearpath.dump',
    });

    expect(plan.dump.command).toBe('pg_dump');
    expect(plan.restore.command).toBe('pg_restore');
    expect(plan.restore.args).toContain('--clean');
    expect(JSON.stringify(plan)).not.toContain('secret');
    expect(JSON.stringify(plan)).not.toContain('other');
  });

  it('refuses to restore over the source database', () => {
    expect(() => buildRestorePlan({
      sourceUrl: 'postgresql://user:secret@example/db',
      restoreUrl: 'postgresql://user:different@example/db',
      dumpPath: '/tmp/clearpath.dump',
    })).toThrow(/isolated database/i);
  });

  it('removes credentials from recorded database URLs', () => {
    expect(sanitizeDatabaseUrl('postgresql://user:secret@example/db'))
      .toBe('postgresql://example/db');
  });
});
