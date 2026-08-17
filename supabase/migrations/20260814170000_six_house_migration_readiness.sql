create table public.organization_member_locations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  organization_member_id uuid not null references public.organization_members(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique (organization_member_id, location_id)
);

create table public.migration_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  source_system text not null default 'oathtrack',
  source_manifest jsonb not null default '{}'::jsonb,
  source_sha256 text not null,
  status text not null default 'pending'
    check (status in ('pending','validated','importing','completed','failed','rolled_back')),
  expected_counts jsonb not null default '{}'::jsonb,
  imported_counts jsonb not null default '{}'::jsonb,
  error_summary jsonb not null default '[]'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create table public.migration_source_records (
  id uuid primary key default gen_random_uuid(),
  migration_run_id uuid not null references public.migration_runs(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  source_system text not null default 'oathtrack',
  source_entity text not null,
  source_id text not null,
  source_sha256 text not null,
  target_table text,
  target_id uuid,
  status text not null default 'pending'
    check (status in ('pending','imported','skipped','failed','rolled_back')),
  normalized_payload jsonb,
  error_message text,
  imported_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (migration_run_id, source_entity, source_id)
);

create table public.public_intake_tokens (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  token_hash text not null unique,
  label text not null default 'Website intake',
  is_active boolean not null default true,
  expires_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create index organization_member_locations_org_idx
  on public.organization_member_locations (organization_id);
create index organization_member_locations_location_idx
  on public.organization_member_locations (location_id);
create index migration_runs_org_idx on public.migration_runs (organization_id, created_at desc);
create index migration_runs_source_idx on public.migration_runs (organization_id, source_system, source_sha256);
create index migration_source_records_run_idx on public.migration_source_records (migration_run_id);
create index migration_source_records_target_idx on public.migration_source_records (target_table, target_id);
create unique index migration_source_records_active_source_unique
  on public.migration_source_records (organization_id, source_system, source_entity, source_id)
  where status = 'imported';
create index public_intake_tokens_org_idx on public.public_intake_tokens (organization_id);
create unique index staff_profiles_organization_user_unique
  on public.staff_profiles (organization_id, user_id);

create trigger migration_runs_set_updated_at
before update on public.migration_runs
for each row execute function public.set_updated_at();

create trigger migration_source_records_set_updated_at
before update on public.migration_source_records
for each row execute function public.set_updated_at();

create trigger public_intake_tokens_set_updated_at
before update on public.public_intake_tokens
for each row execute function public.set_updated_at();

alter table public.organization_member_locations enable row level security;
alter table public.migration_runs enable row level security;
alter table public.migration_source_records enable row level security;
alter table public.public_intake_tokens enable row level security;

create or replace function public.current_org_role(org_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.organization_members
  where organization_id = org_id
    and user_id = auth.uid()
    and status = 'active'
  limit 1;
$$;

create or replace function public.can_access_location(org_id uuid, requested_location_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when auth.uid() is null then false
    when public.current_org_role(org_id) in ('admin','owner') then true
    when requested_location_id is null then false
    else exists (
      select 1
      from public.organization_members om
      join public.organization_member_locations oml
        on oml.organization_member_id = om.id
       and oml.organization_id = om.organization_id
      where om.organization_id = org_id
        and om.user_id = auth.uid()
        and om.status = 'active'
        and oml.location_id = requested_location_id
    )
  end;
$$;

create or replace function public.can_access_resident(org_id uuid, requested_resident_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.residents r
    where r.id = requested_resident_id
      and r.organization_id = org_id
      and (
        r.user_id = auth.uid()
        or public.can_access_location(org_id, r.location_id)
      )
  );
$$;

revoke execute on function public.current_org_role(uuid) from public, anon;
revoke execute on function public.can_access_location(uuid, uuid) from public, anon;
revoke execute on function public.can_access_resident(uuid, uuid) from public, anon;
grant execute on function public.current_org_role(uuid) to authenticated;
grant execute on function public.can_access_location(uuid, uuid) to authenticated;
grant execute on function public.can_access_resident(uuid, uuid) to authenticated;

create policy organization_member_locations_select
on public.organization_member_locations
for select using (
  public.is_org_admin(organization_id)
  or exists (
    select 1 from public.organization_members om
    where om.id = organization_member_id and om.user_id = auth.uid()
  )
);

create policy organization_member_locations_admin
on public.organization_member_locations
for all using (public.is_org_admin(organization_id))
with check (public.is_org_admin(organization_id));

create policy migration_runs_admin
on public.migration_runs
for all using (public.is_org_admin(organization_id))
with check (public.is_org_admin(organization_id));

create policy migration_source_records_admin
on public.migration_source_records
for all using (public.is_org_admin(organization_id))
with check (public.is_org_admin(organization_id));

create policy public_intake_tokens_admin
on public.public_intake_tokens
for all using (public.is_org_admin(organization_id))
with check (public.is_org_admin(organization_id));

create or replace function public.rotate_public_intake_token(
  p_organization_id uuid,
  p_label text default 'Website intake',
  p_expires_at timestamptz default null
)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  raw_token text;
begin
  if not public.is_org_admin(p_organization_id) then
    raise exception 'Only organization administrators can rotate public intake tokens';
  end if;

  update public.public_intake_tokens
  set is_active = false
  where organization_id = p_organization_id and is_active = true;

  raw_token := encode(gen_random_bytes(32), 'hex');

  insert into public.public_intake_tokens (
    organization_id,
    token_hash,
    label,
    expires_at,
    created_by
  ) values (
    p_organization_id,
    encode(digest(raw_token, 'sha256'), 'hex'),
    coalesce(nullif(trim(p_label), ''), 'Website intake'),
    p_expires_at,
    auth.uid()
  );

  return raw_token;
end;
$$;

revoke execute on function public.rotate_public_intake_token(uuid, text, timestamptz) from public, anon;
grant execute on function public.rotate_public_intake_token(uuid, text, timestamptz) to authenticated;

drop policy if exists locations_select_members on public.locations;
drop policy if exists locations_insert_members on public.locations;
drop policy if exists locations_update_members on public.locations;
create policy locations_select_location on public.locations
for select using (public.can_access_location(organization_id, id));
create policy locations_insert_location on public.locations
for insert with check (public.is_org_admin(organization_id));
create policy locations_update_location on public.locations
for update using (public.can_access_location(organization_id, id))
with check (public.can_access_location(organization_id, id));

drop policy if exists "Members can read bed assignments" on public.bed_assignments;
drop policy if exists "Members can create bed assignments" on public.bed_assignments;
drop policy if exists "Members can update bed assignments" on public.bed_assignments;

-- Replace broad organization-only policies on records that directly identify a house.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'bed_assignments','shifts','compliance_items','inventory_items','inventory_requests',
    'location_expenses','maintenance_tickets'
  ] loop
    execute format('drop policy if exists %I on public.%I', table_name || '_select_members', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_insert_members', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_update_members', table_name);
    execute format(
      'create policy %I on public.%I for select using (public.can_access_location(organization_id, location_id))',
      table_name || '_select_location', table_name
    );
    execute format(
      'create policy %I on public.%I for insert with check (public.can_access_location(organization_id, location_id))',
      table_name || '_insert_location', table_name
    );
    execute format(
      'create policy %I on public.%I for update using (public.can_access_location(organization_id, location_id)) with check (public.can_access_location(organization_id, location_id))',
      table_name || '_update_location', table_name
    );
  end loop;
end $$;

-- Records tied to a resident inherit that resident's house boundary.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'resident_contacts','care_plan_goals','care_plan_tasks','medications','medication_logs',
    'morning_reflections','procurement_requests','resident_interviews','resident_milestones',
    'resident_outcomes','resident_payments','signature_requests','task_logs','vital_readings'
  ] loop
    execute format('drop policy if exists %I on public.%I', table_name || '_select_members', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_insert_members', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_update_members', table_name);
    execute format(
      'create policy %I on public.%I for select using (public.can_access_resident(organization_id, resident_id))',
      table_name || '_select_resident', table_name
    );
    execute format(
      'create policy %I on public.%I for insert with check (public.can_access_resident(organization_id, resident_id))',
      table_name || '_insert_resident', table_name
    );
    execute format(
      'create policy %I on public.%I for update using (public.can_access_resident(organization_id, resident_id)) with check (public.can_access_resident(organization_id, resident_id))',
      table_name || '_update_resident', table_name
    );
  end loop;
end $$;

-- Mixed-scope records can be reached through either their house or resident.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'incident_reports','staff_tasks','resident_documents','secure_documents','resident_fees'
  ] loop
    execute format('drop policy if exists %I on public.%I', table_name || '_select_members', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_insert_members', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_update_members', table_name);
    execute format(
      'create policy %I on public.%I for select using (public.can_access_location(organization_id, location_id) or public.can_access_resident(organization_id, resident_id) or (location_id is null and resident_id is null and public.is_org_admin(organization_id)))',
      table_name || '_select_scope', table_name
    );
    execute format(
      'create policy %I on public.%I for insert with check (public.can_access_location(organization_id, location_id) or public.can_access_resident(organization_id, resident_id) or (location_id is null and resident_id is null and public.is_org_admin(organization_id)))',
      table_name || '_insert_scope', table_name
    );
    execute format(
      'create policy %I on public.%I for update using (public.can_access_location(organization_id, location_id) or public.can_access_resident(organization_id, resident_id) or (location_id is null and resident_id is null and public.is_org_admin(organization_id))) with check (public.can_access_location(organization_id, location_id) or public.can_access_resident(organization_id, resident_id) or (location_id is null and resident_id is null and public.is_org_admin(organization_id)))',
      table_name || '_update_scope', table_name
    );
  end loop;
end $$;

-- Residents without a placement are visible only to leadership until assigned.
drop policy if exists residents_select_members on public.residents;
drop policy if exists residents_insert_members on public.residents;
drop policy if exists residents_update_members on public.residents;
drop policy if exists residents_select_location on public.residents;
drop policy if exists residents_insert_location on public.residents;
drop policy if exists residents_update_location on public.residents;
create policy residents_select_location on public.residents
for select using (
  user_id = auth.uid()
  or public.can_access_location(organization_id, location_id)
  or (location_id is null and public.is_org_admin(organization_id))
);
create policy residents_insert_location on public.residents
for insert with check (
  public.can_access_location(organization_id, location_id)
  or (location_id is null and public.is_org_admin(organization_id))
);
create policy residents_update_location on public.residents
for update using (
  public.can_access_location(organization_id, location_id)
  or (location_id is null and public.is_org_admin(organization_id))
) with check (
  public.can_access_location(organization_id, location_id)
  or (location_id is null and public.is_org_admin(organization_id))
);

-- Staff profiles and assignments are administrative records, not organization-wide writable data.
drop policy if exists staff_profiles_select_members on public.staff_profiles;
drop policy if exists staff_profiles_insert_members on public.staff_profiles;
drop policy if exists staff_profiles_update_members on public.staff_profiles;
create policy staff_profiles_select_scope on public.staff_profiles
for select using (
  public.is_org_admin(organization_id)
  or user_id = auth.uid()
  or exists (
    select 1
    from unnest(location_ids) assigned_location
    where public.can_access_location(organization_id, assigned_location)
  )
);
create policy staff_profiles_insert_admin on public.staff_profiles
for insert with check (public.is_org_admin(organization_id));
create policy staff_profiles_update_admin on public.staff_profiles
for update using (public.is_org_admin(organization_id))
with check (public.is_org_admin(organization_id));

create or replace function public.audit_sensitive_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  row_data jsonb;
  org_id uuid;
  subject_resident_id uuid;
  resource_id uuid;
begin
  row_data := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  org_id := nullif(row_data->>'organization_id', '')::uuid;
  resource_id := nullif(row_data->>'id', '')::uuid;
  subject_resident_id := case
    when tg_table_name = 'residents' and tg_op <> 'DELETE' then resource_id
    else nullif(row_data->>'resident_id', '')::uuid
  end;

  if org_id is not null then
    insert into public.audit_logs (
      organization_id, performed_by_id, resident_id, action, resource_type,
      resource_id, description
    ) values (
      org_id, auth.uid(), subject_resident_id, lower(tg_op), tg_table_name,
      resource_id, format('%s %s record', initcap(lower(tg_op)), tg_table_name)
    );
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'residents','resident_contacts','resident_documents','secure_documents','medications',
    'medication_logs','incident_reports','bed_assignments','staff_profiles','shifts',
    'care_plan_goals','care_plan_tasks','resident_fees','resident_payments'
  ] loop
    execute format('drop trigger if exists %I on public.%I', table_name || '_audit_sensitive_mutation', table_name);
    execute format(
      'create trigger %I after insert or update or delete on public.%I for each row execute function public.audit_sensitive_mutation()',
      table_name || '_audit_sensitive_mutation', table_name
    );
  end loop;
