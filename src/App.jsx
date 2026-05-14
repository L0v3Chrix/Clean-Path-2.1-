import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import Layout from './components/Layout';

// Page imports
import Dashboard from './pages/Dashboard';
import Residents from './pages/Residents';
import Locations from './pages/Locations';
import Staff from './pages/Staff';
import Incidents from './pages/Incidents';
import Chat from './pages/Chat';
import Compliance from './pages/Compliance';
import Inventory from './pages/Inventory';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-slate-200 border-t-teal-500 rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-sm text-slate-500">Loading ClearPath...</p>
        </div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/residents" element={<Residents />} />
        <Route path="/locations" element={<Locations />} />
        <Route path="/staff" element={<Staff />} />
        <Route path="/incidents" element={<Incidents />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/compliance" element={<Compliance />} />
        <Route path="/inventory" element={<Inventory />} />
        <Route path="/reports" element={<ComingSoon title="Reports & Analytics" description="Outcome data, occupancy reports, incident trends, and quality improvement metrics." />} />
        <Route path="/settings" element={<ComingSoon title="Organization Settings" description="Configure your housing types, recovery pathways, harm reduction modules, and platform preferences." />} />
        <Route path="/my-profile" element={<ComingSoon title="My Profile" description="Your personal recovery journey dashboard, documents, and information." />} />
        <Route path="/resources" element={<ComingSoon title="Resources" description="Community resource directory, local services, and recovery support tools." />} />
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function ComingSoon({ title, description }) {
  return (
    <div className="p-6 flex items-center justify-center min-h-64">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 bg-teal-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <div className="w-8 h-8 bg-teal-500 rounded-lg" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">{title}</h2>
        <p className="text-slate-500 text-sm">{description}</p>
        <div className="mt-4 inline-flex items-center gap-2 bg-teal-50 text-teal-700 px-4 py-2 rounded-full text-sm font-medium">
          Coming in Phase 2
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App