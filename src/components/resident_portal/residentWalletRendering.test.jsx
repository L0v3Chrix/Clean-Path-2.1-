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
  performResidentWalletDocumentAction,
  ResidentWalletDocumentActions,
  resolveWalletResidentDocumentUrl,
} from './ResidentWallet';

describe('resident document wallet access', () => {
  beforeEach(() => {
    createSignedUrl.mockReset();
  });

  it('does not request a signed URL when resident wallet actions mount', () => {
    renderToStaticMarkup(
      <ResidentWalletDocumentActions
        doc={{
          visibility_scope: 'resident_and_staff',
          storage_bucket: 'resident-documents',
          storage_path: 'org-1/resident-1/agreement.pdf',
        }}
      />,
    );

    expect(createSignedUrl).not.toHaveBeenCalled();
  });

  it('signs only the normalized private storage reference', async () => {
    createSignedUrl.mockResolvedValue('https://storage.example/signed/agreement.pdf?token=secret');
    const document = {
      visibility_scope: 'resident_and_staff',
      storage_bucket: 'resident-documents',
      storage_path: 'org-1/resident-1/agreement.pdf',
      file_url: 'https://untrusted.example/agreement.pdf',
    };

    await expect(resolveWalletResidentDocumentUrl(document))
      .resolves.toBe('https://storage.example/signed/agreement.pdf?token=secret');
    expect(createSignedUrl).toHaveBeenCalledWith({
      storage_bucket: 'resident-documents',
      storage_path: 'org-1/resident-1/agreement.pdf',
    }, 600);
  });

  it.each([
    ['a staff-only document', {
      visibility_scope: 'staff_and_admin',
      storage_path: 'org-1/resident-1/internal.pdf',
    }],
    ['an external-only document', {
      visibility_scope: 'resident_and_staff',
      file_url: 'https://untrusted.example/agreement.pdf',
    }],
  ])('rejects %s without asking the signing API', async (_label, document) => {
    await expect(resolveWalletResidentDocumentUrl(document)).rejects.toThrow('Document unavailable');
    expect(createSignedUrl).not.toHaveBeenCalled();
  });

  it('does not enable actions when the signing API returns a raw private path', async () => {
    createSignedUrl.mockResolvedValue('org-1/resident-1/agreement.pdf');

    await expect(resolveWalletResidentDocumentUrl({
      visibility_scope: 'resident_and_staff',
      storage_path: 'org-1/resident-1/agreement.pdf',
    })).rejects.toThrow('Document unavailable');
  });

  it('resolves and opens a signed resident document only after View or Download', async () => {
    createSignedUrl
      .mockResolvedValueOnce('https://storage.example/signed/view.pdf?token=view')
      .mockResolvedValueOnce('https://storage.example/signed/download.pdf?token=download');

    const openWindow = vi.fn();
    const download = vi.fn();
    const document = {
      visibility_scope: 'resident_and_staff',
      storage_bucket: 'resident-documents',
      storage_path: 'org-1/resident-1/agreement.pdf',
    };

    await performResidentWalletDocumentAction(document, 'view', { openWindow, download });
    await performResidentWalletDocumentAction(document, 'download', { openWindow, download });

    expect(createSignedUrl).toHaveBeenCalledTimes(2);
    expect(openWindow).toHaveBeenCalledWith(
      'https://storage.example/signed/view.pdf?token=view',
      '_blank',
      'noopener,noreferrer',
    );
    expect(download).toHaveBeenCalledWith(
      'https://storage.example/signed/download.pdf?token=download',
      document,
    );
  });
});
