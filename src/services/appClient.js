import { supabase } from '@/lib/supabaseClient';
import { authBypassEnabled, bypassUser, demoOrganizationId } from '@/lib/authBypass';
import { isMissingSupabaseSetupError } from '@/lib/authErrors';
import { createEntityService } from './entityService';
import { entityConfigs, getEntityConfig } from './entityConfig';
import { buildOperationalEvent } from '@/lib/operationalTelemetry';

const entities = Object.fromEntries(
  Object.keys(entityConfigs).map((entityName) => {
    const config = getEntityConfig(entityName);
    return [entityName, createEntityService(supabase, config)];
  }),
);

const legacyStaffRoles = new Set(['platform_admin', 'volunteer']);

function normalizeOperationalRole(role) {
  return legacyStaffRoles.has(role) ? 'staff' : role;
}

const onboardingStatuses = new Set(['pending', 'in_progress', 'dismissed', 'completed']);

function requireValue(value, message) {
  if (value === undefined || value === null || value === '') {
    throw new Error(message);
  }
  return value;
}

function isExternalUrl(value) {
  return /^https?:\/\//i.test(value || '') || /^data:/i.test(value || '');
}

async function resolveCurrentOrganizationId(explicitOrganizationId) {
  if (explicitOrganizationId && explicitOrganizationId !== 'default') {
    return explicitOrganizationId;
  }

  if (authBypassEnabled) {
    return demoOrganizationId;
  }

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    throw new Error(error?.message || 'Sign in before uploading files.');
  }

  const { data: membership, error: membershipError } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', data.user.id)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();

  if (membershipError && !isMissingSupabaseSetupError(membershipError)) {
    throw new Error(membershipError.message || 'Unable to read organization membership.');
  }

  return membership?.organization_id || demoOrganizationId;
}

function normalizeStorageReference(input = {}) {
  const bucket = input.bucket || input.storage_bucket || input.storageBucket || 'secure-documents';
  const path = input.path || input.storage_path || input.storagePath || input.file_url || input.fileUrl;

  if (!path) {
    throw new Error('A storage path or file URL is required.');
  }

  return { bucket, path };
}

async function createSignedStorageUrl(input, expiresIn = 300) {
  const { bucket, path } = normalizeStorageReference(input);

  if (isExternalUrl(path) || authBypassEnabled) {
    return path;
  }

  const { data, error } = await supabase.functions.invoke('document-access', {
    body: { bucket, path, expires: expiresIn },
  });
  if (error || !data?.signedUrl) {
    throw new Error('Unable to access this secure document.');
  }
  return data.signedUrl;
}

async function uploadFile({ file, bucket = 'secure-documents', pathPrefix = 'uploads', organizationId }) {
  if (!file) throw new Error('UploadFile requires a file.');
  if (authBypassEnabled) {
    const fileUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error(`Unable to read ${file.name}.`));
      reader.readAsDataURL(file);
    });
    return { file_url: fileUrl, storage_bucket: bucket, storage_path: null };
  }
  const resolvedOrganizationId = await resolveCurrentOrganizationId(organizationId);
  const safeName = file.name?.replace(/[^a-zA-Z0-9._-]/g, '-') || 'upload';
  const path = `${resolvedOrganizationId}/${pathPrefix}/${crypto.randomUUID()}-${safeName}`;
  const { data, error } = await supabase.storage.from(bucket).upload(path, file, {
    upsert: false,
    contentType: file.type || 'application/octet-stream',
  });
  if (error) throw new Error(error.message);
  return {
    file_url: data.path,
    storage_bucket: bucket,
    storage_path: data.path,
  };
}

const providerStatus = Object.freeze({
  email: Object.freeze({ configured: false }),
  llm: Object.freeze({ configured: false }),
  documentExtraction: Object.freeze({ configured: false }),
});

function providerNotConfigured(provider) {
  const error = new Error(`${provider} provider is not configured.`);
  error.code = 'PROVIDER_NOT_CONFIGURED';
  error.provider = provider;
  return error;
}

async function sendEmail() {
  throw providerNotConfigured('email');
}

async function invokeLLM() {
  throw providerNotConfigured('llm');
}

async function extractDataFromUploadedFile() {
  throw providerNotConfigured('document-extraction');
}

