import type {
  ConversationCoreState,
  ConversationStateUpdate,
} from './types';

/**
 * Neutral continuation when no supported travel-field change occurred, or when
 * core requirements and capability-specific follow-ups are already satisfied.
 */
export const NEUTRAL_TRIP_FALLBACK_REPLY =
  'What else should I know about your trip?';

/**
 * Stable capability-label order for multi-capability acknowledgements.
 *
 * Matches the activated behavioural/service request order used by the
 * extractor factory, with accessible travel inserted after nearby discovery
 * (explicit-only field; no extractor).
 */
const CAPABILITY_LABELS = [
  ['flightsRequested', 'flights'],
  ['accommodationRequested', 'accommodation'],
  ['carHireRequested', 'car hire'],
  ['activitiesRequested', 'activities'],
  ['restaurantsRequested', 'restaurants'],
  ['nearbyDiscoveryRequested', 'nearby discovery'],
  ['accessibleTravelRequested', 'accessible travel'],
  ['beachesRequested', 'beaches'],
  ['campingRequested', 'camping'],
  ['kayakingRequested', 'kayaking'],
  ['fourWheelDriveRequested', 'four-wheel driving'],
  ['scenicDrivesRequested', 'scenic drives'],
  ['attractionsRequested', 'attractions'],
  ['snowActivitiesRequested', 'snow activities'],
  ['hikingWalkingRequested', 'hiking and walking'],
  ['fishingRequested', 'fishing'],
  ['divingSnorkellingRequested', 'diving and snorkelling'],
  ['wineriesFoodTrailsRequested', 'wineries and food trails'],
  ['eventsFestivalsRequested', 'events and festivals'],
  ['wildlifeRequested', 'wildlife'],
  ['nationalParksRequested', 'national parks'],
] as const satisfies ReadonlyArray<
  readonly [keyof ConversationStateUpdate, string]
>;

const TRAVEL_COMPARE_KEYS = [
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
 * Phase 10D — deterministic; derived only from final canonical state.
 *
 * Traveller/guest counts share adultCount. Activity/dining interest has no
 * dedicated state field yet, so those questions apply while the capability
 * remains requested.
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

export type GenerateConversationReplyInput = {
  message: string;
  /** Final post-precedence travel state for this turn. */
  state: ConversationCoreState;
  /** Pre-turn state used only to isolate current-turn field changes. */
  previousState: ConversationCoreState;
};

/**
 * Internal conversation-core reply boundary.
 *
 * Phase 10B: deterministic state-aware acknowledgements from current-turn
 * travel-field changes only. Phase 10C: after any acknowledgement, append
 * exactly one follow-up for the first missing core requirement
 * (destination → origin → departureDate → returnDate). Phase 10D: when those
 * four are present, append exactly one capability-specific contextual
 * follow-up, otherwise the neutral continuation. Invoked solely by
 * processConversationTurn after extraction and explicit stateUpdate
 * precedence. Does not re-extract, inspect message text, call
 * search/itinerary, or use an AI provider.
 */
export function generateConversationReply(
  input: GenerateConversationReplyInput,
): string {
  void input.message;
  const { state, previousState } = input;

  const newlyRequestedLabels = CAPABILITY_LABELS.filter(([field]) => {
    return previousState[field] !== true && state[field] === true;
  }).map(([, label]) => label);

  if (newlyRequestedLabels.length > 0) {
    return withProgression(
      `I've added ${formatLabelList(newlyRequestedLabels)} to your trip requirements.`,
      state,
    );
  }

  if (
    state.destination !== null &&
    state.destination !== previousState.destination
  ) {
    return withProgression(`Sounds good — ${state.destination}.`, state);
  }

  if (state.origin !== null && state.origin !== previousState.origin) {
    return withProgression(
      `Got it — travelling from ${state.origin}.`,
      state,
    );
  }

  if (hasSupportedTravelFieldChange(previousState, state)) {
    return withProgression('Got it.', state);
  }

  return NEUTRAL_TRIP_FALLBACK_REPLY;
}

/** True when any canonical travel field differs between pre- and post-turn state. */
export function hasSupportedTravelFieldChange(
  previousState: ConversationCoreState,
  state: ConversationCoreState,
): boolean {
  for (const key of TRAVEL_COMPARE_KEYS) {
    if (previousState[key] !== state[key]) {
      return true;
    }
  }
  return false;
}

function withProgression(
  acknowledgement: string,
  state: ConversationCoreState,
): string {
  return `${acknowledgement}\n${nextMissingRequirementQuestion(state)}`;
}

function nextMissingRequirementQuestion(state: ConversationCoreState): string {
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

function formatLabelList(labels: readonly string[]): string {
  if (labels.length === 1) {
    return labels[0]!;
  }
  if (labels.length === 2) {
    return `${labels[0]} and ${labels[1]}`;
  }
  const head = labels.slice(0, -1).join(', ');
  return `${head} and ${labels[labels.length - 1]}`;
}
