import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const migrationPath = fileURLToPath(
  new URL('../migrations/20260814170000_six_house_migration_readiness.sql', import.meta.url),
);

function migrationSql() {
  return readFileSync(migrationPath, 'utf8').toLowerCase();
}

describe('six-house migration readiness schema', () => {
  it('defines location assignments and location-aware authorization', () => {
    const sql = migrationSql();

    expect(sql).toContain('create table public.organization_member_locations');
    expect(sql).toContain('create or replace function public.can_access_location');
    expect(sql).toContain('organization_member_locations_select');
  });

  it('defines auditable migration runs and idempotent source records', () => {
    const sql = migrationSql();

    expect(sql).toContain('create table public.migration_runs');
    expect(sql).toContain('create table public.migration_source_records');
    expect(sql).toContain('unique (migration_run_id, source_entity, source_id)');
    expect(sql).toContain('migration_source_records_active_source_unique');
    expect(sql).toContain('source_sha256');
  });

  it('stores only hashed public intake tokens', () => {
    const sql = migrationSql();

    expect(sql).toContain('create table public.public_intake_tokens');
    expect(sql).toContain('token_hash text not null unique');
    expect(sql).not.toMatch(/public_intake_tokens\s*\([^)]*\btoken\s+text/i);
  });

  it('audits sensitive mutations and document access at the database boundary', () => {
    const sql = migrationSql();

    expect(sql).toContain('create or replace function public.audit_sensitive_mutation');
    expect(sql).toContain("'residents','resident_contacts','resident_documents'");
    expect(sql).toContain("table_name || '_audit_sensitive_mutation'");
    expect(sql).toContain('create or replace function public.record_document_access');
    expect(sql).toContain('drop policy if exists "members can read organization storage files"');
  });
});
