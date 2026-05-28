export const CLEARPATH_LOGIN_COPY = {
  headline: 'Welcome back to ClearPath',
  supportingLine: 'Your operating picture starts here',
  demoKicker: 'Demo environment',
  demoNote: 'Use only approved resident information.',
};

export const CLEARPATH_LOGIN_MODES = {
  light: {
    id: 'light',
    label: 'Light threshold',
    asset: '/images/clearpath/clearpath-threshold-hero.png',
    eyebrow: 'Morning handoff',
    title: 'A calm entry into daily operations',
    description: 'Residents, medications, incidents, compliance, and owner visibility in one connected path.',
  },
  dark: {
    id: 'dark',
    label: 'Dark command',
    asset: '/images/clearpath/clearpath-operational-cockpit.png',
    eyebrow: 'Command center',
    title: 'Operational clarity after the lights go low',
    description: 'A focused view for high-attention handoffs, safety checks, and owner updates.',
  },
};

export function getLoginMode(preference) {
  return CLEARPATH_LOGIN_MODES[preference] || CLEARPATH_LOGIN_MODES.light;
}
