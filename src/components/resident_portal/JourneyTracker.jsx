import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { format, parseISO, differenceInDays, isPast, isFuture, isToday } from 'date-fns';
import {
  MapPin, CheckCircle2, Circle, Clock, Star, Trophy, Flame,
  Target, Briefcase, Home, BookOpen, Heart, Scale, DollarSign,
  Users, Sparkles, ChevronDown, ChevronRight, Calendar, AlertCircle
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const PHASE_CONFIG = [
  {
    id: '1', label: 'Phase 1', subtitle: 'Stabilization',
    desc: 'Settling in, establishing routines, basic accountability.',
    color: '#F59E0B', bg: '#FEF3C7', border: '#FDE68A',
    durationLabel: 'Days 1–30'
  },
  {
    id: '2', label: 'Phase 2', subtitle: 'Integration',
    desc: 'Building skills, employment, community engagement.',
    color: '#10B981', bg: '#D1FAE5', border: '#A7F3D0',
    durationLabel: 'Days 31–90'
  },
  {
    id: '3', label: 'Phase 3', subtitle: 'Growth',
    desc: 'Independence, mentoring, advanced goal pursuit.',
    color: '#3B82F6', bg: '#DBEAFE', border: '#BFDBFE',
    durationLabel: 'Days 91–180'
  },
  {
    id: '4', label: 'Phase 4', subtitle: 'Transition',
    desc: 'Alumni preparation, independent housing planning.',
    color: '#8B5CF6', bg: '#EDE9FE', border: '#DDD6FE',
    durationLabel: 'Days 181+'
  },
];

const CATEGORY_ICONS = {
  sobriety: Flame, employment: Briefcase, housing: Home,
  education: BookOpen, mental_health: Heart, physical_health: Heart,
  family: Users, legal: Scale, financial: DollarSign,
  social: Users, spiritual: Sparkles, other: Target,
};

const STATUS_CONFIG = {
  completed: { label: 'Completed', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', icon: CheckCircle2 },
  in_progress: { label: 'In Progress', color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200', icon: Clock },
  not_started: { label: 'Not Started', color: 'text-slate-500', bg: 'bg-slate-50', border: 'border-slate-200', icon: Circle },
  on_hold: { label: 'On Hold', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', icon: AlertCircle },
  discontinued: { label: 'Discontinued', color: 'text-red-500', bg: 'bg-red-50', border: 'border-red-200', icon: AlertCircle },
};

function GoalCard({ goal, tasks }) {
  const [open, setOpen] = useState(false);
  const CatIcon = CATEGORY_ICONS[goal.category] || Target;
  const st = STATUS_CONFIG[goal.status] || STATUS_CONFIG.not_started;
  const StatusIcon = st.icon;
  const relatedTasks = tasks.filter(t => t.goal_id === goal.id);
  const pendingTasks = relatedTasks.filter(t => t.status === 'pending' || t.status === 'overdue');
  const overdue = goal.target_date && isPast(parseISO(goal.target_date)) && goal.status !== 'completed';

  return (
    <div className={`rounded-xl border ${st.border} ${st.bg} overflow-hidden`}>
      <button
        className="w-full text-left px-4 py-3 flex items-start gap-3"
        onClick={() => setOpen(o => !o)}
      >
        <div className="mt-0.5">
          <CatIcon className="w-4 h-4 text-slate-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-slate-800 text-sm">{goal.title}</span>
            {overdue && (
              <span className="text-xs font-medium text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">Overdue</span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
            <span className={`flex items-center gap-1 ${st.color} font-medium`}>
              <StatusIcon className="w-3 h-3" /> {st.label}
            </span>
            {goal.target_date && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {format(parseISO(goal.target_date), 'MMM d, yyyy')}
              </span>
            )}
            {relatedTasks.length > 0 && (
              <span>{relatedTasks.length - pendingTasks.length}/{relatedTasks.length} tasks done</span>
            )}
          </div>
        </div>
        {(goal.description || relatedTasks.length > 0) && (
          open ? <ChevronDown className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" /> : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
        )}
      </button>

      {open && (
        <div className="px-4 pb-3 space-y-2 border-t border-current/10">
          {goal.description && (
            <p className="text-xs text-slate-600 pt-2">{goal.description}</p>
          )}
          {goal.progress_notes && (
            <p className="text-xs text-slate-500 italic">"{goal.progress_notes}"</p>
          )}
          {relatedTasks.length > 0 && (
            <div className="space-y-1.5 pt-1">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Tasks</p>
              {relatedTasks.map(t => (
                <div key={t.id} className="flex items-center gap-2 text-xs text-slate-700">
                  {t.status === 'completed'
                    ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    : t.status === 'overdue'
                    ? <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                    : <Circle className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                  }
                  <span className={t.status === 'completed' ? 'line-through text-slate-400' : ''}>
                    {t.title}
                  </span>
                  {t.due_date && (
                    <span className="ml-auto text-slate-400">
                      {format(parseISO(t.due_date), 'MMM d')}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MilestoneItem({ milestone }) {
  const isAuto = milestone.source === 'auto';
  const typeEmoji = {
    intake: '🏠', sobriety_date: '🔥', phase_change: '🚀', life_skills: '🛠',
    employment: '💼', housing_goal: '🏡', medical: '🏥', legal: '⚖️',
    family: '👨‍👩‍👧', graduation: '🎓', other: '📌', status_change: '🔄',
    interview_completed: '📋', care_plan_update: '📝',
  };
  const emoji = typeEmoji[milestone.type] || '📌';

  return (
    <div className="flex gap-3 items-start group">
      <div className="shrink-0 flex flex-col items-center">
        <div className="w-8 h-8 rounded-full bg-white border-2 border-amber-300 flex items-center justify-center text-base shadow-sm">
          {emoji}
        </div>
        <div className="w-0.5 bg-amber-100 flex-1 min-h-[20px]" />
      </div>
      <div className="pb-4 flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <p className="font-semibold text-slate-800 text-sm">{milestone.title}</p>
          <span className="text-xs text-slate-400 shrink-0">
            {format(parseISO(milestone.date), 'MMM d, yyyy')}
          </span>
        </div>
        {milestone.description && (
          <p className="text-xs text-slate-500 mt-0.5">{milestone.description}</p>
        )}
        {milestone.staff_annotation && (
          <p className="text-xs text-slate-400 italic mt-0.5">"{milestone.staff_annotation}"</p>
        )}
        {isAuto && (
          <Badge className="mt-1 text-[10px] h-4 bg-slate-100 text-slate-400 border-0 px-1.5">auto</Badge>
        )}
      </div>
    </div>
  );
}

export default function JourneyTracker({ resident }) {
  const [goals, setGoals] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [milestones, setMilestones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState('phases');

  useEffect(() => {
    if (!resident?.id) { setLoading(false); return; }
    Promise.all([
      base44.entities.CarePlanGoal.filter({ resident_id: resident.id }),
      base44.entities.CarePlanTask.filter({ resident_id: resident.id }),
      base44.entities.ResidentMilestone.filter({ resident_id: resident.id }),
    ]).then(([g, t, m]) => {
      setGoals(g.sort((a, b) => (a.status === 'completed' ? 1 : 0) - (b.status === 'completed' ? 1 : 0)));
      setTasks(t);
      setMilestones(m.sort((a, b) => new Date(b.date) - new Date(a.date)));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [resident?.id]);

  if (!resident) return null;

  const currentPhase = resident.phase || '1';
  const currentPhaseNum = parseInt(currentPhase, 10) || 1;
  const intakeDate = resident.intake_date ? parseISO(resident.intake_date) : null;
  const daysInProgram = intakeDate ? differenceInDays(new Date(), intakeDate) : null;

  // Upcoming tasks (next 30 days, not completed)
  const upcoming = tasks.filter(t =>
    t.status === 'pending' && t.due_date &&
    isFuture(parseISO(t.due_date)) &&
    differenceInDays(parseISO(t.due_date), new Date()) <= 30
  ).sort((a, b) => new Date(a.due_date) - new Date(b.due_date));

  const completedGoals = goals.filter(g => g.status === 'completed').length;
  const totalGoals = goals.length;
  const progressPct = totalGoals > 0 ? Math.round((completedGoals / totalGoals) * 100) : 0;

  const shortGoals = goals.filter(g => g.term === 'short_term');
  const longGoals = goals.filter(g => g.term === 'long_term');

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="h-4 bg-slate-100 rounded w-1/3 animate-pulse mb-3" />
        <div className="h-24 bg-slate-50 rounded-xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-4" style={{ background: 'linear-gradient(135deg, #1C1917 0%, #292118 100%)' }}>
        <div className="flex items-center gap-2 mb-3">
          <MapPin className="w-4 h-4 text-amber-400" />
          <h2 className="font-bold text-white text-base">Your Recovery Journey</h2>
        </div>

        {/* Phase strip */}
        <div className="flex gap-1.5 mb-4">
          {PHASE_CONFIG.map((ph, i) => {
            const phNum = i + 1;
            const isActive = phNum === currentPhaseNum;
            const isDone = phNum < currentPhaseNum;
            return (
              <div key={ph.id} className="flex-1 text-center">
                <div className={`h-1.5 rounded-full mb-1.5 transition-all ${isDone ? 'bg-emerald-400' : isActive ? 'bg-amber-400' : 'bg-white/20'}`} />
                <p className={`text-[10px] font-semibold ${isActive ? 'text-amber-400' : isDone ? 'text-emerald-400' : 'text-white/40'}`}>
                  {ph.label}
                </p>
                <p className={`text-[9px] ${isActive ? 'text-amber-300' : isDone ? 'text-emerald-300' : 'text-white/30'}`}>
                  {ph.subtitle}
                </p>
              </div>
            );
          })}
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white/10 rounded-xl p-2.5 text-center">
            <p className="text-amber-400 font-bold text-lg leading-none">{daysInProgram ?? '—'}</p>
            <p className="text-white/60 text-[10px] mt-0.5">Days In</p>
          </div>
          <div className="bg-white/10 rounded-xl p-2.5 text-center">
            <p className="text-amber-400 font-bold text-lg leading-none">{completedGoals}/{totalGoals}</p>
            <p className="text-white/60 text-[10px] mt-0.5">Goals Done</p>
          </div>
          <div className="bg-white/10 rounded-xl p-2.5 text-center">
            <p className="text-amber-400 font-bold text-lg leading-none">{milestones.length}</p>
            <p className="text-white/60 text-[10px] mt-0.5">Milestones</p>
          </div>
        </div>
      </div>

      {/* Goal progress bar */}
      {totalGoals > 0 && (
        <div className="px-5 py-3 border-b border-slate-100">
          <div className="flex justify-between text-xs text-slate-500 mb-1.5">
            <span className="font-medium text-slate-700">Overall Goal Progress</span>
            <span className="font-bold text-slate-700">{progressPct}%</span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${progressPct}%`, background: 'linear-gradient(90deg, #F59E0B, #10B981)' }}
            />
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-100">
        {[
          { id: 'phases', label: 'Phase Map' },
          { id: 'goals', label: `Goals${totalGoals > 0 ? ` (${totalGoals})` : ''}` },
          { id: 'upcoming', label: `Upcoming${upcoming.length > 0 ? ` (${upcoming.length})` : ''}` },
          { id: 'milestones', label: `Milestones${milestones.length > 0 ? ` (${milestones.length})` : ''}` },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setActiveSection(t.id)}
            className={`flex-1 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
              activeSection === t.id
                ? 'border-amber-500 text-amber-700'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="p-4">
        {/* PHASE MAP */}
        {activeSection === 'phases' && (
          <div className="space-y-3">
            {PHASE_CONFIG.map((ph, i) => {
              const phNum = i + 1;
              const isActive = phNum === currentPhaseNum;
              const isDone = phNum < currentPhaseNum;
              return (
                <div
                  key={ph.id}
                  className={`rounded-xl border-2 p-4 transition-all ${
                    isActive ? 'border-amber-400 shadow-md' : isDone ? 'border-emerald-200' : 'border-slate-100 opacity-60'
                  }`}
                  style={{ background: isActive ? ph.bg : isDone ? '#F0FDF4' : '#F8FAFC' }}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 font-bold text-sm ${
                      isDone ? 'bg-emerald-500 text-white' : isActive ? 'text-white' : 'bg-slate-200 text-slate-400'
                    }`}
                      style={isActive ? { background: ph.color } : {}}
                    >
                      {isDone ? <CheckCircle2 className="w-5 h-5" /> : phNum}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-slate-800 text-sm">{ph.label}: {ph.subtitle}</p>
                        {isActive && (
                          <Badge className="text-[10px] h-5 px-2 border-0 font-semibold" style={{ background: ph.color + '30', color: ph.color }}>
                            You are here
                          </Badge>
                        )}
                        {isDone && (
                          <Badge className="text-[10px] h-5 px-2 bg-emerald-100 text-emerald-700 border-0">Completed</Badge>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">{ph.desc}</p>
                      <p className="text-[10px] text-slate-400 mt-1">{ph.durationLabel}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* GOALS */}
        {activeSection === 'goals' && (
          <div className="space-y-4">
            {totalGoals === 0 && (
              <div className="text-center py-8 text-slate-400">
                <Target className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No goals set yet. Your care team will add goals to your plan.</p>
              </div>
            )}
            {shortGoals.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Short-Term Goals (≤90 days)</p>
                {shortGoals.map(g => <GoalCard key={g.id} goal={g} tasks={tasks} />)}
              </div>
            )}
            {longGoals.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Long-Term Goals</p>
                {longGoals.map(g => <GoalCard key={g.id} goal={g} tasks={tasks} />)}
              </div>
            )}
          </div>
        )}

        {/* UPCOMING */}
        {activeSection === 'upcoming' && (
          <div className="space-y-2">
            {upcoming.length === 0 && (
              <div className="text-center py-8 text-slate-400">
                <Calendar className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No upcoming tasks in the next 30 days.</p>
              </div>
            )}
            {upcoming.map(t => {
              const daysLeft = differenceInDays(parseISO(t.due_date), new Date());
              const isUrgent = daysLeft <= 3;
              return (
                <div key={t.id} className={`flex items-start gap-3 rounded-xl border p-3 ${isUrgent ? 'border-red-200 bg-red-50' : 'border-slate-100 bg-slate-50'}`}>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${isUrgent ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-700'}`}>
                    {daysLeft === 0 ? 'Today' : `${daysLeft}d`}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800 text-sm">{t.title}</p>
                    {t.description && <p className="text-xs text-slate-500 mt-0.5">{t.description}</p>}
                    <p className="text-xs text-slate-400 mt-0.5">
                      Due {format(parseISO(t.due_date), 'EEEE, MMM d')}
                      {t.assigned_to_name && ` · Assigned by ${t.assigned_to_name}`}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* MILESTONES */}
        {activeSection === 'milestones' && (
          <div>
            {milestones.length === 0 && (
              <div className="text-center py-8 text-slate-400">
                <Trophy className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">Your milestones will appear here as you progress.</p>
              </div>
            )}
            <div className="relative">
              {milestones.map((m, i) => (
                <MilestoneItem key={m.id} milestone={m} isLast={i === milestones.length - 1} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}