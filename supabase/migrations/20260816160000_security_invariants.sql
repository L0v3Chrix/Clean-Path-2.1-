revoke insert, update, delete, truncate
on table public.audit_logs
from service_role;

revoke insert, update, delete, truncate
on table public.application_error_events
from service_role;

create or replace function public.record_public_intake_submission_audit(
  requested_organization_id uuid,
  requested_resident_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  audit_id uuid;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Public intake audit access denied' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.residents r
    where r.id = requested_resident_id
      and r.organization_id = requested_organization_id
  ) then
    raise exception 'Public intake resident scope is invalid' using errcode = '23503';
  end if;

  insert into public.audit_logs (
    organization_id,
    resident_id,
    action,
    resource_type,
    resource_id,
    description
  ) values (
    requested_organization_id,
    requested_resident_id,
    'public_intake_submitted',
    'resident',
    requested_resident_id,
    'Public intake submitted; background-check consent recorded. No screening was initiated.'
  )
  returning id into audit_id;

  return audit_id;
end;
$$;

revoke execute on function public.record_public_intake_submission_audit(uuid, uuid)
from public, anon, authenticated;
grant execute on function public.record_public_intake_submission_audit(uuid, uuid)
to service_role;

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
        and r.status = 'active'
    );
$$;

revoke execute on function public.is_resident_self(uuid, uuid) from public, anon;
grant execute on function public.is_resident_self(uuid, uuid) to authenticated;

create unique index if not exists residents_one_user_per_account_idx
on public.residents (user_id)
where user_id is not null;

