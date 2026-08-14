import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { appClient } from '@/services/appClient';
import { Button } from '@/components/ui/button';

export default class ApplicationErrorBoundary extends React.Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    appClient.operations.reportError({
      category: 'render_error',
      component: 'Application',
      route: window.location.pathname,
      release: import.meta.env.VITE_VERCEL_GIT_COMMIT_SHA || 'local',
    }).catch(() => {});
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <section className="max-w-md text-center">
          <AlertTriangle className="w-10 h-10 mx-auto mb-4 text-amber-600" />
          <h1 className="text-xl font-bold text-slate-900">ClearPath could not load this view</h1>
          <p className="mt-2 text-sm text-slate-600">The issue was recorded without resident or form data.</p>
          <Button className="mt-5 gap-2" onClick={() => window.location.reload()}>
            <RefreshCw className="w-4 h-4" /> Reload
          </Button>
        </section>
      </main>
    );
  }
}
