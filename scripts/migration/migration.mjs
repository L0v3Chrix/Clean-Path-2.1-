import { createHash } from 'node:crypto';

export const ENTITY_SPECS = {
  locations: { table: 'locations', required: ['name'] },
  staff_profiles: {
    table: 'staff_profiles',
    required: ['first_name', 'last_name', 'role'],
    arrayReferences: { source_location_ids: ['location_ids', 'locations'] },
  },
  residents: {
    table: 'residents',
    required: ['first_name', 'last_name'],
    references: { source_location_id: ['location_id', 'locations', false] },
  },
  resident_contacts: {
    table: 'resident_contacts',
    required: ['name'],
    references: { source_resident_id: ['resident_id', 'residents', true] },
  },
  bed_assignments: {
    table: 'bed_assignments',
    required: ['bed_label'],
    references: {
      source_location_id: ['location_id', 'locations', true],
      source_resident_id: ['resident_id', 'residents', false],
    },
  },
  resident_documents: {
    table: 'resident_documents',
    required: ['document_type'],
    references: {
      source_resident_id: ['resident_id', 'residents', false],
      source_location_id: ['location_id', 'locations', false],
    },
  },
  care_plan_goals: {
    table: 'care_plan_goals',
    required: ['term', 'category', 'title'],
    references: { source_resident_id: ['resident_id', 'residents', true] },
  },
  care_plan_tasks: {
    table: 'care_plan_tasks',
    required: ['title'],
    references: {
      source_resident_id: ['resident_id', 'residents', true],
      source_goal_id: ['goal_id', 'care_plan_goals', false],
    },
  },
  medications: {
    table: 'medications',
    required: ['medication_name', 'dosage'],
    references: { source_resident_id: ['resident_id', 'residents', true] },
  },
  medication_logs: {
    table: 'medication_logs',
    required: ['status'],
    references: {
      source_resident_id: ['resident_id', 'residents', true],
      source_medication_id: ['medication_id', 'medications', true],
    },
  },
  incident_reports: {
    table: 'incident_reports',
    required: ['incident_date', 'description'],
    references: {
      source_resident_id: ['resident_id', 'residents', false],
      source_location_id: ['location_id', 'locations', false],
    },
  },
  shifts: {
    table: 'shifts',
    required: ['shift_date', 'start_time', 'end_time'],
    references: {
      source_location_id: ['location_id', 'locations', true],
      source_staff_id: ['staff_id', 'staff_profiles', true],
    },
  },
  resident_fees: {
    table: 'resident_fees',
    required: ['label', 'amount'],
    references: {
      source_resident_id: ['resident_id', 'residents', true],
      source_location_id: ['location_id', 'locations', false],
    },
  },
  resident_payments: {
    table: 'resident_payments',
    required: ['amount', 'payment_date'],
    references: {
      source_resident_id: ['resident_id', 'residents', true],
      source_fee_id: ['fee_id', 'resident_fees', false],
    },
  },
};

export const IMPORT_ORDER = Object.keys(ENTITY_SPECS);

const numberFields = new Set([
  'total_beds', 'occupied_beds', 'current_quantity', 'low_stock_threshold',
  'reorder_quantity', 'quantity_requested', 'amount', 'score',
]);
const booleanFields = new Set([
  'consent_signed', 'resident_agreement_signed', 'background_check_consent',
  'controlled_substance', 'mat_medication', 'follow_up_required', 'naloxone_used',
  'ems_called', 'confidential', 'auto_pay',
]);

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(
        ([key, nested]) => [key, stableValue(nested)],
      ),
    );
  }
  return value;
}

export function sha256(value) {
  const serialized = typeof value === 'string' ? value : JSON.stringify(stableValue(value));
  return createHash('sha256').update(serialized).digest('hex');
}

