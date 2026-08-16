create index if not exists signature_requests_file_url_idx
  on public.signature_requests (file_url);

create or replace function public.enforce_signature_document_binding()
returns trigger
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  actor_id uuid := auth.uid();
begin
  if tg_op = 'UPDATE'
     and new.file_url is not distinct from old.file_url
     and new.organization_id is not distinct from old.organization_id
     and new.resident_id is not distinct from old.resident_id then
    return new;
  end if;

  -- Trusted migration and service-role writes have no end-user JWT subject.
  if actor_id is null then
    return new;
  end if;

  if (storage.foldername(new.file_url))[1] is distinct from new.organization_id::text
     or not exists (
       select 1
       from storage.objects o
       where o.bucket_id = 'secure-documents'
         and o.name = new.file_url
         and (
           o.owner_id = actor_id::text
           or public.is_org_admin(new.organization_id)
         )
     ) then
    raise exception using
      errcode = '42501',
      message = 'Signature document binding denied';
  end if;

  return new;
end;
$$;

revoke execute on function public.enforce_signature_document_binding() from public, anon, authenticated;

drop trigger if exists signature_requests_enforce_document_binding on public.signature_requests;
create trigger signature_requests_enforce_document_binding
before insert or update of file_url, organization_id, resident_id
on public.signature_requests
for each row execute function public.enforce_signature_document_binding();

-- NULL delegates non-signature paths to the existing protected-document rules.
create or replace function public.signature_document_access_decision(
  p_bucket text,
  p_path text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_bucket is distinct from 'secure-documents' or not exists (
      select 1
      from public.signature_requests sr
      where sr.file_url = p_path
    ) then null
    else exists (
      select 1
      from public.signature_requests sr
      where sr.file_url = p_path
        and (storage.foldername(sr.file_url))[1] = sr.organization_id::text
        and public.can_access_resident(sr.organization_id, sr.resident_id)
    )
  end;
$$;

revoke execute on function public.signature_document_access_decision(text, text) from public, anon, authenticated;

create or replace function public.can_read_protected_storage_object(
  p_bucket text,
  p_path text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    public.signature_document_access_decision(p_bucket, p_path),
    exists (
      select 1 from public.resident_documents d
      where d.storage_bucket = p_bucket and d.storage_path = p_path
        and (public.is_org_admin(d.organization_id) or public.can_access_resident(d.organization_id, d.resident_id))
    )
    or exists (
      select 1 from public.secure_documents d
      where d.storage_bucket = p_bucket and d.storage_path = p_path
        and (public.is_org_admin(d.organization_id) or public.can_access_resident(d.organization_id, d.resident_id))
    )
    or exists (
      select 1 from public.compliance_items d
      where p_bucket = 'secure-documents' and d.document_url = p_path
        and (public.is_org_admin(d.organization_id) or public.can_access_location(d.organization_id, d.location_id))
    ),
    false
  );
$$;

revoke execute on function public.can_read_protected_storage_object(text, text) from public, anon;
grant execute on function public.can_read_protected_storage_object(text, text) to authenticated;

create or replace function public.record_document_access(p_bucket text, p_path text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  document_record record;
  signature_access boolean;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  signature_access := public.signature_document_access_decision(p_bucket, p_path);

  if signature_access is not null then
    if not signature_access then
      raise exception 'Document access denied';
    end if;

    select
      sr.organization_id,
      sr.resident_id,
      null::uuid as location_id,
      sr.id,
      'signature_requests'::text as resource_type
    into document_record
    from public.signature_requests sr
    where p_bucket = 'secure-documents'
      and sr.file_url = p_path
      and (storage.foldername(sr.file_url))[1] = sr.organization_id::text
      and public.can_access_resident(sr.organization_id, sr.resident_id)
    limit 1;
  else
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
  end if;

  insert into public.audit_logs (
    organization_id, performed_by_id, resident_id, action, resource_type, resource_id, description
  ) values (
    document_record.organization_id, auth.uid(), document_record.resident_id,
    'viewed_document', document_record.resource_type, document_record.id, 'Opened a protected document'
  );
end;
$$;

revoke execute on function public.record_document_access(text, text) from public, anon;
grant execute on function public.record_document_access(text, text) to authenticated;

drop policy if exists "Scoped members can read protected storage files" on storage.objects;
create policy "Scoped members can read protected storage files" on storage.objects
for select using (
  public.can_read_protected_storage_object(bucket_id, name)
);
