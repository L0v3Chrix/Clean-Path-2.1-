import { useMemo } from 'react';
import { AlertTriangle, TrendingUp, TrendingDown, Minus, Activity, Calendar, CheckCircle2, XCircle } from 'lucide-react';
import { differenceInDays, parseISO, isValid } from 'date-fns';

// Known MOUD medications by generic name / common name
export const MOUD_NAMES = [
  'buprenorphine', 'suboxone', 'subutex', 'zubsolv', 'bunavail', 'cassipa',
  'sublocade', 'probuphine', 'brixia',
  'methadone', 'dolophine', 'methadose',
  'naltrexone', 'vivitrol', 'revia',
  'naloxone', 'narcan',
  'buprenorphine/naloxone',
];

export function isMOUD(med) {
  if (med.mat_medication) return true;
  if (!med.name) return false;
  const nameLower = med.name.toLowerCase();
  const genericLower = (med.generic_name || '').toLowerCase();
  return MOUD_NAMES.some(m => nameLower.includes(m) || genericLower.includes(m));
}

function AdherenceChip({ pct }) {
  const color = pct >= 90 ? '#059669' : pct >= 70 ? '#D97706' : '#DC2626';
  const bg    = pct >= 90 ? '#D1FAE5' : pct >= 70 ? '#FEF3C7' : '#FEE2E2';
  const Icon  = pct >= 90 ? TrendingUp : pct >= 70 ? Minus : TrendingDown;
  return (
    <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full"
      style={{ background: bg, color }}>
      <Icon className="w-3 h-3" /> {pct}%
    </span>
  );
}

