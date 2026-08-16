import { useState, useEffect } from 'react';
import { appClient } from '@/services/appClient';
import { Plus, Clock, CheckCircle2, AlertTriangle, Loader2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import TicketCard from './TicketCard';
import TicketFormModal from './TicketFormModal';
import { toast } from 'sonner';

const STATUS_COLS = [
  { id: 'open',        label: 'Open',        icon: AlertTriangle, color: 'text-red-500',   bg: 'bg-red-50',   border: 'border-red-200' },
  { id: 'in_progress', label: 'In Progress',  icon: Clock,         color: 'text-amber-500', bg: 'bg-amber-50', border: 'border-amber-200' },
  { id: 'completed',   label: 'Completed',    icon: CheckCircle2,  color: 'text-green-500', bg: 'bg-green-50', border: 'border-green-200' },
];

const PRIORITY_COLORS = {
  urgent: 'bg-red-100 text-red-700',
  high:   'bg-orange-100 text-orange-700',
  medium: 'bg-amber-100 text-amber-700',
  low:    'bg-slate-100 text-slate-500',
};

export default function MaintenanceBoard({ user }) {
  const [tickets, setTickets] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTicket, setEditingTicket] = useState(null);
  const [search, setSearch] = useState('');
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterLocation, setFilterLocation] = useState('all');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [t, l] = await Promise.all([
        appClient.entities.MaintenanceTicket.list('-created_date', 200),
        appClient.entities.Location.list('name', 50),
      ]);
      setTickets(t);
      setLocations(l);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleStatusChange = async (ticket, newStatus) => {
    const update = { status: newStatus };
    if (newStatus === 'completed') update.completed_at = new Date().toISOString();
    await appClient.entities.MaintenanceTicket.update(ticket.id, update);

    // Notify submitter when completed
    if (newStatus === 'completed' && ticket.submitted_by_email) {
      try {
        const delivery = await appClient.integrations.Core.SendEmail({
          to: ticket.submitted_by_email,
          subject: `✅ Maintenance Ticket Completed: ${ticket.title}`,
          body: `Hi ${ticket.submitted_by_name},\n\nYour maintenance request "${ticket.title}" (${ticket.room || ticket.location_name}) has been marked as completed.\n\n${ticket.resolution_notes ? `Resolution notes: ${ticket.resolution_notes}` : ''}\n\nThank you!\nClearPath Maintenance Team`,
        });
        if (delivery?.delivered === true) {
          toast.success('Ticket marked completed in ClearPath and email delivery was verified.');
        } else {
          toast.warning('Ticket marked completed in ClearPath. Email delivery could not be verified.');
        }
      } catch (error) {
        const reason = error?.code === 'PROVIDER_NOT_CONFIGURED'
          ? 'No email provider is configured.'
          : 'Email delivery could not be verified.';
        toast.warning(`Ticket marked completed in ClearPath. ${reason}`);
      }
    } else if (newStatus === 'completed') {
      toast.warning('Ticket marked completed in ClearPath. No submitter email address is available for delivery.');
    } else {
      toast.success('Ticket status saved in ClearPath.');
    }

    setTickets(prev => prev.map(t => t.id === ticket.id ? { ...t, ...update } : t));
  };

  const handleSaved = (ticket, isNew) => {
    if (isNew) setTickets(prev => [ticket, ...prev]);
    else setTickets(prev => prev.map(t => t.id === ticket.id ? ticket : t));
    setShowForm(false);
    setEditingTicket(null);
  };

  const handleDelete = async (ticket) => {
    if (!window.confirm('Delete this ticket?')) return;
    await appClient.entities.MaintenanceTicket.delete(ticket.id);
    setTickets(prev => prev.filter(t => t.id !== ticket.id));
  };

  const filtered = tickets.filter(t => {
    const q = search.toLowerCase();
    const matchSearch = !search || t.title?.toLowerCase().includes(q) || t.room?.toLowerCase().includes(q) || t.location_name?.toLowerCase().includes(q);
    const matchPriority = filterPriority === 'all' || t.priority === filterPriority;
    const matchLocation = filterLocation === 'all' || t.location_id === filterLocation;
    return matchSearch && matchPriority && matchLocation;
  });

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-amber-500" /></div>;

  return (
    <div className="flex flex-col gap-5 h-full">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tickets…" className="pl-9 text-sm" />
        </div>
        <Select value={filterPriority} onValueChange={setFilterPriority}>
          <SelectTrigger className="w-36 text-sm"><SelectValue placeholder="Priority" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            <SelectItem value="urgent">Urgent</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
        {locations.length > 0 && (
          <Select value={filterLocation} onValueChange={setFilterLocation}>
            <SelectTrigger className="w-40 text-sm"><SelectValue placeholder="Location" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Locations</SelectItem>
              {locations.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <Button onClick={() => { setEditingTicket(null); setShowForm(true); }} className="bg-amber-600 hover:bg-amber-700 text-white gap-2">
          <Plus className="w-4 h-4" /> New Ticket
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        {STATUS_COLS.map(col => {
          const Icon = col.icon;
          const count = tickets.filter(t => t.status === col.id).length;
          return (
            <div key={col.id} className={cn('rounded-xl border p-3 flex items-center gap-3', col.bg, col.border)}>
              <Icon className={cn('w-5 h-5', col.color)} />
              <div>
                <p className={cn('text-xl font-bold', col.color)}>{count}</p>
                <p className="text-xs text-slate-500">{col.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Kanban columns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1 overflow-auto">
        {STATUS_COLS.map(col => {
          const colTickets = filtered.filter(t => t.status === col.id);
          const Icon = col.icon;
          return (
            <div key={col.id} className="flex flex-col gap-3">
              <div className={cn('flex items-center gap-2 px-3 py-2 rounded-lg border', col.bg, col.border)}>
                <Icon className={cn('w-4 h-4', col.color)} />
                <span className={cn('font-semibold text-sm', col.color)}>{col.label}</span>
                <span className={cn('ml-auto text-xs font-bold rounded-full px-2 py-0.5', col.bg, col.color, 'border', col.border)}>{colTickets.length}</span>
              </div>
              <div className="space-y-3 overflow-y-auto flex-1">
                {colTickets.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 text-xs">No tickets</div>
                ) : (
                  colTickets.map(ticket => (
                    <TicketCard
                      key={ticket.id}
                      ticket={ticket}
                      user={user}
                      onStatusChange={handleStatusChange}
                      onEdit={() => { setEditingTicket(ticket); setShowForm(true); }}
                      onDelete={() => handleDelete(ticket)}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {showForm && (
        <TicketFormModal
          ticket={editingTicket}
          locations={locations}
          user={user}
          onSaved={handleSaved}
          onClose={() => { setShowForm(false); setEditingTicket(null); }}
        />
      )}
    </div>
  );
}
