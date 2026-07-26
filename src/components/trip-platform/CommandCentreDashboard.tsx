import { useSharedTripStore } from '../../store/TripStoreContext';
import { EmptyState, Panel, PrimaryButton, SecondaryButton } from './shared/ui';

export function CommandCentreDashboard({ onNavigate }: { onNavigate?: (tab: string) => void }) {
  const { commandCentre, openVaultTrip, unreadNotifications } = useSharedTripStore();

  return (
    <Panel
      title="My travel dashboard"
      description="Your trips, alerts, budget status, expiring documents, and quick actions in one place."
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <article className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-sky-300">Trips</p>
          <p className="mt-2 text-2xl font-semibold text-white">{commandCentre.tripCount}</p>
          <p className="mt-1 text-xs text-slate-400">
            {commandCentre.activeTripCount} active · {commandCentre.draftTripCount} draft · {commandCentre.favouriteCount} favourites
          </p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-sky-300">Current trip</p>
          <p className="mt-2 text-lg font-semibold text-white">{commandCentre.currentTrip?.tripName ?? 'None yet'}</p>
          <p className="mt-1 text-xs text-slate-400">{commandCentre.currentTrip?.destination || 'Start planning your next destination'}</p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-sky-300">Alerts</p>
          <p className="mt-2 text-2xl font-semibold text-white">{unreadNotifications}</p>
          <p className="mt-1 text-xs text-slate-400">Travel reminders needing your attention</p>
        </article>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {commandCentre.quickActions.map((action) => (
          <PrimaryButton key={action.id} type="button" onClick={() => onNavigate?.(action.tab)}>
            {action.label}
          </PrimaryButton>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-white/10 bg-slate-950/30 p-4">
          <h4 className="font-medium text-white">Upcoming departures</h4>
          {commandCentre.upcomingDepartures.length === 0 ? (
            <div className="mt-3">
              <EmptyState title="No upcoming departures" body="Add travel dates to a trip to see your countdown here." />
            </div>
          ) : (
            <ul className="mt-3 space-y-2">
              {commandCentre.upcomingDepartures.map((entry) => (
                <li key={entry.tripId} className="flex items-center justify-between gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm">
                  <div>
                    <p className="text-white">{entry.tripName}</p>
                    <p className="text-slate-400">
                      {entry.destination || 'Destination not set'} · {entry.departureDate}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sky-200">{entry.daysUntil}d</span>
                    <SecondaryButton type="button" onClick={() => openVaultTrip(entry.tripId)}>
                      Open
                    </SecondaryButton>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-white/10 bg-slate-950/30 p-4">
          <h4 className="font-medium text-white">Alerts</h4>
          {commandCentre.alerts.length === 0 ? (
            <div className="mt-3">
              <EmptyState title="No alerts" body="Important travel reminders will appear here." />
            </div>
          ) : (
            <ul className="mt-3 space-y-2 text-sm text-slate-300">
              {commandCentre.alerts.map((alert) => (
                <li key={alert.id} className="rounded-xl border border-white/10 px-3 py-2">
                  <p className="text-white">{alert.title}</p>
                  <p className="mt-1">{alert.body}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-white/10 bg-slate-950/30 p-4">
          <h4 className="font-medium text-white">Budget status</h4>
          <ul className="mt-3 space-y-2 text-sm">
            {commandCentre.budgetStatus.slice(0, 6).map((entry) => (
              <li key={entry.tripId} className="flex justify-between rounded-xl border border-white/10 px-3 py-2">
                <span className="text-white">{entry.tripName}</span>
                <span className={entry.overBudget ? 'text-rose-300' : 'text-emerald-300'}>
                  {entry.remaining.toFixed(0)} {entry.currency}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-white/10 bg-slate-950/30 p-4">
          <h4 className="font-medium text-white">Documents expiring</h4>
          {commandCentre.documentsExpiring.length === 0 ? (
            <div className="mt-3">
              <EmptyState title="No expiry alerts" body="Passport, visa and travel-document reminders will appear here." />
            </div>
          ) : (
            <ul className="mt-3 space-y-2 text-sm text-slate-300">
              {commandCentre.documentsExpiring.map((doc) => (
                <li key={`${doc.tripId}-${doc.title}-${doc.expiryDate}`} className="rounded-xl border border-white/10 px-3 py-2">
                  <p className="text-white">{doc.title}</p>
                  <p className="mt-1">
                    {doc.tripName} · {doc.expiryDate} · {doc.daysUntilExpiry}d
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="mt-4 rounded-2xl border border-white/10 bg-slate-950/30 p-4">
        <h4 className="font-medium text-white">Recent activity</h4>
        {commandCentre.recentActivity.length === 0 ? (
          <div className="mt-3">
            <EmptyState title="No recent activity" body="Your recent trip changes will appear here." />
          </div>
        ) : (
          <ul className="mt-3 space-y-2 text-sm text-slate-300">
            {commandCentre.recentActivity.map((entry, index) => (
              <li key={`${entry.tripId}-${entry.at}-${index}`} className="rounded-xl border border-white/10 px-3 py-2">
                <p className="text-white">{entry.tripName}</p>
                <p className="mt-1">{entry.message}</p>
                <p className="mt-1 text-xs text-slate-500">{new Date(entry.at).toLocaleString()}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Panel>
  );
}
