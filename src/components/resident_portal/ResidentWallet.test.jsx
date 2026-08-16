import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createSignedUrl } = vi.hoisted(() => ({ createSignedUrl: vi.fn() }));

vi.hoisted(() => {
  globalThis.window = { self: {}, top: {} };
});

vi.mock('@/services/appClient', () => ({
  appClient: {
    integrations: {
      Core: { CreateSignedUrl: createSignedUrl },
    },
  },
}));

import {
  WalletDocumentActions,
  resolveWalletSignatureDocumentUrl,
} from './ResidentWallet';

describe('completed signature wallet actions', () => {
  beforeEach(() => {
    createSignedUrl.mockReset();
  });

  it('resolves private signature paths before exposing View or Save actions', async () => {
    const request = { file_url: 'org-1/private/signed-agreement.pdf' };
    createSignedUrl.mockResolvedValue('https://storage.example/signed/agreement.pdf?token=secret');

    await expect(resolveWalletSignatureDocumentUrl(request))
      .resolves.toBe('https://storage.example/signed/agreement.pdf?token=secret');
    expect(createSignedUrl).toHaveBeenCalledWith(request, 600);
  });

  it('preserves external demo signature URLs through the resolver', async () => {
    const request = { file_url: 'https://example.com/demo-agreement.pdf' };
    createSignedUrl.mockResolvedValue(request.file_url);

    await expect(resolveWalletSignatureDocumentUrl(request)).resolves.toBe(request.file_url);
  });

  it('shows loading and retry states without exposing the private path', () => {
    const privatePath = 'org-1/private/signed-agreement.pdf';
    const loading = renderToStaticMarkup(
      <WalletDocumentActions access={{ loading: true, error: '', url: '' }} onRetry={() => {}} />,
    );
    const unavailable = renderToStaticMarkup(
      <WalletDocumentActions access={{ loading: false, error: 'Unavailable', url: '' }} onRetry={() => {}} />,
    );

    expect(loading).toContain('Preparing');
    expect(unavailable).toContain('Retry');
    expect(`${loading}${unavailable}`).not.toContain(privatePath);
    expect(`${loading}${unavailable}`).not.toContain('href=');
  });

  it('renders idle View and Save actions without a signed URL', () => {
    const markup = renderToStaticMarkup(
      <WalletDocumentActions access={{ loading: false, error: '', url: '' }} onView={() => {}} onSave={() => {}} />,
    );

    expect(markup).toContain('View');
    expect(markup).toContain('Save');
    expect(markup).not.toContain('href=');
    expect(createSignedUrl).not.toHaveBeenCalled();
  });

  it('uses only the resolved URL for completed signature View and Save actions', () => {
    const signedUrl = 'https://storage.example/signed/agreement.pdf?token=secret';
    const markup = renderToStaticMarkup(
      <WalletDocumentActions access={{ loading: false, error: '', url: signedUrl }} onView={() => {}} onSave={() => {}} />,
    );

    expect(markup.match(/href=/g)).toHaveLength(2);
    expect(markup.match(/https:\/\/storage\.example\/signed\/agreement\.pdf\?token=secret/g)).toHaveLength(2);
    expect(markup).toContain('download=""');
  });
});
