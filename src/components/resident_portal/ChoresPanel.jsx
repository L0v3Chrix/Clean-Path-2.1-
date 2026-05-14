import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { CheckCircle2, Circle, ClipboardList } from 'lucide-react';
import { format } from 'date-fns';

export default function ChoresPanel({ residentId }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!residentId) { setLoading(false); return; }
    base44.entities.CarePlanTask.filter({ resident_id: residentId })
      .then(all => {
        const relevant = all
          .filter(t => t.status !== 'cancelled')
          .sort((a, b) => {
            if (a.status === 'completed' && b.status !== 'completed') return 1;
            if (a.status !== 'completed' && b.status === 'completed') return -1;
            return 0;
          });
        setTasks(relevant);
      })
      .finally(() => setLoading(false));
  }, [residentId]);

  const markDone = async (task) => {
    await base44.entities.CarePlanTask.update(task.id, {
      status: 'completed',
      completed_date: new Date().toISOString().split('T')[0],
    });
    setTasks(prev => prev.map(t => t.id === task.id
      ? { ...t, status: 'completed', completed_date: new Date().toISOString().split('T')[0] }
      : t
    ));
  };

  const pending = tasks.filter(t => t.status !== 'completed');
  const completed = tasks.filter(t => t.status === 'completed');

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-amber-600" />
          <span className="font-semibold text-slate-800">My Chores & Tasks</span>
        </div>
        {pending.length > 0 && (
          <span className="text-xs bg-amber-100 text-amber-700 font-medium px-2 py-0.5 rounded-full">
            {pending.length} pending
          </span>
        )}
      </div>

      <div className="p-4 space-y-2 max-h-72 overflow-y-auto">
        {loading && (
          <div className="text-center py-6 text-slate-400 text-sm">Loading…</div>
        )}
        {!loading && tasks.length === 0 && (
          <div className="text-center py-6">
            <CheckCircle2 className="w-8 h-8 text-emerald-300 mx-auto mb-2" />
            <p className="text-sm text-slate-500">No tasks assigned yet.</p>
          </div>
        )}
        {pending.map(task => (
          <div key={task.id} className="flex items-start gap-3 p-3 rounded-xl border border-slate-100 hover:border-amber-200 transition-colors group">
            <button
              onClick={() => markDone(task)}
              className="mt-0.5 flex-shrink-0 text-slate-300 hover:text-emerald-500 transition-colors"
            >
              <Circle className="w-5 h-5" />
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-800">{task.title}</p>
              {task.description && <p className="text-xs text-slate-400 mt-0.5 truncate">{task.description}</p>}
              {task.due_date && (
                <p className={`text-xs mt-1 font-medium ${new Date(task.due_date) < new Date() ? 'text-red-500' : 'text-slate-400'}`}>
                  Due {format(new Date(task.due_date), 'MMM d')}
                  {new Date(task.due_date) < new Date() ? ' · Overdue' : ''}
                </p>
              )}
            </div>
            {task.recurrence && task.recurrence !== 'once' && (
              <span className="text-xs text-slate-400 capitalize flex-shrink-0">{task.recurrence}</span>
            )}
          </div>
        ))}
        {completed.length > 0 && (
          <p className="text-xs text-slate-400 pt-1 pb-1 font-medium">Completed ({completed.length})</p>
        )}
        {completed.map(task => (
          <div key={task.id} className="flex items-center gap-3 p-3 rounded-xl opacity-50">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            <p className="text-sm text-slate-500 line-through">{task.title}</p>
          </div>
        ))}
      </div>
    </div>
  );
}