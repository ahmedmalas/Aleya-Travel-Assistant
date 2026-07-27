import type { ConversationState, TravellerCounts, TripPurposeKind } from '../types';
import type { ExtractionPatch } from './types';
import { field, markChanged } from './shared';

const WORD_NUMBERS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
};

function parseCount(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  if (/^\d+$/.test(raw)) return Number(raw);
  return WORD_NUMBERS[raw.toLowerCase()];
}

export function extractTravellers(text: string, previous?: ConversationState): TravellerCounts | undefined {
  const t = text.toLowerCase();
  const base = previous?.travellers?.value ?? { adults: 1, children: 0, infants: 0, total: 1 };
  const adultsMatch = t.match(/(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s*adults?/);
  const childrenMatch = t.match(/(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s*(?:children|kids|child)/);
  const infantsMatch = t.match(/(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s*(?:infants?|babies|baby)/);
  const peopleMatch = t.match(
    /(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s*(?:travellers?|travelers?|people|passengers?|of us)/,
  );

  const wifePartner =
    /\bcouple\b|\btwo of us\b/.test(t) ||
    /\b(?:my wife|my husband|my partner)\b/.test(t) ||
    /\b(?:wife and i|husband and i|partner and i)\b/.test(t) ||
    /\b(?:me and my wife|me and my husband|me and my partner)\b/.test(t) ||
    /\btake my (?:wife|husband|partner)\b/.test(t);

  const childAdd =
    /\b(?:bring my (?:daughter|son|child)|my (?:daughter|son|child) (?:is|are) coming(?:\s+too)?|add one child|the kids? are coming)\b/.test(
      t,
    ) ||
    /\b(?:wife|husband|partner)\s+and\s+(?:daughter|son|child|kids?)\b/.test(t) ||
    /\b(?:daughter|son|child)\s+as well\b/.test(t);
  const childCountFromPhrase = /\bthe kids\b|\bchildren\b/.test(t) && childAdd ? 2 : childAdd ? 1 : 0;

  if (adultsMatch || childrenMatch || infantsMatch) {
    const adults =
      parseCount(adultsMatch?.[1]) ?? (wifePartner ? 2 : infantsMatch || childrenMatch ? 1 : base.adults);
    const children = parseCount(childrenMatch?.[1]) ?? Math.max(base.children, childCountFromPhrase);
    const infants = parseCount(infantsMatch?.[1]) ?? base.infants;
    return { adults, children, infants, total: adults + children + infants };
  }
  if (peopleMatch) {
    const total = parseCount(peopleMatch[1]) ?? 1;
    return { adults: total, children: 0, infants: 0, total };
  }
  if (/\bjust me\b|\bsolo\b/.test(t)) return { adults: 1, children: 0, infants: 0, total: 1 };

  if (wifePartner || childAdd) {
    const adults = wifePartner ? Math.max(base.adults, 2) : base.adults;
    const children = Math.max(base.children, childCountFromPhrase);
    const infants = base.infants;
    return { adults, children, infants, total: adults + children + infants };
  }
  return undefined;
}

export function extractPurpose(text: string): TripPurposeKind | undefined {
  const t = text.toLowerCase();
  if (/\bbusiness\b|\bwork trip\b|\bconference\b/.test(t)) return 'business';
  if (/\bfamily\b|\bkids?\b|\bchildren\b/.test(t)) return 'family';
  if (/\bluxury\b|\bpremium\b|\bfive[- ]star\b/.test(t)) return 'luxury';
  if (/\bbudget\b|\bcheap\b|\blow[- ]cost\b/.test(t)) return 'budget';
  if (/\bromantic\b|\bhoneymoon\b/.test(t)) return 'romantic';
  if (/\bleisure\b|\bholiday\b|\bvacation\b|\bgetaway\b/.test(t)) return 'leisure';
  return undefined;
}

export function extractPeoplePatch(
  text: string,
  previous?: ConversationState,
): Partial<ExtractionPatch> {
  const patch: Partial<ExtractionPatch> = { changedFields: [] };
  const changed = patch.changedFields!;
  const travellers = extractTravellers(text, previous);
  if (travellers) {
    patch.travellers = field(travellers);
    markChanged(changed, 'travellers');
  }
  const purpose = extractPurpose(text);
  if (purpose) {
    patch.tripPurpose = field(purpose);
    markChanged(changed, 'tripPurpose');
  }
  return patch;
}
