import { useState } from 'react';
import {
  X, ChevronLeft, ChevronRight, Star,
  CheckCircle2, Loader2, Sparkles, ClipboardList,
  AlertTriangle, Phone, Video, Users
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { appClient } from '@/services/appClient';

// ─── Interview Questions ───────────────────────────────────────────────────
const SCREENING = [
  { id: 'sex_offender', label: 'Are you a registered sex offender?', type: 'yn', disqualifying: true },
  { id: 'arson',        label: 'Have you ever been charged with Arson?', type: 'yn' },
  { id: 'pending',      label: 'Do you have any other current or pending charges?', type: 'yn' },
  { id: 'id_ss',        label: 'Do you have an ID and Social Security card?', type: 'yn' },
  { id: 'accountability', label: "What's your definition of Accountability?", type: 'text' },
];

const QUESTIONS = [
  { id: 'q1',  text: 'Tell me a little about yourself.',                                             probe: null },
  { id: 'q2',  text: 'How did you get to this point in your recovery?',                              probe: null },
  { id: 'q3',  text: 'How do you feel about your addiction?',                                        probe: 'Probe for denial — do they accept the disease concept? Assess anger, willingness, desire.' },
  { id: 'q4',  text: 'What is your plan for recovery?',                                              probe: null },
  { id: 'q5',  text: 'Do you go to AA/NA meetings? What step are you currently working on, if any?', probe: null },
  { id: 'q6',  text: 'Do you have a sponsor? If not, will you get one within 30 days?',              probe: null },
  { id: 'q7',  text: 'Have you identified your relapse triggers? If so, what are they?',             probe: null },
  { id: 'q8',  text: 'Can you tell me any behaviors you might exhibit that would indicate you are headed towards a relapse?', probe: null },
  { id: 'q9',  text: 'What is your job history? Do you have a profession, trade, or skill? Do you have a current job?', probe: null },
  { id: 'q10', text: 'Do you have an anger problem? What provokes the anger? Do you have a defensive reaction when told you\'re wrong?', probe: 'Ask them to name something that makes them angry. Probe for aggression, physical/domestic violence, isolation. Have they attended anger management?' },
  { id: 'q11', text: 'How do you feel about group living? Are you compatible with most people? Are you willing to work with others?', probe: null },
  { id: 'q12', text: 'Are you involved in a relationship (significant other, children, etc.)?',      probe: null },
  { id: 'q13', text: 'Are you involved in any relationships that may be potentially disruptive to the house?', probe: null },
  { id: 'q14', text: 'Are you on any medications? If so, what? Is your doctor aware of your addiction if on narcotics?', probe: 'Explain the house policy on medication.' },
  { id: 'q15', text: 'Tell us about your legal history — jail time, charges, probation, and how addiction related to illegal activities.',probe: 'How many times incarcerated? How long? For what? Pending trials or sentencing? On probation? At what age did criminal activity start? Probe for criminal mentality before addiction.' },
  { id: 'q16', text: 'Can you handle being confronted in a constructive manner?',                    probe: null },
  { id: 'q17', text: 'Can you confront others in a constructive manner?',                            probe: null },
  { id: 'q18', text: 'Do you have any prejudice issues (racial, sexual, etc.)?',                     probe: null },
  { id: 'q19', text: 'Would you have any problems performing chores (disabilities, yard work, etc.)?', probe: null },
  { id: 'q20', text: 'What do you feel you can offer this house?',                                   probe: null },
  { id: 'q21', text: 'What can this house offer you?',                                               probe: null },
  { id: 'q22', text: 'Why do you want to live in this house?',                                       probe: null },
  { id: 'q23', text: 'Scenario: Your roommate confides they had one drink/hit after a bad day and begs you to keep it secret. How would you handle this situation?', probe: null },
  { id: 'q24', text: 'Review house guidelines, probationary period, meeting requirements, and mandatory house meeting schedule.', probe: 'Staff: Review all guidelines. Confirm applicant understands house meetings are mandatory.' },
  { id: 'q25', text: 'If accepted, when could you pay your membership fees and move in?',            probe: null },
];

const SCORE_LABELS = {
  1: 'Poor',
  2: 'Below Average',
  3: 'Average',
  4: 'Good',
  5: 'Excellent',
};

const SCORE_COLORS = {
  1: 'text-red-500',
  2: 'text-orange-500',
  3: 'text-amber-500',
  4: 'text-teal-600',
  5: 'text-green-600',
};

export const INTERVIEW_SPEECH_POLICY = Object.freeze({
  enabled: false,
  approvedProvider: null,
  consentMechanism: null,
});

export const INTERVIEW_AI_ERROR_MESSAGE = 'AI assessment is temporarily unavailable. Continue with staff notes and recommendations.';

export async function requestInterviewAssessment(invokeLLM, prompt) {
  try {
    const result = await invokeLLM({ prompt });
    return { summary: result?.output || '', error: '' };
  } catch {
    return { summary: '', error: INTERVIEW_AI_ERROR_MESSAGE };
  }
}

function ScoreStars({ value, onChange }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className={`transition-transform hover:scale-110 ${n <= value ? 'text-amber-400' : 'text-slate-200'}`}
        >
          <Star className="w-6 h-6 fill-current" />
        </button>
      ))}
      {value > 0 && (
        <span className={`ml-2 text-xs font-semibold ${SCORE_COLORS[value]}`}>{SCORE_LABELS[value]}</span>
      )}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────
