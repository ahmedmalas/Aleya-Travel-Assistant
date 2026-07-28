import { resolveSync } from '../../travel-location-intelligence';
import { catalogueByPlaceName } from './catalogue';
import type {
  BudgetLevel,
  DiscoveryCriteria,
  DiscoveryRegionBias,
  DiscoveryVibe,
  TravellerGroup,
  TripCharacter,
} from './types';
import { emptyDiscoveryCriteria } from './types';

const CHARACTER_PATTERNS: Array<{ re: RegExp; value: TripCharacter }> = [
  { re: /\btropical\b/i, value: 'tropical' },
  { re: /\bbeach(?:es|y)?\b/i, value: 'beach' },
  { re: /\bcity\s+break\b|\bcity\b/i, value: 'city' },
  { re: /\bnature\b|\brainforest\b|\bnational\s+park\b/i, value: 'nature' },
  { re: /\bsnow\b|\bski(?:ing)?\b|\balpine\b/i, value: 'snow' },
  { re: /\bcountryside\b|\brural\b|\bwine\s+country\b/i, value: 'countryside' },
  { re: /\bisland\b/i, value: 'island' },
  { re: /\badventure\b|\badventurous\b/i, value: 'adventure' },
  { re: /\brelax(?:ing|ation)?\b|\bquiet\b|\bpeaceful\b|\bchill\b/i, value: 'relaxation' },
  { re: /\bnightlife\b|\blively\b|\bparty\b/i, value: 'nightlife' },
  { re: /\bfamily\b|\bkids?\b|\bchildren\b/i, value: 'family' },
  { re: /\bromantic\b|\bhoneymoon\b/i, value: 'romantic' },
  { re: /\bcultur(?:e|al)\b|\btemples?\b|\bmuseums?\b/i, value: 'cultural' },
  { re: /\bfood\b|\bculinary\b|\bgastronomy\b/i, value: 'food' },
  { re: /\bwellness\b|\bspa\b|\byoga\b/i, value: 'wellness' },
];

const ACTIVITY_PATTERNS: Array<{ re: RegExp; value: string }> = [
  { re: /\bkayak(?:ing)?\b/i, value: 'kayaking' },
  { re: /\bsnorkel(?:ling)?\b/i, value: 'snorkelling' },
  { re: /\bdiv(?:e|ing)\b/i, value: 'diving' },
  { re: /\bsurf(?:ing)?\b/i, value: 'surfing' },
  { re: /\bhik(?:e|ing)\b/i, value: 'hiking' },
  { re: /\breef\b/i, value: 'reef' },
  { re: /\bsail(?:ing)?\b/i, value: 'sailing' },
];

function uniq<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

function mergeLists<T>(prev: T[], next: T[]): T[] {
  return uniq([...prev, ...next]);
}

function detectVibe(text: string): DiscoveryVibe | undefined {
  if (/\b(quiet|peaceful|slower|slow\s+pace|relaxing)\b/i.test(text)) return 'quiet';
  if (/\b(nightlife|lively|busy|party)\b/i.test(text)) return 'lively';
  return undefined;
}

function detectBudget(text: string): { level?: BudgetLevel; maxAud?: number } {
  const max = text.match(
    /\b(?:under|below|max(?:imum)?|up\s+to)\s*(?:a\$|aud\s*\$?|\$)?\s*(\d{3,5})\b/i,
  );
  if (max) return { maxAud: Number(max[1]), level: 'mid_range' };
  if (/\b(mid[- ]?range|moderate)\b/i.test(text)) return { level: 'mid_range' };
  if (/\b(luxury|upscale|high[- ]?end)\b/i.test(text)) return { level: 'luxury' };
  if (/\b(budget|cheap(?:er)?|affordable)\b/i.test(text)) return { level: 'budget' };
  return {};
}

function detectTravellerGroup(text: string): TravellerGroup | undefined {
  if (/\b(solo|on\s+my\s+own|by\s+myself)\b/i.test(text)) return 'solo';
  if (/\b(wife|husband|partner|spouse|couple|romantic)\b/i.test(text)) return 'couple';
  if (/\b(family|kids?|children)\b/i.test(text)) return 'family';
  if (/\b(friends|mates)\b/i.test(text)) return 'friends';
  return undefined;
}

function detectRegionBias(text: string): DiscoveryRegionBias | undefined {
  if (/\b(only\s+)?(?:within\s+)?australia\b|\bdomestic\b|\bin\s+australia\b/i.test(text)) {
    return 'australia';
  }
  if (/\bpacific\b|\bsouth\s+pacific\b/i.test(text)) return 'pacific';
  if (/\basia\b/i.test(text)) return 'asia';
  if (/\binternational\b|\boverseas\b/i.test(text)) return 'international';
  return undefined;
}

