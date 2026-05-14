import { useState } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

const FREQUENCY_LABELS = {
  once_daily: 'Once Daily', twice_daily: 'Twice Daily', three_times_daily: 'Three Times Daily',
  four_times_daily: 'Four Times Daily', every_morning: 'Every Morning', every_evening: 'Every Evening',
  weekly: 'Weekly', as_needed: 'As Needed', other: 'Other',
};

const DEFAULT_TIMES = {
  once_daily: ['08:00'], twice_daily: ['08:00', '20:00'],
  three_times_daily: ['08:00', '13:00', '20:00'], four_times_daily: ['08:00', '12:00', '17:00', '21:00'],
  every_morning: ['08:00'], every_evening: ['20:00'], weekly: ['08:00'], as_needed: [], other: [],
};

export default function MedicationForm({ resident, editing, onSave, onClose }) {
  const [form, setForm] = useState(editing || {
    resident_id: resident.id,
    organization_id: resident.organization_id,
    name: '', generic_name: '', dosage: '', form: 'tablet', route: 'oral',
    frequency: 'once_daily', scheduled_times: ['08:00'],
    prescriber: '', pharmacy: '', rx_number: '',
    start_date: new Date().toISOString().split('T')[0], end_date: '',
    instructions: '', controlled_substance: false, mat_medication: false,
    status: 'active', notes: '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleFrequencyChange = (v) => {
    set('frequency', v);
    if (!editing) set('scheduled_times', DEFAULT_TIMES[v] || []);
  };

  const updateTime = (idx, val) => {
    const times = [...(form.scheduled_times || [])];
    times[idx] = val;
    set('scheduled_times', times);
  };

  const addTime = () => set('scheduled_times', [...(form.scheduled_times || []), '08:00']);
  const removeTime = (idx) => set('scheduled_times', form.scheduled_times.filter((_, i) => i !== idx));

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
      <div className="rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[92vh] flex flex-col" style={{ background: '#FAF6EF' }}>
        <div className="flex items-center justify-between p-5 border-b flex-shrink-0" style={{ borderColor: '#E0D5C5' }}>
          <h3 className="font-bold" style={{ color: '#1C1917' }}>{editing ? 'Edit Medication' : 'Add Medication'}</h3>
          <button onClick={onClose}><X className="w-5 h-5" style={{ color: '#78716C' }} /></button>
        </div>
        <form
          onSubmit={async e => { e.preventDefault(); setSaving(true); await onSave(form); setSaving(false); }}
          className="p-5 space-y-4 overflow-y-auto"
        >
          {/* Name + Dosage */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Medication Name *</Label>
              <Input placeholder="e.g. Metformin" value={form.name} onChange={e => set('name', e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>Dosage *</Label>
              <Input placeholder="e.g. 500mg" value={form.dosage} onChange={e => set('dosage', e.target.value)} required />
            </div>
          </div>

          {/* Form + Route */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Form</Label>
              <Select value={form.form} onValueChange={v => set('form', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['tablet','capsule','liquid','injection','patch','inhaler','topical','other'].map(f => (
                    <SelectItem key={f} value={f} className="capitalize">{f}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Route</Label>
              <Select value={form.route} onValueChange={v => set('route', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['oral','sublingual','injection','topical','inhalation','other'].map(r => (
                    <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Frequency + Scheduled Times */}
          <div className="space-y-1.5">
            <Label>Frequency *</Label>
            <Select value={form.frequency} onValueChange={handleFrequencyChange}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(FREQUENCY_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {form.frequency !== 'as_needed' && (
            <div className="space-y-2">
              <Label>Scheduled Times</Label>
              <div className="space-y-2">
                {(form.scheduled_times || []).map((t, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input type="time" value={t} onChange={e => updateTime(i, e.target.value)} className="flex-1" />
                    <button type="button" onClick={() => removeTime(i)} className="p-1.5 rounded hover:bg-red-50">
                      <Trash2 className="w-4 h-4" style={{ color: '#DC2626' }} />
                    </button>
                  </div>
                ))}
                <button type="button" onClick={addTime} className="flex items-center gap-1.5 text-xs font-medium hover:underline" style={{ color: '#B45309' }}>
                  <Plus className="w-3.5 h-3.5" /> Add time
                </button>
              </div>
            </div>
          )}

          {/* Prescriber + Pharmacy */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Prescriber</Label>
              <Input placeholder="Dr. Smith" value={form.prescriber} onChange={e => set('prescriber', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Pharmacy</Label>
              <Input placeholder="CVS, Walgreens…" value={form.pharmacy} onChange={e => set('pharmacy', e.target.value)} />
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Start Date</Label>
              <Input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>End Date (if applicable)</Label>
              <Input type="date" value={form.end_date} onChange={e => set('end_date', e.target.value)} />
            </div>
          </div>

          {/* Instructions */}
          <div className="space-y-1.5">
            <Label>Special Instructions</Label>
            <Input placeholder="e.g. Take with food, avoid alcohol" value={form.instructions} onChange={e => set('instructions', e.target.value)} />
          </div>

          {/* Flags */}
          <div className="flex flex-wrap gap-5">
            {[
              { key: 'controlled_substance', label: 'Controlled Substance' },
              { key: 'mat_medication', label: 'MAT Medication' },
            ].map(opt => (
              <label key={opt.key} className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <input type="checkbox" checked={!!form[opt.key]} onChange={e => set(opt.key, e.target.checked)} className="rounded" />
                {opt.label}
              </label>
            ))}
          </div>

          {/* Status */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => set('status', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                  <SelectItem value="discontinued">Discontinued</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Inventory */}
          <div className="rounded-xl p-3 space-y-3" style={{ background: '#F0E9DC', border: '1px solid #E0D5C5' }}>
            <p className="text-xs font-bold uppercase tracking-wide" style={{ color: '#B45309' }}>Inventory Tracking (optional)</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Current Quantity</Label>
                <Input type="number" min="0" step="0.5" placeholder="e.g. 30"
                  value={form.current_quantity ?? ''}
                  onChange={e => set('current_quantity', e.target.value === '' ? undefined : parseFloat(e.target.value))} />
              </div>
              <div className="space-y-1.5">
                <Label>Unit</Label>
                <Input placeholder="tablets, mL…"
                  value={form.quantity_unit || ''}
                  onChange={e => set('quantity_unit', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Low-Stock Threshold</Label>
                <Input type="number" min="0" placeholder="e.g. 7"
                  value={form.low_stock_threshold ?? ''}
                  onChange={e => set('low_stock_threshold', e.target.value === '' ? undefined : parseFloat(e.target.value))} />
              </div>
              <div className="space-y-1.5">
                <Label>Reorder Quantity</Label>
                <Input type="number" min="0" placeholder="e.g. 30"
                  value={form.reorder_quantity ?? ''}
                  onChange={e => set('reorder_quantity', e.target.value === '' ? undefined : parseFloat(e.target.value))} />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea placeholder="Additional notes…" value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving} style={{ background: '#B45309', color: '#fff' }}>
              {saving ? 'Saving…' : 'Save Medication'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}