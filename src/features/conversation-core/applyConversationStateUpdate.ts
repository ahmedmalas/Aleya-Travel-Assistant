import type {
  ConversationCoreState,
  ConversationStateUpdate,
  ConversationTripLeg,
  OpenClarification,
  TripStructureKind,
} from './types';

/** Travel fields only — no lifecycle, identity, or clock fields. */
export type AppliedConversationTravelState = {
  destination: string | null;
  origin: string | null;
  tripStructure: TripStructureKind | null;
  destinationStops: string[] | null;
  tripLegs: ConversationTripLeg[] | null;
  departureDate: string | null;
  returnDate: string | null;
  adultCount: number | null;
  childCount: number | null;
  infantCount: number | null;
  flightsRequested: boolean | null;
  accommodationRequested: boolean | null;
  carHireRequested: boolean | null;
  activitiesRequested: boolean | null;
  restaurantsRequested: boolean | null;
  restaurantPreference: string | null;
  nearbyDiscoveryRequested: boolean | null;
  beachesRequested: boolean | null;
  campingRequested: boolean | null;
  kayakingRequested: boolean | null;
  fourWheelDriveRequested: boolean | null;
  scenicDrivesRequested: boolean | null;
  attractionsRequested: boolean | null;
  snowActivitiesRequested: boolean | null;
  hikingWalkingRequested: boolean | null;
  fishingRequested: boolean | null;
  divingSnorkellingRequested: boolean | null;
  wineriesFoodTrailsRequested: boolean | null;
  eventsFestivalsRequested: boolean | null;
  wildlifeRequested: boolean | null;
  nationalParksRequested: boolean | null;
  toursRequested: boolean | null;
  nightlifeRequested: boolean | null;
  shoppingRequested: boolean | null;
  wellnessRequested: boolean | null;
  familyActivitiesRequested: boolean | null;
  accessibleTravelRequested: boolean | null;
  conversationComplete: boolean | null;
  searchExecutionRequested: boolean | null;
  amendmentResumeSearchReady: boolean | null;
  openClarification: OpenClarification | null;
  destinationResolutionStatus:
    | 'resolved'
    | 'unresolved'
    | 'ambiguous'
    | null;
  originResolutionStatus: 'resolved' | 'unresolved' | 'ambiguous' | null;
};

/**
 * Pure application of an explicit ConversationStateUpdate onto travel fields.
 *
 * Internal helper — not a second processor. Does not read user text, mutate
 * currentState, or touch lifecycle, identity, or clock fields.
 */
