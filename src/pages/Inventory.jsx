import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Package } from 'lucide-react';
import MedicationInventory from '@/components/medications/MedicationInventory';

export default function Inventory() {
  const [orgId, setOrgId] = useState(null);

  useEffect(() => {
    base44.entities.Organization.list('name', 1).then(orgs => {
      if (orgs?.[0]) setOrgId(orgs[0].id);
    });
  }, []);

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#FEF3C7' }}>
          <Package className="w-5 h-5" style={{ color: '#B45309' }} />
        </div>
        <div>
          <h1 className="text-2xl font-black" style={{ color: '#1C1917' }}>Medication Inventory</h1>
          <p className="text-sm" style={{ color: '#78716C' }}>Track stock levels, low-stock alerts, and procurement orders</p>
        </div>
      </div>
      <MedicationInventory organizationId={orgId} />
    </div>
  );
}