import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Sun, Moon, Star, Heart, CheckCircle2, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { format } from 'date-fns';

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
    sleep_quality: existingLog?.sleep_quality || null,
    sleep_hours: existingLog?.sleep_hours || '',
    daily_goal: existingLog?.daily_goal || '',
    gratitude: existingLog?.gratitude || '',
    concerns: existingLog?.concerns || '',
  });

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const canAdvance = () => {
    if (step === 0) return form.mood !== null;
    if (step === 1) return form.sleep_quality !== null;
    return true;
  };

  const handleSubmit = async () => {
    setSaving(true);
    const flagged = form.mood <= 2 || form.sleep_quality <= 2;
    const payload = {
      resident_id: resident.id,
      organization_id: resident.organization_id,
      log_date: today,
      mood: form.mood,
      sleep_quality: form.sleep_quality,
      sleep_hours: form.sleep_hours ? Number(form.sleep_hours) : undefined,
      daily_goal: form.daily_goal || undefined,
      gratitude: form.gratitude || undefined,
      concerns: form.concerns || undefined,
      flagged_for_support: flagged,
    };
    if (existingLog?.id) {
      await base44.entities.MorningReflection.update(existingLog.id, payload);
    } else {
      await base44.entities.MorningReflection.create(payload);
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

  const steps = [
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
              form.mood === opt.value
                ? 'border-amber-500 bg-amber-50 scale-110'
                : 'border-slate-200 hover:border-amber-300'
            }`}
          >
            <span className="text-3xl">{opt.emoji}</span>
            <span className="text-xs text-slate-600 font-medium">{opt.label}</span>
          </button>
        ))}
      </div>
    </div>,

    // Step 1: Sleep
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
          type="number"
          min="1" max="14" step="0.5"
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
        <Textarea
          value={form.daily_goal}
          onChange={e => set('daily_goal', e.target.value)}
          placeholder="e.g. Attend my noon meeting and call my sponsor..."
          className="mt-1 resize-none h-20 text-sm"
        />
      </div>
      <div>
        <label className="text-sm font-medium text-slate-700">One thing I'm grateful for</label>
        <Textarea
          value={form.gratitude}
          onChange={e => set('gratitude', e.target.value)}
          placeholder="e.g. My family's support..."
          className="mt-1 resize-none h-16 text-sm"
        />
      </div>
    </div>,

    // Step 3: Concerns
    <div key="concerns" className="space-y-4">
      <div className="text-center">
        <Heart className="w-8 h-8 text-rose-400 mx-auto mb-2" />
        <h3 className="font-bold text-slate-800 text-lg">Anything on your mind?</h3>
        <p className="text-slate-400 text-sm mt-1">This is private — shared only with your support team if needed.</p>
      </div>
      <Textarea
        value={form.concerns}
        onChange={e => set('concerns', e.target.value)}
        placeholder="Optional — share any concerns, triggers, or thoughts you'd like support with..."
        className="resize-none h-28 text-sm"
      />
    </div>,
  ];

  return (
    <div className="space-y-5">
      {/* Progress dots */}
      <div className="flex justify-center gap-2">
        {steps.map((_, i) => (
          <div key={i} className={`h-1.5 rounded-full transition-all ${i === step ? 'w-6 bg-amber-500' : i < step ? 'w-4 bg-emerald-400' : 'w-4 bg-slate-200'}`} />
        ))}
      </div>

      {/* Step content */}
      {steps[step]}

      {/* Navigation */}
      <div className="flex gap-3 pt-2">
        {step > 0 && (
          <Button variant="outline" className="flex-1" onClick={() => setStep(s => s - 1)}>
            Back
          </Button>
        )}
        {step < steps.length - 1 ? (
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