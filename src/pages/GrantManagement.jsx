import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, Edit2, ChevronDown, ChevronUp, Award, Users, Calendar, DollarSign, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { differenceInDays, parseISO } from 'date-fns';
import GrantForm from '@/components/grants/GrantForm';
import GrantEnrollmentPanel from '@/components/grants/GrantEnrollmentPanel';
import GrantReportPanel from '@/components/grants/GrantReportPanel';

const STATUS_STYLES = {
  active: 'bg-emerald-100 text-emerald-700',
  pending: 'bg-amber-100 text-amber-700',
  completed: 'bg-blue-100 text-blue-700',
  cancelled: 'bg-red-100 text-red-600',
};

const FUNDER_TYPE_LABELS = {
  federal: 'Federal', state: 'State', county: 'County', city: 'City/Municipal',
  private_foundation: 'Private Foundation', corporate: 'Corporate',
  individual: 'Individual Donor', other: 'Other',
};

const PROGRAM_TYPE_LABELS = {
  recovery_housing: 'Recovery Housing', peer_support: 'Peer Support', mat_support: 'MAT Support',
  transitional_housing: 'Transitional Housing', harm_reduction: 'Harm Reduction',
  workforce_development: 'Workforce Development', mental_health: 'Mental Health', other: 'Other',
};