async function invokeFunction(name, payload) {
  if (name === 'generateChoreRotation') {
    const { data, error } = await supabase.rpc('generate_chore_rotation', {
      p_location_id: payload.location_id,
      p_organization_id: payload.organization_id,
      p_week_start_date: payload.week_start_date,
    });
    if (error) throw new Error(error.message);
    return data;
  }

  const { data, error } = await supabase.functions.invoke(name, { body: payload });
  if (error) throw new Error(error.message);
  return data;
}

export const appClient = {
  auth: {
    async me() {
      if (authBypassEnabled) {
        return bypassUser;
      }

      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) {
        throw new Error(error?.message || 'No authenticated user.');
      }

      const { data: membership, error: membershipError } = await supabase
        .from('organization_members')
        .select('organization_id, role, display_name, email')
        .eq('user_id', data.user.id)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle();

      if (membershipError && !isMissingSupabaseSetupError(membershipError)) {
        throw new Error(membershipError.message || 'Unable to read organization membership.');
      }

      let operationalRole = null;
      if (membership?.organization_id && ['staff'].includes(membership.role)) {
        const { data: profile, error: profileError } = await supabase
          .from('staff_profiles')
          .select('role')
          .eq('organization_id', membership.organization_id)
          .eq('user_id', data.user.id)
          .eq('status', 'active')
          .maybeSingle();
        if (profileError && !isMissingSupabaseSetupError(profileError)) {
          throw new Error(profileError.message || 'Unable to read staff role.');
        }
        operationalRole = normalizeOperationalRole(profile?.role);
      }

      return {
        ...data.user,
        organization_id: membership?.organization_id,
        full_name: membership?.display_name || data.user.user_metadata?.full_name || data.user.email,
        role: operationalRole || membership?.role || data.user.user_metadata?.role,
      };
    },
    async completeInvite(password) {
      requireValue(password, 'A password is required to complete the invitation.');
      const { data, error } = await supabase.auth.updateUser({ password });
      if (error) throw new Error(error.message);
      if (!data?.user) throw new Error('Unable to complete the invitation.');
      return data.user;
    },
    async acceptInvitation(activationToken) {
      requireValue(activationToken, 'An invitation activation secret is required.');
      const { data, error } = await supabase.rpc('accept_pre_authorized_invitation', {
        p_activation_token: activationToken,
      });
      if (error) throw new Error(error.message);
      return data;
    },
    async establishEmailLinkSession(session) {
      requireValue(session?.access_token, 'A valid email-link session is required.');
      requireValue(session?.refresh_token, 'A valid email-link session is required.');
      const { data, error } = await supabase.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      });
      if (error || !data?.user) {
        throw new Error(error?.message || 'Unable to validate the email link.');
      }
      return data.user;
    },
    async logout() {
      if (authBypassEnabled) {
        return;
      }

      const { error } = await supabase.auth.signOut();
      if (error) throw new Error(error.message);
    },
    async redirectToLogin() {
      window.location.assign('/login');
    },
  },
  entities,
  integrations: {
    Core: {
      providerStatus,
      UploadFile: uploadFile,
      CreateSignedUrl: createSignedStorageUrl,
      SendEmail: sendEmail,
      InvokeLLM: invokeLLM,
      ExtractDataFromUploadedFile: extractDataFromUploadedFile,
    },
  },
  functions: {
    invoke: invokeFunction,
  },
  publicIntake: {
    async rotateToken(organizationId) {
      const { data, error } = await supabase.rpc('rotate_public_intake_token', {
        p_organization_id: organizationId,
        p_label: 'Website intake',
      });
      if (error) throw new Error(error.message);
      return data;
    },
  },
  accountClaims: {
    async claim({ token, displayName } = {}) {
      requireValue(token, 'A pre-authorized account claim is required.');
      const { data, error } = await supabase.rpc('claim_pre_authorized_account', {
        p_token: token,
        p_display_name: displayName || null,
      });
      if (error) throw new Error(error.message);
      return data;
    },
  },
  onboarding: {
    async get({ organizationId, userId, flow, version } = {}) {
      requireValue(organizationId, 'An organization is required to load onboarding progress.');
      requireValue(userId, 'A user is required to load onboarding progress.');
      requireValue(flow, 'An onboarding flow is required.');
      requireValue(version, 'An onboarding flow version is required.');

      const { data, error } = await supabase
        .from('user_onboarding_progress')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('user_id', userId)
        .eq('flow', flow)
        .eq('version', version)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },
    async save({
      organizationId,
      userId,
      flow,
      version,
      currentStep = null,
      completedSteps = [],
      status = 'in_progress',
    } = {}) {
      requireValue(organizationId, 'An organization is required to save onboarding progress.');
      requireValue(userId, 'A user is required to save onboarding progress.');
      requireValue(flow, 'An onboarding flow is required.');
      requireValue(version, 'An onboarding flow version is required.');
      if (!onboardingStatuses.has(status)) {
        throw new Error('Invalid onboarding status.');
      }

      const normalizedSteps = [...new Set(completedSteps.filter(Boolean))];
      const payload = {
        organization_id: organizationId,
        user_id: userId,
        flow,
        version,
        current_step: currentStep,
        completed_steps: normalizedSteps,
        status,
        completed_at: status === 'completed' ? new Date().toISOString() : null,
      };
      const { data, error } = await supabase
        .from('user_onboarding_progress')
        .upsert(payload, { onConflict: 'organization_id,user_id,flow,version' })
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
  },
  staffAccess: {
    async invite(payload) {
      const { data, error } = await supabase.functions.invoke('invite-staff', { body: payload });
      if (error) throw new Error(error.message);
      if (!data?.ok) throw new Error(data?.error || 'Unable to invite staff member.');
      return data;
    },
    async updateAssignments(profile) {
      if (!profile?.id) throw new Error('A staff profile is required to update access.');
      const { data, error } = await supabase.rpc('update_staff_access', {
        p_profile_id: profile.id,
        p_role: profile.role,
        p_location_ids: profile.location_ids || [],
      });
      if (error) throw new Error(error.message);
      return data;
    },
    async updateProfileAndAssignments(profile) {
      if (!profile?.id) throw new Error('A staff profile is required to update access.');
      const { data, error } = await supabase.rpc('update_staff_profile_and_access', {
        p_profile_id: profile.id,
        p_first_name: profile.first_name,
        p_last_name: profile.last_name,
        p_phone: profile.phone || null,
        p_title: profile.title || null,
        p_hire_date: profile.hire_date || null,
        p_status: profile.status,
        p_lived_experience: Boolean(profile.lived_experience),
        p_notes: profile.notes || null,
        p_role: profile.role,
        p_location_ids: profile.location_ids || [],
      });
      if (error) throw new Error(error.message);
      return data;
    },
    async sendPasswordReset(email) {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/accept-invite?mode=recovery`,
      });
      if (error) throw new Error(error.message);
    },
  },
  residentAccess: {
    async invite(payload) {
      requireValue(payload?.resident_id, 'A resident is required to send an invitation.');
      const { data, error } = await supabase.functions.invoke('invite-resident', {
        body: { resident_id: payload.resident_id },
      });
      if (error) throw new Error(error.message);
      if (!data?.ok) throw new Error(data?.error || 'Unable to invite resident.');
      return data;
    },
    async me() {
      const { data: userResult, error: userError } = await supabase.auth.getUser();
      if (userError || !userResult.user) {
        throw new Error(userError?.message || 'Sign in to load the resident profile.');
      }
      const { data, error } = await supabase
        .from('residents')
        .select('*')
        .eq('user_id', userResult.user.id)
        .eq('status', 'active')
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },
  },
  operations: {
    async reportError(input) {
      if (authBypassEnabled) return;
      const event = buildOperationalEvent(input);
      const { error } = await supabase.rpc('record_application_error', {
        p_category: event.category,
        p_component: event.component,
        p_route: event.route,
        p_release: event.release,
      });
      if (error && !isMissingSupabaseSetupError(error)) throw new Error(error.message);
    },
    async recordExport(organizationId, resourceType, recordCount) {
      if (authBypassEnabled) return;
      const { error } = await supabase.rpc('record_data_export', {
        p_organization_id: organizationId,
        p_resource_type: resourceType,
        p_record_count: recordCount,
      });
      if (error) throw new Error(error.message);
    },
  },
};
