import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabaseClient', () => ({ supabase: {} }));

import { appClient } from './appClient';

describe('appClient external providers', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('fails email delivery closed without logging the sensitive payload', async () => {
    const consoleSpies = [
      vi.spyOn(console, 'info').mockImplementation(() => {}),
      vi.spyOn(console, 'warn').mockImplementation(() => {}),
      vi.spyOn(console, 'error').mockImplementation(() => {}),
    ];

    await expect(appClient.integrations.Core.SendEmail({
      to: 'resident@example.com',
      subject: 'Sensitive subject',
      body: 'Sensitive body',
    })).rejects.toMatchObject({
      code: 'PROVIDER_NOT_CONFIGURED',
      provider: 'email',
    });

    consoleSpies.forEach(spy => expect(spy).not.toHaveBeenCalled());
  });

  it('fails AI and extraction calls closed when their providers are unavailable', async () => {
    await expect(appClient.integrations.Core.InvokeLLM({ prompt: 'Assess applicant' }))
      .rejects.toMatchObject({ code: 'PROVIDER_NOT_CONFIGURED', provider: 'llm' });
    await expect(appClient.integrations.Core.ExtractDataFromUploadedFile({ file_url: 'private' }))
      .rejects.toMatchObject({ code: 'PROVIDER_NOT_CONFIGURED', provider: 'document-extraction' });
  });

  it('publishes provider availability for feature gates', () => {
    expect(appClient.integrations.Core.providerStatus).toEqual({
      email: { configured: false },
      llm: { configured: false },
      documentExtraction: { configured: false },
    });
  });
});
