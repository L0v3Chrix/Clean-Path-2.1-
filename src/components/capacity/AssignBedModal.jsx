import { useState } from 'react';
import { appClient } from '@/services/appClient';
import { X, UserPlus, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function AssignBedModal({ locations, applicants, bedAssignments = [], preselectedLocation, preselectedApplicant, onClose, onSaved }) {
  const [selectedApplicant, setSelectedApplicant] = useState(preselectedApplicant?.id || '');
  const [selectedLocation, setSelectedLocation] = useState(preselectedLocation?.id || '');
  const [selectedBed, setSelectedBed] = useState('');
  const [room, setRoom] = useState('');
  const [intakeDate, setIntakeDate] = useState(new Date().toISOString().split('T')[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const location = locations.find((item) => item.id === selectedLocation);
  const availableBeds = bedAssignments
    .filter((bed) => bed.location_id === selectedLocation && bed.status === 'available')
    .sort((a, b) => (a.room || '').localeCompare(b.room || '') || (a.bed_label || '').localeCompare(b.bed_label || ''));

  const handleSave = async () => {
    if (!selectedApplicant || !selectedLocation) { setError('Please select both an applicant and a location.'); return; }
    setSaving(true);
    setError('');
    try {
      const selectedBedRecord = availableBeds.find((bed) => bed.id === selectedBed);
      await appClient.entities.Resident.update(selectedApplicant, {
        location_id: selectedLocation,
        status: 'active',
        intake_date: intakeDate,
        room: room || selectedBedRecord?.room || selectedBedRecord?.bed_label || undefined,
      });
      if (selectedBedRecord) {
        await appClient.entities.BedAssignment.update(selectedBedRecord.id, {
          status: 'occupied',
          resident_id: selectedApplicant,
          room: room || selectedBedRecord.room,
          assigned_at: new Date().toISOString(),
        });
      } else {
        await appClient.entities.BedAssignment.create({
          organization_id: location?.organization_id || 'default',
          location_id: selectedLocation,
          resident_id: selectedApplicant,
          bed_label: room || 'Assigned bed',
          room: room || undefined,
          status: 'occupied',
          assigned_at: new Date().toISOString(),
        });
      }
      await onSaved();
    } catch (failure) {
      setError(failure.message || 'Unable to assign this bed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b">
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-teal-600" />
            <h2 className="font-bold text-slate-800">Assign Applicant to Bed</h2>
          </div>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <div className="p-5 space-y-4">
          {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          <div className="space-y-1.5">
            <Label>Applicant *</Label>
            <Select value={selectedApplicant} onValueChange={setSelectedApplicant}>
              <SelectTrigger>
                <SelectValue placeholder="Choose applicant…" />
              </SelectTrigger>
              <SelectContent>
                {applicants.length === 0
                  ? <SelectItem value="none" disabled>No applicants on waitlist</SelectItem>
                  : applicants.map(a => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.first_name} {a.last_name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Location / House *</Label>
            <Select value={selectedLocation} onValueChange={(value) => { setSelectedLocation(value); setSelectedBed(''); }}>
              <SelectTrigger>
                <SelectValue placeholder="Choose location…" />
              </SelectTrigger>
              <SelectContent>
                {locations.map(l => (
                  <SelectItem key={l.id} value={l.id}>
                    <span className="flex items-center gap-2">
                      <Building2 className="w-3.5 h-3.5 text-slate-400" />
                      {l.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {availableBeds.length > 0 && (
            <div className="space-y-1.5">
              <Label>Available Bed</Label>
              <Select value={selectedBed} onValueChange={setSelectedBed}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose an open bed…" />
                </SelectTrigger>
                <SelectContent>
                  {availableBeds.map((bed) => (
                    <SelectItem key={bed.id} value={bed.id}>
                      {bed.bed_label}{bed.room ? ` · Room ${bed.room}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Room / Bed Override</Label>
              <Input placeholder="e.g. 2A, Rm 3" value={room} onChange={e => setRoom(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Intake Date</Label>
              <Input type="date" value={intakeDate} onChange={e => setIntakeDate(e.target.value)} />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button disabled={saving} onClick={handleSave} className="bg-teal-600 hover:bg-teal-700 gap-2">
              <UserPlus className="w-4 h-4" /> {saving ? 'Assigning…' : 'Confirm Assignment'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
