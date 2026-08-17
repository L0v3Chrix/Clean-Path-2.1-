create table public.user_onboarding_progress (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  flow text not null check (flow = btrim(flow) and flow <> ''),
  version integer not null check (version > 0),
  status text not null default 'pending'
    check (status in ('pending', 'in_progress', 'completed', 'dismissed')),
  current_step text check (current_step is null or (current_step = btrim(current_step) and current_step <> '')),
  completed_steps text[] not null default '{}'::text[],
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, user_id, flow, version)
);

create trigger user_onboarding_progress_set_updated_at
before update on public.user_onboarding_progress
for each row execute function public.set_updated_at();

alter table public.user_onboarding_progress enable row level security;

create policy user_onboarding_progress_select_own_active_membership
on public.user_onboarding_progress
for select
to authenticated
using (
  user_id = auth.uid()
  and public.is_org_member(organization_id)
);

create policy user_onboarding_progress_insert_own_active_membership
on public.user_onboarding_progress
for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.is_org_member(organization_id)
);

create policy user_onboarding_progress_update_own_active_membership
on public.user_onboarding_progress
for update
to authenticated
using (
  user_id = auth.uid()
  and public.is_org_member(organization_id)
)
with check (
  user_id = auth.uid()
  and public.is_org_member(organization_id)
);

revoke all on table public.user_onboarding_progress from public, anon, authenticated;
grant select, insert, update on table public.user_onboarding_progress to authenticated;
grant all privileges on table public.user_onboarding_progress to service_role;

create index user_onboarding_progress_user_updated_idx
on public.user_onboarding_progress (user_id, updated_at desc);

create index user_onboarding_progress_org_status_idx
on public.user_onboarding_progress (organization_id, status, updated_at desc);

create policy locations_select_resident_home
on public.locations
for select
to authenticated
using (
  exists (
    select 1
    from public.residents r
    where r.user_id = auth.uid()
      and r.status = 'active'
      and r.organization_id = locations.organization_id
      and r.location_id = locations.id
  )
);

create table public.account_claims (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  token_hash bytea not null unique check (octet_length(token_hash) = 32),
  email text not null check (email = btrim(email) and email <> ''),
  initial_role text not null default 'admin' check (initial_role in ('owner', 'admin')),
  expires_at timestamptz not null,
  used_at timestamptz,
  used_by_user_id uuid references auth.users(id) on delete set null,
  revoked_at timestamptz,
  revoked_by_user_id uuid references auth.users(id) on delete set null,
  revocation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null
);

create trigger account_claims_set_updated_at
before update on public.account_claims
for each row execute function public.set_updated_at();

alter table public.account_claims enable row level security;

revoke all on table public.account_claims from public, anon, authenticated, service_role;
grant select, insert, update on table public.account_claims to service_role;

create index account_claims_pending_organization_idx
on public.account_claims (organization_id, expires_at)
where used_at is null and revoked_at is null;

create index account_claims_email_expiry_idx
on public.account_claims (lower(email), expires_at desc);

create or replace function public.enforce_single_pending_account_claim()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  perform 1
  from public.organizations o
  where o.id = new.organization_id
  for update;
  if not found then
    raise exception 'Account claim organization not found' using errcode = '23503';
  end if;

  if new.expires_at <= statement_timestamp() then
    raise exception 'Account claim must expire in the future' using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.organization_members om
    where om.organization_id = new.organization_id
      and om.status = 'active'
  ) then
    raise exception 'Account claim organization already has an active membership'
      using errcode = '23514';
  end if;

  update public.account_claims ac
  set revoked_at = statement_timestamp(),
      revocation_reason = 'expired_replaced'
  where ac.organization_id = new.organization_id
    and ac.used_at is null
    and ac.revoked_at is null
    and ac.expires_at <= statement_timestamp();

  if exists (
    select 1
    from public.account_claims ac
    where ac.organization_id = new.organization_id
      and ac.used_at is null
      and ac.revoked_at is null
  ) then
    raise exception 'Account claim organization already has a pending claim'
      using errcode = '23505';
  end if;

  return new;
end;
$$;

