create or replace function public.can_access_location(org_id uuid, requested_location_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select case
    when auth.uid() is null then false
    when public.current_access_role(org_id) in ('admin', 'owner', 'director') then true
    when public.current_access_role(org_id) = 'resident' then false
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
        and om.role <> 'resident'
        and oml.location_id = requested_location_id
    )
  end;
$$;

revoke execute on function public.can_access_location(uuid, uuid) from public, anon;
grant execute on function public.can_access_location(uuid, uuid) to authenticated;

delete from public.organization_member_locations oml
using public.organization_members om
where om.id = oml.organization_member_id
  and om.role = 'resident';

create or replace function public.enforce_non_resident_location_assignment()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  member_record public.organization_members;
begin
  select om.* into member_record
  from public.organization_members om
  where om.id = new.organization_member_id;

  if member_record.id is null or member_record.organization_id <> new.organization_id then
    raise exception 'House assignment membership scope is invalid' using errcode = '23503';
  end if;
  if member_record.role = 'resident' then
    raise exception 'Resident memberships cannot receive staff house assignments'
      using errcode = '23514';
  end if;
  if not exists (
    select 1
    from public.locations l
    where l.id = new.location_id
      and l.organization_id = new.organization_id
  ) then
    raise exception 'House assignment location scope is invalid' using errcode = '23503';
  end if;

  return new;
end;
$$;

revoke execute on function public.enforce_non_resident_location_assignment()
from public, anon, authenticated, service_role;

drop trigger if exists organization_member_locations_enforce_principal_type
on public.organization_member_locations;
create trigger organization_member_locations_enforce_principal_type
before insert or update of organization_id, organization_member_id, location_id
on public.organization_member_locations
for each row execute function public.enforce_non_resident_location_assignment();

update public.resident_documents
set visibility_scope = 'staff_and_admin'
where visibility_scope is null
  or visibility_scope not in ('admin_only', 'staff_and_admin', 'resident_and_staff');

alter table public.resident_documents
  alter column visibility_scope set default 'staff_and_admin',
  alter column visibility_scope set not null;
alter table public.resident_documents
  drop constraint if exists resident_documents_visibility_scope_check;
alter table public.resident_documents
  add constraint resident_documents_visibility_scope_check
  check (visibility_scope in ('admin_only', 'staff_and_admin', 'resident_and_staff'));

create unique index if not exists resident_documents_storage_object_unique
on public.resident_documents (storage_bucket, storage_path)
where storage_path is not null;

create unique index if not exists secure_documents_storage_object_unique
on public.secure_documents (storage_bucket, storage_path)
where storage_path is not null;

create unique index if not exists compliance_items_storage_object_unique
on public.compliance_items (document_url)
where document_url is not null;

create unique index if not exists signature_requests_storage_object_unique
on public.signature_requests (file_url);

create table public.protected_document_bindings (
  storage_bucket text not null,
  storage_path text not null,
  organization_id uuid not null,
  resident_id uuid,
  location_id uuid,
  resource_type text not null
    check (resource_type in (
      'resident_documents', 'secure_documents', 'compliance_items', 'signature_requests'
    )),
  resource_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (storage_bucket, storage_path),
  unique (resource_type, resource_id)
);

alter table public.protected_document_bindings enable row level security;
revoke all on table public.protected_document_bindings from public, anon, authenticated;

do $$
begin
  if exists (
    select 1
    from public.resident_documents d
    join public.residents r
      on r.id = d.resident_id
     and r.organization_id = d.organization_id
    where d.resident_id is not null
      and d.location_id is not null
      and d.location_id is distinct from r.location_id
    union all
    select 1
    from public.secure_documents d
    join public.residents r
      on r.id = d.resident_id
     and r.organization_id = d.organization_id
    where d.resident_id is not null
      and d.location_id is not null
      and d.location_id is distinct from r.location_id
  ) then
    raise exception 'Existing protected document metadata has a resident/location mismatch'
      using errcode = '23514';
  end if;
end;
$$;

