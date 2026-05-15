import { useState, useEffect } from 'react';
import { Link, useLocation, Outlet, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import {
  Home, Users, Building2, MessageSquare, FileText,
  Shield, BarChart3, Settings, Menu, X, ChevronDown,
  LogOut, Bell, User, AlertTriangle, ClipboardList, Package, TrendingUp, CalendarDays,
  DollarSign, BookOpen, Lock, Zap, PieChart, Award, Activity, ClipboardCheck
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
const cn = (...inputs) => twMerge(clsx(inputs));

const FULL_NAV = ['dashboard', 'applications', 'residents', 'locations', 'staff', 'scheduling', 'incidents', 'incident_safety', 'chat', 'compliance', 'inventory', 'analytics', 'grants', 'outcomes', 'finance', 'training', 'hipaa', 'integrations', 'reports', 'settings'];

const roleNavMap = {
  admin:          FULL_NAV,
  platform_admin: FULL_NAV,
  owner:          FULL_NAV,
  director:       ['dashboard', 'applications', 'residents', 'locations', 'staff', 'scheduling', 'incidents', 'incident_safety', 'chat', 'compliance', 'inventory', 'analytics', 'grants', 'outcomes', 'finance', 'training', 'hipaa', 'reports'],
  house_manager:  ['dashboard', 'applications', 'residents', 'scheduling', 'incidents', 'incident_safety', 'chat', 'inventory', 'training'],
  peer_support:   ['dashboard', 'residents', 'chat', 'training'],
  case_manager:   ['dashboard', 'applications', 'residents', 'incidents', 'incident_safety', 'chat', 'inventory', 'training'],
  staff:          ['dashboard', 'applications', 'residents', 'chat', 'training'],
  resident:       ['my_profile', 'chat', 'resources'],
};

const allNavItems = [
  { id: 'dashboard', label: 'Dashboard', icon: Home, path: '/' },
  { id: 'applications', label: 'Applications', icon: ClipboardCheck, path: '/intake' },
  { id: 'residents', label: 'Residents', icon: Users, path: '/residents' },
  { id: 'locations', label: 'Locations', icon: Building2, path: '/locations' },
  { id: 'staff', label: 'Staff', icon: User, path: '/staff' },
  { id: 'scheduling', label: 'Scheduling', icon: CalendarDays, path: '/scheduling' },
  { id: 'incidents', label: 'Incidents', icon: AlertTriangle, path: '/incidents' },
  { id: 'incident_safety', label: 'Safety Trends', icon: TrendingUp, path: '/incident-safety' },
  { id: 'chat', label: 'Community Chat', icon: MessageSquare, path: '/chat' },
  { id: 'compliance', label: 'NARR Compliance', icon: Shield, path: '/compliance' },
  { id: 'inventory', label: 'Med Inventory', icon: Package, path: '/inventory' },
  { id: 'reports', label: 'Reports', icon: BarChart3, path: '/reports' },
  { id: 'settings', label: 'Settings', icon: Settings, path: '/settings' },
  { id: 'analytics', label: 'Analytics', icon: PieChart, path: '/analytics' },
  { id: 'grants', label: 'Grant Management', icon: Award, path: '/grants' },
  { id: 'finance', label: 'Finance & Expenses', icon: DollarSign, path: '/finance' },
  { id: 'training', label: 'Training Center', icon: BookOpen, path: '/training' },
  { id: 'outcomes', label: 'Outcomes & Impact', icon: Activity, path: '/outcomes' },
  { id: 'hipaa', label: 'HIPAA Compliance', icon: Lock, path: '/hipaa' },
  { id: 'integrations', label: 'Integrations', icon: Zap, path: '/integrations' },
  { id: 'my_profile', label: 'My Profile', icon: User, path: '/my-profile' },
  { id: 'resources', label: 'Resources', icon: ClipboardList, path: '/resources' },
];

export default function Layout() {
  const [user, setUser] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    base44.auth.me().then(me => {
      setUser(me);
      // Redirect residents to their portal if they land on admin pages
      const isResident = me?.role === 'resident' || me?.role === 'user';
      const adminPaths = ['/residents', '/locations', '/staff', '/incidents', '/compliance', '/inventory', '/incident-safety', '/scheduling'];
      if (isResident && (location.pathname === '/' || adminPaths.includes(location.pathname))) {
        navigate('/my-profile', { replace: true });
      }
    }).catch(() => {});
  }, []);

  const userRole = user?.role || 'staff';
  const isResident = userRole === 'resident' || userRole === 'user';
  const effectiveRole = isResident ? 'resident' : userRole;
  const allowedNav = roleNavMap[effectiveRole] || roleNavMap['staff'];
  const navItems = allNavItems.filter(item => allowedNav.includes(item.id));

  const handleLogout = () => base44.auth.logout();

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#FAF6EF' }}>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed lg:relative z-50 h-full flex flex-col transition-all duration-300",
        sidebarOpen ? "w-64" : "w-16",
        mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )} style={{ background: '#1C1917', color: '#E7DDD0' }}>
        {/* Logo */}
        <div className="flex items-center justify-between p-4" style={{ borderBottom: '1px solid #2C2825' }}>
          {sidebarOpen && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#B45309' }}>
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="font-bold text-sm text-white">ClearPath</div>
                <div className="text-xs" style={{ color: '#F59E0B' }}>Production 2</div>
              </div>
            </div>
          )}
          {!sidebarOpen && (
            <div className="w-8 h-8 rounded-lg flex items-center justify-center mx-auto" style={{ background: '#B45309' }}>
              <Shield className="w-5 h-5 text-white" />
            </div>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="hidden lg:flex p-1 hover:text-white"
            style={{ color: '#8C7B6E' }}
          >
            <Menu className="w-4 h-4" />
          </button>
        </div>

        {/* Role badge */}
        {sidebarOpen && user && (
          <div className="px-4 py-3" style={{ borderBottom: '1px solid #2C2825' }}>
            <div className="text-xs mb-1" style={{ color: '#A09080' }}>{user.full_name || user.email}</div>
            <Badge className="text-xs capitalize border-0" style={{ background: '#B45309', color: '#fff' }}>
              {effectiveRole.replace('_', ' ')}
            </Badge>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 py-4 overflow-y-auto">
          {navItems.map(item => {
            const Icon = item.icon;
            const active = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
            return (
              <Link
                key={item.id}
                to={item.path}
                onClick={() => setMobileOpen(false)}
                className={cn("flex items-center gap-3 px-4 py-2.5 text-sm transition-colors")}
                style={active
                  ? { background: '#2C2420', color: '#F59E0B', borderRight: '2px solid #F59E0B' }
                  : { color: '#A09080' }
                }
                onMouseEnter={e => { if (!active) { e.currentTarget.style.color = '#E7DDD0'; e.currentTarget.style.background = '#252220'; } }}
                onMouseLeave={e => { if (!active) { e.currentTarget.style.color = '#A09080'; e.currentTarget.style.background = 'transparent'; } }}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {sidebarOpen && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="p-4" style={{ borderTop: '1px solid #2C2825' }}>
          <button
            onClick={handleLogout}
            className={cn("flex items-center gap-3 text-sm w-full hover:text-white transition-colors", !sidebarOpen && "justify-center")}
            style={{ color: '#8C7B6E' }}
          >
            <LogOut className="w-4 h-4" />
            {sidebarOpen && "Sign Out"}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="px-4 py-3 flex items-center justify-between flex-shrink-0" style={{ background: '#1C1917', borderBottom: '1px solid #2C2825' }}>
          <button
            className="lg:hidden"
            style={{ color: '#A09080' }}
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="hidden sm:flex items-center gap-2">
            <span className="text-sm font-bold" style={{ color: '#FFFFFF' }}>ClearPath</span>
            <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: '#B45309', color: '#FEF3C7' }}>
              Recovery-Oriented Housing Platform
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2 relative" style={{ color: '#A09080' }}>
              <Bell className="w-4 h-4" />
            </button>
            <div className="text-sm font-medium" style={{ color: '#E7DDD0' }}>
              {user?.full_name || user?.email || ''}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto" style={{ background: '#FAF6EF' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}