revoke execute on function public.enforce_single_pending_account_claim()
from public, anon, authenticated, service_role;

create trigger account_claims_enforce_single_pending
before insert on public.account_claims
for each row execute function public.enforce_single_pending_account_claim();

create unique index account_claims_one_pending_organization_idx
on public.account_claims (organization_id)
where used_at is null and revoked_at is null;

create or replace function public.enforce_principal_type_separation()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  candidate_user_id uuid;
begin
  if tg_table_name = 'staff_profiles' then
    candidate_user_id := new.user_id;
    if candidate_user_id is null then
      return new;
    end if;

    perform 1
    from auth.users u
    where u.id = candidate_user_id
    for update;
    if not found then
      raise exception 'Auth user not found' using errcode = 'P0002';
    end if;

    if exists (
      select 1
      from public.residents r
      where r.user_id = candidate_user_id
        and r.status = 'active'
    ) then
      raise exception 'An active resident principal cannot hold a staff profile'
        using errcode = '23514';
    end if;

    if exists (
      select 1
      from public.organization_members om
      where om.user_id = candidate_user_id
        and om.role = 'resident'
        and om.status = 'active'
    ) then
      raise exception 'An active resident principal cannot hold a staff profile'
        using errcode = '23514';
    end if;

    return new;
  end if;

  if tg_table_name = 'organization_members' then
    candidate_user_id := new.user_id;
    if candidate_user_id is null then
      return new;
    end if;

    perform 1
    from auth.users u
    where u.id = candidate_user_id
    for update;
    if not found then
      raise exception 'Auth user not found' using errcode = 'P0002';
    end if;

    if new.role = 'resident' then
      if exists (
        select 1
        from public.staff_profiles sp
        where sp.user_id = candidate_user_id
      ) then
        raise exception 'A staff-linked principal cannot hold a resident membership'
          using errcode = '23514';
      end if;

      if exists (
        select 1
        from public.organization_members om
        where om.user_id = candidate_user_id
          and om.role <> 'resident'
          and om.status = 'active'
          and om.id is distinct from new.id
      ) then
        raise exception 'A non-resident principal cannot hold a resident membership'
          using errcode = '23514';
      end if;

      return new;
    end if;

    if exists (
      select 1
      from public.organization_members om
      where om.user_id = candidate_user_id
        and om.role = 'resident'
        and om.status = 'active'
        and om.id is distinct from new.id
    ) then
      raise exception 'An active resident principal cannot hold a non-resident membership'
        using errcode = '23514';
    end if;

    if exists (
      select 1
      from public.residents r
      where r.user_id = candidate_user_id
        and r.status = 'active'
    ) then
      raise exception 'An active resident principal cannot hold a non-resident membership'
        using errcode = '23514';
    end if;

    return new;
  end if;

  if tg_table_name = 'residents' then
    candidate_user_id := new.user_id;
    if candidate_user_id is null or new.status <> 'active' then
      return new;
    end if;

    perform 1
    from auth.users u
    where u.id = candidate_user_id
    for update;
    if not found then
      raise exception 'Auth user not found' using errcode = 'P0002';
    end if;

    if exists (
      select 1
      from public.staff_profiles sp
      where sp.user_id = candidate_user_id
    ) then
      raise exception 'A staff-linked principal cannot be bound to an active resident'
        using errcode = '23514';
    end if;

    if exists (
      select 1
      from public.organization_members om
      where om.user_id = candidate_user_id
        and om.role <> 'resident'
    ) then
      raise exception 'A non-resident member cannot be bound to an active resident'
        using errcode = '23514';
    end if;

    return new;
  end if;

  raise exception 'Principal-type trigger attached to an unsupported table'
    using errcode = '55000';
end;
$$;

revoke execute on function public.enforce_principal_type_separation()
from public, anon, authenticated, service_role;

do $$
begin
  if exists (
    select 1
    from public.residents r
    join public.staff_profiles sp on sp.user_id = r.user_id
    where r.user_id is not null
      and r.status = 'active'
  ) then
    raise exception 'Existing data mixes active resident and staff principals'
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.residents r
    join public.organization_members om on om.user_id = r.user_id
    where r.user_id is not null
      and r.status = 'active'
      and om.role <> 'resident'
  ) then
    raise exception 'Existing data gives an active resident a non-resident membership'
      using errcode = '23514';
  end if;
