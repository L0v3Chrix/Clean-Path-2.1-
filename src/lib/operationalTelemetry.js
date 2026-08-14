const CATEGORIES = new Set(['render_error', 'request_error', 'unhandled_error', 'health_check_failed']);

function normalizeRoute(value) {
  const firstSegment = String(value || '/').split('?')[0].split('/').filter(Boolean)[0];
  return firstSegment ? `/${firstSegment}` : '/';
}

export function buildOperationalEvent(input = {}) {
  const component = /^[a-zA-Z0-9 _-]{1,64}$/.test(input.component || '') ? input.component : 'Application';
  const release = /^[a-zA-Z0-9._-]{1,80}$/.test(input.release || '') ? input.release : 'unknown';
  return {
    category: CATEGORIES.has(input.category) ? input.category : 'unknown_error',
    component,
    route: normalizeRoute(input.route),
    release,
  };
}
