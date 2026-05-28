import { useState } from 'react';
import { ChevronDown, ChevronRight, Briefcase, Home, Heart, Users } from 'lucide-react';
import { Card } from '@/components/ui/card';
import ComplianceRuleRow from './ComplianceRuleRow';

const domainConfig = {
  administrative: { color: 'blue', Icon: Briefcase },
  physical_environment: { color: 'green', Icon: Home },
  recovery_support: { color: 'teal', Icon: Heart },
  good_neighbor: { color: 'amber', Icon: Users },
};

const colorMap = {
  blue: { header: 'bg-blue-50 border-blue-200', title: 'text-blue-800', icon: 'text-blue-600', badge: 'bg-blue-100 text-blue-700' },
  green: { header: 'bg-green-50 border-green-200', title: 'text-green-800', icon: 'text-green-600', badge: 'bg-green-100 text-green-700' },
  teal: { header: 'bg-teal-50 border-teal-200', title: 'text-teal-800', icon: 'text-teal-600', badge: 'bg-teal-100 text-teal-700' },
  amber: { header: 'bg-amber-50 border-amber-200', title: 'text-amber-800', icon: 'text-amber-600', badge: 'bg-amber-100 text-amber-700' },
};

export default function ComplianceDomainAccordion({ domain, getRecord, onUpdateRecord, onFileUpload }) {
  const [open, setOpen] = useState(false);
  const { color, Icon } = domainConfig[domain.id] || { color: 'blue', Icon: Briefcase };
  const c = colorMap[color];

  const compliant = domain.rules.filter(r => getRecord(r.id)?.status === 'compliant').length;
  const total = domain.rules.length;

  return (
    <Card className="overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center justify-between p-4 border-b ${c.header} hover:opacity-90 transition-opacity`}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white shadow-sm flex items-center justify-center">
            {Icon && <Icon className={`w-5 h-5 ${c.icon}`} />}
          </div>
          <div className="text-left">
            <h3 className={`font-semibold ${c.title}`}>{domain.label}</h3>
            <p className="text-xs text-slate-500">{domain.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${c.badge}`}>
            {compliant}/{total} met
          </span>
          {open ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
        </div>
      </button>

      {open && (
        <div className="divide-y divide-slate-100">
          {domain.rules.map(rule => (
            <ComplianceRuleRow
              key={rule.id}
              rule={rule}
              domain={domain.id}
              record={getRecord(rule.id)}
              onUpdate={(updates) => onUpdateRecord(rule.id, domain.id, rule.name, updates)}
              onFileUpload={(file) => onFileUpload(rule.id, domain.id, rule.name, file)}
            />
          ))}
        </div>
      )}
    </Card>
  );
}