export function applyConversationStateUpdate(
  currentState: ConversationCoreState,
  stateUpdate?: ConversationStateUpdate,
): AppliedConversationTravelState {
  return {
    destination:
      stateUpdate?.destination !== undefined
        ? stateUpdate.destination
        : currentState.destination,
    origin:
      stateUpdate?.origin !== undefined
        ? stateUpdate.origin
        : currentState.origin,
    tripStructure:
      stateUpdate?.tripStructure !== undefined
        ? stateUpdate.tripStructure
        : currentState.tripStructure,
    destinationStops:
      stateUpdate?.destinationStops !== undefined
        ? stateUpdate.destinationStops
        : currentState.destinationStops,
    tripLegs:
      stateUpdate?.tripLegs !== undefined
        ? stateUpdate.tripLegs
        : currentState.tripLegs,
    departureDate:
      stateUpdate?.departureDate !== undefined
        ? stateUpdate.departureDate
        : currentState.departureDate,
    returnDate:
      stateUpdate?.returnDate !== undefined
        ? stateUpdate.returnDate
        : currentState.returnDate,
    adultCount:
      stateUpdate?.adultCount !== undefined
        ? stateUpdate.adultCount
        : currentState.adultCount,
    childCount:
      stateUpdate?.childCount !== undefined
        ? stateUpdate.childCount
        : currentState.childCount,
    infantCount:
      stateUpdate?.infantCount !== undefined
        ? stateUpdate.infantCount
        : currentState.infantCount,
    flightsRequested:
      stateUpdate?.flightsRequested !== undefined
        ? stateUpdate.flightsRequested
        : currentState.flightsRequested,
    accommodationRequested:
      stateUpdate?.accommodationRequested !== undefined
        ? stateUpdate.accommodationRequested
        : currentState.accommodationRequested,
    carHireRequested:
      stateUpdate?.carHireRequested !== undefined
        ? stateUpdate.carHireRequested
        : currentState.carHireRequested,
    activitiesRequested:
      stateUpdate?.activitiesRequested !== undefined
        ? stateUpdate.activitiesRequested
        : currentState.activitiesRequested,
    restaurantsRequested:
      stateUpdate?.restaurantsRequested !== undefined
        ? stateUpdate.restaurantsRequested
        : currentState.restaurantsRequested,
    restaurantPreference:
      stateUpdate?.restaurantPreference !== undefined
        ? stateUpdate.restaurantPreference
        : currentState.restaurantPreference,
    nearbyDiscoveryRequested:
      stateUpdate?.nearbyDiscoveryRequested !== undefined
        ? stateUpdate.nearbyDiscoveryRequested
        : currentState.nearbyDiscoveryRequested,
    beachesRequested:
      stateUpdate?.beachesRequested !== undefined
        ? stateUpdate.beachesRequested
        : currentState.beachesRequested,
    campingRequested:
      stateUpdate?.campingRequested !== undefined
        ? stateUpdate.campingRequested
        : currentState.campingRequested,
    kayakingRequested:
      stateUpdate?.kayakingRequested !== undefined
        ? stateUpdate.kayakingRequested
        : currentState.kayakingRequested,
    fourWheelDriveRequested:
      stateUpdate?.fourWheelDriveRequested !== undefined
        ? stateUpdate.fourWheelDriveRequested
        : currentState.fourWheelDriveRequested,
    scenicDrivesRequested:
      stateUpdate?.scenicDrivesRequested !== undefined
        ? stateUpdate.scenicDrivesRequested
        : currentState.scenicDrivesRequested,
    attractionsRequested:
      stateUpdate?.attractionsRequested !== undefined
        ? stateUpdate.attractionsRequested
        : currentState.attractionsRequested,
    snowActivitiesRequested:
      stateUpdate?.snowActivitiesRequested !== undefined
        ? stateUpdate.snowActivitiesRequested
        : currentState.snowActivitiesRequested,
    hikingWalkingRequested:
      stateUpdate?.hikingWalkingRequested !== undefined
        ? stateUpdate.hikingWalkingRequested
        : currentState.hikingWalkingRequested,
    fishingRequested:
      stateUpdate?.fishingRequested !== undefined
        ? stateUpdate.fishingRequested
        : currentState.fishingRequested,
    divingSnorkellingRequested:
      stateUpdate?.divingSnorkellingRequested !== undefined
        ? stateUpdate.divingSnorkellingRequested
        : currentState.divingSnorkellingRequested,
    wineriesFoodTrailsRequested:
      stateUpdate?.wineriesFoodTrailsRequested !== undefined
        ? stateUpdate.wineriesFoodTrailsRequested
        : currentState.wineriesFoodTrailsRequested,
    eventsFestivalsRequested:
      stateUpdate?.eventsFestivalsRequested !== undefined
        ? stateUpdate.eventsFestivalsRequested
        : currentState.eventsFestivalsRequested,
    wildlifeRequested:
      stateUpdate?.wildlifeRequested !== undefined
        ? stateUpdate.wildlifeRequested
        : currentState.wildlifeRequested,
    nationalParksRequested:
      stateUpdate?.nationalParksRequested !== undefined
        ? stateUpdate.nationalParksRequested
        : currentState.nationalParksRequested,
    toursRequested:
      stateUpdate?.toursRequested !== undefined
        ? stateUpdate.toursRequested
        : currentState.toursRequested,
    nightlifeRequested:
      stateUpdate?.nightlifeRequested !== undefined
        ? stateUpdate.nightlifeRequested
        : currentState.nightlifeRequested,
    shoppingRequested:
      stateUpdate?.shoppingRequested !== undefined
        ? stateUpdate.shoppingRequested
        : currentState.shoppingRequested,
    wellnessRequested:
      stateUpdate?.wellnessRequested !== undefined
        ? stateUpdate.wellnessRequested
        : currentState.wellnessRequested,
    familyActivitiesRequested:
      stateUpdate?.familyActivitiesRequested !== undefined
        ? stateUpdate.familyActivitiesRequested
        : currentState.familyActivitiesRequested,
    accessibleTravelRequested:
      stateUpdate?.accessibleTravelRequested !== undefined
        ? stateUpdate.accessibleTravelRequested
        : currentState.accessibleTravelRequested,
    conversationComplete:
      stateUpdate?.conversationComplete !== undefined
        ? stateUpdate.conversationComplete
        : currentState.conversationComplete,
    searchExecutionRequested:
      stateUpdate?.searchExecutionRequested !== undefined
        ? stateUpdate.searchExecutionRequested
        : currentState.searchExecutionRequested,
    amendmentResumeSearchReady:
      stateUpdate?.amendmentResumeSearchReady !== undefined
        ? stateUpdate.amendmentResumeSearchReady
        : currentState.amendmentResumeSearchReady,
    openClarification:
      stateUpdate?.openClarification !== undefined
        ? stateUpdate.openClarification
        : currentState.openClarification,
    destinationResolutionStatus:
      stateUpdate?.destinationResolutionStatus !== undefined
        ? stateUpdate.destinationResolutionStatus
        : currentState.destinationResolutionStatus,
    originResolutionStatus:
      stateUpdate?.originResolutionStatus !== undefined
        ? stateUpdate.originResolutionStatus
        : currentState.originResolutionStatus,
  };
}
