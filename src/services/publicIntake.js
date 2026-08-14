const CLIENT_FIELDS = [
  'first_name', 'last_name', 'date_of_birth', 'gender_identity', 'pronouns', 'phone',
  'email', 'emergency_contact_name', 'emergency_contact_phone',
  'emergency_contact_relationship', 'sober_date', 'recovery_pathway', 'referred_by',
  'notes', 'location_id', 'room', 'intake_date', 'race', 'ethnicity',
  'primary_language', 'sexual_orientation', 'veteran_status', 'disability_status',
  'housing_status_at_intake', 'religion_spirituality', 'interpreter_needed',
  'substances_used', 'treatment_history', 'mat_medications',
];

export function publicIntakeToken(search = window.location.search) {
  return new URLSearchParams(search).get('token')?.trim() || '';
}

export function buildPublicIntakePayload({ token, form, signatureDataUrl, documents = {} }) {
  const application = Object.fromEntries(
    CLIENT_FIELDS.filter((field) => form[field] !== undefined).map((field) => [field, form[field]]),
  );
  application.background_check_consent = true;
  application.resident_agreement_signed = true;

  return {
    token,
    application,
    signature_data_url: signatureDataUrl,
    documents: Object.entries(documents).map(([key, document]) => ({
      key,
      file_name: document.name,
      data_url: document.data_url,
    })),
  };
}

function endpoint() {
  const url = import.meta.env.VITE_SUPABASE_URL;
  if (!url) throw new Error('Public intake is not configured.');
  return `${url}/functions/v1/public-intake`;
}

async function request(method, body) {
  const response = await fetch(endpoint(), {
    method,
    headers: {
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: method === 'GET' ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Public intake request failed.');
  return data;
}

export function loadPublicIntake(token) {
  return request('POST', { action: 'configuration', token });
}

export function submitPublicIntake(payload) {
  return request('POST', { action: 'submit', ...payload });
}

export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error(`Unable to read ${file.name}.`));
    reader.readAsDataURL(file);
  });
}
