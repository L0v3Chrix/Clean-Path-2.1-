import { beforeEach, describe, expect, it, vi } from 'vitest';

const supabase = vi.hoisted(() => ({
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(),
  functions: {
    invoke: vi.fn(),
  },
  rpc: vi.fn(),
  storage: {
    from: vi.fn(),
  },
}));

vi.mock('@/lib/supabaseClient', () => ({ supabase }));

import { appClient } from './appClient';

describe('appClient signed URL access', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('invokes the authenticated document-access function for protected objects', async () => {
    supabase.functions.invoke.mockResolvedValue({
      data: { signedUrl: 'https://signed.example.test/file.pdf' },
      error: null,
    });

    await expect(appClient.integrations.Core.CreateSignedUrl({
      storage_bucket: 'secure-documents',
      storage_path: 'org-1/residents/private/intake.pdf',
    }, 600)).resolves.toBe('https://signed.example.test/file.pdf');

    expect(supabase.functions.invoke).toHaveBeenCalledWith('document-access', {
      body: {
        bucket: 'secure-documents',
        path: 'org-1/residents/private/intake.pdf',
        expires: 600,
      },
    });
    expect(supabase.storage.from).not.toHaveBeenCalled();
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it('preserves the direct bypass for external document URLs', async () => {
    const externalUrl = 'https://example.test/documents/intake.pdf';

    await expect(appClient.integrations.Core.CreateSignedUrl({
      storage_bucket: 'secure-documents',
      storage_path: externalUrl,
    }, 600)).resolves.toBe(externalUrl);

    expect(supabase.functions.invoke).not.toHaveBeenCalled();
    expect(supabase.storage.from).not.toHaveBeenCalled();
  });

  it('surfaces only a generic error when the function does not return a signed URL', async () => {
    supabase.functions.invoke.mockResolvedValue({
      data: { signedUrl: '' },
      error: null,
    });

    await expect(appClient.integrations.Core.CreateSignedUrl({
      storage_bucket: 'secure-documents',
      storage_path: 'org-1/residents/private/intake.pdf',
    }, 600)).rejects.toThrow('Unable to access this secure document.');
  });
});
