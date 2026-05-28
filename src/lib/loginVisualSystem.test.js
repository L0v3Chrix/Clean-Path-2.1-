import { describe, expect, it } from 'vitest';
import {
  CLEARPATH_LOGIN_COPY,
  CLEARPATH_LOGIN_MODES,
  getLoginMode,
} from './loginVisualSystem';

describe('clearpath login visual system', () => {
  it('keeps the approved ClearPath login copy in one place', () => {
    expect(CLEARPATH_LOGIN_COPY.headline).toBe('Welcome back to ClearPath');
    expect(CLEARPATH_LOGIN_COPY.supportingLine).toBe('Your operating picture starts here');
    expect(CLEARPATH_LOGIN_COPY.demoNote).toContain('approved resident information');
  });

  it('defines paired light and dark login experiences', () => {
    expect(CLEARPATH_LOGIN_MODES.light.asset).toBe('/images/clearpath/clearpath-threshold-hero.png');
    expect(CLEARPATH_LOGIN_MODES.dark.asset).toBe('/images/clearpath/clearpath-operational-cockpit.png');
    expect(CLEARPATH_LOGIN_MODES.light.label).toMatch(/Light/i);
    expect(CLEARPATH_LOGIN_MODES.dark.label).toMatch(/Dark/i);
  });

  it('falls back to the light threshold mode for unknown preferences', () => {
    expect(getLoginMode('dark')).toBe(CLEARPATH_LOGIN_MODES.dark);
    expect(getLoginMode('unknown')).toBe(CLEARPATH_LOGIN_MODES.light);
  });
});
