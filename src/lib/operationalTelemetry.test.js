import { describe, expect, it } from 'vitest';
import { buildOperationalEvent } from './operationalTelemetry';

describe('operational telemetry', () => {
  it('records allowlisted diagnostics without messages, stacks, or form values', () => {
    const event = buildOperationalEvent({
      category: 'render_error',
      component: 'Residents',
      route: '/residents/secret-name',
      release: 'abc1234',
      error: new Error('Resident Jane Doe failed'),
      form: { firstName: 'Jane' },
    });

    expect(event).toEqual({
      category: 'render_error',
      component: 'Residents',
      route: '/residents',
      release: 'abc1234',
    });
    expect(JSON.stringify(event)).not.toMatch(/jane|failed|stack|form/i);
  });

  it('normalizes unrecognized values instead of forwarding them', () => {
    expect(buildOperationalEvent({ category: 'custom-secret', component: '<script>' }))
      .toEqual({ category: 'unknown_error', component: 'Application', route: '/', release: 'unknown' });
  });
});