create or replace function public.can_access_resident(org_id uuid, requested_resident_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_resident_self(org_id, requested_resident_id)
    or (
      public.current_access_role(org_id) is distinct from 'resident'
      and exists (
        select 1
        from public.residents r
        where r.id = requested_resident_id
          and r.organization_id = org_id
          and public.can_access_location(org_id, r.location_id)
      )
    );
$$;

revoke execute on function public.can_access_resident(uuid, uuid) from public, anon;
grant execute on function public.can_access_resident(uuid, uuid) to authenticated;

drop policy if exists residents_select_location on public.residents;
create policy residents_select_location on public.residents
for select using (
  public.is_resident_self(organization_id, id)
  or (
    public.current_access_role(organization_id) is distinct from 'resident'
    and public.can_access_location(organization_id, location_id)
  )
);

create or replace function public.enforce_resident_self_service_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  server_now timestamptz := statement_timestamp();
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

    if tg_op = 'INSERT' then
      new.created_at := server_now;
      new.updated_at := server_now;
      new.created_by := auth.uid();
      new.updated_by := auth.uid();
      return new;
    end if;

    if tg_op <> 'UPDATE' or (
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
    if tg_op = 'INSERT' then
      return new;
    end if;

    if tg_op <> 'UPDATE' then
      raise exception 'Residents may update only their own signature response fields'
        using errcode = '42501';
    end if;

    if old.status in ('signed', 'declined') then
      raise exception 'Completed signature responses are immutable' using errcode = '23514';
    end if;

    if old.status not in ('pending', 'viewed')
      or new.status not in ('viewed', 'signed', 'declined')
      or (to_jsonb(new) - array[
          'status', 'viewed_at', 'signed_at', 'signature_data', 'signature_name',
          'decline_reason', 'updated_at', 'updated_by'
        ]) is distinct from
        (to_jsonb(old) - array[
          'status', 'viewed_at', 'signed_at', 'signature_data', 'signature_name',
          'decline_reason', 'updated_at', 'updated_by'
        ]) then
      raise exception 'Residents may update only their own signature response fields'
        using errcode = '42501';
    end if;

    if new.status = 'viewed' then
      if (
        new.signature_name is distinct from old.signature_name
        and nullif(btrim(new.signature_name), '') is not null
      ) or (
        new.signature_data is distinct from old.signature_data
        and nullif(btrim(new.signature_data), '') is not null
      ) or (
        new.signed_at is distinct from old.signed_at
        and new.signed_at is not null
      ) or (
        new.decline_reason is distinct from old.decline_reason
        and nullif(btrim(new.decline_reason), '') is not null
      ) then
        raise exception 'Viewed signatures cannot include a terminal response'
          using errcode = '22023';
      end if;

      new.viewed_at := coalesce(old.viewed_at, server_now);
      new.signed_at := null;
      new.signature_data := null;
      new.signature_name := null;
      new.decline_reason := null;
    elsif new.status = 'signed' then
      if nullif(btrim(new.signature_name), '') is null then
        raise exception 'A signature name is required' using errcode = '22023';
      end if;
      if nullif(btrim(new.signature_data), '') is null
        or btrim(new.signature_data) !~* '^data:image/[a-z0-9.+-]+;base64,[a-z0-9+/]+={0,2}$' then
        raise exception 'Valid data:image signature data is required' using errcode = '22023';
      end if;
      if new.decline_reason is distinct from old.decline_reason
        and nullif(btrim(new.decline_reason), '') is not null then
        raise exception 'Signed responses cannot include a decline reason'
          using errcode = '22023';
      end if;

      new.viewed_at := old.viewed_at;
      new.signature_name := btrim(new.signature_name);
      new.signature_data := btrim(new.signature_data);
      new.signed_at := server_now;
      new.decline_reason := null;
    else
      if nullif(btrim(new.decline_reason), '') is null then
        raise exception 'A decline reason is required' using errcode = '22023';
      end if;
      if (
        new.signature_name is distinct from old.signature_name
        and nullif(btrim(new.signature_name), '') is not null
      ) or (
        new.signature_data is distinct from old.signature_data
        and nullif(btrim(new.signature_data), '') is not null
      ) then
        raise exception 'Declined responses cannot include signature data'
          using errcode = '22023';
      end if;

      new.viewed_at := old.viewed_at;
      new.decline_reason := btrim(new.decline_reason);
      new.signature_name := null;
      new.signature_data := null;
      new.signed_at := null;
    end if;

    new.updated_by := auth.uid();
    return new;
  end if;

  raise exception 'Resident mutation is not a permitted self-service action'
    using errcode = '42501';
end;
$$;

revoke execute on function public.enforce_resident_self_service_mutation()
from public, anon, authenticated;

create or replace function public.enforce_last_active_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.role <> 'owner' or old.status <> 'active' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if tg_op = 'UPDATE'
    and new.organization_id = old.organization_id
    and new.role = 'owner'
    and new.status = 'active' then
    return new;
  end if;

  perform 1
  from public.organizations
  where id = old.organization_id
  for update;

  if not exists (
    select 1
    from public.organization_members om
    where om.organization_id = old.organization_id
      and om.id <> old.id
      and om.role = 'owner'
      and om.status = 'active'
  ) then
    raise exception 'The organization must retain at least one active owner'
      using errcode = '23514';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke execute on function public.enforce_last_active_owner()
from public, anon, authenticated, service_role;

drop trigger if exists organization_members_preserve_last_owner
on public.organization_members;
create trigger organization_members_preserve_last_owner
before update or delete on public.organization_members
for each row execute function public.enforce_last_active_owner();

create or replace function public.clear_sample_data(p_batch_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  table_name text;
  deleted_count integer;
  total_deleted integer := 0;
  detail jsonb := '{}'::jsonb;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'clear_sample_data requires server-side service credentials';
  end if;

  foreach table_name in array array[
    'bed_assignments','chore_assignments','chore_templates','chat_messages','chat_channels',
    'grant_enrollments','grants','vital_readings','task_logs','signature_requests','shifts',
    'resident_payments','resident_outcomes','resident_milestones','resident_interviews',
    'resident_fees','procurement_requests','morning_reflections','maintenance_tickets',
    'location_expenses','integration_configs','inventory_requests','inventory_items','audit_logs',
    'compliance_evidence','compliance_items','training_completions','training_modules',
    'staff_tasks','incident_reports','medication_logs','medications','care_plan_tasks',
    'care_plan_goals','secure_documents','resident_documents','resident_contacts','residents',
    'staff_profiles','locations','organization_members','organizations'
  ] loop
    -- The table lock held by ALTER keeps the last-owner trigger bypass local to
    -- this service-only deletion of explicitly tagged sample memberships.
    if table_name = 'organization_members' then
      alter table public.organization_members
        disable trigger organization_members_preserve_last_owner;
    end if;

    execute format(
      'delete from public.%I where is_sample_data = true and ($1::uuid is null or sample_data_batch_id = $1)',
      table_name
    )
    using p_batch_id;

    get diagnostics deleted_count = row_count;

    if table_name = 'organization_members' then
      alter table public.organization_members
        enable trigger organization_members_preserve_last_owner;
    end if;

    total_deleted := total_deleted + deleted_count;
    detail := detail || jsonb_build_object(table_name, deleted_count);
  end loop;

  delete from public.sample_data_registry
  where p_batch_id is null or batch_id = p_batch_id;

  delete from public.sample_data_batches
  where p_batch_id is null or id = p_batch_id;

  return jsonb_build_object(
    'ok', true,
    'batch_id', p_batch_id,
    'deleted_rows', total_deleted,
    'tables', detail
  );
end;
$$;

revoke all on function public.clear_sample_data(uuid) from public, anon, authenticated;
grant execute on function public.clear_sample_data(uuid) to service_role;
