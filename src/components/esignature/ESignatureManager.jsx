import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { FilePen, Plus, X, Upload, Clock, CheckCircle2, XCircle, Eye, Loader2, Send } from 'lucide-react';
import { format } from 'date-fns';

const DOC_TYPES = [
  { value: 'house_rules', label: 'House Rules' },
  { value: 'lease_agreement', label: 'Lease Agreement' },
  { value: 'consent_form', label: 'Consent Form' },
  { value: 'release_of_information', label: 'Release of Information' },
  { value: 'grievance_policy', label: 'Grievance Policy' },
  { value: 'medication_policy', label: 'Medication Policy' },
  { value: 'other', label: 'Other' },
];

const statusConfig = {
  pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  viewed: { label: 'Viewed', color: 'bg-blue-100 text-blue-700', icon: Eye },
  signed: { label: 'Signed', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  declined: { label: 'Declined', color: 'bg-red-100 text-red-700', icon: XCircle },
};

export default function ESignatureManager({ resident }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', document_type: 'house_rules', due_date: '', file_url: '', file_name: '' });

  const load = async () => {
    setLoading(true);
    const data = await base44.entities.SignatureRequest.filter({ resident_id: resident.id });
    setRequests(data.sort((a, b) => new Date(b.created_date) - new Date(a.created_date)));
    setLoading(false);
  };

  useEffect(() => { load(); }, [resident.id]);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setForm(f => ({ ...f, file_url, file_name: file.name }));
    setUploading(false);
  };

  const handleSend = async () => {
    if (!form.title || !form.file_url) return;
    setSending(true);
    const me = await base44.auth.me();
    await base44.entities.SignatureRequest.create({
      organization_id: resident.organization_id,
      resident_id: resident.id,
      resident_name: `${resident.first_name} ${resident.last_name}`,
      resident_email: resident.email,
      title: form.title,
      description: form.description,
      document_type: form.document_type,
      file_url: form.file_url,
      file_name: form.file_name,
      due_date: form.due_date,
      sent_by_name: me.full_name || me.email,
      sent_by_id: me.id,
      status: 'pending',
    });

    if (resident.email) {
      await base44.integrations.Core.SendEmail({
        to: resident.email,
        subject: `Action Required: Please sign "${form.title}"`,
        body: `Hi ${resident.first_name},\n\nA document requires your signature: "${form.title}".\n\n${form.description || ''}\n\nPlease log in to your ClearPath portal to review and sign this document${form.due_date ? ` by ${form.due_date}` : ''}.\n\nThank you.`,
      });
    }

    setForm({ title: '', description: '', document_type: 'house_rules', due_date: '', file_url: '', file_name: '' });
    setShowForm(false);
    setSending(false);
    load();
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this signature request?')) return;
    await base44.entities.SignatureRequest.delete(id);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-800 flex items-center gap-2">
          <FilePen className="w-4 h-4 text-teal-600" /> E-Signature Requests
        </h3>
        <Button size="sm" onClick={() => setShowForm(v => !v)} className="gap-1 bg-teal-600 hover:bg-teal-700 text-white">
          <Plus className="w-3.5 h-3.5" /> Send Request
        </Button>
      </div>

      {showForm && (
        <div className="border rounded-xl p-4 bg-slate-50 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700">New Signature Request</span>
            <button onClick={() => setShowForm(false)}><X className="w-4 h-4 text-slate-400" /></button>
          </div>

          <Input placeholder="Document title *" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />

          <Select value={form.document_type} onValueChange={v => setForm(f => ({ ...f, document_type: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {DOC_TYPES.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
            </SelectContent>
          </Select>

          <Textarea placeholder="Description or instructions for the resident (optional)" value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} />

          <div className="space-y-1">
            <label className="text-xs text-slate-500">Due Date (optional)</label>
            <Input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
          </div>

          <div>
            <label className="text-xs text-slate-500 block mb-1">Upload Document *</label>
            <label className="flex items-center gap-2 cursor-pointer border-2 border-dashed border-slate-300 rounded-lg p-3 hover:border-teal-400 transition-colors">
              <Upload className="w-4 h-4 text-slate-400" />
              <span className="text-sm text-slate-500">{form.file_name || 'Click to upload PDF or image'}</span>
              <input type="file" accept=".pdf,.png,.jpg,.jpeg,.docx" className="hidden" onChange={handleFile} />
              {uploading && <Loader2 className="w-4 h-4 animate-spin text-teal-500 ml-auto" />}
            </label>
            {form.file_url && <p className="text-xs text-green-600 mt-1">✓ Document uploaded</p>}
          </div>

          <Button
            className="w-full gap-2 bg-teal-600 hover:bg-teal-700 text-white"
            disabled={!form.title || !form.file_url || sending}
            onClick={handleSend}
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {sending ? 'Sending...' : `Send to ${resident.first_name}`}
          </Button>
        </div>
      )}

      {loading ? (
        <div className="text-center py-6 text-slate-400 text-sm">Loading...</div>
      ) : requests.length === 0 ? (
        <div className="text-center py-8 text-slate-400 text-sm border rounded-xl bg-slate-50">
          No signature requests sent yet.
        </div>
      ) : (
        <div className="space-y-2">
          {requests.map(req => {
            const cfg = statusConfig[req.status] || statusConfig.pending;
            const StatusIcon = cfg.icon;
            return (
              <div key={req.id} className="border rounded-xl p-4 bg-white flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-medium text-sm text-slate-800 truncate">{req.title}</span>
                    <Badge className={`${cfg.color} border-0 text-xs flex items-center gap-1`}>
                      <StatusIcon className="w-3 h-3" /> {cfg.label}
                    </Badge>
                  </div>
                  <div className="text-xs text-slate-400 space-y-0.5">
                    <p>Sent {format(new Date(req.created_date), 'MMM d, yyyy')} by {req.sent_by_name}</p>
                    {req.due_date && <p>Due: {req.due_date}</p>}
                    {req.signed_at && <p className="text-green-600">Signed: {format(new Date(req.signed_at), 'MMM d, yyyy h:mm a')}</p>}
                    {req.signature_name && <p className="text-green-600">By: {req.signature_name}</p>}
                    {req.decline_reason && <p className="text-red-500">Declined: {req.decline_reason}</p>}
                  </div>
                  {req.file_url && (
                    <a href={req.file_url} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-teal-600 hover:underline mt-1 inline-block">
                      View document ↗
                    </a>
                  )}
                </div>
                {req.status === 'pending' && (
                  <button onClick={() => handleDelete(req.id)} className="text-slate-300 hover:text-red-400 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}