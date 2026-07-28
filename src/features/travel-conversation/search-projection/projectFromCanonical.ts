/**
 * Authoritative canonical-state → live-search projection.
 *
 * Required mapping (direction is invariant — never reversed):
 *   origin          → departure airport
 *   destination     → arrival airport
 *   departureDate   → outbound date
 *   returnDate      → inbound date
 *   services        → provider searches
 *   travellers      → adults only when explicitly stored
 *
 * Missing travellers → product_default of 1 adult (visible rule).
 * Never invent 2 adults.
 */

import { iataForPlace } from '../lexicon';
import type { ConversationState } from '../types';
import type {
  CanonicalSearchProjection,
  SearchFormProjection,
  SearchRequestProjection,
  TravellerCountSource,
} from './types';

const PRODUCT_DEFAULT_ADULTS = 1 as const;

function exactDepartureIso(state: ConversationState): string | undefined {
  const dep = state.departureDate?.value;
  if (!dep || dep.kind !== 'exact') return undefined;
  return dep.isoDate;
}

function returnIso(state: ConversationState): string | undefined {
  return state.returnDate?.value.isoDate;
}

function resolveTravellers(state: ConversationState): {
  adults: number;
  travellerSource: TravellerCountSource;
} {
  const raw = state.travellers?.value;
  if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 1) {
    return {
      adults: Math.floor(raw),
      travellerSource: 'explicit',
    };
  }
  return {
    adults: PRODUCT_DEFAULT_ADULTS,
    travellerSource: 'product_default',
  };
}

/**
 * Sole authority: project canonical travel state into a provider-ready search payload.
 * Callers must not invent origin/destination/dates/travellers outside this function.
 */
export function projectCanonicalSearch(
  state: ConversationState,
): CanonicalSearchProjection {
  const originLabel = state.origin?.value;
  const destinationLabel = state.destination?.value;
  const originCode =
    state.originPlace?.iataCode ??
    state.originPlace?.nearestAirportCodes?.[0] ??
    iataForPlace(originLabel);
  const destinationCode =
    state.destinationPlace?.iataCode ??
    state.destinationPlace?.nearestAirportCodes?.[0] ??
    iataForPlace(destinationLabel);
  const { adults, travellerSource } = resolveTravellers(state);

  // Direction invariant: origin field → departure, destination field → arrival.
  // No swap, no “nearest”, no vault travellerCount, no silent defaults of 2.
  const projection: CanonicalSearchProjection = {
    origin: {
      label: originLabel,
      airportCode: originCode,
    },
    destination: {
      label: destinationLabel,
      airportCode: destinationCode,
    },
    departureDate: exactDepartureIso(state),
    returnDate: returnIso(state),
    services: [...state.services],
    adults,
    travellerSource,
  };

  if (
    projection.travellerSource === 'product_default' &&
    projection.adults !== PRODUCT_DEFAULT_ADULTS
  ) {
    throw new Error('Search projection violated product default traveller rule');
  }
  if (projection.adults === 2 && projection.travellerSource !== 'explicit') {
    throw new Error('Search projection must not fabricate 2 adults');
  }

  return projection;
}

/** UI form fields projected from the same canonical payload. */
export function projectSearchForm(state: ConversationState): SearchFormProjection {
  const p = projectCanonicalSearch(state);
  return {
    originLabel: p.origin.label,
    destinationLabel: p.destination.label,
    originCode: p.origin.airportCode,
    destinationCode: p.destination.airportCode,
    departDate: p.departureDate,
    returnDate: p.returnDate,
    adults: p.adults,
    travellerSource: p.travellerSource,
  };
}

/** Provider request fields projected from the same canonical payload. */
export function projectSearchRequest(state: ConversationState): SearchRequestProjection {
  const p = projectCanonicalSearch(state);
  return {
    origin: p.origin.airportCode ?? p.origin.label,
    destination: p.destination.airportCode ?? p.destination.label,
    departDate: p.departureDate,
    returnDate: p.returnDate,
    services: [...p.services],
    adults: p.adults,
    travellerSource: p.travellerSource,
  };
}
