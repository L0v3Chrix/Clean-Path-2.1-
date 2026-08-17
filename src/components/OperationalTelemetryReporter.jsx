import { useEffect } from 'react';
import { appClient } from '@/services/appClient';

export default function OperationalTelemetryReporter() {
  useEffect(() => {
    const report = () => {
      appClient.operations.reportError({
        category: 'unhandled_error',
        component: 'Application',
        route: window.location.pathname,
        release: import.meta.env.VITE_VERCEL_GIT_COMMIT_SHA || 'local',
      }).catch(() => {});
    };
    window.addEventListener('error', report);
    window.addEventListener('unhandledrejection', report);
    return () => {
      window.removeEventListener('error', report);
      window.removeEventListener('unhandledrejection', report);
    };
  }, []);
  return null;
}
