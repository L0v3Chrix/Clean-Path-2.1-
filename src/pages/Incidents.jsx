import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, Search, AlertTriangle, X, ChevronRight, BarChart2, List } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import IncidentAnalytics from '@/components/incidents/IncidentAnalytics';

const severityColors = {
  low: 'bg-slate-100 text-slate-600',
  medium: 'bg-yellow-100 text-yellow-700',
  high: 'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700',
};

const statusColors = {
  open: 'bg-red-100 text-red-700',
  in_review: 'bg-yellow-100 text-yellow-700',
  resolved: 'bg-green-100 text-green-700',
  closed: 'bg-slate-100 text-slate-600',
};

export default function Incidents() {
  const [incidents, setIncidents] = useState([]);
  const [residents, setResidents] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [view, setView] = useState('list');

  useEffect(() => {
    loadData();
    if (window.location.search.includes('action=new')) setShowForm(true);
  }, []);

  const loadData = async () => {
    try {
      const [inc, res, loc] = await Promise.all([
        base44.entities.IncidentReport.list('-created_date', 100),
        base44.entities.Resident.list(),
        base44.entities.Location.list(),
      ]);
      setIncidents(inc);
      setResidents(res);
      setLocations(loc);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const filtered = incidents.filter(i => {
    const matchSearch = i.type?.includes(search.toLowerCase()) || i.description?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || i.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const residentName = (id) => {
    const r = residents.find(r => r.id === id);
    return r ? `${r.first_name} ${r.last_name}` : 'Unknown';
  };

  const locationName = (id) => locations.find(l => l.id === id)?.name || '—';

  return (
    <div className="p-6" style={{ background: '#FAF6EF', minHeight: '100%' }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#1C1917' }}>Incident Reports</h1>
          <p className="text-sm mt-1" style={{ color: '#78716C' }}>{incidents.filter(i => i.status === 'open').length} open incidents</p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex rounded-xl overflow-hidden border" style={{ borderColor: '#E0D5C5' }}>
            <button
              onClick={() => setView('list')}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors"
              style={view === 'list' ? { background: '#1C1917', color: '#F5EFE6' } : { background: '#F0E9DC', color: '#78716C' }}
            >
              <List className="w-4 h-4" /> List
            </button>
            <button
              onClick={() => setView('analytics')}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors"
              style={view === 'analytics' ? { background: '#1C1917', color: '#F5EFE6' } : { background: '#F0E9DC', color: '#78716C' }}
            >
              <BarChart2 className="w-4 h-4" /> Analytics
            </button>
          </div>
          <Button onClick={() => { setEditing(null); setShowForm(true); }} className="gap-2" style={{ background: '#B45309', color: '#fff' }}>
            <Plus className="w-4 h-4" /> Log Incident
          </Button>
        </div>
      </div>

      {view === 'analytics' ? (
        <IncidentAnalytics incidents={incidents} locations={locations} />
      ) : (
        <>
          <div className="flex gap-3 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input placeholder="Search incidents..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="in_review">In Review</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-2xl overflow-hidden" style={{ background: '#F0E9DC', border: '1px solid #E0D5C5' }}>
            {loading ? (
              <div className="p-4 space-y-2">{[1,2,3].map(i => <div key={i} className="h-14 rounded-xl animate-pulse" style={{ background: '#E5DDD0' }} />)}</div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16">
                <AlertTriangle className="w-10 h-10 mx-auto mb-3" style={{ color: '#C9A227' }} />
                <p style={{ color: '#78716C' }}>No incidents found</p>
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: '#E0D5C5' }}>
                {filtered.map(inc => (
                  <button key={inc.id} className="w-full flex items-center justify-between px-5 py-4 text-left transition-colors hover:bg-amber-50/30" onClick={() => { setEditing(inc); setShowForm(true); }}>
                    <div className="flex items-center gap-4">
                      <div className="w-2 h-8 rounded-full flex-shrink-0" style={{
                        background: inc.severity === 'critical' ? '#EF4444' : inc.severity === 'high' ? '#F97316' : inc.severity === 'medium' ? '#F59E0B' : '#A8B5C0'
                      }} />
                      <div>
                        <p className="font-medium capitalize" style={{ color: '#1C1917' }}>{inc.type?.replace(/_/g, ' ')}</p>
                        <p className="text-xs" style={{ color: '#78716C' }}>{inc.incident_date} · {locationName(inc.location_id)} {inc.resident_id ? `· ${residentName(inc.resident_id)}` : ''}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full capitalize" style={
                        inc.severity === 'critical' ? { background: '#FEE2E2', color: '#991B1B' } :
                        inc.severity === 'high' ? { background: '#FFEDD5', color: '#9A3412' } :
                        inc.severity === 'medium' ? { background: '#FEF3C7', color: '#92400E' } :
                        { background: '#F1F5F9', color: '#475569' }
                      }>{inc.severity}</span>
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full capitalize" style={
                        inc.status === 'open' ? { background: '#FEE2E2', color: '#991B1B' } :
                        inc.status === 'in_review' ? { background: '#FEF3C7', color: '#92400E' } :
                        inc.status === 'resolved' ? { background: '#D1FAE5', color: '#065F46' } :
                        { background: '#F1F5F9', color: '#475569' }
                      }>{inc.status?.replace('_', ' ')}</span>
                      <ChevronRight className="w-4 h-4" style={{ color: '#A09080' }} />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {showForm && (
        <IncidentForm
          incident={editing}
          residents={residents}
          locations={locations}
          onSave={async (data) => {
            if (data.id) await base44.entities.IncidentReport.update(data.id, data);
            else await base44.entities.IncidentReport.create(data);
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

function IncidentForm({ incident, residents, locations, onSave, onClose }) {
  const [form, setForm] = useState(incident || {
    incident_date: new Date().toISOString().split('T')[0],
    incident_time: '', type: '', severity: 'medium', location_id: '', resident_id: '',
    description: '', action_taken: '', follow_up_required: false, follow_up_notes: '',
    status: 'open', naloxone_used: false, ems_called: false, confidential: true,
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b sticky top-0 bg-white">
          <h2 className="font-bold">{incident ? 'Edit Incident Report' : 'Log Incident Report'}</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <form onSubmit={async e => { e.preventDefault(); setSaving(true); await onSave(form); setSaving(false); }} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Date *</Label>
              <Input type="date" value={form.incident_date} onChange={e => set('incident_date', e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>Time</Label>
              <Input type="time" value={form.incident_time} onChange={e => set('incident_time', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Type *</Label>
              <Select value={form.type} onValueChange={v => set('type', v)}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  {['relapse','overdose','behavioral','medical','property_damage','rule_violation','altercation','elopement','other'].map(t => (
                    <SelectItem key={t} value={t} className="capitalize">{t.replace(/_/g, ' ')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Severity</Label>
              <Select value={form.severity} onValueChange={v => set('severity', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Location</Label>
              <Select value={form.location_id} onValueChange={v => set('location_id', v)}>
                <SelectTrigger><SelectValue placeholder="Select location" /></SelectTrigger>
                <SelectContent>
                  {locations.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Resident Involved</Label>
              <Select value={form.resident_id} onValueChange={v => set('resident_id', v)}>
                <SelectTrigger><SelectValue placeholder="Select resident (optional)" /></SelectTrigger>
                <SelectContent>
                  {residents.map(r => <SelectItem key={r.id} value={r.id}>{r.first_name} {r.last_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Description *</Label>
            <Textarea value={form.description} onChange={e => set('description', e.target.value)} rows={4} required />
          </div>
          <div className="space-y-1.5">
            <Label>Action Taken</Label>
            <Textarea value={form.action_taken} onChange={e => set('action_taken', e.target.value)} rows={2} />
          </div>
          <div className="flex flex-wrap gap-4">
            {[
              { key: 'naloxone_used', label: 'Naloxone Used' },
              { key: 'ems_called', label: 'EMS Called' },
              { key: 'follow_up_required', label: 'Follow-up Required' },
              { key: 'confidential', label: 'Confidential' },
            ].map(opt => (
              <label key={opt.key} className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={form[opt.key]} onChange={e => set(opt.key, e.target.checked)} className="rounded" />
                {opt.label}
              </label>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => set('status', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in_review">In Review</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving} className="bg-teal-600 hover:bg-teal-700">
              {saving ? 'Saving...' : incident ? 'Update Report' : 'Submit Report'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}