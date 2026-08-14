import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REQUIRED_INPUTS = [
  ['oathTrackExportsChecksummed', 'Oath Track exports are received and checksummed'],
  ['dataDictionaryReceived', 'Oath Track data dictionary is received'],
  ['staffRosterReceived', 'staff roster and house assignments are received'],
  ['attachmentManifestReceived', 'attachment archive and manifest are received'],
  ['historyCutoffApproved', 'record-history cutoff is approved'],
  ['financialTotalsApproved', 'financial totals are approved'],
];

const REQUIRED_TECHNICAL = [
  ['businessSupabaseVerified', 'business-owned Supabase is verified'],
  ['rlsVerified', 'RLS role and cross-house tests passed'],
  ['storageVerified', 'private storage access is verified'],
  ['publicIntakeVerified', 'public intake is verified'],
  ['staffAccessVerified', 'staff invitation and recovery are verified'],
  ['migrationRehearsalPassed', 'migration rehearsal passed'],
  ['reconciliationPassed', 'migration reconciliation passed'],
  ['restoreDrillPassed', 'backup restore drill passed'],
  ['automatedChecksPassed', 'automated checks passed'],
  ['productionSmokePassed', 'production smoke check passed'],
];

function completedText(value) {
  return typeof value === 'string' && value.trim().length > 0 && !value.includes('[FILL');
}

function validTimestamp(value) {
  return completedText(value) && !Number.isNaN(Date.parse(value));
}

export function evaluateReadiness(evidence = {}) {
  const blockers = [];
  const release = evidence.release || {};
  const inputs = evidence.inputs || {};
  const technical = evidence.technical || {};
  const approvals = evidence.approvals || {};
  const houses = Array.isArray(inputs.houses) ? inputs.houses : [];

  if (evidence.schemaVersion !== 1) blockers.push('Evidence schemaVersion must be 1.');
  if (houses.length !== 6 || houses.some((house) => !completedText(house?.name) || !completedText(house?.address) || house.sourceCountsVerified !== true)) {
    blockers.push('Exactly six houses must have names, addresses, and verified source counts.');
  }
  for (const [key, label] of REQUIRED_INPUTS) {
    if (inputs[key] !== true) blockers.push(`${label}.`);
  }

  if (!completedText(release.canonicalCommit) || release.canonicalCommit !== release.previewCommit || release.canonicalCommit !== release.productionCommit) {
    blockers.push('Canonical, preview, and production commit evidence must match.');
  }
  if (release.demoMode !== false) blockers.push('Production demo mode must be disabled.');
  if (release.authBypass !== false) blockers.push('Production authentication bypass must be disabled.');

  for (const [key, label] of REQUIRED_TECHNICAL) {
    if (technical[key] !== true) blockers.push(`${label}.`);
  }

  if (approvals.slade?.approved !== true || !validTimestamp(approvals.slade?.approvedAt)) {
    blockers.push('Slade approval with timestamp is required.');
  }
  const representatives = Array.isArray(approvals.houseRepresentatives) ? approvals.houseRepresentatives : [];
  const houseNames = new Set(houses.map((house) => house?.name));
  const approvedHouseNames = new Set(representatives.map((approval) => approval?.house));
  if (representatives.length !== 6
      || approvedHouseNames.size !== 6
      || [...approvedHouseNames].some((house) => !houseNames.has(house))
      || representatives.some((approval) => !completedText(approval?.house) || approval.approved !== true || !validTimestamp(approval.approvedAt))) {
    blockers.push('Approval with timestamp is required from one representative for each of the six houses.');
  }

  return {
    ready: blockers.length === 0,
    checkedAt: new Date().toISOString(),
    blockers,
    counts: {
      houses: houses.length,
      houseApprovals: representatives.filter((approval) => approval?.approved === true).length,
      passedTechnicalGates: REQUIRED_TECHNICAL.filter(([key]) => technical[key] === true).length,
      requiredTechnicalGates: REQUIRED_TECHNICAL.length,
    },
  };
}

async function main(argv = process.argv.slice(2)) {
  const [evidencePath, reportFlag, reportPath] = argv;
  if (!evidencePath || (reportFlag && reportFlag !== '--report') || (reportFlag === '--report' && !reportPath)) {
    throw new Error('Usage: readiness:check <evidence.json> [--report <report.json>]');
  }
  const evidence = JSON.parse(await readFile(resolve(evidencePath), 'utf8'));
  const result = evaluateReadiness(evidence);
  const output = `${JSON.stringify(result, null, 2)}\n`;
  if (reportPath) await writeFile(resolve(reportPath), output, { mode: 0o600 });
  process.stdout.write(output);
  if (!result.ready) process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
