import { demoOrganizationId } from '@/lib/authBypass';
import { buildSampleDataset } from '@/sample-data/mvpSampleData';

const seedData = buildSampleDataset().tables;

const tables = new Map(
  Object.entries(seedData).map(([table, records]) => [
    table,
    records.map((record) => ({ ...record })),
  ]),
);

function clone(record) {
  return record ? { ...record } : record;
}

function rowsFor(table) {
  if (!tables.has(table)) tables.set(table, []);
  return tables.get(table);
}

function fieldForSort(sort) {
  const rawField = sort?.startsWith('-') ? sort.slice(1) : sort;
  return rawField === 'created_date' ? 'created_at' : rawField;
}

function sortRows(rows, sort) {
  if (!sort) return rows;
  const field = fieldForSort(sort);
  const direction = sort.startsWith('-') ? -1 : 1;
  return [...rows].sort((a, b) => {
    const left = a[field] ?? '';
    const right = b[field] ?? '';
    if (left === right) return 0;
    return left > right ? direction : -direction;
  });
}

function applyLimit(rows, limit) {
  return limit ? rows.slice(0, limit) : rows;
}

function matchesCriteria(row, criteria) {
  return Object.entries(criteria || {}).every(([key, value]) => {
    if (value === undefined || value === null || value === '') return true;
    return row[key] === value;
  });
}

function normalizePayload(payload) {
  if (!payload || typeof payload !== 'object') return payload;
  return {
    ...payload,
    organization_id: payload.organization_id === 'default' ? demoOrganizationId : payload.organization_id,
  };
}

export const localBypassStore = {
  list(table, sort = '-created_at', limit = 500) {
    return applyLimit(sortRows(rowsFor(table).map(clone), sort), limit);
  },

  filter(table, criteria = {}, sort = '-created_at', limit = 500) {
    const filtered = rowsFor(table).filter((row) => matchesCriteria(row, criteria)).map(clone);
    return applyLimit(sortRows(filtered, sort), limit);
  },

  create(table, payload) {
    const timestamp = new Date().toISOString();
    const record = {
      id: crypto.randomUUID(),
      created_at: timestamp,
      updated_at: timestamp,
      ...normalizePayload(payload),
    };
    rowsFor(table).unshift(record);
    return clone(record);
  },

  bulkCreate(table, records) {
    return records.map((record) => this.create(table, record));
  },

  update(table, id, payload) {
    const rows = rowsFor(table);
    const index = rows.findIndex((row) => row.id === id);
    if (index === -1) throw new Error(`Local bypass record not found: ${table}.${id}`);
    rows[index] = {
      ...rows[index],
      ...normalizePayload(payload),
      updated_at: new Date().toISOString(),
    };
    return clone(rows[index]);
  },

  delete(table, id) {
    const rows = rowsFor(table);
    const index = rows.findIndex((row) => row.id === id);
    if (index !== -1) rows.splice(index, 1);
    return { id };
  },
};
