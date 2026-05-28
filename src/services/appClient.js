import { supabase } from '@/lib/supabaseClient';
import { authBypassEnabled, bypassUser, demoOrganizationId } from '@/lib/authBypass';
import { isMissingSupabaseSetupError } from '@/lib/authErrors';
import { createEntityService } from './entityService';
import { entityConfigs, getEntityConfig } from './entityConfig';

const entities = Object.fromEntries(
  Object.keys(entityConfigs).map((entityName) => {
    const config = getEntityConfig(entityName);
    return [entityName, createEntityService(supabase, config)];
  }),
);

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
  return data.signedUrl;
}

async function uploadFile({ file, bucket = 'secure-documents', pathPrefix = 'uploads', organizationId }) {
  if (!file) throw new Error('UploadFile requires a file.');
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

async function sendEmail(payload) {
  console.info('[ClearPath email placeholder]', payload);
  return {
    ok: true,
    skipped: 'Email provider is not configured.',
  };
}

async function invokeLLM() {
  return {
    output: {
      summary: '[FILL: Configure an LLM provider to generate summaries.]',
      recommendation: 'pending',
      records: [],
    },
  };
}

async function extractDataFromUploadedFile() {
  return {
    output: {
      records: [],
      note: '[FILL: Configure document extraction provider.]',
    },
  };
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
        .eq('organization_id', demoOrganizationId)
        .eq('user_id', data.user.id)
        .maybeSingle();

      if (membershipError && !isMissingSupabaseSetupError(membershipError)) {
        throw new Error(membershipError.message || 'Unable to read organization membership.');
      }

      return {
        ...data.user,
        organization_id: membership?.organization_id || demoOrganizationId,
        full_name: membership?.display_name || data.user.user_metadata?.full_name || data.user.email,
        role: membership?.role || data.user.user_metadata?.role || 'staff',
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
};
