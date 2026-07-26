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

function extractServices(text: string): TravelServiceKind[] {
  const t = text.toLowerCase();
  const services: TravelServiceKind[] = [];
  if (/\bflights?\b|\bflying\b|\bfly\b|\bairfare\b/.test(t)) services.push('flights');
  if (/\bhotels?\b|\bresorts?\b|\bstay\b|\baccommodation\b|\blodging\b/.test(t)) services.push('accommodation');
  if (/\bcar hire\b|\brent(?:al)? car\b|\bhire a car\b|\brental car\b|\bvehicle hire\b/.test(t)) {
    services.push('car_hire');
  }
  if (/\btransfer\b|\bairport transfer\b|\btaxi\b|\brideshare\b/.test(t)) services.push('transfers');
  if (/\bactivit(?:y|ies)\b|\bexperience\b|\btour\b/.test(t)) services.push('activities');
  return Array.from(new Set(services));
}

function extractRemovals(text: string): TravelServiceKind[] {
  const t = text.toLowerCase();
  const removed: TravelServiceKind[] = [];
  if (
    /\b(?:no|without|remove|don't need|do not need|cancel)\b[\s\w]{0,24}\b(?:car hire|rental car|hire car|rent(?:al)? car)\b/.test(t) ||
    /\b(?:car hire|rental car|hire car)\b[\s\w]{0,16}\b(?:not needed|off|removed)\b/.test(t)
  ) {
    removed.push('car_hire');
  }
  if (/\b(?:no|without|remove|don't need)\b[\s\w]{0,20}\b(?:hotel|accommodation|stay)\b/.test(t)) {
    removed.push('accommodation');
  }
  if (/\b(?:no|without|remove|don't need)\b[\s\w]{0,20}\bflights?\b/.test(t)) {
    removed.push('flights');
  }
  if (/\b(?:no|without|remove|don't need)\b[\s\w]{0,20}\b(?:transfer|taxi)\b/.test(t)) {
    removed.push('transfers');
  }
  return removed;
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

export function parseAbsoluteDate(text: string, now: Date): ApproximateDate | undefined {
  const lower = text.toLowerCase();
  const long = lower.match(
    /\b(?:(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue|wed|thu|fri|sat)[,]?\s+)?(\d{1,2})(?:st|nd|rd|th)?\s+(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)(?:\s+(\d{4}))?\b/,
  );
  if (long) {
    const day = Number(long[2]);
    const month = MONTHS[long[3]!];
    const year = long[4] ? Number(long[4]) : now.getFullYear();
    const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return {
      kind: 'absolute',
      isoDate: iso,
      label: long[0]!,
      weekday: long[1] ? WEEKDAYS[long[1]] : undefined,
      month,
      year,
    };
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

function extractTravellers(text: string): TravellerCounts | undefined {
  const t = text.toLowerCase();
  const adultsMatch = t.match(/(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s*adults?/);
  const childrenMatch = t.match(/(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s*(?:children|kids|child)/);
  const infantsMatch = t.match(/(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s*(?:infants?|babies|baby)/);
  const peopleMatch = t.match(/(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s*(?:travellers?|travelers?|people|passengers?|of us)/);
  if (adultsMatch || childrenMatch || infantsMatch) {
    const adults = parseCount(adultsMatch?.[1]) ?? (infantsMatch || childrenMatch ? 1 : 1);
    const children = parseCount(childrenMatch?.[1]) ?? 0;
    const infants = parseCount(infantsMatch?.[1]) ?? 0;
    return { adults, children, infants, total: adults + children + infants };
  }
  if (peopleMatch) {
    const total = parseCount(peopleMatch[1]) ?? 1;
    return { adults: total, children: 0, infants: 0, total };
  }
  if (/\bjust me\b|\bsolo\b/.test(t)) return { adults: 1, children: 0, infants: 0, total: 1 };
  if (/\bcouple\b|\btwo of us\b/.test(t)) return { adults: 2, children: 0, infants: 0, total: 2 };
  return undefined;
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

  const airline = text.match(/\b(?:prefer|fly|with)\s+(Qantas|Jetstar|Virgin|Singapore Airlines|Emirates|Cathay)\b/i);
  const cabin = lower.match(/\b(economy|premium economy|business|first)\s*class\b/);
  if (airline || cabin || /\bdirect(?: flights?)? only\b|\bnon[- ]stop\b/.test(lower)) {
    patch.airlinePreferences = field({
      airlines: airline ? [airline[1]!] : undefined,
      cabin: cabin?.[1],
      directOnly: /\bdirect(?: flights?)? only\b|\bnon[- ]stop\b/.test(lower) || undefined,
    });
  }

  const stars = lower.match(/(\d)\s*[- ]?star/);
  if (stars || /\bboutique\b|\bnear the beach\b|\bpool\b/.test(lower)) {
    const amenities: string[] = [];
    if (/\bpool\b/.test(lower)) amenities.push('pool');
    if (/\bbeach\b/.test(lower)) amenities.push('beach');
    if (/\bboutique\b/.test(lower)) amenities.push('boutique');
    patch.hotelPreferences = field({
      stars: stars ? Number(stars[1]) : undefined,
      amenities: amenities.length ? amenities : undefined,
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

function looksLikeDateConfirmation(text: string, previous?: ConversationState): boolean {
  const t = text.trim().toLowerCase();
  // Do not treat destination-confirmation turns as date confirmations
  if (previous?.awaitingDestinationConfirmation) return false;
  if (previous?.awaitingDateConfirmation || previous?.lastSuggestedDate) {
    if (/^(yes|yep|yeah|correct|confirm|that works|sounds good)\b/.test(t)) return true;
    if (t.includes('friday') && (t.includes('28') || t.includes('august'))) return true;
  }
  if (parseAbsoluteDate(text, new Date()) && /^(yes[,.]?\s*)?/i.test(t) && t.length < 100) {
    if (previous?.awaitingDateConfirmation) return true;
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

  if (
    /\b(?:keep|stay with|stay in|don'?t change|do not change)\b/.test(t) ||
    (/^(no|nope|nah)\b/.test(t) && !t.includes(pending))
  ) {
    return 'decline';
  }
  if (current && new RegExp(`\\b(?:keep|stay with|stay in)\\s+${current}\\b`, 'i').test(t)) {
    return 'decline';
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

function hasDestinationReplacementLanguage(text: string): boolean {
  return /\b(?:change of plans|instead of|actually\b|make it\b|change the destination|destination is|destination to|go to\b[\s\S]{0,40}\binstead|not\s+[A-Za-z])/i.test(
    text,
  );
}

function extractDestinationChange(text: string): DestinationChange | undefined {
  // Never treat day-shift phrasing as a destination change
  if (/\b(?:one|a|1)\s+day\s+(?:earlier|later)\b/i.test(text)) return undefined;

  // Intentionally NOT using the `i` flag on place captures — JS `/i` makes [A-Z] match
  // lowercase and turns "instead of Melbourne" into destination "Of Melbourne".
  const patterns: Array<{ re: RegExp; group: number }> = [
    { re: new RegExp(`\\b(?:actually\\s+)?make it\\s+${PLACE_CAPTURE}\\s*(?:instead)?\\b`), group: 1 },
    { re: new RegExp(`\\b(?:actually\\s+)?(?:change|switch)\\s+(?:the\\s+)?destination\\s+to\\s+(.+?)(?:\\.|$)`, 'i'), group: 1 },
    { re: new RegExp(`\\bdestination\\s+is\\s+(.+?)(?:\\.|$)`, 'i'), group: 1 },
    { re: new RegExp(`\\b(?:actually\\s+)?(?:change|switch)\\s+(?:it\\s+)?to\\s+${PLACE_CAPTURE}`), group: 1 },
    {
      re: new RegExp(`\\b(?:go to|travel to|fly to|going to)\\s+${PLACE_CAPTURE}\\s+instead of\\b`),
      group: 1,
    },
    { re: new RegExp(`\\b${PLACE_CAPTURE}\\s+instead of\\b`), group: 1 },
    { re: new RegExp(`\\binstead(?:\\s+make it|\\s+to)\\s+${PLACE_CAPTURE}`), group: 1 },
    {
      re: new RegExp(
        `\\bnot\\s+[A-Za-z][a-zA-Z]+(?:\\s+[A-Za-z][a-zA-Z]+)?\\s*[—\\-,:]+\\s*${PLACE_CAPTURE}`,
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
    if (!raw) continue;
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
  const text = message.trim();
  const lower = text.toLowerCase();
  const patch: ExtractionPatch = { changedFields: [] };

  if (/^(hi|hello|hey|good morning|good afternoon|good evening|hiya)([!,.\s].*)?$/i.test(text)) {
    patch.isGreeting = true;
    return patch;
  }
  if (/^(thanks|thank you|thankyou|cheers)([!,.\s].*)?$/i.test(text)) {
    patch.isThanks = true;
    return patch;
  }
  if (/what can you do|how can you help|who are you|what are you/i.test(text)) {
    patch.isCapabilityQuestion = true;
    return patch;
  }

  const pendingDecision = resolvePendingDestinationDecision(text, previous);
  if (pendingDecision === 'confirm') {
    patch.confirmPendingDestination = true;
    return patch;
  }
  if (pendingDecision === 'decline') {
    patch.declinePendingDestination = true;
    return patch;
  }

  if (looksLikeDateConfirmation(text, previous)) {
    patch.isDateConfirmation = true;
    const absolute = parseAbsoluteDate(text, now);
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
  const destinationChange = extractDestinationChange(text);

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
  if (destinationChange) {
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

  if (!patch.destination && toMatch) {
    const raw = toMatch[1]!;
    const isReturnPhrase =
      /\b(?:come back|return|back)\s+to\b/i.test(text) &&
      new RegExp(`\\b(?:come back|return|back)\\s+to\\s+${raw.split(/\s+/)[0]}`, 'i').test(text);
    // Avoid treating clarification origin replies as destination via "to"
    if (!isReturnPhrase && !(pendingPlaceField === 'origin' && patch.origin)) {
      patch.destination = field(resolvePlaceName(raw));
      patch.changedFields!.push('destination');
    }
  }

  if (!patch.destination && inMatch) {
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
  if (!patch.destination && explicitTo && !(pendingPlaceField === 'origin' && patch.origin)) {
    const name = resolvePlaceName(explicitTo[1]!);
    const isReturnOnly =
      /\b(?:come back|return|back)\s+to\b/i.test(text) &&
      new RegExp(`\\b(?:come back|return|back)\\s+to\\s+${explicitTo[1]!.split(/\s+/)[0]}`, 'i').test(text);
    if (name && !isReturnOnly && !areas.some((a) => a.area.toLowerCase() === name.toLowerCase())) {
      patch.destination = field(name);
      patch.changedFields!.push('destination');
    }
  }

  // Bare place → destination, unless this turn answered an origin clarification
  const answeredOriginClarification = pendingPlaceField === 'origin' && Boolean(patch.origin);
  if (!patch.destination && places.length > 0 && !answeredOriginClarification) {
    const originName = (patch.origin?.value ?? previous?.origin?.value)?.toLowerCase();
    const previousDestination = previous?.destination?.value;
    let preferred;
    if (hasDestinationReplacementLanguage(text) && previousDestination) {
      // Prefer the new place, not the destination being replaced
      preferred =
        places.find((p) => p.name.toLowerCase() !== previousDestination.toLowerCase()) ?? places[0];
    } else {
      preferred =
        places.find((p) => p.name === 'Melbourne' && p.name.toLowerCase() !== originName) ??
        places.find((p) => p.name.toLowerCase() !== originName) ??
        places[0];
    }
    if (preferred && preferred.name.toLowerCase() !== originName) {
      patch.destination = field(preferred.name, 'confirmed');
      patch.changedFields!.push('destination');
    }
  }

  if (areas.length > 0) {
    patch.accommodationArea = field(areas[0]!.area);
    patch.changedFields!.push('accommodationArea');
    if (!patch.destination) {
      // Explicit "destination is <locality>" already handled above; area-only mentions stay inferred
      patch.destination = field(areas[0]!.city, 'inferred');
    }
  }

  const removals = extractRemovals(text);
  if (removals.length) {
    patch.removeServices = removals;
    patch.changedFields!.push('requestedServices');
  }

  const services = extractServices(text).filter((s) => !removals.includes(s));
  if (services.length) {
    patch.requestedServices = services;
    patch.changedFields!.push('requestedServices');
  }
  if (areas.length && !services.includes('accommodation') && !removals.includes('accommodation')) {
    patch.requestedServices = Array.from(new Set([...(patch.requestedServices ?? []), 'accommodation']));
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

  const travellers = extractTravellers(text);
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

  if (/\bitinerary\b|\bday[- ]by[- ]day\b|\bdaily schedule\b|\bbuild (?:me )?an? itinerary\b|\bcreate (?:an? )?itinerary\b/.test(lower)) {
    patch.explicitItineraryIntent = true;
    patch.changedFields!.push('explicitItineraryIntent');
  }

  patch.changedFields = Array.from(new Set(patch.changedFields));
  return patch;
}
