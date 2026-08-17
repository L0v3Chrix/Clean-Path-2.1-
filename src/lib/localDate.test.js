import { describe, expect, it } from 'vitest';

import { toLocalDateInputValue } from './localDate';

describe('local date input formatting', () => {
  it('uses the operating device calendar date instead of a UTC conversion', () => {
    const localDate = {
      getFullYear: () => 2026,
      getMonth: () => 7,
      getDate: () => 16,
    };

    expect(toLocalDateInputValue(localDate)).toBe('2026-08-16');
  });
});
