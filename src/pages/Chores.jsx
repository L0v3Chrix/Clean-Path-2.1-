import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import {
  Plus, RefreshCw, CheckCircle2, Circle, Clock, AlertTriangle,
  Trash2, Edit2, X, Loader2, ChevronLeft, ChevronRight, Users,
  Home, Leaf, Star, Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { format, startOfWeek, addWeeks, subWeeks } from 'date-fns';

// ─── Config ─────────────────────────────────────────────────────────────────
const AREA_LABELS = {
  kitchen: '🍳 Kitchen', bathroom: '🚿 Bathroom', living_room: '🛋️ Living Room',
  yard: '🌿 Yard', laundry: '🧺 Laundry', common_area: '🏠 Common Area',
  trash: '🗑️ Trash', bedroom: '🛏️ Bedroom', other: '📋 Other',
};
const STATUS_CONFIG = {
  pending:   { label: 'Pending',   color: 'bg-slate-100 text-slate-600' },
  completed: { label: 'Done',      color: 'bg-blue-100 text-blue-700' },
  verified:  { label: 'Verified',  color: 'bg-green-100 text-green-700' },
  missed:    { label: 'Missed',    color: 'bg-red-100 text-red-700' },
};

function getWeekStart(date) {
  return startOfWeek(date, { weekStartsOn: 1 }); // Monday
}
function fmtDate(d) {
  return format(new Date(d), 'MMM d');
}

// ─── Chore Template Form ────────────────────────────────────────────────────
function ChoreTemplateForm({ template, locationId, orgId, onSave, onClose }) {
  const [form, setForm] = useState(template || {
    organization_id: orgId,
    location_id: locationId,
    name: '',
    description: '',
    area: 'common_area',
    frequency: 'weekly',
    estimated_minutes: 30,
    instructions: '',
    requires_verification: true,
    active: true,
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    if (form.id) {
      await base44.entities.ChoreTemplate.update(form.id, form);
    } else {
      await base44.entities.ChoreTemplate.create(form);
    }
    setSaving(false);
    onSave();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b">
          <h3 className="font-bold text-slate-800">{form.id ? 'Edit Chore' : 'New Chore'}</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="space-y-1.5">
            <Label>Chore Name *</Label>
            <Input placeholder="e.g. Kitchen Cleaning" value={form.name} onChange={e => set('name', e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Area</Label>
              <Select value={form.area} onValueChange={v => set('area', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(AREA_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Frequency</Label>
              <Select value={form.frequency} onValueChange={v => set('frequency', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="biweekly">Bi-weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Est. Minutes</Label>
            <Input type="number" min={5} max={480} value={form.estimated_minutes} onChange={e => set('estimated_minutes', +e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Instructions (shown to resident)</Label>
            <Textarea rows={2} placeholder="Step-by-step or tips…" value={form.instructions} onChange={e => set('instructions', e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input type="checkbox" checked={form.requires_verification} onChange={e => set('requires_verification', e.target.checked)} />
            Requires staff verification
          </label>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving} className="bg-teal-600 hover:bg-teal-700 text-white">
              {saving ? 'Saving…' : 'Save Chore'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function Chores() {
  const [org, setOrg] = useState(null);
  const [locations, setLocations] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState('');
  const [templates, setTemplates] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [weekStart, setWeekStart] = useState(getWeekStart(new Date()));
  const [tab, setTab] = useState('schedule'); // schedule | templates
  const [showForm, setShowForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [verifyingId, setVerifyingId] = useState(null);
  const [user, setUser] = useState(null);

  useEffect(() => {
    Promise.all([
      base44.auth.me(),
      base44.entities.Organization.list(),
      base44.entities.Location.filter({ status: 'active' }),
    ]).then(([u, orgs, locs]) => {
      setUser(u);
      setOrg(orgs[0]);
      setLocations(locs);
      if (locs.length) setSelectedLocation(locs[0].id);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (selectedLocation) {
      loadTemplates();
      loadAssignments();
    }
  }, [selectedLocation, weekStart]);

  const loadTemplates = () =>
    base44.entities.ChoreTemplate.filter({ location_id: selectedLocation }).then(setTemplates);

  const loadAssignments = () =>
    base44.entities.ChoreAssignment.filter({
      location_id: selectedLocation,
      week_label: `Week of ${weekStart.toISOString().split('T')[0]}`,
    }).then(data => setAssignments(data.sort((a, b) => a.due_date.localeCompare(b.due_date))));

  const handleGenerate = async () => {
    setGenerating(true);
    await base44.functions.invoke('generateChoreRotation', {
      location_id: selectedLocation,
      organization_id: org?.id,
      week_start_date: weekStart.toISOString().split('T')[0],
    });
    await loadAssignments();
    setGenerating(false);
  };

  const handleVerify = async (assignment) => {
    setVerifyingId(assignment.id);
    await base44.entities.ChoreAssignment.update(assignment.id, {
      status: 'verified',
      verified_by_name: user?.full_name || 'Staff',
      verified_at: new Date().toISOString(),
    });
    await loadAssignments();
    setVerifyingId(null);
  };

  const handleMarkMissed = async (id) => {
    await base44.entities.ChoreAssignment.update(id, { status: 'missed' });
    await loadAssignments();
  };

  const handleDeleteTemplate = async (id) => {
    if (!confirm('Delete this chore template?')) return;
    await base44.entities.ChoreTemplate.delete(id);
    loadTemplates();
  };

  const toggleTemplate = async (t) => {
    await base44.entities.ChoreTemplate.update(t.id, { active: !t.active });
    loadTemplates();
  };

  // Group assignments by day
  const byDay = assignments.reduce((acc, a) => {
    if (!acc[a.due_date]) acc[a.due_date] = [];
    acc[a.due_date].push(a);
    return acc;
  }, {});

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d.toISOString().split('T')[0];
  });

  const stats = {
    total: assignments.length,
    pending: assignments.filter(a => a.status === 'pending').length,
    completed: assignments.filter(a => a.status === 'completed').length,
    verified: assignments.filter(a => a.status === 'verified').length,
    missed: assignments.filter(a => a.status === 'missed').length,
  };

  if (loading) return <div className="p-8 text-center text-slate-400">Loading…</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Chore Management</h1>
          <p className="text-slate-500 text-sm mt-1">Define household responsibilities and manage rotating schedules</p>
        </div>
        {locations.length > 1 && (
          <Select value={selectedLocation} onValueChange={setSelectedLocation}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Select location" /></SelectTrigger>
            <SelectContent>
              {locations.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-lg p-1 mb-6 w-fit">
        {[['schedule','📅 Schedule'],['templates','🗂️ Chore Library']].map(([v,l]) => (
          <button key={v} onClick={() => setTab(v)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${tab===v ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            {l}
          </button>
        ))}
      </div>

      {/* ── SCHEDULE TAB ── */}
      {tab === 'schedule' && (
        <div className="space-y-5">
          {/* Week nav + generate */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <button onClick={() => setWeekStart(subWeeks(weekStart, 1))} className="p-1.5 rounded-lg border hover:bg-slate-50">
                <ChevronLeft className="w-4 h-4 text-slate-500" />
              </button>
              <span className="text-sm font-semibold text-slate-700 min-w-48 text-center">
                {format(weekStart, 'MMM d')} – {format(addWeeks(weekStart, 1), 'MMM d, yyyy')}
              </span>
              <button onClick={() => setWeekStart(addWeeks(weekStart, 1))} className="p-1.5 rounded-lg border hover:bg-slate-50">
                <ChevronRight className="w-4 h-4 text-slate-500" />
              </button>
            </div>
            <Button onClick={handleGenerate} disabled={generating} className="gap-2 bg-teal-600 hover:bg-teal-700 text-white">
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              {generating ? 'Generating…' : 'Generate Rotation'}
            </Button>
          </div>

          {/* Stats row */}
          {assignments.length > 0 && (
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: 'Total', val: stats.total, color: 'text-slate-700' },
                { label: 'Pending', val: stats.pending, color: 'text-amber-600' },
                { label: 'Completed', val: stats.completed + stats.verified, color: 'text-green-600' },
                { label: 'Missed', val: stats.missed, color: 'text-red-500' },
              ].map(s => (
                <div key={s.label} className="bg-white border border-slate-200 rounded-xl p-3 text-center">
                  <p className={`text-2xl font-black ${s.color}`}>{s.val}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
          )}

          {/* Daily columns */}
          {assignments.length === 0 ? (
            <div className="text-center py-16 border-2 border-dashed border-slate-200 rounded-2xl">
              <RefreshCw className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="font-semibold text-slate-500">No schedule for this week</p>
              <p className="text-sm text-slate-400 mt-1">Click "Generate Rotation" to auto-assign chores to active residents.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {weekDays.map(day => {
                const dayAssignments = byDay[day] || [];
                if (!dayAssignments.length) return null;
                return (
                  <div key={day}>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
                      {format(new Date(day + 'T12:00:00'), 'EEEE, MMM d')}
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {dayAssignments.map(a => {
                        const sc = STATUS_CONFIG[a.status];
                        return (
                          <div key={a.id} className={`bg-white border rounded-xl p-4 space-y-2 ${a.status === 'missed' ? 'opacity-60' : ''}`}>
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="font-semibold text-slate-800 text-sm">{a.chore_name}</p>
                                <p className="text-xs text-slate-400">{AREA_LABELS[a.area] || a.area}</p>
                              </div>
                              <Badge className={`${sc.color} border-0 text-xs flex-shrink-0`}>{sc.label}</Badge>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 text-xs font-bold flex-shrink-0">
                                {a.resident_name?.split(' ').map(n => n[0]).join('')}
                              </div>
                              <p className="text-xs text-slate-600 font-medium">{a.resident_name}</p>
                            </div>
                            {a.estimated_minutes && (
                              <p className="text-xs text-slate-400 flex items-center gap-1">
                                <Clock className="w-3 h-3" /> ~{a.estimated_minutes} min
                              </p>
                            )}
                            {a.staff_notes && <p className="text-xs text-slate-500 italic">{a.staff_notes}</p>}
                            {/* Staff actions */}
                            <div className="flex gap-1.5 pt-1">
                              {a.status === 'completed' && (
                                <Button size="sm" className="h-7 text-xs flex-1 bg-green-600 hover:bg-green-700 text-white gap-1"
                                  onClick={() => handleVerify(a)} disabled={verifyingId === a.id}>
                                  {verifyingId === a.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Star className="w-3 h-3" />}
                                  Verify
                                </Button>
                              )}
                              {a.status === 'verified' && (
                                <p className="text-xs text-green-600 font-medium flex items-center gap-1">
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Verified by {a.verified_by_name}
                                </p>
                              )}
                              {a.status === 'pending' && (
                                <Button size="sm" variant="outline" className="h-7 text-xs flex-1 gap-1 border-red-200 text-red-500 hover:bg-red-50"
                                  onClick={() => handleMarkMissed(a.id)}>
                                  <AlertTriangle className="w-3 h-3" /> Mark Missed
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── TEMPLATES TAB ── */}
      {tab === 'templates' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => { setEditingTemplate(null); setShowForm(true); }} className="gap-2 bg-teal-600 hover:bg-teal-700 text-white">
              <Plus className="w-4 h-4" /> New Chore
            </Button>
          </div>

          {templates.length === 0 ? (
            <div className="text-center py-16 border-2 border-dashed border-slate-200 rounded-2xl">
              <Home className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="font-semibold text-slate-500">No chores defined yet</p>
              <p className="text-sm text-slate-400 mt-1">Add household responsibilities to get started.</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {templates.map(t => (
                <div key={t.id} className={`bg-white border rounded-xl p-4 space-y-2 ${!t.active ? 'opacity-50' : ''}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-slate-800">{t.name}</p>
                      <p className="text-xs text-slate-400">{AREA_LABELS[t.area] || t.area} · {t.frequency} · ~{t.estimated_minutes}min</p>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => { setEditingTemplate(t); setShowForm(true); }} className="p-1.5 rounded-lg hover:bg-slate-100">
                        <Edit2 className="w-3.5 h-3.5 text-slate-500" />
                      </button>
                      <button onClick={() => handleDeleteTemplate(t.id)} className="p-1.5 rounded-lg hover:bg-red-50">
                        <Trash2 className="w-3.5 h-3.5 text-red-400" />
                      </button>
                    </div>
                  </div>
                  {t.instructions && <p className="text-xs text-slate-500 leading-relaxed">{t.instructions}</p>}
                  <div className="flex items-center justify-between">
                    <div className="flex gap-1.5">
                      {t.requires_verification && (
                        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">Needs verification</span>
                      )}
                    </div>
                    <button onClick={() => toggleTemplate(t)} className={`text-xs font-medium px-2 py-0.5 rounded-full transition-colors ${t.active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                      {t.active ? 'Active' : 'Inactive'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showForm && (
        <ChoreTemplateForm
          template={editingTemplate}
          locationId={selectedLocation}
          orgId={org?.id}
          onSave={() => { setShowForm(false); setEditingTemplate(null); loadTemplates(); }}
          onClose={() => { setShowForm(false); setEditingTemplate(null); }}
        />
      )}
    </div>
  );
}