end $$;

drop policy if exists audit_logs_select_members on public.audit_logs;
drop policy if exists audit_logs_insert_members on public.audit_logs;
drop policy if exists audit_logs_update_members on public.audit_logs;
create policy audit_logs_select_scope on public.audit_logs
for select using (
  public.is_org_admin(organization_id)
  or (resident_id is not null and public.can_access_resident(organization_id, resident_id))
);

create or replace function public.record_document_access(p_bucket text, p_path text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  document_record record;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  select d.organization_id, d.resident_id, d.location_id, d.id, 'resident_documents'::text as resource_type
  into document_record
  from public.resident_documents d
  where d.storage_bucket = p_bucket and d.storage_path = p_path
  union all
  select d.organization_id, d.resident_id, d.location_id, d.id, 'secure_documents'::text
  from public.secure_documents d
  where d.storage_bucket = p_bucket and d.storage_path = p_path
  union all
  select d.organization_id, null::uuid, d.location_id, d.id, 'compliance_items'::text
  from public.compliance_items d
  where p_bucket = 'secure-documents' and d.document_url = p_path
  limit 1;

  if document_record.id is null
     or not (
       public.is_org_admin(document_record.organization_id)
       or public.can_access_resident(document_record.organization_id, document_record.resident_id)
       or public.can_access_location(document_record.organization_id, document_record.location_id)
     ) then
    raise exception 'Document access denied';
  end if;

  insert into public.audit_logs (
    organization_id, performed_by_id, resident_id, action, resource_type, resource_id, description
  ) values (
    document_record.organization_id, auth.uid(), document_record.resident_id,
    'viewed_document', document_record.resource_type, document_record.id, 'Opened a protected document'
  );
end;
$$;

revoke execute on function public.audit_sensitive_mutation() from public, anon, authenticated;
revoke execute on function public.record_document_access(text, text) from public, anon;
grant execute on function public.record_document_access(text, text) to authenticated;

drop policy if exists "Members can read organization storage files" on storage.objects;
create policy "Scoped members can read protected storage files" on storage.objects
for select using (
  exists (
    select 1 from public.resident_documents d
    where d.storage_bucket = bucket_id and d.storage_path = name
      and (public.is_org_admin(d.organization_id) or public.can_access_resident(d.organization_id, d.resident_id))
  )
  or exists (
    select 1 from public.secure_documents d
    where d.storage_bucket = bucket_id and d.storage_path = name
      and (public.is_org_admin(d.organization_id) or public.can_access_resident(d.organization_id, d.resident_id))
  )
  or exists (
    select 1 from public.compliance_items d
    where bucket_id = 'secure-documents' and d.document_url = name
      and (public.is_org_admin(d.organization_id) or public.can_access_location(d.organization_id, d.location_id))
  )
);

-- RLS evaluates only after the API role has table privileges.
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant usage on schema public to service_role;
grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant usage, select on sequences to authenticated;
alter default privileges in schema public
  grant all privileges on tables to service_role;
alter default privileges in schema public
  grant all privileges on sequences to service_role;

revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
