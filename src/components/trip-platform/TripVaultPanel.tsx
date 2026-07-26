import { useState } from 'react';
import { useSharedTripStore } from '../../store/TripStoreContext';
import type { VaultFilterKey, VaultSortKey } from '../../store/vaultDomain';
import {
  EmptyState,
  Field,
  Panel,
  PrimaryButton,
  SecondaryButton,
  StatusBanner,
  inputClassName,
} from './shared/ui';

export function TripVaultPanel() {
  const {
    vault,
    vaultTrips,
    vaultQuery,
    setVaultQuery,
    vaultFilter,
    setVaultFilter,
    vaultSort,
    setVaultSort,
    openVaultTrip,
    createVaultTripEntry,
    archiveVaultTrip,
    restoreVaultTrip,
    updateVaultTripMeta,
    duplicateVaultTrip,
    deleteVaultTrip,
    toggleVaultFavourite,
    activeVaultTrip,
  } = useSharedTripStore();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [metaTripId, setMetaTripId] = useState<string | null>(null);
  const [metaTags, setMetaTags] = useState('');
  const [metaCover, setMetaCover] = useState('');
  const [metaStyle, setMetaStyle] = useState('balanced');
  const [metaStatus, setMetaStatus] = useState('draft');

  return (
    <Panel
      title="Trip vault"
      description="Manage multiple trips locally — open, favourite, archive, duplicate, or delete."
      actions={
        <PrimaryButton
          type="button"
          onClick={() => {
            createVaultTripEntry({ tripName: 'New vault trip', status: 'draft' });
            setFeedback('Created a new draft trip in the vault.');
          }}
        >
          New trip
        </PrimaryButton>
      }
    >
      {feedback ? <StatusBanner kind="info" message={feedback} /> : null}
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <Field label="Search vault" htmlFor="vault-query">
          <input
            id="vault-query"
            className={inputClassName}
            value={vaultQuery}
            onChange={(event) => setVaultQuery(event.target.value)}
            placeholder="Name, destination, notes…"
          />
        </Field>
        <Field label="Filter" htmlFor="vault-filter">
          <select
            id="vault-filter"
            className={inputClassName}
            value={vaultFilter}
            onChange={(event) => setVaultFilter(event.target.value as VaultFilterKey)}
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="upcoming">Upcoming</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="draft">Draft</option>
            <option value="archived">Archived</option>
            <option value="favourites">Favourites</option>
          </select>
        </Field>
        <Field label="Sort" htmlFor="vault-sort">
          <select
            id="vault-sort"
            className={inputClassName}
            value={vaultSort}
            onChange={(event) => setVaultSort(event.target.value as VaultSortKey)}
          >
            <option value="lastOpened">Last opened</option>
            <option value="name">Name</option>
            <option value="departure">Departure</option>
            <option value="updated">Updated</option>
            <option value="favourite">Favourites first</option>
          </select>
        </Field>
      </div>

      <p className="mt-3 text-sm text-slate-400">
        {vault.trips.length} trip(s) in vault · Active: {activeVaultTrip.tripName}
      </p>

      <div className="mt-4 space-y-3">
        {vaultTrips.length === 0 ? (
          <EmptyState title="No trips match" body="Adjust search or filter, or create a new trip." />
        ) : (
          vaultTrips.map((trip) => {
            const active = trip.id === vault.activeTripId;
            return (
              <article
                key={trip.id}
                className={`rounded-2xl border px-4 py-3 ${
                  active ? 'border-sky-300/40 bg-sky-500/10' : 'border-white/10 bg-slate-950/40'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-medium text-white">
                      {trip.favourite ? '★ ' : ''}
                      {trip.tripName}
                      {active ? ' · open' : ''}
                    </p>
                    <p className="mt-1 text-sm text-slate-300">
                      {trip.destination || 'No destination'} · {trip.status} · {trip.travelStyle} ·{' '}
                      {trip.departureDate || 'No dates'}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Tags: {(trip.tags ?? []).join(', ') || 'none'} · Last opened{' '}
                      {new Date(trip.lastOpenedAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <SecondaryButton
                      type="button"
                      onClick={() => {
                        const result = openVaultTrip(trip.id);
                        setFeedback(result.message);
                      }}
                    >
                      Open
                    </SecondaryButton>
                    <SecondaryButton type="button" onClick={() => toggleVaultFavourite(trip.id)}>
                      {trip.favourite ? 'Unfavourite' : 'Favourite'}
                    </SecondaryButton>
                    {trip.status === 'archived' ? (
                      <SecondaryButton
                        type="button"
                        onClick={() => {
                          restoreVaultTrip(trip.id);
                          setFeedback('Trip restored from archive.');
                        }}
                      >
                        Restore
                      </SecondaryButton>
                    ) : (
                      <SecondaryButton
                        type="button"
                        onClick={() => {
                          archiveVaultTrip(trip.id);
                          setFeedback('Trip archived.');
                        }}
                      >
                        Archive
                      </SecondaryButton>
                    )}
                    <SecondaryButton
                      type="button"
                      onClick={() => {
                        setMetaTripId(trip.id);
                        setMetaTags((trip.tags ?? []).join(', '));
                        setMetaCover(trip.coverImageUrl || '');
                        setMetaStyle(trip.travelStyle || 'balanced');
                        setMetaStatus(trip.status);
                      }}
                    >
                      Edit meta
                    </SecondaryButton>
                    <SecondaryButton
                      type="button"
                      onClick={() => {
                        const result = duplicateVaultTrip(trip.id);
                        setFeedback(result.message);
                      }}
                    >
                      Duplicate
                    </SecondaryButton>
                    <SecondaryButton
                      type="button"
                      onClick={() => {
                        const result = deleteVaultTrip(trip.id);
                        setFeedback(result.message);
                      }}
                    >
                      Delete
                    </SecondaryButton>
                  </div>
                </div>
                {metaTripId === trip.id ? (
                  <div className="mt-3 grid gap-2 border-t border-white/10 pt-3 md:grid-cols-4">
                    <Field label="Tags" htmlFor={`meta-tags-${trip.id}`}>
                      <input
                        id={`meta-tags-${trip.id}`}
                        className={inputClassName}
                        value={metaTags}
                        onChange={(event) => setMetaTags(event.target.value)}
                        placeholder="family, summer"
                      />
                    </Field>
                    <Field label="Cover image URL" htmlFor={`meta-cover-${trip.id}`}>
                      <input
                        id={`meta-cover-${trip.id}`}
                        className={inputClassName}
                        value={metaCover}
                        onChange={(event) => setMetaCover(event.target.value)}
                      />
                    </Field>
                    <Field label="Travel style" htmlFor={`meta-style-${trip.id}`}>
                      <select
                        id={`meta-style-${trip.id}`}
                        className={inputClassName}
                        value={metaStyle}
                        onChange={(event) => setMetaStyle(event.target.value)}
                      >
                        {['budget', 'balanced', 'luxury', 'family', 'adventure', 'romantic', 'business', 'accessible'].map(
                          (style) => (
                            <option key={style} value={style}>
                              {style}
                            </option>
                          ),
                        )}
                      </select>
                    </Field>
                    <Field label="Status" htmlFor={`meta-status-${trip.id}`}>
                      <select
                        id={`meta-status-${trip.id}`}
                        className={inputClassName}
                        value={metaStatus}
                        onChange={(event) => setMetaStatus(event.target.value)}
                      >
                        {['draft', 'upcoming', 'active', 'completed', 'cancelled', 'archived'].map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <div className="md:col-span-4 flex gap-2">
                      <PrimaryButton
                        type="button"
                        onClick={() => {
                          updateVaultTripMeta(trip.id, {
                            tags: metaTags
                              .split(',')
                              .map((entry) => entry.trim())
                              .filter(Boolean),
                            coverImageUrl: metaCover.trim(),
                            travelStyle: metaStyle as typeof trip.travelStyle,
                            status: metaStatus as typeof trip.status,
                          });
                          setMetaTripId(null);
                          setFeedback('Trip metadata updated.');
                        }}
                      >
                        Save meta
                      </PrimaryButton>
                      <SecondaryButton type="button" onClick={() => setMetaTripId(null)}>
                        Cancel
                      </SecondaryButton>
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })
        )}
      </div>
    </Panel>
  );
}
