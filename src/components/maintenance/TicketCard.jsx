import { useState } from 'react';
import { MapPin, User, Calendar, ChevronDown, Edit2, Trash2, CheckCircle2, RotateCcw, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const PRIORITY_STYLES = {
  urgent: 'bg-red-100 text-red-700 border-red-200',
  high:   'bg-orange-100 text-orange-700 border-orange-200',
  medium: 'bg-amber-100 text-amber-700 border-amber-200',
  low:    'bg-slate-100 text-slate-500 border-slate-200',
};

const CATEGORY_LABELS = {
  plumbing: '🔧 Plumbing', electrical: '⚡ Electrical', hvac: '❄️ HVAC',
  appliance: '🏠 Appliance', structural: '🧱 Structural', pest_control: '🐛 Pest Control',
  cleaning: '🧹 Cleaning', safety: '🦺 Safety', other: '📋 Other',
};

function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function TicketCard({ ticket, user, onStatusChange, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const isAdmin = user?.role === 'admin' || user?.role === 'owner' || user?.role === 'director' || user?.role === 'house_manager';

  return (
    <div className="bg-white rounded-xl border shadow-sm hover:shadow-md transition-shadow p-4">
      {/* Header row */}
      <div className="flex items-start gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-slate-800 leading-snug">{ticket.title}</p>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            <Badge className={cn('border text-xs', PRIORITY_STYLES[ticket.priority] || PRIORITY_STYLES.medium)}>
              {ticket.priority}
            </Badge>
            <span className="text-xs text-slate-400">{CATEGORY_LABELS[ticket.category] || ticket.category}</span>
          </div>
        </div>
        <button onClick={() => setExpanded(v => !v)} className="text-slate-400 hover:text-slate-600 flex-shrink-0 mt-0.5">
          <ChevronDown className={cn('w-4 h-4 transition-transform', expanded && 'rotate-180')} />
        </button>
      </div>

      {/* Location / room */}
      {(ticket.location_name || ticket.room) && (
        <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-2">
          <MapPin className="w-3 h-3" />
          <span>{[ticket.location_name, ticket.room].filter(Boolean).join(' · ')}</span>
        </div>
      )}

      {/* Expanded details */}
      {expanded && (
        <div className="border-t pt-3 mt-2 space-y-2 text-xs text-slate-600">
          {ticket.description && <p className="text-slate-500">{ticket.description}</p>}
          {ticket.submitted_by_name && (
            <div className="flex items-center gap-1.5"><User className="w-3 h-3" /> Submitted by {ticket.submitted_by_name}</div>
          )}
          {ticket.assigned_to_name && (
            <div className="flex items-center gap-1.5"><User className="w-3 h-3 text-teal-500" /> Assigned to {ticket.assigned_to_name}</div>
          )}
          {ticket.due_date && (
            <div className="flex items-center gap-1.5"><Calendar className="w-3 h-3" /> Due {formatDate(ticket.due_date)}</div>
          )}
          {ticket.resolution_notes && (
            <div className="bg-green-50 rounded-lg px-3 py-2 text-green-700">
              <p className="font-medium mb-0.5">Resolution:</p>
              <p>{ticket.resolution_notes}</p>
            </div>
          )}
          {ticket.completed_at && (
            <p className="text-slate-400">Completed {formatDate(ticket.completed_at)}</p>
          )}
          {ticket.photo_url && (
            <img src={ticket.photo_url} alt="Issue" className="rounded-lg max-h-32 object-cover w-full" />
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-1.5 mt-3 pt-3 border-t">
        {ticket.status === 'open' && isAdmin && (
          <Button size="sm" variant="outline" className="text-xs gap-1 flex-1" onClick={() => onStatusChange(ticket, 'in_progress')}>
            <Play className="w-3 h-3" /> Start
          </Button>
        )}
        {ticket.status === 'in_progress' && isAdmin && (
          <Button size="sm" variant="outline" className="text-xs gap-1 flex-1 text-green-600 border-green-200 hover:bg-green-50" onClick={() => onStatusChange(ticket, 'completed')}>
            <CheckCircle2 className="w-3 h-3" /> Complete
          </Button>
        )}
        {ticket.status === 'completed' && isAdmin && (
          <Button size="sm" variant="outline" className="text-xs gap-1 flex-1" onClick={() => onStatusChange(ticket, 'open')}>
            <RotateCcw className="w-3 h-3" /> Reopen
          </Button>
        )}
        <Button size="sm" variant="ghost" className="text-xs text-slate-500 gap-1" onClick={onEdit}>
          <Edit2 className="w-3 h-3" /> Edit
        </Button>
        {isAdmin && (
          <Button size="sm" variant="ghost" className="text-xs text-red-400 hover:text-red-600 hover:bg-red-50" onClick={onDelete}>
            <Trash2 className="w-3 h-3" />
          </Button>
        )}
      </div>
    </div>
  );
}