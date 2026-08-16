import { describe, expect, it } from 'vitest';

let subject = {};
try {
  subject = await import('./release-evidence.mjs');
} catch {
  // The first TDD run intentionally exercises the not-yet-created module.
}

const { collectReleaseEvidence, parseReleaseEvidenceArgs } = subject;
const COMMIT = '0123456789abcdef0123456789abcdef01234567';
const OTHER_COMMIT = 'fedcba9876543210fedcba9876543210fedcba98';
const CHECKED_AT = '2026-08-16T15:00:00.000Z';
const PROJECT = {
  projectId: 'prj_clearpath123',
  projectName: 'clearpath-rcl-mvp',
  orgId: 'team_clearpath123',
  cliCwd: '/repo',
};
const RELEASE = {
  schemaVersion: 1,
  commit: COMMIT,
  demoMode: false,
  authBypass: false,
  projectRef: 'abcdefghijklmnopqrst',
};

function requireSubject(fn) {
  expect(fn).toBeTypeOf('function');
  return typeof fn === 'function';
}

function deploymentFixture(options = {}) {
  const sha = Object.hasOwn(options, 'sha') ? options.sha : COMMIT;
  const source = Object.hasOwn(options, 'source') ? options.source : 'git';
  const status = options.status ?? 'READY';
  const target = Object.hasOwn(options, 'target') ? options.target : 'production';
  return {
    uid: 'dpl_clearpath123',
    url: 'clearpath-rcl-mvp-abc123.vercel.app',
    name: PROJECT.projectName,
    projectId: PROJECT.projectId,
    readyState: status,
    state: status,
    source,
    target,
    createdAt: 1786891200000,
    meta: {
      githubCommitSha: sha,
      githubCommitAuthorEmail: 'private-author@example.com',
      githubCommitMessage: 'private release subject',
    },
    creator: {
      uid: 'user_private',
      email: 'private-account@example.com',
    },
  };
}

function commandRunner({
  dirty = '',
  deployment = deploymentFixture(),
  release = RELEASE,
  apiError = null,
} = {}) {
  return async (command, args) => {
    if (command === 'git' && args.join(' ') === 'rev-parse HEAD') return { stdout: `${COMMIT}\n`, stderr: '' };
    if (command === 'git' && args.join(' ') === 'status --porcelain') return { stdout: dirty, stderr: '' };
    if (command === 'npx' && args.includes('api')) {
      if (apiError) throw apiError;
      return { stdout: JSON.stringify({ deployments: [deployment] }), stderr: '' };
    }
    if (command === 'npx' && args.includes('curl')) {
      return { stdout: JSON.stringify(release), stderr: '' };
    }
    throw new Error(`Unexpected command: ${command} ${args.join(' ')}`);
  };
}

async function collect(overrides = {}) {
  return collectReleaseEvidence({
    argv: [],
    cwd: '/repo/.worktrees/release-evidence',
    env: {},
    now: () => new Date(CHECKED_AT),
    project: PROJECT,
    runCommand: commandRunner(),
    ...overrides,
  });
}

