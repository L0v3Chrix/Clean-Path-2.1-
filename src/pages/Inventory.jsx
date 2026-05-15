import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Package, ClipboardList, Syringe, Bell, BarChart2 } from 'lucide-react';
import HouseInventoryPanel from '@/components/inventory/HouseInventoryPanel';
import InventoryRequestsPanel from '@/components/inventory/InventoryRequestsPanel';
import InventoryRequestForm from '@/components/inventory/InventoryRequestForm';
import MedicationInventory from '@/components/medications/MedicationInventory';
import InventoryReports from '@/components/inventory/InventoryReports';

export default function Inventory() {
  const [org, setOrg] = useState(null);
  const [location, setLocation] = useState(null);
  const [user, setUser] = useState(null);
  const [requests, setRequests] = useState([]);
  const [items, setItems] = useState([]);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [activeTab, setActiveTab] = useState('supplies');

  useEffect(() => {
    const init = async () => {
      const [orgs, me] = await Promise.all([
        base44.entities.Organization.list('name', 1),
        base44.auth.me(),
      ]);
      const o = orgs?.[0];
      setOrg(o);
      setUser(me);
      if (o) {
        const locs = await base44.entities.Location.filter({ organization_id: o.id });
        setLocation(locs?.[0] || null);
      }
    };
    init();
  }, []);

  const loadRequests = async () => {
    if (!org) return;
    const data = await base44.entities.InventoryRequest.filter({ organization_id: org.id }, '-created_date');
    setRequests(data);
  };

  const loadItems = async () => {
    if (!org) return;
    const data = await base44.entities.HouseInventoryItem.filter({ organization_id: org.id });
    setItems(data);
  };

  useEffect(() => {
    if (org) { loadRequests(); loadItems(); }
  }, [org]);

  const isAdmin = user?.role === 'admin' || user?.role === 'staff';
  const pendingRequests = requests.filter(r => r.status === 'pending').length;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
            <Package className="w-5 h-5 text-amber-700" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900">Inventory</h1>
            <p className="text-sm text-slate-500">Track supplies, medications, and resident requests</p>
          </div>
        </div>
        <Button onClick={() => setShowRequestForm(true)} className="gap-1.5">
          <Bell className="w-4 h-4" /> Request a Supply
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-5">
          <TabsTrigger value="supplies" className="gap-1.5">
            <Package className="w-4 h-4" /> House Supplies
          </TabsTrigger>
          <TabsTrigger value="requests" className="gap-1.5 relative">
            <ClipboardList className="w-4 h-4" /> Requests
            {pendingRequests > 0 && (
              <span className="ml-1 bg-amber-500 text-white text-xs rounded-full px-1.5 py-0.5 leading-none">
                {pendingRequests}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="medications" className="gap-1.5">
            <Syringe className="w-4 h-4" /> Medications
          </TabsTrigger>
          <TabsTrigger value="reports" className="gap-1.5">
            <BarChart2 className="w-4 h-4" /> Reports
          </TabsTrigger>
        </TabsList>

        <TabsContent value="supplies">
          <HouseInventoryPanel
            organizationId={org?.id}
            locationId={location?.id}
          />
        </TabsContent>

        <TabsContent value="requests">
          <InventoryRequestsPanel
            requests={requests}
            isAdmin={isAdmin}
            onRefresh={loadRequests}
          />
        </TabsContent>

        <TabsContent value="medications">
          <MedicationInventory organizationId={org?.id} />
        </TabsContent>

        <TabsContent value="reports">
          <InventoryReports requests={requests} items={items} />
        </TabsContent>
      </Tabs>

      {showRequestForm && (
        <InventoryRequestForm
          organizationId={org?.id}
          locationId={location?.id}
          items={items}
          user={user}
          onClose={() => setShowRequestForm(false)}
          onSaved={() => { setShowRequestForm(false); loadRequests(); setActiveTab('requests'); }}
        />
      )}
    </div>
  );
}