import { useState } from 'react';
import { searchHotels, type HotelOffer } from '../../providers';
import { useSharedTripStore } from '../../store/TripStoreContext';
import {
  PAYMENT_STATUSES,
  STAY_TYPES,
  type AccommodationStay,
  type PaymentStatus,
  type StayType,
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

const createStay = (currency: string): AccommodationStay => ({
  id: crypto.randomUUID(),
  type: 'hotel',
  name: '',
  address: '',
  contactPhone: '',
  contactEmail: '',
  checkInDate: '',
  checkInTime: '',
  checkOutDate: '',
  checkOutTime: '',
  roomInfo: '',
  confirmationNumber: '',
  cost: 0,
  currency,
  paymentStatus: 'unpaid',
  amenities: '',
  notes: '',
  itineraryStopId: null,
  travellerIds: [],
});

export function StaysPanel() {
  const {
    activeVaultTrip,
    upsertStay,
    deleteStay,
    canEditTrip,
    upsertSavedSearch,
    addStop,
  } = useSharedTripStore();
  const stays = activeVaultTrip.stays ?? [];
  const travellers = activeVaultTrip.travellers ?? [];
  const [draft, setDraft] = useState<AccommodationStay>(createStay(activeVaultTrip.currency));
  const [feedback, setFeedback] = useState<string | null>(null);
  const [planDestination, setPlanDestination] = useState(activeVaultTrip.destination || '');
  const [planCheckIn, setPlanCheckIn] = useState('');
  const [planCheckOut, setPlanCheckOut] = useState('');
  const [planGuests, setPlanGuests] = useState(Math.max(1, activeVaultTrip.travellerCount || 1));
  const [planRooms, setPlanRooms] = useState(1);
  const [planPrefs, setPlanPrefs] = useState('');
  const [propertyType, setPropertyType] = useState('hotel');
  const [starRating, setStarRating] = useState(0);
  const [guestRating, setGuestRating] = useState(0);
  const [amenitiesFilter, setAmenitiesFilter] = useState('');
  const [accessibilityNeeds, setAccessibilityNeeds] = useState('');
  const [mealPlan, setMealPlan] = useState('room-only');
  const [cancellationFlex, setCancellationFlex] = useState('flexible');
  const [neighbourhood, setNeighbourhood] = useState('');
  const [distancePref, setDistancePref] = useState('');
  const [budgetNightly, setBudgetNightly] = useState(0);
  const [shortlist, setShortlist] = useState<string[]>([]);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [providerOffers, setProviderOffers] = useState<HotelOffer[]>([]);
  const [providerBusy, setProviderBusy] = useState(false);
  const [providerWarning, setProviderWarning] = useState<string | null>(null);

  const toggleTraveller = (travellerId: string) => {
    setDraft((current) => ({
      ...current,
      travellerIds: current.travellerIds.includes(travellerId)
        ? current.travellerIds.filter((id) => id !== travellerId)
        : [...current.travellerIds, travellerId],
    }));
  };

  const handleSave = () => {
    if (!draft.name.trim()) {
      setFeedback('Accommodation name is required.');
      return;
    }
    upsertStay({
      ...draft,
      itineraryStopId: draft.itineraryStopId?.trim() || null,
    });
    setDraft(createStay(activeVaultTrip.currency));
    setFeedback('Stay saved.');
  };

  const nights =
    planCheckIn && planCheckOut
      ? Math.max(
          1,
          Math.round(
            (new Date(`${planCheckOut}T00:00:00`).getTime() - new Date(`${planCheckIn}T00:00:00`).getTime()) /
              (24 * 60 * 60 * 1000),
          ),
        )
      : 1;

  const saveHotelPlan = () => {
    if (!planDestination.trim()) {
      setFeedback('Destination is required for a hotel plan.');
      return;
    }
    if (planCheckOut && planCheckIn && planCheckOut < planCheckIn) {
      setFeedback('Check-out cannot be before check-in.');
      return;
    }
    const planned: AccommodationStay = {
      ...createStay(activeVaultTrip.currency),
      type: (STAY_TYPES.includes(propertyType as StayType) ? propertyType : 'hotel') as StayType,
      name: `Hotel plan · ${planDestination}`,
      address: [planDestination, neighbourhood].filter(Boolean).join(' · '),
      checkInDate: planCheckIn,
      checkOutDate: planCheckOut || planCheckIn,
      roomInfo: `${planRooms} room(s) · ${planGuests} guest(s) · ${mealPlan}`,
      amenities: [planPrefs, amenitiesFilter, accessibilityNeeds].filter(Boolean).join('; '),
      notes: [
        'Hotel search plan — not live inventory.',
        `Stars ≥ ${starRating || 'any'} · guest rating ≥ ${guestRating || 'any'}`,
        `Cancellation: ${cancellationFlex}`,
        distancePref ? `Distance: ${distancePref}` : null,
        budgetNightly > 0 ? `Nightly budget ${budgetNightly} ${activeVaultTrip.currency}` : null,
      ]
        .filter(Boolean)
        .join(' · '),
      paymentStatus: 'unpaid',
    };
    upsertStay(planned);
    setDraft(planned);
    upsertSavedSearch({
      id: crypto.randomUUID(),
      kind: 'hotel',
      label: planDestination,
      query: {
        destination: planDestination,
        checkIn: planCheckIn,
        checkOut: planCheckOut,
        guests: planGuests,
        rooms: planRooms,
        propertyType,
        starRating,
        guestRating,
        amenitiesFilter,
        mealPlan,
        cancellationFlex,
        budgetNightly,
      },
      createdAt: new Date().toISOString(),
      alertEnabled: false,
    });
    setFeedback('Hotel plan saved to this trip. Saved search stored. Live availability is not connected.');
  };

  const runProviderSearch = async () => {
    if (!planDestination.trim() || !planCheckIn || !planCheckOut) {
      setFeedback('Destination, check-in, and check-out are required for provider search.');
      return;
    }
    setProviderBusy(true);
    setProviderWarning(null);
    try {
      const result = await searchHotels({
        destination: planDestination,
        checkIn: planCheckIn,
        checkOut: planCheckOut,
        guests: planGuests,
        rooms: planRooms,
        preferences: [planPrefs, amenitiesFilter, accessibilityNeeds, mealPlan, cancellationFlex]
          .filter(Boolean)
          .join('; '),
        currency: activeVaultTrip.currency,
      });
      const filtered = result.offers.filter((offer) => {
        if (budgetNightly > 0 && offer.nightlyRate.amount > budgetNightly) return false;
        if (starRating > 0 && (offer.rating ?? 0) < starRating) return false;
        if (guestRating > 0 && (offer.rating ?? 0) < guestRating) return false;
        return true;
      });
      setProviderOffers(filtered);
      setProviderWarning(
        [result.warnings[0], 'Mock hotel results — taxes/fees shown as provider estimates only, not live inventory.']
          .filter(Boolean)
          .join(' '),
      );
      setFeedback(
        filtered.length
          ? `Provider gateway returned ${filtered.length} mock hotel offer(s) (filters applied).`
          : 'No hotel offers matched filters from enabled mock providers.',
      );
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Provider search failed');
    } finally {
      setProviderBusy(false);
    }
  };

  const selectMockStay = (offer: HotelOffer) => {
    if (!canEditTrip) return;
    const stay: AccommodationStay = {
      ...createStay(activeVaultTrip.currency),
      name: offer.property,
      address: offer.location || planDestination,
      checkInDate: planCheckIn,
      checkOutDate: planCheckOut,
      roomInfo: offer.room,
      confirmationNumber: '',
      cost: offer.nightlyRate.amount * nights + (offer.taxes?.amount ?? 0),
      currency: offer.nightlyRate.currency,
      amenities: amenitiesFilter || planPrefs,
      notes: `Selected mock hotel from ${offer.providerId}. Nightly ${offer.nightlyRate.amount}; taxes placeholder ${offer.taxes?.amount ?? 0}. Policy: ${offer.cancellationPolicy}. Cancellation state: planned. Not a live reservation.`,
      paymentStatus: 'unpaid',
    };
    upsertStay(stay);
    addStop({
      title: offer.property,
      category: 'lodging',
      date: planCheckIn,
      location: stay.address,
      cost: stay.cost,
      currency: stay.currency,
      notes: stay.notes,
      supplierDetails: offer.providerId,
    });
    setFeedback('Mock hotel saved to stays + itinerary with booking-reference placeholder.');
  };

  return (
    <Panel
      title="Hotels"
      description="Plan accommodation with destination autocomplete and calendar dates. Availability label: Planning and recommendation tool — live inventory is not connected."
    >
      {feedback ? <StatusBanner kind="info" message={feedback} /> : null}
      <div className="rounded-2xl border border-sky-300/20 bg-sky-500/5 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="font-medium text-white">Hotel search plan</h4>
          <StatusBadge label="Planning and recommendation tool" tone="info" />
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <Field label="Destination" htmlFor="hotel-plan-destination">
            <LocationAutocomplete
              id="hotel-plan-destination"
              mode="place"
              value={planDestination}
              placeholder="City, suburb, landmark…"
              onChange={setPlanDestination}
            />
          </Field>
          <Field label="Guests" htmlFor="hotel-plan-guests">
            <input
              id="hotel-plan-guests"
              type="number"
              min={1}
              className={inputClassName}
              value={planGuests}
              onChange={(e) => setPlanGuests(Math.max(1, Number(e.target.value) || 1))}
            />
          </Field>
          <Field label="Rooms" htmlFor="hotel-plan-rooms">
            <input
              id="hotel-plan-rooms"
              type="number"
              min={1}
              className={inputClassName}
              value={planRooms}
              onChange={(e) => setPlanRooms(Math.max(1, Number(e.target.value) || 1))}
            />
          </Field>
          <Field label="Check-in" htmlFor="hotel-plan-checkin">
            <DatePickerField
              id="hotel-plan-checkin"
              value={planCheckIn}
              min={todayIso()}
              onChange={(next) => {
                setPlanCheckIn(next);
                if (planCheckOut && next && planCheckOut < next) setPlanCheckOut(next);
              }}
            />
          </Field>
          <Field label="Check-out" htmlFor="hotel-plan-checkout">
            <DatePickerField
              id="hotel-plan-checkout"
              value={planCheckOut}
              min={planCheckIn || todayIso()}
              onChange={setPlanCheckOut}
            />
          </Field>
          <Field label="Preferences" htmlFor="hotel-plan-prefs">
            <input
              id="hotel-plan-prefs"
              className={inputClassName}
              value={planPrefs}
              placeholder="Near transit, breakfast, family room…"
              onChange={(e) => setPlanPrefs(e.target.value)}
            />
          </Field>
          <Field label="Property type" htmlFor="hotel-property-type">
            <select id="hotel-property-type" className={inputClassName} value={propertyType} onChange={(e) => setPropertyType(e.target.value)}>
              {STAY_TYPES.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </Field>
          <Field label="Min star rating" htmlFor="hotel-stars">
            <input id="hotel-stars" type="number" min={0} max={5} className={inputClassName} value={starRating} onChange={(e) => setStarRating(Math.max(0, Number(e.target.value) || 0))} />
          </Field>
          <Field label="Min guest rating" htmlFor="hotel-guest-rating">
            <input id="hotel-guest-rating" type="number" min={0} max={10} step="0.1" className={inputClassName} value={guestRating} onChange={(e) => setGuestRating(Math.max(0, Number(e.target.value) || 0))} />
          </Field>
          <Field label="Amenities" htmlFor="hotel-amenities">
            <input id="hotel-amenities" className={inputClassName} value={amenitiesFilter} onChange={(e) => setAmenitiesFilter(e.target.value)} placeholder="wifi, pool, parking" />
          </Field>
          <Field label="Accessibility" htmlFor="hotel-access">
            <input id="hotel-access" className={inputClassName} value={accessibilityNeeds} onChange={(e) => setAccessibilityNeeds(e.target.value)} />
          </Field>
          <Field label="Meal plan" htmlFor="hotel-meal">
            <select id="hotel-meal" className={inputClassName} value={mealPlan} onChange={(e) => setMealPlan(e.target.value)}>
              <option value="room-only">Room only</option>
              <option value="breakfast">Breakfast</option>
              <option value="half-board">Half board</option>
              <option value="full-board">Full board</option>
            </select>
          </Field>
          <Field label="Cancellation flexibility" htmlFor="hotel-cancel">
            <select id="hotel-cancel" className={inputClassName} value={cancellationFlex} onChange={(e) => setCancellationFlex(e.target.value)}>
              <option value="flexible">Flexible</option>
              <option value="moderate">Moderate</option>
              <option value="strict">Strict</option>
            </select>
          </Field>
          <Field label="Neighbourhood" htmlFor="hotel-neighbourhood">
            <input id="hotel-neighbourhood" className={inputClassName} value={neighbourhood} onChange={(e) => setNeighbourhood(e.target.value)} />
          </Field>
          <Field label="Distance preference" htmlFor="hotel-distance">
            <input id="hotel-distance" className={inputClassName} value={distancePref} onChange={(e) => setDistancePref(e.target.value)} placeholder="Walk to centre / near beach" />
          </Field>
          <Field label="Nightly budget" htmlFor="hotel-budget">
            <input id="hotel-budget" type="number" min={0} className={inputClassName} value={budgetNightly} onChange={(e) => setBudgetNightly(Math.max(0, Number(e.target.value) || 0))} />
          </Field>
        </div>
        <p className="mt-2 text-xs text-slate-400">
          Estimated stay length: {nights} night(s)
          {budgetNightly > 0 ? ` · total budget ≈ ${(budgetNightly * nights).toFixed(2)} ${activeVaultTrip.currency} (excl. live taxes/fees)` : ''}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <PrimaryButton type="button" disabled={providerBusy} onClick={() => void runProviderSearch()}>
            {providerBusy ? 'Searching providers…' : 'Search via provider gateway'}
          </PrimaryButton>
          <SecondaryButton type="button" disabled={!canEditTrip} onClick={saveHotelPlan}>
            Save hotel plan to trip
          </SecondaryButton>
        </div>
        {providerWarning ? <p className="mt-3 text-xs text-amber-200">{providerWarning}</p> : null}
        {providerOffers.length > 0 ? (
          <ul className="mt-3 space-y-2" aria-label="Hotel provider offers">
            {providerOffers.map((offer) => {
              const total = offer.nightlyRate.amount * nights;
              return (
                <li key={offer.id} className="rounded-xl border border-white/10 bg-slate-950/50 px-3 py-2 text-sm text-slate-200">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="font-medium text-white">{offer.property}</span>
                      {' · '}
                      {offer.room}
                      {' · '}
                      {offer.nightlyRate.currency} {offer.nightlyRate.amount}/night
                      {' · total '}
                      {offer.nightlyRate.currency} {total.toFixed(2)}
                      {' · '}
                      <StatusBadge label={`${offer.providerId} · mock`} tone="warning" />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <SecondaryButton
                        type="button"
                        onClick={() =>
                          setShortlist((current) =>
                            current.includes(offer.id) ? current.filter((id) => id !== offer.id) : [...current, offer.id],
                          )
                        }
                      >
                        {shortlist.includes(offer.id) ? 'Shortlisted' : 'Shortlist'}
                      </SecondaryButton>
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
                      <PrimaryButton type="button" disabled={!canEditTrip} onClick={() => selectMockStay(offer)}>
                        Mock reservation
                      </PrimaryButton>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : null}
        {compareIds.length > 1 ? (
          <p className="mt-2 text-xs text-sky-200">
            Room compare: {providerOffers.filter((offer) => compareIds.includes(offer.id)).map((offer) => `${offer.property} (${offer.nightlyRate.amount}/night)`).join(' vs ')}
          </p>
        ) : null}
      </div>

      <h4 className="mt-6 text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">Tracked stays</h4>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <Field label="Name" htmlFor="stay-name">
          <input id="stay-name" className={inputClassName} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        </Field>
        <Field label="Type" htmlFor="stay-type">
          <select id="stay-type" className={inputClassName} value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as StayType })}>
            {STAY_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Payment status" htmlFor="stay-payment">
          <select
            id="stay-payment"
            className={inputClassName}
            value={draft.paymentStatus}
            onChange={(e) => setDraft({ ...draft, paymentStatus: e.target.value as PaymentStatus })}
          >
            {PAYMENT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Check-in date" htmlFor="stay-checkin-date">
          <DatePickerField
            id="stay-checkin-date"
            value={draft.checkInDate}
            min={todayIso()}
            onChange={(next) =>
              setDraft((current) => ({
                ...current,
                checkInDate: next,
                checkOutDate:
                  current.checkOutDate && next && current.checkOutDate < next ? next : current.checkOutDate,
              }))
            }
          />
        </Field>
        <Field label="Check-in time" htmlFor="stay-checkin-time">
          <input id="stay-checkin-time" type="time" className={inputClassName} value={draft.checkInTime} onChange={(e) => setDraft({ ...draft, checkInTime: e.target.value })} />
        </Field>
        <Field label="Check-out date" htmlFor="stay-checkout-date">
          <DatePickerField
            id="stay-checkout-date"
            value={draft.checkOutDate}
            min={draft.checkInDate || todayIso()}
            onChange={(next) => setDraft({ ...draft, checkOutDate: next })}
          />
        </Field>
        <Field label="Check-out time" htmlFor="stay-checkout-time">
          <input id="stay-checkout-time" type="time" className={inputClassName} value={draft.checkOutTime} onChange={(e) => setDraft({ ...draft, checkOutTime: e.target.value })} />
        </Field>
        <div className="md:col-span-2 xl:col-span-3">
          <Field label="Address / area" htmlFor="stay-address">
            <LocationAutocomplete
              id="stay-address"
              mode="place"
              value={draft.address}
              onChange={(value) => setDraft({ ...draft, address: value })}
            />
          </Field>
        </div>
        <Field label="Contact phone" htmlFor="stay-phone">
          <input id="stay-phone" className={inputClassName} value={draft.contactPhone} onChange={(e) => setDraft({ ...draft, contactPhone: e.target.value })} />
        </Field>
        <Field label="Contact email" htmlFor="stay-email">
          <input id="stay-email" type="email" className={inputClassName} value={draft.contactEmail} onChange={(e) => setDraft({ ...draft, contactEmail: e.target.value })} />
        </Field>
        <Field label="Room info" htmlFor="stay-room">
          <input id="stay-room" className={inputClassName} value={draft.roomInfo} onChange={(e) => setDraft({ ...draft, roomInfo: e.target.value })} />
        </Field>
        <Field label="Confirmation number" htmlFor="stay-confirmation">
          <input id="stay-confirmation" className={inputClassName} value={draft.confirmationNumber} onChange={(e) => setDraft({ ...draft, confirmationNumber: e.target.value })} />
        </Field>
        <Field label="Cost" htmlFor="stay-cost">
          <input id="stay-cost" type="number" min={0} className={inputClassName} value={draft.cost} onChange={(e) => setDraft({ ...draft, cost: Number(e.target.value) })} />
        </Field>
        <Field label="Currency" htmlFor="stay-currency">
          <input id="stay-currency" className={inputClassName} value={draft.currency} onChange={(e) => setDraft({ ...draft, currency: e.target.value.toUpperCase() })} />
        </Field>
        <Field label="Itinerary stop ID (optional)" htmlFor="stay-stop-id">
          <input
            id="stay-stop-id"
            className={inputClassName}
            value={draft.itineraryStopId ?? ''}
            onChange={(e) => setDraft({ ...draft, itineraryStopId: e.target.value || null })}
          />
        </Field>
        <div className="md:col-span-2 xl:col-span-3">
          <Field label="Amenities" htmlFor="stay-amenities">
            <textarea id="stay-amenities" rows={2} className={inputClassName} value={draft.amenities} onChange={(e) => setDraft({ ...draft, amenities: e.target.value })} />
          </Field>
        </div>
        <div className="md:col-span-2 xl:col-span-3">
          <Field label="Traveller note" htmlFor="stay-notes">
            <textarea id="stay-notes" rows={2} className={inputClassName} value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
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
          Save stay
        </PrimaryButton>
        <SecondaryButton type="button" onClick={() => setDraft(createStay(activeVaultTrip.currency))}>
          Reset form
        </SecondaryButton>
      </div>

      <div className="mt-6 space-y-3">
        {stays.length === 0 ? (
          <EmptyState title="No stays yet" body="Add accommodation with check-in times, confirmation numbers, and payment status." />
        ) : (
          stays.map((stay) => (
            <article key={stay.id} className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-white">{stay.name}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.18em] text-sky-300">
                    {stay.type} · {stay.paymentStatus}
                  </p>
                  <p className="mt-2 text-sm text-slate-300">{stay.address || 'No address'}</p>
                  <p className="mt-1 text-sm text-slate-400">
                    Check-in {stay.checkInDate || '—'} {stay.checkInTime} · Check-out {stay.checkOutDate || '—'} {stay.checkOutTime}
                  </p>
                  <p className="mt-1 text-sm text-slate-400">
                    Conf {stay.confirmationNumber || '—'} · {stay.cost.toFixed(2)} {stay.currency}
                  </p>
                  {stay.itineraryStopId ? (
                    <StatusBadge label={`Stop ${stay.itineraryStopId}`} tone="neutral" />
                  ) : null}
                  {stay.notes ? <p className="mt-2 text-sm text-slate-300">{stay.notes}</p> : null}
                </div>
                <div className="flex gap-2">
                  <SecondaryButton type="button" onClick={() => setDraft(stay)}>
                    Edit
                  </SecondaryButton>
                  <SecondaryButton type="button" disabled={!canEditTrip} onClick={() => deleteStay(stay.id)}>
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
