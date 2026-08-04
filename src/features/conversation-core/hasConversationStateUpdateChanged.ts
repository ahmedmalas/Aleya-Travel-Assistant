import type {
  ConversationCoreState,
  ConversationStateUpdate,
} from './types';

const TRAVEL_STATE_UPDATE_KEYS = [
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
  'nightlifeRequested',
  'shoppingRequested',
  'wellnessRequested',
  'familyActivitiesRequested',
  'accessibleTravelRequested',
  'conversationComplete',
  'searchExecutionRequested',
  'amendmentResumeSearchReady',
  'destinationResolutionStatus',
  'originResolutionStatus',
] as const satisfies ReadonlyArray<keyof ConversationStateUpdate>;

/**
 * Pure detection of whether an explicit ConversationStateUpdate would change
 * any canonical travel-field value.
 *
 * Internal helper — not a second processor. Does not read user text, mutate
 * inputs, apply updates, or touch lifecycle, identity, or clock fields.
 */
export function hasConversationStateUpdateChanged(
  currentState: ConversationCoreState,
  stateUpdate?: ConversationStateUpdate,
): boolean {
  if (stateUpdate === undefined) return false;

  for (const key of TRAVEL_STATE_UPDATE_KEYS) {
    const supplied = stateUpdate[key];
    if (supplied !== undefined && supplied !== currentState[key]) {
      return true;
    }
  }

  return false;
}
