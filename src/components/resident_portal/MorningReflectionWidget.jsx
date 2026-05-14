import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Sun, CheckCircle2, RotateCcw } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import MorningReflectionForm from './MorningReflectionForm';

export default function MorningReflectionWidget({ resident }) {
  const [todayLog, setTodayLog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);

  const today = format(new Date(), 'yyyy-MM-dd');

  useEffect(() => {
    if (!resident?.id) { setLoading(false); return; }
    base44.entities.MorningReflection.filter({ resident_id: resident.id, log_date: today })
      .then(logs => setTodayLog(logs[0] || null))
      .finally(() => setLoading(false));
  }, [resident?.id]);

  const MOOD_EMOJI = { 1: '😞', 2: '😕', 3: '😐', 4: '🙂', 5: '😄' };
  const SLEEP_LABEL = { 1: 'Very Poor', 2: 'Poor', 3: 'Fair', 4: 'Good', 5: 'Excellent' };
  const SLEEP_COLOR = { 1: '#EF4444', 2: '#F97316', 3: '#EAB308', 4: '#22C55E', 5: '#10B981' };

  if (loading) return null;

  if (!editing && todayLog) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sun className="w-4 h-4 text-amber-500" />
            <span className="font-semibold text-slate-800">Morning Reflection</span>
            <span className="text-xs bg-emerald-100 text-emerald-700 font-medium px-2 py-0.5 rounded-full flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Done
            </span>
          </div>
          <button onClick={() => setEditing(true)} className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1">
            <RotateCcw className="w-3 h-3" /> Edit
          </button>
        </div>
        <div className="p-4 grid grid-cols-2 gap-3">
          <div className="bg-amber-50 rounded-xl p-3 text-center">
            <p className="text-3xl">{MOOD_EMOJI[todayLog.mood] || '😐'}</p>
            <p className="text-xs text-slate-500 mt-1">Mood</p>
          </div>
          <div className="rounded-xl p-3 text-center" style={{ background: `${SLEEP_COLOR[todayLog.sleep_quality]}15` }}>
            <p className="text-xl font-black" style={{ color: SLEEP_COLOR[todayLog.sleep_quality] }}>{SLEEP_LABEL[todayLog.sleep_quality]}</p>
            {todayLog.sleep_hours && <p className="text-xs text-slate-500 mt-0.5">{todayLog.sleep_hours}h sleep</p>}
            <p className="text-xs text-slate-400">Sleep</p>
          </div>
          {todayLog.daily_goal && (
            <div className="col-span-2 bg-slate-50 rounded-xl p-3">
              <p className="text-xs font-medium text-slate-500 mb-1">Today's Goal</p>
              <p className="text-sm text-slate-700">{todayLog.daily_goal}</p>
            </div>
          )}
          {todayLog.gratitude && (
            <div className="col-span-2 bg-rose-50 rounded-xl p-3">
              <p className="text-xs font-medium text-rose-400 mb-1">Grateful for</p>
              <p className="text-sm text-slate-700">{todayLog.gratitude}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-amber-200 overflow-hidden">
      {!editing && (
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2" style={{ background: 'linear-gradient(90deg, #FFFBEB, #FFF7ED)' }}>
          <Sun className="w-4 h-4 text-amber-500" />
          <span className="font-semibold text-slate-800">Morning Reflection</span>
          <span className="text-xs text-amber-600 ml-auto">Not logged today</span>
        </div>
      )}
      <div className="p-5">
        <MorningReflectionForm
          resident={resident}
          existingLog={editing ? todayLog : null}
          onComplete={() => {
            setEditing(false);
            base44.entities.MorningReflection.filter({ resident_id: resident.id, log_date: format(new Date(), 'yyyy-MM-dd') })
              .then(logs => setTodayLog(logs[0] || null));
          }}
        />
      </div>
    </div>
  );
}