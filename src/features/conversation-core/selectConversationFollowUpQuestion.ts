import {
  CONVERSATION_REPLY_CATALOGUE,
  NEUTRAL_TRIP_FALLBACK_REPLY,
} from './conversationReplyCatalogue';
import type { ConversationCoreState } from './types';

export { NEUTRAL_TRIP_FALLBACK_REPLY };

/**
 * Fixed progression priority for the next missing core travel requirement.
 * Phase 10C — deterministic; derived only from final canonical state.
 * Phase 10K — wording comes from CONVERSATION_REPLY_CATALOGUE.
 */
const PROGRESSION_QUESTIONS = [
  ['destination', CONVERSATION_REPLY_CATALOGUE.followUps.destination],
  ['origin', CONVERSATION_REPLY_CATALOGUE.followUps.origin],
  ['departureDate', CONVERSATION_REPLY_CATALOGUE.followUps.departureDate],
  ['returnDate', CONVERSATION_REPLY_CATALOGUE.followUps.returnDate],
] as const satisfies ReadonlyArray<
  readonly [keyof ConversationCoreState, string]
>;

/**
 * Specific activity-interest capability flags that satisfy the general
 * activities preference follow-up once any one is true.
 *
 * Phase 18D — excludes broad travel services (flights, accommodation,
 * car hire, activities, restaurants). Includes discovery / activity /
 * experience flags already present on ConversationCoreState.
 */
const SPECIFIC_ACTIVITY_INTEREST_FLAGS = [
  'nearbyDiscoveryRequested',
  'accessibleTravelRequested',
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
] as const satisfies ReadonlyArray<keyof ConversationCoreState>;

/**
 * True when at least one supported specific activity interest is already set.
 *
 * Phase 18D — used only by the activities contextual follow-up eligibility
 * rule. Does not inspect message text or mutate state.
 */
function hasSpecificActivityInterest(state: ConversationCoreState): boolean {
  return SPECIFIC_ACTIVITY_INTEREST_FLAGS.some(
    (field) => state[field] === true,
  );
}

/**
 * Phase 19F — child-count follow-up applies only when passenger counts are
 * relevant (flights or accommodation), adults are already captured, and
 * childCount is still null.
 */
function needsChildCountFollowUp(state: ConversationCoreState): boolean {
  const passengerServiceRelevant =
    state.flightsRequested === true || state.accommodationRequested === true;
  return (
    passengerServiceRelevant &&
    state.adultCount !== null &&
    state.childCount === null
  );
}

/**
 * Phase 19G — infant-count follow-up applies only when passenger counts are
 * relevant (flights or accommodation), adult and child counts are already
 * captured, and infantCount is still null.
 */
function needsInfantCountFollowUp(state: ConversationCoreState): boolean {
  const passengerServiceRelevant =
    state.flightsRequested === true || state.accommodationRequested === true;
  return (
    passengerServiceRelevant &&
    state.adultCount !== null &&
    state.childCount !== null &&
    state.infantCount === null
  );
}

/**
 * Fixed contextual follow-up priority after core fields are complete.
 * Phase 10D/10E — deterministic; derived only from final canonical state.
 *
 * Phase 10E suppression: skip any contextual question whose required
 * information already exists, then continue to the next eligible question.
 * Traveller/guest counts share adultCount.
 * Phase 18D — activities follow-up remains eligible only while
 * activitiesRequested is true and no specific activity-interest capability
 * is true yet.
 * Phase 18F — restaurants follow-up remains eligible only while
 * restaurantsRequested is true and restaurantPreference is still null.
 * Phase 19F — child-count follow-up after adult/guest count when flights or
 * accommodation is requested and childCount is still null.
 * Phase 19G — infant-count follow-up after child count when flights or
 * accommodation is requested and infantCount is still null.
 *
 * Phase 10K — wording comes from CONVERSATION_REPLY_CATALOGUE.
 */
const CONTEXTUAL_QUESTIONS = [
  {
    applies: (state: ConversationCoreState) =>
      state.flightsRequested === true && state.adultCount === null,
    question: CONVERSATION_REPLY_CATALOGUE.followUps.flightsAdultCount,
  },
  {
    applies: (state: ConversationCoreState) =>
      state.accommodationRequested === true && state.adultCount === null,
    question: CONVERSATION_REPLY_CATALOGUE.followUps.accommodationGuestCount,
  },
  {
    applies: needsChildCountFollowUp,
    question: CONVERSATION_REPLY_CATALOGUE.followUps.childCount,
  },
  {
    applies: needsInfantCountFollowUp,
    question: CONVERSATION_REPLY_CATALOGUE.followUps.infantCount,
  },
  {
    applies: (state: ConversationCoreState) =>
      state.activitiesRequested === true &&
      !hasSpecificActivityInterest(state),
    question: CONVERSATION_REPLY_CATALOGUE.followUps.activities,
  },
  {
    applies: (state: ConversationCoreState) =>
      state.restaurantsRequested === true &&
      state.restaurantPreference === null,
    question: CONVERSATION_REPLY_CATALOGUE.followUps.restaurants,
  },
] as const;

/**
 * Select exactly one deterministic follow-up from final canonical state.
 *
 * Phase 10H — owns core progression, contextual questions, adultCount
 * suppression, and the neutral continuation. Returns a question string, or
 * null only when no follow-up should be emitted (unused by current planners,
 * which treat the neutral continuation as the terminal selection).
 * Phase 10K — selects catalogue entries; does not own literal wording.
 * Phase 18D — activities contextual eligibility also requires that no
 * specific activity-interest capability is already true.
 * Phase 18F — restaurants contextual eligibility also requires that
 * restaurantPreference is still null.
 * Phase 19F — after adult/guest count, solicits childCount when flights or
 * accommodation is requested and childCount is still null.
 * Phase 19G — after child count, solicits infantCount when flights or
 * accommodation is requested and infantCount is still null.
 */
export function selectConversationFollowUpQuestion(
  state: ConversationCoreState,
): string | null {
  for (const [field, question] of PROGRESSION_QUESTIONS) {
    if (state[field] === null) {
      return question;
    }
  }
  for (const entry of CONTEXTUAL_QUESTIONS) {
    if (entry.applies(state)) {
      return entry.question;
    }
  }
  return NEUTRAL_TRIP_FALLBACK_REPLY;
}
