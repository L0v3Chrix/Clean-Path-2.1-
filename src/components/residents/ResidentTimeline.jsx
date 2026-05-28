import { useState, useEffect } from 'react';
import { appClient } from '@/services/appClient';
import {
  Plus, X, Calendar, Star, Award, Briefcase, Home, Heart, Scale, Users,
  GraduationCap, AlertCircle, Pencil, Trash2, ChevronDown, Zap,
  ClipboardList, ArrowRightLeft, MessageSquare, CheckCircle2, Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { differenceInDays, parseISO, format, isValid } from 'date-fns';

// ─── Config ─────────────────────────────────────────────────────────────────
const EVENT_CONFIG = {
  intake:               { label: 'Program Intake',         icon: Home,             color: '#4A6B8A', bg: '#EBF2FA' },
  sobriety_date:        { label: 'Sobriety Date',          icon: Star,             color: '#B45309', bg: '#FEF3C7' },
  phase_change:         { label: 'Phase Change',           icon: ChevronDown,      color: '#7C3AED', bg: '#EDE9FE' },
  status_change:        { label: 'Status Change',          icon: ArrowRightLeft,   color: '#0891B2', bg: '#E0F2FE' },
  interview_completed:  { label: 'Interview Completed',    icon: ClipboardList,    color: '#0D9488', bg: '#CCFBF1' },
  care_plan_update:     { label: 'Care Plan Goal Achieved',icon: CheckCircle2,     color: '#16A34A', bg: '#DCFCE7' },
  life_skills:          { label: 'Life Skills Module',     icon: Award,            color: '#059669', bg: '#D1FAE5' },
  employment:           { label: 'Employment',             icon: Briefcase,        color: '#0891B2', bg: '#CFFAFE' },
  housing_goal:         { label: 'Housing Goal',           icon: Home,             color: '#B45309', bg: '#FEF9C3' },
  medical:              { label: 'Medical Milestone',      icon: Heart,            color: '#DC2626', bg: '#FEE2E2' },
  legal:                { label: 'Legal',                  icon: Scale,            color: '#6B7280', bg: '#F3F4F6' },
  family:               { label: 'Family',                 icon: Users,            color: '#D97706', bg: '#FEF3C7' },
  graduation:           { label: 'Program Graduation',     icon: GraduationCap,    color: '#7C3AED', bg: '#EDE9FE' },
  relapse:              { label: 'Relapse / Setback',      icon: AlertCircle,      color: '#DC2626', bg: '#FEE2E2' },
  other:                { label: 'Other',                  icon: Calendar,         color: '#78716C', bg: '#F5F5F4' },
};

function sobrietyCounter(sobrietyDate) {
  if (!sobrietyDate) return null;
  const d = parseISO(sobrietyDate);
  if (!isValid(d)) return null;
  const days = differenceInDays(new Date(), d);
  if (days < 0) return null;
  if (days < 30) return `${days} day${days !== 1 ? 's' : ''}`;
  if (days < 365) return `${Math.floor(days / 30)} month${Math.floor(days / 30) !== 1 ? 's' : ''}`;
  const years = Math.floor(days / 365);
  const rem = Math.floor((days % 365) / 30);
  return `${years} yr${years !== 1 ? 's' : ''}${rem > 0 ? ` ${rem} mo` : ''}`;
}

// ─── Annotation inline editor ────────────────────────────────────────────────
function AnnotationEditor({ milestone, onSave, onCancel }) {
  const [text, setText] = useState(milestone.staff_annotation || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onSave(text);
    setSaving(false);
  };

  return (
    <div className="mt-2 space-y-2">
      <Textarea
        autoFocus
        rows={2}
        placeholder="Add a staff note to this event…"
        className="text-xs resize-none"
        value={text}
        onChange={e => setText(e.target.value)}
      />
      <div className="flex gap-2">
        <Button size="sm" onClick={handleSave} disabled={saving} className="h-7 text-xs bg-teal-600 hover:bg-teal-700 text-white gap-1">
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
          Save Note
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel} className="h-7 text-xs">Cancel</Button>
      </div>
    </div>
  );
}

