import { useState, useRef, useEffect } from 'react';
import { X, Download, PenLine, RotateCcw, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { appClient } from '@/services/appClient';
import jsPDF from 'jspdf';

// ─── Form definitions ──────────────────────────────────────────────────────────
// Each form has: title, subtitle, sections (with paragraphs and/or fields)
const CONSENT_FORMS = {
  consent_form: {
    title: 'Consent to Services',
    subtitle: 'Your participation is voluntary and you have the right to ask questions at any time.',
    sections: [
      {
        heading: 'About This Agreement',
        body: `This form documents your agreement to participate in the services offered at this recovery residence. You are always in control of your own journey. Our role is to offer support, safety, and community — not to manage or control your choices.`,
      },
      {
        heading: 'Services We Provide',
        body: `We provide peer-based community living, wellness resources, life skills support, and connection to community care. Services are provided in a trauma-informed, non-judgmental environment that honors your dignity and autonomy.`,
      },
      {
        heading: 'Your Rights',
        body: `You have the right to receive services free from discrimination, abuse, or coercion. You may ask questions, raise concerns, or withdraw your participation at any time. Confidentiality will be maintained except where required by law to ensure safety.`,
      },
      {
        heading: 'Your Agreement',
        body: `By signing below, you confirm that you have read and understand this consent, and that you are voluntarily choosing to participate in services at this residence.`,
      },
    ],
    fields: [
      { key: 'legal_name', label: 'Full Legal Name', type: 'text', required: true },
      { key: 'date_of_birth', label: 'Date of Birth', type: 'date', required: true },
      { key: 'phone', label: 'Phone Number', type: 'text' },
    ],
  },

  resident_agreement: {
    title: 'Resident Community Agreement',
    subtitle: 'A shared understanding of how we live and support each other.',
    sections: [
      {
        heading: 'Our Community Values',
        body: `This residence is built on mutual respect, accountability, and support. Everyone here is navigating their own path, and we are committed to holding space for that. This agreement outlines how we can best support one another while living together.`,
      },
      {
        heading: 'Community Expectations',
        body: `We ask all community members to: treat everyone with dignity and respect, contribute to shared spaces, communicate openly with staff and peers, and honor the safety and recovery of everyone in the home. Substances that are not medically authorized are not permitted on the premises.`,
      },
      {
        heading: 'Program Fees & Financial Responsibility',
        body: `Program fees help sustain our community. You agree to pay your program fee according to the schedule agreed upon with staff. If you are facing financial hardship, please speak with your house manager — we want to find a solution together.`,
      },
      {
        heading: 'Guest & Curfew Policies',
        body: `Guests are welcome during designated hours. Overnight guests require prior staff approval. Curfew times exist to ensure the safety and rest of everyone in the home and will be discussed with you individually.`,
      },
      {
        heading: 'Changes & Exits',
        body: `If you choose to leave the program, we ask for as much notice as possible so we can connect you with continued support. We want your transition — whenever it happens — to be as safe and supported as possible.`,
      },
    ],
    fields: [
      { key: 'legal_name', label: 'Full Legal Name', type: 'text', required: true },
      { key: 'move_in_date', label: 'Move-In Date', type: 'date', required: true },
      { key: 'room_number', label: 'Room / Unit', type: 'text' },
    ],
  },

  house_rules: {
    title: 'Community Guidelines Acknowledgment',
    subtitle: 'These guidelines help keep our shared space safe, comfortable, and supportive for everyone.',
    sections: [
      {
        heading: 'Safety & Wellness',
        body: `The safety of every person in this home is our shared responsibility. We maintain a substance-free environment (except medically prescribed medications), and we ask that all community members support one another in upholding this. If you are struggling, please reach out — you will not be judged, and we will help you access support.`,
      },
      {
        heading: 'Shared Spaces',
        body: `Common areas (kitchen, living room, bathrooms) should be left clean and usable for all. Please clean up after yourself and be mindful of others' needs and schedules. Personal items should stay in your private space.`,
      },
      {
        heading: 'Noise & Rest',
        body: `We share walls and schedules. Please keep noise to a respectful level, especially during evening and overnight hours. Rest is an important part of healing, and we want everyone to have access to it.`,
      },
      {
        heading: 'Medications',
        body: `All medications — including medications for opioid use disorder (MOUD) — must be disclosed to staff and stored securely. There is no judgment here; we want to support your medical care safely.`,
      },
      {
        heading: 'Accountability',
        body: `When conflicts arise, we encourage direct, respectful communication. Staff are always available to help mediate. Behaviors that compromise the safety or well-being of others may result in a community review or, in serious cases, transition from the residence.`,
      },
    ],
    fields: [
      { key: 'legal_name', label: 'Full Legal Name', type: 'text', required: true },
      { key: 'date', label: 'Date of Acknowledgment', type: 'date', required: true },
    ],
  },

  intake_assessment: {
    title: 'Intake Wellness Assessment',
    subtitle: 'This information helps us provide you with the right support from day one.',
    sections: [
      {
        heading: 'Why We Collect This',
        body: `This assessment helps us understand your current wellness, history, and goals so we can connect you with the most relevant support. Everything you share is confidential and treated with respect. You may decline to answer any question.`,
      },
      {
        heading: 'Wellness & Support Goals',
        body: `We want to understand what matters most to you right now. Are there areas — like housing stability, employment, family connection, mental health support, or physical health — where you'd like extra support? Your answers will help us personalize your experience in our community.`,
      },
      {
        heading: 'Substance Use History',
        body: `If you are comfortable, please share your history with substance use so we can better support your wellness goals. This includes any medications you are currently taking or have previously used for your mental health or substance use. This information is never used to judge you.`,
      },
      {
        heading: 'Consent to Assess',
        body: `By signing below, you agree that the information collected in this assessment will be used solely to support your wellbeing and to help us coordinate care on your behalf. You may update this information at any time.`,
      },
    ],
    fields: [
      { key: 'legal_name', label: 'Full Legal Name', type: 'text', required: true },
      { key: 'date_of_birth', label: 'Date of Birth', type: 'date', required: true },
      { key: 'assessment_date', label: 'Assessment Date', type: 'date', required: true },
      { key: 'referred_by', label: 'Referred By (optional)', type: 'text' },
    ],
  },

  release_of_information: {
    title: 'Release of Information',
    subtitle: 'This form authorizes us to share your health information with specific providers or agencies on your behalf.',
    sections: [
      {
        heading: 'Your Privacy Rights',
        body: `Your personal and health information is protected under federal and state privacy laws, including 42 CFR Part 2 (which specifically protects information related to substance use treatment). We will never share your information without your explicit consent, except in situations where your immediate safety is at risk.`,
      },
      {
        heading: 'What You Are Authorizing',
        body: `This authorization allows us to send or receive the information types you select below to or from the person, agency, or provider you name. This helps us coordinate care and ensure that your entire support team is working with the same information.`,
      },
      {
        heading: 'Duration & Revocation',
        body: `This authorization is valid for one (1) year from the date of signing unless you specify a shorter period or revoke it in writing. You may revoke this authorization at any time by notifying us in writing. Revocation will not affect any actions already taken based on this authorization.`,
      },
      {
        heading: 'Your Choice',
        body: `Signing this form is completely voluntary. Refusing to sign will not affect your access to services here. You are always in control of your own information.`,
      },
    ],
    fields: [
      { key: 'legal_name', label: 'Full Legal Name', type: 'text', required: true },
      { key: 'date_of_birth', label: 'Date of Birth', type: 'date', required: true },
      { key: 'recipient_name', label: 'Release To / From (Name or Agency)', type: 'text', required: true },
      { key: 'recipient_phone', label: 'Recipient Phone / Fax', type: 'text' },
      { key: 'information_type', label: 'Type of Information (e.g. medical, behavioral, all)', type: 'text', required: true },
      { key: 'expiration_date', label: 'Authorization Expires On', type: 'date' },
    ],
  },

  recovery_plan: {
    title: 'Personal Wellness & Recovery Plan',
    subtitle: 'Your plan belongs to you — this is a living document you can update as your goals evolve.',
    sections: [
      {
        heading: 'Your Journey, Your Plan',
        body: `A wellness and recovery plan isn't a prescription — it's a reflection of what you want your life to look like and what support you need to get there. It is created by you, for you, with the guidance of our team. It can and should change as you grow.`,
      },
      {
        heading: 'What This Plan Covers',
        body: `Your plan may include short- and long-term goals related to: housing stability, employment or education, relationships and family, mental and physical health, community connection, and any wellness practices that matter to you (meetings, therapy, spirituality, fitness, etc.).`,
      },
      {
        heading: 'Review & Updates',
        body: `Your plan will be reviewed with you regularly — at least every 90 days, or sooner if your circumstances or goals change. You can request a review at any time. You are always welcome to update your goals, remove things that no longer serve you, or add new ones.`,
      },
      {
        heading: 'Your Agreement to This Plan',
        body: `By signing below, you acknowledge that you have co-created this plan with a staff member, that it reflects your current goals and values, and that you understand it is not a binding contract but a supportive tool.`,
      },
    ],
    fields: [
      { key: 'legal_name', label: 'Full Legal Name', type: 'text', required: true },
      { key: 'plan_date', label: 'Plan Start Date', type: 'date', required: true },
      { key: 'review_date', label: 'Scheduled Review Date', type: 'date' },
      { key: 'staff_name', label: 'Supporting Staff Member', type: 'text' },
    ],
  },

  photo_id: {
    title: 'Photo Identification — Copy on File',
    subtitle: 'We collect a copy of your ID to verify identity and assist with benefits enrollment and community coordination.',
    sections: [
      {
        heading: 'Why We Collect This',
        body: `A copy of your government-issued photo ID helps us accurately maintain your records, assist with benefits applications, and verify identity when required by partner agencies. This information is stored securely and is only accessed by authorized staff.`,
      },
      {
        heading: 'Accepted Forms of ID',
        body: `We accept any government-issued photo ID, including: state driver's license or ID card, US passport or passport card, military ID, tribal ID, or foreign government-issued ID. If you do not have a valid ID, please speak with your case manager — we can often help you obtain one.`,
      },
      {
        heading: 'Your Privacy',
        body: `Your ID copy is stored in your confidential file and is not shared with any third party without your written authorization. You may request to review your file at any time.`,
      },
    ],
    fields: [
      { key: 'legal_name', label: 'Full Legal Name', type: 'text', required: true },
      { key: 'id_type', label: 'Type of ID Provided', type: 'text', required: true },
      { key: 'id_number', label: 'ID Number (last 4 digits only, optional)', type: 'text' },
      { key: 'id_expiry', label: 'ID Expiration Date', type: 'date' },
    ],
  },

  tb_test: {
    title: 'Tuberculosis (TB) Screening Consent',
    subtitle: 'TB screening is a routine public health measure required for communal living settings.',
    sections: [
      {
        heading: 'Why TB Screening Matters',
        body: `Tuberculosis is a contagious illness that can spread in shared-living environments. Routine TB screening is a standard public health precaution — not a reflection of any individual's history or choices. It protects everyone in our community, including you.`,
      },
      {
        heading: 'What the Screening Involves',
        body: `TB screening typically involves a skin test (TST/Mantoux) or a blood test (IGRA). A result does not mean you have active TB — many people test positive due to prior exposure or vaccination and are completely healthy. A staff member or healthcare provider will explain your results and next steps.`,
      },
      {
        heading: 'Follow-Up Care',
        body: `If your screening requires any follow-up, we will connect you with a healthcare provider at no cost to you. We will support you through every step and ensure you have the information you need.`,
      },
      {
        heading: 'Your Consent',
        body: `By signing below, you agree to complete required TB screening as a condition of your stay in this communal residence, and authorize results to be shared with house staff for safety and compliance purposes.`,
      },
    ],
    fields: [
      { key: 'legal_name', label: 'Full Legal Name', type: 'text', required: true },
      { key: 'date_of_birth', label: 'Date of Birth', type: 'date', required: true },
      { key: 'test_date', label: 'Screening Date', type: 'date' },
      { key: 'test_location', label: 'Testing Location / Provider', type: 'text' },
    ],
  },
};

// ─── Signature Canvas ──────────────────────────────────────────────────────────
function SignaturePad({ onSign }) {
  const canvasRef = useRef();
  const [drawing, setDrawing] = useState(false);
  const [hasSig, setHasSig] = useState(false);

  const getPos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect();
    const src = e.touches ? e.touches[0] : e;
    return { x: src.clientX - rect.left, y: src.clientY - rect.top };
  };

  const start = (e) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const pos = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    setDrawing(true);
  };

  const draw = (e) => {
    if (!drawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    const pos = getPos(e, canvas);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    setHasSig(true);
  };

  const stop = (e) => {
    if (!drawing) return;
    e.preventDefault();
    setDrawing(false);
    const dataUrl = canvasRef.current.toDataURL();
    onSign(dataUrl);
  };

  const clear = () => {
    const canvas = canvasRef.current;
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    setHasSig(false);
    onSign(null);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-sm font-medium text-slate-700">Signature *</label>
        {hasSig && (
          <button type="button" onClick={clear} className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600">
            <RotateCcw className="w-3 h-3" /> Clear
          </button>
        )}
      </div>
      <canvas
        ref={canvasRef}
        width={500}
        height={120}
        className="w-full border-2 border-dashed border-slate-300 rounded-lg bg-slate-50 cursor-crosshair touch-none"
        onMouseDown={start}
        onMouseMove={draw}
        onMouseUp={stop}
        onMouseLeave={stop}
        onTouchStart={start}
        onTouchMove={draw}
        onTouchEnd={stop}
      />
      {!hasSig && (
        <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
          <PenLine className="w-3 h-3" /> Draw your signature above
        </p>
      )}
    </div>
  );
}

