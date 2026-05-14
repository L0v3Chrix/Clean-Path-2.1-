import { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const TYPES = ['relapse','overdose','behavioral','medical','property_damage','rule_violation','altercation','elopement','other'];

export default function IncidentForm({ incident, residents, locations, staff, onSave, onClose }) {
  const [form, setForm] = useState(incident ? { ...incident } : {
    incident_date: new Date().toISOString().split('T')[0],
    incident_time: new Date().toTimeString().slice(0,5),
    type: '',
    severity: 'medium',
    location_id: '',
    resident_id: '',
    reported_by_id: '',
    involved_staff_names: '',
    description: '',
    action_taken: '',
    follow_up_required: false,
    follow_up_notes: '',
    status: 'open',
    naloxone_used: false,
    ems_called: false,
    confidential: true,
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl" style={{ background: '#FAF6EF' }}>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b flex-shrink-0" style={{ borderColor: '#E0D5C5' }}>
          <div>
            <h2 className="font-bold text-base" style={{ color: '#1C1917' }}>
              {incident ? 'Edit Incident Report' : 'Log Incident Report'}
            </h2>
            <p className="text-xs mt-0.5" style={{ color: '#78716C' }}>All incidents are stored confidentially by default</p>
          </div>
          <button onClick={onClose}><X className="w-5 h-5" style={{ color: '#78716C' }} /></button>
        </div>

        <form
          onSubmit={async e => { e.preventDefault(); setSaving(true); await onSave(form); setSaving(false); }}
          className="p-5 space-y-4 overflow-y-auto"
        >
          {/* Section: When & Where */}
          <p className="text-xs font-bold uppercase tracking-wide" style={{ color: '#B45309' }}>When & Where</p>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>Date *</Label>
              <Input type="date" value={form.incident_date} onChange={e => set('incident_date', e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>Time</Label>
              <Input type="time" value={form.incident_time} onChange={e => set('incident_time', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Location</Label>
              <Select value={form.location_id || ''} onValueChange={v => set('location_id', v)}>
                <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>
                  {locations.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Section: Incident Details */}
          <p className="text-xs font-bold uppercase tracking-wide pt-1" style={{ color: '#B45309' }}>Incident Details</p>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Type *</Label>
              <Select value={form.type} onValueChange={v => set('type', v)}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  {TYPES.map(t => (
                    <SelectItem key={t} value={t} className="capitalize">{t.replace(/_/g, ' ')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Severity *</Label>
              <Select value={form.severity} onValueChange={v => set('severity', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">🟢 Low</SelectItem>
                  <SelectItem value="medium">🟡 Medium</SelectItem>
                  <SelectItem value="high">🟠 High</SelectItem>
                  <SelectItem value="critical">🔴 Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Resident Involved</Label>
            <Select value={form.resident_id || ''} onValueChange={v => set('resident_id', v)}>
              <SelectTrigger><SelectValue placeholder="Select resident (optional)" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={null}>None</SelectItem>
                {residents.map(r => <SelectItem key={r.id} value={r.id}>{r.first_name} {r.last_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Description *</Label>
            <Textarea
              placeholder="Describe what happened, circumstances, and any immediate observations…"
              value={form.description}
              onChange={e => set('description', e.target.value)}
              rows={4}
              required
            />
          </div>

          {/* Section: People Involved */}
          <p className="text-xs font-bold uppercase tracking-wide pt-1" style={{ color: '#B45309' }}>People Involved</p>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Reporting Staff</Label>
              <Select value={form.reported_by_id || ''} onValueChange={v => set('reported_by_id', v)}>
                <SelectTrigger><SelectValue placeholder="Select staff member" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>Not specified</SelectItem>
                  {staff.map(s => <SelectItem key={s.id} value={s.id}>{s.first_name} {s.last_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Other Involved Staff</Label>
              <Input
                placeholder="Names of other staff present…"
                value={form.involved_staff_names || ''}
                onChange={e => set('involved_staff_names', e.target.value)}
              />
            </div>
          </div>

          {/* Section: Response */}
          <p className="text-xs font-bold uppercase tracking-wide pt-1" style={{ color: '#B45309' }}>Response & Follow-up</p>
          <div className="space-y-1.5">
            <Label>Immediate Action Taken</Label>
            <Textarea
              placeholder="Steps taken immediately after the incident…"
              value={form.action_taken}
              onChange={e => set('action_taken', e.target.value)}
              rows={2}
            />
          </div>

          {/* Quick flags */}
          <div className="flex flex-wrap gap-5">
            {[
              { key: 'naloxone_used', label: '💉 Naloxone Used' },
              { key: 'ems_called', label: '🚑 EMS Called' },
              { key: 'follow_up_required', label: '📋 Follow-up Required' },
              { key: 'confidential', label: '🔒 Confidential' },
            ].map(opt => (
              <label key={opt.key} className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <input type="checkbox" checked={!!form[opt.key]} onChange={e => set(opt.key, e.target.checked)} className="rounded" />
                {opt.label}
              </label>
            ))}
          </div>

          {form.follow_up_required && (
            <div className="space-y-1.5">
              <Label>Follow-up Notes</Label>
              <Textarea
                placeholder="Describe the required follow-up actions…"
                value={form.follow_up_notes}
                onChange={e => set('follow_up_notes', e.target.value)}
                rows={2}
              />
            </div>
          )}

          {/* Status */}
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={v => set('status', v)}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="open">🔴 Open</SelectItem>
                <SelectItem value="in_review">🟡 In Review</SelectItem>
                <SelectItem value="resolved">🟢 Resolved</SelectItem>
                <SelectItem value="closed">⚫ Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving} style={{ background: '#B45309', color: '#fff' }}>
              {saving ? 'Saving…' : incident ? 'Update Report' : 'Submit Report'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}