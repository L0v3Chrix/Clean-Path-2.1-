begin;

create function pg_temp.assert_sqlstate(
  statement text,
  expected_state text,
  label text
)
returns void
language plpgsql
as $$
declare
  actual_state text;
begin
  begin
    execute statement;
  exception
    when others then
      get stacked diagnostics actual_state = returned_sqlstate;
      if actual_state = expected_state then
        return;
      end if;
      raise exception '% failed with SQLSTATE %, expected %', label, actual_state, expected_state;
  end;

  raise exception '% unexpectedly succeeded', label;
end;
$$;

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, created_at, updated_at
)
values
  (
    'a1000000-0000-4000-8000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'security-owner@example.test', '', now(), now()
  ),
  (
    'a1000000-0000-4000-8000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'security-second-owner@example.test', '', now(), now()
  ),
  (
    'a1000000-0000-4000-8000-000000000003',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'security-resident@example.test', '', now(), now()
  ),
  (
    'a1000000-0000-4000-8000-000000000004',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'security-exited@example.test', '', now(), now()
  );

insert into public.organizations (id, name, status)
values
  ('b1000000-0000-4000-8000-000000000001', 'Security Invariants Organization', 'active'),
  ('b1000000-0000-4000-8000-000000000002', 'Multi-owner Control Organization', 'active');

insert into public.organization_members (
  id, organization_id, user_id, role, status
)
values
  (
    'c1000000-0000-4000-8000-000000000001',
    'b1000000-0000-4000-8000-000000000001',
    'a1000000-0000-4000-8000-000000000001',
    'owner', 'active'
  ),
  (
    'c1000000-0000-4000-8000-000000000003',
    'b1000000-0000-4000-8000-000000000001',
    'a1000000-0000-4000-8000-000000000003',
    'resident', 'active'
  ),
  (
    'c1000000-0000-4000-8000-000000000004',
    'b1000000-0000-4000-8000-000000000001',
    'a1000000-0000-4000-8000-000000000004',
    'resident', 'active'
  ),
  (
    'c1000000-0000-4000-8000-000000000011',
    'b1000000-0000-4000-8000-000000000002',
    'a1000000-0000-4000-8000-000000000001',
    'owner', 'active'
  ),
  (
    'c1000000-0000-4000-8000-000000000012',
    'b1000000-0000-4000-8000-000000000002',
    'a1000000-0000-4000-8000-000000000002',
    'owner', 'active'
  );

insert into public.residents (
  id, organization_id, user_id, first_name, last_name, status
)
values
  (
    'd1000000-0000-4000-8000-000000000001',
    'b1000000-0000-4000-8000-000000000001',
    'a1000000-0000-4000-8000-000000000003',
    'Active', 'Resident', 'active'
  ),
  (
    'd1000000-0000-4000-8000-000000000002',
    'b1000000-0000-4000-8000-000000000001',
    'a1000000-0000-4000-8000-000000000004',
    'Exited', 'Resident', 'exited'
  );

select pg_temp.assert_sqlstate(
  $sql$
    insert into public.residents (
      organization_id, user_id, first_name, last_name, status
    ) values (
      'b1000000-0000-4000-8000-000000000002',
      'a1000000-0000-4000-8000-000000000003',
      'Duplicate', 'Resident Login', 'active'
    )
  $sql$,
  '23505',
  'one login linked to multiple residents'
);

insert into public.signature_requests (
  id, organization_id, resident_id, title, file_url, status,
  signature_name, signature_data, signed_at
)
values
  (
    'e1000000-0000-4000-8000-000000000001',
    'b1000000-0000-4000-8000-000000000001',
    'd1000000-0000-4000-8000-000000000001',
    'View test', 'b1000000-0000-4000-8000-000000000001/view-test.pdf', 'pending',
    null, null, null
  ),
  (
    'e1000000-0000-4000-8000-000000000002',
    'b1000000-0000-4000-8000-000000000001',
    'd1000000-0000-4000-8000-000000000001',
    'Sign test', 'b1000000-0000-4000-8000-000000000001/sign-test.pdf', 'pending',
    null, null, null
  ),
  (
    'e1000000-0000-4000-8000-000000000003',
    'b1000000-0000-4000-8000-000000000001',
    'd1000000-0000-4000-8000-000000000001',
    'Decline test', 'b1000000-0000-4000-8000-000000000001/decline-test.pdf', 'pending',
    'Legacy Signature', 'data:image/png;base64,TEVHQUNZ', '2025-01-01 00:00:00+00'
  );

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000001', true);

