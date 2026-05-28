import { useState, useEffect, useMemo } from 'react';
import { appClient } from '@/services/appClient';
import {
  Plus, CheckCircle2, XCircle, Clock, CalendarDays,
  RotateCcw, ListChecks, ChevronLeft, ChevronRight, Pencil, Trash2, X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval,
  startOfWeek, endOfWeek, isSameMonth, addMonths, subMonths,
  isPast, isToday, addDays, addWeeks, addMonths as addMo
} from 'date-fns';

// ─── Config ───────────────────────────────────────────────────────────────────
const RECURRENCE_LABELS = {
  once: 'One-time', daily: 'Daily', weekly: 'Weekly',
  biweekly: 'Bi-weekly', monthly: 'Monthly'
};

const OUTCOME_CONFIG = {
  completed:   { label: 'Completed',   color: '#059669', bg: '#D1FAE5', icon: CheckCircle2 },
  missed:      { label: 'Missed',      color: '#DC2626', bg: '#FEE2E2', icon: XCircle },
  rescheduled: { label: 'Rescheduled', color: '#D97706', bg: '#FEF3C7', icon: Clock },
  excused:     { label: 'Excused',     color: '#6B7280', bg: '#F3F4F6', icon: Clock },
};

// ─── Expand recurring tasks into occurrences for a date range ─────────────────
function expandTasksForMonth(tasks, monthStart, monthEnd) {
  const results = [];
  tasks.forEach(task => {
    if (!task.due_date) {
      if (task.recurrence === 'once') return;
    }
    const start = task.due_date ? parseISO(task.due_date) : new Date();
    const genDates = [];

    if (task.recurrence === 'once') {
      if (start >= monthStart && start <= monthEnd) genDates.push(start);
    } else {
      let cursor = start;
      // walk backwards to find first occurrence before/within month
      while (cursor > monthStart) {
        if (task.recurrence === 'daily') cursor = addDays(cursor, -1);
        else if (task.recurrence === 'weekly') cursor = addWeeks(cursor, -1);
        else if (task.recurrence === 'biweekly') cursor = addWeeks(cursor, -2);
        else if (task.recurrence === 'monthly') cursor = addMo(cursor, -1);
      }
      // now walk forward through the month
      while (cursor <= monthEnd) {
        if (cursor >= monthStart) genDates.push(new Date(cursor));
        if (task.recurrence === 'daily') cursor = addDays(cursor, 1);
        else if (task.recurrence === 'weekly') cursor = addWeeks(cursor, 1);
        else if (task.recurrence === 'biweekly') cursor = addWeeks(cursor, 2);
        else if (task.recurrence === 'monthly') cursor = addMo(cursor, 1);
        else break;
      }
    }
    genDates.forEach(date => results.push({ task, date, dateStr: format(date, 'yyyy-MM-dd') }));
  });
  return results;
}

