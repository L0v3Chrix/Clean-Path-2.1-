import { describe, expect, it } from 'vitest';
import { canAccessRoute } from './routeAccess';
import {
  CANONICAL_ONBOARDING_ROLES,
  ONBOARDING_FLOW_VERSION,
  advanceOnboardingProgress,
  backOnboardingProgress,
  completeOnboardingProgress,
  deriveOnboardingFlow,
  dismissOnboardingProgress,
  normalizeOnboardingProgress,
  replayOnboardingProgress,
  resumeOnboardingProgress,
} from './onboardingFlows';

const EXPECTED_STEP_IDS = {
  owner: [
    'organization-profile',
    'six-house-structure',
    'bed-structure',
    'team-access-review',
    'safety-workflows',
    'compliance-review',
    'audit-review',
  ],
  admin: [
    'organization-profile',
    'six-house-structure',
    'bed-structure',
    'team-access-review',
    'safety-workflows',
    'compliance-review',
    'audit-review',
  ],
  director: [
    'operations-overview',
    'capacity-review',
    'team-coordination',
    'safety-trends',
    'report-review',
  ],
  house_manager: [
    'house-overview',
    'resident-roster',
    'daily-schedule',
    'chore-operations',
    'incident-response',
    'house-communication',
  ],
  case_manager: [
    'caseload-overview',
    'resident-records',
    'incident-coordination',
    'care-team-chat',
    'secure-documents',
  ],
  peer_support: [
    'support-overview',
    'resident-support',
    'support-chat',
    'training-resources',
  ],
  staff: [
    'staff-overview',
    'resident-support',
    'staff-chat',
    'secure-documents',
    'staff-training',
  ],
  resident: [
    'profile-home',
    'my-chores',
    'community-chat',
    'morning-reflection',
    'signature-requests',
  ],
};

