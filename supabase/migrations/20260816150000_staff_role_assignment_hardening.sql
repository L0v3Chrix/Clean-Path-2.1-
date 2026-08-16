alter table public.staff_profiles
  drop constraint if exists staff_profiles_role_check;
alter table public.staff_profiles
  add constraint staff_profiles_role_check check (role in (
    'platform_admin', 'owner', 'admin', 'director', 'house_manager',
    'peer_support', 'case_manager', 'staff', 'volunteer'
  ));

-- Admins may manage operational users. Only owners may grant or manage owner/admin access.
drop policy if exists organization_members_insert_managers on public.organization_members;
drop policy if exists organization_members_update_managers on public.organization_members;
drop policy if exists organization_members_delete_managers on public.organization_members;
create policy organization_members_insert_managers on public.organization_members
for insert with check (
  public.current_org_role(organization_id) = 'owner'
  or (
    public.current_org_role(organization_id) = 'admin'
    and role not in ('owner', 'admin')
  )
);
create policy organization_members_update_managers on public.organization_members
for update using (
  public.current_org_role(organization_id) = 'owner'
  or (
    public.current_org_role(organization_id) = 'admin'
    and role not in ('owner', 'admin')
  )
) with check (
  public.current_org_role(organization_id) = 'owner'
  or (
    public.current_org_role(organization_id) = 'admin'
    and role not in ('owner', 'admin')
  )
);
create policy organization_members_delete_managers on public.organization_members
for delete using (
  public.current_org_role(organization_id) = 'owner'
  or (
    public.current_org_role(organization_id) = 'admin'
    and role not in ('owner', 'admin')
  )
);

drop policy if exists staff_profiles_insert_admin on public.staff_profiles;
drop policy if exists staff_profiles_update_admin on public.staff_profiles;
drop policy if exists staff_profiles_delete_admins on public.staff_profiles;
drop policy if exists staff_profiles_insert_managers on public.staff_profiles;
drop policy if exists staff_profiles_update_managers on public.staff_profiles;
drop policy if exists staff_profiles_delete_managers on public.staff_profiles;
create policy staff_profiles_insert_managers on public.staff_profiles
for insert with check (
  public.current_org_role(organization_id) = 'owner'
  or (
    public.current_org_role(organization_id) = 'admin'
    and role not in ('platform_admin', 'owner', 'admin')
  )
);
create policy staff_profiles_update_managers on public.staff_profiles
for update using (
  public.current_org_role(organization_id) = 'owner'
  or (
    public.current_org_role(organization_id) = 'admin'
    and role not in ('platform_admin', 'owner', 'admin')
  )
) with check (
  public.current_org_role(organization_id) = 'owner'
  or (
    public.current_org_role(organization_id) = 'admin'
    and role not in ('platform_admin', 'owner', 'admin')
  )
);
create policy staff_profiles_delete_managers on public.staff_profiles
for delete using (
  public.current_org_role(organization_id) = 'owner'
  or (
    public.current_org_role(organization_id) = 'admin'
    and role not in ('platform_admin', 'owner', 'admin')
  )
);

create or replace function public.update_staff_access(
  p_profile_id uuid,
  p_role text,
  p_location_ids uuid[] default '{}'::uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_profile public.staff_profiles;
  target_membership public.organization_members;
  caller_role text;
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
  where sp.id = p_profile_id;
  if target_profile.id is null then
    raise exception 'Staff profile not found' using errcode = 'P0002';
  end if;

  select om.role into caller_role
  from public.organization_members om
  where om.organization_id = target_profile.organization_id
    and om.user_id = auth.uid()
    and om.status = 'active';
  if caller_role not in ('owner', 'admin') then
    raise exception 'Only organization administrators can assign staff access' using errcode = '42501';
  end if;
  if caller_role <> 'owner' and p_role in ('owner', 'admin') then
    raise exception 'Only an owner can grant owner or admin access' using errcode = '42501';
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
      and om.user_id = target_profile.user_id;
    if target_membership.id is null then
      raise exception 'Linked staff membership not found' using errcode = 'P0002';
    end if;
    if caller_role <> 'owner' and target_membership.role in ('owner', 'admin') then
      raise exception 'Only an owner can manage owner or admin access' using errcode = '42501';
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

  return jsonb_build_object(
    'ok', true,
    'profileId', target_profile.id,
    'role', p_role,
    'locationIds', to_jsonb(normalized_locations)
  );
end;
$$;

revoke execute on function public.update_staff_access(uuid, text, uuid[]) from public, anon;
grant execute on function public.update_staff_access(uuid, text, uuid[]) to authenticated;