do $$
begin
  if exists (
    select 1
    from (
      select
        d.storage_bucket,
        d.storage_path,
        d.organization_id,
        d.resident_id,
        coalesce(d.location_id, r.location_id) as location_id
      from public.resident_documents d
      left join public.residents r on r.id = d.resident_id
      where d.storage_path is not null
      union all
      select
        d.storage_bucket,
        d.storage_path,
        d.organization_id,
        d.resident_id,
        coalesce(d.location_id, r.location_id)
      from public.secure_documents d
      left join public.residents r on r.id = d.resident_id
      where d.storage_path is not null
      union all
      select
        'secure-documents',
        d.document_url,
        d.organization_id,
        null::uuid,
        d.location_id
      from public.compliance_items d
      where d.document_url is not null
      union all
      select
        'secure-documents',
        d.file_url,
        d.organization_id,
        d.resident_id,
        r.location_id
      from public.signature_requests d
      join public.residents r on r.id = d.resident_id
      where d.file_url is not null
    ) candidates
    group by storage_bucket, storage_path
    having count(distinct jsonb_build_array(
      organization_id, resident_id, location_id
    )::text) > 1
  ) then
    raise exception 'Existing protected document metadata contains conflicting object bindings'
      using errcode = '23505';
  end if;
end;
$$;

insert into public.protected_document_bindings (
  storage_bucket,
  storage_path,
  organization_id,
  resident_id,
  location_id,
  resource_type,
  resource_id
)
select distinct on (storage_bucket, storage_path)
  storage_bucket,
  storage_path,
  organization_id,
  resident_id,
  location_id,
  resource_type,
  resource_id
from (
  select
    d.storage_bucket,
    d.storage_path,
    d.organization_id,
    d.resident_id,
    coalesce(d.location_id, r.location_id) as location_id,
    'resident_documents'::text as resource_type,
    d.id as resource_id,
    1 as priority
  from public.resident_documents d
  left join public.residents r on r.id = d.resident_id
  where d.storage_path is not null
  union all
  select
    d.storage_bucket,
    d.storage_path,
    d.organization_id,
    d.resident_id,
    coalesce(d.location_id, r.location_id),
    'secure_documents',
    d.id,
    1
  from public.secure_documents d
  left join public.residents r on r.id = d.resident_id
  where d.storage_path is not null
  union all
  select
    'secure-documents',
    d.file_url,
    d.organization_id,
    d.resident_id,
    r.location_id,
    'signature_requests',
    d.id,
    2
  from public.signature_requests d
  join public.residents r on r.id = d.resident_id
  where d.file_url is not null
  union all
  select
    'secure-documents',
    d.document_url,
    d.organization_id,
    null::uuid,
    d.location_id,
    'compliance_items',
    d.id,
    3
  from public.compliance_items d
  where d.document_url is not null
) candidates
order by storage_bucket, storage_path, priority, resource_id;

create or replace function public.enforce_protected_document_scope()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, storage
as $$
declare
  payload jsonb := to_jsonb(new);
  document_organization_id uuid := nullif(payload ->> 'organization_id', '')::uuid;
  document_resident_id uuid := nullif(payload ->> 'resident_id', '')::uuid;
  document_location_id uuid := nullif(payload ->> 'location_id', '')::uuid;
  resource_id uuid := nullif(payload ->> 'id', '')::uuid;
  actor_id uuid := auth.uid();
  resident_location_id uuid;
  effective_location_id uuid;
  protected_path text;
  document_bucket text;
  resource_type text;
  existing_binding public.protected_document_bindings;
