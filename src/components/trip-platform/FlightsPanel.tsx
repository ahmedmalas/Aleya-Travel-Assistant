import { useState } from 'react';
import { searchFlights, type FlightOffer } from '../../providers';
import { useSharedTripStore } from '../../store/TripStoreContext';
import {
  FLIGHT_CHECK_IN_STATUSES,
  type FlightCheckInStatus,
  type FlightSegment,
} from '../../store/travelOpsDomain';
import { DatePickerField, todayIso } from '../ui/DatePickerField';
import { LocationAutocomplete } from '../ui/LocationAutocomplete';
import {
  EmptyState,
  Field,
  Panel,
  PrimaryButton,
  SecondaryButton,
  StatusBanner,
  StatusBadge,
  inputClassName,
} from './shared/ui';

const createFlight = (currency: string): FlightSegment => ({
  id: crypto.randomUUID(),
  airline: '',
  flightNumber: '',
  bookingReference: '',
  departureAirport: '',
  arrivalAirport: '',
  departureTerminal: '',
  arrivalTerminal: '',
  departureGate: '',
  arrivalGate: '',
  departureDate: '',
  departureTime: '',
  arrivalDate: '',
  arrivalTime: '',
  layoverMinutes: 0,
  cabin: '',
  seat: '',
  baggageAllowance: '',
  checkInStatus: 'not-open',
  statusNotes: '',
  travellerIds: [],
  cost: 0,
  currency,
  notes: '',
});

