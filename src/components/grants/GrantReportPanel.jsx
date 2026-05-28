import { useState, useEffect } from 'react';
import { appClient } from '@/services/appClient';
import { differenceInDays, parseISO, format } from 'date-fns';
import { FileText, TrendingUp, Users, Clock, Star, Heart } from 'lucide-react';

function MetricCard({ icon: Icon, label, value, sub, highlight }) {
  return (
    <div className={`rounded-xl p-4 ${highlight ? 'bg-amber-600 text-white' : 'bg-white border border-slate-200'}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className={`text-2xl font-black ${highlight ? 'text-white' : 'text-slate-900'}`}>{value}</p>
          <p className={`text-xs font-semibold mt-0.5 ${highlight ? 'text-amber-100' : 'text-slate-500'}`}>{label}</p>
          {sub && <p className={`text-xs mt-0.5 ${highlight ? 'text-amber-200' : 'text-slate-400'}`}>{sub}</p>}
        </div>
        <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${highlight ? 'text-amber-200' : 'text-amber-600'}`} />
      </div>
    </div>
  );
}

export default function GrantReportPanel({ grant }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [enrollments, residents, milestones, reflections] = await Promise.all([
        appClient.entities.GrantEnrollment.filter({ grant_id: grant.id }),
        appClient.entities.Resident.list(),
        appClient.entities.ResidentMilestone.list(),
        appClient.entities.MorningReflection.list('-log_date', 1000),
      ]);
      setData({ enrollments, residents, milestones, reflections });
      setLoading(false);
    };
    load();
  }, [grant.id]);

  if (loading) return <div className="p-4 text-center text-slate-400 text-sm">Calculating metrics...</div>;

  const { enrollments, residents, milestones, reflections } = data;

  const residentMap = Object.fromEntries(residents.map(r => [r.id, r]));
  const grantStart = parseISO(grant.start_date);
  const grantEnd = parseISO(grant.end_date);
  const today = new Date();
  const reportEnd = today < grantEnd ? today : grantEnd;

  // 1. Unique individuals served
  const uniqueIds = new Set(enrollments.map(e => e.resident_id));
  const uniqueCount = uniqueIds.size;

  // 2. Currently active under grant
  const activeEnrollments = enrollments.filter(e => !e.exit_date);
  const activeCount = activeEnrollments.length;

  // 3. Average stay duration
  const stayDays = enrollments.map(e => {
    const start = parseISO(e.enrollment_date);
    const end = e.exit_date ? parseISO(e.exit_date) : today;
    return Math.max(0, differenceInDays(end, start));
  });
  const avgStay = stayDays.length ? Math.round(stayDays.reduce((a, b) => a + b, 0) / stayDays.length) : 0;
  const maxStay = stayDays.length ? Math.max(...stayDays) : 0;

  // 4. Recovery milestone completion
  const enrolledResidentIds = [...uniqueIds];
  const grantMilestones = milestones.filter(m =>
    enrolledResidentIds.includes(m.resident_id) &&
    m.date >= grant.start_date && m.date <= reportEnd.toISOString().split('T')[0]
  );
  const milestonesPerResident = uniqueCount > 0 ? (grantMilestones.length / uniqueCount).toFixed(1) : 0;

  // 5. Sobriety maintenance — residents with sober date that falls within grant period
  const soberCount = enrolledResidentIds.filter(id => {
    const r = residentMap[id];
    return r?.sober_date && r.sober_date >= grant.start_date;
  }).length;

  // 6. Wellness / mood average for enrolled residents during grant period
  const grantReflections = reflections.filter(r =>
    enrolledResidentIds.includes(r.resident_id) &&
    r.log_date >= grant.start_date && r.log_date <= reportEnd.toISOString().split('T')[0]
  );
  const avgMood = grantReflections.length
    ? (grantReflections.reduce((s, r) => s + (r.mood || 0), 0) / grantReflections.length).toFixed(1)
    : '—';
  const avgSleep = grantReflections.length
    ? (grantReflections.reduce((s, r) => s + (r.sleep_quality || 0), 0) / grantReflections.length).toFixed(1)
    : '—';

  // 7. Exit outcomes
  const exitedEnrollments = enrollments.filter(e => e.exit_date);
  const completedCount = exitedEnrollments.filter(e => e.exit_reason === 'completed_program').length;
  const completionRate = exitedEnrollments.length
    ? Math.round((completedCount / exitedEnrollments.length) * 100)
    : 0;

  // 8. Grant utilization (beds)
  const utilizationPct = grant.beds_funded
    ? Math.round((activeCount / grant.beds_funded) * 100)
    : null;

  // 9. Grant period progress
  const totalDays = differenceInDays(grantEnd, grantStart);
  const elapsedDays = differenceInDays(today, grantStart);
  const grantProgress = Math.min(100, Math.round((elapsedDays / totalDays) * 100));

  // Milestone type breakdown
  const msByType = {};
  grantMilestones.forEach(m => { msByType[m.type] = (msByType[m.type] || 0) + 1; });

  return (
    <div className="space-y-6">
      {/* Grant period bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-slate-700">Grant Period Progress</span>
          <span className="text-xs text-slate-400">{grant.start_date} → {grant.end_date}</span>
        </div>
        <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
          <div className="h-3 rounded-full bg-amber-600 transition-all" style={{ width: `${grantProgress}%` }} />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-xs text-slate-400">{grantProgress}% elapsed</span>
          <span className="text-xs text-slate-400">{Math.max(0, differenceInDays(grantEnd, today))} days remaining</span>
        </div>
      </div>

      {/* Primary metrics */}
      <div>
        <p className="text-xs font-bold text-slate-400 uppercase mb-3">Core Performance Metrics</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricCard icon={Users} label="Unique Individuals Served" value={uniqueCount} sub="All time" highlight />
          <MetricCard icon={Clock} label="Avg Stay Duration" value={`${avgStay}d`} sub={`Max ${maxStay}d`} />
          <MetricCard icon={Star} label="Milestones Completed" value={grantMilestones.length} sub={`${milestonesPerResident}/resident`} />
          <MetricCard icon={TrendingUp} label="Program Completion Rate" value={`${completionRate}%`} sub={`${completedCount} of ${exitedEnrollments.length} exits`} />
        </div>
      </div>

      {/* Secondary metrics */}
      <div>
        <p className="text-xs font-bold text-slate-400 uppercase mb-3">Wellness & Recovery Indicators</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricCard icon={Heart} label="Avg Mood Score" value={avgMood !== '—' ? `${avgMood}/5` : '—'} sub={`${grantReflections.length} check-ins`} />
          <MetricCard icon={Heart} label="Avg Sleep Quality" value={avgSleep !== '—' ? `${avgSleep}/5` : '—'} />
          <MetricCard icon={Users} label="New Sobriety Dates" value={soberCount} sub="During grant period" />
          {utilizationPct !== null && (
            <MetricCard icon={TrendingUp} label="Bed Utilization" value={`${utilizationPct}%`} sub={`${activeCount} of ${grant.beds_funded} beds`} />
          )}
        </div>
      </div>

      {/* Milestone type breakdown */}
      {Object.keys(msByType).length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-sm font-semibold text-slate-700 mb-3">Milestone Types Achieved</p>
          <div className="space-y-2">
            {Object.entries(msByType).sort(([,a],[,b]) => b - a).map(([type, count]) => {
              const pct = grantMilestones.length ? Math.round((count / grantMilestones.length) * 100) : 0;
              return (
                <div key={type} className="flex items-center gap-3">
                  <span className="text-xs text-slate-500 w-32 flex-shrink-0 capitalize">{type.replace(/_/g, ' ')}</span>
                  <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-2.5 rounded-full bg-amber-500" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs font-bold text-slate-700 w-8 text-right">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Exit reason breakdown */}
      {exitedEnrollments.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-sm font-semibold text-slate-700 mb-3">Exit Reasons</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {Object.entries(
              exitedEnrollments.reduce((acc, e) => {
                const key = e.exit_reason || 'unknown';
                acc[key] = (acc[key] || 0) + 1;
                return acc;
              }, {})
            ).map(([reason, count]) => (
              <div key={reason} className="bg-slate-50 rounded-lg p-3 text-center">
                <p className="text-lg font-black text-slate-800">{count}</p>
                <p className="text-xs text-slate-500 capitalize mt-0.5">{reason.replace(/_/g, ' ')}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Grantor-ready summary */}
      <div className="bg-slate-800 text-white rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="w-4 h-4 text-amber-400" />
          <p className="font-bold text-sm text-amber-300">Grantor Report Summary</p>
          <span className="text-xs text-slate-400 ml-auto">As of {format(today, 'MMMM d, yyyy')}</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          {[
            ['Grant Name', grant.name],
            ['Funding Source', grant.funder_name],
            ['Grant Period', `${grant.start_date} – ${grant.end_date}`],
            ['Award Number', grant.grant_number || '—'],
            ['Total Individuals Served', uniqueCount],
            ['Currently Enrolled', activeCount],
            ['Average Length of Stay', `${avgStay} days`],
            ['Program Completion Rate', `${completionRate}%`],
            ['Recovery Milestones Achieved', grantMilestones.length],
            ['Avg Milestones per Resident', milestonesPerResident],
            ['New Sobriety Dates Established', soberCount],
            ['Average Mood Score', avgMood !== '—' ? `${avgMood} / 5` : 'No data'],
            ['Total Wellness Check-ins', grantReflections.length],
            grant.beds_funded ? ['Bed Utilization', `${utilizationPct}% (${activeCount}/${grant.beds_funded})`] : null,
          ].filter(Boolean).map(([label, value]) => (
            <div key={label} className="flex justify-between py-1.5 border-b border-slate-700">
              <span className="text-slate-400 text-xs">{label}</span>
              <span className="font-semibold text-xs text-white">{String(value)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}