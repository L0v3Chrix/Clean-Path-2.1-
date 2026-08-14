const TEXT_FIELDS = [
  'first_name', 'last_name', 'gender_identity', 'pronouns', 'phone', 'email',
  'sober_date', 'recovery_pathway', 'referred_by', 'notes', 'location_id', 'room',
  'intake_date', 'race', 'ethnicity', 'primary_language', 'sexual_orientation',
  'veteran_status', 'disability_status', 'housing_status_at_intake',
  'religion_spirituality',
];

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function cleanText(value: unknown, maximum = 4000) {
  return typeof value === 'string' ? value.trim().slice(0, maximum) : undefined;
}

export function normalizePublicIntake(input: Record<string, unknown> = {}) {
  const errors: string[] = [];
  const firstName = cleanText(input.first_name, 100);
  const lastName = cleanText(input.last_name, 100);
  const dateOfBirth = cleanText(input.date_of_birth, 10);

  if (!firstName) errors.push('First name is required.');
  if (!lastName) errors.push('Last name is required.');
  if (!dateOfBirth || !DATE_PATTERN.test(dateOfBirth)) errors.push('A valid date of birth is required.');
  if (input.background_check_consent !== true) errors.push('Background-check consent is required.');
  if (input.resident_agreement_signed !== true) errors.push('Resident-agreement consent is required.');

  const resident: Record<string, unknown> = {};
  for (const field of TEXT_FIELDS) {
    const value = cleanText(input[field]);
    if (value) resident[field] = value;
  }
  Object.assign(resident, {
    first_name: firstName,
    last_name: lastName,
    date_of_birth: dateOfBirth,
    interpreter_needed: input.interpreter_needed === true,
    status: 'applicant',
    consent_signed: true,
    resident_agreement_signed: true,
    background_check_consent: true,
    background_check_status: 'not_started',
    background_check_date: new Date().toISOString().slice(0, 10),
  });

  const intakeNotes = [
    cleanText(input.notes) ? `[Intake Form]\n${cleanText(input.notes)}` : '[Intake Form - submitted digitally]',
    cleanText(input.substances_used) ? `Substances: ${cleanText(input.substances_used)}` : '',
    cleanText(input.treatment_history) ? `Treatment history: ${cleanText(input.treatment_history)}` : '',
    cleanText(input.mat_medications) ? `MAT medications: ${cleanText(input.mat_medications)}` : '',
  ].filter(Boolean).join('\n');
  resident.notes = intakeNotes;

  const emergencyContact = cleanText(input.emergency_contact_name, 200) ? {
    name: cleanText(input.emergency_contact_name, 200),
    relationship: cleanText(input.emergency_contact_relationship, 100),
    phone: cleanText(input.emergency_contact_phone, 100),
    is_emergency_contact: true,
  } : null;

  return { ok: errors.length === 0, errors, resident, emergencyContact };
}
