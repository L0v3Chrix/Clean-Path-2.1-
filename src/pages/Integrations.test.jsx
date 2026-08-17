import { describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  globalThis.window = { self: {}, top: {} };
});

vi.mock('@/services/appClient', () => ({ appClient: {} }));

import {
  disconnectIntegration,
  getIntegrationDisplayStatus,
  loadIntegrationData,
  savePendingIntegration,
} from './Integrations';

describe('integration connection status', () => {
  it('does not label a self-reported connection as connected', () => {
    expect(getIntegrationDisplayStatus({ status: 'connected', metadata: {} })).toBe('pending');
  });

  it('does not label metadata as connected without a shipped provider adapter', () => {
    expect(getIntegrationDisplayStatus({
      integration_name: 'Stripe',
      status: 'connected',
      metadata: {
        verification_status: 'verified',
        verified_at: '2026-08-16T12:00:00.000Z',
      },
    })).toBe('pending');
  });

  it('preserves non-connected states', () => {
    expect(getIntegrationDisplayStatus(null)).toBe('disconnected');
    expect(getIntegrationDisplayStatus({ status: 'error' })).toBe('error');
  });
});

describe('integration operations', () => {
  it('loads organizations and configs without manufacturing state', async () => {
    const client = {
      entities: {
        Organization: { list: vi.fn().mockResolvedValue([{ id: 'org-1' }]) },
        IntegrationConfig: { list: vi.fn().mockResolvedValue([{ id: 'config-1' }]) },
      },
    };

    await expect(loadIntegrationData(client)).resolves.toEqual({
      orgId: 'org-1',
      configs: [{ id: 'config-1' }],
    });
  });

  it('creates setup records as pending and unverified', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'config-1' });
    const client = { entities: { IntegrationConfig: { create, update: vi.fn() } } };

    await savePendingIntegration(client, {
      configs: [],
      orgId: 'org-1',
      integration: { name: 'Stripe', type: 'payments' },
    });

    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      organization_id: 'org-1',
      integration_name: 'Stripe',
      status: 'pending',
      connected_date: null,
      metadata: expect.objectContaining({
        verification_status: 'unverified',
        verified_at: null,
      }),
    }));
  });

  it('disconnects with unverified metadata while preserving provider details', async () => {
    const update = vi.fn().mockResolvedValue({ id: 'config-1' });
    const client = { entities: { IntegrationConfig: { update } } };
    const config = {
      id: 'config-1',
      metadata: {
        account_id: 'acct-123',
        environment: 'production',
        verification_status: 'verified',
        verified_at: '2026-08-16T12:00:00.000Z',
      },
    };

    await disconnectIntegration(client, config);

    expect(update).toHaveBeenCalledWith('config-1', {
      status: 'disconnected',
      connected_date: null,
      metadata: {
        account_id: 'acct-123',
        environment: 'production',
        verification_status: 'unverified',
        verified_at: null,
      },
    });
  });
});
