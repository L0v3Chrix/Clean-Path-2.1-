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
    { label: 'Active Residents', value: stats.residents, icon: Users, color: 'text-teal-600', bg: 'bg-teal-50', path: '/residents' },
    { label: 'Active Locations', value: stats.locations, icon: Building2, color: 'text-blue-600', bg: 'bg-blue-50', path: '/locations' },
    { label: 'Open Incidents', value: stats.incidents, icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50', path: '/incidents' },
    { label: 'Active Staff', value: stats.staff, icon: Shield, color: 'text-purple-600', bg: 'bg-purple-50', path: '/staff' },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Welcome back{user?.full_name ? `, ${user.full_name.split(' ')[0]}` : ''}
        </h1>
        <p className="text-slate-500 mt-1">Here's what's happening across your housing community today.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(card => {
          const Icon = card.icon;
          return (
            <Link key={card.label} to={card.path}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-slate-500 font-medium">{card.label}</p>
                      <p className="text-3xl font-bold text-slate-900 mt-1">
                        {loading ? '—' : card.value}
                      </p>
                    </div>
                    <div className={`w-10 h-10 rounded-xl ${card.bg} flex items-center justify-center`}>
                      <Icon className={`w-5 h-5 ${card.color}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Residents */}
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base">Recent Residents</CardTitle>
            <Link to="/residents">
              <Button variant="ghost" size="sm" className="text-teal-600 gap-1">
                View all <ArrowRight className="w-3 h-3" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-12 bg-slate-100 rounded animate-pulse" />)}</div>
            ) : recentResidents.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-4">No residents yet. <Link to="/residents" className="text-teal-600 hover:underline">Add your first resident.</Link></p>
            ) : recentResidents.map(r => (
              <div key={r.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 text-sm font-bold">
                    {r.first_name?.[0]}{r.last_name?.[0]}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{r.first_name} {r.last_name}</p>
                    <p className="text-xs text-slate-500">{r.room ? `Room ${r.room}` : 'No room assigned'}</p>
                  </div>
                </div>
                <Badge className={
                  r.status === 'active' ? 'bg-green-100 text-green-700 border-0' :
                  r.status === 'applicant' ? 'bg-blue-100 text-blue-700 border-0' :
                  'bg-slate-100 text-slate-600 border-0'
                }>
                  {r.status}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Recent Incidents */}
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base">Recent Incidents</CardTitle>
            <Link to="/incidents">
              <Button variant="ghost" size="sm" className="text-teal-600 gap-1">
                View all <ArrowRight className="w-3 h-3" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-12 bg-slate-100 rounded animate-pulse" />)}</div>
            ) : recentIncidents.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-4">No incidents reported. That's great!</p>
            ) : recentIncidents.map(inc => (
              <div key={inc.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    inc.severity === 'critical' ? 'bg-red-500' :
                    inc.severity === 'high' ? 'bg-orange-500' :
                    inc.severity === 'medium' ? 'bg-yellow-500' : 'bg-slate-400'
                  }`} />
                  <div>
                    <p className="text-sm font-medium capitalize">{inc.type?.replace('_', ' ')}</p>
                    <p className="text-xs text-slate-500">{inc.incident_date}</p>
                  </div>
                </div>
                <Badge className={
                  inc.status === 'open' ? 'bg-red-100 text-red-700 border-0' :
                  inc.status === 'resolved' ? 'bg-green-100 text-green-700 border-0' :
                  'bg-slate-100 text-slate-600 border-0'
                }>
                  {inc.status}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Quick actions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'New Intake', path: '/residents?action=new', color: 'bg-teal-50 text-teal-700 hover:bg-teal-100' },
            { label: 'Log Incident', path: '/incidents?action=new', color: 'bg-amber-50 text-amber-700 hover:bg-amber-100' },
            { label: 'Open Chat', path: '/chat', color: 'bg-blue-50 text-blue-700 hover:bg-blue-100' },
            { label: 'NARR Compliance', path: '/compliance', color: 'bg-purple-50 text-purple-700 hover:bg-purple-100' },
          ].map(a => (
            <Link key={a.label} to={a.path}>
              <button className={`w-full py-3 px-4 rounded-xl text-sm font-medium transition-colors ${a.color}`}>
                {a.label}
              </button>
            </Link>
          ))}
        </CardContent>
      </Card>
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