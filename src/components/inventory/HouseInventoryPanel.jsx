import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Package, Plus, AlertTriangle, Search, Pencil, Trash2,
  CheckCircle2, MinusCircle, XCircle, RefreshCw, ScanLine
} from 'lucide-react';
import InventoryItemForm from './InventoryItemForm';
import QRScannerModal from './QRScannerModal';

const CATEGORY_LABELS = {
  toiletries: 'Toiletries',
  cleaning_supplies: 'Cleaning Supplies',
  pantry: 'Pantry',
  paper_goods: 'Paper Goods',
  laundry: 'Laundry',
  first_aid: 'First Aid',
  other: 'Other',
};

const CATEGORY_COLORS = {
  toiletries: 'bg-blue-100 text-blue-700',
  cleaning_supplies: 'bg-green-100 text-green-700',
  pantry: 'bg-amber-100 text-amber-700',
  paper_goods: 'bg-slate-100 text-slate-600',
  laundry: 'bg-purple-100 text-purple-700',
  first_aid: 'bg-red-100 text-red-700',
  other: 'bg-slate-100 text-slate-500',
};

const STATUS_CONFIG = {
  in_stock: { label: 'In Stock', color: 'bg-green-100 text-green-700', Icon: CheckCircle2 },
  low_stock: { label: 'Low Stock', color: 'bg-amber-100 text-amber-700', Icon: AlertTriangle },
  out_of_stock: { label: 'Out of Stock', color: 'bg-red-100 text-red-700', Icon: XCircle },
};

export default function HouseInventoryPanel({ organizationId, locationId }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [updatingQty, setUpdatingQty] = useState({});
  const [showScanner, setShowScanner] = useState(false);

  const load = async () => {
    setLoading(true);
    const data = await base44.entities.HouseInventoryItem.filter({ organization_id: organizationId });
    setItems(data);
    setLoading(false);
  };

  useEffect(() => { if (organizationId) load(); }, [organizationId]);

  const handleDelete = async (id) => {
    if (!confirm('Remove this item from inventory?')) return;
    await base44.entities.HouseInventoryItem.delete(id);
    load();
  };

  const adjustQty = async (item, delta) => {
    const newQty = Math.max(0, (item.current_quantity || 0) + delta);
    const threshold = item.low_stock_threshold || 2;
    const status = newQty === 0 ? 'out_of_stock' : newQty <= threshold ? 'low_stock' : 'in_stock';
    setUpdatingQty(u => ({ ...u, [item.id]: true }));
    await base44.entities.HouseInventoryItem.update(item.id, { current_quantity: newQty, status });
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, current_quantity: newQty, status } : i));
    setUpdatingQty(u => ({ ...u, [item.id]: false }));
  };

  const filtered = items.filter(i => {
    const matchSearch = i.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCat === 'all' || i.category === filterCat;
    const matchStatus = filterStatus === 'all' || i.status === filterStatus;
    return matchSearch && matchCat && matchStatus;
  });

  const alertCount = items.filter(i => i.status === 'low_stock' || i.status === 'out_of_stock').length;

  return (
    <div className="space-y-4">
      {/* Alert banner */}
      {alertCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-800">{alertCount} item{alertCount > 1 ? 's' : ''} need attention</p>
            <p className="text-xs text-amber-600">Low stock or out of stock — consider restocking soon.</p>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search items…" className="pl-9" />
        </div>
        <Select value={filterCat} onValueChange={setFilterCat}>
          <SelectTrigger className="w-44"><SelectValue placeholder="All Categories" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {Object.entries(CATEGORY_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40"><SelectValue placeholder="All Statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="in_stock">In Stock</SelectItem>
            <SelectItem value="low_stock">Low Stock</SelectItem>
            <SelectItem value="out_of_stock">Out of Stock</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={load} title="Refresh"><RefreshCw className="w-4 h-4" /></Button>
        <Button variant="outline" onClick={() => setShowScanner(true)} className="gap-1.5">
          <ScanLine className="w-4 h-4" /> Scan QR
        </Button>
        <Button onClick={() => { setEditItem(null); setShowForm(true); }} className="gap-1.5">
          <Plus className="w-4 h-4" /> Add Item
        </Button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-2">{[1,2,3,4].map(i => <div key={i} className="h-14 bg-slate-100 rounded-xl animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <Package className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No inventory items found.</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => setShowForm(true)}>Add first item</Button>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(item => {
            const cfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.in_stock;
            const Icon = cfg.Icon;
            return (
              <div key={item.id} className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-4 py-3 hover:shadow-sm transition-shadow group">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-slate-800">{item.name}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[item.category] || 'bg-slate-100 text-slate-500'}`}>
                      {CATEGORY_LABELS[item.category] || item.category}
                    </span>
                    <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>
                      <Icon className="w-3 h-3" /> {cfg.label}
                    </span>
                  </div>
                  {item.notes && <p className="text-xs text-slate-400 mt-0.5 truncate">{item.notes}</p>}
                </div>

                {/* Qty adjuster */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => adjustQty(item, -1)}
                    disabled={updatingQty[item.id] || item.current_quantity <= 0}
                    className="w-7 h-7 rounded-full border border-slate-200 flex items-center justify-center hover:bg-slate-100 disabled:opacity-40 transition-colors"
                  >
                    <MinusCircle className="w-4 h-4 text-slate-500" />
                  </button>
                  <span className="text-sm font-bold text-slate-700 w-8 text-center">
                    {updatingQty[item.id] ? '…' : item.current_quantity ?? 0}
                  </span>
                  <button
                    onClick={() => adjustQty(item, 1)}
                    disabled={updatingQty[item.id]}
                    className="w-7 h-7 rounded-full border border-slate-200 flex items-center justify-center hover:bg-slate-100 disabled:opacity-40 transition-colors"
                  >
                    <Plus className="w-4 h-4 text-slate-500" />
                  </button>
                  <span className="text-xs text-slate-400 ml-1">{item.unit || 'units'}</span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => { setEditItem(item); setShowForm(true); }} className="p-1.5 rounded hover:bg-slate-100 text-slate-500">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleDelete(item.id)} className="p-1.5 rounded hover:bg-red-100 text-red-400">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showScanner && (
        <QRScannerModal
          items={items}
          onClose={() => setShowScanner(false)}
          onUpdated={(updatedItem) => {
            setItems(prev => prev.map(i => i.id === updatedItem.id ? updatedItem : i));
          }}
        />
      )}

      {showForm && (
        <InventoryItemForm
          item={editItem}
          organizationId={organizationId}
          locationId={locationId}
          onClose={() => { setShowForm(false); setEditItem(null); }}
          onSaved={() => { setShowForm(false); setEditItem(null); load(); }}
        />
      )}
    </div>
  );
}