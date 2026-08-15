import { useState } from 'react';
import { X, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

// Reusable labeled select
function Field({ label, hint, children }) {
  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-1.5">
        {label}
        {hint && (
          <span className="group relative">
            <Info className="w-3 h-3 text-slate-400 cursor-help" />
            <span className="absolute left-5 top-0 z-10 hidden group-hover:block bg-slate-800 text-white text-xs rounded-lg px-3 py-2 w-56 shadow-lg">{hint}</span>
          </span>
        )}
      </Label>
      {children}
    </div>
  );
}

function SectionHeader({ title, description }) {
  return (
    <div className="border-t pt-5">
      <p className="text-sm font-bold text-slate-800">{title}</p>
      {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
    </div>
  );
}

const PNTA = <SelectItem value="prefer_not_to_answer">Prefer not to answer</SelectItem>;

export default function ResidentForm({ resident, locations, onSave, onClose }) {
  const [form, setForm] = useState(resident || {
    first_name: '', last_name: '', date_of_birth: '',
    phone: '', email: '', location_id: '', room: '', status: 'applicant',
    intake_date: new Date().toISOString().split('T')[0],
    sober_date: '', recovery_pathway: '', referred_by: '',
    emergency_contact_name: '', emergency_contact_phone: '', emergency_contact_relationship: '',
    notes: '',
    // Cultural & Identity fields
    gender_identity: '', gender_identity_other: '',
    pronouns: '', pronouns_other: '',
    sexual_orientation: '', sexual_orientation_other: '',
    transition_status: '',
    race: '', race_other: '',
    ethnicity: '',
    primary_language: '', primary_language_other: '',
    interpreter_needed: false,
    religion_spirituality: '', religion_other: '',
    veteran_status: '',
    disability_status: '',
    housing_status_at_intake: '',
    trauma_informed_notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaveError('');
    try {
      await onSave(form);
    } catch (error) {
      setSaveError(error.message || 'Unable to save this resident.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white z-10">
          <h2 className="text-lg font-bold">{resident ? 'Edit Resident' : 'New Intake'}</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">

          {/* ── Basic Info ── */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="First Name *">
              <Input value={form.first_name} onChange={e => set('first_name', e.target.value)} required />
            </Field>
            <Field label="Last Name *">
              <Input value={form.last_name} onChange={e => set('last_name', e.target.value)} required />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Date of Birth">
              <Input type="date" value={form.date_of_birth} onChange={e => set('date_of_birth', e.target.value)} />
            </Field>
            <Field label="Phone">
              <Input value={form.phone} onChange={e => set('phone', e.target.value)} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Email">
              <Input type="email" value={form.email} onChange={e => set('email', e.target.value)} />
            </Field>
            <Field label="Referred By">
              <Input value={form.referred_by} onChange={e => set('referred_by', e.target.value)} placeholder="Organization, person, or source" />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Location">
              <Select value={form.location_id} onValueChange={v => set('location_id', v)}>
                <SelectTrigger><SelectValue placeholder="Select location" /></SelectTrigger>
                <SelectContent>
                  {locations.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Room">
              <Input value={form.room} onChange={e => set('room', e.target.value)} placeholder="e.g. 2B" />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Status">
              <Select value={form.status} onValueChange={v => set('status', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="applicant">Applicant</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="on_leave">On Leave</SelectItem>
                  <SelectItem value="exited">Exited</SelectItem>
                  <SelectItem value="alumni">Alumni</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Recovery Pathway">
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
                  <SelectItem value="secular">Secular / Non-12-Step</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Intake Date">
              <Input type="date" value={form.intake_date} onChange={e => set('intake_date', e.target.value)} />
            </Field>
            <Field label="Sobriety / Recovery Date">
              <Input type="date" value={form.sober_date} onChange={e => set('sober_date', e.target.value)} />
            </Field>
          </div>

          {/* ── Emergency Contact ── */}
          <SectionHeader title="Emergency Contact" />
          <div className="grid grid-cols-3 gap-3">
            <Field label="Name">
              <Input value={form.emergency_contact_name} onChange={e => set('emergency_contact_name', e.target.value)} />
            </Field>
            <Field label="Phone">
              <Input value={form.emergency_contact_phone} onChange={e => set('emergency_contact_phone', e.target.value)} />
            </Field>
            <Field label="Relationship">
              <Input value={form.emergency_contact_relationship} onChange={e => set('emergency_contact_relationship', e.target.value)} />
            </Field>
          </div>

          {/* ── Cultural & Identity ── */}
          <SectionHeader
            title="Cultural & Identity Information"
            description="All fields in this section are voluntary and confidential. This information helps us provide affirming, trauma-informed, and culturally responsive care."
          />

          <div className="bg-teal-50 border border-teal-200 rounded-xl px-4 py-3 text-xs text-teal-700">
            <strong>Trauma-Informed Notice:</strong> Residents are never required to share this information. It is used only to ensure affirming, appropriate, and equitable support.
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Race" hint="Used for equitable service reporting and culturally responsive care. Voluntary.">
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
                  <SelectItem value="multiracial">Multiracial / More than one race</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                  {PNTA}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Ethnicity">
              <Select value={form.ethnicity} onValueChange={v => set('ethnicity', v)}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="hispanic_latino">Hispanic or Latino</SelectItem>
                  <SelectItem value="not_hispanic_latino">Not Hispanic or Latino</SelectItem>
                  {PNTA}
                </SelectContent>
              </Select>
            </Field>
          </div>

          {form.race === 'other' && (
            <Field label="Race (self-describe)">
              <Input value={form.race_other} onChange={e => set('race_other', e.target.value)} placeholder="Please describe" />
            </Field>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Field label="Gender Identity" hint="Voluntary. Used to ensure affirming housing placement and use of correct name/pronouns.">
              <Select value={form.gender_identity} onValueChange={v => set('gender_identity', v)}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="man">Man</SelectItem>
                  <SelectItem value="woman">Woman</SelectItem>
                  <SelectItem value="non_binary">Non-Binary</SelectItem>
                  <SelectItem value="genderqueer">Genderqueer</SelectItem>
                  <SelectItem value="genderfluid">Genderfluid</SelectItem>
                  <SelectItem value="agender">Agender</SelectItem>
                  <SelectItem value="two_spirit">Two-Spirit</SelectItem>
                  <SelectItem value="transgender_man">Transgender Man</SelectItem>
                  <SelectItem value="transgender_woman">Transgender Woman</SelectItem>
                  <SelectItem value="questioning">Questioning / Exploring</SelectItem>
                  <SelectItem value="other">Other / Self-describe</SelectItem>
                  {PNTA}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Pronouns">
              <Select value={form.pronouns} onValueChange={v => set('pronouns', v)}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="he_him">He / Him</SelectItem>
                  <SelectItem value="she_her">She / Her</SelectItem>
                  <SelectItem value="they_them">They / Them</SelectItem>
                  <SelectItem value="he_they">He / They</SelectItem>
                  <SelectItem value="she_they">She / They</SelectItem>
                  <SelectItem value="ze_zir">Ze / Zir</SelectItem>
                  <SelectItem value="xe_xem">Xe / Xem</SelectItem>
                  <SelectItem value="other">Other / Self-describe</SelectItem>
                  {PNTA}
                </SelectContent>
              </Select>
            </Field>
          </div>

          {form.gender_identity === 'other' && (
            <Field label="Gender Identity (self-describe)">
              <Input value={form.gender_identity_other} onChange={e => set('gender_identity_other', e.target.value)} placeholder="Please describe" />
            </Field>
          )}
          {form.pronouns === 'other' && (
            <Field label="Pronouns (self-describe)">
              <Input value={form.pronouns_other} onChange={e => set('pronouns_other', e.target.value)} placeholder="e.g. fae / faer" />
            </Field>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Field label="Sexual Orientation" hint="Voluntary and kept strictly confidential. Helps ensure affirming peer placement and support resources.">
              <Select value={form.sexual_orientation} onValueChange={v => set('sexual_orientation', v)}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="heterosexual_straight">Heterosexual / Straight</SelectItem>
                  <SelectItem value="gay">Gay</SelectItem>
                  <SelectItem value="lesbian">Lesbian</SelectItem>
                  <SelectItem value="bisexual">Bisexual</SelectItem>
                  <SelectItem value="pansexual">Pansexual</SelectItem>
                  <SelectItem value="asexual">Asexual</SelectItem>
                  <SelectItem value="queer">Queer</SelectItem>
                  <SelectItem value="questioning">Questioning / Exploring</SelectItem>
                  <SelectItem value="other">Other / Self-describe</SelectItem>
                  {PNTA}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Gender Transition Status" hint="Used only to ensure appropriate affirming housing placement and access to gender-affirming care.">
              <Select value={form.transition_status} onValueChange={v => set('transition_status', v)}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="not_applicable">Not Applicable</SelectItem>
                  <SelectItem value="considering">Considering / Exploring</SelectItem>
                  <SelectItem value="socially_transitioned">Socially Transitioned</SelectItem>
                  <SelectItem value="medically_transitioning">Medically Transitioning (in process)</SelectItem>
                  <SelectItem value="medically_transitioned">Medically Transitioned</SelectItem>
                  {PNTA}
                </SelectContent>
              </Select>
            </Field>
          </div>

          {form.sexual_orientation === 'other' && (
            <Field label="Sexual Orientation (self-describe)">
              <Input value={form.sexual_orientation_other} onChange={e => set('sexual_orientation_other', e.target.value)} placeholder="Please describe" />
            </Field>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Field label="Primary Language" hint="Ensures language access and interpretation services are arranged.">
              <Select value={form.primary_language} onValueChange={v => set('primary_language', v)}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="english">English</SelectItem>
                  <SelectItem value="spanish">Spanish / Español</SelectItem>
                  <SelectItem value="arabic">Arabic / العربية</SelectItem>
                  <SelectItem value="chinese_mandarin">Chinese (Mandarin)</SelectItem>
                  <SelectItem value="chinese_cantonese">Chinese (Cantonese)</SelectItem>
                  <SelectItem value="french">French / Français</SelectItem>
                  <SelectItem value="haitian_creole">Haitian Creole</SelectItem>
                  <SelectItem value="hindi">Hindi / हिंदी</SelectItem>
                  <SelectItem value="hmong">Hmong</SelectItem>
                  <SelectItem value="korean">Korean / 한국어</SelectItem>
                  <SelectItem value="portuguese">Portuguese / Português</SelectItem>
                  <SelectItem value="russian">Russian / Русский</SelectItem>
                  <SelectItem value="somali">Somali</SelectItem>
                  <SelectItem value="tagalog">Tagalog / Filipino</SelectItem>
                  <SelectItem value="vietnamese">Vietnamese / Tiếng Việt</SelectItem>
                  <SelectItem value="american_sign_language">American Sign Language (ASL)</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                  {PNTA}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Religion / Spirituality" hint="Used to align recovery supports (e.g. faith-based meetings, dietary needs, spiritual care).">
              <Select value={form.religion_spirituality} onValueChange={v => set('religion_spirituality', v)}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="christian">Christian (General)</SelectItem>
                  <SelectItem value="catholic">Catholic</SelectItem>
                  <SelectItem value="protestant">Protestant</SelectItem>
                  <SelectItem value="evangelical">Evangelical</SelectItem>
                  <SelectItem value="mormon_lds">Mormon / LDS</SelectItem>
                  <SelectItem value="jewish">Jewish</SelectItem>
                  <SelectItem value="muslim">Muslim / Islam</SelectItem>
                  <SelectItem value="buddhist">Buddhist</SelectItem>
                  <SelectItem value="hindu">Hindu</SelectItem>
                  <SelectItem value="native_spiritual">Native / Indigenous Spiritual</SelectItem>
                  <SelectItem value="spiritual_not_religious">Spiritual but not religious</SelectItem>
                  <SelectItem value="agnostic">Agnostic</SelectItem>
                  <SelectItem value="atheist">Atheist / No religion</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                  {PNTA}
                </SelectContent>
              </Select>
            </Field>
          </div>

          {form.primary_language === 'other' && (
            <Field label="Primary Language (specify)">
              <Input value={form.primary_language_other} onChange={e => set('primary_language_other', e.target.value)} placeholder="Language name" />
            </Field>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Field label="Veteran / Military Status">
              <Select value={form.veteran_status} onValueChange={v => set('veteran_status', v)}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="not_a_veteran">Not a Veteran</SelectItem>
                  <SelectItem value="active_duty">Active Duty</SelectItem>
                  <SelectItem value="veteran">Veteran</SelectItem>
                  <SelectItem value="national_guard_reserve">National Guard / Reserve</SelectItem>
                  {PNTA}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Disability Status" hint="Used to arrange appropriate accommodations. Voluntary.">
              <Select value={form.disability_status} onValueChange={v => set('disability_status', v)}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None / Not applicable</SelectItem>
                  <SelectItem value="physical">Physical disability</SelectItem>
                  <SelectItem value="cognitive_intellectual">Cognitive / Intellectual disability</SelectItem>
                  <SelectItem value="mental_health">Mental health condition</SelectItem>
                  <SelectItem value="sensory_vision_hearing">Sensory (vision / hearing)</SelectItem>
                  <SelectItem value="multiple">Multiple disabilities</SelectItem>
                  {PNTA}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Housing Status at Intake">
              <Select value={form.housing_status_at_intake} onValueChange={v => set('housing_status_at_intake', v)}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="housed">Housed (stable)</SelectItem>
                  <SelectItem value="couch_surfing">Couch surfing / Temporary</SelectItem>
                  <SelectItem value="transitional_housing">Transitional housing</SelectItem>
                  <SelectItem value="shelter">Shelter</SelectItem>
                  <SelectItem value="vehicle">Living in vehicle</SelectItem>
                  <SelectItem value="unsheltered">Unsheltered / Street</SelectItem>
                  <SelectItem value="incarcerated">Incarcerated / Releasing</SelectItem>
                  {PNTA}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Interpreter Needed?">
              <Select value={String(form.interpreter_needed)} onValueChange={v => set('interpreter_needed', v === 'true')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="false">No</SelectItem>
                  <SelectItem value="true">Yes — interpretation services needed</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>

          {/* ── Staff Notes ── */}
          <SectionHeader title="Staff Notes" />
          <Field label="General Notes">
            <Textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={3} placeholder="General intake notes…" />
          </Field>
          <Field label="Trauma-Informed / Cultural Considerations" hint="Staff-only. Document any trauma history, cultural considerations, known triggers, or affirming care notes. Strictly confidential.">
            <Textarea value={form.trauma_informed_notes} onChange={e => set('trauma_informed_notes', e.target.value)} rows={3} placeholder="e.g. Needs gender-affirming housing placement; prefers female staff…" />
          </Field>

          {saveError && <p role="alert" className="text-sm text-red-700">{saveError}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving} className="bg-teal-600 hover:bg-teal-700">
              {saving ? 'Saving...' : resident ? 'Save Changes' : 'Complete Intake'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
