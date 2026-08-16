import { describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  globalThis.window = { self: {}, top: {} };
});

vi.mock('@/services/appClient', () => ({ appClient: {} }));
vi.mock('@/lib/criticalIncidentNotifier', () => ({ notifyCriticalIncident: vi.fn() }));

import { buildCriticalIncidentRecord, getDeepLinkedIncident } from './Incidents';

const authorizedIncidents = [
  { id: '11111111-1111-4111-8111-111111111111', type: 'medical' },
  { id: '22222222-2222-4222-8222-222222222222', type: 'behavioral' },
];

describe('incident deep links', () => {
  it('opens the exact authorized incident from a valid view parameter', () => {
    expect(getDeepLinkedIncident(
      '?view=22222222-2222-4222-8222-222222222222',
      authorizedIncidents,
    )).toBe(authorizedIncidents[1]);
  });

  it('does not open an incident that was not returned by the authorized list', () => {
    expect(getDeepLinkedIncident(
      '?view=33333333-3333-4333-8333-333333333333',
      authorizedIncidents,
    )).toBeNull();
  });

  it.each([
    '?view=not-an-id',
    '?view=11111111-1111-4111-8111-111111111111&view=22222222-2222-4222-8222-222222222222',
    '?view=',
    '',
  ])('rejects an invalid or ambiguous view parameter: %s', (search) => {
    expect(getDeepLinkedIncident(search, authorizedIncidents)).toBeNull();
  });
});

describe('critical incident notification payload', () => {
  it('uses the authoritative saved id without forwarding the reporter-visible staff roster', () => {
    expect(buildCriticalIncidentRecord(
      { id: 'draft-id', severity: 'critical', description: 'private details' },
      { id: 'saved-id', organization_id: 'org-1' },
    )).toEqual({ id: 'saved-id', severity: 'critical' });
  });
});
