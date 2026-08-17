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
  return Object.fromEntries(
    Object.entries(payload).flatMap(([key, value]) => {
      if (value === undefined) return [];
      return [[key, value === '' ? null : value]];
    }),
  );
}

async function resolveActiveOrganizationId(supabaseClient) {
  const { data: userResult, error: userError } = await supabaseClient.auth.getUser();
  if (userError || !userResult?.user) {
    throw new Error(userError?.message || 'Sign in before creating records.');
  }

  const { data: membership, error: membershipError } = await supabaseClient
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', userResult.user.id)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();
  if (membershipError) throw normalizeError(membershipError);
  if (!membership?.organization_id) {
    throw new Error('Your account does not have an active organization membership.');
  }
  return membership.organization_id;
}

async function normalizeCreatePayload(supabaseClient, payload, tenantScoped) {
  const normalized = normalizePayload(payload);
  if (!tenantScoped || !normalized || typeof normalized !== 'object') return normalized;
  if (normalized.organization_id && normalized.organization_id !== 'default') return normalized;
  return {
    ...normalized,
    organization_id: await resolveActiveOrganizationId(supabaseClient),
  };
}

export function createEntityService(supabaseClient, { table, schema, tenantScoped = true }) {
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

      const normalized = await normalizeCreatePayload(supabaseClient, payload, tenantScoped);
      return readSingle(supabaseClient.from(table).insert(normalized).select('*'));
    },

    async bulkCreate(records) {
      if (authBypassEnabled) {
        return localBypassStore.bulkCreate(table, records);
      }

      let normalized = records.map(normalizePayload);
      const needsOrganization = tenantScoped && normalized.some((record) =>
        record && typeof record === 'object' &&
        (!record.organization_id || record.organization_id === 'default'),
      );
      if (needsOrganization) {
        const organizationId = await resolveActiveOrganizationId(supabaseClient);
        normalized = normalized.map((record) => (
          record && typeof record === 'object' &&
          (!record.organization_id || record.organization_id === 'default')
            ? { ...record, organization_id: organizationId }
            : record
        ));
      }
      const { data, error } = await supabaseClient.from(table).insert(normalized).select('*');
      const normalizedError = normalizeError(error);
      if (normalizedError) throw normalizedError;
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
