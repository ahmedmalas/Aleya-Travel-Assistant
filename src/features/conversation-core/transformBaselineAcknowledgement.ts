import type {
  AcknowledgementTravelField,
  ConversationAcknowledgementEvent,
} from './conversationAcknowledgementEvent';

/**
 * Phase 15B — first controlled acknowledgement-only conversational transform.
 * Phase 16D — refine cross-field acknowledgement openers (stateless).
 * Phase 16F — distinguish infant opener from child (`That includes`).
 * Phase 16J — event-aware set-versus-changed wording from acknowledgementEvent.
 * Phase 19E — restaurant-preference set keeps catalogue wording; changed uses
 * "Great — {preference} instead." Distinguished from destination via event.
 *
 * Pure, deterministic mapping from a completed-plan acknowledgement string
 * (plus optional acknowledgementEvent) to a restrained conversational variant.
 * Operates on wording only.
 *
 * Does not import catalogue, state, or classification modules. Does not
 * compare trip states, re-derive events from text, use regex inference beyond
 * exact catalogue-shape extraction, keyword guessing, AI, randomness, or
 * mutation. Unknown acknowledgements are returned unchanged.
 *
 * When acknowledgementEvent is null, mismatched, or unsupported, falls back
 * to Phase 16F string-driven behaviour.
 *
 * Not exported from index.ts.
 */

/** Exact fixed acknowledgement strings → conversational variants. */
const EXACT_ACKNOWLEDGEMENT_TRANSFORMS: Readonly<Record<string, string>> = {
  'Destination removed.': "No problem, I've removed the destination.",
  'Departure location removed.':
    "No problem, I've removed the departure location.",
  'Departure date removed.': "No problem, I've removed the departure date.",
  'Return date removed.': "No problem, I've removed the return date.",
  'Adult count removed.': "No problem, I've removed the adult count.",
  'Child count removed.': "No problem, I've removed the child count.",
  'Infant count removed.': "No problem, I've removed the infant count.",
  'Perfect.': 'Perfect, got it.',
};

/**
 * Extract the interior of a known catalogue template when the string matches
 * an exact prefix + suffix pair. Returns null when the shape does not match.
 */
function extractBetween(
  acknowledgement: string,
  prefix: string,
  suffix: string,
): string | null {
  if (!acknowledgement.startsWith(prefix)) return null;
  if (!acknowledgement.endsWith(suffix)) return null;
  const interiorLength =
    acknowledgement.length - prefix.length - suffix.length;
  if (interiorLength <= 0) return null;
  return acknowledgement.slice(
    prefix.length,
    acknowledgement.length - suffix.length,
  );
}

function isFieldChanged(
  acknowledgementEvent: ConversationAcknowledgementEvent,
  field: AcknowledgementTravelField,
): boolean {
  return (
    acknowledgementEvent !== null &&
    acknowledgementEvent.kind === 'field-changed' &&
    acknowledgementEvent.field === field
  );
}

/**
 * Transform a single deterministic acknowledgement string into its
 * conversational variant. Optional acknowledgementEvent selects set versus
 * changed wording for matching travel-field families; otherwise Phase 16F
 * string-driven behaviour is preserved.
 */
