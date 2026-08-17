import { execFile } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join, parse, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { signMigrationReport } from '../migration/report-integrity.mjs';

const execFileAsync = promisify(execFile);
const GIT_COMMIT_PATTERN = /^[0-9a-f]{40}$/;
const PROJECT_REF_PATTERN = /^[a-z0-9]{20}$/;
const VERCEL_CLI_PACKAGE = 'vercel@59.1.3';

class EvidenceError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

async function defaultRunCommand(command, args, options = {}) {
  return execFileAsync(command, args, {
    cwd: options.cwd,
    env: options.env || process.env,
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
  });
}

function blocker(code, message) {
  return { code, message };
}

function baseReport(environment, checkedAt) {
  return {
    schemaVersion: 1,
    artifactType: 'clearpath-release-evidence',
    checkedAt,
    environment,
    canonicalCommit: null,
    deployment: null,
    release: null,
    ok: false,
    blockers: [],
  };
}

export function parseReleaseEvidenceArgs(argv) {
  const result = { environment: 'production', reportPath: null };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--preview') {
      result.environment = 'preview';
      continue;
    }
    if (argument === 'preview' || argument === '--environment') {
      throw new EvidenceError('PREVIEW_FLAG_REQUIRED', 'Preview inspection requires the explicit --preview flag.');
    }
    if (argument === '--report') {
      const value = argv[++index];
      if (!value || value.startsWith('--')) {
        throw new EvidenceError('INVALID_ARGUMENTS', '--report requires a file path.');
      }
      result.reportPath = value;
      continue;
    }
    throw new EvidenceError('INVALID_ARGUMENTS', 'Unknown option. Preview inspection requires the explicit --preview flag.');
  }
  return result;
}

async function readProjectFile(startDirectory) {
  let directory = resolve(startDirectory);
  const root = parse(directory).root;
  while (true) {
    const projectPath = join(directory, '.vercel', 'project.json');
    try {
      const value = JSON.parse(await readFile(projectPath, 'utf8'));
      return { ...value, cliCwd: directory };
    } catch (error) {
      if (error?.code !== 'ENOENT') {
        throw new EvidenceError('PROJECT_BINDING_INVALID', 'The Vercel project binding is invalid.');
      }
    }
    if (directory === root) break;
    directory = dirname(directory);
  }
  return null;
}

async function resolveProject({ cwd, env, project }) {
  const value = project || (
    env.VERCEL_PROJECT_ID && env.VERCEL_PROJECT_NAME
      ? {
          projectId: env.VERCEL_PROJECT_ID,
          projectName: env.VERCEL_PROJECT_NAME,
          orgId: env.VERCEL_ORG_ID || null,
          cliCwd: cwd,
        }
      : await readProjectFile(cwd)
  );
  if (!value?.projectId || !value?.projectName) {
    throw new EvidenceError(
      'PROJECT_BINDING_MISSING',
      'A Vercel project binding or VERCEL_PROJECT_ID and VERCEL_PROJECT_NAME is required.',
    );
  }
  return {
    projectId: value.projectId,
    projectName: value.projectName,
    orgId: value.orgId || null,
    cliCwd: value.cliCwd || cwd,
  };
}

function parseJson(value, code, message) {
  try {
    return JSON.parse(value);
  } catch {
    throw new EvidenceError(code, message);
  }
}

function deploymentEnvironment(value) {
  if (typeof value.environment === 'string') return value.environment.toLowerCase();
  if (typeof value.target === 'string') return value.target.toLowerCase();
  if (value.target === null) return 'preview';
  return null;
}

function gitBinding(value) {
  if (value.gitSource?.sha) {
    return value.gitSource.sha;
  }
  for (const key of ['githubCommitSha', 'gitlabCommitSha', 'bitbucketCommitSha', 'gitCommitSha']) {
    if (value.meta?.[key]) return value.meta[key];
  }
  return null;
}

