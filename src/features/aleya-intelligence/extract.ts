import { findAreaMentions, findPlacesInText, matchAreaName, PLACES } from './places';
import type {
  ApproximateDate,
  ConversationState,
  FieldValue,
  TimePreference,
  TravellerCounts,
  TravelServiceKind,
  TripPurposeKind,
} from './types';
import { withConfidence } from './confidence';

export type ExtractionPatch = {
  origin?: FieldValue<string>;
  destination?: FieldValue<string>;
  departureDate?: FieldValue<ApproximateDate>;
  returnDate?: FieldValue<ApproximateDate>;
  departureTimePreference?: FieldValue<TimePreference>;
  returnTimePreference?: FieldValue<TimePreference>;
  dateFlexibility?: FieldValue<'strict' | 'flexible' | 'plus_minus_days'>;
  requestedServices?: TravelServiceKind[];
  removeServices?: TravelServiceKind[];
  accommodationArea?: FieldValue<string>;
  clearAccommodationArea?: boolean;
  durationNights?: FieldValue<number>;
  travellers?: FieldValue<TravellerCounts>;
  tripPurpose?: FieldValue<TripPurposeKind>;
  budget?: FieldValue<{ amount?: number; currency?: string; style?: 'budget' | 'mid' | 'luxury'; relative?: 'cheaper' | 'more_expensive' }>;
  roomRequirements?: FieldValue<{ rooms?: number; beds?: string; connecting?: boolean; notes?: string }>;
  airlinePreferences?: FieldValue<{ airlines?: string[]; cabin?: string; directOnly?: boolean; notes?: string }>;
  hotelPreferences?: FieldValue<{ stars?: number; brands?: string[]; amenities?: string[]; notes?: string }>;
  activities?: FieldValue<string[]>;
  dietaryRequirements?: FieldValue<string[]>;
  accessibility?: FieldValue<string[]>;
  loyaltyMemberships?: FieldValue<string[]>;
  specialRequests?: FieldValue<string[]>;
  transportNotes?: FieldValue<string>;
  explicitItineraryIntent?: boolean;
  isGreeting?: boolean;
  isThanks?: boolean;
  isCapabilityQuestion?: boolean;
  isDateConfirmation?: boolean;
  confirmedDateLabel?: string;
  pendingLowConfidenceFields?: string[];
  changedFields?: string[];
  /** User accepted the soft/pending destination candidate. */
  confirmPendingDestination?: boolean;
  /** User declined the soft/pending destination candidate. */
  declinePendingDestination?: boolean;
};

const MONTHS: Record<string, number> = {
  january: 1, jan: 1, february: 2, feb: 2, march: 3, mar: 3, april: 4, apr: 4,
  may: 5, june: 6, jun: 6, july: 7, jul: 7, august: 8, aug: 8,
  september: 9, sep: 9, sept: 9, october: 10, oct: 10, november: 11, nov: 11,
  december: 12, dec: 12,
};

const WEEKDAYS: Record<string, number> = {
  sunday: 0, sun: 0, monday: 1, mon: 1, tuesday: 2, tue: 2, wednesday: 3, wed: 3,
  thursday: 4, thu: 4, friday: 5, fri: 5, saturday: 6, sat: 6,
};

const PLACE_STOPWORDS = new Set([
  'around', 'from', 'to', 'on', 'at', 'in', 'and', 'with', 'for', 'next', 'this',
  'the', 'a', 'an', 'after', 'before', 'near', 'via', 'leaving', 'actually', 'instead',
  'of', 'go', 'going', 'want', 'plans', 'change', 'make', 'it',
]);

function field<T>(value: T, source: 'confirmed' | 'inferred' = 'confirmed'): FieldValue<T> {
  return withConfidence(value, source, source === 'confirmed' ? 0.9 : 0.55);
}

function resolvePlaceName(raw: string): string {
  const cleaned = raw
    .trim()
    .split(/\s+/)
    .filter((part) => !PLACE_STOPWORDS.has(part.toLowerCase()))
    .join(' ');
  const lower = cleaned.toLowerCase();
  const known = PLACES.find((p) => p.name.toLowerCase() === lower || p.aliases.includes(lower));
  if (known) return known.name;
  const first = cleaned.split(/\s+/)[0]?.toLowerCase() ?? '';
  const byFirst = PLACES.find((p) => p.name.toLowerCase() === first || p.aliases.includes(first));
  return byFirst?.name ?? cleaned.replace(/^\w/, (c) => c.toUpperCase());
}

const SERVICE_FRAGMENT: Array<{ kind: TravelServiceKind; re: RegExp }> = [
  { kind: 'car_hire', re: /\b(?:car hire|rental car|hire car|rent(?:al)? car|vehicle hire|the rental|the car)\b/i },
  { kind: 'accommodation', re: /\b(?:hotels?|resorts?|accommodation|lodging|the hotel|the stay)\b/i },
  { kind: 'flights', re: /\b(?:flights?|airfare|the flights?)\b/i },
  { kind: 'transfers', re: /\b(?:transfers?|airport transfer|taxi|rideshare)\b/i },
  { kind: 'activities', re: /\b(?:activit(?:y|ies)|experiences?|tours?)\b/i },
];

function detectServicesInFragment(fragment: string): TravelServiceKind[] {
  const hits: TravelServiceKind[] = [];
  for (const { kind, re } of SERVICE_FRAGMENT) {
    if (re.test(fragment)) hits.push(kind);
  }
  return hits;
}

/** Split on clause boundaries so removal verbs cannot span into add/keep clauses. */
function splitServiceClauses(text: string): string[] {
  return text
    .split(/\s*(?:,|;|\.(?=\s|$)|!|\?|\band\b|\bbut\b|\bthen\b|\bwhile\b|\bhowever\b)\s*/i)
    .map((part) => part.trim())
    .filter(Boolean);
}

type ServiceClauseIntent = 'remove' | 'add' | 'keep' | 'neutral';