end;
$$;

create trigger staff_profiles_enforce_principal_type
before insert or update on public.staff_profiles
for each row execute function public.enforce_principal_type_separation();

create trigger organization_members_enforce_principal_type
before insert or update on public.organization_members
for each row execute function public.enforce_principal_type_separation();

create trigger residents_enforce_principal_type
before insert or update on public.residents
for each row execute function public.enforce_principal_type_separation();

create or replace function public.claim_pre_authorized_account(
  p_token text,
  p_display_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth, extensions
as $$
declare
  claim_record public.account_claims;
  membership public.organization_members;
  caller_id uuid := auth.uid();
  caller_email text := auth.jwt() ->> 'email';
begin
  if auth.role() is distinct from 'authenticated' or caller_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_token is null or p_token = '' then
    raise exception 'Account claim token is required' using errcode = '22023';
  end if;

  select ac.* into claim_record
  from public.account_claims ac
  where ac.token_hash = extensions.digest(p_token, 'sha256')
  for update;

  if claim_record.id is null then
    raise exception 'Account claim is invalid' using errcode = '22023';
  end if;
  if claim_record.revoked_at is not null then
    raise exception 'Account claim is no longer pending' using errcode = '22023';
  end if;
  if caller_email is null or lower(caller_email) <> lower(claim_record.email) then
    raise exception 'Account claim email does not match the authenticated identity'
      using errcode = '42501';
  end if;

  if claim_record.used_at is not null then
    if claim_record.used_by_user_id is distinct from caller_id then
      raise exception 'Account claim is no longer pending' using errcode = '22023';
    end if;

    select om.* into membership
    from public.organization_members om
    where om.organization_id = claim_record.organization_id
      and om.user_id = caller_id
      and om.status = 'active'
    limit 1;

    if membership.id is null then
      raise exception 'Account claim completion is inconsistent' using errcode = '55000';
    end if;

    return jsonb_build_object(
      'claimId', claim_record.id,
      'organizationId', claim_record.organization_id,
      'membershipId', membership.id,
      'role', membership.role
    );
  end if;

  if claim_record.expires_at <= statement_timestamp() then
    raise exception 'Account claim is no longer pending' using errcode = '22023';
  end if;

  perform 1
  from auth.users u
  where u.id = caller_id
  for update;
  if not found then
    raise exception 'Authenticated user not found' using errcode = 'P0002';
  end if;

  perform 1
  from public.organizations o
  where o.id = claim_record.organization_id
  for update;
  if not found then
    raise exception 'Claim organization not found' using errcode = 'P0002';
  end if;

  if exists (
    select 1
    from public.organization_members om
    where om.organization_id = claim_record.organization_id
      and om.status = 'active'
  ) then
    raise exception 'Claim organization already has an active membership'
      using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.organization_members om
    where om.user_id = caller_id
      and om.status = 'active'
  ) then
    raise exception 'Authenticated user already has an active organization membership'
      using errcode = '42501';
  end if;

  insert into public.organization_members (
    organization_id,
    user_id,
    role,
    display_name,
    email,
    status,
    created_by,
    updated_by
  ) values (
    claim_record.organization_id,
    caller_id,
    claim_record.initial_role,
    nullif(btrim(p_display_name), ''),
    claim_record.email,
    'active',
    caller_id,
    caller_id
  )
  returning * into membership;

  update public.account_claims
  set used_at = statement_timestamp(),
      used_by_user_id = caller_id,
      updated_by = caller_id
  where id = claim_record.id;

  insert into public.audit_logs (
    organization_id,
    performed_by_id,
    performed_by_name,
    action,
    resource_type,
    resource_id,
    description,
    created_by,
    updated_by
  ) values (
    claim_record.organization_id,
    caller_id,
    coalesce(nullif(btrim(p_display_name), ''), claim_record.email),
    'account_claimed',
    'organization_members',
    membership.id,
    'Pre-authorized account claim completed.',
    caller_id,
    caller_id
  );

  return jsonb_build_object(
    'claimId', claim_record.id,
    'organizationId', claim_record.organization_id,
    'membershipId', membership.id,
    'role', membership.role
  );
