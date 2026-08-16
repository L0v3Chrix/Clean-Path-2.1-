import { createHmac, timingSafeEqual } from 'node:crypto';

const ALGORITHM = 'hmac-sha256';
const SIGNATURE_PATTERN = /^[a-f0-9]{64}$/;

function reportPayload(report) {
  if (!report || typeof report !== 'object' || Array.isArray(report)) {
    throw new Error('Migration report must be an object.');
  }
  const { integrity: _integrity, ...payload } = report;
  return payload;
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, stableValue(nested)]),
    );
  }
  return value;
}

function reportHmac(report, signingKey) {
  return createHmac('sha256', signingKey)
    .update(JSON.stringify(stableValue(reportPayload(report))))
    .digest();
}

export function signMigrationReport(report, signingKey) {
  const payload = reportPayload(report);
  if (!signingKey) return payload;
  return {
    ...payload,
    integrity: {
      algorithm: ALGORITHM,
      signature: reportHmac(payload, signingKey).toString('hex'),
    },
  };
}

export function verifyMigrationReport(report, signingKey) {
  if (!signingKey || !report || typeof report !== 'object' || Array.isArray(report)) return false;
  const { algorithm, signature } = report.integrity || {};
  if (algorithm !== ALGORITHM || !SIGNATURE_PATTERN.test(signature || '')) return false;

  const expected = reportHmac(report, signingKey);
  const observed = Buffer.from(signature, 'hex');
  return observed.length === expected.length && timingSafeEqual(observed, expected);
}

export function assertMigrationReportIntegrity(report, signingKey) {
  if (!verifyMigrationReport(report, signingKey)) {
    throw new Error('Migration report integrity verification failed.');
  }
}
