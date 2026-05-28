import { useState, useEffect } from 'react';
import { appClient } from '@/services/appClient';
import { Link } from 'react-router-dom';
import { Plus, Search, AlertTriangle, BarChart2, List, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { notifyCriticalIncident } from '@/lib/criticalIncidentNotifier';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import IncidentAnalytics from '@/components/incidents/IncidentAnalytics';
import IncidentForm from '@/components/incidents/IncidentForm';
import IncidentDetailDrawer from '@/components/incidents/IncidentDetailDrawer';

const SEV_CFG = {
  low:      { bg: '#F1F5F9', color: '#475569', bar: '#94A3B8' },
  medium:   { bg: '#FEF3C7', color: '#92400E', bar: '#F59E0B' },
  high:     { bg: '#FFEDD5', color: '#9A3412', bar: '#F97316' },
  critical: { bg: '#FEE2E2', color: '#991B1B', bar: '#EF4444' },
};

const STATUS_CFG = {
  open:      { bg: '#FEE2E2', color: '#991B1B' },
  in_review: { bg: '#FEF3C7', color: '#92400E' },
  resolved:  { bg: '#D1FAE5', color: '#065F46' },
  closed:    { bg: '#F1F5F9', color: '#475569' },
};

const TYPES = ['relapse','overdose','behavioral','medical','property_damage','rule_violation','altercation','elopement','other'];

export default function Incidents() {
  const [incidents, setIncidents] = useState([]);
  const [residents, setResidents] = useState([]);
  const [locations, setLocations] = useState([]);
  const [staff, setStaff]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter]     = useState('all');
  const [sevFilter, setSevFilter]       = useState('all');
  const [showForm, setShowForm]   = useState(false);
  const [editing, setEditing]     = useState(null);
  const [viewing, setViewing]     = useState(null);
  const [view, setView]           = useState('list');

  useEffect(() => {
    loadData();
    if (window.location.search.includes('action=new')) setShowForm(true);
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [inc, res, loc, st] = await Promise.all([
      appClient.entities.IncidentReport.list('-incident_date', 200),
      appClient.entities.Resident.list(),
      appClient.entities.Location.list(),
      appClient.entities.StaffMember.list(),
    ]);
    setIncidents(inc);
    setResidents(res);
    setLocations(loc);
    setStaff(st);
    setLoading(false);
  };

  // Refresh a single incident in the list (after status change)
  const refreshIncident = async (id, newStatus) => {
    setIncidents(prev => prev.map(i => i.id === id ? { ...i, status: newStatus } : i));
    if (viewing?.id === id) setViewing(v => ({ ...v, status: newStatus }));
  };

  const filtered = incidents.filter(i => {
    const q = search.toLowerCase();
    const matchSearch = !q || i.type?.includes(q) || i.description?.toLowerCase().includes(q);
    const matchStatus = statusFilter === 'all' || i.status === statusFilter;
    const matchType   = typeFilter === 'all' || i.type === typeFilter;
    const matchSev    = sevFilter === 'all' || i.severity === sevFilter;
    return matchSearch && matchStatus && matchType && matchSev;
  });

  const residentName = (id) => { const r = residents.find(r => r.id === id); return r ? `${r.first_name} ${r.last_name}` : null; };
  const locationName = (id) => locations.find(l => l.id === id)?.name || '—';

  // Stats
  const openCount     = incidents.filter(i => i.status === 'open').length;
  const criticalCount = incidents.filter(i => i.severity === 'critical' && i.status !== 'closed').length;
  const followUpCount = incidents.filter(i => i.follow_up_required && i.status !== 'closed' && i.status !== 'resolved').length;

  return (
    <div className="p-6" style={{ background: '#FAF6EF', minHeight: '100%' }}>
      {/* Page header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#1C1917' }}>Incident Reports</h1>
          <p className="text-sm mt-0.5" style={{ color: '#78716C' }}>
            {openCount} open · {criticalCount} critical · {followUpCount} awaiting follow-up
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-xl overflow-hidden border" style={{ borderColor: '#E0D5C5' }}>
            {[['list', List, 'List'], ['analytics', BarChart2, 'Analytics']].map(([v, Icon, label]) => (
              <button key={v} onClick={() => setView(v)}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors"
                style={view === v ? { background: '#1C1917', color: '#F5EFE6' } : { background: '#F0E9DC', color: '#78716C' }}>
                <Icon className="w-4 h-4" />{label}
              </button>
            ))}
          </div>
          <Link to="/incident-safety">
            <Button variant="outline" className="gap-2" style={{ borderColor: '#E0D5C5', color: '#B45309' }}>
              <TrendingUp className="w-4 h-4" /> Safety Trends
            </Button>
          </Link>
          <Button onClick={() => { setEditing(null); setShowForm(true); }} className="gap-2" style={{ background: '#B45309', color: '#fff' }}>
            <Plus className="w-4 h-4" /> Log Incident
          </Button>
        </div>
      </div>

      {view === 'analytics' ? (
        <IncidentAnalytics incidents={incidents} locations={locations} />
      ) : (
        <>
          {/* KPI strip */}
          {!loading && (
            <div className="grid grid-cols-3 gap-3 mb-5">
              {[
                { label: 'Open', value: openCount, bg: '#FEE2E2', color: '#991B1B' },
                { label: 'Critical Active', value: criticalCount, bg: '#FFEDD5', color: '#9A3412' },
                { label: 'Needs Follow-up', value: followUpCount, bg: '#FEF3C7', color: '#92400E' },
              ].map(k => (
                <div key={k.label} className="rounded-xl p-3 text-center" style={{ background: k.bg, border: `1px solid ${k.bg}` }}>
                  <p className="text-2xl font-black" style={{ color: k.color }}>{k.value}</p>
                  <p className="text-xs" style={{ color: k.color }}>{k.label}</p>
                </div>
              ))}
            </div>
          )}

          {/* Filters */}
          <div className="flex flex-wrap gap-2 mb-4">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input placeholder="Search incidents…" className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="in_review">In Review</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {TYPES.map(t => <SelectItem key={t} value={t} className="capitalize">{t.replace(/_/g, ' ')}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={sevFilter} onValueChange={setSevFilter}>
              <SelectTrigger className="w-36"><SelectValue placeholder="Severity" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severities</SelectItem>
                <SelectItem value="low">🟢 Low</SelectItem>
                <SelectItem value="medium">🟡 Medium</SelectItem>
                <SelectItem value="high">🟠 High</SelectItem>
                <SelectItem value="critical">🔴 Critical</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Incident list */}
          <div className="rounded-2xl overflow-hidden" style={{ background: '#F0E9DC', border: '1px solid #E0D5C5' }}>
            {loading ? (
              <div className="p-4 space-y-2">{[1,2,3].map(i => <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background: '#E5DDD0' }} />)}</div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16">
                <AlertTriangle className="w-10 h-10 mx-auto mb-3" style={{ color: '#C9A227' }} />
                <p style={{ color: '#78716C' }}>No incidents match your filters</p>
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: '#E0D5C5' }}>
                {filtered.map(inc => {
                  const sev = SEV_CFG[inc.severity] || SEV_CFG.medium;
                  const sta = STATUS_CFG[inc.status] || STATUS_CFG.closed;
                  const rname = residentName(inc.resident_id);
                  return (
                    <button
                      key={inc.id}
                      className="w-full flex items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-amber-50/40"
                      onClick={() => setViewing(inc)}
                    >
                      {/* Severity bar */}
                      <div className="w-1 h-10 rounded-full flex-shrink-0" style={{ background: sev.bar }} />

                      {/* Main info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm capitalize" style={{ color: '#1C1917' }}>
                            {inc.type?.replace(/_/g, ' ')}
                          </span>
                          {inc.confidential && <span className="text-xs" style={{ color: '#A09080' }}>🔒</span>}
                          {inc.naloxone_used && <span className="text-xs" style={{ color: '#DC2626' }}>💉</span>}
                          {inc.ems_called && <span className="text-xs" style={{ color: '#EA580C' }}>🚑</span>}
                        </div>
                        <p className="text-xs truncate mt-0.5" style={{ color: '#78716C' }}>
                          {inc.incident_date}{inc.incident_time ? ` ${inc.incident_time}` : ''}
                          {' · '}{locationName(inc.location_id)}
                          {rname ? ` · ${rname}` : ''}
                        </p>
                        {inc.description && (
                          <p className="text-xs truncate mt-0.5" style={{ color: '#A09080' }}>{inc.description}</p>
                        )}
                      </div>

                      {/* Badges */}
                      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full capitalize"
                          style={{ background: sev.bg, color: sev.color }}>{inc.severity}</span>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full capitalize"
                          style={{ background: sta.bg, color: sta.color }}>{inc.status?.replace('_', ' ')}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* Detail Drawer */}
      {viewing && !showForm && (
        <IncidentDetailDrawer
          incident={viewing}
          residents={residents}
          locations={locations}
          staff={staff}
          onEdit={() => { setEditing(viewing); setShowForm(true); }}
          onClose={() => setViewing(null)}
          onRefresh={(newStatus) => refreshIncident(viewing.id, newStatus)}
        />
      )}

      {/* Form Modal */}
      {showForm && (
        <IncidentForm
          incident={editing}
          residents={residents}
          locations={locations}
          staff={staff}
          onSave={async (data) => {
            const isNew = !data.id;
            const saved = data.id
              ? await appClient.entities.IncidentReport.update(data.id, data)
              : await appClient.entities.IncidentReport.create(data);

            // Critical incident notifications (new reports only)
            if (isNew && data.severity === 'critical') {
              const incidentRecord = { ...data, id: saved?.id || saved };
              const result = await notifyCriticalIncident(incidentRecord, staff, locations);
              const incidentUrl = result?.incidentUrl;

              toast.error(
                <div className="space-y-1">
                  <p className="font-bold text-sm">🔴 Critical Incident Logged</p>
                  <p className="text-xs opacity-90">{data.type?.replace(/_/g, ' ')} — immediate attention required</p>
                  {incidentUrl && (
                    <a
                      href={incidentUrl}
                      className="text-xs underline font-medium block mt-1"
                      style={{ color: '#FCA5A5' }}
                    >
                      View Incident Report →
                    </a>
                  )}
                  {result?.recipientCount > 0 && (
                    <p className="text-xs opacity-75">{result.recipientCount} staff member{result.recipientCount !== 1 ? 's' : ''} notified by email</p>
                  )}
                </div>,
                { duration: 10000, style: { background: '#7F1D1D', color: '#FEF2F2', border: '1px solid #EF4444' } }
              );
            }

            setShowForm(false);
            setEditing(null);
            setViewing(null);
            loadData();
          }}
          onClose={() => { setShowForm(false); setEditing(null); }}
        />
      )}
    </div>
  );
}