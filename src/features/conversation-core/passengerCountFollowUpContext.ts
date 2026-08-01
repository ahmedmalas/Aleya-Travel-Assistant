import type { ConversationCoreState } from './types';

export type PassengerCountField = 'adultCount' | 'childCount' | 'infantCount';

/**
 * Shared passenger follow-up context helpers.
 *
 * Phase 19J: keeps BareNumber (19I) and ExplicitGuest active-question gates
 * aligned with selectConversationFollowUpQuestion passenger priority:
 * flights adult → accommodation guest (adultCount) → child → infant.
 */

export function hasCompleteCoreTravelFields(
  state: ConversationCoreState,
): boolean {
  return (
    state.destination !== null &&
    state.origin !== null &&
    state.departureDate !== null &&
    state.returnDate !== null
  );
}

/** True when the flights adult-count follow-up is the active passenger question. */
export function isFlightsAdultCountFollowUpActive(
  state: ConversationCoreState,
): boolean {
  return (
    hasCompleteCoreTravelFields(state) &&
    state.flightsRequested === true &&
    state.adultCount === null
  );
}

/**
 * True when the accommodation guest-count follow-up is active.
 *
 * Requires accommodationRequested, missing adultCount, complete core fields,
 * and that the flights-adult question is not ahead in priority.
 */
export function isAccommodationGuestCountFollowUpActive(
  state: ConversationCoreState,
): boolean {
  return (
    hasCompleteCoreTravelFields(state) &&
    state.accommodationRequested === true &&
    state.adultCount === null &&
    state.flightsRequested !== true
  );
}

/**
 * Mirrors follow-up passenger priority after core travel fields are complete:
 * flights adult → accommodation guest (adultCount) → child → infant.
 */
export function resolveActivePassengerCountField(
  state: ConversationCoreState,
): PassengerCountField | null {
  if (!hasCompleteCoreTravelFields(state)) {
    return null;
  }

  if (state.flightsRequested === true && state.adultCount === null) {
    return 'adultCount';
  }
  if (state.accommodationRequested === true && state.adultCount === null) {
    return 'adultCount';
  }

  const passengerServiceRelevant =
    state.flightsRequested === true || state.accommodationRequested === true;
  if (
    passengerServiceRelevant &&
    state.adultCount !== null &&
    state.childCount === null
  ) {
    return 'childCount';
  }
  if (
    passengerServiceRelevant &&
    state.adultCount !== null &&
    state.childCount !== null &&
    state.infantCount === null
  ) {
    return 'infantCount';
  }

  return null;
}
