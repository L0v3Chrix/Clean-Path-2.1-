create or replace function public.update_staff_access(
  p_profile_id uuid,
  p_role text,
  p_location_ids uuid[] default '{}'::uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  target_profile public.staff_profiles;
  target_membership public.organization_members;
  caller_membership public.organization_members;
  membership_role text;
  normalized_locations uuid[];
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_role is null or p_role not in (
    'owner', 'admin', 'director', 'house_manager', 'case_manager', 'peer_support', 'staff'
  ) then
    raise exception 'Unsupported staff role' using errcode = '22023';
  end if;

  select sp.* into target_profile
  from public.staff_profiles sp
  where sp.id = p_profile_id
  for update;
  if target_profile.id is null then
    raise exception 'Staff profile not found' using errcode = 'P0002';
  end if;

  select om.* into caller_membership
  from public.organization_members om
  where om.organization_id = target_profile.organization_id
    and om.user_id = auth.uid()
    and om.status = 'active'
  for update;
  if caller_membership.id is null
    or caller_membership.role not in ('owner', 'admin') then
    raise exception 'Only organization administrators can assign staff access' using errcode = '42501';
  end if;
  if caller_membership.role <> 'owner' and p_role = 'owner' then
    raise exception 'Only an owner can grant owner access' using errcode = '42501';
  end if;

  perform 1
  from public.organizations o
  where o.id = target_profile.organization_id
  for update;
  if not found then
    raise exception 'Staff organization not found' using errcode = 'P0002';
  end if;

  select coalesce(array_agg(location_id order by location_id), '{}'::uuid[])
  into normalized_locations
  from (
    select distinct location_id
    from unnest(coalesce(p_location_ids, '{}'::uuid[])) location_id
    where location_id is not null
  ) requested_locations;

  if p_role in ('house_manager', 'case_manager', 'peer_support', 'staff')
    and cardinality(normalized_locations) = 0 then
    raise exception 'At least one house assignment is required for this role' using errcode = '22023';
  end if;
  if exists (
    select 1
    from unnest(normalized_locations) requested_location
    where not exists (
      select 1 from public.locations l
      where l.id = requested_location
        and l.organization_id = target_profile.organization_id
        and l.status = 'active'
    )
  ) then
    raise exception 'One or more house assignments are invalid' using errcode = '22023';
  end if;

  if target_profile.user_id is not null then
    select om.* into target_membership
    from public.organization_members om
    where om.organization_id = target_profile.organization_id
      and om.user_id = target_profile.user_id
    for update;
    if target_membership.id is null then
      raise exception 'Linked staff membership not found' using errcode = 'P0002';
    end if;
    if caller_membership.role <> 'owner' and target_membership.role = 'owner' then
      raise exception 'Only an owner can manage owner access' using errcode = '42501';
    end if;
    if target_membership.role = 'owner' and p_role <> 'owner' and (
      select count(*) from public.organization_members om
      where om.organization_id = target_profile.organization_id
        and om.role = 'owner'
        and om.status = 'active'
    ) <= 1 then
      raise exception 'The organization must retain at least one active owner' using errcode = '23514';
    end if;
  end if;

  update public.staff_profiles
  set role = p_role,
      location_ids = normalized_locations,
      updated_by = auth.uid()
  where id = target_profile.id;

  if target_profile.user_id is not null then
    membership_role := case when p_role in ('owner', 'admin') then p_role else 'staff' end;
    update public.organization_members
    set role = membership_role,
        updated_by = auth.uid()
    where id = target_membership.id;

    delete from public.organization_member_locations
    where organization_member_id = target_membership.id;
    if cardinality(normalized_locations) > 0 then
      insert into public.organization_member_locations (
        organization_id, organization_member_id, location_id, created_by
      )
      select target_profile.organization_id, target_membership.id, location_id, auth.uid()
      from unnest(normalized_locations) location_id;
    end if;
  end if;

  insert into public.audit_logs (
    organization_id,
    performed_by_id,
    performed_by_name,
    action,
    resource_type,
    resource_id,
    description,
    created_by,
    updated_by
  ) values (
    target_profile.organization_id,
    auth.uid(),
    coalesce(
      nullif(btrim(caller_membership.display_name), ''),
      nullif(btrim(caller_membership.email), ''),
      'Organization administrator'
    ),
    'staff_access_updated',
    'staff_profiles',
    target_profile.id,
    format('Staff access updated to role %s with %s house assignment(s).', p_role, cardinality(normalized_locations)),
    auth.uid(),
    auth.uid()
  );

  return jsonb_build_object(
    'ok', true,
    'profileId', target_profile.id,
    'role', p_role,
    'locationIds', to_jsonb(normalized_locations)
  );
end;
$$;

revoke execute on function public.update_staff_access(uuid, text, uuid[])
from public, anon;
grant execute on function public.update_staff_access(uuid, text, uuid[])
to authenticated;

create or replace function public.update_staff_profile_and_access(
  p_profile_id uuid,
  p_first_name text,
  p_last_name text,
  p_phone text,
  p_title text,
  p_hire_date date,
  p_status text,
  p_lived_experience boolean,
  p_notes text,
  p_role text,
  p_location_ids uuid[] default '{}'::uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  target_profile public.staff_profiles;
  access_result jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if nullif(btrim(p_first_name), '') is null
    or nullif(btrim(p_last_name), '') is null then
    raise exception 'Staff first and last name are required' using errcode = '22023';
  end if;
  if p_status is null or p_status not in ('active', 'inactive') then
    raise exception 'Unsupported staff status' using errcode = '22023';
  end if;

  select sp.* into target_profile
  from public.staff_profiles sp
  where sp.id = p_profile_id
  for update;
  if target_profile.id is null then
    raise exception 'Staff profile not found' using errcode = 'P0002';
  end if;

  access_result := public.update_staff_access(
    p_profile_id,
    p_role,
    coalesce(p_location_ids, '{}'::uuid[])
  );

  update public.staff_profiles
  set first_name = btrim(p_first_name),
      last_name = btrim(p_last_name),
      phone = nullif(btrim(p_phone), ''),
      title = nullif(btrim(p_title), ''),
      hire_date = p_hire_date,
      status = p_status,
      lived_experience = coalesce(p_lived_experience, false),
      notes = nullif(btrim(p_notes), ''),
      updated_by = auth.uid()
  where id = p_profile_id
  returning * into target_profile;

  if target_profile.user_id is not null then
    update public.organization_members om
    set status = p_status,
        display_name = btrim(p_first_name) || ' ' || btrim(p_last_name),
        updated_by = auth.uid()
    where om.organization_id = target_profile.organization_id
      and om.user_id = target_profile.user_id;

    if not found then
      raise exception 'Linked staff membership not found' using errcode = 'P0002';
    end if;
  end if;

  return access_result || jsonb_build_object(
    'status', target_profile.status,
    'firstName', target_profile.first_name,
    'lastName', target_profile.last_name
  );
end;
$$;

revoke execute on function public.update_staff_profile_and_access(
  uuid, text, text, text, text, date, text, boolean, text, text, uuid[]
) from public, anon;
grant execute on function public.update_staff_profile_and_access(
  uuid, text, text, text, text, date, text, boolean, text, text, uuid[]
) to authenticated;

-- Authenticated access management must use the transactional RPCs above or the
-- service-backed invitation flow so profile, membership, and house state cannot drift.
drop policy if exists organization_members_insert_managers on public.organization_members;
drop policy if exists organization_members_update_managers on public.organization_members;
drop policy if exists organization_members_delete_managers on public.organization_members;
drop policy if exists organization_member_locations_admin on public.organization_member_locations;

drop policy if exists staff_profiles_update_admin on public.staff_profiles;
drop policy if exists staff_profiles_update_managers on public.staff_profiles;
drop policy if exists staff_profiles_insert_admin on public.staff_profiles;
drop policy if exists staff_profiles_insert_managers on public.staff_profiles;
drop policy if exists staff_profiles_delete_admins on public.staff_profiles;
drop policy if exists staff_profiles_delete_managers on public.staff_profiles;

do $$
declare
  write_policy record;
begin
  for write_policy in
    select schemaname, tablename, policyname
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename in (
        'organization_members',
        'organization_member_locations',
        'staff_profiles'
      )
      and cmd in ('ALL', 'INSERT', 'UPDATE', 'DELETE')
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      write_policy.policyname,
      write_policy.schemaname,
      write_policy.tablename
    );
  end loop;
end;
$$;
