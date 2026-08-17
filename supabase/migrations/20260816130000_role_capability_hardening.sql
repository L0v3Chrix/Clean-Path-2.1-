create or replace function public.current_access_role(org_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when om.role <> 'staff' then om.role
    else coalesce((
      select sp.role
      from public.staff_profiles sp
      where sp.organization_id = om.organization_id
        and sp.user_id = om.user_id
        and sp.status = 'active'
      order by sp.created_at
      limit 1
    ), 'staff')
  end
  from public.organization_members om
  where om.organization_id = org_id
    and om.user_id = auth.uid()
    and om.status = 'active'
  limit 1;
$$;

create or replace function public.is_resident_self(org_id uuid, requested_resident_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_org_role(org_id) = 'resident'
    and exists (
      select 1
      from public.residents r
      where r.id = requested_resident_id
        and r.organization_id = org_id
        and r.user_id = auth.uid()
    );
$$;

create or replace function public.can_staff_access_location(org_id uuid, requested_location_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when public.current_access_role(org_id) in ('owner', 'admin', 'director')
      then public.is_org_member(org_id)
    when public.current_access_role(org_id) = 'resident' then false
    else public.can_access_location(org_id, requested_location_id)
  end;
$$;

create or replace function public.can_manage_location(org_id uuid, requested_location_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when public.current_access_role(org_id) in ('owner', 'admin', 'director')
      then public.is_org_member(org_id)
    when public.current_access_role(org_id) = 'house_manager'
      then public.can_access_location(org_id, requested_location_id)
    else false
  end;
$$;

revoke execute on function public.current_access_role(uuid) from public, anon;
revoke execute on function public.is_resident_self(uuid, uuid) from public, anon;
revoke execute on function public.can_staff_access_location(uuid, uuid) from public, anon;
revoke execute on function public.can_manage_location(uuid, uuid) from public, anon;
grant execute on function public.current_access_role(uuid) to authenticated;
grant execute on function public.is_resident_self(uuid, uuid) to authenticated;
grant execute on function public.can_staff_access_location(uuid, uuid) to authenticated;
grant execute on function public.can_manage_location(uuid, uuid) to authenticated;

-- Admins may manage non-owner accounts. Only an owner can create, change, or remove an owner row.
drop policy if exists "Admins can manage organization memberships" on public.organization_members;
drop policy if exists organization_members_insert_managers on public.organization_members;
drop policy if exists organization_members_update_managers on public.organization_members;
drop policy if exists organization_members_delete_managers on public.organization_members;
create policy organization_members_insert_managers on public.organization_members
for insert with check (
  public.current_org_role(organization_id) = 'owner'
  or (public.current_org_role(organization_id) = 'admin' and role <> 'owner')
);
create policy organization_members_update_managers on public.organization_members
for update using (
  public.current_org_role(organization_id) = 'owner'
  or (public.current_org_role(organization_id) = 'admin' and role <> 'owner')
) with check (
  public.current_org_role(organization_id) = 'owner'
  or (public.current_org_role(organization_id) = 'admin' and role <> 'owner')
);
create policy organization_members_delete_managers on public.organization_members
for delete using (
  public.current_org_role(organization_id) = 'owner'
  or (public.current_org_role(organization_id) = 'admin' and role <> 'owner')
);

create or replace function public.can_read_chat_channel(requested_channel_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.chat_channels c
    where c.id = requested_channel_id
      and c.status = 'active'
      and public.is_org_member(c.organization_id)
      and (
        public.current_access_role(c.organization_id) in ('owner', 'admin', 'director')
        or (
          c.category <> 'direct'
          and c.location_id is not null
          and (
            (
              public.current_access_role(c.organization_id) = 'resident'
              and c.access_level = 'residents_and_staff'
              and exists (
                select 1
                from public.residents r
                where r.organization_id = c.organization_id
                  and r.location_id = c.location_id
                  and r.user_id = auth.uid()
                  and r.status = 'active'
              )
            )
            or (
              public.current_access_role(c.organization_id) <> 'resident'
              and public.can_staff_access_location(c.organization_id, c.location_id)
              and (
                c.access_level in ('residents_and_staff', 'staff_only')
                or (
                  c.access_level = 'management_only'
                  and public.current_access_role(c.organization_id) in ('house_manager', 'owner', 'admin', 'director')
                )
              )
            )
          )
        )
      )
  );
$$;

revoke execute on function public.can_read_chat_channel(uuid) from public, anon;
grant execute on function public.can_read_chat_channel(uuid) to authenticated;

drop policy if exists chat_channels_select_members on public.chat_channels;
drop policy if exists chat_channels_insert_members on public.chat_channels;
drop policy if exists chat_channels_update_members on public.chat_channels;
drop policy if exists chat_channels_select_capability on public.chat_channels;
drop policy if exists chat_channels_insert_admin on public.chat_channels;
drop policy if exists chat_channels_update_admin on public.chat_channels;
create policy chat_channels_select_capability on public.chat_channels
for select using (public.can_read_chat_channel(id));
create policy chat_channels_insert_admin on public.chat_channels
for insert with check (public.is_org_admin(organization_id));
create policy chat_channels_update_admin on public.chat_channels
for update using (public.is_org_admin(organization_id))
with check (public.is_org_admin(organization_id));

drop policy if exists chat_messages_select_members on public.chat_messages;
drop policy if exists chat_messages_insert_members on public.chat_messages;
drop policy if exists chat_messages_update_members on public.chat_messages;
drop policy if exists chat_messages_select_channel on public.chat_messages;
drop policy if exists chat_messages_insert_channel on public.chat_messages;
drop policy if exists chat_messages_update_own on public.chat_messages;
create policy chat_messages_select_channel on public.chat_messages
for select using (public.can_read_chat_channel(channel_id));
create policy chat_messages_insert_channel on public.chat_messages
for insert with check (
  sender_id = auth.uid()
  and public.can_read_chat_channel(channel_id)
  and exists (
    select 1
    from public.chat_channels c
    where c.id = channel_id
      and c.organization_id = organization_id
      and c.is_locked = false
  )
);
create policy chat_messages_update_own on public.chat_messages
for update using (
  sender_id = auth.uid()
  and public.can_read_chat_channel(channel_id)
) with check (
  sender_id = auth.uid()
  and public.can_read_chat_channel(channel_id)
  and exists (
    select 1
    from public.chat_channels c
    where c.id = channel_id
      and c.organization_id = organization_id
      and c.is_locked = false
  )
);

create or replace function public.enforce_chat_message_identity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_role text;
  actor_name text;
begin
  if auth.role() = 'service_role' or auth.role() is null then return new; end if;
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;

  if tg_op = 'INSERT' then
    if new.sender_id is distinct from auth.uid() then
      raise exception 'Chat sender identity does not match the authenticated user' using errcode = '42501';
    end if;
    actor_role := public.current_access_role(new.organization_id);
    if actor_role is null then raise exception 'Active membership required' using errcode = '42501'; end if;
    select coalesce(
      nullif(trim(concat_ws(' ', sp.first_name, sp.last_name)), ''),
      nullif(om.display_name, ''),
      nullif(om.email, ''),
      'ClearPath member'
    )
    into actor_name
    from public.organization_members om
    left join public.staff_profiles sp
      on sp.organization_id = om.organization_id and sp.user_id = om.user_id and sp.status = 'active'
    where om.organization_id = new.organization_id
      and om.user_id = auth.uid()
      and om.status = 'active'
    order by sp.created_at nulls last
    limit 1;
    new.sender_role := actor_role;
    new.sender_name := actor_name;
    new.created_by := auth.uid();
    new.updated_by := auth.uid();
    return new;
  end if;

  if old.sender_id is distinct from auth.uid() then
    raise exception 'Only the sender can edit a chat message' using errcode = '42501';
  end if;
  if (to_jsonb(new) - array['content', 'file_url', 'edited', 'updated_at', 'updated_by'])
      is distinct from
     (to_jsonb(old) - array['content', 'file_url', 'edited', 'updated_at', 'updated_by']) then
    raise exception 'Chat identity and channel fields are immutable' using errcode = '42501';
  end if;
  new.sender_id := old.sender_id;
  new.sender_name := old.sender_name;
  new.sender_role := old.sender_role;
  new.channel_id := old.channel_id;
  new.organization_id := old.organization_id;
  new.edited := true;
  new.updated_by := auth.uid();
  return new;
end;
$$;

drop trigger if exists enforce_chat_message_identity on public.chat_messages;
create trigger enforce_chat_message_identity
before insert or update on public.chat_messages
for each row execute function public.enforce_chat_message_identity();
revoke execute on function public.enforce_chat_message_identity() from public, anon, authenticated;

-- Chore configuration belongs to assigned staff; residents see and complete only their own assignment.
drop policy if exists chore_templates_select_members on public.chore_templates;
drop policy if exists chore_templates_insert_members on public.chore_templates;
drop policy if exists chore_templates_update_members on public.chore_templates;
drop policy if exists chore_templates_delete_admins on public.chore_templates;
drop policy if exists chore_templates_select_location on public.chore_templates;
drop policy if exists chore_templates_insert_location on public.chore_templates;
drop policy if exists chore_templates_update_location on public.chore_templates;
drop policy if exists chore_templates_delete_location on public.chore_templates;
create policy chore_templates_select_location on public.chore_templates
for select using (public.can_staff_access_location(organization_id, location_id));
create policy chore_templates_insert_location on public.chore_templates
for insert with check (public.can_manage_location(organization_id, location_id));
create policy chore_templates_update_location on public.chore_templates
for update using (public.can_manage_location(organization_id, location_id))
with check (public.can_manage_location(organization_id, location_id));
create policy chore_templates_delete_location on public.chore_templates
for delete using (public.can_manage_location(organization_id, location_id));

drop policy if exists chore_assignments_select_members on public.chore_assignments;
drop policy if exists chore_assignments_insert_members on public.chore_assignments;
drop policy if exists chore_assignments_update_members on public.chore_assignments;
drop policy if exists chore_assignments_delete_admins on public.chore_assignments;
drop policy if exists chore_assignments_select_scope on public.chore_assignments;
drop policy if exists chore_assignments_insert_location on public.chore_assignments;
drop policy if exists chore_assignments_update_scope on public.chore_assignments;
drop policy if exists chore_assignments_delete_location on public.chore_assignments;
create policy chore_assignments_select_scope on public.chore_assignments
for select using (
  public.can_staff_access_location(organization_id, location_id)
  or public.is_resident_self(organization_id, resident_id)
);
create policy chore_assignments_insert_location on public.chore_assignments
for insert with check (public.can_manage_location(organization_id, location_id));
create policy chore_assignments_update_scope on public.chore_assignments
for update using (
  public.can_manage_location(organization_id, location_id)
  or public.is_resident_self(organization_id, resident_id)
) with check (
  public.can_manage_location(organization_id, location_id)
  or public.is_resident_self(organization_id, resident_id)
);
create policy chore_assignments_delete_location on public.chore_assignments
for delete using (public.can_manage_location(organization_id, location_id));

create or replace function public.enforce_resident_chore_completion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'service_role'
    or public.current_access_role(new.organization_id) is distinct from 'resident' then
    return new;
  end if;
  if not public.is_resident_self(new.organization_id, new.resident_id)
    or old.status <> 'pending'
    or new.status <> 'completed'
    or new.completed_at is null
    or (to_jsonb(new) - array['status', 'completed_at', 'updated_at', 'updated_by'])
       is distinct from
       (to_jsonb(old) - array['status', 'completed_at', 'updated_at', 'updated_by']) then
    raise exception 'Residents may only complete their own pending chore' using errcode = '42501';
  end if;
  new.updated_by := auth.uid();
  return new;
end;
$$;

drop trigger if exists enforce_resident_chore_completion on public.chore_assignments;
create trigger enforce_resident_chore_completion
before update on public.chore_assignments
for each row execute function public.enforce_resident_chore_completion();
revoke execute on function public.enforce_resident_chore_completion() from public, anon, authenticated;

create or replace function public.generate_chore_rotation(
  p_location_id uuid,
  p_organization_id uuid,
  p_week_start_date date
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  resident_count integer;
  chore_count integer;
  rotation_offset integer;
  chore_record record;
  resident_record record;
  created_count integer := 0;
  v_week_label text := 'Week of ' || p_week_start_date::text;
begin
  if not public.can_manage_location(p_organization_id, p_location_id) then
    raise exception 'Chore rotation access denied' using errcode = '42501';
  end if;

  select count(*) into resident_count
  from public.residents r
  where r.location_id = p_location_id and r.organization_id = p_organization_id and r.status = 'active';
  if resident_count = 0 then raise exception 'No active residents found at this location'; end if;

  select count(*) into chore_count
  from public.chore_templates c
  where c.location_id = p_location_id and c.organization_id = p_organization_id and c.active = true;
  if chore_count = 0 then raise exception 'No active chore templates defined for this location'; end if;

  delete from public.chore_assignments
  where location_id = p_location_id and organization_id = p_organization_id and week_label = v_week_label;

  select (count(*) / greatest(chore_count, 1))::integer % resident_count
  into rotation_offset
  from public.chore_assignments
  where location_id = p_location_id and organization_id = p_organization_id;

  for chore_record in
    select c.*, row_number() over (order by c.created_at) - 1 as idx
    from public.chore_templates c
    where c.location_id = p_location_id and c.organization_id = p_organization_id and c.active = true
    order by c.created_at
  loop
    if chore_record.frequency = 'daily' then
      for day_offset in 0..6 loop
        select * into resident_record
        from (
          select r.*, row_number() over (order by r.created_at) - 1 as idx
          from public.residents r
          where r.location_id = p_location_id and r.organization_id = p_organization_id and r.status = 'active'
        ) ranked
        where ranked.idx = ((chore_record.idx + rotation_offset + day_offset) % resident_count);
        insert into public.chore_assignments (
          organization_id, location_id, chore_id, chore_name, resident_id, resident_name,
          due_date, week_label, status, area, estimated_minutes, instructions
        ) values (
          p_organization_id, p_location_id, chore_record.id, chore_record.name, resident_record.id,
          trim(resident_record.first_name || ' ' || resident_record.last_name),
          p_week_start_date + day_offset, v_week_label, 'pending', chore_record.area,
          chore_record.estimated_minutes, chore_record.instructions
        );
        created_count := created_count + 1;
      end loop;
    else
      select * into resident_record
      from (
        select r.*, row_number() over (order by r.created_at) - 1 as idx
        from public.residents r
        where r.location_id = p_location_id and r.organization_id = p_organization_id and r.status = 'active'
      ) ranked
      where ranked.idx = ((chore_record.idx + rotation_offset) % resident_count);
      insert into public.chore_assignments (
        organization_id, location_id, chore_id, chore_name, resident_id, resident_name,
        due_date, week_label, status, area, estimated_minutes, instructions
      ) values (
        p_organization_id, p_location_id, chore_record.id, chore_record.name, resident_record.id,
        trim(resident_record.first_name || ' ' || resident_record.last_name),
        p_week_start_date, v_week_label, 'pending', chore_record.area,
        chore_record.estimated_minutes, chore_record.instructions
      );
      created_count := created_count + 1;
    end if;
  end loop;
  return jsonb_build_object('success', true, 'created', created_count, 'week', v_week_label);
end;
$$;

revoke execute on function public.generate_chore_rotation(uuid, uuid, date) from public, anon;
grant execute on function public.generate_chore_rotation(uuid, uuid, date) to authenticated;

-- Residents retain read access to their own portal records but cannot rewrite clinical, financial, or document metadata.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'resident_contacts','care_plan_goals','care_plan_tasks','medications','medication_logs',
    'procurement_requests','resident_interviews','resident_milestones','resident_outcomes',
    'resident_payments','task_logs','vital_readings'
  ] loop
    execute format('drop policy if exists %I on public.%I', table_name || '_insert_resident', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_update_resident', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_insert_staff', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_update_staff', table_name);
    execute format(
      'create policy %I on public.%I for insert with check (public.current_org_role(organization_id) <> ''resident'' and public.can_access_resident(organization_id, resident_id))',
      table_name || '_insert_staff', table_name
    );
    execute format(
      'create policy %I on public.%I for update using (public.current_org_role(organization_id) <> ''resident'' and public.can_access_resident(organization_id, resident_id)) with check (public.current_org_role(organization_id) <> ''resident'' and public.can_access_resident(organization_id, resident_id))',
      table_name || '_update_staff', table_name
    );
  end loop;
end $$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array['incident_reports','staff_tasks','resident_documents','secure_documents','resident_fees'] loop
    execute format('drop policy if exists %I on public.%I', table_name || '_insert_scope', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_update_scope', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_insert_staff_scope', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_update_staff_scope', table_name);
    execute format(
      'create policy %I on public.%I for insert with check (public.current_org_role(organization_id) <> ''resident'' and (public.can_access_location(organization_id, location_id) or public.can_access_resident(organization_id, resident_id) or (location_id is null and resident_id is null and public.is_org_admin(organization_id))))',
      table_name || '_insert_staff_scope', table_name
    );
    execute format(
      'create policy %I on public.%I for update using (public.current_org_role(organization_id) <> ''resident'' and (public.can_access_location(organization_id, location_id) or public.can_access_resident(organization_id, resident_id) or (location_id is null and resident_id is null and public.is_org_admin(organization_id)))) with check (public.current_org_role(organization_id) <> ''resident'' and (public.can_access_location(organization_id, location_id) or public.can_access_resident(organization_id, resident_id) or (location_id is null and resident_id is null and public.is_org_admin(organization_id))))',
      table_name || '_update_staff_scope', table_name
    );
  end loop;
end $$;

drop policy if exists incident_reports_select_scope on public.incident_reports;
drop policy if exists incident_reports_select_staff_scope on public.incident_reports;
create policy incident_reports_select_staff_scope on public.incident_reports
for select using (
  public.current_org_role(organization_id) <> 'resident'
  and (public.can_access_location(organization_id, location_id)
    or public.can_access_resident(organization_id, resident_id)
    or (location_id is null and resident_id is null and public.is_org_admin(organization_id)))
);
drop policy if exists staff_tasks_select_scope on public.staff_tasks;
drop policy if exists staff_tasks_select_staff_scope on public.staff_tasks;
create policy staff_tasks_select_staff_scope on public.staff_tasks
for select using (
  public.current_org_role(organization_id) <> 'resident'
  and (public.can_access_location(organization_id, location_id)
    or public.can_access_resident(organization_id, resident_id)
    or (location_id is null and resident_id is null and public.is_org_admin(organization_id)))
);
drop policy if exists secure_documents_select_scope on public.secure_documents;
drop policy if exists secure_documents_select_staff_scope on public.secure_documents;
create policy secure_documents_select_staff_scope on public.secure_documents
for select using (
  public.current_org_role(organization_id) <> 'resident'
  and (public.can_access_location(organization_id, location_id)
    or public.can_access_resident(organization_id, resident_id)
    or (location_id is null and resident_id is null and public.is_org_admin(organization_id)))
);

drop policy if exists morning_reflections_insert_resident on public.morning_reflections;
drop policy if exists morning_reflections_update_resident on public.morning_reflections;
drop policy if exists morning_reflections_insert_self_or_staff on public.morning_reflections;
drop policy if exists morning_reflections_update_self_or_staff on public.morning_reflections;
create policy morning_reflections_insert_self_or_staff on public.morning_reflections
for insert with check (public.can_access_resident(organization_id, resident_id));
create policy morning_reflections_update_self_or_staff on public.morning_reflections
for update using (public.can_access_resident(organization_id, resident_id))
with check (public.can_access_resident(organization_id, resident_id));

drop policy if exists signature_requests_insert_resident on public.signature_requests;
drop policy if exists signature_requests_update_resident on public.signature_requests;
drop policy if exists signature_requests_insert_staff on public.signature_requests;
drop policy if exists signature_requests_update_self_or_staff on public.signature_requests;
create policy signature_requests_insert_staff on public.signature_requests
for insert with check (
  public.current_org_role(organization_id) <> 'resident'
  and public.can_access_resident(organization_id, resident_id)
);
create policy signature_requests_update_self_or_staff on public.signature_requests
for update using (public.can_access_resident(organization_id, resident_id))
with check (public.can_access_resident(organization_id, resident_id));

create or replace function public.enforce_resident_self_service_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'service_role'
    or public.current_access_role(new.organization_id) is distinct from 'resident' then
    return new;
  end if;
  if not public.is_resident_self(new.organization_id, new.resident_id) then
    raise exception 'Resident self-service access denied' using errcode = '42501';
  end if;

  if tg_table_name = 'morning_reflections' then
    if new.staff_reviewed is not false or new.reviewed_by is not null
      or new.reviewed_at is not null or new.review_notes is not null then
      raise exception 'Residents cannot set staff review fields' using errcode = '42501';
    end if;
    if tg_op = 'UPDATE' and (
      new.id is distinct from old.id
      or new.organization_id is distinct from old.organization_id
      or new.resident_id is distinct from old.resident_id
      or new.created_at is distinct from old.created_at
      or new.created_by is distinct from old.created_by
    ) then
      raise exception 'Resident reflection identity fields are immutable' using errcode = '42501';
    end if;
    new.updated_by := auth.uid();
    return new;
  end if;

  if tg_table_name = 'signature_requests' then
    if tg_op = 'INSERT' then return new; end if;
    if tg_op <> 'UPDATE'
      or old.status not in ('pending', 'viewed')
      or new.status not in ('viewed', 'signed', 'declined')
      or (to_jsonb(new) - array[
          'status', 'viewed_at', 'signed_at', 'signature_data', 'signature_name',
          'decline_reason', 'updated_at', 'updated_by'
        ]) is distinct from
        (to_jsonb(old) - array[
          'status', 'viewed_at', 'signed_at', 'signature_data', 'signature_name',
          'decline_reason', 'updated_at', 'updated_by'
        ]) then
      raise exception 'Residents may update only their own signature response fields' using errcode = '42501';
    end if;
    new.updated_by := auth.uid();
    return new;
  end if;

  raise exception 'Resident mutation is not a permitted self-service action' using errcode = '42501';
end;
$$;

drop trigger if exists enforce_resident_reflection_mutation on public.morning_reflections;
create trigger enforce_resident_reflection_mutation
before insert or update on public.morning_reflections
for each row execute function public.enforce_resident_self_service_mutation();
drop trigger if exists enforce_resident_signature_mutation on public.signature_requests;
drop trigger if exists signature_requests_enforce_resident_mutation on public.signature_requests;
create trigger signature_requests_enforce_resident_mutation
before insert or update on public.signature_requests
for each row execute function public.enforce_resident_self_service_mutation();
revoke execute on function public.enforce_resident_self_service_mutation() from public, anon, authenticated;
