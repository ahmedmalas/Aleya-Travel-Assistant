import type { ActiveTravelRequirement } from './types';

/**
 * Traveller-count meaning classes — active-requirement–scoped quantity
 * resolution. Surface forms (myself / none / no / bare cardinals) map to
 * adult/child/infant counts without cue-extractor growth.
 */

export type TravellerCountMeaning = {
  adultCount?: number;
  childCount?: number;
  infantCount?: number;
};

const WORD_QUANTITY: Record<string, number> = {
  zero: 0,
  oh: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
};

function asciiFold(value: string): string {
  let out = '';
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code >= 65 && code <= 90) out += String.fromCharCode(code + 32);
    else out += value.charAt(i);
  }
  return out;
}

function parseCardinal(raw: string): number | null {
  const folded = raw.trim().toLowerCase();
  if (/^\d+$/.test(folded)) {
    const n = Number(folded);
    return n >= 0 && n <= 20 ? n : null;
  }
  return WORD_QUANTITY[folded] ?? null;
}

/** Self-party: the speaker alone as the travelling adult/guest party. */
function isSelfPartyUtterance(trimmed: string): boolean {
  return (
    /^(?:just\s+)?myself$/.test(trimmed) ||
    /^(?:just\s+|only\s+)?me$/.test(trimmed) ||
    /^(?:by\s+myself|on\s+my\s+own|alone|solo)$/.test(trimmed) ||
    /^(?:just\s+)?(?:me\s+myself|myself\s+only)$/.test(trimmed)
  );
}

/**
 * Zero-quantity class for dependent traveller slots (children / infants).
 * Intentionally broad for the active slot — not a completion signal.
 */
function isZeroQuantityUtterance(trimmed: string): boolean {
  return (
    /^(?:none|no|nope|nah|zero|nobody|no\s+one)$/.test(trimmed) ||
    /^(?:none|no|zero)\s+(?:at\s+all|thanks|thank\s+you)?$/.test(trimmed) ||
    /^(?:no|none|zero)\s+(?:children|child|kids?|infants?|babies|baby)$/.test(
      trimmed,
    ) ||
    /^(?:without\s+(?:any\s+)?(?:children|child|kids?|infants?|babies|baby))$/.test(
      trimmed,
    )
  );
}

function activeCountSlot(
  activeRequirement: ActiveTravelRequirement,
): 'adultCount' | 'childCount' | 'infantCount' | null {
  if (activeRequirement === 'adultCount') return 'adultCount';
  if (activeRequirement === 'childCount') return 'childCount';
  if (activeRequirement === 'infantCount') return 'infantCount';
  return null;
}

/**
 * Resolve traveller-count meaning from the utterance and active requirement.
 * Returns null when no traveller-count meaning is present.
 */
export function resolveTravellerCountSemantics(input: {
  message: string;
  activeRequirement: ActiveTravelRequirement;
}): TravellerCountMeaning | null {
  const folded = asciiFold(input.message);
  const trimmed = folded.replace(/[.!?]+$/g, '').trim();
  if (!trimmed) return null;

  const meaning: TravellerCountMeaning = {};

  const adults = folded.match(
    /\b(\d+|zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+adults?\b/,
  );
  if (adults) {
    const n = parseCardinal(adults[1] ?? '');
    if (n !== null) meaning.adultCount = n;
  }

  const children = folded.match(
    /\b(\d+|zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+(?:children|child|kids?)\b/,
  );
  if (children) {
    const n = parseCardinal(children[1] ?? '');
    if (n !== null) meaning.childCount = n;
  }

  const infants = folded.match(
    /\b(\d+|zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+infants?\b/,
  );
  if (infants) {
    const n = parseCardinal(infants[1] ?? '');
    if (n !== null) meaning.infantCount = n;
  }

  const slot = activeCountSlot(input.activeRequirement);

  if (slot === 'adultCount' && meaning.adultCount === undefined) {
    if (isSelfPartyUtterance(trimmed)) {
      meaning.adultCount = 1;
    } else {
      const bare = trimmed.match(
        /^(?:\d+|zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)$/,
      );
      if (bare) {
        const n = parseCardinal(bare[0] ?? '');
        if (n !== null) meaning.adultCount = n;
      }
    }
  }

  if (
    (slot === 'childCount' || slot === 'infantCount') &&
    meaning[slot] === undefined
  ) {
    if (isZeroQuantityUtterance(trimmed)) {
      meaning[slot] = 0;
    } else {
      const bare = trimmed.match(
        /^(?:\d+|zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)$/,
      );
      if (bare) {
        const n = parseCardinal(bare[0] ?? '');
        if (n !== null) meaning[slot] = n;
      }
    }
  }

  if (
    meaning.adultCount === undefined &&
    meaning.childCount === undefined &&
    meaning.infantCount === undefined
  ) {
    return null;
  }

  return meaning;
}
