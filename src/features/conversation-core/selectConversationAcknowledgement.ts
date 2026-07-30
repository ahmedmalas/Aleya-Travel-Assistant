import {
  fieldValueChanged,
  type ConversationStateChangeClassification,
} from './classifyConversationStateChange';
import type {
  ConversationCoreState,
  ConversationStateUpdate,
} from './types';

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
 * Select exactly one deterministic acknowledgement from final canonical state
 * and the turn's change classification.
 *
 * Phase 10I — owns capability, destination, origin, and generic travel-field
 * acknowledgements. Priority: newly enabled capabilities → destination →
 * origin → other travel-field change → null when unchanged.
 */
export function selectConversationAcknowledgement(
  state: ConversationCoreState,
  classification: ConversationStateChangeClassification,
): string | null {
  const newlyRequestedLabels = CAPABILITY_LABELS.filter(([field]) =>
    classification.newlyEnabledRequestFlags.includes(field),
  ).map(([, label]) => label);

  if (newlyRequestedLabels.length > 0) {
    return `I've added ${formatLabelList(newlyRequestedLabels)} to your trip requirements.`;
  }

  if (
    state.destination !== null &&
    fieldValueChanged(classification, 'destination')
  ) {
    return `Sounds good — ${state.destination}.`;
  }

  if (state.origin !== null && fieldValueChanged(classification, 'origin')) {
    return `Got it — travelling from ${state.origin}.`;
  }

  if (classification.hasAnyChange) {
    return 'Got it.';
  }

  return null;
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
