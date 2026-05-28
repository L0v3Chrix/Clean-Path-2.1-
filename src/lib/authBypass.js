const fallbackOrganizationId = '00000000-0000-4000-8000-000000000001';

export const demoOrganizationId = import.meta.env.VITE_DEMO_ORGANIZATION_ID || fallbackOrganizationId;

export const demoModeEnabled = import.meta.env.VITE_CLEARPATH_DEMO_MODE === 'true';

export const devAuthBypassEnabled =
  import.meta.env.DEV &&
  import.meta.env.MODE !== 'test' &&
  import.meta.env.VITE_AUTH_BYPASS === 'true';

export const authBypassEnabled = demoModeEnabled || devAuthBypassEnabled;

export const bypassUser = {
  id: '00000000-0000-4000-8000-000000000000',
  email: 'demo@clearpath.local',
  full_name: 'Slade',
  role: 'owner',
  organization_id: demoOrganizationId,
};
