begin;

create function pg_temp.assert_write_denied(statement text, label text)
returns void
language plpgsql
as $$
declare
  affected_rows bigint := 0;
  permission_denied boolean := false;
begin
  begin
    execute statement;
    get diagnostics affected_rows = row_count;
  exception
    when insufficient_privilege then
      permission_denied := true;
  end;

  if not permission_denied and affected_rows > 0 then
    raise exception '% unexpectedly changed % row(s)', label, affected_rows;
  end if;
end;
$$;

create function pg_temp.assert_only_resident_rows(table_name text, resident_id uuid)
returns void
language plpgsql
as $$
declare
  visible_rows bigint;
  foreign_rows bigint;
begin
  execute format(
    'select count(*), count(*) filter (where resident_id is distinct from $1) from public.%I',
    table_name
  )
  into visible_rows, foreign_rows
  using resident_id;

  if visible_rows = 0 or foreign_rows > 0 then
    raise exception 'Resident row scope failed for %: % visible, % foreign',
      table_name, visible_rows, foreign_rows;
  end if;
end;
$$;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
values
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner@example.test', '', now(), now()),
  ('10000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'staff@example.test', '', now(), now()),
  ('10000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'resident@example.test', '', now(), now()),
  ('10000000-0000-4000-8000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bootstrap-owner@example.test', '', now(), now()),
  ('10000000-0000-4000-8000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'second-bootstrap@example.test', '', now(), now()),
  ('10000000-0000-4000-8000-000000000006', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'other-owner@example.test', '', now(), now()),
  ('10000000-0000-4000-8000-000000000007', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@example.test', '', now(), now()),
  ('10000000-0000-4000-8000-000000000008', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin-staff-target@example.test', '', now(), now()),
  ('10000000-0000-4000-8000-000000000009', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner-insert-target@example.test', '', now(), now()),
  ('10000000-0000-4000-8000-000000000010', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'service-owner-target@example.test', '', now(), now()),
  ('10000000-0000-4000-8000-000000000011', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'denied-owner-target@example.test', '', now(), now());

do $$
begin
  if not exists (
    select 1 from public.organizations
    where id = '00000000-0000-4000-8000-000000000001'
      and name = 'Recovery Centered Living'
      and status = 'active'
  ) then
    raise exception 'Production tenant must exist before first-owner bootstrap';
  end if;
end;
$$;

do $$
begin
  if has_function_privilege('anon', 'public.auto_log_resident_milestone()', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.auto_log_resident_milestone()', 'EXECUTE') then
    raise exception 'Trigger-only milestone function must not be directly executable';
  end if;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000004', true);
select public.bootstrap_organization_owner(
  '00000000-0000-4000-8000-000000000001',
  'Bootstrap Owner',
  'bootstrap-owner@example.test'
);
reset role;

do $$
begin
  if not exists (
    select 1 from public.organization_members
    where organization_id = '00000000-0000-4000-8000-000000000001'
      and user_id = '10000000-0000-4000-8000-000000000004'
      and role = 'owner'
      and status = 'active'
  ) then
    raise exception 'First authenticated user must become the production tenant owner';
  end if;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000005', true);
do $$
begin
  perform public.bootstrap_organization_owner(
    '00000000-0000-4000-8000-000000000001',
    'Second Bootstrap',
    'second-bootstrap@example.test'
  );
  raise exception 'Second bootstrap unexpectedly succeeded';
exception
  when others then
    if sqlerrm <> 'Organization already has active members' then
      raise;
    end if;
end;
$$;
reset role;
select set_config('request.jwt.claim.role', '', true);
select set_config('request.jwt.claim.sub', '', true);

insert into public.organizations (id, name, status)
values
  ('20000000-0000-4000-8000-000000000001', 'RLS Test Organization', 'active'),
  ('20000000-0000-4000-8000-000000000002', 'Other RLS Test Organization', 'active');

insert into public.locations (id, organization_id, name, status)
values
  ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'Assigned House', 'active'),
  ('30000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', 'Other House', 'active'),
  ('30000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000002', 'Cross Organization House', 'active');

insert into public.organization_members (id, organization_id, user_id, role, status)
values
  ('40000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'owner', 'active'),
  ('40000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 'staff', 'active'),
  ('40000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003', 'resident', 'active'),
  ('40000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000006', 'owner', 'active'),
  ('40000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000007', 'admin', 'active');

insert into public.organization_member_locations (organization_id, organization_member_id, location_id)
values ('20000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000001');

insert into public.residents (id, organization_id, location_id, user_id, first_name, last_name, status)
values
  ('50000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003', 'Assigned', 'Resident', 'active'),
  ('50000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000002', null, 'Other', 'Resident', 'active'),
  ('50000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000003', null, 'Cross', 'Organization', 'active');

insert into public.signature_requests (
  id, organization_id, resident_id, title, file_url, file_name, status
)
values
  ('68000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', 'Assigned signature', '20000000-0000-4000-8000-000000000001/signatures/assigned.pdf', 'assigned.pdf', 'pending'),
  ('68000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000002', 'Other-house signature', '20000000-0000-4000-8000-000000000001/signatures/other-house.pdf', 'other-house.pdf', 'pending'),
  ('68000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000002', '50000000-0000-4000-8000-000000000003', 'Cross-organization signature', '20000000-0000-4000-8000-000000000002/signatures/cross-org.pdf', 'cross-org.pdf', 'pending'),
  ('68000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000002', '50000000-0000-4000-8000-000000000003', 'Mismatched path signature', '20000000-0000-4000-8000-000000000001/signatures/mismatched.pdf', 'mismatched.pdf', 'pending');

insert into storage.objects (id, bucket_id, name)
values
  ('69000000-0000-4000-8000-000000000001', 'secure-documents', '20000000-0000-4000-8000-000000000001/signatures/assigned.pdf'),
  ('69000000-0000-4000-8000-000000000002', 'secure-documents', '20000000-0000-4000-8000-000000000001/signatures/other-house.pdf'),
  ('69000000-0000-4000-8000-000000000003', 'secure-documents', '20000000-0000-4000-8000-000000000002/signatures/cross-org.pdf'),
  ('69000000-0000-4000-8000-000000000004', 'secure-documents', '20000000-0000-4000-8000-000000000001/signatures/mismatched.pdf'),
  ('69000000-0000-4000-8000-000000000005', 'secure-documents', '20000000-0000-4000-8000-000000000001/uploads/staff-upload.pdf'),
  ('69000000-0000-4000-8000-000000000006', 'secure-documents', '20000000-0000-4000-8000-000000000001/private/arbitrary-object.pdf');

update storage.objects
set owner_id = case id
  when '69000000-0000-4000-8000-000000000005' then '10000000-0000-4000-8000-000000000002'
  when '69000000-0000-4000-8000-000000000006' then '10000000-0000-4000-8000-000000000001'
  else owner_id
end
where id in (
  '69000000-0000-4000-8000-000000000005',
  '69000000-0000-4000-8000-000000000006'
);

do $$
begin
  if not exists (
    select 1 from storage.buckets
    where id = 'secure-documents' and public = false
  ) then
    raise exception 'Secure documents bucket must remain private';
  end if;
  if has_function_privilege(
    'authenticated',
    'public.signature_document_access_decision(text,text)',
    'EXECUTE'
  ) then
    raise exception 'Authenticated role can inspect internal signature path decisions';
  end if;
  if has_function_privilege(
    'authenticated',
    'public.enforce_signature_document_binding()',
    'EXECUTE'
  ) then
    raise exception 'Authenticated role can execute the signature binding trigger function';
  end if;
end $$;

insert into public.staff_profiles (id, organization_id, user_id, location_ids, first_name, last_name, role, status)
values
  ('60000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', array['30000000-0000-4000-8000-000000000001']::uuid[], 'Assigned', 'Staff', 'house_manager', 'active'),
  ('60000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', null, array['30000000-0000-4000-8000-000000000002']::uuid[], 'Other', 'Staff', 'house_manager', 'active');

insert into public.bed_assignments (id, organization_id, location_id, resident_id, bed_label, status)
values
  ('61000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', 'A-1', 'occupied'),
  ('61000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000002', '50000000-0000-4000-8000-000000000002', 'B-1', 'occupied');

insert into public.resident_documents (id, organization_id, resident_id, location_id, document_type, title, status)
values
  ('62000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 'agreement', 'Assigned agreement', 'current'),
  ('62000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000002', 'agreement', 'Other agreement', 'current');

insert into public.medications (id, organization_id, resident_id, medication_name, name, dosage, status)
values
  ('63000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', 'Test A', 'Test A', '1 mg', 'active'),
  ('63000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000002', 'Test B', 'Test B', '2 mg', 'active');

insert into public.medication_logs (id, organization_id, resident_id, medication_id, scheduled_date, status)
values
  ('64000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', '63000000-0000-4000-8000-000000000001', current_date, 'administered'),
  ('64000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000002', '63000000-0000-4000-8000-000000000002', current_date, 'administered');

insert into public.incident_reports (id, organization_id, resident_id, location_id, incident_date, description, status)
values
  ('65000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', current_date, 'Assigned test incident', 'open'),
  ('65000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000002', current_date, 'Other test incident', 'open');

insert into public.shifts (id, organization_id, location_id, staff_id, shift_date, start_time, end_time, status)
values
  ('66000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000001', current_date, '08:00', '16:00', 'scheduled'),
  ('66000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000002', '60000000-0000-4000-8000-000000000002', current_date, '08:00', '16:00', 'scheduled');

insert into public.care_plan_goals (id, organization_id, resident_id, term, category, title, status)
values
  ('67000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', 'short_term', 'recovery', 'Assigned goal', 'in_progress'),
  ('67000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000002', 'short_term', 'recovery', 'Other goal', 'in_progress');

insert into public.resident_contacts (id, organization_id, resident_id, name, relationship)
values
  ('71000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', 'Assigned Contact', 'friend'),
  ('71000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000002', 'Other Contact', 'friend');

insert into public.care_plan_tasks (id, organization_id, resident_id, goal_id, title, status)
values
  ('70000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', '67000000-0000-4000-8000-000000000001', 'Assigned task', 'pending'),
  ('70000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000002', '67000000-0000-4000-8000-000000000002', 'Other task', 'pending');

insert into public.secure_documents (id, organization_id, resident_id, location_id, title, access_level, visibility_scope)
values
  ('72000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 'Assigned secure metadata', 'staff_and_admin', 'staff_and_admin'),
  ('72000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000002', 'Other secure metadata', 'staff_and_admin', 'staff_and_admin');

insert into public.morning_reflections (id, organization_id, resident_id, log_date, mood, sleep_quality)
values
  ('73000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', current_date - 1, 4, 4),
  ('73000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000002', current_date - 1, 3, 3);

insert into public.procurement_requests (
  id, organization_id, medication_id, resident_id, medication_name, quantity_requested, status
)
values
  ('74000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '63000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', 'Test A', 30, 'pending'),
  ('74000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', '63000000-0000-4000-8000-000000000002', '50000000-0000-4000-8000-000000000002', 'Test B', 30, 'pending');

insert into public.resident_fees (id, organization_id, resident_id, location_id, label, amount, status)
values
  ('75000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 'Assigned fee', 100, 'unpaid'),
  ('75000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000002', 'Other fee', 100, 'unpaid');

insert into public.resident_interviews (
  id, organization_id, resident_id, conducted_by_name, interview_date, status
)
values
  ('76000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', 'Assigned Staff', current_date, 'completed'),
  ('76000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000002', 'Other Staff', current_date, 'completed');

insert into public.resident_milestones (id, organization_id, resident_id, date, type, title)
values
  ('77000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', current_date, 'manual', 'Assigned milestone'),
  ('77000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000002', current_date, 'manual', 'Other milestone');

insert into public.resident_outcomes (id, organization_id, resident_id, exit_date, exit_type)
values
  ('78000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', current_date, 'graduated'),
  ('78000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000002', current_date, 'graduated');

insert into public.resident_payments (id, organization_id, resident_id, fee_id, amount, payment_date)
values
  ('79000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', '75000000-0000-4000-8000-000000000001', 25, current_date),
  ('79000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000002', '75000000-0000-4000-8000-000000000002', 25, current_date);

insert into public.task_logs (id, organization_id, task_id, resident_id, log_date, outcome)
values
  ('7a000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', current_date, 'completed'),
  ('7a000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-000000000002', '50000000-0000-4000-8000-000000000002', current_date, 'completed');

insert into public.vital_readings (id, organization_id, resident_id, recorded_date, heart_rate)
values
  ('7b000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', current_date, 70),
  ('7b000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000002', current_date, 72);

insert into public.chat_channels (
  id, organization_id, location_id, name, category, access_level, is_locked, status
)
values
  ('7c000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 'Assigned public', 'public', 'residents_and_staff', false, 'active'),
  ('7c000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 'Assigned private', 'private', 'staff_only', false, 'active'),
  ('7c000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 'Assigned management', 'management', 'management_only', false, 'active'),
  ('7c000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 'Assigned locked', 'public', 'residents_and_staff', true, 'active'),
  ('7c000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000002', 'Other house public', 'public', 'residents_and_staff', false, 'active'),
  ('7c000000-0000-4000-8000-000000000006', '20000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000003', 'Cross organization public', 'public', 'residents_and_staff', false, 'active'),
  ('7c000000-0000-4000-8000-000000000007', '20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 'Unsafe direct', 'direct', 'residents_and_staff', false, 'active'),
  ('7c000000-0000-4000-8000-000000000008', '20000000-0000-4000-8000-000000000001', null, 'Organization public', 'public', 'residents_and_staff', false, 'active');

insert into public.chat_messages (
  id, organization_id, channel_id, sender_id, sender_name, sender_role, content
)
values
  ('7d000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '7c000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 'Assigned Staff', 'staff', 'Assigned public message'),
  ('7d000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', '7c000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', 'Assigned Staff', 'staff', 'Private message'),
  ('7d000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000001', '7c000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', 'Owner', 'owner', 'Management message'),
  ('7d000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000001', '7c000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000001', 'Owner', 'owner', 'Other house message'),
  ('7d000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000002', '7c000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000006', 'Other Owner', 'owner', 'Cross organization message');

insert into public.chore_templates (
  id, organization_id, location_id, name, frequency, active
)
values
  ('7e000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 'Assigned chore', 'weekly', true),
  ('7e000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000002', 'Other chore', 'weekly', true),
  ('7e000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000003', 'Cross organization chore', 'weekly', true);

insert into public.chore_assignments (
  id, organization_id, location_id, chore_id, chore_name, resident_id, resident_name,
  due_date, week_label, status
)
values
  ('7f000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', '7e000000-0000-4000-8000-000000000001', 'Assigned chore', '50000000-0000-4000-8000-000000000001', 'Assigned Resident', current_date, 'Acceptance week', 'pending'),
  ('7f000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000002', '7e000000-0000-4000-8000-000000000002', 'Other chore', '50000000-0000-4000-8000-000000000002', 'Other Resident', current_date, 'Acceptance week', 'pending'),
  ('7f000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000003', '7e000000-0000-4000-8000-000000000003', 'Cross organization chore', '50000000-0000-4000-8000-000000000003', 'Cross Organization', current_date, 'Acceptance week', 'pending');

insert into storage.objects (id, bucket_id, name, owner_id)
values (
  '69000000-0000-4000-8000-000000000007',
  'secure-documents',
  '20000000-0000-4000-8000-000000000001/signatures/resident-upload.pdf',
  '10000000-0000-4000-8000-000000000003'
);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000007', true);

insert into public.organization_members (
  id, organization_id, user_id, role, display_name, status
) values (
  '40000000-0000-4000-8000-000000000006',
  '20000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000008',
  'staff',
  'Admin-created staff',
  'active'
);

update public.organization_members
set display_name = 'Admin-updated staff'
where id = '40000000-0000-4000-8000-000000000006';

select pg_temp.assert_write_denied(
  $$insert into public.organization_members (
      id, organization_id, user_id, role, status
    ) values (
      '40000000-0000-4000-8000-000000000007',
      '20000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000011',
      'owner',
      'active'
    )$$,
  'Membership admin owner insert'
);
select pg_temp.assert_write_denied(
  $$insert into public.organization_members (
      id, organization_id, user_id, role, status
    ) values (
      '40000000-0000-4000-8000-000000000010',
      '20000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000011',
      'admin',
      'active'
    )$$,
  'Membership admin peer-admin insert'
);
select pg_temp.assert_write_denied(
  $$update public.organization_members
    set role = 'owner'
    where id = '40000000-0000-4000-8000-000000000002'$$,
  'Membership admin owner promotion'
);
select pg_temp.assert_write_denied(
  $$update public.organization_members
    set role = 'admin'
    where id = '40000000-0000-4000-8000-000000000002'$$,
  'Membership admin peer-admin promotion'
);
select pg_temp.assert_write_denied(
  $$update public.organization_members
    set display_name = 'Admin touched owner'
    where id = '40000000-0000-4000-8000-000000000001'$$,
  'Membership admin owner update'
);
select pg_temp.assert_write_denied(
  $$update public.staff_profiles
    set role = 'platform_admin'
    where id = '60000000-0000-4000-8000-000000000001'$$,
  'Staff-profile admin privilege escalation'
);

select public.update_staff_access(
  '60000000-0000-4000-8000-000000000001',
  'case_manager',
  array['30000000-0000-4000-8000-000000000001']::uuid[]
);

do $$
begin
  if not exists (
    select 1 from public.staff_profiles
    where id = '60000000-0000-4000-8000-000000000001'
      and role = 'case_manager'
      and location_ids = array['30000000-0000-4000-8000-000000000001']::uuid[]
  ) then
    raise exception 'Admin staff-role assignment did not update the profile';
  end if;
  if not exists (
    select 1 from public.organization_members
    where id = '40000000-0000-4000-8000-000000000002' and role = 'staff'
  ) then
    raise exception 'Operational role assignment changed the membership privilege tier';
  end if;
end $$;

select pg_temp.assert_write_denied(
  $$select public.update_staff_access(
      '60000000-0000-4000-8000-000000000001',
      'admin',
      array[]::uuid[]
    )$$,
  'Admin RPC privilege escalation'
);

select public.update_staff_access(
  '60000000-0000-4000-8000-000000000001',
  'house_manager',
  array['30000000-0000-4000-8000-000000000001']::uuid[]
);

reset role;
select set_config('request.jwt.claim.role', '', true);
select set_config('request.jwt.claim.sub', '', true);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);

update public.organization_members
set role = 'owner'
where id = '40000000-0000-4000-8000-000000000006';

insert into public.organization_members (
  id, organization_id, user_id, role, status
) values (
  '40000000-0000-4000-8000-000000000008',
  '20000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000009',
  'owner',
  'active'
);

reset role;
set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);
select set_config('request.jwt.claim.sub', '', true);

insert into public.organization_members (
  id, organization_id, user_id, role, status
) values (
  '40000000-0000-4000-8000-000000000009',
  '20000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000010',
  'owner',
  'active'
);

reset role;
select set_config('request.jwt.claim.role', '', true);
select set_config('request.jwt.claim.sub', '', true);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);

do $$
begin
  begin
    insert into public.signature_requests (
      id, organization_id, resident_id, title, file_url, file_name, status
    ) values (
      '68000000-0000-4000-8000-000000000005',
      '20000000-0000-4000-8000-000000000001',
      '50000000-0000-4000-8000-000000000001',
      'Staff uploaded signature',
      '20000000-0000-4000-8000-000000000001/uploads/staff-upload.pdf',
      'staff-upload.pdf',
      'pending'
    );
    raise exception 'rollback successful staff binding';
  exception
    when raise_exception then
      if sqlerrm <> 'rollback successful staff binding' then
        raise;
      end if;
  end;
end $$;

do $$
declare
  binding_rejected boolean := false;
begin
  begin
    insert into public.signature_requests (
      id, organization_id, resident_id, title, file_url, file_name, status
    ) values (
      '68000000-0000-4000-8000-000000000006',
      '20000000-0000-4000-8000-000000000001',
      '50000000-0000-4000-8000-000000000001',
      'Rebound arbitrary object',
      '20000000-0000-4000-8000-000000000001/private/arbitrary-object.pdf',
      'arbitrary-object.pdf',
      'pending'
    );
  exception
    when insufficient_privilege then
      if sqlerrm <> 'Signature document binding denied' then
        raise;
      end if;
      binding_rejected := true;
  end;

  if not binding_rejected then
    raise exception 'Assigned staff created a signature request for another user''s storage object';
  end if;
end $$;

do $$
declare
  binding_rejected boolean := false;
begin
  begin
    update public.signature_requests
    set file_url = '20000000-0000-4000-8000-000000000001/private/arbitrary-object.pdf'
    where id = '68000000-0000-4000-8000-000000000001';
  exception
    when insufficient_privilege then
      if sqlerrm <> 'Signature document binding denied' then
        raise;
      end if;
      binding_rejected := true;
  end;

  if not binding_rejected then
    raise exception 'Assigned staff rebound a signature request to another user''s storage object';
  end if;
end $$;

select pg_temp.assert_write_denied(
  $$insert into public.chat_channels (
      id, organization_id, location_id, name, category, access_level
    ) values (
      '7c000000-0000-4000-8000-000000000009',
      '20000000-0000-4000-8000-000000000001',
      '30000000-0000-4000-8000-000000000001',
      'Staff-created channel',
      'public',
      'residents_and_staff'
    )$$,
  'Staff channel creation'
);

do $$
begin
  begin
    insert into public.chat_messages (
      id, organization_id, channel_id, sender_id, sender_name, sender_role, content
    ) values (
      '7d000000-0000-4000-8000-000000000006',
      '20000000-0000-4000-8000-000000000001',
      '7c000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000002',
      'Assigned Staff',
      'staff',
      'Allowed staff post'
    );
    update public.chat_messages
    set content = 'Allowed staff edit'
    where id = '7d000000-0000-4000-8000-000000000006';
    raise exception 'rollback successful staff chat write';
  exception
    when raise_exception then
      if sqlerrm <> 'rollback successful staff chat write' then
        raise;
      end if;
  end;
end $$;

update public.chore_templates
set description = 'Assigned staff update'
where id = '7e000000-0000-4000-8000-000000000001';

select pg_temp.assert_write_denied(
  $$update public.chore_templates
    set description = 'Cross-house staff update'
    where id = '7e000000-0000-4000-8000-000000000002'$$,
  'Staff cross-house chore template update'
);

do $$
begin
  begin
    perform public.generate_chore_rotation(
      '30000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000001',
      current_date
    );
    raise exception 'rollback successful assigned-house chore rotation';
  exception
    when raise_exception then
      if sqlerrm <> 'rollback successful assigned-house chore rotation' then
        raise;
      end if;
  end;
end $$;

do $$
declare
  rejected boolean := false;
begin
  begin
    perform public.generate_chore_rotation(
      '30000000-0000-4000-8000-000000000002',
      '20000000-0000-4000-8000-000000000001',
      current_date
    );
  exception
    when insufficient_privilege then
      rejected := true;
  end;

  if not rejected then
    raise exception 'Staff generated a cross-house chore rotation';
  end if;
end $$;

do $$
begin
  if (select count(*) from public.locations) <> 1 then
    raise exception 'Assigned staff must see exactly one house';
  end if;
  if (select count(*) from public.residents) <> 1 then
    raise exception 'Assigned staff crossed a house boundary';
  end if;
  if (select count(*) from public.signature_requests) <> 1 then
    raise exception 'Assigned staff must see only assigned-house signature requests';
  end if;
  if (select count(*) from public.bed_assignments) <> 1
     or (select count(*) from public.resident_documents) <> 1
     or (select count(*) from public.secure_documents) <> 1
     or (select count(*) from public.resident_contacts) <> 1
     or (select count(*) from public.medications) <> 1
     or (select count(*) from public.medication_logs) <> 1
     or (select count(*) from public.incident_reports) <> 1
     or (select count(*) from public.shifts) <> 1
     or (select count(*) from public.care_plan_goals) <> 1
     or (select count(*) from public.care_plan_tasks) <> 1
     or (select count(*) from public.morning_reflections) <> 1
     or (select count(*) from public.procurement_requests) <> 1
     or (select count(*) from public.resident_fees) <> 1
     or (select count(*) from public.resident_interviews) <> 1
     or (select count(*) from public.resident_milestones) <> 2
     or (select count(*) from public.resident_outcomes) <> 1
     or (select count(*) from public.resident_payments) <> 1
     or (select count(*) from public.task_logs) <> 1
     or (select count(*) from public.vital_readings) <> 1 then
    raise exception 'Assigned staff crossed a core-workflow house boundary';
  end if;
  if (select count(*) from public.chat_channels) <> 4
     or (select count(*) from public.chat_messages) <> 3 then
    raise exception 'Assigned staff crossed a chat capability boundary';
  end if;
  if (select count(*) from public.chore_templates) <> 1
     or (select count(*) from public.chore_assignments) <> 1 then
    raise exception 'Assigned staff crossed a chore house boundary';
  end if;
  if (select count(*) from storage.objects where bucket_id = 'secure-documents') <> 1 then
    raise exception 'Assigned staff must see only the assigned-house signature file';
  end if;
end $$;

select public.record_document_access(
  'secure-documents',
  '20000000-0000-4000-8000-000000000001/signatures/assigned.pdf'
);

do $$
begin
  perform public.record_document_access(
    'secure-documents',
    '20000000-0000-4000-8000-000000000001/signatures/other-house.pdf'
  );
  raise exception 'Assigned staff unexpectedly accessed a cross-house signature file';
exception
  when others then
    if sqlerrm <> 'Document access denied' then
      raise;
    end if;
end $$;

do $$
begin
  perform public.record_document_access(
    'secure-documents',
    '20000000-0000-4000-8000-000000000002/signatures/cross-org.pdf'
  );
  raise exception 'Assigned staff unexpectedly accessed a cross-organization signature file';
exception
  when others then
    if sqlerrm <> 'Document access denied' then
      raise;
    end if;
end $$;

update public.medications
set dosage = '1.5 mg'
where id = '63000000-0000-4000-8000-000000000001';
select public.record_application_error('request_error', 'DatabaseAcceptance', '/residents', 'local-test');

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);

select public.record_document_access(
  'secure-documents',
  '20000000-0000-4000-8000-000000000001/signatures/other-house.pdf'
);

do $$
begin
  perform public.record_document_access(
    'secure-documents',
    '20000000-0000-4000-8000-000000000002/signatures/cross-org.pdf'
  );
  raise exception 'Owner unexpectedly accessed a cross-organization signature file';
exception
  when others then
    if sqlerrm <> 'Document access denied' then
      raise;
    end if;
end $$;

do $$
begin
  if (select count(*) from public.locations) <> 2 then
    raise exception 'Owner must see both houses';
  end if;
  if (select count(*) from public.residents) <> 2 then
    raise exception 'Owner must see both residents';
  end if;
  if (select count(*) from public.signature_requests) <> 2 then
    raise exception 'Owner must see only in-organization signature requests';
  end if;
  if not exists (
    select 1 from public.audit_logs
    where action = 'update' and resource_type = 'medications'
      and resource_id = '63000000-0000-4000-8000-000000000001'
  ) then
    raise exception 'Medication update was not audited';
  end if;
  if not exists (
    select 1 from public.application_error_events
    where category = 'request_error' and component = 'DatabaseAcceptance'
  ) then
    raise exception 'Privacy-minimized application error was not recorded';
  end if;
  if (select count(*) from storage.objects where bucket_id = 'secure-documents') <> 2 then
    raise exception 'Owner must see both in-organization signature files only';
  end if;
  if (select count(*) from public.chat_channels) <> 7
     or (select count(*) from public.chat_messages) <> 4 then
    raise exception 'Owner must see all in-organization chat records only';
  end if;
  if (select count(*) from public.chore_templates) <> 2
     or (select count(*) from public.chore_assignments) <> 2 then
    raise exception 'Owner must see all in-organization chore records only';
  end if;
  if not exists (
    select 1 from public.audit_logs
    where action = 'viewed_document'
      and resource_type = 'signature_requests'
      and resource_id = '68000000-0000-4000-8000-000000000001'
      and resident_id = '50000000-0000-4000-8000-000000000001'
      and performed_by_id = '10000000-0000-4000-8000-000000000002'
  ) then
    raise exception 'Allowed signature file access was not audited';
  end if;
  if not exists (
    select 1 from public.audit_logs
    where action = 'viewed_document'
      and resource_type = 'signature_requests'
      and resource_id = '68000000-0000-4000-8000-000000000002'
      and resident_id = '50000000-0000-4000-8000-000000000002'
      and performed_by_id = '10000000-0000-4000-8000-000000000001'
  ) then
    raise exception 'Owner signature file access was not audited';
  end if;
end $$;

do $$
begin
  begin
    insert into public.chat_channels (
      id, organization_id, location_id, name, category, access_level
    ) values (
      '7c000000-0000-4000-8000-000000000010',
      '20000000-0000-4000-8000-000000000001',
      '30000000-0000-4000-8000-000000000002',
      'Owner-created channel',
      'management',
      'management_only'
    );
    update public.chat_channels
    set description = 'Owner-updated channel'
    where id = '7c000000-0000-4000-8000-000000000010';
    raise exception 'rollback successful owner channel management';
  exception
    when raise_exception then
      if sqlerrm <> 'rollback successful owner channel management' then
        raise;
      end if;
  end;
end $$;

do $$
begin
  begin
    perform public.generate_chore_rotation(
      '30000000-0000-4000-8000-000000000002',
      '20000000-0000-4000-8000-000000000001',
      current_date
    );
    raise exception 'rollback successful owner chore rotation';
  exception
    when raise_exception then
      if sqlerrm <> 'rollback successful owner chore rotation' then
        raise;
      end if;
  end;
end $$;

select public.record_data_export('20000000-0000-4000-8000-000000000001', 'residents', 2);
do $$
begin
  if not exists (select 1 from public.audit_logs where action = 'export' and resource_type = 'residents') then
    raise exception 'Data export was not audited';
  end if;
end $$;

insert into public.residents (
  id, organization_id, location_id, first_name, last_name, status
) values (
  '50000000-0000-4000-8000-000000000004',
  '20000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000002',
  'Disposable',
  'Resident',
  'active'
);
delete from public.residents where id = '50000000-0000-4000-8000-000000000004';
do $$
begin
  if not exists (
    select 1 from public.audit_logs
    where action = 'delete'
      and resource_type = 'residents'
      and resource_id = '50000000-0000-4000-8000-000000000004'
      and resident_id is null
  ) then
    raise exception 'Resident deletion was not audited safely';
  end if;
end $$;

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000003', true);

do $$
declare
  binding_rejected boolean := false;
begin
  begin
    insert into public.signature_requests (
      id, organization_id, resident_id, title, file_url, file_name, status
    ) values (
      '68000000-0000-4000-8000-000000000007',
      '20000000-0000-4000-8000-000000000001',
      '50000000-0000-4000-8000-000000000001',
      'Resident rebound arbitrary object',
      '20000000-0000-4000-8000-000000000001/private/arbitrary-object.pdf',
      'arbitrary-object.pdf',
      'pending'
    );
  exception
    when insufficient_privilege then
      if sqlerrm <> 'Signature document binding denied' then
        raise;
      end if;
      binding_rejected := true;
  end;

  if not binding_rejected then
    raise exception 'Resident created a signature request for another user''s storage object';
  end if;
end $$;

do $$
declare
  binding_rejected boolean := false;
begin
  begin
    update public.signature_requests
    set file_url = '20000000-0000-4000-8000-000000000001/private/arbitrary-object.pdf'
    where id = '68000000-0000-4000-8000-000000000001';
  exception
    when insufficient_privilege then
      if sqlerrm <> 'Signature document binding denied' then
        raise;
      end if;
      binding_rejected := true;
  end;

  if not binding_rejected then
    raise exception 'Resident rebound a signature request to another user''s storage object';
  end if;
end $$;

update public.signature_requests
set status = 'viewed'
where id = '68000000-0000-4000-8000-000000000001';

do $$
begin
  if not exists (
    select 1 from public.signature_requests
    where id = '68000000-0000-4000-8000-000000000001'
      and status = 'viewed'
  ) then
    raise exception 'Resident signature status update was blocked';
  end if;
  if (select count(*) from public.residents) <> 1 then
    raise exception 'Resident must see only their own resident record';
  end if;
  if exists (select 1 from public.locations) then
    raise exception 'Resident must not list internal house records';
  end if;
  if (select count(*) from public.resident_documents) <> 1
     or (select count(*) from public.medications) <> 1
     or (select count(*) from public.medication_logs) <> 1
     or (select count(*) from public.care_plan_goals) <> 1
     or (select count(*) from public.signature_requests) <> 1 then
    raise exception 'Resident must see only their own resident-linked workflow records';
  end if;
  if (select count(*) from storage.objects where bucket_id = 'secure-documents') <> 1 then
    raise exception 'Resident must see only their own signature file';
  end if;
  if exists (select 1 from public.incident_reports)
     or exists (select 1 from public.secure_documents)
     or exists (select 1 from public.staff_tasks) then
    raise exception 'Resident must not see internal incident, secure-document, or staff-task records';
  end if;
  if (select count(*) from public.chat_channels) <> 2
     or (select count(*) from public.chat_messages) <> 1 then
    raise exception 'Resident crossed a chat visibility boundary';
  end if;
  if exists (select 1 from public.chore_templates)
     or (select count(*) from public.chore_assignments) <> 1 then
    raise exception 'Resident crossed a chore visibility boundary';
  end if;
end $$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'resident_contacts', 'care_plan_goals', 'care_plan_tasks', 'medications',
    'medication_logs', 'morning_reflections', 'procurement_requests',
    'resident_fees', 'resident_interviews', 'resident_milestones',
    'resident_outcomes', 'resident_payments', 'task_logs', 'vital_readings',
    'resident_documents', 'signature_requests'
  ] loop
    perform pg_temp.assert_only_resident_rows(
      table_name,
      '50000000-0000-4000-8000-000000000001'
    );
  end loop;
end $$;

do $$
declare
  target record;
begin
  for target in
    select * from (values
      ('resident_contacts', '71000000-0000-4000-8000-000000000001'),
      ('care_plan_goals', '67000000-0000-4000-8000-000000000001'),
      ('care_plan_tasks', '70000000-0000-4000-8000-000000000001'),
      ('medications', '63000000-0000-4000-8000-000000000001'),
      ('medication_logs', '64000000-0000-4000-8000-000000000001'),
      ('procurement_requests', '74000000-0000-4000-8000-000000000001'),
      ('resident_fees', '75000000-0000-4000-8000-000000000001'),
      ('resident_interviews', '76000000-0000-4000-8000-000000000001'),
      ('resident_milestones', '77000000-0000-4000-8000-000000000001'),
      ('resident_outcomes', '78000000-0000-4000-8000-000000000001'),
      ('resident_payments', '79000000-0000-4000-8000-000000000001'),
      ('task_logs', '7a000000-0000-4000-8000-000000000001'),
      ('vital_readings', '7b000000-0000-4000-8000-000000000001'),
      ('resident_documents', '62000000-0000-4000-8000-000000000001'),
      ('secure_documents', '72000000-0000-4000-8000-000000000001'),
      ('incident_reports', '65000000-0000-4000-8000-000000000001')
    ) as denied(table_name, record_id)
  loop
    perform pg_temp.assert_write_denied(
      format(
        'update public.%I set updated_at = clock_timestamp() where id = %L::uuid',
        target.table_name,
        target.record_id
      ),
      'Resident direct update of ' || target.table_name
    );
  end loop;
end $$;

select pg_temp.assert_write_denied(
  $$insert into public.resident_contacts (
      id, organization_id, resident_id, name, relationship
    ) values (
      '71000000-0000-4000-8000-000000000010',
      '20000000-0000-4000-8000-000000000001',
      '50000000-0000-4000-8000-000000000001',
      'Resident-created contact',
      'friend'
    )$$,
  'Resident clinical-record insert'
);

insert into public.morning_reflections (
  id, organization_id, resident_id, log_date, mood, sleep_quality, daily_goal
) values (
  '73000000-0000-4000-8000-000000000010',
  '20000000-0000-4000-8000-000000000001',
  '50000000-0000-4000-8000-000000000001',
  current_date,
  4,
  4,
  'Attend today''s meeting'
);

update public.morning_reflections
set gratitude = 'A safe place to recover'
where id = '73000000-0000-4000-8000-000000000010';

select pg_temp.assert_write_denied(
  $$update public.morning_reflections
    set staff_reviewed = true, reviewed_by = 'Resident spoof'
    where id = '73000000-0000-4000-8000-000000000010'$$,
  'Resident reflection staff review'
);

select pg_temp.assert_write_denied(
  $$update public.signature_requests
    set title = 'Resident rewrote document metadata'
    where id = '68000000-0000-4000-8000-000000000001'$$,
  'Resident signature metadata update'
);

insert into public.chat_messages (
  id, organization_id, channel_id, sender_id, sender_name, sender_role, content
) values (
  '7d000000-0000-4000-8000-000000000010',
  '20000000-0000-4000-8000-000000000001',
  '7c000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000003',
  'Spoofed Owner',
  'owner',
  'Resident public message'
);

update public.chat_messages
set content = 'Resident edited public message'
where id = '7d000000-0000-4000-8000-000000000010';

do $$
begin
  if not exists (
    select 1 from public.chat_messages
    where id = '7d000000-0000-4000-8000-000000000010'
      and sender_id = '10000000-0000-4000-8000-000000000003'
      and sender_role = 'resident'
      and sender_name <> 'Spoofed Owner'
      and content = 'Resident edited public message'
      and edited = true
  ) then
    raise exception 'Resident chat identity normalization or own-message edit failed';
  end if;
end $$;

select pg_temp.assert_write_denied(
  $$insert into public.chat_messages (
      id, organization_id, channel_id, sender_id, sender_name, sender_role, content
    ) values (
      '7d000000-0000-4000-8000-000000000011',
      '20000000-0000-4000-8000-000000000001',
      '7c000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000001',
      'Owner',
      'owner',
      'Spoofed sender message'
    )$$,
  'Resident chat sender spoof'
);

select pg_temp.assert_write_denied(
  $$insert into public.chat_messages (
      id, organization_id, channel_id, sender_id, sender_name, sender_role, content
    ) values (
      '7d000000-0000-4000-8000-000000000012',
      '20000000-0000-4000-8000-000000000001',
      '7c000000-0000-4000-8000-000000000004',
      '10000000-0000-4000-8000-000000000003',
      'Resident',
      'resident',
      'Locked-channel message'
    )$$,
  'Resident locked-channel post'
);

select pg_temp.assert_write_denied(
  $$update public.chat_messages
    set content = 'Resident edited staff message'
    where id = '7d000000-0000-4000-8000-000000000001'$$,
  'Resident edit of another sender message'
);

select pg_temp.assert_write_denied(
  $$update public.chore_assignments
    set staff_notes = 'Resident-authored staff note'
    where id = '7f000000-0000-4000-8000-000000000001'$$,
  'Resident chore staff-note update'
);

update public.chore_assignments
set status = 'completed', completed_at = now()
where id = '7f000000-0000-4000-8000-000000000001';

select pg_temp.assert_write_denied(
  $$update public.chore_assignments
    set status = 'verified', verified_by_name = 'Resident spoof'
    where id = '7f000000-0000-4000-8000-000000000001'$$,
  'Resident chore verification'
);

update public.signature_requests
set status = 'signed',
    signed_at = now(),
    signature_name = 'Assigned Resident',
    signature_data = 'data:image/png;base64,QUJD'
where id = '68000000-0000-4000-8000-000000000001';

select public.record_document_access(
  'secure-documents',
  '20000000-0000-4000-8000-000000000001/signatures/assigned.pdf'
);

do $$
begin
  if not exists (
    select 1 from public.audit_logs
    where action = 'viewed_document'
      and resource_type = 'signature_requests'
      and resource_id = '68000000-0000-4000-8000-000000000001'
      and resident_id = '50000000-0000-4000-8000-000000000001'
      and performed_by_id = '10000000-0000-4000-8000-000000000003'
  ) then
    raise exception 'Resident signature file access was not audited';
  end if;
end $$;

do $$
begin
  perform public.record_document_access(
    'secure-documents',
    '20000000-0000-4000-8000-000000000001/signatures/mismatched.pdf'
  );
  raise exception 'Resident unexpectedly accessed a signature path owned by another organization';
exception
  when others then
    if sqlerrm <> 'Document access denied' then
      raise;
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
  if has_function_privilege(
    'anon',
    'public.can_read_protected_storage_object(text,text)',
    'EXECUTE'
  ) then
    raise exception 'Anonymous role can execute protected storage authorization';
  end if;
end $$;

rollback;
