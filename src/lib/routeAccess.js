export const FULL_NAV = [
  'dashboard', 'bed_capacity', 'masterlist', 'applications', 'residents', 'locations',
  'staff', 'scheduling', 'chores', 'incidents', 'incident_safety', 'chat', 'compliance',
  'inventory', 'analytics', 'grants', 'outcomes', 'finance', 'training', 'hipaa',
  'integrations', 'reports', 'secure_docs', 'settings', 'presentation',
];

export const ROLE_NAV = {
  admin: FULL_NAV,
  platform_admin: FULL_NAV,
  owner: FULL_NAV,
  director: ['dashboard', 'bed_capacity', 'applications', 'residents', 'locations', 'staff', 'scheduling', 'incidents', 'incident_safety', 'chat', 'compliance', 'inventory', 'analytics', 'grants', 'outcomes', 'finance', 'training', 'hipaa', 'reports', 'secure_docs'],
  house_manager: ['dashboard', 'masterlist', 'applications', 'residents', 'scheduling', 'chores', 'incidents', 'incident_safety', 'chat', 'inventory', 'compliance', 'training', 'secure_docs'],
  assistant_manager: ['dashboard', 'masterlist', 'applications', 'residents', 'scheduling', 'chores', 'incidents', 'incident_safety', 'chat', 'inventory', 'training', 'secure_docs'],
  house_manager_trainee: ['dashboard', 'masterlist', 'residents', 'scheduling', 'chores', 'chat', 'inventory', 'training'],
  case_manager: ['dashboard', 'masterlist', 'applications', 'residents', 'incidents', 'incident_safety', 'chat', 'inventory', 'training', 'secure_docs'],
  peer_support: ['dashboard', 'residents', 'chat', 'training'],
  staff: ['dashboard', 'residents', 'chat', 'training', 'secure_docs'],
  resident: ['my_profile', 'chat', 'resources'],
  user: ['my_profile', 'chat', 'resources'],
};

const ROUTE_NAV_ID = {
  '/': 'dashboard',
  '/analytics': 'analytics',
  '/bed-capacity': 'bed_capacity',
  '/chat': 'chat',
  '/chores': 'chores',
  '/compliance': 'compliance',
  '/finance': 'finance',
  '/grants': 'grants',
  '/hipaa': 'hipaa',
  '/incident-safety': 'incident_safety',
  '/incidents': 'incidents',
  '/intake': 'applications',
  '/integrations': 'integrations',
  '/inventory': 'inventory',
  '/locations': 'locations',
  '/masterlist': 'masterlist',
  '/my-profile': 'my_profile',
  '/outcomes': 'outcomes',
  '/reports': 'reports',
  '/residents': 'residents',
  '/resources': 'resources',
  '/scheduling': 'scheduling',
  '/secure-docs': 'secure_docs',
  '/settings': 'settings',
  '/staff': 'staff',
  '/training': 'training',
};

export function navForRole(role) {
  return ROLE_NAV[role] || [];
}

export function canAccessRoute(role, pathname) {
  const route = Object.keys(ROUTE_NAV_ID)
    .filter((candidate) => candidate === '/' ? pathname === '/' : pathname === candidate || pathname.startsWith(`${candidate}/`))
    .sort((left, right) => right.length - left.length)[0];
  return Boolean(route && navForRole(role).includes(ROUTE_NAV_ID[route]));
}

export function defaultRouteForRole(role) {
  return ['resident', 'user'].includes(role) ? '/my-profile' : '/';
}
