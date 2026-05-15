import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { CheckCircle2, Clock, ShoppingCart, XCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';

const STATUS_CONFIG = {
  pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-800', Icon: Clock },
  ordered: { label: 'Ordered', color: 'bg-blue-100 text-blue-800', Icon: ShoppingCart },
  fulfilled: { label: 'Fulfilled', color: 'bg-green-100 text-green-800', Icon: CheckCircle2 },
  denied: { label: 'Denied', color: 'bg-red-100 text-red-800', Icon: XCircle },
};

const URGENCY_COLORS = {
  low: 'bg-slate-100 text-slate-600',
  medium: 'bg-amber-100 text-amber-700',
  high: 'bg-red-100 text-red-700',
};

export default function InventoryRequestsPanel({ requests, isAdmin, onRefresh }) {
  const [expanded, setExpanded] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);

  const updateStatus = async (req, status) => {
    setUpdatingId(req.id);
    await base44.entities.InventoryRequest.update(req.id, { status });
    setUpdatingId(null);
    onRefresh();
  };

  const updateStaffNotes = async (req, staffNotes) => {
    await base44.entities.InventoryRequest.update(req.id, { staff_notes: staffNotes });
    onRefresh();
  };

  if (requests.length === 0) {
    return <p className="text-sm text-slate-400 text-center py-6">No supply requests yet.</p>;
  }

  return (
    <div className="space-y-2">
      {requests.map(req => {
        const cfg = STATUS_CONFIG[req.status] || STATUS_CONFIG.pending;
        const Icon = cfg.Icon;
        const isOpen = expanded === req.id;

        return (
          <div key={req.id} className="border border-slate-200 rounded-xl overflow-hidden bg-white">
            <button
              onClick={() => setExpanded(isOpen ? null : req.id)}
              className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50 text-left"
            >
              <div className="flex items-center gap-3 min-w-0">
                <Icon className={`w-4 h-4 flex-shrink-0 ${req.status === 'fulfilled' ? 'text-green-500' : req.status === 'denied' ? 'text-red-400' : req.status === 'ordered' ? 'text-blue-500' : 'text-yellow-500'}`} />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{req.item_name}</p>
                  <p className="text-xs text-slate-400">{req.requested_by_name} · {req.created_date ? format(new Date(req.created_date), 'MMM d') : '—'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${URGENCY_COLORS[req.urgency] || URGENCY_COLORS.medium}`}>
                  {req.urgency}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>{cfg.label}</span>
                {isOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </div>
            </button>

            {isOpen && (
              <div className="px-4 pb-4 pt-1 border-t border-slate-100 bg-slate-50">
                <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 mb-3">
                  <div><span className="font-medium">Category:</span> {req.category?.replace('_', ' ')}</div>
                  <div><span className="font-medium">Quantity:</span> {req.quantity_requested}</div>
                  {req.notes && <div className="col-span-2"><span className="font-medium">Notes:</span> {req.notes}</div>}
                </div>
                {isAdmin && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Select value={req.status} onValueChange={v => updateStatus(req, v)} disabled={updatingId === req.id}>
                        <SelectTrigger className="h-8 text-xs w-36"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="ordered">Ordered</SelectItem>
                          <SelectItem value="fulfilled">Fulfilled</SelectItem>
                          <SelectItem value="denied">Denied</SelectItem>
                        </SelectContent>
                      </Select>
                      {updatingId === req.id && <span className="text-xs text-slate-400">Saving…</span>}
                    </div>
                    <StaffNoteInline req={req} onSave={updateStaffNotes} />
                  </div>
                )}
                {!isAdmin && req.staff_notes && (
                  <p className="text-xs text-slate-500 italic mt-1">Staff note: {req.staff_notes}</p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function StaffNoteInline({ req, onSave }) {
  const [note, setNote] = useState(req.staff_notes || '');
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    await onSave(req, note);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="flex gap-2">
      <Input value={note} onChange={e => setNote(e.target.value)} placeholder="Staff notes…" className="h-8 text-xs" />
      <Button size="sm" variant="outline" onClick={handleSave} className="h-8 text-xs">
        {saved ? 'Saved!' : 'Save Note'}
      </Button>
    </div>
  );
}