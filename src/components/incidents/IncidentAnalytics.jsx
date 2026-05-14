import { useMemo } from 'react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { AlertTriangle, TrendingUp, TrendingDown, Minus, Activity, MapPin, Tag, Zap } from 'lucide-react';
import { format, parseISO, subMonths, startOfMonth, isValid } from 'date-fns';

const SEVERITY_COLORS = { low: '#A8B5C0', medium: '#F59E0B', high: '#F97316', critical: '#EF4444' };
const TYPE_COLORS = ['#B45309','#86B8B1','#8B6BAE','#4A6B8A','#C9A227','#6B8A4A','#8A4A6B','#4A8A6B','#6B4A8A'];
const MONTH_FORMAT = 'MMM yy';

function StatCard({ icon: Icon, label, value, sub, color }) {
  return (
    <div className="rounded-2xl p-4" style={{ background: '#F0E9DC', border: '1px solid #E0D5C5' }}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium mb-1" style={{ color: '#78716C' }}>{label}</p>
          <p className="text-3xl font-bold" style={{ color: '#1C1917' }}>{value}</p>
          {sub && <p className="text-xs mt-1" style={{ color: '#78716C' }}>{sub}</p>}
        </div>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: color + '22' }}>
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
      </div>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl shadow-lg p-3 text-sm" style={{ background: '#1C1917', color: '#E7DDD0', border: '1px solid #2C2825' }}>
      <p className="font-semibold mb-1">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color || p.fill }} />
          <span style={{ color: '#A09080' }}>{p.name}:</span>
          <span className="font-medium">{p.value}</span>
        </div>
      ))}
    </div>
  );
};

