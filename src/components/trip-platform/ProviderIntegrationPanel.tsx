import { useEffect, useMemo, useState } from 'react';
import {
  describeProviderArchitecture,
  listProviderHealth,
  type ProviderHealth,
} from '../../providers';
import { Panel, StatusBadge, StatusBanner } from './shared/ui';

const statusTone = (status: ProviderHealth['status']): 'success' | 'warning' | 'danger' | 'info' | 'neutral' => {
  if (status === 'healthy') return 'success';
  if (status === 'degraded') return 'warning';
  if (status === 'down') return 'danger';
  if (status === 'not_configured') return 'neutral';
  return 'info';
};

export function ProviderIntegrationPanel() {
  const architecture = useMemo(() => describeProviderArchitecture(), []);
  const [health, setHealth] = useState<ProviderHealth[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void listProviderHealth()
      .then(setHealth)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load provider health'));
  }, []);

  return (
    <Panel
      title="Travel provider integration"
      description="Abstraction layer for flights, hotels, activities, car hire, cruises, transfers, insurance, and rail. The UI talks only to the provider gateway — never to supplier APIs. Live suppliers are not connected yet."
    >
      <StatusBanner
        kind="info"
        message={`${architecture.principle}. Live proxy: ${architecture.liveProxyEnabled ? 'flagged' : 'off'}.`}
      />
      {error ? <StatusBanner kind="error" message={error} /> : null}

      <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/40 p-4 text-sm text-slate-300">
        <p className="font-medium text-white">Architecture</p>
        <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-xs text-sky-100" aria-label="Provider architecture diagram">
{`UI panels (Flights / Hotels / Services / Deal Engine)
        │
        ▼
Provider Gateway  (src/providers/gateway.ts)
        │
        ├── FlightProvider      → Amadeus / Duffel / Mock
        ├── HotelProvider       → Booking.com / Expedia / Hotelbeds / Mock
        ├── ActivitiesProvider  → Viator / Mock
        ├── CarHireProvider     → Placeholder / Mock
        ├── CruiseProvider      → Placeholder / Mock
        ├── TransferProvider    → Placeholder / Mock
        ├── InsuranceProvider   → Mock (future)
        └── RailProvider        → Mock (future)
                │
                ▼
     Unified internal models (never supplier-specific JSON in UI)
                │
                ▼
     Mock responses today  ·  Live adapters later (server secrets)`}
        </pre>
      </div>

      <h4 className="mt-6 text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">Supplier configuration</h4>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        {architecture.suppliers.map((supplier) => (
          <article key={supplier.supplierId} className="rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-white">{supplier.displayName}</span>
              <StatusBadge label={supplier.status} tone={supplier.status === 'enabled' ? 'success' : supplier.status === 'pending' ? 'warning' : 'neutral'} />
              <StatusBadge label={supplier.service} tone="info" />
            </div>
            <p className="mt-1 text-xs text-slate-400">{supplier.supplierId}</p>
          </article>
        ))}
      </div>

      <h4 className="mt-6 text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">Provider health</h4>
      <ul className="mt-3 space-y-2">
        {health.map((entry) => (
          <li key={entry.providerId} className="rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2 text-sm text-slate-200">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-white">{entry.displayName}</span>
              <StatusBadge label={entry.status} tone={statusTone(entry.status)} />
              <StatusBadge label={entry.mode} tone="warning" />
            </div>
            <p className="mt-1 text-xs text-slate-400">{entry.message}</p>
          </li>
        ))}
      </ul>

      <p className="mt-4 text-xs text-slate-400">
        Private credential env keys (server-only, never bundled): {architecture.privateEnvKeysDocumented.join(', ')}.
        Switch suppliers with <code className="text-slate-200">VITE_TRAVEL_PROVIDER_&lt;ID&gt;=enabled|disabled|pending</code>.
      </p>
    </Panel>
  );
}
