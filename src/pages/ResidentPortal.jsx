import { useState, useEffect } from 'react';
import { appClient } from '@/services/appClient';
import { format } from 'date-fns';
import { MapPin } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import SobrietyMilestoneCard from '@/components/resident_portal/SobrietyMilestoneCard';
import ChoresPanel from '@/components/resident_portal/ChoresPanel';
import MeetingsPanel from '@/components/resident_portal/MeetingsPanel';
import LedgerPanel from '@/components/resident_portal/LedgerPanel';
import MorningReflectionWidget from '@/components/resident_portal/MorningReflectionWidget';
import ESignaturePanel from '@/components/esignature/ESignaturePanel';
import ResidentWallet from '@/components/resident_portal/ResidentWallet';
import JourneyTracker from '@/components/resident_portal/JourneyTracker';
import { getResidentPortalLoadState } from '@/lib/residentAccess';

export default function ResidentPortal() {
  const [user, setUser] = useState(null);
  const [resident, setResident] = useState(null);
  const [location, setLocation] = useState(null);
  const [org, setOrg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    const load = async () => {
      const me = await appClient.auth.me();
      setUser(me);

      const mine = await appClient.residentAccess.me();
      if (mine) {
        setResident(mine);
        const [locs, orgs] = await Promise.all([
          mine.location_id ? appClient.entities.Location.filter({ status: 'active' }) : Promise.resolve([]),
          mine.organization_id ? appClient.entities.Organization.filter({}) : Promise.resolve([]),
        ]);
        if (mine.location_id) setLocation(locs.find(l => l.id === mine.location_id) || null);
        if (mine.organization_id) setOrg(orgs.find(o => o.id === mine.organization_id) || null);
      }
    };
    load()
      .catch(setLoadError)
      .finally(() => setLoading(false));
  }, []);

  const portalState = getResidentPortalLoadState({ loading, error: loadError, resident });

  if (portalState === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="w-8 h-8 border-4 border-amber-200 border-t-amber-600 rounded-full animate-spin" />
      </div>
    );
  }

  const firstName = resident?.first_name || user?.full_name?.split(' ')[0] || 'there';

  if (portalState === 'error') {
    return (
      <div className="mx-auto flex min-h-64 max-w-xl items-center justify-center p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-5 text-center">
          <h1 className="font-semibold text-slate-900">Unable to load resident profile</h1>
          <p className="mt-2 text-sm text-slate-600">
            Refresh the page. If the problem continues, contact an organization administrator.
          </p>
        </div>
      </div>
    );
  }

  if (portalState === 'unlinked') {
    return (
      <div className="mx-auto flex min-h-64 max-w-xl items-center justify-center p-6">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-center">
          <h1 className="font-semibold text-slate-900">Resident profile not linked</h1>
          <p className="mt-2 text-sm text-slate-600">
            Ask an organization administrator to link this account to an active resident record.
          </p>
        </div>
      </div>
    );
  }

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

      {/* E-Signature requests — shown prominently if any are pending */}
      {resident && <ESignaturePanel resident={resident} />}

      {/* Morning Reflection */}
      <MorningReflectionWidget resident={resident} />

      {/* Sobriety tracker */}
      <SobrietyMilestoneCard resident={resident} />

      {/* Journey / Phase Progress Tracker */}
      <JourneyTracker resident={resident} />

      {/* Chores + Meetings grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ChoresPanel residentId={resident?.id} />
        <MeetingsPanel locationId={resident?.location_id} />
      </div>

      {/* Payments & Ledger */}
      <LedgerPanel resident={resident} location={location} organizationName={org?.name} />

      {/* Wallet — centralized document access */}
      {resident && <ResidentWallet resident={resident} />}
    </div>
  );
}
