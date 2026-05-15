import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { base44 } from '@/api/base44Client';

const CATEGORIES = [
  { value: 'toiletries', label: 'Toiletries' },
  { value: 'cleaning_supplies', label: 'Cleaning Supplies' },
  { value: 'pantry', label: 'Pantry' },
  { value: 'paper_goods', label: 'Paper Goods' },
  { value: 'laundry', label: 'Laundry' },
  { value: 'first_aid', label: 'First Aid' },
  { value: 'other', label: 'Other' },
];

export default function InventoryRequestForm({ organizationId, locationId, items = [], user, onClose, onSaved }) {
  const [form, setForm] = useState({
    item_id: '',
    item_name: '',
    category: 'toiletries',
    quantity_requested: 1,
    urgency: 'medium',
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleItemSelect = (itemId) => {
    if (itemId === '__custom__') {
      set('item_id', '');
    } else {
      const found = items.find(i => i.id === itemId);
      if (found) setForm(f => ({ ...f, item_id: itemId, item_name: found.name, category: found.category }));
    }
  };

  const handleSave = async () => {
    if (!form.item_name) return;
    setSaving(true);
    await base44.entities.InventoryRequest.create({
      ...form,
      quantity_requested: Number(form.quantity_requested),
      organization_id: organizationId,
      location_id: locationId,
      requested_by_name: user?.full_name || 'Resident',
      requested_by_id: user?.id || '',
      status: 'pending',
    });
    setSaving(false);
    onSaved();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Request a Supply</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-slate-500 -mt-1">Let staff know what needs to be restocked.</p>
        <div className="space-y-4 py-2">
          <div>
            <Label>Select Existing Item (or type a new one)</Label>
            <Select onValueChange={handleItemSelect}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="— Choose an item —" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__custom__">✏️ Enter a different item…</SelectItem>
                {items.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Item Name *</Label>
            <Input value={form.item_name} onChange={e => set('item_name', e.target.value)} placeholder="e.g. Dish Soap" className="mt-1" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Category</Label>
              <Select value={form.category} onValueChange={v => set('category', v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Quantity Needed</Label>
              <Input type="number" min="1" value={form.quantity_requested} onChange={e => set('quantity_requested', e.target.value)} className="mt-1" />
            </div>
          </div>
          <div>
            <Label>Urgency</Label>
            <Select value={form.urgency} onValueChange={v => set('urgency', v)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low — whenever possible</SelectItem>
                <SelectItem value="medium">Medium — within a few days</SelectItem>
                <SelectItem value="high">High — needed soon</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Additional Notes</Label>
            <Textarea value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Any details for staff…" className="mt-1" rows={2} />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !form.item_name}>
            {saving ? 'Submitting…' : 'Submit Request'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}