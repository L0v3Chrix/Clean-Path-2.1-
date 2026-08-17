import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ExternalLink,
  Pause,
  Play,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import {
  advanceOnboardingProgress,
  backOnboardingProgress,
  completeOnboardingProgress,
  deriveOnboardingFlow,
  dismissOnboardingProgress,
  normalizeOnboardingProgress,
  replayOnboardingProgress,
  resumeOnboardingProgress,
} from '@/lib/onboardingFlows';
import { cn } from '@/lib/utils';

const SECTION_LABELS = {
  '/': 'Dashboard',
  '/bed-capacity': 'Bed Capacity',
  '/chat': 'Community Chat',
  '/chores': 'Chore Management',
  '/compliance': 'NARR Compliance',
  '/incident-safety': 'Safety Trends',
  '/incidents': 'Incidents',
  '/locations': 'Locations',
  '/masterlist': 'Masterlist',
  '/my-profile': 'My Profile',
  '/reports': 'Reports',
  '/residents': 'Residents',
  '/scheduling': 'Scheduling',
  '/secure-docs': 'Secure Documents',
  '/settings': 'Organization Settings',
  '/staff': 'Staff',
  '/training': 'Training Center',
};

function formatRole(role) {
  return role.split('_').map((part) => `${part[0].toUpperCase()}${part.slice(1)}`).join(' ');
}

function StepRail({ flow, currentIndex, completedStepIds, status }) {
  const completed = new Set(completedStepIds);

  return (
    <ol className="hidden min-h-0 flex-1 space-y-1 overflow-y-auto pr-1 sm:block" aria-label="Walkthrough steps">
      {flow.steps.map((step, index) => {
        const isCurrent = status === 'active' && index === currentIndex;
        const isComplete = completed.has(step.id);

        return (
          <li
            key={step.id}
            aria-current={isCurrent ? 'step' : undefined}
            className={cn(
              'grid min-h-11 grid-cols-[1.75rem_minmax(0,1fr)] items-center gap-2 border-l-2 px-2 py-2 text-xs',
              isCurrent
                ? 'border-[#F26D2B] bg-white/10 text-white'
                : 'border-transparent text-stone-400',
            )}
          >
            <span
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded-sm border font-semibold tabular-nums',
                isComplete
                  ? 'border-[#78A47A] bg-[#456847] text-white'
                  : isCurrent
                    ? 'border-[#F26D2B] bg-[#F26D2B] text-white'
                    : 'border-stone-700 text-stone-500',
              )}
              aria-hidden="true"
            >
              {isComplete ? <Check className="h-3.5 w-3.5" /> : index + 1}
            </span>
            <span className="min-w-0 leading-4">{step.title}</span>
          </li>
        );
      })}
    </ol>
  );
}

