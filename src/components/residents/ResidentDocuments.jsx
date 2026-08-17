import { useState, useEffect, useRef } from 'react';
import { appClient } from '@/services/appClient';
import { Upload, FileText, CheckCircle2, AlertTriangle, AlertCircle, Clock, Trash2, ExternalLink, Download, Loader2, PenLine } from 'lucide-react';
import { REQUIRED_DOCUMENTS, getResidentAlerts } from '@/lib/residentAlerts';
import {
  DEFAULT_RESIDENT_DOCUMENT_VISIBILITY,
  downloadResidentDocumentUrl,
  openResidentDocumentUrl,
  persistResidentDocumentUpload,
  resolveResidentDocumentUrl,
} from '@/lib/residentDocuments';
import { differenceInDays, parseISO, isValid } from 'date-fns';
import ConsentFormModal from './ConsentFormModal';

const CONSENT_FORM_TYPES = new Set([
  'consent_form','resident_agreement','house_rules','intake_assessment',
  'release_of_information','recovery_plan','photo_id','tb_test',
]);

const DOC_TYPE_LABELS = {
  consent_form: 'Consent Form',
  resident_agreement: 'Resident Agreement',
  house_rules: 'House Rules (Signed)',
  intake_assessment: 'Intake Assessment',
  photo_id: 'Photo ID',
  insurance_card: 'Insurance Card',
  release_of_information: 'Release of Information',
  recovery_plan: 'Recovery Plan',
  drug_test_result: 'Drug Test Result',
  medication_log: 'Medication Log',
  tb_test: 'TB Test',
  other: 'Other',
};

function docStatus(doc, reqDef) {
  if (!doc || !doc.file_url) return 'missing';
  if (!reqDef?.expiresInDays) return 'current';

  const today = new Date();
  let expiry = null;
  if (doc.expiry_date) expiry = parseISO(doc.expiry_date);
  else if (doc.signed_date) {
    const s = parseISO(doc.signed_date);
    if (isValid(s)) { expiry = new Date(s); expiry.setDate(expiry.getDate() + reqDef.expiresInDays); }
  }
  if (!expiry || !isValid(expiry)) return 'current';
  const days = differenceInDays(expiry, today);
  if (days < 0) return 'expired';
  if (days <= 30) return 'expiring_soon';
  return 'current';
}

const statusConfig = {
  current:       { label: 'Current',       color: 'bg-green-100 text-green-700',  Icon: CheckCircle2 },
  expiring_soon: { label: 'Expiring Soon', color: 'bg-yellow-100 text-yellow-700', Icon: Clock },
  expired:       { label: 'Expired',       color: 'bg-red-100 text-red-700',      Icon: AlertCircle },
  missing:       { label: 'Missing',       color: 'bg-orange-100 text-orange-700', Icon: AlertTriangle },
};

const VISIBILITY_OPTIONS = [
  { value: 'staff_and_admin', label: 'Staff and administrators' },
  { value: 'resident_and_staff', label: 'Resident and staff' },
  { value: 'admin_only', label: 'Administrators only' },
];

