import { useState, useEffect, useCallback } from 'react';
import { appClient } from '@/services/appClient';
import { format, parseISO, differenceInDays, isFuture } from 'date-fns';
import {
  BedDouble, Building2, Users, Plus, Search, ChevronDown, ChevronRight, CheckCircle2, Clock, ArrowRight, RefreshCw,
  UserPlus
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ExpandCapacityModal from '@/components/capacity/ExpandCapacityModal';
import AssignBedModal from '@/components/capacity/AssignBedModal';

// ──────────────────────────────────────────
//  Helpers
// ──────────────────────────────────────────
function occupancyColor(pct) {
  if (pct >= 95) return { bar: '#EF4444', bg: '#FEF2F2', text: '#DC2626', label: 'At Capacity' };
  if (pct >= 80) return { bar: '#F97316', bg: '#FFF7ED', text: '#EA580C', label: 'High' };
  if (pct >= 50) return { bar: '#10B981', bg: '#ECFDF5', text: '#059669', label: 'Good' };
  return { bar: '#3B82F6', bg: '#EFF6FF', text: '#2563EB', label: 'Available' };
}

function OccupancyRing({ pct, size = 56 }) {
  const r = (size / 2) - 5;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  const col = occupancyColor(pct);
  return (
    <svg width={size} height={size} className="rotate-[-90deg]">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#E5E7EB" strokeWidth="6" />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={col.bar} strokeWidth="6"
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" />
      <text x="50%" y="54%" textAnchor="middle" dominantBaseline="middle"
        style={{ fontSize: 12, fontWeight: 700, fill: col.text, transform: 'rotate(90deg)', transformOrigin: '50% 50%' }}>
        {pct}%
      </text>
    </svg>
  );
}

function locationBedAssignments(loc, bedAssignments) {
  return bedAssignments
    .filter((bed) => bed.location_id === loc.id)
    .sort((a, b) => (a.room || '').localeCompare(b.room || '') || (a.bed_label || '').localeCompare(b.bed_label || ''));
}

function bedResident(assignment, residents) {
  return residents.find((resident) => resident.id === assignment.resident_id) || null;
}

function locationOccupancy(loc, residents, bedAssignments) {
  const assignments = locationBedAssignments(loc, bedAssignments);
  const activeResidents = residents.filter((resident) => resident.location_id === loc.id && resident.status === 'active');
  const assignedOccupied = assignments.filter((bed) => ['occupied', 'reserved'].includes(bed.status) && bed.resident_id);
  const usesAssignments = assignments.length > 0;
  const total = Math.max(loc.total_beds || 0, assignments.length);
  const occupied = usesAssignments ? assignedOccupied.length : activeResidents.length;
  const implicitAvailable = usesAssignments ? Math.max(0, total - assignments.length) : 0;
  const available = usesAssignments
    ? assignments.filter((bed) => bed.status === 'available').length + implicitAvailable
    : Math.max(0, total - occupied);

  return {
    assignments,
    activeResidents,
    total,
    occupied: Math.min(occupied, total || occupied),
    available: Math.max(0, available),
    pct: total > 0 ? Math.round((Math.min(occupied, total) / total) * 100) : 0,
    usesAssignments,
  };
}

// ──────────────────────────────────────────
//  Location Card
// ──────────────────────────────────────────
function LocationCard({ loc, residents, applicants, bedAssignments, onAssign }) {
  const [expanded, setExpanded] = useState(false);
  const occupancy = locationOccupancy(loc, residents, bedAssignments);
  const active = occupancy.activeResidents;
  const totalBeds = occupancy.total;
  const occupied = occupancy.occupied;
  const available = occupancy.available;
  const pct = occupancy.pct;
  const col = occupancyColor(pct);

  // upcoming move-outs: exiting within 30 days
  const moveOuts = active.filter(r => r.exit_date && isFuture(parseISO(r.exit_date)) && differenceInDays(parseISO(r.exit_date), new Date()) <= 30)
    .sort((a, b) => new Date(a.exit_date) - new Date(b.exit_date));

  // upcoming move-ins: applicants with intake_date set in next 30 days
  const moveIns = applicants.filter(r => r.location_id === loc.id && r.intake_date && isFuture(parseISO(r.intake_date)) && differenceInDays(parseISO(r.intake_date), new Date()) <= 30)
    .sort((a, b) => new Date(a.intake_date) - new Date(b.intake_date));

  // Build bed grid (max display 30 beds)
  const displayBeds = Math.min(totalBeds, 30);
  const bedSlots = occupancy.usesAssignments
    ? [
        ...occupancy.assignments.map((assignment, index) => ({
          index,
          assignment,
          resident: assignment.resident_id ? bedResident(assignment, residents) : null,
        })),
        ...Array.from({ length: Math.max(0, displayBeds - occupancy.assignments.length) }, (_, index) => ({
          index: occupancy.assignments.length + index,
          assignment: null,
          resident: null,
        })),
      ].slice(0, displayBeds)
    : Array.from({ length: displayBeds }, (_, i) => {
        const res = active[i];
        return { index: i, resident: res || null };
      });

  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="p-4 flex items-start gap-4">
        <OccupancyRing pct={pct} />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div>
              <h3 className="font-bold text-slate-800 text-base leading-tight">{loc.name}</h3>
              <p className="text-xs text-slate-400 mt-0.5">{[loc.city, loc.state].filter(Boolean).join(', ')} · {loc.housing_type || 'Recovery Residence'}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: col.bg, color: col.text }}>
                {col.label}
              </span>
              {loc.narr_level && loc.narr_level !== 'not_applicable' && (
                <Badge variant="outline" className="text-xs">NARR {loc.narr_level}</Badge>
              )}
            </div>
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-4 mt-2 flex-wrap">
            <span className="text-xs text-slate-600 flex items-center gap-1">
              <BedDouble className="w-3.5 h-3.5 text-slate-400" /> {occupied}/{totalBeds} occupied
            </span>
            <span className="text-xs font-semibold" style={{ color: available > 0 ? '#10B981' : '#EF4444' }}>
              {available} bed{available !== 1 ? 's' : ''} open
            </span>
            {moveOuts.length > 0 && (
              <span className="text-xs text-orange-600 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> {moveOuts.length} move-out{moveOuts.length > 1 ? 's' : ''} soon
              </span>
            )}
            {moveIns.length > 0 && (
              <span className="text-xs text-blue-600 flex items-center gap-1">
                <ArrowRight className="w-3.5 h-3.5" /> {moveIns.length} move-in{moveIns.length > 1 ? 's' : ''} soon
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Bed grid */}
      {totalBeds > 0 && (
        <div className="px-4 pb-3">
          <div className="flex flex-wrap gap-1.5">
            {bedSlots.map(slot => (
              <div
                key={slot.index}
                title={slot.resident
                  ? `${slot.resident.first_name} ${slot.resident.last_name}${slot.assignment?.bed_label ? ` · ${slot.assignment.bed_label}` : slot.resident.room ? ` · Room ${slot.resident.room}` : ''}`
                  : slot.assignment?.status === 'maintenance'
                    ? `${slot.assignment.bed_label || 'Bed'} · Maintenance`
                    : 'Available'}
                className={`w-7 h-7 rounded-md flex items-center justify-center text-[10px] font-bold transition-all cursor-default
                  ${slot.resident
                    ? 'bg-slate-700 text-white'
                    : slot.assignment?.status === 'maintenance'
                      ? 'bg-orange-100 text-orange-600 border-2 border-orange-200'
                      : 'bg-emerald-100 text-emerald-600 border-2 border-dashed border-emerald-300'}`}
              >
                {slot.resident ? slot.resident.first_name?.[0] : '+'}
              </div>
            ))}
            {totalBeds > 30 && (
              <div className="w-7 h-7 rounded-md bg-slate-100 flex items-center justify-center text-[9px] text-slate-400 font-bold">
                +{totalBeds - 30}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Progress bar */}
      <div className="px-4 pb-3">
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: col.bar }} />
        </div>
      </div>

      {/* Expand / Assign row */}
      <div className="px-4 pb-4 flex items-center gap-2 flex-wrap">
        {available > 0 && (
          <Button size="sm" className="gap-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs h-8"
            onClick={() => onAssign(loc)}>
            <UserPlus className="w-3.5 h-3.5" /> Assign Applicant
          </Button>
        )}
        <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8" onClick={() => setExpanded(e => !e)}>
          {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          {expanded ? 'Hide Details' : 'View Details'}
        </Button>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-slate-100 px-4 py-4 space-y-4 bg-slate-50/60">
          {/* Current residents */}
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Current Residents ({occupied})</p>
            {active.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No active residents assigned.</p>
            ) : (
              <div className="space-y-2">
                {active.map(r => (
                  <div key={r.id} className="flex items-center gap-3 rounded-xl bg-white border border-slate-100 px-3 py-2">
                    <div className="w-7 h-7 rounded-full bg-slate-700 text-white flex items-center justify-center text-xs font-bold shrink-0">
                      {r.first_name?.[0]}{r.last_name?.[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800">{r.first_name} {r.last_name}</p>
                      <p className="text-xs text-slate-400">
                        {r.room ? `Room ${r.room}` : 'No room'} · Phase {r.phase || '—'} · Since {r.intake_date ? format(parseISO(r.intake_date), 'MMM d, yyyy') : '—'}
                      </p>
                    </div>
                    {r.exit_date && isFuture(parseISO(r.exit_date)) && (
                      <span className="text-xs text-orange-600 font-medium shrink-0">
                        Out {format(parseISO(r.exit_date), 'MMM d')}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Upcoming move-ins */}
          {moveIns.length > 0 && (
            <div>
              <p className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-2">Upcoming Move-Ins</p>
              <div className="space-y-1.5">
                {moveIns.map(r => (
                  <div key={r.id} className="flex items-center gap-3 rounded-xl bg-blue-50 border border-blue-100 px-3 py-2">
                    <div className="w-7 h-7 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold shrink-0">
                      {r.first_name?.[0]}{r.last_name?.[0]}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-slate-800">{r.first_name} {r.last_name}</p>
                    </div>
                    <span className="text-xs text-blue-700 font-semibold shrink-0">
                      {format(parseISO(r.intake_date), 'MMM d')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Upcoming move-outs */}
          {moveOuts.length > 0 && (
            <div>
              <p className="text-xs font-bold text-orange-600 uppercase tracking-wider mb-2">Upcoming Move-Outs</p>
              <div className="space-y-1.5">
                {moveOuts.map(r => (
                  <div key={r.id} className="flex items-center gap-3 rounded-xl bg-orange-50 border border-orange-100 px-3 py-2">
                    <div className="w-7 h-7 rounded-full bg-orange-500 text-white flex items-center justify-center text-xs font-bold shrink-0">
                      {r.first_name?.[0]}{r.last_name?.[0]}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-slate-800">{r.first_name} {r.last_name}</p>
                      <p className="text-xs text-slate-400">Room {r.room || '—'}</p>
                    </div>
                    <span className="text-xs text-orange-700 font-semibold shrink-0">
                      {format(parseISO(r.exit_date), 'MMM d')} · {differenceInDays(parseISO(r.exit_date), new Date())}d
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────
//  Main Page
// ──────────────────────────────────────────
export default function BedCapacity() {
  const [locations, setLocations] = useState([]);
  const [residents, setResidents] = useState([]);
  const [bedAssignments, setBedAssignments] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // all | available | full | critical
  const [showExpand, setShowExpand] = useState(false);
  const [assignTarget, setAssignTarget] = useState(null); // location to assign into

  const loadData = useCallback(async () => {
    setLoading(true);
    const [locs, res, beds, currentUser] = await Promise.all([
      appClient.entities.Location.list(),
      appClient.entities.Resident.list(),
      appClient.entities.BedAssignment.list(),
      appClient.auth.me(),
    ]);
    setLocations(locs.filter(l => l.status === 'active'));
    setResidents(res);
    setBedAssignments(beds);
    setUser(currentUser);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Aggregate stats ──
  const occupancyByLocation = new Map(locations.map((loc) => [loc.id, locationOccupancy(loc, residents, bedAssignments)]));
  const totalBeds = locations.reduce((sum, loc) => sum + (occupancyByLocation.get(loc.id)?.total || 0), 0);
  const occupiedBeds = locations.reduce((sum, loc) => sum + (occupancyByLocation.get(loc.id)?.occupied || 0), 0);
  const availableBeds = locations.reduce((sum, loc) => sum + (occupancyByLocation.get(loc.id)?.available || 0), 0);
  const overallPct = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;
  const applicants = residents.filter(r => r.status === 'applicant');

  // ── Filter + search ──
  const filtered = locations.filter(loc => {
    const occupancy = occupancyByLocation.get(loc.id) || locationOccupancy(loc, residents, bedAssignments);
    const pct = occupancy.pct;
    const avail = occupancy.available;
    const matchSearch = !search || loc.name.toLowerCase().includes(search.toLowerCase()) || loc.city?.toLowerCase().includes(search.toLowerCase());
    const matchFilter =
      filter === 'all' ? true :
      filter === 'available' ? avail > 0 :
      filter === 'full' ? pct >= 95 :
      filter === 'critical' ? pct >= 90 : true;
    return matchSearch && matchFilter;
  });

  return (
    <div className="p-4 sm:p-6 space-y-5" style={{ background: '#FAF6EF', minHeight: '100%' }}>

      {/* Page header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <BedDouble className="w-6 h-6 text-teal-600" /> Bed Capacity Dashboard
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Real-time occupancy across all properties</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={loadData}>
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </Button>
          <Button size="sm" className="gap-1.5 bg-teal-600 hover:bg-teal-700" onClick={() => setShowExpand(true)}>
            <Plus className="w-3.5 h-3.5" /> Expand Capacity
          </Button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Beds', value: totalBeds, icon: BedDouble, color: '#0F766E', bg: '#CCFBF1' },
          { label: 'Occupied', value: occupiedBeds, icon: Users, color: '#B45309', bg: '#FEF3C7' },
          { label: 'Available', value: availableBeds, icon: CheckCircle2, color: '#15803D', bg: '#DCFCE7' },
          { label: 'Applicants Waiting', value: applicants.length, icon: Clock, color: '#1D4ED8', bg: '#DBEAFE' },
        ].map(k => {
          const Icon = k.icon;
          return (
            <div key={k.label} className="rounded-2xl p-4 flex items-center gap-3" style={{ background: k.bg }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: k.color + '20' }}>
                <Icon className="w-5 h-5" style={{ color: k.color }} />
              </div>
              <div>
                <p className="text-xl font-bold leading-none" style={{ color: k.color }}>{loading ? '—' : k.value}</p>
                <p className="text-xs mt-0.5 text-slate-600">{k.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Overall occupancy bar */}
      {!loading && totalBeds > 0 && (
        <div className="rounded-2xl bg-white border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            <span className="font-semibold text-slate-700 text-sm">Network-Wide Occupancy</span>
            <div className="flex items-center gap-3 text-sm">
              <span className="text-slate-500">{occupiedBeds} of {totalBeds} beds filled</span>
              <span className="font-bold" style={{ color: occupancyColor(overallPct).text }}>{overallPct}%</span>
            </div>
          </div>
          <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700"
              style={{ width: `${overallPct}%`, background: occupancyColor(overallPct).bar }} />
          </div>
          <div className="flex justify-between mt-1.5 text-[10px] text-slate-400">
            <span>0%</span><span>50%</span><span>75%</span><span>100%</span>
          </div>
        </div>
      )}

      {/* Filters + search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input placeholder="Search by name or city…" value={search} onChange={e => setSearch(e.target.value)}
            className="pl-9 bg-white" />
        </div>
        <div className="flex gap-2 flex-wrap">
          {[
            { id: 'all', label: 'All' },
            { id: 'available', label: 'Has Beds' },
            { id: 'critical', label: '90%+ Full' },
            { id: 'full', label: 'At Capacity' },
          ].map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                filter === f.id ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-slate-600 border-slate-200 hover:border-teal-400'
              }`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Location cards */}
      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-48 bg-white rounded-2xl border animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <Building2 className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No locations match your filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map(loc => (
            <LocationCard
              key={loc.id}
              loc={loc}
              residents={residents}
              applicants={residents.filter(r => r.status === 'applicant')}
              bedAssignments={bedAssignments}
              onAssign={setAssignTarget}
            />
          ))}
        </div>
      )}

      {/* Waitlist panel */}
      {applicants.length > 0 && (
        <div className="rounded-2xl bg-white border border-slate-200 p-5">
          <h2 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-500" /> Applicant Waitlist
            <Badge className="bg-blue-100 text-blue-700 border-0 ml-1">{applicants.length}</Badge>
          </h2>
          <div className="space-y-2">
            {applicants.slice(0, 8).map(r => (
              <div key={r.id} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
                <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
                  {r.first_name?.[0]}{r.last_name?.[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-800 text-sm">{r.first_name} {r.last_name}</p>
                  <p className="text-xs text-slate-400">Applied {r.created_date ? format(parseISO(r.created_date), 'MMM d, yyyy') : '—'}</p>
                </div>
                {availableBeds > 0 && (
                  <Button size="sm" variant="outline" className="text-xs h-7 gap-1"
                    onClick={() => setAssignTarget({ _preselected: r })}>
                    <UserPlus className="w-3 h-3" /> Assign
                  </Button>
                )}
              </div>
            ))}
            {applicants.length > 8 && (
              <p className="text-xs text-slate-400 text-center pt-1">+{applicants.length - 8} more applicants</p>
            )}
          </div>
        </div>
      )}

      {/* Modals */}
      {showExpand && (
        <ExpandCapacityModal
          locations={locations}
          organizationId={user?.organization_id}
          onClose={() => setShowExpand(false)}
          onSaved={() => { setShowExpand(false); loadData(); }}
        />
      )}
      {assignTarget && (
        <AssignBedModal
          locations={locations.filter(l => {
            const occupancy = occupancyByLocation.get(l.id) || locationOccupancy(l, residents, bedAssignments);
            return occupancy.available > 0;
          })}
          applicants={residents.filter(r => r.status === 'applicant')}
          bedAssignments={bedAssignments}
          preselectedLocation={assignTarget._preselected ? null : assignTarget}
          preselectedApplicant={assignTarget._preselected || null}
          onClose={() => setAssignTarget(null)}
          onSaved={() => { setAssignTarget(null); loadData(); }}
        />
      )}
    </div>
  );
}
