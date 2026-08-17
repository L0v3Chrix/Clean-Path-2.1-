import { describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  globalThis.window = { self: {}, top: {} };
});

vi.mock('@/services/appClient', () => ({
  appClient: {
    integrations: {
      Core: {
        providerStatus: { llm: { configured: false } },
      },
    },
  },
}));

import {
  INTERVIEW_AI_ERROR_MESSAGE,
  INTERVIEW_SPEECH_POLICY,
  requestInterviewAssessment,
} from './InterviewModal';

describe('interview privacy safeguards', () => {
  it('keeps browser speech recognition disabled without an approved provider and consent mechanism', () => {
    expect(INTERVIEW_SPEECH_POLICY).toEqual({
      enabled: false,
      approvedProvider: null,
      consentMechanism: null,
    });
  });

  it('returns a non-sensitive message when the AI provider fails', async () => {
    const invokeLLM = vi.fn().mockRejectedValue(new Error('Private resident details from provider'));

    await expect(requestInterviewAssessment(invokeLLM, 'sensitive prompt')).resolves.toEqual({
      summary: '',
      error: INTERVIEW_AI_ERROR_MESSAGE,
    });
    expect(INTERVIEW_AI_ERROR_MESSAGE).not.toContain('Private resident details');
  });

  it('returns the provider output after a successful assessment', async () => {
    const invokeLLM = vi.fn().mockResolvedValue({ output: 'Assessment complete.' });

    await expect(requestInterviewAssessment(invokeLLM, 'prompt')).resolves.toEqual({
      summary: 'Assessment complete.',
      error: '',
    });
  });
});
