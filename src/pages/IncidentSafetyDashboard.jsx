import { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ScatterChart, Scatter, ZAxis
} from 'recharts';
import {
  AlertTriangle, Activity, MapPin, Clock, Calendar, Tag,
  Zap, TrendingUp, ArrowLeft, RefreshCw
} from 'lucide-react';
import { format, parseISO, subMonths, startOfMonth, isValid, getDay, getHours } from 'date-fns';

const SEVERITY_COLORS = { low: '#A8B5C0', medium: '#F59E0B', high: '#F97316', critical: '#EF4444' };
const TYPE_COLORS = ['#B45309','#86B8B1','#8B6BAE','#4A6B8A','#C9A227','#6B8A4A','#8A4A6B','#4A8A6B'];
const DOW = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

const HOUR_BLOCKS = [
  { label: '12a–4a', hours: [0,1,2,3] },
  { label: '4a–8a',  hours: [4,5,6,7] },
  { label: '8a–12p', hours: [8,9,10,11] },
  { label: '12p–4p', hours: [12,13,14,15] },
  { label: '4p–8p',  hours: [16,17,18,19] },
  { label: '8p–12a', hours: [20,21,22,23] },
];

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

// Time-of-day heatmap cell
function HeatCell({ value, max }) {
  const pct = max > 0 ? value / max : 0;
  const bg = pct === 0 ? '#E0D5C5'
    : pct < 0.25 ? '#FBBF24'
    : pct < 0.6 ? '#F97316'
    : '#EF4444';
  return (
    <div
      title={`${value} incident${value !== 1 ? 's' : ''}`}
      className="rounded flex items-center justify-center text-xs font-bold transition-all"
      style={{
        background: bg,
        color: pct > 0.25 ? '#fff' : '#78716C',
        opacity: pct === 0 ? 0.35 : 0.7 + pct * 0.3,
        minHeight: '36px',
        minWidth: '36px',
      }}
    >
      {value > 0 ? value : ''}
    </div>
  );
}

