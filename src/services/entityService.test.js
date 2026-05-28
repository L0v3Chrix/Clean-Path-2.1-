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

    expect(query.insert).toHaveBeenCalledWith({ medication_name: 'Example' });
    expect(query.select).toHaveBeenCalledWith('*');
    expect(query.update).toHaveBeenCalledWith({ status: 'paused' });
    expect(query.eq).toHaveBeenCalledWith('id', 'med-1');
    expect(query.single).toHaveBeenCalledTimes(2);
  });
});
