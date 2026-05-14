import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { differenceInDays, differenceInYears, differenceInMonths, format, parseISO, isToday, isFuture } from 'date-fns';
import { Heart, CheckCircle2, Circle, CalendarDays, MapPin, Clock, Star, Flame, Trophy, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import SobrietyMilestoneCard from '@/components/resident_portal/SobrietyMilestoneCard';
import ChoresPanel from '@/components/resident_portal/ChoresPanel';
import MeetingsPanel from '@/components/resident_portal/MeetingsPanel';
import LedgerPanel from '@/components/resident_portal/LedgerPanel';

export default function ResidentPortal() {
  const [user, setUser] = useState(null);
  const [resident, setResident] = useState(null);
  const [location, setLocation] = useState(null);
  const [org, setOrg] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const me = await base44.auth.me();
      setUser(me);

      // Find resident profile linked to this user
      const residents = await base44.entities.Resident.filter({ status: 'active' });
      const mine = residents.find(r => r.user_id === me.id || r.email === me.email);
      if (mine) {
        setResident(mine);
        const [locs, orgs] = await Promise.all([
          mine.location_id ? base44.entities.Location.filter({ status: 'active' }) : Promise.resolve([]),
          mine.organization_id ? base44.entities.Organization.filter({}) : Promise.resolve([]),
        ]);
        if (mine.location_id) setLocation(locs.find(l => l.id === mine.location_id) || null);
        if (mine.organization_id) setOrg(orgs.find(o => o.id === mine.organization_id) || null);
      }
      setLoading(false);
    };
    load().catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="w-8 h-8 border-4 border-amber-200 border-t-amber-600 rounded-full animate-spin" />
      </div>
    );
  }

  const firstName = resident?.first_name || user?.full_name?.split(' ')[0] || 'there';

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
      {/* Welcome header */}
      <div className="rounded-2xl p-5 text-white" style={{ background: 'linear-gradient(135deg, #1C1917 0%, #2C2420 100%)', border: '1px solid #3C3028' }}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-amber-400 text-sm font-medium mb-1">Welcome back</p>
            <h1 className="text-2xl font-bold">{firstName} 👋</h1>
            {location && (
              <div className="flex items-center gap-1.5 mt-2 text-slate-300 text-sm">
                <MapPin className="w-3.5 h-3.5 text-amber-400" />
                {location.name}
                {resident?.room && <span className="text-slate-400">· Room {resident.room}</span>}
              </div>
            )}
          </div>
          <div className="text-right">
            <p className="text-slate-400 text-xs">Today</p>
            <p className="text-white font-semibold text-sm">{format(new Date(), 'EEEE, MMMM d')}</p>
            {resident?.phase && (
              <Badge className="mt-1 text-xs bg-amber-600/20 text-amber-300 border border-amber-600/30">
                Phase {resident.phase}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Sobriety tracker */}
      <SobrietyMilestoneCard resident={resident} />

      {/* Chores + Meetings grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ChoresPanel residentId={resident?.id} />
        <MeetingsPanel locationId={resident?.location_id} />
      </div>

      {/* Payments & Ledger */}
      <LedgerPanel resident={resident} location={location} organizationName={org?.name} />
    </div>
  );
}