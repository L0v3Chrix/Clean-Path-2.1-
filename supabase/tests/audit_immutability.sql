begin;

create function pg_temp.assert_insufficient_privilege(statement text, label text)
returns void
language plpgsql
as $$
declare
  denied boolean := false;
begin
  begin
    execute statement;
  exception
    when insufficient_privilege then
      denied := true;
  end;

  if not denied then
    raise exception '% unexpectedly succeeded', label;
  end if;
end;
$$;

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, created_at, updated_at
)
values (
  '91000000-0000-4000-8000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'audit-owner@example.test',
  '',
  now(),
  now()
);

insert into public.organizations (id, name, status)
values (
  '92000000-0000-4000-8000-000000000001',
  'Audit Immutability Test Organization',
  'active'
);

insert into public.organization_members (
  id, organization_id, user_id, role, status
)
values (
  '93000000-0000-4000-8000-000000000001',
  '92000000-0000-4000-8000-000000000001',
  '91000000-0000-4000-8000-000000000001',
  'owner',
  'active'
);

do $$
declare
  table_name text;
begin
  foreach table_name in array array['audit_logs', 'application_error_events'] loop
    if exists (
      select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      cross join lateral aclexplode(
        coalesce(c.relacl, acldefault('r', c.relowner))
      ) acl
      where n.nspname = 'public'
        and c.relname = table_name
        and acl.grantee in (
          0,
          'anon'::regrole::oid,
          'authenticated'::regrole::oid
        )
        and acl.privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')
    ) then
      raise exception '% exposes a direct mutation privilege', table_name;
    end if;

    if exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = table_name
        and cmd in ('ALL', 'INSERT', 'UPDATE', 'DELETE')
    ) then
      raise exception '% retains a mutating RLS policy', table_name;
    end if;

    if not exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = table_name
        and cmd = 'SELECT'
    ) then
      raise exception '% lost its read policy', table_name;
    end if;
  end loop;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claim.sub',
  '91000000-0000-4000-8000-000000000001',
  true
);

select public.record_data_export(
  '92000000-0000-4000-8000-000000000001',
  'audit_immutability_test',
  1
);
select public.record_application_error(
  'request_error',
  'AuditImmutabilityTest',
  '/audit-immutability-test',
  'local-test'
);

do $$
begin
  if not exists (
    select 1
    from public.audit_logs
    where organization_id = '92000000-0000-4000-8000-000000000001'
      and performed_by_id = '91000000-0000-4000-8000-000000000001'
      and action = 'export'
      and resource_type = 'audit_immutability_test'
  ) then
    raise exception 'SECURITY DEFINER audit logger did not append a readable row';
  end if;

  if not exists (
    select 1
    from public.application_error_events
    where organization_id = '92000000-0000-4000-8000-000000000001'
      and user_id = '91000000-0000-4000-8000-000000000001'
      and category = 'request_error'
      and component = 'AuditImmutabilityTest'
  ) then
    raise exception 'SECURITY DEFINER error logger did not append a readable row';
  end if;
end;
$$;

select pg_temp.assert_insufficient_privilege(
  $sql$
    insert into public.audit_logs (
      organization_id, performed_by_id, action, resource_type
    ) values (
      '92000000-0000-4000-8000-000000000001',
      '91000000-0000-4000-8000-000000000001',
      'forged',
      'audit_immutability_test'
    )
  $sql$,
  'authenticated owner audit insert'
);
select pg_temp.assert_insufficient_privilege(
  $sql$
    update public.audit_logs
    set description = 'tampered'
    where organization_id = '92000000-0000-4000-8000-000000000001'
  $sql$,
  'authenticated owner audit update'
);
select pg_temp.assert_insufficient_privilege(
  $sql$
    delete from public.audit_logs
    where organization_id = '92000000-0000-4000-8000-000000000001'
  $sql$,
  'authenticated owner audit delete'
);
select pg_temp.assert_insufficient_privilege(
  'truncate table public.audit_logs',
  'authenticated owner audit truncate'
);

select pg_temp.assert_insufficient_privilege(
  $sql$
    insert into public.application_error_events (
      organization_id, user_id, category, component, route, release
    ) values (
      '92000000-0000-4000-8000-000000000001',
      '91000000-0000-4000-8000-000000000001',
      'request_error',
      'ForgedError',
      '/forged',
      'local-test'
    )
  $sql$,
  'authenticated owner error insert'
);
select pg_temp.assert_insufficient_privilege(
  $sql$
    update public.application_error_events
    set component = 'TamperedError'
    where organization_id = '92000000-0000-4000-8000-000000000001'
  $sql$,
  'authenticated owner error update'
);
select pg_temp.assert_insufficient_privilege(
  $sql$
    delete from public.application_error_events
    where organization_id = '92000000-0000-4000-8000-000000000001'
  $sql$,
  'authenticated owner error delete'
);
select pg_temp.assert_insufficient_privilege(
  'truncate table public.application_error_events',
  'authenticated owner error truncate'
);

reset role;
select set_config('request.jwt.claim.role', '', true);
select set_config('request.jwt.claim.sub', '', true);

rollback;