begin
  if document_organization_id is null then
    raise exception 'Protected document organization is required' using errcode = '23502';
  end if;

  if document_resident_id is not null then
    select r.location_id into resident_location_id
    from public.residents r
    where r.id = document_resident_id
      and r.organization_id = document_organization_id;

    if not found then
      raise exception 'Protected document resident scope is invalid' using errcode = '23503';
    end if;
  end if;

  if document_location_id is not null and not exists (
    select 1
    from public.locations l
    where l.id = document_location_id
      and l.organization_id = document_organization_id
  ) then
    raise exception 'Protected document location scope is invalid' using errcode = '23503';
  end if;

  if document_resident_id is not null
    and document_location_id is not null
    and document_location_id is distinct from resident_location_id then
    raise exception 'Protected document location must match the resident current location'
      using errcode = '23514';
  end if;

  if tg_table_name = 'resident_documents' then
    resource_type := 'resident_documents';
    document_bucket := nullif(btrim(payload ->> 'storage_bucket'), '');
    protected_path := nullif(btrim(payload ->> 'storage_path'), '');
  elsif tg_table_name = 'secure_documents' then
    resource_type := 'secure_documents';
    document_bucket := nullif(btrim(payload ->> 'storage_bucket'), '');
    protected_path := nullif(btrim(payload ->> 'storage_path'), '');
  elsif tg_table_name = 'compliance_items' then
    resource_type := 'compliance_items';
    document_bucket := 'secure-documents';
    protected_path := nullif(btrim(payload ->> 'document_url'), '');
  elsif tg_table_name = 'signature_requests' then
    resource_type := 'signature_requests';
    document_bucket := 'secure-documents';
    protected_path := nullif(btrim(payload ->> 'file_url'), '');
  else
    raise exception 'Protected-document trigger attached to an unsupported table'
      using errcode = '55000';
  end if;

  if protected_path is null then
    return new;
  end if;

  if resource_id is null then
    raise exception 'Protected document resource id is required' using errcode = '23502';
  end if;

  if (tg_table_name = 'resident_documents'
      and document_bucket not in ('resident-documents', 'intake-attachments'))
    or (tg_table_name in ('secure_documents', 'compliance_items', 'signature_requests')
      and document_bucket <> 'secure-documents') then
    raise exception 'Protected document storage bucket is invalid' using errcode = '23514';
  end if;
  if (storage.foldername(protected_path))[1]
    is distinct from document_organization_id::text then
    raise exception 'Protected document storage path is outside its organization'
      using errcode = '23514';
  end if;

  effective_location_id := coalesce(document_location_id, resident_location_id);

  if actor_id is not null then
    if public.current_org_role(document_organization_id) = 'resident'
      or not (
        public.is_org_admin(document_organization_id)
        or (
          document_resident_id is not null
          and public.can_access_resident(document_organization_id, document_resident_id)
        )
        or (
          document_location_id is not null
          and public.can_access_location(document_organization_id, document_location_id)
        )
      ) then
      raise exception 'Protected document binding denied' using errcode = '42501';
    end if;

    if not exists (
      select 1
      from storage.objects o
      where o.bucket_id = document_bucket
        and o.name = protected_path
        and (
          public.is_org_admin(document_organization_id)
          or o.owner_id = actor_id::text
          or o.owner = actor_id
        )
    ) then
      raise exception 'Protected document binding denied' using errcode = '42501';
    end if;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      pg_catalog.jsonb_build_array(document_bucket, protected_path)::text,
      0
    )
  );

  insert into public.protected_document_bindings (
    storage_bucket,
    storage_path,
    organization_id,
    resident_id,
    location_id,
    resource_type,
    resource_id
  ) values (
    document_bucket,
    protected_path,
    document_organization_id,
    document_resident_id,
    effective_location_id,
    resource_type,
    resource_id
  )
  on conflict (storage_bucket, storage_path) do nothing;

  select b.* into existing_binding
  from public.protected_document_bindings b
  where b.storage_bucket = document_bucket
    and b.storage_path = protected_path
  for update;

  if existing_binding.organization_id is distinct from document_organization_id
    or existing_binding.location_id is distinct from effective_location_id
    or (
      existing_binding.resident_id is distinct from document_resident_id
      and not (
        actor_id is null
        and resource_type = 'compliance_items'
        and existing_binding.resource_type = 'secure_documents'
        and document_resident_id is null
      )
    ) then
    raise exception 'Protected document object is already bound to another scope'
      using errcode = '23505';
  end if;

  if existing_binding.resource_type <> resource_type
    or existing_binding.resource_id <> resource_id then
    if actor_id is not null
      or resource_type <> 'compliance_items'
      or existing_binding.resource_type <> 'secure_documents' then
      raise exception 'Protected document object already has canonical metadata'
        using errcode = '23505';
    end if;
  end if;

  return new;
end;
$$;

revoke execute on function public.enforce_protected_document_scope()
from public, anon, authenticated, service_role;

create trigger resident_documents_enforce_protected_scope
before insert or update of organization_id, resident_id, location_id, storage_bucket, storage_path
on public.resident_documents
for each row execute function public.enforce_protected_document_scope();

create trigger secure_documents_enforce_protected_scope
before insert or update of organization_id, resident_id, location_id, storage_bucket, storage_path
on public.secure_documents
for each row execute function public.enforce_protected_document_scope();

create trigger compliance_items_enforce_protected_scope
before insert or update of organization_id, location_id, document_url
on public.compliance_items
for each row execute function public.enforce_protected_document_scope();

