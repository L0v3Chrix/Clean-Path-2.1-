import { describe, expect, it, vi } from 'vitest';
import { createEntityService } from './entityService';

function createQueryResult() {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    order: vi.fn(() => query),
    limit: vi.fn(() => query),
    insert: vi.fn(() => query),
    update: vi.fn(() => query),
    delete: vi.fn(() => query),
    single: vi.fn(() => Promise.resolve({ data: { id: 'record-1' }, error: null })),
    maybeSingle: vi.fn(() => Promise.resolve({
      data: { organization_id: 'organization-1' },
      error: null,
    })),
    then: (resolve) => resolve({ data: [{ id: 'record-1' }], error: null }),
  };
  return query;
}

function createSupabaseMock() {
  const query = createQueryResult();
  return {
    query,
    client: {
      from: vi.fn(() => query),
      auth: {
        getUser: vi.fn(() => Promise.resolve({
          data: { user: { id: 'user-1' } },
          error: null,
        })),
      },
      channel: vi.fn(() => ({
        on: vi.fn(() => ({
          subscribe: vi.fn(() => ({ unsubscribe: vi.fn() })),
        })),
      })),
    },
  };
}

describe('createEntityService', () => {
  it('lists records with descending sort syntax and limit', async () => {
    const { client, query } = createSupabaseMock();
    const service = createEntityService(client, {
      table: 'residents',
      schema: { name: 'Resident' },
    });

    const records = await service.list('-created_at', 25);

    expect(client.from).toHaveBeenCalledWith('residents');
    expect(query.select).toHaveBeenCalledWith('*');
    expect(query.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(query.limit).toHaveBeenCalledWith(25);
    expect(records).toEqual([{ id: 'record-1' }]);
  });

  it('filters records by equality conditions', async () => {
    const { client, query } = createSupabaseMock();
    const service = createEntityService(client, {
      table: 'incident_reports',
      schema: { name: 'IncidentReport' },
    });

    await service.filter({ status: 'open', severity: 'high' }, 'incident_date', 100);

    expect(client.from).toHaveBeenCalledWith('incident_reports');
    expect(query.eq).toHaveBeenCalledWith('status', 'open');
    expect(query.eq).toHaveBeenCalledWith('severity', 'high');
    expect(query.order).toHaveBeenCalledWith('incident_date', { ascending: true });
    expect(query.limit).toHaveBeenCalledWith(100);
  });

  it('creates and updates single records through Supabase', async () => {
    const { client, query } = createSupabaseMock();
    const service = createEntityService(client, {
      table: 'medications',
      schema: { name: 'Medication' },
    });

    await service.create({ medication_name: 'Example' });
    await service.update('med-1', { status: 'paused' });

    expect(query.insert).toHaveBeenCalledWith({
      medication_name: 'Example',
      organization_id: 'organization-1',
    });
    expect(query.select).toHaveBeenCalledWith('*');
    expect(query.update).toHaveBeenCalledWith({ status: 'paused' });
    expect(query.eq).toHaveBeenCalledWith('id', 'med-1');
    expect(query.single).toHaveBeenCalledTimes(2);
  });

  it('normalizes empty and undefined form values before persistence', async () => {
    const { client, query } = createSupabaseMock();
    const service = createEntityService(client, {
      table: 'residents',
      schema: { name: 'Resident' },
    });

    await service.create({ first_name: 'Test', sober_date: '', room: '', omitted: undefined });

    expect(query.insert).toHaveBeenCalledWith({
      first_name: 'Test',
      sober_date: null,
      room: null,
      organization_id: 'organization-1',
    });
  });

  it('replaces legacy default ownership and preserves an explicit organization', async () => {
    const { client, query } = createSupabaseMock();
    const service = createEntityService(client, { table: 'locations', schema: {} });

    await service.create({ name: 'Resolved House', organization_id: 'default' });
    await service.create({ name: 'Explicit House', organization_id: 'organization-2' });

    expect(query.insert).toHaveBeenNthCalledWith(1, {
      name: 'Resolved House',
      organization_id: 'organization-1',
    });
    expect(query.insert).toHaveBeenNthCalledWith(2, {
      name: 'Explicit House',
      organization_id: 'organization-2',
    });
    expect(client.auth.getUser).toHaveBeenCalledTimes(1);
  });

  it('does not add tenant ownership to the organizations table', async () => {
    const { client, query } = createSupabaseMock();
    const service = createEntityService(client, {
      table: 'organizations',
      schema: {},
      tenantScoped: false,
    });

    await service.create({ name: 'Business Tenant' });

    expect(query.insert).toHaveBeenCalledWith({ name: 'Business Tenant' });
    expect(client.auth.getUser).not.toHaveBeenCalled();
  });

  it('resolves tenant ownership once for an entire bulk create', async () => {
    const { client, query } = createSupabaseMock();
    const service = createEntityService(client, { table: 'residents', schema: {} });

    await service.bulkCreate([
      { first_name: 'First' },
      { first_name: 'Second', organization_id: 'default' },
      { first_name: 'Third', organization_id: 'organization-2' },
    ]);

    expect(query.insert).toHaveBeenCalledWith([
      { first_name: 'First', organization_id: 'organization-1' },
      { first_name: 'Second', organization_id: 'organization-1' },
      { first_name: 'Third', organization_id: 'organization-2' },
    ]);
    expect(client.auth.getUser).toHaveBeenCalledTimes(1);
  });
});