end;
$$;

revoke execute on function public.claim_pre_authorized_account(text, text)
from public, anon, service_role;
grant execute on function public.claim_pre_authorized_account(text, text)
to authenticated;

revoke execute on function public.bootstrap_organization_owner(uuid, text, text)
from public, anon, authenticated, service_role;

create table public.user_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  membership_id uuid references public.organization_members(id) on delete set null,
  staff_profile_id uuid references public.staff_profiles(id) on delete set null,
  resident_id uuid references public.residents(id) on delete set null,
  invited_by_user_id uuid not null references auth.users(id),
  principal_type text not null check (principal_type in ('staff', 'resident')),
  email text not null,
  operation_marker uuid not null unique,
  activation_token_hash bytea not null unique,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'revoked')),
  expires_at timestamptz not null default (now() + interval '1 hour'),
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_invitations_exact_target check (
    (principal_type = 'staff' and staff_profile_id is not null and resident_id is null)
    or (principal_type = 'resident' and resident_id is not null and staff_profile_id is null)
  )
);

create unique index user_invitations_one_pending_user_idx
on public.user_invitations (user_id)
where status = 'pending';

create unique index user_invitations_one_pending_staff_profile_idx
on public.user_invitations (staff_profile_id)
where status = 'pending' and staff_profile_id is not null;

create unique index user_invitations_one_pending_resident_idx
on public.user_invitations (resident_id)
where status = 'pending' and resident_id is not null;

alter table public.user_invitations enable row level security;
revoke all on public.user_invitations from public, anon, authenticated;
grant select, insert, update, delete on public.user_invitations to service_role;

