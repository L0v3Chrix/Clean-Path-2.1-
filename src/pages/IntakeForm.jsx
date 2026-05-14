import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { CheckCircle, ChevronRight, ChevronLeft, Shield, PenLine, RotateCcw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const STEPS = [
  { id: 'personal',   label: 'Personal Info',    icon: '👤' },
  { id: 'contact',    label: 'Contact & Emergency', icon: '📞' },
  { id: 'recovery',   label: 'Recovery Info',    icon: '💚' },
  { id: 'placement',  label: 'Housing Placement', icon: '🏠' },
  { id: 'rules',      label: 'House Rules & Signature', icon: '✍️' },
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
  const [step, setStep]         = useState(0);
  const [locations, setLocations] = useState([]);
  const [houseRules, setHouseRules] = useState(DEFAULT_HOUSE_RULES);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted]  = useState(false);
  const [createdName, setCreatedName] = useState('');

  const canvasRef = useRef(null);
  const [drawing, setDrawing]     = useState(false);
  const [hasSig, setHasSig]       = useState(false);
  const [signedAt, setSignedAt]   = useState(null);

  const [form, setForm] = useState({
    // Personal
    first_name: '', last_name: '', date_of_birth: '', gender: '',
    // Contact
    phone: '', email: '',
    emergency_contact_name: '', emergency_contact_phone: '', emergency_contact_relationship: '',
    // Recovery
    sober_date: '', recovery_pathway: '', referred_by: '', notes: '',
    // Placement
    location_id: '', room: '', intake_date: new Date().toISOString().split('T')[0],
  });

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  useEffect(() => {
    base44.entities.Location.filter({ status: 'active' }).then(setLocations);
    base44.entities.Organization.list().then(orgs => {
      if (orgs[0]?.house_rules) setHouseRules(orgs[0].house_rules);
    });
  }, []);

  // ── Canvas signature ──────────────────────────────────────────────────────
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
    ctx.beginPath();
    ctx.moveTo(x, y);
    setDrawing(true);
  };

  const draw = (e) => {
    if (!drawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#1C1917';
    const { x, y } = getPos(e, canvas);
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasSig(true);
  };

  const endDraw = () => {
    setDrawing(false);
    if (hasSig && !signedAt) setSignedAt(new Date().toISOString());
  };

  const clearSig = () => {
    const canvas = canvasRef.current;
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    setHasSig(false);
    setSignedAt(null);
  };
  // ─────────────────────────────────────────────────────────────────────────

  const isStepValid = () => {
    if (step === 0) return form.first_name.trim() && form.last_name.trim() && form.date_of_birth;
    if (step === 4) return hasSig;
    return true;
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    // Get signature as data URL
    const sigDataUrl = canvasRef.current.toDataURL('image/png');

    // Build resident record
    const residentData = {
      ...form,
      status: 'applicant',
      consent_signed: true,
      resident_agreement_signed: true,
      notes: form.notes ? `[Intake Form]\n${form.notes}` : '[Intake Form — submitted digitally]',
    };

    // Create the resident profile
    const created = await base44.entities.Resident.create(residentData);
    const residentId = created?.id || created;

    // Save signature as a ResidentDocument record (store data URL as file_url for now)
    await base44.entities.ResidentDocument.create({
      resident_id: residentId,
      organization_id: form.organization_id || undefined,
      document_type: 'resident_agreement',
      label: 'House Rules E-Signature',
      file_url: sigDataUrl,
      signed_date: new Date().toISOString().split('T')[0],
      status: 'current',
      notes: `Digitally signed via intake form at ${signedAt}. IP: client-side.`,
    });

    // Notify house managers by email
    const managers = await base44.entities.StaffMember.filter({ status: 'active' });
    const houseManagers = managers.filter(s =>
      ['house_manager', 'director', 'owner', 'platform_admin'].includes(s.role) && s.email
    );

    const residentName = `${form.first_name} ${form.last_name}`;
    const locationName = locations.find(l => l.id === form.location_id)?.name || 'Unassigned';
    const reviewUrl = `${window.location.origin}/residents`;

    await Promise.allSettled(houseManagers.map(mgr =>
      base44.integrations.Core.SendEmail({
        to: mgr.email,
        subject: `✅ New Intake Ready for Review — ${residentName}`,
        body: `
<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #FAF6EF; border-radius: 12px;">
  <div style="background: #D1FAE5; border: 1px solid #A7F3D0; border-radius: 10px; padding: 16px 20px; margin-bottom: 20px;">
    <p style="margin: 0; font-size: 18px; font-weight: 700; color: #065F46;">✅ New Resident Intake — Ready for Review</p>
    <p style="margin: 4px 0 0; font-size: 13px; color: #047857;">A new intake form has been submitted and requires your review.</p>
  </div>

  <table style="width: 100%; font-size: 14px; color: #1C1917; border-collapse: collapse;">
    <tr style="border-bottom: 1px solid #E0D5C5;">
      <td style="padding: 10px 4px; font-weight: 600; color: #78716C; width: 40%;">Resident Name</td>
      <td style="padding: 10px 4px;">${residentName}</td>
    </tr>
    <tr style="border-bottom: 1px solid #E0D5C5;">
      <td style="padding: 10px 4px; font-weight: 600; color: #78716C;">Location</td>
      <td style="padding: 10px 4px;">${locationName}</td>
    </tr>
    <tr style="border-bottom: 1px solid #E0D5C5;">
      <td style="padding: 10px 4px; font-weight: 600; color: #78716C;">Intake Date</td>
      <td style="padding: 10px 4px;">${form.intake_date}</td>
    </tr>
    <tr style="border-bottom: 1px solid #E0D5C5;">
      <td style="padding: 10px 4px; font-weight: 600; color: #78716C;">Recovery Pathway</td>
      <td style="padding: 10px 4px;">${form.recovery_pathway?.replace(/_/g, ' ') || '—'}</td>
    </tr>
    <tr style="border-bottom: 1px solid #E0D5C5;">
      <td style="padding: 10px 4px; font-weight: 600; color: #78716C;">Referred By</td>
      <td style="padding: 10px 4px;">${form.referred_by || '—'}</td>
    </tr>
    <tr>
      <td style="padding: 10px 4px; font-weight: 600; color: #78716C;">House Rules Signed</td>
      <td style="padding: 10px 4px; color: #065F46; font-weight: 600;">✅ Yes — ${signedAt ? new Date(signedAt).toLocaleString() : 'Signed'}</td>
    </tr>
  </table>

  <div style="margin-top: 24px; text-align: center;">
    <a href="${reviewUrl}" style="display: inline-block; background: #B45309; color: #fff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 600; font-size: 14px;">
      Review Applicant →
    </a>
  </div>

  <p style="margin-top: 20px; font-size: 12px; color: #A09080; text-align: center;">
    Sent automatically by ClearPath when a new intake form is submitted.
  </p>
</div>`.trim(),
      }).catch(() => {})
    ));

    setCreatedName(residentName);
    setSubmitted(true);
    setSubmitting(false);
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: '#FAF6EF' }}>
        <div className="max-w-md w-full text-center space-y-5">
          <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto" style={{ background: '#D1FAE5' }}>
            <CheckCircle className="w-10 h-10" style={{ color: '#065F46' }} />
          </div>
          <h1 className="text-2xl font-bold" style={{ color: '#1C1917' }}>Intake Submitted!</h1>
          <p style={{ color: '#78716C' }}>
            Thank you, <strong>{createdName}</strong>. Your intake form has been received and your profile has been created. The house manager has been notified and will be in touch shortly.
          </p>
          <div className="rounded-xl p-4" style={{ background: '#F0E9DC', border: '1px solid #E0D5C5' }}>
            <p className="text-sm font-semibold" style={{ color: '#B45309' }}>What happens next?</p>
            <ul className="text-sm mt-2 space-y-1 text-left" style={{ color: '#78716C' }}>
              <li>✅ Your profile is created as "Applicant"</li>
              <li>✅ Your signed house rules agreement is on file</li>
              <li>📋 A house manager will review and contact you</li>
              <li>🏠 Your housing placement will be confirmed</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 sm:p-6" style={{ background: '#FAF6EF' }}>
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#B45309' }}>
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: '#1C1917' }}>ClearPath Resident Intake</h1>
            <p className="text-xs" style={{ color: '#78716C' }}>Secure & Confidential</p>
          </div>
        </div>

        {/* Step progress */}
        <div className="flex items-center gap-1 mb-6 overflow-x-auto pb-1">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center gap-1 flex-shrink-0">
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                i === step ? 'text-white' : i < step ? 'text-white' : ''
              }`}
                style={{
                  background: i === step ? '#B45309' : i < step ? '#065F46' : '#E0D5C5',
                  color: i === step || i < step ? '#fff' : '#78716C',
                }}
              >
                {i < step ? '✓' : s.icon} <span className="hidden sm:inline">{s.label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#C5B8AA' }} />
              )}
            </div>
          ))}
        </div>

        {/* Card */}
        <div className="rounded-2xl shadow-sm" style={{ background: '#fff', border: '1px solid #E0D5C5' }}>
          <div className="p-5 border-b" style={{ borderColor: '#F0E9DC' }}>
            <p className="text-xs font-bold uppercase tracking-wide" style={{ color: '#B45309' }}>
              Step {step + 1} of {STEPS.length}
            </p>
            <h2 className="text-lg font-bold mt-0.5" style={{ color: '#1C1917' }}>{STEPS[step].label}</h2>
          </div>

          <div className="p-5 space-y-4">

            {/* ── STEP 0: Personal ─────────────────────────── */}
            {step === 0 && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>First Name *</Label>
                    <Input value={form.first_name} onChange={e => set('first_name', e.target.value)} required />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Last Name *</Label>
                    <Input value={form.last_name} onChange={e => set('last_name', e.target.value)} required />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Date of Birth *</Label>
                    <Input type="date" value={form.date_of_birth} onChange={e => set('date_of_birth', e.target.value)} required />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Gender</Label>
                    <Select value={form.gender} onValueChange={v => set('gender', v)}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="non_binary">Non-Binary</SelectItem>
                        <SelectItem value="transgender">Transgender</SelectItem>
                        <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </>
            )}

            {/* ── STEP 1: Contact ──────────────────────────── */}
            {step === 1 && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Phone</Label>
                    <Input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="(555) 000-0000" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Email</Label>
                    <Input type="email" value={form.email} onChange={e => set('email', e.target.value)} />
                  </div>
                </div>
                <p className="text-xs font-bold uppercase tracking-wide pt-2" style={{ color: '#B45309' }}>Emergency Contact</p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label>Name</Label>
                    <Input value={form.emergency_contact_name} onChange={e => set('emergency_contact_name', e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Phone</Label>
                    <Input value={form.emergency_contact_phone} onChange={e => set('emergency_contact_phone', e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Relationship</Label>
                    <Input value={form.emergency_contact_relationship} onChange={e => set('emergency_contact_relationship', e.target.value)} />
                  </div>
                </div>
              </>
            )}

            {/* ── STEP 2: Recovery ─────────────────────────── */}
            {step === 2 && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Sobriety / Recovery Date</Label>
                    <Input type="date" value={form.sober_date} onChange={e => set('sober_date', e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Recovery Pathway</Label>
                    <Select value={form.recovery_pathway} onValueChange={v => set('recovery_pathway', v)}>
                      <SelectTrigger><SelectValue placeholder="Select pathway" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="12_step">12-Step</SelectItem>
                        <SelectItem value="smart_recovery">SMART Recovery</SelectItem>
                        <SelectItem value="faith_based">Faith-Based</SelectItem>
                        <SelectItem value="mat">Medication-Assisted (MAT)</SelectItem>
                        <SelectItem value="harm_reduction">Harm Reduction</SelectItem>
                        <SelectItem value="peer_support">Peer Support</SelectItem>
                        <SelectItem value="refuge_recovery">Refuge Recovery</SelectItem>
                        <SelectItem value="secular">Secular/Non-12-Step</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Referred By</Label>
                  <Input value={form.referred_by} onChange={e => set('referred_by', e.target.value)} placeholder="Organization, person, or source" />
                </div>
                <div className="space-y-1.5">
                  <Label>Additional Notes</Label>
                  <Textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={3} placeholder="Any additional information you'd like to share with staff…" />
                </div>
              </>
            )}

            {/* ── STEP 3: Placement ────────────────────────── */}
            {step === 3 && (
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
                    <Label>Preferred Room (if any)</Label>
                    <Input value={form.room} onChange={e => set('room', e.target.value)} placeholder="e.g. 2B" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Requested Intake Date</Label>
                  <Input type="date" value={form.intake_date} onChange={e => set('intake_date', e.target.value)} />
                </div>
                <div className="rounded-xl p-4 text-sm" style={{ background: '#FEF3C7', border: '1px solid #FDE68A' }}>
                  <p style={{ color: '#92400E' }}>
                    <strong>Note:</strong> Room and placement assignments are subject to availability and will be confirmed by your house manager.
                  </p>
                </div>
              </>
            )}

            {/* ── STEP 4: House Rules + E-Signature ────────── */}
            {step === 4 && (
              <>
                <div className="rounded-xl p-4 overflow-y-auto text-xs leading-relaxed whitespace-pre-wrap max-h-52"
                  style={{ background: '#F8F5F0', border: '1px solid #E0D5C5', color: '#3C3530', fontFamily: 'monospace' }}>
                  {houseRules}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2">
                      <PenLine className="w-4 h-4" style={{ color: '#B45309' }} />
                      Sign Below *
                    </Label>
                    <button onClick={clearSig} className="flex items-center gap-1 text-xs" style={{ color: '#78716C' }}>
                      <RotateCcw className="w-3 h-3" /> Clear
                    </button>
                  </div>
                  <div className="rounded-xl overflow-hidden" style={{ border: `2px solid ${hasSig ? '#B45309' : '#E0D5C5'}`, background: '#FFFEF9' }}>
                    <canvas
                      ref={canvasRef}
                      width={580}
                      height={140}
                      className="w-full touch-none cursor-crosshair"
                      onMouseDown={startDraw}
                      onMouseMove={draw}
                      onMouseUp={endDraw}
                      onMouseLeave={endDraw}
                      onTouchStart={startDraw}
                      onTouchMove={draw}
                      onTouchEnd={endDraw}
                    />
                  </div>
                  {!hasSig && (
                    <p className="text-xs" style={{ color: '#A09080' }}>Draw your signature in the box above to proceed</p>
                  )}
                  {hasSig && signedAt && (
                    <p className="text-xs" style={{ color: '#065F46' }}>
                      ✅ Signed on {new Date(signedAt).toLocaleString()}
                    </p>
                  )}
                </div>

                <label className="flex items-start gap-3 text-sm cursor-pointer">
                  <input type="checkbox" required className="mt-1 rounded" />
                  <span style={{ color: '#3C3530' }}>
                    I confirm that I have read the house rules in full, that the signature above is mine, and that I agree to abide by all terms of this agreement.
                  </span>
                </label>
              </>
            )}

          </div>

          {/* Footer nav */}
          <div className="flex items-center justify-between p-5 border-t" style={{ borderColor: '#F0E9DC' }}>
            <Button
              variant="outline"
              onClick={() => setStep(s => s - 1)}
              disabled={step === 0}
              className="gap-2"
            >
              <ChevronLeft className="w-4 h-4" /> Back
            </Button>

            {step < STEPS.length - 1 ? (
              <Button
                onClick={() => setStep(s => s + 1)}
                disabled={!isStepValid()}
                style={{ background: '#B45309', color: '#fff' }}
                className="gap-2"
              >
                Continue <ChevronRight className="w-4 h-4" />
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={!hasSig || submitting}
                style={{ background: '#065F46', color: '#fff' }}
                className="gap-2"
              >
                {submitting ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</>
                ) : (
                  <><CheckCircle className="w-4 h-4" /> Submit Intake</>
                )}
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