export function deterministicTargetId(organizationId, sourceSystem, entity, sourceId) {
  const hex = sha256(`${organizationId}:${sourceSystem}:${entity}:${sourceId}`).slice(0, 32).split('');
  hex[12] = '5';
  hex[16] = ((Number.parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  const value = hex.join('');
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

function isBlank(value) {
  return value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
}

function coerceValue(field, value) {
  if (isBlank(value)) return null;
  if (numberFields.has(field)) {
    const number = Number(value);
    return Number.isFinite(number) ? number : value;
  }
  if (booleanFields.has(field) && typeof value === 'string') {
    if (['true', 'yes', '1'].includes(value.toLowerCase())) return true;
    if (['false', 'no', '0'].includes(value.toLowerCase())) return false;
  }
  if (field.endsWith('_ids') && typeof value === 'string') {
    return value.split(/[|;,]/).map((item) => item.trim()).filter(Boolean);
  }
  return typeof value === 'string' ? value.trim() : value;
}

function sourceKey(entity, sourceId) {
  return `${entity}:${sourceId}`;
}

function indexSourceRows(input) {
  const index = new Map();
  for (const [entity, rows] of Object.entries(input.entities || {})) {
    for (const row of rows || []) {
      if (!isBlank(row.source_id)) index.set(sourceKey(entity, String(row.source_id)), row);
    }
  }
  return index;
}

export function validateMigrationDataset(input) {
  const errors = [];
  const manifest = input?.manifest || {};
  const sourceRows = indexSourceRows(input || {});

  if (isBlank(manifest.sourceSystem)) errors.push({ entity: 'manifest', field: 'sourceSystem', message: 'Required' });
  if (isBlank(manifest.organizationId)) errors.push({ entity: 'manifest', field: 'organizationId', message: 'Required' });
  if (isBlank(manifest.cutoffAt)) errors.push({ entity: 'manifest', field: 'cutoffAt', message: 'Required' });

  for (const [entity, rows] of Object.entries(input?.entities || {})) {
    const spec = ENTITY_SPECS[entity];
    if (!spec) {
      errors.push({ entity, field: 'entity', message: 'Unsupported entity' });
      continue;
    }
    const seen = new Set();
    for (const [rowIndex, row] of (rows || []).entries()) {
      const sourceId = isBlank(row.source_id) ? `row-${rowIndex + 1}` : String(row.source_id);
      if (isBlank(row.source_id)) errors.push({ entity, sourceId, field: 'source_id', message: 'Required' });
      if (seen.has(sourceId)) errors.push({ entity, sourceId, field: 'source_id', message: 'Duplicate in file' });
      seen.add(sourceId);
      for (const field of spec.required || []) {
        if (isBlank(row[field])) errors.push({ entity, sourceId, field, message: 'Required' });
      }
      for (const [sourceField, [, referenceEntity, required]] of Object.entries(spec.references || {})) {
        const referenceId = row[sourceField];
        if (required && isBlank(referenceId)) {
          errors.push({ entity, sourceId, field: sourceField, message: 'Required reference' });
        } else if (!isBlank(referenceId) && !sourceRows.has(sourceKey(referenceEntity, String(referenceId)))) {
          errors.push({ entity, sourceId, field: sourceField, message: `Unknown ${referenceEntity} source id` });
        }
      }
      for (const [sourceField, [, referenceEntity]] of Object.entries(spec.arrayReferences || {})) {
        const values = coerceValue(sourceField, row[sourceField]) || [];
        for (const referenceId of values) {
          if (!sourceRows.has(sourceKey(referenceEntity, String(referenceId)))) {
            errors.push({ entity, sourceId, field: sourceField, message: `Unknown ${referenceEntity} source id ${referenceId}` });
          }
        }
      }
    }
  }

  return { ok: errors.length === 0, errors };
}

function attachmentIdentity(attachment) {
  if (!attachment) return null;
  return {
    sourceEntity: attachment.source_entity,
    sourceId: String(attachment.source_id),
    path: attachment.path || null,
    fileName: attachment.file_name || null,
    mimeType: attachment.mime_type || null,
    size: Number.isInteger(Number(attachment.size)) ? Number(attachment.size) : null,
    sha256: attachment.sha256 || null,
  };
}

function normalizeRow(input, entity, row, attachment) {
  const { organizationId, sourceSystem } = input.manifest;
  const spec = ENTITY_SPECS[entity];
  const sourceId = String(row.source_id);
  const targetId = deterministicTargetId(organizationId, sourceSystem, entity, sourceId);
  const payload = { id: targetId, organization_id: organizationId };

  for (const [field, value] of Object.entries(row)) {
    if (field === 'source_id' || field.startsWith('source_')) continue;
    if (!isBlank(value)) payload[field] = coerceValue(field, value);
  }

  for (const [sourceField, [targetField, referenceEntity]] of Object.entries(spec.references || {})) {
    if (!isBlank(row[sourceField])) {
      payload[targetField] = deterministicTargetId(organizationId, sourceSystem, referenceEntity, String(row[sourceField]));
    }
  }
  for (const [sourceField, [targetField, referenceEntity]] of Object.entries(spec.arrayReferences || {})) {
    const values = coerceValue(sourceField, row[sourceField]) || [];
    payload[targetField] = values.map((referenceId) => (
      deterministicTargetId(organizationId, sourceSystem, referenceEntity, String(referenceId))
    ));
  }

  return {
    payload,
    sourceId,
    targetId,
    sourceSha256: sha256({ row, attachment: attachmentIdentity(attachment) }),
  };
}

export function buildMigrationPlan(input, priorRecords = [], packageSha256) {
  const validation = validateMigrationDataset(input);
  if (!validation.ok) {
    const error = new Error(`Migration dataset failed validation with ${validation.errors.length} error(s).`);
    error.validationErrors = validation.errors;
    throw error;
  }

  const priorBySource = new Map();
  const blockingPriorBySource = new Map();
  for (const record of priorRecords) {
    const key = sourceKey(record.source_entity, String(record.source_id));
    if (record.status === 'imported') priorBySource.set(key, record);
    else if (!['skipped', 'rolled_back'].includes(record.status)) blockingPriorBySource.set(key, record);
  }
  const records = [];
  const attachments = new Map((input.attachments || []).map((attachment) => [
    sourceKey(attachment.source_entity, String(attachment.source_id)), attachment,
  ]));

  for (const entity of IMPORT_ORDER) {
    for (const row of input.entities[entity] || []) {
      const attachment = attachments.get(sourceKey(entity, String(row.source_id))) || null;
      const normalized = normalizeRow(input, entity, row, attachment);
      const key = sourceKey(entity, normalized.sourceId);
      const prior = priorBySource.get(key);
      const blockingPrior = blockingPriorBySource.get(key);
      let action = 'import';
      if (prior?.source_sha256 === normalized.sourceSha256 && prior.status === 'imported') action = 'skip';
      else if (prior || blockingPrior) action = 'conflict';

      records.push({
        sourceSystem: input.manifest.sourceSystem,
        sourceEntity: entity,
        sourceId: normalized.sourceId,
        sourceSha256: normalized.sourceSha256,
        targetTable: ENTITY_SPECS[entity].table,
        targetId: normalized.targetId,
        payload: normalized.payload,
        priorPayload: prior?.normalized_payload || null,
        attachment,
        action,
      });
    }
  }

  const plannedKeys = new Set(records.map((record) => sourceKey(record.sourceEntity, record.sourceId)));
  for (const attachment of input.attachments || []) {
    if (!plannedKeys.has(sourceKey(attachment.source_entity, String(attachment.source_id)))) {
      throw new Error(`Attachment references an unknown source record: ${attachment.source_entity}.${attachment.source_id}`);
    }
  }

  const datasetSha256 = sha256(input);
  return {
    manifest: input.manifest,
    packageSha256: packageSha256 || datasetSha256,
    datasetSha256,
    manifestSha256: datasetSha256,
    records,
  };
}

function countByEntity(records, predicate = () => true) {
  const counts = {};
  for (const record of records.filter(predicate)) {
    const entity = record.sourceEntity || record.source_entity;
    counts[entity] = (counts[entity] || 0) + 1;
  }
  return counts;
}

export function reconcilePlan(plan, importedRecords, migrationRun) {
  const expected = countByEntity(plan.records);
  const acceptedRecords = importedRecords.filter((record) => ['imported', 'skipped'].includes(record.status));
  const acceptedBySource = new Map();
  for (const record of acceptedRecords) {
    const key = sourceKey(record.source_entity, String(record.source_id));
    const records = acceptedBySource.get(key) || [];
    records.push(record);
    acceptedBySource.set(key, records);
  }
  const recordsBySource = new Map(
    [...acceptedBySource].map(([key, records]) => [key, records[0]]),
  );
  const plannedKeys = new Set(plan.records.map(
    (record) => sourceKey(record.sourceEntity, record.sourceId),
  ));
  const recorded = countByEntity(acceptedRecords);
  const statuses = {
    imported: countByEntity(importedRecords, (record) => record.status === 'imported'),
    skipped: countByEntity(importedRecords, (record) => record.status === 'skipped'),
  };
  const missingLineage = plan.records.filter(
    (record) => !recordsBySource.has(sourceKey(record.sourceEntity, record.sourceId)),
  ).map((record) => ({ entity: record.sourceEntity, sourceId: record.sourceId }));
  const failed = importedRecords.filter((record) => record.status === 'failed').map(
    (record) => ({ entity: record.source_entity, sourceId: record.source_id, error: record.error_message }),
  );
  const duplicateLineage = [...acceptedBySource.entries()]
    .filter(([, records]) => records.length > 1)
    .map(([, records]) => ({
      entity: records[0].source_entity,
      sourceId: String(records[0].source_id),
      count: records.length,
    }));
  const extraLineage = acceptedRecords
    .filter((record) => !plannedKeys.has(sourceKey(record.source_entity, String(record.source_id))))
    .map((record) => ({ entity: record.source_entity, sourceId: String(record.source_id) }));

  const sameValue = (left, right) => (
    JSON.stringify(stableValue(left)) === JSON.stringify(stableValue(right))
  );
  const runMismatches = [];
  const addRunMismatch = (field, expectedValue, actualValue) => {
    if (!sameValue(expectedValue, actualValue)) {
      runMismatches.push({ field, expected: expectedValue, actual: actualValue });
    }
  };
  if (!migrationRun) {
    runMismatches.push({ field: 'migration_run', expected: 'existing run', actual: null });
  } else {
    addRunMismatch('status', 'completed', migrationRun.status);
    addRunMismatch('organization_id', plan.manifest.organizationId, migrationRun.organization_id);
    addRunMismatch('source_system', plan.manifest.sourceSystem, migrationRun.source_system);
    addRunMismatch('source_sha256', plan.packageSha256, migrationRun.source_sha256);
    addRunMismatch('expected_counts', expected, migrationRun.expected_counts);
    if (!sameValue(expected, migrationRun.imported_counts) || !sameValue(recorded, migrationRun.imported_counts)) {
      runMismatches.push({
        field: 'imported_counts',
        expected,
        actual: migrationRun.imported_counts,
        acceptedLineage: recorded,
      });
    }
  }

  const lineageMismatches = [];
  const missingTargets = [];
  const mismatchedTargets = [];
  const missingAttachments = [];
  const mismatchedAttachments = [];

  for (const planned of plan.records) {
    const actual = recordsBySource.get(sourceKey(planned.sourceEntity, planned.sourceId));
    if (!actual) continue;
    const lineageFields = [];
    if (actual.source_sha256 !== planned.sourceSha256) lineageFields.push('source_sha256');
    if (actual.target_table !== planned.targetTable) lineageFields.push('target_table');
    if (actual.target_id !== planned.targetId) lineageFields.push('target_id');
    if (migrationRun && actual.migration_run_id !== migrationRun.id) lineageFields.push('migration_run_id');
    if (migrationRun && actual.organization_id !== migrationRun.organization_id) lineageFields.push('organization_id');
    if (migrationRun && actual.source_system !== migrationRun.source_system) lineageFields.push('source_system');
    if (lineageFields.length) {
      lineageMismatches.push({ entity: planned.sourceEntity, sourceId: planned.sourceId, fields: lineageFields });
    }

    if (!actual.target) {
      missingTargets.push({
        entity: planned.sourceEntity, sourceId: planned.sourceId,
        targetTable: planned.targetTable, targetId: planned.targetId,
      });
    } else {
      const fields = Object.entries(planned.payload).filter(([field, expectedValue]) => (
        JSON.stringify(stableValue(actual.target[field])) !== JSON.stringify(stableValue(expectedValue))
      )).map(([field]) => field);
      if (fields.length) {
        mismatchedTargets.push({
          entity: planned.sourceEntity, sourceId: planned.sourceId,
          targetTable: planned.targetTable, targetId: planned.targetId, fields,
        });
      }
    }

    if (planned.attachment) {
      const evidence = actual.attachmentEvidence;
      if (!evidence?.exists) {
        missingAttachments.push({ entity: planned.sourceEntity, sourceId: planned.sourceId });
      } else {
        const fields = [];
        const lineageBucket = actual.normalized_payload?.storage_bucket;
        const lineagePath = actual.normalized_payload?.storage_path;
        if (evidence.bucket !== lineageBucket) fields.push('bucket');
        if (evidence.path !== lineagePath) fields.push('path');
        if (evidence.sha256 !== planned.attachment.sha256) fields.push('sha256');
        if (fields.length) mismatchedAttachments.push({
          entity: planned.sourceEntity,
          sourceId: planned.sourceId,
          fields,
          expectedBucket: lineageBucket || null,
          actualBucket: evidence.bucket || null,
          expectedPath: lineagePath || null,
          actualPath: evidence.path || null,
          expectedSha256: planned.attachment.sha256,
          actualSha256: evidence.sha256,
        });
      }
    }
  }

  const financialTotal = (records, entity, valueFromRecord) => records
    .filter((record) => (record.sourceEntity || record.source_entity) === entity)
    .reduce((total, record) => total + (Number(valueFromRecord(record)) || 0), 0);
  const roundCurrency = (value) => Math.round((value + Number.EPSILON) * 100) / 100;
  const expectedFees = roundCurrency(financialTotal(plan.records, 'resident_fees', (record) => record.payload.amount));
  const expectedPayments = roundCurrency(financialTotal(plan.records, 'resident_payments', (record) => record.payload.amount));
  const actualFees = roundCurrency(financialTotal(acceptedRecords, 'resident_fees', (record) => record.target?.amount));
  const actualPayments = roundCurrency(financialTotal(acceptedRecords, 'resident_payments', (record) => record.target?.amount));
  const expectedFinancial = {
    fees: expectedFees,
    payments: expectedPayments,
    balance: roundCurrency(expectedFees - expectedPayments),
  };
  const actualFinancial = {
    fees: actualFees,
    payments: actualPayments,
    balance: roundCurrency(actualFees - actualPayments),
  };
  const variance = Object.fromEntries(Object.keys(expectedFinancial).map((key) => [
    key, roundCurrency(actualFinancial[key] - expectedFinancial[key]),
  ]));

  return {
    ok: [
      missingLineage, failed, lineageMismatches, missingTargets, mismatchedTargets,
      missingAttachments, mismatchedAttachments, runMismatches, duplicateLineage, extraLineage,
    ].every((issues) => issues.length === 0) && Object.values(variance).every((value) => value === 0),
    runId: migrationRun?.id || null,
    expected,
    recorded,
    imported: recorded,
    statuses,
    missingLineage,
    missing: missingLineage,
    failed,
    runMismatches,
    duplicateLineage,
    extraLineage,
    lineageMismatches,
    targets: { missing: missingTargets, mismatched: mismatchedTargets },
    attachments: { missing: missingAttachments, mismatched: mismatchedAttachments },
    financial: { expected: expectedFinancial, actual: actualFinancial, variance },
  };
}

export function selectRollbackRecords(records, migrationRunId) {
  const rank = new Map([...IMPORT_ORDER].reverse().map((entity, index) => [ENTITY_SPECS[entity].table, index]));
  return records
    .filter((record) => (
      record.migration_run_id === migrationRunId
      && ['imported', 'failed'].includes(record.status)
      && record.target_id
    ))
    .map((record) => ({ table: record.target_table, id: record.target_id }))
    .sort((left, right) => (rank.get(left.table) ?? Number.MAX_SAFE_INTEGER) - (rank.get(right.table) ?? Number.MAX_SAFE_INTEGER));
}
