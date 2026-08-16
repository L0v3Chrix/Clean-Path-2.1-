import { createHash } from 'node:crypto';
import { readFile, realpath, writeFile } from 'node:fs/promises';
import { dirname, extname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'csv-parse/sync';
import { loadMigrationDataset } from './io.mjs';
import { IMPORT_ORDER, sha256, validateMigrationDataset } from './migration.mjs';

const STAFF_ROLES = new Set([
  'owner', 'director', 'house_manager', 'peer_support', 'case_manager', 'staff', 'volunteer',
]);

const RESIDENT_SCOPED = new Set([
  'resident_contacts', 'care_plan_goals', 'care_plan_tasks', 'medications', 'medication_logs',
  'resident_payments',
]);

function parseCsv(content) {
  return parse(content, {
    columns: true,
    bom: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: false,
  });
}

function parseHeaders(path, content) {
  if (extname(path).toLowerCase() === '.csv') {
    return (parse(content, { bom: true, to_line: 1, relax_column_count: true })[0] || []).map(String);
  }
  const parsed = JSON.parse(content);
  const rows = Array.isArray(parsed) ? parsed : parsed.records;
  return [...new Set((rows || []).flatMap((row) => Object.keys(row || {})))];
}

function digest(content) {
  return createHash('sha256').update(content).digest('hex');
}

function isBlank(value) {
  return value === undefined || value === null || String(value).trim() === '' || String(value).includes('[FILL');
}

function validTimestamp(value) {
  return !isBlank(value)
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/i.test(String(value))
    && !Number.isNaN(Date.parse(value));
}

function validMoney(value) {
  return (typeof value === 'number' && Number.isFinite(value))
    || (typeof value === 'string' && /^-?\d+(?:\.\d{1,2})?$/.test(value.trim()));
}

function parseNonNegativeInteger(value) {
  if (isBlank(value) || !/^\d+$/.test(String(value).trim())) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

async function resolveInside(baseDirectory, requestedPath) {
  if (isBlank(requestedPath)) throw new Error('Required package path is missing.');
  const base = await realpath(baseDirectory);
  const absolute = await realpath(resolve(baseDirectory, requestedPath));
  const relation = relative(base, absolute);
  if (relation.startsWith('..') || relation === '') {
    throw new Error(`Package path must stay inside the migration input directory: ${requestedPath}`);
  }
  return absolute;
}

async function readCsvInside(baseDirectory, requestedPath) {
  const absolutePath = await resolveInside(baseDirectory, requestedPath);
  const content = await readFile(absolutePath, 'utf8');
  return { rows: parseCsv(content), content, absolutePath };
}

function splitHouseIds(value) {
  return String(value || '').split(/[;,|]/).map((item) => item.trim()).filter(Boolean);
}

function rowHouseIds(entity, row, residentHouses) {
  if (entity === 'locations') return [row.source_id];
  if (entity === 'staff_profiles') return splitHouseIds(row.source_location_ids);
  if (entity === 'residents') return [row.source_location_id];
  if (['bed_assignments', 'shifts'].includes(entity)) return [row.source_location_id];
  if (['resident_documents', 'incident_reports', 'resident_fees'].includes(entity)) {
    return [row.source_location_id || residentHouses.get(String(row.source_resident_id))];
  }
  if (RESIDENT_SCOPED.has(entity)) return [residentHouses.get(String(row.source_resident_id))];
  return [];
}

function addMigrationErrors(blockers, dataset) {
  const validation = validateMigrationDataset(dataset);
  for (const error of validation.errors) {
    blockers.push(`Migration data ${error.entity}.${error.sourceId || 'manifest'}.${error.field}: ${error.message}.`);
  }
}

export async function validateSourcePackage(manifestPath) {
  const absoluteManifestPath = resolve(manifestPath);
  const baseDirectory = dirname(absoluteManifestPath);
  const manifestContent = await readFile(absoluteManifestPath, 'utf8');
  const manifest = JSON.parse(manifestContent);
  const blockers = [];
  const supportDigests = {};

  if (manifest.sourceSystem !== 'oathtrack') blockers.push('Manifest sourceSystem must be oathtrack.');
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(manifest.organizationId || '')) {
    blockers.push('Manifest organizationId must be a UUID.');
  }
  if (!validTimestamp(manifest.cutoffAt)) blockers.push('Manifest cutoffAt must be an ISO-8601 timestamp with an offset.');
  if (isBlank(manifest.cutoffApprovedBy) || !validTimestamp(manifest.cutoffApprovedAt)) {
    blockers.push('Manifest cutoff needs an approver and ISO-8601 approval timestamp.');
  }

  let dataset;
  try {
    dataset = await loadMigrationDataset(absoluteManifestPath);
    addMigrationErrors(blockers, dataset);
    const attachmentManifestPath = await resolveInside(baseDirectory, manifest.attachmentManifest);
    supportDigests.attachmentManifest = digest(await readFile(attachmentManifestPath));
  } catch (error) {
    blockers.push(error.message);
  }

  const manifestFiles = Array.isArray(manifest.files) ? manifest.files : [];
  const manifestEntities = new Set(manifestFiles.map((file) => file.entity));
  for (const entity of IMPORT_ORDER) {
    if (!manifestEntities.has(entity)) blockers.push(`Manifest must include ${entity}, even when its export has zero records.`);
  }
  for (const entity of manifestEntities) {
    if (!IMPORT_ORDER.includes(entity)) blockers.push(`Manifest contains unsupported entity ${entity}.`);
  }

  const locations = dataset?.entities?.locations || [];
  const houseIds = new Set();
  const houses = [];
  if (locations.length !== 6) blockers.push(`Exactly six location records are required; found ${locations.length}.`);
  for (const [index, house] of locations.entries()) {
    if (isBlank(house.source_id) || isBlank(house.name) || isBlank(house.address)) {
      blockers.push(`Location row ${index + 1} needs source_id, name, and address.`);
      continue;
    }
    const houseId = String(house.source_id);
    if (houseIds.has(houseId)) blockers.push(`Duplicate location source_id: ${houseId}.`);
    houseIds.add(houseId);
    houses.push({ sourceId: houseId, name: String(house.name), address: String(house.address) });
  }

  const residentHouses = new Map((dataset?.entities?.residents || []).map((row) => [
    String(row.source_id), String(row.source_location_id || ''),
  ]));
  for (const entity of ['resident_documents', 'incident_reports', 'resident_fees']) {
    for (const row of dataset?.entities?.[entity] || []) {
      const residentHouse = residentHouses.get(String(row.source_resident_id));
      if (row.source_location_id && residentHouse && String(row.source_location_id) !== residentHouse) {
        blockers.push(`${entity}.${row.source_id} location conflicts with its resident's house.`);
      }
    }
  }
  for (const entity of ['resident_fees', 'resident_payments']) {
    for (const row of dataset?.entities?.[entity] || []) {
      if (!validMoney(row.amount)) blockers.push(`${entity}.${row.source_id} amount must be a decimal with at most two places.`);
    }
  }
  const expectedCounts = new Map();
  for (const sourceFile of dataset?.sourceFiles || []) {
    for (const houseId of houseIds) expectedCounts.set(`${sourceFile.entity}:${sourceFile.path}:${houseId}`, 0);
    for (const row of dataset.entities[sourceFile.entity] || []) {
      const ids = [...new Set(rowHouseIds(sourceFile.entity, row, residentHouses).filter(Boolean).map(String))];
      if (ids.length === 0) blockers.push(`${sourceFile.entity}.${row.source_id || '(missing source_id)'} is not assigned to a house.`);
      for (const houseId of ids) {
        if (!houseIds.has(houseId)) {
          blockers.push(`${sourceFile.entity}.${row.source_id || '(missing source_id)'} references unknown house ${houseId}.`);
          continue;
        }
        const key = `${sourceFile.entity}:${sourceFile.path}:${houseId}`;
        expectedCounts.set(key, (expectedCounts.get(key) || 0) + 1);
      }
    }
  }

  let sourceCounts = [];
  try {
    const loaded = await readCsvInside(baseDirectory, manifest.sourceCounts);
    sourceCounts = loaded.rows;
    supportDigests.sourceCounts = digest(loaded.content);
  } catch (error) {
    blockers.push(`Source-count sheet: ${error.message}`);
  }

  const actualCounts = new Map();
  const sourceFileByKey = new Map((dataset?.sourceFiles || []).map((file) => [`${file.entity}:${file.path}`, file]));
  for (const [index, row] of sourceCounts.entries()) {
    const rowNumber = index + 2;
    const count = parseNonNegativeInteger(row.source_count);
    const fileKey = `${row.entity}:${row.export_file}`;
    const sourceFile = sourceFileByKey.get(fileKey);
    const key = `${fileKey}:${row.house_source_id}`;
    if (!sourceFile) blockers.push(`Source-count row ${rowNumber} references a file not present in the manifest.`);
    if (!houseIds.has(String(row.house_source_id))) blockers.push(`Source-count row ${rowNumber} references an unknown house.`);
    if (actualCounts.has(key)) blockers.push(`Duplicate source-count row for ${row.house_source_id}, ${row.entity}, ${row.export_file}.`);
    if (count === null) blockers.push(`Source-count row ${rowNumber} needs a non-negative integer count.`);
    if (!/^[a-f0-9]{64}$/i.test(row.sha256 || '')) blockers.push(`Source-count row ${rowNumber} needs a SHA-256 checksum.`);
    if (sourceFile && String(row.sha256).toLowerCase() !== sourceFile.sha256.toLowerCase()) blockers.push(`Checksum mismatch for ${row.export_file}.`);
    if (isBlank(row.verified_by) || !validTimestamp(row.verified_at)) blockers.push(`Source-count row ${rowNumber} needs verifier and ISO-8601 timestamp.`);
    if (count !== null) actualCounts.set(key, count);
  }
  for (const [key, expected] of expectedCounts) {
    if (!actualCounts.has(key)) blockers.push(`Missing per-house source count for ${key}.`);
    else if (actualCounts.get(key) !== expected) blockers.push(`Source count for ${key} is ${actualCounts.get(key)}; expected ${expected}.`);
  }
  for (const key of actualCounts.keys()) {
    if (!expectedCounts.has(key)) blockers.push(`Unexpected source-count row for ${key}.`);
  }

  let dictionary = [];
  try {
    const loaded = await readCsvInside(baseDirectory, manifest.dataDictionary);
    dictionary = loaded.rows;
    supportDigests.dataDictionary = digest(loaded.content);
  } catch (error) {
    blockers.push(`Data dictionary: ${error.message}`);
  }
  const documentedFields = new Map();
  for (const [index, row] of dictionary.entries()) {
    if (isBlank(row.entity) || isBlank(row.source_field) || isBlank(row.description)) {
      blockers.push(`Data-dictionary row ${index + 2} needs entity, source_field, and description.`);
      continue;
    }
    const fields = documentedFields.get(String(row.entity)) || new Set();
    fields.add(String(row.source_field));
    documentedFields.set(String(row.entity), fields);
  }
  for (const file of manifestFiles) {
    try {
      const absolutePath = await resolveInside(baseDirectory, file.path);
      const content = await readFile(absolutePath, 'utf8');
      for (const header of parseHeaders(absolutePath, content)) {
        if (!documentedFields.get(file.entity)?.has(header)) blockers.push(`Data dictionary does not cover ${file.entity}.${header}.`);
      }
    } catch (error) {
      blockers.push(`Unable to inspect dictionary coverage for ${file.entity}: ${error.message}`);
    }
  }

  let staffRoster = [];
  try {
    const loaded = await readCsvInside(baseDirectory, manifest.staffRoster);
    staffRoster = loaded.rows;
    supportDigests.staffRoster = digest(loaded.content);
  } catch (error) {
    blockers.push(`Staff roster: ${error.message}`);
  }
  if (staffRoster.length === 0) blockers.push('Staff roster must contain at least one approved user.');
  for (const [index, row] of staffRoster.entries()) {
    const rowNumber = index + 2;
    if (isBlank(row.email) || isBlank(row.first_name) || isBlank(row.last_name) || isBlank(row.role)) blockers.push(`Staff-roster row ${rowNumber} is incomplete.`);
    if (!STAFF_ROLES.has(row.role)) blockers.push(`Staff-roster row ${rowNumber} has unsupported role ${row.role || '(blank)'}.`);
    const assignments = splitHouseIds(row.house_source_ids);
    if (assignments.length === 0) blockers.push(`Staff-roster row ${rowNumber} needs at least one house assignment.`);
    for (const houseId of assignments) if (!houseIds.has(houseId)) blockers.push(`Staff-roster row ${rowNumber} references unknown house ${houseId}.`);
    if (!['active', 'inactive'].includes(row.status)) blockers.push(`Staff-roster row ${rowNumber} status must be active or inactive.`);
    if (isBlank(row.invitation_owner)) blockers.push(`Staff-roster row ${rowNumber} needs an invitation owner.`);
  }

  let financialTotals = [];
  try {
    const loaded = await readCsvInside(baseDirectory, manifest.financialTotals);
    financialTotals = loaded.rows;
    supportDigests.financialTotals = digest(loaded.content);
  } catch (error) {
    blockers.push(`Financial totals: ${error.message}`);
  }
  const sourceFinancialByHouse = new Map([...houseIds].map((houseId) => [houseId, { charges: 0, payments: 0 }]));
  for (const [entity, field] of [['resident_fees', 'charges'], ['resident_payments', 'payments']]) {
    for (const row of dataset?.entities?.[entity] || []) {
      const ids = [...new Set(rowHouseIds(entity, row, residentHouses).filter(Boolean).map(String))];
      for (const houseId of ids) {
        if (sourceFinancialByHouse.has(houseId) && validMoney(row.amount)) {
          sourceFinancialByHouse.get(houseId)[field] += Number(row.amount);
        }
      }
    }
  }
  const financialHouses = new Set();
  for (const [index, row] of financialTotals.entries()) {
    const rowNumber = index + 2;
    const houseId = String(row.house_source_id || '');
    if (!houseIds.has(houseId)) blockers.push(`Financial-total row ${rowNumber} references an unknown house.`);
    if (financialHouses.has(houseId)) blockers.push(`Duplicate financial-total row for house ${houseId}.`);
    financialHouses.add(houseId);
    const financialFields = ['opening_balance', 'charges', 'payments', 'adjustments', 'closing_balance'];
    const values = financialFields.map((field) => validMoney(row[field]) ? Number(row[field]) : null);
    if (values.some((value) => value === null)) blockers.push(`Financial-total row ${rowNumber} contains an invalid amount.`);
    else {
      if (Math.abs((values[0] + values[1] - values[2] + values[3]) - values[4]) > 0.005) blockers.push(`Financial-total row ${rowNumber} does not reconcile.`);
      const source = sourceFinancialByHouse.get(houseId);
      if (source && (Math.abs(source.charges - values[1]) > 0.005 || Math.abs(source.payments - values[2]) > 0.005)) {
        blockers.push(`Financial-total row ${rowNumber} does not match the fee and payment exports.`);
      }
    }
    if (isBlank(row.verified_by) || !validTimestamp(row.verified_at)) blockers.push(`Financial-total row ${rowNumber} needs verifier and ISO-8601 timestamp.`);
  }
  for (const houseId of houseIds) if (!financialHouses.has(houseId)) blockers.push(`Financial totals are missing for house ${houseId}.`);

  const sourceKeys = new Set(Object.entries(dataset?.entities || {}).flatMap(([entity, rows]) => (
    rows.map((row) => `${entity}:${row.source_id}`)
  )));
  const attachmentKeys = new Set();
  for (const attachment of dataset?.attachments || []) {
    const key = `${attachment.source_entity}:${attachment.source_id}`;
    if (attachmentKeys.has(key)) blockers.push(`Duplicate attachment row for ${key}.`);
    if (!sourceKeys.has(key)) blockers.push(`Attachment references unknown source record ${key}.`);
    attachmentKeys.add(key);
  }
  for (const document of dataset?.entities?.resident_documents || []) {
    if (!attachmentKeys.has(`resident_documents:${document.source_id}`)) blockers.push(`Resident document ${document.source_id} has no attachment.`);
  }

  const uniqueBlockers = [...new Set(blockers)];
  const sourceFiles = dataset?.sourceFiles || [];
  const packageSha256 = digest(JSON.stringify({
    manifest: digest(manifestContent),
    sourceFiles: sourceFiles.map(({ entity, path, records, sha256 }) => ({ entity, path, records, sha256 })),
    attachments: (dataset?.attachments || []).map(({ source_entity, source_id, sha256 }) => ({
      source_entity, source_id, sha256,
    })).sort((left, right) => `${left.source_entity}:${left.source_id}`.localeCompare(`${right.source_entity}:${right.source_id}`)),
    supportDigests,
  }));
  const result = {
    ok: uniqueBlockers.length === 0,
    checkedAt: new Date().toISOString(),
    manifestSha256: digest(manifestContent),
    packageSha256,
    datasetSha256: dataset ? sha256(dataset) : null,
    cutoffAt: manifest.cutoffAt || null,
    houses,
    sourceFiles: sourceFiles.map(({ entity, path, records, sha256 }) => ({ entity, path, records, sha256 })),
    counts: {
      houses: locations.length,
      sourceFiles: sourceFiles.length,
      requiredSourceFiles: IMPORT_ORDER.length,
      sourceRecords: sourceFiles.reduce((sum, file) => sum + file.records, 0),
      sourceCountRows: sourceCounts.length,
      dictionaryRows: dictionary.length,
      staffUsers: staffRoster.length,
      financialHouses: financialTotals.length,
      attachments: dataset?.attachments?.length || 0,
    },
    blockers: uniqueBlockers,
  };
  Object.defineProperty(result, 'validatedDataset', { value: dataset, enumerable: false });
  return result;
}

function parseArgs(argv) {
  const [manifestPath, reportFlag, reportPath] = argv;
  if (!manifestPath || (reportFlag && reportFlag !== '--report') || (reportFlag === '--report' && !reportPath)) {
    throw new Error('Usage: migration:package-validate <manifest.json> [--report <report.json>]');
  }
  return { manifestPath, reportPath: reportFlag === '--report' ? reportPath : null };
}

async function main(argv = process.argv.slice(2)) {
  const { manifestPath, reportPath } = parseArgs(argv);
  const result = await validateSourcePackage(manifestPath);
  const output = `${JSON.stringify(result, null, 2)}\n`;
  if (reportPath) await writeFile(resolve(reportPath), output, { mode: 0o600 });
  process.stdout.write(output);
  if (!result.ok) process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
