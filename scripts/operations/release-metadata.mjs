import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const GIT_COMMIT_PATTERN = /^[0-9a-f]{40}$/;
const SUPABASE_HOST_PATTERN = /^([a-z0-9]{20})\.supabase\.co$/;

async function defaultRunCommand(command, args, options = {}) {
  return execFileAsync(command, args, {
    cwd: options.cwd,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024,
  });
}

export function parsePublicSupabaseProjectRef(value) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('VITE_SUPABASE_URL must be a public Supabase project URL.');
  }

  const match = SUPABASE_HOST_PATTERN.exec(parsed.hostname);
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.port
    || parsed.pathname !== '/'
    || parsed.search || parsed.hash || !match) {
    throw new Error('VITE_SUPABASE_URL must be a public Supabase project URL.');
  }
  return match[1];
}

export function createReleaseMetadata({ env = {}, commit }) {
  if (!GIT_COMMIT_PATTERN.test(commit || '')) {
    throw new Error('Release metadata requires an exact lowercase 40-character Git commit.');
  }

  return {
    schemaVersion: 1,
    commit,
    demoMode: env.VITE_CLEARPATH_DEMO_MODE === 'true',
    authBypass: env.VITE_AUTH_BYPASS === 'true',
    projectRef: env.VITE_SUPABASE_URL ? parsePublicSupabaseProjectRef(env.VITE_SUPABASE_URL) : null,
  };
}

export async function resolveReleaseCommit({
  commit,
  env = {},
  cwd = process.cwd(),
  runCommand = defaultRunCommand,
} = {}) {
  const injected = commit || env.CLEARPATH_RELEASE_COMMIT || env.VERCEL_GIT_COMMIT_SHA;
  if (injected) return injected.trim();
  const result = await runCommand('git', ['rev-parse', 'HEAD'], { cwd });
  return result.stdout.trim();
}

export function releaseMetadataPlugin(options = {}) {
  return {
    name: 'clearpath-release-metadata',
    apply: 'build',
    async generateBundle() {
      const commit = await resolveReleaseCommit(options);
      const metadata = createReleaseMetadata({ env: options.env, commit });
      this.emitFile({
        type: 'asset',
        fileName: 'clearpath-release.json',
        source: `${JSON.stringify(metadata, null, 2)}\n`,
      });
    },
  };
}