export function ResidentDocumentVisibilitySelector({
  value = DEFAULT_RESIDENT_DOCUMENT_VISIBILITY,
  onChange,
  id = 'resident-document-visibility',
}) {
  const helpId = `${id}-help`;

  return (
    <div>
      <label htmlFor={id} className="text-xs font-medium text-slate-700 mb-1 block">
        Who should this document be available to?
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-describedby={helpId}
        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
      >
        {VISIBILITY_OPTIONS.map(option => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
      <p id={helpId} className="mt-1 text-xs text-slate-500">
        Account permissions and resident assignments still apply.
      </p>
    </div>
  );
}

export function ResidentDocumentAccessControls({ access, onOpen, onDownload, onRetry }) {
  if (access.loading) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-slate-500" role="status">
        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Preparing document...
      </span>
    );
  }

  if (access.error) {
    return (
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-xs text-red-600 hover:bg-red-50"
        title="Retry secure document access"
      >
        <AlertCircle className="w-3.5 h-3.5" /> Document unavailable. Retry
      </button>
    );
  }

  return (
    <div className="flex items-center gap-0.5">
      <button
        type="button"
        onClick={onOpen}
        className="p-1 rounded hover:bg-slate-200 text-slate-500"
        title="Open document"
      >
        <ExternalLink className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={onDownload}
        className="p-1 rounded hover:bg-slate-200 text-slate-500"
        title="Download document"
      >
        <Download className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function ResidentDocumentActions({ residentDocument }) {
  const [access, setAccess] = useState({ loading: false, error: '', lastAction: 'open' });

  const runAction = async (action) => {
    setAccess({ loading: true, error: '', lastAction: action });
    try {
      const url = await resolveResidentDocumentUrl(
        appClient.integrations.Core.CreateSignedUrl,
        residentDocument,
      );
      if (action === 'download') {
        const fileName = residentDocument.file_name
          || DOC_TYPE_LABELS[residentDocument.document_type]
          || 'Document';
        downloadResidentDocumentUrl(url, fileName);
      } else {
        openResidentDocumentUrl(url);
      }
      setAccess({ loading: false, error: '', lastAction: action });
    } catch {
      setAccess({
        loading: false,
        error: 'Unable to access this secure document.',
        lastAction: action,
      });
    }
  };

  return (
    <ResidentDocumentAccessControls
      access={access}
      onOpen={() => runAction('open')}
      onDownload={() => runAction('download')}
      onRetry={() => runAction(access.lastAction)}
    />
  );
}

export default function ResidentDocuments({ resident }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(null);
  const fileRef = useRef();
  const [pendingUploadType, setPendingUploadType] = useState(null);
  const [visibilityScope, setVisibilityScope] = useState(DEFAULT_RESIDENT_DOCUMENT_VISIBILITY);
  const [consentFormDocType, setConsentFormDocType] = useState(null);

  useEffect(() => {
    loadDocs();
  }, [resident.id]);

  const loadDocs = async () => {
    setLoading(true);
    const docs = await appClient.entities.ResidentDocument.filter({ resident_id: resident.id });
    setDocuments(docs);
    setLoading(false);
  };

  const triggerUpload = (docType) => {
    setPendingUploadType(docType);
    const existing = documents.some(document => document.document_type === docType);
    if (existing) {
      fileRef.current?.click();
    } else {
      setVisibilityScope(DEFAULT_RESIDENT_DOCUMENT_VISIBILITY);
    }
  };

  const cancelPendingUpload = () => {
    setPendingUploadType(null);
    setVisibilityScope(DEFAULT_RESIDENT_DOCUMENT_VISIBILITY);
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !pendingUploadType) return;
    e.target.value = '';
    setUploading(pendingUploadType);
    try {
      const upload = await appClient.integrations.Core.UploadFile({ file });
      const documentData = {
        resident_id: resident.id,
        location_id: resident.location_id,
        organization_id: resident.organization_id || 'default',
        document_type: pendingUploadType,
        file_url: upload.file_url,
        storage_bucket: upload.storage_bucket,
        storage_path: upload.storage_path,
        signed_date: new Date().toISOString().split('T')[0],
        status: 'current',
      };
      const { document: savedDocument, replacedId } = await persistResidentDocumentUpload({
        residentDocumentService: appClient.entities.ResidentDocument,
        documents,
        documentData,
        visibilityScope,
      });
      if (replacedId) {
        setDocuments(prev => prev.map(d => d.id === replacedId ? savedDocument : d));
      } else {
        setDocuments(prev => [...prev, savedDocument]);
      }
    } finally {
      setUploading(null);
      setPendingUploadType(null);
      setVisibilityScope(DEFAULT_RESIDENT_DOCUMENT_VISIBILITY);
    }
  };

  const handleDelete = async (docId) => {
    await appClient.entities.ResidentDocument.delete(docId);
    setDocuments(prev => prev.filter(d => d.id !== docId));
  };

  const alerts = getResidentAlerts(resident, documents);
  const alertCount = alerts.length;

  // Build full list: required docs + any extras
  const requiredTypes = REQUIRED_DOCUMENTS.map(r => r.type);
  const extraDocs = documents.filter(d => !requiredTypes.includes(d.document_type));

  return (
    <>
    <div className="space-y-3">
      <input ref={fileRef} type="file" className="hidden" onChange={handleFileChange}
        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" />

      {pendingUploadType && !documents.some(document => document.document_type === pendingUploadType) && (
        <div className="border border-slate-200 bg-slate-50 px-3 py-3 rounded-lg space-y-3">
          <div>
            <p className="text-sm font-semibold text-slate-800">
              Add {DOC_TYPE_LABELS[pendingUploadType]
                || REQUIRED_DOCUMENTS.find(document => document.type === pendingUploadType)?.label
                || 'document'}
            </p>
            <p className="text-xs text-slate-500">Choose visibility before selecting the file.</p>
          </div>
          <ResidentDocumentVisibilitySelector
            id={`resident-document-visibility-${pendingUploadType}`}
            value={visibilityScope}
            onChange={setVisibilityScope}
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={cancelPendingUpload}
              disabled={uploading === pendingUploadType}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading === pendingUploadType}
              className="inline-flex items-center gap-1.5 rounded-md bg-teal-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {uploading === pendingUploadType
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <Upload className="w-3.5 h-3.5" />}
              {uploading === pendingUploadType ? 'Uploading...' : 'Choose file'}
            </button>
          </div>
        </div>
      )}

      {/* Alert summary banner */}
      {alertCount > 0 && (
        <div className="rounded-xl bg-orange-50 border border-orange-200 p-3">
          <p className="text-xs font-semibold text-orange-800 mb-1.5">
            {alertCount} document alert{alertCount > 1 ? 's' : ''} require attention
          </p>
          <div className="space-y-1">
            {alerts.map((a, i) => {
              const cfg = statusConfig[a.type === 'missing' ? 'missing' : a.type === 'expired' ? 'expired' : 'expiring_soon'];
              const Icon = cfg.Icon;
              return (
                <div key={i} className="flex items-center gap-1.5 text-xs text-orange-700">
                  <Icon className="w-3 h-3 flex-shrink-0" />
                  <span>
                    {a.label}
                    {a.type === 'expired' && ` — expired ${Math.abs(a.daysUntilExpiry)} days ago`}
                    {a.type === 'expiring' && ` — expires in ${a.daysUntilExpiry} day${a.daysUntilExpiry !== 1 ? 's' : ''}`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Required documents */}
      <div className="space-y-1">
        {loading ? (
          <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-10 bg-slate-100 rounded animate-pulse" />)}</div>
        ) : (
          REQUIRED_DOCUMENTS.map(req => {
            const doc = documents.find(d => d.document_type === req.type);
            const status = docStatus(doc, req);
            const cfg = statusConfig[status];
            const Icon = cfg.Icon;
            const isUploading = uploading === req.type;

            return (
              <div key={req.type} className="flex items-center justify-between gap-2 py-2 px-3 rounded-lg hover:bg-slate-50 group">
                <div className="flex items-center gap-2 min-w-0">
                  <Icon className={`w-4 h-4 flex-shrink-0 ${status === 'current' ? 'text-green-500' : status === 'expiring_soon' ? 'text-yellow-500' : status === 'expired' ? 'text-red-500' : 'text-orange-400'}`} />
                  <span className="text-sm text-slate-700 truncate">{req.label}</span>
                  {doc?.signed_date && (
                    <span className="text-xs text-slate-400 hidden sm:inline">
                      {status === 'expiring_soon' || status === 'expired' ? `exp. ${doc.expiry_date || '—'}` : `signed ${doc.signed_date}`}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cfg.color}`}>{cfg.label}</span>
                  {CONSENT_FORM_TYPES.has(req.type) && (
                    <button
                      onClick={() => setConsentFormDocType(req.type)}
                      className="flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-200 hover:bg-teal-100 transition-colors opacity-0 group-hover:opacity-100"
                      title="Fill out & sign form"
                    >
                      <PenLine className="w-3 h-3" /> Fill & Sign
                    </button>
                  )}
                  {doc?.file_url && (
                    <ResidentDocumentActions residentDocument={doc} />
                  )}
                  <button
                    onClick={() => triggerUpload(req.type)}
                    disabled={isUploading}
                    className="p-1 rounded hover:bg-teal-100 text-teal-600 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Upload existing document"
                  >
                    {isUploading ? (
                      <div className="w-3.5 h-3.5 border-2 border-teal-400 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Upload className="w-3.5 h-3.5" />
                    )}
                  </button>
                  {doc && (
                    <button
                      onClick={() => handleDelete(doc.id)}
                      className="p-1 rounded hover:bg-red-100 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Remove document"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Extra docs */}
      {extraDocs.length > 0 && (
        <div className="border-t pt-3 space-y-1">
          <p className="text-xs font-semibold text-slate-500 px-3 mb-2">ADDITIONAL DOCUMENTS</p>
          {extraDocs.map(doc => (
            <div key={doc.id} className="flex items-center justify-between gap-2 py-2 px-3 rounded-lg hover:bg-slate-50 group">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-slate-400" />
                <span className="text-sm text-slate-700">{DOC_TYPE_LABELS[doc.document_type] || doc.document_type}</span>
                {doc.signed_date && <span className="text-xs text-slate-400">signed {doc.signed_date}</span>}
              </div>
              <div className="flex items-center gap-1.5">
                {doc.file_url && (
                  <ResidentDocumentActions residentDocument={doc} />
                )}
                <button onClick={() => handleDelete(doc.id)}
                  className="p-1 rounded hover:bg-red-100 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>

      {consentFormDocType && (
        <ConsentFormModal
          docType={consentFormDocType}
          resident={resident}
          onClose={() => setConsentFormDocType(null)}
          onSaved={() => { setConsentFormDocType(null); loadDocs(); }}
        />
      )}
    </>
  );
}
