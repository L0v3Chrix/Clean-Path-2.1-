import { describe, expect, it } from 'vitest';
import { validateAppResponse, validateHealthResponse } from './health-check.mjs';

describe('release health checks', () => {
  it('accepts a built ClearPath shell and healthy database response', () => {
    expect(validateAppResponse(200, '<title>ClearPath</title><script src="/assets/index.js"></script>')).toEqual([]);
    expect(validateHealthResponse(200, { ok: true, service: 'clearpath-api', checks: { database: 'ok' } })).toEqual([]);
  });

  it('reports deployment protection, missing assets, and database failures', () => {
    expect(validateAppResponse(401, '<title>Authentication Required</title>').join(' ')).toMatch(/status 401|ClearPath|asset/i);
    expect(validateHealthResponse(503, { ok: false, checks: { database: 'failed' } }).join(' ')).toMatch(/503|database/i);
  });
});