// ─── Main Modal ────────────────────────────────────────────────────────────────
export default function ConsentFormModal({ docType, resident, onClose, onSaved }) {
  const form = CONSENT_FORMS[docType];
  const [fieldValues, setFieldValues] = useState({});
  const [signatureDataUrl, setSignatureDataUrl] = useState(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Pre-fill common fields from resident
    const today = new Date().toISOString().split('T')[0];
    setFieldValues({
      legal_name: `${resident.first_name || ''} ${resident.last_name || ''}`.trim(),
      date_of_birth: resident.date_of_birth || '',
      phone: resident.phone || '',
      date: today,
      assessment_date: today,
      plan_date: today,
      move_in_date: resident.intake_date || today,
      test_date: today,
    });
  }, [resident]);

  if (!form) return null;

  const generatePDF = () => {
    const doc = new jsPDF({ unit: 'pt', format: 'letter' });
    const W = doc.internal.pageSize.getWidth();
    const margin = 56;
    const lineW = W - margin * 2;
    let y = 60;

    const checkPage = (needed = 20) => {
      if (y + needed > doc.internal.pageSize.getHeight() - 60) {
        doc.addPage();
        y = 60;
      }
    };

    // Header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(15, 23, 42);
    doc.text(form.title, margin, y);
    y += 22;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    const subLines = doc.splitTextToSize(form.subtitle, lineW);
    doc.text(subLines, margin, y);
    y += subLines.length * 13 + 10;

    doc.setDrawColor(226, 232, 240);
    doc.line(margin, y, W - margin, y);
    y += 18;

    // Sections
    form.sections.forEach(section => {
      checkPage(60);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text(section.heading, margin, y);
      y += 16;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(51, 65, 85);
      const lines = doc.splitTextToSize(section.body, lineW);
      lines.forEach(line => {
        checkPage(14);
        doc.text(line, margin, y);
        y += 14;
      });
      y += 10;
    });

    // Fields
    y += 10;
    checkPage(30);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text('Participant Information', margin, y);
    y += 18;

    form.fields.forEach(field => {
      checkPage(36);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text(field.label, margin, y);
      y += 13;

      const val = fieldValues[field.key] || '';
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text(val || '____________________', margin, y);
      y += 18;
    });

    // Signature
    y += 12;
    checkPage(100);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text('Signature', margin, y);
    y += 14;

    if (signatureDataUrl) {
      doc.addImage(signatureDataUrl, 'PNG', margin, y, 200, 60);
      y += 70;
    } else {
      doc.setDrawColor(200, 200, 200);
      doc.line(margin, y + 50, margin + 220, y + 50);
      y += 60;
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(`Date Signed: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, margin, y);
    y += 14;
    doc.text(`Document Generated by ClearPath Platform`, margin, y);

    return doc;
  };

  const handleDownload = () => {
    const doc = generatePDF();
    const name = `${resident.first_name}_${resident.last_name}_${docType}_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(name.replace(/\s+/g, '_'));
  };

  const handleSaveAndDownload = async () => {
    const required = form.fields.filter(f => f.required);
    for (const f of required) {
      if (!fieldValues[f.key]) {
        alert(`Please fill in: ${f.label}`);
        return;
      }
    }
    if (!signatureDataUrl) {
      alert('Please provide your signature before saving.');
      return;
    }

    setSaving(true);
    try {
      const pdfDoc = generatePDF();
      const pdfBlob = pdfDoc.output('blob');
      const file = new File([pdfBlob], `${docType}.pdf`, { type: 'application/pdf' });
      const { file_url } = await appClient.integrations.Core.UploadFile({ file });

      const today = new Date().toISOString().split('T')[0];
      const existing = await appClient.entities.ResidentDocument.filter({
        resident_id: resident.id,
        document_type: docType,
      });

      const payload = {
        resident_id: resident.id,
        location_id: resident.location_id,
        organization_id: resident.organization_id || 'default',
        document_type: docType,
        file_url,
        signed_date: today,
        status: 'current',
      };

      if (existing?.length > 0) {
        await appClient.entities.ResidentDocument.update(existing[0].id, payload);
      } else {
        await appClient.entities.ResidentDocument.create(payload);
      }

      // Also update legacy consent flags on resident entity
      if (docType === 'consent_form') {
        await appClient.entities.Resident.update(resident.id, { consent_signed: true });
      }
      if (docType === 'resident_agreement') {
        await appClient.entities.Resident.update(resident.id, { resident_agreement_signed: true });
      }

      pdfDoc.save(`${resident.first_name}_${resident.last_name}_${docType}.pdf`);
      setDone(true);
      onSaved();
    } catch (err) {
      console.error(err);
      alert('Something went wrong saving the document. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{form.title}</h2>
            <p className="text-sm text-slate-500 mt-0.5">{form.subtitle}</p>
          </div>
          <button onClick={onClose} className="ml-4 text-slate-400 hover:text-slate-600 flex-shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">
          {done ? (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
              <CheckCircle2 className="w-12 h-12 text-green-500" />
              <h3 className="text-lg font-bold text-slate-900">Document Saved</h3>
              <p className="text-sm text-slate-500 max-w-xs">
                The signed {form.title} has been saved to {resident.first_name}'s record and downloaded to your device.
              </p>
              <Button onClick={onClose} className="mt-2 bg-teal-600 hover:bg-teal-700">Done</Button>
            </div>
          ) : (
            <>
              {/* Sections */}
              {form.sections.map((s, i) => (
                <div key={i} className="bg-slate-50 rounded-xl p-4">
                  <h3 className="text-sm font-semibold text-slate-800 mb-1.5">{s.heading}</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">{s.body}</p>
                </div>
              ))}

              {/* Fields */}
              <div>
                <h3 className="text-sm font-semibold text-slate-800 mb-3">Your Information</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {form.fields.map(field => (
                    <div key={field.key}>
                      <label className="text-xs font-medium text-slate-600 block mb-1">
                        {field.label}{field.required && <span className="text-red-500 ml-0.5">*</span>}
                      </label>
                      <Input
                        type={field.type}
                        value={fieldValues[field.key] || ''}
                        onChange={e => setFieldValues(v => ({ ...v, [field.key]: e.target.value }))}
                        className="text-sm"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Signature */}
              <div>
                <SignaturePad onSign={setSignatureDataUrl} />
              </div>

              <p className="text-xs text-slate-400 text-center">
                By signing above and clicking "Save &amp; Download", you agree to the terms of this document.
              </p>
            </>
          )}
        </div>

        {/* Footer */}
        {!done && (
          <div className="flex items-center justify-between gap-3 p-4 border-t flex-shrink-0 bg-white">
            <Button variant="outline" onClick={handleDownload} className="gap-2 text-slate-600">
              <Download className="w-4 h-4" /> Preview PDF
            </Button>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={onClose}>Cancel</Button>
              <Button
                onClick={handleSaveAndDownload}
                disabled={saving}
                className="bg-teal-600 hover:bg-teal-700 gap-2"
              >
                {saving ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                Save & Download PDF
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}