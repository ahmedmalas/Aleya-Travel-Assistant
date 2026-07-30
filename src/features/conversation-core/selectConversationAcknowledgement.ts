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
  ['toursRequested', 'tours'],
  ['eventsRequested', 'events'],
  ['nightlifeRequested', 'nightlife'],
  ['shoppingRequested', 'shopping'],
  ['wellnessRequested', 'wellness'],
  ['familyActivitiesRequested', 'family activities'],
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
 * Phase 10R — departure-date acknowledgement inserted after origin.
 * Phase 10S — return-date acknowledgement inserted after departure date.
 * Phase 10T — adult-count acknowledgement inserted after return date.
 * Phase 10U — child-count acknowledgement inserted after adult count.
 * Phase 10V — infant-count acknowledgement inserted after child count:
 * newly enabled capabilities → destination → origin → departure date →
 * return date → adult count → child count → infant count → other
 * travel-field change → null when unchanged.
 * Phase 11B — capability labels completed for tours, events, nightlife,
 * shopping, wellness, and family activities.
 * Phase 11C — newly disabled capabilities inserted after newly enabled:
 * newly enabled capabilities → newly disabled capabilities → destination →
 * origin → departure date → return date → adult count → child count →
 * infant count → other travel-field change → null when unchanged.
 * Phase 11J — destination removal (stored → null) uses the destination
 * priority slot after destination set/changed:
 * newly enabled capabilities → newly disabled capabilities →
 * destination set or changed → destination removed → origin →
 * departure date → return date → adult count → child count →
 * infant count → other travel-field change → null when unchanged.
 * Phase 11K — origin removal (stored → null) uses the origin priority
 * slot after origin set/changed:
 * newly enabled capabilities → newly disabled capabilities →
 * destination set or changed → destination removed →
 * origin set or changed → origin removed → departure date →
 * return date → adult count → child count → infant count →
 * other travel-field change → null when unchanged.
 * Phase 11L — departure-date removal (stored → null) uses the
 * departure-date priority slot after departure date set/changed:
 * newly enabled capabilities → newly disabled capabilities →
 * destination set or changed → destination removed →
 * origin set or changed → origin removed →
 * departure date set or changed → departure date removed →
 * return date → adult count → child count → infant count →
 * other travel-field change → null when unchanged.
 * Phase 11M — return-date removal (stored → null) uses the
 * return-date priority slot after return date set/changed:
 * newly enabled capabilities → newly disabled capabilities →
 * destination set or changed → destination removed →
 * origin set or changed → origin removed →
 * departure date set or changed → departure date removed →
 * return date set or changed → return date removed →
 * adult count → child count → infant count →
 * other travel-field change → null when unchanged.
 * Phase 11N — adult-count removal (stored → null) uses the
 * adult-count priority slot after adult count set/changed:
 * newly enabled capabilities → newly disabled capabilities →
 * destination set or changed → destination removed →
 * origin set or changed → origin removed →
 * departure date set or changed → departure date removed →
 * return date set or changed → return date removed →
 * adult count set or changed → adult count removed →
 * child count → infant count →
 * other travel-field change → null when unchanged.
 * Phase 11O — child-count removal (stored → null) uses the
 * child-count priority slot after child count set/changed:
 * newly enabled capabilities → newly disabled capabilities →
 * destination set or changed → destination removed →
 * origin set or changed → origin removed →
 * departure date set or changed → departure date removed →
 * return date set or changed → return date removed →
 * adult count set or changed → adult count removed →
 * child count set or changed → child count removed →
 * infant count → other travel-field change → null when unchanged.
 * Phase 11P — infant-count removal (stored → null) uses the
 * infant-count priority slot after infant count set/changed:
 * newly enabled capabilities → newly disabled capabilities →
 * destination set or changed → destination removed →
 * origin set or changed → origin removed →
 * departure date set or changed → departure date removed →
 * return date set or changed → return date removed →
 * adult count set or changed → adult count removed →
 * child count set or changed → child count removed →
 * infant count set or changed → infant count removed →
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

  const newlyDisabledLabels = CAPABILITY_LABELS.filter(([field]) =>
    classification.newlyDisabledRequestFlags.includes(field),
  ).map(([, label]) => label);

  if (newlyDisabledLabels.length > 0) {
    return CONVERSATION_REPLY_CATALOGUE.acknowledgements.removedCapabilities(
      formatLabelList(newlyDisabledLabels),
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

  // Stored destination → null: final value is null and destination is in
  // updated (not newlyPopulated). No new classification field required.
  if (
    state.destination === null &&
    classification.updated.includes('destination')
  ) {
    return CONVERSATION_REPLY_CATALOGUE.acknowledgements.destinationRemoved;
  }

  if (state.origin !== null && fieldValueChanged(classification, 'origin')) {
    return CONVERSATION_REPLY_CATALOGUE.acknowledgements.origin(state.origin);
  }

  // Stored origin → null: final value is null and origin is in updated
  // (not newlyPopulated). No new classification field required.
  if (state.origin === null && classification.updated.includes('origin')) {
    return CONVERSATION_REPLY_CATALOGUE.acknowledgements.originRemoved;
  }

  if (
    state.departureDate !== null &&
    fieldValueChanged(classification, 'departureDate')
  ) {
    return CONVERSATION_REPLY_CATALOGUE.acknowledgements.departureDate(
      state.departureDate,
    );
  }

  // Stored departureDate → null: final value is null and departureDate is
  // in updated (not newlyPopulated). No new classification field required.
  if (
    state.departureDate === null &&
    classification.updated.includes('departureDate')
  ) {
    return CONVERSATION_REPLY_CATALOGUE.acknowledgements.departureDateRemoved;
  }

  if (
    state.returnDate !== null &&
    fieldValueChanged(classification, 'returnDate')
  ) {
    return CONVERSATION_REPLY_CATALOGUE.acknowledgements.returnDate(
      state.returnDate,
    );
  }

  // Stored returnDate → null: final value is null and returnDate is in
  // updated (not newlyPopulated). No new classification field required.
  if (
    state.returnDate === null &&
    classification.updated.includes('returnDate')
  ) {
    return CONVERSATION_REPLY_CATALOGUE.acknowledgements.returnDateRemoved;
  }

  if (
    state.adultCount !== null &&
    fieldValueChanged(classification, 'adultCount')
  ) {
    return CONVERSATION_REPLY_CATALOGUE.acknowledgements.adultCount(
      state.adultCount,
    );
  }

  // Stored adultCount → null: final value is null and adultCount is in
  // updated (not newlyPopulated). No new classification field required.
  if (
    state.adultCount === null &&
    classification.updated.includes('adultCount')
  ) {
    return CONVERSATION_REPLY_CATALOGUE.acknowledgements.adultCountRemoved;
  }

  if (
    state.childCount !== null &&
    fieldValueChanged(classification, 'childCount')
  ) {
    return CONVERSATION_REPLY_CATALOGUE.acknowledgements.childCount(
      state.childCount,
    );
  }

  // Stored childCount → null: final value is null and childCount is in
  // updated (not newlyPopulated). No new classification field required.
  if (
    state.childCount === null &&
    classification.updated.includes('childCount')
  ) {
    return CONVERSATION_REPLY_CATALOGUE.acknowledgements.childCountRemoved;
  }

  if (
    state.infantCount !== null &&
    fieldValueChanged(classification, 'infantCount')
  ) {
    return CONVERSATION_REPLY_CATALOGUE.acknowledgements.infantCount(
      state.infantCount,
    );
  }

  // Stored infantCount → null: final value is null and infantCount is in
  // updated (not newlyPopulated). No new classification field required.
  if (
    state.infantCount === null &&
    classification.updated.includes('infantCount')
  ) {
    return CONVERSATION_REPLY_CATALOGUE.acknowledgements.infantCountRemoved;
  }

  if (classification.hasAcknowledgementEligibleChange) {
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