select public.record_data_export(
  'b1000000-0000-4000-8000-000000000001',
  'security_invariants_test',
  1
);
select public.record_application_error(
  'request_error',
  'SecurityInvariantsTest',
  '/security-invariants-test',
  'local-test'
);

reset role;
select set_config('request.jwt.claim.role', '', true);
select set_config('request.jwt.claim.sub', '', true);

do $$
declare
  table_name text;
begin
  foreach table_name in array array['audit_logs', 'application_error_events'] loop
    if exists (
      select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      cross join lateral aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) acl
      where n.nspname = 'public'
        and c.relname = table_name
        and acl.grantee = 'service_role'::regrole::oid
        and acl.privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')
    ) then
      raise exception '% exposes a service_role mutation privilege', table_name;
    end if;
  end loop;
end;
$$;

set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);

select public.record_public_intake_submission_audit(
  'b1000000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000001'
);

do $$
begin
  if not exists (
    select 1
    from public.audit_logs
    where organization_id = 'b1000000-0000-4000-8000-000000000001'
      and resident_id = 'd1000000-0000-4000-8000-000000000001'
      and action = 'public_intake_submitted'
  ) then
    raise exception 'Narrow public-intake audit function did not record its event';
  end if;
end;
$$;

select pg_temp.assert_sqlstate(
  $sql$
    insert into public.audit_logs (organization_id, action, resource_type)
    values (
      'b1000000-0000-4000-8000-000000000001',
      'forged',
      'security_invariants_test'
    )
  $sql$,
  '42501',
  'service_role audit insert'
);
select pg_temp.assert_sqlstate(
  $sql$
    update public.audit_logs
    set description = 'tampered'
    where organization_id = 'b1000000-0000-4000-8000-000000000001'
  $sql$,
  '42501',
  'service_role audit update'
);
select pg_temp.assert_sqlstate(
  $sql$
    delete from public.audit_logs
    where organization_id = 'b1000000-0000-4000-8000-000000000001'
  $sql$,
  '42501',
  'service_role audit delete'
);
select pg_temp.assert_sqlstate(
  'truncate table public.audit_logs',
  '42501',
  'service_role audit truncate'
);

select pg_temp.assert_sqlstate(
  $sql$
    insert into public.application_error_events (
      organization_id, user_id, category, component, route, release
    ) values (
      'b1000000-0000-4000-8000-000000000001',
      'a1000000-0000-4000-8000-000000000001',
      'request_error', 'ForgedError', '/forged', 'local-test'
    )
  $sql$,
  '42501',
  'service_role application error insert'
);
select pg_temp.assert_sqlstate(
  $sql$
    update public.application_error_events
    set component = 'TamperedError'
    where organization_id = 'b1000000-0000-4000-8000-000000000001'
  $sql$,
  '42501',
  'service_role application error update'
);
select pg_temp.assert_sqlstate(
  $sql$
    delete from public.application_error_events
    where organization_id = 'b1000000-0000-4000-8000-000000000001'
  $sql$,
  '42501',
  'service_role application error delete'
);
select pg_temp.assert_sqlstate(
  'truncate table public.application_error_events',
  '42501',
  'service_role application error truncate'
);

reset role;
select set_config('request.jwt.claim.role', '', true);

-- Service-role writes bypass RLS, so these checks prove the table-level owner
-- invariant remains intact beneath the authenticated RPC-only access layer.
set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);
select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000001', true);

select pg_temp.assert_sqlstate(
  $sql$
    update public.organization_members
    set role = 'admin'
    where id = 'c1000000-0000-4000-8000-000000000001'
  $sql$,
  '23514',
  'sole owner demotion'
);
select pg_temp.assert_sqlstate(
  $sql$
    update public.organization_members
    set status = 'inactive'
    where id = 'c1000000-0000-4000-8000-000000000001'
  $sql$,
  '23514',
  'sole owner deactivation'
);
select pg_temp.assert_sqlstate(
  $sql$
    delete from public.organization_members
    where id = 'c1000000-0000-4000-8000-000000000001'
  $sql$,
  '23514',
  'sole owner deletion'
);

