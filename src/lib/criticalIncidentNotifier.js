import { appClient } from '@/services/appClient';

/**
 * Ask the server to authorize and notify recipients for a saved critical incident.
 * Incident details and recipient records never cross this client boundary.
 */
export async function notifyCriticalIncident(incident) {
  if (incident.severity !== 'critical') return;

  const incidentUrl = `${window.location.origin}/incidents?view=${encodeURIComponent(incident.id)}`;

  try {
    const result = await appClient.functions.invoke('critical-incident-notify', {
      incident_id: incident.id,
    });

    return {
      incidentUrl,
      eligibleRecipientCount: result?.eligibleRecipientCount || 0,
      deliveredCount: result?.deliveredCount || 0,
      failedCount: result?.failedCount || 0,
      providerConfigured: result?.providerConfigured === true,
      notificationFailed: false,
    };
  } catch {
    return {
      incidentUrl,
      eligibleRecipientCount: 0,
      deliveredCount: 0,
      failedCount: 0,
      providerConfigured: false,
      notificationFailed: true,
    };
  }
}
