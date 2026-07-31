/**
 * Phase 15B — first controlled acknowledgement-only conversational transform.
 *
 * Pure, deterministic mapping from a single completed-plan acknowledgement
 * string to a restrained conversational variant. Operates on wording only.
 *
 * Does not import catalogue, state, or classification modules. Does not use
 * regex inference, keyword guessing, AI, randomness, or mutation.
 * Unknown acknowledgements are returned unchanged.
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

/**
 * Transform a single deterministic acknowledgement string into its first
 * conversational variant. Unknown strings are returned unchanged.
 */
export function transformBaselineAcknowledgement(
  acknowledgement: string,
): string {
  const exact = EXACT_ACKNOWLEDGEMENT_TRANSFORMS[acknowledgement];
  if (exact !== undefined) {
    return exact;
  }

  const destination = extractBetween(acknowledgement, 'Great — ', '.');
  if (destination !== null) {
    return `Great, ${destination} it is.`;
  }

  const origin = extractBetween(
    acknowledgement,
    'Perfect — departing from ',
    '.',
  );
  if (origin !== null) {
    return `Perfect, we'll start from ${origin}.`;
  }

  const departureDate = extractBetween(
    acknowledgement,
    'Perfect — departing on ',
    '.',
  );
  if (departureDate !== null) {
    return `Perfect, set to depart on ${departureDate}.`;
  }

  const returnDate = extractBetween(
    acknowledgement,
    'Perfect — returning on ',
    '.',
  );
  if (returnDate !== null) {
    return `Perfect, set to return on ${returnDate}.`;
  }

  const adultSingular = extractBetween(
    acknowledgement,
    'Perfect — ',
    ' adult travelling.',
  );
  if (adultSingular !== null) {
    return `Perfect, ${adultSingular} adult travelling.`;
  }

  const adultPlural = extractBetween(
    acknowledgement,
    'Perfect — ',
    ' adults travelling.',
  );
  if (adultPlural !== null) {
    return `Perfect, ${adultPlural} adults travelling.`;
  }

  const childSingular = extractBetween(
    acknowledgement,
    'Perfect — ',
    ' child travelling.',
  );
  if (childSingular !== null) {
    return `Perfect, ${childSingular} child travelling.`;
  }

  const childPlural = extractBetween(
    acknowledgement,
    'Perfect — ',
    ' children travelling.',
  );
  if (childPlural !== null) {
    return `Perfect, ${childPlural} children travelling.`;
  }

  const infantSingular = extractBetween(
    acknowledgement,
    'Perfect — ',
    ' infant travelling.',
  );
  if (infantSingular !== null) {
    return `Perfect, ${infantSingular} infant travelling.`;
  }

  const infantPlural = extractBetween(
    acknowledgement,
    'Perfect — ',
    ' infants travelling.',
  );
  if (infantPlural !== null) {
    return `Perfect, ${infantPlural} infants travelling.`;
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
