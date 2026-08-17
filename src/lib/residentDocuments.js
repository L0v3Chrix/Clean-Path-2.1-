export const RESIDENT_DOCUMENT_SIGNED_URL_TTL_SECONDS = 600;
export const DEFAULT_RESIDENT_DOCUMENT_VISIBILITY = 'staff_and_admin';

export function buildResidentDocumentCreatePayload(
  documentData,
  visibilityScope = DEFAULT_RESIDENT_DOCUMENT_VISIBILITY,
) {
  return {
    ...documentData,
    visibility_scope: visibilityScope,
  };
}

export async function persistResidentDocumentUpload({
  residentDocumentService,
  documents,
  documentData,
  visibilityScope,
}) {
  const existing = documents.find(
    residentDocument => residentDocument.document_type === documentData.document_type,
  );

  if (existing) {
    const document = await residentDocumentService.update(existing.id, documentData);
    return { document, replacedId: existing.id };
  }

  const createPayload = buildResidentDocumentCreatePayload(documentData, visibilityScope);
  const document = await residentDocumentService.create(createPayload);
  return { document, replacedId: null };
}

export async function resolveResidentDocumentUrl(createSignedUrl, document) {
  try {
    const url = await createSignedUrl(document, RESIDENT_DOCUMENT_SIGNED_URL_TTL_SECONDS);
    if (!url) throw new Error('Signed URL was empty.');
    return url;
  } catch {
    throw new Error('Unable to access this secure document.');
  }
}

export function openResidentDocumentUrl(url, browserWindow = window) {
  browserWindow.open(url, '_blank', 'noopener,noreferrer');
}

export function downloadResidentDocumentUrl(url, fileName, documentObject = document) {
  const link = documentObject.createElement('a');
  link.href = url;
  link.download = fileName || 'document';
  link.rel = 'noopener noreferrer';
  link.click();
}