function normalizeDeployment(value) {
  let url = value.url;
  if (url && !/^https?:\/\//i.test(url)) url = `https://${url}`;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password) url = null;
    else url = parsed.origin;
  } catch {
    url = null;
  }
  return {
    id: value.uid || value.id || null,
    url,
    projectId: value.projectId || value.project?.id || null,
    projectName: value.name || value.project?.name || null,
    status: value.readyState || value.state || null,
    source: value.source === 'git' ? 'git' : null,
    gitSha: gitBinding(value),
  };
}

function normalizeRelease(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return {
    schemaVersion: value.schemaVersion,
    commit: typeof value.commit === 'string' ? value.commit : null,
    demoMode: typeof value.demoMode === 'boolean' ? value.demoMode : null,
    authBypass: typeof value.authBypass === 'boolean' ? value.authBypass : null,
    projectRef: typeof value.projectRef === 'string' ? value.projectRef : null,
  };
}

function deploymentApiPath(project, environment) {
  const query = new URLSearchParams({
    projectId: project.projectId,
    target: environment,
    limit: '100',
  });
  if (project.orgId) query.set('teamId', project.orgId);
  return `/v6/deployments?${query.toString()}`;
}

function latestForEnvironment(deployments, environment) {
  return deployments
    .filter((deployment) => deploymentEnvironment(deployment) === environment)
    .sort((left, right) => Number(right.createdAt || right.created || 0) - Number(left.createdAt || left.created || 0))[0] || null;
}

async function runGit(runCommand, args, { cwd, env }, code, message) {
  try {
    return await runCommand('git', args, { cwd, env });
  } catch {
    throw new EvidenceError(code, message);
  }
}

async function lookupDeployment(runCommand, project, environment, env) {
  try {
    const result = await runCommand('npx', [
      '--yes',
      VERCEL_CLI_PACKAGE,
      'api',
      deploymentApiPath(project, environment),
      '--no-color',
    ], { cwd: project.cliCwd, env });
    const body = parseJson(result.stdout, 'VERCEL_LOOKUP_FAILED', 'Vercel deployment lookup failed.');
    if (!Array.isArray(body.deployments)) {
      throw new EvidenceError('VERCEL_LOOKUP_FAILED', 'Vercel deployment lookup failed.');
    }
    return body.deployments;
  } catch (error) {
    if (error instanceof EvidenceError) throw error;
    throw new EvidenceError('VERCEL_LOOKUP_FAILED', 'Vercel deployment lookup failed.');
  }
}

async function fetchRelease(runCommand, project, deploymentUrl, env) {
  const args = [
    '--yes',
    VERCEL_CLI_PACKAGE,
    'curl',
    '/clearpath-release.json',
    '--deployment',
    deploymentUrl,
  ];
  if (project.orgId) args.push('--scope', project.orgId);
  try {
    const result = await runCommand('npx', args, { cwd: project.cliCwd, env });
    return parseJson(result.stdout, 'RELEASE_FETCH_FAILED', 'The deployed release metadata could not be read.');
  } catch (error) {
    if (error instanceof EvidenceError) throw error;
    throw new EvidenceError('RELEASE_FETCH_FAILED', 'The deployed release metadata could not be read.');
  }
}

function addError(report, error) {
  const safe = error instanceof EvidenceError
    ? blocker(error.code, error.message)
    : blocker('RELEASE_EVIDENCE_FAILED', 'Release evidence collection failed.');
  report.blockers.push(safe);
  return report;
}

