import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  globalThis.window = { self: {}, top: {} };
});

vi.mock('@/services/appClient', () => ({
  appClient: {
    entities: { ResidentDocument: {} },
    integrations: { Core: { CreateSignedUrl: vi.fn() } },
  },
}));

vi.mock('@/components/residents/ConsentFormModal', () => ({ default: () => null }));

import * as ResidentDocumentsModule from '@/components/residents/ResidentDocuments';

const helperUrl = new URL('./residentDocuments.js', import.meta.url).href;

async function loadHelpers() {
  return import(/* @vite-ignore */ helperUrl).catch(() => ({}));
}

describe('resident document access', () => {
  it('resolves private references through the signed-storage URL mechanism', async () => {
    const helpers = await loadHelpers();

    expect(helpers.resolveResidentDocumentUrl).toBeTypeOf('function');

    const document = {
      id: 'doc-1',
      file_url: 'org-1/residents/private/intake.pdf',
      storage_bucket: 'secure-documents',
      storage_path: 'org-1/residents/private/intake.pdf',
    };
    const createSignedUrl = vi.fn().mockResolvedValue(
      'https://storage.example/signed/intake.pdf?token=secret',
    );

    await expect(helpers.resolveResidentDocumentUrl(createSignedUrl, document))
      .resolves.toBe('https://storage.example/signed/intake.pdf?token=secret');
    expect(createSignedUrl).toHaveBeenCalledWith(document, 600);
  });

  it('does not expose a private reference when document authorization fails', async () => {
    const helpers = await loadHelpers();
    const privatePath = 'org-1/residents/private/clinical-notes.pdf';
    const createSignedUrl = vi.fn().mockRejectedValue(
      new Error(`Object not found: ${privatePath}`),
    );

    await expect(helpers.resolveResidentDocumentUrl(createSignedUrl, { file_url: privatePath }))
      .rejects.toThrow('Unable to access this secure document.');

    try {
      await helpers.resolveResidentDocumentUrl(createSignedUrl, { file_url: privatePath });
    } catch (error) {
      expect(error.message).not.toContain(privatePath);
    }
  });

  it('rejects an empty signed URL instead of attempting to open it', async () => {
    const helpers = await loadHelpers();
    const createSignedUrl = vi.fn().mockResolvedValue('');

    await expect(helpers.resolveResidentDocumentUrl(createSignedUrl, { file_url: 'private/file.pdf' }))
      .rejects.toThrow('Unable to access this secure document.');
  });

  it('opens only the resolved document URL in a separate browsing context', async () => {
    const helpers = await loadHelpers();

    expect(helpers.openResidentDocumentUrl).toBeTypeOf('function');

    const open = vi.fn();
    const signedUrl = 'https://storage.example/signed/intake.pdf?token=secret';
    helpers.openResidentDocumentUrl(signedUrl, { open });

    expect(open).toHaveBeenCalledWith(signedUrl, '_blank', 'noopener,noreferrer');
  });

  it('downloads only the resolved document URL with a non-sensitive filename', async () => {
    const helpers = await loadHelpers();

    expect(helpers.downloadResidentDocumentUrl).toBeTypeOf('function');

    const link = { click: vi.fn() };
    const createElement = vi.fn().mockReturnValue(link);
    const signedUrl = 'https://storage.example/signed/intake.pdf?token=secret';
    helpers.downloadResidentDocumentUrl(signedUrl, 'Intake Assessment.pdf', { createElement });

    expect(createElement).toHaveBeenCalledWith('a');
    expect(link).toMatchObject({
      href: signedUrl,
      download: 'Intake Assessment.pdf',
      rel: 'noopener noreferrer',
    });
    expect(link.click).toHaveBeenCalledOnce();
  });

  it('renders idle, loading, and retry controls without an href or private path', () => {
    const AccessControls = ResidentDocumentsModule.ResidentDocumentAccessControls;

    expect(AccessControls).toBeTypeOf('function');

    const idle = renderToStaticMarkup(
      <AccessControls access={{ loading: false, error: '', lastAction: 'open' }} />,
    );
    const loading = renderToStaticMarkup(
      <AccessControls access={{ loading: true, error: '', lastAction: 'download' }} />,
    );
    const failed = renderToStaticMarkup(
      <AccessControls access={{ loading: false, error: 'Document unavailable', lastAction: 'open' }} />,
    );
    const markup = `${idle}${loading}${failed}`;

    expect(idle).toContain('Open document');
    expect(idle).toContain('Download document');
    expect(loading).toContain('Preparing document');
    expect(failed).toContain('Retry');
    expect(markup).not.toContain('href=');
    expect(markup).not.toContain('org-1/residents/private/intake.pdf');
  });
});

