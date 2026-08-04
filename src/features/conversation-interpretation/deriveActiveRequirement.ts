import type { ConversationCoreState } from '../conversation-core';
import type { ActiveTravelRequirement } from './types';

/**
 * Deterministic active missing-requirement derivation for interpretation context.
 * Mirrors core progression priority without importing reply catalogue wording.
 */
export function deriveActiveTravelRequirement(
  state: ConversationCoreState,
): ActiveTravelRequirement {
  if (state.destination === null) return 'destination';
  if (state.origin === null) return 'origin';
  if (state.departureDate === null) return 'departureDate';
  if (state.returnDate === null) return 'returnDate';

  const passengerRelevant =
    state.flightsRequested === true || state.accommodationRequested === true;
  if (passengerRelevant && state.adultCount === null) return 'adultCount';
  if (
    passengerRelevant &&
    state.adultCount !== null &&
    state.childCount === null
  ) {
    return 'childCount';
  }
  if (
    passengerRelevant &&
    state.adultCount !== null &&
    state.infantCount === null
  ) {
    return 'infantCount';
  }

  if (
    state.flightsRequested === null &&
    state.accommodationRequested === null &&
    state.carHireRequested === null
  ) {
    return 'services';
  }

  return 'none';
}
