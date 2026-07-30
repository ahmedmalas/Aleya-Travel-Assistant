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
 */
export type ConversationStateChangeClassification = {
  /** Fields that moved from null to a non-null value (excluding newly-enabled true flags). */
  newlyPopulated: readonly TravelCompareKey[];
  /** Fields that changed between two non-null values, or were cleared / otherwise altered. */
  updated: readonly TravelCompareKey[];
  /** Fields whose values are identical in previous and final state. */
  unchanged: readonly TravelCompareKey[];
  /** Boolean request flags that became true this turn. */
  newlyEnabledRequestFlags: readonly TravelCompareKey[];
  /** True when any travel field differs between previous and final state. */
  hasAnyChange: boolean;
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

    if (previousValue === null && nextValue !== null) {
      newlyPopulated.push(key);
      continue;
    }

    updated.push(key);
  }

  return {
    newlyPopulated,
    updated,
    unchanged,
    newlyEnabledRequestFlags,
    hasAnyChange:
      newlyPopulated.length > 0 ||
      updated.length > 0 ||
      newlyEnabledRequestFlags.length > 0,
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