create trigger signature_requests_enforce_protected_scope
before insert or update of organization_id, resident_id, file_url
on public.signature_requests
for each row execute function public.enforce_protected_document_scope();

drop policy if exists resident_documents_select_scope on public.resident_documents;
drop policy if exists resident_documents_select_resident_scope on public.resident_documents;
create policy resident_documents_select_resident_scope
on public.resident_documents
for select using (
  (
    public.current_org_role(organization_id) = 'resident'
    and visibility_scope = 'resident_and_staff'
    and public.is_resident_self(organization_id, resident_id)
  )
  or (
    public.current_org_role(organization_id) <> 'resident'
    and (visibility_scope <> 'admin_only' or public.is_org_admin(organization_id))
    and (
      public.can_access_location(organization_id, location_id)
      or public.can_access_resident(organization_id, resident_id)
      or (location_id is null and resident_id is null and public.is_org_admin(organization_id))
    )
  )
);

drop policy if exists shifts_select_resident_home on public.shifts;
create policy shifts_select_resident_home
on public.shifts
for select using (
  public.current_org_role(organization_id) = 'resident'
  and exists (
    select 1
    from public.residents r
    where r.organization_id = shifts.organization_id
      and r.location_id = shifts.location_id
      and r.user_id = auth.uid()
      and r.status = 'active'
  )
);

