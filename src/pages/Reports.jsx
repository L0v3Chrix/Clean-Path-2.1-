import { useEffect, useState } from 'react';
import { Download, FileSpreadsheet, Loader2 } from 'lucide-react';
import { appClient } from '@/services/appClient';
import { downloadCsv } from '@/lib/csvExport';
import { Button } from '@/components/ui/button';

const REPORTS = [
  { entity: 'Location', label: 'Houses and beds', columns: ['id', 'name', 'address', 'city', 'state', 'zip', 'total_beds', 'occupied_beds', 'status'] },
  { entity: 'StaffMember', label: 'Staff roster', columns: ['id', 'first_name', 'last_name', 'email', 'role', 'title', 'location_ids', 'status'] },
  { entity: 'Resident', label: 'Residents', columns: ['id', 'location_id', 'first_name', 'last_name', 'status', 'room', 'intake_date', 'exit_date', 'sober_date'] },
  { entity: 'ResidentContact', label: 'Resident contacts', columns: ['id', 'resident_id', 'name', 'relationship', 'phone', 'email', 'is_emergency_contact'] },
  { entity: 'ResidentDocument', label: 'Document register', columns: ['id', 'resident_id', 'location_id', 'title', 'document_type', 'status', 'signed_at', 'expires_at'] },
  { entity: 'Medication', label: 'Medications', columns: ['id', 'resident_id', 'name', 'dosage', 'frequency', 'status', 'current_quantity'] },
  { entity: 'MedicationLog', label: 'Medication logs', columns: ['id', 'resident_id', 'medication_id', 'scheduled_time', 'administered_at', 'status'] },
  { entity: 'IncidentReport', label: 'Incidents', columns: ['id', 'location_id', 'resident_id', 'incident_date', 'type', 'severity', 'status'] },
  { entity: 'Shift', label: 'Schedules', columns: ['id', 'location_id', 'staff_id', 'shift_date', 'start_time', 'end_time', 'status'] },
  { entity: 'CarePlanGoal', label: 'Care-plan goals', columns: ['id', 'resident_id', 'term', 'category', 'title', 'target_date', 'status', 'completed_date'] },
  { entity: 'BedAssignment', label: 'Bed assignments', columns: ['id', 'location_id', 'resident_id', 'room', 'bed_label', 'status', 'assigned_at'] },
];

export default function Reports() {
  const [user, setUser] = useState(null);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    appClient.auth.me().then(setUser).catch((failure) => setError(failure.message));
  }, []);

  const exportReport = async (report) => {
    setBusy(report.entity);
    setError('');
    try {
      const records = await appClient.entities[report.entity].list('-created_at', 1000);
      await appClient.operations.recordExport(user.organization_id, report.entity, records.length);
      const date = new Date().toISOString().slice(0, 10);
      downloadCsv(`clearpath-${report.entity.toLowerCase()}-${date}.csv`, records, report.columns);
    } catch (failure) {
      setError(failure.message || 'Unable to export report.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Operational Exports</h1>
        <p className="text-sm text-slate-500 mt-1">Downloads contain only records your account is authorized to view. Every export is audited.</p>
      </header>
      {error && <div className="mb-4 border border-red-200 bg-red-50 text-red-800 px-4 py-3 text-sm">{error}</div>}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {REPORTS.map((report) => (
          <article key={report.entity} className="border border-slate-200 bg-white p-4 rounded-lg flex items-center gap-3">
            <FileSpreadsheet className="w-5 h-5 text-teal-700 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold text-slate-900">{report.label}</h2>
              <p className="text-xs text-slate-500">CSV, {report.columns.length} approved fields</p>
            </div>
            <Button
              variant="outline"
              size="icon"
              title={`Download ${report.label}`}
              aria-label={`Download ${report.label}`}
              disabled={!user || busy !== null}
              onClick={() => exportReport(report)}
            >
              {busy === report.entity ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            </Button>
          </article>
        ))}
      </div>
    </div>
  );
}
