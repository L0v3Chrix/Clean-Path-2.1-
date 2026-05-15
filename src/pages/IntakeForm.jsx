import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import {
  CheckCircle, ChevronRight, ChevronLeft, Shield, PenLine,
  RotateCcw, Loader2, Upload, FileText, X, AlertCircle, Search
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

const STEPS = [
  { id: 'personal',      label: 'Personal Info',        icon: '👤' },
  { id: 'demographics',  label: 'Demographics',         icon: '🌍' },
  { id: 'contact',       label: 'Emergency Contact',    icon: '📞' },
  { id: 'recovery',      label: 'Recovery Info',        icon: '💚' },
  { id: 'placement',     label: 'Housing Placement',    icon: '🏠' },
  { id: 'documents',     label: 'Documents',            icon: '📄' },
  { id: 'background',    label: 'Background Check',     icon: '🔍' },
  { id: 'rules',         label: 'Agreement & Signature', icon: '✍️' },
];

const REQUIRED_DOCS = [
  { key: 'photo_id',       label: 'Government-Issued Photo ID', doc_type: 'photo_id',      required: true  },
  { key: 'insurance_card', label: 'Insurance Card',             doc_type: 'insurance_card', required: false },
  { key: 'release_of_info',label: 'Release of Information',     doc_type: 'release_of_information', required: false },
  { key: 'tb_test',        label: 'TB Test Result',             doc_type: 'tb_test',        required: false },
];

const DEFAULT_HOUSE_RULES = `[Your Organization Name] — House Guidelines & Resident Agreement

1. SOBRIETY: All residents must maintain complete abstinence from all non-prescribed mood-altering substances. Any use is grounds for immediate discharge.

2. DRUG TESTING: Residents consent to random drug and alcohol testing at any time, without prior notice.

3. MEETINGS: Residents are required to attend a minimum of [X] recovery support meetings per week and provide documentation.

4. CURFEW: All residents must comply with house curfew as posted. Exceptions require advance approval from the house manager.

5. CHORES: Each resident is assigned weekly household responsibilities. Completion is mandatory.

6. GUESTS: Guests are permitted only in common areas and only during approved visiting hours. No overnight guests without prior approval.

7. FEES: Resident agrees to pay program fees on or before the due date. Non-payment may result in discharge.

8. CONDUCT: All residents will treat fellow residents, staff, and neighbors with respect. Violence, threats, harassment, or intimidation will result in immediate discharge.

9. MEDICATIONS: All prescription medications must be disclosed to staff and stored per house protocol.

10. CONFIDENTIALITY: Residents will respect the privacy of fellow residents and keep house matters within the house.

11. PROPERTY: Residents are responsible for their personal belongings. The organization is not liable for lost or stolen items.

12. COMPLIANCE: Residents must comply with all local, state, and federal laws.

By signing below, I acknowledge that I have read, understand, and agree to abide by all house rules and policies. I understand that violations may result in discharge from the program.`;

export default function IntakeForm() {
  const [step, setStep] = useState(0);
  const [locations, setLocations] = useState([]);
  const [houseRules, setHouseRules] = useState(DEFAULT_HOUSE_RULES);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [createdName, setCreatedName] = useState('');

  // Signature
  const canvasRef = useRef(null);
  const [drawing, setDrawing] = useState(false);
  const [hasSig, setHasSig] = useState(false);
  const [signedAt, setSignedAt] = useState(null);
  const [agreedToRules, setAgreedToRules] = useState(false);

  // Documents
  const [uploadedDocs, setUploadedDocs] = useState({});
  const [uploading, setUploading] = useState({});

  // Background check
  const [bgConsent, setBgConsent] = useState(false);

  const [form, setForm] = useState({
    first_name: '', last_name: '', date_of_birth: '', gender_identity: '', pronouns: '',
    phone: '', email: '',
    emergency_contact_name: '', emergency_contact_phone: '', emergency_contact_relationship: '',
    sober_date: '', recovery_pathway: '', referred_by: '', notes: '',
    location_id: '', room: '', intake_date: new Date().toISOString().split('T')[0],
    // demographics
    race: '', ethnicity: '', primary_language: '', sexual_orientation: '',
    veteran_status: '', disability_status: '', housing_status_at_intake: '',
    religion_spirituality: '', interpreter_needed: false,
    // sobriety extras
    substances_used: '', treatment_history: '', mat_medications: '',
  });

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  useEffect(() => {
    base44.entities.Location.filter({ status: 'active' }).then(setLocations).catch(() => {});
    base44.entities.Organization.list().then(orgs => {
      if (orgs[0]?.house_rules) setHouseRules(orgs[0].house_rules);
    }).catch(() => {});
  }, []);

  // ── File upload ──────────────────────────────────────────────────────────
  const handleFileUpload = async (docKey, file) => {
    if (!file) return;
    setUploading(p => ({ ...p, [docKey]: true }));
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setUploadedDocs(p => ({ ...p, [docKey]: { file_url, name: file.name } }));
    setUploading(p => ({ ...p, [docKey]: false }));
  };

  const removeDoc = (docKey) => {
    setUploadedDocs(p => { const n = { ...p }; delete n[docKey]; return n; });
  };

  // ── Canvas signature ─────────────────────────────────────────────────────
  const getPos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect();
    const src = e.touches?.[0] || e;
    return { x: src.clientX - rect.left, y: src.clientY - rect.top };
  };
  const startDraw = (e) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const { x, y } = getPos(e, canvas);
    ctx.beginPath(); ctx.moveTo(x, y);
    setDrawing(true);
  };
  const draw = (e) => {
    if (!drawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.strokeStyle = '#1C1917';
    const { x, y } = getPos(e, canvas);
    ctx.lineTo(x, y); ctx.stroke();
    setHasSig(true);
  };
  const endDraw = () => {
    setDrawing(false);
    if (hasSig && !signedAt) setSignedAt(new Date().toISOString());
  };
  const clearSig = () => {
    const canvas = canvasRef.current;
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    setHasSig(false); setSignedAt(null);
  };

  // ── Validation ───────────────────────────────────────────────────────────
  const isStepValid = () => {
    if (step === 0) return form.first_name.trim() && form.last_name.trim() && form.date_of_birth;
    if (step === 5) return REQUIRED_DOCS.filter(d => d.required).every(d => uploadedDocs[d.key]);
    if (step === 6) return bgConsent;
    if (step === 7) return hasSig && agreedToRules;
    return true;
  };

  // ── Submit ───────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setSubmitting(true);

    const sigDataUrl = canvasRef.current.toDataURL('image/png');
    const residentName = `${form.first_name} ${form.last_name}`;

    const residentData = {
      ...form,
      status: 'applicant',
      consent_signed: true,
      resident_agreement_signed: true,
      background_check_consent: bgConsent,
      background_check_status: 'pending',
      background_check_date: new Date().toISOString().split('T')[0],
      notes: [
        form.notes ? `[Intake Form]\n${form.notes}` : '[Intake Form — submitted digitally]',
        form.substances_used ? `Substances: ${form.substances_used}` : '',
        form.treatment_history ? `Treatment history: ${form.treatment_history}` : '',
        form.mat_medications ? `MAT medications: ${form.mat_medications}` : '',
      ].filter(Boolean).join('\n'),
    };

    const created = await base44.entities.Resident.create(residentData);
    const residentId = created?.id || created;

    // Save e-signature document
    await base44.entities.ResidentDocument.create({
      resident_id: residentId,
      document_type: 'resident_agreement',
      label: 'House Rules E-Signature',
      file_url: sigDataUrl,
      signed_date: new Date().toISOString().split('T')[0],
      status: 'current',
      notes: `Digitally signed via intake form at ${signedAt}.`,
    });

    // Save uploaded documents
    await Promise.allSettled(
      REQUIRED_DOCS.filter(d => uploadedDocs[d.key]).map(d =>
        base44.entities.ResidentDocument.create({
          resident_id: residentId,
          document_type: d.doc_type,
          label: d.label,
          file_url: uploadedDocs[d.key].file_url,
          signed_date: new Date().toISOString().split('T')[0],
          status: 'current',
        })
      )
    );

    // Notify all active staff
    const allStaff = await base44.entities.StaffMember.filter({ status: 'active' }).catch(() => []);
    const staffToNotify = allStaff.filter(s => s.email);
    const preferredLocation = locations.find(l => l.id === form.location_id);
    const locationName = preferredLocation?.name || 'No preference';
    const reviewUrl = `${window.location.origin}/residents`;
    const submittedAt = new Date().toLocaleString();
    const docList = REQUIRED_DOCS.filter(d => uploadedDocs[d.key]).map(d => `• ${d.label}`).join('<br/>');

    await Promise.allSettled(staffToNotify.map(staff =>
      base44.integrations.Core.SendEmail({
        to: staff.email,
        subject: `🚨 New Application Pending — ${residentName} | Background Check Initiated`,
        body: `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#FAF6EF;border-radius:12px;">
  <div style="background:#FEE2E2;border:2px solid #FCA5A5;border-radius:10px;padding:14px 18px;margin-bottom:20px;">
    <p style="margin:0;font-size:16px;font-weight:700;color:#991B1B;">🚨 New Applicant — Action Required</p>
    <p style="margin:6px 0 0;font-size:13px;color:#B91C1C;">Review their application and follow up within the hour for best placement outcomes.</p>
  </div>
  <table style="width:100%;font-size:14px;color:#1C1917;border-collapse:collapse;margin-bottom:16px;">
    <tr style="border-bottom:1px solid #E0D5C5;"><td style="padding:10px 4px;font-weight:600;color:#78716C;width:38%;">Applicant</td><td style="padding:10px 4px;font-weight:700;">${residentName}</td></tr>
    <tr style="border-bottom:1px solid #E0D5C5;"><td style="padding:10px 4px;font-weight:600;color:#78716C;">Phone</td><td style="padding:10px 4px;">${form.phone || '—'}</td></tr>
    <tr style="border-bottom:1px solid #E0D5C5;"><td style="padding:10px 4px;font-weight:600;color:#78716C;">Email</td><td style="padding:10px 4px;">${form.email || '—'}</td></tr>
    <tr style="border-bottom:1px solid #E0D5C5;"><td style="padding:10px 4px;font-weight:600;color:#78716C;">Preferred Location</td><td style="padding:10px 4px;">${locationName}</td></tr>
    <tr style="border-bottom:1px solid #E0D5C5;"><td style="padding:10px 4px;font-weight:600;color:#78716C;">Requested Move-in</td><td style="padding:10px 4px;">${form.intake_date}</td></tr>
    <tr style="border-bottom:1px solid #E0D5C5;"><td style="padding:10px 4px;font-weight:600;color:#78716C;">Recovery Pathway</td><td style="padding:10px 4px;text-transform:capitalize;">${form.recovery_pathway?.replace(/_/g,' ') || '—'}</td></tr>
    <tr style="border-bottom:1px solid #E0D5C5;"><td style="padding:10px 4px;font-weight:600;color:#78716C;">Background Check</td><td style="padding:10px 4px;color:#B45309;font-weight:600;">⏳ Pending — consent given</td></tr>
    <tr style="border-bottom:1px solid #E0D5C5;"><td style="padding:10px 4px;font-weight:600;color:#78716C;">Documents Uploaded</td><td style="padding:10px 4px;">${docList || '—'}</td></tr>
    <tr><td style="padding:10px 4px;font-weight:600;color:#78716C;">Submitted At</td><td style="padding:10px 4px;color:#065F46;font-weight:600;">${submittedAt}</td></tr>
  </table>
  <div style="text-align:center;margin:20px 0;">
    <a href="${reviewUrl}" style="display:inline-block;background:#B45309;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:14px;">Review Full Application →</a>
  </div>
  <p style="font-size:12px;color:#A09080;text-align:center;">ClearPath — All staff are notified instantly when a new application arrives.</p>
</div>`.trim(),
      }).catch(() => {})
    ));

    setCreatedName(residentName);
    setSubmitted(true);
    setSubmitting(false);
  };

  // ── Success screen ───────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: '#FAF6EF' }}>
        <div className="max-w-md w-full text-center space-y-5">
          <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto" style={{ background: '#D1FAE5' }}>
            <CheckCircle className="w-10 h-10" style={{ color: '#065F46' }} />
          </div>
          <h1 className="text-2xl font-bold" style={{ color: '#1C1917' }}>Application Submitted!</h1>
          <p style={{ color: '#78716C' }}>
            Thank you, <strong>{createdName}</strong>. Your application has been received, your documents are on file, and a background check has been initiated. Staff have been notified and will be in touch shortly.
          </p>
          <div className="rounded-xl p-4 text-left" style={{ background: '#F0E9DC', border: '1px solid #E0D5C5' }}>
            <p className="text-sm font-semibold mb-2" style={{ color: '#B45309' }}>What happens next?</p>
            <ul className="text-sm space-y-1.5" style={{ color: '#78716C' }}>
              <li>✅ Your applicant profile has been created</li>
              <li>✅ Uploaded documents are securely stored</li>
              <li>🔍 Background check is <strong>pending</strong> — staff will update you</li>
              <li>📋 A house manager will review and contact you</li>
              <li>🏠 Housing placement will be confirmed upon approval</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  // ── Wizard ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen p-4 sm:p-6" style={{ background: '#FAF6EF' }}>
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#B45309' }}>
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: '#1C1917' }}>ClearPath Resident Application</h1>
            <p className="text-xs" style={{ color: '#78716C' }}>Secure & Confidential — Step {step + 1} of {STEPS.length}</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mb-5">
          <div className="flex items-center gap-1 overflow-x-auto pb-2">
            {STEPS.map((s, i) => (
              <div key={s.id} className="flex items-center gap-1 flex-shrink-0">
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium" style={{
                  background: i === step ? '#B45309' : i < step ? '#065F46' : '#E0D5C5',
                  color: i === step || i < step ? '#fff' : '#78716C',
                }}>
                  {i < step ? '✓' : s.icon}
                  <span className="hidden sm:inline">{s.label}</span>
                </div>
                {i < STEPS.length - 1 && <ChevronRight className="w-3 h-3 flex-shrink-0" style={{ color: '#C5B8AA' }} />}
              </div>
            ))}
          </div>
          <div className="h-1.5 rounded-full mt-2" style={{ background: '#E0D5C5' }}>
            <div className="h-full rounded-full transition-all duration-300" style={{ width: `${((step + 1) / STEPS.length) * 100}%`, background: '#B45309' }} />
          </div>
        </div>

        <div className="rounded-2xl shadow-sm" style={{ background: '#fff', border: '1px solid #E0D5C5' }}>
          <div className="p-5 border-b" style={{ borderColor: '#F0E9DC' }}>
            <h2 className="text-lg font-bold" style={{ color: '#1C1917' }}>
              {STEPS[step].icon} {STEPS[step].label}
            </h2>
          </div>

          <div className="p-5 space-y-4">

            {/* STEP 0 — Personal */}
            {step === 0 && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>First Name *</Label>
                    <Input value={form.first_name} onChange={e => set('first_name', e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Last Name *</Label>
                    <Input value={form.last_name} onChange={e => set('last_name', e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Date of Birth *</Label>
                    <Input type="date" value={form.date_of_birth} onChange={e => set('date_of_birth', e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Gender Identity</Label>
                    <Select value={form.gender_identity} onValueChange={v => set('gender_identity', v)}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="man">Man</SelectItem>
                        <SelectItem value="woman">Woman</SelectItem>
                        <SelectItem value="non_binary">Non-Binary</SelectItem>
                        <SelectItem value="genderqueer">Genderqueer</SelectItem>
                        <SelectItem value="transgender_man">Transgender Man</SelectItem>
                        <SelectItem value="transgender_woman">Transgender Woman</SelectItem>
                        <SelectItem value="agender">Agender</SelectItem>
                        <SelectItem value="two_spirit">Two-Spirit</SelectItem>
                        <SelectItem value="questioning">Questioning</SelectItem>
                        <SelectItem value="prefer_not_to_answer">Prefer not to answer</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Pronouns</Label>
                    <Select value={form.pronouns} onValueChange={v => set('pronouns', v)}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="he_him">He / Him</SelectItem>
                        <SelectItem value="she_her">She / Her</SelectItem>
                        <SelectItem value="they_them">They / Them</SelectItem>
                        <SelectItem value="he_they">He / They</SelectItem>
                        <SelectItem value="she_they">She / They</SelectItem>
                        <SelectItem value="ze_zir">Ze / Zir</SelectItem>
                        <SelectItem value="prefer_not_to_answer">Prefer not to answer</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Phone</Label>
                    <Input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="(555) 000-0000" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input type="email" value={form.email} onChange={e => set('email', e.target.value)} />
                </div>
              </>
            )}

            {/* STEP 1 — Demographics */}
            {step === 1 && (
              <>
                <div className="rounded-xl p-3 text-xs mb-1" style={{ background: '#F0F9FF', border: '1px solid #BAE6FD', color: '#0369A1' }}>
                  🌍 This information is voluntary and used solely for equitable service delivery and grant reporting. It does not affect your admission decision.
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Race</Label>
                    <Select value={form.race} onValueChange={v => set('race', v)}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="american_indian_alaska_native">American Indian / Alaska Native</SelectItem>
                        <SelectItem value="asian">Asian</SelectItem>
                        <SelectItem value="black_african_american">Black / African American</SelectItem>
                        <SelectItem value="hispanic_latino">Hispanic / Latino</SelectItem>
                        <SelectItem value="middle_eastern_north_african">Middle Eastern / North African</SelectItem>
                        <SelectItem value="native_hawaiian_pacific_islander">Native Hawaiian / Pacific Islander</SelectItem>
                        <SelectItem value="white">White</SelectItem>
                        <SelectItem value="multiracial">Multiracial</SelectItem>
                        <SelectItem value="prefer_not_to_answer">Prefer not to answer</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Ethnicity</Label>
                    <Select value={form.ethnicity} onValueChange={v => set('ethnicity', v)}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="hispanic_latino">Hispanic / Latino</SelectItem>
                        <SelectItem value="not_hispanic_latino">Not Hispanic / Latino</SelectItem>
                        <SelectItem value="prefer_not_to_answer">Prefer not to answer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Primary Language</Label>
                    <Select value={form.primary_language} onValueChange={v => set('primary_language', v)}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="english">English</SelectItem>
                        <SelectItem value="spanish">Spanish</SelectItem>
                        <SelectItem value="arabic">Arabic</SelectItem>
                        <SelectItem value="chinese_mandarin">Chinese (Mandarin)</SelectItem>
                        <SelectItem value="french">French</SelectItem>
                        <SelectItem value="haitian_creole">Haitian Creole</SelectItem>
                        <SelectItem value="hindi">Hindi</SelectItem>
                        <SelectItem value="portuguese">Portuguese</SelectItem>
                        <SelectItem value="russian">Russian</SelectItem>
                        <SelectItem value="somali">Somali</SelectItem>
                        <SelectItem value="tagalog">Tagalog</SelectItem>
                        <SelectItem value="vietnamese">Vietnamese</SelectItem>
                        <SelectItem value="american_sign_language">American Sign Language</SelectItem>
                        <SelectItem value="prefer_not_to_answer">Prefer not to answer</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Interpreter Needed?</Label>
                    <Select value={form.interpreter_needed ? 'yes' : 'no'} onValueChange={v => set('interpreter_needed', v === 'yes')}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="no">No</SelectItem>
                        <SelectItem value="yes">Yes</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Veteran Status</Label>
                    <Select value={form.veteran_status} onValueChange={v => set('veteran_status', v)}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="not_a_veteran">Not a Veteran</SelectItem>
                        <SelectItem value="active_duty">Active Duty</SelectItem>
                        <SelectItem value="veteran">Veteran</SelectItem>
                        <SelectItem value="national_guard_reserve">National Guard / Reserve</SelectItem>
                        <SelectItem value="prefer_not_to_answer">Prefer not to answer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Disability Status</Label>
                    <Select value={form.disability_status} onValueChange={v => set('disability_status', v)}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="physical">Physical</SelectItem>
                        <SelectItem value="cognitive_intellectual">Cognitive / Intellectual</SelectItem>
                        <SelectItem value="mental_health">Mental Health</SelectItem>
                        <SelectItem value="sensory_vision_hearing">Sensory (Vision / Hearing)</SelectItem>
                        <SelectItem value="multiple">Multiple</SelectItem>
                        <SelectItem value="prefer_not_to_answer">Prefer not to answer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Housing Status at Intake</Label>
                    <Select value={form.housing_status_at_intake} onValueChange={v => set('housing_status_at_intake', v)}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="housed">Housed</SelectItem>
                        <SelectItem value="couch_surfing">Couch Surfing</SelectItem>
                        <SelectItem value="transitional_housing">Transitional Housing</SelectItem>
                        <SelectItem value="shelter">Shelter</SelectItem>
                        <SelectItem value="vehicle">Living in Vehicle</SelectItem>
                        <SelectItem value="unsheltered">Unsheltered</SelectItem>
                        <SelectItem value="incarcerated">Incarcerated / Releasing</SelectItem>
                        <SelectItem value="prefer_not_to_answer">Prefer not to answer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Religion / Spirituality</Label>
                    <Select value={form.religion_spirituality} onValueChange={v => set('religion_spirituality', v)}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="christian">Christian</SelectItem>
                        <SelectItem value="catholic">Catholic</SelectItem>
                        <SelectItem value="muslim">Muslim</SelectItem>
                        <SelectItem value="jewish">Jewish</SelectItem>
                        <SelectItem value="buddhist">Buddhist</SelectItem>
                        <SelectItem value="hindu">Hindu</SelectItem>
                        <SelectItem value="native_spiritual">Native / Spiritual</SelectItem>
                        <SelectItem value="spiritual_not_religious">Spiritual, not religious</SelectItem>
                        <SelectItem value="agnostic">Agnostic</SelectItem>
                        <SelectItem value="atheist">Atheist</SelectItem>
                        <SelectItem value="prefer_not_to_answer">Prefer not to answer</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </>
            )}

            {/* STEP 2 — Emergency Contact */}
            {step === 2 && (
              <>
                <div className="rounded-xl p-3 text-xs mb-1" style={{ background: '#FFF7ED', border: '1px solid #FED7AA', color: '#9A3412' }}>
                  📞 In case of emergency, who should we contact on your behalf?
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Full Name *</Label>
                    <Input value={form.emergency_contact_name} onChange={e => set('emergency_contact_name', e.target.value)} placeholder="Contact's full name" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Phone *</Label>
                    <Input value={form.emergency_contact_phone} onChange={e => set('emergency_contact_phone', e.target.value)} placeholder="(555) 000-0000" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Relationship to Applicant</Label>
                  <Select value={form.emergency_contact_relationship} onValueChange={v => set('emergency_contact_relationship', v)}>
                    <SelectTrigger><SelectValue placeholder="Select relationship" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="parent">Parent</SelectItem>
                      <SelectItem value="sibling">Sibling</SelectItem>
                      <SelectItem value="spouse_partner">Spouse / Partner</SelectItem>
                      <SelectItem value="child">Child</SelectItem>
                      <SelectItem value="grandparent">Grandparent</SelectItem>
                      <SelectItem value="aunt_uncle">Aunt / Uncle</SelectItem>
                      <SelectItem value="friend">Friend</SelectItem>
                      <SelectItem value="sponsor">Sponsor / Mentor</SelectItem>
                      <SelectItem value="case_manager">Case Manager</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 pt-2">
                  <p className="text-xs font-bold uppercase tracking-wide" style={{ color: '#B45309' }}>Secondary Emergency Contact (Optional)</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Full Name</Label>
                    <Input value={form.emergency_contact_2_name || ''} onChange={e => set('emergency_contact_2_name', e.target.value)} placeholder="Contact's full name" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Phone</Label>
                    <Input value={form.emergency_contact_2_phone || ''} onChange={e => set('emergency_contact_2_phone', e.target.value)} placeholder="(555) 000-0000" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Relationship</Label>
                  <Input value={form.emergency_contact_2_relationship || ''} onChange={e => set('emergency_contact_2_relationship', e.target.value)} placeholder="e.g. Sponsor, Friend" />
                </div>
              </>
            )}

            {/* STEP 3 — Recovery & Sobriety */}
            {step === 3 && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Sobriety / Clean Date</Label>
                    <Input type="date" value={form.sober_date} onChange={e => set('sober_date', e.target.value)} />
                    {form.sober_date && (
                      <p className="text-xs" style={{ color: '#065F46' }}>
                        🎉 {Math.floor((new Date() - new Date(form.sober_date)) / 86400000)} days of recovery
                      </p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label>Recovery Pathway</Label>
                    <Select value={form.recovery_pathway} onValueChange={v => set('recovery_pathway', v)}>
                      <SelectTrigger><SelectValue placeholder="Select pathway" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="12_step">12-Step (AA / NA / CA)</SelectItem>
                        <SelectItem value="smart_recovery">SMART Recovery</SelectItem>
                        <SelectItem value="faith_based">Faith-Based</SelectItem>
                        <SelectItem value="mat">Medication-Assisted (MAT)</SelectItem>
                        <SelectItem value="harm_reduction">Harm Reduction</SelectItem>
                        <SelectItem value="peer_support">Peer Support</SelectItem>
                        <SelectItem value="refuge_recovery">Refuge Recovery</SelectItem>
                        <SelectItem value="secular">Secular / Non-12-Step</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Primary Substance(s) Used</Label>
                  <Input value={form.substances_used} onChange={e => set('substances_used', e.target.value)} placeholder="e.g. Alcohol, Opioids, Methamphetamine" />
                </div>

                <div className="space-y-1.5">
                  <Label>Prior Treatment History</Label>
                  <Textarea value={form.treatment_history} onChange={e => set('treatment_history', e.target.value)} rows={2}
                    placeholder="Previous detox, inpatient, outpatient, sober living stays…" />
                </div>

                <div className="space-y-1.5">
                  <Label>Current MAT Medications (if any)</Label>
                  <Input value={form.mat_medications} onChange={e => set('mat_medications', e.target.value)} placeholder="e.g. Suboxone 8mg daily, Vivitrol monthly" />
                </div>

                <div className="space-y-1.5">
                  <Label>Referred By</Label>
                  <Input value={form.referred_by} onChange={e => set('referred_by', e.target.value)} placeholder="Organization, person, or source" />
                </div>

                <div className="space-y-1.5">
                  <Label>Additional Notes for Staff</Label>
                  <Textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} placeholder="Anything else you'd like staff to know…" />
                </div>
              </>
            )}

            {/* STEP 4 — Placement */}
            {step === 4 && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Preferred Location</Label>
                    <Select value={form.location_id} onValueChange={v => set('location_id', v)}>
                      <SelectTrigger><SelectValue placeholder="Select house" /></SelectTrigger>
                      <SelectContent>
                        {locations.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Preferred Room (optional)</Label>
                    <Input value={form.room} onChange={e => set('room', e.target.value)} placeholder="e.g. 2B" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Requested Intake Date</Label>
                  <Input type="date" value={form.intake_date} onChange={e => set('intake_date', e.target.value)} />
                </div>
                <div className="rounded-xl p-4 text-sm" style={{ background: '#FEF3C7', border: '1px solid #FDE68A' }}>
                  <p style={{ color: '#92400E' }}>
                    <strong>Note:</strong> Room and placement are subject to availability and confirmed by your house manager.
                  </p>
                </div>
              </>
            )}

            {/* STEP 5 — Documents */}
            {step === 5 && (
              <div className="space-y-4">
                <p className="text-sm" style={{ color: '#78716C' }}>
                  Please upload the documents listed below. Items marked <strong>Required *</strong> must be provided to proceed.
                </p>
                {REQUIRED_DOCS.map(doc => (
                  <div key={doc.key} className="rounded-xl p-4" style={{ border: `1px solid ${uploadedDocs[doc.key] ? '#A7F3D0' : '#E0D5C5'}`, background: uploadedDocs[doc.key] ? '#ECFDF5' : '#FAFAF9' }}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 flex-shrink-0" style={{ color: uploadedDocs[doc.key] ? '#065F46' : '#78716C' }} />
                        <div>
                          <p className="text-sm font-medium" style={{ color: '#1C1917' }}>
                            {doc.label} {doc.required && <span style={{ color: '#B45309' }}>*</span>}
                          </p>
                          {uploadedDocs[doc.key] && (
                            <p className="text-xs mt-0.5" style={{ color: '#065F46' }}>✓ {uploadedDocs[doc.key].name}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {uploadedDocs[doc.key] ? (
                          <button onClick={() => removeDoc(doc.key)} className="p-1 rounded hover:bg-red-50">
                            <X className="w-4 h-4 text-red-400" />
                          </button>
                        ) : (
                          <label className="cursor-pointer">
                            <input type="file" className="hidden" accept="image/*,.pdf,.doc,.docx"
                              onChange={e => handleFileUpload(doc.key, e.target.files[0])} />
                            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                              style={{ background: uploading[doc.key] ? '#E0D5C5' : '#B45309', color: '#fff', cursor: uploading[doc.key] ? 'not-allowed' : 'pointer' }}>
                              {uploading[doc.key]
                                ? <><Loader2 className="w-3 h-3 animate-spin" /> Uploading…</>
                                : <><Upload className="w-3 h-3" /> Upload</>}
                            </span>
                          </label>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                <p className="text-xs" style={{ color: '#A09080' }}>
                  Accepted formats: PDF, JPG, PNG, DOC. All documents are encrypted and stored securely.
                </p>
              </div>
            )}

            {/* STEP 6 — Background Check */}
            {step === 6 && (
              <div className="space-y-4">
                <div className="rounded-xl p-5" style={{ background: '#F0F9FF', border: '1px solid #BAE6FD' }}>
                  <div className="flex items-start gap-3">
                    <Search className="w-6 h-6 mt-0.5 flex-shrink-0" style={{ color: '#0369A1' }} />
                    <div>
                      <h3 className="font-semibold" style={{ color: '#0C4A6E' }}>Background Screening Consent</h3>
                      <p className="text-sm mt-1" style={{ color: '#0369A1' }}>
                        As part of our admissions process, we conduct a background screening to ensure the safety of all residents and staff. This is a standard requirement for placement.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 text-sm" style={{ color: '#3C3530' }}>
                  <p><strong>What is checked:</strong></p>
                  <ul className="space-y-1 pl-4" style={{ color: '#78716C' }}>
                    <li>• Criminal history (national & county-level)</li>
                    <li>• Sex offender registry</li>
                    <li>• Identity verification</li>
                  </ul>
                  <p className="mt-2"><strong>Your rights:</strong></p>
                  <ul className="space-y-1 pl-4" style={{ color: '#78716C' }}>
                    <li>• You will be notified of any adverse action taken</li>
                    <li>• You have the right to dispute inaccurate information</li>
                    <li>• A criminal history does not automatically disqualify you</li>
                  </ul>
                </div>

                <div className="rounded-xl p-4" style={{ background: '#FEF3C7', border: '1px solid #FDE68A' }}>
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: '#92400E' }} />
                    <p className="text-xs" style={{ color: '#78400E' }}>
                      Background check results are reviewed by the admissions team. A history of criminal charges does not automatically disqualify an applicant — each application is reviewed holistically.
                    </p>
                  </div>
                </div>

                <div className="mt-2">
                  <Badge className="mb-3 text-xs" style={{ background: bgConsent ? '#D1FAE5' : '#FEE2E2', color: bgConsent ? '#065F46' : '#991B1B', border: 'none' }}>
                    Status: {bgConsent ? '✓ Consent Given' : '⏳ Consent Required'}
                  </Badge>
                  <label className="flex items-start gap-3 cursor-pointer p-4 rounded-xl" style={{ border: `2px solid ${bgConsent ? '#6EE7B7' : '#E0D5C5'}`, background: bgConsent ? '#ECFDF5' : '#fff' }}>
                    <input type="checkbox" checked={bgConsent} onChange={e => setBgConsent(e.target.checked)} className="mt-0.5 rounded" />
                    <span className="text-sm" style={{ color: '#1C1917' }}>
                      I, <strong>{form.first_name || 'Applicant'} {form.last_name}</strong>, consent to a background check being conducted as part of my application to this recovery housing program. I understand my rights as described above.
                    </span>
                  </label>
                </div>
              </div>
            )}

            {/* STEP 7 — Agreement & Signature */}
            {step === 7 && (
              <>
                <div className="rounded-xl p-4 overflow-y-auto text-xs leading-relaxed whitespace-pre-wrap max-h-48"
                  style={{ background: '#F8F5F0', border: '1px solid #E0D5C5', color: '#3C3530', fontFamily: 'monospace' }}>
                  {houseRules}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2">
                      <PenLine className="w-4 h-4" style={{ color: '#B45309' }} /> Sign Below *
                    </Label>
                    <button onClick={clearSig} className="flex items-center gap-1 text-xs" style={{ color: '#78716C' }}>
                      <RotateCcw className="w-3 h-3" /> Clear
                    </button>
                  </div>
                  <div className="rounded-xl overflow-hidden" style={{ border: `2px solid ${hasSig ? '#B45309' : '#E0D5C5'}`, background: '#FFFEF9' }}>
                    <canvas
                      ref={canvasRef} width={580} height={130}
                      className="w-full touch-none cursor-crosshair"
                      onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw}
                      onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw}
                    />
                  </div>
                  {!hasSig && <p className="text-xs" style={{ color: '#A09080' }}>Draw your signature in the box above</p>}
                  {hasSig && signedAt && <p className="text-xs" style={{ color: '#065F46' }}>✅ Signed on {new Date(signedAt).toLocaleString()}</p>}
                </div>

                <label className="flex items-start gap-3 text-sm cursor-pointer">
                  <input type="checkbox" checked={agreedToRules} onChange={e => setAgreedToRules(e.target.checked)} className="mt-1 rounded" />
                  <span style={{ color: '#3C3530' }}>
                    I confirm I have read the house rules in full, the signature above is mine, and I agree to abide by all terms of this agreement.
                  </span>
                </label>
              </>
            )}
          </div>

          {/* Footer nav */}
          <div className="flex items-center justify-between p-5 border-t" style={{ borderColor: '#F0E9DC' }}>
            <Button variant="outline" onClick={() => setStep(s => s - 1)} disabled={step === 0} className="gap-2">
              <ChevronLeft className="w-4 h-4" /> Back
            </Button>

            {step < STEPS.length - 1 ? (
              <Button onClick={() => setStep(s => s + 1)} disabled={!isStepValid()}
                style={{ background: '#B45309', color: '#fff' }} className="gap-2">
                Continue <ChevronRight className="w-4 h-4" />
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={!isStepValid() || submitting}
                style={{ background: '#065F46', color: '#fff' }} className="gap-2">
                {submitting
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</>
                  : <><CheckCircle className="w-4 h-4" /> Submit Application</>}
              </Button>
            )}
          </div>
        </div>

        <p className="text-center text-xs mt-4" style={{ color: '#A09080' }}>
          🔒 Your information is stored securely and treated with strict confidentiality.
        </p>
      </div>
    </div>
  );
}