export async function collectReleaseEvidence({
  argv = [],
  cwd = process.cwd(),
  env = process.env,
  now = () => new Date(),
  project,
  runCommand = defaultRunCommand,
} = {}) {
  const options = parseReleaseEvidenceArgs(argv);
  const report = baseReport(options.environment, now().toISOString());

  let head;
  try {
    const result = await runGit(
      runCommand,
      ['rev-parse', 'HEAD'],
      { cwd, env },
      'GIT_HEAD_UNAVAILABLE',
      'The current Git commit could not be determined.',
    );
    head = result.stdout.trim();
    if (!GIT_COMMIT_PATTERN.test(head)) {
      throw new EvidenceError('GIT_HEAD_INVALID', 'Git HEAD is not an exact 40-character commit.');
    }
    report.canonicalCommit = head;

    const status = await runGit(
      runCommand,
      ['status', '--porcelain'],
      { cwd, env },
      'GIT_STATUS_UNAVAILABLE',
      'The Git worktree status could not be determined.',
    );
    if (status.stdout.trim()) {
      throw new EvidenceError(
        'DIRTY_WORKTREE',
        'The Git worktree must be clean before release evidence is collected.',
      );
    }
  } catch (error) {
    return addError(report, error);
  }

  let binding;
  try {
    binding = await resolveProject({ cwd, env, project });
    const deployments = await lookupDeployment(runCommand, binding, options.environment, env);
    const selected = latestForEnvironment(deployments, options.environment);
    if (!selected) {
      throw new EvidenceError(
        'DEPLOYMENT_NOT_FOUND',
        `No ${options.environment} Vercel deployment was found for the bound project.`,
      );
    }
    report.deployment = normalizeDeployment(selected);

    if (report.deployment.projectId !== binding.projectId
      || report.deployment.projectName !== binding.projectName
      || !report.deployment.id
      || !report.deployment.url) {
      throw new EvidenceError(
        'DEPLOYMENT_BINDING_INVALID',
        'The selected Vercel deployment is missing required project or Git binding metadata.',
      );
    }
    if (report.deployment.source !== 'git') {
      throw new EvidenceError(
        'DEPLOYMENT_SOURCE_NOT_GIT',
        'The selected Vercel deployment was not created from Git.',
      );
    }
    if (!GIT_COMMIT_PATTERN.test(report.deployment.gitSha || '')) {
      throw new EvidenceError(
        'DEPLOYMENT_GIT_SHA_INVALID',
        'The selected Git deployment is missing an exact full commit SHA.',
      );
    }
    if (report.deployment.gitSha !== head) {
      throw new EvidenceError(
        'DEPLOYMENT_COMMIT_MISMATCH',
        'The selected Vercel deployment does not match the current Git commit.',
      );
    }
    if (report.deployment.status !== 'READY') {
      throw new EvidenceError('DEPLOYMENT_NOT_READY', 'The selected Vercel deployment is not READY.');
    }
  } catch (error) {
    return addError(report, error);
  }

  try {
    const rawRelease = await fetchRelease(runCommand, binding, report.deployment.url, env);
    report.release = normalizeRelease(rawRelease);
    if (report.release?.schemaVersion !== 1
      || report.release.commit !== head
      || report.release.commit !== report.deployment.gitSha
      || typeof report.release.demoMode !== 'boolean'
      || typeof report.release.authBypass !== 'boolean'
      || !PROJECT_REF_PATTERN.test(report.release.projectRef || '')) {
      throw new EvidenceError(
        'RELEASE_MISMATCH',
        'The deployed release metadata does not match the selected deployment.',
      );
    }
  } catch (error) {
    return addError(report, error);
  }

  report.ok = true;
  return report;
}

async function writeReport(report, reportPath) {
  const output = `${JSON.stringify(report, null, 2)}\n`;
  if (reportPath) await writeFile(resolve(reportPath), output, { mode: 0o600 });
  process.stdout.write(output);
}

async function main(argv = process.argv.slice(2)) {
  let options;
  let report;
  try {
    options = parseReleaseEvidenceArgs(argv);
    report = await collectReleaseEvidence({ argv });
  } catch (error) {
    const environment = argv.includes('--preview') ? 'preview' : 'production';
    report = addError(baseReport(environment, new Date().toISOString()), error);
  }
  const signingKey = process.env.CLEARPATH_EVIDENCE_SIGNING_KEY;
  if (!signingKey) {
    report = addError(report, new EvidenceError(
      'EVIDENCE_SIGNING_KEY_MISSING',
      'CLEARPATH_EVIDENCE_SIGNING_KEY is required to issue release evidence.',
    ));
  } else {
    report = signMigrationReport(report, signingKey);
  }
  await writeReport(report, options?.reportPath);
  if (!report.ok) process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(() => {
    process.stderr.write('Release evidence collection failed.\n');
    process.exitCode = 1;
  });
}
