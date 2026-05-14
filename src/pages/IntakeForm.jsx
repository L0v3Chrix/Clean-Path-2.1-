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

const HOUSE_RULES = `Recovery Centered Living
House Guidelines & Regulations

1. There is a 2 week to 30 days clean and sober requirement before admission into Recovery Centered Living. If a member has a recurrence of use and is dismissed, they will need to acquire up to 30 days of sobriety to reenter. This rule is for the welfare of all house members and their sobriety.

2. We encourage members to consider at least a 3-months of stay.

3. All members are required to attend a AA/NA/CA/HA, Smart Recovery (Recovery Related) meeting at least 4 days a week until they start work, volunteering or school, to have a sponsor/mentor and homegroup within two weeks.

Once working, volunteering or school starts, all members are required to attend at least 3 AA/NA/CA/HA Smart Recovery/Dharma Recovery (Recovery Related) meetings weekly, and be working on their recovery – progressing through the 12 Steps or Meeting type curriculum.

Maintaining sobriety and improving one's quality of life is our primary purpose.

Notes: Members are required to report the names of the meetings attended, days and times during the Sunday House meeting. Members enrolled in an Intensive Outpatient Program (IOP) are permitted to count that towards one of their required meetings.

4. Any House member found to be using any narcotics, synthetics, or alcohol will be dismissed immediately. Any member who has knowledge of another member's relapse and withholds this information from the House could be removed. If you provide a false urine sample, tamper with urine or have the knowledge of other's tampering with a specimen, it will be grounds for dismissal.

Medication is not a topic of Conversation period, and can be grounds for eviction!

Types of misuse may include:
a) Taking any medication not prescribed to the individual by a physician or otherwise not approved by the House Manager.
b) Taking any prescription narcotic medication not approved by management. (NO EXCEPTIONS)
c) Not taking medicine as prescribed and required by a physician.
d) Taking any over-the-counter medication or nutritional supplements that can produce a false positive on a drug test. Such as Kava, Kratom, CBD, Delta, ephedrine-based medication, or dextromethorphan.
e) Members must notify the House Management within 24 hours or before any prescribed medication changes.
f) Members who have visited any physician or medical facility are required to bring home discharge paperwork and any documentation of prescriptions given to share with management.

5. Drug/Alcohol testing may be required from any member at any time and without notice. Failure to submit to testing will be viewed as an admission of recurrence of use, requiring immediate dismissal. Collection must be submitted within 1 to 2 hours after request.

6. To obtain membership at RCL houses, 2 weeks of membership fees and a $150.00 Move-In fee (Non-Refundable) are required. The membership fee is due at admission. Future membership fees will be due every Friday. There will be a $10.00 a day late fee for each day thereafter. All payments via client portal on OathTrack or money order payable to Recovery Centered Living. We do not accept cash.

7. All members are required to have a minimum of 25 hours of verifiable employment, be enrolled in nine hours of school, or have secured a 25-hour volunteer position within two weeks of their move-in date. Members who are not employed or volunteering are required to be out of the house from 10:00 a.m. – 2:00 p.m. Monday through Friday.

8. Overnight pass requirements:
a) Have been a member for at least 14 days.
b) Submit a completed overnight pass request 24–48 hours before leaving.
c) Leave a contact number.
d) Make sure chore(s) is/are covered.
e) Have no outstanding bed dues or chore fines.
f) Each member will be drug tested upon return.
When a full member, you may stay out three nights a week (not consecutively) and must also meet requirements B–E above.

9. House meetings are mandatory! The only exception is an approved and documentable work commitment and/or one House meeting per month for an authorized overnight stay.

Being late or missing a House Meeting will result in:
1st Violation: Conversation with management
2nd Violation: Behavioral Contract

10. Disruptive behavior is grounds for dismissal, including:
a) Any physical or verbally antisocial behavior
b) Stealing (eating someone else's food/using their toiletries is considered theft)
c) Lying
d) Being in another member's room without permission
e) Always complaining or bringing negativity into the House

11. Weekly chore lists will be posted at the beginning of each week. Missing a chore is a $5 fine.

12. BE CLEAN. The bedroom needs to be orderly. No leaving dishes in the sink, leaving personal items in common areas. Not bathing, not changing bed sheets weekly, or being unsanitary in any way are all violations. "Leave a room better than you found it."

13. Members are responsible for purchasing and cooking their own food and hygiene items. Members on medications are required to supply their own lockbox and provide management with a copy of the key. The House will supply: laundry soap, dish soap, dishwasher soap, toilet paper, paper towels, cleaning supplies, and coffee once monthly.

14. No alcoholics or addicts in active use are allowed on premises – no exceptions!! Any visitors may be subject to drug/alcohol testing at any time.

15. If you are the last to leave the house, you are responsible for locking both doors and checking lights & TVs.

16. The living room television is to be off between 12 am–7 am Sun–Thurs. QUIET TIME: 10:30 pm–7 am Sun–Thurs; Fri & Sat 12 am–7 am.

17A. There is a 10:30 p.m. curfew for all members in their 14-day probationary period. After the 14-day probationary period and at a zero balance, curfew changes to 12:30 am.

17B. If a member stays out all night without permission, their door code will be removed until they speak with management. A UA/Breathalyzer test will be done upon return, and if allowed to stay, a Behavioral Contract and 9:00 p.m. curfew will be in effect for 30 days.

18. Each member will be assigned a laundry day. Laundry must be done and put up immediately.

19. All House members are responsible for ensuring anonymity and friendliness within the neighborhood. All House business remains within the Facility.

20. No soliciting in the neighborhood for any reason or loitering in front of the House.

21. Members are allowed to have a vehicle with management consent. Copies of a current driver's license, registration, and insurance must be provided within three days of move-in.

22. Do not park in front of the neighbor's house. No broken-down vehicles allowed on premises unless approved by the House Manager.

23. Grocery shopping should be done on a weekly basis due to limited shelf and refrigerator space.

24. After 1:00 am, the kitchen is considered a quiet area.

25. No burning of candles, incense or sage without House Manager approval. No smoking in the House. Vaping is allowed but must be kept to a minimum. Failure to comply will result in loss of inside privileges for 30 days.

26. All rooms are assigned by the House Manager. Room changes require management approval.

27. No visitors are allowed in any rooms alone. Visitors must be approved by management and the roommate must be comfortable with the visitor.

28. No weapons of any kind are allowed on premises. If a weapon is found, the member may be asked to leave immediately.

29. Surfing pornography or distasteful websites on House computers is not allowed.

30. Gaming consoles, laptops, and iPads are allowed at your own risk. House Managers may search browser history of related equipment.

31. Recovery Centered Living may have working monitoring security cameras inside and outside of the house.

32. Once a member departs, all mail will be returned to the sender. Please apply for a change of address upon departure.

33. Recovery Centered Living is not responsible for any member's stolen items.

34. Members who had financial support to pay membership fees and breach contract will have their family or payee contacted by Recovery Centered Living.

35. This Agreement is not a lease and does not create a landlord-tenant relationship of any kind. Membership Fees do not constitute rent. If a dismissed member remains on property after notice to depart, they may be arrested for criminal trespassing. The House may change the locks without notice. After a member departs, they have 72 hours to coordinate pick up of their belongings. After 30 days their property will be donated.

36. Breach of contract for any reason (relapse, two weeks late on membership fees, excessive guideline infractions, stealing, disruptive behavior, etc.) will result in loss of all funds paid. The Facility will be entitled to $5,000.00 in liquidated damages for disruption to business operations if a member fails to leave immediately upon dismissal.

The rules are suggested guidelines and subject to change. Recovery Centered Living reserves the right to modify consequences, move straight to a behavioral contract and dismissal as necessary, or revoke the membership of any member deemed a threat to the sobriety and recovery of members.

Slade Skaggs has full authority over the Houses as needed.

Failure to comply with Recovery Centered Guidelines will result in:
1st Violation: Conversation with management
2nd Violation: Behavioral Contract

By signing below, I acknowledge that I have read, understand, and agree to abide by all of the above house guidelines and regulations. I understand that violation of these rules may result in dismissal from Recovery Centered Living.`;

export default function IntakeForm() {
  const [step, setStep]         = useState(0);
  const [locations, setLocations] = useState([]);
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
                  {HOUSE_RULES}
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