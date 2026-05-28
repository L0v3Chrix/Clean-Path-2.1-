import { useState } from 'react';
import { appClient } from '@/services/appClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X } from 'lucide-react';

const FUNDER_TYPES = [
  { value: 'federal', label: 'Federal' },
  { value: 'state', label: 'State' },
  { value: 'county', label: 'County' },
  { value: 'city', label: 'City/Municipal' },
  { value: 'private_foundation', label: 'Private Foundation' },
  { value: 'corporate', label: 'Corporate' },
  { value: 'individual', label: 'Individual Donor' },
  { value: 'other', label: 'Other' },
];

const PROGRAM_TYPES = [
  { value: 'recovery_housing', label: 'Recovery Housing' },
  { value: 'peer_support', label: 'Peer Support' },
  { value: 'mat_support', label: 'MAT Support' },
  { value: 'transitional_housing', label: 'Transitional Housing' },
  { value: 'harm_reduction', label: 'Harm Reduction' },
  { value: 'workforce_development', label: 'Workforce Development' },
  { value: 'mental_health', label: 'Mental Health' },
  { value: 'other', label: 'Other' },
];

export default function GrantForm({ grant, locations, orgId, onSave, onCancel }) {
  const [form, setForm] = useState(grant || {
    name: '', funder_name: '', funder_type: 'state', program_type: 'recovery_housing',
    grant_number: '', start_date: '', end_date: '', total_award: '',
    beds_funded: '', location_ids: [], reporting_frequency: 'quarterly',
    contact_name: '', contact_email: '', notes: '', status: 'active',
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const toggleLocation = (id) => {
    const ids = form.location_ids || [];
    set('location_ids', ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]);
  };

  const handleSave = async () => {
    setSaving(true);
    const payload = {
      ...form,
      organization_id: orgId,
      total_award: form.total_award ? Number(form.total_award) : undefined,
      beds_funded: form.beds_funded ? Number(form.beds_funded) : undefined,
    };
    if (grant?.id) {
      await appClient.entities.Grant.update(grant.id, payload);
    } else {
      await appClient.entities.Grant.create(payload);
    }
    setSaving(false);
    onSave();
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-slate-800 text-lg">{grant?.id ? 'Edit Grant' : 'New Grant'}</h3>
        <button onClick={onCancel}><X className="w-5 h-5 text-slate-400 hover:text-slate-700" /></button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className="text-xs font-semibold text-slate-500 uppercase">Grant Name</label>
          <Input className="mt-1" value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. SAMHSA Recovery Housing Initiative FY2026" />
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase">Funder / Grantor</label>
          <Input className="mt-1" value={form.funder_name} onChange={e => set('funder_name', e.target.value)} placeholder="e.g. SAMHSA, State DMHAS" />
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase">Funder Type</label>
          <Select value={form.funder_type} onValueChange={v => set('funder_type', v)}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>{FUNDER_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase">Program Type</label>
          <Select value={form.program_type} onValueChange={v => set('program_type', v)}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>{PROGRAM_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase">Grant Award Number</label>
          <Input className="mt-1" value={form.grant_number} onChange={e => set('grant_number', e.target.value)} placeholder="Official award #" />
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase">Start Date</label>
          <Input className="mt-1" type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} />
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase">End Date</label>
          <Input className="mt-1" type="date" value={form.end_date} onChange={e => set('end_date', e.target.value)} />
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase">Total Award ($)</label>
          <Input className="mt-1" type="number" value={form.total_award} onChange={e => set('total_award', e.target.value)} placeholder="0" />
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase">Beds / Slots Funded</label>
          <Input className="mt-1" type="number" value={form.beds_funded} onChange={e => set('beds_funded', e.target.value)} placeholder="0" />
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase">Reporting Frequency</label>
          <Select value={form.reporting_frequency} onValueChange={v => set('reporting_frequency', v)}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="quarterly">Quarterly</SelectItem>
              <SelectItem value="semi_annual">Semi-Annual</SelectItem>
              <SelectItem value="annual">Annual</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase">Status</label>
          <Select value={form.status} onValueChange={v => set('status', v)}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase">Program Officer Name</label>
          <Input className="mt-1" value={form.contact_name} onChange={e => set('contact_name', e.target.value)} placeholder="Contact at grantor org" />
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase">Program Officer Email</label>
          <Input className="mt-1" type="email" value={form.contact_email} onChange={e => set('contact_email', e.target.value)} placeholder="email@grantor.gov" />
        </div>

        {locations.length > 0 && (
          <div className="sm:col-span-2">
            <label className="text-xs font-semibold text-slate-500 uppercase">Covered Locations</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {locations.map(l => {
                const selected = (form.location_ids || []).includes(l.id);
                return (
                  <button key={l.id} type="button" onClick={() => toggleLocation(l.id)}
                    className={`text-xs px-3 py-1.5 rounded-full font-medium border transition-colors ${selected ? 'bg-amber-600 text-white border-amber-600' : 'bg-white text-slate-600 border-slate-200 hover:border-amber-400'}`}>
                    {l.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="sm:col-span-2">
          <label className="text-xs font-semibold text-slate-500 uppercase">Notes</label>
          <Textarea className="mt-1 resize-none h-20" value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Additional context, restrictions, or requirements..." />
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <Button variant="outline" className="flex-1" onClick={onCancel}>Cancel</Button>
        <Button
          className="flex-1 bg-amber-600 hover:bg-amber-700 text-white"
          onClick={handleSave}
          disabled={saving || !form.name || !form.funder_name || !form.start_date || !form.end_date}
        >
          {saving ? 'Saving…' : grant?.id ? 'Update Grant' : 'Create Grant'}
        </Button>
      </div>
    </div>
  );
}