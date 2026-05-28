import { useState } from 'react';
import { AlertTriangle, AlertCircle, ChevronDown, ChevronUp, CheckCircle } from 'lucide-react';
import { getResidentAlerts, REQUIRED_DOCUMENTS } from '@/lib/residentAlerts';

const severityStyle = {
  missing:  { bg: 'bg-orange-50', border: 'border-orange-200', dot: 'bg-orange-400', text: 'text-orange-700', label: 'Missing' },
  expired:  { bg: 'bg-red-50',    border: 'border-red-200',    dot: 'bg-red-500',    text: 'text-red-700',    label: 'Expired' },
  expiring: { bg: 'bg-yellow-50', border: 'border-yellow-200', dot: 'bg-yellow-400', text: 'text-yellow-700', label: 'Expiring Soon' },
};

export default function DocumentAlertPanel({ residents, documents, onSelectResident }) {
  const [expanded, setExpanded] = useState(false);

  // Build per-resident alert data
  const residentAlerts = residents
    .map(r => ({
      resident: r,
      alerts: getResidentAlerts(r, documents.filter(d => d.resident_id === r.id)),
    }))
    .filter(({ alerts }) => alerts.length > 0)
    .sort((a, b) => b.alerts.length - a.alerts.length);

  if (residentAlerts.length === 0) return null;

  const totalDocAlerts = residentAlerts.reduce((sum, { alerts }) => sum + alerts.length, 0);
  const hasExpired  = residentAlerts.some(({ alerts }) => alerts.some(a => a.type === 'expired'));
  const hasMissing  = residentAlerts.some(({ alerts }) => alerts.some(a => a.type === 'missing'));

  const panelColor = hasExpired ? 'border-red-200 bg-red-50' : hasMissing ? 'border-orange-200 bg-orange-50' : 'border-yellow-200 bg-yellow-50';
  const iconColor  = hasExpired ? 'text-red-600' : hasMissing ? 'text-orange-600' : 'text-yellow-600';
  const Icon       = hasExpired ? AlertCircle : AlertTriangle;

  return (
    <div className={`rounded-xl border mb-5 overflow-hidden ${panelColor}`}>
      {/* Header — always visible */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3"
      >
        <div className="flex items-center gap-2">
          <Icon className={`w-4 h-4 ${iconColor}`} />
          <span className={`text-sm font-semibold ${iconColor}`}>
            {totalDocAlerts} document alert{totalDocAlerts !== 1 ? 's' : ''} require attention
            <span className="font-normal ml-1 opacity-75">
              — {residentAlerts.length} resident{residentAlerts.length !== 1 ? 's' : ''}
            </span>
          </span>
        </div>
        {expanded
          ? <ChevronUp className={`w-4 h-4 ${iconColor}`} />
          : <ChevronDown className={`w-4 h-4 ${iconColor}`} />}
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-current/10 divide-y divide-current/10">
          {residentAlerts.map(({ resident: r, alerts }) => (
            <div key={r.id} className="px-4 py-3">
              <button
                className="flex items-center justify-between w-full text-left mb-2 group"
                onClick={() => onSelectResident(r)}
              >
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-white/70 flex items-center justify-center text-xs font-bold text-slate-700">
                    {r.first_name?.[0]}{r.last_name?.[0]}
                  </div>
                  <span className="text-sm font-semibold text-slate-800 group-hover:underline">
                    {r.first_name} {r.last_name}
                  </span>
                  <span className="text-xs text-slate-500 capitalize">{r.status}</span>
                </div>
                <span className="text-xs text-slate-500">{alerts.length} alert{alerts.length !== 1 ? 's' : ''} →</span>
              </button>

              {/* Doc checklist */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 ml-9">
                {REQUIRED_DOCUMENTS.map(req => {
                  const alert = alerts.find(a => a.docType === req.type);
                  if (!alert) {
                    return (
                      <div key={req.type} className="flex items-center gap-1 text-xs text-green-700 opacity-60">
                        <CheckCircle className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{req.label}</span>
                      </div>
                    );
                  }
                  const s = severityStyle[alert.type] || severityStyle.missing;
                  return (
                    <div key={req.type} className={`flex items-center gap-1 text-xs ${s.text} rounded px-1.5 py-0.5 ${s.bg} border ${s.border}`}>
                      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.dot}`} />
                      <span className="truncate">{req.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}