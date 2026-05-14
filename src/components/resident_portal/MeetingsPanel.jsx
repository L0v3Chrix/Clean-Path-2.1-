import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { CalendarDays, Clock, MapPin, Users } from 'lucide-react';
import { format, parseISO, isToday, isFuture, isPast, addDays } from 'date-fns';

export default function MeetingsPanel({ locationId }) {
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Show upcoming shifts/house meetings for the resident's location in the next 14 days
    const today = new Date().toISOString().split('T')[0];
    const future = addDays(new Date(), 14).toISOString().split('T')[0];

    const fetchShifts = locationId
      ? base44.entities.Shift.filter({ location_id: locationId })
      : base44.entities.Shift.list();

    fetchShifts
      .then(all => {
        const upcoming = all
          .filter(s => s.shift_date >= today && s.shift_date <= future && s.status !== 'cancelled')
          .sort((a, b) => a.shift_date.localeCompare(b.shift_date) || a.start_time?.localeCompare(b.start_time || ''));
        setShifts(upcoming.slice(0, 8));
      })
      .finally(() => setLoading(false));
  }, [locationId]);

  // Also show static weekly house meeting info
  const HOUSE_MEETING = {
    day: 'Sunday',
    time: '6:00 PM',
    label: 'Weekly House Meeting',
    required: true,
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
        <CalendarDays className="w-4 h-4 text-blue-600" />
        <span className="font-semibold text-slate-800">House Schedule</span>
      </div>

      <div className="p-4 space-y-3 max-h-72 overflow-y-auto">
        {/* Weekly house meeting — always shown */}
        <div className="flex items-start gap-3 p-3 rounded-xl border-2 border-blue-100 bg-blue-50">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
            <Users className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold text-blue-900">{HOUSE_MEETING.label}</p>
              <span className="text-xs bg-red-100 text-red-600 font-medium px-1.5 py-0.5 rounded-full">Mandatory</span>
            </div>
            <p className="text-xs text-blue-600 mt-0.5 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {HOUSE_MEETING.day}s at {HOUSE_MEETING.time}
            </p>
          </div>
        </div>

        {loading && <div className="text-center py-4 text-slate-400 text-sm">Loading schedule…</div>}

        {!loading && shifts.length === 0 && (
          <div className="text-center py-4 text-slate-400 text-sm">
            No additional events scheduled in the next 2 weeks.
          </div>
        )}

        {shifts.map(shift => {
          const dateObj = parseISO(shift.shift_date);
          const isNow = isToday(dateObj);
          return (
            <div key={shift.id} className={`flex items-start gap-3 p-3 rounded-xl border transition-colors ${
              isNow ? 'border-amber-200 bg-amber-50' : 'border-slate-100'
            }`}>
              <div className={`flex-shrink-0 text-center w-10 rounded-lg py-1 ${isNow ? 'bg-amber-500' : 'bg-slate-100'}`}>
                <p className={`text-xs font-bold leading-none ${isNow ? 'text-white' : 'text-slate-500'}`}>
                  {format(dateObj, 'MMM').toUpperCase()}
                </p>
                <p className={`text-lg font-black leading-none ${isNow ? 'text-white' : 'text-slate-800'}`}>
                  {format(dateObj, 'd')}
                </p>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800">
                  {shift.staff_name ? `On Duty: ${shift.staff_name}` : 'Scheduled Event'}
                  {isNow && <span className="ml-2 text-xs text-amber-600 font-bold">TODAY</span>}
                </p>
                {shift.start_time && (
                  <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                    <Clock className="w-3 h-3" />
                    {shift.start_time}{shift.end_time ? ` – ${shift.end_time}` : ''}
                  </p>
                )}
                {shift.notes && <p className="text-xs text-slate-500 mt-0.5 truncate">{shift.notes}</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}