import { useState, useRef } from 'react';
import { CheckCircle2, XCircle, Clock, Minus, Upload, FileText, ExternalLink, ChevronDown, ChevronUp, MessageSquare } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

const STATUS_OPTIONS = [
  { value: 'compliant', label: 'Compliant', icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-100 text-green-700' },
  { value: 'in_progress', label: 'In Progress', icon: Clock, color: 'text-amber-600', bg: 'bg-amber-100 text-amber-700' },
  { value: 'not_met', label: 'Not Met', icon: XCircle, color: 'text-red-600', bg: 'bg-red-100 text-red-700' },
  { value: 'not_applicable', label: 'N/A', icon: Minus, color: 'text-slate-400', bg: 'bg-slate-100 text-slate-500' },
];

export default function ComplianceRuleRow({ rule, domain, record, onUpdate, onFileUpload }) {
  const [expanded, setExpanded] = useState(false);
  const [notes, setNotes] = useState(record?.evidence_notes || '');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef();

  const currentStatus = record?.status || 'not_applicable';
  const statusConfig = STATUS_OPTIONS.find(s => s.value === currentStatus) || STATUS_OPTIONS[3];
  const StatusIcon = statusConfig.icon;

  const handleStatusChange = (newStatus) => {
    onUpdate({ status: newStatus, last_reviewed: new Date().toISOString().split('T')[0] });
  };

  const handleNotesSave = () => {
    onUpdate({ evidence_notes: notes });
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    await onFileUpload(file);
    setUploading(false);
  };

  return (
    <div className="bg-white">
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Status icon */}
        <StatusIcon className={`w-5 h-5 flex-shrink-0 ${statusConfig.color}`} />

        {/* Rule info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono text-slate-400">{rule.id}</span>
            <span className="text-sm font-medium text-slate-800">{rule.name}</span>
            {record?.document_url && (
              <a href={record.document_url} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline">
                <FileText className="w-3 h-3" /> Evidence
              </a>
            )}
          </div>
          {record?.last_reviewed && (
            <p className="text-xs text-slate-400 mt-0.5">Last reviewed: {record.last_reviewed}</p>
          )}
        </div>

        {/* Status selector */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <select
            value={currentStatus}
            onChange={e => handleStatusChange(e.target.value)}
            className="text-xs rounded-lg border border-slate-200 px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-purple-400 cursor-pointer"
          >
            {STATUS_OPTIONS.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>

          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"
            title="Add notes / upload evidence"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Expanded panel */}
      {expanded && (
        <div className="px-4 pb-4 pt-1 space-y-3 bg-slate-50 border-t border-slate-100">
          <p className="text-xs text-slate-500">{rule.description}</p>

          {/* Evidence notes */}
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 flex items-center gap-1">
              <MessageSquare className="w-3 h-3" /> Evidence Notes
            </label>
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Describe how this standard is being met, or what actions are planned..."
              className="text-sm resize-none h-20"
            />
            <div className="flex justify-end mt-1.5">
              <Button size="sm" variant="outline" onClick={handleNotesSave} className="text-xs h-7">
                Save Notes
              </Button>
            </div>
          </div>

          {/* File upload */}
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 flex items-center gap-1">
              <Upload className="w-3 h-3" /> Evidence Document
            </label>
            <input ref={fileRef} type="file" className="hidden" onChange={handleFileChange}
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" />
            <div className="flex items-center gap-2">
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-2 px-3 py-2 border-2 border-dashed border-slate-300 rounded-lg text-xs text-slate-500 hover:border-purple-400 hover:text-purple-600 transition-colors w-full justify-center disabled:opacity-50"
              >
                {uploading ? (
                  <><div className="w-3 h-3 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" /> Uploading...</>
                ) : (
                  <><Upload className="w-3.5 h-3.5" /> Click to upload (PDF, DOC, image)</>
                )}
              </button>
              {record?.document_url && (
                <a href={record.document_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-blue-600 hover:underline whitespace-nowrap">
                  <ExternalLink className="w-3 h-3" /> View
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}