function MOUDCard({ med, logs }) {
  const medLogs = logs.filter(l => l.medication_id === med.id);
  const recentLogs = medLogs.slice(0, 30);
  const given = recentLogs.filter(l => l.outcome === 'administered' || l.outcome === 'self_administered').length;
  const adherencePct = recentLogs.length ? Math.round((given / recentLogs.length) * 100) : null;

  const daysOnMed = med.start_date && isValid(parseISO(med.start_date))
    ? differenceInDays(new Date(), parseISO(med.start_date))
    : null;

  const lastLog = medLogs[0];
  const lastOutcomeOk = lastLog && (lastLog.outcome === 'administered' || lastLog.outcome === 'self_administered');

  const drugLabel = (() => {
    const n = med.name.toLowerCase();
    if (n.includes('methadone')) return 'Methadone';
    if (n.includes('buprenorphine') || n.includes('suboxone') || n.includes('subutex') || n.includes('sublocade') || n.includes('zubsolv')) return 'Buprenorphine';
    if (n.includes('naltrexone') || n.includes('vivitrol')) return 'Naltrexone';
    if (n.includes('naloxone') || n.includes('narcan')) return 'Naloxone';
    return 'MOUD';
  })();

  const drugColors = {
    'Methadone':      { border: '#7C3AED', bg: '#F5F3FF', badge: '#EDE9FE', badgeText: '#5B21B6' },
    'Buprenorphine':  { border: '#0891B2', bg: '#F0F9FF', badge: '#CFFAFE', badgeText: '#0E7490' },
    'Naltrexone':     { border: '#059669', bg: '#F0FDF4', badge: '#D1FAE5', badgeText: '#065F46' },
    'Naloxone':       { border: '#D97706', bg: '#FFFBEB', badge: '#FEF3C7', badgeText: '#92400E' },
    'MOUD':           { border: '#6366F1', bg: '#EEF2FF', badge: '#E0E7FF', badgeText: '#3730A3' },
  };
  const dc = drugColors[drugLabel] || drugColors['MOUD'];

  return (
    <div className="rounded-xl p-4 space-y-3"
      style={{ background: dc.bg, border: `2px solid ${dc.border}` }}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold px-2 py-0.5 rounded-full uppercase tracking-wide"
            style={{ background: dc.badge, color: dc.badgeText }}>{drugLabel}</span>
          <span className="font-bold text-sm" style={{ color: '#1C1917' }}>{med.name}</span>
          {med.dosage && <span className="text-xs" style={{ color: '#78716C' }}>· {med.dosage}</span>}
          {med.route && <span className="text-xs" style={{ color: '#78716C' }}>· {med.route}</span>}
        </div>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${
          med.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
        }`}>{med.status}</span>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg p-2 text-center" style={{ background: 'rgba(255,255,255,0.7)' }}>
          <p className="text-base font-black" style={{ color: '#1C1917' }}>
            {adherencePct !== null ? `${adherencePct}%` : '—'}
          </p>
          <p className="text-xs" style={{ color: '#78716C' }}>Adherence</p>
          {adherencePct !== null && (
            <div className="mt-1">
              <AdherenceChip pct={adherencePct} />
            </div>
          )}
        </div>
        <div className="rounded-lg p-2 text-center" style={{ background: 'rgba(255,255,255,0.7)' }}>
          <p className="text-base font-black" style={{ color: '#1C1917' }}>
            {daysOnMed !== null ? daysOnMed : '—'}
          </p>
          <p className="text-xs" style={{ color: '#78716C' }}>Days on Med</p>
        </div>
        <div className="rounded-lg p-2 text-center" style={{ background: 'rgba(255,255,255,0.7)' }}>
          <p className="text-base font-black" style={{ color: '#1C1917' }}>{medLogs.length}</p>
          <p className="text-xs" style={{ color: '#78716C' }}>Total Logs</p>
        </div>
      </div>

      {/* Recent logs mini-strip (last 14 doses) */}
      {recentLogs.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-semibold" style={{ color: '#78716C' }}>Recent Dose History</p>
          <div className="flex gap-1 flex-wrap">
            {recentLogs.slice(0, 14).map((log, i) => {
              const ok = log.outcome === 'administered' || log.outcome === 'self_administered';
              const missed = log.outcome === 'missed';
              return (
                <div key={i} title={`${log.scheduled_date} — ${log.outcome}`}
                  className="w-5 h-5 rounded flex items-center justify-center"
                  style={{ background: ok ? '#D1FAE5' : missed ? '#FEE2E2' : '#FEF3C7' }}>
                  {ok
                    ? <CheckCircle2 className="w-3 h-3" style={{ color: '#059669' }} />
                    : missed
                      ? <XCircle className="w-3 h-3" style={{ color: '#DC2626' }} />
                      : <Minus className="w-3 h-3" style={{ color: '#D97706' }} />
                  }
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Prescriber / pharmacy */}
      {(med.prescriber || med.pharmacy) && (
        <p className="text-xs" style={{ color: '#78716C' }}>
          {med.prescriber && <>Prescriber: <strong>{med.prescriber}</strong></>}
          {med.prescriber && med.pharmacy && ' · '}
          {med.pharmacy && <>Pharmacy: <strong>{med.pharmacy}</strong></>}
        </p>
      )}

      {/* Last dose status */}
      {lastLog && (
        <p className="text-xs" style={{ color: lastOutcomeOk ? '#059669' : '#DC2626' }}>
          {lastOutcomeOk ? '✅' : '⚠️'} Last dose: {lastLog.scheduled_date}
          {lastLog.scheduled_time ? ` at ${lastLog.scheduled_time}` : ''} — <strong>{lastLog.outcome?.replace(/_/g, ' ')}</strong>
        </p>
      )}
    </div>
  );
}

export default function MOUDPanel({ medications, logs, resident }) {
  const moudMeds = useMemo(
    () => medications.filter(isMOUD),
    [medications]
  );
  const activeMoud = moudMeds.filter(m => m.status === 'active');

  if (moudMeds.length === 0) return null;

  // Overall adherence across all MOUD
  const allMoudLogs = logs.filter(l => moudMeds.some(m => m.id === l.medication_id));
  const recentMoudLogs = allMoudLogs.slice(0, 60);
  const totalGiven = recentMoudLogs.filter(l => l.outcome === 'administered' || l.outcome === 'self_administered').length;
  const overallAdherence = recentMoudLogs.length ? Math.round((totalGiven / recentMoudLogs.length) * 100) : null;

  return (
    <div className="rounded-2xl overflow-hidden"
      style={{ border: '2px solid #7C3AED', background: '#FDFAFF' }}>
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between"
        style={{ background: '#7C3AED' }}>
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-white" />
          <span className="text-sm font-bold text-white">MOUD — Medications for Opioid Use Disorder</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-purple-200">
            {activeMoud.length} active · {moudMeds.length} total
          </span>
          {overallAdherence !== null && (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full"
              style={{ background: overallAdherence >= 80 ? '#D1FAE5' : overallAdherence >= 60 ? '#FEF3C7' : '#FEE2E2',
                       color: overallAdherence >= 80 ? '#065F46' : overallAdherence >= 60 ? '#92400E' : '#991B1B' }}>
              {overallAdherence}% overall adherence
            </span>
          )}
        </div>
      </div>

      {/* Outcome outcome callout */}
      <div className="px-4 py-2.5 text-xs flex items-center gap-2"
        style={{ background: '#EDE9FE', borderBottom: '1px solid #DDD6FE' }}>
        <Calendar className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#7C3AED' }} />
        <span style={{ color: '#4C1D95' }}>
          <strong>OUD Treatment Tracking:</strong> Adherence data below is recorded as part of outcomes reporting. Consistent MOUD engagement is a primary indicator of long-term recovery success.
        </span>
      </div>

      {/* Low adherence alert */}
      {overallAdherence !== null && overallAdherence < 70 && (
        <div className="px-4 py-2.5 flex items-center gap-2"
          style={{ background: '#FEE2E2', borderBottom: '1px solid #FECACA' }}>
          <AlertTriangle className="w-4 h-4 flex-shrink-0" style={{ color: '#DC2626' }} />
          <span className="text-xs font-semibold" style={{ color: '#991B1B' }}>
            MOUD adherence is below 70% — this requires immediate clinical follow-up.
          </span>
        </div>
      )}

      {/* Cards */}
      <div className="p-4 space-y-3">
        {moudMeds.map(med => (
          <MOUDCard key={med.id} med={med} logs={logs} />
        ))}
      </div>
    </div>
  );
}