export default function IncidentSafetyDashboard() {
  const [incidents, setIncidents] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState(6); // months

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const [inc, locs] = await Promise.all([
      base44.entities.IncidentReport.list('-incident_date', 500),
      base44.entities.Location.list(),
    ]);
    setIncidents(inc);
    setLocations(locs);
    setLoading(false);
  };

  const locationName = (id) => locations.find(l => l.id === id)?.name || 'Unknown';

  // Filter by date range
  const filtered = useMemo(() => {
    const cutoff = subMonths(new Date(), range);
    return incidents.filter(i => {
      if (!i.incident_date) return false;
      const d = parseISO(i.incident_date);
      return isValid(d) && d >= cutoff;
    });
  }, [incidents, range]);

  // KPIs
  const kpis = useMemo(() => {
    const total = filtered.length;
    const open = filtered.filter(i => i.status === 'open').length;
    const critical = filtered.filter(i => i.severity === 'critical').length;
    const resolved = filtered.filter(i => i.status === 'resolved' || i.status === 'closed').length;
    return { total, open, critical, resolutionRate: total ? Math.round(resolved / total * 100) : 0 };
  }, [filtered]);

  // Monthly trend
  const monthlyTrend = useMemo(() => {
    return Array.from({ length: range }, (_, i) => {
      const d = subMonths(new Date(), range - 1 - i);
      const label = format(d, 'MMM yy');
      const inMonth = filtered.filter(inc => {
        const dd = parseISO(inc.incident_date);
        return isValid(dd) && format(dd, 'MMM yy') === label;
      });
      return {
        month: label,
        total: inMonth.length,
        critical: inMonth.filter(i => i.severity === 'critical').length,
        high: inMonth.filter(i => i.severity === 'high').length,
      };
    });
  }, [filtered, range]);

  // By type
  const byType = useMemo(() => {
    const counts = {};
    filtered.forEach(i => { counts[i.type] = (counts[i.type] || 0) + 1; });
    return Object.entries(counts)
      .map(([type, count]) => ({ type: type.replace(/_/g, ' '), count }))
      .sort((a, b) => b.count - a.count);
  }, [filtered]);

  // Time-of-day × day-of-week heatmap
  const heatmapData = useMemo(() => {
    // matrix: rows = hour blocks, cols = days
    const matrix = HOUR_BLOCKS.map(block => {
      const row = { label: block.label };
      DOW.forEach(d => { row[d] = 0; });
      return row;
    });
    filtered.forEach(i => {
      const time = i.incident_time; // HH:MM
      const date = parseISO(i.incident_date);
      if (!isValid(date)) return;
      const dow = DOW[getDay(date)];
      let hour = null;
      if (time) {
        const h = parseInt(time.split(':')[0], 10);
        if (!isNaN(h)) hour = h;
      }
      if (hour === null) return;
      const blockIdx = HOUR_BLOCKS.findIndex(b => b.hours.includes(hour));
      if (blockIdx >= 0) matrix[blockIdx][dow]++;
    });
    return matrix;
  }, [filtered]);

  const heatMax = useMemo(() => {
    let m = 0;
    heatmapData.forEach(row => DOW.forEach(d => { if (row[d] > m) m = row[d]; }));
    return m;
  }, [heatmapData]);

  // Hour-of-day bar chart
  const byHour = useMemo(() => {
    const counts = Array.from({ length: 24 }, (_, h) => ({ hour: `${h}:00`, count: 0, h }));
    filtered.forEach(i => {
      if (!i.incident_time) return;
      const h = parseInt(i.incident_time.split(':')[0], 10);
      if (!isNaN(h) && h >= 0 && h < 24) counts[h].count++;
    });
    return counts;
  }, [filtered]);

  // Day-of-week bar
  const byDow = useMemo(() => {
    const counts = DOW.map(d => ({ day: d, count: 0 }));
    filtered.forEach(i => {
      const d = parseISO(i.incident_date);
      if (isValid(d)) counts[getDay(d)].count++;
    });
    return counts;
  }, [filtered]);

  // Repeat locations
  const locationRank = useMemo(() => {
    const counts = {};
    filtered.forEach(i => {
      const name = locationName(i.location_id);
      if (!counts[name]) counts[name] = { name, total: 0, critical: 0, high: 0 };
      counts[name].total++;
      if (i.severity === 'critical') counts[name].critical++;
      if (i.severity === 'high') counts[name].high++;
    });
    return Object.values(counts).sort((a, b) => b.total - a.total).slice(0, 8);
  }, [filtered, locations]);

  // Severity donut
  const bySeverity = useMemo(() => {
    const counts = { low: 0, medium: 0, high: 0, critical: 0 };
    filtered.forEach(i => { if (i.severity) counts[i.severity]++; });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [filtered]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="w-8 h-8 border-4 border-amber-200 border-t-amber-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" style={{ background: '#FAF6EF', minHeight: '100%' }}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link to="/incidents" className="p-2 rounded-xl hover:bg-amber-100 transition-colors" style={{ color: '#B45309' }}>
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: '#1C1917' }}>Safety Pattern Dashboard</h1>
            <p className="text-sm mt-0.5" style={{ color: '#78716C' }}>Identify incident trends, hotspots, and timing patterns</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {[3, 6, 12].map(m => (
            <button
              key={m}
              onClick={() => setRange(m)}
              className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
              style={range === m
                ? { background: '#B45309', color: '#fff' }
                : { background: '#F0E9DC', color: '#78716C', border: '1px solid #E0D5C5' }}
            >
              {m}M
            </button>
          ))}
          <button onClick={loadData} className="p-2 rounded-lg transition-colors" style={{ background: '#F0E9DC', color: '#78716C' }}>
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24" style={{ color: '#78716C' }}>
          <Activity className="w-12 h-12 mb-3" style={{ color: '#C9A227' }} />
          <p className="font-semibold text-lg" style={{ color: '#1C1917' }}>No incidents in this period</p>
          <p className="text-sm mt-1">Try expanding the date range or log incidents to see patterns.</p>
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={Activity} label="Total Incidents" value={kpis.total} sub={`Last ${range} months`} color="#B45309" />
            <StatCard icon={AlertTriangle} label="Open" value={kpis.open} sub={`${Math.round(kpis.open / Math.max(kpis.total,1) * 100)}% unresolved`} color="#F97316" />
            <StatCard icon={Zap} label="Critical" value={kpis.critical} sub="Require immediate action" color="#EF4444" />
            <StatCard icon={TrendingUp} label="Resolution Rate" value={`${kpis.resolutionRate}%`} sub="Resolved or closed" color="#6B8A4A" />
          </div>

          {/* Trend over time */}
          <div className="rounded-2xl p-5" style={{ background: '#F0E9DC', border: '1px solid #E0D5C5' }}>
            <h3 className="font-semibold mb-4" style={{ color: '#1C1917' }}>Incident Trend Over Time</h3>
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
            {/* By type */}
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

            {/* By severity donut */}
            <div className="rounded-2xl p-5" style={{ background: '#F0E9DC', border: '1px solid #E0D5C5' }}>
              <div className="flex items-center gap-2 mb-4">
                <Zap className="w-4 h-4" style={{ color: '#B45309' }} />
                <h3 className="font-semibold" style={{ color: '#1C1917' }}>By Severity</h3>
              </div>
              <div className="flex items-center gap-4">
                <ResponsiveContainer width="55%" height={200}>
                  <PieChart>
                    <Pie data={bySeverity} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3}>
                      {bySeverity.map((e, i) => <Cell key={i} fill={SEVERITY_COLORS[e.name] || '#ccc'} />)}
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

          {/* Time-of-day distribution */}
          <div className="rounded-2xl p-5" style={{ background: '#F0E9DC', border: '1px solid #E0D5C5' }}>
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-4 h-4" style={{ color: '#B45309' }} />
              <h3 className="font-semibold" style={{ color: '#1C1917' }}>Time of Day Frequency</h3>
              <span className="text-xs ml-1" style={{ color: '#78716C' }}>(incidents with time recorded)</span>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={byHour} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E0D5C5" vertical={false} />
                <XAxis dataKey="hour" tick={{ fill: '#78716C', fontSize: 10 }} axisLine={false} tickLine={false} interval={2} />
                <YAxis tick={{ fill: '#78716C', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" name="Incidents" radius={[4, 4, 0, 0]}>
                  {byHour.map((entry, i) => (
                    <Cell key={i} fill={entry.h >= 22 || entry.h < 6 ? '#EF4444' : entry.h < 12 ? '#F59E0B' : entry.h < 18 ? '#86B8B1' : '#F97316'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap gap-4 mt-2 justify-end">
              {[['Night (10p–6a)', '#EF4444'], ['Morning (6a–12p)', '#F59E0B'], ['Afternoon (12p–6p)', '#86B8B1'], ['Evening (6p–10p)', '#F97316']].map(([label, color]) => (
                <div key={label} className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-sm" style={{ background: color }} />
                  <span className="text-xs" style={{ color: '#78716C' }}>{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Day of week */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-2xl p-5" style={{ background: '#F0E9DC', border: '1px solid #E0D5C5' }}>
              <div className="flex items-center gap-2 mb-4">
                <Calendar className="w-4 h-4" style={{ color: '#B45309' }} />
                <h3 className="font-semibold" style={{ color: '#1C1917' }}>Day of Week Pattern</h3>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={byDow} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E0D5C5" vertical={false} />
                  <XAxis dataKey="day" tick={{ fill: '#78716C', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#78716C', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" name="Incidents" radius={[4, 4, 0, 0]} fill="#B45309">
                    {byDow.map((entry, i) => (
                      <Cell key={i} fill={entry.count === Math.max(...byDow.map(d => d.count)) ? '#EF4444' : '#B45309'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Day × Hour heatmap */}
            <div className="rounded-2xl p-5" style={{ background: '#F0E9DC', border: '1px solid #E0D5C5' }}>
              <div className="flex items-center gap-2 mb-4">
                <Activity className="w-4 h-4" style={{ color: '#B45309' }} />
                <h3 className="font-semibold" style={{ color: '#1C1917' }}>Day × Time Heatmap</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr>
                      <th className="w-16 text-left pb-2 font-medium" style={{ color: '#78716C' }}></th>
                      {DOW.map(d => (
                        <th key={d} className="text-center pb-2 font-medium w-10" style={{ color: '#78716C' }}>{d}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {heatmapData.map((row, ri) => (
                      <tr key={ri}>
                        <td className="pr-2 text-right font-medium whitespace-nowrap py-1" style={{ color: '#78716C' }}>{row.label}</td>
                        {DOW.map(d => (
                          <td key={d} className="p-0.5">
                            <HeatCell value={row[d]} max={heatMax} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center gap-3 mt-3 justify-end">
                <span className="text-xs" style={{ color: '#78716C' }}>Low</span>
                {['#FBBF24','#F97316','#EF4444'].map(c => (
                  <div key={c} className="w-4 h-4 rounded" style={{ background: c }} />
                ))}
                <span className="text-xs" style={{ color: '#78716C' }}>High</span>
              </div>
            </div>
          </div>

          {/* Repeat locations */}
          <div className="rounded-2xl p-5" style={{ background: '#F0E9DC', border: '1px solid #E0D5C5' }}>
            <div className="flex items-center gap-2 mb-4">
              <MapPin className="w-4 h-4" style={{ color: '#B45309' }} />
              <h3 className="font-semibold" style={{ color: '#1C1917' }}>Repeat Incident Locations</h3>
              <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: '#FECACA', color: '#991B1B' }}>
                Safety Hotspots
              </span>
            </div>
            <div className="space-y-3">
              {locationRank.map((loc, i) => {
                const pct = Math.round((loc.total / filtered.length) * 100);
                const riskScore = loc.critical * 3 + loc.high * 2 + loc.total;
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold w-5 text-center" style={{
                          color: i === 0 ? '#EF4444' : i === 1 ? '#F97316' : '#78716C'
                        }}>#{i + 1}</span>
                        <span className="text-sm font-medium" style={{ color: '#1C1917' }}>{loc.name}</span>
                        {loc.critical > 0 && (
                          <span className="text-xs px-1.5 py-0.5 rounded font-medium" style={{ background: '#FEE2E2', color: '#991B1B' }}>
                            {loc.critical} critical
                          </span>
                        )}
                        {loc.high > 0 && (
                          <span className="text-xs px-1.5 py-0.5 rounded font-medium" style={{ background: '#FFEDD5', color: '#9A3412' }}>
                            {loc.high} high
                          </span>
                        )}
                      </div>
                      <span className="text-sm font-semibold" style={{ color: '#78716C' }}>{loc.total} ({pct}%)</span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: '#E0D5C5' }}>
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${pct}%`,
                          background: loc.critical > 0 ? '#EF4444' : loc.high > 0 ? '#F97316' : '#B45309'
                        }}
                      />
                    </div>
                  </div>
                );
              })}
              {locationRank.length === 0 && (
                <p className="text-sm text-center py-6" style={{ color: '#78716C' }}>No location data available for this period.</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}