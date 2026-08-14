create table public.application_error_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('render_error','request_error','unhandled_error','health_check_failed','unknown_error')),
  component text not null check (char_length(component) between 1 and 64),
  route text not null check (char_length(route) between 1 and 80),
  release text not null check (char_length(release) between 1 and 80),
  occurred_at timestamptz not null default now()
);

-- Cascading child deletes may run after the resident row is gone. Preserve the
-- audit event without retaining a dangling resident foreign key.
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

  if subject_resident_id is not null and not exists (
    select 1 from public.residents where id = subject_resident_id
  ) then
    subject_resident_id := null;
  end if;

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

revoke execute on function public.audit_sensitive_mutation() from public, anon, authenticated;

create index application_error_events_org_time_idx
  on public.application_error_events (organization_id, occurred_at desc);

alter table public.application_error_events enable row level security;

create policy application_error_events_admin_read
on public.application_error_events
for select using (public.is_org_admin(organization_id));

create or replace function public.record_application_error(
  p_category text,
  p_component text,
  p_route text,
  p_release text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  org_id uuid;
begin
  select organization_id into org_id
  from public.organization_members
  where user_id = auth.uid() and status = 'active'
  order by created_at asc
  limit 1;

  if org_id is null then raise exception 'Active organization membership required'; end if;
  if p_category not in ('render_error','request_error','unhandled_error','health_check_failed','unknown_error') then
    p_category := 'unknown_error';
  end if;

  insert into public.application_error_events (
    organization_id, user_id, category, component, route, release
  ) values (
    org_id,
    auth.uid(),
    p_category,
    left(coalesce(nullif(trim(p_component), ''), 'Application'), 64),
    left(coalesce(nullif(trim(p_route), ''), '/'), 80),
    left(coalesce(nullif(trim(p_release), ''), 'unknown'), 80)
  );
end;
$$;

create or replace function public.record_data_export(
  p_organization_id uuid,
  p_resource_type text,
  p_record_count integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.organization_members
    where organization_id = p_organization_id and user_id = auth.uid() and status = 'active'
  ) then
    raise exception 'Active organization membership required';
  end if;

  insert into public.audit_logs (
    organization_id, performed_by_id, action, resource_type, description
  ) values (
    p_organization_id,
    auth.uid(),
    'export',
    left(coalesce(nullif(trim(p_resource_type), ''), 'unknown'), 80),
    format('Exported %s authorized records', greatest(coalesce(p_record_count, 0), 0))
  );
end;
$$;

grant select on public.application_error_events to authenticated;
revoke insert, update, delete on public.application_error_events from authenticated;
revoke execute on function public.record_application_error(text, text, text, text) from public, anon;
revoke execute on function public.record_data_export(uuid, text, integer) from public, anon;
grant execute on function public.record_application_error(text, text, text, text) to authenticated;
grant execute on function public.record_data_export(uuid, text, integer) to authenticated;

revoke all on public.application_error_events from anon;
