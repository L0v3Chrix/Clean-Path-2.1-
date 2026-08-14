import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function validateAppResponse(status, body) {
  const errors = [];
  if (status !== 200) errors.push(`Application returned status ${status}.`);
  if (!/<title>\s*ClearPath\s*<\/title>/i.test(body)) errors.push('ClearPath page title was not found.');
  if (!/<script[^>]+src=["'][^"']*\/assets\//i.test(body)) errors.push('Built application asset was not found.');
  return errors;
}

export function validateHealthResponse(status, body) {
  const errors = [];
  if (status !== 200) errors.push(`Health endpoint returned status ${status}.`);
  if (body?.ok !== true) errors.push('Health endpoint did not report ok.');
  if (body?.service !== 'clearpath-api') errors.push('Health endpoint service identity did not match.');
  if (body?.checks?.database !== 'ok') errors.push('Health endpoint database check failed.');
  return errors;
}

async function main(argv = process.argv.slice(2)) {
  const reportIndex = argv.indexOf('--report');
  const reportPath = reportIndex >= 0 ? argv[reportIndex + 1] : null;
  const appUrl = process.env.CLEARPATH_APP_URL;
  const healthUrl = process.env.CLEARPATH_HEALTH_URL;
  if (!appUrl || !healthUrl) throw new Error('CLEARPATH_APP_URL and CLEARPATH_HEALTH_URL are required.');

  const [appResponse, healthResponse] = await Promise.all([
    fetch(appUrl, { redirect: 'follow' }),
    fetch(healthUrl, { headers: process.env.CLEARPATH_HEALTH_ANON_KEY ? { apikey: process.env.CLEARPATH_HEALTH_ANON_KEY } : {} }),
  ]);
  const appBody = await appResponse.text();
  let healthBody = {};
  try { healthBody = await healthResponse.json(); } catch { healthBody = {}; }
  const blockers = [
    ...validateAppResponse(appResponse.status, appBody),
    ...validateHealthResponse(healthResponse.status, healthBody),
  ];
  const report = {
    ok: blockers.length === 0,
    checkedAt: new Date().toISOString(),
    app: { url: appUrl, status: appResponse.status },
    health: { url: healthUrl, status: healthResponse.status, database: healthBody?.checks?.database || 'unknown' },
    blockers,
  };
  const output = `${JSON.stringify(report, null, 2)}\n`;
  if (reportPath) await writeFile(resolve(reportPath), output, { mode: 0o600 });
  process.stdout.write(output);
  if (!report.ok) process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
