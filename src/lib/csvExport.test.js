import { describe, expect, it } from 'vitest';
import { recordsToCsv } from './csvExport';

describe('CSV exports', () => {
  it('uses explicit columns and prevents spreadsheet formula execution', () => {
    const csv = recordsToCsv([
      { first_name: '=HYPERLINK("bad")', status: 'active', ignored: 'secret' },
      { first_name: 'Alex, Jr.', status: 'applicant', ignored: 'secret' },
    ], ['first_name', 'status']);

    expect(csv).toContain("'=HYPERLINK");
    expect(csv).toContain('"Alex, Jr."');
    expect(csv).not.toContain('ignored');
    expect(csv).not.toContain('secret');
  });
});
