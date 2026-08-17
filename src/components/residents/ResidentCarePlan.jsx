import { useState, useEffect } from 'react';
import { appClient } from '@/services/appClient';
import {
  Plus, X, ChevronDown, ChevronRight, CheckCircle2, Circle, Target, ListChecks, Pencil, Trash2, RotateCcw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { format, parseISO, isValid, isPast } from 'date-fns';

// ─── Config ──────────────────────────────────────────────────────────────────

const CATEGORY_CONFIG = {
  sobriety:       { label: 'Sobriety',        color: '#B45309', bg: '#FEF3C7' },
  employment:     { label: 'Employment',       color: '#0891B2', bg: '#CFFAFE' },
  housing:        { label: 'Housing',          color: '#7C3AED', bg: '#EDE9FE' },
  education:      { label: 'Education',        color: '#059669', bg: '#D1FAE5' },
  mental_health:  { label: 'Mental Health',    color: '#DC2626', bg: '#FEE2E2' },
  physical_health:{ label: 'Physical Health',  color: '#EA580C', bg: '#FFEDD5' },
  family:         { label: 'Family',           color: '#D97706', bg: '#FEF3C7' },
  legal:          { label: 'Legal',            color: '#6B7280', bg: '#F3F4F6' },
  financial:      { label: 'Financial',        color: '#15803D', bg: '#DCFCE7' },
  social:         { label: 'Social',           color: '#0284C7', bg: '#E0F2FE' },
  spiritual:      { label: 'Spiritual',        color: '#9333EA', bg: '#F3E8FF' },
  other:          { label: 'Other',            color: '#78716C', bg: '#F5F5F4' },
};

const STATUS_CONFIG = {
  not_started:  { label: 'Not Started', color: '#78716C', bg: '#F5F5F4' },
  in_progress:  { label: 'In Progress', color: '#0891B2', bg: '#CFFAFE' },
  completed:    { label: 'Completed',   color: '#059669', bg: '#D1FAE5' },
  on_hold:      { label: 'On Hold',     color: '#D97706', bg: '#FEF3C7' },
  discontinued: { label: 'Discontinued',color: '#DC2626', bg: '#FEE2E2' },
};

const TASK_STATUS_CONFIG = {
  pending:   { label: 'Pending',   color: '#78716C' },
  completed: { label: 'Done',      color: '#059669' },
  overdue:   { label: 'Overdue',   color: '#DC2626' },
  cancelled: { label: 'Cancelled', color: '#9CA3AF' },
};

// ─── Pill badge ───────────────────────────────────────────────────────────────
function Pill({ cfg, children }) {
  return (
    <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: cfg.bg, color: cfg.color }}>
      {children || cfg.label}
    </span>
  );
}

// ─── Progress bar ─────────────────────────────────────────────────────────────
function ProgressBar({ goals }) {
  const total = goals.length;
  const done = goals.filter(g => g.status === 'completed').length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs" style={{ color: '#78716C' }}>
        <span>{done}/{total} goals completed</span>
        <span className="font-semibold" style={{ color: '#1C1917' }}>{pct}%</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: '#E0D5C5' }}>
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: pct === 100 ? '#059669' : '#B45309' }} />
      </div>
    </div>
  );
}

