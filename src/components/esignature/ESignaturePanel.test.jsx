import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createSignedUrl, updateSignatureRequest } = vi.hoisted(() => ({
  createSignedUrl: vi.fn(),
  updateSignatureRequest: vi.fn(),
}));

vi.hoisted(() => {
  globalThis.window = { self: {}, top: {} };
});

vi.mock('@/services/appClient', () => ({
  appClient: {
    entities: {
      SignatureRequest: { update: updateSignatureRequest },
    },
    integrations: {
      Core: { CreateSignedUrl: createSignedUrl },
    },
  },
}));

import {
  ESIGNATURE_SIGNED_URL_TTL_SECONDS,
  ESignatureDocumentLink,
  authorizeSignatureDocument,
  resolveESignatureDocumentUrl,
} from './ESignaturePanel';

describe('e-signature document URL resolution', () => {
  beforeEach(() => {
    createSignedUrl.mockReset();
    updateSignatureRequest.mockReset();
  });

  it('resolves a private storage path before it can be rendered', async () => {
    const request = { file_url: 'org-1/signatures/lease.pdf' };
    createSignedUrl.mockResolvedValue('https://storage.example/signed/lease.pdf?token=secret');

    await expect(resolveESignatureDocumentUrl(request)).resolves.toContain('/signed/lease.pdf');
    expect(createSignedUrl).toHaveBeenCalledWith(request, ESIGNATURE_SIGNED_URL_TTL_SECONDS);
  });

  it('preserves an external URL returned by the integration', async () => {
    const request = { file_url: 'https://example.com/demo-document.pdf' };
    createSignedUrl.mockResolvedValue(request.file_url);

    await expect(resolveESignatureDocumentUrl(request)).resolves.toBe(request.file_url);
  });

  it('does not expose a raw storage path when signing fails', async () => {
    const privatePath = 'org-1/private/resident-agreement.pdf';
    createSignedUrl.mockRejectedValue(new Error(`Object not found: ${privatePath}`));

    await expect(resolveESignatureDocumentUrl({ file_url: privatePath }))
      .rejects.toThrow('Unable to open this secure document.');

    try {
      await resolveESignatureDocumentUrl({ file_url: privatePath });
    } catch (error) {
      expect(error.message).not.toContain(privatePath);
    }
  });

  it('renders an idle document action without resolving a signed URL', () => {
    const markup = renderToStaticMarkup(
      <ESignatureDocumentLink request={{ id: 'sig-1', file_url: 'private/lease.pdf' }} />,
    );

    expect(markup).toContain('View document');
    expect(markup).not.toContain('href=');
    expect(createSignedUrl).not.toHaveBeenCalled();
  });

  it('marks a pending request viewed only after its document URL resolves', async () => {
    const events = [];
    createSignedUrl.mockImplementation(async () => {
      events.push('resolved');
      return 'https://storage.example/signed/lease.pdf?token=secret';
    });
    updateSignatureRequest.mockImplementation(async () => {
      events.push('viewed');
    });

    await authorizeSignatureDocument({ id: 'sig-1', status: 'pending', file_url: 'private/lease.pdf' });

    expect(events).toEqual(['resolved', 'viewed']);
    expect(updateSignatureRequest).toHaveBeenCalledWith('sig-1', expect.objectContaining({ status: 'viewed' }));
  });

  it('does not mark a pending request viewed when document authorization fails', async () => {
    createSignedUrl.mockRejectedValue(new Error('storage unavailable'));

    await expect(authorizeSignatureDocument({ id: 'sig-1', status: 'pending', file_url: 'private/lease.pdf' }))
      .rejects.toThrow('Unable to open this secure document.');
    expect(updateSignatureRequest).not.toHaveBeenCalled();
  });
});
