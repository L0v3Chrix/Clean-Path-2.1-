import { useState, useEffect } from 'react';
import { Link, Navigate, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { appClient } from '@/services/appClient';
import { demoModeEnabled } from '@/lib/authBypass';
import { canAccessRoute, defaultRouteForRole, navForRole } from '@/lib/routeAccess';
import { deriveOnboardingFlow, normalizeOnboardingProgress } from '@/lib/onboardingFlows';
import { fromOnboardingRow, toOnboardingSaveInput } from '@/lib/onboardingPersistence';
import OnboardingGuide from '@/components/onboarding/OnboardingGuide';
import {
  Home, Users, Building2, MessageSquare,
  Shield, BarChart3, Settings, Menu,
  LogOut, Bell, User, AlertTriangle, ClipboardList, Package, TrendingUp, CalendarDays,
  DollarSign, BookOpen, Lock, Zap, PieChart, Award, Activity, ClipboardCheck, FolderLock, Play, BedDouble, CircleHelp
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
const cn = (...inputs) => twMerge(clsx(inputs));

const allNavItems = [
  { id: 'dashboard', label: 'Dashboard', icon: Home, path: '/' },
  { id: 'applications', label: 'Applications', icon: ClipboardCheck, path: '/intake' },
  { id: 'residents', label: 'Residents', icon: Users, path: '/residents' },
  { id: 'bed_capacity', label: 'Bed Capacity', icon: BedDouble, path: '/bed-capacity' },
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
  { id: 'masterlist', label: 'Masterlist', icon: Users, path: '/masterlist' },
  { id: 'chores', label: 'Chore Management', icon: ClipboardList, path: '/chores' },
  { id: 'integrations', label: 'Integrations', icon: Zap, path: '/integrations' },
  { id: 'secure_docs', label: 'Secure Documents', icon: FolderLock, path: '/secure-docs' },
  { id: 'my_profile', label: 'My Profile', icon: User, path: '/my-profile' },
  { id: 'resources', label: 'Resources', icon: ClipboardList, path: '/resources' },
  { id: 'presentation', label: 'Sales Presentation', icon: Play, path: '/presentation' },
];

export default function Layout() {
  const [user, setUser] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [onboardingProgress, setOnboardingProgress] = useState(null);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [onboardingError, setOnboardingError] = useState('');
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    appClient.auth.me().then(me => {
      setUser(me);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!user?.id || !user.organization_id) return undefined;
    const flow = deriveOnboardingFlow(user.role);
    if (!flow) return undefined;

    let active = true;
    const loadProgress = async () => {
      try {
        const row = await appClient.onboarding.get({
          organizationId: user.organization_id,
          userId: user.id,
          flow: flow.id,
          version: flow.version,
        });
        const nextProgress = normalizeOnboardingProgress(user.role, fromOnboardingRow(row));
        if (!row) {
          await appClient.onboarding.save(toOnboardingSaveInput({
            organizationId: user.organization_id,
            userId: user.id,
            progress: nextProgress,
          }));
        }
        if (!active) return;
        setOnboardingProgress(nextProgress);
        setOnboardingOpen(!row || nextProgress.status === 'active');
      } catch {
        if (!active) return;
        setOnboardingProgress(normalizeOnboardingProgress(user.role, null));
        setOnboardingError('Walkthrough progress is temporarily unavailable.');
      }
    };
    loadProgress();
    return () => { active = false; };
  }, [user]);

  if (!user) {
    return <div className="fixed inset-0 flex items-center justify-center bg-slate-50 text-sm text-slate-600">Loading workspace...</div>;
  }

  const userRole = user.role;
  const effectiveRole = userRole;
  const allowedNav = navForRole(effectiveRole);
  const navItems = allNavItems.filter(item => allowedNav.includes(item.id));

  if (allowedNav.length === 0) {
    return <div className="fixed inset-0 flex items-center justify-center bg-slate-50 text-sm text-slate-700">This account does not have an assigned ClearPath role.</div>;
  }

  if (!canAccessRoute(effectiveRole, location.pathname)) {
    return <Navigate to={defaultRouteForRole(effectiveRole)} replace />;
  }

  const handleLogout = () => appClient.auth.logout();

  const handleOnboardingSave = async (nextProgress) => {
    setOnboardingProgress(nextProgress);
    setOnboardingError('');
    try {
      await appClient.onboarding.save(toOnboardingSaveInput({
        organizationId: user.organization_id,
        userId: user.id,
        progress: nextProgress,
      }));
    } catch {
      setOnboardingError('Walkthrough progress could not be saved. Try again before signing out.');
    }
  };

  return (
    <div className="flex h-screen overflow-hidden cp-page cp-texture-bg">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed lg:relative z-50 h-full flex flex-col transition-all duration-300 cp-shell",
        sidebarOpen ? "w-64" : "w-16",
        mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        {/* Logo */}
        <div className="flex items-center justify-between p-4" style={{ borderBottom: '1px solid rgba(212,181,160,0.18)' }}>
          {sidebarOpen && (
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-2xl flex items-center justify-center shadow-lg" style={{ background: 'linear-gradient(135deg, #5D8A5D, #3A5638)' }}>
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="font-bold text-sm text-[#FFF8EA]">ClearPath</div>
                <div className="text-xs" style={{ color: '#FFB388' }}>Operator cockpit</div>
              </div>
            </div>
          )}
          {!sidebarOpen && (
            <div className="w-9 h-9 rounded-2xl flex items-center justify-center mx-auto" style={{ background: 'linear-gradient(135deg, #5D8A5D, #3A5638)' }}>
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
          <div className="px-4 py-3" style={{ borderBottom: '1px solid rgba(212,181,160,0.18)' }}>
            <div className="text-xs mb-1" style={{ color: '#A09080' }}>{user.full_name || user.email}</div>
            <Badge className="text-xs capitalize border-0" style={{ background: '#432D21', color: '#FFB388' }}>
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
                  ? { background: 'rgba(67,45,33,0.88)', color: '#FFB388', borderRight: '2px solid #F26D2B' }
                  : { color: '#D4B5A0' }
                }
                onMouseEnter={e => { if (!active) { e.currentTarget.style.color = '#FFF8EA'; e.currentTarget.style.background = 'rgba(255,248,234,0.06)'; } }}
                onMouseLeave={e => { if (!active) { e.currentTarget.style.color = '#D4B5A0'; e.currentTarget.style.background = 'transparent'; } }}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {sidebarOpen && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="p-4" style={{ borderTop: '1px solid rgba(212,181,160,0.18)' }}>
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
        <header className="px-4 py-3 flex items-center justify-between flex-shrink-0 cp-topbar">
          <button
            className="lg:hidden"
            style={{ color: '#A09080' }}
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="hidden sm:flex items-center gap-2">
            <span className="text-sm font-bold" style={{ color: '#FFFFFF' }}>ClearPath</span>
            <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: '#432D21', color: '#FFB388' }}>
              Recovery-Oriented Housing Platform
            </span>
          </div>
          <div className="flex items-center gap-2">
            {onboardingProgress && (
              <button
                type="button"
                className="cp-focus-ring inline-flex h-9 w-9 items-center justify-center rounded-md text-[#A09080] transition-colors hover:bg-white/10 hover:text-white"
                onClick={() => setOnboardingOpen(true)}
                aria-label="Open guided walkthrough"
                title="Guided walkthrough"
              >
                <CircleHelp className="h-4 w-4" />
              </button>
            )}
            <button className="p-2 relative" style={{ color: '#A09080' }}>
              <Bell className="w-4 h-4" />
            </button>
            <div className="text-sm font-medium" style={{ color: '#E7DDD0' }}>
              {user?.full_name || user?.email || ''}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto cp-page cp-texture-bg">
          {demoModeEnabled && (
            <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
              Demo mode: this workspace uses fake sample data only. Do not enter real resident information or PHI here.
            </div>
          )}
          {onboardingError && (
            <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900" role="status">
              {onboardingError}
            </div>
          )}
          <Outlet />
        </main>
      </div>
      <OnboardingGuide
        userRole={effectiveRole}
        progress={onboardingProgress}
        open={onboardingOpen}
        onOpenChange={setOnboardingOpen}
        onSave={handleOnboardingSave}
        onNavigate={(path) => navigate(path)}
      />
    </div>
  );
}
