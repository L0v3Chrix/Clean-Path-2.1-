import { useState, useEffect } from 'react';
import { appClient } from '@/services/appClient';
import { Sun, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { format, subDays } from 'date-fns';

const MOOD_EMOJI  = { 1: '😞', 2: '😕', 3: '😐', 4: '🙂', 5: '😄' };
const MOOD_LABEL  = { 1: 'Very Low', 2: 'Low', 3: 'Okay', 4: 'Good', 5: 'Great' };
const SLEEP_COLOR = { 1: '#EF4444', 2: '#F97316', 3: '#EAB308', 4: '#22C55E', 5: '#10B981' };
const SLEEP_LABEL = { 1: 'Very Poor', 2: 'Poor', 3: 'Fair', 4: 'Good', 5: 'Excellent' };

function MoodBar({ value }) {
  const pct = ((value - 1) / 4) * 100;
  const color = value <= 2 ? '#EF4444' : value === 3 ? '#EAB308' : '#22C55E';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-xs font-medium w-3" style={{ color }}>{value}</span>
    </div>
  );
}

function ResidentRow({ resident, logs }) {
  const [open, setOpen] = useState(false);
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const todayLog = logs.find(l => l.log_date === todayStr);
  const recent = logs.slice(0, 7);
  const avgMood = recent.length ? (recent.reduce((s, l) => s + l.mood, 0) / recent.length).toFixed(1) : null;
  const needsSupport = logs.some(l => l.flagged_for_support && l.log_date >= subDays(new Date(), 3).toISOString().split('T')[0]);

  return (
    <div className={`rounded-xl border transition-all ${needsSupport ? 'border-red-200 bg-red-50' : 'border-slate-100 bg-white'}`}>
      <button
        className="w-full flex items-center gap-3 p-3 text-left"
        onClick={() => setOpen(o => !o)}
      >
        {/* Avatar */}
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 text-white"
          style={{ background: needsSupport ? '#EF4444' : '#B45309' }}>
          {resident.first_name?.[0]}{resident.last_name?.[0]}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-slate-800">{resident.first_name} {resident.last_name}</p>
            {needsSupport && (
              <span className="text-xs bg-red-100 text-red-600 font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                <AlertTriangle className="w-3 h-3" /> Needs Support
              </span>
            )}
          </div>
          {todayLog ? (
            <div className="flex items-center gap-3 mt-0.5">
              <span className="text-base">{MOOD_EMOJI[todayLog.mood]}</span>
              <MoodBar value={todayLog.mood} />
              <span className="text-xs text-slate-400 flex-shrink-0">Today</span>
            </div>
          ) : (
            <p className="text-xs text-slate-400 mt-0.5">No reflection today</p>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {avgMood && <span className="text-xs text-slate-400">7d avg: {avgMood}</span>}
          {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </div>
      </button>

      {open && (
        <div className="px-3 pb-3 border-t border-slate-100 pt-3 space-y-3">
          {/* 7-day history strip */}
          <div>
            <p className="text-xs font-medium text-slate-500 mb-2">Last 7 days</p>
            <div className="flex gap-1.5">
              {Array.from({ length: 7 }, (_, i) => {
                const d = format(subDays(new Date(), 6 - i), 'yyyy-MM-dd');
                const log = logs.find(l => l.log_date === d);
                return (
                  <div key={d} className="flex-1 flex flex-col items-center gap-1">
                    <div
                      className="w-full h-6 rounded-md flex items-center justify-center text-sm"
                      style={log ? { background: log.mood <= 2 ? '#FEE2E2' : log.mood === 3 ? '#FEF9C3' : '#DCFCE7' } : { background: '#F1F5F9' }}
                    >
                      {log ? MOOD_EMOJI[log.mood] : <span className="text-slate-200 text-xs">—</span>}
                    </div>
                    <span className="text-xs text-slate-400">{format(subDays(new Date(), 6 - i), 'EEE')[0]}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Today's detail */}
          {todayLog && (
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-slate-50 rounded-lg p-2">
                <p className="text-xs text-slate-400">Sleep</p>
                <p className="text-sm font-semibold" style={{ color: SLEEP_COLOR[todayLog.sleep_quality] }}>
                  {SLEEP_LABEL[todayLog.sleep_quality]}{todayLog.sleep_hours ? ` · ${todayLog.sleep_hours}h` : ''}
                </p>
              </div>
              {todayLog.daily_goal && (
                <div className="bg-slate-50 rounded-lg p-2 col-span-2">
                  <p className="text-xs text-slate-400">Today's Goal</p>
                  <p className="text-sm text-slate-700">{todayLog.daily_goal}</p>
                </div>
              )}
              {todayLog.concerns && (
                <div className="bg-red-50 border border-red-100 rounded-lg p-2 col-span-2">
                  <p className="text-xs text-red-500 font-medium">Concerns shared</p>
                  <p className="text-sm text-slate-700 mt-0.5">{todayLog.concerns}</p>
                </div>
              )}
              {(todayLog.barc10_score != null || todayLog.qol_score != null) && (
                <div className="col-span-2 flex gap-2">
                  {todayLog.barc10_score != null && (
                    <div className="flex-1 bg-indigo-50 border border-indigo-100 rounded-lg p-2 text-center">
                      <p className="text-sm font-black text-indigo-700">{todayLog.barc10_score}<span className="text-xs font-normal text-indigo-400">/40</span></p>
                      <p className="text-xs text-indigo-500">BARC-10</p>
                    </div>
                  )}
                  {todayLog.qol_score != null && (
                    <div className="flex-1 bg-teal-50 border border-teal-100 rounded-lg p-2 text-center">
                      <p className="text-sm font-black text-teal-700">{todayLog.qol_score}<span className="text-xs font-normal text-teal-400">/35</span></p>
                      <p className="text-xs text-teal-500">Quality of Life</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function WellnessDashboard() {
  const [residents, setResidents] = useState([]);
  const [reflections, setReflections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all | flagged | no_log

  useEffect(() => {
    const since = subDays(new Date(), 7).toISOString().split('T')[0];
    Promise.all([
      appClient.entities.Resident.filter({ status: 'active' }),
      appClient.entities.MorningReflection.list('-log_date', 500),
    ]).then(([r, logs]) => {
      setResidents(r);
      setReflections(logs.filter(l => l.log_date >= since));
    }).finally(() => setLoading(false));
  }, []);

  const today = format(new Date(), 'yyyy-MM-dd');
  const since3 = subDays(new Date(), 3).toISOString().split('T')[0];

  const enriched = residents.map(r => {
    const logs = reflections.filter(l => l.resident_id === r.id).sort((a, b) => b.log_date.localeCompare(a.log_date));
    const flagged = logs.some(l => l.flagged_for_support && l.log_date >= since3);
    const hasToday = logs.some(l => l.log_date === today);
    return { resident: r, logs, flagged, hasToday };
  });

  const flaggedCount = enriched.filter(e => e.flagged).length;
  const noLogCount = enriched.filter(e => !e.hasToday).length;
  const loggedCount = enriched.filter(e => e.hasToday).length;

  let displayed = enriched;
  if (filter === 'flagged') displayed = enriched.filter(e => e.flagged);
  if (filter === 'no_log') displayed = enriched.filter(e => !e.hasToday);

  // Sort: flagged first, then no-log, then logged
  displayed = [...displayed].sort((a, b) => {
    if (a.flagged && !b.flagged) return -1;
    if (!a.flagged && b.flagged) return 1;
    if (!a.hasToday && b.hasToday) return -1;
    if (a.hasToday && !b.hasToday) return 1;
    return 0;
  });

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: '#F0E9DC', border: '1px solid #E0D5C5' }}>
      <div className="px-5 py-4 border-b border-amber-100 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Sun className="w-5 h-5 text-amber-600" />
          <span className="font-semibold text-slate-800">Morning Reflections — Today</span>
        </div>
        <div className="flex gap-2 flex-wrap">
          {[
            ['all', `All (${residents.length})`, ''],
            ['flagged', `Needs Support (${flaggedCount})`, flaggedCount > 0 ? 'bg-red-100 text-red-700' : ''],
            ['no_log', `No Entry (${noLogCount})`, noLogCount > 0 ? 'bg-amber-100 text-amber-700' : ''],
          ].map(([key, label, style]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`text-xs px-3 py-1 rounded-full font-medium transition-colors ${
                filter === key ? 'bg-amber-600 text-white' : style || 'bg-white text-slate-500 hover:bg-amber-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-3 divide-x divide-amber-100 border-b border-amber-100">
        {[
          { label: 'Logged Today', value: loggedCount, color: '#065F46', bg: '#D1FAE5' },
          { label: 'Needs Support', value: flaggedCount, color: '#991B1B', bg: '#FEE2E2' },
          { label: 'No Entry', value: noLogCount, color: '#92400E', bg: '#FEF3C7' },
        ].map(k => (
          <div key={k.label} className="p-3 text-center">
            <p className="text-xl font-black" style={{ color: k.color }}>{loading ? '—' : k.value}</p>
            <p className="text-xs text-slate-500">{k.label}</p>
          </div>
        ))}
      </div>

      <div className="p-4 space-y-2 max-h-96 overflow-y-auto">
        {loading && <div className="text-center py-6 text-slate-400 text-sm">Loading…</div>}
        {!loading && displayed.length === 0 && (
          <div className="text-center py-8 text-slate-400 text-sm">No residents match this filter.</div>
        )}
        {displayed.map(({ resident, logs, flagged }) => (
          <ResidentRow key={resident.id} resident={resident} logs={logs} />
        ))}
      </div>
    </div>
  );
}