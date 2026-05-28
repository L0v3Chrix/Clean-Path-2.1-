import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, ScanLine, Plus, Minus, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { appClient } from '@/services/appClient';

export default function QRScannerModal({ items, onClose, onUpdated }) {
  const scannerRef = useRef(null);
  const html5QrRef = useRef(null);
  const [scanning, setScanning] = useState(true);
  const [matchedItem, setMatchedItem] = useState(null);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [savedDelta, setSavedDelta] = useState(null);

  useEffect(() => {
    const qr = new Html5Qrcode('qr-reader');
    html5QrRef.current = qr;

    qr.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 250, height: 250 } },
      (decodedText) => {
        handleScan(decodedText);
      },
      () => {} // ignore scan failures
    ).catch(() => {
      setError('Camera access denied or unavailable. Please allow camera permissions and try again.');
      setScanning(false);
    });

    return () => {
      qr.isRunning() && qr.stop().catch(() => {});
    };
  }, []);

  const handleScan = (text) => {
    if (!scanning) return;
    // Match by item id, item name (case-insensitive), or a JSON payload {id: "..."}
    let query = text.trim();
    let found = null;

    try {
      const parsed = JSON.parse(query);
      if (parsed.id) found = items.find(i => i.id === parsed.id);
      if (!found && parsed.name) found = items.find(i => i.name.toLowerCase() === parsed.name.toLowerCase());
    } catch {
      // plain text — match by id or name
      found = items.find(i => i.id === query) ||
              items.find(i => i.name.toLowerCase() === query.toLowerCase());
    }

    if (found) {
      html5QrRef.current?.isRunning() && html5QrRef.current.stop().catch(() => {});
      setMatchedItem(found);
      setScanning(false);
    } else {
      setError(`No item matched: "${text.slice(0, 40)}". Try scanning again.`);
    }
  };

  const adjust = async (delta) => {
    setSaving(true);
    const item = matchedItem;
    const newQty = Math.max(0, (item.current_quantity || 0) + delta);
    const threshold = item.low_stock_threshold || 2;
    const status = newQty === 0 ? 'out_of_stock' : newQty <= threshold ? 'low_stock' : 'in_stock';
    await appClient.entities.HouseInventoryItem.update(item.id, { current_quantity: newQty, status });
    setSavedDelta(delta);
    setSaving(false);
    onUpdated({ ...item, current_quantity: newQty, status });
  };

  const resetScan = () => {
    setMatchedItem(null);
    setSavedDelta(null);
    setError(null);
    setScanning(true);
    const qr = new Html5Qrcode('qr-reader');
    html5QrRef.current = qr;
    qr.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 250, height: 250 } },
      handleScan,
      () => {}
    ).catch(() => setError('Camera unavailable.'));
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <ScanLine className="w-5 h-5 text-amber-600" />
            <h2 className="text-base font-bold text-slate-800">Scan Item QR Code</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scanner viewport */}
        <div className="relative bg-black">
          <div id="qr-reader" className="w-full" style={{ minHeight: 280 }} />
          {scanning && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-52 h-52 border-2 border-amber-400 rounded-xl opacity-80 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" />
            </div>
          )}
        </div>

        {/* Status / result */}
        <div className="px-5 py-4 space-y-3">
          {error && !matchedItem && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3">
              <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-700">{error}</p>
            </div>
          )}

          {scanning && !error && (
            <p className="text-xs text-slate-400 text-center">Point camera at an item QR code…</p>
          )}

          {matchedItem && savedDelta === null && (
            <div className="space-y-3">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                <p className="text-xs text-amber-600 font-medium mb-0.5">Item found</p>
                <p className="text-sm font-bold text-slate-800">{matchedItem.name}</p>
                <p className="text-xs text-slate-500">Current qty: <strong>{matchedItem.current_quantity ?? 0}</strong> {matchedItem.unit || 'units'}</p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 gap-1.5 border-red-200 text-red-600 hover:bg-red-50"
                  disabled={saving || matchedItem.current_quantity <= 0}
                  onClick={() => adjust(-1)}
                >
                  <Minus className="w-4 h-4" /> Remove 1
                </Button>
                <Button
                  className="flex-1 gap-1.5 bg-amber-500 hover:bg-amber-600 text-white"
                  disabled={saving}
                  onClick={() => adjust(1)}
                >
                  <Plus className="w-4 h-4" /> Add 1
                </Button>
              </div>
              <button onClick={resetScan} className="w-full text-xs text-slate-400 hover:text-slate-600 text-center">
                Scan a different item
              </button>
            </div>
          )}

          {savedDelta !== null && (
            <div className="space-y-3">
              <div className="flex flex-col items-center gap-2 py-2">
                <CheckCircle2 className="w-10 h-10 text-green-500" />
                <p className="text-sm font-semibold text-slate-800">
                  {savedDelta > 0 ? 'Added 1' : 'Removed 1'} — {matchedItem.name}
                </p>
                <p className="text-xs text-slate-400">
                  New qty: {matchedItem.current_quantity + savedDelta} {matchedItem.unit || 'units'}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={resetScan}>Scan Another</Button>
                <Button className="flex-1 bg-amber-500 hover:bg-amber-600 text-white" onClick={onClose}>Done</Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}