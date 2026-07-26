import {
  searchActivities,
  searchCarHire,
  searchCruises,
  searchFlights,
  searchHotels,
  searchRail,
  searchTransfers,
} from '../../providers/gateway';
import type { ConversationState, OfferSummary, SearchBundle, TravelServiceKind } from './types';

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function resolveReturnDate(state: ConversationState): string {
  if (state.returnDate?.value.isoDate) return state.returnDate.value.isoDate;
  const dep = state.departureDate?.value.isoDate;
  if (!dep) return '';
  return addDays(dep, state.returnTimePreference ? 2 : 3);
}

/**
 * Orchestrate provider-gateway searches for all routed services.
 */
export async function orchestrateSearch(
  state: ConversationState,
  services: TravelServiceKind[],
  currency = 'AUD',
): Promise<SearchBundle> {
  const bundle: SearchBundle = {
    flights: [],
    hotels: [],
    carHire: [],
    transfers: [],
    activities: [],
    cruises: [],
    rail: [],
    warnings: [],
  };

  const origin = state.origin?.value ?? '';
  const destination = state.destination?.value ?? '';
  const departDate = state.departureDate?.value.isoDate ?? '';
  const returnDate = resolveReturnDate(state);
  const travellers = state.travellers?.value.total ?? 1;

  const tasks: Array<Promise<void>> = [];

  if (services.includes('flights') && origin && destination && departDate) {
    tasks.push(
      searchFlights({
        origin,
        destination,
        departDate,
        returnDate: returnDate || undefined,
        travellers,
        currency,
      }).then((res) => {
        bundle.warnings.push(...res.warnings);
        bundle.flights = res.offers.slice(0, 5).map(
          (offer): OfferSummary => ({
            service: 'flights',
            id: offer.id,
            title: `${offer.airline} ${offer.flightNumber}`,
            detail: `${offer.departure.airport.code ?? origin} → ${offer.arrival.airport.code ?? destination} · ${offer.cabin} · ${offer.stops === 0 ? 'Direct' : `${offer.stops} stop(s)`}`,
            priceLabel: `${offer.fare.amount} ${offer.fare.currency}`,
            providerId: offer.providerId,
            isBookableLive: offer.isBookableLive,
          }),
        );
      }),
    );
  }

  if (services.includes('hotels') && destination && departDate) {
    const checkOut = returnDate || addDays(departDate, 2);
    const location = state.accommodationLocation
      ? `${state.accommodationLocation.value}, ${destination}`
      : destination;
    tasks.push(
      searchHotels({
        destination: location,
        checkIn: departDate,
        checkOut,
        guests: travellers,
        currency,
        preferences: state.accommodationLocation?.value,
      }).then((res) => {
        bundle.warnings.push(...res.warnings);
        bundle.hotels = res.offers.slice(0, 5).map(
          (offer): OfferSummary => ({
            service: 'hotels',
            id: offer.id,
            title: offer.property,
            detail: `${offer.location} · ${offer.room} · ${offer.cancellationPolicy}`,
            priceLabel: `${offer.nightlyRate.amount} ${offer.nightlyRate.currency}/night`,
            providerId: offer.providerId,
            isBookableLive: offer.isBookableLive,
          }),
        );
      }),
    );
  }

  if (services.includes('car_hire') && destination && departDate) {
    const dropoff = returnDate || addDays(departDate, 2);
    tasks.push(
      searchCarHire({
        pickupLocation: destination,
        dropoffLocation: destination,
        pickupDate: departDate,
        dropoffDate: dropoff,
        drivers: 1,
        currency,
      }).then((res) => {
        bundle.warnings.push(...res.warnings);
        bundle.carHire = res.offers.slice(0, 5).map(
          (offer): OfferSummary => ({
            service: 'car_hire',
            id: offer.id,
            title: `${offer.supplier} · ${offer.vehicleClass}`,
            detail: `Pickup ${offer.pickupLocation} · Drop-off ${offer.dropoffLocation}${state.carHireRequirements.includes('align_to_flight_schedule') ? ' · timed to flight schedule' : ''}`,
            priceLabel: `${offer.total.amount} ${offer.total.currency}`,
            providerId: offer.providerId,
            isBookableLive: offer.isBookableLive,
          }),
        );
      }),
    );
  }

  if (services.includes('airport_transfers') && destination && departDate) {
    tasks.push(
      searchTransfers({
        pickup: `${destination} Airport`,
        dropoff: state.accommodationLocation?.value ?? `${destination} city`,
        pickupDate: departDate,
        pickupTime: state.departureTimePreference?.value === 'after_5pm' ? '17:30' : '14:00',
        passengers: travellers,
        currency,
      }).then((res) => {
        bundle.warnings.push(...res.warnings);
        bundle.transfers = res.offers.slice(0, 3).map(
          (offer): OfferSummary => ({
            service: 'airport_transfers',
            id: offer.id,
            title: `${offer.supplier} · ${offer.vehicleType}`,
            detail: `${offer.pickup} → ${offer.dropoff}`,
            priceLabel: `${offer.total.amount} ${offer.total.currency}`,
            providerId: offer.providerId,
            isBookableLive: offer.isBookableLive,
          }),
        );
      }),
    );
  }

  if (services.includes('activities') && destination) {
    tasks.push(
      searchActivities({
        destination,
        startDate: departDate || undefined,
        endDate: returnDate || undefined,
        travellers,
        currency,
      }).then((res) => {
        bundle.warnings.push(...res.warnings);
        bundle.activities = res.offers.slice(0, 5).map(
          (offer): OfferSummary => ({
            service: 'activities',
            id: offer.id,
            title: offer.title,
            detail: `${offer.destination} · ${offer.category} · ${offer.duration}`,
            priceLabel: `${offer.pricing.amount} ${offer.pricing.currency}`,
            providerId: offer.providerId,
            isBookableLive: offer.isBookableLive,
          }),
        );
      }),
    );
  }

  if (services.includes('cruises') && (destination || origin) && departDate) {
    tasks.push(
      searchCruises({
        region: destination || origin,
        departurePort: origin || destination,
        startDate: departDate,
        endDate: returnDate || undefined,
        travellers,
        currency,
      }).then((res) => {
        bundle.warnings.push(...res.warnings);
        bundle.cruises = res.offers.slice(0, 3).map(
          (offer): OfferSummary => ({
            service: 'cruises',
            id: offer.id,
            title: `${offer.line} · ${offer.ship}`,
            detail: `${offer.itineraryName} · ${offer.nights} nights · ${offer.cabinType}`,
            priceLabel: `${offer.fareFrom.amount} ${offer.fareFrom.currency}`,
            providerId: offer.providerId,
            isBookableLive: offer.isBookableLive,
          }),
        );
      }),
    );
  }

  if (services.includes('rail') && origin && destination && departDate) {
    tasks.push(
      searchRail({
        origin,
        destination,
        departDate,
        travellers,
        currency,
      }).then((res) => {
        bundle.warnings.push(...res.warnings);
        bundle.rail = res.offers.slice(0, 3).map(
          (offer): OfferSummary => ({
            service: 'rail',
            id: offer.id,
            title: `${offer.operator} ${offer.trainNumber}`,
            detail: `${offer.origin} → ${offer.destination}`,
            priceLabel: `${offer.fare.amount} ${offer.fare.currency}`,
            providerId: offer.providerId,
            isBookableLive: offer.isBookableLive,
          }),
        );
      }),
    );
  }

  await Promise.all(tasks);
  bundle.warnings = Array.from(new Set(bundle.warnings));
  const total =
    bundle.flights.length +
    bundle.hotels.length +
    bundle.carHire.length +
    bundle.transfers.length +
    bundle.activities.length +
    bundle.cruises.length +
    bundle.rail.length;
  if (total === 0) {
    bundle.warnings.push('No planning offers returned yet — check dates and destinations.');
  } else {
    bundle.warnings.push('Results are planning/mock offers — not live inventory.');
  }

  return bundle;
}
