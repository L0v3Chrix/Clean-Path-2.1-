import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Upload, FileText, CheckCircle2, AlertTriangle, AlertCircle, Clock, Trash2, ExternalLink, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { REQUIRED_DOCUMENTS, getResidentAlerts } from '@/lib/residentAlerts';
import { differenceInDays, parseISO, isValid, format } from 'date-fns';

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

export default function ResidentDocuments({ resident }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(null);
  const [addingType, setAddingType] = useState(null);
  const fileRef = useRef();
  const [pendingUploadType, setPendingUploadType] = useState(null);

  useEffect(() => {
    loadDocs();
  }, [resident.id]);

  const loadDocs = async () => {
    setLoading(true);
    const docs = await base44.entities.ResidentDocument.filter({ resident_id: resident.id });
    setDocuments(docs);
    setLoading(false);
  };

  const triggerUpload = (docType) => {
    setPendingUploadType(docType);
    fileRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !pendingUploadType) return;
    e.target.value = '';
    setUploading(pendingUploadType);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    const existing = documents.find(d => d.document_type === pendingUploadType);
    const payload = {
      resident_id: resident.id,
      location_id: resident.location_id,
      organization_id: resident.organization_id || 'default',
      document_type: pendingUploadType,
      file_url,
      signed_date: new Date().toISOString().split('T')[0],
      status: 'current',
    };
    if (existing) {
      const updated = await base44.entities.ResidentDocument.update(existing.id, payload);
      setDocuments(prev => prev.map(d => d.id === existing.id ? updated : d));
    } else {
      const created = await base44.entities.ResidentDocument.create(payload);
      setDocuments(prev => [...prev, created]);
    }
    setUploading(null);
    setPendingUploadType(null);
  };

  const handleDelete = async (docId) => {
    await base44.entities.ResidentDocument.delete(docId);
    setDocuments(prev => prev.filter(d => d.id !== docId));
  };

  const alerts = getResidentAlerts(resident, documents);
  const alertCount = alerts.length;

  // Build full list: required docs + any extras
  const requiredTypes = REQUIRED_DOCUMENTS.map(r => r.type);
  const extraDocs = documents.filter(d => !requiredTypes.includes(d.document_type));

  return (
    <div className="space-y-3">
      <input ref={fileRef} type="file" className="hidden" onChange={handleFileChange}
        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" />

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
                  {doc?.file_url && (
                    <a href={doc.file_url} target="_blank" rel="noopener noreferrer"
                      className="p-1 rounded hover:bg-slate-200 text-slate-400">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                  <button
                    onClick={() => triggerUpload(req.type)}
                    disabled={isUploading}
                    className="p-1 rounded hover:bg-teal-100 text-teal-600 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Upload document"
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
                  <a href={doc.file_url} target="_blank" rel="noopener noreferrer"
                    className="p-1 rounded hover:bg-slate-200 text-slate-400">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
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
  );
}