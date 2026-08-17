import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const migrationPath = fileURLToPath(new URL('../migrations/20260814180000_operational_readiness.sql', import.meta.url));
const healthPath = fileURLToPath(new URL('../functions/health/index.ts', import.meta.url));

describe('operational readiness controls', () => {
  it('stores privacy-minimized errors through a controlled RPC', () => {
    const sql = readFileSync(migrationPath, 'utf8').toLowerCase();
    expect(sql).toContain('create table public.application_error_events');
    expect(sql).toContain('create or replace function public.record_application_error');
    expect(sql).toContain('revoke insert, update, delete on public.application_error_events from authenticated');
    expect(sql).not.toContain('error_message');
    expect(sql).not.toContain('stack_trace');
  });

  it('records authorized exports in the audit log', () => {
    const sql = readFileSync(migrationPath, 'utf8').toLowerCase();
    expect(sql).toContain('create or replace function public.record_data_export');
    expect(sql).toContain("'export'");
  });

  it('keeps cascading deletion audits foreign-key safe', () => {
    const sql = readFileSync(migrationPath, 'utf8').toLowerCase();
    expect(sql).toContain('create or replace function public.audit_sensitive_mutation');
    expect(sql).toContain('not exists (\n    select 1 from public.residents where id = subject_resident_id');
    expect(sql).toContain('subject_resident_id := null');
  });

  it('defines a database-backed health function without exposing configuration', () => {
    const source = readFileSync(healthPath, 'utf8');
    expect(source).toContain("service: 'clearpath-api'");
    expect(source).toContain("database: 'ok'");
    expect(source).not.toContain('SUPABASE_SERVICE_ROLE_KEY,');
  });
});
