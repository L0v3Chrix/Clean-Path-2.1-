import { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import {
  AlertTriangle, Package, ShoppingCart, CheckCircle2, Clock,
  X, ChevronDown, ChevronRight, Pill, RotateCcw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format, parseISO } from 'date-fns';

// ─── Config ───────────────────────────────────────────────────────────────────
const STATUS_CFG = {
  pending:   { label: 'Pending',   color: '#D97706', bg: '#FEF3C7' },
  ordered:   { label: 'Ordered',   color: '#0891B2', bg: '#CFFAFE' },
  received:  { label: 'Received',  color: '#059669', bg: '#D1FAE5' },
  cancelled: { label: 'Cancelled', color: '#9CA3AF', bg: '#F3F4F6' },
};

const URGENCY_CFG = {
  routine:  { label: 'Routine',  color: '#78716C', bg: '#F5F5F4' },
  urgent:   { label: 'Urgent',   color: '#D97706', bg: '#FEF3C7' },
  critical: { label: 'Critical', color: '#DC2626', bg: '#FEE2E2' },
};

function stockLevel(med) {
  if (med.current_quantity == null || med.low_stock_threshold == null) return 'unknown';
  if (med.current_quantity === 0) return 'out';
  if (med.current_quantity <= med.low_stock_threshold) return 'low';
  return 'ok';
}

// ─── Quick Order Modal ────────────────────────────────────────────────────────
function QuickOrderModal({ med, resident, onSave, onClose }) {
  const [form, setForm] = useState({
    medication_id: med.id,
    resident_id: med.resident_id,
    organization_id: med.organization_id || '',
    medication_name: `${med.name} ${med.dosage}`,
    dosage: med.dosage,
    quantity_requested: med.reorder_quantity || med.low_stock_threshold || 30,
    quantity_unit: med.quantity_unit || 'tablets',
    pharmacy: med.pharmacy || '',
    rx_number: med.rx_number || '',
    requested_by_name: '',
    urgency: med.current_quantity === 0 ? 'critical' : 'urgent',
    status: 'pending',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4">
      <div className="rounded-2xl w-full max-w-md shadow-2xl overflow-hidden" style={{ background: '#FAF6EF' }}>
        <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: '#E0D5C5' }}>
          <div>
            <h3 className="font-bold" style={{ color: '#1C1917' }}>Quick Order</h3>
            <p className="text-xs mt-0.5" style={{ color: '#78716C' }}>{med.name} · {med.dosage}</p>
          </div>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <form onSubmit={async e => {
          e.preventDefault();
          setSaving(true);
          await base44.entities.ProcurementRequest.create(form);
          onSave();
          setSaving(false);
        }} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Quantity to Order *</Label>
              <Input type="number" min="1" value={form.quantity_requested}
                onChange={e => set('quantity_requested', parseFloat(e.target.value))} required />
            </div>
            <div className="space-y-1.5">
              <Label>Unit</Label>
              <Input value={form.quantity_unit} onChange={e => set('quantity_unit', e.target.value)} placeholder="tablets" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Pharmacy</Label>
            <Input placeholder="Pharmacy name" value={form.pharmacy} onChange={e => set('pharmacy', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Rx Number</Label>
              <Input value={form.rx_number} onChange={e => set('rx_number', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Urgency</Label>
              <Select value={form.urgency} onValueChange={v => set('urgency', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="routine">Routine</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Requested By</Label>
            <Input placeholder="Staff name" value={form.requested_by_name} onChange={e => set('requested_by_name', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea placeholder="Any special instructions…" value={form.notes}
              onChange={e => set('notes', e.target.value)} rows={2} />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving} style={{ background: '#B45309', color: '#fff' }}>
              {saving ? 'Submitting…' : 'Submit Order'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Receive Modal ────────────────────────────────────────────────────────────
function ReceiveModal({ request, onSave, onClose }) {
  const [qty, setQty] = useState(request.quantity_requested);
  const [saving, setSaving] = useState(false);

  return (
    <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4">
      <div className="rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden" style={{ background: '#FAF6EF' }}>
        <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: '#E0D5C5' }}>
          <h3 className="font-bold" style={{ color: '#1C1917' }}>Mark as Received</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <form onSubmit={async e => {
          e.preventDefault();
          setSaving(true);
          // Update request status and update medication stock
          await Promise.all([
            base44.entities.ProcurementRequest.update(request.id, {
              status: 'received',
              received_date: new Date().toISOString().split('T')[0],
              quantity_received: qty,
            }),
            base44.entities.Medication.update(request.medication_id, {
              current_quantity: qty,
            }),
          ]);
          onSave();
          setSaving(false);
        }} className="p-5 space-y-4">
          <div className="space-y-1.5">
            <Label>Quantity Received</Label>
            <Input type="number" min="0" value={qty} onChange={e => setQty(parseFloat(e.target.value))} required />
          </div>
          <p className="text-xs" style={{ color: '#78716C' }}>
            This will update the medication's current stock to this quantity.
          </p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving} style={{ background: '#059669', color: '#fff' }}>
              {saving ? 'Saving…' : 'Confirm Receipt'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Inventory Card ───────────────────────────────────────────────────────────
function InventoryCard({ med, residentName, onOrder, onUpdateQty }) {
  const [editQty, setEditQty] = useState(false);
  const [qty, setQty] = useState(med.current_quantity ?? '');
  const [saving, setSaving] = useState(false);
  const level = stockLevel(med);

  const levelCfg = {
    out:     { color: '#DC2626', bg: '#FEE2E2', border: '#FECACA', label: 'Out of Stock' },
    low:     { color: '#D97706', bg: '#FEF3C7', border: '#FDE68A', label: 'Low Stock' },
    ok:      { color: '#059669', bg: '#D1FAE5', border: '#A7F3D0', label: 'In Stock' },
    unknown: { color: '#78716C', bg: '#F5F5F4', border: '#E5E7EB', label: 'Not Tracked' },
  }[level];

  const pct = (level === 'ok' || level === 'low') && med.low_stock_threshold
    ? Math.min(100, Math.round((med.current_quantity / (med.low_stock_threshold * 3)) * 100))
    : null;

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${levelCfg.border}`, background: level === 'out' ? '#FFF5F5' : '#FEFCF8' }}>
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: levelCfg.bg }}>
            {level === 'out' || level === 'low'
              ? <AlertTriangle className="w-4 h-4" style={{ color: levelCfg.color }} />
              : <Pill className="w-4 h-4" style={{ color: levelCfg.color }} />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-sm" style={{ color: '#1C1917' }}>{med.name}</span>
              <span className="text-xs" style={{ color: '#78716C' }}>{med.dosage}</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{ background: levelCfg.bg, color: levelCfg.color }}>{levelCfg.label}</span>
            </div>
            {residentName && <p className="text-xs mt-0.5" style={{ color: '#78716C' }}>Resident: {residentName}</p>}
            {med.pharmacy && <p className="text-xs" style={{ color: '#78716C' }}>Pharmacy: {med.pharmacy}</p>}

            {/* Stock level bar */}
            {med.current_quantity != null && (
              <div className="mt-2 space-y-1">
                <div className="flex items-center gap-2">
                  {editQty ? (
                    <form className="flex items-center gap-1.5" onSubmit={async e => {
                      e.preventDefault();
                      setSaving(true);
                      await base44.entities.Medication.update(med.id, { current_quantity: parseFloat(qty) });
                      setEditQty(false);
                      setSaving(false);
                      onUpdateQty();
                    }}>
                      <Input type="number" min="0" value={qty} onChange={e => setQty(e.target.value)}
                        className="h-7 w-20 text-xs" />
                      <span className="text-xs" style={{ color: '#78716C' }}>{med.quantity_unit || 'units'}</span>
                      <button type="submit" disabled={saving}
                        className="text-xs px-2 py-0.5 rounded font-medium"
                        style={{ background: '#059669', color: '#fff' }}>{saving ? '…' : '✓'}</button>
                      <button type="button" onClick={() => setEditQty(false)} className="text-xs" style={{ color: '#78716C' }}>✕</button>
                    </form>
                  ) : (
                    <button onClick={() => setEditQty(true)}
                      className="text-sm font-bold hover:underline" style={{ color: levelCfg.color }}>
                      {med.current_quantity} {med.quantity_unit || 'units'}
                    </button>
                  )}
                  {med.low_stock_threshold != null && !editQty && (
                    <span className="text-xs" style={{ color: '#A09080' }}>
                      · threshold: {med.low_stock_threshold}
                    </span>
                  )}
                </div>
                {pct != null && (
                  <div className="h-1.5 rounded-full overflow-hidden w-full" style={{ background: '#E0D5C5' }}>
                    <div className="h-full rounded-full transition-all" style={{
                      width: `${pct}%`,
                      background: level === 'out' ? '#DC2626' : level === 'low' ? '#D97706' : '#059669',
                    }} />
                  </div>
                )}
              </div>
            )}
          </div>
          <Button size="sm" onClick={() => onOrder(med)}
            className="flex-shrink-0 gap-1 text-xs"
            style={{ background: level === 'out' ? '#DC2626' : '#B45309', color: '#fff' }}>
            <ShoppingCart className="w-3.5 h-3.5" />
            Order
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Procurement Table ────────────────────────────────────────────────────────
function ProcurementTable({ requests, residents, onReceive, onCancel, onRefresh }) {
  const [filter, setFilter] = useState('pending');

  const filtered = requests.filter(r => filter === 'all' || r.status === filter);
  const residentMap = Object.fromEntries(residents.map(r => [r.id, `${r.first_name} ${r.last_name}`]));

  return (
    <div className="space-y-3">
      <div className="flex rounded-xl overflow-hidden border text-xs" style={{ borderColor: '#E0D5C5' }}>
        {[['pending', 'Pending'], ['ordered', 'Ordered'], ['received', 'Received'], ['all', 'All']].map(([v, l]) => (
          <button key={v} onClick={() => setFilter(v)}
            className="flex-1 py-2 font-medium transition-colors"
            style={filter === v ? { background: '#1C1917', color: '#F5EFE6' } : { background: '#F0E9DC', color: '#78716C' }}>
            {l}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-center py-8 text-sm" style={{ color: '#A09080' }}>No {filter === 'all' ? '' : filter} orders.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map(req => {
            const scfg = STATUS_CFG[req.status] || STATUS_CFG.pending;
            const ucfg = URGENCY_CFG[req.urgency] || URGENCY_CFG.routine;
            return (
              <div key={req.id} className="rounded-xl p-3 flex items-center gap-3"
                style={{ background: '#FEFCF8', border: '1px solid #E0D5C5' }}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold" style={{ color: '#1C1917' }}>{req.medication_name}</span>
                    <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full"
                      style={{ background: scfg.bg, color: scfg.color }}>{scfg.label}</span>
                    <span className="text-xs font-medium px-1.5 py-0.5 rounded-full"
                      style={{ background: ucfg.bg, color: ucfg.color }}>{ucfg.label}</span>
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: '#78716C' }}>
                    {req.quantity_requested} {req.quantity_unit}
                    {residentMap[req.resident_id] && ` · ${residentMap[req.resident_id]}`}
                    {req.pharmacy && ` · ${req.pharmacy}`}
                  </p>
                  <p className="text-xs" style={{ color: '#A09080' }}>
                    {req.created_date ? format(parseISO(req.created_date), 'MMM d, yyyy') : ''}
                    {req.requested_by_name && ` · ${req.requested_by_name}`}
                  </p>
                </div>
                <div className="flex gap-1.5 flex-shrink-0">
                  {(req.status === 'pending' || req.status === 'ordered') && (
                    <button onClick={() => onReceive(req)}
                      className="text-xs px-2.5 py-1 rounded-lg font-medium"
                      style={{ background: '#059669', color: '#fff' }}>
                      Receive
                    </button>
                  )}
                  {req.status === 'pending' && (
                    <button onClick={async () => {
                      await base44.entities.ProcurementRequest.update(req.id, { status: 'ordered' });
                      onRefresh();
                    }} className="text-xs px-2.5 py-1 rounded-lg font-medium"
                      style={{ background: '#0891B2', color: '#fff' }}>
                      Mark Ordered
                    </button>
                  )}
                  {req.status !== 'received' && req.status !== 'cancelled' && (
                    <button onClick={() => onCancel(req.id)}
                      className="text-xs px-2.5 py-1 rounded-lg font-medium"
                      style={{ background: '#F3F4F6', color: '#6B7280' }}>
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function MedicationInventory({ organizationId }) {
  const [medications, setMedications] = useState([]);
  const [requests, setRequests] = useState([]);
  const [residents, setResidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('alerts');
  const [orderTarget, setOrderTarget] = useState(null);
  const [receiveTarget, setReceiveTarget] = useState(null);

  const load = async () => {
    setLoading(true);
    const [meds, reqs, res] = await Promise.all([
      organizationId
        ? base44.entities.Medication.filter({ organization_id: organizationId }, 'name', 500)
        : base44.entities.Medication.list('name', 500),
      organizationId
        ? base44.entities.ProcurementRequest.filter({ organization_id: organizationId }, '-created_date', 200)
        : base44.entities.ProcurementRequest.list('-created_date', 200),
      organizationId
        ? base44.entities.Resident.filter({ organization_id: organizationId }, 'first_name', 200)
        : base44.entities.Resident.list('first_name', 200),
    ]);
    setMedications(meds);
    setRequests(reqs);
    setResidents(res);
    setLoading(false);
  };

  useEffect(() => { load(); }, [organizationId]);

  const residentMap = Object.fromEntries(residents.map(r => [r.id, `${r.first_name} ${r.last_name}`]));

  const alertMeds = useMemo(() =>
    medications.filter(m => m.status === 'active' && (stockLevel(m) === 'low' || stockLevel(m) === 'out'))
      .sort((a, b) => (stockLevel(a) === 'out' ? -1 : 1)),
    [medications]
  );

  const trackedMeds = useMemo(() =>
    medications.filter(m => m.current_quantity != null && m.status === 'active'),
    [medications]
  );

  const pendingOrders = requests.filter(r => r.status === 'pending' || r.status === 'ordered').length;

  const cancelRequest = async (id) => {
    if (!confirm('Cancel this order?')) return;
    await base44.entities.ProcurementRequest.update(id, { status: 'cancelled' });
    load();
  };

  return (
    <div className="space-y-4">
      {/* KPI strip */}
      {!loading && (
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl p-3 text-center" style={{ background: alertMeds.filter(m => stockLevel(m) === 'out').length > 0 ? '#FEE2E2' : '#F0E9DC', border: '1px solid #E0D5C5' }}>
            <p className="text-2xl font-black" style={{ color: '#DC2626' }}>
              {alertMeds.filter(m => stockLevel(m) === 'out').length}
            </p>
            <p className="text-xs" style={{ color: '#78716C' }}>Out of Stock</p>
          </div>
          <div className="rounded-xl p-3 text-center" style={{ background: alertMeds.filter(m => stockLevel(m) === 'low').length > 0 ? '#FEF3C7' : '#F0E9DC', border: '1px solid #E0D5C5' }}>
            <p className="text-2xl font-black" style={{ color: '#D97706' }}>
              {alertMeds.filter(m => stockLevel(m) === 'low').length}
            </p>
            <p className="text-xs" style={{ color: '#78716C' }}>Low Stock</p>
          </div>
          <div className="rounded-xl p-3 text-center" style={{ background: pendingOrders > 0 ? '#CFFAFE' : '#F0E9DC', border: '1px solid #E0D5C5' }}>
            <p className="text-2xl font-black" style={{ color: '#0891B2' }}>{pendingOrders}</p>
            <p className="text-xs" style={{ color: '#78716C' }}>Open Orders</p>
          </div>
        </div>
      )}

      {/* Tab switcher */}
      <div className="flex rounded-xl overflow-hidden border text-xs" style={{ borderColor: '#E0D5C5' }}>
        {[
          ['alerts', `Alerts${alertMeds.length > 0 ? ` (${alertMeds.length})` : ''}`],
          ['all', `All Tracked (${trackedMeds.length})`],
          ['orders', `Orders${pendingOrders > 0 ? ` (${pendingOrders})` : ''}`],
        ].map(([v, l]) => (
          <button key={v} onClick={() => setTab(v)}
            className="flex-1 py-2 font-medium transition-colors"
            style={tab === v ? { background: '#1C1917', color: '#F5EFE6' } : { background: '#F0E9DC', color: '#78716C' }}>
            {l}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-20 rounded-xl animate-pulse" style={{ background: '#E5DDD0' }} />)}</div>
      ) : (
        <>
          {tab === 'alerts' && (
            alertMeds.length === 0 ? (
              <div className="text-center py-12 rounded-2xl" style={{ background: '#F0FDF4', border: '1px solid #A7F3D0' }}>
                <CheckCircle2 className="w-9 h-9 mx-auto mb-2" style={{ color: '#059669' }} />
                <p className="font-semibold" style={{ color: '#1C1917' }}>All stocked up!</p>
                <p className="text-sm mt-1" style={{ color: '#78716C' }}>No low-stock or out-of-stock medications.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {alertMeds.map(med => (
                  <InventoryCard key={med.id} med={med}
                    residentName={residentMap[med.resident_id]}
                    onOrder={setOrderTarget}
                    onUpdateQty={load} />
                ))}
              </div>
            )
          )}

          {tab === 'all' && (
            trackedMeds.length === 0 ? (
              <div className="text-center py-12 rounded-2xl" style={{ background: '#F0E9DC', border: '1px dashed #C9B99A' }}>
                <Package className="w-9 h-9 mx-auto mb-2" style={{ color: '#C9A227' }} />
                <p className="font-semibold" style={{ color: '#1C1917' }}>No inventory tracked</p>
                <p className="text-sm mt-1" style={{ color: '#78716C' }}>Set a current quantity and threshold on any medication to enable tracking.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {trackedMeds.map(med => (
                  <InventoryCard key={med.id} med={med}
                    residentName={residentMap[med.resident_id]}
                    onOrder={setOrderTarget}
                    onUpdateQty={load} />
                ))}
              </div>
            )
          )}

          {tab === 'orders' && (
            <ProcurementTable
              requests={requests}
              residents={residents}
              onReceive={setReceiveTarget}
              onCancel={cancelRequest}
              onRefresh={load}
            />
          )}
        </>
      )}

      {orderTarget && (
        <QuickOrderModal
          med={orderTarget}
          onSave={() => { setOrderTarget(null); load(); }}
          onClose={() => setOrderTarget(null)}
        />
      )}
      {receiveTarget && (
        <ReceiveModal
          request={receiveTarget}
          onSave={() => { setReceiveTarget(null); load(); }}
          onClose={() => setReceiveTarget(null)}
        />
      )}
    </div>
  );
}