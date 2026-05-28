import { useState, useEffect } from 'react';
import { appClient } from '@/services/appClient';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Save, RotateCcw, FileText } from 'lucide-react';

const DEFAULT_RULES = `[Your Organization Name] — House Guidelines & Resident Agreement

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

11. PROPERTY: Residents are responsible for their personal belongings. [Organization Name] is not liable for lost or stolen items.

12. COMPLIANCE: Residents must comply with all local, state, and federal laws.

By signing below, I acknowledge that I have read, understand, and agree to abide by all house rules and policies. I understand that violations may result in discharge from the program.`;

export default function HouseRulesEditor() {
  const [org, setOrg] = useState(null);
  const [rules, setRules] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    appClient.entities.Organization.list().then(orgs => {
      const o = orgs[0];
      if (o) {
        setOrg(o);
        setRules(o.house_rules || DEFAULT_RULES);
      } else {
        setRules(DEFAULT_RULES);
      }
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    if (org) {
      await appClient.entities.Organization.update(org.id, { house_rules: rules });
    } else {
      const created = await appClient.entities.Organization.create({ name: 'My Organization', house_rules: rules });
      setOrg(created);
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleReset = () => {
    setRules(DEFAULT_RULES);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-amber-700" />
          <div>
            <h3 className="font-semibold text-slate-800">House Rules & Resident Agreement</h3>
            <p className="text-xs text-slate-500">This text is displayed to applicants during the digital intake process and requires their e-signature.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleReset} className="gap-1.5">
            <RotateCcw className="w-3.5 h-3.5" /> Reset to Default
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5 bg-amber-700 hover:bg-amber-800 text-white">
            <Save className="w-3.5 h-3.5" />
            {saving ? 'Saving…' : saved ? '✓ Saved!' : 'Save Rules'}
          </Button>
        </div>
      </div>

      <Textarea
        value={rules}
        onChange={e => setRules(e.target.value)}
        rows={20}
        className="font-mono text-xs leading-relaxed"
        placeholder="Enter your house rules here…"
      />

      <p className="text-xs text-slate-400">
        Tip: Use plain text. Number your rules for clarity. Changes take effect immediately for all new intake submissions.
      </p>
    </div>
  );
}