import { useMemo, useState } from 'react';
import { useSharedTripStore } from '../../store/TripStoreContext';
import {
  buildBookingChecklist,
  buildPackageChecklist,
  buildPriceTrend,
  buildTrustPanel,
  buildWholeTripDeals,
  captureBookingConfirmation,
  createPriceAlert,
  evaluateAlert,
  generateDeepLink,
  generateSimulatedPriceHistory,
  markChecklistOpened,
  rankOffers,
  recordClick,
  runAccommodationSuperSearch,
  runFlexibleDiscovery,
  runFlightSuperSearch,
  shareDealPayload,
  toComparisonRows,
  type DiscoveryIntent,
  type RankedOffer,
  type TripPackageDeal,
} from '../../deal-engine';
import { DatePickerField, todayIso } from '../ui/DatePickerField';
import { LocationAutocomplete } from '../ui/LocationAutocomplete';
import { Field, Panel, PrimaryButton, SecondaryButton, StatusBadge, inputClassName } from './shared/ui';

function extractAirportToken(value: string): string {
  const match = value.match(/\(([A-Za-z]{3})\)/);
  if (match?.[1]) return match[1].toUpperCase();
  const trimmed = value.trim();
  if (/^[A-Za-z]{3}$/.test(trimmed)) return trimmed.toUpperCase();
  return value;
}

type DealTab = 'flights' | 'stays' | 'packages' | 'compare' | 'alerts' | 'discovery' | 'prefs' | 'trust';

