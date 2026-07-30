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
 * Fixed contextual follow-up priority after core fields are complete.
 * Phase 10D/10E — deterministic; derived only from final canonical state.
 *
 * Phase 10E suppression: skip any contextual question whose required
 * information already exists, then continue to the next eligible question.
 * Traveller/guest counts share adultCount. Activity/dining interest has no
 * dedicated state field yet, so those questions remain eligible while the
 * capability stays requested.
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
    applies: (state: ConversationCoreState) => state.activitiesRequested === true,
    question: CONVERSATION_REPLY_CATALOGUE.followUps.activities,
  },
  {
    applies: (state: ConversationCoreState) =>
      state.restaurantsRequested === true,
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
