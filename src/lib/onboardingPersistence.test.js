import { describe, expect, it } from 'vitest';

import { fromOnboardingRow, toOnboardingSaveInput } from './onboardingPersistence';

describe('onboarding persistence adapter', () => {
  it('maps a database row into the role-flow state shape', () => {
    expect(fromOnboardingRow({
      flow: 'clearpath-onboarding-admin-v1',
      version: 1,
      current_step: 'team-access-review',
      completed_steps: ['organization-profile'],
      status: 'in_progress',
    })).toEqual({
      flowId: 'clearpath-onboarding-admin-v1',
      version: 1,
      currentStepId: 'team-access-review',
      completedStepIds: ['organization-profile'],
      status: 'active',
    });
    expect(fromOnboardingRow(null)).toBeNull();
  });

  it('maps guide state to the self-scoped service contract', () => {
    expect(toOnboardingSaveInput({
      organizationId: 'organization-1',
      userId: 'user-1',
      progress: {
        flowId: 'clearpath-onboarding-resident-v1',
        version: 1,
        currentStepId: 'my-chores',
        completedStepIds: ['profile-home'],
        status: 'active',
        ignoredRole: 'owner',
      },
    })).toEqual({
      organizationId: 'organization-1',
      userId: 'user-1',
      flow: 'clearpath-onboarding-resident-v1',
      version: 1,
      currentStep: 'my-chores',
      completedSteps: ['profile-home'],
      status: 'in_progress',
    });
  });
});
