import { useState, useEffect } from 'react';
import { appClient } from '@/services/appClient';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { TrendingUp, Users, DollarSign, Heart, AlertTriangle, Building2, Star } from 'lucide-react';
import { format, subDays, subMonths, parseISO } from 'date-fns';

const COLORS = ['#B45309', '#10B981', '#6366F1', '#F97316', '#EC4899', '#14B8A6'];

function KpiCard({ icon: Icon, label, value, sub, color }) {
  return (
    <div className="rounded-2xl p-4" style={{ background: '#F0E9DC', border: '1px solid #E0D5C5' }}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-2xl font-black" style={{ color: color || '#1C1917' }}>{value}</p>
          <p className="text-sm font-medium text-slate-600 mt-0.5">{label}</p>
          {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
        </div>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${color}20` }}>
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="rounded-2xl p-5" style={{ background: '#F0E9DC', border: '1px solid #E0D5C5' }}>
      <h2 className="font-bold text-slate-800 text-base mb-4">{title}</h2>
      {children}
    </div>
  );
}

export default function Analytics() {
  const [data, setData] = useState({
    residents: [], locations: [], incidents: [], reflections: [],
    fees: [], payments: [], staff: []
  });
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState('enterprise'); // enterprise | location
  const [selectedLocation, setSelectedLocation] = useState(null);

  useEffect(() => {
    const safe = (promise) => promise.catch(() => []);
    Promise.all([
      safe(appClient.entities.Resident.list('-created_date', 500)),
      safe(appClient.entities.Location.list()),
      safe(appClient.entities.IncidentReport.list('-incident_date', 500)),
      safe(appClient.entities.MorningReflection.list('-log_date', 500)),
      safe(appClient.entities.ResidentFee.list('-due_date', 500)),
      safe(appClient.entities.ResidentPayment.list('-payment_date', 500)),
      safe(appClient.entities.StaffMember.list()),
    ]).then(([residents, locations, incidents, reflections, fees, payments, staff]) => {
      setData({ residents, locations, incidents, reflections, fees, payments, staff });
      if (locations.length) setSelectedLocation(locations[0].id);
    }).finally(() => setLoading(false));
  }, []);

  const filterByLocation = (arr, field = 'location_id') =>
    scope === 'enterprise' ? arr : arr.filter(r => r[field] === selectedLocation);

  const residents = filterByLocation(data.residents);
  const incidents = filterByLocation(data.incidents);

  // Occupancy
  const activeResidents = residents.filter(r => r.status === 'active').length;
  const totalBeds = scope === 'enterprise'
    ? data.locations.reduce((s, l) => s + (l.total_beds || 0), 0)
    : (data.locations.find(l => l.id === selectedLocation)?.total_beds || 0);
  const occupancyPct = totalBeds ? Math.round((activeResidents / totalBeds) * 100) : 0;

  // Financial
  const totalFees = data.fees.filter(f => f.status !== 'waived').reduce((s, f) => s + (f.amount || 0), 0);
  const totalPaid = data.payments.reduce((s, p) => s + (p.amount || 0), 0);
  const outstanding = totalFees - totalPaid;

  // Wellness
  const recentReflections = data.reflections.filter(r => r.log_date >= subDays(new Date(), 7).toISOString().split('T')[0]);
  const avgMood = recentReflections.length
    ? (recentReflections.reduce((s, r) => s + (r.mood || 0), 0) / recentReflections.length).toFixed(1)
    : '—';
  const flaggedCount = recentReflections.filter(r => r.flagged_for_support).length;

  // Incident trend — last 6 months
  const incidentTrend = Array.from({ length: 6 }, (_, i) => {
    const d = subMonths(new Date(), 5 - i);
    const month = format(d, 'yyyy-MM');
    return {
      month: format(d, 'MMM'),
      count: incidents.filter(inc => inc.incident_date?.startsWith(month)).length,
    };
  });

  // Incident types pie
  const typeCounts = {};
  incidents.forEach(inc => { typeCounts[inc.type] = (typeCounts[inc.type] || 0) + 1; });
  const incidentTypes = Object.entries(typeCounts).map(([name, value]) => ({ name: name.replace(/_/g, ' '), value }));

  // Resident status breakdown
  const statusCounts = {};
  residents.forEach(r => { statusCounts[r.status] = (statusCounts[r.status] || 0) + 1; });
  const residentStatuses = Object.entries(statusCounts).map(([name, value]) => ({ name, value }));

  // Mood trend last 14 days
  const moodTrend = Array.from({ length: 14 }, (_, i) => {
    const d = format(subDays(new Date(), 13 - i), 'yyyy-MM-dd');
    const dayLogs = data.reflections.filter(r => r.log_date === d);
    return {
      day: format(subDays(new Date(), 13 - i), 'MM/dd'),
      avg: dayLogs.length ? +(dayLogs.reduce((s, r) => s + (r.mood || 0), 0) / dayLogs.length).toFixed(1) : null,
    };
  });

  // Recovery pathway breakdown
  const pathwayCounts = {};
  residents.forEach(r => { if (r.recovery_pathway) pathwayCounts[r.recovery_pathway] = (pathwayCounts[r.recovery_pathway] || 0) + 1; });
  const pathwayData = Object.entries(pathwayCounts).map(([name, value]) => ({ name, value }));

  // Length of stay distribution
  const today = new Date();
  const stayBuckets = { '< 30d': 0, '30-90d': 0, '90-180d': 0, '180d+': 0 };
  residents.filter(r => r.status === 'active' && r.intake_date).forEach(r => {
    const days = Math.floor((today - parseISO(r.intake_date)) / 86400000);
    if (days < 30) stayBuckets['< 30d']++;
    else if (days < 90) stayBuckets['30-90d']++;
    else if (days < 180) stayBuckets['90-180d']++;
    else stayBuckets['180d+']++;
  });
  const stayData = Object.entries(stayBuckets).map(([name, value]) => ({ name, value }));

  // Peer support / social model: sobriety dates
  const soberResidents = residents.filter(r => r.sober_date && r.status === 'active');
  const avgSoberDays = soberResidents.length
    ? Math.floor(soberResidents.reduce((s, r) => s + Math.floor((today - parseISO(r.sober_date)) / 86400000), 0) / soberResidents.length)
    : 0;

  if (loading) return (
    <div className="flex items-center justify-center min-h-64">
      <div className="w-8 h-8 border-4 border-amber-200 border-t-amber-600 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-6 space-y-6" style={{ background: '#FAF6EF', minHeight: '100%' }}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Analytics & Outcomes</h1>
          <p className="text-sm text-slate-500 mt-0.5">Grant-ready reporting across residents, wellness, finance, and operations.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex rounded-xl overflow-hidden border border-slate-200">
            {['enterprise', 'location'].map(s => (
              <button key={s} onClick={() => setScope(s)}
                className={`px-4 py-1.5 text-sm font-medium transition-colors ${scope === s ? 'bg-amber-600 text-white' : 'bg-white text-slate-600 hover:bg-amber-50'}`}>
                {s === 'enterprise' ? 'Enterprise' : 'By Location'}
              </button>
            ))}
          </div>
          {scope === 'location' && (
            <select
              value={selectedLocation || ''}
              onChange={e => setSelectedLocation(e.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm bg-white"
            >
              {data.locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard icon={Users} label="Active Residents" value={activeResidents} color="#B45309" sub={`${occupancyPct}% occupancy`} />
        <KpiCard icon={Heart} label="Avg Mood (7d)" value={avgMood} color="#EC4899" sub={`${flaggedCount} flagged`} />
        <KpiCard icon={AlertTriangle} label="Open Incidents" value={incidents.filter(i => i.status === 'open').length} color="#EF4444" />
        <KpiCard icon={DollarSign} label="Outstanding Fees" value={`$${outstanding.toLocaleString()}`} color="#F97316" sub={`$${totalPaid.toLocaleString()} collected`} />
      </div>

      {/* Peer / Social model KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard icon={Star} label="Avg Sobriety" value={`${avgSoberDays}d`} color="#10B981" sub={`${soberResidents.length} tracking`} />
        <KpiCard icon={Building2} label="Active Locations" value={data.locations.filter(l => l.status === 'active').length} color="#6366F1" />
        <KpiCard icon={Users} label="Active Staff" value={data.staff.filter(s => s.status === 'active').length} color="#14B8A6" />
        <KpiCard icon={TrendingUp} label="Reflections (7d)" value={recentReflections.length} color="#8B5CF6" sub={`${data.residents.filter(r=>r.status==='active').length} residents`} />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Section title="Incident Trend (6 Months)">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={incidentTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5DDD0" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="#B45309" radius={[4, 4, 0, 0]} name="Incidents" />
            </BarChart>
          </ResponsiveContainer>
        </Section>

        <Section title="Average Mood Trend (14 Days)">
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={moodTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5DDD0" />
              <XAxis dataKey="day" tick={{ fontSize: 10 }} />
              <YAxis domain={[1, 5]} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Line type="monotone" dataKey="avg" stroke="#EC4899" strokeWidth={2} dot={false} name="Avg Mood" connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </Section>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Section title="Resident Status">
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={residentStatuses} cx="50%" cy="50%" outerRadius={70} dataKey="value" label={({ name, value }) => `${name} (${value})`} labelLine={false}>
                {residentStatuses.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </Section>

        <Section title="Length of Stay">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={stayData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#E5DDD0" />
              <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={55} />
              <Tooltip />
              <Bar dataKey="value" fill="#10B981" radius={[0, 4, 4, 0]} name="Residents" />
            </BarChart>
          </ResponsiveContainer>
        </Section>

        <Section title="Recovery Pathways">
          {pathwayData.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-10">No pathway data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={pathwayData} cx="50%" cy="50%" outerRadius={70} dataKey="value">
                  {pathwayData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend iconSize={10} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Section>
      </div>

      {/* Grant-ready summary table */}
      <Section title="Grant Reporting Summary">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '2px solid #E0D5C5' }}>
                {['Metric', 'Value', 'Notes'].map(h => (
                  <th key={h} className="text-left py-2 pr-4 text-slate-500 font-semibold text-xs uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-amber-100">
              {[
                ['Total Residents Served', data.residents.length, 'All statuses'],
                ['Currently Active', activeResidents, 'Active status only'],
                ['Average Sobriety Days', `${avgSoberDays} days`, `${soberResidents.length} residents tracking`],
                ['Occupancy Rate', `${occupancyPct}%`, `${activeResidents} of ${totalBeds} beds`],
                ['Incidents (All Time)', data.incidents.length, 'All locations'],
                ['Wellness Logs (7d)', recentReflections.length, 'Morning reflections'],
                ['Avg Mood Score (7d)', avgMood + ' / 5', 'Self-reported'],
                ['Residents Flagged (7d)', flaggedCount, 'Low mood or sleep'],
                ['Revenue Collected', `$${totalPaid.toLocaleString()}`, 'All payments'],
                ['Outstanding Fees', `$${outstanding.toLocaleString()}`, 'Unpaid/partial'],
              ].map(([metric, value, note]) => (
                <tr key={metric}>
                  <td className="py-2 pr-4 font-medium text-slate-700">{metric}</td>
                  <td className="py-2 pr-4 font-bold text-slate-900">{value}</td>
                  <td className="py-2 text-slate-400 text-xs">{note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}