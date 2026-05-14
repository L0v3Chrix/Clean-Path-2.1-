import { useState } from 'react';
import { X, Edit, Phone, Mail, Calendar, MapPin, Heart, FileText, AlertTriangle, GitBranch, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { base44 } from '@/api/base44Client';
import ResidentDocuments from './ResidentDocuments';
import ResidentTimeline from './ResidentTimeline';
import ResidentCarePlan from './ResidentCarePlan';

const statusColors = {
  applicant: 'bg-blue-100 text-blue-700',
  active: 'bg-green-100 text-green-700',
  on_leave: 'bg-yellow-100 text-yellow-700',
  exited: 'bg-slate-100 text-slate-600',
  alumni: 'bg-purple-100 text-purple-700',
};

export default function ResidentDetail({ resident: r, locations, onEdit, onClose, onRefresh }) {
  const [tab, setTab] = useState('profile');
  const location = locations.find(l => l.id === r.location_id);

  const handleDelete = async () => {
    if (!confirm(`Remove ${r.first_name} ${r.last_name} from the system?`)) return;
    await base44.entities.Resident.delete(r.id);
    onClose();
    onRefresh();
  };

  const info = (label, value, icon) => value ? (
    <div className="flex items-start gap-2">
      {icon && <span className="text-slate-400 mt-0.5">{icon}</span>}
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-sm font-medium text-slate-800">{value}</p>
      </div>
    </div>
  ) : null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-end">
      <div className="bg-white h-full w-full max-w-md overflow-y-auto shadow-xl">
        <div className="flex items-center justify-between p-5 border-b sticky top-0 bg-white z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 font-bold">
              {r.first_name?.[0]}{r.last_name?.[0]}
            </div>
            <div>
              <h2 className="font-bold text-slate-900">{r.first_name} {r.last_name}</h2>
              <Badge className={`${statusColors[r.status] || ''} border-0 text-xs capitalize`}>{r.status}</Badge>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={onEdit} className="gap-1">
              <Edit className="w-3 h-3" /> Edit
            </Button>
            <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b px-5 gap-1 sticky top-[73px] bg-white z-10">
          {[
            { id: 'profile', label: 'Profile' },
            { id: 'careplan', label: 'Care Plan', icon: ClipboardList },
            { id: 'timeline', label: 'Timeline', icon: GitBranch },
            { id: 'documents', label: 'Documents', icon: FileText },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                tab === t.id ? 'border-teal-500 text-teal-600' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {t.icon && <t.icon className="w-3.5 h-3.5" />}
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'profile' && (
          <div className="p-5 space-y-5">
            <div className="grid grid-cols-2 gap-4">
              {info('Location', location?.name)}
              {info('Room', r.room ? `Room ${r.room}` : null)}
              {info('Intake Date', r.intake_date)}
              {info('Recovery Date', r.sober_date)}
              {info('Recovery Pathway', r.recovery_pathway?.replace('_', ' '))}
              {info('Phase', r.phase)}
              {info('Phone', r.phone)}
              {info('Email', r.email)}
              {info('Date of Birth', r.date_of_birth)}
              {info('Gender', r.gender)}
              {info('Referred By', r.referred_by)}
            </div>

            {(r.emergency_contact_name || r.emergency_contact_phone) && (
              <div className="border rounded-xl p-4 bg-red-50">
                <p className="text-xs font-semibold text-red-700 mb-2">EMERGENCY CONTACT</p>
                <p className="text-sm font-medium">{r.emergency_contact_name}</p>
                {r.emergency_contact_relationship && <p className="text-xs text-slate-500">{r.emergency_contact_relationship}</p>}
                {r.emergency_contact_phone && <p className="text-sm text-slate-700 mt-1">{r.emergency_contact_phone}</p>}
              </div>
            )}

            {r.notes && (
              <div>
                <p className="text-xs font-semibold text-slate-500 mb-1">NOTES</p>
                <p className="text-sm text-slate-700 bg-slate-50 rounded-lg p-3">{r.notes}</p>
              </div>
            )}

            <div className="flex items-center gap-2 pt-2">
              <div className={`w-2 h-2 rounded-full ${r.consent_signed ? 'bg-green-500' : 'bg-red-400'}`} />
              <span className="text-xs text-slate-500">Consent {r.consent_signed ? 'signed' : 'not signed'}</span>
              <div className={`w-2 h-2 rounded-full ml-3 ${r.resident_agreement_signed ? 'bg-green-500' : 'bg-red-400'}`} />
              <span className="text-xs text-slate-500">Agreement {r.resident_agreement_signed ? 'signed' : 'not signed'}</span>
            </div>

            <Button variant="ghost" className="text-red-500 hover:text-red-700 hover:bg-red-50 w-full text-sm" onClick={handleDelete}>
              Remove Resident
            </Button>
          </div>
        )}

        {tab === 'careplan' && (
          <div className="p-5">
            <ResidentCarePlan resident={r} />
          </div>
        )}

        {tab === 'timeline' && (
          <div className="p-5">
            <ResidentTimeline resident={r} />
          </div>
        )}

        {tab === 'documents' && (
          <div className="p-5">
            <ResidentDocuments resident={r} />
          </div>
        )}
      </div>
    </div>
  );
}