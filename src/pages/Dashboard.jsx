import { useState, useEffect } from 'react';
import { appClient } from '@/services/appClient';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { Users, Building2, AlertTriangle, Shield, ArrowRight, Sparkles } from 'lucide-react';
import WellnessDashboard from '@/components/dashboard/WellnessDashboard';
import FlaggedCheckinsPanel from '@/components/checkins/FlaggedCheckinsPanel';
import { Card, CardContent } from '@/components/ui/card';
import { MODULE_TREATMENTS, getAttentionTone } from '@/lib/clearpathVisualSystem';

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState({ residents: 0, locations: 0, incidents: 0, staff: 0 });
  const [recentResidents, setRecentResidents] = useState([]);
  const [recentIncidents, setRecentIncidents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [u, residents, locations, incidents, staff] = await Promise.all([
        appClient.auth.me(),
        appClient.entities.Resident.list('-created_date', 50),
        appClient.entities.Location.list(),
        appClient.entities.IncidentReport.list('-created_date', 50),
        appClient.entities.StaffMember.list(),
      ]);
      setUser(u);
      setStats({
        residents: residents.filter(r => r.status === 'active').length,
        locations: locations.filter(l => l.status === 'active').length,
        incidents: incidents.filter(i => i.status === 'open').length,
        staff: staff.filter(s => s.status === 'active').length,
      });
      setRecentResidents(residents.slice(0, 5));
      setRecentIncidents(incidents.slice(0, 5));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const isResident = user?.role === 'user' || user?.role === 'resident';

  if (isResident) {
    return <ResidentDashboard user={user} />;
  }

  const statCards = [
    { label: 'Active Residents', value: stats.residents, icon: Users, path: '/residents', tone: 'active', cue: 'People in the house' },
    { label: 'Active Locations', value: stats.locations, icon: Building2, path: '/locations', tone: 'steady', cue: 'Homes online' },
    { label: 'Open Incidents', value: stats.incidents, icon: AlertTriangle, path: '/incidents', tone: stats.incidents > 0 ? 'urgent' : 'steady', cue: 'Follow-ups to review' },
    { label: 'Active Staff', value: stats.staff, icon: Shield, path: '/staff', tone: 'active', cue: 'Team coverage' },
  ];

  return (
    <motion.div
      className="p-4 sm:p-6 lg:p-8 space-y-7 cp-page"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: 'easeOut' }}
    >
      {/* Welcome */}
      <section
        className="cp-hero-panel rounded-[2rem] min-h-[250px]"
        style={{
          backgroundImage: `url(${MODULE_TREATMENTS.dashboard.asset})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="relative z-10 max-w-3xl p-7 sm:p-9">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#E8D5C6] bg-[#FFF8EA]/85 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-[#F26D2B]">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            Operator cockpit
          </div>
          <h1 className="mt-6 max-w-2xl text-4xl font-black leading-[0.98] tracking-tight text-[#2A1D15] sm:text-5xl">
            Today&apos;s operating picture
          </h1>
          <p className="mt-4 max-w-xl text-lg leading-7 text-[#5F4130]">
            Residents, incidents, medications, and handoffs in one calmer view for the work that needs attention today.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link to="/residents" className="cp-path-button cp-focus-ring rounded-2xl px-5 py-3 text-sm font-bold">
              Review resident path
            </Link>
            <Link to="/incidents" className="cp-focus-ring rounded-2xl border border-[#D4B5A0] bg-[#FFF8EA]/85 px-5 py-3 text-sm font-bold text-[#5F4130] transition hover:border-[#5D8A5D] hover:text-[#3A5638]">
              Open incident stream
            </Link>
          </div>
        </div>
      </section>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map(card => {
          const Icon = card.icon;
          const tone = getAttentionTone(card.tone);
          return (
            <AttentionCard key={card.label} to={card.path} tone={tone}>
              <div className="relative z-10 flex items-start justify-between gap-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-4xl font-black leading-none text-[#2A1D15]">
                      {loading ? '—' : card.value}
                    </p>
                    <p className="mt-2 text-sm font-bold text-[#2A1D15]">{card.label}</p>
                    <p className="mt-1 text-xs text-[#6B5F55]">{card.cue}</p>
                  </div>
                </div>
                <div className={`rounded-2xl p-3 ${tone.surface}`}>
                  <Icon className={`h-5 w-5 ${tone.text}`} aria-hidden="true" />
                </div>
              </div>
              <span className={`relative z-10 mt-5 inline-flex rounded-full px-3 py-1 text-xs font-bold ${tone.surface} ${tone.text}`}>
                {tone.label}
              </span>
            </AttentionCard>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent Residents */}
        <StreamPanel title="Resident stream" to="/residents" treatment="residents">
          <div className="flex items-center justify-between mb-4">
            <Link to="/residents" className="flex items-center gap-1 text-sm font-medium" style={{ color: '#B45309' }}>
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-3">
            {loading ? (
              <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-14 rounded-2xl animate-pulse" style={{ background: '#E5DDD0' }} />)}</div>
            ) : recentResidents.length === 0 ? (
              <p className="text-sm text-center py-6" style={{ color: '#78716C' }}>No residents yet. <Link to="/residents" className="underline" style={{ color: '#B45309' }}>Add your first resident.</Link></p>
            ) : recentResidents.map(r => (
              <div key={r.id} className="flex items-center justify-between rounded-2xl bg-white/45 px-3 py-3" style={{ border: '1px solid rgba(232,213,198,0.65)' }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-sm font-bold" style={{ background: '#5D8A5D', color: '#fff' }}>
                    {r.first_name?.[0]}{r.last_name?.[0]}
                  </div>
                  <div>
                    <p className="text-sm font-medium" style={{ color: '#1C1917' }}>{r.first_name} {r.last_name}</p>
                    <p className="text-xs" style={{ color: '#78716C' }}>{r.room ? `Room ${r.room}` : 'No room assigned'}</p>
                  </div>
                </div>
                <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={
                  r.status === 'active' ? { background: '#D1FAE5', color: '#065F46' } :
                  r.status === 'applicant' ? { background: '#DBEAFE', color: '#1E40AF' } :
                  { background: '#E5E7EB', color: '#374151' }
                }>{r.status}</span>
              </div>
            ))}
          </div>
        </StreamPanel>

        {/* Recent Incidents */}
        <StreamPanel title="Incident stream" to="/incidents" treatment="incidents">
          <div className="flex items-center justify-between mb-4">
            <Link to="/incidents" className="flex items-center gap-1 text-sm font-medium" style={{ color: '#B45309' }}>
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-3">
            {loading ? (
              <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-14 rounded-2xl animate-pulse" style={{ background: '#E5DDD0' }} />)}</div>
            ) : recentIncidents.length === 0 ? (
              <p className="text-sm text-center py-6" style={{ color: '#78716C' }}>No incidents reported. The stream is clear.</p>
            ) : recentIncidents.map(inc => (
              <div key={inc.id} className="flex items-center justify-between rounded-2xl bg-white/45 px-3 py-3" style={{ border: '1px solid rgba(232,213,198,0.65)' }}>
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0`} style={{
                    background: inc.severity === 'critical' ? '#EF4444' : inc.severity === 'high' ? '#F97316' : inc.severity === 'medium' ? '#EAB308' : '#9CA3AF'
                  }} />
                  <div>
                    <p className="text-sm font-medium capitalize" style={{ color: '#1C1917' }}>{inc.type?.replace('_', ' ')}</p>
                    <p className="text-xs" style={{ color: '#78716C' }}>{inc.incident_date}</p>
                  </div>
                </div>
                <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={
                  inc.status === 'open' ? { background: '#FEE2E2', color: '#991B1B' } :
                  inc.status === 'resolved' ? { background: '#D1FAE5', color: '#065F46' } :
                  { background: '#E5E7EB', color: '#374151' }
                }>{inc.status}</span>
              </div>
            ))}
          </div>
        </StreamPanel>
      </div>

      {/* Flagged Check-ins — immediate review */}
      <div className="rounded-[1.75rem] p-5 cp-card" style={{ background: 'rgba(255, 241, 231, 0.88)', borderColor: 'rgba(242,109,43,0.24)' }}>
        <FlaggedCheckinsPanel />
      </div>

      {/* Morning Reflections Wellness Dashboard */}
      <WellnessDashboard />

      {/* Quick actions */}
      <div className="rounded-[1.75rem] p-5 cp-card">
        <h2 className="font-bold text-base mb-4" style={{ color: '#1C1917' }}>Quick paths</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'New Intake', path: '/residents?action=new', bg: '#5D8A5D', color: '#FFF8EA', icon: Users },
            { label: 'Log Incident', path: '/incidents?action=new', bg: '#F26D2B', color: '#FFF8EA', icon: AlertTriangle },
            { label: 'Open Chat', path: '/chat', bg: '#432D21', color: '#FFF8EA', icon: ArrowRight },
            { label: 'NARR Compliance', path: '/compliance', bg: '#9B7355', color: '#FFF8EA', icon: Shield },
          ].map(a => {
            return (
              <QuickActionButton key={a.label} action={a} />
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

function AttentionCard({ children, to, tone }) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      whileHover={reduceMotion ? undefined : { y: -4 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
    >
      <Link
        to={to}
        className={`block min-h-[166px] rounded-[1.6rem] p-5 cp-card cp-card-interactive cp-attention-node cp-focus-ring ${tone.ring}`}
      >
        {children}
      </Link>
    </motion.div>
  );
}

function StreamPanel({ children, title, treatment }) {
  const moduleTreatment = MODULE_TREATMENTS[treatment] || MODULE_TREATMENTS.dashboard;

  return (
    <section className="rounded-[1.75rem] cp-card overflow-hidden">
      <div
        className="relative min-h-[112px] p-5"
        style={{
          backgroundImage: `linear-gradient(90deg, rgba(42,29,21,0.78), rgba(42,29,21,0.20)), url(${moduleTreatment.asset})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="relative z-10">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#FFB388]">{moduleTreatment.title}</p>
          <h2 className="mt-2 text-2xl font-black text-[#FFF8EA]">{title}</h2>
        </div>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function QuickActionButton({ action }) {
  const reduceMotion = useReducedMotion();
  const Icon = action.icon;

  return (
    <motion.div whileHover={reduceMotion ? undefined : { y: -3, scale: 1.01 }} transition={{ duration: 0.18 }}>
      <Link key={action.label} to={action.path} className="block cp-focus-ring rounded-2xl">
        <button
          className="w-full py-5 px-3 rounded-2xl text-sm font-bold flex flex-col items-center gap-2 shadow-lg"
          style={{ background: action.bg, color: action.color }}
        >
          <Icon className="w-5 h-5" aria-hidden="true" />
          {action.label}
        </button>
      </Link>
    </motion.div>
  );
}

// ResidentDashboard is defined below and used inline
function ResidentDashboard({ user }) {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Welcome{user?.full_name ? `, ${user.full_name.split(' ')[0]}` : ''}
        </h1>
        <p className="text-slate-500 mt-1">Your recovery journey dashboard.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link to="/my-profile">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-10 h-10 bg-teal-100 rounded-xl flex items-center justify-center">
                <Users className="w-5 h-5 text-teal-600" />
              </div>
              <div>
                <p className="font-semibold text-slate-800">My Profile</p>
                <p className="text-xs text-slate-500">View your information</p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link to="/chat">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="font-semibold text-slate-800">Community Chat</p>
                <p className="text-xs text-slate-500">Connect with your community</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
