import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { appClient } from '@/services/appClient';

const CATEGORIES = [
  { value: 'toiletries', label: 'Toiletries' },
  { value: 'cleaning_supplies', label: 'Cleaning Supplies' },
  { value: 'pantry', label: 'Pantry' },
  { value: 'paper_goods', label: 'Paper Goods' },
  { value: 'laundry', label: 'Laundry' },
  { value: 'first_aid', label: 'First Aid' },
  { value: 'other', label: 'Other' },
];

export default function InventoryItemForm({ item, organizationId, locationId, onClose, onSaved }) {
  const isEdit = !!item;
  const [form, setForm] = useState({
    name: item?.name || '',
    category: item?.category || 'toiletries',
    unit: item?.unit || 'units',
    current_quantity: item?.current_quantity ?? 0,
    low_stock_threshold: item?.low_stock_threshold ?? 2,
    reorder_quantity: item?.reorder_quantity ?? 5,
    notes: item?.notes || '',
  });
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.name) return;
    setSaving(true);
    const qty = Number(form.current_quantity);
    const threshold = Number(form.low_stock_threshold);
    const status = qty === 0 ? 'out_of_stock' : qty <= threshold ? 'low_stock' : 'in_stock';
    const data = { ...form, current_quantity: qty, low_stock_threshold: threshold, reorder_quantity: Number(form.reorder_quantity), status, organization_id: organizationId, location_id: locationId };
    if (isEdit) {
      await appClient.entities.HouseInventoryItem.update(item.id, data);
    } else {
      await appClient.entities.HouseInventoryItem.create(data);
    }
    setSaving(false);
    onSaved();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Item' : 'Add Inventory Item'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Item Name *</Label>
            <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Hand Soap" className="mt-1" />
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
              <Label>Unit</Label>
              <Input value={form.unit} onChange={e => set('unit', e.target.value)} placeholder="bottles, rolls…" className="mt-1" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Current Qty</Label>
              <Input type="number" min="0" value={form.current_quantity} onChange={e => set('current_quantity', e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Low Stock At</Label>
              <Input type="number" min="0" value={form.low_stock_threshold} onChange={e => set('low_stock_threshold', e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Reorder Qty</Label>
              <Input type="number" min="1" value={form.reorder_quantity} onChange={e => set('reorder_quantity', e.target.value)} className="mt-1" />
            </div>
          </div>
          <div>
            <Label>Notes</Label>
            <Input value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Optional notes" className="mt-1" />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !form.name}>
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Item'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}