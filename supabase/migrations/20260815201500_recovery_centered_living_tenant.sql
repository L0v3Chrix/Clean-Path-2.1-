insert into public.organizations (id, name, status)
values (
  '00000000-0000-4000-8000-000000000001',
  'Recovery Centered Living',
  'active'
)
on conflict (id) do nothing;
