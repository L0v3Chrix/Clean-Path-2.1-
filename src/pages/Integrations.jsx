import { useCallback, useState, useEffect } from 'react';
import { appClient } from '@/services/appClient';
import { AlertCircle, CheckCircle2, ExternalLink, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

const INTEGRATION_CATALOG = [
  {
    name: 'Stripe', type: 'payments', icon: '💳', color: '#6772E5',
    desc: 'Accept payments, manage subscriptions, and process program fees directly.',
    docsUrl: 'https://stripe.com/docs',
    setupSteps: ['Create a Stripe account at stripe.com', 'Get your API keys from the Stripe Dashboard', 'Set STRIPE_SECRET_KEY in your platform secrets', 'Configure webhook endpoint for payment events'],
  },
  {
    name: 'Twilio', type: 'sms', icon: '📱', color: '#F22F46',
    desc: 'Send SMS alerts, appointment reminders, and emergency notifications to residents and staff.',
    docsUrl: 'https://www.twilio.com/docs',
    setupSteps: ['Create a Twilio account and get a phone number', 'Copy Account SID and Auth Token', 'Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in secrets', 'Configure messaging service for outbound SMS'],
  },
  {
    name: 'QuickBooks', type: 'accounting', icon: '📊', color: '#2CA01C',
    desc: 'Sync expenses, income, and financial reports with QuickBooks for CPA and tax filing.',
    docsUrl: 'https://developer.intuit.com',
    setupSteps: ['Create a QuickBooks Online account', 'Register an app at developer.intuit.com to get OAuth credentials', 'Authorize the connection via OAuth flow', 'Map expense categories to your QuickBooks chart of accounts'],
  },
  {
    name: 'Mailchimp', type: 'email_marketing', icon: '📧', color: '#FFE01B',
    desc: 'Run email campaigns, donor outreach, and community newsletters from one place.',
    docsUrl: 'https://mailchimp.com/developer',
    setupSteps: ['Create a Mailchimp account', 'Generate an API key in your Mailchimp account settings', 'Set MAILCHIMP_API_KEY in secrets', 'Create audience lists for residents, donors, and partners'],
  },
  {
    name: 'Google Calendar', type: 'scheduling', icon: '📅', color: '#4285F4',
    desc: 'Sync house meetings, appointments, and staff schedules with Google Calendar.',
    docsUrl: 'https://developers.google.com/calendar',
    setupSteps: ['Connect via OAuth in the Integrations tab', 'Select calendars to sync', 'Map meeting types to calendar events'],
  },
  {
    name: 'Zoom / Telehealth', type: 'telehealth', icon: '🎥', color: '#2D8CFF',
    desc: 'Launch virtual support group meetings and telehealth appointments.',
    docsUrl: 'https://marketplace.zoom.us',
    setupSteps: ['Create a Zoom account and marketplace app', 'Get OAuth credentials', 'Set ZOOM_CLIENT_ID and ZOOM_CLIENT_SECRET in secrets'],
  },
  {
    name: 'Checkr', type: 'background_check', icon: '🔍', color: '#2B2A2E',
    desc: 'Run background checks on staff and applicants with FCRA-compliant screening.',
    docsUrl: 'https://docs.checkr.com',
    setupSteps: ['Sign up for Checkr', 'Get API key from the Checkr dashboard', 'Set CHECKR_API_KEY in secrets'],
  },
  {
    name: 'DocuSign', type: 'other', icon: '✍️', color: '#FFCC00',
    desc: 'Send and sign resident agreements, consent forms, and ROI documents electronically.',
    docsUrl: 'https://developers.docusign.com',
    setupSteps: ['Create a DocuSign developer account', 'Create an integration key (client ID)', 'Configure OAuth redirect URI', 'Use templates for resident agreements and consent forms'],
  },
];

// Add a provider only after its server-side adapter verifies credentials and connectivity.
const VERIFIED_PROVIDER_ADAPTERS = new Set();

export function getIntegrationDisplayStatus(config) {
  if (!config) return 'disconnected';
  if (config.status !== 'connected') return config.status;
  const metadata = config.metadata || {};
  return VERIFIED_PROVIDER_ADAPTERS.has(config.integration_name)
    && metadata.verification_status === 'verified' && metadata.verified_at
    ? 'connected'
    : 'pending';
}

export async function loadIntegrationData(client) {
  const [orgs, configs] = await Promise.all([
    client.entities.Organization.list(),
    client.entities.IntegrationConfig.list(),
  ]);
  return { orgId: orgs?.[0]?.id || null, configs: configs || [] };
}

export async function savePendingIntegration(client, { configs, orgId, integration }) {
  if (!orgId) throw new Error('Active organization is unavailable.');
  const existing = configs.find(config => (
    config.integration_name === integration.name && config.organization_id === orgId
  ));
  const pendingConfig = {
    status: 'pending',
    connected_date: null,
    metadata: {
      ...(existing?.metadata || {}),
      verification_status: 'unverified',
      verified_at: null,
    },
  };

  if (existing) {
    return client.entities.IntegrationConfig.update(existing.id, pendingConfig);
  }
  return client.entities.IntegrationConfig.create({
    organization_id: orgId,
    integration_name: integration.name,
    integration_type: integration.type,
    ...pendingConfig,
  });
}

export function disconnectIntegration(client, config) {
  return client.entities.IntegrationConfig.update(config.id, {
    status: 'disconnected',
    connected_date: null,
    metadata: {
      ...(config.metadata || {}),
      verification_status: 'unverified',
      verified_at: null,
    },
  });
}

function StatusBadge({ status }) {
  const cfg = {
    connected: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: '● Connected' },
    disconnected: { bg: 'bg-slate-100', text: 'text-slate-500', label: '○ Not Connected' },
    pending: { bg: 'bg-amber-100', text: 'text-amber-700', label: '◌ Pending' },
    error: { bg: 'bg-red-100', text: 'text-red-600', label: '✕ Error' },
  }[status] || { bg: 'bg-slate-100', text: 'text-slate-500', label: status };
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.bg} ${cfg.text}`}>{cfg.label}</span>;
}

function IntegrationCard({ integration, config, onConnect, onDisconnect, busyAction }) {
  const [expanded, setExpanded] = useState(false);
  const displayStatus = getIntegrationDisplayStatus(config);
  const isConnected = displayStatus === 'connected';
  const connectBusy = busyAction === `connect:${integration.name}`;
  const disconnectBusy = busyAction === `disconnect:${config?.id}`;
  const mutationBusy = busyAction !== null;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-md transition-shadow">
      <div className="p-4">
        <div className="flex items-start gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0" style={{ background: `${integration.color}15` }}>
            {integration.icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-bold text-slate-800">{integration.name}</p>
              <StatusBadge status={displayStatus} />
            </div>
            <p className="text-xs text-slate-500 mt-0.5">{integration.desc}</p>
          </div>
        </div>

        {expanded && (
          <div className="bg-slate-50 rounded-xl p-3 mb-3">
            <p className="text-xs font-bold text-slate-600 mb-2">Setup Steps:</p>
            <ol className="space-y-1">
              {integration.setupSteps.map((step, i) => (
                <li key={i} className="text-xs text-slate-600 flex gap-2">
                  <span className="font-bold text-amber-600 flex-shrink-0">{i + 1}.</span> {step}
                </li>
              ))}
            </ol>
          </div>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setExpanded(!expanded)} className="text-xs text-slate-400 hover:text-amber-600 font-medium">
            {expanded ? 'Hide steps' : 'Setup guide'}
          </button>
          <a href={integration.docsUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-500 hover:underline flex items-center gap-0.5">
            Docs <ExternalLink className="w-3 h-3" />
          </a>
          <div className="ml-auto flex gap-2">
            {isConnected ? (
              <Button size="sm" variant="outline" disabled={mutationBusy} className="text-xs text-red-500 border-red-200 hover:bg-red-50" onClick={() => onDisconnect(config)}>
                {disconnectBusy ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Disconnecting</> : 'Disconnect'}
              </Button>
            ) : (
              <Button size="sm" disabled={mutationBusy} className="text-xs bg-amber-600 hover:bg-amber-700 text-white" onClick={() => onConnect(integration)}>
                {connectBusy ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving</> : 'Record Setup'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Integrations() {
  const [configs, setConfigs] = useState([]);
  const [orgId, setOrgId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [mutationError, setMutationError] = useState('');
  const [busyAction, setBusyAction] = useState(null);
  const [filterType, setFilterType] = useState('all');
  const [connectingTo, setConnectingTo] = useState(null);

  const load = useCallback(async ({ showLoading = true } = {}) => {
    if (showLoading) setLoading(true);
    setLoadError('');
    try {
      const data = await loadIntegrationData(appClient);
      setOrgId(data.orgId);
      setConfigs(data.configs);
      if (!data.orgId) setLoadError('No active organization is available. Retry after your account access is restored.');
      return true;
    } catch {
      setLoadError('Integrations could not be loaded. Check your connection and try again.');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleConnect = (integration) => {
    setMutationError('');
    setConnectingTo(integration);
  };

  const confirmConnect = async () => {
    if (!connectingTo || busyAction) return;
    setMutationError('');
    setBusyAction(`connect:${connectingTo.name}`);
    try {
      await savePendingIntegration(appClient, { configs, orgId, integration: connectingTo });
      setConnectingTo(null);
      await load({ showLoading: false });
    } catch {
      setMutationError('Setup could not be saved. Nothing was marked connected. Try again.');
    } finally {
      setBusyAction(null);
    }
  };

  const handleDisconnect = async (config) => {
    if (busyAction) return;
    setMutationError('');
    setBusyAction(`disconnect:${config.id}`);
    try {
      await disconnectIntegration(appClient, config);
      await load({ showLoading: false });
    } catch {
      setMutationError('The integration could not be disconnected. Its displayed status was not changed. Try again.');
    } finally {
      setBusyAction(null);
    }
  };

  const types = ['all', ...new Set(INTEGRATION_CATALOG.map(i => i.type))];
  const filtered = filterType === 'all' ? INTEGRATION_CATALOG : INTEGRATION_CATALOG.filter(i => i.type === filterType);
  const connectedCount = configs.filter(c => getIntegrationDisplayStatus(c) === 'connected').length;

  if (loading) return <div className="flex items-center justify-center min-h-64"><div className="w-8 h-8 border-4 border-amber-200 border-t-amber-600 rounded-full animate-spin" /></div>;

  return (
    <div className="p-6 space-y-6" style={{ background: '#FAF6EF', minHeight: '100%' }}>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Integrations & Connections</h1>
          <p className="text-sm text-slate-500 mt-0.5">Track provider setup and verified connections.</p>
        </div>
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span className="text-sm font-semibold text-emerald-700">{connectedCount} verified connected</span>
        </div>
      </div>

      {loadError && (
        <div role="alert" className="flex items-center gap-3 border border-red-200 bg-red-50 text-red-800 px-4 py-3 text-sm rounded-lg">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span className="flex-1">{loadError}</span>
          <Button variant="outline" size="sm" onClick={() => load()} disabled={loading || busyAction !== null} className="gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" /> Retry
          </Button>
        </div>
      )}
      {mutationError && !connectingTo && (
        <div role="alert" className="border border-red-200 bg-red-50 text-red-800 px-4 py-3 text-sm rounded-lg">{mutationError}</div>
      )}

      {/* Connect modal */}
      {connectingTo && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{connectingTo.icon}</span>
              <div>
                <h3 className="font-bold text-slate-800">Set up {connectingTo.name}</h3>
                <p className="text-xs text-slate-500">Save this provider as pending setup</p>
              </div>
            </div>
            <p className="text-xs text-slate-400 bg-blue-50 rounded-lg p-3">
              This record will remain Pending until ClearPath verifies the provider connection. Saving setup does not prove API access or live data sync.
            </p>
            {mutationError && <p role="alert" className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">{mutationError}</p>}
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" disabled={busyAction !== null} onClick={() => setConnectingTo(null)}>Cancel</Button>
              <Button disabled={!orgId || busyAction !== null} className="flex-1 bg-amber-600 hover:bg-amber-700 text-white" onClick={confirmConnect}>
                {busyAction === `connect:${connectingTo.name}` ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving</> : 'Save Pending'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Type filter */}
      <div className="flex gap-2 flex-wrap">
        {types.map(t => (
          <button key={t} onClick={() => setFilterType(t)}
            className={`text-xs px-3 py-1 rounded-full font-medium capitalize transition-colors ${filterType === t ? 'bg-amber-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-amber-50'}`}>
            {t.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Integration grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(integration => {
          const config = configs.find(c => c.integration_name === integration.name && c.organization_id === orgId);
          return (
            <IntegrationCard
              key={integration.name}
              integration={integration}
              config={config}
              onConnect={handleConnect}
              onDisconnect={handleDisconnect}
              busyAction={busyAction}
            />
          );
        })}
      </div>

      {/* Connected list */}
      {connectedCount > 0 && (
        <div className="rounded-2xl p-5" style={{ background: '#F0E9DC', border: '1px solid #E0D5C5' }}>
          <h2 className="font-bold text-slate-800 mb-3">Active Connections</h2>
          <div className="space-y-2">
            {configs.filter(c => getIntegrationDisplayStatus(c) === 'connected').map(c => (
              <div key={c.id} className="bg-white rounded-xl p-3 flex items-center justify-between border border-slate-100">
                <div className="flex items-center gap-3">
                  <span className="text-lg">{INTEGRATION_CATALOG.find(i => i.name === c.integration_name)?.icon || '🔗'}</span>
                  <div>
                    <p className="font-semibold text-sm text-slate-800">{c.integration_name}</p>
                    <p className="text-xs text-slate-400">Verified {c.metadata?.verified_at || c.connected_date || ''}</p>
                  </div>
                </div>
                <StatusBadge status={getIntegrationDisplayStatus(c)} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
