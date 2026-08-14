import { describe, expect, it } from 'vitest';
import { evaluateReadiness } from './readiness.mjs';

function completeEvidence() {
  return {
    schemaVersion: 1,
    release: {
      canonicalCommit: 'abc1234',
      previewCommit: 'abc1234',
      productionCommit: 'abc1234',
      demoMode: false,
      authBypass: false,
    },
    inputs: {
      houses: Array.from({ length: 6 }, (_, index) => ({
        name: `House ${index + 1}`,
        address: `${index + 1} Main St`,
        sourceCountsVerified: true,
      })),
      oathTrackExportsChecksummed: true,
      dataDictionaryReceived: true,
      staffRosterReceived: true,
      attachmentManifestReceived: true,
      historyCutoffApproved: true,
      financialTotalsApproved: true,
    },
    technical: {
      businessSupabaseVerified: true,
      rlsVerified: true,
      storageVerified: true,
      publicIntakeVerified: true,
      staffAccessVerified: true,
      migrationRehearsalPassed: true,
      reconciliationPassed: true,
      restoreDrillPassed: true,
      automatedChecksPassed: true,
      productionSmokePassed: true,
    },
    approvals: {
      slade: { approved: true, approvedAt: '2026-08-14T12:00:00Z' },
      houseRepresentatives: Array.from({ length: 6 }, (_, index) => ({
        house: `House ${index + 1}`,
        approved: true,
        approvedAt: '2026-08-14T12:00:00Z',
      })),
    },
  };
}

describe('cutover readiness evaluation', () => {
  it('passes only complete evidence with matching commits and six approvals', () => {
    const result = evaluateReadiness(completeEvidence());
    expect(result.ready).toBe(true);
    expect(result.blockers).toEqual([]);
  });

  it('fails closed when external inputs, restore proof, or approvals are missing', () => {
    const evidence = completeEvidence();
    evidence.inputs.houses = evidence.inputs.houses.slice(0, 5);
    evidence.inputs.oathTrackExportsChecksummed = false;
    evidence.technical.restoreDrillPassed = false;
    evidence.approvals.slade.approved = false;

    const result = evaluateReadiness(evidence);
    expect(result.ready).toBe(false);
    expect(result.blockers).toEqual(expect.arrayContaining([
      expect.stringContaining('six houses'),
      expect.stringContaining('Oath Track exports'),
      expect.stringContaining('restore drill'),
      expect.stringContaining('Slade approval'),
    ]));
  });

  it('rejects demo mode and release commit drift', () => {
    const evidence = completeEvidence();
    evidence.release.demoMode = true;
    evidence.release.productionCommit = 'different';

    const result = evaluateReadiness(evidence);
    expect(result.ready).toBe(false);
    expect(result.blockers.join('\n')).toMatch(/demo mode/i);
    expect(result.blockers.join('\n')).toMatch(/commit/i);
  });

  it('rejects untouched placeholders and approvals for the wrong houses', () => {
    const evidence = completeEvidence();
    evidence.inputs.houses[0].name = '[FILL: HOUSE_1_NAME]';
    evidence.approvals.houseRepresentatives[0].house = 'Unlisted House';

    const result = evaluateReadiness(evidence);
    expect(result.ready).toBe(false);
    expect(result.blockers.join('\n')).toMatch(/six houses/i);
    expect(result.blockers.join('\n')).toMatch(/representative/i);
  });
});
