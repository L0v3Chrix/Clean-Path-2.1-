begin;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
values
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner@example.test', '', now(), now()),
  ('10000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'staff@example.test', '', now(), now()),
  ('10000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'resident@example.test', '', now(), now());

insert into public.organizations (id, name, status)
values ('20000000-0000-4000-8000-000000000001', 'RLS Test Organization', 'active');

insert into public.locations (id, organization_id, name, status)
values
  ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'Assigned House', 'active'),
  ('30000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', 'Other House', 'active');

insert into public.organization_members (id, organization_id, user_id, role, status)
values
  ('40000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'owner', 'active'),
  ('40000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 'staff', 'active'),
  ('40000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003', 'resident', 'active');

insert into public.organization_member_locations (organization_id, organization_member_id, location_id)
values ('20000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000001');

insert into public.residents (id, organization_id, location_id, user_id, first_name, last_name, status)
values
  ('50000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003', 'Assigned', 'Resident', 'active'),
  ('50000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000002', null, 'Other', 'Resident', 'active');

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);

do $$
begin
  if (select count(*) from public.locations) <> 1 then
    raise exception 'Assigned staff must see exactly one house';
  end if;
  if (select count(*) from public.residents) <> 1 then
    raise exception 'Assigned staff crossed a house boundary';
  end if;
end $$;

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
do $$
begin
  if (select count(*) from public.locations) <> 2 then
    raise exception 'Owner must see both houses';
  end if;
  if (select count(*) from public.residents) <> 2 then
    raise exception 'Owner must see both residents';
  end if;
end $$;

delete from public.residents where id = '50000000-0000-4000-8000-000000000002';
do $$
begin
  if not exists (
    select 1 from public.audit_logs
    where action = 'delete'
      and resource_type = 'residents'
      and resource_id = '50000000-0000-4000-8000-000000000002'
      and resident_id is null
  ) then
    raise exception 'Resident deletion was not audited safely';
  end if;
end $$;

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000003', true);
do $$
begin
  if (select count(*) from public.residents) <> 1 then
    raise exception 'Resident must see only their own resident record';
  end if;
  if exists (select 1 from public.locations) then
    raise exception 'Resident must not list internal house records';
  end if;
end $$;

reset role;
set local role anon;
select set_config('request.jwt.claim.role', 'anon', true);
select set_config('request.jwt.claim.sub', '', true);
do $$
begin
  if has_table_privilege('anon', 'public.residents', 'select')
     or has_table_privilege('anon', 'public.locations', 'select') then
    raise exception 'Anonymous role received internal table privileges';
  end if;
end $$;

rollback;
