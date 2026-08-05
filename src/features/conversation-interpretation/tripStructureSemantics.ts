/**
 * Trip-structure semantics — one-way / return / multi-city.
 *
 * Detects itinerary shape and ordered destination stops as meaning classes.
 * Sequence/list connectives are one connective class (not a single-word patch).
 * Multiple destination places in an ordered list imply multi-city structure.
 */

export type TripStructureKind = 'one_way' | 'return' | 'multi_city';

export type TripStructureMeaning = {
  tripStructure: TripStructureKind | null;
  /** Ordered destination cities (multi-city stops, or a single destination). */
  destinationStops: string[];
};

const SEQUENCE_LIST_CONNECTIVE =
  /\b(?:then|next|followed\s+by|after\s+that|and\s+then|via)\b|[,/]|→| - /;

function asciiFold(value: string): string {
  let out = '';
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code >= 65 && code <= 90) out += String.fromCharCode(code + 32);
    else out += value.charAt(i);
  }
  return out;
}

function declaresMultiCity(folded: string): boolean {
  return (
    /\bmulti[\s-]?city\b/.test(folded) ||
    /\bmulti[\s-]?destination[s]?\b/.test(folded) ||
    /\bmultiple\s+(?:cities|destinations|stops)\b/.test(folded) ||
    /\bseveral\s+(?:cities|destinations|stops)\b/.test(folded) ||
    /\b(?:visit(?:ing)?|stop(?:ping)?\s+(?:in|at))\s+multiple\b/.test(folded)
  );
}

function declaresOneWay(folded: string): boolean {
  return (
    /\bone[\s-]?way\b/.test(folded) ||
    /\bno\s+return\b/.test(folded) ||
    /\bnot\s+(?:a\s+)?return\b/.test(folded)
  );
}

function declaresReturn(folded: string): boolean {
  return (
    /\bround[\s-]?trip\b/.test(folded) ||
    /\breturn\s+(?:trip|flight|ticket)s?\b/.test(folded) ||
    /\bwith\s+a\s+return\b/.test(folded)
  );
}

function hasOriginRoleCue(folded: string): boolean {
  return /\b(?:from|leaving from|departing from|travelling from|traveling from|flying from)\b/.test(
    folded,
  );
}

function hasDestinationRoleCue(folded: string): boolean {
  return (
    /\b(?:go(?:ing)?\s+to|travel(?:l?ing)?\s+to|fly(?:ing)?\s+to|visit(?:ing)?|head(?:ing)?\s+to)\b/.test(
      folded,
    ) || /\bto\s+[a-z]/.test(folded.replace(/\bfrom\b[\s\S]*$/i, ' '))
  );
}

/**
 * True when the utterance assigns places to distinct origin vs destination
 * roles (from X … go/to Y). That is a single-leg structure, not multi-city
 * destination stops.
 */
export function hasOriginDestinationRoleSplit(message: string): boolean {
  const folded = asciiFold(message);
  return hasOriginRoleCue(folded) && hasDestinationRoleCue(folded);
}

/** Origin-only travel role — must not be captured as a destination stop. */
export function hasOriginOnlyRole(message: string): boolean {
  const folded = asciiFold(message);
  return hasOriginRoleCue(folded) && !hasDestinationRoleCue(folded);
}

/**
 * True when places form an ordered destination list in the utterance
 * (list/sequence structure between ordered place mentions).
 */
export function hasOrderedDestinationListStructure(
  message: string,
  orderedPlaces: string[],
): boolean {
  if (orderedPlaces.length < 2) return false;
  // Origin+destination role split is not a multi-city destination list.
  if (hasOriginDestinationRoleSplit(message)) return false;

  const folded = asciiFold(message);
  const indexes: number[] = [];
  for (const place of orderedPlaces) {
    const needle = asciiFold(place);
    const index = folded.indexOf(needle);
    if (index === -1) return false;
    indexes.push(index);
  }
  for (let i = 1; i < indexes.length; i += 1) {
    if ((indexes[i] ?? 0) <= (indexes[i - 1] ?? 0)) return false;
    const between = folded.slice(indexes[i - 1], indexes[i]);
    if (!SEQUENCE_LIST_CONNECTIVE.test(between) && !/\band\b/.test(between)) {
      // Adjacent place names with only whitespace still count as a list when
      // two or more curated places were extracted in order.
      if (!/^[a-z0-9\s'.,/-]*$/i.test(between)) return false;
    }
  }
  return true;
}

/**
 * Resolve trip-structure meaning from the utterance and already-found places
 * (canonical names, message order).
 */
export function resolveTripStructureSemantics(input: {
  message: string;
  placesInOrder: string[];
  /** When the active requirement is collecting destinations. */
  collectingDestinations?: boolean;
  /** Prior structure already on canonical state. */
  currentTripStructure?: TripStructureKind | null;
}): TripStructureMeaning | null {
  const folded = asciiFold(input.message);
  const places = input.placesInOrder.filter((place, index, all) => {
    return place.length > 0 && all.indexOf(place) === index;
  });

  let tripStructure: TripStructureKind | null = null;
  let destinationStops: string[] = [];

  if (declaresMultiCity(folded)) {
    tripStructure = 'multi_city';
  } else if (declaresOneWay(folded)) {
    tripStructure = 'one_way';
  } else if (declaresReturn(folded)) {
    tripStructure = 'return';
  }

  const orderedList = hasOrderedDestinationListStructure(input.message, places);
  const collecting = input.collectingDestinations === true;
  const originOnly = hasOriginOnlyRole(input.message);

  // Origin-only utterances never populate destinationStops.
  if (!originOnly) {
    if (
      places.length >= 2 &&
      (orderedList || collecting || tripStructure === 'multi_city')
    ) {
      tripStructure = 'multi_city';
      destinationStops = places;
    } else if (
      places.length === 1 &&
      collecting &&
      (tripStructure === 'multi_city' ||
        input.currentTripStructure === 'multi_city')
    ) {
      // Single stop only while actively collecting multi-city destinations —
      // never while origin/date slots are active.
      destinationStops = places;
      tripStructure = 'multi_city';
    } else if (places.length === 1 && tripStructure === null && collecting) {
      // Ordinary single destination while destination is active.
      destinationStops = places;
    }
  }

  if (tripStructure === null && destinationStops.length === 0) {
    return null;
  }

  return { tripStructure, destinationStops };
}

/**
 * Build ordered trip legs from origin + destination stops.
 * Leg i: previous city → stop i (previous is origin for the first leg).
 */
export function buildTripLegsFromStops(input: {
  origin: string | null;
  destinationStops: string[];
  departureDate?: string | null;
}): Array<{
  origin: string | null;
  destination: string;
  departureDate: string | null;
}> {
  const legs: Array<{
    origin: string | null;
    destination: string;
    departureDate: string | null;
  }> = [];
  let previous = input.origin;
  for (const stop of input.destinationStops) {
    legs.push({
      origin: previous,
      destination: stop,
      departureDate: legs.length === 0 ? (input.departureDate ?? null) : null,
    });
    previous = stop;
  }
  return legs;
}