export default function InterviewModal({ resident, onClose, onSaved }) {
  const [phase, setPhase] = useState('setup');   // setup | screening | interview | summary | done
  const [mode, setMode] = useState('in_person');
  const [conductedBy, setConductedBy] = useState('');
  const [screening, setScreening] = useState({});
  const [qIndex, setQIndex] = useState(0);
  const [notes, setNotes] = useState({});        // { qId: string }
  const [scores, setScores] = useState({});      // { qId: 1-5 }
  const [summaryNotes, setSummaryNotes] = useState('');
  const [recommendation, setRecommendation] = useState('pending');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSummary, setAiSummary] = useState('');
  const [aiError, setAiError] = useState('');
  const [saving, setSaving] = useState(false);
  const llmConfigured = appClient.integrations?.Core?.providerStatus?.llm?.configured === true;

  // ── Scoring ──
  const overallScore = () => {
    const vals = Object.values(scores).filter(Boolean);
    if (!vals.length) return 0;
    return (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1);
  };

  const completedCount = QUESTIONS.filter(q => notes[q.id] || scores[q.id]).length;

  // ── AI Summary ──
  const generateAISummary = async () => {
    if (!llmConfigured) return;
    setAiLoading(true);
    setAiError('');
    const qSummary = QUESTIONS.map(q => {
      const note = notes[q.id] || '';
      const score = scores[q.id] || 'not scored';
      return `Q: ${q.text}\nNotes: ${note || '(none)'}\nScore: ${score}/5`;
    }).join('\n\n');

    const screenSummary = SCREENING.map(s => {
      const a = screening[s.id];
      return `${s.label}: ${a ?? '(not answered)'}`;
    }).join('\n');

    const prompt = `You are an experienced recovery housing intake specialist. Review this interview summary and provide:
1. A 3-4 sentence professional assessment of the applicant's readiness and suitability
2. Key strengths noted
3. Key concerns or areas to monitor
4. A recommendation: approve / conditional approve / waitlist / deny — with brief rationale

Resident: ${resident.first_name} ${resident.last_name}
Interview mode: ${mode}
Overall score: ${overallScore()}/5
Questions answered: ${completedCount}/${QUESTIONS.length}

SCREENING:
${screenSummary}

INTERVIEW RESPONSES:
${qSummary}

STAFF SUMMARY NOTES: ${summaryNotes || '(none)'}

Write in a professional, trauma-informed tone. Keep it concise (under 250 words).`;

    try {
      const result = await requestInterviewAssessment(appClient.integrations.Core.InvokeLLM, prompt);
      setAiSummary(result.summary);
      setAiError(result.error);
    } finally {
      setAiLoading(false);
    }
  };

  // ── Save ──
  const handleSave = async () => {
    setSaving(true);
    const score = parseFloat(overallScore()) || 0;

    const interview = await appClient.entities.ResidentInterview.create({
      resident_id: resident.id,
      organization_id: resident.organization_id,
      conducted_by_name: conductedBy,
      interview_date: new Date().toISOString().split('T')[0],
      interview_mode: mode,
      status: 'completed',
      screening_answers: screening,
      question_notes: notes,
      question_scores: scores,
      overall_score: score,
      recommendation,
      summary_notes: summaryNotes,
      ai_summary: aiSummary,
    });

    // Append interview summary to resident notes
    const interviewNoteBlock = `\n\n[INTERVIEW ${new Date().toLocaleDateString()} — ${conductedBy}]\nScore: ${score}/5 | Recommendation: ${recommendation}\n${summaryNotes}`;
    await appClient.entities.Resident.update(resident.id, {
      notes: (resident.notes || '') + interviewNoteBlock,
      status: recommendation === 'approve' ? 'active'
             : recommendation === 'deny' ? 'exited'
             : 'applicant',
    });

    setSaving(false);
    setPhase('done');
    onSaved?.();
  };

  const currentQ = QUESTIONS[qIndex];
  const qId = currentQ?.id;

  // ════════════════════════════════════════════════════════════════════════════
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-3">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[95vh] flex flex-col shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal-600 flex items-center justify-center">
              <ClipboardList className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">Resident Interview</h2>
              <p className="text-xs text-slate-400">{resident.first_name} {resident.last_name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto">

          {/* ── PHASE: Setup ── */}
          {phase === 'setup' && (
            <div className="p-6 space-y-5">
              <div className="bg-teal-50 border border-teal-200 rounded-xl px-4 py-3 text-sm text-teal-700">
                This tool will guide you through the 25-question resident interview. Enter only the notes needed for placement review.
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600">Interviewer Name</label>
                <input
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                  placeholder="Your name"
                  value={conductedBy}
                  onChange={e => setConductedBy(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600">Interview Mode</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { v: 'in_person', label: 'In Person', Icon: Users },
                    { v: 'phone', label: 'Phone', Icon: Phone },
                    { v: 'video', label: 'Video Call', Icon: Video },
                  ].map(({ v, label, Icon }) => (
                    <button
                      key={v}
                      onClick={() => setMode(v)}
                      className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 text-sm font-medium transition-all
                        ${mode === v ? 'border-teal-500 bg-teal-50 text-teal-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}
                    >
                      <Icon className="w-5 h-5" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {mode === 'phone' && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-2">
                  <Phone className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700">
                    <strong>Phone interview:</strong> Take written notes during the call. Browser transcription is disabled for resident privacy.
                  </p>
                </div>
              )}

              <Button
                disabled={!conductedBy.trim()}
                onClick={() => setPhase('screening')}
                className="w-full bg-teal-600 hover:bg-teal-700 text-white"
              >
                Begin Interview <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          )}

          {/* ── PHASE: Screening ── */}
          {phase === 'screening' && (
            <div className="p-6 space-y-4">
              <div>
                <p className="text-sm font-bold text-slate-800 mb-1">Pre-Screening Questions</p>
                <p className="text-xs text-slate-500">Ask these before the formal interview. Disqualifying answers are flagged.</p>
              </div>

              {SCREENING.map(s => (
                <div key={s.id} className={`rounded-xl border p-4 space-y-3 ${s.disqualifying && screening[s.id] === 'yes' ? 'border-red-300 bg-red-50' : 'border-slate-200'}`}>
                  <p className="text-sm font-medium text-slate-800">{s.label}</p>
                  {s.disqualifying && screening[s.id] === 'yes' && (
                    <div className="flex items-center gap-1.5 text-xs text-red-600 font-semibold">
                      <AlertTriangle className="w-3.5 h-3.5" /> Disqualifying response — review with supervisor before proceeding
                    </div>
                  )}
                  {s.type === 'yn' ? (
                    <div className="flex gap-2">
                      {['yes', 'no'].map(v => (
                        <button
                          key={v}
                          onClick={() => setScreening(p => ({ ...p, [s.id]: v }))}
                          className={`px-5 py-1.5 rounded-lg text-sm font-medium border-2 transition-all
                            ${screening[s.id] === v
                              ? v === 'yes' ? 'bg-red-500 text-white border-red-500' : 'bg-green-500 text-white border-green-500'
                              : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}
                        >
                          {v === 'yes' ? 'Yes' : 'No'}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <Textarea
                      rows={2}
                      className="text-sm"
                      placeholder="Notes…"
                      value={screening[s.id] || ''}
                      onChange={e => setScreening(p => ({ ...p, [s.id]: e.target.value }))}
                    />
                  )}
                </div>
              ))}

              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={() => setPhase('setup')} className="gap-1"><ChevronLeft className="w-4 h-4" /> Back</Button>
                <Button onClick={() => setPhase('interview')} className="flex-1 bg-teal-600 hover:bg-teal-700 text-white">
                  Proceed to Interview Questions <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          )}

          {/* ── PHASE: Interview ── */}
          {phase === 'interview' && currentQ && (
            <div className="p-6 space-y-4">
              {/* Progress */}
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                <span>Question {qIndex + 1} of {QUESTIONS.length}</span>
                <span>{completedCount} answered</span>
              </div>
              <div className="h-1.5 bg-slate-100 rounded-full">
                <div
                  className="h-full bg-teal-500 rounded-full transition-all"
                  style={{ width: `${((qIndex + 1) / QUESTIONS.length) * 100}%` }}
                />
              </div>

              {/* Question card */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
                <p className="text-xs font-bold text-teal-600 uppercase tracking-wide">Question {qIndex + 1}</p>
                <p className="text-sm font-semibold text-slate-800 leading-relaxed">{currentQ.text}</p>
                {currentQ.probe && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    <p className="text-xs text-amber-700"><strong>Staff probe:</strong> {currentQ.probe}</p>
                  </div>
                )}
              </div>

              {/* Score */}
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-slate-600">Score this response</p>
                <ScoreStars value={scores[qId] || 0} onChange={v => setScores(s => ({ ...s, [qId]: v }))} />
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-slate-600">Response Notes</p>
                <Textarea
                  rows={4}
                  placeholder="Enter concise notes from the applicant's response..."
                  className="text-sm"
                  value={notes[qId] || ''}
                  onChange={e => setNotes(n => ({ ...n, [qId]: e.target.value }))}
                />
              </div>

              {/* Nav */}
              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={() => qIndex > 0 && setQIndex(q => q - 1)} disabled={qIndex === 0} className="gap-1">
                  <ChevronLeft className="w-4 h-4" /> Prev
                </Button>
                {qIndex < QUESTIONS.length - 1 ? (
                  <Button onClick={() => setQIndex(q => q + 1)} className="flex-1 bg-teal-600 hover:bg-teal-700 text-white gap-1">
                    Next <ChevronRight className="w-4 h-4" />
                  </Button>
                ) : (
                  <Button onClick={() => setPhase('summary')} className="flex-1 bg-slate-800 hover:bg-slate-900 text-white gap-1">
                    Finish & Review <ChevronRight className="w-4 h-4" />
                  </Button>
                )}
              </div>

              {/* Jump nav */}
              <div className="flex flex-wrap gap-1 pt-1">
                {QUESTIONS.map((q, i) => (
                  <button
                    key={q.id}
                    onClick={() => setQIndex(i)}
                    className={`w-7 h-7 rounded text-xs font-medium transition-all
                      ${i === qIndex ? 'bg-teal-600 text-white'
                        : notes[q.id] || scores[q.id] ? 'bg-teal-100 text-teal-700'
                        : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── PHASE: Summary ── */}
          {phase === 'summary' && (
            <div className="p-6 space-y-5">
              {/* Score card */}
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center bg-teal-50 border border-teal-200 rounded-xl p-4">
                  <p className="text-3xl font-black text-teal-700">{overallScore()}</p>
                  <p className="text-xs text-teal-500 mt-1">Avg Score / 5</p>
                </div>
                <div className="text-center bg-slate-50 border border-slate-200 rounded-xl p-4">
                  <p className="text-3xl font-black text-slate-700">{completedCount}</p>
                  <p className="text-xs text-slate-500 mt-1">Questions Answered</p>
                </div>
                <div className="text-center bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <p className="text-3xl font-black text-amber-700">{Object.values(scores).filter(s => s >= 4).length}</p>
                  <p className="text-xs text-amber-500 mt-1">High Scores (4-5)</p>
                </div>
              </div>

              {/* Recommendation */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600">Staff Recommendation</label>
                <Select value={recommendation} onValueChange={setRecommendation}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="approve">✅ Approve for Placement</SelectItem>
                    <SelectItem value="conditional_approve">⚠️ Conditional Approval</SelectItem>
                    <SelectItem value="waitlist">🕐 Waitlist</SelectItem>
                    <SelectItem value="deny">❌ Deny Application</SelectItem>
                    <SelectItem value="pending">⏳ Pending — Needs Review</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Staff notes */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600">Overall Interview Summary Notes</label>
                <Textarea
                  rows={4}
                  placeholder="Overall impressions, concerns, strengths, and any follow-up items…"
                  value={summaryNotes}
                  onChange={e => setSummaryNotes(e.target.value)}
                />
              </div>

              {/* AI Summary */}
              <div className="space-y-2">
                <Button
                  variant="outline"
                  onClick={generateAISummary}
                  disabled={aiLoading || !llmConfigured}
                  className="w-full gap-2 border-purple-200 text-purple-700 hover:bg-purple-50"
                >
                  {!llmConfigured
                    ? <><Sparkles className="w-4 h-4" /> AI Assessment Unavailable</>
                    : aiLoading
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating AI Summary…</>
                    : <><Sparkles className="w-4 h-4" /> Generate AI Assessment</>}
                </Button>
                {!llmConfigured && (
                  <p className="text-xs text-slate-500">No AI provider is configured. Staff notes and recommendations remain available.</p>
                )}
                {aiError && (
                  <p role="alert" className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{aiError}</p>
                )}
                {aiSummary && (
                  <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 text-sm text-purple-900 whitespace-pre-wrap leading-relaxed">
                    <p className="text-xs font-bold text-purple-600 mb-2 flex items-center gap-1"><Sparkles className="w-3.5 h-3.5" /> AI Assessment</p>
                    {aiSummary}
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={() => setPhase('interview')} className="gap-1">
                  <ChevronLeft className="w-4 h-4" /> Review Questions
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 bg-teal-600 hover:bg-teal-700 text-white gap-2"
                >
                  {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : <><CheckCircle2 className="w-4 h-4" /> Save Interview</>}
                </Button>
              </div>
            </div>
          )}

          {/* ── PHASE: Done ── */}
          {phase === 'done' && (
            <div className="p-8 text-center space-y-4">
              <CheckCircle2 className="w-14 h-14 text-green-500 mx-auto" />
              <p className="text-lg font-bold text-slate-800">Interview Saved</p>
              <p className="text-sm text-slate-500">The interview record has been saved and the resident's profile has been updated with the summary notes and recommendation.</p>
              <Button onClick={onClose} className="bg-teal-600 hover:bg-teal-700 text-white px-8">Close</Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
