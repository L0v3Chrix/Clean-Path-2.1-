import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle2, Clock, XCircle, Minus, Award } from 'lucide-react';

const domainColorMap = {
  blue: { bar: 'bg-blue-500', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  green: { bar: 'bg-green-500', bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
  teal: { bar: 'bg-teal-500', bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200' },
  amber: { bar: 'bg-amber-500', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
};

function ScoreRing({ score }) {
  const r = 54;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = score >= 80 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444';

  return (
    <div className="relative w-36 h-36 flex-shrink-0">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={r} fill="none" stroke="#e2e8f0" strokeWidth="10" />
        <circle
          cx="60" cy="60" r={r} fill="none"
          stroke={color} strokeWidth="10"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold text-slate-900">{score}%</span>
        <span className="text-xs text-slate-500 font-medium">Ready</span>
      </div>
    </div>
  );
}

export default function ComplianceReadinessScore({ score, compliant, inProgress, notMet, total, domains, getRecord }) {
  const readinessLabel = score >= 80 ? 'Certification Ready' : score >= 50 ? 'In Progress' : 'Needs Attention';
  const readinessColor = score >= 80 ? 'text-green-600 bg-green-50' : score >= 50 ? 'text-amber-600 bg-amber-50' : 'text-red-600 bg-red-50';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Main score card */}
      <Card className="lg:col-span-1">
        <CardContent className="p-6 flex flex-col items-center justify-center gap-4 h-full">
          <ScoreRing score={score} />
          <div className="text-center">
            <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${readinessColor}`}>
              <Award className="w-3.5 h-3.5" />
              {readinessLabel}
            </div>
            <p className="text-xs text-slate-500 mt-2">{compliant} of {total} standards met</p>
          </div>
        </CardContent>
      </Card>

      {/* Status summary */}
      <Card className="lg:col-span-1">
        <CardContent className="p-6 space-y-4">
          <h3 className="text-sm font-semibold text-slate-700">Status Summary</h3>
          {[
            { label: 'Compliant', count: compliant, icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-100' },
            { label: 'In Progress', count: inProgress, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-100' },
            { label: 'Not Met', count: notMet, icon: XCircle, color: 'text-red-600', bg: 'bg-red-100' },
            { label: 'Not Reviewed', count: total - compliant - inProgress - notMet, icon: Minus, color: 'text-slate-400', bg: 'bg-slate-100' },
          ].map(({ label, count, icon: Icon, color, bg }) => (
            <div key={label} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-lg ${bg} flex items-center justify-center`}>
                  <Icon className={`w-4 h-4 ${color}`} />
                </div>
                <span className="text-sm text-slate-600">{label}</span>
              </div>
              <span className="text-sm font-bold text-slate-800">{count}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Domain breakdown */}
      <Card className="lg:col-span-1">
        <CardContent className="p-6 space-y-3">
          <h3 className="text-sm font-semibold text-slate-700">Domain Progress</h3>
          {domains.map(domain => {
            const domainTotal = domain.rules.length;
            const domainCompliant = domain.rules.filter(r => getRecord(r.id)?.status === 'compliant').length;
            const total = domainTotal;
            const compliant = domainCompliant;
            const pct = total > 0 ? Math.round((compliant / total) * 100) : 0;
            const colors = domainColorMap[domain.color];
            return (
              <div key={domain.id}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-slate-600">{domain.label}</span>
                  <span className={`text-xs font-bold ${colors.text}`}>{pct}%</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${colors.bar} transition-all duration-500`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="text-xs text-slate-400 mt-0.5">{compliant}/{total} standards</p>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}