function GrantCard({ grant, locations, orgId, onEdit, onRefresh }) {
  const [tab, setTab] = useState(null); // null | 'enrollments' | 'report'

  const today = new Date();
  const end = parseISO(grant.end_date);
  const daysLeft = differenceInDays(end, today);
  const isExpiring = daysLeft >= 0 && daysLeft <= 60;
  const isExpired = daysLeft < 0;

  const coveredLocations = (grant.location_ids || [])
    .map(id => locations.find(l => l.id === id)?.name)
    .filter(Boolean);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      {/* Header strip */}
      <div className={`h-1.5 w-full ${grant.status === 'active' ? 'bg-amber-500' : grant.status === 'completed' ? 'bg-blue-400' : grant.status === 'pending' ? 'bg-yellow-400' : 'bg-slate-300'}`} />

      <div className="p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold capitalize ${STATUS_STYLES[grant.status] || 'bg-slate-100 text-slate-600'}`}>
                {grant.status}
              </span>
              <span className="text-xs text-slate-400">{FUNDER_TYPE_LABELS[grant.funder_type] || grant.funder_type}</span>
              {isExpiring && !isExpired && <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-semibold">⚠ {daysLeft}d left</span>}
              {isExpired && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-semibold">Expired</span>}
            </div>
            <h3 className="font-bold text-slate-900 text-base leading-tight">{grant.name}</h3>
            <p className="text-sm text-slate-500 mt-0.5">{grant.funder_name}</p>
          </div>
          <button onClick={() => onEdit(grant)} className="p-1.5 rounded-lg hover:bg-amber-50 text-amber-600 flex-shrink-0">
            <Edit2 className="w-4 h-4" />
          </button>
        </div>

        {/* Key facts row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div className="text-center bg-slate-50 rounded-xl py-2">
            <p className="text-xs text-slate-400">Award</p>
            <p className="font-bold text-slate-800 text-sm">{grant.total_award ? `$${grant.total_award.toLocaleString()}` : '—'}</p>
          </div>
          <div className="text-center bg-slate-50 rounded-xl py-2">
            <p className="text-xs text-slate-400">Period</p>
            <p className="font-bold text-slate-800 text-xs">{grant.start_date} →</p>
            <p className="font-bold text-slate-800 text-xs">{grant.end_date}</p>
          </div>
          <div className="text-center bg-slate-50 rounded-xl py-2">
            <p className="text-xs text-slate-400">Beds Funded</p>
            <p className="font-bold text-slate-800 text-sm">{grant.beds_funded || '—'}</p>
          </div>
          <div className="text-center bg-slate-50 rounded-xl py-2">
            <p className="text-xs text-slate-400">Reporting</p>
            <p className="font-bold text-slate-800 text-xs capitalize">{grant.reporting_frequency?.replace('_', '-') || '—'}</p>
          </div>
        </div>

        {coveredLocations.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {coveredLocations.map(name => (
              <span key={name} className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200">{name}</span>
            ))}
          </div>
        )}

        {grant.grant_number && (
          <p className="text-xs text-slate-400 mb-4">Award #: <span className="font-mono text-slate-600">{grant.grant_number}</span></p>
        )}

        {/* Tab toggles */}
        <div className="flex gap-2 border-t border-slate-100 pt-3">
          <button
            onClick={() => setTab(tab === 'enrollments' ? null : 'enrollments')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-colors ${tab === 'enrollments' ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-amber-50'}`}
          >
            <Users className="w-3.5 h-3.5" />
            Enrollments
            {tab === 'enrollments' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          <button
            onClick={() => setTab(tab === 'report' ? null : 'report')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-colors ${tab === 'report' ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-amber-50'}`}
          >
            <FileText className="w-3.5 h-3.5" />
            Performance Report
            {tab === 'report' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {/* Expandable panels */}
      {tab === 'enrollments' && (
        <div className="px-5 pb-5 border-t border-slate-100 pt-4">
          <GrantEnrollmentPanel grant={grant} orgId={orgId} />
        </div>
      )}
      {tab === 'report' && (
        <div className="px-5 pb-5 border-t border-slate-100 pt-4">
          <GrantReportPanel grant={grant} />
        </div>
      )}
    </div>
  );
}

export default function GrantManagement() {
  const [grants, setGrants] = useState([]);
  const [locations, setLocations] = useState([]);
  const [orgId, setOrgId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingGrant, setEditingGrant] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');

  const load = async () => {
    const [orgs, gs, locs] = await Promise.all([
      base44.entities.Organization.list(),
      base44.entities.Grant.list('-created_date', 200),
      base44.entities.Location.filter({ status: 'active' }),
    ]);
    if (orgs[0]) setOrgId(orgs[0].id);
    setGrants(gs);
    setLocations(locs);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = filterStatus === 'all' ? grants : grants.filter(g => g.status === filterStatus);

  const totalAward = grants.filter(g => g.status === 'active').reduce((s, g) => s + (g.total_award || 0), 0);
  const activeCount = grants.filter(g => g.status === 'active').length;

  if (loading) return (
    <div className="flex items-center justify-center min-h-64">
      <div className="w-8 h-8 border-4 border-amber-200 border-t-amber-600 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-6 space-y-6" style={{ background: '#FAF6EF', minHeight: '100%' }}>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Grant Management</h1>
          <p className="text-sm text-slate-500 mt-0.5">Define funding sources, enroll residents, and generate real-time grantor reports.</p>
        </div>
        <Button className="bg-amber-600 hover:bg-amber-700 text-white" onClick={() => { setEditingGrant(null); setShowForm(true); }}>
          <Plus className="w-4 h-4" /> New Grant
        </Button>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Active Grants', value: activeCount, icon: Award, color: '#B45309' },
          { label: 'Total Active Funding', value: `$${totalAward.toLocaleString()}`, icon: DollarSign, color: '#10B981' },
          { label: 'Total Grants', value: grants.length, icon: FileText, color: '#6366F1' },
          { label: 'Completed Grants', value: grants.filter(g => g.status === 'completed').length, icon: Calendar, color: '#3B82F6' },
        ].map(k => {
          const Icon = k.icon;
          return (
            <div key={k.label} className="rounded-2xl p-4" style={{ background: '#F0E9DC', border: '1px solid #E0D5C5' }}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-2xl font-black text-slate-900">{k.value}</p>
                  <p className="text-sm text-slate-500 mt-0.5">{k.label}</p>
                </div>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${k.color}20` }}>
                  <Icon className="w-4.5 h-4.5" style={{ color: k.color }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Grant form */}
      {(showForm || editingGrant) && (
        <GrantForm
          grant={editingGrant}
          locations={locations}
          orgId={orgId}
          onSave={() => { setShowForm(false); setEditingGrant(null); load(); }}
          onCancel={() => { setShowForm(false); setEditingGrant(null); }}
        />
      )}

      {/* Status filter */}
      <div className="flex gap-2 flex-wrap">
        {['all', 'active', 'pending', 'completed', 'cancelled'].map(s => (
          <button key={s} onClick={() => setFilterStatus(s)}
            className={`text-xs px-3 py-1 rounded-full font-medium capitalize transition-colors ${filterStatus === s ? 'bg-amber-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-amber-50'}`}>
            {s === 'all' ? 'All Grants' : s}
          </button>
        ))}
      </div>

      {/* Grant cards */}
      <div className="space-y-4">
        {filtered.length === 0 && (
          <div className="text-center py-16">
            <Award className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <p className="text-slate-500 font-medium">No grants yet.</p>
            <p className="text-slate-400 text-sm mt-1">Click "New Grant" to define your first funding source.</p>
          </div>
        )}
        {filtered.map(grant => (
          <GrantCard
            key={grant.id}
            grant={grant}
            locations={locations}
            orgId={orgId}
            onEdit={(g) => { setEditingGrant(g); setShowForm(false); }}
            onRefresh={load}
          />
        ))}
      </div>
    </div>
  );
}