create or replace function public.register_pre_authorized_invitation(
  p_organization_id uuid,
  p_user_id uuid,
  p_membership_id uuid,
  p_staff_profile_id uuid,
  p_email text,
  p_invited_by_user_id uuid,
  p_operation_marker uuid,
  p_activation_token text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth, extensions
as $$
declare
  invitation_record public.user_invitations;
  membership_record public.organization_members;
  profile_record public.staff_profiles;
  inviter_record public.organization_members;
  auth_email text;
  auth_operation_marker text;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Invitation registration requires service credentials'
      using errcode = '42501';
  end if;
  if p_email is null or p_email = '' or p_email <> btrim(p_email)
    or p_activation_token is null or p_activation_token = '' then
    raise exception 'Invitation email and activation secret are required'
      using errcode = '22023';
  end if;

  select ui.* into invitation_record
  from public.user_invitations ui
  where ui.operation_marker = p_operation_marker
  for update;

  if invitation_record.id is not null then
    if invitation_record.organization_id <> p_organization_id
      or invitation_record.user_id <> p_user_id
      or invitation_record.membership_id <> p_membership_id
      or invitation_record.staff_profile_id <> p_staff_profile_id
      or invitation_record.principal_type <> 'staff'
      or lower(invitation_record.email) <> lower(p_email)
      or invitation_record.activation_token_hash
        <> extensions.digest(p_activation_token, 'sha256')
      or invitation_record.status <> 'pending' then
      raise exception 'Invitation registration is inconsistent' using errcode = '23505';
    end if;
    return jsonb_build_object(
      'invitationId', invitation_record.id,
      'membershipId', invitation_record.membership_id,
      'staffProfileId', invitation_record.staff_profile_id,
      'alreadyRegistered', true
    );
  end if;

  select u.email, u.raw_user_meta_data ->> 'invite_operation_id'
  into auth_email, auth_operation_marker
  from auth.users u
  where u.id = p_user_id
  for update;
  if not found then
    raise exception 'Auth user not found' using errcode = 'P0002';
  end if;
  if auth_email is null or lower(btrim(auth_email)) <> lower(p_email)
    or auth_operation_marker is distinct from p_operation_marker::text then
    raise exception 'Invitation Auth identity does not match the prepared operation'
      using errcode = '42501';
  end if;

  select om.* into inviter_record
  from public.organization_members om
  where om.organization_id = p_organization_id
    and om.user_id = p_invited_by_user_id
    and om.status = 'active'
    and om.role in ('owner', 'admin')
  for update;
  if not found then
    raise exception 'Invitation requires an active organization administrator'
      using errcode = '42501';
  end if;

  select om.* into membership_record
  from public.organization_members om
  where om.id = p_membership_id
    and om.organization_id = p_organization_id
    and om.user_id = p_user_id
    and om.status = 'invited'
    and om.role <> 'resident'
  for update;
  if not found then
    raise exception 'Pending staff membership not found' using errcode = 'P0002';
  end if;
  if membership_record.role = 'owner' and inviter_record.role <> 'owner' then
    raise exception 'Only an owner can grant owner access' using errcode = '42501';
  end if;

  select sp.* into profile_record
  from public.staff_profiles sp
  where sp.id = p_staff_profile_id
    and sp.organization_id = p_organization_id
    and sp.user_id = p_user_id
    and sp.status = 'inactive'
  for update;
  if not found then
    raise exception 'Pending staff profile not found' using errcode = 'P0002';
  end if;
  if profile_record.email is null or lower(btrim(profile_record.email)) <> lower(p_email) then
    raise exception 'Invitation email does not match the staff profile'
      using errcode = '42501';
  end if;

  insert into public.user_invitations (
    organization_id,
    user_id,
    membership_id,
    staff_profile_id,
    invited_by_user_id,
    principal_type,
    email,
    operation_marker,
    activation_token_hash
  ) values (
    p_organization_id,
    p_user_id,
    p_membership_id,
    p_staff_profile_id,
    p_invited_by_user_id,
    'staff',
    lower(p_email),
    p_operation_marker,
    extensions.digest(p_activation_token, 'sha256')
  )
  returning * into invitation_record;

  return jsonb_build_object(
    'invitationId', invitation_record.id,
    'membershipId', invitation_record.membership_id,
    'staffProfileId', invitation_record.staff_profile_id,
    'alreadyRegistered', false
  );
end;
$$;

revoke execute on function public.register_pre_authorized_invitation(
  uuid, uuid, uuid, uuid, text, uuid, uuid, text
) from public, anon, authenticated;
grant execute on function public.register_pre_authorized_invitation(
  uuid, uuid, uuid, uuid, text, uuid, uuid, text
) to service_role;

drop function if exists public.finalize_resident_invitation(uuid, uuid, uuid, text, uuid);

create or replace function public.finalize_resident_invitation(
  p_organization_id uuid,
  p_resident_id uuid,
  p_user_id uuid,
  p_email text,
  p_invited_by_user_id uuid,
  p_operation_marker uuid,
  p_activation_token text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth, extensions
as $$
declare
  resident_record public.residents;
  inviter_membership public.organization_members;
  invitation_record public.user_invitations;
  auth_user_email text;
  auth_operation_marker text;
  membership_id uuid;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Resident invitation finalization requires service credentials'
      using errcode = '42501';
  end if;
  if p_email is null or p_email = '' or p_email <> btrim(p_email)
    or p_activation_token is null or p_activation_token = '' then
    raise exception 'Resident invitation email and activation secret are required'
      using errcode = '22023';
  end if;

  select ui.* into invitation_record
  from public.user_invitations ui
  where ui.operation_marker = p_operation_marker
  for update;

  if invitation_record.id is not null then
    if invitation_record.organization_id <> p_organization_id
      or invitation_record.user_id <> p_user_id
      or invitation_record.resident_id <> p_resident_id
      or invitation_record.principal_type <> 'resident'
      or lower(invitation_record.email) <> lower(p_email)
      or invitation_record.activation_token_hash
        <> extensions.digest(p_activation_token, 'sha256')
      or invitation_record.status <> 'pending' then
      raise exception 'Resident invitation preparation is inconsistent'
        using errcode = '23505';
    end if;
    return jsonb_build_object(
      'organizationId', invitation_record.organization_id,
      'residentId', invitation_record.resident_id,
      'userId', invitation_record.user_id,
      'membershipId', invitation_record.membership_id,
      'invitationId', invitation_record.id,
      'alreadyFinalized', true
    );
  end if;

  select r.* into resident_record
  from public.residents r
  where r.id = p_resident_id
  for update;

  if resident_record.id is null then
    raise exception 'Resident not found' using errcode = 'P0002';
  end if;
  if resident_record.organization_id <> p_organization_id then
    raise exception 'Resident does not belong to the requested organization'
      using errcode = '23503';
  end if;
  if resident_record.status <> 'active' then
    raise exception 'Resident invitation requires an active resident'
      using errcode = '22023';
  end if;
  if resident_record.user_id is not null and resident_record.user_id <> p_user_id then
    raise exception 'Resident is already linked to an Auth user'
      using errcode = '23505';
  end if;
  if resident_record.email is null
    or lower(btrim(resident_record.email)) <> lower(p_email) then
    raise exception 'Resident invitation email does not match the resident record'
      using errcode = '42501';
  end if;

  select om.* into inviter_membership
  from public.organization_members om
  where om.organization_id = p_organization_id
    and om.user_id = p_invited_by_user_id
    and om.status = 'active'
    and om.role in ('owner', 'admin')
  for update;

  if not found then
    raise exception 'Resident invitation requires an active organization administrator'
      using errcode = '42501';
  end if;

  select u.email, u.raw_user_meta_data ->> 'invite_operation_id'
  into auth_user_email, auth_operation_marker
  from auth.users u
  where u.id = p_user_id
  for update;
  if not found then
    raise exception 'Auth user not found' using errcode = 'P0002';
  end if;
  if auth_user_email is null or lower(btrim(auth_user_email)) <> lower(p_email)
    or auth_operation_marker is distinct from p_operation_marker::text then
    raise exception 'Resident invitation does not match the prepared Auth user'
      using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.residents r
    where r.user_id = p_user_id
  ) then
    raise exception 'Auth user is already linked to a resident'
      using errcode = '23505';
  end if;

  if exists (
    select 1
    from public.organization_members om
    where om.user_id = p_user_id
      and om.status = 'active'
  ) then
    raise exception 'Auth user already has an active organization membership'
      using errcode = '23505';
  end if;

  if exists (
    select 1
    from public.staff_profiles sp
    where sp.user_id = p_user_id
  ) then
    raise exception 'A staff-linked Auth user cannot be finalized as a resident'
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.organization_members om
    where om.user_id = p_user_id
      and om.role <> 'resident'
  ) then
    raise exception 'A non-resident member cannot be finalized as a resident'
      using errcode = '23514';
  end if;

  insert into public.organization_members (
    organization_id,
    user_id,
    role,
    display_name,
    email,
    status
  ) values (
    p_organization_id,
    p_user_id,
    'resident',
    coalesce(
      nullif(btrim(resident_record.preferred_name), ''),
      nullif(btrim(concat_ws(' ', resident_record.first_name, resident_record.last_name)), '')
    ),
    lower(p_email),
    'invited'
  )
  returning id into membership_id;

  insert into public.user_invitations (
    organization_id,
    user_id,
    membership_id,
    resident_id,
    invited_by_user_id,
    principal_type,
    email,
    operation_marker,
    activation_token_hash
  ) values (
    p_organization_id,
    p_user_id,
    membership_id,
    p_resident_id,
    p_invited_by_user_id,
    'resident',
    lower(p_email),
    p_operation_marker,
    extensions.digest(p_activation_token, 'sha256')
  )
  returning * into invitation_record;

  return jsonb_build_object(
    'organizationId', p_organization_id,
    'residentId', resident_record.id,
    'userId', p_user_id,
    'membershipId', membership_id,
    'invitationId', invitation_record.id,
    'alreadyFinalized', false
  );
