import { beforeEach, describe, expect, it, vi } from 'vitest';

const { invokeFunction } = vi.hoisted(() => ({ invokeFunction: vi.fn() }));

vi.mock('@/services/appClient', () => ({
  appClient: {
    functions: {
      invoke: invokeFunction,
    },
  },
}));

import { notifyCriticalIncident } from './criticalIncidentNotifier';

describe('notifyCriticalIncident', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('window', { location: { origin: 'https://clearpath.test' } });
  });

  it('delegates recipient resolution to the server using only the saved incident id', async () => {
    invokeFunction.mockResolvedValue({
      ok: true,
      eligibleRecipientCount: 5,
      deliveredCount: 5,
      failedCount: 0,
      providerConfigured: true,
    });

    const result = await notifyCriticalIncident(
      {
        id: '11111111-1111-4111-8111-111111111111',
        organization_id: 'org-1',
        severity: 'critical',
        location_id: 'house-1',
        description: 'CONFIDENTIAL DESCRIPTION PHI',
      },
    );

    expect(invokeFunction).toHaveBeenCalledWith('critical-incident-notify', {
      incident_id: '11111111-1111-4111-8111-111111111111',
    });
    expect(result).toMatchObject({
      incidentUrl: 'https://clearpath.test/incidents?view=11111111-1111-4111-8111-111111111111',
      eligibleRecipientCount: 5,
      deliveredCount: 5,
      failedCount: 0,
      providerConfigured: true,
    });
  });

  it('does not invoke notifications for a non-critical incident', async () => {
    await expect(notifyCriticalIncident({ id: 'incident-1', severity: 'high' })).resolves.toBeUndefined();
    expect(invokeFunction).not.toHaveBeenCalled();
  });

  it('reports notification failure without turning a saved incident into a failed save', async () => {
    invokeFunction.mockRejectedValue(new Error('edge unavailable'));

    const result = await notifyCriticalIncident(
      { id: '11111111-1111-4111-8111-111111111111', severity: 'critical' },
    );

    expect(result).toMatchObject({
      eligibleRecipientCount: 0,
      deliveredCount: 0,
      failedCount: 0,
      providerConfigured: false,
      notificationFailed: true,
    });
  });
});
