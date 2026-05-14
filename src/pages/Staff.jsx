import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, User, X, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const roleColors = {
  platform_admin: 'bg-red-100 text-red-700',
  owner: 'bg-purple-100 text-purple-700',
  director: 'bg-indigo-100 text-indigo-700',
  house_manager: 'bg-teal-100 text-teal-700',
  peer_support: 'bg-green-100 text-green-700',
  case_manager: 'bg-blue-100 text-blue-700',
  staff: 'bg-slate-100 text-slate-600',
  volunteer: 'bg-yellow-100 text-yellow-700',
};

export default function Staff() {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  useEffect(() => { loadData(); }, []);
  const loadData = async () => {
    try {
      setStaff(await base44.entities.StaffMember.list('-created_date', 100));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Staff</h1>
          <p className="text-slate-500 text-sm mt-1">{staff.filter(s => s.status === 'active').length} active staff members</p>
        </div>
        <Button onClick={() => { setEditing(null); setShowForm(true); }} className="bg-teal-600 hover:bg-teal-700 gap-2">
          <Plus className="w-4 h-4" /> Add Staff
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-2">{[1,2,3].map(i => <div key={i} className="h-14 bg-slate-100 rounded animate-pulse" />)}</div>
          ) : staff.length === 0 ? (
            <div className="text-center py-16">
              <User className="w-10 h-10 mx-auto mb-3 text-slate-300" />
              <p className="text-slate-500">No staff members added yet</p>
            </div>
          ) : (
            <div className="divide-y">
              {staff.map(s => (
                <button key={s.id} className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 text-left" onClick={() => { setEditing(s); setShowForm(true); }}>
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 font-bold text-sm">
                      {s.first_name?.[0]}{s.last_name?.[0]}
                    </div>
                    <div>
                      <p className="font-medium text-slate-800">{s.first_name} {s.last_name}</p>
                      <p className="text-xs text-slate-500">{s.email} {s.title ? `· ${s.title}` : ''}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {s.lived_experience && <Badge className="bg-teal-100 text-teal-700 border-0 text-xs">Lived Experience</Badge>}
                    <Badge className={`${roleColors[s.role] || 'bg-slate-100 text-slate-600'} border-0 text-xs capitalize`}>
                      {s.role?.replace(/_/g, ' ')}
                    </Badge>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {showForm && (
        <StaffForm
          member={editing}
          onSave={async (data) => {
            if (data.id) await base44.entities.StaffMember.update(data.id, data);
            else await base44.entities.StaffMember.create({ ...data, organization_id: 'default' });
            setShowForm(false);
            setEditing(null);
            loadData();
          }}
          onClose={() => { setShowForm(false); setEditing(null); }}
        />
      )}
    </div>
  );
}

function StaffForm({ member, onSave, onClose }) {
  const [form, setForm] = useState(member || {
    first_name: '', last_name: '', email: '', phone: '',
    role: 'staff', title: '', hire_date: '', status: 'active', lived_experience: false,
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="font-bold">{member ? 'Edit Staff Member' : 'Add Staff Member'}</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <form onSubmit={async e => { e.preventDefault(); setSaving(true); await onSave(form); setSaving(false); }} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5"><Label>First Name *</Label><Input value={form.first_name} onChange={e => set('first_name', e.target.value)} required /></div>
            <div className="space-y-1.5"><Label>Last Name *</Label><Input value={form.last_name} onChange={e => set('last_name', e.target.value)} required /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={form.email} onChange={e => set('email', e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Phone</Label><Input value={form.phone} onChange={e => set('phone', e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Role *</Label>
              <Select value={form.role} onValueChange={v => set('role', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['platform_admin','owner','director','house_manager','peer_support','case_manager','staff','volunteer'].map(r => (
                    <SelectItem key={r} value={r} className="capitalize">{r.replace(/_/g, ' ')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Job Title</Label><Input value={form.title} onChange={e => set('title', e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5"><Label>Hire Date</Label><Input type="date" value={form.hire_date} onChange={e => set('hire_date', e.target.value)} /></div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => set('status', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={form.lived_experience} onChange={e => set('lived_experience', e.target.checked)} className="rounded" />
            Has lived experience in recovery
          </label>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving} className="bg-teal-600 hover:bg-teal-700">
              {saving ? 'Saving...' : member ? 'Save Changes' : 'Add Staff Member'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}