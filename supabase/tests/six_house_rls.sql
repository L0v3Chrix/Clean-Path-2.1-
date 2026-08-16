begin;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
values
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner@example.test', '', now(), now()),
  ('10000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'staff@example.test', '', now(), now()),
  ('10000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'resident@example.test', '', now(), now()),
  ('10000000-0000-4000-8000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bootstrap-owner@example.test', '', now(), now()),
  ('10000000-0000-4000-8000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'second-bootstrap@example.test', '', now(), now()),
  ('10000000-0000-4000-8000-000000000006', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'other-owner@example.test', '', now(), now());

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
  ('40000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000006', 'owner', 'active');

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
     or (select count(*) from public.medications) <> 1
     or (select count(*) from public.medication_logs) <> 1
     or (select count(*) from public.incident_reports) <> 1
     or (select count(*) from public.shifts) <> 1
     or (select count(*) from public.care_plan_goals) <> 1 then
    raise exception 'Assigned staff crossed a core-workflow house boundary';
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

select public.record_data_export('20000000-0000-4000-8000-000000000001', 'residents', 2);
do $$
begin
  if not exists (select 1 from public.audit_logs where action = 'export' and resource_type = 'residents') then
    raise exception 'Data export was not audited';
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
end $$;

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
