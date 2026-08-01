import type {
  ConversationCoreState,
  ConversationStateUpdate,
} from './types';

/** Canonical travel fields compared for reply-turn change classification. */
export const TRAVEL_COMPARE_KEYS = [
  'destination',
  'origin',
  'departureDate',
  'returnDate',
  'adultCount',
  'childCount',
  'infantCount',
  'flightsRequested',
  'accommodationRequested',
  'carHireRequested',
  'activitiesRequested',
  'restaurantsRequested',
  'restaurantPreference',
  'nearbyDiscoveryRequested',
  'beachesRequested',
  'campingRequested',
  'kayakingRequested',
  'fourWheelDriveRequested',
  'scenicDrivesRequested',
  'attractionsRequested',
  'snowActivitiesRequested',
  'hikingWalkingRequested',
  'fishingRequested',
  'divingSnorkellingRequested',
  'wineriesFoodTrailsRequested',
  'eventsFestivalsRequested',
  'wildlifeRequested',
  'nationalParksRequested',
  'toursRequested',
  'eventsRequested',
  'nightlifeRequested',
  'shoppingRequested',
  'wellnessRequested',
  'familyActivitiesRequested',
  'accessibleTravelRequested',
] as const satisfies ReadonlyArray<keyof ConversationStateUpdate>;

export type TravelCompareKey = (typeof TRAVEL_COMPARE_KEYS)[number];

const REQUEST_FLAG_KEYS = new Set<TravelCompareKey>([
  'flightsRequested',
  'accommodationRequested',
  'carHireRequested',
  'activitiesRequested',
  'restaurantsRequested',
  'nearbyDiscoveryRequested',
  'beachesRequested',
  'campingRequested',
  'kayakingRequested',
  'fourWheelDriveRequested',
  'scenicDrivesRequested',
  'attractionsRequested',
  'snowActivitiesRequested',
  'hikingWalkingRequested',
  'fishingRequested',
  'divingSnorkellingRequested',
  'wineriesFoodTrailsRequested',
  'eventsFestivalsRequested',
  'wildlifeRequested',
  'nationalParksRequested',
  'toursRequested',
  'eventsRequested',
  'nightlifeRequested',
  'shoppingRequested',
  'wellnessRequested',
  'familyActivitiesRequested',
  'accessibleTravelRequested',
]);

/**
 * Internal deterministic classification of travel-field changes between the
 * pre-turn and final post-precedence ConversationCoreState.
 *
 * Phase 10F — consumed only by the reply boundary. Does not inspect message
 * text, re-extract, or alter state.
 * Phase 11C — newlyDisabledRequestFlags for request flags transitioning
 * exactly true → false.
 * Phase 11E — newlyDisabledRequestFlags also includes null → false (explicit
 * disable from unset), while true → null and false → null remain excluded.
 * Phase 11F — true → null and false → null still classify as updated, but do
 * not contribute to acknowledgement-eligible change, so the generic Perfect.
 * acknowledgement is suppressed when those clears are the only travel-field
 * changes.
 * Phase 11G — hasInterpretedChange is true for any travel-field difference
 * (including interpretation-only request-flag clears to null).
 * Acknowledgement-eligible change remains narrower, so Perfect. stays
 * suppressed when the sole change is interpretation-only.
 * Phase 11H — renames the acknowledgement-eligible flag to
 * hasAcknowledgementEligibleChange.
 */
export type ConversationStateChangeClassification = {
  /** Fields that moved from null to a non-null value (excluding newly-enabled true flags and null → false disables). */
  newlyPopulated: readonly TravelCompareKey[];
  /** Fields that changed between two non-null values, or were cleared / otherwise altered. */
  updated: readonly TravelCompareKey[];
  /** Fields whose values are identical in previous and final state. */
  unchanged: readonly TravelCompareKey[];
  /** Boolean request flags that became true this turn. */
  newlyEnabledRequestFlags: readonly TravelCompareKey[];
  /** Boolean request flags that transitioned true → false or null → false this turn. */
  newlyDisabledRequestFlags: readonly TravelCompareKey[];
  /**
   * True when any acknowledgement-eligible travel field differs between
   * previous and final state. Request-flag clears to null (true → null,
   * false → null) are recorded in updated but do not set this flag alone.
   */
  hasAcknowledgementEligibleChange: boolean;
  /**
   * True when any canonical travel field differs between previous and final
   * state, including acknowledgement-inert request-flag clears to null.
   * Drives messageInterpreted; does not alone select Perfect.
   */
  hasInterpretedChange: boolean;
};

/**
 * Classify travel-field differences between previous and final conversation state.
 */
export function classifyConversationStateChange(
  previousState: ConversationCoreState,
  state: ConversationCoreState,
): ConversationStateChangeClassification {
  const newlyPopulated: TravelCompareKey[] = [];
  const updated: TravelCompareKey[] = [];
  const unchanged: TravelCompareKey[] = [];
  const newlyEnabledRequestFlags: TravelCompareKey[] = [];
  const newlyDisabledRequestFlags: TravelCompareKey[] = [];

  for (const key of TRAVEL_COMPARE_KEYS) {
    const previousValue = previousState[key];
    const nextValue = state[key];

    if (previousValue === nextValue) {
      unchanged.push(key);
      continue;
    }

    if (
      REQUEST_FLAG_KEYS.has(key) &&
      previousValue !== true &&
      nextValue === true
    ) {
      newlyEnabledRequestFlags.push(key);
      continue;
    }

    if (
      REQUEST_FLAG_KEYS.has(key) &&
      (previousValue === true || previousValue === null) &&
      nextValue === false
    ) {
      newlyDisabledRequestFlags.push(key);
      continue;
    }

    if (previousValue === null && nextValue !== null) {
      newlyPopulated.push(key);
      continue;
    }

    updated.push(key);
  }

  const hasAcknowledgementEligibleChange =
    newlyPopulated.length > 0 ||
    newlyEnabledRequestFlags.length > 0 ||
    newlyDisabledRequestFlags.length > 0 ||
    // Request-flag entries in updated are only true→null / false→null clears
    // (Phase 11F/11G) — acknowledgement-inert on their own.
    updated.some((key) => !REQUEST_FLAG_KEYS.has(key));

  const hasInterpretedChange =
    newlyPopulated.length > 0 ||
    newlyEnabledRequestFlags.length > 0 ||
    newlyDisabledRequestFlags.length > 0 ||
    updated.length > 0;

  return {
    newlyPopulated,
    updated,
    unchanged,
    newlyEnabledRequestFlags,
    newlyDisabledRequestFlags,
    hasAcknowledgementEligibleChange,
    hasInterpretedChange,
  };
}

/** True when the named field was newly populated or updated this turn. */
export function fieldValueChanged(
  classification: ConversationStateChangeClassification,
  field: TravelCompareKey,
): boolean {
  return (
    classification.newlyPopulated.includes(field) ||
    classification.updated.includes(field)
  );
}
