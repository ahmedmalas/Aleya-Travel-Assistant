import {
  fieldValueChanged,
  type ConversationStateChangeClassification,
} from './classifyConversationStateChange';
import { CONVERSATION_REPLY_CATALOGUE } from './conversationReplyCatalogue';
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
 *
 * Phase 10K — ordering and eligibility remain selector-owned; acknowledgement
 * sentence wording comes from CONVERSATION_REPLY_CATALOGUE.
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
 * Phase 10K — selects catalogue entries; does not own literal wording.
 * Phase 10R — departure-date acknowledgement inserted after origin:
 * newly enabled capabilities → destination → origin → departure date →
 * other travel-field change → null when unchanged.
 */
export function selectConversationAcknowledgement(
  state: ConversationCoreState,
  classification: ConversationStateChangeClassification,
): string | null {
  const newlyRequestedLabels = CAPABILITY_LABELS.filter(([field]) =>
    classification.newlyEnabledRequestFlags.includes(field),
  ).map(([, label]) => label);

  if (newlyRequestedLabels.length > 0) {
    return CONVERSATION_REPLY_CATALOGUE.acknowledgements.addedCapabilities(
      formatLabelList(newlyRequestedLabels),
    );
  }

  if (
    state.destination !== null &&
    fieldValueChanged(classification, 'destination')
  ) {
    return CONVERSATION_REPLY_CATALOGUE.acknowledgements.destination(
      state.destination,
    );
  }

  if (state.origin !== null && fieldValueChanged(classification, 'origin')) {
    return CONVERSATION_REPLY_CATALOGUE.acknowledgements.origin(state.origin);
  }

  if (
    state.departureDate !== null &&
    fieldValueChanged(classification, 'departureDate')
  ) {
    return CONVERSATION_REPLY_CATALOGUE.acknowledgements.departureDate(
      state.departureDate,
    );
  }

  if (classification.hasAnyChange) {
    return CONVERSATION_REPLY_CATALOGUE.acknowledgements
      .genericTravelFieldChange;
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
