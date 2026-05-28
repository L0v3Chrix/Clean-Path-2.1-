import { useState, useEffect, useMemo } from 'react';
import { appClient } from '@/services/appClient';
import { Plus, Activity, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine
} from 'recharts';
import { format, parseISO } from 'date-fns';

// ─── Vital definitions ────────────────────────────────────────────────────────
const VITALS = [
  { key: 'weight_lbs',        label: 'Weight',          unit: 'lbs',   color: '#B45309', refLow: null, refHigh: null },
  { key: 'bp_systolic',       label: 'BP Systolic',     unit: 'mmHg',  color: '#DC2626', refLow: 90,   refHigh: 140 },
  { key: 'bp_diastolic',      label: 'BP Diastolic',    unit: 'mmHg',  color: '#EA580C', refLow: 60,   refHigh: 90  },
  { key: 'heart_rate',        label: 'Heart Rate',      unit: 'bpm',   color: '#E11D48', refLow: 60,   refHigh: 100 },
  { key: 'temperature_f',     label: 'Temperature',     unit: '°F',    color: '#7C3AED', refLow: 97,   refHigh: 99  },
  { key: 'oxygen_saturation', label: 'SpO₂',            unit: '%',     color: '#0891B2', refLow: 95,   refHigh: null },
  { key: 'blood_glucose',     label: 'Blood Glucose',   unit: 'mg/dL', color: '#059669', refLow: 70,   refHigh: 140 },
  { key: 'respiratory_rate',  label: 'Resp. Rate',      unit: 'brpm',  color: '#6366F1', refLow: 12,   refHigh: 20  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function isOutOfRange(v, refLow, refHigh) {
  if (v == null) return false;
  if (refLow != null && v < refLow) return true;
  if (refHigh != null && v > refHigh) return true;
  return false;
}

function LatestCard({ vital, value, date }) {
  const out = isOutOfRange(value, vital.refLow, vital.refHigh);
  return (
    <div className="rounded-xl p-3 flex flex-col gap-0.5" style={{
      background: out ? '#FEF2F2' : '#F0E9DC',
      border: `1px solid ${out ? '#FECACA' : '#E0D5C5'}`,
    }}>
      <p className="text-xs" style={{ color: '#78716C' }}>{vital.label}</p>
      {value != null ? (
        <>
          <p className="text-lg font-black" style={{ color: out ? '#DC2626' : '#1C1917' }}>
            {value}<span className="text-xs font-medium ml-0.5" style={{ color: '#78716C' }}>{vital.unit}</span>
          </p>
          {out && <p className="text-xs font-semibold" style={{ color: '#DC2626' }}>⚠ Out of range</p>}
          <p className="text-xs" style={{ color: '#A09080' }}>{date}</p>
        </>
      ) : (
        <p className="text-sm" style={{ color: '#C4B8A8' }}>No data</p>
      )}
    </div>
  );
}

function VitalChart({ vital, readings }) {
  const data = readings
    .filter(r => r[vital.key] != null)
    .map(r => ({ date: r.recorded_date, value: r[vital.key] }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-30);

  if (data.length < 2) return (
    <div className="h-20 flex items-center justify-center text-xs" style={{ color: '#A09080' }}>
      Need ≥2 readings to show trend
    </div>
  );

  return (
    <ResponsiveContainer width="100%" height={90}>
      <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -28 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E0D5C5" />
        <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#A09080' }}
          tickFormatter={d => { try { return format(parseISO(d), 'M/d'); } catch { return d; } }} />
        <YAxis tick={{ fontSize: 9, fill: '#A09080' }} />
        {vital.refHigh != null && <ReferenceLine y={vital.refHigh} stroke="#FBBF24" strokeDasharray="4 2" />}
        {vital.refLow  != null && <ReferenceLine y={vital.refLow}  stroke="#FBBF24" strokeDasharray="4 2" />}
        <Tooltip
          contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #E0D5C5', background: '#FAF6EF' }}
          formatter={v => [`${v} ${vital.unit}`, vital.label]}
          labelFormatter={d => { try { return format(parseISO(d), 'MMM d, yyyy'); } catch { return d; } }}
        />
        <Line type="monotone" dataKey="value" stroke={vital.color} strokeWidth={2} dot={{ r: 3, fill: vital.color }} activeDot={{ r: 5 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function VitalSection({ vital, readings }) {
  const [open, setOpen] = useState(false);
  const sectionReadings = readings.filter(r => r[vital.key] != null);
  if (sectionReadings.length === 0) return null;

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #E0D5C5' }}>
      <button
        className="w-full flex items-center justify-between px-4 py-3 transition-colors hover:bg-amber-50/40"
        style={{ background: '#F0E9DC' }}
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: vital.color }} />
          <span className="text-sm font-semibold" style={{ color: '#1C1917' }}>{vital.label}</span>
          <span className="text-xs" style={{ color: '#78716C' }}>{sectionReadings.length} readings</span>
        </div>
        {open ? <ChevronDown className="w-4 h-4" style={{ color: '#A09080' }} /> : <ChevronRight className="w-4 h-4" style={{ color: '#A09080' }} />}
      </button>
      {open && (
        <div className="p-4" style={{ background: '#FEFCF8' }}>
          <VitalChart vital={vital} readings={readings} />
        </div>
      )}
    </div>
  );
}

// ─── Log Form ─────────────────────────────────────────────────────────────────
function LogForm({ resident, onSave, onClose }) {
  const [form, setForm] = useState({
    resident_id: resident.id,
    organization_id: resident.organization_id || '',
    recorded_date: new Date().toISOString().split('T')[0],
    recorded_time: new Date().toTimeString().slice(0, 5),
    recorded_by_name: '',
    weight_lbs: '', bp_systolic: '', bp_diastolic: '', heart_rate: '',
    temperature_f: '', oxygen_saturation: '', blood_glucose: '', respiratory_rate: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const hasAnyVital = VITALS.some(v => form[v.key] !== '');

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
      <div className="rounded-2xl w-full max-w-md shadow-2xl max-h-[92vh] flex flex-col overflow-hidden" style={{ background: '#FAF6EF' }}>
        <div className="flex items-center justify-between p-5 border-b flex-shrink-0" style={{ borderColor: '#E0D5C5' }}>
          <h3 className="font-bold" style={{ color: '#1C1917' }}>Log Vitals</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>
        <form
          onSubmit={async e => {
            e.preventDefault();
            if (!hasAnyVital) return;
            setSaving(true);
            const payload = { ...form };
            VITALS.forEach(v => { if (payload[v.key] === '') delete payload[v.key]; else payload[v.key] = parseFloat(payload[v.key]); });
            await appClient.entities.VitalReading.create(payload);
            onSave();
            setSaving(false);
          }}
          className="p-5 space-y-4 overflow-y-auto"
        >
          {/* Date / Time / Recorder */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" value={form.recorded_date} onChange={e => set('recorded_date', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Time</Label>
              <Input type="time" value={form.recorded_time} onChange={e => set('recorded_time', e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Recorded By</Label>
            <Input placeholder="Staff name" value={form.recorded_by_name} onChange={e => set('recorded_by_name', e.target.value)} />
          </div>

          {/* Vital fields */}
          <p className="text-xs font-bold uppercase tracking-wide pt-1" style={{ color: '#B45309' }}>Measurements (fill in what you have)</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Weight (lbs)</Label>
              <Input type="number" step="0.1" placeholder="e.g. 165.5" value={form.weight_lbs} onChange={e => set('weight_lbs', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Temperature (°F)</Label>
              <Input type="number" step="0.1" placeholder="e.g. 98.6" value={form.temperature_f} onChange={e => set('temperature_f', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>BP Systolic (mmHg)</Label>
              <Input type="number" placeholder="e.g. 120" value={form.bp_systolic} onChange={e => set('bp_systolic', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>BP Diastolic (mmHg)</Label>
              <Input type="number" placeholder="e.g. 80" value={form.bp_diastolic} onChange={e => set('bp_diastolic', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Heart Rate (bpm)</Label>
              <Input type="number" placeholder="e.g. 72" value={form.heart_rate} onChange={e => set('heart_rate', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>SpO₂ (%)</Label>
              <Input type="number" placeholder="e.g. 98" value={form.oxygen_saturation} onChange={e => set('oxygen_saturation', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Blood Glucose (mg/dL)</Label>
              <Input type="number" placeholder="e.g. 95" value={form.blood_glucose} onChange={e => set('blood_glucose', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Resp. Rate (brpm)</Label>
              <Input type="number" placeholder="e.g. 16" value={form.respiratory_rate} onChange={e => set('respiratory_rate', e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea placeholder="Any observations or context…" value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving || !hasAnyVital} style={{ background: '#B45309', color: '#fff' }}>
              {saving ? 'Saving…' : 'Save Vitals'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── History Table ─────────────────────────────────────────────────────────────
function HistoryRow({ reading, onDelete }) {
  const [open, setOpen] = useState(false);
  const filled = VITALS.filter(v => reading[v.key] != null);
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #E0D5C5', background: '#FEFCF8' }}>
      <button className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-amber-50/30" onClick={() => setOpen(o => !o)}>
        <div className="text-left">
          <p className="text-sm font-medium" style={{ color: '#1C1917' }}>{reading.recorded_date}{reading.recorded_time ? ` · ${reading.recorded_time}` : ''}</p>
          <p className="text-xs" style={{ color: '#78716C' }}>
            {filled.map(v => `${v.label}: ${reading[v.key]}${v.unit}`).join('  ·  ')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {reading.recorded_by_name && <span className="text-xs" style={{ color: '#A09080' }}>{reading.recorded_by_name}</span>}
          {open ? <ChevronDown className="w-3.5 h-3.5" style={{ color: '#A09080' }} /> : <ChevronRight className="w-3.5 h-3.5" style={{ color: '#A09080' }} />}
        </div>
      </button>
      {open && (
        <div className="px-4 pb-3 border-t" style={{ borderColor: '#E0D5C5' }}>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {filled.map(v => (
              <div key={v.key}>
                <p className="text-xs" style={{ color: '#78716C' }}>{v.label}</p>
                <p className="text-sm font-semibold" style={{ color: isOutOfRange(reading[v.key], v.refLow, v.refHigh) ? '#DC2626' : '#1C1917' }}>
                  {reading[v.key]} {v.unit}
                  {isOutOfRange(reading[v.key], v.refLow, v.refHigh) && ' ⚠'}
                </p>
              </div>
            ))}
          </div>
          {reading.notes && <p className="text-xs mt-2 italic" style={{ color: '#78716C' }}>{reading.notes}</p>}
          <button onClick={() => onDelete(reading.id)} className="mt-2 text-xs flex items-center gap-1 hover:underline" style={{ color: '#DC2626' }}>
            <Trash2 className="w-3 h-3" /> Delete reading
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function VitalsTracker({ resident }) {
  const [readings, setReadings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  const load = async () => {
    setLoading(true);
    const data = await appClient.entities.VitalReading.filter({ resident_id: resident.id }, '-recorded_date', 200);
    setReadings(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, [resident.id]);

  const deleteReading = async (id) => {
    if (!confirm('Delete this reading?')) return;
    await appClient.entities.VitalReading.delete(id);
    load();
  };

  // Latest value per vital
  const latest = useMemo(() => {
    const map = {};
    VITALS.forEach(v => {
      const r = readings.find(rd => rd[v.key] != null);
      map[v.key] = r ? { value: r[v.key], date: r.recorded_date } : null;
    });
    return map;
  }, [readings]);

  const alerts = VITALS.filter(v => latest[v.key] && isOutOfRange(latest[v.key].value, v.refLow, v.refHigh));

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold" style={{ color: '#1C1917' }}>Vitals Tracker</h3>
          {alerts.length > 0 && (
            <p className="text-xs font-semibold mt-0.5" style={{ color: '#DC2626' }}>
              ⚠ {alerts.length} reading{alerts.length > 1 ? 's' : ''} out of normal range
            </p>
          )}
        </div>
        <Button size="sm" onClick={() => setShowForm(true)} className="gap-1.5" style={{ background: '#B45309', color: '#fff' }}>
          <Plus className="w-3.5 h-3.5" /> Log Vitals
        </Button>
      </div>

      {/* Sub-tabs */}
      <div className="flex rounded-xl overflow-hidden border text-xs" style={{ borderColor: '#E0D5C5' }}>
        {[['overview', 'Overview'], ['trends', 'Trends'], ['history', 'History']].map(([v, l]) => (
          <button key={v} onClick={() => setActiveTab(v)}
            className="flex-1 py-2 font-medium transition-colors"
            style={activeTab === v ? { background: '#1C1917', color: '#F5EFE6' } : { background: '#F0E9DC', color: '#78716C' }}>
            {l}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background: '#E5DDD0' }} />)}</div>
      ) : readings.length === 0 && activeTab !== 'history' ? (
        <div className="text-center py-12 rounded-2xl" style={{ background: '#F0E9DC', border: '1px dashed #C9B99A' }}>
          <Activity className="w-9 h-9 mx-auto mb-2" style={{ color: '#C9A227' }} />
          <p className="font-semibold" style={{ color: '#1C1917' }}>No vitals recorded</p>
          <p className="text-sm mt-1" style={{ color: '#78716C' }}>Log the first reading to start tracking health trends.</p>
        </div>
      ) : (
        <>
          {/* Overview: latest cards grid */}
          {activeTab === 'overview' && (
            <div className="grid grid-cols-2 gap-2">
              {VITALS.map(v => (
                <LatestCard key={v.key} vital={v} value={latest[v.key]?.value} date={latest[v.key]?.date} />
              ))}
            </div>
          )}

          {/* Trends: collapsible charts per vital */}
          {activeTab === 'trends' && (
            <div className="space-y-2">
              {VITALS.map(v => <VitalSection key={v.key} vital={v} readings={readings} />)}
              {VITALS.every(v => readings.filter(r => r[v.key] != null).length === 0) && (
                <p className="text-center py-8 text-sm" style={{ color: '#A09080' }}>No data available for trends.</p>
              )}
            </div>
          )}

          {/* History: all readings */}
          {activeTab === 'history' && (
            <div className="space-y-2">
              {readings.length === 0 ? (
                <p className="text-center py-8 text-sm" style={{ color: '#A09080' }}>No readings logged yet.</p>
              ) : readings.map(r => (
                <HistoryRow key={r.id} reading={r} onDelete={deleteReading} />
              ))}
            </div>
          )}
        </>
      )}

      {showForm && <LogForm resident={resident} onSave={() => { setShowForm(false); load(); }} onClose={() => setShowForm(false)} />}
    </div>
  );
}