import { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

export default function ResidentForm({ resident, locations, onSave, onClose }) {
  const [form, setForm] = useState(resident || {
    first_name: '', last_name: '', date_of_birth: '', gender: '',
    phone: '', email: '', location_id: '', room: '', status: 'applicant',
    intake_date: new Date().toISOString().split('T')[0],
    sober_date: '', recovery_pathway: '', referred_by: '',
    emergency_contact_name: '', emergency_contact_phone: '', emergency_contact_relationship: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white">
          <h2 className="text-lg font-bold">{resident ? 'Edit Resident' : 'New Intake'}</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>First Name *</Label>
              <Input value={form.first_name} onChange={e => set('first_name', e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>Last Name *</Label>
              <Input value={form.last_name} onChange={e => set('last_name', e.target.value)} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Date of Birth</Label>
              <Input type="date" value={form.date_of_birth} onChange={e => set('date_of_birth', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Gender</Label>
              <Select value={form.gender} onValueChange={v => set('gender', v)}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="non_binary">Non-Binary</SelectItem>
                  <SelectItem value="transgender">Transgender</SelectItem>
                  <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input value={form.phone} onChange={e => set('phone', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={e => set('email', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Location *</Label>
              <Select value={form.location_id} onValueChange={v => set('location_id', v)}>
                <SelectTrigger><SelectValue placeholder="Select location" /></SelectTrigger>
                <SelectContent>
                  {locations.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Room</Label>
              <Input value={form.room} onChange={e => set('room', e.target.value)} placeholder="e.g. 2B" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Intake Date</Label>
              <Input type="date" value={form.intake_date} onChange={e => set('intake_date', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Sobriety / Recovery Date</Label>
              <Input type="date" value={form.sober_date} onChange={e => set('sober_date', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => set('status', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="applicant">Applicant</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="on_leave">On Leave</SelectItem>
                  <SelectItem value="exited">Exited</SelectItem>
                  <SelectItem value="alumni">Alumni</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Recovery Pathway</Label>
              <Select value={form.recovery_pathway} onValueChange={v => set('recovery_pathway', v)}>
                <SelectTrigger><SelectValue placeholder="Select pathway" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="12_step">12-Step</SelectItem>
                  <SelectItem value="smart_recovery">SMART Recovery</SelectItem>
                  <SelectItem value="faith_based">Faith-Based</SelectItem>
                  <SelectItem value="mat">Medication-Assisted (MAT)</SelectItem>
                  <SelectItem value="harm_reduction">Harm Reduction</SelectItem>
                  <SelectItem value="peer_support">Peer Support</SelectItem>
                  <SelectItem value="refuge_recovery">Refuge Recovery</SelectItem>
                  <SelectItem value="secular">Secular/Non-12-Step</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Referred By</Label>
            <Input value={form.referred_by} onChange={e => set('referred_by', e.target.value)} placeholder="Organization, person, or source" />
          </div>

          <div className="border-t pt-4">
            <p className="text-sm font-semibold text-slate-700 mb-3">Emergency Contact</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input value={form.emergency_contact_name} onChange={e => set('emergency_contact_name', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input value={form.emergency_contact_phone} onChange={e => set('emergency_contact_phone', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Relationship</Label>
                <Input value={form.emergency_contact_relationship} onChange={e => set('emergency_contact_relationship', e.target.value)} />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={3} />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving} className="bg-teal-600 hover:bg-teal-700">
              {saving ? 'Saving...' : resident ? 'Save Changes' : 'Complete Intake'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}