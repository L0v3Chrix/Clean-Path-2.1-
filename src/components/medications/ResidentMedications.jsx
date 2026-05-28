import { useState, useEffect, useMemo } from 'react';
import { appClient } from '@/services/appClient';
import {
  Plus, Pill, CheckCircle2, XCircle, AlertCircle, Clock,
  User, Pencil, Trash2, ChevronDown, ChevronRight, History, Bell, ShoppingCart
} from 'lucide-react';
import MOUDPanel from './MOUDPanel';
import { Button } from '@/components/ui/button';
import { subDays } from 'date-fns';
import MedicationForm from './MedicationForm';
import DoseLogModal from './DoseLogModal';
import { isMOUD } from './MOUDPanel';


// ─── Helpers ─────────────────────────────────────────────────────────────────

const FREQ_LABELS = {
  once_daily: 'Once daily', twice_daily: 'Twice daily', three_times_daily: '3× daily',
  four_times_daily: '4× daily', every_morning: 'Every morning', every_evening: 'Every evening',
  weekly: 'Weekly', as_needed: 'As needed', other: 'Other',
};

const OUTCOME_CONFIG = {
  administered:      { label: 'Given',         color: '#059669', bg: '#D1FAE5', icon: CheckCircle2 },
  self_administered: { label: 'Self-given',     color: '#0891B2', bg: '#CFFAFE', icon: User },
  missed:            { label: 'Missed',         color: '#DC2626', bg: '#FEE2E2', icon: XCircle },
  refused:           { label: 'Refused',        color: '#EA580C', bg: '#FFEDD5', icon: AlertCircle },
  held:              { label: 'Held',           color: '#D97706', bg: '#FEF3C7', icon: Clock },
};

function StatusBadge({ status }) {
  const cfg = {
    active:       { color: '#059669', bg: '#D1FAE5' },
    paused:       { color: '#D97706', bg: '#FEF3C7' },
    discontinued: { color: '#DC2626', bg: '#FEE2E2' },
    completed:    { color: '#78716C', bg: '#F5F5F4' },
  }[status] || { color: '#78716C', bg: '#F5F5F4' };
  return (
    <span className="text-xs font-semibold px-2 py-0.5 rounded-full capitalize" style={{ background: cfg.bg, color: cfg.color }}>
      {status}
    </span>
  );
}

function AdherenceBar({ logs }) {
  if (!logs.length) return null;
  const total = logs.length;
  const given = logs.filter(l => l.outcome === 'administered' || l.outcome === 'self_administered').length;
  const pct = Math.round((given / total) * 100);
  const color = pct >= 80 ? '#059669' : pct >= 60 ? '#D97706' : '#DC2626';
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between text-xs" style={{ color: '#78716C' }}>
        <span>Adherence (last 30 days)</span>
        <span className="font-bold" style={{ color }}>{pct}%</span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#E0D5C5' }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color, transition: 'width 0.4s' }} />
      </div>
    </div>
  );
}