create or replace function public.authorized_protected_document(
  p_bucket text,
  p_path text
)
returns table (
  organization_id uuid,
  resident_id uuid,
  location_id uuid,
  resource_id uuid,
  resource_type text
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select
    b.organization_id,
    b.resident_id,
    b.location_id,
    b.resource_id,
    b.resource_type
  from public.protected_document_bindings b
  join public.resident_documents d
    on b.resource_type = 'resident_documents'
   and d.id = b.resource_id
   and d.storage_bucket = b.storage_bucket
   and d.storage_path = b.storage_path
   and d.organization_id = b.organization_id
   and d.resident_id is not distinct from b.resident_id
   and (d.location_id is null or d.location_id is not distinct from b.location_id)
  left join public.residents r
    on r.id = d.resident_id
   and r.organization_id = d.organization_id
  where b.storage_bucket = p_bucket
    and b.storage_path = p_path
    and b.storage_bucket in ('resident-documents', 'intake-attachments')
    and (storage.foldername(b.storage_path))[1] = b.organization_id::text
    and (
      b.resident_id is null
      or (
        r.id is not null
        and r.location_id is not distinct from b.location_id
        and (d.location_id is null or d.location_id is not distinct from r.location_id)
      )
    )
    and (
      public.is_org_admin(b.organization_id)
      or (
        public.current_org_role(b.organization_id) = 'resident'
        and d.visibility_scope = 'resident_and_staff'
        and public.is_resident_self(b.organization_id, b.resident_id)
      )
      or (
        public.current_org_role(b.organization_id) <> 'resident'
        and d.visibility_scope <> 'admin_only'
        and (
          public.can_access_resident(b.organization_id, b.resident_id)
          or public.can_access_location(b.organization_id, b.location_id)
        )
      )
    )
  union all
  select
    b.organization_id,
    b.resident_id,
    b.location_id,
    b.resource_id,
    b.resource_type
  from public.protected_document_bindings b
  join public.secure_documents d
    on b.resource_type = 'secure_documents'
   and d.id = b.resource_id
   and d.storage_bucket = b.storage_bucket
   and d.storage_path = b.storage_path
   and d.organization_id = b.organization_id
   and d.resident_id is not distinct from b.resident_id
   and (d.location_id is null or d.location_id is not distinct from b.location_id)
  left join public.residents r
    on r.id = d.resident_id
   and r.organization_id = d.organization_id
  where b.storage_bucket = p_bucket
    and b.storage_path = p_path
    and b.storage_bucket = 'secure-documents'
    and (storage.foldername(b.storage_path))[1] = b.organization_id::text
    and (
      b.resident_id is null
      or (
        r.id is not null
        and r.location_id is not distinct from b.location_id
        and (d.location_id is null or d.location_id is not distinct from r.location_id)
      )
    )
    and public.current_org_role(b.organization_id) <> 'resident'
    and (
      public.is_org_admin(b.organization_id)
      or public.can_access_resident(b.organization_id, b.resident_id)
      or public.can_access_location(b.organization_id, b.location_id)
    )
  union all
  select
    b.organization_id,
    b.resident_id,
    b.location_id,
    b.resource_id,
    b.resource_type
  from public.protected_document_bindings b
  join public.compliance_items d
    on b.resource_type = 'compliance_items'
   and d.id = b.resource_id
   and d.document_url = b.storage_path
   and d.organization_id = b.organization_id
   and d.location_id is not distinct from b.location_id
  where b.storage_bucket = p_bucket
    and b.storage_path = p_path
    and b.storage_bucket = 'secure-documents'
    and (storage.foldername(b.storage_path))[1] = b.organization_id::text
    and public.current_org_role(b.organization_id) <> 'resident'
    and (
      public.is_org_admin(b.organization_id)
      or public.can_access_location(b.organization_id, b.location_id)
    )
  union all
  select
    b.organization_id,
    b.resident_id,
    b.location_id,
    b.resource_id,
    b.resource_type
  from public.protected_document_bindings b
  join public.signature_requests d
    on b.resource_type = 'signature_requests'
   and d.id = b.resource_id
   and d.file_url = b.storage_path
   and d.organization_id = b.organization_id
   and d.resident_id = b.resident_id
  where b.storage_bucket = p_bucket
    and b.storage_path = p_path
    and b.storage_bucket = 'secure-documents'
    and (storage.foldername(b.storage_path))[1] = b.organization_id::text
    and public.can_access_resident(b.organization_id, b.resident_id)
  limit 1;
$$;

revoke execute on function public.authorized_protected_document(text, text)
from public, anon, authenticated, service_role;

-- Protected object bytes are signed only after record_document_access audits the caller.
drop policy if exists "Members can read organization storage files" on storage.objects;
drop policy if exists "Scoped members can read protected storage files" on storage.objects;
drop policy if exists "Members can read medication photos" on storage.objects;
drop function if exists public.can_read_protected_storage_object(text, text);

create policy "Members can read medication photos"
on storage.objects
for select using (
  bucket_id = 'medication-photos'
  and public.is_org_member((storage.foldername(name))[1]::uuid)
);

drop function public.record_document_access(text, text);
create function public.record_document_access(p_bucket text, p_path text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  document_record record;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select authorized_document.* into document_record
  from public.authorized_protected_document(p_bucket, p_path) authorized_document;

  if document_record.resource_id is null then
    raise exception 'Document access denied' using errcode = '42501';
  end if;

  insert into public.audit_logs (
    organization_id,
    performed_by_id,
    resident_id,
    action,
    resource_type,
    resource_id,
    description
  ) values (
    document_record.organization_id,
    auth.uid(),
    document_record.resident_id,
    'document_access_authorized',
    document_record.resource_type,
    document_record.resource_id,
    'Authorized a protected document URL.'
  );

  return jsonb_build_object(
    'bucket', p_bucket,
    'path', p_path,
    'resourceType', document_record.resource_type,
    'resourceId', document_record.resource_id
  );
end;
$$;

revoke execute on function public.record_document_access(text, text)
from public, anon;
grant execute on function public.record_document_access(text, text)
to authenticated;

drop policy if exists "Members can upload organization storage files" on storage.objects;
drop policy if exists "Staff can upload organization storage files" on storage.objects;
create policy "Staff can upload organization storage files"
on storage.objects
for insert with check (
  bucket_id in ('resident-documents', 'secure-documents', 'medication-photos', 'intake-attachments')
  and public.is_org_member((storage.foldername(name))[1]::uuid)
  and public.current_org_role((storage.foldername(name))[1]::uuid) <> 'resident'
);

drop policy if exists "Members can update organization storage files" on storage.objects;
drop policy if exists "Staff can update organization storage files" on storage.objects;
create policy "Staff can update organization storage files"
on storage.objects
for update using (
  bucket_id in ('resident-documents', 'secure-documents', 'medication-photos', 'intake-attachments')
  and public.is_org_member((storage.foldername(name))[1]::uuid)
  and public.current_org_role((storage.foldername(name))[1]::uuid) <> 'resident'
) with check (
  bucket_id in ('resident-documents', 'secure-documents', 'medication-photos', 'intake-attachments')
  and public.is_org_member((storage.foldername(name))[1]::uuid)
  and public.current_org_role((storage.foldername(name))[1]::uuid) <> 'resident'
);
