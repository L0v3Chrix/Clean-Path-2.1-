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
    'a2000000-0000-4000-8000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'Claim.Owner@example.test', '', now(), now()
  ),
  (
    'a2000000-0000-4000-8000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'progress-other@example.test', '', now(), now()
  ),
  (
    'a2000000-0000-4000-8000-000000000003',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'unmembered@example.test', '', now(), now()
  ),
  (
    'a2000000-0000-4000-8000-000000000004',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'wrong-email@example.test', '', now(), now()
  ),
  (
    'a2000000-0000-4000-8000-000000000005',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'expired@example.test', '', now(), now()
  ),
  (
    'a2000000-0000-4000-8000-000000000006',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'cross-user@example.test', '', now(), now()
  ),
  (
    'a2000000-0000-4000-8000-000000000007',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'occupied-claim@example.test', '', now(), now()
  ),
  (
    'a3000000-0000-4000-8000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'resident-success@example.test', '', now(), now()
  ),
  (
    'a3000000-0000-4000-8000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'resident-linked@example.test', '', now(), now()
  ),
  (
    'a3000000-0000-4000-8000-000000000003',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'resident-member@example.test', '', now(), now()
  ),
  (
    'a3000000-0000-4000-8000-000000000004',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'resident-already@example.test', '', now(), now()
  ),
  (
    'a3000000-0000-4000-8000-000000000005',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'resident-inactive@example.test', '', now(), now()
  ),
  (
    'a3000000-0000-4000-8000-000000000006',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'resident-cross-org@example.test', '', now(), now()
  ),
  (
    'a3000000-0000-4000-8000-000000000007',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'staff-linked@example.test', '', now(), now()
  ),
  (
    'a3000000-0000-4000-8000-000000000008',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'inactive-staff-member@example.test', '', now(), now()
  ),
  (
    'a3000000-0000-4000-8000-000000000009',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'resident-inviter@example.test', '', now(), now()
  ),
  (
    'a3000000-0000-4000-8000-000000000010',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'unique-control@example.test', '', now(), now()
  ),
  (
    'a3000000-0000-4000-8000-000000000011',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'resident-membership-only@example.test', '', now(), now()
  ),
  (
    'a3000000-0000-4000-8000-000000000012',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'staff-accept@example.test', '', now(), now()
  );

insert into public.organizations (id, name, status)
values
  ('b2000000-0000-4000-8000-000000000001', 'Claim Target', 'active'),
  ('b2000000-0000-4000-8000-000000000002', 'Expired Claim Target', 'active'),
  ('b2000000-0000-4000-8000-000000000003', 'Wrong Email Claim Target', 'active'),
  ('b2000000-0000-4000-8000-000000000004', 'Cross User Claim Target', 'active'),
  ('b2000000-0000-4000-8000-000000000005', 'Occupied Claim Target', 'active'),
  ('b2000000-0000-4000-8000-000000000006', 'Existing Membership Control', 'active'),
  ('b2000000-0000-4000-8000-000000000007', 'Default Administrator Claim Target', 'active'),
  ('b2000000-0000-4000-8000-000000000008', 'Invalid Claim Control', 'active'),
  ('b3000000-0000-4000-8000-000000000001', 'Resident Invitation Organization', 'active'),
  ('b3000000-0000-4000-8000-000000000002', 'Resident Cross Organization', 'active');

insert into public.organization_members (
  id, organization_id, user_id, role, status
)
values
  (
    'd2000000-0000-4000-8000-000000000001',
    'b2000000-0000-4000-8000-000000000006',
    'a2000000-0000-4000-8000-000000000006',
    'staff', 'active'
  ),
  (
    'd3000000-0000-4000-8000-000000000001',
    'b3000000-0000-4000-8000-000000000002',
    'a3000000-0000-4000-8000-000000000003',
    'staff', 'active'
  ),
  (
    'd3000000-0000-4000-8000-000000000002',
    'b3000000-0000-4000-8000-000000000002',
    'a3000000-0000-4000-8000-000000000008',
    'staff', 'inactive'
  ),
  (
    'd3000000-0000-4000-8000-000000000003',
    'b3000000-0000-4000-8000-000000000001',
    'a3000000-0000-4000-8000-000000000009',
    'owner', 'active'
  ),
  (
    'd3000000-0000-4000-8000-000000000004',
    'b3000000-0000-4000-8000-000000000001',
    'a3000000-0000-4000-8000-000000000011',
    'resident', 'active'
  ),
  (
    'd3000000-0000-4000-8000-000000000005',
    'b3000000-0000-4000-8000-000000000001',
    'a3000000-0000-4000-8000-000000000012',
    'staff', 'invited'
  );

update public.organization_members
set display_name = 'Resident Account Owner',
    email = 'resident-inviter@example.test'
where id = 'd3000000-0000-4000-8000-000000000003';

insert into public.account_claims (
  id, organization_id, token_hash, email, initial_role, expires_at
)
values
  (
    'c2000000-0000-4000-8000-000000000001',
    'b2000000-0000-4000-8000-000000000001',
    extensions.digest('valid-claim-token', 'sha256'),
    'claim.owner@EXAMPLE.test',
    'owner',
    now() + interval '1 hour'
  ),
  (
    'c2000000-0000-4000-8000-000000000002',
    'b2000000-0000-4000-8000-000000000002',
    extensions.digest('expired-claim-token', 'sha256'),
    'expired@example.test',
    'owner',
    now() + interval '1 hour'
  ),
  (
    'c2000000-0000-4000-8000-000000000003',
    'b2000000-0000-4000-8000-000000000003',
    extensions.digest('wrong-email-claim-token', 'sha256'),
    'expected-email@example.test',
    'admin',
    now() + interval '1 hour'
  ),
  (
    'c2000000-0000-4000-8000-000000000004',
    'b2000000-0000-4000-8000-000000000004',
    extensions.digest('cross-user-claim-token', 'sha256'),
    'cross-user@example.test',
    'owner',
    now() + interval '1 hour'
  ),
  (
    'c2000000-0000-4000-8000-000000000005',
    'b2000000-0000-4000-8000-000000000005',
    extensions.digest('occupied-org-claim-token', 'sha256'),
    'occupied-claim@example.test',
    'owner',
    now() + interval '1 hour'
  );

insert into public.account_claims (
  id, organization_id, token_hash, email, expires_at
) values (
  'c2000000-0000-4000-8000-000000000006',
  'b2000000-0000-4000-8000-000000000007',
  extensions.digest('default-admin-claim-token', 'sha256'),
  'default-admin@example.test',
  now() + interval '1 hour'
);

update public.account_claims
set expires_at = now() - interval '1 minute'
where id = 'c2000000-0000-4000-8000-000000000002';

insert into public.organization_members (
  id, organization_id, user_id, role, status
) values (
  'd2000000-0000-4000-8000-000000000002',
  'b2000000-0000-4000-8000-000000000005',
  'a2000000-0000-4000-8000-000000000002',
  'owner', 'active'
);

