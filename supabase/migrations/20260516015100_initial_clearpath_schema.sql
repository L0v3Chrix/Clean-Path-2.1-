create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  housing_type text,
  narr_level text check (narr_level in ('I','II','III','IV','not_applicable') or narr_level is null),
  state text,
  narr_affiliate text,
  mission_statement text,
  vision_statement text,
  recovery_pathways text[] default '{}',
  harm_reduction_enabled boolean default false,
  logo_url text,
  phone text,
  email text,
  website text,
  address text,
  status text default 'trial' check (status in ('active','inactive','trial')),
  house_rules text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'staff' check (role in ('owner','admin','staff','resident')),
  display_name text,
  email text,
  status text default 'active' check (status in ('active','inactive','invited')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  unique (organization_id, user_id)
);

create or replace function public.is_org_member(org_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.organization_members om
    where om.organization_id = org_id
      and om.user_id = auth.uid()
      and om.status = 'active'
  );
$$;

create or replace function public.is_org_admin(org_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.organization_members om
    where om.organization_id = org_id
      and om.user_id = auth.uid()
      and om.status = 'active'
      and om.role in ('owner','admin')
  );
$$;

create or replace function public.bootstrap_organization_owner(
  p_organization_id uuid,
  p_display_name text default null,
  p_email text default null
)
returns public.organization_members
language plpgsql
security definer
set search_path = public
as $$
declare
  membership public.organization_members;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not exists (select 1 from public.organizations where id = p_organization_id) then
    raise exception 'Organization not found';
  end if;

  select *
  into membership
  from public.organization_members
  where organization_id = p_organization_id
    and user_id = auth.uid();

  if membership.id is not null then
    return membership;
  end if;

  if exists (
    select 1
    from public.organization_members
    where organization_id = p_organization_id
      and status = 'active'
  ) then
    raise exception 'Organization already has active members';
  end if;

  insert into public.organization_members (
    organization_id, user_id, role, display_name, email, status, created_by, updated_by
  ) values (
    p_organization_id, auth.uid(), 'owner', p_display_name, p_email, 'active', auth.uid(), auth.uid()
  )
  returning * into membership;

  return membership;
end;
$$;

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  address text,
  city text,
  state text,
  zip text,
  housing_type text,
  narr_level text check (narr_level in ('I','II','III','IV','not_applicable') or narr_level is null),
  total_beds integer default 0,
  occupied_beds integer default 0,
  house_manager_id uuid,
  phone text,
  status text default 'active' check (status in ('active','inactive')),
  certifications text[] default '{}',
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

create table public.staff_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  location_ids uuid[] default '{}',
  first_name text not null,
  last_name text not null,
  email text,
  phone text,
  role text not null default 'staff' check (role in ('platform_admin','owner','director','house_manager','peer_support','case_manager','staff','volunteer')),
  title text,
  certifications text[] default '{}',
  hire_date date,
  status text default 'active' check (status in ('active','inactive')),
  lived_experience boolean default false,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

