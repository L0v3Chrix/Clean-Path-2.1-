import { useState, useEffect } from 'react';
import { appClient } from '@/services/appClient';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Plus, UserCheck, UserX } from 'lucide-react';

const EXIT_REASONS = [
  { value: 'completed_program', label: 'Completed Program' },
  { value: 'voluntary_exit', label: 'Voluntary Exit' },
  { value: 'administrative_discharge', label: 'Administrative Discharge' },
  { value: 'relocated', label: 'Relocated' },
  { value: 'deceased', label: 'Deceased' },
  { value: 'lost_contact', label: 'Lost Contact' },
  { value: 'other', label: 'Other' },
];

export default function GrantEnrollmentPanel({ grant, orgId }) {
  const [enrollments, setEnrollments] = useState([]);
  const [residents, setResidents] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newEnrollment, setNewEnrollment] = useState({ resident_id: '', enrollment_date: new Date().toISOString().split('T')[0] });
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const [enrs, res] = await Promise.all([
      appClient.entities.GrantEnrollment.filter({ grant_id: grant.id }),
      appClient.entities.Resident.filter({ status: 'active' }),
    ]);
    setEnrollments(enrs);
    setResidents(res);
    setLoading(false);
  };

  useEffect(() => { load(); }, [grant.id]);

  const enrolledIds = new Set(enrollments.filter(e => !e.exit_date).map(e => e.resident_id));
  const unenrolled = residents.filter(r => !enrolledIds.has(r.id));

  const handleAdd = async () => {
    if (!newEnrollment.resident_id || !newEnrollment.enrollment_date) return;
    await appClient.entities.GrantEnrollment.create({
      ...newEnrollment,
      grant_id: grant.id,
      organization_id: orgId,
    });
    setShowAdd(false);
    setNewEnrollment({ resident_id: '', enrollment_date: new Date().toISOString().split('T')[0] });
    load();
  };

  const handleExit = async (enrollment) => {
    const reason = prompt('Exit reason (optional):') || 'voluntary_exit';
    await appClient.entities.GrantEnrollment.update(enrollment.id, {
      exit_date: new Date().toISOString().split('T')[0],
      exit_reason: reason,
    });
    load();
  };

  const residentName = (id) => {
    const r = residents.find(r => r.id === id);
    return r ? `${r.first_name} ${r.last_name}` : 'Unknown';
  };

  const active = enrollments.filter(e => !e.exit_date);
  const exited = enrollments.filter(e => e.exit_date);

  if (loading) return <div className="p-4 text-center text-slate-400 text-sm">Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-slate-700">
            <span className="text-2xl font-black text-amber-700">{new Set(enrollments.map(e => e.resident_id)).size}</span> unique individuals enrolled
          </span>
          <span className="text-xs text-slate-400">({active.length} active, {exited.length} exited)</span>
        </div>
        <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white text-xs" onClick={() => setShowAdd(true)}>
          <Plus className="w-3.5 h-3.5" /> Enroll Resident
        </Button>
      </div>

      {showAdd && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold text-amber-800">Enroll a Resident</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-500">Resident</label>
              <Select value={newEnrollment.resident_id} onValueChange={v => setNewEnrollment(f => ({ ...f, resident_id: v }))}>
                <SelectTrigger className="mt-1 bg-white"><SelectValue placeholder="Select resident…" /></SelectTrigger>
                <SelectContent>
                  {unenrolled.map(r => <SelectItem key={r.id} value={r.id}>{r.first_name} {r.last_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">Enrollment Date</label>
              <Input className="mt-1 bg-white" type="date" value={newEnrollment.enrollment_date} onChange={e => setNewEnrollment(f => ({ ...f, enrollment_date: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white" onClick={handleAdd} disabled={!newEnrollment.resident_id}>
              Enroll
            </Button>
          </div>
        </div>
      )}

      {/* Active enrollments */}
      {active.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase mb-2">Currently Enrolled ({active.length})</p>
          <div className="space-y-1.5">
            {active.map(e => (
              <div key={e.id} className="bg-white rounded-xl border border-slate-100 px-4 py-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-emerald-500" />
                  <span className="text-sm font-medium text-slate-700">{residentName(e.resident_id)}</span>
                  <span className="text-xs text-slate-400">since {e.enrollment_date}</span>
                </div>
                <button onClick={() => handleExit(e)} className="text-xs text-red-400 hover:text-red-600 flex items-center gap-1">
                  <UserX className="w-3.5 h-3.5" /> Exit
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Exited */}
      {exited.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase mb-2">Exited ({exited.length})</p>
          <div className="space-y-1.5">
            {exited.map(e => (
              <div key={e.id} className="bg-slate-50 rounded-xl border border-slate-100 px-4 py-2.5 flex items-center justify-between opacity-70">
                <div className="flex items-center gap-2">
                  <UserX className="w-4 h-4 text-slate-400" />
                  <span className="text-sm text-slate-600">{residentName(e.resident_id)}</span>
                  <span className="text-xs text-slate-400">{e.enrollment_date} → {e.exit_date}</span>
                </div>
                <span className="text-xs text-slate-400 capitalize">{e.exit_reason?.replace(/_/g, ' ') || '—'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {enrollments.length === 0 && !showAdd && (
        <div className="text-center py-8 text-slate-400 text-sm">
          No residents enrolled yet. Click "Enroll Resident" to begin.
        </div>
      )}
    </div>
  );
}