// ─── Task Form ────────────────────────────────────────────────────────────────
function TaskForm({ resident, editing, onSave, onClose }) {
  const [form, setForm] = useState(editing || {
    resident_id: resident.id,
    organization_id: resident.organization_id || '',
    title: '',
    description: '',
    recurrence: 'once',
    due_date: new Date().toISOString().split('T')[0],
    assigned_to_name: '',
    status: 'pending',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4">
      <div className="rounded-2xl w-full max-w-md shadow-2xl overflow-hidden" style={{ background: '#FAF6EF' }}>
        <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: '#E0D5C5' }}>
          <h3 className="font-bold" style={{ color: '#1C1917' }}>{editing ? 'Edit Task' : 'New Task'}</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <form onSubmit={async e => {
          e.preventDefault();
          setSaving(true);
          await onSave(form);
          setSaving(false);
        }} className="p-5 space-y-4">
          <div className="space-y-1.5">
            <Label>Task Title *</Label>
            <Input placeholder="e.g. Attend counseling session" value={form.title}
              onChange={e => set('title', e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea placeholder="Optional details…" value={form.description}
              onChange={e => set('description', e.target.value)} rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Recurrence</Label>
              <Select value={form.recurrence} onValueChange={v => set('recurrence', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(RECURRENCE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{form.recurrence === 'once' ? 'Due Date' : 'Starts On'}</Label>
              <Input type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Assigned To (staff)</Label>
            <Input placeholder="Staff name" value={form.assigned_to_name}
              onChange={e => set('assigned_to_name', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea placeholder="Any context…" value={form.notes}
              onChange={e => set('notes', e.target.value)} rows={2} />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving} style={{ background: '#B45309', color: '#fff' }}>
              {saving ? 'Saving…' : 'Save Task'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Log Modal ────────────────────────────────────────────────────────────────
function LogModal({ task, date, existingLog, onSave, onClose }) {
  const [form, setForm] = useState(existingLog || {
    task_id: task.id,
    resident_id: task.resident_id,
    organization_id: task.organization_id || '',
    log_date: format(date, 'yyyy-MM-dd'),
    outcome: 'completed',
    rescheduled_date: '',
    logged_by_name: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div className="fixed inset-0 bg-black/50 z-[80] flex items-center justify-center p-4">
      <div className="rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden" style={{ background: '#FAF6EF' }}>
        <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: '#E0D5C5' }}>
          <div>
            <h3 className="font-bold" style={{ color: '#1C1917' }}>Log Outcome</h3>
            <p className="text-xs mt-0.5" style={{ color: '#78716C' }}>{task.title} · {format(date, 'MMM d, yyyy')}</p>
          </div>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <form onSubmit={async e => {
          e.preventDefault();
          setSaving(true);
          await onSave(form);
          setSaving(false);
        }} className="p-5 space-y-4">
          <div className="space-y-2">
            <Label>Outcome</Label>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(OUTCOME_CONFIG).map(([k, cfg]) => {
                const Icon = cfg.icon;
                return (
                  <button key={k} type="button" onClick={() => set('outcome', k)}
                    className="flex items-center gap-2 rounded-xl p-2.5 text-sm font-medium border-2 transition-all"
                    style={{
                      borderColor: form.outcome === k ? cfg.color : '#E0D5C5',
                      background: form.outcome === k ? cfg.bg : '#FEFCF8',
                      color: form.outcome === k ? cfg.color : '#78716C',
                    }}>
                    <Icon className="w-4 h-4" /> {cfg.label}
                  </button>
                );
              })}
            </div>
          </div>
          {form.outcome === 'rescheduled' && (
            <div className="space-y-1.5">
              <Label>Rescheduled Date</Label>
              <Input type="date" value={form.rescheduled_date} onChange={e => set('rescheduled_date', e.target.value)} />
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Logged By</Label>
            <Input placeholder="Staff name" value={form.logged_by_name} onChange={e => set('logged_by_name', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea placeholder="Optional notes…" value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving} style={{ background: '#059669', color: '#fff' }}>
              {saving ? 'Saving…' : 'Log'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Calendar ─────────────────────────────────────────────────────────────────
function CalendarView({ tasks, logs, onCellClick }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart);
  const calEnd = endOfWeek(monthEnd);
  const days = eachDayOfInterval({ start: calStart, end: calEnd });

  // Map dateStr → occurrences
  const occurrencesByDate = useMemo(() => {
    const expanded = expandTasksForMonth(tasks, monthStart, monthEnd);
    const map = {};
    expanded.forEach(occ => {
      if (!map[occ.dateStr]) map[occ.dateStr] = [];
      map[occ.dateStr].push(occ);
    });
    return map;
  }, [tasks, currentMonth]);

  // Map taskId+date → log
  const logMap = useMemo(() => {
    const map = {};
    logs.forEach(l => { map[`${l.task_id}_${l.log_date}`] = l; });
    return map;
  }, [logs]);

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #E0D5C5' }}>
      {/* Month nav */}
      <div className="flex items-center justify-between px-4 py-3" style={{ background: '#1C1917' }}>
        <button onClick={() => setCurrentMonth(m => subMonths(m, 1))} className="p-1 rounded-lg hover:bg-white/10">
          <ChevronLeft className="w-4 h-4 text-amber-300" />
        </button>
        <span className="font-bold text-sm text-white">{format(currentMonth, 'MMMM yyyy')}</span>
        <button onClick={() => setCurrentMonth(m => addMonths(m, 1))} className="p-1 rounded-lg hover:bg-white/10">
          <ChevronRight className="w-4 h-4 text-amber-300" />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 text-center" style={{ background: '#F0E9DC' }}>
        {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
          <div key={d} className="py-1.5 text-xs font-bold" style={{ color: '#78716C' }}>{d}</div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7" style={{ background: '#FEFCF8' }}>
        {days.map(day => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const occs = occurrencesByDate[dateStr] || [];
          const today = isToday(day);
          const inMonth = isSameMonth(day, currentMonth);

          // Compute dot colors for each occurrence
          const dots = occs.map(occ => {
            const log = logMap[`${occ.task.id}_${dateStr}`];
            if (log) return OUTCOME_CONFIG[log.outcome]?.color || '#059669';
            if (isPast(day) && !today) return '#E0D5C5'; // missed (unlogged past)
            return '#B45309'; // pending
          });

          return (
            <button
              key={dateStr}
              onClick={() => occs.length > 0 && onCellClick(day, occs, logMap)}
              className="min-h-[52px] p-1.5 flex flex-col items-center gap-0.5 transition-colors hover:bg-amber-50/60 border-r border-b"
              style={{ borderColor: '#F0E9DC', opacity: inMonth ? 1 : 0.35 }}
            >
              <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-medium
                ${today ? 'text-white font-black' : ''}`}
                style={today ? { background: '#B45309' } : { color: inMonth ? '#1C1917' : '#C4B8A8' }}>
                {format(day, 'd')}
              </span>
              <div className="flex flex-wrap gap-0.5 justify-center">
                {dots.slice(0, 4).map((c, i) => (
                  <span key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: c }} />
                ))}
                {dots.length > 4 && <span className="text-[9px]" style={{ color: '#A09080' }}>+{dots.length - 4}</span>}
              </div>
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="px-4 py-2 flex flex-wrap gap-3" style={{ background: '#F0E9DC', borderTop: '1px solid #E0D5C5' }}>
        <span className="flex items-center gap-1.5 text-xs" style={{ color: '#78716C' }}>
          <span className="w-2 h-2 rounded-full" style={{ background: '#B45309' }} /> Pending
        </span>
        {Object.entries(OUTCOME_CONFIG).map(([k, cfg]) => (
          <span key={k} className="flex items-center gap-1.5 text-xs" style={{ color: '#78716C' }}>
            <span className="w-2 h-2 rounded-full" style={{ background: cfg.color }} /> {cfg.label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Day Detail Panel ─────────────────────────────────────────────────────────
function DayOccurrenceList({ day, occurrences, logMap, onLog, onClose }) {
  return (
    <div className="rounded-2xl overflow-hidden mt-3" style={{ border: '1px solid #E0D5C5', background: '#FEFCF8' }}>
      <div className="flex items-center justify-between px-4 py-2.5" style={{ background: '#F0E9DC' }}>
        <span className="font-semibold text-sm" style={{ color: '#1C1917' }}>
          {format(day, 'EEEE, MMMM d')}
        </span>
        <button onClick={onClose}><X className="w-4 h-4" style={{ color: '#78716C' }} /></button>
      </div>
      <div className="divide-y" style={{ borderColor: '#F0E9DC' }}>
        {occurrences.map(occ => {
          const log = logMap[`${occ.task.id}_${occ.dateStr}`];
          const cfg = log ? OUTCOME_CONFIG[log.outcome] : null;
          const Icon = cfg?.icon;
          return (
            <div key={occ.task.id} className="flex items-center gap-3 px-4 py-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium" style={{ color: '#1C1917' }}>{occ.task.title}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {occ.task.recurrence !== 'once' && (
                    <span className="flex items-center gap-1 text-xs" style={{ color: '#78716C' }}>
                      <RotateCcw className="w-3 h-3" /> {RECURRENCE_LABELS[occ.task.recurrence]}
                    </span>
                  )}
                  {occ.task.assigned_to_name && (
                    <span className="text-xs" style={{ color: '#78716C' }}>· {occ.task.assigned_to_name}</span>
                  )}
                </div>
                {log?.notes && <p className="text-xs mt-1 italic" style={{ color: '#78716C' }}>{log.notes}</p>}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {cfg ? (
                  <span className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: cfg.bg, color: cfg.color }}>
                    <Icon className="w-3 h-3" /> {cfg.label}
                  </span>
                ) : (
                  <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                    style={{ background: '#F0E9DC', color: '#B45309' }}>Pending</span>
                )}
                <button onClick={() => onLog(occ, log)}
                  className="text-xs px-2.5 py-1 rounded-lg font-medium transition-colors hover:opacity-80"
                  style={{ background: '#1C1917', color: '#F5EFE6' }}>
                  {log ? 'Edit' : 'Log'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Status List View ─────────────────────────────────────────────────────────
function StatusListView({ tasks, logs, onLog, onEdit, onDelete }) {
  const today = format(new Date(), 'yyyy-MM-dd');
  const logMap = useMemo(() => {
    const m = {};
    logs.forEach(l => { m[`${l.task_id}_${l.log_date}`] = l; });
    return m;
  }, [logs]);

  // Group: today's tasks, upcoming, recurring
  const todayOccs = useMemo(() => {
    const monthStart = startOfMonth(new Date());
    const monthEnd = endOfMonth(new Date());
    const expanded = expandTasksForMonth(tasks, monthStart, monthEnd);
    return expanded.filter(o => o.dateStr === today);
  }, [tasks]);

  return (
    <div className="space-y-4">
      {/* Today's tasks */}
      <div>
        <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: '#B45309' }}>Today</p>
        {todayOccs.length === 0 ? (
          <p className="text-sm" style={{ color: '#A09080' }}>No tasks scheduled today.</p>
        ) : (
          <div className="space-y-2">
            {todayOccs.map(occ => {
              const log = logMap[`${occ.task.id}_${today}`];
              const cfg = log ? OUTCOME_CONFIG[log.outcome] : null;
              return (
                <div key={occ.task.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5 group"
                  style={{ background: '#F0E9DC', border: '1px solid #E0D5C5' }}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold" style={{ color: '#1C1917' }}>{occ.task.title}</p>
                    {occ.task.assigned_to_name && <p className="text-xs" style={{ color: '#78716C' }}>{occ.task.assigned_to_name}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    {cfg ? (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
                    ) : (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: '#FEF3C7', color: '#B45309' }}>Pending</span>
                    )}
                    <button onClick={() => onLog(occ, log)} className="text-xs px-2.5 py-1 rounded-lg font-medium"
                      style={{ background: '#1C1917', color: '#F5EFE6' }}>{log ? 'Edit' : 'Log'}</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* All tasks */}
      <div>
        <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: '#78716C' }}>All Tasks</p>
        {tasks.length === 0 ? (
          <p className="text-sm" style={{ color: '#A09080' }}>No tasks yet.</p>
        ) : (
          <div className="space-y-2">
            {tasks.map(task => (
              <div key={task.id} className="rounded-xl px-3 py-2.5 group flex items-center gap-3"
                style={{ background: '#FEFCF8', border: '1px solid #E0D5C5' }}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium" style={{ color: '#1C1917' }}>{task.title}</p>
                  <div className="flex flex-wrap gap-2 mt-0.5">
                    <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: '#F0E9DC', color: '#B45309' }}>
                      {RECURRENCE_LABELS[task.recurrence]}
                    </span>
                    {task.due_date && <span className="text-xs" style={{ color: '#78716C' }}>From {task.due_date}</span>}
                    {task.assigned_to_name && <span className="text-xs" style={{ color: '#78716C' }}>· {task.assigned_to_name}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => onEdit(task)} className="p-1.5 rounded-lg hover:bg-amber-100">
                    <Pencil className="w-3.5 h-3.5" style={{ color: '#B45309' }} />
                  </button>
                  <button onClick={() => onDelete(task.id)} className="p-1.5 rounded-lg hover:bg-red-50">
                    <Trash2 className="w-3.5 h-3.5" style={{ color: '#DC2626' }} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function ResidentTasks({ resident }) {
  const [tasks, setTasks] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('calendar'); // 'calendar' | 'list'
  const [taskForm, setTaskForm] = useState(null);   // null | 'new' | task
  const [logModal, setLogModal] = useState(null);    // null | { occ, existingLog }
  const [selectedDay, setSelectedDay] = useState(null);
  const [selectedOccs, setSelectedOccs] = useState([]);
  const [selectedLogMap, setSelectedLogMap] = useState({});

  const load = async () => {
    setLoading(true);
    const [t, l] = await Promise.all([
      appClient.entities.CarePlanTask.filter({ resident_id: resident.id }, 'due_date', 500),
      appClient.entities.TaskLog.filter({ resident_id: resident.id }, '-log_date', 1000),
    ]);
    setTasks(t);
    setLogs(l);
    setLoading(false);
  };

  useEffect(() => { load(); }, [resident.id]);

  const saveTask = async (form) => {
    if (form.id) await appClient.entities.CarePlanTask.update(form.id, form);
    else await appClient.entities.CarePlanTask.create(form);
    setTaskForm(null);
    load();
  };

  const deleteTask = async (id) => {
    if (!confirm('Delete this task?')) return;
    await appClient.entities.CarePlanTask.delete(id);
    load();
  };

  const saveLog = async (form) => {
    if (form.id) await appClient.entities.TaskLog.update(form.id, form);
    else await appClient.entities.TaskLog.create(form);
    setLogModal(null);
    setSelectedDay(null);
    load();
  };

  const handleCellClick = (day, occs, logMap) => {
    setSelectedDay(day);
    setSelectedOccs(occs);
    setSelectedLogMap(logMap);
  };

  const handleLog = (occ, existingLog) => {
    setLogModal({ occ, existingLog });
    setSelectedDay(null);
  };

  // KPIs: last 30 days
  const kpis = useMemo(() => {
    const last30 = logs.filter(l => {
      const d = parseISO(l.log_date);
      const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 30);
      return d >= cutoff;
    });
    const completed = last30.filter(l => l.outcome === 'completed').length;
    const missed = last30.filter(l => l.outcome === 'missed').length;
    const total = last30.length;
    return { completed, missed, total, rate: total ? Math.round((completed / total) * 100) : null };
  }, [logs]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold" style={{ color: '#1C1917' }}>Task Schedule</h3>
          {kpis.total > 0 && (
            <p className="text-xs mt-0.5" style={{ color: '#78716C' }}>
              Last 30 days: <span style={{ color: '#059669', fontWeight: 700 }}>{kpis.completed} completed</span>
              {kpis.missed > 0 && <span style={{ color: '#DC2626' }}>, {kpis.missed} missed</span>}
              {kpis.rate != null && <span> ({kpis.rate}% rate)</span>}
            </p>
          )}
        </div>
        <Button size="sm" onClick={() => setTaskForm('new')} className="gap-1.5"
          style={{ background: '#B45309', color: '#fff' }}>
          <Plus className="w-3.5 h-3.5" /> New Task
        </Button>
      </div>

      {/* KPI strip */}
      {kpis.total > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Completed', value: kpis.completed, color: '#059669', bg: '#D1FAE5' },
            { label: 'Missed', value: kpis.missed, color: '#DC2626', bg: '#FEE2E2' },
            { label: 'Completion %', value: kpis.rate + '%', color: '#B45309', bg: '#FEF3C7' },
          ].map(s => (
            <div key={s.label} className="rounded-xl p-2.5 text-center" style={{ background: s.bg, border: `1px solid ${s.color}30` }}>
              <p className="text-xl font-black" style={{ color: s.color }}>{s.value}</p>
              <p className="text-xs" style={{ color: '#78716C' }}>{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* View switcher */}
      <div className="flex rounded-xl overflow-hidden border text-xs" style={{ borderColor: '#E0D5C5' }}>
        {[['calendar', 'Calendar', CalendarDays], ['list', 'Tasks & Status', ListChecks]].map(([v, l, Icon]) => (
          <button key={v} onClick={() => setView(v)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 font-medium transition-colors"
            style={view === v ? { background: '#1C1917', color: '#F5EFE6' } : { background: '#F0E9DC', color: '#78716C' }}>
            <Icon className="w-3.5 h-3.5" /> {l}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="h-14 rounded-xl animate-pulse" style={{ background: '#E5DDD0' }} />)}</div>
      ) : tasks.length === 0 ? (
        <div className="text-center py-12 rounded-2xl" style={{ background: '#F0E9DC', border: '1px dashed #C9B99A' }}>
          <ListChecks className="w-9 h-9 mx-auto mb-2" style={{ color: '#C9A227' }} />
          <p className="font-semibold" style={{ color: '#1C1917' }}>No tasks yet</p>
          <p className="text-sm mt-1" style={{ color: '#78716C' }}>Create one-off or recurring tasks for this resident.</p>
        </div>
      ) : (
        <>
          {view === 'calendar' && (
            <>
              <CalendarView tasks={tasks} logs={logs} onCellClick={handleCellClick} />
              {selectedDay && (
                <DayOccurrenceList
                  day={selectedDay}
                  occurrences={selectedOccs}
                  logMap={selectedLogMap}
                  onLog={handleLog}
                  onClose={() => setSelectedDay(null)}
                />
              )}
            </>
          )}
          {view === 'list' && (
            <StatusListView
              tasks={tasks}
              logs={logs}
              onLog={handleLog}
              onEdit={t => setTaskForm(t)}
              onDelete={deleteTask}
            />
          )}
        </>
      )}

      {/* Modals */}
      {taskForm && (
        <TaskForm
          resident={resident}
          editing={taskForm === 'new' ? null : taskForm}
          onSave={saveTask}
          onClose={() => setTaskForm(null)}
        />
      )}
      {logModal && (
        <LogModal
          task={logModal.occ.task}
          date={logModal.occ.date}
          existingLog={logModal.existingLog}
          onSave={saveLog}
          onClose={() => setLogModal(null)}
        />
      )}
    </div>
  );
}