// ─── Event card ──────────────────────────────────────────────────────────────
function TimelineEvent({ m, onEdit, onDelete, onAnnotate }) {
  const [annotating, setAnnotating] = useState(false);
  const cfg = EVENT_CONFIG[m.type] || EVENT_CONFIG.other;
  const Icon = cfg.icon;
  const isAuto = m.source === 'auto';

  const handleAnnotateSave = async (text) => {
    await onAnnotate(m.id, text);
    setAnnotating(false);
  };

  return (
    <div className="relative flex gap-3 group">
      {/* Timeline dot */}
      <div className="flex-shrink-0 z-10 pt-0.5">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center"
          style={{ background: cfg.bg, border: `2px solid ${cfg.color}33` }}
        >
          <Icon className="w-3.5 h-3.5" style={{ color: cfg.color }} />
        </div>
      </div>

      {/* Card */}
      <div className="flex-1 pb-5">
        <div className="rounded-xl border border-slate-100 bg-white px-4 py-3 shadow-sm">
          {/* Header row */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: cfg.bg, color: cfg.color }}>
                  {cfg.label}
                </span>
                {isAuto && (
                  <span className="flex items-center gap-0.5 text-xs text-slate-400">
                    <Zap className="w-3 h-3" /> auto-logged
                  </span>
                )}
                {m.type === 'phase_change' && m.phase_from && m.phase_to && (
                  <span className="text-xs text-slate-500">{m.phase_from} → {m.phase_to}</span>
                )}
              </div>
              <p className="text-sm font-semibold text-slate-800 mt-1">{m.title}</p>
              {m.description && (
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{m.description}</p>
              )}
              <p className="text-xs text-slate-400 mt-1">
                {m.date && isValid(parseISO(m.date)) ? format(parseISO(m.date), 'MMMM d, yyyy') : m.date}
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
              <button
                onClick={() => setAnnotating(a => !a)}
                className="p-1.5 rounded-lg hover:bg-teal-50 text-teal-600"
                title="Add note"
              >
                <MessageSquare className="w-3.5 h-3.5" />
              </button>
              {!m._synthetic && !isAuto && (
                <>
                  <button onClick={() => onEdit(m)} className="p-1.5 rounded-lg hover:bg-amber-50" title="Edit">
                    <Pencil className="w-3.5 h-3.5 text-amber-600" />
                  </button>
                  <button onClick={() => onDelete(m.id)} className="p-1.5 rounded-lg hover:bg-red-50" title="Delete">
                    <Trash2 className="w-3.5 h-3.5 text-red-500" />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Existing annotation */}
          {m.staff_annotation && !annotating && (
            <div className="mt-2 flex items-start gap-1.5 bg-teal-50 border border-teal-100 rounded-lg px-3 py-2">
              <MessageSquare className="w-3 h-3 text-teal-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-teal-800 leading-relaxed">{m.staff_annotation}</p>
                {m.annotated_by && (
                  <p className="text-xs text-teal-400 mt-0.5">— {m.annotated_by}</p>
                )}
              </div>
            </div>
          )}

          {/* Inline annotation editor */}
          {annotating && (
            <AnnotationEditor
              milestone={m}
              onSave={handleAnnotateSave}
              onCancel={() => setAnnotating(false)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Milestone form modal ────────────────────────────────────────────────────
function MilestoneForm({ resident, editingMilestone, onSave, onClose }) {
  const [form, setForm] = useState(editingMilestone || {
    resident_id: resident.id,
    organization_id: resident.organization_id,
    date: new Date().toISOString().split('T')[0],
    type: 'life_skills',
    source: 'manual',
    title: '',
    description: '',
    phase_from: '',
    phase_to: '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };

  const manualTypes = Object.entries(EVENT_CONFIG).filter(([k]) =>
    !['status_change', 'interview_completed', 'care_plan_update'].includes(k)
  );

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
      <div className="rounded-2xl w-full max-w-md shadow-2xl bg-white overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b">
          <h3 className="font-bold text-slate-800">{editingMilestone ? 'Edit Milestone' : 'Add Milestone'}</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Date *</Label>
              <Input type="date" value={form.date} onChange={e => set('date', e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>Type *</Label>
              <Select value={form.type} onValueChange={v => set('type', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {manualTypes.map(([key, cfg]) => (
                    <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Title *</Label>
            <Input placeholder="e.g. Completed Financial Literacy Module" value={form.title} onChange={e => set('title', e.target.value)} required />
          </div>
          {form.type === 'phase_change' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>From Phase</Label>
                <Input placeholder="Phase 1" value={form.phase_from} onChange={e => set('phase_from', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>To Phase</Label>
                <Input placeholder="Phase 2" value={form.phase_to} onChange={e => set('phase_to', e.target.value)} />
              </div>
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea placeholder="Optional details…" value={form.description} onChange={e => set('description', e.target.value)} rows={3} />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving} className="bg-teal-600 hover:bg-teal-700 text-white">
              {saving ? 'Saving…' : 'Save Milestone'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────
export default function ResidentTimeline({ resident }) {
  const [milestones, setMilestones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [filter, setFilter] = useState('all');

  const load = async () => {
    setLoading(true);
    const data = await appClient.entities.ResidentMilestone.filter({ resident_id: resident.id }, '-date', 300);

    // Synthetic events from resident record
    const synthetic = [];
    if (resident.intake_date) {
      synthetic.push({
        id: '__intake', date: resident.intake_date, type: 'intake', source: 'auto',
        title: 'Program Intake',
        description: `Admitted${resident.phase ? ` — Phase ${resident.phase}` : ''}${resident.referred_by ? `. Referred by ${resident.referred_by}` : ''}.`,
        _synthetic: true,
      });
    }
    if (resident.sober_date) {
      synthetic.push({
        id: '__sober', date: resident.sober_date, type: 'sobriety_date', source: 'auto',
        title: 'Recovery Date',
        description: `${sobrietyCounter(resident.sober_date)} of continuous recovery.`,
        _synthetic: true,
      });
    }

    // Merge & sort descending (newest first)
    const all = [...synthetic, ...data].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    setMilestones(all);
    setLoading(false);
  };

  useEffect(() => { load(); }, [resident.id]);

  const handleSave = async (form) => {
    if (form.id && !form._synthetic) {
      await appClient.entities.ResidentMilestone.update(form.id, form);
    } else {
      const { id, _synthetic, ...rest } = form;
      await appClient.entities.ResidentMilestone.create(rest);
    }
    setShowForm(false);
    setEditing(null);
    load();
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this milestone?')) return;
    await appClient.entities.ResidentMilestone.delete(id);
    load();
  };

  const handleAnnotate = async (id, text) => {
    const user = await appClient.auth.me().catch(() => null);
    await appClient.entities.ResidentMilestone.update(id, {
      staff_annotation: text,
      annotated_by: user?.full_name || 'Staff',
      annotated_at: new Date().toISOString(),
    });
    load();
  };

  const sobriety = sobrietyCounter(resident.sober_date);

  const filtered = filter === 'all' ? milestones
    : filter === 'auto' ? milestones.filter(m => m.source === 'auto' || m._synthetic)
    : milestones.filter(m => m.source === 'manual' && !m._synthetic);

  // Group by month-year
  const grouped = filtered.reduce((acc, m) => {
    const key = m.date && isValid(parseISO(m.date))
      ? format(parseISO(m.date), 'MMMM yyyy')
      : 'Unknown Date';
    if (!acc[key]) acc[key] = [];
    acc[key].push(m);
    return acc;
  }, {});

  return (
    <div className="space-y-5">
      {/* Sobriety banner */}
      {sobriety && (
        <div className="rounded-2xl p-4 flex items-center gap-4" style={{ background: '#FEF3C7', border: '1px solid #FDE68A' }}>
          <div className="w-12 h-12 rounded-full flex items-center justify-center text-2xl font-black" style={{ background: '#B45309', color: '#FEF3C7' }}>★</div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#92400E' }}>Recovery Milestone</p>
            <p className="text-xl font-black" style={{ color: '#78350F' }}>{sobriety} sober</p>
            <p className="text-xs" style={{ color: '#A16207' }}>since {format(parseISO(resident.sober_date), 'MMMM d, yyyy')}</p>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
          {[['all','All'],['auto','System'],['manual','Staff']].map(([v,l]) => (
            <button
              key={v}
              onClick={() => setFilter(v)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${filter === v ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}
            >
              {l}
            </button>
          ))}
        </div>
        <Button size="sm" onClick={() => { setEditing(null); setShowForm(true); }} className="gap-1.5 text-xs bg-teal-600 hover:bg-teal-700 text-white">
          <Plus className="w-3.5 h-3.5" /> Add Event
        </Button>
      </div>

      {/* Timeline */}
      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 rounded-xl bg-slate-100 animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 rounded-2xl border-2 border-dashed border-slate-200">
          <Calendar className="w-8 h-8 mx-auto mb-2 text-slate-300" />
          <p className="font-medium text-slate-500">No events yet</p>
          <p className="text-xs text-slate-400 mt-1">Events are logged automatically as the resident progresses.</p>
        </div>
      ) : (
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-4 top-3 bottom-3 w-px bg-slate-200" />

          <div className="space-y-1">
            {Object.entries(grouped).map(([month, events]) => (
              <div key={month}>
                <div className="relative flex items-center gap-3 py-2 pl-10">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{month}</p>
                </div>
                {events.map(m => (
                  <TimelineEvent
                    key={m.id}
                    m={m}
                    onEdit={(m) => { setEditing(m); setShowForm(true); }}
                    onDelete={handleDelete}
                    onAnnotate={handleAnnotate}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {showForm && (
        <MilestoneForm
          resident={resident}
          editingMilestone={editing}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditing(null); }}
        />
      )}
    </div>
  );
}