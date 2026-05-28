import { describe, expect, it } from 'vitest';
import {
  CLEARPATH_ASSETS,
  MODULE_TREATMENTS,
  getAttentionTone,
} from './clearpathVisualSystem';

describe('clearpath visual system', () => {
  it('exposes project-local generated image assets for the visual upgrade', () => {
    expect(CLEARPATH_ASSETS.operationalCockpit).toBe('/images/clearpath/clearpath-operational-cockpit.png');
    expect(CLEARPATH_ASSETS.thresholdHero).toBe('/images/clearpath/clearpath-threshold-hero.png');
    expect(CLEARPATH_ASSETS.paperTexture).toBe('/images/clearpath/warm-paper-path-texture.png');
  });

  it('maps operational modules to branded image treatments', () => {
    expect(MODULE_TREATMENTS.dashboard.asset).toBe(CLEARPATH_ASSETS.operationalCockpit);
    expect(MODULE_TREATMENTS.incidents.asset).toBe(CLEARPATH_ASSETS.incidentComplianceDesk);
    expect(MODULE_TREATMENTS.medication.asset).toBe(CLEARPATH_ASSETS.medicationWorkflowScan);
  });

  it('returns accessible attention tones with labels and visual classes', () => {
    expect(getAttentionTone('urgent')).toMatchObject({
      label: 'Needs review',
      ring: 'cp-attention-urgent',
    });
    expect(getAttentionTone('unknown')).toMatchObject({
      label: 'Steady',
      ring: 'cp-attention-steady',
    });
  });
});
