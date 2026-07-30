import type { ConversationCoreState } from './types';

/**
 * Neutral continuation when no more specific follow-up applies.
 * Shared by the follow-up selector and reply planner.
 */
export const NEUTRAL_TRIP_FALLBACK_REPLY =
  'What else should I know about your trip?';

/**
 * Fixed progression priority for the next missing core travel requirement.
 * Phase 10C — deterministic; derived only from final canonical state.
 */
const PROGRESSION_QUESTIONS = [
  ['destination', 'Where would you like to travel?'],
  ['origin', 'Where will you be travelling from?'],
  ['departureDate', 'When would you like to depart?'],
  ['returnDate', 'When would you like to return?'],
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
 */
const CONTEXTUAL_QUESTIONS = [
  {
    applies: (state: ConversationCoreState) =>
      state.flightsRequested === true && state.adultCount === null,
    question: 'How many adults will be travelling?',
  },
  {
    applies: (state: ConversationCoreState) =>
      state.accommodationRequested === true && state.adultCount === null,
    question: 'How many guests will be staying?',
  },
  {
    applies: (state: ConversationCoreState) => state.activitiesRequested === true,
    question: 'What kinds of activities are you interested in?',
  },
  {
    applies: (state: ConversationCoreState) =>
      state.restaurantsRequested === true,
    question: 'What type of dining are you looking for?',
  },
] as const;

/**
 * Select exactly one deterministic follow-up from final canonical state.
 *
 * Phase 10H — owns core progression, contextual questions, adultCount
 * suppression, and the neutral continuation. Returns a question string, or
 * null only when no follow-up should be emitted (unused by current planners,
 * which treat the neutral continuation as the terminal selection).
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
