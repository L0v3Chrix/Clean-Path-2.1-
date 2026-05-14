import { differenceInDays, parseISO, isValid } from 'date-fns';

// Documents required for ALL active residents
export const REQUIRED_DOCUMENTS = [
  { type: 'consent_form', label: 'Consent Form', expiresInDays: null },
  { type: 'resident_agreement', label: 'Resident Agreement', expiresInDays: null },
  { type: 'house_rules', label: 'House Rules (Signed)', expiresInDays: null },
  { type: 'intake_assessment', label: 'Intake Assessment', expiresInDays: null },
  { type: 'photo_id', label: 'Photo ID', expiresInDays: 365 * 5 },
  { type: 'release_of_information', label: 'Release of Information', expiresInDays: 365 },
  { type: 'recovery_plan', label: 'Recovery Plan', expiresInDays: 90 },
  { type: 'tb_test', label: 'TB Test', expiresInDays: 365 },
];

const EXPIRING_SOON_DAYS = 30;

/**
 * Returns alerts for a single resident given their documents array.
 * Each alert: { type: 'missing'|'expiring'|'expired', docType, label, daysUntilExpiry? }
 */
export function getResidentAlerts(resident, documents) {
  // Only flag active/applicant residents
  if (!['active', 'applicant', 'on_leave'].includes(resident.status)) return [];

  const alerts = [];
  const today = new Date();

  for (const req of REQUIRED_DOCUMENTS) {
    const doc = documents.find(d => d.document_type === req.type);

    if (!doc || doc.status === 'missing' || !doc.file_url) {
      // Also check legacy fields on resident entity itself
      if (req.type === 'consent_form' && resident.consent_signed) continue;
      if (req.type === 'resident_agreement' && resident.resident_agreement_signed) continue;
      alerts.push({ type: 'missing', docType: req.type, label: req.label });
      continue;
    }

    if (req.expiresInDays && doc.expiry_date) {
      const expiry = parseISO(doc.expiry_date);
      if (isValid(expiry)) {
        const days = differenceInDays(expiry, today);
        if (days < 0) {
          alerts.push({ type: 'expired', docType: req.type, label: req.label, daysUntilExpiry: days });
        } else if (days <= EXPIRING_SOON_DAYS) {
          alerts.push({ type: 'expiring', docType: req.type, label: req.label, daysUntilExpiry: days });
        }
      }
    } else if (req.expiresInDays && doc.signed_date) {
      // Derive expiry from signed date if no explicit expiry_date
      const signed = parseISO(doc.signed_date);
      if (isValid(signed)) {
        const expiry = new Date(signed);
        expiry.setDate(expiry.getDate() + req.expiresInDays);
        const days = differenceInDays(expiry, today);
        if (days < 0) {
          alerts.push({ type: 'expired', docType: req.type, label: req.label, daysUntilExpiry: days });
        } else if (days <= EXPIRING_SOON_DAYS) {
          alerts.push({ type: 'expiring', docType: req.type, label: req.label, daysUntilExpiry: days });
        }
      }
    }
  }

  return alerts;
}

export function getAlertSeverity(alerts) {
  if (alerts.some(a => a.type === 'expired')) return 'critical';
  if (alerts.some(a => a.type === 'missing')) return 'high';
  if (alerts.some(a => a.type === 'expiring')) return 'warning';
  return 'ok';
}