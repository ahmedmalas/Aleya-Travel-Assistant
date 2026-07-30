import {
  fieldValueChanged,
  type ConversationStateChangeClassification,
} from './classifyConversationStateChange';
import {
  NEUTRAL_TRIP_FALLBACK_REPLY,
  selectConversationFollowUpQuestion,
} from './selectConversationFollowUpQuestion';
import type {
  ConversationCoreState,
  ConversationStateUpdate,
} from './types';

export { NEUTRAL_TRIP_FALLBACK_REPLY };

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
 * Internal deterministic reply plan produced before reply text is rendered.
 *
 * Phase 10G — consumed only by generateConversationReply. Contains at most
 * one acknowledgement string and at most one follow-up question. Phase 10H:
 * follow-up selection is delegated to selectConversationFollowUpQuestion.
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
 * change classification. Preserves Phase 10B–10E acknowledgement behaviour;
 * follow-up selection is owned by selectConversationFollowUpQuestion.
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
      followUpQuestion: selectConversationFollowUpQuestion(state),
      messageInterpreted,
    };
  }

  if (
    state.destination !== null &&
    fieldValueChanged(classification, 'destination')
  ) {
    return {
      acknowledgements: [`Sounds good — ${state.destination}.`],
      followUpQuestion: selectConversationFollowUpQuestion(state),
      messageInterpreted,
    };
  }

  if (state.origin !== null && fieldValueChanged(classification, 'origin')) {
    return {
      acknowledgements: [`Got it — travelling from ${state.origin}.`],
      followUpQuestion: selectConversationFollowUpQuestion(state),
      messageInterpreted,
    };
  }

  if (classification.hasAnyChange) {
    return {
      acknowledgements: ['Got it.'],
      followUpQuestion: selectConversationFollowUpQuestion(state),
      messageInterpreted,
    };
  }

  return {
    acknowledgements: [],
    followUpQuestion: NEUTRAL_TRIP_FALLBACK_REPLY,
    messageInterpreted: false,
  };
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
