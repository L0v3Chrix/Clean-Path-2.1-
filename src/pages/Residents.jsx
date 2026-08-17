import { useState, useEffect } from 'react';
import { appClient } from '@/services/appClient';
import { Link } from 'react-router-dom';
import { Plus, Search, User, ChevronRight, AlertTriangle, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ResidentForm from '@/components/residents/ResidentForm';
import ResidentDetail from '@/components/residents/ResidentDetail';
import ResidentAlertBadge from '@/components/residents/ResidentAlertBadge';
import DocumentAlertPanel from '@/components/residents/DocumentAlertPanel';
import { getResidentAlerts } from '@/lib/residentAlerts';
import { applyResidentAccountLink } from '@/lib/residentAccess';

const statusColors = {
  applicant: 'bg-blue-100 text-blue-700',
  active: 'bg-green-100 text-green-700',
  on_leave: 'bg-yellow-100 text-yellow-700',
  exited: 'bg-slate-100 text-slate-600',
  alumni: 'bg-purple-100 text-purple-700',
};

export default function Residents() {
  const [residents, setResidents] = useState([]);
  const [locations, setLocations] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [organizationId, setOrganizationId] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('all');
  const [alertFilter, setAlertFilter] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [selectedResident, setSelectedResident] = useState(null);

  useEffect(() => {
    loadData();
    // Check for ?action=new
    if (window.location.search.includes('action=new')) setShowForm(true);
  }, []);

  const loadData = async () => {
    try {
      const [r, l, d, c, me] = await Promise.all([
        appClient.entities.Resident.list('-created_date', 200),
        appClient.entities.Location.list(),
        appClient.entities.ResidentDocument.list(),
        appClient.entities.ResidentContact.list(),
        appClient.auth.me(),
      ]);
      setResidents(r);
      setLocations(l);
      setDocuments(d);
      setContacts(c);
      setCurrentUser(me);
      setOrganizationId(me.organization_id || r[0]?.organization_id || l[0]?.organization_id || null);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const getAlerts = (resident) => getResidentAlerts(resident, documents.filter(d => d.resident_id === resident.id));

  const filtered = residents.filter(r => {
    const name = `${r.first_name} ${r.last_name}`.toLowerCase();
    const matchSearch = name.includes(search.toLowerCase()) || r.email?.includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || r.status === statusFilter;
    const matchLocation = locationFilter === 'all' || r.location_id === locationFilter;
    const matchAlert = !alertFilter || getAlerts(r).length > 0;
    return matchSearch && matchStatus && matchLocation && matchAlert;
  });

  const totalAlerts = residents.filter(r => getAlerts(r).length > 0).length;

  const withEmergencyContact = (resident) => {
    const contact = contacts.find(c => c.resident_id === resident.id && c.is_emergency_contact);
    if (!contact) return resident;
    return {
      ...resident,
      emergency_contact_name: contact.name || '',
      emergency_contact_phone: contact.phone || '',
      emergency_contact_relationship: contact.relationship || '',
    };
  };

  const handleSave = async (data) => {
    if (!data.id && !organizationId) {
      throw new Error('Unable to determine the active organization. Reload and try again.');
    }
    const {
      emergency_contact_name,
      emergency_contact_phone,
      emergency_contact_relationship,
      ...residentFields
    } = data;
    const resident = data.id
      ? await appClient.entities.Resident.update(data.id, residentFields)
      : await appClient.entities.Resident.create({ ...residentFields, organization_id: organizationId });
    const existingContact = contacts.find(c => c.resident_id === resident.id && c.is_emergency_contact);
    const contactData = {
      organization_id: resident.organization_id || organizationId,
      resident_id: resident.id,
      name: emergency_contact_name,
      phone: emergency_contact_phone,
      relationship: emergency_contact_relationship,
      is_emergency_contact: true,
    };
    if (emergency_contact_name) {
      if (existingContact) await appClient.entities.ResidentContact.update(existingContact.id, contactData);
      else await appClient.entities.ResidentContact.create(contactData);
    } else if (existingContact) {
      await appClient.entities.ResidentContact.delete(existingContact.id);
    }
    setShowForm(false);
    setSelectedResident(null);
    await loadData();
  };

  const handleResidentInvited = async (result) => {
    setResidents(previous => previous.map(resident => applyResidentAccountLink(resident, result)));
    setSelectedResident(previous => applyResidentAccountLink(previous, result));
    await loadData();
  };

  const locationName = (id) => locations.find(l => l.id === id)?.name || '—';

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Residents</h1>
          <p className="text-slate-500 text-sm mt-1">
            {residents.filter(r => r.status === 'active').length} active · {residents.filter(r => r.status === 'applicant').length} applicants
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/intake">
            <Button variant="outline" className="gap-2" style={{ borderColor: '#B45309', color: '#B45309' }}>
              <ClipboardList className="w-4 h-4" /> Digital Intake Form
            </Button>
          </Link>
          <Button onClick={() => { setSelectedResident(null); setShowForm(true); }} className="bg-teal-600 hover:bg-teal-700 gap-2">
            <Plus className="w-4 h-4" /> New Intake
          </Button>
        </div>
      </div>

      {/* Document Alert Panel */}
      <DocumentAlertPanel
        residents={residents}
        documents={documents}
        onSelectResident={(r) => { setSelectedResident(withEmergencyContact(r)); setShowForm(false); }}
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input placeholder="Search residents..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="applicant">Applicant</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="on_leave">On Leave</SelectItem>
            <SelectItem value="exited">Exited</SelectItem>
            <SelectItem value="alumni">Alumni</SelectItem>
          </SelectContent>
        </Select>
        <Select value={locationFilter} onValueChange={setLocationFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Location" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Locations</SelectItem>
            {locations.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <button
          onClick={() => setAlertFilter(v => !v)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
            alertFilter ? 'bg-orange-100 border-orange-300 text-orange-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          <AlertTriangle className="w-4 h-4" /> Alerts only
        </button>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-1 p-4">{[1,2,3,4,5].map(i => <div key={i} className="h-14 bg-slate-100 rounded animate-pulse" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-slate-500">
              <User className="w-10 h-10 mx-auto mb-3 text-slate-300" />
              <p className="font-medium">No residents found</p>
              <p className="text-sm mt-1">Try adjusting filters or add a new resident</p>
            </div>
          ) : (
            <div className="divide-y">
              {filtered.map(r => (
                <button
                  key={r.id}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors text-left"
                  onClick={() => setSelectedResident(withEmergencyContact(r))}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 font-bold text-sm flex-shrink-0">
                      {r.first_name?.[0]}{r.last_name?.[0]}
                    </div>
                    <div>
                      <p className="font-medium text-slate-800">{r.first_name} {r.last_name}</p>
                      <p className="text-xs text-slate-500">
                        {locationName(r.location_id)} {r.room ? `· Room ${r.room}` : ''} {r.intake_date ? `· Intake: ${r.intake_date}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {r.recovery_pathway && (
                      <Badge variant="outline" className="text-xs hidden sm:flex">{r.recovery_pathway}</Badge>
                    )}
                    <ResidentAlertBadge alerts={getAlerts(r)} />
                    <Badge className={`${statusColors[r.status] || 'bg-slate-100 text-slate-600'} border-0 capitalize`}>
                      {r.status}
                    </Badge>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Forms / Modals */}
      {showForm && (
        <ResidentForm
          resident={selectedResident}
          locations={locations}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setSelectedResident(null); }}
        />
      )}
      {selectedResident && !showForm && (
        <ResidentDetail
          resident={selectedResident}
          locations={locations}
          onEdit={() => setShowForm(true)}
          onClose={() => setSelectedResident(null)}
          onRefresh={loadData}
          onResidentInvited={handleResidentInvited}
          currentUserRole={currentUser?.role}
        />
      )}
    </div>
  );
}
