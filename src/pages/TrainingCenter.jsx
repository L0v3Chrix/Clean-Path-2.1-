import { useState, useEffect } from 'react';
import { appClient } from '@/services/appClient';
import { BookOpen, Plus, Play, CheckCircle2, Clock, ChevronRight, ChevronLeft, X, Edit2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const CATEGORIES = [
  { value: 'onboarding', label: 'Onboarding', color: '#6366F1' },
  { value: 'hipaa_compliance', label: 'HIPAA Compliance', color: '#EF4444' },
  { value: 'peer_support', label: 'Peer Support', color: '#10B981' },
  { value: 'crisis_intervention', label: 'Crisis Intervention', color: '#F97316' },
  { value: 'medication_management', label: 'Med Management', color: '#8B5CF6' },
  { value: 'documentation', label: 'Documentation', color: '#14B8A6' },
  { value: 'recovery_support', label: 'Recovery Support', color: '#B45309' },
  { value: 'safety', label: 'Safety', color: '#EAB308' },
  { value: 'custom', label: 'Custom', color: '#64748B' },
];

function SlideViewer({ module, onClose }) {
  const [slide, setSlide] = useState(0);
  const slides = module.slides || [];
  if (slides.length === 0) return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-8 max-w-lg w-full text-center">
        <p className="text-slate-500">No slides in this module yet.</p>
        <Button className="mt-4" onClick={onClose}>Close</Button>
      </div>
    </div>
  );
  const current = slides[slide];
  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl overflow-hidden max-w-2xl w-full">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
          <span className="font-bold text-slate-800">{module.title}</span>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400">{slide + 1} / {slides.length}</span>
            <button onClick={onClose}><X className="w-5 h-5 text-slate-400 hover:text-slate-700" /></button>
          </div>
        </div>
        <div className="p-6 min-h-64">
          {current.image_url && <img src={current.image_url} alt="" className="w-full h-40 object-cover rounded-xl mb-4" />}
          <h2 className="text-xl font-bold text-slate-800 mb-3">{current.title}</h2>
          <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">{current.body}</p>
        </div>
        <div className="flex items-center justify-between px-5 py-4 border-t border-slate-100 bg-slate-50">
          <Button variant="outline" disabled={slide === 0} onClick={() => setSlide(s => s - 1)}>
            <ChevronLeft className="w-4 h-4" /> Previous
          </Button>
          <div className="flex gap-1">
            {slides.map((_, i) => (
              <div key={i} onClick={() => setSlide(i)}
                className={`w-2 h-2 rounded-full cursor-pointer transition-all ${i === slide ? 'bg-amber-600 w-4' : 'bg-slate-300'}`} />
            ))}
          </div>
          {slide < slides.length - 1 ? (
            <Button className="bg-amber-600 hover:bg-amber-700 text-white" onClick={() => setSlide(s => s + 1)}>
              Next <ChevronRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={onClose}>
              <CheckCircle2 className="w-4 h-4" /> Complete
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function ModuleForm({ orgId, module, onSave, onCancel }) {
  const [form, setForm] = useState(module || {
    title: '', description: '', category: 'onboarding', content_type: 'slides',
    external_url: '', estimated_minutes: '', status: 'draft',
    slides: [{ title: '', body: '', image_url: '' }]
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const [saving, setSaving] = useState(false);

  const addSlide = () => set('slides', [...(form.slides || []), { title: '', body: '', image_url: '' }]);
  const updateSlide = (i, k, v) => {
    const s = [...(form.slides || [])];
    s[i] = { ...s[i], [k]: v };
    set('slides', s);
  };
  const removeSlide = (i) => set('slides', form.slides.filter((_, idx) => idx !== i));

  const handleSave = async () => {
    setSaving(true);
    const payload = { ...form, organization_id: orgId, estimated_minutes: form.estimated_minutes ? Number(form.estimated_minutes) : undefined };
    if (module?.id) {
      await appClient.entities.TrainingModule.update(module.id, payload);
    } else {
      await appClient.entities.TrainingModule.create(payload);
    }
    setSaving(false);
    onSave();
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 max-h-[80vh] overflow-y-auto">
      <h3 className="font-bold text-slate-800">{module?.id ? 'Edit Module' : 'New Training Module'}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <label className="text-xs font-medium text-slate-500">Title</label>
          <Input className="mt-1" value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. HIPAA 101 for Staff" />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500">Category</label>
          <Select value={form.category} onValueChange={v => set('category', v)}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>{CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500">Est. Duration (minutes)</label>
          <Input className="mt-1" type="number" value={form.estimated_minutes} onChange={e => set('estimated_minutes', e.target.value)} placeholder="15" />
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs font-medium text-slate-500">Description</label>
          <Textarea className="mt-1 h-16 resize-none" value={form.description} onChange={e => set('description', e.target.value)} />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500">External URL (optional)</label>
          <Input className="mt-1" value={form.external_url} onChange={e => set('external_url', e.target.value)} placeholder="https://..." />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500">Status</label>
          <Select value={form.status} onValueChange={v => set('status', v)}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="published">Published</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Slides editor */}
      <div className="border-t border-slate-100 pt-4">
        <div className="flex items-center justify-between mb-3">
          <p className="font-semibold text-slate-700 text-sm">Slides ({(form.slides || []).length})</p>
          <Button size="sm" variant="outline" onClick={addSlide}><Plus className="w-3 h-3" /> Add Slide</Button>
        </div>
        <div className="space-y-3">
          {(form.slides || []).map((s, i) => (
            <div key={i} className="bg-slate-50 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400">SLIDE {i + 1}</span>
                {(form.slides || []).length > 1 && (
                  <button onClick={() => removeSlide(i)} className="text-red-400 hover:text-red-600"><X className="w-3.5 h-3.5" /></button>
                )}
              </div>
              <Input placeholder="Slide title" value={s.title} onChange={e => updateSlide(i, 'title', e.target.value)} />
              <Textarea placeholder="Slide body / content..." value={s.body} onChange={e => updateSlide(i, 'body', e.target.value)} className="resize-none h-20 text-sm" />
              <Input placeholder="Image URL (optional)" value={s.image_url} onChange={e => updateSlide(i, 'image_url', e.target.value)} />
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <Button variant="outline" className="flex-1" onClick={onCancel}>Cancel</Button>
        <Button className="flex-1 bg-amber-600 hover:bg-amber-700 text-white" onClick={handleSave} disabled={saving || !form.title}>
          {saving ? 'Saving…' : 'Save Module'}
        </Button>
      </div>
    </div>
  );
}

export default function TrainingCenter() {
  const [modules, setModules] = useState([]);
  const [orgId, setOrgId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingModule, setEditingModule] = useState(null);
  const [viewingModule, setViewingModule] = useState(null);
  const [filterCat, setFilterCat] = useState('all');

  const load = async () => {
    const [orgs, mods] = await Promise.all([
      appClient.entities.Organization.list(),
      appClient.entities.TrainingModule.list('-created_date', 200),
    ]);
    if (orgs[0]) setOrgId(orgs[0].id);
    setModules(mods);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const published = modules.filter(m => m.status === 'published');
  const filtered = filterCat === 'all' ? published : published.filter(m => m.category === filterCat);

  if (loading) return <div className="flex items-center justify-center min-h-64"><div className="w-8 h-8 border-4 border-amber-200 border-t-amber-600 rounded-full animate-spin" /></div>;

  return (
    <div className="p-6 space-y-6" style={{ background: '#FAF6EF', minHeight: '100%' }}>
      {viewingModule && <SlideViewer module={viewingModule} onClose={() => setViewingModule(null)} />}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Training Center</h1>
          <p className="text-sm text-slate-500 mt-0.5">Staff training, slide decks, certifications & compliance modules.</p>
        </div>
        <Button className="bg-amber-600 hover:bg-amber-700 text-white" onClick={() => { setEditingModule(null); setShowForm(true); }}>
          <Plus className="w-4 h-4" /> New Module
        </Button>
      </div>

      {(showForm || editingModule) && (
        <ModuleForm
          orgId={orgId}
          module={editingModule}
          onSave={() => { setShowForm(false); setEditingModule(null); load(); }}
          onCancel={() => { setShowForm(false); setEditingModule(null); }}
        />
      )}

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Modules', value: modules.length },
          { label: 'Published', value: published.length },
          { label: 'Drafts', value: modules.filter(m => m.status === 'draft').length },
          { label: 'Categories', value: new Set(modules.map(m => m.category)).size },
        ].map(k => (
          <div key={k.label} className="rounded-2xl p-4" style={{ background: '#F0E9DC', border: '1px solid #E0D5C5' }}>
            <p className="text-2xl font-black text-slate-900">{k.value}</p>
            <p className="text-sm text-slate-500">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Category filter */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setFilterCat('all')}
          className={`text-xs px-3 py-1 rounded-full font-medium transition-colors ${filterCat === 'all' ? 'bg-amber-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-amber-50'}`}>
          All
        </button>
        {CATEGORIES.map(c => (
          <button key={c.value} onClick={() => setFilterCat(c.value)}
            className={`text-xs px-3 py-1 rounded-full font-medium transition-colors ${filterCat === c.value ? 'text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-amber-50'}`}
            style={filterCat === c.value ? { background: c.color } : {}}>
            {c.label}
          </button>
        ))}
      </div>

      {/* Module grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.length === 0 && (
          <div className="col-span-3 text-center py-12 text-slate-400">
            <BookOpen className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p>No published modules yet. Create your first training module!</p>
          </div>
        )}
        {filtered.map(m => {
          const cat = CATEGORIES.find(c => c.value === m.category);
          return (
            <div key={m.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-md transition-shadow">
              <div className="h-1.5 w-full" style={{ background: cat?.color || '#9CA3AF' }} />
              <div className="p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full text-white" style={{ background: cat?.color || '#9CA3AF' }}>
                    {cat?.label || m.category}
                  </span>
                  <div className="flex gap-1">
                    <button onClick={() => { setEditingModule(m); setShowForm(false); }} className="p-1 rounded hover:bg-amber-50 text-amber-600">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <h3 className="font-bold text-slate-800 text-base">{m.title}</h3>
                {m.description && <p className="text-sm text-slate-500 mt-1 line-clamp-2">{m.description}</p>}
                <div className="flex items-center gap-3 mt-3">
                  {m.estimated_minutes && (
                    <span className="flex items-center gap-1 text-xs text-slate-400">
                      <Clock className="w-3 h-3" /> {m.estimated_minutes} min
                    </span>
                  )}
                  {m.slides?.length > 0 && (
                    <span className="text-xs text-slate-400">{m.slides.length} slides</span>
                  )}
                </div>
                <div className="flex gap-2 mt-3">
                  {m.slides?.length > 0 && (
                    <Button size="sm" className="flex-1 bg-amber-600 hover:bg-amber-700 text-white text-xs" onClick={() => setViewingModule(m)}>
                      <Play className="w-3 h-3" /> Start
                    </Button>
                  )}
                  {m.external_url && (
                    <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => window.open(m.external_url, '_blank')}>
                      Open Link
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Drafts section */}
      {modules.filter(m => m.status === 'draft').length > 0 && (
        <div className="rounded-2xl p-5" style={{ background: '#F0E9DC', border: '1px solid #E0D5C5' }}>
          <h2 className="font-bold text-slate-700 mb-3 text-sm">Drafts</h2>
          <div className="space-y-2">
            {modules.filter(m => m.status === 'draft').map(m => (
              <div key={m.id} className="bg-white rounded-xl border border-slate-200 p-3 flex items-center justify-between">
                <span className="text-sm font-medium text-slate-600">{m.title}</span>
                <button onClick={() => { setEditingModule(m); setShowForm(false); }} className="text-xs text-amber-600 font-medium hover:underline flex items-center gap-1">
                  <Edit2 className="w-3 h-3" /> Edit
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}