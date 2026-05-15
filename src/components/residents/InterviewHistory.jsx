import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Star, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';

const REC_STYLES = {
  approve:             'bg-green-100 text-green-700',
  conditional_approve: 'bg-amber-100 text-amber-700',
  waitlist:            'bg-blue-100 text-blue-700',
  deny:                'bg-red-100 text-red-700',
  pending:             'bg-slate-100 text-slate-500',
};

const REC_LABELS = {
  approve:             '✅ Approved',
  conditional_approve: '⚠️ Conditional',
  waitlist:            '🕐 Waitlisted',
  deny:                '❌ Denied',
  pending:             '⏳ Pending',
};

export default function InterviewHistory({ residentId }) {
  const [interviews, setInterviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    base44.entities.ResidentInterview
      .filter({ resident_id: residentId }, '-interview_date', 20)
      .then(setInterviews)
      .finally(() => setLoading(false));
  }, [residentId]);

  if (loading) return <div className="h-16 bg-slate-100 rounded-xl animate-pulse" />;
  if (!interviews.length) return (
    <div className="text-center py-8 text-slate-400 text-sm">
      No interviews on record yet.
    </div>
  );

  return (
    <div className="space-y-2">
      <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Past Interviews ({interviews.length})</p>
      {interviews.map(iv => (
        <div key={iv.id} className="border border-slate-200 rounded-xl overflow-hidden">
          <button
            onClick={() => setExpanded(expanded === iv.id ? null : iv.id)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 text-left"
          >
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-0.5">
                {[1,2,3,4,5].map(n => (
                  <Star key={n} className={`w-3.5 h-3.5 fill-current ${n <= Math.round(iv.overall_score || 0) ? 'text-amber-400' : 'text-slate-200'}`} />
                ))}
              </div>
              <span className="text-sm font-medium text-slate-700">{iv.interview_date}</span>
              <span className="text-xs text-slate-400">by {iv.conducted_by_name}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${REC_STYLES[iv.recommendation]}`}>
                {REC_LABELS[iv.recommendation]}
              </span>
              {expanded === iv.id ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </div>
          </button>

          {expanded === iv.id && (
            <div className="px-4 pb-4 space-y-3 border-t border-slate-100 pt-3">
              {iv.summary_notes && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 mb-1">Staff Summary</p>
                  <p className="text-sm text-slate-700 bg-slate-50 rounded-lg p-3 whitespace-pre-wrap">{iv.summary_notes}</p>
                </div>
              )}
              {iv.ai_summary && (
                <div>
                  <p className="text-xs font-semibold text-purple-600 mb-1 flex items-center gap-1"><Sparkles className="w-3 h-3" /> AI Assessment</p>
                  <p className="text-sm text-slate-700 bg-purple-50 border border-purple-100 rounded-lg p-3 whitespace-pre-wrap">{iv.ai_summary}</p>
                </div>
              )}
              <div className="grid grid-cols-3 gap-2 text-center text-xs text-slate-500">
                <div className="bg-slate-50 rounded-lg py-2">
                  <p className="text-base font-bold text-slate-700">{(iv.overall_score || 0).toFixed(1)}</p>
                  <p>Score / 5</p>
                </div>
                <div className="bg-slate-50 rounded-lg py-2">
                  <p className="text-base font-bold text-slate-700">{Object.keys(iv.question_notes || {}).length}</p>
                  <p>Answered</p>
                </div>
                <div className="bg-slate-50 rounded-lg py-2">
                  <p className="text-base font-bold text-slate-700 capitalize">{iv.interview_mode?.replace('_', ' ')}</p>
                  <p>Mode</p>
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}