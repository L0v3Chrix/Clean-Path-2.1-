import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, Search, AlertTriangle, X, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

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
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Incident Reports</h1>
          <p className="text-slate-500 text-sm mt-1">{incidents.filter(i => i.status === 'open').length} open incidents</p>
        </div>
        <Button onClick={() => { setEditing(null); setShowForm(true); }} className="bg-teal-600 hover:bg-teal-700 gap-2">
          <Plus className="w-4 h-4" /> Log Incident
        </Button>
      </div>

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

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-2">{[1,2,3].map(i => <div key={i} className="h-14 bg-slate-100 rounded animate-pulse" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16">
              <AlertTriangle className="w-10 h-10 mx-auto mb-3 text-slate-300" />
              <p className="text-slate-500">No incidents found</p>
            </div>
          ) : (
            <div className="divide-y">
              {filtered.map(inc => (
                <button key={inc.id} className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 text-left" onClick={() => { setEditing(inc); setShowForm(true); }}>
                  <div className="flex items-center gap-4">
                    <div className={`w-2 h-8 rounded-full flex-shrink-0 ${
                      inc.severity === 'critical' ? 'bg-red-500' :
                      inc.severity === 'high' ? 'bg-orange-500' :
                      inc.severity === 'medium' ? 'bg-yellow-500' : 'bg-slate-300'
                    }`} />
                    <div>
                      <p className="font-medium text-slate-800 capitalize">{inc.type?.replace(/_/g, ' ')}</p>
                      <p className="text-xs text-slate-500">{inc.incident_date} · {locationName(inc.location_id)} {inc.resident_id ? `· ${residentName(inc.resident_id)}` : ''}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={`${severityColors[inc.severity] || ''} border-0 text-xs capitalize`}>{inc.severity}</Badge>
                    <Badge className={`${statusColors[inc.status] || ''} border-0 text-xs capitalize`}>{inc.status}</Badge>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

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