import { describe, expect, it } from 'vitest';
import {
  MVP_FEATURE_COVERAGE,
  SAMPLE_BATCH_ID,
  SAMPLE_ORGANIZATION_ID,
  SAMPLE_STORAGE_BUCKETS,
  buildSampleDataset,
  createStorageObjectPlan,
  deleteOrder,
  validateDatasetShape,
} from './sampleDataset.mjs';

describe('ClearPath MVP sample dataset', () => {
  it('covers every required MVP feature with tagged rows', () => {
    const dataset = buildSampleDataset();
    const result = validateDatasetShape(dataset);

    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);

    for (const [feature, tables] of Object.entries(MVP_FEATURE_COVERAGE)) {
      expect(tables.length, `${feature} should name at least one table`).toBeGreaterThan(0);
      for (const table of tables) {
        expect(dataset.tables[table]?.length, `${feature} needs sample rows in ${table}`).toBeGreaterThan(0);
      }
    }

    for (const [table, rows] of Object.entries(dataset.tables)) {
      for (const row of rows) {
        expect(row.is_sample_data, `${table}.${row.id} must be tagged`).toBe(true);
        expect(row.sample_data_batch_id, `${table}.${row.id} needs a batch id`).toBe(SAMPLE_BATCH_ID);
        if (table !== 'organizations') {
          expect(row.organization_id, `${table}.${row.id} needs organization scope`).toBe(SAMPLE_ORGANIZATION_ID);
        }
      }
    }
  });

  it('keeps storage files under removable sample prefixes', () => {
    const dataset = buildSampleDataset();
    const objects = createStorageObjectPlan(dataset);

    expect(objects.length).toBeGreaterThanOrEqual(SAMPLE_STORAGE_BUCKETS.length);
    for (const bucket of SAMPLE_STORAGE_BUCKETS) {
      expect(objects.some((object) => object.bucket === bucket), `${bucket} should have a sample object`).toBe(true);
    }

    for (const object of objects) {
      expect(object.path.startsWith(`${SAMPLE_ORGANIZATION_ID}/sample/${SAMPLE_BATCH_ID}/`)).toBe(true);
      expect(SAMPLE_STORAGE_BUCKETS).toContain(object.bucket);
    }
  });

  it('deletes dependent rows before parent rows', () => {
    expect(deleteOrder.indexOf('medication_logs')).toBeLessThan(deleteOrder.indexOf('medications'));
    expect(deleteOrder.indexOf('care_plan_tasks')).toBeLessThan(deleteOrder.indexOf('care_plan_goals'));
    expect(deleteOrder.indexOf('resident_contacts')).toBeLessThan(deleteOrder.indexOf('residents'));
    expect(deleteOrder.indexOf('bed_assignments')).toBeLessThan(deleteOrder.indexOf('locations'));
    expect(deleteOrder.indexOf('locations')).toBeLessThan(deleteOrder.indexOf('organizations'));
  });

  it('contains realistic workflow states for MVP UI testing', () => {
    const { tables } = buildSampleDataset();
    const values = (table, field) => new Set(tables[table].map((row) => row[field]));

    for (const status of ['administered', 'missed', 'refused', 'held']) {
      expect(values('medication_logs', 'status'), `missing ${status} dose state`).toContain(status);
    }
    for (const severity of ['low', 'medium', 'high']) {
      expect(values('incident_reports', 'severity'), `missing ${severity} incident`).toContain(severity);
    }
    for (const status of ['compliant', 'in_progress', 'not_met']) {
      expect(values('compliance_items', 'status'), `missing ${status} compliance item`).toContain(status);
    }
    for (const status of ['occupied', 'available', 'reserved']) {
      expect(values('bed_assignments', 'status'), `missing ${status} bed state`).toContain(status);
    }
    for (const status of ['pending', 'fulfilled']) {
      expect(values('inventory_requests', 'status'), `missing ${status} request`).toContain(status);
    }
  });
});
