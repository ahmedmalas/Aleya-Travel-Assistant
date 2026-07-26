import { useMemo, useState } from 'react';
import {
  appendAdminAudit,
  assertAdminCapability,
  loadAdminAudit,
  resolveAppRole,
  type AdminCapability,
} from '../../store/admin/adminAccess';
import { describeProviderArchitecture } from '../../providers/gateway';
import { useSharedTripStore } from '../../store/TripStoreContext';
import { EmptyState, Panel, PrimaryButton, StatusBanner, StatusBadge } from './shared/ui';

export function AdminOpsPanel() {
  const { accountSettings, vault, finalisationState, authState } = useSharedTripStore();
  const [audit, setAudit] = useState(() => loadAdminAudit());
  const [feedback, setFeedback] = useState<string | null>(null);

  const role = useMemo(
    () =>
      resolveAppRole({
        email: accountSettings.email || authState.user?.email,
      }),
    [accountSettings.email, authState.user?.email],
  );

  const providerArchitecture = useMemo(() => describeProviderArchitecture(), []);

  const gated = (capability: AdminCapability, action: string, run: () => void) => {
    const check = assertAdminCapability(role, capability);
    if (!check.ok) {
      setFeedback(check.message);
      return;
    }
    run();
    const entry = appendAdminAudit({
      actorEmail: accountSettings.email || authState.user?.email || 'unknown',
      action,
      details: `capability=${capability}`,
    });
    setAudit((current) => [entry, ...current].slice(0, 50));
    setFeedback(`Admin action recorded: ${action}`);
  };

  if (role === 'traveller') {
    return (
      <Panel title="Admin area" description="Role-protected operations console.">
        <StatusBanner
          kind="error"
          message="Admin access is unavailable for traveller accounts. Access is enforced by role checks, not UI hiding alone."
        />
        <EmptyState
          title="Forbidden"
          body="Ask a workspace admin to grant the admin role via Supabase app_role or VITE_ALEYA_ADMIN_EMAILS allowlist."
        />
      </Panel>
    );
  }

  return (
    <Panel
      title="Admin & operations"
      description="Users, trips, provider health, feature flags, audit logs, and support indicators. Secrets are never exposed."
    >
      {feedback ? <StatusBanner kind="info" message={feedback} /> : null}
      <div className="mb-4 flex flex-wrap gap-2">
        <StatusBadge label={`Role: ${role}`} tone="info" />
        <StatusBadge label={`${vault.trips.length} trips`} tone="success" />
        <StatusBadge
          label={finalisationState.offline.network === 'offline' ? 'Network offline' : 'Network online'}
          tone={finalisationState.offline.network === 'offline' ? 'warning' : 'success'}
        />
        <StatusBadge
          label={providerArchitecture.liveProxyEnabled ? 'Live proxy flag on' : 'Mock providers'}
          tone={providerArchitecture.liveProxyEnabled ? 'warning' : 'info'}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-xl border border-white/10 p-3 text-sm text-slate-300">
          <h4 className="font-medium text-white">Users (local view)</h4>
          <p className="mt-1">Signed-in email: {accountSettings.email || authState.user?.email || 'n/a'}</p>
          <p className="mt-1 text-xs text-slate-500">Full user directory requires server-side admin APIs.</p>
          <PrimaryButton
            type="button"
            className="mt-3"
            onClick={() => gated('view_users', 'view_users_snapshot', () => undefined)}
          >
            Record user view
          </PrimaryButton>
        </section>
        <section className="rounded-xl border border-white/10 p-3 text-sm text-slate-300">
          <h4 className="font-medium text-white">Trips</h4>
          <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs">
            {vault.trips.map((trip) => (
              <li key={trip.id}>
                {trip.tripName} · {trip.status} · {trip.destination || 'no destination'}
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-xl border border-white/10 p-3 text-sm text-slate-300">
          <h4 className="font-medium text-white">Provider configuration</h4>
          <p className="mt-1 text-xs text-slate-500">{providerArchitecture.principle}</p>
          <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs">
            {providerArchitecture.suppliers.map((provider) => (
              <li key={`${provider.supplierId}-${provider.service}`}>
                {provider.displayName}: {provider.status} · {provider.service}
              </li>
            ))}
          </ul>
          <PrimaryButton
            type="button"
            className="mt-3"
            onClick={() => gated('view_provider_health', 'view_provider_health', () => undefined)}
          >
            Audit provider health view
          </PrimaryButton>
        </section>
        <section className="rounded-xl border border-white/10 p-3 text-sm text-slate-300">
          <h4 className="font-medium text-white">Feature flags</h4>
          <ul className="mt-2 text-xs">
            {finalisationState.featureFlags.map((flag) => (
              <li key={flag.id}>
                {flag.id}: {flag.enabled ? 'on' : 'off'}
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-xl border border-white/10 p-3 text-sm text-slate-300 md:col-span-2">
          <h4 className="font-medium text-white">Audit log</h4>
          {audit.length === 0 ? (
            <p className="mt-1">No admin audit entries yet.</p>
          ) : (
            <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs">
              {audit.map((entry) => (
                <li key={entry.id}>
                  {new Date(entry.at).toLocaleString()} · {entry.actorEmail} · {entry.action} · {entry.details}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Panel>
  );
}