// ─── Today's Schedule ─────────────────────────────────────────────────────────
function TodaySchedule({ medications, logs, onLog }) {
  const todayStr = new Date().toISOString().split('T')[0];
  const todayLogs = logs.filter(l => l.scheduled_date === todayStr);

  const doses = useMemo(() => {
    const items = [];
    medications.filter(m => m.status === 'active').forEach(med => {
      const times = med.scheduled_times?.length ? med.scheduled_times : ['—'];
      times.forEach(time => {
        const logged = todayLogs.find(l => l.medication_id === med.id && l.scheduled_time === time);
        items.push({ med, time, logged });
      });
    });
    return items.sort((a, b) => (a.time || '').localeCompare(b.time || ''));
  }, [medications, todayLogs]);

  if (!doses.length) return null;

  const given = doses.filter(d => d.logged && (d.logged.outcome === 'administered' || d.logged.outcome === 'self_administered')).length;

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #FDE68A', background: '#FFFBEB' }}>
      <div className="px-4 py-3 flex items-center justify-between border-b" style={{ borderColor: '#FDE68A' }}>
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4" style={{ color: '#B45309' }} />
          <span className="text-sm font-semibold" style={{ color: '#1C1917' }}>Today's Schedule</span>
        </div>
        <span className="text-xs font-medium" style={{ color: '#78716C' }}>{given}/{doses.length} given</span>
      </div>
      <div className="divide-y" style={{ borderColor: '#FDE68A' }}>
        {doses.map(({ med, time, logged }, idx) => {
          const outcfg = logged ? (OUTCOME_CONFIG[logged.outcome] || OUTCOME_CONFIG.administered) : null;
          const Icon = outcfg?.icon || Pill;
          return (
            <div key={idx} className="flex items-center gap-3 px-4 py-2.5">
              <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: outcfg ? outcfg.bg : '#F0E9DC' }}>
                <Icon className="w-3.5 h-3.5" style={{ color: outcfg ? outcfg.color : '#78716C' }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: '#1C1917' }}>
                  {med.name} <span className="font-normal text-xs" style={{ color: '#78716C' }}>{med.dosage}</span>
                </p>
                <p className="text-xs" style={{ color: '#78716C' }}>
                  {time !== '—' ? time : 'As needed'}
                  {logged && <span className="ml-2 font-semibold" style={{ color: outcfg?.color }}>{outcfg?.label}</span>}
                  {logged?.administered_by_name && <span className="ml-1">· {logged.administered_by_name}</span>}
                </p>
              </div>
              {!logged && (
                <button onClick={() => onLog(med, time)} className="text-xs font-semibold px-2.5 py-1 rounded-full transition-colors"
                  style={{ background: '#FEF3C7', color: '#B45309' }}>
                  Log
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Medication Card ──────────────────────────────────────────────────────────
function MedicationCard({ med, logs, onEdit, onDelete, onLog }) {
  const [showHistory, setShowHistory] = useState(false);
  const medLogs = logs.filter(l => l.medication_id === med.id)
    .sort((a, b) => b.scheduled_date.localeCompare(a.scheduled_date))
    .slice(0, 30);

  return (
    <div className="rounded-2xl overflow-hidden" style={{
      border: `1px solid ${isMOUD(med) ? '#7C3AED' : med.status === 'active' ? '#E0D5C5' : '#E5E7EB'}`,
      background: med.status === 'active' ? '#FEFCF8' : '#F9FAFB',
      opacity: med.status === 'discontinued' ? 0.7 : 1,
    }}>
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: med.controlled_substance ? '#FEE2E2' : med.mat_medication ? '#EDE9FE' : '#FEF3C7' }}>
            <Pill className="w-4 h-4" style={{ color: med.controlled_substance ? '#DC2626' : med.mat_medication ? '#7C3AED' : '#B45309' }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-sm" style={{ color: '#1C1917' }}>{med.name}</span>
              {med.generic_name && <span className="text-xs" style={{ color: '#78716C' }}>({med.generic_name})</span>}
              <StatusBadge status={med.status} />
              {med.controlled_substance && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: '#FEE2E2', color: '#DC2626' }}>⚠ Controlled</span>
              )}
              {isMOUD(med) && (
                <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: '#7C3AED', color: '#fff' }}>MOUD / OUD</span>
              )}
            </div>
            <p className="text-xs mt-0.5" style={{ color: '#78716C' }}>
              {med.dosage} · {med.form} · {med.route} · {FREQ_LABELS[med.frequency] || med.frequency}
            </p>
            {med.scheduled_times?.length > 0 && med.frequency !== 'as_needed' && (
              <p className="text-xs mt-0.5" style={{ color: '#A09080' }}>
                ⏰ {med.scheduled_times.join('  ·  ')}
              </p>
            )}
            {med.prescriber && <p className="text-xs mt-0.5" style={{ color: '#78716C' }}>Prescribed by {med.prescriber}</p>}
            {med.instructions && (
              <p className="text-xs mt-1 italic" style={{ color: '#92400E' }}>{med.instructions}</p>
            )}
            <AdherenceBar logs={medLogs} />
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {med.status === 'active' && (
              <button onClick={() => onLog(med, null)} className="p-1.5 rounded-lg hover:bg-amber-100" title="Log Dose">
                <CheckCircle2 className="w-3.5 h-3.5" style={{ color: '#059669' }} />
              </button>
            )}
            <button onClick={() => onEdit(med)} className="p-1.5 rounded-lg hover:bg-amber-100" title="Edit">
              <Pencil className="w-3.5 h-3.5" style={{ color: '#B45309' }} />
            </button>
            <button onClick={() => onDelete(med.id)} className="p-1.5 rounded-lg hover:bg-red-50" title="Delete">
              <Trash2 className="w-3.5 h-3.5" style={{ color: '#DC2626' }} />
            </button>
          </div>
        </div>
      </div>

      {/* History toggle */}
      <div className="border-t" style={{ borderColor: '#E0D5C5' }}>
        <button
          onClick={() => setShowHistory(s => !s)}
          className="w-full flex items-center gap-2 px-4 py-2 text-xs font-medium hover:bg-amber-50/50 transition-colors"
          style={{ color: '#78716C' }}
        >
          <History className="w-3.5 h-3.5" />
          Dose History ({medLogs.length})
          {showHistory ? <ChevronDown className="w-3 h-3 ml-auto" /> : <ChevronRight className="w-3 h-3 ml-auto" />}
        </button>
        {showHistory && (
          <div className="px-4 pb-3 space-y-1" style={{ background: '#FAF6EF' }}>
            {medLogs.length === 0 ? (
              <p className="text-xs py-2" style={{ color: '#A09080' }}>No dose logs yet.</p>
            ) : (
              medLogs.map(log => {
                const cfg = OUTCOME_CONFIG[log.outcome] || OUTCOME_CONFIG.administered;
                const Icon = cfg.icon;
                return (
                  <div key={log.id} className="flex items-center gap-3 py-1.5">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: cfg.bg }}>
                      <Icon className="w-3 h-3" style={{ color: cfg.color }} />
                    </div>
                    <div className="flex-1">
                      <span className="text-xs font-semibold" style={{ color: cfg.color }}>{cfg.label}</span>
                      {log.administered_by_name && <span className="text-xs ml-1" style={{ color: '#78716C' }}>by {log.administered_by_name}</span>}
                      {log.notes && <span className="text-xs ml-1 italic" style={{ color: '#78716C' }}>· {log.notes}</span>}
                    </div>
                    <span className="text-xs" style={{ color: '#A09080' }}>
                      {log.scheduled_date}{log.scheduled_time ? ` ${log.scheduled_time}` : ''}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function ResidentMedications({ resident }) {
  const [medications, setMedications] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [medForm, setMedForm] = useState(null);
  const [logTarget, setLogTarget] = useState(null); // { med, time }
  const [filter, setFilter] = useState('active');

  const load = async () => {
    setLoading(true);
    const since = subDays(new Date(), 30).toISOString().split('T')[0];
    const [meds, ls] = await Promise.all([
      appClient.entities.Medication.filter({ resident_id: resident.id }, 'created_date', 200),
      appClient.entities.MedicationLog.filter({ resident_id: resident.id }, '-scheduled_date', 300),
    ]);
    setMedications(meds);
    setLogs(ls);
    setLoading(false);
  };

  useEffect(() => { load(); }, [resident.id]);

  const saveMed = async (form) => {
    if (form.id) await appClient.entities.Medication.update(form.id, form);
    else await appClient.entities.Medication.create(form);
    setMedForm(null);
    load();
  };

  const deleteMed = async (id) => {
    if (!confirm('Remove this medication?')) return;
    await appClient.entities.Medication.delete(id);
    load();
  };

  const handleLog = (med, time) => setLogTarget({ med, time });

  const filtered = medications.filter(m => filter === 'all' || m.status === filter);
  const activeMeds = medications.filter(m => m.status === 'active');

  // Summary stats
  const todayStr = new Date().toISOString().split('T')[0];
  const todayLogs = logs.filter(l => l.scheduled_date === todayStr);
  const todayGiven = todayLogs.filter(l => l.outcome === 'administered' || l.outcome === 'self_administered').length;
  const todayMissed = todayLogs.filter(l => l.outcome === 'missed').length;

  return (
    <div className="space-y-5">
      {/* KPI row */}
      {!loading && medications.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl p-3 text-center" style={{ background: '#F0E9DC', border: '1px solid #E0D5C5' }}>
            <p className="text-2xl font-black" style={{ color: '#1C1917' }}>{activeMeds.length}</p>
            <p className="text-xs" style={{ color: '#78716C' }}>Active Meds</p>
          </div>
          <div className="rounded-xl p-3 text-center" style={{ background: todayGiven > 0 ? '#D1FAE5' : '#F0E9DC', border: `1px solid ${todayGiven > 0 ? '#A7F3D0' : '#E0D5C5'}` }}>
            <p className="text-2xl font-black" style={{ color: '#059669' }}>{todayGiven}</p>
            <p className="text-xs" style={{ color: '#78716C' }}>Given Today</p>
          </div>
          <div className="rounded-xl p-3 text-center" style={{ background: todayMissed > 0 ? '#FEE2E2' : '#F0E9DC', border: `1px solid ${todayMissed > 0 ? '#FECACA' : '#E0D5C5'}` }}>
            <p className="text-2xl font-black" style={{ color: todayMissed > 0 ? '#DC2626' : '#1C1917' }}>{todayMissed}</p>
            <p className="text-xs" style={{ color: '#78716C' }}>Missed Today</p>
          </div>
        </div>
      )}

      {/* Low-stock alert banner */}
      {!loading && medications.some(m => m.status === 'active' && m.current_quantity != null && m.low_stock_threshold != null && m.current_quantity <= m.low_stock_threshold) && (
        <div className="rounded-xl px-4 py-3 flex items-center gap-3" style={{ background: '#FEF3C7', border: '1px solid #FDE68A' }}>
          <AlertCircle className="w-4 h-4 flex-shrink-0" style={{ color: '#B45309' }} />
          <p className="text-sm flex-1" style={{ color: '#92400E' }}>
            <span className="font-bold">Low stock alert: </span>
            {medications.filter(m => m.status === 'active' && m.current_quantity != null && m.low_stock_threshold != null && m.current_quantity <= m.low_stock_threshold)
              .map(m => `${m.name} (${m.current_quantity} ${m.quantity_unit || 'units'} left)`).join(', ')}
          </p>
          <a href="/inventory" className="flex-shrink-0 text-xs font-semibold flex items-center gap-1 hover:underline" style={{ color: '#B45309' }}>
            <ShoppingCart className="w-3 h-3" /> Order
          </a>
        </div>
      )}

      {/* MOUD Panel — priority section */}
      {!loading && <MOUDPanel medications={medications} logs={logs} resident={resident} />}

      {/* Today's schedule */}
      {!loading && <TodaySchedule medications={medications} logs={logs} onLog={handleLog} />}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex rounded-xl overflow-hidden border" style={{ borderColor: '#E0D5C5' }}>
          {[['active', 'Active'], ['all', 'All'], ['discontinued', 'Discontinued']].map(([v, l]) => (
            <button key={v} onClick={() => setFilter(v)}
              className="px-3 py-1.5 text-xs font-medium transition-colors"
              style={filter === v ? { background: '#1C1917', color: '#F5EFE6' } : { background: '#F0E9DC', color: '#78716C' }}>
              {l}
            </button>
          ))}
        </div>
        <Button size="sm" onClick={() => setMedForm('new')} className="gap-1.5 text-xs" style={{ background: '#B45309', color: '#fff' }}>
          <Plus className="w-3.5 h-3.5" /> Add Medication
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">{[1, 2].map(i => <div key={i} className="h-28 rounded-2xl animate-pulse" style={{ background: '#E5DDD0' }} />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-14 rounded-2xl" style={{ background: '#F0E9DC', border: '1px dashed #C9B99A' }}>
          <Pill className="w-9 h-9 mx-auto mb-2" style={{ color: '#C9A227' }} />
          <p className="font-semibold" style={{ color: '#1C1917' }}>No medications logged</p>
          <p className="text-sm mt-1" style={{ color: '#78716C' }}>Add medications to track scheduled doses and adherence.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(med => (
            <MedicationCard key={med.id} med={med} logs={logs} onEdit={m => setMedForm(m)} onDelete={deleteMed} onLog={handleLog} />
          ))}
        </div>
      )}

      {/* Modals */}
      {medForm && (
        <MedicationForm
          resident={resident}
          editing={medForm === 'new' ? null : medForm}
          onSave={saveMed}
          onClose={() => setMedForm(null)}
        />
      )}
      {logTarget && (
        <DoseLogModal
          medication={logTarget.med}
          resident={resident}
          prefill={{ time: logTarget.time }}
          onSave={() => { setLogTarget(null); load(); }}
          onClose={() => setLogTarget(null)}
        />
      )}
    </div>
  );
}