export function DealEnginePanel() {
  const {
    dealEngineState,
    setDealScoringWeights,
    setDealLastSearchMeta,
    addDealShortlistItem,
    removeDealShortlistItem,
    setDealBookingChecklist,
    setDealPriceAlerts,
    appendDealPriceSnapshots,
    appendDealAttributionEvents,
    createDealPreferenceProfile,
    overrideActiveDealPreferences,
    setActiveDealPreferenceProfile,
  } = useSharedTripStore();

  const [tab, setTab] = useState<DealTab>('flights');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [origin, setOrigin] = useState('LHR');
  const [destination, setDestination] = useState('BCN');
  const [departDate, setDepartDate] = useState('2026-09-10');
  const [returnDate, setReturnDate] = useState('2026-09-17');
  const [ranked, setRanked] = useState<RankedOffer[]>([]);
  const [packages, setPackages] = useState<TripPackageDeal[]>([]);
  const [selectedOfferId, setSelectedOfferId] = useState<string | null>(null);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [discoveryIntent, setDiscoveryIntent] = useState<DiscoveryIntent>('weekend_escape');
  const [discoveryResults, setDiscoveryResults] = useState<
    Array<TripPackageDeal & { destination: string }>
  >([]);
  const [shareText, setShareText] = useState<string | null>(null);
  const [confirmationRef, setConfirmationRef] = useState('');

  const activePrefs = useMemo(
    () =>
      dealEngineState.preferenceProfiles.find(
        (profile) => profile.id === dealEngineState.activePreferenceProfileId,
      ) ?? null,
    [dealEngineState],
  );

  const selectedOffer = ranked.find((offer) => offer.id === selectedOfferId) ?? null;
  const trustPanel = selectedOffer
    ? buildTrustPanel(selectedOffer, dealEngineState.lastSearchMeta.providersSearched)
    : null;

  const runFlights = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await runFlightSuperSearch({
        mode: 'return',
        origin,
        destination,
        departDate,
        returnDate,
        nearbyAirports: true,
        flexibleDates: true,
        bags: 1,
        travellers: 2,
        weights: dealEngineState.scoringWeights,
        preferences: activePrefs,
      });
      setRanked(result.ranked);
      setSelectedOfferId(result.ranked[0]?.id ?? null);
      setDealLastSearchMeta({
        providersSearched: result.search.providersSearched,
        searchedAt: result.search.searchedAt,
        durationMs: result.search.durationMs,
        partial: result.search.partial,
      });
      setTab('compare');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Flight search failed');
    } finally {
      setBusy(false);
    }
  };

  const runStays = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await runAccommodationSuperSearch({
        destination,
        checkIn: departDate,
        checkOut: returnDate,
        travellers: 2,
        weights: dealEngineState.scoringWeights,
        preferences: activePrefs,
      });
      setRanked(result.ranked);
      setSelectedOfferId(result.ranked[0]?.id ?? null);
      setDealLastSearchMeta({
        providersSearched: result.search.providersSearched,
        searchedAt: result.search.searchedAt,
        durationMs: result.search.durationMs,
        partial: result.search.partial,
      });
      setTab('compare');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Stay search failed');
    } finally {
      setBusy(false);
    }
  };

  const runPackages = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await buildWholeTripDeals({
        origin,
        destination,
        departDate,
        returnDate,
        travellers: 2,
        preferences: activePrefs,
      });
      setPackages(result.packages);
      setDealLastSearchMeta({
        providersSearched: result.providersSearched,
        searchedAt: result.searchedAt,
        durationMs: null,
        partial: false,
      });
      setTab('packages');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Package build failed');
    } finally {
      setBusy(false);
    }
  };

  const runDiscovery = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await runFlexibleDiscovery({
        intent: discoveryIntent,
        origin,
        departDate,
        returnDate,
        budgetMax: activePrefs?.budgetMax ?? undefined,
        travellers: 2,
      });
      setDiscoveryResults(result.rankedTrips);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Discovery failed');
    } finally {
      setBusy(false);
    }
  };

  const toggleCompare = (id: string) => {
    setCompareIds((current) =>
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id].slice(0, 4),
    );
  };

  const openHandoff = (offer: RankedOffer) => {
    const link = generateDeepLink({ partnerId: offer.providerId, offerId: offer.id });
    const clickedAt = new Date().toISOString();
    appendDealAttributionEvents(
      recordClick([], {
        clickId: link.clickId,
        partnerId: offer.providerId,
        campaignId: link.campaignId,
        offerId: offer.id,
        searchedAt: dealEngineState.lastSearchMeta.searchedAt,
        clickedAt,
        deepLink: link.deepLink,
      }),
    );
    const checklist = buildBookingChecklist([offer]);
    setDealBookingChecklist(markChecklistOpened(checklist, offer.id));
    window.open(link.deepLink, '_blank', 'noopener,noreferrer');
  };

  const openPackageHandoff = (pkg: TripPackageDeal) => {
    const { checklist, multiProviderWarning } = buildPackageChecklist(pkg);
    setDealBookingChecklist(checklist);
    if (multiProviderWarning) setError(multiProviderWarning);
    setTab('compare');
  };

  const createAlertForSelected = () => {
    if (!selectedOffer) return;
    const snapshots = generateSimulatedPriceHistory(
      selectedOffer.id,
      selectedOffer.costs.finalEstimatedPayableTotal,
      selectedOffer.costs.currency,
    );
    appendDealPriceSnapshots(snapshots);
    const alert = createPriceAlert({
      offerKey: selectedOffer.id,
      kind: 'percentage_drop',
      percentageDrop: 5,
      label: `Watch ${selectedOffer.title}`,
    });
    setDealPriceAlerts([alert, ...dealEngineState.priceAlerts]);
    setTab('alerts');
  };

  const comparisonRows = toComparisonRows(ranked.filter((offer) => compareIds.includes(offer.id)));

  const tabs: Array<{ id: DealTab; label: string }> = [
    { id: 'flights', label: 'Flight search' },
    { id: 'stays', label: 'Stay search' },
    { id: 'packages', label: 'Trip builder' },
    { id: 'compare', label: 'Compare & handoff' },
    { id: 'alerts', label: 'Price alerts' },
    { id: 'discovery', label: 'Discovery' },
    { id: 'prefs', label: 'Preferences' },
    { id: 'trust', label: 'Trust centre' },
  ];

  return (
    <Panel
      title="Super Deal Engine"
      description="Provider-neutral demo search with fee-inclusive totals, explainable ranking, and partner handoff. Never claims global cheapest."
      actions={
        <>
          {dealEngineState.lastSearchMeta.searchedAt ? (
            <StatusBadge label={`Searched ${new Date(dealEngineState.lastSearchMeta.searchedAt).toLocaleString()}`} tone="info" />
          ) : null}
          {dealEngineState.lastSearchMeta.partial ? <StatusBadge label="Partial results" tone="warning" /> : null}
        </>
      }
    >
      <p className="mb-4 text-xs text-slate-400" role="note">
        Affiliate disclosure: Travel Buddy may earn a commission from approved partners. Ranking does not use commission.
        Prices shown are simulated until live providers are approved.
      </p>

      <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Deal engine sections">
        {tabs.map((entry) => (
          <button
            key={entry.id}
            type="button"
            role="tab"
            aria-selected={tab === entry.id}
            className={`rounded-full px-3 py-1.5 text-sm ${
              tab === entry.id ? 'bg-sky-400/25 text-sky-100' : 'border border-white/15 text-slate-300'
            }`}
            onClick={() => setTab(entry.id)}
          >
            {entry.label}
          </button>
        ))}
      </div>

      {(tab === 'flights' || tab === 'stays' || tab === 'packages') && (
        <div className="mb-4 grid gap-3 md:grid-cols-4">
          <Field label="Origin" htmlFor="deal-origin">
            <LocationAutocomplete
              id="deal-origin"
              mode="flight"
              value={origin}
              onChange={(value, suggestion) =>
                setOrigin(suggestion?.airportCode ?? extractAirportToken(value))
              }
              placeholder="City or airport"
            />
          </Field>
          <Field label="Destination" htmlFor="deal-destination">
            <LocationAutocomplete
              id="deal-destination"
              mode={tab === 'stays' ? 'place' : 'flight'}
              value={destination}
              onChange={(value, suggestion) => {
                if (tab === 'stays') {
                  setDestination(value);
                  return;
                }
                setDestination(suggestion?.airportCode ?? extractAirportToken(value));
              }}
              placeholder={tab === 'stays' ? 'City or neighbourhood' : 'City or airport'}
            />
          </Field>
          <Field label="Depart" htmlFor="deal-depart">
            <DatePickerField
              id="deal-depart"
              value={departDate}
              min={todayIso()}
              onChange={(next) => {
                setDepartDate(next);
                if (returnDate && next && returnDate < next) setReturnDate(next);
              }}
            />
          </Field>
          <Field label="Return" htmlFor="deal-return">
            <DatePickerField
              id="deal-return"
              value={returnDate}
              min={departDate || todayIso()}
              onChange={setReturnDate}
            />
          </Field>
        </div>
      )}

      {error ? (
        <p className="mb-3 text-sm text-amber-200" role="alert">
          {error}
        </p>
      ) : null}

      {tab === 'flights' ? (
        <div className="space-y-3">
          <PrimaryButton disabled={busy} onClick={() => void runFlights()}>
            {busy ? 'Searching…' : 'Run flight super-search (demo)'}
          </PrimaryButton>
          <p className="text-sm text-slate-400">
            Compares return-style, separate one-ways, nearby airports, flexible dates, and baggage-inclusive totals.
          </p>
        </div>
      ) : null}

      {tab === 'stays' ? (
        <div className="space-y-3">
          <PrimaryButton disabled={busy} onClick={() => void runStays()}>
            {busy ? 'Searching…' : 'Run accommodation super-search (demo)'}
          </PrimaryButton>
          <p className="text-sm text-slate-400">
            Hotels, apartments, hostels, resorts, holiday homes, serviced apartments — final stay cost including fees.
          </p>
        </div>
      ) : null}

      {tab === 'packages' ? (
        <div className="space-y-3">
          <PrimaryButton disabled={busy} onClick={() => void runPackages()}>
            {busy ? 'Building…' : 'Build whole-trip deals (demo)'}
          </PrimaryButton>
          <ul className="space-y-3">
            {packages.map((pkg) => (
              <li key={pkg.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h4 className="font-semibold text-white">{pkg.title}</h4>
                    <p className="mt-1 text-sm text-slate-300">{pkg.whyThisDeal}</p>
                    <p className="mt-2 text-sm text-sky-200">
                      Total journey {pkg.currency} {pkg.totalEstimatedPayable.toFixed(2)} · {pkg.components.length}{' '}
                      components
                    </p>
                  </div>
                  <SecondaryButton onClick={() => openPackageHandoff(pkg)}>Open booking steps</SecondaryButton>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {tab === 'compare' ? (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <SecondaryButton
              onClick={() => {
                setRanked(rankOffers(ranked, dealEngineState.scoringWeights, activePrefs));
              }}
            >
              Re-rank with current weights
            </SecondaryButton>
            {selectedOffer ? (
              <>
                <SecondaryButton onClick={() => addDealShortlistItem(selectedOffer)}>Save for later</SecondaryButton>
                <SecondaryButton onClick={() => openHandoff(selectedOffer)}>Open booking partner</SecondaryButton>
                <SecondaryButton
                  onClick={() => {
                    const share = shareDealPayload({
                      dealId: selectedOffer.id,
                      title: selectedOffer.title,
                      total: selectedOffer.costs.finalEstimatedPayableTotal,
                      currency: selectedOffer.costs.currency,
                    });
                    setShareText(share.text);
                  }}
                >
                  Share deal
                </SecondaryButton>
                <SecondaryButton onClick={createAlertForSelected}>Watch price</SecondaryButton>
              </>
            ) : null}
          </div>

          {shareText ? <p className="text-sm text-slate-300">{shareText}</p> : null}

          <div className="grid gap-3 lg:grid-cols-2">
            <div>
              <h4 className="mb-2 text-sm font-medium text-slate-200">Ranked results</h4>
              <ul className="max-h-96 space-y-2 overflow-y-auto">
                {ranked.map((offer, index) => (
                  <li key={offer.id}>
                    <button
                      type="button"
                      className={`w-full rounded-xl border p-3 text-left text-sm ${
                        selectedOfferId === offer.id
                          ? 'border-sky-300/50 bg-sky-400/10'
                          : 'border-white/10 bg-white/[0.02]'
                      }`}
                      onClick={() => setSelectedOfferId(offer.id)}
                    >
                      <div className="flex justify-between gap-2">
                        <span className="font-medium text-white">
                          #{index + 1} {offer.title}
                        </span>
                        <span className="text-sky-200">
                          {offer.costs.currency} {offer.costs.finalEstimatedPayableTotal.toFixed(2)}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-400">Why this deal? {offer.whyThisDeal}</p>
                      <label className="mt-2 flex items-center gap-2 text-xs text-slate-300">
                        <input
                          type="checkbox"
                          checked={compareIds.includes(offer.id)}
                          onChange={() => toggleCompare(offer.id)}
                        />
                        Side-by-side
                      </label>
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="mb-2 text-sm font-medium text-slate-200">Side-by-side</h4>
              {comparisonRows.length === 0 ? (
                <p className="text-sm text-slate-400">Select up to four offers to compare.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-xs text-slate-200">
                    <thead>
                      <tr className="border-b border-white/10 text-slate-400">
                        <th className="p-2">Offer</th>
                        <th className="p-2">Total</th>
                        <th className="p-2">Freshness</th>
                        <th className="p-2">Sponsored</th>
                      </tr>
                    </thead>
                    <tbody>
                      {comparisonRows.map((row) => (
                        <tr key={row.offerId} className="border-b border-white/5">
                          <td className="p-2">{row.title}</td>
                          <td className="p-2">
                            {row.currency} {row.finalTotal.toFixed(2)}
                          </td>
                          <td className="p-2">{row.freshness}</td>
                          <td className="p-2">{row.sponsored ? 'Yes (labelled)' : 'No'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <h4 className="mb-2 mt-4 text-sm font-medium text-slate-200">Shortlist</h4>
              <ul className="space-y-2 text-sm">
                {dealEngineState.shortlist.map((item) => (
                  <li key={item.id} className="flex justify-between gap-2 rounded-lg border border-white/10 px-3 py-2">
                    <span>
                      {item.title} · {item.currency} {item.total.toFixed(2)}
                    </span>
                    <SecondaryButton onClick={() => removeDealShortlistItem(item.id)}>Remove</SecondaryButton>
                  </li>
                ))}
              </ul>

              <h4 className="mb-2 mt-4 text-sm font-medium text-slate-200">Booking checklist</h4>
              <ul className="space-y-2 text-sm">
                {dealEngineState.bookingChecklist.map((step) => (
                  <li key={step.offerId} className="rounded-lg border border-white/10 p-3">
                    <p className="font-medium text-white">
                      {step.order}. {step.title} ({step.providerName}) — {step.status}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">{step.disclosureText}</p>
                    <a className="mt-1 inline-block text-sky-300 underline" href={step.deepLink} target="_blank" rel="noreferrer">
                      Partner deep link
                    </a>
                    {step.status !== 'confirmed' ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        <input
                          className={inputClassName}
                          placeholder="Confirmation ref"
                          value={confirmationRef}
                          onChange={(e) => setConfirmationRef(e.target.value)}
                          aria-label="Booking confirmation reference"
                        />
                        <SecondaryButton
                          onClick={() =>
                            setDealBookingChecklist(
                              captureBookingConfirmation(
                                dealEngineState.bookingChecklist,
                                step.offerId,
                                confirmationRef || 'DEMO-CONF',
                              ),
                            )
                          }
                        >
                          Capture confirmation
                        </SecondaryButton>
                      </div>
                    ) : (
                      <p className="mt-1 text-xs text-emerald-300">Confirmed: {step.confirmationReference}</p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : null}

      {tab === 'alerts' ? (
        <div className="space-y-3">
          {dealEngineState.priceAlerts.length === 0 ? (
            <p className="text-sm text-slate-400">No alerts yet. Rank an offer and choose Watch price.</p>
          ) : (
            dealEngineState.priceAlerts.map((alert) => {
              const snaps = dealEngineState.priceSnapshots.filter((snap) => snap.offerKey === alert.offerKey);
              const trend = buildPriceTrend(snaps);
              const evaluation = trend ? evaluateAlert(alert, trend) : null;
              return (
                <div key={alert.id} className="rounded-xl border border-white/10 p-3 text-sm">
                  <p className="font-medium text-white">{alert.label}</p>
                  <p className="text-slate-400">
                    {alert.kind} · expires {new Date(alert.expiresAt).toLocaleDateString()}
                  </p>
                  {trend ? (
                    <p className="mt-1 text-sky-200">
                      Latest {trend.currency} {trend.latest} · low {trend.lowestObserved} · Δ {trend.changePercent}%
                    </p>
                  ) : null}
                  {evaluation?.triggered ? (
                    <StatusBadge label={evaluation.reason ?? 'Triggered'} tone="warning" />
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      ) : null}

      {tab === 'discovery' ? (
        <div className="space-y-3">
          <Field label="Intent" htmlFor="discovery-intent">
            <select
              id="discovery-intent"
              className={inputClassName}
              value={discoveryIntent}
              onChange={(e) => setDiscoveryIntent(e.target.value as DiscoveryIntent)}
            >
              {[
                'anywhere_within_budget',
                'warm_destination',
                'beach_holiday',
                'family_holiday',
                'weekend_escape',
                'food_destination',
                'luxury_under_budget',
                'cheapest_international',
                'visa_friendly',
                'short_flight',
                'school_holiday_deal',
                'accessible_destination',
              ].map((intent) => (
                <option key={intent} value={intent}>
                  {intent.replaceAll('_', ' ')}
                </option>
              ))}
            </select>
          </Field>
          <PrimaryButton disabled={busy} onClick={() => void runDiscovery()}>
            {busy ? 'Discovering…' : 'Run flexible discovery'}
          </PrimaryButton>
          <ul className="space-y-2">
            {discoveryResults.map((trip) => (
              <li key={`${trip.destination}-${trip.id}`} className="rounded-xl border border-white/10 p-3 text-sm">
                <p className="font-medium text-white">
                  {trip.destination} — {trip.title}
                </p>
                <p className="text-sky-200">
                  Complete trip {trip.currency} {trip.totalEstimatedPayable.toFixed(2)}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {tab === 'prefs' ? (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <PrimaryButton onClick={() => createDealPreferenceProfile(`Profile ${dealEngineState.preferenceProfiles.length + 1}`)}>
              New preference profile
            </PrimaryButton>
          </div>
          <Field label="Active profile" htmlFor="pref-active">
            <select
              id="pref-active"
              className={inputClassName}
              value={dealEngineState.activePreferenceProfileId ?? ''}
              onChange={(e) => setActiveDealPreferenceProfile(e.target.value || null)}
            >
              {dealEngineState.preferenceProfiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.name}
                </option>
              ))}
            </select>
          </Field>
          {activePrefs ? (
            <div className="grid gap-3 md:grid-cols-3">
              <Field label="Budget max" htmlFor="pref-budget">
                <input
                  id="pref-budget"
                  type="number"
                  className={inputClassName}
                  value={activePrefs.budgetMax ?? ''}
                  onChange={(e) =>
                    overrideActiveDealPreferences({
                      budgetMax: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                />
              </Field>
              <Field label="Max stops" htmlFor="pref-stops">
                <input
                  id="pref-stops"
                  type="number"
                  className={inputClassName}
                  value={activePrefs.maxStops ?? ''}
                  onChange={(e) =>
                    overrideActiveDealPreferences({
                      maxStops: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                />
              </Field>
              <Field label="Cost weight" htmlFor="weight-cost">
                <input
                  id="weight-cost"
                  type="number"
                  className={inputClassName}
                  value={dealEngineState.scoringWeights.totalCost}
                  onChange={(e) => setDealScoringWeights({ totalCost: Number(e.target.value) || 0 })}
                />
              </Field>
            </div>
          ) : null}
          <p className="text-xs text-slate-400">
            Preferences apply automatically to ranking; override any field per search session above.
          </p>
        </div>
      ) : null}

      {tab === 'trust' ? (
        <div className="space-y-3 text-sm text-slate-300">
          {!trustPanel ? (
            <p>Select a ranked offer to inspect the trust panel.</p>
          ) : (
            <>
              <p>
                <strong className="text-white">Providers searched:</strong>{' '}
                {trustPanel.providersSearched.join(', ') || '—'}
              </p>
              <p>
                <strong className="text-white">Last checked:</strong> {trustPanel.lastChecked}
              </p>
              <p>
                <strong className="text-white">Availability confidence:</strong> {trustPanel.availabilityConfidence}
              </p>
              <p>
                <strong className="text-white">Price freshness:</strong> {trustPanel.priceFreshness}
              </p>
              <p>
                <strong className="text-white">Final estimated payable:</strong>{' '}
                {trustPanel.priceComposition.currency}{' '}
                {trustPanel.priceComposition.finalEstimatedPayableTotal.toFixed(2)}
              </p>
              <p>
                <strong className="text-white">Self-transfer risk:</strong> {trustPanel.selfTransferRisk}
              </p>
              <p>
                <strong className="text-white">Sponsored:</strong> {trustPanel.sponsoredResult ? 'Yes' : 'No'}
              </p>
              <p>
                <strong className="text-white">Data source:</strong> {trustPanel.dataSource}
              </p>
              <p>
                <strong className="text-white">Redirect:</strong> {trustPanel.redirectDestination}
              </p>
              <p className="text-amber-100">{trustPanel.affiliateRelationship}</p>
              <p className="text-emerald-200">{trustPanel.rankingIndependenceNote}</p>
              {selectedOffer ? (
                <div>
                  <h4 className="font-medium text-white">Why this deal?</h4>
                  <ul className="mt-1 list-disc pl-5">
                    {selectedOffer.rankReasons.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </Panel>
  );
}
