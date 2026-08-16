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

  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
  if (error) throw new Error(error.message);
  const { error: auditError } = await supabase.rpc('record_document_access', {
    p_bucket: bucket,
    p_path: path,
  });
  if (auditError) throw new Error(auditError.message);
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
    async bootstrapOrganizationOwner(displayName) {
      const { data: userResult, error: userError } = await supabase.auth.getUser();
      if (userError || !userResult.user) {
        throw new Error(userError?.message || 'Sign in before bootstrapping the organization.');
      }

      const { data, error } = await supabase.rpc('bootstrap_organization_owner', {
        p_organization_id: demoOrganizationId,
        p_display_name: displayName || userResult.user.email,
        p_email: userResult.user.email,
      });
      if (error) {
        const bootstrapError = new Error(error.message);
        bootstrapError.code = error.code;
        bootstrapError.details = error.details;
        bootstrapError.hint = error.hint;
        throw bootstrapError;
      }
      return data;
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
    async sendPasswordReset(email) {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/login`,
      });
      if (error) throw new Error(error.message);
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
