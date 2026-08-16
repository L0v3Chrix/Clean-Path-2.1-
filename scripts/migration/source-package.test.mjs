import { createHash } from 'node:crypto';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { IMPORT_ORDER } from './migration.mjs';
import { validateSourcePackage } from './source-package.mjs';

function checksum(value) {
  return createHash('sha256').update(value).digest('hex');
}

const HEADERS = {
  locations: 'source_id,name,address',
  staff_profiles: 'source_id,source_location_ids,first_name,last_name,role',
  residents: 'source_id,source_location_id,first_name,last_name',
  resident_contacts: 'source_id,source_resident_id,name',
  bed_assignments: 'source_id,source_location_id,source_resident_id,bed_label',
  resident_documents: 'source_id,source_resident_id,source_location_id,document_type',
  care_plan_goals: 'source_id,source_resident_id,term,category,title',
  care_plan_tasks: 'source_id,source_resident_id,source_goal_id,title',
  medications: 'source_id,source_resident_id,medication_name,dosage',
  medication_logs: 'source_id,source_resident_id,source_medication_id,status',
  incident_reports: 'source_id,source_resident_id,source_location_id,incident_date,description',
  shifts: 'source_id,source_location_id,source_staff_id,shift_date,start_time,end_time',
  resident_fees: 'source_id,source_resident_id,source_location_id,label,amount',
  resident_payments: 'source_id,source_resident_id,source_fee_id,amount,payment_date',
};

async function makePackage({
  corruptChecksum = false, houseCount = 6, omitEntity = null, missingResidentName = false,
  financialMismatch = false, orphanAttachment = false, invalidAmount = false,
  crossHouseIncident = false, blankSourceCount = false, blankFinancial = false,
} = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'clearpath-package-'));
  const houseIds = Array.from({ length: houseCount }, (_, index) => `h-${index + 1}`);
  const data = Object.fromEntries(IMPORT_ORDER.map((entity) => [entity, `${HEADERS[entity]}\n`]));
  data.locations += houseIds.map((id, index) => `${id},House ${index + 1},${index + 1} Main Street`).join('\n');
  data.locations += '\n';
  data.staff_profiles += 's-1,h-1,Test,Owner,owner\n';
  data.residents += missingResidentName ? 'r-1,h-1,,\n' : 'r-1,h-1,Test,Resident\n';
  if (invalidAmount) data.resident_fees += 'fee-1,r-1,h-1,Test Fee,not-money\n';
  if (crossHouseIncident) data.incident_reports += 'incident-1,r-1,h-2,2026-08-16,Test incident\n';

  const files = [];
  for (const entity of IMPORT_ORDER) {
    if (entity === omitEntity) continue;
    const path = `${entity}.csv`;
    await writeFile(join(directory, path), data[entity]);
    files.push({ entity, path });
  }
  if (orphanAttachment) await writeFile(join(directory, 'orphan.txt'), 'orphan');
  await writeFile(
    join(directory, 'attachments.csv'),
    orphanAttachment
      ? 'source_entity,source_id,path,file_name,mime_type\nresident_documents,missing-doc,orphan.txt,orphan.txt,text/plain\n'
      : 'source_entity,source_id,path,file_name,mime_type\n',
  );
  await writeFile(join(directory, 'staff-roster.csv'), [
    'email,first_name,last_name,role,house_source_ids,status,invitation_owner',
    `owner@example.com,Test,Owner,owner,${houseIds.join(';')},active,Slade`,
  ].join('\n'));
  await writeFile(join(directory, 'financial-totals.csv'), [
    'house_source_id,opening_balance,charges,payments,adjustments,closing_balance,verified_by,verified_at',
    ...houseIds.map((id, index) => (
      financialMismatch && index === 0
        ? `${id},0,1,0,0,1,Slade,2026-08-16T10:00:00-05:00`
        : blankFinancial && index === 0
          ? `${id},,0,0,0,0,Slade,2026-08-16T10:00:00-05:00`
          : `${id},0,0,0,0,0,Slade,2026-08-16T10:00:00-05:00`
    )),
  ].join('\n'));

  const dictionaryRows = ['entity,source_field,description'];
  for (const entity of IMPORT_ORDER) {
    for (const header of HEADERS[entity].split(',')) dictionaryRows.push(`${entity},${header},Oath Track ${header}`);
  }
  await writeFile(join(directory, 'data-dictionary.csv'), dictionaryRows.join('\n'));

  const countRows = [];
  for (const { entity, path } of files) {
    for (const houseId of houseIds) {
      const populatedAtHouseOne = ['staff_profiles', 'residents'].includes(entity)
        || (invalidAmount && entity === 'resident_fees');
      const populatedAtHouseTwo = crossHouseIncident && entity === 'incident_reports';
      const expected = entity === 'locations'
        || (houseId === 'h-1' && populatedAtHouseOne)
        || (houseId === 'h-2' && populatedAtHouseTwo) ? 1 : 0;
      const hash = corruptChecksum && entity === 'locations' ? '0'.repeat(64) : checksum(data[entity]);
      const count = blankSourceCount && entity === 'incident_reports' && houseId === 'h-1' ? '' : expected;
      countRows.push(`${houseId},${entity},${count},${path},${hash},Slade,2026-08-16T10:00:00-05:00`);
    }
  }
  await writeFile(join(directory, 'source-counts.csv'), [
    'house_source_id,entity,source_count,export_file,sha256,verified_by,verified_at',
    ...countRows,
  ].join('\n'));

  const manifest = {
    sourceSystem: 'oathtrack',
    organizationId: '00000000-0000-4000-8000-000000000001',
    cutoffAt: '2026-08-16T09:00:00-05:00',
    cutoffApprovedBy: 'Slade',
    cutoffApprovedAt: '2026-08-16T09:05:00-05:00',
    sourceCounts: 'source-counts.csv',
    dataDictionary: 'data-dictionary.csv',
    staffRoster: 'staff-roster.csv',
    financialTotals: 'financial-totals.csv',
    attachmentManifest: 'attachments.csv',
    files,
  };
  const manifestPath = join(directory, 'manifest.json');
  await writeFile(manifestPath, JSON.stringify(manifest));
  return manifestPath;
}

