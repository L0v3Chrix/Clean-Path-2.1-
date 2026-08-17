revoke insert, update, delete, truncate
on table public.audit_logs
from public, anon, authenticated;

revoke insert, update, delete, truncate
on table public.application_error_events
from public, anon, authenticated;

do $$
declare
  policy_record record;
begin
  for policy_record in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('audit_logs', 'application_error_events')
      and cmd in ('ALL', 'INSERT', 'UPDATE', 'DELETE')
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      policy_record.policyname,
      policy_record.schemaname,
      policy_record.tablename
    );
  end loop;
end;
$$;
