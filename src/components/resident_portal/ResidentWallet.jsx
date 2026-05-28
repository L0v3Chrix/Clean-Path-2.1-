import { useState, useEffect } from 'react';
import { appClient } from '@/services/appClient';
import { Badge } from '@/components/ui/badge';
import {
  Wallet, FileText, ShieldCheck, FilePen, Download, ExternalLink,
  ChevronDown, ChevronUp, Search, Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import { Input } from '@/components/ui/input';

const CATEGORY_CONFIG = {
  signed_agreements: {
    label: 'Signed Agreements',
    icon: FilePen,
    color: 'bg-green-100 text-green-700',
    accent: 'border-green-200 bg-green-50',
    iconColor: 'text-green-600',
  },
  insurance: {
    label: 'Insurance Cards',
    icon: ShieldCheck,
    color: 'bg-blue-100 text-blue-700',
    accent: 'border-blue-200 bg-blue-50',
    iconColor: 'text-blue-600',
  },
  medical_consent: {
    label: 'Medical & Consent Forms',
    icon: FileText,
    color: 'bg-purple-100 text-purple-700',
    accent: 'border-purple-200 bg-purple-50',
    iconColor: 'text-purple-600',
  },
  other_docs: {
    label: 'Other Records',
    icon: FileText,
    color: 'bg-slate-100 text-slate-600',
    accent: 'border-slate-200 bg-slate-50',
    iconColor: 'text-slate-500',
  },
};

const DOC_TYPE_TO_CATEGORY = {
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

const SIG_TYPE_TO_CATEGORY = {
  house_rules: 'signed_agreements',
  lease_agreement: 'signed_agreements',
  release_of_information: 'signed_agreements',
  consent_form: 'medical_consent',
  medication_policy: 'medical_consent',
  grievance_policy: 'signed_agreements',
  other: 'other_docs',
};

function DocCard({ doc }) {
  const filename = doc.file_name || doc.label || doc.title || 'Document';
  const date = doc.signed_at
    ? format(new Date(doc.signed_at), 'MMM d, yyyy')
    : doc.signed_date
    ? format(new Date(doc.signed_date), 'MMM d, yyyy')
    : doc.created_date
    ? format(new Date(doc.created_date), 'MMM d, yyyy')
    : null;

  return (
    <div className="flex items-center justify-between gap-3 py-3 px-4 bg-white rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-800 truncate">{filename}</p>
        {date && <p className="text-xs text-slate-400 mt-0.5">{doc.signed_at || doc.signed_date ? `Signed ${date}` : `Added ${date}`}</p>}
        {doc.expiry_date && (
          <p className={`text-xs mt-0.5 ${new Date(doc.expiry_date) < new Date() ? 'text-red-500' : 'text-amber-500'}`}>
            {new Date(doc.expiry_date) < new Date() ? 'Expired' : 'Expires'}: {format(new Date(doc.expiry_date), 'MMM d, yyyy')}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <a
          href={doc.file_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-teal-600 hover:text-teal-800 font-medium px-2.5 py-1.5 rounded-lg border border-teal-200 hover:bg-teal-50 transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" /> View
        </a>
        <a
          href={doc.file_url}
          download
          className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-800 font-medium px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors"
        >
          <Download className="w-3.5 h-3.5" /> Save
        </a>
      </div>
    </div>
  );
}

function CategorySection({ categoryKey, docs, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  const cfg = CATEGORY_CONFIG[categoryKey];
  const Icon = cfg.icon;

  if (docs.length === 0) return null;

  return (
    <div className={`rounded-xl border ${cfg.accent} overflow-hidden`}>
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:opacity-90 transition-opacity"
        onClick={() => setOpen(v => !v)}
      >
        <div className="flex items-center gap-2.5">
          <Icon className={`w-4 h-4 ${cfg.iconColor}`} />
          <span className="text-sm font-semibold text-slate-800">{cfg.label}</span>
          <Badge className={`${cfg.color} border-0 text-xs`}>{docs.length}</Badge>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-2">
          {docs.map((doc, i) => <DocCard key={doc.id || i} doc={doc} />)}
        </div>
      )}
    </div>
  );
}

export default function ResidentWallet({ resident }) {
  const [loading, setLoading] = useState(true);
  const [grouped, setGrouped] = useState({});
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [resDocs, sigRequests] = await Promise.all([
        appClient.entities.ResidentDocument.filter({ resident_id: resident.id }),
        appClient.entities.SignatureRequest.filter({ resident_id: resident.id }),
      ]);

      const groups = { signed_agreements: [], insurance: [], medical_consent: [], other_docs: [] };

      // Resident documents with a file_url
      resDocs.filter(d => d.file_url).forEach(doc => {
        const cat = DOC_TYPE_TO_CATEGORY[doc.document_type] || 'other_docs';
        groups[cat].push({ ...doc, _source: 'doc' });
      });

      // Signed signature requests only
      sigRequests.filter(r => r.status === 'signed' && r.file_url).forEach(req => {
        const cat = SIG_TYPE_TO_CATEGORY[req.document_type] || 'signed_agreements';
        // Avoid duplicates (check file_url)
        const alreadyAdded = Object.values(groups).flat().some(d => d.file_url === req.file_url);
        if (!alreadyAdded) groups[cat].push({ ...req, _source: 'sig' });
      });

      setGrouped(groups);
      setTotal(Object.values(groups).reduce((sum, arr) => sum + arr.length, 0));
      setLoading(false);
    };
    if (resident?.id) load();
  }, [resident?.id]);

  const filteredGroups = Object.fromEntries(
    Object.entries(grouped).map(([key, docs]) => [
      key,
      search.trim()
        ? docs.filter(d =>
            (d.label || d.title || d.file_name || '').toLowerCase().includes(search.toLowerCase())
          )
        : docs,
    ])
  );

  const visibleTotal = Object.values(filteredGroups).reduce((s, a) => s + a.length, 0);

  return (
    <div className="rounded-2xl border border-amber-200 bg-white overflow-hidden shadow-sm">
      {/* Header */}
      <div className="px-5 py-4 flex items-center justify-between gap-3 border-b border-amber-100"
        style={{ background: 'linear-gradient(135deg, #1C1917 0%, #2C2420 100%)' }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/20 flex items-center justify-center">
            <Wallet className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h2 className="text-white font-bold text-base">My Wallet</h2>
            <p className="text-amber-300/80 text-xs">Your documents, always on hand</p>
          </div>
        </div>
        {!loading && (
          <Badge className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs">
            {total} {total === 1 ? 'document' : 'documents'}
          </Badge>
        )}
      </div>

      <div className="p-4 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-10 text-slate-400 gap-2">
            <Loader2 className="w-5 h-5 animate-spin" /> Loading your documents...
          </div>
        ) : total === 0 ? (
          <div className="text-center py-10 text-slate-400">
            <Wallet className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No documents available yet.</p>
            <p className="text-xs mt-1">Signed agreements and uploaded records will appear here.</p>
          </div>
        ) : (
          <>
            {total > 3 && (
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  className="pl-9 text-sm h-9"
                  placeholder="Search documents..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
            )}

            {search && visibleTotal === 0 ? (
              <p className="text-center text-sm text-slate-400 py-6">No documents match "{search}"</p>
            ) : (
              <>
                <CategorySection categoryKey="signed_agreements" docs={filteredGroups.signed_agreements} defaultOpen={true} />
                <CategorySection categoryKey="insurance" docs={filteredGroups.insurance} defaultOpen={true} />
                <CategorySection categoryKey="medical_consent" docs={filteredGroups.medical_consent} defaultOpen={true} />
                <CategorySection categoryKey="other_docs" docs={filteredGroups.other_docs} />
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}