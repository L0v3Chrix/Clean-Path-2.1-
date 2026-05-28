import { differenceInDays, differenceInYears, differenceInMonths, parseISO } from 'date-fns';
import { Flame, Heart } from 'lucide-react';

const MILESTONES = [
  { days: 1,    label: '24 Hours',   color: '#F59E0B' },
  { days: 7,    label: '1 Week',     color: '#10B981' },
  { days: 30,   label: '30 Days',    color: '#3B82F6' },
  { days: 60,   label: '60 Days',    color: '#8B5CF6' },
  { days: 90,   label: '90 Days',    color: '#EC4899' },
  { days: 180,  label: '6 Months',   color: '#F97316' },
  { days: 365,  label: '1 Year',     color: '#EF4444' },
  { days: 730,  label: '2 Years',    color: '#06B6D4' },
  { days: 1095, label: '3 Years',    color: '#F59E0B' },
];

export default function SobrietyMilestoneCard({ resident }) {
  if (!resident?.sober_date) {
    return (
      <div className="rounded-2xl border border-dashed border-amber-200 bg-amber-50 p-5 text-center">
        <Heart className="w-8 h-8 text-amber-300 mx-auto mb-2" />
        <p className="text-sm text-amber-700 font-medium">Sobriety date not set</p>
        <p className="text-xs text-amber-500 mt-1">Ask your house manager to update your profile.</p>
      </div>
    );
  }

  const soberDate = parseISO(resident.sober_date);
  const today = new Date();
  const totalDays = differenceInDays(today, soberDate);
  const years = differenceInYears(today, soberDate);
  const months = differenceInMonths(today, soberDate) % 12;
  const days = totalDays % 30;

  // Find next milestone
  const nextMilestone = MILESTONES.find(m => m.days > totalDays);
  const daysToNext = nextMilestone ? nextMilestone.days - totalDays : null;

  // Find highest achieved milestone
  const achieved = [...MILESTONES].reverse().find(m => totalDays >= m.days);

  const formatDuration = () => {
    if (years > 0) return `${years}y ${months}m ${days}d`;
    if (months > 0) return `${months} month${months > 1 ? 's' : ''} ${days} day${days !== 1 ? 's' : ''}`;
    return `${totalDays} day${totalDays !== 1 ? 's' : ''}`;
  };

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'linear-gradient(135deg, #065F46 0%, #047857 100%)' }}>
      <div className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <Flame className="w-5 h-5 text-emerald-200" />
          <span className="text-emerald-100 font-semibold text-sm">Sobriety Tracker</span>
          {achieved && (
            <span className="ml-auto text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: 'rgba(255,255,255,0.15)', color: '#fff' }}>
              🏆 {achieved.label}
            </span>
          )}
        </div>

        <div className="flex items-end gap-4">
          <div>
            <p className="text-5xl font-black text-white leading-none">{totalDays}</p>
            <p className="text-emerald-200 text-sm mt-1">days sober</p>
          </div>
          <div className="mb-1 text-right ml-auto">
            <p className="text-white font-bold text-lg">{formatDuration()}</p>
            <p className="text-emerald-300 text-xs">since {soberDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
          </div>
        </div>

        {nextMilestone && (
          <div className="mt-4">
            <div className="flex justify-between text-xs text-emerald-200 mb-1">
              <span>Next: {nextMilestone.label}</span>
              <span>{daysToNext} day{daysToNext !== 1 ? 's' : ''} to go</span>
            </div>
            <div className="h-2 rounded-full" style={{ background: 'rgba(255,255,255,0.15)' }}>
              <div
                className="h-2 rounded-full transition-all"
                style={{
                  width: `${Math.min(100, (totalDays / nextMilestone.days) * 100)}%`,
                  background: 'linear-gradient(90deg, #A7F3D0, #34D399)'
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Milestone chips */}
      <div className="px-5 pb-4 flex flex-wrap gap-2">
        {MILESTONES.slice(0, 6).map(m => (
          <span
            key={m.days}
            className="text-xs px-2 py-0.5 rounded-full border font-medium"
            style={totalDays >= m.days
              ? { background: 'rgba(255,255,255,0.2)', color: '#fff', borderColor: 'rgba(255,255,255,0.3)' }
              : { background: 'rgba(0,0,0,0.1)', color: 'rgba(255,255,255,0.35)', borderColor: 'rgba(255,255,255,0.1)' }
            }
          >
            {totalDays >= m.days ? '✓ ' : ''}{m.label}
          </span>
        ))}
      </div>
    </div>
  );
}