import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, X, Calendar, Star, Award, Briefcase, Home, Heart, Scale, Users, GraduationCap, AlertCircle, Pencil, Trash2, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { differenceInDays, parseISO, format, isValid } from 'date-fns';

const MILESTONE_CONFIG = {
  intake:        { label: 'Program Intake',       icon: Home,         color: '#4A6B8A', bg: '#EBF2FA' },
  sobriety_date: { label: 'Sobriety Date',        icon: Star,         color: '#B45309', bg: '#FEF3C7' },
  phase_change:  { label: 'Phase Change',         icon: ChevronDown,  color: '#7C3AED', bg: '#EDE9FE' },
  life_skills:   { label: 'Life Skills Module',   icon: Award,        color: '#059669', bg: '#D1FAE5' },
  employment:    { label: 'Employment',            icon: Briefcase,    color: '#0891B2', bg: '#CFFAFE' },
  housing_goal:  { label: 'Housing Goal',         icon: Home,         color: '#B45309', bg: '#FEF9C3' },
  medical:       { label: 'Medical Milestone',    icon: Heart,        color: '#DC2626', bg: '#FEE2E2' },
  legal:         { label: 'Legal',                icon: Scale,        color: '#6B7280', bg: '#F3F4F6' },
  family:        { label: 'Family',               icon: Users,        color: '#D97706', bg: '#FEF3C7' },
  graduation:    { label: 'Program Graduation',   icon: GraduationCap,color: '#7C3AED', bg: '#EDE9FE' },
  relapse:       { label: 'Relapse / Setback',    icon: AlertCircle,  color: '#DC2626', bg: '#FEE2E2' },
  other:         { label: 'Other',                icon: Calendar,     color: '#78716C', bg: '#F5F5F4' },
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

function MilestoneIcon({ type, size = 'md' }) {
  const cfg = MILESTONE_CONFIG[type] || MILESTONE_CONFIG.other;
  const Icon = cfg.icon;
  const sz = size === 'sm' ? 'w-7 h-7' : 'w-9 h-9';
  const icz = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';
  return (
    <div className={`${sz} rounded-full flex items-center justify-center flex-shrink-0`} style={{ background: cfg.bg, border: `2px solid ${cfg.color}22` }}>
      <Icon className={icz} style={{ color: cfg.color }} />
    </div>
  );
}

function MilestoneForm({ resident, editingMilestone, onSave, onClose }) {
  const [form, setForm] = useState(editingMilestone || {
    resident_id: resident.id,
    organization_id: resident.organization_id,
    date: new Date().toISOString().split('T')[0],
    type: 'life_skills',
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

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
      <div className="rounded-2xl w-full max-w-md shadow-2xl overflow-hidden" style={{ background: '#FAF6EF' }}>
        <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: '#E0D5C5' }}>
          <h3 className="font-bold" style={{ color: '#1C1917' }}>{editingMilestone ? 'Edit Milestone' : 'Add Milestone'}</h3>
          <button onClick={onClose}><X className="w-5 h-5" style={{ color: '#78716C' }} /></button>
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
                  {Object.entries(MILESTONE_CONFIG).map(([key, cfg]) => (
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
            <Textarea placeholder="Optional details..." value={form.description} onChange={e => set('description', e.target.value)} rows={3} />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving} style={{ background: '#B45309', color: '#fff' }}>
              {saving ? 'Saving…' : 'Save Milestone'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ResidentTimeline({ resident }) {
  const [milestones, setMilestones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = async () => {
    setLoading(true);
    const data = await base44.entities.ResidentMilestone.filter({ resident_id: resident.id }, 'date', 200);
    // Also synthesize built-in milestones from resident record
    const synthetic = [];
    if (resident.intake_date) {
      synthetic.push({ id: '__intake', date: resident.intake_date, type: 'intake', title: 'Program Intake', description: `Admitted to ${resident.phase ? `Phase ${resident.phase}` : 'the program'}`, _synthetic: true });
    }
    if (resident.sober_date) {
      synthetic.push({ id: '__sober', date: resident.sober_date, type: 'sobriety_date', title: 'Recovery Date', description: `${sobrietyCounter(resident.sober_date)} of recovery`, _synthetic: true });
    }
    // Merge and sort descending
    const all = [...synthetic, ...data].sort((a, b) => {
      const da = a.date || '0000';
      const db = b.date || '0000';
      return db.localeCompare(da);
    });
    setMilestones(all);
    setLoading(false);
  };

  useEffect(() => { load(); }, [resident.id]);

  const handleSave = async (form) => {
    if (form.id && !form._synthetic) {
      await base44.entities.ResidentMilestone.update(form.id, form);
    } else {
      const { id, _synthetic, ...rest } = form;
      await base44.entities.ResidentMilestone.create(rest);
    }
    setShowForm(false);
    setEditing(null);
    load();
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this milestone?')) return;
    await base44.entities.ResidentMilestone.delete(id);
    load();
  };

  const sobriety = sobrietyCounter(resident.sober_date);

  return (
    <div className="space-y-5">
      {/* Sobriety counter banner */}
      {sobriety && (
        <div className="rounded-2xl p-4 flex items-center gap-4" style={{ background: '#FEF3C7', border: '1px solid #FDE68A' }}>
          <div className="w-12 h-12 rounded-full flex items-center justify-center text-2xl font-black" style={{ background: '#B45309', color: '#FEF3C7' }}>
            ★
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#92400E' }}>Recovery Milestone</p>
            <p className="text-xl font-black" style={{ color: '#78350F' }}>{sobriety} sober</p>
            <p className="text-xs" style={{ color: '#A16207' }}>since {format(parseISO(resident.sober_date), 'MMMM d, yyyy')}</p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide" style={{ color: '#78716C' }}>Journey Timeline</h3>
        <Button size="sm" onClick={() => { setEditing(null); setShowForm(true); }} className="gap-1.5 text-xs" style={{ background: '#B45309', color: '#fff' }}>
          <Plus className="w-3.5 h-3.5" /> Add Milestone
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background: '#E5DDD0' }} />
          ))}
        </div>
      ) : milestones.length === 0 ? (
        <div className="text-center py-12 rounded-2xl" style={{ background: '#F0E9DC', border: '1px dashed #C9B99A' }}>
          <Calendar className="w-8 h-8 mx-auto mb-2" style={{ color: '#C9A227' }} />
          <p className="font-medium" style={{ color: '#1C1917' }}>No milestones yet</p>
          <p className="text-sm mt-1" style={{ color: '#78716C' }}>Track this resident's recovery journey by adding key milestones.</p>
        </div>
      ) : (
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-[17px] top-4 bottom-4 w-0.5" style={{ background: '#E0D5C5' }} />

          <div className="space-y-1">
            {milestones.map((m, idx) => {
              const cfg = MILESTONE_CONFIG[m.type] || MILESTONE_CONFIG.other;
              const Icon = cfg.icon;
              const isFirst = idx === 0;
              return (
                <div key={m.id} className={`relative flex gap-4 py-3 pr-3 pl-1 rounded-xl group transition-colors hover:bg-amber-50/50`}>
                  {/* Icon dot on timeline */}
                  <div className="flex-shrink-0 z-10">
                    <MilestoneIcon type={m.type} size="sm" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 pt-0.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: cfg.bg, color: cfg.color }}>
                            {cfg.label}
                          </span>
                          {m.type === 'phase_change' && m.phase_from && m.phase_to && (
                            <span className="text-xs" style={{ color: '#78716C' }}>{m.phase_from} → {m.phase_to}</span>
                          )}
                        </div>
                        <p className="text-sm font-semibold mt-1" style={{ color: '#1C1917' }}>{m.title}</p>
                        {m.description && (
                          <p className="text-xs mt-0.5 leading-relaxed" style={{ color: '#78716C' }}>{m.description}</p>
                        )}
                        <p className="text-xs mt-1" style={{ color: '#A09080' }}>
                          {m.date && isValid(parseISO(m.date)) ? format(parseISO(m.date), 'MMMM d, yyyy') : m.date}
                        </p>
                      </div>

                      {/* Edit / Delete — only for non-synthetic */}
                      {!m._synthetic && (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => { setEditing(m); setShowForm(true); }}
                            className="p-1.5 rounded-lg hover:bg-amber-100"
                            title="Edit"
                          >
                            <Pencil className="w-3.5 h-3.5" style={{ color: '#B45309' }} />
                          </button>
                          <button
                            onClick={() => handleDelete(m.id)}
                            className="p-1.5 rounded-lg hover:bg-red-50"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" style={{ color: '#DC2626' }} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
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