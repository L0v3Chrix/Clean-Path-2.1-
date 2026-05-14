import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { Users, Building2, AlertTriangle, Shield, TrendingUp, Clock, CheckCircle, XCircle, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

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
        base44.auth.me(),
        base44.entities.Resident.list('-created_date', 50),
        base44.entities.Location.list(),
        base44.entities.IncidentReport.list('-created_date', 50),
        base44.entities.StaffMember.list(),
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
    { label: 'Active Residents', value: stats.residents, icon: Users, iconColor: '#B45309', borderColor: '#D97706', path: '/residents' },
    { label: 'Active Locations', value: stats.locations, icon: Building2, iconColor: '#B45309', borderColor: '#D97706', path: '/locations' },
    { label: 'Open Incidents', value: stats.incidents, icon: AlertTriangle, iconColor: '#B45309', borderColor: '#D97706', path: '/incidents' },
    { label: 'Active Staff', value: stats.staff, icon: Shield, iconColor: '#B45309', borderColor: '#D97706', path: '/staff' },
  ];

  return (
    <div className="p-6 space-y-6" style={{ background: '#FAF6EF', minHeight: '100%' }}>
      {/* Welcome */}
      <div>
        <h1 className="text-3xl font-bold" style={{ color: '#1C1917' }}>
          Welcome back{user?.full_name ? `, ${user.full_name.split(' ')[0]}` : ''}
        </h1>
        <p className="mt-1" style={{ color: '#78716C' }}>Here's what's happening across your housing community today.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(card => {
          const Icon = card.icon;
          return (
            <Link key={card.label} to={card.path}>
              <div className="rounded-2xl p-4 cursor-pointer transition-shadow hover:shadow-md" style={{ background: '#F0E9DC', borderLeft: `3px solid ${card.borderColor}` }}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-3xl font-bold" style={{ color: '#1C1917' }}>
                      {loading ? '—' : card.value}
                    </p>
                    <p className="text-sm mt-1" style={{ color: '#78716C' }}>{card.label}</p>
                  </div>
                  <Icon className="w-6 h-6 mt-1" style={{ color: card.iconColor }} />
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Residents */}
        <div className="rounded-2xl p-5" style={{ background: '#F0E9DC', border: '1px solid #E0D5C5' }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-base" style={{ color: '#1C1917' }}>Recent Residents</h2>
            <Link to="/residents" className="flex items-center gap-1 text-sm font-medium" style={{ color: '#B45309' }}>
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-3">
            {loading ? (
              <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-12 rounded-xl animate-pulse" style={{ background: '#E5DDD0' }} />)}</div>
            ) : recentResidents.length === 0 ? (
              <p className="text-sm text-center py-6" style={{ color: '#78716C' }}>No residents yet. <Link to="/residents" className="underline" style={{ color: '#B45309' }}>Add your first resident.</Link></p>
            ) : recentResidents.map(r => (
              <div key={r.id} className="flex items-center justify-between py-2" style={{ borderBottom: '1px solid #DDD5C5' }}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: '#D97706', color: '#fff' }}>
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
        </div>

        {/* Recent Incidents */}
        <div className="rounded-2xl p-5" style={{ background: '#F0E9DC', border: '1px solid #E0D5C5' }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-base" style={{ color: '#1C1917' }}>Recent Incidents</h2>
            <Link to="/incidents" className="flex items-center gap-1 text-sm font-medium" style={{ color: '#B45309' }}>
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-3">
            {loading ? (
              <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-12 rounded-xl animate-pulse" style={{ background: '#E5DDD0' }} />)}</div>
            ) : recentIncidents.length === 0 ? (
              <p className="text-sm text-center py-6" style={{ color: '#78716C' }}>No incidents reported. That's great!</p>
            ) : recentIncidents.map(inc => (
              <div key={inc.id} className="flex items-center justify-between py-2" style={{ borderBottom: '1px solid #DDD5C5' }}>
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
        </div>
      </div>

      {/* Quick actions */}
      <div className="rounded-2xl p-5" style={{ background: '#F0E9DC', border: '1px solid #E0D5C5' }}>
        <h2 className="font-semibold text-base mb-4" style={{ color: '#1C1917' }}>Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'New Intake', path: '/residents?action=new', bg: '#86B8B1', color: '#1C3A37', icon: Users },
            { label: 'Log Incident', path: '/incidents?action=new', bg: '#C9A227', color: '#3D2E00', icon: AlertTriangle },
            { label: 'Open Chat', path: '/chat', bg: '#4A6B8A', color: '#E8F0F8', icon: ArrowRight },
            { label: 'NARR Compliance', path: '/compliance', bg: '#8B6BAE', color: '#F3EEF8', icon: Shield },
          ].map(a => {
            const Icon = a.icon;
            return (
              <Link key={a.label} to={a.path}>
                <button className="w-full py-5 px-3 rounded-2xl text-sm font-medium transition-opacity hover:opacity-90 flex flex-col items-center gap-2"
                  style={{ background: a.bg, color: a.color }}>
                  <Icon className="w-5 h-5" />
                  {a.label}
                </button>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
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