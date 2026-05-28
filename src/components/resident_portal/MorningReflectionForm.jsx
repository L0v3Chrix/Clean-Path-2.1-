import { useState } from 'react';
import { appClient } from '@/services/appClient';
import { Sun, Moon, Star, Heart, CheckCircle2, ChevronRight, ClipboardList, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { format } from 'date-fns';
import { BARC10Survey, QoLSurvey, BARC10_COUNT, QOL_COUNT } from './SurveyStep';

const MOOD_OPTIONS = [
  { value: 1, emoji: '😞', label: 'Very Low' },
  { value: 2, emoji: '😕', label: 'Low' },
  { value: 3, emoji: '😐', label: 'Okay' },
  { value: 4, emoji: '🙂', label: 'Good' },
  { value: 5, emoji: '😄', label: 'Great' },
];

const SLEEP_OPTIONS = [
  { value: 1, label: 'Very Poor', color: '#EF4444' },
  { value: 2, label: 'Poor',      color: '#F97316' },
  { value: 3, label: 'Fair',      color: '#EAB308' },
  { value: 4, label: 'Good',      color: '#22C55E' },
  { value: 5, label: 'Excellent', color: '#10B981' },
];

export default function MorningReflectionForm({ resident, onComplete, existingLog }) {
  const today = format(new Date(), 'yyyy-MM-dd');
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const [form, setForm] = useState({
    mood: existingLog?.mood || null,
    physical_wellbeing: existingLog?.physical_wellbeing || null,
    sleep_quality: existingLog?.sleep_quality || null,
    sleep_hours: existingLog?.sleep_hours || '',
    daily_goal: existingLog?.daily_goal || '',
    gratitude: existingLog?.gratitude || '',
    concerns: existingLog?.concerns || '',
    barc10_answers: existingLog?.barc10_answers || {},
    qol_answers: existingLog?.qol_answers || {},
    showBARC10: false,
    showQoL: false,
  });

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const setBARCAnswer = (i, val) => setForm(f => ({ ...f, barc10_answers: { ...f.barc10_answers, [i]: val } }));
  const setQoLAnswer  = (i, val) => setForm(f => ({ ...f, qol_answers: { ...f.qol_answers, [i]: val } }));

  const canAdvance = () => {
    if (step === 0) return form.mood !== null;
    if (step === 1) return form.physical_wellbeing !== null;
    if (step === 2) return form.sleep_quality !== null;
    return true;
  };

  const handleSubmit = async () => {
    setSaving(true);
    const lowScores = [];
    if (form.mood < 3) lowScores.push(`mood (${form.mood}/5)`);
    if (form.physical_wellbeing < 3) lowScores.push(`physical well-being (${form.physical_wellbeing}/5)`);
    if (form.sleep_quality < 3) lowScores.push(`sleep quality (${form.sleep_quality}/5)`);
    const flagged = lowScores.length > 0;
    const flag_reason = flagged ? `Low scores reported: ${lowScores.join(', ')}` : undefined;

    const barc10Score = Object.keys(form.barc10_answers).length === BARC10_COUNT
      ? Object.values(form.barc10_answers).reduce((a, b) => a + b, 0)
      : undefined;

    const qolScore = Object.keys(form.qol_answers).length === QOL_COUNT
      ? Object.values(form.qol_answers).reduce((a, b) => a + b, 0)
      : undefined;

    const payload = {
      resident_id: resident.id,
      organization_id: resident.organization_id,
      log_date: today,
      mood: form.mood,
      physical_wellbeing: form.physical_wellbeing,
      sleep_quality: form.sleep_quality,
      sleep_hours: form.sleep_hours ? Number(form.sleep_hours) : undefined,
      daily_goal: form.daily_goal || undefined,
      gratitude: form.gratitude || undefined,
      concerns: form.concerns || undefined,
      flagged_for_support: flagged,
      flag_reason,
      staff_reviewed: false,
      barc10_answers: Object.keys(form.barc10_answers).length ? form.barc10_answers : undefined,
      barc10_score: barc10Score,
      qol_answers: Object.keys(form.qol_answers).length ? form.qol_answers : undefined,
      qol_score: qolScore,
    };

    if (existingLog?.id) {
      await appClient.entities.MorningReflection.update(existingLog.id, payload);
    } else {
      await appClient.entities.MorningReflection.create(payload);
    }
    setSaving(false);
    setDone(true);
    setTimeout(() => onComplete?.(), 1200);
  };

  if (done) {
    return (
      <div className="flex flex-col items-center justify-center py-8 gap-3">
        <CheckCircle2 className="w-12 h-12 text-emerald-500" />
        <p className="font-bold text-slate-800 text-lg">Reflection saved!</p>
        <p className="text-slate-500 text-sm">Have a great day 🌟</p>
      </div>
    );
  }

  // Survey opt-in step (step 4)
  const surveyOptIn = (
    <div key="surveys" className="space-y-4">
      <div className="text-center">
        <ClipboardList className="w-8 h-8 text-teal-500 mx-auto mb-2" />
        <h3 className="font-bold text-slate-800 text-lg">Optional: Recovery Surveys</h3>
        <p className="text-slate-400 text-sm mt-1">These help your support team track your progress over time. Takes ~2 minutes each.</p>
      </div>
      <div className="space-y-3">
        <button
          onClick={() => set('showBARC10', !form.showBARC10)}
          className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all text-left ${
            form.showBARC10 ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 hover:border-indigo-200'
          }`}
        >
          <div>
            <p className="font-semibold text-sm text-slate-800">BARC-10</p>
            <p className="text-xs text-slate-500 mt-0.5">Brief Assessment of Recovery Capital · 10 questions</p>
          </div>
          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${form.showBARC10 ? 'border-indigo-500 bg-indigo-500' : 'border-slate-300'}`}>
            {form.showBARC10 && <CheckCircle2 className="w-3 h-3 text-white" />}
          </div>
        </button>
        <button
          onClick={() => set('showQoL', !form.showQoL)}
          className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all text-left ${
            form.showQoL ? 'border-teal-400 bg-teal-50' : 'border-slate-200 hover:border-teal-200'
          }`}
        >
          <div>
            <p className="font-semibold text-sm text-slate-800">Quality of Life</p>
            <p className="text-xs text-slate-500 mt-0.5">Life satisfaction across 7 domains · 7 questions</p>
          </div>
          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${form.showQoL ? 'border-teal-500 bg-teal-500' : 'border-slate-300'}`}>
            {form.showQoL && <CheckCircle2 className="w-3 h-3 text-white" />}
          </div>
        </button>
      </div>
    </div>
  );

  const baseSteps = [
    // Step 0: Mood
    <div key="mood" className="space-y-4">
      <div className="text-center">
        <Sun className="w-8 h-8 text-amber-400 mx-auto mb-2" />
        <h3 className="font-bold text-slate-800 text-lg">Good morning! How are you feeling today?</h3>
        <p className="text-slate-400 text-sm mt-1">{format(new Date(), 'EEEE, MMMM d')}</p>
      </div>
      <div className="flex justify-center gap-3 flex-wrap pt-2">
        {MOOD_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => set('mood', opt.value)}
            className={`flex flex-col items-center gap-1 p-3 rounded-2xl border-2 transition-all ${
              form.mood === opt.value ? 'border-amber-500 bg-amber-50 scale-110' : 'border-slate-200 hover:border-amber-300'
            }`}
          >
            <span className="text-3xl">{opt.emoji}</span>
            <span className="text-xs text-slate-600 font-medium">{opt.label}</span>
          </button>
        ))}
      </div>
    </div>,

    // Step 1: Physical Well-being
    <div key="physical" className="space-y-4">
      <div className="text-center">
        <Activity className="w-8 h-8 text-rose-400 mx-auto mb-2" />
        <h3 className="font-bold text-slate-800 text-lg">How is your body feeling today?</h3>
        <p className="text-slate-400 text-sm mt-1">Rate your physical well-being</p>
      </div>
      <div className="flex justify-center gap-3 flex-wrap pt-2">
        {[
          { value: 1, emoji: '🤕', label: 'Very Poor' },
          { value: 2, emoji: '😓', label: 'Poor' },
          { value: 3, emoji: '😌', label: 'Fair' },
          { value: 4, emoji: '💪', label: 'Good' },
          { value: 5, emoji: '🌟', label: 'Excellent' },
        ].map(opt => (
          <button
            key={opt.value}
            onClick={() => set('physical_wellbeing', opt.value)}
            className={`flex flex-col items-center gap-1 p-3 rounded-2xl border-2 transition-all ${
              form.physical_wellbeing === opt.value ? 'border-rose-400 bg-rose-50 scale-110' : 'border-slate-200 hover:border-rose-300'
            }`}
          >
            <span className="text-3xl">{opt.emoji}</span>
            <span className="text-xs text-slate-600 font-medium">{opt.label}</span>
          </button>
        ))}
      </div>
      {form.physical_wellbeing !== null && form.physical_wellbeing < 3 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 text-center">
          <p className="text-sm text-orange-700 font-medium">💛 Your care team will check in with you today.</p>
        </div>
      )}
    </div>,

    // Step 2: Sleep
    <div key="sleep" className="space-y-4">
      <div className="text-center">
        <Moon className="w-8 h-8 text-indigo-400 mx-auto mb-2" />
        <h3 className="font-bold text-slate-800 text-lg">How did you sleep last night?</h3>
      </div>
      <div className="grid grid-cols-5 gap-2">
        {SLEEP_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => set('sleep_quality', opt.value)}
            className={`flex flex-col items-center gap-1 p-2 rounded-xl border-2 transition-all text-center ${
              form.sleep_quality === opt.value ? 'scale-105' : 'border-slate-200'
            }`}
            style={form.sleep_quality === opt.value ? { borderColor: opt.color, background: `${opt.color}15` } : {}}
          >
            <span className="text-lg font-bold" style={{ color: opt.color }}>{opt.value}</span>
            <span className="text-xs text-slate-500 leading-tight">{opt.label}</span>
          </button>
        ))}
      </div>
      <div>
        <label className="text-sm text-slate-600 font-medium">Hours of sleep (optional)</label>
        <input
          type="number" min="1" max="14" step="0.5"
          value={form.sleep_hours}
          onChange={e => set('sleep_hours', e.target.value)}
          placeholder="e.g. 7"
          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
        />
      </div>
    </div>,

    // Step 2: Goals & Gratitude
    <div key="goals" className="space-y-4">
      <div className="text-center">
        <Star className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
        <h3 className="font-bold text-slate-800 text-lg">Set your intention for today</h3>
      </div>
      <div>
        <label className="text-sm font-medium text-slate-700">My recovery goal for today</label>
        <Textarea value={form.daily_goal} onChange={e => set('daily_goal', e.target.value)}
          placeholder="e.g. Attend my noon meeting and call my sponsor..."
          className="mt-1 resize-none h-20 text-sm" />
      </div>
      <div>
        <label className="text-sm font-medium text-slate-700">One thing I'm grateful for</label>
        <Textarea value={form.gratitude} onChange={e => set('gratitude', e.target.value)}
          placeholder="e.g. My family's support..."
          className="mt-1 resize-none h-16 text-sm" />
      </div>
    </div>,

    // Step 3: Concerns
    <div key="concerns" className="space-y-4">
      <div className="text-center">
        <Heart className="w-8 h-8 text-rose-400 mx-auto mb-2" />
        <h3 className="font-bold text-slate-800 text-lg">Anything on your mind?</h3>
        <p className="text-slate-400 text-sm mt-1">Private — shared only with your support team if needed.</p>
      </div>
      <Textarea value={form.concerns} onChange={e => set('concerns', e.target.value)}
        placeholder="Optional — concerns, triggers, or thoughts you'd like support with..."
        className="resize-none h-28 text-sm" />
    </div>,

    // Step 4: Survey opt-in
    surveyOptIn,
  ];

  // Dynamically append selected surveys
  const steps = [...baseSteps];
  if (form.showBARC10) {
    steps.push(
      <div key="barc10" className="max-h-[60vh] overflow-y-auto pr-1">
        <BARC10Survey answers={form.barc10_answers} onChange={setBARCAnswer} />
      </div>
    );
  }
  if (form.showQoL) {
    steps.push(
      <div key="qol" className="max-h-[60vh] overflow-y-auto pr-1">
        <QoLSurvey answers={form.qol_answers} onChange={setQoLAnswer} />
      </div>
    );
  }

  const isLastStep = step === steps.length - 1;

  return (
    <div className="space-y-5">
      {/* Progress dots */}
      <div className="flex justify-center gap-2">
        {steps.map((_, i) => (
          <div key={i} className={`h-1.5 rounded-full transition-all ${i === step ? 'w-6 bg-amber-500' : i < step ? 'w-4 bg-emerald-400' : 'w-4 bg-slate-200'}`} />
        ))}
      </div>

      {steps[step]}

      <div className="flex gap-3 pt-2">
        {step > 0 && (
          <Button variant="outline" className="flex-1" onClick={() => setStep(s => s - 1)}>Back</Button>
        )}
        {!isLastStep ? (
          <Button
            className="flex-1 bg-amber-600 hover:bg-amber-700 text-white"
            disabled={!canAdvance()}
            onClick={() => setStep(s => s + 1)}
          >
            Next <ChevronRight className="w-4 h-4" />
          </Button>
        ) : (
          <Button
            className="flex-1 bg-emerald-700 hover:bg-emerald-800 text-white"
            onClick={handleSubmit}
            disabled={saving}
          >
            {saving ? 'Saving…' : '✓ Save Reflection'}
          </Button>
        )}
      </div>
    </div>
  );
}