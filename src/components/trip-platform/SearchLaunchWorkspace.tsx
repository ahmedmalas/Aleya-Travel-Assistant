/**
 * In-app search launch workspace — one explicit Open action per provider.
 * Each button click is its own browser user gesture (never multi-popup).
 */

import { useEffect, useState } from 'react';
import {
  getActiveSearchLaunchSession,
  openProviderLaunchAction,
  type ProviderLaunchResult,
  type SearchLaunchSession,
} from '../../features/travel-conversation/search-projection/providerLaunch';

function formatDates(result: ProviderLaunchResult): string {
  if (result.departDate && result.returnDate) {
    return `${result.departDate} → ${result.returnDate}`;
  }
  if (result.departDate) return result.departDate;
  return 'Dates from your trip';
}

function statusLabel(status: ProviderLaunchResult['status']): string {
  if (status === 'opened') return 'Opened';
  if (status === 'ready_for_user') return 'Ready';
  if (status === 'blocked') return 'Blocked';
  return 'Failed';
}

function statusClass(status: ProviderLaunchResult['status']): string {
  if (status === 'opened') return 'border-emerald-400/40 bg-emerald-950/40 text-emerald-100';
  if (status === 'ready_for_user') return 'border-sky-400/40 bg-sky-950/40 text-sky-100';
  if (status === 'blocked') return 'border-amber-400/40 bg-amber-950/40 text-amber-100';
  return 'border-rose-400/40 bg-rose-950/40 text-rose-100';
}

function serviceTitle(service: ProviderLaunchResult['service']): string {
  if (service === 'flights') return 'Flights';
  if (service === 'accommodation') return 'Accommodation';
  if (service === 'car_hire') return 'Car hire';
  return service.replace(/_/g, ' ');
}

export type SearchLaunchWorkspaceProps = {
  session: SearchLaunchSession;
  onSessionChange?: (session: SearchLaunchSession) => void;
};

export function SearchLaunchWorkspace({
  session,
  onSessionChange,
}: SearchLaunchWorkspaceProps) {
  const [rows, setRows] = useState(session.results);

  useEffect(() => {
    setRows(session.results);
  }, [session]);

  const openOne = (service: ProviderLaunchResult['service']) => {
    const updated = openProviderLaunchAction(service);
    const latest = getActiveSearchLaunchSession();
    if (latest) {
      setRows([...latest.results]);
      onSessionChange?.(latest);
    } else if (updated) {
      setRows((current) =>
        current.map((row) => (row.service === service ? updated : row)),
      );
    }
  };

  const destination =
    session.projection.destination.label ??
    session.projection.destination.airportCode ??
    'your destination';

  return (
    <section
      className="border-b border-white/10 bg-slate-950/60 px-5 py-4 md:px-7"
      data-testid="search-launch-workspace"
      aria-label="Provider search launch workspace"
    >
      <header className="mb-3">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-300">
          Search results workspace
        </p>
        <p className="mt-1 text-sm text-slate-300">
          Open each provider from here. Destination: {destination}
          {session.projection.departureDate
            ? ` · ${session.projection.departureDate}`
            : ''}
          {session.projection.returnDate
            ? ` → ${session.projection.returnDate}`
            : ''}
        </p>
      </header>

      <ul className="space-y-3">
        {rows.map((row) => (
          <li
            key={`${row.service}-${row.url}`}
            className={`rounded-2xl border px-4 py-3 ${statusClass(row.status)}`}
            data-testid={`search-launch-row-${row.service}`}
            data-launch-status={row.status}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-white">
                  {serviceTitle(row.service)} — Open {row.provider}
                </p>
                <p className="mt-1 text-xs opacity-90">
                  {row.destinationLabel ?? destination} · {formatDates(row)}
                </p>
                <p className="mt-1 text-[11px] uppercase tracking-[0.14em]">
                  Status: {statusLabel(row.status)}
                </p>
                {row.reason ? (
                  <p className="mt-1 text-xs opacity-80">{row.reason}</p>
                ) : null}
              </div>
              <button
                type="button"
                data-testid={`open-provider-${row.service}`}
                disabled={!row.url || row.status === 'opened'}
                onClick={() => openOne(row.service)}
                className="rounded-full bg-sky-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-sky-300 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {row.status === 'opened' ? 'Opened' : 'Open'}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
