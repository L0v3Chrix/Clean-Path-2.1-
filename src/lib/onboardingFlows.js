import { canAccessRoute } from './routeAccess';

export const ONBOARDING_FLOW_VERSION = 1;

export const CANONICAL_ONBOARDING_ROLES = Object.freeze([
  'owner',
  'admin',
  'director',
  'house_manager',
  'case_manager',
  'peer_support',
  'staff',
  'resident',
]);

const LEADERSHIP_STEPS = [
  {
    id: 'organization-profile',
    title: 'Review the organization profile',
    action: 'Confirm organization details, shared house rules, and intake preferences.',
    route: '/settings',
  },
  {
    id: 'six-house-structure',
    title: 'Confirm all six houses',
    action: 'Review each property, its active status, and the details staff rely on.',
    route: '/locations',
  },
  {
    id: 'bed-structure',
    title: 'Check rooms and beds',
    action: 'Verify the bed structure and capacity across the six-house portfolio.',
    route: '/bed-capacity',
  },
  {
    id: 'team-access-review',
    title: 'Invite and place the team',
    action: 'Review each invitation, role, and house assignment before access is used.',
    route: '/staff',
  },
  {
    id: 'safety-workflows',
    title: 'Walk through incident response',
    action: 'Confirm how the team records, escalates, and follows up on safety events.',
    route: '/incidents',
  },
  {
    id: 'compliance-review',
    title: 'Review core safeguards',
    action: 'Check compliance responsibilities and the evidence used to support them.',
    route: '/compliance',
  },
  {
    id: 'audit-review',
    title: 'Complete an operating review',
    action: 'Use reports to review activity, spot gaps, and document follow-up work.',
    route: '/reports',
  },
];