delete from public.organization_members
where id = 'c1000000-0000-4000-8000-000000000012';

do $$
begin
  if exists (
    select 1 from public.organization_members
    where id = 'c1000000-0000-4000-8000-000000000012'
  ) then
    raise exception 'An owner was not removable from a multi-owner organization';
  end if;
end;
$$;

reset role;
set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000004', true);

do $$
begin
  if public.is_resident_self(
    'b1000000-0000-4000-8000-000000000001',
    'd1000000-0000-4000-8000-000000000002'
  ) then
    raise exception 'Exited resident retained self-service identity';
  end if;
  if exists (
    select 1
    from public.residents
    where id = 'd1000000-0000-4000-8000-000000000002'
  ) then
    raise exception 'Exited resident retained read access';
  end if;
end;
$$;

select pg_temp.assert_sqlstate(
  $sql$
    insert into public.morning_reflections (
      organization_id, resident_id, log_date, mood, sleep_quality
    ) values (
      'b1000000-0000-4000-8000-000000000001',
      'd1000000-0000-4000-8000-000000000002',
      current_date, 5, 5
    )
  $sql$,
  '42501',
  'exited resident reflection insert'
);

select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000003', true);

select pg_temp.assert_sqlstate(
  $sql$
    select public.record_public_intake_submission_audit(
      'b1000000-0000-4000-8000-000000000001',
      'd1000000-0000-4000-8000-000000000001'
    )
  $sql$,
  '42501',
  'authenticated public intake audit execution'
);

insert into public.morning_reflections (
  id, organization_id, resident_id, log_date, mood, sleep_quality,
  staff_reviewed, created_at, created_by, updated_by
)
values (
  'f1000000-0000-4000-8000-000000000001',
  'b1000000-0000-4000-8000-000000000001',
  'd1000000-0000-4000-8000-000000000001',
  current_date, 7, 6, false,
  '2000-01-01 00:00:00+00',
  'a1000000-0000-4000-8000-000000000001',
  'a1000000-0000-4000-8000-000000000001'
);

do $$
declare
  reflection public.morning_reflections;
begin
  select * into reflection
  from public.morning_reflections
  where id = 'f1000000-0000-4000-8000-000000000001';

  if reflection.created_at < transaction_timestamp() - interval '1 minute'
    or reflection.created_at > clock_timestamp() + interval '1 minute'
    or reflection.created_by is distinct from 'a1000000-0000-4000-8000-000000000003'::uuid
    or reflection.updated_by is distinct from 'a1000000-0000-4000-8000-000000000003'::uuid then
    raise exception 'Resident reflection provenance was not normalized';
  end if;
end;
$$;

select pg_temp.assert_sqlstate(
  $sql$
    insert into public.morning_reflections (
      organization_id, resident_id, log_date, mood, sleep_quality,
      staff_reviewed, reviewed_by, review_notes
    ) values (
      'b1000000-0000-4000-8000-000000000001',
      'd1000000-0000-4000-8000-000000000001',
      current_date + 1, 5, 5,
      true, 'Forged Reviewer', 'Forged review'
    )
  $sql$,
  '42501',
  'resident reflection staff review spoof'
);

select pg_temp.assert_sqlstate(
  $sql$
    update public.signature_requests
    set status = 'viewed', signature_name = 'Contradictory signature'
    where id = 'e1000000-0000-4000-8000-000000000001'
  $sql$,
  '22023',
  'viewed signature contradictory response'
);

update public.signature_requests
set status = 'viewed', viewed_at = '2099-01-01 00:00:00+00'
where id = 'e1000000-0000-4000-8000-000000000001';

do $$
declare
  signature public.signature_requests;
begin
  select * into signature
  from public.signature_requests
  where id = 'e1000000-0000-4000-8000-000000000001';

  if signature.status <> 'viewed'
    or signature.viewed_at < transaction_timestamp() - interval '1 minute'
    or signature.viewed_at > clock_timestamp() + interval '1 minute'
    or signature.signature_name is not null
    or signature.signature_data is not null
    or signature.signed_at is not null
    or signature.decline_reason is not null then
    raise exception 'Viewed signature state was not normalized';
  end if;
