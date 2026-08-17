import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import OnboardingGuide from './OnboardingGuide';

const buttonHandlers = vi.hoisted(() => new Map());

vi.mock('@/lib/utils', () => ({
  cn: (...classes) => classes.filter(Boolean).join(' '),
}));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }) => (open ? <div role="dialog">{children}</div> : null),
  DialogContent: ({ children, ...props }) => <div {...props}>{children}</div>,
  DialogDescription: (props) => <p {...props} />,
  DialogHeader: (props) => <div {...props} />,
  DialogTitle: (props) => <h1 {...props} />,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, ...props }) => {
    const label = props['aria-label'];
    if (label) buttonHandlers.set(label, onClick);
    delete props.variant;
    delete props.size;
    delete props.asChild;
    return <button onClick={onClick} {...props}>{children}</button>;
  },
}));

vi.mock('@/components/ui/progress', () => ({
  Progress: ({ value, ...props }) => <div data-value={value} {...props} />,
}));

const dismissedProgress = {
  flowId: 'clearpath-onboarding-resident-v1',
  version: 1,
  currentStepId: 'community-chat',
  completedStepIds: ['profile-home', 'my-chores'],
  status: 'dismissed',
};

function renderGuide(progress, onSave = () => {}) {
  return renderToStaticMarkup(
    <OnboardingGuide
      userRole="resident"
      progress={progress}
      open
      onOpenChange={() => {}}
      onSave={onSave}
      onNavigate={() => {}}
    />,
  );
}

describe('OnboardingGuide paused actions', () => {
  beforeEach(() => {
    buttonHandlers.clear();
  });

  it('offers distinct resume and replay-from-beginning actions when dismissed', () => {
    const markup = renderGuide(dismissedProgress);

    expect(markup).toMatch(/<button[^>]*>.*Resume walkthrough.*<\/button>/);
    expect(markup).toMatch(/<button[^>]*>.*Replay from beginning.*<\/button>/);
  });

  it('resumes from the dismissed step', async () => {
    const onSave = vi.fn();
    renderGuide(dismissedProgress, onSave);

    await buttonHandlers.get('Resume walkthrough')?.();

    expect(onSave).toHaveBeenCalledWith({
      ...dismissedProgress,
      status: 'active',
    });
  });

  it('replays dismissed progress from the beginning', async () => {
    const onSave = vi.fn();
    renderGuide(dismissedProgress, onSave);

    await buttonHandlers.get('Replay from beginning')?.();

    expect(onSave).toHaveBeenCalledWith({
      flowId: dismissedProgress.flowId,
      version: dismissedProgress.version,
      currentStepId: 'profile-home',
      completedStepIds: [],
      status: 'active',
    });
  });

  it('keeps completed walkthroughs replay-only', () => {
    const markup = renderGuide({
      ...dismissedProgress,
      currentStepId: 'signature-requests',
      status: 'completed',
    });

    expect(markup).not.toContain('Resume walkthrough');
    expect(markup).toMatch(/<button[^>]*>.*Replay from beginning.*<\/button>/);
  });
});
