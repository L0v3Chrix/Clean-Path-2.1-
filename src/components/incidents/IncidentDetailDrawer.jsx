import { X, Pencil, Trash2, AlertTriangle, MapPin, User, Users, Clock, FileText, CheckCircle2, Circle, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';

const SEVERITY_CFG = {
  low:      { label: 'Low',      bg: '#F1F5F9', color: '#475569', bar: '#94A3B8' },
  medium:   { label: 'Medium',   bg: '#FEF3C7', color: '#92400E', bar: '#F59E0B' },
  high:     { label: 'High',     bg: '#FFEDD5', color: '#9A3412', bar: '#F97316' },
  critical: { label: 'Critical', bg: '#FEE2E2', color: '#991B1B', bar: '#EF4444' },
};

const STATUS_STEPS = ['open', 'in_review', 'resolved', 'closed'];
const STATUS_LABELS = { open: 'Open', in_review: 'In Review', resolved: 'Resolved', closed: 'Closed' };
const STATUS_COLORS = {
  open:      { active: '#EF4444', bg: '#FEE2E2' },
  in_review: { active: '#F59E0B', bg: '#FEF3C7' },
  resolved:  { active: '#10B981', bg: '#D1FAE5' },
  closed:    { active: '#64748B', bg: '#F1F5F9' },
};

function StatusPipeline({ current, onChange }) {
  const currentIdx = STATUS_STEPS.indexOf(current);
  return (
    <div className="flex items-center gap-1">
      {STATUS_STEPS.map((s, idx) => {
        const isCurrent = s === current;
        const isPast = idx < currentIdx;
        const cfg = STATUS_COLORS[s];
        return (
          <button
            key={s}
            onClick={() => onChange(s)}
            title={`Mark as ${STATUS_LABELS[s]}`}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all border"
            style={{
              background: isCurrent ? cfg.bg : isPast ? '#F0E9DC' : '#F9F6F0',
              color: isCurrent ? cfg.active : isPast ? '#A09080' : '#C4B8A8',
              borderColor: isCurrent ? cfg.active : '#E0D5C5',
              opacity: 1,
            }}
          >
            {isPast || isCurrent ? <CheckCircle2 className="w-3 h-3" /> : <Circle className="w-3 h-3" />}
            {STATUS_LABELS[s]}
          </button>
        );
      })}
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3">
      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: '#F0E9DC' }}>
        <Icon className="w-3.5 h-3.5" style={{ color: '#B45309' }} />
      </div>
      <div>
        <p className="text-xs" style={{ color: '#78716C' }}>{label}</p>
        <p className="text-sm font-medium" style={{ color: '#1C1917' }}>{value}</p>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#B45309' }}>{title}</p>
      {children}
    </div>
  );
}