do $$
begin
  if to_regclass('public.user_invitations') is null then
    raise exception 'Server-verified invitation authorization table is missing';
  end if;
  if not coalesce((
    select relrowsecurity
    from pg_class
    where oid = 'public.user_invitations'::regclass
  ), false) then
    raise exception 'Invitation authorization table does not enforce RLS';
  end if;
  if has_table_privilege('anon', 'public.user_invitations', 'select')
    or has_table_privilege('authenticated', 'public.user_invitations', 'select') then
    raise exception 'Invitation authorization records are exposed to clients';
  end if;

  if (
    select column_default
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'account_claims'
      and column_name = 'initial_role'
  ) <> '''admin''::text' or not exists (
    select 1
    from public.account_claims
    where id = 'c2000000-0000-4000-8000-000000000006'
      and initial_role = 'admin'
  ) then
    raise exception 'First-user account claims must default to administrator access';
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'account_claims'
      and roles && array['anon'::name, 'authenticated'::name]
  ) then
    raise exception 'Account claims expose an anon or authenticated policy';
  end if;

  if not has_table_privilege('service_role', 'public.account_claims', 'select')
    or not has_table_privilege('service_role', 'public.account_claims', 'insert')
    or not has_table_privilege('service_role', 'public.account_claims', 'update')
    or has_table_privilege('anon', 'public.account_claims', 'select')
    or has_table_privilege('authenticated', 'public.account_claims', 'select')
    or has_table_privilege('authenticated', 'public.account_claims', 'insert') then
    raise exception 'Account claim table grants are not service-only';
  end if;

  if not has_table_privilege('authenticated', 'public.user_onboarding_progress', 'select')
    or not has_table_privilege('authenticated', 'public.user_onboarding_progress', 'insert')
    or not has_table_privilege('authenticated', 'public.user_onboarding_progress', 'update')
    or has_table_privilege('authenticated', 'public.user_onboarding_progress', 'delete')
    or has_table_privilege('anon', 'public.user_onboarding_progress', 'select') then
    raise exception 'Onboarding progress grants are not fail closed';
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'user_onboarding_progress'
      and cmd in ('ALL', 'DELETE')
  ) then
    raise exception 'Onboarding progress exposes a delete policy';
  end if;

  if has_function_privilege(
      'authenticated',
      'public.bootstrap_organization_owner(uuid,text,text)',
      'execute'
    )
    or not has_function_privilege(
      'authenticated',
      'public.claim_pre_authorized_account(text,text)',
      'execute'
    )
    or has_function_privilege(
      'anon',
      'public.claim_pre_authorized_account(text,text)',
      'execute'
    )
    or has_function_privilege(
      'service_role',
      'public.claim_pre_authorized_account(text,text)',
      'execute'
    ) then
    raise exception 'Account claim function grants are incorrect';
  end if;

  if to_regprocedure('public.register_pre_authorized_invitation(uuid,uuid,uuid,uuid,text,uuid,uuid,text)') is null
    or to_regprocedure('public.accept_pre_authorized_invitation(text)') is null
    or to_regprocedure('public.revoke_pre_authorized_invitation(uuid,uuid)') is null then
    raise exception 'Invitation lifecycle RPCs are missing';
  end if;

  if not has_function_privilege(
      'service_role',
      'public.finalize_resident_invitation(uuid,uuid,uuid,text,uuid,uuid,text)',
      'execute'
    )
    or has_function_privilege(
      'anon',
      'public.finalize_resident_invitation(uuid,uuid,uuid,text,uuid,uuid,text)',
      'execute'
    )
    or has_function_privilege(
      'authenticated',
      'public.finalize_resident_invitation(uuid,uuid,uuid,text,uuid,uuid,text)',
      'execute'
    )
    or not has_function_privilege(
      'authenticated',
      'public.accept_pre_authorized_invitation(text)',
      'execute'
    )
    or has_function_privilege('anon', 'public.accept_pre_authorized_invitation(text)', 'execute')
    or has_function_privilege('service_role', 'public.accept_pre_authorized_invitation(text)', 'execute')
    or not has_function_privilege(
      'service_role',
      'public.revoke_pre_authorized_invitation(uuid,uuid)',
      'execute'
    )
    or has_function_privilege(
      'authenticated',
      'public.revoke_pre_authorized_invitation(uuid,uuid)',
      'execute'
    ) then
    raise exception 'Resident invitation function grants are incorrect';
  end if;

  if (
    select proargnames
    from pg_proc
    where oid = 'public.claim_pre_authorized_account(text,text)'::regprocedure
  ) <> array['p_token', 'p_display_name']::text[] then
    raise exception 'Account claim RPC argument names do not match the client contract';
  end if;

  if (
    select proargnames
    from pg_proc
    where oid = 'public.finalize_resident_invitation(uuid,uuid,uuid,text,uuid,uuid,text)'::regprocedure
  ) <> array[
    'p_organization_id', 'p_resident_id', 'p_user_id', 'p_email',
    'p_invited_by_user_id', 'p_operation_marker', 'p_activation_token'
  ]::text[] then
    raise exception 'Resident invitation RPC argument names do not match the Edge Function contract';
  end if;
end;
$$;

select pg_temp.assert_sqlstate(
  $sql$
    insert into public.account_claims (
      organization_id, token_hash, email, initial_role, expires_at
    ) values (
      'b2000000-0000-4000-8000-000000000008',
      extensions.digest('invalid-role-token', 'sha256'),
      'invalid-role@example.test',
      'staff',
      now() + interval '1 hour'
    )
  $sql$,
  '23514',
  'account claim invalid initial role'
);

select pg_temp.assert_sqlstate(
  $sql$
    insert into public.account_claims (
      organization_id, token_hash, email, expires_at
    ) values (
      'b2000000-0000-4000-8000-000000000007',
      extensions.digest('second-pending-token', 'sha256'),
      'second-pending@example.test',
      now() + interval '1 hour'
    )
  $sql$,
  '23505',
  'second pending first-administrator claim'
);

insert into public.account_claims (
  id, organization_id, token_hash, email, expires_at
) values (
  'c2000000-0000-4000-8000-000000000007',
  'b2000000-0000-4000-8000-000000000002',
  extensions.digest('replacement-claim-token', 'sha256'),
  'replacement@example.test',
  now() + interval '1 hour'
);

do $$
begin
  if not exists (
    select 1
    from public.account_claims
    where id = 'c2000000-0000-4000-8000-000000000002'
      and revoked_at is not null
      and revocation_reason = 'expired_replaced'
  ) or not exists (
    select 1
    from public.account_claims
    where id = 'c2000000-0000-4000-8000-000000000007'
      and used_at is null
      and revoked_at is null
  ) then
    raise exception 'Expired pending claims were not safely replaced';
  end if;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'a2000000-0000-4000-8000-000000000001', true);
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'role', 'authenticated',
    'sub', 'a2000000-0000-4000-8000-000000000001',
    'email', 'Claim.Owner@example.test'
  )::text,
  true
);

do $$
declare
  result jsonb;
begin
  result := public.claim_pre_authorized_account('valid-claim-token', 'Claim Owner');

  if result ->> 'organizationId' <> 'b2000000-0000-4000-8000-000000000001'
    or result ->> 'claimId' <> 'c2000000-0000-4000-8000-000000000001'
    or nullif(result ->> 'membershipId', '') is null
    or result ->> 'role' <> 'owner' then
    raise exception 'Valid account claim did not return useful identifiers';
  end if;

  if not exists (
    select 1
    from public.organization_members
    where id = (result ->> 'membershipId')::uuid
      and organization_id = 'b2000000-0000-4000-8000-000000000001'
      and user_id = 'a2000000-0000-4000-8000-000000000001'
      and role = 'owner'
      and status = 'active'
      and display_name = 'Claim Owner'
      and lower(email) = 'claim.owner@example.test'
  ) then
    raise exception 'Valid account claim did not create its explicit owner membership';
  end if;

  if not exists (
    select 1
    from public.audit_logs
    where organization_id = 'b2000000-0000-4000-8000-000000000001'
      and performed_by_id = 'a2000000-0000-4000-8000-000000000001'
      and action = 'account_claimed'
      and resource_type = 'organization_members'
      and resource_id = (result ->> 'membershipId')::uuid
  ) then
    raise exception 'Valid account claim was not immutably audited';
  end if;
end;
$$;

do $$
declare
  first_membership_id uuid;
  replay_result jsonb;
begin
  select id into first_membership_id
  from public.organization_members
  where organization_id = 'b2000000-0000-4000-8000-000000000001'
    and user_id = 'a2000000-0000-4000-8000-000000000001'
    and status = 'active';

  replay_result := public.claim_pre_authorized_account(
    'valid-claim-token',
    'Claim Owner Again'
  );

  if (replay_result ->> 'membershipId')::uuid <> first_membership_id
    or replay_result ->> 'claimId' <> 'c2000000-0000-4000-8000-000000000001'
    or replay_result ->> 'role' <> 'owner'
    or (
      select count(*)
      from public.organization_members
      where organization_id = 'b2000000-0000-4000-8000-000000000001'
        and user_id = 'a2000000-0000-4000-8000-000000000001'
    ) <> 1
    or (
      select count(*)
      from public.audit_logs
      where organization_id = 'b2000000-0000-4000-8000-000000000001'
        and performed_by_id = 'a2000000-0000-4000-8000-000000000001'
        and action = 'account_claimed'
    ) <> 1 then
    raise exception 'Same-user account claim replay was not idempotent';
  end if;
end;
$$;

select pg_temp.assert_sqlstate(
  $$select public.bootstrap_organization_owner(
    'b2000000-0000-4000-8000-000000000002',
    'Legacy Owner',
    'legacy-owner@example.test'
  )$$,
  '42501',
  'authenticated legacy owner bootstrap execution'
);

reset role;
select set_config('request.jwt.claim.role', '', true);
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '', true);

do $$
begin
  if not exists (
    select 1
    from public.account_claims
    where id = 'c2000000-0000-4000-8000-000000000001'
      and octet_length(token_hash) = 32
      and used_at is not null
      and used_by_user_id = 'a2000000-0000-4000-8000-000000000001'
  ) then
    raise exception 'Claim token was not stored and consumed as a SHA-256 digest';
  end if;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'a2000000-0000-4000-8000-000000000004', true);
select set_config(
  'request.jwt.claims',
  '{"role":"authenticated","sub":"a2000000-0000-4000-8000-000000000004","email":"wrong-email@example.test"}',
  true
);
select pg_temp.assert_sqlstate(
  $$select public.claim_pre_authorized_account('wrong-email-claim-token', 'Wrong Email')$$,
  '42501',
  'account claim wrong JWT email'
);

reset role;
select set_config('request.jwt.claim.role', '', true);
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '', true);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'a2000000-0000-4000-8000-000000000005', true);
select set_config(
  'request.jwt.claims',
  '{"role":"authenticated","sub":"a2000000-0000-4000-8000-000000000005","email":"expired@example.test"}',
  true
);
select pg_temp.assert_sqlstate(
  $$select public.claim_pre_authorized_account('expired-claim-token', 'Expired Claim')$$,
  '22023',
  'expired account claim'
);

reset role;
select set_config('request.jwt.claim.role', '', true);
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '', true);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'a2000000-0000-4000-8000-000000000006', true);
select set_config(
  'request.jwt.claims',
  '{"role":"authenticated","sub":"a2000000-0000-4000-8000-000000000006","email":"cross-user@example.test"}',
  true
);
select pg_temp.assert_sqlstate(
  $$select public.claim_pre_authorized_account('cross-user-claim-token', 'Cross User')$$,
  '42501',
  'account claim by user with an active membership'
);

reset role;
select set_config('request.jwt.claim.role', '', true);
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '', true);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'a2000000-0000-4000-8000-000000000007', true);
select set_config(
  'request.jwt.claims',
  '{"role":"authenticated","sub":"a2000000-0000-4000-8000-000000000007","email":"occupied-claim@example.test"}',
  true
);
select pg_temp.assert_sqlstate(
  $$select public.claim_pre_authorized_account('occupied-org-claim-token', 'Occupied Claim')$$,
  '42501',
  'account claim for an organization with active members'
);

reset role;
select set_config('request.jwt.claim.role', '', true);
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '', true);

insert into public.organization_members (
  id, organization_id, user_id, role, status
)
values (
  'd2000000-0000-4000-8000-000000000003',
  'b2000000-0000-4000-8000-000000000001',
  'a2000000-0000-4000-8000-000000000002',
  'staff', 'active'
);

insert into public.user_onboarding_progress (
  organization_id, user_id, flow, version, status, current_step, completed_steps
)
values
  (
    'b2000000-0000-4000-8000-000000000001',
    'a2000000-0000-4000-8000-000000000002',
    'account_setup', 1, 'in_progress', 'profile', array['welcome']
  ),
  (
    'b2000000-0000-4000-8000-000000000003',
    'a2000000-0000-4000-8000-000000000003',
    'account_setup', 1, 'completed', null, array['welcome', 'profile']
  );

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'a2000000-0000-4000-8000-000000000001', true);
select set_config(
  'request.jwt.claims',
  '{"role":"authenticated","sub":"a2000000-0000-4000-8000-000000000001","email":"Claim.Owner@example.test"}',
  true
);

insert into public.user_onboarding_progress (
  organization_id, user_id, flow, version, status, current_step, completed_steps,
  created_at, updated_at
)
values (
  'b2000000-0000-4000-8000-000000000001',
  'a2000000-0000-4000-8000-000000000001',
  'account_setup', 1, 'pending', 'welcome', '{}',
  '2000-01-01 00:00:00+00', '2000-01-01 00:00:00+00'
);

do $$
begin
  if (select count(*) from public.user_onboarding_progress) <> 1 then
    raise exception 'A user can see onboarding progress belonging to another member';
  end if;
end;
$$;

update public.user_onboarding_progress
set status = 'in_progress',
    current_step = 'profile',
    completed_steps = array['welcome']
where organization_id = 'b2000000-0000-4000-8000-000000000001'
  and user_id = 'a2000000-0000-4000-8000-000000000001'
  and flow = 'account_setup'
  and version = 1;

update public.user_onboarding_progress
set current_step = 'tampered'
where organization_id = 'b2000000-0000-4000-8000-000000000001'
  and user_id = 'a2000000-0000-4000-8000-000000000002'
  and flow = 'account_setup'
  and version = 1;

select pg_temp.assert_sqlstate(
  $sql$
    insert into public.user_onboarding_progress (
      organization_id, user_id, flow, version, status
    ) values (
      'b2000000-0000-4000-8000-000000000001',
      'a2000000-0000-4000-8000-000000000002',
      'cross_user_insert', 1, 'pending'
    )
  $sql$,
  '42501',
  'cross-user onboarding insert'
);

select pg_temp.assert_sqlstate(
  $sql$
    update public.user_onboarding_progress
    set user_id = 'a2000000-0000-4000-8000-000000000002'
    where organization_id = 'b2000000-0000-4000-8000-000000000001'
      and user_id = 'a2000000-0000-4000-8000-000000000001'
      and flow = 'account_setup'
      and version = 1
  $sql$,
  '42501',
  'onboarding ownership reassignment'
);

select pg_temp.assert_sqlstate(
  $sql$
    delete from public.user_onboarding_progress
    where organization_id = 'b2000000-0000-4000-8000-000000000001'
      and user_id = 'a2000000-0000-4000-8000-000000000001'
  $sql$,
  '42501',
  'onboarding progress deletion'
);

reset role;
select set_config('request.jwt.claim.role', '', true);
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '', true);

do $$
declare
  owner_progress public.user_onboarding_progress;
begin
  select * into owner_progress
  from public.user_onboarding_progress
  where organization_id = 'b2000000-0000-4000-8000-000000000001'
    and user_id = 'a2000000-0000-4000-8000-000000000001'
    and flow = 'account_setup'
    and version = 1;

  if owner_progress.status <> 'in_progress'
    or owner_progress.current_step <> 'profile'
    or owner_progress.completed_steps <> array['welcome']
    or owner_progress.updated_at <= owner_progress.created_at then
    raise exception 'Own onboarding progress did not update through the standard timestamp trigger';
  end if;

  if exists (
    select 1
    from public.user_onboarding_progress
    where organization_id = 'b2000000-0000-4000-8000-000000000001'
      and user_id = 'a2000000-0000-4000-8000-000000000002'
      and current_step = 'tampered'
  ) then
    raise exception 'Cross-user onboarding update changed another member row';
  end if;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'a2000000-0000-4000-8000-000000000003', true);
select set_config(
  'request.jwt.claims',
  '{"role":"authenticated","sub":"a2000000-0000-4000-8000-000000000003","email":"unmembered@example.test"}',
  true
);

do $$
begin
  if public.is_org_member('b2000000-0000-4000-8000-000000000003') then
    raise exception 'Onboarding progress granted organization authorization';
  end if;
  if exists (select 1 from public.user_onboarding_progress) then
    raise exception 'Onboarding progress is visible without an active membership';
  end if;
end;
$$;

reset role;
select set_config('request.jwt.claim.role', '', true);
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '', true);

insert into public.residents (
  id, organization_id, user_id, first_name, last_name, email, status
)
values
  (
    'e3000000-0000-4000-8000-000000000001',
    'b3000000-0000-4000-8000-000000000001',
    null, 'Invite', 'Success', 'resident-success@example.test', 'active'
  ),
  (
    'e3000000-0000-4000-8000-000000000002',
    'b3000000-0000-4000-8000-000000000001',
    null, 'Invite', 'Inactive', null, 'exited'
  ),
  (
    'e3000000-0000-4000-8000-000000000003',
    'b3000000-0000-4000-8000-000000000001',
    'a3000000-0000-4000-8000-000000000002', 'Existing', 'Link',
    'resident-linked@example.test', 'active'
  ),
  (
    'e3000000-0000-4000-8000-000000000004',
    'b3000000-0000-4000-8000-000000000001',
    null, 'Second', 'Link Target', 'resident-linked@example.test', 'active'
  ),
  (
    'e3000000-0000-4000-8000-000000000005',
    'b3000000-0000-4000-8000-000000000001',
    'a3000000-0000-4000-8000-000000000004', 'Already', 'Linked',
    'resident-already@example.test', 'active'
  ),
  (
    'e3000000-0000-4000-8000-000000000006',
    'b3000000-0000-4000-8000-000000000002',
    null, 'Cross', 'Organization', null, 'active'
  ),
  (
    'e3000000-0000-4000-8000-000000000007',
    'b3000000-0000-4000-8000-000000000001',
    null, 'Member', 'Target', 'resident-member@example.test', 'active'
  ),
  (
    'e3000000-0000-4000-8000-000000000008',
    'b3000000-0000-4000-8000-000000000001',
    null, 'Unique', 'Control', 'unique-control@example.test', 'active'
  ),
  (
    'e3000000-0000-4000-8000-000000000009',
    'b3000000-0000-4000-8000-000000000001',
    null, 'Staff', 'Conflict', 'staff-linked@example.test', 'active'
  ),
  (
    'e3000000-0000-4000-8000-000000000010',
    'b3000000-0000-4000-8000-000000000001',
    null, 'Membership', 'Conflict', 'inactive-staff-member@example.test', 'active'
  );

insert into public.staff_profiles (
  id, organization_id, user_id, first_name, last_name, email, role, status
)
values (
  'f3000000-0000-4000-8000-000000000001',
  'b3000000-0000-4000-8000-000000000001',
  'a3000000-0000-4000-8000-000000000007',
  'Staff', 'Linked', 'staff-linked@example.test', 'staff', 'active'
), (
  'f3000000-0000-4000-8000-000000000002',
  'b3000000-0000-4000-8000-000000000001',
  'a3000000-0000-4000-8000-000000000012',
  'Staff', 'Accept', 'staff-accept@example.test', 'staff', 'inactive'
);

update auth.users
set raw_user_meta_data = jsonb_build_object(
  'invite_operation_id',
  case id
    when 'a3000000-0000-4000-8000-000000000001'::uuid then '93000000-0000-4000-8000-000000000001'
    when 'a3000000-0000-4000-8000-000000000002'::uuid then '93000000-0000-4000-8000-000000000002'
    when 'a3000000-0000-4000-8000-000000000003'::uuid then '93000000-0000-4000-8000-000000000003'
    when 'a3000000-0000-4000-8000-000000000005'::uuid then '93000000-0000-4000-8000-000000000005'
    when 'a3000000-0000-4000-8000-000000000006'::uuid then '93000000-0000-4000-8000-000000000006'
    when 'a3000000-0000-4000-8000-000000000007'::uuid then '93000000-0000-4000-8000-000000000007'
    when 'a3000000-0000-4000-8000-000000000008'::uuid then '93000000-0000-4000-8000-000000000008'
    when 'a3000000-0000-4000-8000-000000000010'::uuid then '93000000-0000-4000-8000-000000000010'
    when 'a3000000-0000-4000-8000-000000000012'::uuid then '93000000-0000-4000-8000-000000000011'
  end
)
where id in (
  'a3000000-0000-4000-8000-000000000001',
  'a3000000-0000-4000-8000-000000000002',
  'a3000000-0000-4000-8000-000000000003',
  'a3000000-0000-4000-8000-000000000005',
  'a3000000-0000-4000-8000-000000000006',
  'a3000000-0000-4000-8000-000000000007',
  'a3000000-0000-4000-8000-000000000008',
  'a3000000-0000-4000-8000-000000000010',
  'a3000000-0000-4000-8000-000000000012'
);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'a2000000-0000-4000-8000-000000000001', true);
select set_config(
  'request.jwt.claims',
  '{"role":"authenticated","sub":"a2000000-0000-4000-8000-000000000001","email":"Claim.Owner@example.test"}',
  true
);
select pg_temp.assert_sqlstate(
  $$select public.finalize_resident_invitation(
    'b3000000-0000-4000-8000-000000000001',
    'e3000000-0000-4000-8000-000000000008',
    'a3000000-0000-4000-8000-000000000006',
    'wrong-resident-email@example.test',
    'a3000000-0000-4000-8000-000000000009',
    '93000000-0000-4000-8000-000000000006',
    'wrong-email-activation'
  )$$,
  '42501',
  'resident invitation email mismatch'
);

select pg_temp.assert_sqlstate(
  $$select public.finalize_resident_invitation(
    'b3000000-0000-4000-8000-000000000001',
    'e3000000-0000-4000-8000-000000000001',
    'a3000000-0000-4000-8000-000000000001',
    'resident-success@example.test',
    'a3000000-0000-4000-8000-000000000009',
    '93000000-0000-4000-8000-000000000001',
    'resident-success-activation'
  )$$,
  '42501',
  'authenticated resident invitation finalization'
);

reset role;
select set_config('request.jwt.claim.role', '', true);
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '', true);

set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{"role":"service_role"}', true);

select public.register_pre_authorized_invitation(
  'b3000000-0000-4000-8000-000000000001',
  'a3000000-0000-4000-8000-000000000012',
  'd3000000-0000-4000-8000-000000000005',
  'f3000000-0000-4000-8000-000000000002',
  'staff-accept@example.test',
  'a3000000-0000-4000-8000-000000000009',
  '93000000-0000-4000-8000-000000000011',
  'staff-success-activation'
);

reset role;
select set_config('request.jwt.claim.role', '', true);
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '', true);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'a3000000-0000-4000-8000-000000000012', true);
select set_config(
  'request.jwt.claims',
  '{"role":"authenticated","sub":"a3000000-0000-4000-8000-000000000012","email":"staff-accept@example.test"}',
  true
);

do $$
declare
  result jsonb;
  replay_result jsonb;
begin
  if public.is_org_member('b3000000-0000-4000-8000-000000000001') then
    raise exception 'Pending staff invitation granted organization access';
  end if;

  begin
    perform public.accept_pre_authorized_invitation('recovery-session-has-no-secret');
    raise exception 'Password recovery activated pending staff access without the invite secret';
  exception
    when sqlstate '22023' then null;
  end;

  result := public.accept_pre_authorized_invitation('staff-success-activation');
  replay_result := public.accept_pre_authorized_invitation('staff-success-activation');

  if result ->> 'role' <> 'staff'
    or result ->> 'alreadyAccepted' <> 'false'
    or replay_result ->> 'alreadyAccepted' <> 'true'
    or replay_result ->> 'invitationId' <> result ->> 'invitationId' then
    raise exception 'Staff invitation acceptance was not atomic and idempotent';
  end if;

  if not public.is_org_member('b3000000-0000-4000-8000-000000000001')
    or not exists (
      select 1 from public.staff_profiles
      where id = 'f3000000-0000-4000-8000-000000000002'
        and user_id = 'a3000000-0000-4000-8000-000000000012'
        and status = 'active'
    ) then
    raise exception 'Staff invitation acceptance did not activate exact access';
  end if;
end;
$$;

reset role;
select set_config('request.jwt.claim.role', '', true);
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '', true);

set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{"role":"service_role"}', true);

do $$
declare
  invitation_id uuid;
begin
  select id into invitation_id
  from public.user_invitations
  where user_id = 'a3000000-0000-4000-8000-000000000012'
    and staff_profile_id = 'f3000000-0000-4000-8000-000000000002'
    and principal_type = 'staff'
    and status = 'accepted';

  if invitation_id is null or not exists (
    select 1 from public.audit_logs
    where organization_id = 'b3000000-0000-4000-8000-000000000001'
      and performed_by_id = 'a3000000-0000-4000-8000-000000000012'
      and action = 'invitation_accepted'
      and resource_id = invitation_id
  ) then
    raise exception 'Staff invitation acceptance was not recorded and audited';
  end if;
end;
$$;

select pg_temp.assert_sqlstate(
  $$select public.finalize_resident_invitation(
    'b3000000-0000-4000-8000-000000000001',
    'e3000000-0000-4000-8000-000000000008',
    'a3000000-0000-4000-8000-000000000010',
    'unique-control@example.test',
    'a3000000-0000-4000-8000-000000000003',
    '93000000-0000-4000-8000-000000000010',
    'control-activation'
  )$$,
  '42501',
  'resident invitation by an unauthorized organization member'
);

do $$
declare
  result jsonb;
  retry_result jsonb;
begin
  result := public.finalize_resident_invitation(
    'b3000000-0000-4000-8000-000000000001',
    'e3000000-0000-4000-8000-000000000001',
    'a3000000-0000-4000-8000-000000000001',
    'resident-success@example.test',
    'a3000000-0000-4000-8000-000000000009',
    '93000000-0000-4000-8000-000000000001',
    'resident-success-activation'
  );

  retry_result := public.finalize_resident_invitation(
    'b3000000-0000-4000-8000-000000000001',
    'e3000000-0000-4000-8000-000000000001',
    'a3000000-0000-4000-8000-000000000001',
    'resident-success@example.test',
    'a3000000-0000-4000-8000-000000000009',
    '93000000-0000-4000-8000-000000000001',
    'resident-success-activation'
  );

  if result ->> 'organizationId' <> 'b3000000-0000-4000-8000-000000000001'
    or result ->> 'residentId' <> 'e3000000-0000-4000-8000-000000000001'
    or result ->> 'userId' <> 'a3000000-0000-4000-8000-000000000001'
    or nullif(result ->> 'membershipId', '') is null
    or nullif(result ->> 'invitationId', '') is null then
    raise exception 'Resident invitation did not return useful identifiers';
  end if;

  if retry_result ->> 'membershipId' <> result ->> 'membershipId'
    or retry_result ->> 'invitationId' <> result ->> 'invitationId'
    or retry_result ->> 'alreadyFinalized' <> 'true' then
    raise exception 'Resident invitation retry was not idempotent';
  end if;
end;
$$;

select pg_temp.assert_sqlstate(
  $$select public.finalize_resident_invitation(
    'b3000000-0000-4000-8000-000000000001',
    'e3000000-0000-4000-8000-000000000002',
    'a3000000-0000-4000-8000-000000000005',
    'resident-inactive@example.test',
    'a3000000-0000-4000-8000-000000000009',
    '93000000-0000-4000-8000-000000000005',
    'inactive-activation'
  )$$,
  '22023',
  'inactive resident invitation'
);

select pg_temp.assert_sqlstate(
  $$select public.finalize_resident_invitation(
    'b3000000-0000-4000-8000-000000000001',
    'e3000000-0000-4000-8000-000000000005',
    'a3000000-0000-4000-8000-000000000006',
    'resident-cross-org@example.test',
    'a3000000-0000-4000-8000-000000000009',
    '93000000-0000-4000-8000-000000000006',
    'already-linked-activation'
  )$$,
  '23505',
  'already-linked resident invitation'
);

select pg_temp.assert_sqlstate(
  $$select public.finalize_resident_invitation(
    'b3000000-0000-4000-8000-000000000001',
    'e3000000-0000-4000-8000-000000000006',
    'a3000000-0000-4000-8000-000000000006',
    'resident-cross-org@example.test',
    'a3000000-0000-4000-8000-000000000009',
    '93000000-0000-4000-8000-000000000006',
    'cross-org-activation'
  )$$,
  '23503',
  'cross-organization resident invitation'
);

select pg_temp.assert_sqlstate(
  $$select public.finalize_resident_invitation(
    'b3000000-0000-4000-8000-000000000001',
    'e3000000-0000-4000-8000-000000000004',
    'a3000000-0000-4000-8000-000000000002',
    'resident-linked@example.test',
    'a3000000-0000-4000-8000-000000000009',
    '93000000-0000-4000-8000-000000000002',
    'duplicate-resident-activation'
  )$$,
  '23505',
  'Auth user linked to another resident'
);

select pg_temp.assert_sqlstate(
  $$select public.finalize_resident_invitation(
    'b3000000-0000-4000-8000-000000000001',
    'e3000000-0000-4000-8000-000000000007',
    'a3000000-0000-4000-8000-000000000003',
    'resident-member@example.test',
    'a3000000-0000-4000-8000-000000000009',
    '93000000-0000-4000-8000-000000000003',
    'member-activation'
  )$$,
  '23505',
  'Auth user with an active organization membership'
);

select pg_temp.assert_sqlstate(
  $$select public.finalize_resident_invitation(
    'b3000000-0000-4000-8000-000000000001',
    'e3000000-0000-4000-8000-000000000009',
    'a3000000-0000-4000-8000-000000000007',
    'staff-linked@example.test',
    'a3000000-0000-4000-8000-000000000009',
    '93000000-0000-4000-8000-000000000007',
    'staff-conflict-activation'
  )$$,
  '23514',
  'staff-linked Auth user resident finalization'
);

select pg_temp.assert_sqlstate(
  $$select public.finalize_resident_invitation(
    'b3000000-0000-4000-8000-000000000001',
    'e3000000-0000-4000-8000-000000000010',
    'a3000000-0000-4000-8000-000000000008',
    'inactive-staff-member@example.test',
    'a3000000-0000-4000-8000-000000000009',
    '93000000-0000-4000-8000-000000000008',
    'inactive-staff-activation'
  )$$,
  '23514',
  'non-resident principal resident finalization'
);

do $$
declare
  control_result jsonb;
begin
  if not exists (
    select 1
    from public.organization_members om
    where om.organization_id = 'b3000000-0000-4000-8000-000000000001'
      and om.user_id = 'a3000000-0000-4000-8000-000000000001'
      and om.role = 'resident'
      and om.status = 'invited'
  ) or exists (
    select 1
    from public.residents r
    where r.id = 'e3000000-0000-4000-8000-000000000001'
      and r.user_id is not null
  ) or not exists (
    select 1
    from public.user_invitations ui
    where ui.user_id = 'a3000000-0000-4000-8000-000000000001'
      and ui.resident_id = 'e3000000-0000-4000-8000-000000000001'
      and ui.status = 'pending'
      and ui.activation_token_hash = extensions.digest(
        'resident-success-activation',
        'sha256'
      )
  ) then
    raise exception 'Resident invitation granted access before acceptance';
  end if;

  control_result := public.finalize_resident_invitation(
    'b3000000-0000-4000-8000-000000000001',
    'e3000000-0000-4000-8000-000000000008',
    'a3000000-0000-4000-8000-000000000010',
    'unique-control@example.test',
    'a3000000-0000-4000-8000-000000000009',
    '93000000-0000-4000-8000-000000000010',
    'control-activation'
  );
  perform public.revoke_pre_authorized_invitation(
    'a3000000-0000-4000-8000-000000000010',
    '93000000-0000-4000-8000-000000000010'
  );

  if not exists (
    select 1 from public.user_invitations
    where id = (control_result ->> 'invitationId')::uuid
      and status = 'revoked'
  ) or exists (
    select 1 from public.organization_members
    where id = (control_result ->> 'membershipId')::uuid
      and status = 'active'
  ) or exists (
    select 1 from public.residents
    where id = 'e3000000-0000-4000-8000-000000000008'
      and user_id is not null
  ) then
    raise exception 'Invitation revocation left resident authorization active';
  end if;
end;
$$;

reset role;
select set_config('request.jwt.claim.role', '', true);
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '', true);

update public.user_invitations
set expires_at = now() - interval '1 second'
where user_id = 'a3000000-0000-4000-8000-000000000001';

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'a3000000-0000-4000-8000-000000000001', true);
select set_config(
  'request.jwt.claims',
  '{"role":"authenticated","sub":"a3000000-0000-4000-8000-000000000001","email":"resident-success@example.test"}',
  true
);

select pg_temp.assert_sqlstate(
  $$select public.accept_pre_authorized_invitation('resident-success-activation')$$,
  '22023',
  'expired resident activation secret'
);

reset role;
select set_config('request.jwt.claim.role', '', true);
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '', true);

update public.user_invitations
set expires_at = now() + interval '1 hour'
where user_id = 'a3000000-0000-4000-8000-000000000001';

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'a3000000-0000-4000-8000-000000000006', true);
select set_config(
  'request.jwt.claims',
  '{"role":"authenticated","sub":"a3000000-0000-4000-8000-000000000006","email":"resident-cross-org@example.test"}',
  true
);

select pg_temp.assert_sqlstate(
  $$select public.accept_pre_authorized_invitation('resident-success-activation')$$,
  '42501',
  'resident activation secret used by the wrong Auth identity'
);

reset role;
select set_config('request.jwt.claim.role', '', true);
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '', true);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'a3000000-0000-4000-8000-000000000001', true);
select set_config(
  'request.jwt.claims',
  '{"role":"authenticated","sub":"a3000000-0000-4000-8000-000000000001","email":"resident-success@example.test"}',
  true
);

select pg_temp.assert_sqlstate(
  $$select public.accept_pre_authorized_invitation('recovery-session-has-no-secret')$$,
  '22023',
  'password recovery without the invitation activation secret'
);

do $$
declare
  result jsonb;
  replay_result jsonb;
begin
  if public.is_org_member('b3000000-0000-4000-8000-000000000001') then
    raise exception 'Pending invitation granted organization access';
  end if;

  result := public.accept_pre_authorized_invitation('resident-success-activation');
  replay_result := public.accept_pre_authorized_invitation('resident-success-activation');

  if result ->> 'role' <> 'resident'
    or result ->> 'residentId' <> 'e3000000-0000-4000-8000-000000000001'
    or result ->> 'alreadyAccepted' <> 'false'
    or replay_result ->> 'invitationId' <> result ->> 'invitationId'
    or replay_result ->> 'membershipId' <> result ->> 'membershipId'
    or replay_result ->> 'alreadyAccepted' <> 'true' then
    raise exception 'Resident invitation acceptance was not atomic and idempotent';
  end if;
end;
$$;

reset role;
select set_config('request.jwt.claim.role', '', true);
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '', true);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'a3000000-0000-4000-8000-000000000010', true);
select set_config(
  'request.jwt.claims',
  '{"role":"authenticated","sub":"a3000000-0000-4000-8000-000000000010","email":"unique-control@example.test"}',
  true
);

select pg_temp.assert_sqlstate(
  $$select public.accept_pre_authorized_invitation('control-activation')$$,
  '22023',
  'revoked resident activation secret'
);

reset role;
select set_config('request.jwt.claim.role', '', true);
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '', true);

do $$
declare
  membership_id uuid;
begin
  select om.id into membership_id
  from public.organization_members om
  where om.organization_id = 'b3000000-0000-4000-8000-000000000001'
    and om.user_id = 'a3000000-0000-4000-8000-000000000001'
    and om.role = 'resident'
    and om.status = 'active';

  if membership_id is null then
    raise exception 'Resident invitation did not create an active resident membership';
  end if;

  if not exists (
    select 1
    from public.residents r
    where r.id = 'e3000000-0000-4000-8000-000000000001'
      and r.organization_id = 'b3000000-0000-4000-8000-000000000001'
      and r.user_id = 'a3000000-0000-4000-8000-000000000001'
      and r.email = 'resident-success@example.test'
  ) then
    raise exception 'Resident invitation did not bind the resident identity and email';
  end if;

  if not exists (
    select 1
    from public.audit_logs a
    where a.organization_id = 'b3000000-0000-4000-8000-000000000001'
      and a.resident_id = 'e3000000-0000-4000-8000-000000000001'
      and a.action = 'invitation_accepted'
      and a.resource_type = 'user_invitation'
      and a.resource_id = (
        select ui.id
        from public.user_invitations ui
        where ui.resident_id = 'e3000000-0000-4000-8000-000000000001'
          and ui.user_id = 'a3000000-0000-4000-8000-000000000001'
      )
      and a.performed_by_id = 'a3000000-0000-4000-8000-000000000001'
      and a.performed_by_name = 'Invite Success'
  ) then
    raise exception 'Resident invitation was not immutably audited';
  end if;

  if (
    select count(*)
    from public.organization_members om
    where om.organization_id = 'b3000000-0000-4000-8000-000000000001'
      and om.user_id = 'a3000000-0000-4000-8000-000000000001'
      and om.role = 'resident'
  ) <> 1 or (
    select count(*)
    from public.audit_logs a
    where a.organization_id = 'b3000000-0000-4000-8000-000000000001'
      and a.resident_id = 'e3000000-0000-4000-8000-000000000001'
      and a.action = 'invitation_accepted'
  ) <> 1 then
    raise exception 'Resident invitation retry created duplicate state';
  end if;

  if exists (
    select 1
    from public.organization_members
    where user_id in (
      'a3000000-0000-4000-8000-000000000005',
      'a3000000-0000-4000-8000-000000000006'
    )
      and role = 'resident'
      and status = 'active'
  ) then
    raise exception 'Rejected resident invitation created a membership';
  end if;
end;
$$;

select pg_temp.assert_sqlstate(
  $sql$
    insert into public.organization_members (
      organization_id, user_id, role, status
    ) values (
      'b3000000-0000-4000-8000-000000000001',
      'a3000000-0000-4000-8000-000000000007',
      'resident', 'active'
    )
  $sql$,
  '23514',
  'staff principal resident membership creation'
);

select pg_temp.assert_sqlstate(
  $sql$
    update public.residents
    set user_id = 'a3000000-0000-4000-8000-000000000001'
    where id = 'e3000000-0000-4000-8000-000000000008'
  $sql$,
  '23505',
  'one Auth user linked to multiple residents'
);

select pg_temp.assert_sqlstate(
  $sql$
    insert into public.staff_profiles (
      organization_id, user_id, first_name, last_name, role, status
    ) values (
      'b3000000-0000-4000-8000-000000000001',
      'a3000000-0000-4000-8000-000000000001',
      'Resident', 'Cannot Become Staff', 'staff', 'active'
    )
  $sql$,
  '23514',
  'active resident staff profile creation'
);

select pg_temp.assert_sqlstate(
  $sql$
    insert into public.organization_members (
      organization_id, user_id, role, status
    ) values (
      'b3000000-0000-4000-8000-000000000002',
      'a3000000-0000-4000-8000-000000000001',
      'staff', 'invited'
    )
  $sql$,
  '23514',
  'active resident non-resident membership creation'
);

select pg_temp.assert_sqlstate(
  $sql$
    insert into public.organization_members (
      organization_id, user_id, role, status
    ) values (
      'b3000000-0000-4000-8000-000000000002',
      'a3000000-0000-4000-8000-000000000011',
      'admin', 'active'
    )
  $sql$,
  '23514',
  'resident-membership principal non-resident membership creation'
);

select pg_temp.assert_sqlstate(
  $sql$
    update public.residents
    set user_id = 'a3000000-0000-4000-8000-000000000007',
        email = 'staff-linked@example.test'
    where id = 'e3000000-0000-4000-8000-000000000009'
  $sql$,
  '23514',
  'staff principal active resident binding'
);

select pg_temp.assert_sqlstate(
  $sql$
    update public.residents
    set user_id = 'a3000000-0000-4000-8000-000000000008',
        email = 'inactive-staff-member@example.test'
    where id = 'e3000000-0000-4000-8000-000000000010'
  $sql$,
  '23514',
  'non-resident principal active resident binding'
);

insert into public.locations (id, organization_id, name, status)
values
  (
    'c4000000-0000-4000-8000-000000000001',
    'b3000000-0000-4000-8000-000000000001',
    'Document House A',
    'active'
  ),
  (
    'c4000000-0000-4000-8000-000000000002',
    'b3000000-0000-4000-8000-000000000001',
    'Document House B',
    'active'
  );

insert into public.residents (
  id, organization_id, location_id, first_name, last_name, status
)
values
  (
    'e4000000-0000-4000-8000-000000000001',
    'b3000000-0000-4000-8000-000000000001',
    'c4000000-0000-4000-8000-000000000001',
    'Document', 'House A', 'active'
  ),
  (
    'e4000000-0000-4000-8000-000000000002',
    'b3000000-0000-4000-8000-000000000001',
    'c4000000-0000-4000-8000-000000000002',
    'Document', 'House B', 'active'
  );

insert into public.organization_members (
  id, organization_id, user_id, role, status
) values (
  'd4000000-0000-4000-8000-000000000001',
  'b3000000-0000-4000-8000-000000000001',
  'a2000000-0000-4000-8000-000000000003',
  'staff',
  'active'
);

insert into public.organization_member_locations (
  organization_id, organization_member_id, location_id
) values (
  'b3000000-0000-4000-8000-000000000001',
  'd4000000-0000-4000-8000-000000000001',
  'c4000000-0000-4000-8000-000000000002'
);

insert into storage.objects (
  id, bucket_id, name, owner, owner_id, metadata
) values
  (
    '94000000-0000-4000-8000-000000000001',
    'secure-documents',
    'b3000000-0000-4000-8000-000000000001/document-binding/house-a-private.pdf',
    'a3000000-0000-4000-8000-000000000009',
    'a3000000-0000-4000-8000-000000000009',
    '{}'::jsonb
  ),
  (
    '94000000-0000-4000-8000-000000000003',
    'resident-documents',
    'b3000000-0000-4000-8000-000000000001/document-binding/resident-private.pdf',
    'a3000000-0000-4000-8000-000000000009',
    'a3000000-0000-4000-8000-000000000009',
    '{}'::jsonb
  ),
  (
    '94000000-0000-4000-8000-000000000004',
    'intake-attachments',
    'b3000000-0000-4000-8000-000000000001/document-binding/intake-private.pdf',
    'a3000000-0000-4000-8000-000000000009',
    'a3000000-0000-4000-8000-000000000009',
    '{}'::jsonb
  ),
  (
    '94000000-0000-4000-8000-000000000005',
    'medication-photos',
    'b3000000-0000-4000-8000-000000000001/document-binding/medication.jpg',
    'a3000000-0000-4000-8000-000000000009',
    'a3000000-0000-4000-8000-000000000009',
    '{}'::jsonb
  );

insert into public.secure_documents (
  id, organization_id, resident_id, location_id, title,
  storage_bucket, storage_path
) values (
  '94000000-0000-4000-8000-000000000010',
  'b3000000-0000-4000-8000-000000000001',
  'e4000000-0000-4000-8000-000000000001',
  'c4000000-0000-4000-8000-000000000001',
  'House A private document',
  'secure-documents',
  'b3000000-0000-4000-8000-000000000001/document-binding/house-a-private.pdf'
);

do $$
begin
  if has_table_privilege('anon', 'public.protected_document_bindings', 'select')
    or has_table_privilege('authenticated', 'public.protected_document_bindings', 'select')
    or has_table_privilege('authenticated', 'public.protected_document_bindings', 'insert')
    or to_regprocedure('public.can_read_protected_storage_object(text,text)') is not null
    or not coalesce((
      select relrowsecurity
      from pg_class
      where oid = 'public.protected_document_bindings'::regclass
    ), false) then
    raise exception 'Protected document internals are exposed to application callers';
  end if;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'a3000000-0000-4000-8000-000000000009', true);
select set_config(
  'request.jwt.claims',
  '{"role":"authenticated","sub":"a3000000-0000-4000-8000-000000000009","email":"resident-inviter@example.test"}',
  true
);

select pg_temp.assert_sqlstate(
  $sql$
    insert into public.secure_documents (
      organization_id, resident_id, location_id, title, storage_bucket, storage_path
    ) values (
      'b3000000-0000-4000-8000-000000000001',
      'e4000000-0000-4000-8000-000000000001',
      'c4000000-0000-4000-8000-000000000002',
      'Resident and location mismatch',
      'secure-documents',
      'b3000000-0000-4000-8000-000000000001/document-binding/mismatched-house.pdf'
    )
  $sql$,
  '23514',
  'protected document resident current-location mismatch'
);

select pg_temp.assert_sqlstate(
  $sql$
    insert into public.secure_documents (
      organization_id, resident_id, location_id, title, storage_bucket, storage_path
    ) values (
      'b3000000-0000-4000-8000-000000000001',
      'e4000000-0000-4000-8000-000000000001',
      'c4000000-0000-4000-8000-000000000001',
      'Duplicate metadata for the same object',
      'secure-documents',
      'b3000000-0000-4000-8000-000000000001/document-binding/house-a-private.pdf'
    )
  $sql$,
  '23505',
  'duplicate secure-document object binding'
);

select pg_temp.assert_sqlstate(
  $sql$
    insert into public.secure_documents (
      organization_id, resident_id, location_id, title, storage_bucket, storage_path
    ) values (
      'b3000000-0000-4000-8000-000000000001',
      'e4000000-0000-4000-8000-000000000002',
      'c4000000-0000-4000-8000-000000000002',
      'Cross-house alias metadata',
      'secure-documents',
      'b3000000-0000-4000-8000-000000000001/document-binding/house-a-private.pdf'
    )
  $sql$,
  '23505',
  'cross-house secure-document alias binding'
);

select pg_temp.assert_sqlstate(
  $sql$
    insert into public.compliance_items (
      organization_id, location_id, requirement_text, document_url
    ) values (
      'b3000000-0000-4000-8000-000000000001',
      'c4000000-0000-4000-8000-000000000002',
      'Cross-house compliance alias',
      'b3000000-0000-4000-8000-000000000001/document-binding/house-a-private.pdf'
    )
  $sql$,
  '23505',
  'cross-house compliance alias binding'
);

select pg_temp.assert_sqlstate(
  $sql$
    insert into public.compliance_items (
      organization_id, location_id, requirement_text, document_url
    ) values (
      'b3000000-0000-4000-8000-000000000001',
      'c4000000-0000-4000-8000-000000000001',
      'Duplicate same-house compliance metadata',
      'b3000000-0000-4000-8000-000000000001/document-binding/house-a-private.pdf'
    )
  $sql$,
  '23505',
  'same-house cross-table object alias binding'
);

select pg_temp.assert_sqlstate(
  $sql$
    update public.secure_documents
    set resident_id = 'e4000000-0000-4000-8000-000000000002',
        location_id = 'c4000000-0000-4000-8000-000000000002'
    where id = '94000000-0000-4000-8000-000000000010'
  $sql$,
  '23505',
  'immutable secure-document object scope'
);

reset role;
select set_config('request.jwt.claim.role', '', true);
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '', true);

insert into storage.objects (
  id, bucket_id, name, owner, owner_id, metadata
) values (
  '94000000-0000-4000-8000-000000000002',
  'secure-documents',
  'b3000000-0000-4000-8000-000000000001/document-binding/deleted-house-a.pdf',
  'a3000000-0000-4000-8000-000000000009',
  'a3000000-0000-4000-8000-000000000009',
  '{}'::jsonb
);

insert into public.secure_documents (
  id, organization_id, resident_id, location_id, title,
  storage_bucket, storage_path
) values (
  '94000000-0000-4000-8000-000000000011',
  'b3000000-0000-4000-8000-000000000001',
  'e4000000-0000-4000-8000-000000000001',
  'c4000000-0000-4000-8000-000000000001',
  'House A deleted metadata control',
  'secure-documents',
  'b3000000-0000-4000-8000-000000000001/document-binding/deleted-house-a.pdf'
);

delete from public.secure_documents
where id = '94000000-0000-4000-8000-000000000011';

select pg_temp.assert_sqlstate(
  $sql$
    insert into public.secure_documents (
      organization_id, resident_id, location_id, title, storage_bucket, storage_path
    ) values (
      'b3000000-0000-4000-8000-000000000001',
      'e4000000-0000-4000-8000-000000000002',
      'c4000000-0000-4000-8000-000000000002',
      'Deleted-object cross-house rebind',
      'secure-documents',
      'b3000000-0000-4000-8000-000000000001/document-binding/deleted-house-a.pdf'
    )
  $sql$,
  '23505',
  'deleted metadata object rebind'
);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'a2000000-0000-4000-8000-000000000003', true);
select set_config(
  'request.jwt.claims',
  '{"role":"authenticated","sub":"a2000000-0000-4000-8000-000000000003","email":"unmembered@example.test"}',
  true
);

select pg_temp.assert_sqlstate(
  $sql$
    select public.record_document_access(
      'secure-documents',
      'b3000000-0000-4000-8000-000000000001/document-binding/house-a-private.pdf'
    )
  $sql$,
  '42501',
  'cross-house document signing authorization'
);

reset role;
select set_config('request.jwt.claim.role', '', true);
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '', true);

update public.residents
set location_id = 'c4000000-0000-4000-8000-000000000002'
where id = 'e4000000-0000-4000-8000-000000000001';

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'a3000000-0000-4000-8000-000000000009', true);
select set_config(
  'request.jwt.claims',
  '{"role":"authenticated","sub":"a3000000-0000-4000-8000-000000000009","email":"resident-inviter@example.test"}',
  true
);

select pg_temp.assert_sqlstate(
  $sql$
    select public.record_document_access(
      'secure-documents',
      'b3000000-0000-4000-8000-000000000001/document-binding/house-a-private.pdf'
    )
  $sql$,
  '42501',
  'stale protected document location after resident move'
);

reset role;
select set_config('request.jwt.claim.role', '', true);
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '', true);

update public.residents
set location_id = 'c4000000-0000-4000-8000-000000000001'
where id = 'e4000000-0000-4000-8000-000000000001';

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'a3000000-0000-4000-8000-000000000009', true);
select set_config(
  'request.jwt.claims',
  '{"role":"authenticated","sub":"a3000000-0000-4000-8000-000000000009","email":"resident-inviter@example.test"}',
  true
);

do $$
declare
  protected_object_count integer;
  medication_photo_count integer;
begin
  select count(*) into protected_object_count
  from storage.objects
  where bucket_id in ('resident-documents', 'secure-documents', 'intake-attachments')
    and name like 'b3000000-0000-4000-8000-000000000001/document-binding/%';

  if protected_object_count <> 0 then
    raise exception 'Authenticated callers can directly read protected storage objects';
  end if;

  select count(*) into medication_photo_count
  from storage.objects
  where bucket_id = 'medication-photos'
    and name = 'b3000000-0000-4000-8000-000000000001/document-binding/medication.jpg';

  if medication_photo_count <> 1 then
    raise exception 'Medication-photo read access was removed with protected-document access';
  end if;
end;
$$;

insert into storage.objects (
  id, bucket_id, name, owner, owner_id, metadata
) values (
  '94000000-0000-4000-8000-000000000006',
  'resident-documents',
  'b3000000-0000-4000-8000-000000000001/document-binding/upload-only.pdf',
  'a3000000-0000-4000-8000-000000000009',
  'a3000000-0000-4000-8000-000000000009',
  '{}'::jsonb
);

do $$
begin
  if exists (
    select 1
    from storage.objects
    where bucket_id = 'resident-documents'
      and name = 'b3000000-0000-4000-8000-000000000001/document-binding/upload-only.pdf'
  ) then
    raise exception 'Protected upload became directly readable by the authenticated uploader';
  end if;
end;
$$;

do $$
declare
  authorization_receipt jsonb;
begin
  authorization_receipt := public.record_document_access(
    'secure-documents',
    'b3000000-0000-4000-8000-000000000001/document-binding/house-a-private.pdf'
  );

  if authorization_receipt ->> 'bucket' <> 'secure-documents'
    or authorization_receipt ->> 'path'
      <> 'b3000000-0000-4000-8000-000000000001/document-binding/house-a-private.pdf'
    or authorization_receipt ->> 'resourceType' <> 'secure_documents'
    or authorization_receipt ->> 'resourceId' <> '94000000-0000-4000-8000-000000000010' then
    raise exception 'Document authorization did not return the exact immutable object binding';
  end if;
end;
$$;

reset role;
select set_config('request.jwt.claim.role', '', true);
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '', true);

set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);

do $$
declare
  protected_object_count integer;
begin
  select count(*) into protected_object_count
  from storage.objects
  where bucket_id in ('resident-documents', 'secure-documents', 'intake-attachments')
    and name like 'b3000000-0000-4000-8000-000000000001/document-binding/%';

  if protected_object_count <> 5 then
    raise exception 'Service role cannot read protected objects for audited signing';
  end if;
end;
$$;

reset role;
select set_config('request.jwt.claim.role', '', true);

rollback;
