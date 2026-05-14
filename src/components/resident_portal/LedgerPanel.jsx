import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { DollarSign, AlertCircle, CheckCircle2, Clock, Printer } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import ReceiptModal from './ReceiptModal';

const FEE_TYPE_LABELS = {
  program_fee: 'Program Fee',
  utility: 'Utility',
  deposit: 'Deposit',
  late_fee: 'Late Fee',
  other: 'Other',
};

const STATUS_STYLES = {
  unpaid:  { bg: 'bg-red-50',    text: 'text-red-600',    border: 'border-red-100',    label: 'Unpaid'  },
  partial: { bg: 'bg-amber-50',  text: 'text-amber-600',  border: 'border-amber-100',  label: 'Partial' },
  paid:    { bg: 'bg-green-50',  text: 'text-green-600',  border: 'border-green-100',  label: 'Paid'    },
  waived:  { bg: 'bg-slate-50',  text: 'text-slate-400',  border: 'border-slate-100',  label: 'Waived'  },
};

export default function LedgerPanel({ resident, location, organizationName }) {
  const [fees, setFees] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('balance');
  const [receiptPayment, setReceiptPayment] = useState(null);

  useEffect(() => {
    if (!resident?.id) { setLoading(false); return; }
    Promise.all([
      base44.entities.ResidentFee.filter({ resident_id: resident.id }),
      base44.entities.ResidentPayment.filter({ resident_id: resident.id }),
    ]).then(([f, p]) => {
      setFees(f.sort((a, b) => (a.due_date || '').localeCompare(b.due_date || '')));
      setPayments(p.sort((a, b) => b.payment_date.localeCompare(a.payment_date)));
    }).finally(() => setLoading(false));
  }, [resident?.id]);

  const totalOwed = fees
    .filter(f => f.status === 'unpaid' || f.status === 'partial')
    .reduce((s, f) => s + (f.amount || 0), 0);
  const totalPaid = payments.reduce((s, p) => s + (p.amount || 0), 0);

  const fmt = (n) => `$${Number(n).toFixed(2)}`;

  if (!resident) return null;

  return (
    <>
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {/* Header summary */}
        <div className="px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2 mb-3">
            <DollarSign className="w-4 h-4 text-emerald-600" />
            <span className="font-semibold text-slate-800">Payments & Ledger</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className={`rounded-xl p-3 ${totalOwed > 0 ? 'bg-red-50 border border-red-100' : 'bg-green-50 border border-green-100'}`}>
              <p className={`text-xs font-medium ${totalOwed > 0 ? 'text-red-500' : 'text-green-500'}`}>Balance Due</p>
              <p className={`text-2xl font-black ${totalOwed > 0 ? 'text-red-700' : 'text-green-700'}`}>{fmt(totalOwed)}</p>
            </div>
            <div className="rounded-xl p-3 bg-slate-50 border border-slate-100">
              <p className="text-xs font-medium text-slate-400">Total Paid</p>
              <p className="text-2xl font-black text-slate-700">{fmt(totalPaid)}</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100">
          {[['balance', 'Fees & Balance'], ['history', 'Payment History']].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                tab === key ? 'text-emerald-700 border-b-2 border-emerald-600' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="p-4 space-y-2 max-h-80 overflow-y-auto">
          {loading && <div className="text-center py-6 text-slate-400 text-sm">Loading…</div>}

          {/* Fees tab */}
          {!loading && tab === 'balance' && (
            <>
              {fees.length === 0 && (
                <div className="text-center py-8">
                  <CheckCircle2 className="w-8 h-8 text-emerald-300 mx-auto mb-2" />
                  <p className="text-sm text-slate-500">No fees on file.</p>
                </div>
              )}
              {fees.map(fee => {
                const s = STATUS_STYLES[fee.status] || STATUS_STYLES.unpaid;
                const isOverdue = fee.status !== 'paid' && fee.status !== 'waived' && fee.due_date && fee.due_date < new Date().toISOString().split('T')[0];
                return (
                  <div key={fee.id} className={`flex items-center gap-3 p-3 rounded-xl border ${s.border} ${s.bg}`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-slate-800">{fee.label}</p>
                        {isOverdue && <span className="text-xs text-red-500 font-bold flex items-center gap-0.5"><AlertCircle className="w-3 h-3" /> Overdue</span>}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {FEE_TYPE_LABELS[fee.type] || 'Fee'}
                        {fee.period ? ` · ${fee.period}` : ''}
                        {fee.due_date ? ` · Due ${format(parseISO(fee.due_date), 'MMM d')}` : ''}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className={`text-sm font-bold ${s.text}`}>{fmt(fee.amount)}</p>
                      <span className={`text-xs font-medium ${s.text}`}>{s.label}</span>
                    </div>
                  </div>
                );
              })}
            </>
          )}

          {/* Payment history tab */}
          {!loading && tab === 'history' && (
            <>
              {payments.length === 0 && (
                <div className="text-center py-8">
                  <Clock className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                  <p className="text-sm text-slate-500">No payment history yet.</p>
                </div>
              )}
              {payments.map(pmt => (
                <div key={pmt.id} className="flex items-center gap-3 p-3 rounded-xl border border-green-100 bg-green-50">
                  <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800">
                      {pmt.memo || 'Payment received'}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {format(parseISO(pmt.payment_date), 'MMM d, yyyy')}
                      {pmt.method ? ` · ${pmt.method.replace('_', ' ')}` : ''}
                      {pmt.received_by_name ? ` · Received by ${pmt.received_by_name}` : ''}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0 flex flex-col items-end gap-1">
                    <p className="text-sm font-bold text-green-700">{fmt(pmt.amount)}</p>
                    <button
                      onClick={() => setReceiptPayment(pmt)}
                      className="flex items-center gap-1 text-xs text-slate-400 hover:text-emerald-600 transition-colors"
                    >
                      <Printer className="w-3 h-3" /> Receipt
                    </button>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {receiptPayment && (
        <ReceiptModal
          payment={receiptPayment}
          resident={resident}
          location={location}
          organizationName={organizationName}
          onClose={() => setReceiptPayment(null)}
        />
      )}
    </>
  );
}