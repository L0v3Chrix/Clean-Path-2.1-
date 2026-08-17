import { useState, useEffect } from 'react';
import { appClient } from '@/services/appClient';
import { Shield, Eye, FileText, Lock, AlertTriangle, CheckCircle2, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';

const ACTION_LABELS = {
  viewed_record: 'Viewed Record',
  viewed_document: 'Viewed Document',
  document_access_authorized: 'Document Access Authorized',
  insert: 'Created Record',
  update: 'Updated Record',
  delete: 'Deleted Record',
  public_intake_submitted: 'Public Intake Submitted',
  edited_record: 'Edited Record',
  exported_record: 'Exported Record',
  shared_record: 'Shared Record',
  deleted_record: 'Deleted Record',
  uploaded_document: 'Uploaded Document',
  accessed_medication: 'Accessed Medication',
  printed_report: 'Printed Report',
  other: 'Other Action',
};

const ACTION_COLORS = {
  viewed_record: '#6366F1',
  edited_record: '#F97316',
  exported_record: '#EAB308',
  shared_record: '#EC4899',
  deleted_record: '#EF4444',
  uploaded_document: '#10B981',
  accessed_medication: '#8B5CF6',
  printed_report: '#14B8A6',
  other: '#64748B',
};

const SAFEGUARDS = [
  { icon: Lock, title: 'Access Controls', status: 'active', desc: 'Database and route policies restrict core resident records by role and assigned house.' },
  { icon: Eye, title: 'Audit Logging', status: 'active', desc: 'Core record changes and protected document opens are logged automatically.' },
  { icon: Shield, title: 'Hosting Controls', status: 'review', desc: 'Verify encryption, retention, and contractual controls in the business-owned Supabase project.' },
  { icon: FileText, title: 'Staff Training', status: 'review', desc: 'Assign, complete, and document required privacy training before cutover.' },
  { icon: AlertTriangle, title: 'Breach Response Plan', status: 'review', desc: 'Document and practice your breach notification procedure.' },
  { icon: CheckCircle2, title: 'Business Associate Agreements', status: 'review', desc: 'Ensure BAAs are signed with all vendors who access PHI.' },
];

export default function HipaaCompliance() {
  const [logs, setLogs] = useState([]);
  const [residents, setResidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterAction, setFilterAction] = useState('all');

  const load = async () => {
    const [auditLogs, res] = await Promise.all([
      appClient.entities.HipaaAuditLog.list('-created_date', 200),
      appClient.entities.Resident.filter({ status: 'active' }),
    ]);
    setLogs(auditLogs);
    setResidents(res);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = logs.filter(l => {
    const matchSearch = !search || l.performed_by_name?.toLowerCase().includes(search.toLowerCase()) || l.description?.toLowerCase().includes(search.toLowerCase()) || l.resource_type?.toLowerCase().includes(search.toLowerCase());
    const matchAction = filterAction === 'all' || l.action === filterAction;
    return matchSearch && matchAction;
  });

  if (loading) return <div className="flex items-center justify-center min-h-64"><div className="w-8 h-8 border-4 border-amber-200 border-t-amber-600 rounded-full animate-spin" /></div>;

  return (
    <div className="p-6 space-y-6" style={{ background: '#FAF6EF', minHeight: '100%' }}>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">HIPAA Compliance</h1>
          <p className="text-sm text-slate-500 mt-0.5">PHI access audit trail, safeguards status, and privacy accountability.</p>
        </div>
        <div className="text-xs text-slate-500">Automated events from protected workflows</div>
      </div>

      {/* Safeguards status */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {SAFEGUARDS.map(s => {
          const Icon = s.icon;
          return (
            <div key={s.title} className="bg-white rounded-2xl border border-slate-200 p-4">
              <div className="flex items-start gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${s.status === 'active' ? 'bg-emerald-100' : 'bg-amber-100'}`}>
                  <Icon className={`w-4 h-4 ${s.status === 'active' ? 'text-emerald-600' : 'text-amber-600'}`} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-slate-800 text-sm">{s.title}</p>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${s.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                      {s.status === 'active' ? '✓ Active' : 'Review'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{s.desc}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total PHI Events', value: logs.length },
          { label: 'Unique Users', value: new Set(logs.map(l => l.performed_by_id)).size },
          { label: 'Exports / Shares', value: logs.filter(l => ['exported_record', 'shared_record'].includes(l.action)).length },
          { label: 'Deletions', value: logs.filter(l => l.action === 'deleted_record').length },
        ].map(k => (
          <div key={k.label} className="rounded-2xl p-4" style={{ background: '#F0E9DC', border: '1px solid #E0D5C5' }}>
            <p className="text-2xl font-black text-slate-900">{k.value}</p>
            <p className="text-sm text-slate-500">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Audit log */}
      <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #E0D5C5' }}>
        <div className="px-5 py-3 flex items-center gap-3 flex-wrap" style={{ background: '#F0E9DC' }}>
          <Shield className="w-4 h-4 text-amber-600" />
          <span className="font-semibold text-slate-800">PHI Access Audit Log</span>
          <div className="ml-auto flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <Input className="pl-8 h-8 text-xs w-44" placeholder="Search logs…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Select value={filterAction} onValueChange={setFilterAction}>
              <SelectTrigger className="h-8 text-xs w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                {Object.entries(ACTION_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="bg-white overflow-x-auto max-h-96 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white border-b border-slate-100">
              <tr>
                {['Date/Time', 'User', 'Action', 'Resource', 'Description', 'Reason'].map(h => (
                  <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="py-10 text-center text-slate-400 text-sm">No audit logs found.</td></tr>
              )}
              {filtered.map(log => (
                <tr key={log.id} className="hover:bg-slate-50">
                  <td className="py-2 px-4 text-xs text-slate-400 whitespace-nowrap">
                    {log.created_date ? format(new Date(log.created_date), 'MM/dd/yy HH:mm') : '—'}
                  </td>
                  <td className="py-2 px-4 text-sm font-medium text-slate-700">{log.performed_by_name}</td>
                  <td className="py-2 px-4">
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium text-white" style={{ background: ACTION_COLORS[log.action] || '#64748B' }}>
                      {ACTION_LABELS[log.action] || log.action}
                    </span>
                  </td>
                  <td className="py-2 px-4 text-sm text-slate-600">{log.resource_type}</td>
                  <td className="py-2 px-4 text-sm text-slate-500 max-w-xs truncate">{log.description || '—'}</td>
                  <td className="py-2 px-4 text-sm text-slate-400 max-w-xs truncate">{log.access_reason || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