function detectExclusions(text: string): string[] {
  const found: string[] = [];
  const notPatterns = [
    ...text.matchAll(/\bnot\s+([a-z][a-z\s]{1,30}?)(?:\s*,|\s*$|\s*\.|\!)/gi),
    ...text.matchAll(/\b(?:except|excluding|no)\s+([a-z][a-z\s]{1,24})/gi),
    ...text.matchAll(/\bi\s+don'?t\s+(?:like|want)\s+([a-z][a-z\s]{1,24})/gi),
  ];
  for (const m of notPatterns) {
    const raw = (m[1] ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
    if (!raw || /^(sure|really|yet|now|ready)$/.test(raw)) continue;
    // "not Bali" / "not a city"
    if (/^(a|an|the)\s+/.test(raw) && !/bali|fiji|cairns|phuket/.test(raw)) continue;
    const cleaned = raw.replace(/^(a|an|the)\s+/, '');
    if (cleaned.length < 3) continue;
    found.push(cleaned.split(/\s+and\s+/)[0]?.trim() ?? cleaned);
  }
  return uniq(found);
}

function detectOriginAndHours(text: string): {
  originLabel?: string;
  originAirportCode?: string;
  maxTravelHours?: number;
} {
  const hours = text.match(
    /\b(?:under|within|less\s+than|max(?:imum)?|up\s+to)\s+(\d+(?:\.\d+)?)\s*hours?\b/i,
  );
  const from = text.match(
    /\b(?:from|out\s+of)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/,
  );
  // "under six hours from Sydney"
  const hoursFrom = text.match(
    /\b(\d+(?:\.\d+)?)\s*hours?\s+from\s+([A-Za-z][A-Za-z\s]{2,30})\b/i,
  );
  const leaving = text.match(/\b(?:leaving(?:\s+from)?|departing(?:\s+from)?)\s+([A-Za-z][A-Za-z\s]{2,30})\b/i);

  let originLabel: string | undefined;
  let maxTravelHours: number | undefined;

  if (hoursFrom) {
    maxTravelHours = Number(hoursFrom[1]);
    originLabel = hoursFrom[2]?.trim();
  } else {
    if (hours) maxTravelHours = Number(hours[1]);
    if (from) originLabel = from[1]?.trim();
    if (leaving) originLabel = leaving[1]?.trim();
  }

  // Word numbers
  const wordHours = text.match(
    /\b(under|within|less\s+than)\s+(two|three|four|five|six|seven|eight|nine|ten)\s+hours?\s+from\s+([A-Za-z][A-Za-z\s]{2,30})\b/i,
  );
  if (wordHours) {
    const map: Record<string, number> = {
      two: 2,
      three: 3,
      four: 4,
      five: 5,
      six: 6,
      seven: 7,
      eight: 8,
      nine: 9,
      ten: 10,
    };
    maxTravelHours = map[wordHours[2]!.toLowerCase()];
    originLabel = wordHours[3]?.trim();
  }

  let originAirportCode: string | undefined;
  if (originLabel) {
    const { best, candidates } = resolveSync(originLabel, {
      allowFuzzy: true,
      roleHint: 'origin',
    });
    const hit = best ?? candidates[0]?.place;
    if (hit) {
      originLabel = hit.canonicalName;
      originAirportCode = hit.iataCode ?? hit.nearestAirportCodes?.[0];
    }
  }

  return { originLabel, originAirportCode, maxTravelHours };
}

function detectNights(text: string): number | undefined {
  const m = text.match(/\b(?:for\s+)?(\d+)\s*nights?\b/i);
  if (m) return Number(m[1]);
  const words: Record<string, number> = {
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
  };
  const w = text.match(/\b(?:for\s+)?(two|three|four|five|six|seven)\s*nights?\b/i);
  if (w) return words[w[1]!.toLowerCase()];
  if (/\bshort\s+(?:city\s+)?break\b|\bweekend\b/i.test(text)) return 3;
  return undefined;
}

function detectCloserCheaperRefinements(text: string): Partial<DiscoveryCriteria> {
  const patch: Partial<DiscoveryCriteria> = {};
  if (/\bcloser\b|\bnearer\b|\bshorter\s+flight\b/i.test(text)) {
    // tighten travel time if known later in merge
    patch.maxTravelHours = undefined; // signal handled in mergeDiscoveryCriteria
  }
  return patch;
}

/** Extract discovery criteria delta from one user message. */
export function extractDiscoveryCriteriaDelta(text: string): Partial<DiscoveryCriteria> & {
  tightenTravelHours?: boolean;
  preferCheaper?: boolean;
  rejectRecommendationNames?: string[];
  clearCharactersTo?: TripCharacter[];
} {
  const characters = CHARACTER_PATTERNS.filter((p) => p.re.test(text)).map((p) => p.value);
  // Avoid treating "city" alone from "capacity" etc. — already word-bounded.
  // Quiet implies relaxation character
  if (/\bquiet\b/i.test(text) && !characters.includes('relaxation')) {
    characters.push('relaxation');
  }

  const climate: string[] = [];
  if (/\btropical\b|\bwarm\b|\bsun(?:ny)?\b|\bsunshine\b/i.test(text)) {
    if (/\btropical\b/i.test(text)) climate.push('tropical');
    if (/\bwarm\b|\bsun(?:ny)?\b/i.test(text)) climate.push('warm');
  }

  const activities = ACTIVITY_PATTERNS.filter((p) => p.re.test(text)).map((p) => p.value);
  const { originLabel, originAirportCode, maxTravelHours } = detectOriginAndHours(text);
  const budget = detectBudget(text);
  const vibe = detectVibe(text);
  const travellerGroup = detectTravellerGroup(text);
  const regionBias = detectRegionBias(text);
  const exclusions = detectExclusions(text);
  const durationNights = detectNights(text);

  // "Actually I want a city break instead" — replace beach/tropical with city
  let clearCharactersTo: TripCharacter[] | undefined;
  if (/\binstead\b/i.test(text) && /\bcity\b/i.test(text)) {
    clearCharactersTo = ['city'];
  }

  const tightenTravelHours = /\bcloser\b|\bnearer\b|\bshorter\s+flight\b/i.test(text);
  const preferCheaper = /\bcheaper\b|\bless\s+expensive\b|\blower\s+budget\b/i.test(text);

  void detectCloserCheaperRefinements;

  return {
    characters: characters.length ? characters : undefined,
    climate: climate.length ? climate : undefined,
    activities: activities.length ? activities : undefined,
    originLabel,
    originAirportCode,
    maxTravelHours,
    budgetLevel: budget.level,
    budgetMaxAud: budget.maxAud,
    vibe,
    travellerGroup,
    regionBias,
    exclusions: exclusions.length ? exclusions : undefined,
    durationNights,
    tightenTravelHours,
    preferCheaper,
    clearCharactersTo,
  };
}

export function mergeDiscoveryCriteria(
  previous: DiscoveryCriteria,
  delta: ReturnType<typeof extractDiscoveryCriteriaDelta>,
): DiscoveryCriteria {
  let characters = previous.characters;
  if (delta.clearCharactersTo?.length) {
    characters = delta.clearCharactersTo;
  } else if (delta.characters?.length) {
    characters = mergeLists(characters, delta.characters);
  }

  let maxTravelHours = previous.maxTravelHours;
  if (delta.maxTravelHours != null) maxTravelHours = delta.maxTravelHours;
  if (delta.tightenTravelHours) {
    maxTravelHours = maxTravelHours != null ? Math.max(2, maxTravelHours - 1.5) : 4;
  }

  let budgetLevel = previous.budgetLevel;
  if (delta.budgetLevel) budgetLevel = delta.budgetLevel;
  if (delta.preferCheaper) {
    budgetLevel =
      budgetLevel === 'luxury' ? 'mid_range' : budgetLevel === 'mid_range' ? 'budget' : 'budget';
  }

  return {
    originLabel: delta.originLabel ?? previous.originLabel,
    originAirportCode: delta.originAirportCode ?? previous.originAirportCode,
    maxTravelHours,
    climate: mergeLists(previous.climate, delta.climate ?? []),
    characters,
    vibe: delta.vibe ?? previous.vibe,
    budgetLevel,
    budgetMaxAud: delta.budgetMaxAud ?? previous.budgetMaxAud,
    durationNights: delta.durationNights ?? previous.durationNights,
    travellers: delta.travellers ?? previous.travellers,
    travellerGroup: delta.travellerGroup ?? previous.travellerGroup,
    activities: mergeLists(previous.activities, delta.activities ?? []),
    exclusions: mergeLists(previous.exclusions, delta.exclusions ?? []),
    regionBias: delta.regionBias ?? previous.regionBias,
    dateFlexibility: delta.dateFlexibility ?? previous.dateFlexibility,
    flightPreference: delta.flightPreference ?? previous.flightPreference,
    accommodationPreference:
      delta.accommodationPreference ?? previous.accommodationPreference,
  };
}

export function criteriaChanged(
  before: DiscoveryCriteria,
  after: DiscoveryCriteria,
): boolean {
  return JSON.stringify(before) !== JSON.stringify(after);
}

/** Map exclusion/place mentions onto catalogue ids for rejection memory. */
export function resolveExclusionIds(exclusions: string[]): string[] {
  const ids: string[] = [];
  for (const ex of exclusions) {
    const hit = catalogueByPlaceName(ex);
    if (hit) ids.push(hit.id);
  }
  return ids;
}

export { emptyDiscoveryCriteria };
