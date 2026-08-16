import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { signMigrationReport } from '../migration/report-integrity.mjs';

export function parseSignEvidenceArgs(argv = []) {
  const inputPath = argv[0];
  let reportPath;
  let keyEnv = 'CLEARPATH_EVIDENCE_SIGNING_KEY';
  for (let index = 1; index < argv.length; index += 1) {
    if (argv[index] === '--report') reportPath = argv[++index];
    else if (argv[index] === '--key-env') keyEnv = argv[++index];
    else throw new Error(`Unknown argument: ${argv[index]}`);
  }
  if (!inputPath || !reportPath || !keyEnv) {
    throw new Error('Usage: evidence:sign <input.json> --report <signed.json> [--key-env ENV_NAME]');
  }
  return { inputPath, reportPath, keyEnv };
}

export function signEvidence(report, signingKey) {
  if (!signingKey) throw new Error('Evidence signing key is required.');
  return signMigrationReport(report, signingKey);
}

async function main(argv = process.argv.slice(2)) {
  const { inputPath, reportPath, keyEnv } = parseSignEvidenceArgs(argv);
  const report = JSON.parse(await readFile(resolve(inputPath), 'utf8'));
  const signed = signEvidence(report, process.env[keyEnv]);
  await writeFile(resolve(reportPath), `${JSON.stringify(signed, null, 2)}\n`, { mode: 0o600 });
  process.stdout.write(`${JSON.stringify({ ok: true, report: resolve(reportPath), keyEnv })}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