const FLOW_DEFINITIONS = {
  owner: {
    title: 'Owner setup and safety review',
    description: 'Prepare the organization, six houses, team access, and review cadence.',
    steps: LEADERSHIP_STEPS,
  },
  admin: {
    title: 'Administrator setup and safety review',
    description: 'Prepare the organization, six houses, team access, and review cadence.',
    steps: LEADERSHIP_STEPS,
  },
  director: {
    title: 'Director operations guide',
    description: 'Orient to capacity, team coordination, safety oversight, and reporting.',
    steps: [
      {
        id: 'operations-overview',
        title: 'Start with the operating picture',
        action: 'Review current occupancy, resident activity, and items needing attention.',
        route: '/',
      },
      {
        id: 'capacity-review',
        title: 'Review house capacity',
        action: 'Check available beds and capacity pressure across active houses.',
        route: '/bed-capacity',
      },
      {
        id: 'team-coordination',
        title: 'Coordinate staff coverage',
        action: 'Review staff roles and house assignments before planning coverage.',
        route: '/staff',
      },
      {
        id: 'safety-trends',
        title: 'Monitor safety trends',
        action: 'Review incident patterns and follow-up areas across the organization.',
        route: '/incident-safety',
      },
      {
        id: 'report-review',
        title: 'Close the review loop',
        action: 'Use reports to identify gaps and assign the next operational review.',
        route: '/reports',
      },
    ],
  },
  house_manager: {
    title: 'House manager daily guide',
    description: 'Focus on the roster, daily rhythm, communication, and incident response.',
    steps: [
      {
        id: 'house-overview',
        title: 'Review today at a glance',
        action: 'Check current house activity and the items that need follow-up today.',
        route: '/',
      },
      {
        id: 'resident-roster',
        title: 'Confirm the house roster',
        action: 'Review current residents and the records needed for daily operations.',
        route: '/masterlist',
      },
      {
        id: 'daily-schedule',
        title: 'Review the daily schedule',
        action: 'Check coverage, appointments, and scheduled responsibilities.',
        route: '/scheduling',
      },
      {
        id: 'chore-operations',
        title: 'Coordinate house chores',
        action: 'Review assignments and follow up on unfinished house responsibilities.',
        route: '/chores',
      },
      {
        id: 'incident-response',
        title: 'Practice incident response',
        action: 'Review how to record an event and coordinate the required follow-up.',
        route: '/incidents',
      },
      {
        id: 'house-communication',
        title: 'Keep communication current',
        action: 'Use community chat for timely, role-appropriate house coordination.',
        route: '/chat',
      },
    ],
  },
  case_manager: {
    title: 'Case manager care guide',
    description: 'Focus on resident records, care coordination, incidents, and documents.',
    steps: [
      {
        id: 'caseload-overview',
        title: 'Review your care overview',
        action: 'Start with resident activity and the follow-up items needing attention.',
        route: '/',
      },
      {
        id: 'resident-records',
        title: 'Review resident records',
        action: 'Open the resident list and locate the record needed for coordinated care.',
        route: '/residents',
      },
      {
        id: 'incident-coordination',
        title: 'Coordinate incident follow-up',
        action: 'Review reported events and the next documented care action.',
        route: '/incidents',
      },
      {
        id: 'care-team-chat',
        title: 'Connect with the care team',
        action: 'Use chat for timely coordination within your assigned responsibilities.',
        route: '/chat',
      },
      {
        id: 'secure-documents',
        title: 'Find secure documents',
        action: 'Review the protected documents available for authorized care work.',
        route: '/secure-docs',
      },
    ],
  },
  peer_support: {
    title: 'Peer support guide',
    description: 'Focus on resident support, communication, and role-specific learning.',
    steps: [
      {
        id: 'support-overview',
        title: 'Start with today\'s overview',
        action: 'Review the resident support items that need attention today.',
        route: '/',
      },
      {
        id: 'resident-support',
        title: 'Find resident context',
        action: 'Open the resident list for the context available to your role.',
        route: '/residents',
      },
      {
        id: 'support-chat',
        title: 'Join support conversations',
        action: 'Use community chat for timely, respectful support coordination.',
        route: '/chat',
      },
      {
        id: 'training-resources',
        title: 'Continue role training',
        action: 'Review training resources relevant to peer support responsibilities.',
        route: '/training',
      },
    ],
  },
  staff: {
    title: 'Staff essentials guide',
    description: 'Focus on resident support, team communication, documents, and training.',
    steps: [
      {
        id: 'staff-overview',
        title: 'Start with today\'s overview',
        action: 'Review resident activity and the work items needing attention today.',
        route: '/',
      },
      {
        id: 'resident-support',
        title: 'Find resident context',
        action: 'Open the resident list for the information available to your role.',
        route: '/residents',
      },
      {
        id: 'staff-chat',
        title: 'Coordinate with the team',
        action: 'Use community chat for timely, role-appropriate coordination.',
        route: '/chat',
      },
      {
        id: 'secure-documents',
        title: 'Find secure documents',
        action: 'Review the protected documents available for authorized work.',
        route: '/secure-docs',
      },
      {
        id: 'staff-training',
        title: 'Continue staff training',
        action: 'Review training resources relevant to your assigned responsibilities.',
        route: '/training',
      },
    ],
  },
  resident: {
    title: 'Resident essentials guide',
    description: 'Find your daily responsibilities, conversations, reflections, and documents.',
    steps: [
      {
        id: 'profile-home',
        title: 'Meet your profile home',
        action: 'Review your house details, progress, schedule, and personal resources.',
        route: '/my-profile',
      },
      {
        id: 'my-chores',
        title: 'Check your chores',
        action: 'Find your current assignments and mark completed chores from your profile.',
        route: '/my-profile',
      },
      {
        id: 'community-chat',
        title: 'Open community chat',
        action: 'Read and participate in the conversations available to you.',
        route: '/chat',
      },
      {
        id: 'morning-reflection',
        title: 'Complete a reflection',
        action: 'Use the morning reflection on your profile to check in for the day.',
        route: '/my-profile',
      },
      {
        id: 'signature-requests',
        title: 'Review signature requests',
        action: 'Open pending documents on your profile and complete your signature when ready.',
        route: '/my-profile',
      },
    ],
  },
};

const VALID_PROGRESS_STATUSES = new Set(['active', 'dismissed', 'completed']);

function createInitialProgress(flow) {
  return {
    flowId: flow.id,
    version: flow.version,
    currentStepId: flow.steps[0].id,
    completedStepIds: [],
    status: 'active',
  };
}

function orderCompletedStepIds(flow, completedStepIds) {
  const completed = new Set(Array.isArray(completedStepIds) ? completedStepIds : []);
  return flow.steps.map((step) => step.id).filter((stepId) => completed.has(stepId));
}

