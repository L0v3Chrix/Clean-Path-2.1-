import { base44 } from '@/api/base44Client';

/**
 * Fire in-app toast + email alerts for a newly created critical incident.
 * @param {object} incident  - the saved incident record (must have .id)
 * @param {array}  staffList - array of StaffMember records
 * @param {array}  locations - array of Location records
 */
export async function notifyCriticalIncident(incident, staffList, locations) {
  if (incident.severity !== 'critical') return;

  const appUrl = window.location.origin;
  const incidentUrl = `${appUrl}/incidents?view=${incident.id}`;
  const locationName = locations.find(l => l.id === incident.location_id)?.name || 'Unknown location';
  const incidentType = incident.type?.replace(/_/g, ' ') || 'incident';
  const dateStr = incident.incident_date || new Date().toISOString().split('T')[0];

  // Send email to every active staff member who has an email address
  const recipients = staffList.filter(s => s.status === 'active' && s.email);

  const emailPromises = recipients.map(staffMember =>
    base44.integrations.Core.SendEmail({
      to: staffMember.email,
      subject: `🔴 CRITICAL Incident Alert — ${incidentType} at ${locationName}`,
      body: `
<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #FAF6EF;">
  <div style="background: #FEE2E2; border: 1px solid #FECACA; border-radius: 12px; padding: 16px 20px; margin-bottom: 20px;">
    <p style="margin: 0; font-size: 18px; font-weight: 700; color: #991B1B;">🔴 Critical Incident Logged</p>
    <p style="margin: 4px 0 0; font-size: 13px; color: #B91C1C;">Immediate attention may be required</p>
  </div>

  <table style="width: 100%; border-collapse: collapse; font-size: 14px; color: #1C1917;">
    <tr style="border-bottom: 1px solid #E0D5C5;">
      <td style="padding: 10px 4px; font-weight: 600; width: 40%; color: #78716C;">Type</td>
      <td style="padding: 10px 4px; text-transform: capitalize;">${incidentType}</td>
    </tr>
    <tr style="border-bottom: 1px solid #E0D5C5;">
      <td style="padding: 10px 4px; font-weight: 600; color: #78716C;">Location</td>
      <td style="padding: 10px 4px;">${locationName}</td>
    </tr>
    <tr style="border-bottom: 1px solid #E0D5C5;">
      <td style="padding: 10px 4px; font-weight: 600; color: #78716C;">Date</td>
      <td style="padding: 10px 4px;">${dateStr}${incident.incident_time ? ' at ' + incident.incident_time : ''}</td>
    </tr>
    <tr style="border-bottom: 1px solid #E0D5C5;">
      <td style="padding: 10px 4px; font-weight: 600; color: #78716C;">Description</td>
      <td style="padding: 10px 4px;">${incident.description || '—'}</td>
    </tr>
    ${incident.action_taken ? `
    <tr>
      <td style="padding: 10px 4px; font-weight: 600; color: #78716C;">Action Taken</td>
      <td style="padding: 10px 4px;">${incident.action_taken}</td>
    </tr>` : ''}
  </table>

  <div style="margin-top: 24px; text-align: center;">
    <a href="${incidentUrl}" style="display: inline-block; background: #B45309; color: #fff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 600; font-size: 14px;">
      View Incident Report →
    </a>
  </div>

  <p style="margin-top: 24px; font-size: 12px; color: #A09080; text-align: center;">
    This alert was sent automatically by ClearPath. You are receiving this because you are an active staff member.
  </p>
</div>
      `.trim(),
    }).catch(err => console.error(`Failed to email ${staffMember.email}:`, err))
  );

  await Promise.allSettled(emailPromises);
  return { incidentUrl, recipientCount: recipients.length };
}