export function transformBaselineAcknowledgement(
  acknowledgement: string,
  acknowledgementEvent: ConversationAcknowledgementEvent = null,
): string {
  const exact = EXACT_ACKNOWLEDGEMENT_TRANSFORMS[acknowledgement];
  if (exact !== undefined) {
    return exact;
  }

  const greatPrefixed = extractBetween(acknowledgement, 'Great — ', '.');
  if (greatPrefixed !== null) {
    // Phase 19E — same catalogue shape as destination; event field owns the
    // restaurant-preference branch so destination transforms do not steal it.
    if (
      acknowledgementEvent !== null &&
      (acknowledgementEvent.kind === 'field-set' ||
        acknowledgementEvent.kind === 'field-changed') &&
      acknowledgementEvent.field === 'restaurantPreference'
    ) {
      if (acknowledgementEvent.kind === 'field-changed') {
        return `Great — ${greatPrefixed} instead.`;
      }
      return acknowledgement;
    }
    if (isFieldChanged(acknowledgementEvent, 'destination')) {
      return `Updated — ${greatPrefixed} it is.`;
    }
    return `Great, ${greatPrefixed} it is.`;
  }

  const origin = extractBetween(
    acknowledgement,
    'Perfect — departing from ',
    '.',
  );
  if (origin !== null) {
    if (isFieldChanged(acknowledgementEvent, 'origin')) {
      return `We'll depart from ${origin} instead.`;
    }
    return `We'll start from ${origin}.`;
  }

  const departureDate = extractBetween(
    acknowledgement,
    'Perfect — departing on ',
    '.',
  );
  if (departureDate !== null) {
    if (isFieldChanged(acknowledgementEvent, 'departureDate')) {
      return `Departure is now set for ${departureDate}.`;
    }
    return `Departure is set for ${departureDate}.`;
  }

  const returnDate = extractBetween(
    acknowledgement,
    'Perfect — returning on ',
    '.',
  );
  if (returnDate !== null) {
    if (isFieldChanged(acknowledgementEvent, 'returnDate')) {
      return `Return is now set for ${returnDate}.`;
    }
    return `Return is set for ${returnDate}.`;
  }

  const adultSingular = extractBetween(
    acknowledgement,
    'Perfect — ',
    ' adult travelling.',
  );
  if (adultSingular !== null) {
    if (isFieldChanged(acknowledgementEvent, 'adultCount')) {
      return `Updated to ${adultSingular} adult.`;
    }
    return `Travelling with ${adultSingular} adult.`;
  }

  const adultPlural = extractBetween(
    acknowledgement,
    'Perfect — ',
    ' adults travelling.',
  );
  if (adultPlural !== null) {
    if (isFieldChanged(acknowledgementEvent, 'adultCount')) {
      return `Updated to ${adultPlural} adults.`;
    }
    return `Travelling with ${adultPlural} adults.`;
  }

  const childSingular = extractBetween(
    acknowledgement,
    'Perfect — ',
    ' child travelling.',
  );
  if (childSingular !== null) {
    if (isFieldChanged(acknowledgementEvent, 'childCount')) {
      return `Updated to ${childSingular} child.`;
    }
    return `I've noted ${childSingular} child.`;
  }

  const childPlural = extractBetween(
    acknowledgement,
    'Perfect — ',
    ' children travelling.',
  );
  if (childPlural !== null) {
    if (isFieldChanged(acknowledgementEvent, 'childCount')) {
      return `Updated to ${childPlural} children.`;
    }
    return `I've noted ${childPlural} children.`;
  }

  const infantSingular = extractBetween(
    acknowledgement,
    'Perfect — ',
    ' infant travelling.',
  );
  if (infantSingular !== null) {
    if (isFieldChanged(acknowledgementEvent, 'infantCount')) {
      return `Updated to ${infantSingular} infant.`;
    }
    return `That includes ${infantSingular} infant.`;
  }

  const infantPlural = extractBetween(
    acknowledgement,
    'Perfect — ',
    ' infants travelling.',
  );
  if (infantPlural !== null) {
    if (isFieldChanged(acknowledgementEvent, 'infantCount')) {
      return `Updated to ${infantPlural} infants.`;
    }
    return `That includes ${infantPlural} infants.`;
  }

  const addedCapabilities = extractBetween(
    acknowledgement,
    "I've added ",
    ' to your trip requirements.',
  );
  if (addedCapabilities !== null) {
    return `Great, I've added ${addedCapabilities} to your trip.`;
  }

  const removedCapabilities = extractBetween(
    acknowledgement,
    "I've removed ",
    ' from your trip requirements.',
  );
  if (removedCapabilities !== null) {
    return `No problem, I've removed ${removedCapabilities} from your trip.`;
  }

  return acknowledgement;
}
