import { useState } from 'react';
import { X, CheckCircle2, XCircle, AlertCircle, Clock, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { appClient } from '@/services/appClient';

const OUTCOMES = [
  { value: 'administered',      label: 'Administered',      icon: CheckCircle2, color: '#059669', bg: '#D1FAE5' },
  { value: 'self_administered', label: 'Self-Administered',  icon: User,         color: '#0891B2', bg: '#CFFAFE' },
  { value: 'missed',            label: 'Missed',             icon: XCircle,      color: '#DC2626', bg: '#FEE2E2' },
  { value: 'refused',           label: 'Refused',            icon: AlertCircle,  color: '#EA580C', bg: '#FFEDD5' },
  { value: 'held',              label: 'Held / Withheld',    icon: Clock,        color: '#D97706', bg: '#FEF3C7' },
];

export default function DoseLogModal({ medication, resident, prefill, onSave, onClose }) {
  const [form, setForm] = useState({
    resident_id: resident.id,
    organization_id: resident.organization_id,
    medication_id: medication.id,
    scheduled_date: prefill?.date || new Date().toISOString().split('T')[0],
    scheduled_time: prefill?.time || '',
    outcome: 'administered',
    administered_at: new Date().toISOString().slice(0, 16),
    administered_by_name: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaveError('');
    try {
      await appClient.entities.MedicationLog.create(form);
      await onSave();
    } catch (error) {
      setSaveError(error.message || 'Unable to log this dose.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4">
      <div className="rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden" style={{ background: '#FAF6EF' }}>
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: '#E0D5C5' }}>
          <div>
            <h3 className="font-bold text-sm" style={{ color: '#1C1917' }}>Log Dose</h3>
            <p className="text-xs mt-0.5" style={{ color: '#78716C' }}>{medication.name} · {medication.dosage}</p>
          </div>
          <button onClick={onClose}><X className="w-5 h-5" style={{ color: '#78716C' }} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Outcome selector */}
          <div className="space-y-1.5">
            <Label>Outcome *</Label>
            <div className="grid grid-cols-1 gap-2">
              {OUTCOMES.map(o => {
                const Icon = o.icon;
                const selected = form.outcome === o.value;
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => set('outcome', o.value)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 text-left transition-all"
                    style={{
                      borderColor: selected ? o.color : '#E0D5C5',
                      background: selected ? o.bg : '#FEFCF8',
                    }}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" style={{ color: o.color }} />
                    <span className="text-sm font-medium" style={{ color: selected ? o.color : '#1C1917' }}>{o.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" value={form.scheduled_date} onChange={e => set('scheduled_date', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Scheduled Time</Label>
              <Input type="time" value={form.scheduled_time} onChange={e => set('scheduled_time', e.target.value)} />
            </div>
          </div>

          {(form.outcome === 'administered' || form.outcome === 'self_administered') && (
            <div className="space-y-1.5">
              <Label>Administered By</Label>
              <Input placeholder="Staff name" value={form.administered_by_name} onChange={e => set('administered_by_name', e.target.value)} />
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea placeholder="Any observations…" value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} />
          </div>

          {saveError && <p role="alert" className="text-sm text-red-700">{saveError}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancel</Button>
            <Button type="submit" size="sm" disabled={saving} style={{ background: '#B45309', color: '#fff' }}>
              {saving ? 'Saving…' : 'Log Dose'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
