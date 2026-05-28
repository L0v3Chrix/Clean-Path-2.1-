export const CLEARPATH_ASSETS = {
  operationalCockpit: '/images/clearpath/clearpath-operational-cockpit.png',
  thresholdHero: '/images/clearpath/clearpath-threshold-hero.png',
  paperTexture: '/images/clearpath/warm-paper-path-texture.png',
  incidentComplianceDesk: '/images/clearpath/incident-compliance-desk.png',
  medicationWorkflowScan: '/images/clearpath/medication-workflow-scan.png',
};

export const MODULE_TREATMENTS = {
  dashboard: {
    asset: CLEARPATH_ASSETS.operationalCockpit,
    accent: 'sage',
    title: "Today's operating picture",
  },
  residents: {
    asset: CLEARPATH_ASSETS.thresholdHero,
    accent: 'earth',
    title: 'Resident path',
  },
  incidents: {
    asset: CLEARPATH_ASSETS.incidentComplianceDesk,
    accent: 'sunset',
    title: 'Incident clarity',
  },
  compliance: {
    asset: CLEARPATH_ASSETS.incidentComplianceDesk,
    accent: 'earth',
    title: 'Compliance posture',
  },
  medication: {
    asset: CLEARPATH_ASSETS.medicationWorkflowScan,
    accent: 'sage',
    title: 'Medication handoff',
  },
};

const ATTENTION_TONES = {
  urgent: {
    label: 'Needs review',
    ring: 'cp-attention-urgent',
    text: 'text-[#8C2F0A]',
    surface: 'bg-[#FFF1E7]',
  },
  active: {
    label: 'Active',
    ring: 'cp-attention-active',
    text: 'text-[#3A5638]',
    surface: 'bg-[#EEF7F0]',
  },
  steady: {
    label: 'Steady',
    ring: 'cp-attention-steady',
    text: 'text-[#5F4130]',
    surface: 'bg-[#FFF8EA]',
  },
};

export function getAttentionTone(tone) {
  return ATTENTION_TONES[tone] || ATTENTION_TONES.steady;
}