end;
$$;

revoke execute on function public.finalize_resident_invitation(
  uuid, uuid, uuid, text, uuid, uuid, text
)
from public, anon, authenticated;
grant execute on function public.finalize_resident_invitation(
  uuid, uuid, uuid, text, uuid, uuid, text
)
to service_role;

create or replace function public.accept_pre_authorized_invitation(
  p_activation_token text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth, extensions
as $$
declare
  invitation_record public.user_invitations;
  membership_record public.organization_members;
  profile_record public.staff_profiles;
  resident_record public.residents;
  caller_id uuid := auth.uid();
  caller_email text := auth.jwt() ->> 'email';
  auth_user_email text;
begin
  if auth.role() is distinct from 'authenticated' or caller_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_activation_token is null or p_activation_token = '' then
    raise exception 'Invitation activation secret is required' using errcode = '22023';
  end if;

  select ui.* into invitation_record
  from public.user_invitations ui
  where ui.activation_token_hash = extensions.digest(p_activation_token, 'sha256')
  for update;
  if not found then
    raise exception 'Invitation activation secret is invalid' using errcode = '22023';
  end if;
  if invitation_record.user_id <> caller_id
    or caller_email is null
    or lower(caller_email) <> lower(invitation_record.email) then
    raise exception 'Invitation does not match the authenticated identity'
      using errcode = '42501';
  end if;

  select u.email into auth_user_email
  from auth.users u
  where u.id = caller_id
  for update;
  if not found or auth_user_email is null
    or lower(btrim(auth_user_email)) <> lower(invitation_record.email) then
    raise exception 'Invitation does not match the Auth identity'
      using errcode = '42501';
  end if;

  select om.* into membership_record
  from public.organization_members om
  where om.id = invitation_record.membership_id
    and om.organization_id = invitation_record.organization_id
    and om.user_id = caller_id
  for update;
  if not found then
    raise exception 'Invitation authorization is incomplete' using errcode = '55000';
  end if;

  if invitation_record.status = 'accepted' then
    if membership_record.status <> 'active' then
      raise exception 'Invitation acceptance is inconsistent' using errcode = '55000';
    end if;
    if invitation_record.principal_type = 'staff' then
      if not exists (
        select 1 from public.staff_profiles sp
        where sp.id = invitation_record.staff_profile_id
          and sp.organization_id = invitation_record.organization_id
          and sp.user_id = caller_id
          and sp.status = 'active'
      ) then
        raise exception 'Invitation acceptance is inconsistent' using errcode = '55000';
      end if;
    elsif not exists (
      select 1 from public.residents r
      where r.id = invitation_record.resident_id
        and r.organization_id = invitation_record.organization_id
        and r.user_id = caller_id
        and r.status = 'active'
    ) then
      raise exception 'Invitation acceptance is inconsistent' using errcode = '55000';
    end if;

    return jsonb_build_object(
      'invitationId', invitation_record.id,
      'organizationId', invitation_record.organization_id,
      'membershipId', membership_record.id,
      'role', membership_record.role,
      'residentId', invitation_record.resident_id,
      'alreadyAccepted', true
    );
  end if;

  if invitation_record.status <> 'pending'
    or invitation_record.expires_at <= statement_timestamp() then
    raise exception 'Invitation is no longer pending' using errcode = '22023';
  end if;
  if membership_record.status <> 'invited' then
    raise exception 'Invitation authorization is not pending' using errcode = '55000';
  end if;
  if exists (
    select 1
    from public.organization_members om
    where om.user_id = caller_id
      and om.status = 'active'
      and om.id <> membership_record.id
  ) then
    raise exception 'Authenticated user already has active organization access'
      using errcode = '23505';
  end if;

  if invitation_record.principal_type = 'staff' then
    select sp.* into profile_record
    from public.staff_profiles sp
    where sp.id = invitation_record.staff_profile_id
      and sp.organization_id = invitation_record.organization_id
      and sp.user_id = caller_id
      and sp.status = 'inactive'
    for update;
    if not found then
      raise exception 'Pending staff profile not found' using errcode = '55000';
    end if;

    update public.staff_profiles
    set status = 'active', updated_by = caller_id
    where id = profile_record.id;
  else
    select r.* into resident_record
    from public.residents r
    where r.id = invitation_record.resident_id
      and r.organization_id = invitation_record.organization_id
    for update;
    if not found or resident_record.status <> 'active'
      or resident_record.user_id is not null
      or resident_record.email is null
      or lower(btrim(resident_record.email)) <> lower(invitation_record.email) then
      raise exception 'Pending resident invitation is no longer eligible'
        using errcode = '55000';
    end if;
    if exists (
      select 1 from public.residents r
      where r.user_id = caller_id and r.id <> resident_record.id
    ) then
      raise exception 'Authenticated user is already linked to another resident'
        using errcode = '23505';
    end if;

    update public.residents
    set user_id = caller_id, updated_by = caller_id
    where id = resident_record.id and user_id is null;
    if not found then
      raise exception 'Resident invitation changed during acceptance' using errcode = '40001';
    end if;
  end if;

  update public.organization_members
  set status = 'active', updated_by = caller_id
  where id = membership_record.id and status = 'invited';
  if not found then
    raise exception 'Invitation authorization changed during acceptance' using errcode = '40001';
  end if;

  update public.user_invitations
  set status = 'accepted',
      accepted_at = statement_timestamp(),
      updated_at = statement_timestamp()
  where id = invitation_record.id and status = 'pending';
  if not found then
    raise exception 'Invitation changed during acceptance' using errcode = '40001';
  end if;

  insert into public.audit_logs (
    organization_id,
    performed_by_id,
    performed_by_name,
    resident_id,
    action,
    resource_type,
    resource_id,
    description,
    created_by,
    updated_by
  ) values (
    invitation_record.organization_id,
    caller_id,
    coalesce(
      nullif(btrim(membership_record.display_name), ''),
      invitation_record.email
    ),
    invitation_record.resident_id,
    'invitation_accepted',
    'user_invitation',
    invitation_record.id,
    case invitation_record.principal_type
      when 'resident' then 'Resident invitation accepted and account access activated.'
      else 'Staff invitation accepted and account access activated.'
    end,
    caller_id,
    caller_id
  );

  return jsonb_build_object(
    'invitationId', invitation_record.id,
    'organizationId', invitation_record.organization_id,
    'membershipId', membership_record.id,
    'role', membership_record.role,
    'residentId', invitation_record.resident_id,
    'alreadyAccepted', false
  );
end;
$$;

revoke execute on function public.accept_pre_authorized_invitation(text)
from public, anon, service_role;
grant execute on function public.accept_pre_authorized_invitation(text)
to authenticated;

create or replace function public.revoke_pre_authorized_invitation(
  p_user_id uuid,
  p_operation_marker uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  invitation_record public.user_invitations;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Invitation revocation requires service credentials'
      using errcode = '42501';
  end if;

  select ui.* into invitation_record
  from public.user_invitations ui
  where ui.user_id = p_user_id
    and ui.operation_marker = p_operation_marker
  for update;

  if not found then
    return jsonb_build_object('alreadyRevoked', true);
  end if;

  update public.organization_members
  set status = 'inactive'
  where id = invitation_record.membership_id
    and organization_id = invitation_record.organization_id
    and user_id = p_user_id;

  if invitation_record.staff_profile_id is not null then
    update public.staff_profiles
    set status = 'inactive'
    where id = invitation_record.staff_profile_id
      and organization_id = invitation_record.organization_id
      and user_id = p_user_id;
  end if;

  if invitation_record.resident_id is not null then
    update public.residents
    set user_id = null
    where id = invitation_record.resident_id
      and organization_id = invitation_record.organization_id
      and user_id = p_user_id;
  end if;

  update public.user_invitations
  set status = 'revoked',
      revoked_at = coalesce(revoked_at, statement_timestamp()),
      updated_at = statement_timestamp()
  where id = invitation_record.id;

  return jsonb_build_object(
    'invitationId', invitation_record.id,
    'membershipId', invitation_record.membership_id,
    'alreadyRevoked', invitation_record.status = 'revoked'
  );
end;
$$;

revoke execute on function public.revoke_pre_authorized_invitation(uuid, uuid)
from public, anon, authenticated;
grant execute on function public.revoke_pre_authorized_invitation(uuid, uuid)
to service_role;

create unique index if not exists residents_one_user_per_account_idx
on public.residents (user_id)
where user_id is not null;
