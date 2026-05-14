import { format, parseISO } from 'date-fns';
import { X, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ReceiptModal({ payment, resident, location, organizationName, onClose }) {
  const fmt = (n) => `$${Number(n).toFixed(2)}`;
  const receiptNo = payment.receipt_number || `RCP-${payment.id?.slice(-6).toUpperCase()}`;

  const handlePrint = () => {
    const printContent = document.getElementById('receipt-content');
    const win = window.open('', '_blank', 'width=480,height=640');
    win.document.write(`
      <html>
        <head>
          <title>Receipt ${receiptNo}</title>
          <style>
            body { font-family: 'Courier New', monospace; padding: 32px; font-size: 13px; color: #1a1a1a; }
            .center { text-align: center; }
            .bold { font-weight: bold; }
            .divider { border-top: 1px dashed #999; margin: 12px 0; }
            .row { display: flex; justify-content: space-between; margin: 6px 0; }
            .large { font-size: 20px; font-weight: bold; }
            .muted { color: #666; font-size: 11px; }
          </style>
        </head>
        <body>${printContent.innerHTML}</body>
      </html>
    `);
    win.document.close();
    win.focus();
    win.print();
    win.close();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <span className="font-semibold text-slate-800">Payment Receipt</span>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Receipt body */}
        <div className="p-6">
          <div id="receipt-content" className="font-mono text-sm">
            <div className="text-center mb-4">
              <p className="font-bold text-base">{organizationName || 'Recovery House'}</p>
              {location && <p className="text-xs text-slate-500">{location.name}</p>}
              {location?.address && <p className="text-xs text-slate-500">{location.address}</p>}
              <div className="border-t border-dashed border-slate-200 my-3" />
              <p className="text-xs text-slate-400">PAYMENT RECEIPT</p>
              <p className="text-xs text-slate-400">#{receiptNo}</p>
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Date:</span>
                <span className="font-medium">{format(parseISO(payment.payment_date), 'MMMM d, yyyy')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Resident:</span>
                <span className="font-medium">{resident?.first_name} {resident?.last_name}</span>
              </div>
              {payment.method && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Method:</span>
                  <span className="font-medium capitalize">{payment.method.replace('_', ' ')}</span>
                </div>
              )}
              {payment.reference_number && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Ref #:</span>
                  <span className="font-medium">{payment.reference_number}</span>
                </div>
              )}
              {payment.received_by_name && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Received by:</span>
                  <span className="font-medium">{payment.received_by_name}</span>
                </div>
              )}
              {payment.memo && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Memo:</span>
                  <span className="font-medium">{payment.memo}</span>
                </div>
              )}
            </div>

            <div className="border-t border-dashed border-slate-200 my-3" />
            <div className="flex justify-between items-center">
              <span className="text-sm font-bold text-slate-700">Amount Paid</span>
              <span className="text-xl font-black text-emerald-700">{fmt(payment.amount)}</span>
            </div>
            <div className="border-t border-dashed border-slate-200 my-3" />

            <p className="text-center text-xs text-slate-400 mt-2">
              Thank you — keep this receipt for your records.
            </p>
          </div>
        </div>

        <div className="flex gap-3 px-5 pb-5">
          <Button variant="outline" className="flex-1" onClick={onClose}>Close</Button>
          <Button className="flex-1 bg-emerald-700 hover:bg-emerald-800 text-white" onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-1.5" /> Print
          </Button>
        </div>
      </div>
    </div>
  );
}