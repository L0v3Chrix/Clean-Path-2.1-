import { describe, expect, it } from 'vitest';
import { normalizePublicIntake } from './publicIntake';

describe('public intake validation', () => {
  const valid = {
    first_name: '  Jane ', last_name: ' Doe ', date_of_birth: '1990-02-03',
    background_check_consent: true, resident_agreement_signed: true,
  };

  it('keeps only approved resident fields and records consent without claiming a check started', () => {
    const result = normalizePublicIntake({ ...valid, organization_id: 'attacker', status: 'active' });
    expect(result.ok).toBe(true);
    expect(result.resident.first_name).toBe('Jane');
    expect(result.resident.organization_id).toBeUndefined();
    expect(result.resident.status).toBe('applicant');
    expect(result.resident.background_check_status).toBe('not_started');
  });

  it('rejects missing consent and malformed dates', () => {
    const result = normalizePublicIntake({ ...valid, date_of_birth: '03/02/1990', background_check_consent: false });
    expect(result.ok).toBe(false);
    expect(result.errors).toContain('A valid date of birth is required.');
    expect(result.errors).toContain('Background-check consent is required.');
  });
});
