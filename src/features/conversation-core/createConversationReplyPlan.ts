import {
  fieldValueChanged,
  type ConversationStateChangeClassification,
} from './classifyConversationStateChange';
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
 * Internal deterministic reply plan produced before reply text is rendered.
 *
 * Phase 10G — consumed only by generateConversationReply. Contains at most
 * one acknowledgement string and at most one follow-up question.
 */
export type ConversationReplyPlan = {
  acknowledgements: readonly string[];
  followUpQuestion: string | null;
  messageInterpreted: boolean;
};

export type CreateConversationReplyPlanInput = {
  state: ConversationCoreState;
  classification: ConversationStateChangeClassification;
};

/**
 * Build a structured reply plan from final canonical state and the turn's
 * change classification. Preserves Phase 10B–10E acknowledgement, progression,
 * contextual, and suppression behaviour exactly.
 */
export function createConversationReplyPlan(
  input: CreateConversationReplyPlanInput,
): ConversationReplyPlan {
  const { state, classification } = input;
  const messageInterpreted = classification.hasAnyChange;

  const newlyRequestedLabels = CAPABILITY_LABELS.filter(([field]) =>
    classification.newlyEnabledRequestFlags.includes(field),
  ).map(([, label]) => label);

  if (newlyRequestedLabels.length > 0) {
    return {
      acknowledgements: [
        `I've added ${formatLabelList(newlyRequestedLabels)} to your trip requirements.`,
      ],
      followUpQuestion: nextMissingRequirementQuestion(state),
      messageInterpreted,
    };
  }

  if (
    state.destination !== null &&
    fieldValueChanged(classification, 'destination')
  ) {
    return {
      acknowledgements: [`Sounds good — ${state.destination}.`],
      followUpQuestion: nextMissingRequirementQuestion(state),
      messageInterpreted,
    };
  }

  if (state.origin !== null && fieldValueChanged(classification, 'origin')) {
    return {
      acknowledgements: [`Got it — travelling from ${state.origin}.`],
      followUpQuestion: nextMissingRequirementQuestion(state),
      messageInterpreted,
    };
  }

  if (classification.hasAnyChange) {
    return {
      acknowledgements: ['Got it.'],
      followUpQuestion: nextMissingRequirementQuestion(state),
      messageInterpreted,
    };
  }

  return {
    acknowledgements: [],
    followUpQuestion: NEUTRAL_TRIP_FALLBACK_REPLY,
    messageInterpreted: false,
  };
}

function nextMissingRequirementQuestion(state: ConversationCoreState): string {
  for (const [field, question] of PROGRESSION_QUESTIONS) {
    if (state[field] === null) {
      return question;
    }
  }
  // Phase 10E: walk contextual candidates in priority order; skip any whose
  // required information is already present in the final canonical state.
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