export function deriveOnboardingFlow(role) {
  if (!Object.hasOwn(FLOW_DEFINITIONS, role)) return null;

  const definition = FLOW_DEFINITIONS[role];

  if (definition.steps.some((step) => !canAccessRoute(role, step.route))) {
    return null;
  }

  return {
    id: `clearpath-onboarding-${role}-v${ONBOARDING_FLOW_VERSION}`,
    version: ONBOARDING_FLOW_VERSION,
    role,
    title: definition.title,
    description: definition.description,
    steps: definition.steps.map((step) => ({ ...step })),
  };
}

export function normalizeOnboardingProgress(role, persistedProgress) {
  const flow = deriveOnboardingFlow(role);
  if (!flow) return null;

  if (
    !persistedProgress
    || typeof persistedProgress !== 'object'
    || Array.isArray(persistedProgress)
    || (persistedProgress.flowId ?? persistedProgress.flow) !== flow.id
    || persistedProgress.version !== flow.version
  ) {
    return createInitialProgress(flow);
  }

  const stepIds = new Set(flow.steps.map((step) => step.id));
  const persistedStatus = ['pending', 'in_progress'].includes(persistedProgress.status)
    ? 'active'
    : persistedProgress.status;
  const status = VALID_PROGRESS_STATUSES.has(persistedStatus)
    ? persistedStatus
    : 'active';
  const currentStepId = persistedProgress.currentStepId ?? persistedProgress.current_step;
  const completedStepIds = persistedProgress.completedStepIds ?? persistedProgress.completed_steps;

  if (status === 'completed') {
    return {
      flowId: flow.id,
      version: flow.version,
      currentStepId: flow.steps.at(-1).id,
      completedStepIds: flow.steps.map((step) => step.id),
      status,
    };
  }

  return {
    flowId: flow.id,
    version: flow.version,
    currentStepId: stepIds.has(currentStepId)
      ? currentStepId
      : flow.steps[0].id,
    completedStepIds: orderCompletedStepIds(flow, completedStepIds),
    status,
  };
}

export function advanceOnboardingProgress(role, progress) {
  const flow = deriveOnboardingFlow(role);
  const normalized = normalizeOnboardingProgress(role, progress);
  if (!flow || !normalized || normalized.status !== 'active') return normalized;

  const currentIndex = flow.steps.findIndex((step) => step.id === normalized.currentStepId);
  const nextIndex = Math.min(currentIndex + 1, flow.steps.length - 1);

  return {
    ...normalized,
    currentStepId: flow.steps[nextIndex].id,
    completedStepIds: orderCompletedStepIds(flow, [
      ...normalized.completedStepIds,
      normalized.currentStepId,
    ]),
  };
}

export function backOnboardingProgress(role, progress) {
  const flow = deriveOnboardingFlow(role);
  const normalized = normalizeOnboardingProgress(role, progress);
  if (!flow || !normalized || normalized.status !== 'active') return normalized;

  const currentIndex = flow.steps.findIndex((step) => step.id === normalized.currentStepId);
  const previousIndex = Math.max(currentIndex - 1, 0);

  return {
    ...normalized,
    currentStepId: flow.steps[previousIndex].id,
  };
}

export function completeOnboardingProgress(role, progress) {
  const flow = deriveOnboardingFlow(role);
  const normalized = normalizeOnboardingProgress(role, progress);
  if (!flow || !normalized) return null;

  return {
    ...normalized,
    currentStepId: flow.steps.at(-1).id,
    completedStepIds: flow.steps.map((step) => step.id),
    status: 'completed',
  };
}

export function dismissOnboardingProgress(role, progress) {
  const normalized = normalizeOnboardingProgress(role, progress);
  if (!normalized || normalized.status === 'completed') return normalized;

  return {
    ...normalized,
    status: 'dismissed',
  };
}

export function resumeOnboardingProgress(role, progress) {
  const normalized = normalizeOnboardingProgress(role, progress);
  if (!normalized || normalized.status !== 'dismissed') return normalized;

  return {
    ...normalized,
    status: 'active',
  };
}

export function replayOnboardingProgress(role) {
  const flow = deriveOnboardingFlow(role);
  return flow ? createInitialProgress(flow) : null;
}