describe('source-package validation', () => {
  it('proves a complete six-house package from the live files', async () => {
    const result = await validateSourcePackage(await makePackage());
    expect(result).toMatchObject({
      ok: true,
      counts: { houses: 6, sourceFiles: 14, requiredSourceFiles: 14, sourceCountRows: 84, financialHouses: 6 },
      blockers: [],
    });
    expect(result.packageSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(result.datasetSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(result.validatedDataset).toBeDefined();
    expect(JSON.stringify(result)).not.toContain('validatedDataset');
    expect(result.houses).toHaveLength(6);
  });

  it('rejects an altered source export', async () => {
    const result = await validateSourcePackage(await makePackage({ corruptChecksum: true }));
    expect(result.ok).toBe(false);
    expect(result.blockers).toContain('Checksum mismatch for locations.csv.');
  });

  it('rejects a package without exactly six houses', async () => {
    const result = await validateSourcePackage(await makePackage({ houseCount: 5 }));
    expect(result.ok).toBe(false);
    expect(result.blockers).toContain('Exactly six location records are required; found 5.');
  });

  it('rejects an omitted required domain even when all listed files reconcile', async () => {
    const result = await validateSourcePackage(await makePackage({ omitEntity: 'incident_reports' }));
    expect(result.ok).toBe(false);
    expect(result.blockers).toContain('Manifest must include incident_reports, even when its export has zero records.');
  });

  it('runs the migration data validator as part of package acceptance', async () => {
    const result = await validateSourcePackage(await makePackage({ missingResidentName: true }));
    expect(result.ok).toBe(false);
    expect(result.blockers.join('\n')).toMatch(/Migration data residents\.r-1\.(first_name|last_name): Required/);
  });

  it('rejects approved financial totals that do not match source exports', async () => {
    const result = await validateSourcePackage(await makePackage({ financialMismatch: true }));
    expect(result.ok).toBe(false);
    expect(result.blockers).toContain('Financial-total row 2 does not match the fee and payment exports.');
  });

  it('rejects attachments without a matching source record', async () => {
    const result = await validateSourcePackage(await makePackage({ orphanAttachment: true }));
    expect(result.ok).toBe(false);
    expect(result.blockers).toContain('Attachment references unknown source record resident_documents:missing-doc.');
  });

  it('rejects nonnumeric source financial amounts', async () => {
    const result = await validateSourcePackage(await makePackage({ invalidAmount: true }));
    expect(result.ok).toBe(false);
    expect(result.blockers).toContain('resident_fees.fee-1 amount must be a decimal with at most two places.');
  });

  it('rejects a resident-scoped record assigned to a different house', async () => {
    const result = await validateSourcePackage(await makePackage({ crossHouseIncident: true }));
    expect(result.ok).toBe(false);
    expect(result.blockers).toContain("incident_reports.incident-1 location conflicts with its resident's house.");
  });

  it('rejects a blank source count instead of coercing it to zero', async () => {
    const result = await validateSourcePackage(await makePackage({ blankSourceCount: true }));
    expect(result.ok).toBe(false);
    expect(result.blockers.join('\n')).toMatch(/source-count row .*non-negative integer/i);
  });

  it('rejects a blank financial value instead of coercing it to zero', async () => {
    const result = await validateSourcePackage(await makePackage({ blankFinancial: true }));
    expect(result.ok).toBe(false);
    expect(result.blockers.join('\n')).toMatch(/financial-total row .*invalid amount/i);
  });
});