describe('resident document creation visibility', () => {
  it('adds the staff-and-admin default to new document data', async () => {
    const helpers = await loadHelpers();

    expect(helpers.buildResidentDocumentCreatePayload).toBeTypeOf('function');

    const documentData = {
      resident_id: 'resident-1',
      document_type: 'photo_id',
      file_url: 'org-1/residents/photo-id.pdf',
    };

    expect(helpers.buildResidentDocumentCreatePayload(documentData)).toEqual({
      resident_id: 'resident-1',
      document_type: 'photo_id',
      file_url: 'org-1/residents/photo-id.pdf',
      visibility_scope: 'staff_and_admin',
    });
    expect(documentData).not.toHaveProperty('visibility_scope');
  });

  it('preserves each supported visibility selection on new document data', async () => {
    const helpers = await loadHelpers();
    const documentData = { resident_id: 'resident-1', file_url: 'private/file.pdf' };

    expect(helpers.buildResidentDocumentCreatePayload(documentData, 'staff_and_admin'))
      .toMatchObject({ visibility_scope: 'staff_and_admin' });
    expect(helpers.buildResidentDocumentCreatePayload(documentData, 'resident_and_staff'))
      .toMatchObject({ visibility_scope: 'resident_and_staff' });
    expect(helpers.buildResidentDocumentCreatePayload(documentData, 'admin_only'))
      .toMatchObject({ visibility_scope: 'admin_only' });
  });

  it('shows the exact visibility choices with staff and admin selected by default', () => {
    const VisibilitySelector = ResidentDocumentsModule.ResidentDocumentVisibilitySelector;

    expect(VisibilitySelector).toBeTypeOf('function');

    const markup = renderToStaticMarkup(
      <VisibilitySelector value="staff_and_admin" onChange={() => {}} />,
    );

    expect(markup).toContain('Who should this document be available to?');
    expect(markup).toContain('<option value="staff_and_admin" selected="">Staff and administrators</option>');
    expect(markup).toContain('<option value="resident_and_staff">Resident and staff</option>');
    expect(markup).toContain('<option value="admin_only">Administrators only</option>');
    expect(markup).toContain('Account permissions and resident assignments still apply.');
  });

  it('passes the selected visibility scope to the create operation', async () => {
    const helpers = await loadHelpers();

    expect(helpers.persistResidentDocumentUpload).toBeTypeOf('function');

    const create = vi.fn(async payload => ({ id: 'doc-1', ...payload }));
    const update = vi.fn();
    const result = await helpers.persistResidentDocumentUpload({
      residentDocumentService: { create, update },
      documents: [],
      documentData: {
        resident_id: 'resident-1',
        document_type: 'photo_id',
        file_url: 'org-1/residents/photo-id.pdf',
      },
      visibilityScope: 'resident_and_staff',
    });

    expect(result).toEqual({
      document: {
        id: 'doc-1',
        resident_id: 'resident-1',
        document_type: 'photo_id',
        file_url: 'org-1/residents/photo-id.pdf',
        visibility_scope: 'resident_and_staff',
      },
      replacedId: null,
    });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      visibility_scope: 'resident_and_staff',
    }));
    expect(update).not.toHaveBeenCalled();
  });

  it('preserves visibility when replacing an existing document', async () => {
    const helpers = await loadHelpers();
    const existing = {
      id: 'doc-1',
      document_type: 'photo_id',
      visibility_scope: 'admin_only',
    };
    const create = vi.fn();
    const update = vi.fn(async (id, payload) => ({ id, ...payload, visibility_scope: 'admin_only' }));
    const documentData = {
      resident_id: 'resident-1',
      document_type: 'photo_id',
      file_url: 'org-1/residents/replacement-photo-id.pdf',
    };

    const result = await helpers.persistResidentDocumentUpload({
      residentDocumentService: { create, update },
      documents: [existing],
      documentData,
      visibilityScope: 'resident_and_staff',
    });

    expect(update).toHaveBeenCalledWith('doc-1', documentData);
    expect(update.mock.calls[0][1]).not.toHaveProperty('visibility_scope');
    expect(create).not.toHaveBeenCalled();
    expect(result).toEqual({
      document: {
        id: 'doc-1',
        resident_id: 'resident-1',
        document_type: 'photo_id',
        file_url: 'org-1/residents/replacement-photo-id.pdf',
        visibility_scope: 'admin_only',
      },
      replacedId: 'doc-1',
    });
  });
});
