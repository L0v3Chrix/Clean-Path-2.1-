import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Shield, ChevronDown, ChevronRight, Upload, FileText, CheckCircle2, XCircle, Clock, Minus, Building2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ComplianceReadinessScore from '@/components/compliance/ComplianceReadinessScore';
import ComplianceDomainAccordion from '@/components/compliance/ComplianceDomainAccordion';
import { NARR_STANDARDS } from '@/lib/narrStandards';

export default function Compliance() {
  const [locations, setLocations] = useState([]);
  const [selectedLocationId, setSelectedLocationId] = useState('all');
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadInitial();
  }, []);

  const loadInitial = async () => {
    setLoading(true);
    const [locs, recs] = await Promise.all([
      base44.entities.Location.list(),
      base44.entities.NarrCompliance.list(),
    ]);
    setLocations(locs.filter(l => l.status === 'active'));
    setRecords(recs);
    setLoading(false);
  };

  const getRecord = (ruleId) => {
    return records.find(r =>
      r.rule_id === ruleId &&
      (selectedLocationId === 'all' ? true : r.location_id === selectedLocationId)
    );
  };

  const updateRecord = async (ruleId, domain, ruleName, updates) => {
    setSaving(true);
    const existing = getRecord(ruleId);
    const payload = {
      rule_id: ruleId,
      domain,
      rule_name: ruleName,
      location_id: selectedLocationId !== 'all' ? selectedLocationId : undefined,
      organization_id: 'default',
      ...updates,
    };
    let updated;
    if (existing) {
      updated = await base44.entities.NarrCompliance.update(existing.id, payload);
      setRecords(prev => prev.map(r => r.id === existing.id ? updated : r));
    } else {
      updated = await base44.entities.NarrCompliance.create(payload);
      setRecords(prev => [...prev, updated]);
    }
    setSaving(false);
  };

  const handleFileUpload = async (ruleId, domain, ruleName, file) => {
    setSaving(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    await updateRecord(ruleId, domain, ruleName, { document_url: file_url, last_reviewed: new Date().toISOString().split('T')[0] });
    setSaving(false);
  };

  // Score calculation
  const allRules = NARR_STANDARDS.flatMap(d => d.rules);
  const totalRules = allRules.length;
  const compliantCount = allRules.filter(rule => getRecord(rule.id)?.status === 'compliant').length;
  const inProgressCount = allRules.filter(rule => getRecord(rule.id)?.status === 'in_progress').length;
  const notMetCount = allRules.filter(rule => getRecord(rule.id)?.status === 'not_met').length;
  const score = totalRules > 0 ? Math.round((compliantCount / totalRules) * 100) : 0;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Shield className="w-6 h-6 text-purple-600" />
            NARR Compliance Tracker
          </h1>
          <p className="text-slate-500 mt-1 text-sm">Track standards across all 4 NARR domains and monitor certification readiness.</p>
        </div>
        <div className="flex items-center gap-3">
          {saving && <span className="text-xs text-slate-400 animate-pulse">Saving...</span>}
          <Select value={selectedLocationId} onValueChange={setSelectedLocationId}>
            <SelectTrigger className="w-52">
              <Building2 className="w-4 h-4 mr-1 text-slate-400" />
              <SelectValue placeholder="All Locations" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Locations</SelectItem>
              {locations.map(l => (
                <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Readiness Score + Domain Summary */}
      <ComplianceReadinessScore
        score={score}
        compliant={compliantCount}
        inProgress={inProgressCount}
        notMet={notMetCount}
        total={totalRules}
        domains={NARR_STANDARDS}
        getRecord={getRecord}
      />

      {/* Domain Accordions */}
      {loading ? (
        <div className="space-y-3">
          {[1,2,3,4].map(i => <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />)}
        </div>
      ) : (
        <div className="space-y-4">
          {NARR_STANDARDS.map(domain => (
            <ComplianceDomainAccordion
              key={domain.id}
              domain={domain}
              getRecord={getRecord}
              onUpdateRecord={updateRecord}
              onFileUpload={handleFileUpload}
            />
          ))}
        </div>
      )}
    </div>
  );
}