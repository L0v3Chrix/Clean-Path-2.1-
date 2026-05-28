import { useState } from 'react';
import { appClient } from '@/services/appClient';
import { X, Plus, BedDouble, Building2, Zap, Star, Shield, Crown, CheckCircle2, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// ── Tier config ──────────────────────────────────────────────
const TIERS = [
  {
    id: 'starter',
    name: 'Starter',
    icon: Zap,
    color: '#6366F1',
    bg: '#EEF2FF',
    border: '#C7D2FE',
    beds: '1–12 beds',
    price: '$49/mo per location',
    perBed: '~$4.08/bed',
    features: ['Basic occupancy tracking', 'Resident intake forms', 'Morning check-ins', 'Community chat'],
    best: false,
  },
  {
    id: 'growth',
    name: 'Growth',
    icon: Star,
    color: '#D97706',
    bg: '#FEF3C7',
    border: '#FDE68A',
    beds: '13–30 beds',
    price: '$149/mo per location',
    perBed: '~$4.97/bed',
    features: ['Everything in Starter', 'Care plans & goals', 'Medication tracking', 'E-signatures', 'Analytics'],
    best: true,
  },
  {
    id: 'professional',
    name: 'Professional',
    icon: Shield,
    color: '#0F766E',
    bg: '#CCFBF1',
    border: '#99F6E4',
    beds: '31–75 beds',
    price: '$299/mo per location',
    perBed: '~$3.99/bed',
    features: ['Everything in Growth', 'Grant management', 'Outcomes module', 'HIPAA audit logs', 'Training center'],
    best: false,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    icon: Crown,
    color: '#7C3AED',
    bg: '#EDE9FE',
    border: '#DDD6FE',
    beds: '76+ beds / Multi-site',
    price: 'Custom pricing',
    perBed: 'Volume discounts',
    features: ['Everything in Professional', 'Unlimited locations', 'White-label intake', 'Dedicated support', 'API access'],
    best: false,
  },
];

function getTierForBeds(beds) {
  if (beds <= 12) return 'starter';
  if (beds <= 30) return 'growth';
  if (beds <= 75) return 'professional';
  return 'enterprise';
}

// ── Step 1: Choose action ────────────────────────────────────
function ActionStep({ onChoose }) {
  return (
    <div className="p-6 space-y-4">
      <p className="text-sm text-slate-500 mb-4">What would you like to do?</p>
      <div className="space-y-3">
        <button onClick={() => onChoose('add_beds')}
          className="w-full flex items-center gap-4 rounded-2xl border-2 border-slate-200 p-4 hover:border-teal-400 hover:bg-teal-50 transition-all text-left group">
          <div className="w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center shrink-0">
            <BedDouble className="w-5 h-5 text-teal-600" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-slate-800">Add beds to existing location</p>
            <p className="text-xs text-slate-500 mt-0.5">Increase the bed count at one of your current properties</p>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-teal-500" />
        </button>
        <button onClick={() => onChoose('new_location')}
          className="w-full flex items-center gap-4 rounded-2xl border-2 border-slate-200 p-4 hover:border-teal-400 hover:bg-teal-50 transition-all text-left group">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
            <Building2 className="w-5 h-5 text-indigo-600" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-slate-800">Add a new location / property</p>
            <p className="text-xs text-slate-500 mt-0.5">Onboard a brand new house or facility to your network</p>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-teal-500" />
        </button>
      </div>
    </div>
  );
}

// ── Step 2: Configure ────────────────────────────────────────
function ConfigureStep({ action, locations, onChange }) {
  const [form, setForm] = useState(
    action === 'add_beds'
      ? { location_id: locations[0]?.id || '', add_beds: 1 }
      : { name: '', address: '', city: '', state: '', zip: '', housing_type: '', total_beds: 12, narr_level: 'II' }
  );
  const set = (k, v) => { const next = { ...form, [k]: v }; setForm(next); onChange(next); };
  onChange(form);

  const bedCount = action === 'add_beds'
    ? (locations.find(l => l.id === form.location_id)?.total_beds || 0) + Number(form.add_beds || 0)
    : Number(form.total_beds || 0);
  const recommendedTier = TIERS.find(t => t.id === getTierForBeds(bedCount));

  return (
    <div className="p-6 space-y-4">
      {action === 'add_beds' ? (
        <>
          <div className="space-y-1.5">
            <Label>Select Location</Label>
            <Select value={form.location_id} onValueChange={v => set('location_id', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {locations.map(l => (
                  <SelectItem key={l.id} value={l.id}>{l.name} ({l.total_beds || 0} beds)</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Beds to Add</Label>
            <Input type="number" min="1" value={form.add_beds}
              onChange={e => set('add_beds', Number(e.target.value))} />
            {form.location_id && (
              <p className="text-xs text-slate-500">
                New total: <strong>{bedCount} beds</strong>
              </p>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="space-y-1.5">
            <Label>Property Name *</Label>
            <Input placeholder="e.g. Oak House, Recovery Home East" value={form.name} onChange={e => set('name', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Address</Label>
            <Input value={form.address} onChange={e => set('address', e.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5 col-span-1"><Label>City</Label><Input value={form.city} onChange={e => set('city', e.target.value)} /></div>
            <div className="space-y-1.5"><Label>State</Label><Input value={form.state} onChange={e => set('state', e.target.value)} maxLength={2} /></div>
            <div className="space-y-1.5"><Label>ZIP</Label><Input value={form.zip} onChange={e => set('zip', e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Housing Type</Label>
              <Input placeholder="Sober Living, Recovery…" value={form.housing_type} onChange={e => set('housing_type', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Total Beds</Label>
              <Input type="number" min="1" value={form.total_beds} onChange={e => set('total_beds', Number(e.target.value))} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>NARR Level</Label>
            <Select value={form.narr_level} onValueChange={v => set('narr_level', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {['I','II','III','IV','not_applicable'].map(l => (
                  <SelectItem key={l} value={l}>{l === 'not_applicable' ? 'Not Applicable' : `Level ${l}`}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </>
      )}

      {/* Tier recommendation */}
      {recommendedTier && (
        <div className="rounded-xl p-3 flex items-start gap-3 mt-2" style={{ background: recommendedTier.bg, border: `1px solid ${recommendedTier.border}` }}>
          <div className="mt-0.5">
            <recommendedTier.icon className="w-4 h-4" style={{ color: recommendedTier.color }} />
          </div>
          <div>
            <p className="text-xs font-bold" style={{ color: recommendedTier.color }}>Recommended plan: {recommendedTier.name}</p>
            <p className="text-xs text-slate-600 mt-0.5">{recommendedTier.beds} · {recommendedTier.price} <span className="text-slate-400">({recommendedTier.perBed})</span></p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Step 3: Pricing tiers ────────────────────────────────────
function PricingStep({ recommendedTierId, onSelect, selected }) {
  return (
    <div className="p-5 space-y-3 max-h-[60vh] overflow-y-auto">
      <p className="text-sm text-slate-500 mb-2">Choose a plan for this property. You can upgrade any time.</p>
      {TIERS.map(tier => {
        const Icon = tier.icon;
        const isSelected = selected === tier.id;
        const isRec = tier.id === recommendedTierId;
        return (
          <button key={tier.id} onClick={() => onSelect(tier.id)}
            className={`w-full text-left rounded-2xl border-2 p-4 transition-all relative ${
              isSelected ? 'border-current shadow-md' : 'border-slate-200 hover:border-slate-300'
            }`}
            style={isSelected ? { borderColor: tier.color, background: tier.bg } : {}}>
            {isRec && (
              <span className="absolute -top-2 left-4 text-[10px] font-bold px-2 py-0.5 rounded-full text-white" style={{ background: tier.color }}>
                Recommended
              </span>
            )}
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: tier.color + '20' }}>
                <Icon className="w-5 h-5" style={{ color: tier.color }} />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-slate-800">{tier.name}</p>
                  <div className="text-right">
                    <p className="text-sm font-bold" style={{ color: tier.color }}>{tier.price}</p>
                    <p className="text-[10px] text-slate-400">{tier.perBed}</p>
                  </div>
                </div>
                <p className="text-xs text-slate-500 mt-0.5 mb-2">{tier.beds}</p>
                <ul className="space-y-0.5">
                  {tier.features.map(f => (
                    <li key={f} className="flex items-center gap-1.5 text-xs text-slate-600">
                      <CheckCircle2 className="w-3 h-3 shrink-0" style={{ color: tier.color }} /> {f}
                    </li>
                  ))}
                </ul>
              </div>
              {isSelected && (
                <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" style={{ color: tier.color }} />
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ── Main modal ───────────────────────────────────────────────
export default function ExpandCapacityModal({ locations, onClose, onSaved }) {
  const [step, setStep] = useState(1); // 1=action, 2=configure, 3=pricing
  const [action, setAction] = useState(null);
  const [formData, setFormData] = useState({});
  const [selectedTier, setSelectedTier] = useState(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const handleAction = (a) => { setAction(a); setStep(2); };

  const bedCount = action === 'add_beds'
    ? (locations.find(l => l.id === formData.location_id)?.total_beds || 0) + Number(formData.add_beds || 0)
    : Number(formData.total_beds || 0);
  const recommendedTierId = getTierForBeds(bedCount);

  const handleNext = () => {
    setSelectedTier(recommendedTierId);
    setStep(3);
  };

  const handleSave = async () => {
    setSaving(true);
    if (action === 'add_beds') {
      const loc = locations.find(l => l.id === formData.location_id);
      if (loc) {
        await appClient.entities.Location.update(loc.id, {
          total_beds: (loc.total_beds || 0) + Number(formData.add_beds || 0)
        });
      }
    } else {
      await appClient.entities.Location.create({
        name: formData.name,
        address: formData.address,
        city: formData.city,
        state: formData.state,
        zip: formData.zip,
        housing_type: formData.housing_type,
        total_beds: Number(formData.total_beds || 0),
        narr_level: formData.narr_level,
        status: 'active',
        organization_id: 'default',
      });
    }
    setSaving(false);
    setDone(true);
  };

  const STEPS = ['Action', 'Configure', 'Plan'];
  const tierObj = TIERS.find(t => t.id === selectedTier);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b sticky top-0 bg-white rounded-t-2xl z-10">
          <div>
            <h2 className="font-bold text-slate-800 flex items-center gap-2">
              <Plus className="w-4 h-4 text-teal-600" /> Expand Capacity
            </h2>
            {!done && (
              <div className="flex items-center gap-1.5 mt-2">
                {STEPS.map((s, i) => (
                  <div key={s} className="flex items-center gap-1.5">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                      step > i + 1 ? 'bg-teal-600 text-white' : step === i + 1 ? 'bg-teal-100 text-teal-700 border-2 border-teal-400' : 'bg-slate-100 text-slate-400'
                    }`}>
                      {step > i + 1 ? '✓' : i + 1}
                    </div>
                    <span className={`text-[10px] font-medium ${step === i + 1 ? 'text-teal-700' : 'text-slate-400'}`}>{s}</span>
                    {i < STEPS.length - 1 && <div className="w-4 h-px bg-slate-200" />}
                  </div>
                ))}
              </div>
            )}
          </div>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1">
          {done ? (
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-teal-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-1">
                {action === 'add_beds' ? 'Beds Added!' : 'New Location Created!'}
              </h3>
              <p className="text-sm text-slate-500 mb-2">
                {action === 'add_beds'
                  ? `${formData.add_beds} bed(s) have been added.`
                  : `${formData.name} is now live in your network.`
                }
              </p>
              {tierObj && (
                <p className="text-xs text-slate-400">
                  Selected plan: <strong>{tierObj.name}</strong> · {tierObj.price}
                </p>
              )}
              <p className="text-xs text-slate-400 mt-1 italic">
                To complete billing setup for your selected plan, visit Settings → Billing.
              </p>
              <Button onClick={onSaved} className="mt-6 bg-teal-600 hover:bg-teal-700">
                Done
              </Button>
            </div>
          ) : step === 1 ? (
            <ActionStep onChoose={handleAction} />
          ) : step === 2 ? (
            <ConfigureStep action={action} locations={locations} onChange={setFormData} />
          ) : (
            <PricingStep recommendedTierId={recommendedTierId} onSelect={setSelectedTier} selected={selectedTier} />
          )}
        </div>

        {/* Footer */}
        {!done && step > 1 && (
          <div className="p-5 border-t bg-white rounded-b-2xl flex justify-between gap-3">
            <Button variant="outline" onClick={() => setStep(s => s - 1)}>Back</Button>
            {step === 2 ? (
              <Button className="bg-teal-600 hover:bg-teal-700 gap-2" onClick={handleNext}
                disabled={action === 'add_beds' ? !formData.location_id : !formData.name}>
                View Plans <ChevronRight className="w-4 h-4" />
              </Button>
            ) : (
              <Button className="bg-teal-600 hover:bg-teal-700 gap-2" onClick={handleSave}
                disabled={saving || !selectedTier}>
                {saving ? 'Saving…' : action === 'add_beds' ? 'Add Beds' : 'Create Location'}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}