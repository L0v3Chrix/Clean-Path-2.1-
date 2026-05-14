import { AlertTriangle, AlertCircle, Clock } from 'lucide-react';
import { getAlertSeverity } from '@/lib/residentAlerts';

export default function ResidentAlertBadge({ alerts }) {
  if (!alerts || alerts.length === 0) return null;
  const severity = getAlertSeverity(alerts);

  if (severity === 'critical') {
    return (
      <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 text-xs font-semibold px-2 py-0.5 rounded-full">
        <AlertCircle className="w-3 h-3" /> {alerts.length} Expired
      </span>
    );
  }
  if (severity === 'high') {
    return (
      <span className="inline-flex items-center gap-1 bg-orange-100 text-orange-700 text-xs font-semibold px-2 py-0.5 rounded-full">
        <AlertTriangle className="w-3 h-3" /> {alerts.length} Missing
      </span>
    );
  }
  if (severity === 'warning') {
    return (
      <span className="inline-flex items-center gap-1 bg-yellow-100 text-yellow-700 text-xs font-semibold px-2 py-0.5 rounded-full">
        <Clock className="w-3 h-3" /> {alerts.length} Expiring
      </span>
    );
  }
  return null;
}