create table public.residents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  location_id uuid references public.locations(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  first_name text not null,
  last_name text not null,
  preferred_name text,
  date_of_birth date,
  phone text,
  email text,
  status text default 'applicant' check (status in ('applicant','active','on_leave','exited','alumni')),
  room text,
  phase text,
  intake_date date,
  exit_date date,
  sober_date date,
  recovery_pathway text,
  referred_by text,
  photo_url text,
  emergency_notes text,
  key_alerts text,
  recovery_notes text,
  medication_notes text,
  notes text,
  consent_signed boolean default false,
  resident_agreement_signed boolean default false,
  background_check_status text default 'not_started',
  background_check_consent boolean default false,
  background_check_date date,
  background_check_notes text,
  gender_identity text,
  gender_identity_other text,
  pronouns text,
  pronouns_other text,
  sexual_orientation text,
  sexual_orientation_other text,
  transition_status text,
  race text,
  race_other text,
  ethnicity text,
  primary_language text,
  primary_language_other text,
  interpreter_needed boolean default false,
  religion_spirituality text,
  religion_other text,
  veteran_status text,
  disability_status text,
  housing_status_at_intake text,
  trauma_informed_notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

create table public.resident_contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  resident_id uuid not null references public.residents(id) on delete cascade,
  name text not null,
  relationship text,
  phone text,
  email text,
  is_emergency_contact boolean default true,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

create table public.resident_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  resident_id uuid references public.residents(id) on delete cascade,
  location_id uuid references public.locations(id) on delete set null,
  title text,
  document_type text not null,
  label text,
  storage_bucket text default 'resident-documents',
  storage_path text,
  file_url text,
  signed_at timestamptz,
  signed_date date,
  expires_at timestamptz,
  expiry_date date,
  status text default 'missing' check (status in ('current','expiring_soon','expired','missing')),
  visibility_scope text default 'staff_and_admin',
  metadata jsonb default '{}',
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

create table public.secure_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  resident_id uuid references public.residents(id) on delete set null,
  location_id uuid references public.locations(id) on delete set null,
  resident_name text,
  folder text default 'other',
  title text not null,
  description text,
  document_type text,
  storage_bucket text default 'secure-documents',
  storage_path text,
  file_url text,
  file_name text,
  file_type text,
  file_size_kb numeric,
  signed_at timestamptz,
  expires_at timestamptz,
  access_level text default 'staff_and_admin',
  visibility_scope text default 'staff_and_admin',
  uploaded_by_name text,
  uploaded_by_id uuid,
  tags text[] default '{}',
  metadata jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

create table public.care_plan_goals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  resident_id uuid not null references public.residents(id) on delete cascade,
  term text not null check (term in ('short_term','long_term')),
  category text not null,
  title text not null,
  description text,
  target_date date,
  status text default 'not_started' check (status in ('not_started','in_progress','completed','on_hold','discontinued')),
  progress_notes text,
  completed_date date,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

create table public.care_plan_tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  resident_id uuid not null references public.residents(id) on delete cascade,
  goal_id uuid references public.care_plan_goals(id) on delete set null,
  title text not null,
  description text,
  recurrence text default 'once',
  due_date date,
  assigned_to_id uuid,
  assigned_to_name text,
  status text default 'pending' check (status in ('pending','completed','overdue','cancelled')),
  completed_date date,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

create table public.medications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  resident_id uuid not null references public.residents(id) on delete cascade,
  medication_name text not null,
  name text,
  generic_name text,
  dosage text not null,
  schedule text,
  form text default 'tablet',
  route text default 'oral',
  frequency text default 'once_daily',
  scheduled_times text[] default '{}',
  prescribing_provider text,
  prescriber text,
  pharmacy text,
  rx_number text,
  instructions text,
  start_date date,
  end_date date,
  status text default 'active' check (status in ('active','paused','discontinued','completed')),
  bottle_photo_path text,
  qr_code text,
  controlled_substance boolean default false,
  mat_medication boolean default false,
  current_quantity numeric,
  quantity_unit text default 'tablets',
  low_stock_threshold numeric,
  reorder_quantity numeric,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

create table public.medication_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  resident_id uuid not null references public.residents(id) on delete cascade,
  medication_id uuid not null references public.medications(id) on delete cascade,
  scheduled_at timestamptz,
  scheduled_date date,
  scheduled_time text,
  administered_at timestamptz,
  administered_by uuid references auth.users(id),
  administered_by_name text,
  status text default 'administered' check (status in ('administered','missed','refused','held','self_administered')),
  outcome text,
  missed_reason text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

create table public.incident_reports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  resident_id uuid references public.residents(id) on delete set null,
  location_id uuid references public.locations(id) on delete set null,
  reported_by uuid references auth.users(id),
  reported_by_id uuid,
  category text,
  type text,
  severity text,
  incident_date date not null,
  incident_time text,
  description text not null,
  people_involved text,
  involved_staff_names text,
  immediate_action text,
  action_taken text,
  follow_up_required boolean default false,
  follow_up_notes text,
  status text default 'open' check (status in ('open','in_review','resolved','closed')),
  naloxone_used boolean default false,
  ems_called boolean default false,
  confidential boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

create table public.staff_tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  location_id uuid references public.locations(id) on delete set null,
  resident_id uuid references public.residents(id) on delete set null,
  title text not null,
  description text,
  assigned_to uuid references auth.users(id),
  assigned_to_name text,
  due_at timestamptz,
  status text default 'pending' check (status in ('pending','in_progress','completed','cancelled')),
  priority text default 'medium' check (priority in ('low','medium','high','urgent')),
  handoff_notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

create table public.training_modules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  description text,
  category text default 'onboarding',
  content_type text default 'slides',
  file_url text,
  external_url text,
  slides jsonb default '[]',
  required_for_roles text[] default '{}',
  estimated_minutes integer,
  status text default 'draft' check (status in ('draft','published','archived')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

create table public.training_completions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  module_id uuid not null references public.training_modules(id) on delete cascade,
  staff_id uuid not null references public.staff_profiles(id) on delete cascade,
  completed_date date not null,
  score numeric,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

create table public.compliance_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  location_id uuid references public.locations(id) on delete set null,
  standard_source text default 'NARR' check (standard_source in ('NARR','state','internal','other')),
  domain text,
  requirement_code text,
  requirement_text text,
  rule_id text,
  rule_name text,
  status text default 'not_applicable' check (status in ('compliant','in_progress','not_met','variance_requested','not_applicable')),
  evidence_document_id uuid,
  evidence_notes text,
  document_url text,
  due_date date,
  assigned_to uuid references auth.users(id),
  last_reviewed date,
  reviewed_by_id uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

create table public.compliance_evidence (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  compliance_item_id uuid not null references public.compliance_items(id) on delete cascade,
  secure_document_id uuid references public.secure_documents(id) on delete set null,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

alter table public.compliance_items
  add constraint compliance_items_evidence_document_id_fkey
  foreign key (evidence_document_id) references public.compliance_evidence(id) on delete set null;

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  performed_by_id uuid references auth.users(id),
  performed_by_name text,
  resident_id uuid references public.residents(id) on delete set null,
  action text default 'viewed_record',
  resource_type text not null,
  resource_id uuid,
  description text,
  ip_address text,
  access_reason text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  location_id uuid references public.locations(id) on delete set null,
  name text not null,
  category text default 'other',
  unit text default 'units',
  current_quantity numeric default 0,
  low_stock_threshold numeric default 2,
  reorder_quantity numeric,
  notes text,
  status text default 'in_stock' check (status in ('in_stock','low_stock','out_of_stock')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

create table public.inventory_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  location_id uuid references public.locations(id) on delete set null,
  item_id uuid references public.inventory_items(id) on delete set null,
  item_name text not null,
  category text default 'other',
  requested_by_name text not null,
  requested_by_id uuid,
  quantity_requested numeric default 1,
  urgency text default 'medium' check (urgency in ('low','medium','high')),
  notes text,
  status text default 'pending' check (status in ('pending','ordered','fulfilled','denied')),
  staff_notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

create table public.integration_configs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  integration_name text not null,
  integration_type text not null,
  status text default 'disconnected' check (status in ('connected','disconnected','pending','error')),
  config_notes text,
  connected_date date,
  last_synced timestamptz,
  metadata jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

create table public.location_expenses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  label text not null,
  category text default 'other',
  amount numeric not null,
  frequency text default 'monthly',
  due_day_of_month integer,
  vendor text,
  account_number text,
  auto_pay boolean default false,
  status text default 'active',
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

create table public.maintenance_tickets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  location_id uuid references public.locations(id) on delete set null,
  location_name text,
  room text,
  title text not null,
  description text,
  category text default 'other',
  priority text default 'medium',
  status text default 'open',
  submitted_by_name text,
  submitted_by_id uuid,
  submitted_by_email text,
  assigned_to_name text,
  assigned_to_id uuid,
  photo_url text,
  resolution_notes text,
  completed_at timestamptz,
  due_date date,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

create table public.morning_reflections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  resident_id uuid not null references public.residents(id) on delete cascade,
  log_date date not null,
  mood numeric not null,
  physical_wellbeing numeric,
  sleep_quality numeric not null,
  sleep_hours numeric,
  daily_goal text,
  gratitude text,
  concerns text,
  flagged_for_support boolean default false,
  flag_reason text,
  staff_reviewed boolean default false,
  reviewed_by text,
  reviewed_at timestamptz,
  review_notes text,
  barc10_answers jsonb default '{}',
  barc10_score numeric,
  qol_answers jsonb default '{}',
  qol_score numeric,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

create table public.procurement_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  medication_id uuid not null references public.medications(id) on delete cascade,
  resident_id uuid not null references public.residents(id) on delete cascade,
  medication_name text not null,
  dosage text,
  quantity_requested numeric not null,
  quantity_unit text,
  pharmacy text,
  rx_number text,
  requested_by_name text,
  urgency text default 'routine',
  status text default 'pending',
  notes text,
  received_date date,
  quantity_received numeric,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

create table public.resident_fees (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  resident_id uuid not null references public.residents(id) on delete cascade,
  location_id uuid references public.locations(id) on delete set null,
  label text not null,
  amount numeric not null,
  due_date date,
  period text,
  type text default 'program_fee',
  status text default 'unpaid',
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

create table public.resident_interviews (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  resident_id uuid not null references public.residents(id) on delete cascade,
  conducted_by_name text not null,
  conducted_by_id uuid,
  interview_date date not null,
  interview_mode text default 'in_person',
  status text default 'in_progress',
  screening_answers jsonb default '{}',
  question_notes jsonb default '{}',
  question_scores jsonb default '{}',
  overall_score numeric,
  recommendation text default 'pending',
  summary_notes text,
  ai_summary text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

create table public.resident_milestones (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  resident_id uuid not null references public.residents(id) on delete cascade,
  date date not null,
  type text not null,
  title text not null,
  description text,
  phase_from text,
  phase_to text,
  source text default 'manual',
  staff_annotation text,
  annotated_by text,
  annotated_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

create table public.resident_outcomes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  resident_id uuid not null references public.residents(id) on delete cascade,
  exit_date date not null,
  exit_type text default 'graduated',
  employment_status text default 'unknown',
  employer_name text,
  income_range text default 'unknown',
  housing_status text default 'unknown',
  housing_stable_since date,
  education_status text default 'unknown',
  education_program text,
  sobriety_maintained boolean default true,
  days_sober_at_exit numeric,
  current_sobriety_days numeric,
  recovery_support_active boolean default false,
  support_type text,
  follow_up_date date,
  follow_up_method text default 'phone',
  grant_ids uuid[] default '{}',
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

create table public.resident_payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  resident_id uuid not null references public.residents(id) on delete cascade,
  fee_id uuid references public.resident_fees(id) on delete set null,
  amount numeric not null,
  payment_date date not null,
  method text default 'cash',
  reference_number text,
  received_by_name text,
  memo text,
  receipt_number text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

create table public.shifts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  staff_id uuid not null references public.staff_profiles(id) on delete cascade,
  staff_name text,
  shift_date date not null,
  start_time text not null,
  end_time text not null,
  role_label text default 'primary',
  notes text,
  status text default 'scheduled',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

create table public.signature_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  resident_id uuid not null references public.residents(id) on delete cascade,
  resident_name text,
  resident_email text,
  title text not null,
  description text,
  document_type text default 'other',
  file_url text not null,
  file_name text,
  status text default 'pending',
  sent_by_name text,
  sent_by_id uuid,
  due_date date,
  signed_at timestamptz,
  signature_data text,
  signature_name text,
  decline_reason text,
  viewed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

create table public.task_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  task_id uuid not null references public.care_plan_tasks(id) on delete cascade,
  resident_id uuid not null references public.residents(id) on delete cascade,
  log_date date not null,
  outcome text default 'completed',
  rescheduled_date date,
  logged_by_name text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

create table public.vital_readings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  resident_id uuid not null references public.residents(id) on delete cascade,
  recorded_date date not null,
  recorded_time text,
  recorded_by_name text,
  weight_lbs numeric,
  bp_systolic numeric,
  bp_diastolic numeric,
  heart_rate numeric,
  temperature_f numeric,
  oxygen_saturation numeric,
  blood_glucose numeric,
  respiratory_rate numeric,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

create table public.grants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  funder_name text not null,
  funder_type text default 'state',
  grant_number text,
  program_type text default 'recovery_housing',
  start_date date not null,
  end_date date not null,
  total_award numeric,
  beds_funded integer,
  location_ids uuid[] default '{}',
  required_metrics text[] default '{}',
  reporting_frequency text default 'quarterly',
  contact_name text,
  contact_email text,
  notes text,
  status text default 'active',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

create table public.grant_enrollments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  grant_id uuid not null references public.grants(id) on delete cascade,
  resident_id uuid not null references public.residents(id) on delete cascade,
  enrollment_date date not null,
  exit_date date,
  exit_reason text,
  services_received text[] default '{}',
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

create table public.chat_channels (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  location_id uuid references public.locations(id) on delete set null,
  name text not null,
  emoji text,
  description text,
  category text default 'public',
  type text default 'general',
  access_level text default 'residents_and_staff',
  is_favorite boolean default false,
  is_locked boolean default false,
  sort_order numeric default 0,
  is_default boolean default false,
  created_by_id uuid,
  status text default 'active',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  channel_id uuid not null references public.chat_channels(id) on delete cascade,
  sender_id uuid not null,
  sender_name text not null,
  sender_role text,
  content text not null,
  file_url text,
  is_pinned boolean default false,
  edited boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

create table public.chore_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  location_id uuid references public.locations(id) on delete cascade,
  name text not null,
  description text,
  area text default 'common_area',
  frequency text default 'weekly',
  estimated_minutes numeric default 30,
  instructions text,
  requires_verification boolean default true,
  active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

create table public.chore_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  location_id uuid references public.locations(id) on delete cascade,
  chore_id uuid references public.chore_templates(id) on delete set null,
  chore_name text not null,
  resident_id uuid not null references public.residents(id) on delete cascade,
  resident_name text not null,
  due_date date not null,
  week_label text,
  status text default 'pending',
  completed_at timestamptz,
  verified_by_name text,
  verified_at timestamptz,
  staff_notes text,
  area text,
  estimated_minutes numeric,
  instructions text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

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
  residents jsonb;
  chores jsonb;
  resident_count integer;
  chore_count integer;
  rotation_offset integer;
  chore_record record;
  resident_record record;
  day_offset integer;
  created_count integer := 0;
  v_week_label text := 'Week of ' || p_week_start_date::text;
begin
  if not public.is_org_member(p_organization_id) then
    raise exception 'Unauthorized';
  end if;

  select jsonb_agg(to_jsonb(r) order by r.created_at), count(*)
  into residents, resident_count
  from public.residents r
  where r.location_id = p_location_id
    and r.organization_id = p_organization_id
    and r.status = 'active';

  if resident_count = 0 then
    raise exception 'No active residents found at this location';
  end if;

  select jsonb_agg(to_jsonb(c) order by c.created_at), count(*)
  into chores, chore_count
  from public.chore_templates c
  where c.location_id = p_location_id
    and c.organization_id = p_organization_id
    and c.active = true;

  if chore_count = 0 then
    raise exception 'No active chore templates defined for this location';
  end if;

  delete from public.chore_assignments
  where location_id = p_location_id
    and organization_id = p_organization_id
    and week_label = v_week_label;

  select (count(*) / greatest(chore_count, 1))::integer % resident_count
  into rotation_offset
  from public.chore_assignments
  where location_id = p_location_id
    and organization_id = p_organization_id;

  for chore_record in
    select c.*, row_number() over (order by c.created_at) - 1 as idx
    from public.chore_templates c
    where c.location_id = p_location_id
      and c.organization_id = p_organization_id
      and c.active = true
    order by c.created_at
  loop
    if chore_record.frequency = 'daily' then
      for day_offset in 0..6 loop
        select *
        into resident_record
        from (
          select r.*, row_number() over (order by r.created_at) - 1 as idx
          from public.residents r
          where r.location_id = p_location_id
            and r.organization_id = p_organization_id
            and r.status = 'active'
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
      select *
      into resident_record
      from (
        select r.*, row_number() over (order by r.created_at) - 1 as idx
        from public.residents r
        where r.location_id = p_location_id
          and r.organization_id = p_organization_id
          and r.status = 'active'
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

create or replace function public.auto_log_resident_milestone()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_table_name = 'residents' and tg_op = 'UPDATE' and old.status is distinct from new.status then
    insert into public.resident_milestones (
      resident_id, organization_id, date, type, source, title, description
    ) values (
      new.id, new.organization_id, current_date, 'status_change', 'auto',
      'Status: ' || coalesce(old.status, '?') || ' -> ' || coalesce(new.status, '?'),
      'Resident status automatically updated.'
    );
  end if;

  if tg_table_name = 'resident_interviews' and tg_op in ('INSERT','UPDATE') and new.status = 'completed' then
    insert into public.resident_milestones (
      resident_id, organization_id, date, type, source, title, description
    ) values (
      new.resident_id, new.organization_id, coalesce(new.interview_date, current_date), 'interview_completed', 'auto',
      'Interview Completed',
      'Recommendation: ' || coalesce(new.recommendation, 'pending')
    );
  end if;

  if tg_table_name = 'care_plan_goals' and tg_op = 'UPDATE' and new.status = 'completed' and old.status is distinct from 'completed' then
    insert into public.resident_milestones (
      resident_id, organization_id, date, type, source, title, description
    ) values (
      new.resident_id, new.organization_id, coalesce(new.completed_date, current_date), 'care_plan_update', 'auto',
      'Care Plan Goal Achieved: ' || new.title,
      coalesce(new.progress_notes, '')
    );
  end if;

  return new;
end;
$$;

create trigger residents_auto_milestone
after update on public.residents
for each row execute function public.auto_log_resident_milestone();

create trigger resident_interviews_auto_milestone
after insert or update on public.resident_interviews
for each row execute function public.auto_log_resident_milestone();

create trigger care_plan_goals_auto_milestone
after update on public.care_plan_goals
for each row execute function public.auto_log_resident_milestone();

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
    'chore_templates','chore_assignments'
  ] loop
    execute format('create trigger %I_set_updated_at before update on public.%I for each row execute function public.set_updated_at()', table_name, table_name);
    execute format('alter table public.%I enable row level security', table_name);
  end loop;
end $$;

create policy "Members can read organizations" on public.organizations
for select using (public.is_org_member(id));
create policy "Admins can update organizations" on public.organizations
for update using (public.is_org_admin(id)) with check (public.is_org_admin(id));
create policy "Authenticated users can create organizations" on public.organizations
for insert with check (auth.uid() is not null);

create policy "Members can read organization memberships" on public.organization_members
for select using (user_id = auth.uid() or public.is_org_admin(organization_id));
create policy "Admins can manage organization memberships" on public.organization_members
for all using (public.is_org_admin(organization_id)) with check (public.is_org_admin(organization_id));

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'locations','staff_profiles','residents','resident_contacts','resident_documents','secure_documents',
    'care_plan_goals','care_plan_tasks','medications','medication_logs','incident_reports','staff_tasks',
    'training_modules','training_completions','compliance_items','compliance_evidence','audit_logs',
    'inventory_items','inventory_requests','integration_configs','location_expenses','maintenance_tickets',
    'morning_reflections','procurement_requests','resident_fees','resident_interviews','resident_milestones',
    'resident_outcomes','resident_payments','shifts','signature_requests','task_logs','vital_readings',
    'grants','grant_enrollments','chat_channels','chat_messages','chore_templates','chore_assignments'
  ] loop
    execute format('create policy %I on public.%I for select using (public.is_org_member(organization_id))', table_name || '_select_members', table_name);
    execute format('create policy %I on public.%I for insert with check (public.is_org_member(organization_id))', table_name || '_insert_members', table_name);
    execute format('create policy %I on public.%I for update using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id))', table_name || '_update_members', table_name);
    execute format('create policy %I on public.%I for delete using (public.is_org_admin(organization_id))', table_name || '_delete_admins', table_name);
  end loop;
end $$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'organization_members','locations','staff_profiles','residents','resident_contacts','resident_documents',
    'secure_documents','care_plan_goals','care_plan_tasks','medications','medication_logs','incident_reports',
    'staff_tasks','training_modules','training_completions','compliance_items','compliance_evidence','audit_logs',
    'inventory_items','inventory_requests','integration_configs','location_expenses','maintenance_tickets',
    'morning_reflections','procurement_requests','resident_fees','resident_interviews','resident_milestones',
    'resident_outcomes','resident_payments','shifts','signature_requests','task_logs','vital_readings',
    'grants','grant_enrollments','chat_channels','chat_messages','chore_templates','chore_assignments'
  ] loop
    execute format('create index if not exists %I on public.%I (organization_id)', table_name || '_organization_id_idx', table_name);
    execute format('create index if not exists %I on public.%I (created_at desc)', table_name || '_created_at_idx', table_name);
  end loop;
end $$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('resident-documents', 'resident-documents', false, 52428800, null),
  ('secure-documents', 'secure-documents', false, 52428800, null),
  ('medication-photos', 'medication-photos', false, 10485760, array['image/png','image/jpeg','image/webp']),
  ('intake-attachments', 'intake-attachments', false, 52428800, null)
on conflict (id) do nothing;

create policy "Members can read organization storage files" on storage.objects
for select using (
  bucket_id in ('resident-documents','secure-documents','medication-photos','intake-attachments')
  and public.is_org_member((storage.foldername(name))[1]::uuid)
);

create policy "Members can upload organization storage files" on storage.objects
for insert with check (
  bucket_id in ('resident-documents','secure-documents','medication-photos','intake-attachments')
  and public.is_org_member((storage.foldername(name))[1]::uuid)
);

create policy "Members can update organization storage files" on storage.objects
for update using (
  bucket_id in ('resident-documents','secure-documents','medication-photos','intake-attachments')
  and public.is_org_member((storage.foldername(name))[1]::uuid)
) with check (
  bucket_id in ('resident-documents','secure-documents','medication-photos','intake-attachments')
  and public.is_org_member((storage.foldername(name))[1]::uuid)
);

create policy "Admins can delete organization storage files" on storage.objects
for delete using (
  bucket_id in ('resident-documents','secure-documents','medication-photos','intake-attachments')
  and public.is_org_admin((storage.foldername(name))[1]::uuid)
);