export default function IncidentAnalytics({ incidents, locations }) {
  const locationName = (id) => locations.find(l => l.id === id)?.name || 'Unknown';

  const stats = useMemo(() => {
    const total = incidents.length;
    const open = incidents.filter(i => i.status === 'open').length;
    const critical = incidents.filter(i => i.severity === 'critical').length;
    const thisMonth = incidents.filter(i => {
      if (!i.incident_date) return false;
      const d = parseISO(i.incident_date);
      return isValid(d) && d >= startOfMonth(new Date());
    }).length;
    return { total, open, critical, thisMonth };
  }, [incidents]);

  // Monthly trend — last 6 months
  const monthlyTrend = useMemo(() => {
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = subMonths(new Date(), 5 - i);
      return { month: format(d, MONTH_FORMAT), start: startOfMonth(d), label: format(d, MONTH_FORMAT) };
    });
    return months.map(m => {
      const inMonth = incidents.filter(i => {
        if (!i.incident_date) return false;
        const d = parseISO(i.incident_date);
        return isValid(d) && format(d, MONTH_FORMAT) === m.month;
      });
      return {
        month: m.label,
        total: inMonth.length,
        critical: inMonth.filter(i => i.severity === 'critical').length,
        high: inMonth.filter(i => i.severity === 'high').length,
      };
    });
  }, [incidents]);

  // By type
  const byType = useMemo(() => {
    const counts = {};
    incidents.forEach(i => { counts[i.type] = (counts[i.type] || 0) + 1; });
    return Object.entries(counts)
      .map(([type, count]) => ({ type: type.replace(/_/g, ' '), count }))
      .sort((a, b) => b.count - a.count);
  }, [incidents]);

  // By location
  const byLocation = useMemo(() => {
    const counts = {};
    incidents.forEach(i => {
      const name = locationName(i.location_id);
      counts[name] = (counts[name] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [incidents, locations]);

  // By severity
  const bySeverity = useMemo(() => {
    const counts = { low: 0, medium: 0, high: 0, critical: 0 };
    incidents.forEach(i => { if (i.severity) counts[i.severity] = (counts[i.severity] || 0) + 1; });
    return Object.entries(counts).map(([sev, count]) => ({ name: sev, value: count }));
  }, [incidents]);

  // Severity by location (stacked)
  const severityByLocation = useMemo(() => {
    const map = {};
    incidents.forEach(i => {
      const name = locationName(i.location_id);
      if (!map[name]) map[name] = { name, low: 0, medium: 0, high: 0, critical: 0 };
      if (i.severity) map[name][i.severity]++;
    });
    return Object.values(map).sort((a, b) => (b.high + b.critical) - (a.high + a.critical)).slice(0, 6);
  }, [incidents, locations]);

  // Resolution rate
  const resolutionRate = useMemo(() => {
    if (!incidents.length) return 0;
    const resolved = incidents.filter(i => i.status === 'resolved' || i.status === 'closed').length;
    return Math.round((resolved / incidents.length) * 100);
  }, [incidents]);

  if (incidents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20" style={{ color: '#78716C' }}>
        <Activity className="w-12 h-12 mb-3" style={{ color: '#C9A227' }} />
        <p className="font-semibold text-lg" style={{ color: '#1C1917' }}>No incident data yet</p>
        <p className="text-sm mt-1">Log incidents to start seeing analytics and trends.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Activity} label="Total Incidents" value={stats.total} sub="All time" color="#B45309" />
        <StatCard icon={AlertTriangle} label="Open" value={stats.open} sub={`${Math.round(stats.open / Math.max(stats.total,1) * 100)}% of total`} color="#F97316" />
        <StatCard icon={Zap} label="Critical" value={stats.critical} sub="Require immediate action" color="#EF4444" />
        <StatCard icon={TrendingUp} label="This Month" value={stats.thisMonth} sub={`${resolutionRate}% resolution rate`} color="#C9A227" />
      </div>

      {/* Monthly trend line */}
      <div className="rounded-2xl p-5" style={{ background: '#F0E9DC', border: '1px solid #E0D5C5' }}>
        <h3 className="font-semibold mb-4" style={{ color: '#1C1917' }}>Incident Trend — Last 6 Months</h3>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={monthlyTrend} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E0D5C5" />
            <XAxis dataKey="month" tick={{ fill: '#78716C', fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#78716C', fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12, color: '#78716C' }} />
            <Line type="monotone" dataKey="total" stroke="#B45309" strokeWidth={2.5} dot={{ fill: '#B45309', r: 4 }} name="Total" />
            <Line type="monotone" dataKey="high" stroke="#F97316" strokeWidth={2} strokeDasharray="4 2" dot={{ fill: '#F97316', r: 3 }} name="High" />
            <Line type="monotone" dataKey="critical" stroke="#EF4444" strokeWidth={2} strokeDasharray="4 2" dot={{ fill: '#EF4444', r: 3 }} name="Critical" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* By Type */}
        <div className="rounded-2xl p-5" style={{ background: '#F0E9DC', border: '1px solid #E0D5C5' }}>
          <div className="flex items-center gap-2 mb-4">
            <Tag className="w-4 h-4" style={{ color: '#B45309' }} />
            <h3 className="font-semibold" style={{ color: '#1C1917' }}>By Incident Type</h3>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={byType} layout="vertical" margin={{ top: 0, right: 20, left: 70, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E0D5C5" horizontal={false} />
              <XAxis type="number" tick={{ fill: '#78716C', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="type" tick={{ fill: '#78716C', fontSize: 11 }} axisLine={false} tickLine={false} width={65} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" name="Count" radius={[0, 6, 6, 0]}>
                {byType.map((_, i) => <Cell key={i} fill={TYPE_COLORS[i % TYPE_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* By Severity donut */}
        <div className="rounded-2xl p-5" style={{ background: '#F0E9DC', border: '1px solid #E0D5C5' }}>
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-4 h-4" style={{ color: '#B45309' }} />
            <h3 className="font-semibold" style={{ color: '#1C1917' }}>By Severity</h3>
          </div>
          <div className="flex items-center gap-4">
            <ResponsiveContainer width="55%" height={200}>
              <PieChart>
                <Pie data={bySeverity} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3}>
                  {bySeverity.map((entry, i) => <Cell key={i} fill={SEVERITY_COLORS[entry.name] || '#ccc'} />)}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2 flex-1">
              {bySeverity.map(s => (
                <div key={s.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ background: SEVERITY_COLORS[s.name] || '#ccc' }} />
                    <span className="text-sm capitalize" style={{ color: '#78716C' }}>{s.name}</span>
                  </div>
                  <span className="text-sm font-bold" style={{ color: '#1C1917' }}>{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Severity by Location stacked bar */}
      <div className="rounded-2xl p-5" style={{ background: '#F0E9DC', border: '1px solid #E0D5C5' }}>
        <div className="flex items-center gap-2 mb-4">
          <MapPin className="w-4 h-4" style={{ color: '#B45309' }} />
          <h3 className="font-semibold" style={{ color: '#1C1917' }}>Severity Distribution by Location</h3>
        </div>
        {severityByLocation.length === 0 ? (
          <p className="text-sm text-center py-8" style={{ color: '#78716C' }}>No location data available</p>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={severityByLocation} margin={{ top: 5, right: 20, left: 0, bottom: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E0D5C5" />
              <XAxis dataKey="name" tick={{ fill: '#78716C', fontSize: 11 }} axisLine={false} tickLine={false} angle={-25} textAnchor="end" interval={0} />
              <YAxis tick={{ fill: '#78716C', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12, color: '#78716C', paddingTop: 8 }} />
              <Bar dataKey="low" name="Low" stackId="a" fill={SEVERITY_COLORS.low} />
              <Bar dataKey="medium" name="Medium" stackId="a" fill={SEVERITY_COLORS.medium} />
              <Bar dataKey="high" name="High" stackId="a" fill={SEVERITY_COLORS.high} />
              <Bar dataKey="critical" name="Critical" stackId="a" fill={SEVERITY_COLORS.critical} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Top locations table */}
      <div className="rounded-2xl p-5" style={{ background: '#F0E9DC', border: '1px solid #E0D5C5' }}>
        <div className="flex items-center gap-2 mb-4">
          <MapPin className="w-4 h-4" style={{ color: '#B45309' }} />
          <h3 className="font-semibold" style={{ color: '#1C1917' }}>Incidents by Location</h3>
        </div>
        <div className="space-y-2">
          {byLocation.map((loc, i) => {
            const pct = Math.round((loc.count / incidents.length) * 100);
            return (
              <div key={i} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium" style={{ color: '#1C1917' }}>{loc.name}</span>
                  <span style={{ color: '#78716C' }}>{loc.count} ({pct}%)</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: '#E0D5C5' }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: '#B45309' }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}