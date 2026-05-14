import { base44 } from '@/api/base44Client';

/**
 * Given a location, date, and time, find the primary staff member on duty.
 * Returns the matching StaffMember record or null.
 */
export async function getStaffOnDuty(locationId, date, time, staffList) {
  if (!locationId || !date) return null;

  const shifts = await base44.entities.Shift.filter({
    location_id: locationId,
    shift_date: date,
    status: 'scheduled',
  });

  if (!shifts?.length) return null;

  // Parse incident time to minutes for comparison
  const toMins = (t) => {
    if (!t) return null;
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };

  const incidentMins = time ? toMins(time) : null;

  // Find a shift covering the incident time (primary first)
  const sorted = [...shifts].sort((a, b) => {
    const rolePriority = { primary: 0, secondary: 1, on_call: 2 };
    return (rolePriority[a.role_label] ?? 1) - (rolePriority[b.role_label] ?? 1);
  });

  let match = null;
  if (incidentMins !== null) {
    match = sorted.find(s => {
      const start = toMins(s.start_time);
      const end = toMins(s.end_time);
      if (start === null || end === null) return false;
      // Handle overnight shifts
      if (end < start) return incidentMins >= start || incidentMins <= end;
      return incidentMins >= start && incidentMins <= end;
    });
  }

  // Fallback: nearest primary shift on that date/location
  if (!match) match = sorted[0];
  if (!match) return null;

  return staffList.find(s => s.id === match.staff_id) || null;
}