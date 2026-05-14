import { useState, useEffect } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import {
  Home, Users, Building2, MessageSquare, FileText,
  Shield, BarChart3, Settings, Menu, X, ChevronDown,
  LogOut, Bell, User, AlertTriangle, ClipboardList
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const roleNavMap = {
  platform_admin: ['dashboard', 'residents', 'locations', 'staff', 'incidents', 'chat', 'compliance', 'reports', 'settings'],
  owner: ['dashboard', 'residents', 'locations', 'staff', 'incidents', 'chat', 'compliance', 'reports', 'settings'],
  director: ['dashboard', 'residents', 'locations', 'staff', 'incidents', 'chat', 'compliance', 'reports'],
  house_manager: ['dashboard', 'residents', 'incidents', 'chat'],
  peer_support: ['dashboard', 'residents', 'chat'],
  case_manager: ['dashboard', 'residents', 'incidents', 'chat'],
  staff: ['dashboard', 'residents', 'chat'],
  resident: ['my_profile', 'chat', 'resources'],
};

const allNavItems = [
  { id: 'dashboard', label: 'Dashboard', icon: Home, path: '/' },
  { id: 'residents', label: 'Residents', icon: Users, path: '/residents' },
  { id: 'locations', label: 'Locations', icon: Building2, path: '/locations' },
  { id: 'staff', label: 'Staff', icon: User, path: '/staff' },
  { id: 'incidents', label: 'Incidents', icon: AlertTriangle, path: '/incidents' },
  { id: 'chat', label: 'Community Chat', icon: MessageSquare, path: '/chat' },
  { id: 'compliance', label: 'NARR Compliance', icon: Shield, path: '/compliance' },
  { id: 'reports', label: 'Reports', icon: BarChart3, path: '/reports' },
  { id: 'settings', label: 'Settings', icon: Settings, path: '/settings' },
  { id: 'my_profile', label: 'My Profile', icon: User, path: '/my-profile' },
  { id: 'resources', label: 'Resources', icon: ClipboardList, path: '/resources' },
];

export default function Layout() {
  const [user, setUser] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const userRole = user?.role || 'staff';
  const isResident = userRole === 'resident' || userRole === 'user';
  const effectiveRole = isResident ? 'resident' : userRole;
  const allowedNav = roleNavMap[effectiveRole] || roleNavMap['staff'];
  const navItems = allNavItems.filter(item => allowedNav.includes(item.id));

  const handleLogout = () => base44.auth.logout();

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed lg:relative z-50 h-full bg-slate-900 text-white flex flex-col transition-all duration-300",
        sidebarOpen ? "w-64" : "w-16",
        mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        {/* Logo */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          {sidebarOpen && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-teal-500 rounded-lg flex items-center justify-center">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="font-bold text-sm text-white">ClearPath</div>
                <div className="text-xs text-teal-400">Production 2</div>
              </div>
            </div>
          )}
          {!sidebarOpen && (
            <div className="w-8 h-8 bg-teal-500 rounded-lg flex items-center justify-center mx-auto">
              <Shield className="w-5 h-5 text-white" />
            </div>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="hidden lg:flex text-slate-400 hover:text-white p-1"
          >
            <Menu className="w-4 h-4" />
          </button>
        </div>

        {/* Role badge */}
        {sidebarOpen && user && (
          <div className="px-4 py-3 border-b border-slate-700">
            <div className="text-xs text-slate-400 mb-1">{user.full_name || user.email}</div>
            <Badge className="bg-teal-500/20 text-teal-400 border-teal-500/30 text-xs capitalize">
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
                className={cn(
                  "flex items-center gap-3 px-4 py-3 text-sm transition-colors",
                  active
                    ? "bg-teal-500/20 text-teal-400 border-r-2 border-teal-400"
                    : "text-slate-400 hover:text-white hover:bg-slate-800"
                )}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {sidebarOpen && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="p-4 border-t border-slate-700">
          <button
            onClick={handleLogout}
            className={cn(
              "flex items-center gap-3 text-slate-400 hover:text-white text-sm w-full",
              !sidebarOpen && "justify-center"
            )}
          >
            <LogOut className="w-4 h-4" />
            {sidebarOpen && "Sign Out"}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between flex-shrink-0">
          <button
            className="lg:hidden text-slate-600"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="text-sm text-slate-500 hidden sm:block">
            Recovery-Oriented Housing Platform
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2 text-slate-400 hover:text-slate-600 relative">
              <Bell className="w-4 h-4" />
            </button>
            <div className="text-sm font-medium text-slate-700">
              {user?.full_name || user?.email || ''}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}