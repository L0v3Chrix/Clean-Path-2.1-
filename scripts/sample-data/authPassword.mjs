import { randomUUID } from 'node:crypto';

export function sampleAuthPassword(environment = process.env) {
  const configured = environment.SAMPLE_AUTH_PASSWORD;
  if (configured && configured.length < 12) {
    throw new Error('SAMPLE_AUTH_PASSWORD must be at least 12 characters.');
  }
  return configured || randomUUID();
}
