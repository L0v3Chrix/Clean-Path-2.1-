export function fromOnboardingRow(row) {
  if (!row) return null;
  return {
    flowId: row.flow,
    version: row.version,
    currentStepId: row.current_step,
    completedStepIds: row.completed_steps || [],
    status: ['pending', 'in_progress'].includes(row.status) ? 'active' : row.status,
  };
}

export function toOnboardingSaveInput({ organizationId, userId, progress }) {
  return {
    organizationId,
    userId,
    flow: progress.flowId,
    version: progress.version,
    currentStep: progress.currentStepId,
    completedSteps: progress.completedStepIds,
    status: progress.status === 'active' ? 'in_progress' : progress.status,
  };
}
