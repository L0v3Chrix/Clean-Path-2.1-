import { logStep, parseArgs } from './runtime.mjs';

const defaultRoutes = [
  '/',
  '/residents',
  '/intake',
  '/incidents',
  '/secure-docs',
  '/compliance',
  '/training',
  '/bed-capacity',
  '/inventory',
  '/staff',
  '/locations',
  '/integrations',
];

function joinUrl(baseUrl, route) {
  return new URL(route, baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`).toString();
}

async function assertRouteResponds(baseUrl, route) {
  const url = joinUrl(baseUrl, route);
  const response = await fetch(url, { redirect: 'manual' });
  if (!response.ok) {
    throw new Error(`${route} returned HTTP ${response.status}`);
  }
  const html = await response.text();
  if (!html.includes('<div id="root">')) {
    throw new Error(`${route} did not return the Vite app shell.`);
  }
}

async function main() {
  const args = parseArgs();
  const baseUrl = args.url || process.env.SAMPLE_UI_BASE_URL || 'http://localhost:5173';
  const routes = args.routes ? String(args.routes).split(',') : defaultRoutes;

  for (const route of routes) {
    await assertRouteResponds(baseUrl, route.trim());
    logStep(`UI route responded: ${route.trim()}`);
  }

  logStep('Sample UI smoke check complete.');
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
