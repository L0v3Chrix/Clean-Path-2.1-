create table if not exists public.sample_data_batches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  label text not null,
  description text,
  created_by_tool text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.sample_data_registry (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.sample_data_batches(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  resource_type text not null check (resource_type in ('table_row','storage_object','auth_user')),
  table_name text,
  record_id uuid,
  storage_bucket text,
  storage_path text,
  external_id text,
  record_label text,
  created_at timestamptz default now()
);

create table if not exists public.bed_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  resident_id uuid references public.residents(id) on delete set null,
  bed_label text not null,
  room text,
  bed_number text,
  status text default 'available' check (status in ('available','occupied','reserved','maintenance')),
  assigned_at timestamptz,
  expected_move_out_date date,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'organizations','organization_members','locations','staff_profiles','residents','resident_contacts',
    'resident_documents','secure_documents','care_plan_goals','care_plan_tasks','medications',
    'medication_logs','incident_reports','staff_tasks','training_modules','training_completions',
    'compliance_items','compliance_evidence','audit_logs','inventory_items','inventory_requests',
    'integration_configs','location_expenses','maintenance_tickets','morning_reflections',
    'procurement_requests','resident_fees','resident_interviews','resident_milestones',
    'resident_outcomes','resident_payments','shifts','signature_requests','task_logs',
    'vital_readings','grants','grant_enrollments','chat_channels','chat_messages',
    'chore_templates','chore_assignments','bed_assignments'
  ] loop
    execute format('alter table public.%I add column if not exists is_sample_data boolean not null default false', table_name);
    execute format('alter table public.%I add column if not exists sample_data_batch_id uuid references public.sample_data_batches(id) on delete set null', table_name);
    execute format('create index if not exists %I on public.%I (sample_data_batch_id) where is_sample_data', table_name || '_sample_data_batch_id_idx', table_name);
  end loop;
end $$;

create trigger sample_data_batches_set_updated_at
before update on public.sample_data_batches
for each row execute function public.set_updated_at();

create trigger bed_assignments_set_updated_at
before update on public.bed_assignments
for each row execute function public.set_updated_at();

alter table public.sample_data_batches enable row level security;
alter table public.sample_data_registry enable row level security;
alter table public.bed_assignments enable row level security;

create policy "Admins can read sample data batches" on public.sample_data_batches
for select using (public.is_org_admin(organization_id));

create policy "Admins can manage sample data batches" on public.sample_data_batches
for all using (public.is_org_admin(organization_id)) with check (public.is_org_admin(organization_id));

create policy "Admins can read sample data registry" on public.sample_data_registry
for select using (public.is_org_admin(organization_id));

create policy "Admins can manage sample data registry" on public.sample_data_registry
for all using (public.is_org_admin(organization_id)) with check (public.is_org_admin(organization_id));

create policy "Members can read bed assignments" on public.bed_assignments
for select using (public.is_org_member(organization_id));

create policy "Members can create bed assignments" on public.bed_assignments
for insert with check (public.is_org_member(organization_id));

create policy "Members can update bed assignments" on public.bed_assignments
for update using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));

create policy "Admins can delete bed assignments" on public.bed_assignments
for delete using (public.is_org_admin(organization_id));

create index if not exists sample_data_batches_organization_id_idx
on public.sample_data_batches (organization_id);

create index if not exists sample_data_registry_batch_id_idx
on public.sample_data_registry (batch_id);

create index if not exists sample_data_registry_storage_idx
on public.sample_data_registry (storage_bucket, storage_path)
where resource_type = 'storage_object';

create index if not exists bed_assignments_organization_id_idx
on public.bed_assignments (organization_id);

create index if not exists bed_assignments_location_id_idx
on public.bed_assignments (location_id);

create index if not exists bed_assignments_resident_id_idx
on public.bed_assignments (resident_id);

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
    execute format(
      'delete from public.%I where is_sample_data = true and ($1::uuid is null or sample_data_batch_id = $1)',
      table_name
    )
    using p_batch_id;

    get diagnostics deleted_count = row_count;
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

revoke all on function public.clear_sample_data(uuid) from anon, authenticated;
grant execute on function public.clear_sample_data(uuid) to service_role;
