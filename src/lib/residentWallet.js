const RESIDENT_VISIBLE_SCOPE = 'resident_and_staff';
const DEFAULT_RESIDENT_DOCUMENT_BUCKET = 'resident-documents';

const DOCUMENT_CATEGORY = {
  resident_agreement: 'signed_agreements',
  house_rules: 'signed_agreements',
  release_of_information: 'signed_agreements',
  recovery_plan: 'signed_agreements',
  insurance_card: 'insurance',
  consent_form: 'medical_consent',
  intake_assessment: 'medical_consent',
  medication_log: 'medical_consent',
  tb_test: 'medical_consent',
  photo_id: 'other_docs',
  drug_test_result: 'other_docs',
  other: 'other_docs',
};

const SIGNATURE_CATEGORY = {
  house_rules: 'signed_agreements',
  lease_agreement: 'signed_agreements',
  release_of_information: 'signed_agreements',
  consent_form: 'medical_consent',
  medication_policy: 'medical_consent',
  grievance_policy: 'signed_agreements',
  other: 'other_docs',
};

function emptyGroups() {
  return {
    signed_agreements: [],
    insurance: [],
    medical_consent: [],
    other_docs: [],
  };
}

function hasStorageObjectPath(value) {
  if (typeof value !== 'string') return false;
  const path = value.trim();
  return Boolean(path)
    && !path.startsWith('/')
    && !/^[a-z][a-z\d+.-]*:/i.test(path);
}

export function isResidentVisibleDocument(document) {
  return document?.visibility_scope === RESIDENT_VISIBLE_SCOPE;
}

export function getResidentDocumentStorageReference(document) {
  const explicitPath = document?.storage_path || document?.storagePath;
  const path = explicitPath || document?.file_url || document?.fileUrl;
  const bucket = document?.storage_bucket
    || document?.storageBucket
    || DEFAULT_RESIDENT_DOCUMENT_BUCKET;

  if (!hasStorageObjectPath(path) || typeof bucket !== 'string') return null;

  const normalizedBucket = bucket.trim();
  if (!/^[a-z\d][a-z\d._-]*$/i.test(normalizedBucket)) return null;

  return {
    storage_bucket: normalizedBucket,
    storage_path: path.trim(),
  };
}

export function isSignedDocumentUrl(value) {
  if (typeof value !== 'string' || !value) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

export function buildResidentWalletViewModel({ residentDocuments = [], signatureRequests = [] } = {}) {
  const groups = emptyGroups();
  const residentDocumentFileUrls = new Set();

  for (const document of Array.isArray(residentDocuments) ? residentDocuments : []) {
    if (!isResidentVisibleDocument(document)) continue;

    const rawReference = document.storage_path
      || document.storagePath
      || document.file_url
      || document.fileUrl;
    if (!rawReference) continue;

    if (document.file_url) residentDocumentFileUrls.add(document.file_url);

    const {
      file_url: _fileUrl,
      fileUrl: _camelFileUrl,
      storage_path: _storagePath,
      storagePath: _camelStoragePath,
      storage_bucket: _storageBucket,
      storageBucket: _camelStorageBucket,
      ...safeDocument
    } = document;
    const category = DOCUMENT_CATEGORY[document.document_type] || 'other_docs';
    groups[category].push({
      ...safeDocument,
      _source: 'doc',
      _storageReference: getResidentDocumentStorageReference(document),
    });
  }

  for (const request of Array.isArray(signatureRequests) ? signatureRequests : []) {
    if (request?.status !== 'signed' || !request.file_url) continue;
    if (residentDocumentFileUrls.has(request.file_url)) continue;

    const category = SIGNATURE_CATEGORY[request.document_type] || 'signed_agreements';
    groups[category].push({ ...request, _source: 'sig' });
  }

  return {
    groups,
    total: Object.values(groups).reduce((sum, documents) => sum + documents.length, 0),
  };
}
