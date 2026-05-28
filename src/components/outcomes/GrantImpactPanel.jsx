import { useMemo } from 'react';
import { differenceInDays, parseISO } from 'date-fns';
import { Award, Briefcase, Home, GraduationCap, Heart } from 'lucide-react';

const STABLE_HOUSING = ['stable_owned', 'stable_rented', 'with_family', 'sober_living'];
const EMPLOYED = ['employed_full_time', 'employed_part_time', 'self_employed'];
const EDUCATION_POSITIVE = ['enrolled_degree', 'enrolled_vocational', 'completed_degree', 'completed_vocational', 'completed_ged'];

function ImpactBar({ label, value, total, color }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-slate-500 w-36 flex-shrink-0">{label}</span>
      <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-2.5 rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-xs font-bold text-slate-700 w-16 text-right">{value}/{total} ({pct}%)</span>
    </div>
  );
}

export default function GrantImpactPanel({ grants, outcomes, residents, enrollments }) {
  const residentMap = useMemo(() => Object.fromEntries(residents.map(r => [r.id, r])), [residents]);

  const grantImpact = useMemo(() => {
    return grants.filter(g => g.status === 'active' || g.status === 'completed').map(grant => {
      // Get all resident IDs under this grant (from GrantEnrollment + ResidentOutcome.grant_ids)
      const enrolledIds = new Set([
        ...enrollments.filter(e => e.grant_id === grant.id).map(e => e.resident_id),
        ...outcomes.filter(o => (o.grant_ids || []).includes(grant.id)).map(o => o.resident_id),
      ]);

      // Outcomes attributed to this grant
      const grantOutcomes = outcomes.filter(o =>
        enrolledIds.has(o.resident_id) ||
        (o.grant_ids || []).includes(grant.id)
      );

      const total = grantOutcomes.length;
      const employed = grantOutcomes.filter(o => EMPLOYED.includes(o.employment_status)).length;
      const stableHousing = grantOutcomes.filter(o => STABLE_HOUSING.includes(o.housing_status)).length;
      const educationPositive = grantOutcomes.filter(o => EDUCATION_POSITIVE.includes(o.education_status)).length;
      const sobrietyMaintained = grantOutcomes.filter(o => o.sobriety_maintained).length;
      const recoverySupport = grantOutcomes.filter(o => o.recovery_support_active).length;

      const avgSobrietyDays = total > 0
        ? Math.round(grantOutcomes.reduce((s, o) => s + (o.current_sobriety_days || o.days_sober_at_exit || 0), 0) / total)
        : 0;

      const avgHousingStabilityDays = grantOutcomes
        .filter(o => o.housing_stable_since)
        .map(o => differenceInDays(new Date(), parseISO(o.housing_stable_since)));
      const avgHousingDays = avgHousingStabilityDays.length
        ? Math.round(avgHousingStabilityDays.reduce((a, b) => a + b, 0) / avgHousingStabilityDays.length)
        : 0;

      return { grant, total, employed, stableHousing, educationPositive, sobrietyMaintained, recoverySupport, avgSobrietyDays, avgHousingDays, enrolledCount: enrolledIds.size };
    });
  }, [grants, outcomes, enrollments, residentMap]);

  if (grantImpact.length === 0) {
    return (
      <div className="text-center py-12 text-slate-400">
        <Award className="w-10 h-10 mx-auto mb-3 opacity-40" />
        <p className="text-sm">No active or completed grants found. Add grants in Grant Management.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {grantImpact.map(({ grant, total, employed, stableHousing, educationPositive, sobrietyMaintained, recoverySupport, avgSobrietyDays, avgHousingDays, enrolledCount }) => (
        <div key={grant.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          {/* Header */}
          <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-0.5">
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold capitalize ${grant.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                  {grant.status}
                </span>
                <span className="text-xs text-slate-400">{grant.funder_name}</span>
              </div>
              <h3 className="font-bold text-slate-900">{grant.name}</h3>
              <p className="text-xs text-slate-400 mt-0.5">{grant.start_date} → {grant.end_date} · {enrolledCount} individuals enrolled</p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-2xl font-black text-amber-700">{total}</p>
              <p className="text-xs text-slate-400">outcomes tracked</p>
            </div>
          </div>

          {total === 0 ? (
            <div className="px-5 py-6 text-sm text-slate-400 text-center">
              No post-exit outcomes recorded yet for residents under this grant.
            </div>
          ) : (
            <div className="p-5 space-y-5">
              {/* KPI strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { icon: Briefcase, label: 'Employment Rate', value: `${total > 0 ? Math.round((employed/total)*100) : 0}%`, sub: `${employed} of ${total}`, color: '#10B981' },
                  { icon: Home, label: 'Stable Housing', value: `${total > 0 ? Math.round((stableHousing/total)*100) : 0}%`, sub: `${avgHousingDays}d avg`, color: '#6366F1' },
                  { icon: GraduationCap, label: 'Education Active', value: `${total > 0 ? Math.round((educationPositive/total)*100) : 0}%`, sub: `${educationPositive} of ${total}`, color: '#F97316' },
                  { icon: Heart, label: 'Sobriety Maintained', value: `${total > 0 ? Math.round((sobrietyMaintained/total)*100) : 0}%`, sub: `${avgSobrietyDays}d avg`, color: '#EC4899' },
                ].map(({ icon: Icon, label, value, sub, color }) => (
                  <div key={label} className="bg-slate-50 rounded-xl p-3 text-center">
                    <Icon className="w-4 h-4 mx-auto mb-1" style={{ color }} />
                    <p className="text-xl font-black" style={{ color }}>{value}</p>
                    <p className="text-xs font-semibold text-slate-600 mt-0.5">{label}</p>
                    <p className="text-xs text-slate-400">{sub}</p>
                  </div>
                ))}
              </div>

              {/* Detail bars */}
              <div className="space-y-2.5">
                <ImpactBar label="Employed" value={employed} total={total} color="#10B981" />
                <ImpactBar label="Stable Housing" value={stableHousing} total={total} color="#6366F1" />
                <ImpactBar label="Education Enrolled/Completed" value={educationPositive} total={total} color="#F97316" />
                <ImpactBar label="Sobriety Maintained" value={sobrietyMaintained} total={total} color="#EC4899" />
                <ImpactBar label="Recovery Support Active" value={recoverySupport} total={total} color="#14B8A6" />
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}