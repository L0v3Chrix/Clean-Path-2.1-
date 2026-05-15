import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { format, parseISO } from 'date-fns';

const SCORE_COLOR = (v) => {
  if (!v) return 'text-slate-400';
  if (v < 3) return 'text-red-600 font-bold';
  if (v === 3) return 'text-amber-600';
  return 'text-green-600';
};

const MOOD_EMOJI = { 1: '😞', 2: '😕', 3: '😐', 4: '🙂', 5: '😄' };

function CheckinCard({ log, residents, user, onReviewed }) {
  const [expanded, setExpanded] = useState(false);
  const [reviewNote, setReviewNote] = useState(log.review_notes || '');
  const [saving, setSaving] = useState(false);

  const resident = residents.find(r => r.id === log.resident_id);
  const name = resident ? `${resident.first_name} ${resident.last_name}` : 'Unknown Resident';

  const handleMarkReviewed = async () => {
    setSaving(true);
    await base44.entities.MorningReflection.update(log.id, {
      staff_reviewed: true,
      reviewed_by: user?.full_name || 'Staff',
      reviewed_at: new Date().toISOString(),
      review_notes: reviewNote,
    });
    setSaving(false);
    onReviewed(log.id);
  };

  return (
    <div className={`border rounded-xl overflow-hidden ${log.staff_reviewed ? 'border-green-200 opacity-70' : 'border-red-200 bg-red-50/30'}`}>
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-50/50 transition-colors"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600 flex-shrink-0">
            {resident?.first_name?.[0]}{resident?.last_name?.[0]}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-slate-800 text-sm">{name}</p>
            <p className="text-xs text-slate-500">
              {format(parseISO(log.log_date), 'EEE, MMM d')}
              {log.flag_reason && <span className="ml-2 text-red-500">· {log.flag_reason}</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {log.staff_reviewed
            ? <Badge className="bg-green-100 text-green-700 border-0 text-xs gap-1"><CheckCircle2 className="w-3 h-3" />Reviewed</Badge>
            : <Badge className="bg-red-100 text-red-700 border-0 text-xs gap-1"><AlertTriangle className="w-3 h-3" />Needs Review</Badge>
          }
          {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-slate-100 pt-3">
          {/* Score grid */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white rounded-lg p-2 text-center border">
              <p className="text-xl">{MOOD_EMOJI[log.mood] || '—'}</p>
              <p className={`text-xs font-bold ${SCORE_COLOR(log.mood)}`}>{log.mood}/5</p>
              <p className="text-xs text-slate-400">Mood</p>
            </div>
            <div className="bg-white rounded-lg p-2 text-center border">
              <p className={`text-lg font-black ${SCORE_COLOR(log.physical_wellbeing)}`}>{log.physical_wellbeing || '—'}</p>
              <p className={`text-xs font-bold ${SCORE_COLOR(log.physical_wellbeing)}`}>{log.physical_wellbeing ? `${log.physical_wellbeing}/5` : 'N/A'}</p>
              <p className="text-xs text-slate-400">Physical</p>
            </div>
            <div className="bg-white rounded-lg p-2 text-center border">
              <p className={`text-lg font-black ${SCORE_COLOR(log.sleep_quality)}`}>{log.sleep_quality || '—'}</p>
              <p className={`text-xs font-bold ${SCORE_COLOR(log.sleep_quality)}`}>{log.sleep_quality ? `${log.sleep_quality}/5` : 'N/A'}</p>
              <p className="text-xs text-slate-400">Sleep</p>
            </div>
          </div>

          {log.concerns && (
            <div className="bg-rose-50 border border-rose-100 rounded-lg p-3">
              <p className="text-xs font-semibold text-rose-600 mb-1">Resident's Concerns</p>
              <p className="text-sm text-slate-700">{log.concerns}</p>
            </div>
          )}

          {log.daily_goal && (
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs font-semibold text-slate-500 mb-1">Today's Goal</p>
              <p className="text-sm text-slate-700">{log.daily_goal}</p>
            </div>
          )}

          {!log.staff_reviewed && (
            <div className="space-y-2 pt-1">
              <Textarea
                placeholder="Add review notes (optional — visible to case management team)…"
                value={reviewNote}
                onChange={e => setReviewNote(e.target.value)}
                className="text-sm resize-none h-16"
              />
              <Button
                onClick={handleMarkReviewed}
                disabled={saving}
                className="w-full bg-green-600 hover:bg-green-700 text-white gap-2 h-8 text-sm"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                Mark as Reviewed
              </Button>
            </div>
          )}

          {log.staff_reviewed && (
            <div className="bg-green-50 rounded-lg p-3 text-sm">
              <p className="text-xs text-green-600 font-semibold">Reviewed by {log.reviewed_by}</p>
              {log.review_notes && <p className="text-slate-600 mt-1">{log.review_notes}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function FlaggedCheckinsPanel({ orgId }) {
  const [logs, setLogs] = useState([]);
  const [residents, setResidents] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showReviewed, setShowReviewed] = useState(false);

  const load = async () => {
    const [me, allLogs, res] = await Promise.all([
      base44.auth.me(),
      base44.entities.MorningReflection.filter({ flagged_for_support: true }),
      base44.entities.Resident.list(),
    ]);
    setUser(me);
    // Sort: unreviewed first, then by date desc
    const sorted = allLogs.sort((a, b) => {
      if (a.staff_reviewed !== b.staff_reviewed) return a.staff_reviewed ? 1 : -1;
      return b.log_date.localeCompare(a.log_date);
    });
    setLogs(sorted);
    setResidents(res);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleReviewed = (id) => {
    setLogs(prev => prev.map(l => l.id === id ? { ...l, staff_reviewed: true } : l));
  };

  const pending = logs.filter(l => !l.staff_reviewed);
  const reviewed = logs.filter(l => l.staff_reviewed);
  const visible = showReviewed ? logs : pending;

  return (
    <div className="space-y-4">
      {/* Header stats */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <span className="font-bold text-slate-800">Flagged Check-ins</span>
          </div>
          {pending.length > 0 && (
            <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full animate-pulse">
              {pending.length} need review
            </span>
          )}
        </div>
        <button
          onClick={() => setShowReviewed(v => !v)}
          className="text-xs text-slate-400 hover:text-slate-600"
        >
          {showReviewed ? 'Hide reviewed' : `Show reviewed (${reviewed.length})`}
        </button>
      </div>

      {loading && (
        <div className="text-center py-8 text-slate-400"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>
      )}

      {!loading && visible.length === 0 && (
        <div className="text-center py-10 border-2 border-dashed border-slate-200 rounded-2xl">
          <CheckCircle2 className="w-8 h-8 text-green-400 mx-auto mb-2" />
          <p className="text-slate-500 font-medium text-sm">
            {pending.length === 0 ? 'All flagged check-ins have been reviewed.' : 'No flagged check-ins.'}
          </p>
        </div>
      )}

      <div className="space-y-2">
        {visible.map(log => (
          <CheckinCard
            key={log.id}
            log={log}
            residents={residents}
            user={user}
            onReviewed={handleReviewed}
          />
        ))}
      </div>
    </div>
  );
}