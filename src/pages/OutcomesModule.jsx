import { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, Edit2, TrendingUp, Users, Briefcase, Home, GraduationCap, Heart, Award, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import OutcomeForm from '@/components/outcomes/OutcomeForm';
import GrantImpactPanel from '@/components/outcomes/GrantImpactPanel';
import { differenceInDays, parseISO, format } from 'date-fns';

const COLORS = ['#10B981', '#B45309', '#6366F1', '#EC4899', '#F97316', '#14B8A6'];

const STABLE_HOUSING = ['stable_owned', 'stable_rented', 'with_family', 'sober_living'];
const EMPLOYED = ['employed_full_time', 'employed_part_time', 'self_employed'];
const EDUCATION_POSITIVE = ['enrolled_degree', 'enrolled_vocational', 'completed_degree', 'completed_vocational', 'completed_ged'];

function KpiCard({ icon: Icon, label, value, sub, color }) {
  return (
    <div className="rounded-2xl p-4" style={{ background: '#F0E9DC', border: '1px solid #E0D5C5' }}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-2xl font-black" style={{ color: color || '#1C1917' }}>{value}</p>
          <p className="text-sm font-medium text-slate-600 mt-0.5">{label}</p>
          {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
        </div>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${color}22` }}>
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
      </div>
    </div>
  );
}

export default function OutcomesModule() {
  const [outcomes, setOutcomes] = useState([]);
  const [residents, setResidents] = useState([]);
  const [grants, setGrants] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [orgId, setOrgId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('overview'); // overview | records | grant_impact
  const [showForm, setShowForm] = useState(false);
  const [editingOutcome, setEditingOutcome] = useState(null);
  const [filterExit, setFilterExit] = useState('all');

  const load = async () => {
    const [orgs, os, res, gs, enrs] = await Promise.all([
      base44.entities.Organization.list(),
      base44.entities.ResidentOutcome.list('-follow_up_date', 500),
      base44.entities.Resident.list('-created_date', 500),
      base44.entities.Grant.list('-created_date', 200),
      base44.entities.GrantEnrollment.list('-created_date', 1000),
    ]);
    if (orgs[0]) setOrgId(orgs[0].id);
    setOutcomes(os);
    setResidents(res);
    setGrants(gs);
    setEnrollments(enrs);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const residentMap = useMemo(() => Object.fromEntries(residents.map(r => [r.id, r])), [residents]);

  const filteredOutcomes = filterExit === 'all' ? outcomes : outcomes.filter(o => o.exit_type === filterExit);

  // Aggregate metrics
  const total = outcomes.length;
  const employedCount = outcomes.filter(o => EMPLOYED.includes(o.employment_status)).length;
  const stableHousingCount = outcomes.filter(o => STABLE_HOUSING.includes(o.housing_status)).length;
  const educationCount = outcomes.filter(o => EDUCATION_POSITIVE.includes(o.education_status)).length;
  const sobrietyCount = outcomes.filter(o => o.sobriety_maintained).length;

  const avgSobrietyDays = total > 0
    ? Math.round(outcomes.reduce((s, o) => s + (o.current_sobriety_days || o.days_sober_at_exit || 0), 0) / total)
    : 0;

  const housingStabilityDays = outcomes
    .filter(o => o.housing_stable_since)
    .map(o => differenceInDays(new Date(), parseISO(o.housing_stable_since)));
  const avgHousingDays = housingStabilityDays.length
    ? Math.round(housingStabilityDays.reduce((a, b) => a + b, 0) / housingStabilityDays.length)
    : 0;

  // Employment breakdown chart
  const empCounts = {};
  outcomes.forEach(o => { if (o.employment_status) empCounts[o.employment_status] = (empCounts[o.employment_status] || 0) + 1; });
  const empData = Object.entries(empCounts).map(([name, value]) => ({ name: name.replace(/_/g, ' '), value })).sort((a, b) => b.value - a.value);

  // Housing breakdown
  const housingCounts = {};
  outcomes.forEach(o => { if (o.housing_status) housingCounts[o.housing_status] = (housingCounts[o.housing_status] || 0) + 1; });
  const housingData = Object.entries(housingCounts).map(([name, value]) => ({ name: name.replace(/_/g, ' '), value }));

  // Exit type breakdown
  const exitCounts = {};
  outcomes.forEach(o => { if (o.exit_type) exitCounts[o.exit_type] = (exitCounts[o.exit_type] || 0) + 1; });
  const exitData = Object.entries(exitCounts).map(([name, value]) => ({ name: name.replace(/_/g, ' '), value }));

  if (loading) return (
    <div className="flex items-center justify-center min-h-64">
      <div className="w-8 h-8 border-4 border-amber-200 border-t-amber-600 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-6 space-y-6" style={{ background: '#FAF6EF', minHeight: '100%' }}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Outcomes & Impact</h1>
          <p className="text-sm text-slate-500 mt-0.5">Long-term stability tracking: employment, housing, education, and sobriety post-exit.</p>
        </div>
        <Button className="bg-amber-600 hover:bg-amber-700 text-white" onClick={() => { setEditingOutcome(null); setShowForm(true); }}>
          <Plus className="w-4 h-4" /> Log Outcome
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-white border border-slate-200 w-fit">
        {[
          { id: 'overview', label: 'Overview' },
          { id: 'records', label: 'All Records' },
          { id: 'grant_impact', label: '🏆 Impact per Grant' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t.id ? 'bg-amber-600 text-white' : 'text-slate-600 hover:bg-amber-50'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Form */}
      {(showForm || editingOutcome) && (
        <OutcomeForm
          outcome={editingOutcome}
          residents={residents}
          grants={grants}
          orgId={orgId}
          onSave={() => { setShowForm(false); setEditingOutcome(null); load(); }}
          onCancel={() => { setShowForm(false); setEditingOutcome(null); }}
        />
      )}

      {/* OVERVIEW TAB */}
      {tab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard icon={Users} label="Outcomes Tracked" value={total} color="#B45309" sub="Post-exit records" />
            <KpiCard icon={Briefcase} label="Employment Rate" value={total ? `${Math.round((employedCount/total)*100)}%` : '—'} color="#10B981" sub={`${employedCount} employed`} />
            <KpiCard icon={Home} label="Stable Housing Rate" value={total ? `${Math.round((stableHousingCount/total)*100)}%` : '—'} color="#6366F1" sub={`${avgHousingDays}d avg duration`} />
            <KpiCard icon={Heart} label="Sobriety Maintained" value={total ? `${Math.round((sobrietyCount/total)*100)}%` : '—'} color="#EC4899" sub={`Avg ${avgSobrietyDays}d`} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard icon={GraduationCap} label="Education Active/Complete" value={total ? `${Math.round((educationCount/total)*100)}%` : '—'} color="#F97316" sub={`${educationCount} residents`} />
            <KpiCard icon={TrendingUp} label="Recovery Support Active" value={outcomes.filter(o => o.recovery_support_active).length} color="#14B8A6" sub="Still engaged" />
            <KpiCard icon={Award} label="Graduated" value={outcomes.filter(o => o.exit_type === 'graduated').length} color="#8B5CF6" sub="Program completions" />
            <KpiCard icon={Users} label="No Contact" value={outcomes.filter(o => o.follow_up_method === 'no_contact').length} color="#94A3B8" sub="Lost to follow-up" />
          </div>

          {/* Charts */}
          {total > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="rounded-2xl p-5 bg-white border border-slate-200">
                <h3 className="font-bold text-slate-800 text-sm mb-4">Employment Status</h3>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={empData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5DDD0" />
                    <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={90} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#10B981" radius={[0, 4, 4, 0]} name="Residents" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="rounded-2xl p-5 bg-white border border-slate-200">
                <h3 className="font-bold text-slate-800 text-sm mb-4">Housing Status</h3>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={housingData} cx="50%" cy="50%" outerRadius={70} dataKey="value">
                      {housingData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="rounded-2xl p-5 bg-white border border-slate-200">
                <h3 className="font-bold text-slate-800 text-sm mb-4">Exit Types</h3>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={exitData} cx="50%" cy="50%" outerRadius={70} dataKey="value" label={({ name, value }) => `${name} (${value})`} labelLine={false}>
                      {exitData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {total === 0 && (
            <div className="text-center py-16">
              <TrendingUp className="w-12 h-12 mx-auto text-slate-300 mb-3" />
              <p className="text-slate-500 font-medium">No outcome records yet.</p>
              <p className="text-slate-400 text-sm mt-1">Click "Log Outcome" to start tracking post-exit stability for your residents.</p>
            </div>
          )}
        </div>
      )}

      {/* RECORDS TAB */}
      {tab === 'records' && (
        <div className="space-y-4">
          <div className="flex gap-2 flex-wrap items-center">
            <Filter className="w-4 h-4 text-slate-400" />
            {['all', 'graduated', 'voluntary', 'administrative', 'relapse', 'unknown'].map(v => (
              <button key={v} onClick={() => setFilterExit(v)}
                className={`text-xs px-3 py-1 rounded-full font-medium capitalize transition-colors ${filterExit === v ? 'bg-amber-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-amber-50'}`}>
                {v === 'all' ? 'All Exits' : v}
              </button>
            ))}
          </div>

          {filteredOutcomes.length === 0 && (
            <div className="text-center py-12 text-slate-400 text-sm">No records match this filter.</div>
          )}

          <div className="space-y-3">
            {filteredOutcomes.map(o => {
              const resident = residentMap[o.resident_id];
              const name = resident ? `${resident.first_name} ${resident.last_name}` : 'Unknown Resident';
              const isEmployed = EMPLOYED.includes(o.employment_status);
              const isHoused = STABLE_HOUSING.includes(o.housing_status);
              const isEducated = EDUCATION_POSITIVE.includes(o.education_status);

              return (
                <div key={o.id} className="bg-white rounded-2xl border border-slate-200 p-4 flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-bold text-slate-900">{name}</span>
                      <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full capitalize">{o.exit_type?.replace(/_/g,' ')}</span>
                      <span className="text-xs text-slate-400">Exited {o.exit_date}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isEmployed ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                        {isEmployed ? '✓' : '○'} {o.employment_status?.replace(/_/g,' ') || 'Employment unknown'}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isHoused ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'}`}>
                        {isHoused ? '✓' : '○'} {o.housing_status?.replace(/_/g,' ') || 'Housing unknown'}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isEducated ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-500'}`}>
                        {isEducated ? '✓' : '○'} {o.education_status?.replace(/_/g,' ') || 'Education unknown'}
                      </span>
                      {o.sobriety_maintained && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-pink-100 text-pink-700">♥ Sober {o.current_sobriety_days || o.days_sober_at_exit || '?'}d</span>
                      )}
                    </div>
                    {o.follow_up_date && (
                      <p className="text-xs text-slate-400 mt-1.5">Last follow-up: {o.follow_up_date} · {o.follow_up_method?.replace(/_/g,' ')}</p>
                    )}
                  </div>
                  <button onClick={() => { setEditingOutcome(o); setShowForm(false); }}
                    className="p-1.5 rounded-lg hover:bg-amber-50 text-amber-600 flex-shrink-0">
                    <Edit2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* GRANT IMPACT TAB */}
      {tab === 'grant_impact' && (
        <GrantImpactPanel
          grants={grants}
          outcomes={outcomes}
          residents={residents}
          enrollments={enrollments}
        />
      )}
    </div>
  );
}