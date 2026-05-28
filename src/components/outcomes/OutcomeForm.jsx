import { useState } from 'react';
import { appClient } from '@/services/appClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X } from 'lucide-react';

const Field = ({ label, children }) => (
  <div>
    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</label>
    <div className="mt-1">{children}</div>
  </div>
);

const Sel = ({ value, onValueChange, children, placeholder }) => (
  <Select value={value || ''} onValueChange={onValueChange}>
    <SelectTrigger><SelectValue placeholder={placeholder || 'Select…'} /></SelectTrigger>
    <SelectContent>{children}</SelectContent>
  </Select>
);

export default function OutcomeForm({ outcome, residents, grants, orgId, onSave, onCancel }) {
  const [form, setForm] = useState(outcome || {
    resident_id: '', exit_date: '', exit_type: 'graduated',
    employment_status: 'unknown', employer_name: '', income_range: 'unknown',
    housing_status: 'unknown', housing_stable_since: '',
    education_status: 'unknown', education_program: '',
    sobriety_maintained: true, days_sober_at_exit: '', current_sobriety_days: '',
    recovery_support_active: false, support_type: '',
    follow_up_date: new Date().toISOString().split('T')[0], follow_up_method: 'phone',
    grant_ids: [], notes: '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const toggleGrant = (id) => {
    const ids = form.grant_ids || [];
    set('grant_ids', ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]);
  };

  const handleSave = async () => {
    setSaving(true);
    const payload = {
      ...form,
      organization_id: orgId,
      days_sober_at_exit: form.days_sober_at_exit ? Number(form.days_sober_at_exit) : undefined,
      current_sobriety_days: form.current_sobriety_days ? Number(form.current_sobriety_days) : undefined,
    };
    if (outcome?.id) {
      await appClient.entities.ResidentOutcome.update(outcome.id, payload);
    } else {
      await appClient.entities.ResidentOutcome.create(payload);
    }
    setSaving(false);
    onSave();
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-slate-800 text-lg">{outcome?.id ? 'Edit Outcome Record' : 'Log Post-Exit Outcome'}</h3>
        <button onClick={onCancel}><X className="w-5 h-5 text-slate-400 hover:text-slate-700" /></button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Resident *">
          <Sel value={form.resident_id} onValueChange={v => set('resident_id', v)} placeholder="Select resident…">
            {residents.map(r => <SelectItem key={r.id} value={r.id}>{r.first_name} {r.last_name}</SelectItem>)}
          </Sel>
        </Field>
        <Field label="Exit Date *">
          <Input type="date" value={form.exit_date} onChange={e => set('exit_date', e.target.value)} />
        </Field>
        <Field label="Exit Type">
          <Sel value={form.exit_type} onValueChange={v => set('exit_type', v)}>
            {['graduated','voluntary','administrative','relapse','medical','incarcerated','deceased','unknown'].map(v =>
              <SelectItem key={v} value={v}>{v.replace(/_/g,' ')}</SelectItem>
            )}
          </Sel>
        </Field>
        <Field label="Follow-up Date">
          <Input type="date" value={form.follow_up_date} onChange={e => set('follow_up_date', e.target.value)} />
        </Field>
        <Field label="Follow-up Method">
          <Sel value={form.follow_up_method} onValueChange={v => set('follow_up_method', v)}>
            {['phone','email','in_person','text','no_contact'].map(v =>
              <SelectItem key={v} value={v}>{v.replace(/_/g,' ')}</SelectItem>
            )}
          </Sel>
        </Field>

        {/* Employment */}
        <div className="sm:col-span-2"><p className="text-xs font-bold uppercase text-amber-700 border-b border-amber-100 pb-1">Employment</p></div>
        <Field label="Employment Status">
          <Sel value={form.employment_status} onValueChange={v => set('employment_status', v)}>
            {['employed_full_time','employed_part_time','self_employed','unemployed_seeking','unemployed_not_seeking','disabled','student','retired','unknown'].map(v =>
              <SelectItem key={v} value={v}>{v.replace(/_/g,' ')}</SelectItem>
            )}
          </Sel>
        </Field>
        <Field label="Employer / Program Name">
          <Input value={form.employer_name} onChange={e => set('employer_name', e.target.value)} placeholder="Optional" />
        </Field>
        <Field label="Income Range">
          <Sel value={form.income_range} onValueChange={v => set('income_range', v)}>
            {[['under_15k','Under $15k'],['15k_30k','$15k–$30k'],['30k_50k','$30k–$50k'],['50k_75k','$50k–$75k'],['over_75k','Over $75k'],['unknown','Unknown']].map(([v,l]) =>
              <SelectItem key={v} value={v}>{l}</SelectItem>
            )}
          </Sel>
        </Field>

        {/* Housing */}
        <div className="sm:col-span-2"><p className="text-xs font-bold uppercase text-amber-700 border-b border-amber-100 pb-1">Housing</p></div>
        <Field label="Housing Status">
          <Sel value={form.housing_status} onValueChange={v => set('housing_status', v)}>
            {['stable_owned','stable_rented','with_family','sober_living','shelter','transitional','unstable','homeless','unknown'].map(v =>
              <SelectItem key={v} value={v}>{v.replace(/_/g,' ')}</SelectItem>
            )}
          </Sel>
        </Field>
        <Field label="Stable Since (if applicable)">
          <Input type="date" value={form.housing_stable_since} onChange={e => set('housing_stable_since', e.target.value)} />
        </Field>

        {/* Education */}
        <div className="sm:col-span-2"><p className="text-xs font-bold uppercase text-amber-700 border-b border-amber-100 pb-1">Education</p></div>
        <Field label="Education Status">
          <Sel value={form.education_status} onValueChange={v => set('education_status', v)}>
            {['enrolled_degree','enrolled_vocational','completed_degree','completed_vocational','completed_ged','not_enrolled','unknown'].map(v =>
              <SelectItem key={v} value={v}>{v.replace(/_/g,' ')}</SelectItem>
            )}
          </Sel>
        </Field>
        <Field label="School / Program">
          <Input value={form.education_program} onChange={e => set('education_program', e.target.value)} placeholder="Optional" />
        </Field>

        {/* Recovery */}
        <div className="sm:col-span-2"><p className="text-xs font-bold uppercase text-amber-700 border-b border-amber-100 pb-1">Recovery & Sobriety</p></div>
        <Field label="Sobriety Maintained?">
          <Sel value={String(form.sobriety_maintained)} onValueChange={v => set('sobriety_maintained', v === 'true')}>
            <SelectItem value="true">Yes</SelectItem>
            <SelectItem value="false">No / Relapsed</SelectItem>
          </Sel>
        </Field>
        <Field label="Still in Recovery Support?">
          <Sel value={String(form.recovery_support_active)} onValueChange={v => set('recovery_support_active', v === 'true')}>
            <SelectItem value="true">Yes</SelectItem>
            <SelectItem value="false">No</SelectItem>
          </Sel>
        </Field>
        <Field label="Days Sober at Exit">
          <Input type="number" value={form.days_sober_at_exit} onChange={e => set('days_sober_at_exit', e.target.value)} placeholder="0" />
        </Field>
        <Field label="Current Sobriety Days">
          <Input type="number" value={form.current_sobriety_days} onChange={e => set('current_sobriety_days', e.target.value)} placeholder="0" />
        </Field>
        <Field label="Support Type">
          <Input value={form.support_type} onChange={e => set('support_type', e.target.value)} placeholder="AA, counseling, MAT, etc." />
        </Field>

        {/* Grant attribution */}
        {grants.length > 0 && (
          <div className="sm:col-span-2">
            <p className="text-xs font-bold uppercase text-amber-700 border-b border-amber-100 pb-1 mb-2">Grant Attribution</p>
            <div className="flex flex-wrap gap-2">
              {grants.map(g => {
                const sel = (form.grant_ids || []).includes(g.id);
                return (
                  <button key={g.id} type="button" onClick={() => toggleGrant(g.id)}
                    className={`text-xs px-3 py-1.5 rounded-full font-medium border transition-colors ${sel ? 'bg-amber-600 text-white border-amber-600' : 'bg-white text-slate-600 border-slate-200 hover:border-amber-400'}`}>
                    {g.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="sm:col-span-2">
          <Field label="Notes">
            <Textarea className="resize-none h-20" value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Case notes, observations, context…" />
          </Field>
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <Button variant="outline" className="flex-1" onClick={onCancel}>Cancel</Button>
        <Button
          className="flex-1 bg-amber-600 hover:bg-amber-700 text-white"
          onClick={handleSave}
          disabled={saving || !form.resident_id || !form.exit_date}
        >
          {saving ? 'Saving…' : outcome?.id ? 'Update Record' : 'Save Outcome'}
        </Button>
      </div>
    </div>
  );
}