export default function IncidentDetailDrawer({ incident, residents, locations, staff, onEdit, onClose, onRefresh }) {
  const sev = SEVERITY_CFG[incident.severity] || SEVERITY_CFG.medium;
  const resident = residents.find(r => r.id === incident.resident_id);
  const location = locations.find(l => l.id === incident.location_id);
  const reporter = staff.find(s => s.id === incident.reported_by_id);

  const updateStatus = async (status) => {
    await base44.entities.IncidentReport.update(incident.id, { status });
    onRefresh(status);
  };

  const handleDelete = async () => {
    if (!confirm('Permanently delete this incident report?')) return;
    await base44.entities.IncidentReport.delete(incident.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-end">
      <div className="h-full w-full max-w-lg overflow-y-auto shadow-2xl flex flex-col" style={{ background: '#FAF6EF' }}>
        {/* Header */}
        <div className="sticky top-0 z-10 flex-shrink-0" style={{ background: '#FAF6EF' }}>
          {/* Severity bar */}
          <div className="h-1.5 w-full" style={{ background: sev.bar }} />
          <div className="flex items-start justify-between p-5 border-b" style={{ borderColor: '#E0D5C5' }}>
            <div className="flex-1 min-w-0 pr-4">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold px-2 py-0.5 rounded-full capitalize" style={{ background: sev.bg, color: sev.color }}>
                  {sev.label}
                </span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full capitalize" style={{ background: '#F0E9DC', color: '#78716C' }}>
                  {incident.type?.replace(/_/g, ' ')}
                </span>
                {incident.confidential && (
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: '#EDE9FE', color: '#5B21B6' }}>🔒 Confidential</span>
                )}
              </div>
              <h2 className="font-bold text-lg mt-2 capitalize" style={{ color: '#1C1917' }}>
                {incident.type?.replace(/_/g, ' ')} Report
              </h2>
              <p className="text-sm" style={{ color: '#78716C' }}>
                {incident.incident_date}{incident.incident_time ? ` at ${incident.incident_time}` : ''}
                {location ? ` · ${location.name}` : ''}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={onEdit} className="p-1.5 rounded-lg hover:bg-amber-100 transition-colors" title="Edit">
                <Pencil className="w-4 h-4" style={{ color: '#B45309' }} />
              </button>
              <button onClick={handleDelete} className="p-1.5 rounded-lg hover:bg-red-50 transition-colors" title="Delete">
                <Trash2 className="w-4 h-4" style={{ color: '#DC2626' }} />
              </button>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors ml-1">
                <X className="w-5 h-5" style={{ color: '#78716C' }} />
              </button>
            </div>
          </div>

          {/* Status Pipeline */}
          <div className="px-5 py-3 border-b overflow-x-auto" style={{ borderColor: '#E0D5C5' }}>
            <p className="text-xs font-semibold mb-2" style={{ color: '#78716C' }}>STATUS TRACKING</p>
            <StatusPipeline current={incident.status} onChange={updateStatus} />
          </div>
        </div>

        {/* Body */}
        <div className="p-5 space-y-6 flex-1">
          {/* Quick flags */}
          <div className="flex flex-wrap gap-2">
            {incident.naloxone_used && (
              <span className="text-xs font-semibold px-3 py-1 rounded-full" style={{ background: '#FEE2E2', color: '#991B1B' }}>💉 Naloxone Used</span>
            )}
            {incident.ems_called && (
              <span className="text-xs font-semibold px-3 py-1 rounded-full" style={{ background: '#FFEDD5', color: '#9A3412' }}>🚑 EMS Called</span>
            )}
            {incident.follow_up_required && (
              <span className="text-xs font-semibold px-3 py-1 rounded-full" style={{ background: '#FEF3C7', color: '#92400E' }}>📋 Follow-up Required</span>
            )}
          </div>

          {/* Who/Where */}
          <Section title="Details">
            <InfoRow icon={MapPin} label="Location" value={location?.name} />
            <InfoRow icon={User} label="Resident Involved" value={resident ? `${resident.first_name} ${resident.last_name}` : null} />
            <InfoRow icon={Users} label="Reported By" value={reporter ? `${reporter.first_name} ${reporter.last_name}` : null} />
            <InfoRow icon={Users} label="Other Staff Involved" value={incident.involved_staff_names} />
            <InfoRow icon={Clock} label="Date & Time" value={`${incident.incident_date}${incident.incident_time ? ' at ' + incident.incident_time : ''}`} />
          </Section>

          {/* Description */}
          <Section title="Description">
            <div className="rounded-xl p-4 text-sm leading-relaxed whitespace-pre-wrap" style={{ background: '#F0E9DC', color: '#1C1917' }}>
              {incident.description || <span style={{ color: '#A09080' }}>No description provided.</span>}
            </div>
          </Section>

          {/* Actions */}
          {incident.action_taken && (
            <Section title="Immediate Action Taken">
              <div className="rounded-xl p-4 text-sm leading-relaxed whitespace-pre-wrap" style={{ background: '#F0E9DC', color: '#1C1917' }}>
                {incident.action_taken}
              </div>
            </Section>
          )}

          {/* Follow-up */}
          {incident.follow_up_required && incident.follow_up_notes && (
            <Section title="Follow-up Notes">
              <div className="rounded-xl p-4 text-sm leading-relaxed whitespace-pre-wrap border-l-4" style={{ background: '#FEF3C7', color: '#1C1917', borderColor: '#F59E0B' }}>
                {incident.follow_up_notes}
              </div>
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}