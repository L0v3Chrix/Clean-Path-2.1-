import { randomUUID } from 'node:crypto';
import {
  createSupabaseAdminClient,
  logStep,
  parseArgs,
  resolveBatchId,
} from './runtime.mjs';

const roleMap = {
  owner: 'owner',
  admin: 'admin',
  staff: 'staff',
  resident: 'resident',
};

const staffRoleMap = {
  owner: 'owner',
  admin: 'director',
  staff: 'staff',
};

async function findUserByEmail(supabase, email) {
  let page = 1;
  const perPage = 1000;
  const normalizedEmail = email.toLowerCase();

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(`Unable to list auth users: ${error.message}`);

    const match = (data?.users || []).find((user) => user.email?.toLowerCase() === normalizedEmail);
    if (match) return match;
    if (!data?.users || data.users.length < perPage) return null;
    page += 1;
  }
}

function splitDisplayName(user, fallbackEmail) {
  const name = user.user_metadata?.full_name || user.user_metadata?.name || fallbackEmail.split('@')[0];
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  return {
    displayName: parts.join(' ') || fallbackEmail,
    firstName: parts[0] || fallbackEmail.split('@')[0],
    lastName: parts.slice(1).join(' ') || 'Tester',
  };
}

async function attachUserToSampleBatch(supabase, { email, role, batchId }) {
  const user = await findUserByEmail(supabase, email);
  if (!user) {
    throw new Error(`No Supabase auth user found for ${email}. Create the user first, then rerun this command.`);
  }

  const { data: batch, error: batchError } = await supabase
    .from('sample_data_batches')
    .select('id, organization_id')
    .eq('id', batchId)
    .single();
  if (batchError) throw new Error(`Unable to read sample batch ${batchId}: ${batchError.message}`);

  const { displayName, firstName, lastName } = splitDisplayName(user, email);
  const membershipRow = {
    organization_id: batch.organization_id,
    user_id: user.id,
    role,
    display_name: displayName,
    email,
    status: 'active',
    is_sample_data: true,
    sample_data_batch_id: batch.id,
  };

  const { data: membership, error: membershipError } = await supabase
    .from('organization_members')
    .upsert(membershipRow, { onConflict: 'organization_id,user_id' })
    .select('id')
    .single();
  if (membershipError) throw new Error(`Unable to attach organization membership: ${membershipError.message}`);

  if (role !== 'resident') {
    const staffProfile = {
      organization_id: batch.organization_id,
      user_id: user.id,
      first_name: firstName,
      last_name: lastName,
      email,
      role: staffRoleMap[role] || 'staff',
      title: `${roleMap[role]} test user`,
      status: 'active',
      is_sample_data: true,
      sample_data_batch_id: batch.id,
    };

    const { data: existingStaff, error: existingStaffError } = await supabase
      .from('staff_profiles')
      .select('id')
      .eq('organization_id', batch.organization_id)
      .eq('user_id', user.id)
      .maybeSingle();
    if (existingStaffError) throw new Error(`Unable to read staff profile: ${existingStaffError.message}`);

    const staffQuery = existingStaff
      ? supabase.from('staff_profiles').update(staffProfile).eq('id', existingStaff.id)
      : supabase.from('staff_profiles').insert(staffProfile);
    const { error: staffError } = await staffQuery;
    if (staffError) throw new Error(`Unable to upsert staff profile: ${staffError.message}`);
  }

  const registryRows = [
    {
      id: randomUUID(),
      batch_id: batch.id,
      organization_id: batch.organization_id,
      resource_type: 'table_row',
      table_name: 'organization_members',
      record_id: membership.id,
      external_id: email,
      record_label: `Attached test user ${email}`,
    },
  ];

  const { error: registryError } = await supabase
    .from('sample_data_registry')
    .upsert(registryRows, { onConflict: 'id' });
  if (registryError) throw new Error(`Unable to register attached user cleanup row: ${registryError.message}`);

  return { organizationId: batch.organization_id, userId: user.id, membershipId: membership.id };
}

async function main() {
  const args = parseArgs();
  const email = String(args.email || '').trim();
  const role = roleMap[String(args.role || 'owner').trim()];

  if (!email) throw new Error('Missing --email. Example: npm run sample:attach-user -- --email cricks@example.com --role owner');
  if (!role) throw new Error('Invalid --role. Use owner, admin, staff, or resident.');

  const supabase = createSupabaseAdminClient();
  const batchId = await resolveBatchId(supabase, args.batch || 'latest');
  const result = await attachUserToSampleBatch(supabase, { email, role, batchId });

  logStep(`Attached ${email} as ${role} to sample organization ${result.organizationId}.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