export function FlightsPanel() {
  const {
    activeVaultTrip,
    upsertFlight,
    deleteFlight,
    canEditTrip,
    upsertSavedSearch,
    deleteSavedSearch,
    addStop,
  } = useSharedTripStore();
  const flights = activeVaultTrip.flights ?? [];
  const travellers = activeVaultTrip.travellers ?? [];
  const savedFlightSearches = (activeVaultTrip.savedSearches ?? []).filter((entry) => entry.kind === 'flight');
  const [draft, setDraft] = useState<FlightSegment>(createFlight(activeVaultTrip.currency));
  const [feedback, setFeedback] = useState<string | null>(null);
  const [tripType, setTripType] = useState<'one-way' | 'return' | 'multi-city'>('return');
  const [planOrigin, setPlanOrigin] = useState('');
  const [planDestination, setPlanDestination] = useState('');
  const [planDepart, setPlanDepart] = useState('');
  const [planReturn, setPlanReturn] = useState('');
  const [multiCityLegs, setMultiCityLegs] = useState([
    { origin: '', destination: '', date: '' },
    { origin: '', destination: '', date: '' },
  ]);
  const [adults, setAdults] = useState(Math.max(1, activeVaultTrip.travellerCount || 1));
  const [children, setChildren] = useState(0);
  const [infants, setInfants] = useState(0);
  const [planCabin, setPlanCabin] = useState('Economy');
  const [directOnly, setDirectOnly] = useState(false);
  const [maxStops, setMaxStops] = useState(2);
  const [preferredAirlines, setPreferredAirlines] = useState('');
  const [excludedAirlines, setExcludedAirlines] = useState('');
  const [baggagePref, setBaggagePref] = useState('');
  const [departTimePref, setDepartTimePref] = useState('any');
  const [arriveTimePref, setArriveTimePref] = useState('any');
  const [maxDurationHours, setMaxDurationHours] = useState(24);
  const [budget, setBudget] = useState(0);
  const [nearbyAirports, setNearbyAirports] = useState(true);
  const [flexibleDates, setFlexibleDates] = useState(false);
  const [fareAlert, setFareAlert] = useState(false);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [providerOffers, setProviderOffers] = useState<FlightOffer[]>([]);
  const [providerBusy, setProviderBusy] = useState(false);
  const [providerWarning, setProviderWarning] = useState<string | null>(null);

  const planTravellers = adults + children + infants;

  const toggleTraveller = (travellerId: string) => {
    setDraft((current) => ({
      ...current,
      travellerIds: current.travellerIds.includes(travellerId)
        ? current.travellerIds.filter((id) => id !== travellerId)
        : [...current.travellerIds, travellerId],
    }));
  };

  const handleSave = () => {
    if (!draft.airline.trim() && !draft.flightNumber.trim()) {
      setFeedback('Airline or flight number is required.');
      return;
    }
    upsertFlight(draft);
    setDraft(createFlight(activeVaultTrip.currency));
    setFeedback('Flight segment saved.');
  };

  const extractAirportToken = (value: string) => {
    const match = value.match(/\(([A-Za-z]{3})\)/);
    if (match?.[1]) return match[1].toUpperCase();
    const trimmed = value.trim();
    if (/^[A-Za-z]{3}$/.test(trimmed)) return trimmed.toUpperCase();
    return trimmed;
  };

  const buildSearchNotes = () =>
    [
      `Trip type: ${tripType}`,
      `Passengers: ${adults} adult(s), ${children} child(ren), ${infants} infant(s)`,
      `Cabin ${planCabin}`,
      directOnly ? 'Direct only' : `Max stops ${maxStops}`,
      flexibleDates ? 'Flexible dates' : null,
      nearbyAirports ? 'Nearby airports OK' : null,
      preferredAirlines ? `Preferred airlines: ${preferredAirlines}` : null,
      excludedAirlines ? `Excluded airlines: ${excludedAirlines}` : null,
      baggagePref ? `Baggage: ${baggagePref}` : null,
      `Depart time pref: ${departTimePref}`,
      `Arrive time pref: ${arriveTimePref}`,
      `Max journey ${maxDurationHours}h`,
      budget > 0 ? `Budget ${budget} ${activeVaultTrip.currency}` : null,
      'Live inventory not connected — planning / mock offers only.',
    ]
      .filter(Boolean)
      .join(' · ');

  const saveFlightPlan = () => {
    if (tripType === 'multi-city') {
      const incomplete = multiCityLegs.some((leg) => !leg.origin.trim() || !leg.destination.trim());
      if (incomplete) {
        setFeedback('Each multi-city leg needs origin and destination.');
        return;
      }
      multiCityLegs.forEach((leg, index) => {
        upsertFlight({
          ...createFlight(activeVaultTrip.currency),
          departureAirport: extractAirportToken(leg.origin),
          arrivalAirport: extractAirportToken(leg.destination),
          departureDate: leg.date,
          arrivalDate: leg.date,
          cabin: planCabin,
          notes: `Multi-city leg ${index + 1}. ${buildSearchNotes()}`,
          airline: 'Planned search',
          flightNumber: `PLAN-MC${index + 1}`,
        });
      });
      setFeedback('Multi-city flight plan saved. Mock/planning only — not a booking.');
      return;
    }
    if (!planOrigin.trim() || !planDestination.trim()) {
      setFeedback('Origin and destination are required for a flight plan.');
      return;
    }
    if (tripType === 'return' && planReturn && planDepart && planReturn < planDepart) {
      setFeedback('Return date cannot be before departure date.');
      return;
    }
    const planned: FlightSegment = {
      ...createFlight(activeVaultTrip.currency),
      departureAirport: extractAirportToken(planOrigin),
      arrivalAirport: extractAirportToken(planDestination),
      departureDate: planDepart,
      arrivalDate: tripType === 'return' ? planReturn || planDepart : planDepart,
      cabin: planCabin,
      notes: `${planOrigin} → ${planDestination}. ${buildSearchNotes()}`,
      airline: 'Planned search',
      flightNumber: 'PLAN',
    };
    upsertFlight(planned);
    setDraft(planned);
    setFeedback('Flight plan saved to this trip. Live fares are not connected — organise booking details when ready.');
  };

  const saveCurrentSearch = () => {
    upsertSavedSearch({
      id: crypto.randomUUID(),
      kind: 'flight',
      label:
        tripType === 'multi-city'
          ? `Multi-city (${multiCityLegs.length} legs)`
          : `${planOrigin || '?'} → ${planDestination || '?'}`,
      query: {
        tripType,
        origin: planOrigin,
        destination: planDestination,
        depart: planDepart,
        returnDate: planReturn,
        adults,
        children,
        infants,
        cabin: planCabin,
        directOnly,
        maxStops,
        preferredAirlines,
        excludedAirlines,
        baggagePref,
        departTimePref,
        arriveTimePref,
        maxDurationHours,
        budget,
        nearbyAirports,
        flexibleDates,
        multiCity: JSON.stringify(multiCityLegs),
      },
      createdAt: new Date().toISOString(),
      alertEnabled: fareAlert,
    });
    setFeedback(fareAlert ? 'Search saved with fare-alert flag (architecture only — no paid alert service).' : 'Search saved.');
  };

  const runProviderSearch = async () => {
    if (tripType !== 'multi-city' && (!planOrigin.trim() || !planDestination.trim() || !planDepart)) {
      setFeedback('Origin, destination, and departure date are required for provider search.');
      return;
    }
    setProviderBusy(true);
    setProviderWarning(null);
    try {
      const result = await searchFlights({
        origin: tripType === 'multi-city' ? multiCityLegs[0]?.origin || planOrigin : planOrigin,
        destination: tripType === 'multi-city' ? multiCityLegs[0]?.destination || planDestination : planDestination,
        departDate: tripType === 'multi-city' ? multiCityLegs[0]?.date || planDepart : planDepart,
        returnDate: tripType === 'return' ? planReturn || undefined : undefined,
        travellers: planTravellers,
        cabin: planCabin.toLowerCase().replace(/\s+/g, '_'),
        currency: activeVaultTrip.currency,
      });
      const filtered = result.offers.filter((offer) => {
        if (directOnly && (offer.stops ?? 0) > 0) return false;
        if ((offer.stops ?? 0) > maxStops) return false;
        if (budget > 0 && offer.fare.amount > budget) return false;
        if (excludedAirlines) {
          const banned = excludedAirlines.split(',').map((entry) => entry.trim().toLowerCase()).filter(Boolean);
          if (banned.some((airline) => offer.airline.toLowerCase().includes(airline))) return false;
        }
        return true;
      });
      setProviderOffers(filtered);
      setProviderWarning(
        [
          result.warnings[0],
          'Mock provider results — not live inventory.',
          fareAlert ? 'Fare alerts are architectural only until a notification vendor is connected.' : null,
        ]
          .filter(Boolean)
          .join(' '),
      );
      setFeedback(
        filtered.length
          ? `Provider gateway returned ${filtered.length} mock flight offer(s) (filtered preferences applied).`
          : 'No flight offers matched filters from enabled mock providers.',
      );
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Provider search failed');
    } finally {
      setProviderBusy(false);
    }
  };

  const addOfferToItinerary = (offer: FlightOffer) => {
    if (!canEditTrip) return;
    const segment: FlightSegment = {
      ...createFlight(activeVaultTrip.currency),
      airline: offer.airline,
      flightNumber: offer.flightNumber,
      departureAirport: offer.departure.airport.code ?? offer.departure.airport.name,
      arrivalAirport: offer.arrival.airport.code ?? offer.arrival.airport.name,
      departureDate: offer.departure.at.slice(0, 10),
      departureTime: offer.departure.at.slice(11, 16),
      arrivalDate: offer.arrival.at.slice(0, 10),
      arrivalTime: offer.arrival.at.slice(11, 16),
      cabin: offer.cabin ?? planCabin,
      cost: offer.fare.amount,
      currency: offer.fare.currency,
      bookingReference: '',
      notes: `Selected mock offer from ${offer.providerId}. Not a live booking. Change/cancel status: planned.`,
      statusNotes: 'planned',
    };
    upsertFlight(segment);
    addStop({
      title: `${offer.airline} ${offer.flightNumber}`,
      category: 'travel',
      date: segment.departureDate,
      startTime: segment.departureTime,
      endTime: segment.arrivalTime,
      location: `${segment.departureAirport} → ${segment.arrivalAirport}`,
      cost: segment.cost,
      currency: segment.currency,
      notes: segment.notes,
      supplierDetails: offer.providerId,
    });
    setFeedback('Mock offer saved to flights + itinerary with booking-reference placeholder.');
  };

  return (
    <Panel
      title="Flights"
      description="Plan and organise flight requirements with live location suggestions and calendar dates. Availability label: Planning and recommendation tool — live inventory is not connected."
    >
      {feedback ? <StatusBanner kind="info" message={feedback} /> : null}
      <div className="rounded-2xl border border-sky-300/20 bg-sky-500/5 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="font-medium text-white">Flight search plan</h4>
          <StatusBadge label="Planning and recommendation tool" tone="info" />
        </div>
        <p className="mt-1 text-sm text-slate-300">
          Autocomplete airports as you type. Choose dates from the calendar. Save the plan to your trip — this does not book tickets.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <Field label="Trip type" htmlFor="flight-trip-type">
            <select
              id="flight-trip-type"
              className={inputClassName}
              value={tripType}
              onChange={(e) => setTripType(e.target.value as typeof tripType)}
            >
              <option value="one-way">One-way</option>
              <option value="return">Return</option>
              <option value="multi-city">Multi-city</option>
            </select>
          </Field>
          <Field label="Adults" htmlFor="flight-adults">
            <input id="flight-adults" type="number" min={1} className={inputClassName} value={adults} onChange={(e) => setAdults(Math.max(1, Number(e.target.value) || 1))} />
          </Field>
          <Field label="Children" htmlFor="flight-children">
            <input id="flight-children" type="number" min={0} className={inputClassName} value={children} onChange={(e) => setChildren(Math.max(0, Number(e.target.value) || 0))} />
          </Field>
          <Field label="Infants" htmlFor="flight-infants">
            <input id="flight-infants" type="number" min={0} className={inputClassName} value={infants} onChange={(e) => setInfants(Math.max(0, Number(e.target.value) || 0))} />
          </Field>
          <Field label="Cabin class" htmlFor="flight-plan-cabin">
            <select id="flight-plan-cabin" className={inputClassName} value={planCabin} onChange={(e) => setPlanCabin(e.target.value)}>
              {['Economy', 'Premium economy', 'Business', 'First'].map((cabin) => (
                <option key={cabin} value={cabin}>{cabin}</option>
              ))}
            </select>
          </Field>
          <Field label="Max stops" htmlFor="flight-max-stops">
            <input id="flight-max-stops" type="number" min={0} max={3} className={inputClassName} value={maxStops} onChange={(e) => setMaxStops(Math.max(0, Number(e.target.value) || 0))} />
          </Field>
          {tripType !== 'multi-city' ? (
            <>
              <Field label="Origin" htmlFor="flight-plan-origin">
                <LocationAutocomplete id="flight-plan-origin" mode="flight" value={planOrigin} placeholder="City or airport (e.g. Sydney, SYD)" onChange={setPlanOrigin} />
              </Field>
              <Field label="Destination" htmlFor="flight-plan-destination">
                <LocationAutocomplete id="flight-plan-destination" mode="flight" value={planDestination} placeholder="City or airport (e.g. Tokyo, NRT)" onChange={setPlanDestination} />
              </Field>
              <Field label="Departure date" htmlFor="flight-plan-depart">
                <DatePickerField
                  id="flight-plan-depart"
                  value={planDepart}
                  min={todayIso()}
                  onChange={(next) => {
                    setPlanDepart(next);
                    if (planReturn && next && planReturn < next) setPlanReturn(next);
                  }}
                />
              </Field>
              {tripType === 'return' ? (
                <Field label="Return date" htmlFor="flight-plan-return">
                  <DatePickerField id="flight-plan-return" value={planReturn} min={planDepart || todayIso()} onChange={setPlanReturn} />
                </Field>
              ) : null}
            </>
          ) : (
            multiCityLegs.map((leg, index) => (
              <div key={`leg-${index}`} className="xl:col-span-3 grid gap-3 md:grid-cols-3 rounded-xl border border-white/10 p-3">
                <Field label={`Leg ${index + 1} origin`} htmlFor={`mc-origin-${index}`}>
                  <LocationAutocomplete id={`mc-origin-${index}`} mode="flight" value={leg.origin} onChange={(value) => setMultiCityLegs((current) => current.map((entry, i) => (i === index ? { ...entry, origin: value } : entry)))} />
                </Field>
                <Field label={`Leg ${index + 1} destination`} htmlFor={`mc-dest-${index}`}>
                  <LocationAutocomplete id={`mc-dest-${index}`} mode="flight" value={leg.destination} onChange={(value) => setMultiCityLegs((current) => current.map((entry, i) => (i === index ? { ...entry, destination: value } : entry)))} />
                </Field>
                <Field label={`Leg ${index + 1} date`} htmlFor={`mc-date-${index}`}>
                  <DatePickerField id={`mc-date-${index}`} value={leg.date} min={todayIso()} onChange={(value) => setMultiCityLegs((current) => current.map((entry, i) => (i === index ? { ...entry, date: value } : entry)))} />
                </Field>
              </div>
            ))
          )}
          <Field label="Preferred airlines" htmlFor="flight-preferred">
            <input id="flight-preferred" className={inputClassName} value={preferredAirlines} onChange={(e) => setPreferredAirlines(e.target.value)} placeholder="QF, VA" />
          </Field>
          <Field label="Excluded airlines" htmlFor="flight-excluded">
            <input id="flight-excluded" className={inputClassName} value={excludedAirlines} onChange={(e) => setExcludedAirlines(e.target.value)} />
          </Field>
          <Field label="Baggage preference" htmlFor="flight-baggage">
            <input id="flight-baggage" className={inputClassName} value={baggagePref} onChange={(e) => setBaggagePref(e.target.value)} />
          </Field>
          <Field label="Departure time preference" htmlFor="flight-dep-pref">
            <select id="flight-dep-pref" className={inputClassName} value={departTimePref} onChange={(e) => setDepartTimePref(e.target.value)}>
              <option value="any">Any</option>
              <option value="morning">Morning</option>
              <option value="afternoon">Afternoon</option>
              <option value="evening">Evening</option>
            </select>
          </Field>
          <Field label="Arrival time preference" htmlFor="flight-arr-pref">
            <select id="flight-arr-pref" className={inputClassName} value={arriveTimePref} onChange={(e) => setArriveTimePref(e.target.value)}>
              <option value="any">Any</option>
              <option value="morning">Morning</option>
              <option value="afternoon">Afternoon</option>
              <option value="evening">Evening</option>
            </select>
          </Field>
          <Field label="Max journey duration (hours)" htmlFor="flight-max-duration">
            <input id="flight-max-duration" type="number" min={1} className={inputClassName} value={maxDurationHours} onChange={(e) => setMaxDurationHours(Math.max(1, Number(e.target.value) || 1))} />
          </Field>
          <Field label="Budget" htmlFor="flight-budget">
            <input id="flight-budget" type="number" min={0} className={inputClassName} value={budget} onChange={(e) => setBudget(Math.max(0, Number(e.target.value) || 0))} />
          </Field>
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-200">
          <label className="flex items-center gap-2"><input type="checkbox" checked={directOnly} onChange={(e) => setDirectOnly(e.target.checked)} /> Direct flights</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={flexibleDates} onChange={(e) => setFlexibleDates(e.target.checked)} /> Flexible dates</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={nearbyAirports} onChange={(e) => setNearbyAirports(e.target.checked)} /> Nearby airports</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={fareAlert} onChange={(e) => setFareAlert(e.target.checked)} /> Fare alert (architecture)</label>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <PrimaryButton type="button" disabled={providerBusy} onClick={() => void runProviderSearch()}>
            {providerBusy ? 'Searching providers…' : 'Search via provider gateway'}
          </PrimaryButton>
          <SecondaryButton type="button" disabled={!canEditTrip} onClick={saveFlightPlan}>
            Save flight plan to trip
          </SecondaryButton>
          <SecondaryButton type="button" disabled={!canEditTrip} onClick={saveCurrentSearch}>
            Save search
          </SecondaryButton>
          {tripType === 'multi-city' ? (
            <SecondaryButton type="button" onClick={() => setMultiCityLegs((current) => [...current, { origin: '', destination: '', date: '' }])}>
              Add leg
            </SecondaryButton>
          ) : null}
        </div>
        {savedFlightSearches.length > 0 ? (
          <ul className="mt-3 space-y-1 text-xs text-slate-300">
            {savedFlightSearches.map((search) => (
              <li key={search.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 px-2 py-1">
                <span>
                  {search.label} {search.alertEnabled ? '· alert on' : ''}
                </span>
                <SecondaryButton type="button" onClick={() => deleteSavedSearch(search.id)}>
                  Remove
                </SecondaryButton>
              </li>
            ))}
          </ul>
        ) : null}
        {providerWarning ? <p className="mt-3 text-xs text-amber-200">{providerWarning}</p> : null}
        {providerOffers.length > 0 ? (
          <ul className="mt-3 space-y-2" aria-label="Flight provider offers">
            {providerOffers.map((offer) => (
              <li key={offer.id} className="rounded-xl border border-white/10 bg-slate-950/50 px-3 py-2 text-sm text-slate-200">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-medium text-white">
                      {offer.airline} {offer.flightNumber}
                    </span>
                    {' · '}
                    {offer.departure.airport.code ?? offer.departure.airport.name} →{' '}
                    {offer.arrival.airport.code ?? offer.arrival.airport.name}
                    {' · '}
                    {offer.fare.currency} {offer.fare.amount}
                    {' · '}
                    <StatusBadge label={`${offer.providerId} · mock`} tone="warning" />
                  </div>
                  <div className="flex gap-2">
                    <SecondaryButton
                      type="button"
                      onClick={() =>
                        setCompareIds((current) =>
                          current.includes(offer.id) ? current.filter((id) => id !== offer.id) : [...current, offer.id].slice(0, 4),
                        )
                      }
                    >
                      {compareIds.includes(offer.id) ? 'In compare' : 'Compare'}
                    </SecondaryButton>
                    <PrimaryButton type="button" disabled={!canEditTrip} onClick={() => addOfferToItinerary(offer)}>
                      Select mock offer
                    </PrimaryButton>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
        {compareIds.length > 1 ? (
          <p className="mt-2 text-xs text-sky-200">
            Comparing {compareIds.length} mock offers: {providerOffers.filter((offer) => compareIds.includes(offer.id)).map((offer) => `${offer.airline} ${offer.flightNumber} (${offer.fare.amount})`).join(' vs ')}
          </p>
        ) : null}
      </div>

      <h4 className="mt-6 text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">Confirmed / tracked segments</h4>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <Field label="Airline" htmlFor="flight-airline">
          <input id="flight-airline" className={inputClassName} value={draft.airline} onChange={(e) => setDraft({ ...draft, airline: e.target.value })} />
        </Field>
        <Field label="Flight number" htmlFor="flight-number">
          <input id="flight-number" className={inputClassName} value={draft.flightNumber} onChange={(e) => setDraft({ ...draft, flightNumber: e.target.value })} />
        </Field>
        <Field label="Booking reference" htmlFor="flight-ref">
          <input id="flight-ref" className={inputClassName} value={draft.bookingReference} onChange={(e) => setDraft({ ...draft, bookingReference: e.target.value })} />
        </Field>
        <Field label="Departure airport" htmlFor="flight-dep-airport">
          <LocationAutocomplete
            id="flight-dep-airport"
            mode="flight"
            value={draft.departureAirport}
            onChange={(value) => setDraft({ ...draft, departureAirport: value.toUpperCase() })}
          />
        </Field>
        <Field label="Arrival airport" htmlFor="flight-arr-airport">
          <LocationAutocomplete
            id="flight-arr-airport"
            mode="flight"
            value={draft.arrivalAirport}
            onChange={(value) => setDraft({ ...draft, arrivalAirport: value.toUpperCase() })}
          />
        </Field>
        <Field label="Layover (minutes)" htmlFor="flight-layover">
          <input id="flight-layover" type="number" min={0} className={inputClassName} value={draft.layoverMinutes} onChange={(e) => setDraft({ ...draft, layoverMinutes: Number(e.target.value) })} />
        </Field>
        <Field label="Departure terminal" htmlFor="flight-dep-term">
          <input id="flight-dep-term" className={inputClassName} value={draft.departureTerminal} onChange={(e) => setDraft({ ...draft, departureTerminal: e.target.value })} />
        </Field>
        <Field label="Arrival terminal" htmlFor="flight-arr-term">
          <input id="flight-arr-term" className={inputClassName} value={draft.arrivalTerminal} onChange={(e) => setDraft({ ...draft, arrivalTerminal: e.target.value })} />
        </Field>
        <Field label="Departure gate" htmlFor="flight-dep-gate">
          <input id="flight-dep-gate" className={inputClassName} value={draft.departureGate} onChange={(e) => setDraft({ ...draft, departureGate: e.target.value })} />
        </Field>
        <Field label="Arrival gate" htmlFor="flight-arr-gate">
          <input id="flight-arr-gate" className={inputClassName} value={draft.arrivalGate} onChange={(e) => setDraft({ ...draft, arrivalGate: e.target.value })} />
        </Field>
        <Field label="Departure date" htmlFor="flight-dep-date">
          <DatePickerField
            id="flight-dep-date"
            value={draft.departureDate}
            min={todayIso()}
            onChange={(next) => {
              setDraft((current) => ({
                ...current,
                departureDate: next,
                arrivalDate: current.arrivalDate && next && current.arrivalDate < next ? next : current.arrivalDate,
              }));
            }}
          />
        </Field>
        <Field label="Departure time" htmlFor="flight-dep-time">
          <input id="flight-dep-time" type="time" className={inputClassName} value={draft.departureTime} onChange={(e) => setDraft({ ...draft, departureTime: e.target.value })} />
        </Field>
        <Field label="Arrival date" htmlFor="flight-arr-date">
          <DatePickerField
            id="flight-arr-date"
            value={draft.arrivalDate}
            min={draft.departureDate || todayIso()}
            onChange={(next) => setDraft({ ...draft, arrivalDate: next })}
          />
        </Field>
        <Field label="Arrival time" htmlFor="flight-arr-time">
          <input id="flight-arr-time" type="time" className={inputClassName} value={draft.arrivalTime} onChange={(e) => setDraft({ ...draft, arrivalTime: e.target.value })} />
        </Field>
        <Field label="Cabin" htmlFor="flight-cabin">
          <input id="flight-cabin" className={inputClassName} value={draft.cabin} onChange={(e) => setDraft({ ...draft, cabin: e.target.value })} />
        </Field>
        <Field label="Seat" htmlFor="flight-seat">
          <input id="flight-seat" className={inputClassName} value={draft.seat} onChange={(e) => setDraft({ ...draft, seat: e.target.value })} />
        </Field>
        <Field label="Baggage allowance" htmlFor="flight-baggage">
          <input id="flight-baggage" className={inputClassName} value={draft.baggageAllowance} onChange={(e) => setDraft({ ...draft, baggageAllowance: e.target.value })} />
        </Field>
        <Field label="Check-in status" htmlFor="flight-checkin">
          <select
            id="flight-checkin"
            className={inputClassName}
            value={draft.checkInStatus}
            onChange={(e) => setDraft({ ...draft, checkInStatus: e.target.value as FlightCheckInStatus })}
          >
            {FLIGHT_CHECK_IN_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Cost" htmlFor="flight-cost">
          <input id="flight-cost" type="number" min={0} className={inputClassName} value={draft.cost} onChange={(e) => setDraft({ ...draft, cost: Number(e.target.value) })} />
        </Field>
        <Field label="Currency" htmlFor="flight-currency">
          <input id="flight-currency" className={inputClassName} value={draft.currency} onChange={(e) => setDraft({ ...draft, currency: e.target.value.toUpperCase() })} />
        </Field>
        <div className="md:col-span-2 xl:col-span-3">
          <Field label="Status notes" htmlFor="flight-status-notes">
            <textarea id="flight-status-notes" rows={2} className={inputClassName} value={draft.statusNotes} onChange={(e) => setDraft({ ...draft, statusNotes: e.target.value })} />
          </Field>
        </div>
        <div className="md:col-span-2 xl:col-span-3">
          <Field label="Notes" htmlFor="flight-notes">
            <textarea id="flight-notes" rows={2} className={inputClassName} value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
          </Field>
        </div>
        {travellers.length > 0 ? (
          <div className="md:col-span-2 xl:col-span-3">
            <p className="mb-2 text-sm font-medium text-slate-100">Travellers</p>
            <div className="flex flex-wrap gap-3">
              {travellers.map((traveller) => (
                <label key={traveller.id} className="flex items-center gap-2 text-sm text-slate-200">
                  <input type="checkbox" checked={draft.travellerIds.includes(traveller.id)} onChange={() => toggleTraveller(traveller.id)} />
                  {traveller.name || 'Unnamed'}
                </label>
              ))}
            </div>
          </div>
        ) : null}
      </div>
      <div className="mt-3 flex gap-2">
        <PrimaryButton type="button" disabled={!canEditTrip} onClick={handleSave}>
          Save flight
        </PrimaryButton>
        <SecondaryButton type="button" onClick={() => setDraft(createFlight(activeVaultTrip.currency))}>
          Reset form
        </SecondaryButton>
      </div>

      <div className="mt-6 space-y-3">
        {flights.length === 0 ? (
          <EmptyState title="No flights yet" body="Add segments with airports, gates, and check-in status for your itinerary." />
        ) : (
          flights.map((flight) => (
            <article key={flight.id} className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-white">
                    {flight.airline || 'Airline'} {flight.flightNumber}
                  </p>
                  <p className="mt-1 text-sm text-slate-300">
                    {flight.departureAirport || '—'} → {flight.arrivalAirport || '—'}
                    {flight.bookingReference ? ` · Ref ${flight.bookingReference}` : ''}
                  </p>
                  <p className="mt-1 text-sm text-slate-400">
                    {flight.departureDate} {flight.departureTime} → {flight.arrivalDate} {flight.arrivalTime}
                    {flight.layoverMinutes > 0 ? ` · Layover ${flight.layoverMinutes}m` : ''}
                  </p>
                  <p className="mt-1 text-sm text-slate-400">
                    T{flight.departureTerminal || '—'}/G{flight.departureGate || '—'} → T{flight.arrivalTerminal || '—'}/G{flight.arrivalGate || '—'}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <StatusBadge label={flight.checkInStatus} tone="info" />
                    {flight.baggageAllowance ? <StatusBadge label={flight.baggageAllowance} tone="neutral" /> : null}
                  </div>
                  {flight.statusNotes ? <p className="mt-2 text-sm text-slate-300">{flight.statusNotes}</p> : null}
                </div>
                <div className="flex gap-2">
                  <SecondaryButton type="button" onClick={() => setDraft(flight)}>
                    Edit
                  </SecondaryButton>
                  <SecondaryButton type="button" disabled={!canEditTrip} onClick={() => deleteFlight(flight.id)}>
                    Delete
                  </SecondaryButton>
                </div>
              </div>
            </article>
          ))
        )}
      </div>
    </Panel>
  );
}
