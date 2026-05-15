import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { CheckCircle2, Circle, Clock, ClipboardList, Star, AlertCircle } from 'lucide-react';
import { format, isToday, isTomorrow, parseISO } from 'date-fns';

const AREA_EMOJI = {
  kitchen: '🍳', bathroom: '🚿', living_room: '🛋️', yard: '🌿',
  laundry: '🧺', common_area: '🏠', trash: '🗑️', bedroom: '🛏️', other: '📋',
};

export default function ChoresPanel({ residentId }) {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(null);

  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    if (!residentId) { setLoading(false); return; }
    // Load this week + today
    base44.entities.ChoreAssignment.filter({ resident_id: residentId })
      .then(all => {
        // Show current + upcoming (next 7 days), not old completed ones
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 1);
        const relevant = all
          .filter(a => a.status !== 'missed' && new Date(a.due_date) >= cutoff)
          .sort((a, b) => a.due_date.localeCompare(b.due_date))
          .slice(0, 10);
        setAssignments(relevant);
      })
      .finally(() => setLoading(false));
  }, [residentId]);

  const markDone = async (a) => {
    setSubmitting(a.id);
    await base44.entities.ChoreAssignment.update(a.id, {
      status: 'completed',
      completed_at: new Date().toISOString(),
    });
    setAssignments(prev => prev.map(x => x.id === a.id ? { ...x, status: 'completed', completed_at: new Date().toISOString() } : x));
    setSubmitting(null);
  };

  const getDueLabel = (dateStr) => {
    const d = parseISO(dateStr);
    if (isToday(d)) return { text: 'Today', color: 'text-amber-600 font-semibold' };
    if (isTomorrow(d)) return { text: 'Tomorrow', color: 'text-blue-600' };
    return { text: format(d, 'EEE, MMM d'), color: 'text-slate-400' };
  };

  const pending = assignments.filter(a => a.status === 'pending');
  const done = assignments.filter(a => a.status === 'completed' || a.status === 'verified');

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-amber-600" />
          <span className="font-semibold text-slate-800">My Chores</span>
        </div>
        {pending.length > 0 && (
          <span className="text-xs bg-amber-100 text-amber-700 font-medium px-2 py-0.5 rounded-full">
            {pending.length} pending
          </span>
        )}
      </div>

      <div className="p-4 space-y-2 max-h-80 overflow-y-auto">
        {loading && <div className="text-center py-6 text-slate-400 text-sm">Loading…</div>}

        {!loading && assignments.length === 0 && (
          <div className="text-center py-8">
            <CheckCircle2 className="w-8 h-8 text-emerald-300 mx-auto mb-2" />
            <p className="text-sm text-slate-500">No chores assigned this week.</p>
          </div>
        )}

        {pending.map(a => {
          const due = getDueLabel(a.due_date);
          return (
            <div key={a.id} className={`flex items-start gap-3 p-3 rounded-xl border transition-colors ${isToday(parseISO(a.due_date)) ? 'border-amber-200 bg-amber-50' : 'border-slate-100 hover:border-slate-200'}`}>
              <button
                onClick={() => markDone(a)}
                disabled={submitting === a.id}
                className="mt-0.5 flex-shrink-0 text-slate-300 hover:text-emerald-500 transition-colors"
              >
                <Circle className="w-5 h-5" />
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span>{AREA_EMOJI[a.area] || '📋'}</span>
                  <p className="text-sm font-medium text-slate-800">{a.chore_name}</p>
                </div>
                {a.instructions && <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{a.instructions}</p>}
                <div className="flex items-center gap-3 mt-1">
                  <p className={`text-xs ${due.color}`}>{due.text}</p>
                  {a.estimated_minutes && (
                    <p className="text-xs text-slate-400 flex items-center gap-0.5">
                      <Clock className="w-3 h-3" /> ~{a.estimated_minutes}min
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {done.length > 0 && (
          <>
            <p className="text-xs text-slate-400 pt-2 font-medium">Completed ({done.length})</p>
            {done.map(a => (
              <div key={a.id} className="flex items-center gap-3 p-3 rounded-xl opacity-60">
                {a.status === 'verified'
                  ? <Star className="w-5 h-5 text-amber-400 flex-shrink-0" />
                  : <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />}
                <div className="flex-1">
                  <p className="text-sm text-slate-500 line-through">{a.chore_name}</p>
                  {a.status === 'verified' && (
                    <p className="text-xs text-amber-600">✓ Verified by staff</p>
                  )}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}