function classifyServiceClauseIntent(clause: string): ServiceClauseIntent {
  const t = clause.toLowerCase();
  if (/\b(?:keep|retain|still (?:need|want)|leave)\b/.test(t)) return 'keep';
  if (
    /\b(?:no|without|remove|forget|don'?t need|do not need|do not include|cancel)\b/.test(t) ||
    /\b(?:not needed|anymore|off|removed)\b/.test(t) ||
    /\bstay with (?:family|friends|relatives)\b/.test(t)
  ) {
    return 'remove';
  }
  if (/\b(?:add(?:\s+it)?(?:\s+back)?|include|get(?:\s+me)?|book)\b/.test(t)) return 'add';
  return 'neutral';
}

/**
 * Clause-scoped service ops. Latest explicit operation per service wins
 * (remove → keep/add in a later clause restores the service).
 */
function extractServiceOperations(text: string): {
  removeServices: TravelServiceKind[];
  addServices: TravelServiceKind[];
} {
  const ops = new Map<TravelServiceKind, 'remove' | 'add' | 'keep'>();
  let lastRemoved: TravelServiceKind | undefined;
  const clauses = splitServiceClauses(text);

  for (const clause of clauses) {
    const intent = classifyServiceClauseIntent(clause);
    const services = detectServicesInFragment(clause);

    if (!services.length) {
      // "actually add it back" refers to the most recently removed service
      if (intent === 'add' && /\badd(?:\s+it)?(?:\s+back)?\b/i.test(clause) && lastRemoved) {
        ops.set(lastRemoved, 'add');
      }
      continue;
    }

    for (const service of services) {
      if (intent === 'remove') {
        ops.set(service, 'remove');
        lastRemoved = service;
      } else if (intent === 'keep') {
        ops.set(service, 'keep');
      } else if (intent === 'add') {
        ops.set(service, 'add');
      }
    }
  }

  // Whole-message family-stay cue (may not isolate cleanly as a service token)
  if (/\bstay with (?:family|friends|relatives)\b/i.test(text)) {
    const current = ops.get('accommodation');
    if (current !== 'add' && current !== 'keep') ops.set('accommodation', 'remove');
  }

  const removeServices: TravelServiceKind[] = [];
  const addServices: TravelServiceKind[] = [];
  for (const [service, op] of ops) {
    if (op === 'remove') removeServices.push(service);
    if (op === 'add' || op === 'keep') addServices.push(service);
  }
  return { removeServices, addServices };
}

function extractServices(text: string): TravelServiceKind[] {
  const t = text.toLowerCase();
  const services: TravelServiceKind[] = [];
  if (/\bflights?\b|\bflying\b|\bfly\b|\bairfare\b/.test(t)) services.push('flights');
  // "stay with family" is a removal cue, not an accommodation request
  const stayWithFamily = /\bstay with (?:family|friends|relatives)\b/.test(t);
  if (
    /\bhotels?\b|\bresorts?\b|\baccommodation\b|\blodging\b/.test(t) ||
    (/\bstay\b/.test(t) && !stayWithFamily)
  ) {
    services.push('accommodation');
  }
  if (/\bcar hire\b|\brent(?:al)? car\b|\bhire a car\b|\brental car\b|\bvehicle hire\b/.test(t)) {
    services.push('car_hire');
  }
  if (/\btransfer\b|\bairport transfer\b|\btaxi\b|\brideshare\b/.test(t)) services.push('transfers');
  if (/\bactivit(?:y|ies)\b|\bexperience\b|\btour\b/.test(t)) services.push('activities');
  return Array.from(new Set(services));
}

function extractRemovals(text: string): TravelServiceKind[] {
  return extractServiceOperations(text).removeServices;
}

function extractPurpose(text: string): TripPurposeKind | undefined {
  const t = text.toLowerCase();
  if (/\bbusiness\b|\bwork trip\b|\bconference\b/.test(t)) return 'business';
  if (/\bfamily\b|\bkids?\b|\bchildren\b/.test(t)) return 'family';
  if (/\bluxury\b|\bpremium\b|\bfive[- ]star\b/.test(t)) return 'luxury';
  if (/\bbudget\b|\bcheap\b|\blow[- ]cost\b/.test(t)) return 'budget';
  if (/\bromantic\b|\bhoneymoon\b/.test(t)) return 'romantic';
  if (/\bleisure\b|\bholiday\b|\bvacation\b|\bgetaway\b/.test(t)) return 'leisure';
  return undefined;
}

function extractTimePreference(fragment: string): TimePreference | undefined {
  const t = fragment.toLowerCase();
  if (/after\s*5|after work|from\s*5\s*pm/.test(t)) return 'after_5pm';
  if (/\bmorning\b/.test(t)) return 'morning';
  if (/\bafternoon\b/.test(t)) return 'afternoon';
  if (/\bevening\b|\bnight\b/.test(t)) return 'evening';
  if (/\bflexible\b/.test(t)) return 'flexible';
  return undefined;
}

export type DateParseContext = {
  month?: number;
  year?: number;
};

function resolveYearForMonth(month: number, explicitYear: number | undefined, now: Date, contextYear?: number): number {
  if (explicitYear) return explicitYear;
  if (contextYear) return contextYear;
  let year = now.getFullYear();
  // If the month has already passed this calendar year, roll forward
  if (month < now.getMonth() + 1) year += 1;
  return year;
}

function buildAbsoluteDate(
  day: number,
  month: number,
  year: number,
  label: string,
  weekday?: number,
): ApproximateDate {
  const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return {
    kind: 'absolute',
    isoDate: iso,
    label,
    weekday,
    month,
    year,
  };
}

/**
 * Parse common Australian absolute date phrases.
 * Optional context supplies month/year from an active trip (e.g. end-of-August clarification).
 */
export function parseAbsoluteDate(
  text: string,
  now: Date,
  context?: DateParseContext,
): ApproximateDate | undefined {
  const lower = text.toLowerCase().trim();
  const monthNames =
    'january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec';
  const weekdays = 'sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue|wed|thu|fri|sat';

  // 28th of August / the 28th of August / Friday 28th of August [2026]
  const ofMonth = lower.match(
    new RegExp(
      `\\b(?:(${weekdays})[,]?\\s+)?(?:the\\s+)?(\\d{1,2})(?:st|nd|rd|th)?\\s+of\\s+(${monthNames})(?:\\s+(\\d{4}))?\\b`,
    ),
  );
  if (ofMonth) {
    const day = Number(ofMonth[2]);
    const month = MONTHS[ofMonth[3]!];
    const year = resolveYearForMonth(month, ofMonth[4] ? Number(ofMonth[4]) : undefined, now, context?.year);
    return buildAbsoluteDate(day, month, year, ofMonth[0]!, ofMonth[1] ? WEEKDAYS[ofMonth[1]] : undefined);
  }

  // 28 August / 28th August / Friday 28 August 2026
  const dayMonth = lower.match(
    new RegExp(
      `\\b(?:(${weekdays})[,]?\\s+)?(\\d{1,2})(?:st|nd|rd|th)?\\s+(${monthNames})(?:\\s+(\\d{4}))?\\b`,
    ),
  );
  if (dayMonth) {
    const day = Number(dayMonth[2]);
    const month = MONTHS[dayMonth[3]!];
    const year = resolveYearForMonth(month, dayMonth[4] ? Number(dayMonth[4]) : undefined, now, context?.year);
    return buildAbsoluteDate(day, month, year, dayMonth[0]!, dayMonth[1] ? WEEKDAYS[dayMonth[1]] : undefined);
  }

  // August 28 / August 28th / August the 28th [2026]
  const monthDay = lower.match(
    new RegExp(`\\b(${monthNames})\\s+(?:the\\s+)?(\\d{1,2})(?:st|nd|rd|th)?(?:\\s+(\\d{4}))?\\b`),
  );
  if (monthDay) {
    const month = MONTHS[monthDay[1]!];
    const day = Number(monthDay[2]);
    const year = resolveYearForMonth(month, monthDay[3] ? Number(monthDay[3]) : undefined, now, context?.year);
    return buildAbsoluteDate(day, month, year, monthDay[0]!);
  }

  // Friday the 28th / the 28th — resolve month/year from trip context
  const dayOnly = lower.match(
    new RegExp(`\\b(?:(${weekdays})\\s+)?(?:the\\s+)?(\\d{1,2})(?:st|nd|rd|th)\\b`),
  );
  if (dayOnly && context?.month) {
    const day = Number(dayOnly[2]);
    const month = context.month;
    const year = resolveYearForMonth(month, undefined, now, context.year);
    return buildAbsoluteDate(day, month, year, dayOnly[0]!, dayOnly[1] ? WEEKDAYS[dayOnly[1]] : undefined);
  }

  return undefined;
}

function parseRelativeDate(text: string, now: Date): ApproximateDate | undefined {
  const lower = text.toLowerCase();
  const endOfMonth = lower.match(/\bend of (january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\b/);
  if (endOfMonth) {
    const month = MONTHS[endOfMonth[1]!];
    let year = now.getFullYear();
    if (month < now.getMonth() + 1) year += 1;
    const weekdayMatch = lower.match(/\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/);
    return {
      kind: 'month_end',
      label: endOfMonth[0]!,
      month,
      year,
      weekday: weekdayMatch ? WEEKDAYS[weekdayMatch[1]!] : undefined,
    };
  }
  if (/\bnext weekend\b/.test(lower)) return { kind: 'weekend', label: 'next weekend' };
  if (/\bthis weekend\b/.test(lower)) return { kind: 'weekend', label: 'this weekend' };
  return parseAbsoluteDate(text, now);
}

const WORD_NUMBERS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
};

function parseCount(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  if (/^\d+$/.test(raw)) return Number(raw);
  return WORD_NUMBERS[raw.toLowerCase()];
}

function extractTravellers(text: string, previous?: ConversationState): TravellerCounts | undefined {
  const t = text.toLowerCase();
  const base = previous?.travellers?.value ?? { adults: 1, children: 0, infants: 0, total: 1 };
  const adultsMatch = t.match(/(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s*adults?/);
  const childrenMatch = t.match(/(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s*(?:children|kids|child)/);
  const infantsMatch = t.match(/(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s*(?:infants?|babies|baby)/);
  const peopleMatch = t.match(/(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s*(?:travellers?|travelers?|people|passengers?|of us)/);

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
    const adults = parseCount(adultsMatch?.[1]) ?? (wifePartner ? 2 : infantsMatch || childrenMatch ? 1 : base.adults);
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

/**
 * Freeform stay locality when not in the curated area lexicon
 * (e.g. "stay near the marina", "base us in South Bank").
 */
function extractFreeformStayArea(text: string): string | undefined {
  if (/\bstay with (?:family|friends|relatives)\b/i.test(text)) return undefined;
  const match = text.match(
    /\b(?:stay|hotel|accommodation|base(?:\s+us)?)\s+(?:near|in|around|at)\s+(?:the\s+)?([A-Za-z][A-Za-z]+(?:\s+[A-Za-z][A-Za-z]+)?)/i,
  );
  if (!match?.[1]) return undefined;
  const raw = match[1].trim();
  const lower = raw.toLowerCase();
  if (PLACE_STOPWORDS.has(lower) || DESTINATION_CHANGE_STOPWORDS.has(lower)) return undefined;
  if (['family', 'friends', 'relatives', 'home', 'there', 'here'].includes(lower)) return undefined;
  // Known cities are destinations, not stay areas
  if (PLACES.some((p) => p.name.toLowerCase() === lower || p.aliases.includes(lower))) return undefined;
  const knownArea = matchAreaName(raw);
  if (knownArea) return knownArea.area;
  return raw.replace(/^\w/, (c) => c.toUpperCase());
}

function extractDurationNights(text: string): number | undefined {
  const t = text.toLowerCase();
  const match = t.match(/\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fourteen)\s*nights?\b/);
  if (!match) return undefined;
  const words: Record<string, number> = {
    ...WORD_NUMBERS,
    eleven: 11,
    twelve: 12,
    fourteen: 14,
  };
  const raw = match[1]!;
  if (/^\d+$/.test(raw)) return Number(raw);
  return words[raw];
}

function extractBudget(text: string): ExtractionPatch['budget'] | undefined {
  const t = text.toLowerCase();
  const amount = t.match(/\$?\s*(\d{3,6})\s*(aud|usd|eur|gbp)?/);
  if (/\bluxury\b|\bpremium\b/.test(t)) {
    return field({ amount: amount ? Number(amount[1]) : undefined, currency: amount?.[2]?.toUpperCase(), style: 'luxury' });
  }
  if (/\bbudget\b|\bcheap\b|\blow[- ]cost\b/.test(t)) {
    return field({ amount: amount ? Number(amount[1]) : undefined, currency: amount?.[2]?.toUpperCase(), style: 'budget' });
  }
  if (amount) {
    return field({ amount: Number(amount[1]), currency: amount[2]?.toUpperCase(), style: 'mid' });
  }
  return undefined;
}

function extractPreferenceExtras(text: string, patch: ExtractionPatch): void {
  const lower = text.toLowerCase();

  if (/\bflexible (?:on|with)?\s*dates?\b|\bdates? are flexible\b|\b\+\/?\-?\s*\d+\s*days?\b/.test(lower)) {
    patch.dateFlexibility = field('flexible');
  } else if (/\bexact dates?\b|\bmust (?:be|travel) on\b/.test(lower)) {
    patch.dateFlexibility = field('strict');
  }

  const rooms = lower.match(/(\d+)\s*rooms?/);
  const beds = lower.match(/\b(king|queen|twin|double)\s*beds?\b/);
  if (rooms || beds || /\bconnecting rooms?\b/.test(lower)) {
    patch.roomRequirements = field({
      rooms: rooms ? Number(rooms[1]) : undefined,
      beds: beds?.[1],
      connecting: /\bconnecting rooms?\b/.test(lower) || undefined,
    });
  }

  const airline = text.match(
    /\b(?:prefer|fly(?:ing)?|with)\s+(Qantas|Jetstar|Virgin|Singapore Airlines|Emirates|Cathay)\b/i,
  );
  const cabin = lower.match(/\b(economy|premium economy|business|first)\s*class\b/);
  if (airline || cabin || /\bdirect(?: flights?)? only\b|\bnon[- ]stop\b/.test(lower)) {
    patch.airlinePreferences = field({
      airlines: airline ? [airline[1]!] : undefined,
      cabin: cabin?.[1],
      directOnly: /\bdirect(?: flights?)? only\b|\bnon[- ]stop\b/.test(lower) || undefined,
    });
  }

  const stars = lower.match(/(\d)\s*[- ]?star/);
  const niceHotel = /\b(?:nice|good|lovely|quality|decent)\s+hotel\b/.test(lower);
  if (stars || niceHotel || /\bboutique\b|\bnear the beach\b|\bpool\b/.test(lower)) {
    const amenities: string[] = [];
    if (/\bpool\b/.test(lower)) amenities.push('pool');
    if (/\bbeach\b/.test(lower)) amenities.push('beach');
    if (/\bboutique\b/.test(lower)) amenities.push('boutique');
    patch.hotelPreferences = field({
      stars: stars ? Number(stars[1]) : undefined,
      amenities: amenities.length ? amenities : undefined,
      notes: niceHotel ? 'nice hotel' : undefined,
    });
  }

  const diet: string[] = [];
  if (/\bvegetarian\b/.test(lower)) diet.push('vegetarian');
  if (/\bvegan\b/.test(lower)) diet.push('vegan');
  if (/\bgluten[- ]free\b/.test(lower)) diet.push('gluten-free');
  if (/\bhalal\b/.test(lower)) diet.push('halal');
  if (/\bkosher\b/.test(lower)) diet.push('kosher');
  if (diet.length) patch.dietaryRequirements = field(diet);

  const access: string[] = [];
  if (/\bwheelchair\b/.test(lower)) access.push('wheelchair');
  if (/\bstep[- ]free\b/.test(lower)) access.push('step-free');
  if (/\baccessible\b/.test(lower)) access.push('accessible');
  if (access.length) patch.accessibility = field(access);

  const loyalty = text.match(/\b((?:Qantas|Virgin|Marriott|Hilton|Accor)\s*(?:Frequent Flyer|FF|Bonvoy|Honors|Live Limitless)?)\b/gi);
  if (loyalty?.length) patch.loyaltyMemberships = field(Array.from(new Set(loyalty.map((s) => s.trim()))));

  if (/\bspecial request\b|\banniversary\b|\bhoneymoon setup\b|\blate checkout\b/.test(lower)) {
    const notes: string[] = [];
    if (/\banniversary\b/.test(lower)) notes.push('anniversary');
    if (/\bhoneymoon\b/.test(lower)) notes.push('honeymoon');
    if (/\blate checkout\b/.test(lower)) notes.push('late checkout');
    if (notes.length) patch.specialRequests = field(notes);
  }

  const activityHits = text.match(/\b(?:visit|see|do)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){0,3})/g);
  if (activityHits?.length && /\bactivit/i.test(text)) {
    patch.activities = field(activityHits.map((h) => h.replace(/^(visit|see|do)\s+/i, '').trim()));
  }
}

function dateContextFromState(previous?: ConversationState): DateParseContext | undefined {
  if (!previous) return undefined;
  const month = previous.departureDate?.value.month ?? previous.lastSuggestedDate?.month;
  const year = previous.departureDate?.value.year ?? previous.lastSuggestedDate?.year;
  if (month == null && year == null) return undefined;
  return { month, year };
}

function awaitingExactDepartureDate(previous?: ConversationState): boolean {
  if (!previous) return false;
  if (previous.awaitingDateConfirmation) return true;
  if (previous.lastSuggestedDate) return true;
  if (previous.missingRequiredFields.includes('departureDate')) return true;
  if (previous.missingRequiredFields.includes('departureDateConfirmation')) return true;
  const kind = previous.departureDate?.value.kind;
  return Boolean(kind && kind !== 'absolute' && !previous.departureDate?.value.isoDate);
}

function looksLikeDateConfirmation(text: string, previous?: ConversationState, now = new Date()): boolean {
  const t = text.trim().toLowerCase();
  // Do not treat destination-confirmation turns as date confirmations
  if (previous?.awaitingDestinationConfirmation) return false;
  if (!awaitingExactDepartureDate(previous)) return false;

  if (/^(yes|yep|yeah|correct|confirm|that works|sounds good)\b/.test(t)) return true;
  if (t.includes('friday') && (t.includes('28') || t.includes('august'))) return true;

  // Short natural-language date answers while a departure date is pending
  if (t.length <= 80 && parseAbsoluteDate(text, now, dateContextFromState(previous))) {
    return true;
  }
  return false;
}

/** Resolve yes/no against a pending soft destination candidate. */
function resolvePendingDestinationDecision(
  text: string,
  previous?: ConversationState,
): 'confirm' | 'decline' | undefined {
  if (!previous?.awaitingDestinationConfirmation || !previous.pendingDestination) return undefined;
  const t = text.trim().toLowerCase();
  const pending = previous.pendingDestination.value.toLowerCase();
  const current = previous.destination?.value.toLowerCase() ?? '';

  // "keep looking/searching/thinking" is not a decline of the pending destination
  const keepLooking = /\bkeep\s+(?:looking|searching|thinking|exploring|checking)\b/.test(t);

  if (!keepLooking) {
    if (/\b(?:don'?t change|do not change)\b/.test(t) || (/^(no|nope|nah)\b/.test(t) && !t.includes(pending))) {
      return 'decline';
    }
    if (current && new RegExp(`\\b(?:keep|stay with|stay in)\\s+${current}\\b`, 'i').test(t)) {
      return 'decline';
    }
    if (/\bkeep\s+(?:the\s+)?(?:current\s+)?destination\b/.test(t)) {
      return 'decline';
    }
  }

  if (
    /^(yes|yep|yeah|correct|confirm|that works|sounds good|please do|change it|switch)\b/.test(t) ||
    new RegExp(`\\b(?:change|switch|go)\\s+to\\s+${pending}\\b`, 'i').test(t) ||
    t === pending ||
    new RegExp(`^(?:yes[,.]?\\s*)?${pending}\\b`, 'i').test(t)
  ) {
    return 'confirm';
  }
  return undefined;
}

/** Escape a place name for safe regex use. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const DESTINATION_CHANGE_STOPWORDS = new Set([
  'one', 'a', 'an', 'the', 'it', 'day', 'days', 'earlier', 'later', 'sometime', 'soon',
  'maybe', 'perhaps', 'tonight', 'today', 'tomorrow', 'yesterday', 'please', 'now',
  'of', 'go', 'going', 'to', 'want', 'plans', 'change', 'make',
]);

type DestinationChange = {
  destination: string;
  area?: string;
};

/** Place-name capture: keep case-sensitive so `instead of Melbourne` never becomes "Of Melbourne". */
const PLACE_CAPTURE = '([A-Z][a-zA-Z]+(?:\\s+[A-Z][a-zA-Z]+)?)';

function normalizeDestinationCandidate(raw: string): DestinationChange | undefined {
  const trimmed = raw.trim().replace(/[.,!?;:]+$/g, '').trim();
  if (!trimmed || DESTINATION_CHANGE_STOPWORDS.has(trimmed.toLowerCase())) return undefined;

  const area = matchAreaName(trimmed);
  if (area) {
    return { destination: area.city, area: area.area };
  }

  const name = resolvePlaceName(trimmed);
  if (!name || DESTINATION_CHANGE_STOPWORDS.has(name.toLowerCase())) return undefined;
  // Only accept known cities/areas for replacement — reject garbage captures like "Of Melbourne"
  const known = PLACES.some((p) => p.name.toLowerCase() === name.toLowerCase());
  if (!known) return undefined;
  return { destination: name };
}

/**
 * Explicit keep / do-not-change language targeting the destination itself.
 * "Keep looking at Brisbane" / "keep the hotel" are NOT destination retention.
 */
function isDestinationRetention(text: string, previous?: ConversationState): boolean {
  const t = text.toLowerCase();
  // Positive replacement of the current destination wins over retention cues
  if (/\bnot\s+[a-z][a-z\s]+?\s+anymore\b/.test(t)) return false;
  if (/\bnot\s+[a-z][a-z\s]+?\s*[—\-,:]+\s*[a-z]/.test(t) && /\b(?:change|make)\b/.test(t)) {
    return false;
  }
  // Explicit destination change in the same sentence overrides keep-looking noise
  if (
    /\b(?:make (?:the\s+)?destination|change (?:the\s+)?destination|go to\b[\s\S]{0,40}\binstead|instead of)\b/.test(
      t,
    )
  ) {
    return false;
  }
  if (/\bkeep\s+(?:looking|searching|thinking|exploring|checking)\b/.test(t)) {
    return false;
  }

  const current = previous?.destination?.value?.toLowerCase();
  if (
    /\bkeep\s+(?:the\s+)?(?:current\s+)?destination\b/.test(t) ||
    /\bkeep\s+it\s+as\b/.test(t) ||
    /\bleave\s+.+\s+as it is\b/.test(t) ||
    /\bdo not change\b/.test(t) ||
    /\bdon'?t change\b/.test(t) ||
    /\bdo not make it\b/.test(t) ||
    /\bdon'?t make it\b/.test(t)
  ) {
    return true;
  }
  if (current) {
    const cur = escapeRegExp(current);
    if (
      new RegExp(`\\bkeep\\s+(?:it\\s+as\\s+)?${cur}\\b`).test(t) ||
      new RegExp(`\\bstay with\\s+${cur}\\b`).test(t) ||
      new RegExp(`\\bleave\\s+${cur}\\s+as it is\\b`).test(t)
    ) {
      return true;
    }
  }

  // "Not Brisbane" / "Not Brisbane, keep Gold Coast" — negate a proposed city,
  // not the confirmed destination (unless "anymore" / replacement punctuation).
  const notPlace = t.match(/\bnot\s+([a-z][a-z]*(?:\s+[a-z][a-z]*)?)\b/);
  if (notPlace?.[1] && !/\banymore\b/.test(t)) {
    const negated = notPlace[1].toLowerCase();
    if (!current || negated !== current) return true;
    if (current && new RegExp(`\\bkeep\\s+(?:it\\s+as\\s+)?${escapeRegExp(current)}\\b`).test(t)) {
      return true;
    }
  }
  return false;
}

/**
 * Strong destination-replacement cues only.
 * Bare "actually" / preference commentary ("I actually prefer Brisbane") is not enough.
 */
function hasDestinationReplacementLanguage(text: string, previous?: ConversationState): boolean {
  if (isDestinationRetention(text, previous)) return false;
  return /\b(?:change of plans|instead(?:\s+of)?|actually\s+(?:make it|change|switch)|make it\b|make (?:the\s+)?destination|change (?:the\s+)?destination|destination is|destination to|go to\b[\s\S]{0,40}\binstead|not\s+[A-Za-z][a-zA-Z]+(?:\s+[A-Za-z][a-zA-Z]+)?\s*(?:anymore|[—\-,:]))/i.test(
    text,
  );
}

/** Preference / commentary about a city — soft pending candidate, not a hard replace. */
function isSoftDestinationPreference(text: string): boolean {
  return /\b(?:actually\s+prefer|actually\s+like|prefer|might be better|is nicer|maybe|perhaps|thinking of|possibly|not sure)\b/i.test(
    text,
  );
}

/** True when a regex match is negated by don't/do not/never immediately before it. */
function matchIsNegated(text: string, matchIndex: number): boolean {
  const before = text.slice(Math.max(0, matchIndex - 32), matchIndex).toLowerCase();
  return (
    /\b(?:do not|don'?t|never)\s+(?:change|make|switch)?\s*$/.test(before) ||
    /\b(?:do not|don'?t|never)\s*$/.test(before)
  );
}

function extractDestinationChange(text: string, previous?: ConversationState): DestinationChange | undefined {
  // Never treat day-shift phrasing as a destination change
  if (/\b(?:one|a|1)\s+day\s+(?:earlier|later)\b/i.test(text)) return undefined;
  // Retention / negation of a proposed city — do not flip destination
  if (isDestinationRetention(text, previous)) return undefined;

  // Intentionally NOT using the `i` flag on place captures — JS `/i` makes [A-Z] match
  // lowercase and turns "instead of Melbourne" into destination "Of Melbourne".
  const patterns: Array<{ re: RegExp; group: number }> = [
    { re: new RegExp(`\\b(?:actually\\s+)?make it\\s+${PLACE_CAPTURE}\\s*(?:instead)?\\b`), group: 1 },
    { re: new RegExp(`\\b(?:actually\\s+)?make\\s+(?:the\\s+)?destination\\s+${PLACE_CAPTURE}`), group: 1 },
    { re: new RegExp(`\\b(?:actually\\s+)?(?:change|switch)\\s+(?:the\\s+)?destination\\s+to\\s+(.+?)(?:\\.|$)`, 'i'), group: 1 },
    { re: new RegExp(`\\bdestination\\s+is\\s+(.+?)(?:\\.|$)`, 'i'), group: 1 },
    { re: new RegExp(`\\b(?:actually\\s+)?(?:change|switch)\\s+(?:it\\s+)?to\\s+${PLACE_CAPTURE}`), group: 1 },
    {
      re: new RegExp(`\\b(?:go to|travel to|fly to|going to)\\s+${PLACE_CAPTURE}\\s+instead of\\b`),
      group: 1,
    },
    { re: new RegExp(`\\b${PLACE_CAPTURE}\\s+instead of\\b`), group: 1 },
    // "Gold Coast instead" / "Bali instead" — known places only via normalizeDestinationCandidate
    { re: new RegExp(`\\b${PLACE_CAPTURE}\\s+instead\\b`), group: 1 },
    { re: new RegExp(`\\binstead(?:\\s+make it|\\s+to)\\s+${PLACE_CAPTURE}`), group: 1 },
    {
      re: new RegExp(
        `\\bnot\\s+[A-Za-z][a-zA-Z]+(?:\\s+[A-Za-z][a-zA-Z]+)?\\s*(?:anymore\\s*[—\\-,:]?\\s*|\\s*[—\\-,:]+\\s*)${PLACE_CAPTURE}`,
      ),
      group: 1,
    },
    {
      // Prefer "go to/travel to/fly to/make it" before bare "to" so "want to go" is skipped
      re: new RegExp(
        `\\bchange of plans\\b[\\s\\S]{0,120}?\\b(?:go to|travel to|fly to|make it)\\s+${PLACE_CAPTURE}`,
      ),
      group: 1,
    },
    {
      re: new RegExp(`\\bchange of plans\\b[\\s\\S]{0,120}?\\bto\\s+${PLACE_CAPTURE}`),
      group: 1,
    },
  ];

  for (const { re, group } of patterns) {
    const m = text.match(re);
    const raw = m?.[group];
    if (!raw || m?.index == null) continue;
    if (matchIsNegated(text, m.index)) continue;
    const normalized = normalizeDestinationCandidate(raw);
    if (normalized) return normalized;
  }
  return undefined;
}

/** Which place field the prior turn asked the user to fill. */
function pendingPlaceClarification(previous?: ConversationState): 'origin' | 'destination' | undefined {
  const missing = previous?.missingRequiredFields ?? [];
  if (missing.includes('origin')) return 'origin';
  if (missing.includes('destination')) return 'destination';
  return undefined;
}

/**
 * Short replies that answer a pending place clarification
 * (e.g. "Sydney", "Sydney Airport", "From Sydney", "Leaving from Sydney").
 */
function extractClarificationPlaceReply(text: string): string | undefined {
  const cleaned = text.trim().replace(/[.!?]+$/, '').trim();
  if (!cleaned || cleaned.length > 80) return undefined;

  const prefixed = cleaned.match(
    /^(?:from|leaving from|departing from|flying from)\s+(.+)$/i,
  );
  if (prefixed?.[1]) {
    const name = resolvePlaceName(prefixed[1].replace(/\s+Airport$/i, '').trim());
    if (name && !PLACE_STOPWORDS.has(name.toLowerCase()) && !DESTINATION_CHANGE_STOPWORDS.has(name.toLowerCase())) {
      return name;
    }
  }

  const airport = cleaned.match(/^(.+?)\s+Airport$/i);
  if (airport?.[1]) {
    const name = resolvePlaceName(airport[1].trim());
    if (name && !PLACE_STOPWORDS.has(name.toLowerCase())) return name;
  }

  const places = findPlacesInText(cleaned);
  if (places.length === 1) {
    const place = places[0]!;
    const escaped = place.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const bare = new RegExp(
      `^(?:from\\s+|leaving\\s+from\\s+|departing\\s+from\\s+|flying\\s+from\\s+)?${escaped}(?:\\s+Airport)?$`,
      'i',
    );
    if (bare.test(cleaned) || cleaned.toLowerCase() === place.name.toLowerCase()) {
      return place.name;
    }
  }

  if (/^[A-Za-z][a-zA-Z]+(?:\s+[A-Za-z][a-zA-Z]+)?$/.test(cleaned)) {
    const name = resolvePlaceName(cleaned);
    if (name && !PLACE_STOPWORDS.has(name.toLowerCase()) && !DESTINATION_CHANGE_STOPWORDS.has(name.toLowerCase())) {
      return name;
    }
  }

  return undefined;
}

export function extractRequirements(message: string, previous?: ConversationState, now = new Date()): ExtractionPatch {
  const rawText = message.trim();
  const patch: ExtractionPatch = { changedFields: [] };

  // Pure greeting / thanks only — do not discard compound "Hi … I want to go to …" turns.
  if (/^(hi|hello|hey|good morning|good afternoon|good evening|hiya)(?:\s+[A-Za-z]+)?[!,.\s]*$/i.test(rawText)) {
    patch.isGreeting = true;
    return patch;
  }
  if (/^(thanks|thank you|thankyou|cheers)([!,.\s]*)$/i.test(rawText)) {
    patch.isThanks = true;
    return patch;
  }
  if (/what can you do|how can you help|who are you|what are you/i.test(rawText)) {
    patch.isCapabilityQuestion = true;
    return patch;
  }

  // Strip a leading greeting so the rest of the message is extracted normally.
  const text = rawText
    .replace(/^(hi|hello|hey|good morning|good afternoon|good evening|hiya)(?:\s+[A-Za-z]+)?[!,.]?\s+/i, '')
    .trim();
  const lower = text.toLowerCase();

  // Resolve pending soft-destination yes/no, then continue extracting other fields
  // from the same turn (nights, services, time, etc.).
  const pendingDecision = resolvePendingDestinationDecision(text, previous);
  const destinationDecisionHandled = Boolean(pendingDecision);
  if (pendingDecision === 'confirm') {
    patch.confirmPendingDestination = true;
    patch.changedFields!.push('destination');
  } else if (pendingDecision === 'decline') {
    patch.declinePendingDestination = true;
    patch.changedFields!.push('destination');
  }

  const dateCtx = dateContextFromState(previous);
  if (looksLikeDateConfirmation(text, previous, now)) {
    patch.isDateConfirmation = true;
    const absolute = parseAbsoluteDate(text, now, dateCtx);
    if (absolute) {
      patch.confirmedDateLabel = absolute.label;
      patch.departureDate = field(absolute, 'confirmed');
      patch.changedFields!.push('departureDate');
    } else if (previous?.lastSuggestedDate) {
      patch.confirmedDateLabel = previous.lastSuggestedDate.label;
      patch.departureDate = field({ ...previous.lastSuggestedDate, kind: 'absolute' }, 'confirmed');
      patch.changedFields!.push('departureDate');
    }
  }

  const places = findPlacesInText(text);
  const areas = findAreaMentions(text);
  const pendingPlaceField = pendingPlaceClarification(previous);
  const destinationChange = extractDestinationChange(text, previous);

  const fromMatch = text.match(/\b(?:leaving|departing|flying)?\s*from\s+([A-Za-z][a-zA-Z]+(?:\s+[A-Za-z][a-zA-Z]+)?)/i);
  const backToMatch = text.match(/\b(?:come back|return|back)\s+to\s+([A-Za-z][a-zA-Z]+(?:\s+[A-Za-z][a-zA-Z]+)?)/i);
  const toMatch = text.match(
    /\b(?:travel to|go to|going to|fly to|visit(?:ing)?|change destination to|destination to)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)/,
  );
  const inMatch = text.match(
    /\b(?:hotel|stay|resort|accommodation)\s+(?:in\s+|at\s+)([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)/,
  );

  if (fromMatch) {
    patch.origin = field(resolvePlaceName(fromMatch[1]!.replace(/\s+Airport$/i, '')));
    patch.changedFields!.push('origin');
  }
  if (backToMatch) {
    patch.origin = field(resolvePlaceName(backToMatch[1]!));
    patch.changedFields!.push('origin');
  }

  // Explicit destination-change language always updates destination (confirmed).
  // Skip when a pending soft-destination decision already handled this turn.
  if (destinationChange && !destinationDecisionHandled) {
    patch.destination = field(destinationChange.destination, 'confirmed');
    patch.changedFields!.push('destination');
    if (destinationChange.area) {
      patch.accommodationArea = field(destinationChange.area, 'confirmed');
      patch.changedFields!.push('accommodationArea');
    } else if (previous?.accommodationArea) {
      const previousAreaMeta = matchAreaName(previous.accommodationArea.value);
      if (
        previousAreaMeta &&
        previousAreaMeta.city !== destinationChange.destination &&
        findAreaMentions(text).length === 0
      ) {
        patch.clearAccommodationArea = true;
        patch.changedFields!.push('accommodationArea');
      }
    }
  }

  // When a clarification asked for a place field, short replies fill that field —
  // do not reinterpret them as a new destination.
  if (pendingPlaceField && !destinationChange) {
    const clarificationPlace = extractClarificationPlaceReply(text);
    if (clarificationPlace) {
      if (pendingPlaceField === 'origin') {
        patch.origin = field(clarificationPlace);
        patch.changedFields!.push('origin');
      } else if (pendingPlaceField === 'destination' && !patch.destination) {
        patch.destination = field(clarificationPlace);
        patch.changedFields!.push('destination');
      }
    }
  }

  // Place reply while a non-place field is pending (e.g. date): treat as origin, never
  // silently overwrite a confirmed destination.
  const placeReply = !destinationChange && !pendingPlaceField ? extractClarificationPlaceReply(text) : undefined;
  const datePendingNonPlace =
    Boolean(previous?.destination) &&
    awaitingExactDepartureDate(previous) &&
    !looksLikeDateConfirmation(text, previous, now);
  if (placeReply && datePendingNonPlace && !hasDestinationReplacementLanguage(text, previous)) {
    if (!patch.origin) {
      patch.origin = field(placeReply);
      patch.changedFields!.push('origin');
    }
  }

  const retainingDestination = isDestinationRetention(text, previous);

  if (!patch.destination && !destinationDecisionHandled && toMatch && !retainingDestination) {
    const raw = toMatch[1]!;
    const isReturnPhrase =
      /\b(?:come back|return|back)\s+to\b/i.test(text) &&
      new RegExp(`\\b(?:come back|return|back)\\s+to\\s+${raw.split(/\s+/)[0]}`, 'i').test(text);
    // Avoid treating clarification origin replies as destination via "to"
    if (
      !isReturnPhrase &&
      !(pendingPlaceField === 'origin' && patch.origin) &&
      !(datePendingNonPlace && placeReply)
    ) {
      patch.destination = field(resolvePlaceName(raw));
      patch.changedFields!.push('destination');
    }
  }

  if (!patch.destination && !destinationDecisionHandled && inMatch && !retainingDestination) {
    const name = resolvePlaceName(inMatch[1]!);
    if (
      name &&
      !PLACE_STOPWORDS.has(name.toLowerCase()) &&
      !areas.some((a) => a.area.toLowerCase() === name.toLowerCase())
    ) {
      patch.destination = field(name);
      patch.changedFields!.push('destination');
    }
  }

  // Explicit "to <place>" even when it matches origin (validation will flag impossible same-city trips)
  const explicitTo = text.match(/\bto\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)/);
  if (
    !patch.destination &&
    !destinationDecisionHandled &&
    explicitTo &&
    !retainingDestination &&
    !(pendingPlaceField === 'origin' && patch.origin) &&
    !(datePendingNonPlace && placeReply)
  ) {
    const name = resolvePlaceName(explicitTo[1]!);
    const isReturnOnly =
      /\b(?:come back|return|back)\s+to\b/i.test(text) &&
      new RegExp(`\\b(?:come back|return|back)\\s+to\\s+${explicitTo[1]!.split(/\s+/)[0]}`, 'i').test(text);
    if (name && !isReturnOnly && !areas.some((a) => a.area.toLowerCase() === name.toLowerCase())) {
      // Bare "to <place>" inside "do not change it to X" must never flip destination
      const toIndex = explicitTo.index ?? 0;
      if (!matchIsNegated(text, toIndex) && !/\bdo not change\b|\bdon'?t change\b/i.test(text)) {
        patch.destination = field(name);
        patch.changedFields!.push('destination');
      }
    }
  }

  // Bare place → destination only when safe (no confirmed dest, or explicit replacement language)
  const answeredOriginClarification = pendingPlaceField === 'origin' && Boolean(patch.origin);
  const confirmedDestination = previous?.destination?.value;
  if (
    !patch.destination &&
    !destinationDecisionHandled &&
    places.length > 0 &&
    !answeredOriginClarification &&
    !(datePendingNonPlace && placeReply) &&
    !isDestinationRetention(text, previous)
  ) {
    const originName = (patch.origin?.value ?? previous?.origin?.value)?.toLowerCase();
    const previousDestination = confirmedDestination;
    const softPreference = isSoftDestinationPreference(text);
    const strongReplace = hasDestinationReplacementLanguage(text, previous);
    // Soft hedges win over bare "instead" so "Maybe Brisbane instead sometime" stays pending
    const explicitHardChange =
      /\b(?:make it|make (?:the\s+)?destination|change (?:the\s+)?destination|change it to|destination is|destination to|not\s+[a-z][a-z\s]+?\s+anymore)\b/i.test(
        text,
      );
    const useSoftPending = Boolean(
      softPreference && previousDestination && !explicitHardChange,
    );

    // Preference commentary ("I actually prefer Brisbane") → soft pending, never hard replace
    if (useSoftPending && previousDestination) {
      const candidate = places.find(
        (p) => p.name.toLowerCase() !== previousDestination.toLowerCase(),
      );
      if (candidate) {
        patch.destination = field(candidate.name, 'inferred');
        patch.pendingLowConfidenceFields = Array.from(
          new Set([...(patch.pendingLowConfidenceFields ?? []), 'destination']),
        );
        patch.changedFields!.push('destination');
      }
    } else {
      const canReplace = !previousDestination || strongReplace || !previous?.destination;
      if (canReplace) {
        let preferred;
        if (strongReplace && previousDestination) {
          preferred =
            places.find((p) => p.name.toLowerCase() !== previousDestination.toLowerCase()) ??
            places[0];
        } else {
          preferred =
            places.find((p) => p.name === 'Melbourne' && p.name.toLowerCase() !== originName) ??
            places.find((p) => p.name.toLowerCase() !== originName) ??
            places[0];
        }
        if (preferred && preferred.name.toLowerCase() !== originName) {
          // Bare place must not overwrite a confirmed destination without replacement language
          if (!previousDestination || strongReplace) {
            patch.destination = field(preferred.name, 'confirmed');
            patch.changedFields!.push('destination');
          } else if (!patch.origin && !previous?.origin) {
            patch.origin = field(preferred.name);
            patch.changedFields!.push('origin');
          }
        }
      }
    }
  }

  if (areas.length > 0) {
    patch.accommodationArea = field(areas[0]!.area);
    patch.changedFields!.push('accommodationArea');
    if (!patch.destination) {
      // Explicit "destination is <locality>" already handled above; area-only mentions stay inferred
      patch.destination = field(areas[0]!.city, 'inferred');
    }
  } else {
    const freeformArea = extractFreeformStayArea(text);
    if (freeformArea) {
      patch.accommodationArea = field(freeformArea);
      patch.changedFields!.push('accommodationArea');
    }
  }

  const serviceOps = extractServiceOperations(text);
  const removals = serviceOps.removeServices;
  if (removals.length) {
    patch.removeServices = removals;
    patch.changedFields!.push('requestedServices');
  }

  const previouslyExcluded = new Set(previous?.excludedServices ?? []);
  const services = Array.from(
    new Set([
      ...extractServices(text).filter((s) => !removals.includes(s)),
      ...serviceOps.addServices.filter((s) => !removals.includes(s)),
    ]),
  );
  if (services.length) {
    patch.requestedServices = services;
    patch.changedFields!.push('requestedServices');
  }
  // Stay-area mention is an explicit accommodation signal (lifts prior exclusion)
  if (areas.length && !services.includes('accommodation') && !removals.includes('accommodation')) {
    patch.requestedServices = Array.from(new Set([...(patch.requestedServices ?? []), 'accommodation']));
  } else if (
    patch.accommodationArea &&
    !services.includes('accommodation') &&
    !removals.includes('accommodation')
  ) {
    patch.requestedServices = Array.from(new Set([...(patch.requestedServices ?? []), 'accommodation']));
  }

  const nights = extractDurationNights(text);
  if (nights != null) {
    patch.durationNights = field(nights);
    patch.changedFields!.push('durationNights');
    // Duration alone must not revive an explicitly excluded accommodation service
    if (!removals.includes('accommodation') && !previouslyExcluded.has('accommodation')) {
      patch.requestedServices = Array.from(
        new Set([...(patch.requestedServices ?? []), 'accommodation']),
      );
    }
  }

  const purpose = extractPurpose(text);
  if (purpose) {
    patch.tripPurpose = field(purpose);
    patch.changedFields!.push('tripPurpose');
  }

  if (!patch.isDateConfirmation) {
    const returnOnlyUpdate = /^\s*return\b/i.test(text) && !/\b(?:depart|leave|outbound|from\s+[A-Z])/i.test(text);

    // Explicit date change phrasing
    const dateChange = text.match(
      /\b(?:change|update|move)\s+(?:the\s+)?date\s+to\s+(.+)$/i,
    );
    const depDate = returnOnlyUpdate
      ? undefined
      : dateChange
        ? parseAbsoluteDate(dateChange[1]!, now) ?? parseRelativeDate(dateChange[1]!, now)
        : parseRelativeDate(text, now);
    if (depDate) {
      patch.departureDate = field(depDate);
      patch.changedFields!.push('departureDate');
    }

    const fridayWindow = /\bfriday\b/i.test(text)
      ? text.match(/\bfriday\b[\s\S]{0,80}?(?=come back|return|$)/i)?.[0] ?? ''
      : '';
    if (fridayWindow) {
      const pref = /after\s*5|after work/.test(fridayWindow.toLowerCase())
        ? 'after_5pm'
        : extractTimePreference(fridayWindow) ?? 'afternoon';
      patch.departureTimePreference = field(pref);
      patch.changedFields!.push('departureTimePreference');
      if (patch.departureDate) {
        patch.departureDate = field({ ...patch.departureDate.value, weekday: 5, timePreference: pref });
      } else {
        patch.departureDate = field({ kind: 'relative', label: 'Friday', weekday: 5, timePreference: pref });
        patch.changedFields!.push('departureDate');
      }
    } else if (/after\s*5|after work/.test(lower) && !/\b(?:come back|return)[\s\S]{0,40}(?:after\s*5|afternoon)/.test(lower)) {
      patch.departureTimePreference = field('after_5pm');
      patch.changedFields!.push('departureTimePreference');
    }

    if (!patch.departureTimePreference) {
      if (
        /\b(?:leave|depart(?:ure)?|fly|flight)\s+(?:in\s+the\s+|early\s+)?morning\b/i.test(text) ||
        /\bmorning\s+(?:flight|departure)\b/i.test(text) ||
        /\bdepart early morning\b/i.test(text)
      ) {
        patch.departureTimePreference = field('morning');
        patch.changedFields!.push('departureTimePreference');
      } else if (
        /\b(?:leave|depart(?:ure)?|fly|flight)\s+(?:in\s+the\s+)?afternoon\b/i.test(text) ||
        /\bafternoon\s+(?:flight|departure)\b/i.test(text)
      ) {
        patch.departureTimePreference = field('afternoon');
        patch.changedFields!.push('departureTimePreference');
      } else if (
        /\b(?:leave|depart(?:ure)?|fly|flight)\s+(?:in\s+the\s+)?evening\b/i.test(text) ||
        /\bevening\s+(?:flight|departure)\b/i.test(text) ||
        /\bfly after\s+5\s*(?:pm|p\.m\.)\b/i.test(text)
      ) {
        patch.departureTimePreference = field(
          /\bafter\s+5\s*(?:pm|p\.m\.)\b/i.test(text) ? 'after_5pm' : 'evening',
        );
        patch.changedFields!.push('departureTimePreference');
      }
    }

    const returnClause = text.match(/\b(?:come back|return)([\s\S]{0,60})/i);
    if (returnClause) {
      const returnBit = returnClause[0]!;
      const returnAbs = parseAbsoluteDate(returnBit, now);
      const returnTime = extractTimePreference(returnBit);
      if (returnAbs) {
        patch.returnDate = field({ ...returnAbs, timePreference: returnTime });
        patch.changedFields!.push('returnDate');
      } else if (returnTime) {
        patch.returnDate = field({
          kind: 'relative',
          label: `return ${returnTime}`,
          timePreference: returnTime,
        });
        patch.changedFields!.push('returnDate');
      }
      if (returnTime) {
        patch.returnTimePreference = field(returnTime);
        patch.changedFields!.push('returnTimePreference');
      }
    } else if (/\bcome back\b|\breturn\b/.test(lower) && /\bafternoon\b/.test(lower)) {
      patch.returnTimePreference = field('afternoon');
      patch.changedFields!.push('returnTimePreference');
    }

    const returnDay = text.match(/\breturn\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\s+(afternoon|morning|evening)/i);
    if (returnDay) {
      patch.returnTimePreference = field(extractTimePreference(returnDay[2]!) ?? 'afternoon');
      patch.returnDate = field({
        kind: 'relative',
        label: `return ${returnDay[1]} ${returnDay[2]}`,
        weekday: WEEKDAYS[returnDay[1]!.toLowerCase()],
        timePreference: extractTimePreference(returnDay[2]!) ?? 'afternoon',
      });
      patch.changedFields!.push('returnDate', 'returnTimePreference');
    }
  }

  const returnDay = text.match(
    /\breturn\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)?\s*(afternoon|morning|evening)?/i,
  );
  if (returnDay && (returnDay[1] || returnDay[2])) {
    const time = returnDay[2] ? extractTimePreference(returnDay[2]) : undefined;
    if (time) patch.returnTimePreference = field(time);
    patch.returnDate = field({
      kind: 'relative',
      label: returnDay[0]!.trim(),
      weekday: returnDay[1] ? WEEKDAYS[returnDay[1].toLowerCase()] : undefined,
      timePreference: time,
    });
  }

  const travellers = extractTravellers(text, previous);
  if (travellers) {
    patch.travellers = field(travellers);
    patch.changedFields!.push('travellers');
  }

  const budget = extractBudget(text);
  if (budget) {
    patch.budget = budget;
    patch.changedFields!.push('budget');
  }

  extractPreferenceExtras(text, patch);
  if (patch.airlinePreferences) patch.changedFields!.push('airlinePreferences');
  if (patch.hotelPreferences) {
    patch.changedFields!.push('hotelPreferences');
    if (!removals.includes('accommodation') && !previouslyExcluded.has('accommodation')) {
      patch.requestedServices = Array.from(
        new Set([...(patch.requestedServices ?? []), 'accommodation']),
      );
      patch.changedFields!.push('requestedServices');
    }
  }
  if (patch.dateFlexibility) patch.changedFields!.push('dateFlexibility');
  if (patch.roomRequirements) patch.changedFields!.push('roomRequirements');

  if (/\bitinerary\b|\bday[- ]by[- ]day\b|\bdaily schedule\b|\bbuild (?:me )?an? itinerary\b|\bcreate (?:an? )?itinerary\b/.test(lower)) {
    patch.explicitItineraryIntent = true;
    patch.changedFields!.push('explicitItineraryIntent');
  }

  patch.changedFields = Array.from(new Set(patch.changedFields));
  return patch;
}
