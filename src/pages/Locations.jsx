import { useState, useEffect } from 'react';
import { appClient } from '@/services/appClient';
import { Plus, Building2, Users, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function Locations() {
  const [locations, setLocations] = useState([]);
  const [residents, setResidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [l, r] = await Promise.all([
        appClient.entities.Location.list(),
        appClient.entities.Resident.list(),
      ]);
      setLocations(l);
      setResidents(r);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const residentCount = (locId) => residents.filter(r => r.location_id === locId && r.status === 'active').length;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Locations</h1>
          <p className="text-slate-500 text-sm mt-1">{locations.filter(l => l.status === 'active').length} active properties</p>
        </div>
        <Button onClick={() => { setEditing(null); setShowForm(true); }} className="bg-teal-600 hover:bg-teal-700 gap-2">
          <Plus className="w-4 h-4" /> Add Location
        </Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="h-40 bg-slate-100 rounded-2xl animate-pulse" />)}
        </div>
      ) : locations.length === 0 ? (
        <div className="text-center py-16">
          <Building2 className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          <p className="text-slate-500 font-medium">No locations added yet</p>
          <Button onClick={() => setShowForm(true)} className="mt-4 bg-teal-600 hover:bg-teal-700">Add your first property</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {locations.map(loc => {
            const count = residentCount(loc.id);
            const occupancy = loc.total_beds > 0 ? Math.round((count / loc.total_beds) * 100) : 0;
            return (
              <Card key={loc.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => { setEditing(loc); setShowForm(true); }}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 bg-teal-100 rounded-xl flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-teal-600" />
                    </div>
                    <Badge className={loc.status === 'active' ? 'bg-green-100 text-green-700 border-0' : 'bg-slate-100 text-slate-500 border-0'}>
                      {loc.status}
                    </Badge>
                  </div>
                  <h3 className="font-semibold text-slate-800 mb-1">{loc.name}</h3>
                  <p className="text-xs text-slate-500 mb-3">{loc.city}, {loc.state} · {loc.housing_type || 'Recovery Residence'}</p>
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1 text-slate-600">
                      <Users className="w-3 h-3" />
                      <span>{count}/{loc.total_beds || '?'} beds</span>
                    </div>
                    {loc.narr_level && loc.narr_level !== 'not_applicable' && (
                      <Badge variant="outline" className="text-xs">NARR Level {loc.narr_level}</Badge>
                    )}
                  </div>
                  {loc.total_beds > 0 && (
                    <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${occupancy > 90 ? 'bg-red-400' : occupancy > 70 ? 'bg-yellow-400' : 'bg-teal-400'}`} style={{ width: `${occupancy}%` }} />
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {showForm && (
        <LocationForm
          location={editing}
          onSave={async (data) => {
            if (data.id) await appClient.entities.Location.update(data.id, data);
            else await appClient.entities.Location.create({ ...data, organization_id: 'default' });
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

function LocationForm({ location, onSave, onClose }) {
  const [form, setForm] = useState(location || {
    name: '', address: '', city: '', state: '', zip: '',
    housing_type: '', narr_level: 'II', total_beds: '', phone: '', status: 'active', notes: '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b sticky top-0 bg-white">
          <h2 className="font-bold">{location ? 'Edit Location' : 'Add Location'}</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <form onSubmit={async e => { e.preventDefault(); setSaving(true); await onSave(form); setSaving(false); }} className="p-5 space-y-4">
          <div className="space-y-1.5">
            <Label>Property Name *</Label>
            <Input value={form.name} onChange={e => set('name', e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>Address</Label>
            <Input value={form.address} onChange={e => set('address', e.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5 col-span-1">
              <Label>City</Label>
              <Input value={form.city} onChange={e => set('city', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>State</Label>
              <Input value={form.state} onChange={e => set('state', e.target.value)} maxLength={2} />
            </div>
            <div className="space-y-1.5">
              <Label>ZIP</Label>
              <Input value={form.zip} onChange={e => set('zip', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Housing Type</Label>
              <Input value={form.housing_type} onChange={e => set('housing_type', e.target.value)} placeholder="e.g. Sober Living, Recovery Home" />
            </div>
            <div className="space-y-1.5">
              <Label>NARR Level</Label>
              <Select value={form.narr_level} onValueChange={v => set('narr_level', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="I">Level I</SelectItem>
                  <SelectItem value="II">Level II</SelectItem>
                  <SelectItem value="III">Level III</SelectItem>
                  <SelectItem value="IV">Level IV</SelectItem>
                  <SelectItem value="not_applicable">Not Applicable</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Total Beds</Label>
              <Input type="number" value={form.total_beds} onChange={e => set('total_beds', Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input value={form.phone} onChange={e => set('phone', e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving} className="bg-teal-600 hover:bg-teal-700">
              {saving ? 'Saving...' : location ? 'Save Changes' : 'Add Location'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}