// ─── Goal Form ────────────────────────────────────────────────────────────────
function GoalForm({ resident, editing, onSave, onClose }) {
  const [form, setForm] = useState(() => ({
    resident_id: resident.id,
    organization_id: resident.organization_id,
    term: 'short_term',
    category: 'sobriety',
    title: '',
    description: '',
    target_date: '',
    status: 'not_started',
    progress_notes: '',
    ...editing,
    description: editing?.description || '',
    target_date: editing?.target_date || '',
    progress_notes: editing?.progress_notes || '',
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
      <div className="rounded-2xl w-full max-w-md shadow-2xl overflow-hidden" style={{ background: '#FAF6EF' }}>
        <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: '#E0D5C5' }}>
          <h3 className="font-bold" style={{ color: '#1C1917' }}>{editing ? 'Edit Goal' : 'Add Recovery Goal'}</h3>
          <button onClick={onClose}><X className="w-5 h-5" style={{ color: '#78716C' }} /></button>
        </div>
        <form onSubmit={async e => {
          e.preventDefault();
          setSaving(true);
          setError('');
          try { await onSave(form); } catch (saveError) { setError(saveError.message); }
          finally { setSaving(false); }
        }} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Term *</Label>
              <Select value={form.term} onValueChange={v => set('term', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="short_term">Short-Term (≤90 days)</SelectItem>
                  <SelectItem value="long_term">Long-Term (&gt;90 days)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Category *</Label>
              <Select value={form.category} onValueChange={v => set('category', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_CONFIG).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Goal Title *</Label>
            <Input placeholder="e.g. Maintain 90 days sobriety" value={form.title} onChange={e => set('title', e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea placeholder="Specific, measurable steps…" value={form.description} onChange={e => set('description', e.target.value)} rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Target Date</Label>
              <Input type="date" value={form.target_date} onChange={e => set('target_date', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => set('status', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {editing && (
            <div className="space-y-1.5">
              <Label>Progress Notes</Label>
              <Textarea placeholder="Staff notes on progress…" value={form.progress_notes} onChange={e => set('progress_notes', e.target.value)} rows={2} />
            </div>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving} style={{ background: '#B45309', color: '#fff' }}>
              {saving ? 'Saving…' : 'Save Goal'}
            </Button>
          </div>
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        </form>
      </div>
    </div>
  );
}

// ─── Task Form ────────────────────────────────────────────────────────────────
function TaskForm({ resident, goals, editing, presetGoalId, onSave, onClose }) {
  const [form, setForm] = useState(() => ({
    resident_id: resident.id,
    organization_id: resident.organization_id,
    goal_id: presetGoalId || '',
    title: '',
    description: '',
    recurrence: 'once',
    due_date: '',
    assigned_to_name: '',
    status: 'pending',
    notes: '',
    ...editing,
    goal_id: editing?.goal_id || presetGoalId || '',
    description: editing?.description || '',
    due_date: editing?.due_date || '',
    assigned_to_name: editing?.assigned_to_name || '',
    notes: editing?.notes || '',
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
      <div className="rounded-2xl w-full max-w-md shadow-2xl overflow-hidden" style={{ background: '#FAF6EF' }}>
        <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: '#E0D5C5' }}>
          <h3 className="font-bold" style={{ color: '#1C1917' }}>{editing ? 'Edit Task' : 'Add Follow-Up Task'}</h3>
          <button onClick={onClose}><X className="w-5 h-5" style={{ color: '#78716C' }} /></button>
        </div>
        <form onSubmit={async e => {
          e.preventDefault();
          setSaving(true);
          setError('');
          try { await onSave(form); } catch (saveError) { setError(saveError.message); }
          finally { setSaving(false); }
        }} className="p-5 space-y-4">
          <div className="space-y-1.5">
            <Label>Task Title *</Label>
            <Input placeholder="e.g. Weekly check-in call" value={form.title} onChange={e => set('title', e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Linked Goal</Label>
              <Select value={form.goal_id || 'none'} onValueChange={v => set('goal_id', v === 'none' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {goals.map(g => <SelectItem key={g.id} value={g.id}>{g.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Recurrence</Label>
              <Select value={form.recurrence} onValueChange={v => set('recurrence', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="once">One-time</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="biweekly">Bi-weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Due Date</Label>
              <Input type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Assigned To</Label>
              <Input placeholder="Staff name" value={form.assigned_to_name} onChange={e => set('assigned_to_name', e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea placeholder="Additional context…" value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving} style={{ background: '#B45309', color: '#fff' }}>
              {saving ? 'Saving…' : 'Save Task'}
            </Button>
          </div>
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        </form>
      </div>
    </div>
  );
}

// ─── Goal Card ────────────────────────────────────────────────────────────────
function GoalCard({ goal, tasks, onEditGoal, onDeleteGoal, onAddTask, onEditTask, onDeleteTask, onToggleTask }) {
  const [expanded, setExpanded] = useState(true);
  const linkedTasks = tasks.filter(t => t.goal_id === goal.id);
  const cfg = STATUS_CONFIG[goal.status] || STATUS_CONFIG.not_started;
  const catCfg = CATEGORY_CONFIG[goal.category] || CATEGORY_CONFIG.other;

  return (
    <article aria-label={`Care plan goal: ${goal.title}`} className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${goal.status === 'completed' ? '#A7F3D0' : '#E0D5C5'}`, background: goal.status === 'completed' ? '#F0FDF4' : '#FEFCF8' }}>
      {/* Goal header */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          <button onClick={() => setExpanded(e => !e)} className="mt-0.5 flex-shrink-0">
            {expanded ? <ChevronDown className="w-4 h-4" style={{ color: '#78716C' }} /> : <ChevronRight className="w-4 h-4" style={{ color: '#78716C' }} />}
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <Pill cfg={catCfg}>{catCfg.label}</Pill>
              <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
              <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: goal.term === 'short_term' ? '#DBEAFE' : '#EDE9FE', color: goal.term === 'short_term' ? '#1D4ED8' : '#7C3AED' }}>
                {goal.term === 'short_term' ? 'Short-Term' : 'Long-Term'}
              </span>
            </div>
            <p className="font-semibold text-sm" style={{ color: '#1C1917' }}>{goal.title}</p>
            {goal.target_date && (
              <p className="text-xs mt-0.5" style={{ color: '#78716C' }}>
                Target: {isValid(parseISO(goal.target_date)) ? format(parseISO(goal.target_date), 'MMM d, yyyy') : goal.target_date}
                {goal.status !== 'completed' && goal.target_date && isPast(parseISO(goal.target_date)) && (
                  <span className="ml-1 font-semibold" style={{ color: '#DC2626' }}>· Overdue</span>
                )}
              </p>
            )}
            {goal.description && <p className="text-xs mt-1 leading-relaxed" style={{ color: '#78716C' }}>{goal.description}</p>}
            {goal.progress_notes && (
              <div className="mt-2 text-xs rounded-lg px-3 py-2" style={{ background: '#FEF3C7', color: '#92400E' }}>
                <span className="font-semibold">Notes: </span>{goal.progress_notes}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button onClick={() => onEditGoal(goal)} className="p-1.5 rounded-lg hover:bg-amber-100" title="Edit goal"><Pencil className="w-3.5 h-3.5" style={{ color: '#B45309' }} /></button>
            <button onClick={() => onDeleteGoal(goal.id)} className="p-1.5 rounded-lg hover:bg-red-50" title="Delete goal"><Trash2 className="w-3.5 h-3.5" style={{ color: '#DC2626' }} /></button>
          </div>
        </div>
      </div>

      {/* Tasks */}
      {expanded && (
        <div className="border-t px-4 pb-3 pt-2 space-y-2" style={{ borderColor: '#E0D5C5', background: '#FAF6EF' }}>
          {linkedTasks.length === 0 && (
            <p className="text-xs py-1" style={{ color: '#A09080' }}>No follow-up tasks for this goal.</p>
          )}
          {linkedTasks.map(task => (
            <TaskRow key={task.id} task={task} onEdit={onEditTask} onDelete={onDeleteTask} onToggle={onToggleTask} />
          ))}
          <button onClick={() => onAddTask(goal.id)} className="flex items-center gap-1.5 text-xs font-medium mt-1 hover:underline" style={{ color: '#B45309' }}>
            <Plus className="w-3 h-3" /> Add task to this goal
          </button>
        </div>
      )}
    </article>
  );
}

// ─── Task Row ─────────────────────────────────────────────────────────────────
function TaskRow({ task, onEdit, onDelete, onToggle }) {
  const done = task.status === 'completed';
  const overdue = !done && task.due_date && isPast(parseISO(task.due_date));
  return (
    <article aria-label={`Care plan task: ${task.title}`} className="flex items-center gap-3 py-1.5 px-2 rounded-xl group hover:bg-amber-50/50 transition-colors">
      <button aria-label={`${done ? 'Reopen' : 'Complete'} task ${task.title}`} onClick={() => onToggle(task)} className="flex-shrink-0">
        {done
          ? <CheckCircle2 className="w-4 h-4" style={{ color: '#059669' }} />
          : <Circle className="w-4 h-4" style={{ color: overdue ? '#DC2626' : '#A09080' }} />
        }
      </button>
      <div className="flex-1 min-w-0">
        <p className={`text-sm ${done ? 'line-through' : ''}`} style={{ color: done ? '#A09080' : '#1C1917' }}>{task.title}</p>
        <div className="flex items-center gap-2 flex-wrap">
          {task.recurrence !== 'once' && (
            <span className="flex items-center gap-0.5 text-xs" style={{ color: '#78716C' }}>
              <RotateCcw className="w-3 h-3" />{task.recurrence}
            </span>
          )}
          {task.due_date && (
            <span className="text-xs" style={{ color: overdue ? '#DC2626' : '#78716C' }}>
              {overdue ? '⚠ ' : ''}{isValid(parseISO(task.due_date)) ? format(parseISO(task.due_date), 'MMM d') : task.due_date}
            </span>
          )}
          {task.assigned_to_name && (
            <span className="text-xs" style={{ color: '#78716C' }}>· {task.assigned_to_name}</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={() => onEdit(task)} className="p-1 rounded hover:bg-amber-100" title="Edit"><Pencil className="w-3 h-3" style={{ color: '#B45309' }} /></button>
        <button onClick={() => onDelete(task.id)} className="p-1 rounded hover:bg-red-50" title="Delete"><Trash2 className="w-3 h-3" style={{ color: '#DC2626' }} /></button>
      </div>
    </article>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ResidentCarePlan({ resident }) {
  const [goals, setGoals] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [termFilter, setTermFilter] = useState('all');

  const [goalForm, setGoalForm] = useState(null);   // null | 'new' | goal obj
  const [taskForm, setTaskForm] = useState(null);   // null | { goalId } | task obj

  const load = async () => {
    setLoading(true);
    const [g, t] = await Promise.all([
      appClient.entities.CarePlanGoal.filter({ resident_id: resident.id }, 'created_date', 200),
      appClient.entities.CarePlanTask.filter({ resident_id: resident.id }, 'due_date', 200),
    ]);
    setGoals(g);
    setTasks(t);
    setLoading(false);
  };

  useEffect(() => { load(); }, [resident.id]);

  const saveGoal = async (form) => {
    if (form.id) await appClient.entities.CarePlanGoal.update(form.id, form);
    else await appClient.entities.CarePlanGoal.create(form);
    setGoalForm(null);
    load();
  };

  const deleteGoal = async (id) => {
    if (!confirm('Delete this goal and its tasks?')) return;
    await appClient.entities.CarePlanGoal.delete(id);
    // also delete linked tasks
    const linked = tasks.filter(t => t.goal_id === id);
    await Promise.all(linked.map(t => appClient.entities.CarePlanTask.delete(t.id)));
    load();
  };

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

  const toggleTask = async (task) => {
    const newStatus = task.status === 'completed' ? 'pending' : 'completed';
    await appClient.entities.CarePlanTask.update(task.id, {
      status: newStatus,
      completed_date: newStatus === 'completed' ? new Date().toISOString().split('T')[0] : '',
    });
    load();
  };

  const filteredGoals = goals.filter(g => termFilter === 'all' || g.term === termFilter);
  const shortGoals = goals.filter(g => g.term === 'short_term');
  const longGoals = goals.filter(g => g.term === 'long_term');
  const unlinkedTasks = tasks.filter(t => !t.goal_id);
  const pendingTasks = tasks.filter(t => t.status === 'pending').length;
  const overdueTasks = tasks.filter(t => t.status === 'pending' && t.due_date && isPast(parseISO(t.due_date))).length;

  return (
    <div className="space-y-5">
      {/* Summary row */}
      {!loading && goals.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl p-3 text-center" style={{ background: '#F0E9DC', border: '1px solid #E0D5C5' }}>
            <p className="text-2xl font-black" style={{ color: '#1C1917' }}>{goals.length}</p>
            <p className="text-xs" style={{ color: '#78716C' }}>Total Goals</p>
          </div>
          <div className="rounded-xl p-3 text-center" style={{ background: pendingTasks > 0 ? '#FEF3C7' : '#F0E9DC', border: `1px solid ${pendingTasks > 0 ? '#FDE68A' : '#E0D5C5'}` }}>
            <p className="text-2xl font-black" style={{ color: '#B45309' }}>{pendingTasks}</p>
            <p className="text-xs" style={{ color: '#78716C' }}>Open Tasks</p>
          </div>
          <div className="rounded-xl p-3 text-center" style={{ background: overdueTasks > 0 ? '#FEE2E2' : '#F0E9DC', border: `1px solid ${overdueTasks > 0 ? '#FECACA' : '#E0D5C5'}` }}>
            <p className="text-2xl font-black" style={{ color: overdueTasks > 0 ? '#DC2626' : '#1C1917' }}>{overdueTasks}</p>
            <p className="text-xs" style={{ color: '#78716C' }}>Overdue</p>
          </div>
        </div>
      )}

      {/* Overall progress */}
      {goals.length > 0 && <ProgressBar goals={goals} />}

      {/* Header + controls */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex rounded-xl overflow-hidden border" style={{ borderColor: '#E0D5C5' }}>
          {[['all', 'All'], ['short_term', 'Short-Term'], ['long_term', 'Long-Term']].map(([v, l]) => (
            <button key={v} onClick={() => setTermFilter(v)}
              className="px-3 py-1.5 text-xs font-medium transition-colors"
              style={termFilter === v ? { background: '#1C1917', color: '#F5EFE6' } : { background: '#F0E9DC', color: '#78716C' }}>
              {l}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setTaskForm({ preset: true })} className="gap-1.5 text-xs">
            <ListChecks className="w-3.5 h-3.5" /> Add Task
          </Button>
          <Button size="sm" onClick={() => setGoalForm('new')} className="gap-1.5 text-xs" style={{ background: '#B45309', color: '#fff' }}>
            <Plus className="w-3.5 h-3.5" /> Add Goal
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map(i => <div key={i} className="h-24 rounded-2xl animate-pulse" style={{ background: '#E5DDD0' }} />)}
        </div>
      ) : filteredGoals.length === 0 && unlinkedTasks.length === 0 ? (
        <div className="text-center py-14 rounded-2xl" style={{ background: '#F0E9DC', border: '1px dashed #C9B99A' }}>
          <Target className="w-9 h-9 mx-auto mb-2" style={{ color: '#C9A227' }} />
          <p className="font-semibold" style={{ color: '#1C1917' }}>No care plan yet</p>
          <p className="text-sm mt-1" style={{ color: '#78716C' }}>Add short-term and long-term goals to build this resident's individualized care plan.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredGoals.map(goal => (
            <GoalCard
              key={goal.id}
              goal={goal}
              tasks={tasks}
              onEditGoal={(g) => setGoalForm(g)}
              onDeleteGoal={deleteGoal}
              onAddTask={(goalId) => setTaskForm({ goalId })}
              onEditTask={(t) => setTaskForm(t)}
              onDeleteTask={deleteTask}
              onToggleTask={toggleTask}
            />
          ))}

          {/* Unlinked tasks */}
          {unlinkedTasks.length > 0 && (
            <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #E0D5C5', background: '#FEFCF8' }}>
              <div className="px-4 py-3 border-b flex items-center gap-2" style={{ borderColor: '#E0D5C5' }}>
                <ListChecks className="w-4 h-4" style={{ color: '#78716C' }} />
                <span className="text-sm font-semibold" style={{ color: '#1C1917' }}>Standalone Follow-Up Tasks</span>
              </div>
              <div className="px-4 py-2 space-y-1" style={{ background: '#FAF6EF' }}>
                {unlinkedTasks.map(task => (
                  <TaskRow key={task.id} task={task} onEdit={(t) => setTaskForm(t)} onDelete={deleteTask} onToggle={toggleTask} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {goalForm && (
        <GoalForm
          resident={resident}
          editing={goalForm === 'new' ? null : goalForm}
          onSave={saveGoal}
          onClose={() => setGoalForm(null)}
        />
      )}
      {taskForm && (
        <TaskForm
          resident={resident}
          goals={goals}
          editing={taskForm?.id ? taskForm : null}
          presetGoalId={taskForm?.goalId}
          onSave={saveTask}
          onClose={() => setTaskForm(null)}
        />
      )}
    </div>
  );
}
