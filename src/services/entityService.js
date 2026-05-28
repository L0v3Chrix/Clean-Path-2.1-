import { authBypassEnabled } from '@/lib/authBypass';
import { localBypassStore } from './localBypassStore';

function applySort(query, sort) {
  if (!sort) return query;
  const rawField = sort.startsWith('-') ? sort.slice(1) : sort;
  const field = rawField === 'created_date' ? 'created_at' : rawField;
  return query.order(field, { ascending: !sort.startsWith('-') });
}

function applyLimit(query, limit) {
  if (!limit) return query;
  return query.limit(limit);
}

function normalizeError(error) {
  if (!error) return null;
  return new Error(error.message || 'Supabase request failed');
}

async function readQuery(query) {
  const { data, error } = await query;
  const normalized = normalizeError(error);
  if (normalized) throw normalized;
  return data || [];
}

async function readSingle(query) {
  const { data, error } = await query.single();
  const normalized = normalizeError(error);
  if (normalized) throw normalized;
  return data;
}

function normalizePayload(payload) {
  if (!payload || typeof payload !== 'object') return payload;
  return {
    ...payload,
    organization_id:
      payload.organization_id === 'default'
        ? import.meta.env.VITE_DEMO_ORGANIZATION_ID || payload.organization_id
        : payload.organization_id,
  };
}

export function createEntityService(supabaseClient, { table, schema }) {
  return {
    async list(sort = '-created_at', limit = 500) {
      if (authBypassEnabled) {
        return localBypassStore.list(table, sort, limit);
      }

      let query = supabaseClient.from(table).select('*');
      query = applySort(query, sort);
      query = applyLimit(query, limit);
      return readQuery(query);
    },

    async filter(criteria = {}, sort = '-created_at', limit = 500) {
      if (authBypassEnabled) {
        return localBypassStore.filter(table, criteria, sort, limit);
      }

      let query = supabaseClient.from(table).select('*');
      Object.entries(criteria || {}).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          query = query.eq(key, value);
        }
      });
      query = applySort(query, sort);
      query = applyLimit(query, limit);
      return readQuery(query);
    },

    async create(payload) {
      if (authBypassEnabled) {
        return localBypassStore.create(table, payload);
      }

      return readSingle(supabaseClient.from(table).insert(normalizePayload(payload)).select('*'));
    },

    async bulkCreate(records) {
      if (authBypassEnabled) {
        return localBypassStore.bulkCreate(table, records);
      }

      const { data, error } = await supabaseClient.from(table).insert(records.map(normalizePayload)).select('*');
      const normalized = normalizeError(error);
      if (normalized) throw normalized;
      return data || [];
    },

    async update(id, payload) {
      if (authBypassEnabled) {
        return localBypassStore.update(table, id, payload);
      }

      return readSingle(supabaseClient.from(table).update(normalizePayload(payload)).eq('id', id).select('*'));
    },

    async delete(id) {
      if (authBypassEnabled) {
        return localBypassStore.delete(table, id);
      }

      const { error } = await supabaseClient.from(table).delete().eq('id', id);
      const normalized = normalizeError(error);
      if (normalized) throw normalized;
      return { id };
    },

    async schema() {
      return schema;
    },

    subscribe(callback) {
      if (authBypassEnabled) {
        return () => callback;
      }

      const channel = supabaseClient
        .channel(`${table}-changes`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table },
          (payload) => callback({
            type: payload.eventType?.toLowerCase(),
            data: payload.new,
            old_data: payload.old,
            id: payload.new?.id || payload.old?.id,
            raw: payload,
          }),
        )
        .subscribe();

      return () => {
        if (typeof channel.unsubscribe === 'function') {
          channel.unsubscribe();
        } else {
          supabaseClient.removeChannel(channel);
        }
      };
    },
  };
}