function ActiveStep({ step, currentIndex, stepCount }) {
  const sectionLabel = SECTION_LABELS[step.route] || 'ClearPath';

  return (
    <div className="flex h-full max-w-xl flex-col justify-center py-4 sm:py-8">
      <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-sm border border-[#CFE0D0] bg-[#EEF5EE] text-[#456847]">
        <ShieldCheck className="h-6 w-6" aria-hidden="true" />
      </div>
      <p className="text-xs font-semibold uppercase text-[#9B4B24]">
        Step {currentIndex + 1} of {stepCount}
      </p>
      <h2 className="mt-2 text-2xl font-semibold leading-8 text-stone-950 sm:text-3xl sm:leading-9">
        {step.title}
      </h2>
      <p className="mt-4 max-w-lg text-base leading-7 text-stone-600">
        {step.action}
      </p>
      <div className="mt-8 border-l-2 border-[#5D8A5D] pl-4">
        <p className="text-xs font-semibold uppercase text-stone-500">Target section</p>
        <p className="mt-1 text-sm font-medium text-stone-900">{sectionLabel}</p>
      </div>
    </div>
  );
}

function InactiveState({ status, flow }) {
  const isComplete = status === 'completed';

  return (
    <div className="flex h-full max-w-xl flex-col justify-center py-4 sm:py-8">
      <div
        className={cn(
          'mb-5 flex h-12 w-12 items-center justify-center rounded-sm border',
          isComplete
            ? 'border-[#CFE0D0] bg-[#EEF5EE] text-[#456847]'
            : 'border-[#F3D4C4] bg-[#FFF4ED] text-[#9B4B24]',
        )}
      >
        {isComplete
          ? <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
          : <Pause className="h-6 w-6" aria-hidden="true" />}
      </div>
      <p className="text-xs font-semibold uppercase text-stone-500">
        {isComplete ? 'Review complete' : 'Walkthrough paused'}
      </p>
      <h2 className="mt-2 text-2xl font-semibold leading-8 text-stone-950 sm:text-3xl sm:leading-9">
        {isComplete ? 'Your walkthrough is complete' : 'Your place is saved'}
      </h2>
      <p className="mt-4 max-w-lg text-base leading-7 text-stone-600">
        {isComplete
          ? `You completed all ${flow.steps.length} steps in the ${flow.title.toLowerCase()}.`
          : 'Resume the guide to continue from your saved step, or replay from the beginning.'}
      </p>
    </div>
  );
}

export default function OnboardingGuide({
  userRole,
  progress,
  open,
  onOpenChange,
  onSave,
  onNavigate,
}) {
  const flow = deriveOnboardingFlow(userRole);
  const normalizedProgress = normalizeOnboardingProgress(userRole, progress);

  if (!flow || !normalizedProgress) return null;

  const currentIndex = Math.max(
    flow.steps.findIndex((step) => step.id === normalizedProgress.currentStepId),
    0,
  );
  const currentStep = flow.steps[currentIndex];
  const isActive = normalizedProgress.status === 'active';
  const isComplete = normalizedProgress.status === 'completed';
  const isDismissed = normalizedProgress.status === 'dismissed';
  const progressValue = isComplete
    ? 100
    : Math.round(((currentIndex + 1) / flow.steps.length) * 100);

  const save = async (nextProgress) => {
    if (nextProgress) await onSave?.(nextProgress);
  };

  const handlePause = async () => {
    await save(dismissOnboardingProgress(userRole, normalizedProgress));
    onOpenChange?.(false);
  };

  const handleOpenSection = () => {
    onNavigate?.(currentStep.route);
    onOpenChange?.(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-[100dvh] max-h-[100dvh] w-screen max-w-none overflow-hidden rounded-none border-0 bg-white p-0 shadow-2xl [&>button]:rounded-sm [&>button]:text-white sm:h-[min(640px,calc(100dvh-2rem))] sm:max-h-[640px] sm:w-[min(760px,calc(100vw-2rem))] sm:max-w-[760px] sm:rounded-sm sm:border sm:border-stone-200 sm:[&>button]:text-stone-500">
        <div className="flex h-full min-h-0 flex-col sm:grid sm:grid-cols-[14.5rem_minmax(0,1fr)]">
          <aside className="flex shrink-0 flex-col bg-stone-950 px-4 py-4 text-white sm:min-h-0 sm:px-5 sm:py-6">
            <div className="flex min-w-0 items-start gap-3 pr-9 sm:pr-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-[#F26D2B] text-white">
                <ShieldCheck className="h-5 w-5" aria-hidden="true" />
              </div>
              <DialogHeader className="min-w-0 space-y-0 text-left">
                <DialogTitle className="text-base leading-5 text-white">{flow.title}</DialogTitle>
                <DialogDescription className="mt-1 text-xs leading-4 text-stone-400">
                  {formatRole(userRole)} walkthrough
                </DialogDescription>
              </DialogHeader>
            </div>

            <div className="mt-4 sm:mb-5 sm:mt-6">
              <div className="mb-2 flex items-center justify-between gap-3 text-xs text-stone-400">
                <span>{isComplete ? 'Complete' : `${currentIndex + 1} of ${flow.steps.length}`}</span>
                <span className="tabular-nums">{progressValue}%</span>
              </div>
              <Progress
                value={progressValue}
                aria-label="Walkthrough progress"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progressValue}
                className="h-1.5 rounded-sm bg-stone-800 [&>div]:rounded-sm [&>div]:bg-[#78A47A]"
              />
            </div>

            <StepRail
              flow={flow}
              currentIndex={currentIndex}
              completedStepIds={normalizedProgress.completedStepIds}
              status={normalizedProgress.status}
            />
          </aside>

          <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-white">
            <main className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-8 sm:py-6">
              {isActive
                ? (
                    <ActiveStep
                      step={currentStep}
                      currentIndex={currentIndex}
                      stepCount={flow.steps.length}
                    />
                  )
                : <InactiveState status={normalizedProgress.status} flow={flow} />}
            </main>

            <footer className="shrink-0 border-t border-stone-200 bg-stone-50 px-3 py-3 sm:px-5">
              {isActive ? (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="rounded-sm px-2 text-stone-600"
                      onClick={handlePause}
                    >
                      <Pause aria-hidden="true" />
                      Pause
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="rounded-sm px-2 text-stone-600"
                      aria-label="Replay from beginning"
                      onClick={() => save(replayOnboardingProgress(userRole))}
                    >
                      <RotateCcw aria-hidden="true" />
                      Replay from beginning
                    </Button>
                  </div>

                  <div className="grid min-w-0 grid-cols-2 gap-2 sm:flex sm:justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="col-start-1 row-start-1 min-w-0 rounded-sm px-2 sm:px-3"
                      disabled={currentIndex === 0}
                      onClick={() => save(backOnboardingProgress(userRole, normalizedProgress))}
                    >
                      <ArrowLeft aria-hidden="true" />
                      Back
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="col-span-2 row-start-2 min-w-0 rounded-sm px-2 sm:px-3"
                      aria-label={`Open ${SECTION_LABELS[currentStep.route] || 'section'}`}
                      onClick={handleOpenSection}
                    >
                      <ExternalLink aria-hidden="true" />
                      <span>Open section</span>
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="col-start-2 row-start-1 min-w-0 rounded-sm bg-[#456847] px-2 text-white hover:bg-[#365238] sm:px-3"
                      onClick={() => save(
                        currentIndex === flow.steps.length - 1
                          ? completeOnboardingProgress(userRole, normalizedProgress)
                          : advanceOnboardingProgress(userRole, normalizedProgress),
                      )}
                    >
                      {currentIndex === flow.steps.length - 1 ? (
                        <>
                          <Check aria-hidden="true" />
                          Complete
                        </>
                      ) : (
                        <>
                          Next
                          <ArrowRight aria-hidden="true" />
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ) : isDismissed ? (
                <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                  <Button
                    type="button"
                    className="w-full rounded-sm bg-[#456847] text-white hover:bg-[#365238] sm:w-auto"
                    aria-label="Resume walkthrough"
                    onClick={() => save(resumeOnboardingProgress(userRole, normalizedProgress))}
                  >
                    <Play aria-hidden="true" />
                    Resume walkthrough
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full rounded-sm sm:w-auto"
                    aria-label="Replay from beginning"
                    onClick={() => save(replayOnboardingProgress(userRole))}
                  >
                    <RotateCcw aria-hidden="true" />
                    Replay from beginning
                  </Button>
                </div>
              ) : (
                <div className="flex items-center justify-end">
                  <Button
                    type="button"
                    className="w-full rounded-sm bg-[#456847] text-white hover:bg-[#365238] sm:w-auto"
                    aria-label="Replay from beginning"
                    onClick={() => save(replayOnboardingProgress(userRole))}
                  >
                    <RotateCcw aria-hidden="true" />
                    Replay from beginning
                  </Button>
                </div>
              )}
            </footer>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
