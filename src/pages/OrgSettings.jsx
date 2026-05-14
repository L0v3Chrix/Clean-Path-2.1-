import { Settings } from 'lucide-react';
import HouseRulesEditor from '@/components/settings/HouseRulesEditor';

export default function OrgSettings() {
  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
          <Settings className="w-5 h-5 text-amber-700" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Organization Settings</h1>
          <p className="text-sm text-slate-500">Configure your house rules and platform preferences.</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <HouseRulesEditor />
      </div>
    </div>
  );
}