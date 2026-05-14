import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { DollarSign, Plus, Trash2, Building2, TrendingUp, Edit2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const CATEGORIES = [
  { value: 'rent_mortgage', label: 'Rent / Mortgage' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'staffing', label: 'Staffing' },
  { value: 'supplies', label: 'Supplies' },
  { value: 'food', label: 'Food' },
  { value: 'transportation', label: 'Transportation' },
  { value: 'program', label: 'Program Costs' },
  { value: 'administrative', label: 'Administrative' },
  { value: 'other', label: 'Other' },
];

const CAT_COLORS = {
  rent_mortgage: '#6366F1', utilities: '#F97316', insurance: '#14B8A6',
  maintenance: '#EAB308', staffing: '#EC4899', supplies: '#10B981',
  food: '#B45309', transportation: '#8B5CF6', program: '#0EA5E9',
  administrative: '#64748B', other: '#9CA3AF',
};

function ExpenseForm({ locations, orgId, expense, onSave, onCancel }) {
  const [form, setForm] = useState(expense || {
    location_id: '', label: '', category: 'other', amount: '',
    frequency: 'monthly', due_day_of_month: '', vendor: '', auto_pay: false, notes: ''
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const payload = { ...form, organization_id: orgId, amount: Number(form.amount), due_day_of_month: form.due_day_of_month ? Number(form.due_day_of_month) : undefined };
    if (expense?.id) {
      await base44.entities.LocationExpense.update(expense.id, payload);
    } else {
      await base44.entities.LocationExpense.create(payload);
    }
    setSaving(false);
    onSave();
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
      <h3 className="font-bold text-slate-800">{expense?.id ? 'Edit Expense' : 'Add Expense'}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-slate-500">Location</label>
          <Select value={form.location_id} onValueChange={v => set('location_id', v)}>
            <SelectTrigger className="mt-1"><SelectValue placeholder="Select location" /></SelectTrigger>
            <SelectContent>{locations.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500">Label</label>
          <Input className="mt-1" value={form.label} onChange={e => set('label', e.target.value)} placeholder="e.g. Monthly Rent" />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500">Category</label>
          <Select value={form.category} onValueChange={v => set('category', v)}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>{CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500">Amount ($)</label>
          <Input className="mt-1" type="number" value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="0.00" />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500">Frequency</label>
          <Select value={form.frequency} onValueChange={v => set('frequency', v)}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {['monthly', 'weekly', 'quarterly', 'annual', 'one_time'].map(f => <SelectItem key={f} value={f}>{f.replace('_', ' ')}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500">Due Day of Month</label>
          <Input className="mt-1" type="number" min="1" max="31" value={form.due_day_of_month} onChange={e => set('due_day_of_month', e.target.value)} placeholder="e.g. 1" />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500">Vendor / Payee</label>
          <Input className="mt-1" value={form.vendor} onChange={e => set('vendor', e.target.value)} placeholder="e.g. City Power Co." />
        </div>
        <div className="flex items-center gap-2 mt-5">
          <input type="checkbox" id="autopay" checked={form.auto_pay} onChange={e => set('auto_pay', e.target.checked)} className="rounded" />
          <label htmlFor="autopay" className="text-sm text-slate-600">Auto-pay enabled</label>
        </div>
      </div>
      <div className="flex gap-2 pt-2">
        <Button variant="outline" className="flex-1" onClick={onCancel}>Cancel</Button>
        <Button className="flex-1 bg-amber-600 hover:bg-amber-700 text-white" onClick={handleSave} disabled={saving || !form.label || !form.amount || !form.location_id}>
          {saving ? 'Saving…' : 'Save Expense'}
        </Button>
      </div>
    </div>
  );
}

export default function FinanceManager() {
  const [expenses, setExpenses] = useState([]);
  const [locations, setLocations] = useState([]);
  const [orgId, setOrgId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [filterLoc, setFilterLoc] = useState('all');

  const load = async () => {
    const [orgs, locs, exps] = await Promise.all([
      base44.entities.Organization.list(),
      base44.entities.Location.filter({ status: 'active' }),
      base44.entities.LocationExpense.list('-created_date', 500),
    ]);
    if (orgs[0]) setOrgId(orgs[0].id);
    setLocations(locs);
    setExpenses(exps);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = filterLoc === 'all' ? expenses : expenses.filter(e => e.location_id === filterLoc);
  const active = filtered.filter(e => e.status !== 'cancelled');

  // Monthly equivalent
  const toMonthly = (e) => {
    if (e.frequency === 'weekly') return e.amount * 4.33;
    if (e.frequency === 'quarterly') return e.amount / 3;
    if (e.frequency === 'annual') return e.amount / 12;
    if (e.frequency === 'one_time') return 0;
    return e.amount;
  };
  const totalMonthly = active.reduce((s, e) => s + toMonthly(e), 0);

  // By category
  const byCat = {};
  active.forEach(e => { byCat[e.category] = (byCat[e.category] || 0) + toMonthly(e); });

  const handleDelete = async (id) => {
    await base44.entities.LocationExpense.delete(id);
    setExpenses(prev => prev.filter(e => e.id !== id));
  };

  if (loading) return <div className="flex items-center justify-center min-h-64"><div className="w-8 h-8 border-4 border-amber-200 border-t-amber-600 rounded-full animate-spin" /></div>;

  return (
    <div className="p-6 space-y-6" style={{ background: '#FAF6EF', minHeight: '100%' }}>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Finance & Expenses</h1>
          <p className="text-sm text-slate-500 mt-0.5">Track monthly bills and operating costs by location.</p>
        </div>
        <Button className="bg-amber-600 hover:bg-amber-700 text-white" onClick={() => { setEditingExpense(null); setShowForm(true); }}>
          <Plus className="w-4 h-4" /> Add Expense
        </Button>
      </div>

      {(showForm || editingExpense) && (
        <ExpenseForm
          locations={locations}
          orgId={orgId}
          expense={editingExpense}
          onSave={() => { setShowForm(false); setEditingExpense(null); load(); }}
          onCancel={() => { setShowForm(false); setEditingExpense(null); }}
        />
      )}

      {/* Summary row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-2xl p-4" style={{ background: '#F0E9DC', border: '1px solid #E0D5C5' }}>
          <p className="text-2xl font-black text-slate-900">${Math.round(totalMonthly).toLocaleString()}</p>
          <p className="text-sm text-slate-500">Monthly Total</p>
        </div>
        <div className="rounded-2xl p-4" style={{ background: '#F0E9DC', border: '1px solid #E0D5C5' }}>
          <p className="text-2xl font-black text-slate-900">${Math.round(totalMonthly * 12).toLocaleString()}</p>
          <p className="text-sm text-slate-500">Annual Est.</p>
        </div>
        <div className="rounded-2xl p-4" style={{ background: '#F0E9DC', border: '1px solid #E0D5C5' }}>
          <p className="text-2xl font-black text-slate-900">{active.length}</p>
          <p className="text-sm text-slate-500">Active Line Items</p>
        </div>
        <div className="rounded-2xl p-4" style={{ background: '#F0E9DC', border: '1px solid #E0D5C5' }}>
          <p className="text-2xl font-black text-slate-900">{locations.length}</p>
          <p className="text-sm text-slate-500">Locations</p>
        </div>
      </div>

      {/* Category breakdown */}
      <div className="rounded-2xl p-5" style={{ background: '#F0E9DC', border: '1px solid #E0D5C5' }}>
        <h2 className="font-bold text-slate-800 mb-3">By Category (Monthly)</h2>
        <div className="space-y-2">
          {Object.entries(byCat).sort(([,a],[,b]) => b-a).map(([cat, amt]) => {
            const pct = totalMonthly ? Math.round((amt / totalMonthly) * 100) : 0;
            const label = CATEGORIES.find(c => c.value === cat)?.label || cat;
            return (
              <div key={cat} className="flex items-center gap-3">
                <span className="text-xs font-medium text-slate-500 w-32 flex-shrink-0">{label}</span>
                <div className="flex-1 h-3 bg-white rounded-full overflow-hidden">
                  <div className="h-3 rounded-full" style={{ width: `${pct}%`, background: CAT_COLORS[cat] || '#9CA3AF' }} />
                </div>
                <span className="text-xs font-bold text-slate-700 w-20 text-right">${Math.round(amt).toLocaleString()}/mo</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-medium text-slate-600">Filter:</span>
        {[{ id: 'all', name: 'All Locations' }, ...locations].map(l => (
          <button key={l.id} onClick={() => setFilterLoc(l.id)}
            className={`text-xs px-3 py-1 rounded-full font-medium transition-colors ${filterLoc === l.id ? 'bg-amber-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-amber-50'}`}>
            {l.name}
          </button>
        ))}
      </div>

      {/* Expense list */}
      <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #E0D5C5' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: '#F0E9DC', borderBottom: '2px solid #E0D5C5' }}>
              {['Label', 'Location', 'Category', 'Amount', 'Frequency', 'Due', 'Vendor', ''].map(h => (
                <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-100">
            {active.length === 0 && (
              <tr><td colSpan={8} className="py-10 text-center text-slate-400 text-sm">No expenses yet. Add your first line item.</td></tr>
            )}
            {active.map(e => (
              <tr key={e.id} className="hover:bg-amber-50 transition-colors">
                <td className="py-3 px-4 font-medium text-slate-800">{e.label}</td>
                <td className="py-3 px-4 text-slate-500">{locations.find(l => l.id === e.location_id)?.name || '—'}</td>
                <td className="py-3 px-4">
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium text-white" style={{ background: CAT_COLORS[e.category] || '#9CA3AF' }}>
                    {CATEGORIES.find(c => c.value === e.category)?.label || e.category}
                  </span>
                </td>
                <td className="py-3 px-4 font-bold text-slate-900">${e.amount.toLocaleString()}</td>
                <td className="py-3 px-4 text-slate-500 capitalize">{e.frequency?.replace('_', ' ')}</td>
                <td className="py-3 px-4 text-slate-500">{e.due_day_of_month ? `Day ${e.due_day_of_month}` : '—'}</td>
                <td className="py-3 px-4 text-slate-500">{e.vendor || '—'}</td>
                <td className="py-3 px-4">
                  <div className="flex gap-1">
                    <button onClick={() => { setEditingExpense(e); setShowForm(false); }} className="p-1 rounded hover:bg-amber-100 text-amber-600"><Edit2 className="w-3.5 h-3.5" /></button>
                    <button onClick={() => handleDelete(e.id)} className="p-1 rounded hover:bg-red-50 text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* QuickBooks / Accounting note */}
      <div className="rounded-2xl p-5 border-2 border-dashed border-amber-200 bg-amber-50">
        <div className="flex items-start gap-3">
          <DollarSign className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-800">QuickBooks Integration</p>
            <p className="text-sm text-amber-700 mt-1">To connect QuickBooks Online for accounting, tax prep, and CPA reporting, go to <strong>Integrations</strong> and set up your QuickBooks OAuth connection. Expense data from this page can then be synced as bills to your QuickBooks account.</p>
          </div>
        </div>
      </div>
    </div>
  );
}