describe('role-specific onboarding flows', () => {
  it('defines one versioned flow with stable steps for every canonical role', () => {
    expect(CANONICAL_ONBOARDING_ROLES).toEqual([
      'owner',
      'admin',
      'director',
      'house_manager',
      'case_manager',
      'peer_support',
      'staff',
      'resident',
    ]);

    for (const role of CANONICAL_ONBOARDING_ROLES) {
      const flow = deriveOnboardingFlow(role);

      expect(flow.id).toBe(`clearpath-onboarding-${role}-v${ONBOARDING_FLOW_VERSION}`);
      expect(flow.version).toBe(ONBOARDING_FLOW_VERSION);
      expect(flow.role).toBe(role);
      expect(flow.steps.map((step) => step.id)).toEqual(EXPECTED_STEP_IDS[role]);
      expect(new Set(flow.steps.map((step) => step.id)).size).toBe(flow.steps.length);

      for (const step of flow.steps) {
        expect(step.title.trim()).not.toBe('');
        expect(step.action.trim()).not.toBe('');
        expect(step.route).toMatch(/^\//);
      }
    }
  });

  it('authorizes every target route through the existing route policy', () => {
    for (const role of CANONICAL_ONBOARDING_ROLES) {
      const flow = deriveOnboardingFlow(role);

      for (const step of flow.steps) {
        expect(canAccessRoute(role, step.route), `${role} cannot access ${step.route}`).toBe(true);
      }
    }
  });

  it('keeps resident guidance on resident-facing surfaces only', () => {
    const flow = deriveOnboardingFlow('resident');

    expect(flow.steps.map(({ id, route }) => [id, route])).toEqual([
      ['profile-home', '/my-profile'],
      ['my-chores', '/my-profile'],
      ['community-chat', '/chat'],
      ['morning-reflection', '/my-profile'],
      ['signature-requests', '/my-profile'],
    ]);
    expect(flow.steps.map((step) => `${step.title} ${step.action}`).join(' '))
      .not.toMatch(/manage staff|organization settings|resident directory|incident report/i);
  });

  it('fails closed for roles without a canonical onboarding flow', () => {
    for (const role of [
      'platform_admin',
      'assistant_manager',
      'user',
      '',
      null,
      'unexpected-role',
      '__proto__',
      'constructor',
      'toString',
    ]) {
      expect(deriveOnboardingFlow(role)).toBeNull();
      expect(normalizeOnboardingProgress(role, {})).toBeNull();
      expect(advanceOnboardingProgress(role, {})).toBeNull();
      expect(backOnboardingProgress(role, {})).toBeNull();
      expect(completeOnboardingProgress(role, {})).toBeNull();
      expect(dismissOnboardingProgress(role, {})).toBeNull();
      expect(replayOnboardingProgress(role)).toBeNull();
    }
  });
});

describe('onboarding progress', () => {
  it('resets progress from an older flow version', () => {
    const flow = deriveOnboardingFlow('owner');
    const stale = {
      flowId: 'clearpath-onboarding-owner-v0',
      version: 0,
      currentStepId: 'audit-review',
      completedStepIds: flow.steps.map((step) => step.id),
      status: 'completed',
    };

    expect(normalizeOnboardingProgress('owner', stale)).toEqual({
      flowId: flow.id,
      version: ONBOARDING_FLOW_VERSION,
      currentStepId: 'organization-profile',
      completedStepIds: [],
      status: 'active',
    });
  });

  it('normalizes forged progress without expanding the role flow', () => {
    const staffFlow = deriveOnboardingFlow('staff');
    const forgedOwnerProgress = {
      flowId: 'clearpath-onboarding-owner-v1',
      version: ONBOARDING_FLOW_VERSION,
      currentStepId: 'organization-profile',
      completedStepIds: ['organization-profile', 'audit-review'],
      status: 'active',
    };

    const normalized = normalizeOnboardingProgress('staff', forgedOwnerProgress);

    expect(normalized).toEqual({
      flowId: staffFlow.id,
      version: ONBOARDING_FLOW_VERSION,
      currentStepId: 'staff-overview',
      completedStepIds: [],
      status: 'active',
    });
    expect(staffFlow.steps.some((step) => step.route === '/settings')).toBe(false);
    expect(staffFlow.steps.some((step) => step.route === '/finance')).toBe(false);
  });

  it('filters unknown step ids and invalid status from otherwise current progress', () => {
    const flow = deriveOnboardingFlow('case_manager');

    expect(normalizeOnboardingProgress('case_manager', {
      flowId: flow.id,
      version: flow.version,
      currentStepId: 'owner-settings',
      completedStepIds: ['resident-records', 'owner-settings', 'resident-records'],
      status: 'elevated',
    })).toEqual({
      flowId: flow.id,
      version: flow.version,
      currentStepId: 'caseload-overview',
      completedStepIds: ['resident-records'],
      status: 'active',
    });
  });

  it('normalizes database-shaped persisted progress into the canonical client shape', () => {
    const flow = deriveOnboardingFlow('director');

    expect(normalizeOnboardingProgress('director', {
      flow: flow.id,
      version: flow.version,
      current_step: 'team-coordination',
      completed_steps: ['operations-overview', 'capacity-review'],
      status: 'in_progress',
    })).toEqual({
      flowId: flow.id,
      version: flow.version,
      currentStepId: 'team-coordination',
      completedStepIds: ['operations-overview', 'capacity-review'],
      status: 'active',
    });
  });

  it('advances, goes back, pauses, completes, and replays without mutating input', () => {
    const flow = deriveOnboardingFlow('resident');
    const initial = normalizeOnboardingProgress('resident', null);

    const advanced = advanceOnboardingProgress('resident', initial);
    expect(advanced).toEqual({
      ...initial,
      currentStepId: 'my-chores',
      completedStepIds: ['profile-home'],
    });
    expect(initial.completedStepIds).toEqual([]);

    expect(backOnboardingProgress('resident', advanced)).toEqual({
      ...advanced,
      currentStepId: 'profile-home',
    });
    expect(dismissOnboardingProgress('resident', advanced)).toEqual({
      ...advanced,
      status: 'dismissed',
    });
    expect(completeOnboardingProgress('resident', advanced)).toEqual({
      flowId: flow.id,
      version: flow.version,
      currentStepId: 'signature-requests',
      completedStepIds: flow.steps.map((step) => step.id),
      status: 'completed',
    });
    expect(replayOnboardingProgress('resident', advanced)).toEqual(initial);
  });

  it('resumes dismissed progress at the saved step without mutating it', () => {
    const flow = deriveOnboardingFlow('resident');
    const dismissed = {
      flowId: flow.id,
      version: flow.version,
      currentStepId: 'community-chat',
      completedStepIds: ['profile-home', 'my-chores'],
      status: 'dismissed',
    };

    expect(resumeOnboardingProgress('resident', dismissed)).toEqual({
      ...dismissed,
      status: 'active',
    });
    expect(dismissed.status).toBe('dismissed');
  });

  it('does not resume completed progress', () => {
    const completed = completeOnboardingProgress(
      'resident',
      normalizeOnboardingProgress('resident', null),
    );

    expect(resumeOnboardingProgress('resident', completed)).toEqual(completed);
  });

  it('replays dismissed progress from the first step', () => {
    const flow = deriveOnboardingFlow('resident');

    expect(replayOnboardingProgress('resident')).toEqual({
      flowId: flow.id,
      version: flow.version,
      currentStepId: 'profile-home',
      completedStepIds: [],
      status: 'active',
    });
  });

  it('clamps navigation at the first and last steps', () => {
    const flow = deriveOnboardingFlow('peer_support');
    const initial = normalizeOnboardingProgress('peer_support', null);
    const lastActive = {
      flowId: flow.id,
      version: flow.version,
      currentStepId: 'training-resources',
      completedStepIds: flow.steps.slice(0, -1).map((step) => step.id),
      status: 'active',
    };

    expect(backOnboardingProgress('peer_support', initial)).toEqual(initial);
    expect(advanceOnboardingProgress('peer_support', lastActive)).toEqual({
      ...lastActive,
      completedStepIds: flow.steps.map((step) => step.id),
    });
  });
});