end;
$$;

select pg_temp.assert_sqlstate(
  $sql$
    update public.signature_requests
    set status = 'signed',
        signature_name = ' ',
        signature_data = 'data:image/png;base64,QUJD'
    where id = 'e1000000-0000-4000-8000-000000000002'
  $sql$,
  '22023',
  'signed signature blank name'
);
select pg_temp.assert_sqlstate(
  $sql$
    update public.signature_requests
    set status = 'signed',
        signature_name = 'Active Resident',
        signature_data = 'not-an-image'
    where id = 'e1000000-0000-4000-8000-000000000002'
  $sql$,
  '22023',
  'signed signature invalid data'
);
select pg_temp.assert_sqlstate(
  $sql$
    update public.signature_requests
    set status = 'signed',
        signature_name = 'Active Resident',
        signature_data = 'data:image/png;base64,QUJD',
        decline_reason = 'Contradictory decline'
    where id = 'e1000000-0000-4000-8000-000000000002'
  $sql$,
  '22023',
  'signed signature contradictory decline'
);

update public.signature_requests
set status = 'signed',
    signature_name = ' Active Resident ',
    signature_data = 'data:image/png;base64,QUJD',
    signed_at = '2099-01-01 00:00:00+00'
where id = 'e1000000-0000-4000-8000-000000000002';

do $$
declare
  signature public.signature_requests;
begin
  select * into signature
  from public.signature_requests
  where id = 'e1000000-0000-4000-8000-000000000002';

  if signature.status <> 'signed'
    or signature.signature_name <> 'Active Resident'
    or signature.signature_data <> 'data:image/png;base64,QUJD'
    or signature.signed_at < transaction_timestamp() - interval '1 minute'
    or signature.signed_at > clock_timestamp() + interval '1 minute'
    or signature.decline_reason is not null
    or signature.updated_by is distinct from 'a1000000-0000-4000-8000-000000000003'::uuid then
    raise exception 'Signed signature state was not normalized';
  end if;
end;
$$;

select pg_temp.assert_sqlstate(
  $sql$
    update public.signature_requests
    set status = 'declined', decline_reason = 'Changed my mind'
    where id = 'e1000000-0000-4000-8000-000000000002'
  $sql$,
  '23514',
  'terminal signature transition'
);

select pg_temp.assert_sqlstate(
  $sql$
    update public.signature_requests
    set status = 'declined', decline_reason = ' '
    where id = 'e1000000-0000-4000-8000-000000000003'
  $sql$,
  '22023',
  'declined signature blank reason'
);
select pg_temp.assert_sqlstate(
  $sql$
    update public.signature_requests
    set status = 'declined',
        decline_reason = 'I decline',
        signature_name = 'New contradictory signature'
    where id = 'e1000000-0000-4000-8000-000000000003'
  $sql$,
  '22023',
  'declined signature contradictory response'
);

update public.signature_requests
set status = 'declined',
    decline_reason = ' I decline ',
    signed_at = '2099-01-01 00:00:00+00'
where id = 'e1000000-0000-4000-8000-000000000003';

do $$
declare
  signature public.signature_requests;
begin
  select * into signature
  from public.signature_requests
  where id = 'e1000000-0000-4000-8000-000000000003';

  if signature.status <> 'declined'
    or signature.decline_reason <> 'I decline'
    or signature.signature_name is not null
    or signature.signature_data is not null
    or signature.signed_at is not null
    or signature.updated_by is distinct from 'a1000000-0000-4000-8000-000000000003'::uuid then
    raise exception 'Declined signature state was not normalized';
  end if;
end;
$$;

reset role;
select set_config('request.jwt.claim.role', '', true);
select set_config('request.jwt.claim.sub', '', true);

update public.organization_members
set status = 'inactive'
where id = 'c1000000-0000-4000-8000-000000000003';

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000003', true);

do $$
begin
  if exists (
    select 1
    from public.residents
    where id = 'd1000000-0000-4000-8000-000000000001'
  ) then
    raise exception 'Deactivated resident retained read access';
  end if;
end;
$$;

reset role;
select set_config('request.jwt.claim.role', '', true);
select set_config('request.jwt.claim.sub', '', true);

rollback;