describe('Vercel release evidence', () => {
  it('binds an exact READY production deployment and release artifact to full HEAD', async () => {
    if (!requireSubject(collectReleaseEvidence)) return;

    expect(await collect()).toEqual({
      schemaVersion: 1,
      artifactType: 'clearpath-release-evidence',
      checkedAt: CHECKED_AT,
      environment: 'production',
      canonicalCommit: COMMIT,
      deployment: {
        id: 'dpl_clearpath123',
        url: 'https://clearpath-rcl-mvp-abc123.vercel.app',
        projectId: PROJECT.projectId,
        projectName: PROJECT.projectName,
        status: 'READY',
        source: 'git',
        gitSha: COMMIT,
      },
      release: RELEASE,
      ok: true,
      blockers: [],
    });
  });

  it('rejects a dirty local tree before trusting deployment evidence', async () => {
    if (!requireSubject(collectReleaseEvidence)) return;

    const report = await collect({ runCommand: commandRunner({ dirty: ' M private-notes.txt\n' }) });

    expect(report.ok).toBe(false);
    expect(report.blockers).toContainEqual({
      code: 'DIRTY_WORKTREE',
      message: 'The Git worktree must be clean before release evidence is collected.',
    });
    expect(JSON.stringify(report)).not.toContain('private-notes.txt');
  });

  it('rejects a deployment whose Git SHA differs from full HEAD', async () => {
    if (!requireSubject(collectReleaseEvidence)) return;

    const report = await collect({
      runCommand: commandRunner({ deployment: deploymentFixture({ sha: OTHER_COMMIT }) }),
    });

    expect(report.ok).toBe(false);
    expect(report.blockers).toContainEqual({
      code: 'DEPLOYMENT_COMMIT_MISMATCH',
      message: 'The selected Vercel deployment does not match the current Git commit.',
    });
  });

  it.each([
    'api-trigger-git-deploy',
    'cli',
    'clone/repo',
    'drop',
    'git-deploy-hook',
    'import',
    'import/repo',
    'redeploy',
    'v0-web',
    'private-source-token',
    undefined,
  ])('rejects non-Git deployment source %s without exposing it', async (source) => {
    if (!requireSubject(collectReleaseEvidence)) return;

    const report = await collect({
      runCommand: commandRunner({ deployment: deploymentFixture({ source }) }),
    });
    const serialized = JSON.stringify(report);

    expect(report.ok).toBe(false);
    expect(report.blockers).toContainEqual({
      code: 'DEPLOYMENT_SOURCE_NOT_GIT',
      message: 'The selected Vercel deployment was not created from Git.',
    });
    expect(serialized).not.toContain('private-source-token');
  });

  it.each([undefined, null, '', COMMIT.slice(0, 39), `${COMMIT}0`, 'g'.repeat(40)])(
    'rejects a Git deployment without an exact full commit SHA',
    async (sha) => {
      if (!requireSubject(collectReleaseEvidence)) return;

      const report = await collect({
        runCommand: commandRunner({ deployment: deploymentFixture({ sha }) }),
      });

      expect(report.ok).toBe(false);
      expect(report.blockers).toContainEqual({
        code: 'DEPLOYMENT_GIT_SHA_INVALID',
        message: 'The selected Git deployment is missing an exact full commit SHA.',
      });
    },
  );

  it('rejects a matching deployment that is not READY', async () => {
    if (!requireSubject(collectReleaseEvidence)) return;

    const report = await collect({
      runCommand: commandRunner({ deployment: deploymentFixture({ status: 'BUILDING' }) }),
    });

    expect(report.ok).toBe(false);
    expect(report.blockers).toContainEqual({
      code: 'DEPLOYMENT_NOT_READY',
      message: 'The selected Vercel deployment is not READY.',
    });
  });

  it('rejects release JSON that does not match the selected deployment commit', async () => {
    if (!requireSubject(collectReleaseEvidence)) return;

    const report = await collect({
      runCommand: commandRunner({
        release: {
          ...RELEASE,
          commit: OTHER_COMMIT,
          serviceRoleKey: 'never-print-this',
        },
      }),
    });

    expect(report.ok).toBe(false);
    expect(report.blockers).toContainEqual({
      code: 'RELEASE_MISMATCH',
      message: 'The deployed release metadata does not match the selected deployment.',
    });
    expect(JSON.stringify(report)).not.toContain('never-print-this');
  });

  it('preserves true demo and auth flags in successful evidence', async () => {
    if (!requireSubject(collectReleaseEvidence)) return;

    const report = await collect({
      runCommand: commandRunner({ release: { ...RELEASE, demoMode: true, authBypass: true } }),
    });

    expect(report.ok).toBe(true);
    expect(report.release.demoMode).toBe(true);
    expect(report.release.authBypass).toBe(true);
  });

  it('defaults to production and requires the explicit --preview flag for preview', () => {
    if (!requireSubject(parseReleaseEvidenceArgs)) return;

    expect(parseReleaseEvidenceArgs([])).toMatchObject({ environment: 'production' });
    expect(parseReleaseEvidenceArgs(['--preview'])).toMatchObject({ environment: 'preview' });
    expect(() => parseReleaseEvidenceArgs(['preview'])).toThrow(/--preview/);
    expect(() => parseReleaseEvidenceArgs(['--environment', 'preview'])).toThrow(/--preview/);
  });

  it('uses preview evidence only when --preview is explicit', async () => {
    if (!requireSubject(collectReleaseEvidence)) return;

    const report = await collect({
      argv: ['--preview'],
      runCommand: commandRunner({ deployment: deploymentFixture({ target: null }) }),
    });

    expect(report.ok).toBe(true);
    expect(report.environment).toBe('preview');
  });

  it('does not forward Vercel CLI-only flags to the protected curl command', async () => {
    if (!requireSubject(collectReleaseEvidence)) return;

    const baseRunner = commandRunner();
    let curlArgs = [];
    const report = await collect({
      runCommand: async (command, args) => {
        if (command === 'npx' && args.includes('curl')) curlArgs = args;
        return baseRunner(command, args);
      },
    });

    expect(report.ok).toBe(true);
    expect(curlArgs).toContain('curl');
    expect(curlArgs).not.toContain('--no-color');
  });

  it('returns privacy-safe errors without raw Vercel metadata or account email', async () => {
    if (!requireSubject(collectReleaseEvidence)) return;

    const report = await collect({
      runCommand: commandRunner({
        apiError: new Error('private-account@example.com token=raw-secret author metadata'),
      }),
    });
    const serialized = JSON.stringify(report);

    expect(report.ok).toBe(false);
    expect(report.blockers).toContainEqual({
      code: 'VERCEL_LOOKUP_FAILED',
      message: 'Vercel deployment lookup failed.',
    });
    expect(serialized).not.toMatch(/private-account@example\.com|raw-secret|author metadata/i);
  });
});
