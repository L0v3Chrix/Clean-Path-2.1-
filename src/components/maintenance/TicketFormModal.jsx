import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const CATEGORIES = ['plumbing','electrical','hvac','appliance','structural','pest_control','cleaning','safety','other'];
const PRIORITIES = ['low','medium','high','urgent'];

export default function TicketFormModal({ ticket, locations, user, onSaved, onClose }) {
  const [form, setForm] = useState(ticket || {
    title: '', description: '', category: 'other', priority: 'medium',
    location_id: '', location_name: '', room: '',
    assigned_to_name: '', resolution_notes: '', due_date: '', status: 'open',
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleLocationChange = (locId) => {
    const loc = locations.find(l => l.id === locId);
    set('location_id', locId);
    set('location_name', loc?.name || '');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        organization_id: user?.organization_id || 'default',
        submitted_by_name: form.submitted_by_name || user?.full_name || user?.email,
        submitted_by_id: form.submitted_by_id || user?.id,
        submitted_by_email: form.submitted_by_email || user?.email,
      };
      let saved;
      if (ticket?.id) {
        saved = await base44.entities.MaintenanceTicket.update(ticket.id, payload);
        onSaved({ ...ticket, ...payload }, false);
      } else {
        saved = await base44.entities.MaintenanceTicket.create(payload);
        onSaved(saved, true);
      }
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white">
          <h2 className="font-bold text-slate-900">{ticket ? 'Edit Ticket' : 'New Maintenance Ticket'}</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Issue Title *</label>
            <Input value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Leaking faucet in bathroom" required />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Description</label>
            <textarea
              value={form.description}
              onChange={e => set('description', e.target.value)}
              placeholder="Describe the issue in detail…"
              rows={3}
              className="w-full border rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Category *</label>
              <Select value={form.category} onValueChange={v => set('category', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => <SelectItem key={c} value={c} className="capitalize">{c.replace(/_/g, ' ')}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Priority *</label>
              <Select value={form.priority} onValueChange={v => set('priority', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map(p => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Location / House</label>
              <Select value={form.location_id} onValueChange={handleLocationChange}>
                <SelectTrigger><SelectValue placeholder="Select location" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>— None —</SelectItem>
                  {locations.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Room / Area</label>
              <Input value={form.room} onChange={e => set('room', e.target.value)} placeholder="e.g. Room 3, Kitchen" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Assign To</label>
              <Input value={form.assigned_to_name} onChange={e => set('assigned_to_name', e.target.value)} placeholder="Staff name" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Due Date</label>
              <Input type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)} />
            </div>
          </div>

          {ticket && (
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Status</label>
              <Select value={form.status} onValueChange={v => set('status', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {(ticket?.status === 'in_progress' || ticket?.status === 'completed' || form.status === 'completed') && (
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Resolution Notes</label>
              <textarea
                value={form.resolution_notes}
                onChange={e => set('resolution_notes', e.target.value)}
                placeholder="What was done to fix this?"
                rows={2}
                className="w-full border rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving} className="flex-1 bg-amber-600 hover:bg-amber-700 text-white gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {saving ? 'Saving…' : ticket ? 'Save Changes' : 'Submit Ticket'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}