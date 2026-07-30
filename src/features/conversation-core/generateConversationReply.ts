import type {
  ConversationCoreState,
  ConversationStateUpdate,
} from './types';

/**
 * Neutral fallback when the current turn produces no supported travel-field
 * change. Must not claim the message was understood.
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
 * travel-field changes only. Invoked solely by processConversationTurn after
 * extraction and explicit stateUpdate precedence. Does not re-extract, ask
 * next questions, call search/itinerary, or use an AI provider.
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
    return `I've added ${formatLabelList(newlyRequestedLabels)} to your trip requirements.`;
  }

  if (
    state.destination !== null &&
    state.destination !== previousState.destination
  ) {
    return `Sounds good — ${state.destination}.`;
  }

  if (state.origin !== null && state.origin !== previousState.origin) {
    return `Got it — travelling from ${state.origin}.`;
  }

  if (hasSupportedTravelFieldChange(previousState, state)) {
    return 'Got it.';
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
