create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke execute on function public.set_updated_at() from public, anon, authenticated;

revoke execute on function public.is_org_member(uuid) from public, anon;
revoke execute on function public.is_org_admin(uuid) from public, anon;
grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.is_org_admin(uuid) to authenticated;

revoke execute on function public.bootstrap_organization_owner(uuid, text, text) from public, anon;
revoke execute on function public.generate_chore_rotation(uuid, uuid, date) from public, anon;
grant execute on function public.bootstrap_organization_owner(uuid, text, text) to authenticated;
grant execute on function public.generate_chore_rotation(uuid, uuid, date) to authenticated;

revoke execute on function public.clear_sample_data(uuid) from public, anon, authenticated;
grant execute on function public.clear_sample_data(uuid) to service_role;
