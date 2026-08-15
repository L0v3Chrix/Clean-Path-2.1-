import { useState, useEffect, useMemo } from 'react';
import { appClient } from '@/services/appClient';
import { Plus, ChevronLeft, ChevronRight, Trash2, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format, addDays, startOfWeek, isToday } from 'date-fns';

const ROLE_CFG = {
  primary:   { bg: '#D1FAE5', color: '#065F46', label: 'Primary' },
  secondary: { bg: '#DBEAFE', color: '#1E40AF', label: 'Secondary' },
  on_call:   { bg: '#F3F4F6', color: '#374151', label: 'On Call' },
};

const STATUS_CFG = {
  scheduled:  { bg: '#FEF3C7', color: '#92400E' },
  completed:  { bg: '#D1FAE5', color: '#065F46' },
  cancelled:  { bg: '#FEE2E2', color: '#991B1B' },
  no_show:    { bg: '#F3E8FF', color: '#6B21A8' },
};

function ShiftForm({ shift, staff, locations, onSave, onClose }) {
  const [form, setForm] = useState(shift || {
    shift_date: new Date().toISOString().split('T')[0],
    start_time: '08:00',
    end_time: '16:00',
    staff_id: '',
    location_id: '',
    role_label: 'primary',
    status: 'scheduled',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="rounded-2xl w-full max-w-lg shadow-2xl" style={{ background: '#FAF6EF' }}>
        <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: '#E0D5C5' }}>
          <h2 className="font-bold" style={{ color: '#1C1917' }}>{shift ? 'Edit Shift' : 'Assign Shift'}</h2>
          <button onClick={onClose} className="text-sm" style={{ color: '#78716C' }}>✕</button>
        </div>
        <form
          className="p-5 space-y-4"
          onSubmit={async e => {
            e.preventDefault();
            setSaving(true);
            setError('');
            try { await onSave(form); } catch (saveError) { setError(saveError.message); }
            finally { setSaving(false); }
          }}
        >
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
              <Label>Staff Member *</Label>
              <Select value={form.staff_id} onValueChange={v => {
                const s = staff.find(s => s.id === v);
                set('staff_id', v);
                set('staff_name', s ? `${s.first_name} ${s.last_name}` : '');
              }}>
                <SelectTrigger><SelectValue placeholder="Select staff" /></SelectTrigger>
                <SelectContent>
                  {staff.filter(s => s.status === 'active').map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.first_name} {s.last_name} — {s.role?.replace('_', ' ')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>Date *</Label>
              <Input type="date" value={form.shift_date} onChange={e => set('shift_date', e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>Start Time *</Label>
              <Input type="time" value={form.start_time} onChange={e => set('start_time', e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>End Time *</Label>
              <Input type="time" value={form.end_time} onChange={e => set('end_time', e.target.value)} required />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={form.role_label} onValueChange={v => set('role_label', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="primary">Primary</SelectItem>
                  <SelectItem value="secondary">Secondary</SelectItem>
                  <SelectItem value="on_call">On Call</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => set('status', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  <SelectItem value="no_show">No Show</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Input placeholder="Any shift notes…" value={form.notes || ''} onChange={e => set('notes', e.target.value)} />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving} style={{ background: '#B45309', color: '#fff' }}>
              {saving ? 'Saving…' : shift ? 'Update Shift' : 'Assign Shift'}
            </Button>
          </div>
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        </form>
      </div>
    </div>
  );
}

export default function Scheduling() {
  const [shifts, setShifts]       = useState([]);
  const [staff, setStaff]         = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [showForm, setShowForm]   = useState(false);
  const [editing, setEditing]     = useState(null);
  const [locFilter, setLocFilter] = useState('all');
  const [user, setUser]           = useState(null);

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    const [sh, st, lc, currentUser] = await Promise.all([
      appClient.entities.Shift.list('-shift_date', 500),
      appClient.entities.StaffMember.list(),
      appClient.entities.Location.list(),
      appClient.auth.me(),
    ]);
    setShifts(sh);
    setStaff(st);
    setLocations(lc);
    setUser(currentUser);
    setLoading(false);
  };

  const weekShifts = useMemo(() => {
    const weekDates = weekDays.map(d => format(d, 'yyyy-MM-dd'));
    return shifts.filter(s =>
      weekDates.includes(s.shift_date) &&
      (locFilter === 'all' || s.location_id === locFilter)
    );
  }, [shifts, weekDays, locFilter]);

  const shiftsForDay = (date) => {
    const d = format(date, 'yyyy-MM-dd');
    return weekShifts.filter(s => s.shift_date === d).sort((a, b) => a.start_time?.localeCompare(b.start_time));
  };

  const staffName = (id) => {
    const s = staff.find(s => s.id === id);
    return s ? `${s.first_name} ${s.last_name}` : '—';
  };

  const handleSave = async (data) => {
    if (data.id) await appClient.entities.Shift.update(data.id, data);
    else await appClient.entities.Shift.create({ ...data, organization_id: user?.organization_id });
    setShowForm(false);
    setEditing(null);
    loadAll();
  };

  const handleDelete = async (id) => {
    await appClient.entities.Shift.delete(id);
    setShifts(prev => prev.filter(s => s.id !== id));
  };

  // Today's on-duty summary across all locations
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const todayShifts = shifts.filter(s => s.shift_date === todayStr && s.status === 'scheduled');

  return (
    <div className="p-6" style={{ background: '#FAF6EF', minHeight: '100%' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#1C1917' }}>Staff Scheduling</h1>
          <p className="text-sm mt-0.5" style={{ color: '#78716C' }}>
            {todayShifts.length} staff on duty today
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={locFilter} onValueChange={setLocFilter}>
            <SelectTrigger className="w-44"><SelectValue placeholder="All locations" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Locations</SelectItem>
              {locations.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={() => { setEditing(null); setShowForm(true); }} style={{ background: '#B45309', color: '#fff' }} className="gap-2">
            <Plus className="w-4 h-4" /> Assign Shift
          </Button>
        </div>
      </div>

      {/* Today on-duty strip */}
      {todayShifts.length > 0 && (
        <div className="rounded-xl p-4 mb-5" style={{ background: '#D1FAE5', border: '1px solid #A7F3D0' }}>
          <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: '#065F46' }}>On Duty Now</p>
          <div className="flex flex-wrap gap-2">
            {todayShifts.map(s => (
              <div key={s.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/70 text-sm" style={{ color: '#1C1917' }}>
                <div className="w-2 h-2 rounded-full" style={{ background: ROLE_CFG[s.role_label]?.color || '#065F46' }} />
                <span className="font-medium">{s.staff_name || staffName(s.staff_id)}</span>
                <span style={{ color: '#78716C' }}>
                  {locations.find(l => l.id === s.location_id)?.name || '—'}
                </span>
                <span style={{ color: '#A09080' }}>{s.start_time}–{s.end_time}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Week navigator */}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={() => setWeekStart(d => addDays(d, -7))}
          className="p-2 rounded-lg hover:bg-amber-100 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" style={{ color: '#B45309' }} />
        </button>
        <span className="text-sm font-semibold" style={{ color: '#1C1917' }}>
          {format(weekStart, 'MMM d')} – {format(addDays(weekStart, 6), 'MMM d, yyyy')}
        </span>
        <button
          onClick={() => setWeekStart(d => addDays(d, 7))}
          className="p-2 rounded-lg hover:bg-amber-100 transition-colors"
        >
          <ChevronRight className="w-4 h-4" style={{ color: '#B45309' }} />
        </button>
        <button
          onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}
          className="text-xs px-3 py-1.5 rounded-lg"
          style={{ background: '#F0E9DC', color: '#B45309' }}
        >
          This Week
        </button>
      </div>

      {/* Weekly grid */}
      {loading ? (
        <div className="grid grid-cols-7 gap-2">
          {Array(7).fill(0).map((_, i) => (
            <div key={i} className="h-48 rounded-xl animate-pulse" style={{ background: '#E5DDD0' }} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          {weekDays.map(day => {
            const dayShifts = shiftsForDay(day);
            const today = isToday(day);
            return (
              <div
                key={day.toISOString()}
                className="rounded-xl p-3 min-h-32"
                style={{
                  background: today ? '#FEF3C7' : '#F0E9DC',
                  border: `1px solid ${today ? '#F59E0B' : '#E0D5C5'}`,
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-xs font-bold uppercase" style={{ color: today ? '#B45309' : '#78716C' }}>
                      {format(day, 'EEE')}
                    </p>
                    <p className="text-lg font-black leading-none" style={{ color: today ? '#B45309' : '#1C1917' }}>
                      {format(day, 'd')}
                    </p>
                  </div>
                  <button
                    onClick={() => { setEditing({ shift_date: format(day, 'yyyy-MM-dd') }); setShowForm(true); }}
                    className="p-1 rounded hover:bg-amber-200 transition-colors"
                    title="Add shift"
                  >
                    <Plus className="w-3.5 h-3.5" style={{ color: '#B45309' }} />
                  </button>
                </div>

                <div className="space-y-1.5">
                  {dayShifts.length === 0 && (
                    <p className="text-xs italic" style={{ color: '#A09080' }}>No shifts</p>
                  )}
                  {dayShifts.map(s => {
                    const rc = ROLE_CFG[s.role_label] || ROLE_CFG.primary;
                    const sc = STATUS_CFG[s.status] || STATUS_CFG.scheduled;
                    return (
                      <div
                        key={s.id}
                        role="button"
                        tabIndex={0}
                        aria-label={`Edit shift for ${s.staff_name || staffName(s.staff_id)} on ${s.shift_date} from ${s.start_time} to ${s.end_time}`}
                        className="rounded-lg p-2 group relative cursor-pointer hover:shadow-sm transition-shadow"
                        style={{ background: sc.bg, border: `1px solid ${rc.color}20` }}
                        onClick={() => { setEditing(s); setShowForm(true); }}
                        onKeyDown={event => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            setEditing(s);
                            setShowForm(true);
                          }
                        }}
                      >
                        <p className="text-xs font-semibold truncate" style={{ color: '#1C1917' }}>
                          {s.staff_name || staffName(s.staff_id)}
                        </p>
                        <p className="text-xs" style={{ color: '#78716C' }}>
                          {s.start_time}–{s.end_time}
                        </p>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-xs px-1.5 py-0.5 rounded-full font-medium" style={{ background: rc.bg, color: rc.color }}>
                            {rc.label}
                          </span>
                          <button
                            onClick={e => { e.stopPropagation(); handleDelete(s.id); }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 className="w-3 h-3" style={{ color: '#DC2626' }} />
                          </button>
                        </div>
                        {locFilter === 'all' && locations.find(l => l.id === s.location_id) && (
                          <p className="text-xs mt-1 truncate flex items-center gap-1" style={{ color: '#A09080' }}>
                            <MapPin className="w-2.5 h-2.5" />
                            {locations.find(l => l.id === s.location_id)?.name}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <ShiftForm
          shift={editing}
          staff={staff}
          locations={locations}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditing(null); }}
        />
      )}
    </div>
  );
}
