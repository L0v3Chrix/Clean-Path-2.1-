import { describe, expect, it } from 'vitest';

import {
  buildResidentWalletViewModel,
  getResidentDocumentStorageReference,
  isResidentVisibleDocument,
  isSignedDocumentUrl,
} from './residentWallet';

describe('resident wallet document visibility', () => {
  it('allows only the resident-inclusive scope used by the schema and UI', () => {
    expect(isResidentVisibleDocument({ visibility_scope: 'resident_and_staff' })).toBe(true);

    for (const visibilityScope of [
      null,
      undefined,
      '',
      'resident',
      'resident_only',
      'residents_and_staff',
      'staff_and_admin',
      'all_staff',
      'admin_only',
      'staff_only',
      'management_only',
      'unknown_scope',
      'RESIDENT_AND_STAFF',
    ]) {
      expect(isResidentVisibleDocument({ visibility_scope: visibilityScope })).toBe(false);
    }
  });
});

describe('resident wallet storage references', () => {
  it('normalizes an explicit storage object path for the signing API', () => {
    expect(getResidentDocumentStorageReference({
      storage_bucket: 'intake-attachments',
      storage_path: 'org-1/residents/resident-1/intake.pdf',
      file_url: 'https://untrusted.example/intake.pdf',
    })).toEqual({
      storage_bucket: 'intake-attachments',
      storage_path: 'org-1/residents/resident-1/intake.pdf',
    });
  });

  it('supports legacy relative file_url object paths in the private resident bucket', () => {
    expect(getResidentDocumentStorageReference({
      file_url: 'org-1/residents/resident-1/agreement.pdf',
    })).toEqual({
      storage_bucket: 'resident-documents',
      storage_path: 'org-1/residents/resident-1/agreement.pdf',
    });
  });

  it.each([
    ['an external URL', { file_url: 'https://files.example/agreement.pdf' }],
    ['a data URL', { file_url: 'data:application/pdf;base64,JVBERi0' }],
    ['a protocol-relative URL', { storage_path: '//files.example/agreement.pdf' }],
    ['an absolute application path', { storage_path: '/storage/v1/object/agreement.pdf' }],
    ['an invalid bucket', { storage_bucket: 'https://files.example', storage_path: 'agreement.pdf' }],
    ['no object path', { file_url: '' }],
  ])('rejects %s instead of treating it as a signable object', (_label, document) => {
    expect(getResidentDocumentStorageReference(document)).toBeNull();
  });

  it('recognizes only absolute HTTP URLs returned by the signing API', () => {
    expect(isSignedDocumentUrl('https://storage.example/object.pdf?token=secret')).toBe(true);
    expect(isSignedDocumentUrl('http://127.0.0.1:54321/storage/v1/object/sign/file.pdf')).toBe(true);
    expect(isSignedDocumentUrl('org-1/private/file.pdf')).toBe(false);
    expect(isSignedDocumentUrl('data:application/pdf;base64,JVBERi0')).toBe(false);
    expect(isSignedDocumentUrl('javascript:alert(1)')).toBe(false);
    expect(isSignedDocumentUrl('')).toBe(false);
  });
});

describe('resident wallet view model', () => {
  it('omits non-resident documents and strips raw paths from visible document rows', () => {
    const viewModel = buildResidentWalletViewModel({
      residentDocuments: [
        {
          id: 'resident-visible',
          document_type: 'insurance_card',
          label: 'Insurance card',
          visibility_scope: 'resident_and_staff',
          storage_path: 'org-1/resident-visible/insurance.pdf',
          file_url: 'org-1/resident-visible/insurance.pdf',
        },
        {
          id: 'external-visible',
          document_type: 'other',
          label: 'External record',
          visibility_scope: 'resident_and_staff',
          file_url: 'https://untrusted.example/record.pdf',
        },
        {
          id: 'staff-only',
          document_type: 'resident_agreement',
          visibility_scope: 'staff_and_admin',
          storage_path: 'org-1/staff-only/agreement.pdf',
        },
        {
          id: 'missing-scope',
          document_type: 'other',
          storage_path: 'org-1/missing-scope/record.pdf',
        },
      ],
      signatureRequests: [],
    });

    expect(viewModel.total).toBe(2);
    expect(viewModel.groups.insurance).toEqual([
      expect.objectContaining({
        id: 'resident-visible',
        _source: 'doc',
        _storageReference: {
          storage_bucket: 'resident-documents',
          storage_path: 'org-1/resident-visible/insurance.pdf',
        },
      }),
    ]);
    expect(viewModel.groups.other_docs).toEqual([
      expect.objectContaining({
        id: 'external-visible',
        _source: 'doc',
        _storageReference: null,
      }),
    ]);
    expect(Object.values(viewModel.groups).flat().map((document) => document.id)).not.toContain('staff-only');
    expect(Object.values(viewModel.groups).flat().map((document) => document.id)).not.toContain('missing-scope');

    for (const document of Object.values(viewModel.groups).flat()) {
      if (document._source !== 'doc') continue;
      expect(document).not.toHaveProperty('file_url');
      expect(document).not.toHaveProperty('storage_path');
      expect(document).not.toHaveProperty('storage_bucket');
    }
  });

  it('preserves signed signature requests and their existing categorization', () => {
    const viewModel = buildResidentWalletViewModel({
      residentDocuments: [],
      signatureRequests: [
        {
          id: 'signed-request',
          status: 'signed',
          document_type: 'lease_agreement',
          file_url: 'org-1/signatures/lease.pdf',
        },
        {
          id: 'pending-request',
          status: 'pending',
          document_type: 'consent_form',
          file_url: 'org-1/signatures/consent.pdf',
        },
      ],
    });

    expect(viewModel.total).toBe(1);
    expect(viewModel.groups.signed_agreements).toEqual([
      expect.objectContaining({ id: 'signed-request', _source: 'sig' }),
    ]);
    expect(Object.values(viewModel.groups).flat().map((document) => document.id)).not.toContain('pending-request');
  });
});
