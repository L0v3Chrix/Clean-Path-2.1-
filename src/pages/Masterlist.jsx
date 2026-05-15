import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import {
  Search, Users, UserCheck, UserX, User, ChevronRight,
  DollarSign, AlertTriangle, FileText, X, Loader2, Filter,
  Building2, Calendar, Phone, Mail, ClipboardList
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import ResidentDetail from '@/components/residents/ResidentDetail';
import { format } from 'date-fns';

// ── Status config ─────────────────────────────────────────────────────────────
const RESIDENT_STATUS = {
  applicant: { label: 'Applicant',  color: 'bg-blue-100 text-blue-700' },
  active:    { label: 'Active',     color: 'bg-green-100 text-green-700' },
  on_leave:  { label: 'On Leave',   color: 'bg-yellow-100 text-yellow-700' },
  exited:    { label: 'Exited',     color: 'bg-slate-100 text-slate-600' },
  alumni:    { label: 'Alumni',     color: 'bg-purple-100 text-purple-700' },
};

const STAFF_STATUS = {
  active:   { label: 'Active',   color: 'bg-green-100 text-green-700' },
  inactive: { label: 'Inactive', color: 'bg-slate-100 text-slate-600' },
};

const EXIT_TYPES = [
  { value: 'graduated',             label: 'Graduated Program' },
  { value: 'voluntary',             label: 'Voluntary Exit' },
  { value: 'administrative',        label: 'Administrative Discharge' },
  { value: 'relapse',               label: 'Relapse' },
  { value: 'rule_violation',        label: 'Rule Violation' },
  { value: 'nonpayment',            label: 'Non-Payment / Financial' },
  { value: 'behavioral',            label: 'Behavioral Issues' },
  { value: 'medical',               label: 'Medical' },
  { value: 'incarcerated',          label: 'Incarcerated' },
  { value: 'deceased',              label: 'Deceased' },
  { value: 'unknown',               label: 'Unknown' },
];

// ── Departure Record Modal ────────────────────────────────────────────────────
function DepartureModal({ person, type, onSave, onClose }) {
  const existing = person._departure || {};
  const [form, setForm] = useState({
    exit_date:       existing.exit_date || new Date().toISOString().split('T')[0],
    exit_type:       existing.exit_type || 'voluntary',
    exit_reason:     existing.exit_reason || '',
    balance_owed:    existing.balance_owed || 0,
    balance_notes:   existing.balance_notes || '',
    behavior_notes:  existing.behavior_notes || '',
    rehire_eligible: existing.rehire_eligible !== undefined ? existing.rehire_eligible : true,
    do_not_readmit:  existing.do_not_readmit || false,
    forwarding_address: existing.forwarding_address || '',
    staff_notes:     existing.staff_notes || '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const isResident = type === 'resident';

  const handleSave = async () => {
    setSaving(true);
    const entity = isResident ? base44.entities.Resident : base44.entities.StaffMember;
    await entity.update(person.id, { _departure: form, status: isResident ? 'exited' : 'inactive' });
    setSaving(false);
    onSave();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b sticky top-0 bg-white">
          <div>
            <h3 className="font-bold text-slate-800">
              {isResident ? 'Resident Departure Record' : 'Staff Separation Record'}
            </h3>
            <p className="text-sm text-slate-500">{person.first_name} {person.last_name}</p>
          </div>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{isResident ? 'Exit Date' : 'Last Day'}</Label>
              <Input type="date" value={form.exit_date} onChange={e => set('exit_date', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{isResident ? 'Exit Type' : 'Separation Type'}</Label>
              <Select value={form.exit_type} onValueChange={v => set('exit_type', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EXIT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Exit Reason / Summary <span className="text-slate-400 font-normal">(internal staff only)</span></Label>
            <Textarea rows={3} placeholder="Brief description of why they left or were dismissed…" value={form.exit_reason} onChange={e => set('exit_reason', e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>Behavior / Conduct Notes</Label>
            <Textarea rows={2} placeholder="Any behavioral concerns, violations, or relevant patterns…" value={form.behavior_notes} onChange={e => set('behavior_notes', e.target.value)} />
          </div>

          <div className="border-t pt-4 space-y-3">
            <p className="text-sm font-semibold text-slate-700 flex items-center gap-2"><DollarSign className="w-4 h-4" /> Financial</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Balance Owed ($)</Label>
                <Input type="number" min={0} step={0.01} value={form.balance_owed} onChange={e => set('balance_owed', +e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Forwarding Address / Contact</Label>
                <Input placeholder="For collections or follow-up" value={form.forwarding_address} onChange={e => set('forwarding_address', e.target.value)} />
              </div>
            </div>
            {form.balance_owed > 0 && (
              <div className="space-y-1.5">
                <Label>Balance Notes</Label>
                <Textarea rows={2} placeholder="What is owed, payment plan attempts, etc." value={form.balance_notes} onChange={e => set('balance_notes', e.target.value)} />
              </div>
            )}
          </div>

          <div className="border-t pt-4 space-y-2">
            <p className="text-sm font-semibold text-slate-700">Flags</p>
            {isResident ? (
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={form.do_not_readmit} onChange={e => set('do_not_readmit', e.target.checked)} />
                <span className="text-red-600 font-medium">Do Not Re-Admit</span> — flag this person as ineligible for future intake
              </label>
            ) : (
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={form.rehire_eligible} onChange={e => set('rehire_eligible', e.target.checked)} />
                Eligible for Re-Hire
              </label>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Additional Staff Notes</Label>
            <Textarea rows={2} placeholder="Anything else relevant for the record…" value={form.staff_notes} onChange={e => set('staff_notes', e.target.value)} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-red-600 hover:bg-red-700 text-white gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserX className="w-4 h-4" />}
              Save Departure Record
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Resident Row ─────────────────────────────────────────────────────────────
function ResidentRow({ r, locationName, onOpen, onDepart }) {
  const sc = RESIDENT_STATUS[r.status] || RESIDENT_STATUS.exited;
  const dep = r._departure;
  const isExited = r.status === 'exited' || r.status === 'alumni';

  return (
    <div className="flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition-colors border-b last:border-0">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${isExited ? 'bg-slate-100 text-slate-500' : 'bg-teal-100 text-teal-700'}`}>
          {r.first_name?.[0]}{r.last_name?.[0]}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <button className="font-medium text-slate-800 hover:text-teal-700 text-sm" onClick={() => onOpen(r)}>
              {r.first_name} {r.last_name}
            </button>
            {dep?.do_not_readmit && (
              <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-medium">⛔ DNA</span>
            )}
          </div>
          <p className="text-xs text-slate-400 truncate">
            {locationName(r.location_id) || '—'}{r.room ? ` · Rm ${r.room}` : ''}
            {r.intake_date ? ` · In: ${r.intake_date}` : ''}
            {dep?.exit_date ? ` · Out: ${dep.exit_date}` : ''}
          </p>
          {dep?.exit_type && (
            <p className="text-xs text-slate-500 mt-0.5">
              <span className="font-medium">Exit:</span> {EXIT_TYPES.find(t => t.value === dep.exit_type)?.label || dep.exit_type}
              {dep.balance_owed > 0 && <span className="ml-2 text-red-500 font-medium">· Owes ${dep.balance_owed.toFixed(2)}</span>}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0 ml-3">
        <Badge className={`${sc.color} border-0 text-xs`}>{sc.label}</Badge>
        <Button size="sm" variant="outline" className="h-7 text-xs gap-1 hidden sm:flex" onClick={() => onDepart(r)}>
          <FileText className="w-3 h-3" />
          {dep ? 'Edit Record' : 'Departure'}
        </Button>
      </div>
    </div>
  );
}

// ── Staff Row ─────────────────────────────────────────────────────────────────
function StaffRow({ s, locationName, onDepart }) {
  const sc = STAFF_STATUS[s.status] || STAFF_STATUS.inactive;
  const dep = s._departure;

  return (
    <div className="flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition-colors border-b last:border-0">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${s.status === 'active' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-500'}`}>
          {s.first_name?.[0]}{s.last_name?.[0]}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-slate-800 text-sm">{s.first_name} {s.last_name}</span>
            {dep?.rehire_eligible === false && (
              <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-medium">No Re-Hire</span>
            )}
          </div>
          <p className="text-xs text-slate-400 truncate">
            {s.role?.replace(/_/g, ' ')} {s.title ? `· ${s.title}` : ''} {s.email ? `· ${s.email}` : ''}
          </p>
          {dep?.exit_type && (
            <p className="text-xs text-slate-500 mt-0.5">
              <span className="font-medium">Separated:</span> {EXIT_TYPES.find(t => t.value === dep.exit_type)?.label || dep.exit_type}
              {dep.exit_date ? ` on ${dep.exit_date}` : ''}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0 ml-3">
        <Badge className={`${sc.color} border-0 text-xs`}>{sc.label}</Badge>
        <Button size="sm" variant="outline" className="h-7 text-xs gap-1 hidden sm:flex" onClick={() => onDepart(s)}>
          <FileText className="w-3 h-3" />
          {dep ? 'Edit Record' : 'Separation'}
        </Button>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function Masterlist() {
  const [tab, setTab] = useState('residents');
  const [residents, setResidents] = useState([]);
  const [staff, setStaff] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('all');
  const [departingPerson, setDepartingPerson] = useState(null);
  const [selectedResident, setSelectedResident] = useState(null);

  useEffect(() => {
    Promise.all([
      base44.entities.Resident.list('-created_date', 500),
      base44.entities.StaffMember.list('-created_date', 200),
      base44.entities.Location.list(),
    ]).then(([r, s, l]) => {
      setResidents(r);
      setStaff(s);
      setLocations(l);
    }).finally(() => setLoading(false));
  }, []);

  const reload = async () => {
    const [r, s] = await Promise.all([
      base44.entities.Resident.list('-created_date', 500),
      base44.entities.StaffMember.list('-created_date', 200),
    ]);
    setResidents(r);
    setStaff(s);
  };

  const locationName = (id) => locations.find(l => l.id === id)?.name || '';

  // ── Filter helpers ──────────────────────────────────────────────────────────
  const filteredResidents = residents.filter(r => {
    const name = `${r.first_name} ${r.last_name}`.toLowerCase();
    const matchSearch = !search || name.includes(search.toLowerCase()) || r.email?.toLowerCase().includes(search.toLowerCase()) || r.phone?.includes(search);
    const matchStatus = statusFilter === 'all' || r.status === statusFilter;
    const matchLocation = locationFilter === 'all' || r.location_id === locationFilter;
    return matchSearch && matchStatus && matchLocation;
  });

  const filteredStaff = staff.filter(s => {
    const name = `${s.first_name} ${s.last_name}`.toLowerCase();
    const matchSearch = !search || name.includes(search.toLowerCase()) || s.email?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || statusFilter === 'all_staff' || s.status === statusFilter;
    return matchSearch && matchStatus;
  });

  // ── Stats ────────────────────────────────────────────────────────────────────
  const residentStats = {
    active: residents.filter(r => r.status === 'active').length,
    exited: residents.filter(r => r.status === 'exited').length,
    alumni: residents.filter(r => r.status === 'alumni').length,
    dna:    residents.filter(r => r._departure?.do_not_readmit).length,
    owed:   residents.reduce((sum, r) => sum + (r._departure?.balance_owed || 0), 0),
  };
  const staffStats = {
    active:   staff.filter(s => s.status === 'active').length,
    inactive: staff.filter(s => s.status === 'inactive').length,
    norehire: staff.filter(s => s._departure?.rehire_eligible === false).length,
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Masterlist</h1>
        <p className="text-slate-500 text-sm mt-1">All residents and staff — active, departed, and dismissed — across all locations</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-lg p-1 mb-6 w-fit">
        <button onClick={() => { setTab('residents'); setStatusFilter('all'); }}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-1.5 ${tab==='residents' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
          <Users className="w-3.5 h-3.5" /> Residents
          <span className="bg-slate-200 text-slate-600 text-xs px-1.5 py-0.5 rounded-full">{residents.length}</span>
        </button>
        <button onClick={() => { setTab('staff'); setStatusFilter('all'); }}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-1.5 ${tab==='staff' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
          <UserCheck className="w-3.5 h-3.5" /> Staff
          <span className="bg-slate-200 text-slate-600 text-xs px-1.5 py-0.5 rounded-full">{staff.length}</span>
        </button>
      </div>

      {/* Stats bar */}
      {tab === 'residents' && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
          {[
            { label: 'Active',  val: residentStats.active,  color: 'text-green-600',  filter: 'active' },
            { label: 'Exited',  val: residentStats.exited,  color: 'text-slate-600',  filter: 'exited' },
            { label: 'Alumni',  val: residentStats.alumni,  color: 'text-purple-600', filter: 'alumni' },
            { label: 'Do Not Re-Admit', val: residentStats.dna, color: 'text-red-600', filter: 'dna' },
            { label: 'Total Owed', val: `$${residentStats.owed.toFixed(0)}`, color: 'text-red-500', filter: null },
          ].map(s => (
            <button key={s.label}
              onClick={() => s.filter && s.filter !== 'dna' ? setStatusFilter(prev => prev === s.filter ? 'all' : s.filter) : null}
              className={`bg-white border border-slate-200 rounded-xl p-3 text-center transition-all ${s.filter && s.filter !== 'dna' ? 'hover:border-slate-300 cursor-pointer' : 'cursor-default'} ${statusFilter === s.filter ? 'border-teal-400 ring-1 ring-teal-300' : ''}`}>
              <p className={`text-xl font-black ${s.color}`}>{s.val}</p>
              <p className="text-xs text-slate-400 mt-0.5 leading-tight">{s.label}</p>
            </button>
          ))}
        </div>
      )}
      {tab === 'staff' && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: 'Active',    val: staffStats.active,   color: 'text-green-600',  filter: 'active' },
            { label: 'Inactive',  val: staffStats.inactive, color: 'text-slate-600',  filter: 'inactive' },
            { label: 'No Re-Hire',val: staffStats.norehire, color: 'text-red-500',    filter: null },
          ].map(s => (
            <button key={s.label}
              onClick={() => s.filter ? setStatusFilter(prev => prev === s.filter ? 'all' : s.filter) : null}
              className={`bg-white border border-slate-200 rounded-xl p-3 text-center transition-all ${s.filter ? 'hover:border-slate-300 cursor-pointer' : 'cursor-default'} ${statusFilter === s.filter ? 'border-teal-400 ring-1 ring-teal-300' : ''}`}>
              <p className={`text-xl font-black ${s.color}`}>{s.val}</p>
              <p className="text-xs text-slate-400 mt-0.5">{s.label}</p>
            </button>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input placeholder={`Search ${tab}…`} className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="All Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {tab === 'residents' ? (
              <>
                <SelectItem value="applicant">Applicant</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="on_leave">On Leave</SelectItem>
                <SelectItem value="exited">Exited</SelectItem>
                <SelectItem value="alumni">Alumni</SelectItem>
              </>
            ) : (
              <>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </>
            )}
          </SelectContent>
        </Select>
        {tab === 'residents' && (
          <Select value={locationFilter} onValueChange={setLocationFilter}>
            <SelectTrigger className="w-44"><SelectValue placeholder="All Locations" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Locations</SelectItem>
              {locations.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* List */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-2">{[1,2,3,4,5].map(i => <div key={i} className="h-14 bg-slate-100 rounded animate-pulse" />)}</div>
        ) : tab === 'residents' ? (
          filteredResidents.length === 0 ? (
            <div className="text-center py-16">
              <User className="w-10 h-10 mx-auto mb-3 text-slate-300" />
              <p className="text-slate-500">No residents match your filters</p>
            </div>
          ) : (
            <div>
              <div className="px-5 py-2 bg-slate-50 border-b text-xs text-slate-400 font-medium">
                {filteredResidents.length} resident{filteredResidents.length !== 1 ? 's' : ''}
              </div>
              {filteredResidents.map(r => (
                <ResidentRow key={r.id} r={r} locationName={locationName}
                  onOpen={setSelectedResident}
                  onDepart={setDepartingPerson}
                />
              ))}
            </div>
          )
        ) : (
          filteredStaff.length === 0 ? (
            <div className="text-center py-16">
              <User className="w-10 h-10 mx-auto mb-3 text-slate-300" />
              <p className="text-slate-500">No staff match your filters</p>
            </div>
          ) : (
            <div>
              <div className="px-5 py-2 bg-slate-50 border-b text-xs text-slate-400 font-medium">
                {filteredStaff.length} staff member{filteredStaff.length !== 1 ? 's' : ''}
              </div>
              {filteredStaff.map(s => (
                <StaffRow key={s.id} s={s} locationName={locationName}
                  onDepart={setDepartingPerson}
                />
              ))}
            </div>
          )
        )}
      </div>

      {/* Modals */}
      {departingPerson && (
        <DepartureModal
          person={departingPerson}
          type={tab === 'residents' ? 'resident' : 'staff'}
          onClose={() => setDepartingPerson(null)}
          onSave={() => { setDepartingPerson(null); reload(); }}
        />
      )}
      {selectedResident && (
        <ResidentDetail
          resident={selectedResident}
          locations={locations}
          onEdit={() => {}}
          onClose={() => setSelectedResident(null)}
          onRefresh={reload}
        />
      )}
    </div>
  );
}