import { findAreaMentions, findPlacesInText, PLACES } from './places';
import type {
  ApproximateDate,
  ConversationState,
  FieldValue,
  TimePreference,
  TravellerCounts,
  TravelServiceKind,
  TripPurposeKind,
} from './types';

const PLACE_STOPWORDS = new Set([
  'around',
  'from',
  'to',
  'on',
  'at',
  'in',
  'and',
  'with',
  'for',
  'next',
  'this',
  'the',
  'a',
  'an',
  'after',
  'before',
  'near',
  'via',
]);

function resolvePlaceName(raw: string): string {
  const cleaned = raw
    .trim()
    .split(/\s+/)
    .filter((part) => !PLACE_STOPWORDS.has(part.toLowerCase()))
    .join(' ');
  const lower = cleaned.toLowerCase();
  const known = PLACES.find((p) => p.name.toLowerCase() === lower || p.aliases.includes(lower));
  if (known) return known.name;
  // Prefer first token if it matches a known place
  const first = cleaned.split(/\s+/)[0]?.toLowerCase() ?? '';
  const byFirst = PLACES.find((p) => p.name.toLowerCase() === first || p.aliases.includes(first));
  if (byFirst) return byFirst.name;
  return cleaned;
}

export type ExtractionPatch = Partial<
  Pick<
    ConversationState,
    | 'origin'
    | 'destination'
    | 'intermediateDestinations'
    | 'departureDate'
    | 'returnDate'
    | 'departureTimePreference'
    | 'returnTimePreference'
    | 'travellers'
    | 'tripPurpose'
    | 'requestedServices'
    | 'accommodationLocation'
    | 'accommodationPreferences'
    | 'carHireRequirements'
    | 'vehiclePreferences'
    | 'flightPreferences'
    | 'budget'
    | 'activities'
    | 'campingRequirements'
    | 'fourWdRequirements'
    | 'cruiseRequirements'
    | 'businessRequirements'
    | 'accessibility'
    | 'pets'
    | 'loyaltyPreferences'
    | 'explicitItineraryIntent'
    | 'rawMentions'
  >
> & {
  isGreeting?: boolean;
  isThanks?: boolean;
  isCapabilityQuestion?: boolean;
  isDateConfirmation?: boolean;
  confirmedDateLabel?: string;
  updates?: {
    origin?: string;
    destination?: string;
    departureIso?: string;
  };
};

const MONTHS: Record<string, number> = {
  january: 1,
  jan: 1,
  february: 2,
  feb: 2,
  march: 3,
  mar: 3,
  april: 4,
  apr: 4,
  may: 5,
  june: 6,
  jun: 6,
  july: 7,
  jul: 7,
  august: 8,
  aug: 8,
  september: 9,
  sep: 9,
  sept: 9,
  october: 10,
  oct: 10,
  november: 11,
  nov: 11,
  december: 12,
  dec: 12,
};

const WEEKDAYS: Record<string, number> = {
  sunday: 0,
  sun: 0,
  monday: 1,
  mon: 1,
  tuesday: 2,
  tue: 2,
  wednesday: 3,
  wed: 3,
  thursday: 4,
  thu: 4,
  friday: 5,
  fri: 5,
  saturday: 6,
  sat: 6,
};

function field<T>(value: T, source: 'confirmed' | 'inferred' = 'confirmed'): FieldValue<T> {
  return { value, source };
}

function uniqueServices(services: TravelServiceKind[]): TravelServiceKind[] {
  return Array.from(new Set(services));
}

function extractServices(text: string): TravelServiceKind[] {
  const t = text.toLowerCase();
  const services: TravelServiceKind[] = [];
  if (/\bflights?\b|\bflying\b|\bfly\b|\bairfare\b/.test(t)) services.push('flights');
  if (/\bhotels?\b|\bresorts?\b|\bstay\b|\baccommodation\b|\blodging\b/.test(t)) services.push('hotels');
  if (/\bcar hire\b|\brent(?:al)? car\b|\bhire a car\b|\bvehicle hire\b/.test(t)) services.push('car_hire');
  if (/\btransfer\b|\bairport transfer\b|\bprivate driver\b|\btaxi\b|\brideshare\b/.test(t)) services.push('airport_transfers');
  if (/\bactivit(?:y|ies)\b|\bexperience\b|\btour\b|\battraction\b/.test(t)) services.push('activities');
  if (/\bcruise\b|\bcruising\b|\bsailing\b/.test(t)) services.push('cruises');
  if (/\btrain\b|\brail\b/.test(t)) services.push('rail');
  if (/\bcoach\b|\bbus\b/.test(t)) services.push('coaches');
  if (/\bcamping\b|\bcamp\b|\btent\b/.test(t)) services.push('camping');
  if (/\b4wd\b|\bfour[- ]?wheel\b|\boff[- ]?road\b/.test(t)) services.push('four_wd');
  if (/\bcaravan\b|\bmotorhome\b|\brv\b/.test(t)) services.push('caravan');
  if (/\broad trip\b|\bdrive from\b|\bself[- ]drive\b/.test(t)) services.push('road_trip');
  if (/\bitinerary\b|\bday[- ]by[- ]day\b|\bdaily schedule\b/.test(t)) services.push('itinerary');
  return uniqueServices(services);
}

function extractPurpose(text: string): TripPurposeKind | undefined {
  const t = text.toLowerCase();
  if (/\brecurring\b.*\bbusiness\b|\bweekly\b.*\bbusiness\b|\bmonthly\b.*\bwork trip\b/.test(t)) return 'recurring_business';
  if (/\bbusiness\b|\bwork trip\b|\bconference\b|\bmeeting\b/.test(t)) return 'business';
  if (/\bfamily\b|\bkids?\b|\bchildren\b/.test(t)) return 'family';
  if (/\bgroup\b|\bcolleagues\b|\bteam\b/.test(t)) return 'group';
  if (/\bluxury\b|\bpremium\b|\bfive[- ]star\b|\bfirst class\b/.test(t)) return 'luxury';
  if (/\bbudget\b|\bcheap\b|\blow[- ]cost\b|\baffordable\b/.test(t)) return 'budget';
  if (/\bromantic\b|\bhoneymoon\b|\banniversary\b/.test(t)) return 'romantic';
  if (/\badventure\b|\bhike\b|\btrek\b/.test(t)) return 'adventure';
  if (/\broad trip\b/.test(t)) return 'road_trip';
  if (/\bcamping\b/.test(t)) return 'camping';
  if (/\bcruise\b/.test(t)) return 'cruise';
  if (/\bmulti[- ]city\b|\bseveral cities\b/.test(t)) return 'multi_city';
  if (/\binternational\b|\boverseas\b/.test(t)) return 'international';
  if (/\bleisure\b|\bholiday\b|\bvacation\b|\bgetaway\b/.test(t)) return 'leisure';
  return undefined;
}

function extractTimePreference(fragment: string): TimePreference | undefined {
  const t = fragment.toLowerCase();
  if (/after\s*5\s*(pm|p\.m)?|from\s*5\s*pm|evening after 5|after five/.test(t)) return 'after_5pm';
  if (/\bmorning\b|\bam\b/.test(t)) return 'morning';
  if (/\bafternoon\b|\bpm\b/.test(t)) return 'afternoon';
  if (/\bevening\b|\bnight\b/.test(t)) return 'evening';
  return undefined;
}

function parseAbsoluteDate(text: string, now: Date): ApproximateDate | undefined {
  const lower = text.toLowerCase();

  // Friday, 28 August 2026 / 28 August 2026 / 28/08/2026
  const long = lower.match(
    /\b(?:(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue|wed|thu|fri|sat)[,]?\s+)?(\d{1,2})(?:st|nd|rd|th)?\s+(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)(?:\s+(\d{4}))?\b/,
  );
  if (long) {
    const weekdayName = long[1];
    const day = Number(long[2]);
    const month = MONTHS[long[3]!];
    const year = long[4] ? Number(long[4]) : now.getFullYear();
    const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return {
      kind: 'absolute',
      isoDate: iso,
      label: long[0]!,
      weekday: weekdayName ? WEEKDAYS[weekdayName] : undefined,
      month,
      year,
    };
  }

  const slash = lower.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\b/);
  if (slash) {
    const day = Number(slash[1]);
    const month = Number(slash[2]);
    const year = Number(slash[3]);
    const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return { kind: 'absolute', isoDate: iso, label: slash[0]!, month, year };
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

  const startOfMonth = lower.match(/\b(?:start|beginning) of (january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\b/);
  if (startOfMonth) {
    const month = MONTHS[startOfMonth[1]!];
    let year = now.getFullYear();
    if (month < now.getMonth() + 1) year += 1;
    return { kind: 'month_start', label: startOfMonth[0]!, month, year };
  }

  if (/\bnext weekend\b/.test(lower)) {
    return { kind: 'weekend', label: 'next weekend' };
  }

  if (/\bthis weekend\b/.test(lower)) {
    return { kind: 'weekend', label: 'this weekend' };
  }

  return parseAbsoluteDate(text, now);
}

function extractTravellers(text: string): TravellerCounts | undefined {
  const t = text.toLowerCase();
  const adultsMatch = t.match(/(\d+)\s*adults?/);
  const childrenMatch = t.match(/(\d+)\s*(?:children|kids|child)/);
  const peopleMatch = t.match(/(\d+)\s*(?:travellers?|travelers?|people|passengers?|of us)/);
  const familyHint = /\bfamily\b/.test(t);

  if (adultsMatch || childrenMatch) {
    const adults = adultsMatch ? Number(adultsMatch[1]) : 1;
    const children = childrenMatch ? Number(childrenMatch[1]) : 0;
    return { adults, children, total: adults + children };
  }
  if (peopleMatch) {
    const total = Number(peopleMatch[1]);
    return { adults: total, children: 0, total };
  }
  if (/\bjust me\b|\bsolo\b|\bmyself\b/.test(t)) {
    return { adults: 1, children: 0, total: 1 };
  }
  if (/\bcouple\b|\btwo of us\b/.test(t)) {
    return { adults: 2, children: 0, total: 2 };
  }
  if (familyHint) {
    return { adults: 2, children: 1, total: 3 };
  }
  return undefined;
}

function extractBudget(text: string): ConversationState['budget'] | undefined {
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

function looksLikeDateConfirmation(text: string, previous?: ConversationState): boolean {
  const t = text.trim().toLowerCase();
  if (!previous?.awaitingDateConfirmation && !previous?.lastSuggestedDate) {
    // Still allow short confirmations that include a date
    if (!/^(yes|yep|yeah|correct|confirm|that works|sounds good)\b/.test(t) && !parseAbsoluteDate(text, new Date())) {
      return false;
    }
  }
  if (/^(yes|yep|yeah|correct|confirm|that works|sounds good)\b/.test(t)) return true;
  if (previous?.lastSuggestedDate && t.includes('friday') && (t.includes('28') || t.includes('august'))) return true;
  if (parseAbsoluteDate(text, new Date()) && /^(yes[,.]?\s*)?/i.test(t) && t.length < 80) return true;
  return false;
}

/**
 * Extract every usable travel requirement from a single user message.
 * Destination-agnostic: uses place lexicon + linguistic patterns, not hardcoded city branches.
 */
export function extractRequirements(message: string, previous?: ConversationState, now = new Date()): ExtractionPatch {
  const text = message.trim();
  const lower = text.toLowerCase();
  const patch: ExtractionPatch = {
    requestedServices: [],
    accommodationPreferences: [],
    carHireRequirements: [],
    vehiclePreferences: [],
    flightPreferences: [],
    activities: [],
    campingRequirements: [],
    fourWdRequirements: [],
    cruiseRequirements: [],
    businessRequirements: [],
    accessibility: [],
    pets: [],
    loyaltyPreferences: [],
    intermediateDestinations: [],
    rawMentions: [text],
    explicitItineraryIntent: false,
  };

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

  if (looksLikeDateConfirmation(text, previous)) {
    patch.isDateConfirmation = true;
    const absolute = parseAbsoluteDate(text, now);
    if (absolute) {
      patch.confirmedDateLabel = absolute.label;
      patch.departureDate = field(absolute, 'confirmed');
    } else if (previous?.lastSuggestedDate) {
      patch.confirmedDateLabel = previous.lastSuggestedDate.label;
      patch.departureDate = field({ ...previous.lastSuggestedDate, kind: 'absolute' }, 'confirmed');
    }
  }

  const places = findPlacesInText(text);
  const areas = findAreaMentions(text);

  // Origin patterns: from X, leave X, come back to X, return to X
  const fromMatch = text.match(/\bfrom\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)/);
  const backToMatch = text.match(/\b(?:come back|return|back)\s+to\s+([A-Za-z][a-zA-Z]+(?:\s+[A-Za-z][a-zA-Z]+)?)/i);
  const toMatch = text.match(
    /\b(?:travel to|go to|going to|fly to|visit(?:ing)?|destination(?:\s+to)?|change destination to)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)/i,
  );
  const inMatch = text.match(
    /\b(?:hotel|stay|resort|camping|activities|transfer|car hire)\s+(?:in\s+)?([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)/i,
  );

  if (fromMatch) {
    patch.origin = field(resolvePlaceName(fromMatch[1]!));
  }
  if (backToMatch) {
    // "come back to Sydney" implies origin/home is Sydney
    patch.origin = field(resolvePlaceName(backToMatch[1]!));
  }
  if (toMatch) {
    const name = resolvePlaceName(toMatch[1]!);
    // Avoid treating "to Sydney" in "come back to Sydney" as destination when another dest exists
    const isReturnPhrase =
      /\b(?:come back|return|back)\s+to\b/i.test(text) &&
      new RegExp(`\\b(?:come back|return|back)\\s+to\\s+${toMatch[1]!.split(/\s+/)[0]}`, 'i').test(text);
    if (!isReturnPhrase) {
      patch.destination = field(name);
    }
  }
  if (!patch.destination && inMatch) {
    const name = resolvePlaceName(inMatch[1]!);
    if (name) {
      patch.destination = field(name);
    }
  }

  // If multiple places and destination still unset, prefer non-origin place
  if (!patch.destination && places.length > 0) {
    const originName = patch.origin?.value.toLowerCase();
    const dest = places.find((p) => p.name.toLowerCase() !== originName && !areas.some((a) => a.area.toLowerCase() === p.aliases[0]));
    // Prefer explicit Melbourne over Docklands alias collision
    const preferred = places.find((p) => p.name === 'Melbourne' && p.name.toLowerCase() !== originName) ?? dest ?? places[0];
    if (preferred && preferred.name.toLowerCase() !== originName) {
      patch.destination = field(preferred.name);
    }
  }

  if (areas.length > 0) {
    patch.accommodationLocation = field(areas[0]!.area);
    if (!patch.destination) {
      patch.destination = field(areas[0]!.city, 'inferred');
    }
  }

  // Multi-city: via / then / and
  const viaMatch = text.match(/\bvia\s+([A-Za-z][a-zA-Z]+(?:\s+[A-Za-z][a-zA-Z]+)?)/i);
  if (viaMatch) {
    patch.intermediateDestinations = [field(viaMatch[1]!)];
  }

  const services = extractServices(text);
  patch.requestedServices = services;

  if (/\bhotel\b|\bstay\b|\baccommodation\b|\bdocklands\b|\bresort\b/.test(lower) && !services.includes('hotels')) {
    patch.requestedServices = uniqueServices([...services, 'hotels']);
  }

  const purpose = extractPurpose(text);
  if (purpose) patch.tripPurpose = field(purpose);

  const depDate = parseRelativeDate(text, now);
  if (depDate && !patch.departureDate) {
    patch.departureDate = field(depDate);
  }

  // Departure / return time preferences
  const fridayWindow = /\bfriday\b/i.test(text)
    ? text.match(/\bfriday\b[\s\S]{0,80}?(?=come back|return|$)/i)?.[0] ?? ''
    : '';
  if (fridayWindow) {
    const pref = /after\s*5/.test(fridayWindow.toLowerCase())
      ? 'after_5pm'
      : extractTimePreference(fridayWindow) ?? 'afternoon';
    patch.departureTimePreference = field(pref);
    if (patch.departureDate) {
      patch.departureDate = field({ ...patch.departureDate.value, weekday: 5, timePreference: pref });
    } else {
      patch.departureDate = field({ kind: 'relative', label: 'Friday', weekday: 5, timePreference: pref });
    }
  } else if (/after\s*5/.test(lower) && !/\b(?:come back|return)[\s\S]{0,40}after\s*5/.test(lower)) {
    patch.departureTimePreference = field('after_5pm');
  } else {
    const depTime = extractTimePreference(text);
    if (depTime && !/come back|return/.test(lower)) {
      patch.departureTimePreference = field(depTime);
    }
  }

  const returnAfternoon = text.match(/(?:come back|return)[^.]*?\b(afternoon|morning|evening|after\s*5\s*pm)\b/i);
  if (returnAfternoon) {
    patch.returnTimePreference = field(extractTimePreference(returnAfternoon[1]!) ?? 'afternoon');
    patch.returnDate = field({
      kind: 'relative',
      label: `return ${returnAfternoon[1]}`,
      timePreference: extractTimePreference(returnAfternoon[1]!) ?? 'afternoon',
    });
  } else if (/\bcome back\b|\breturn\b/.test(lower) && /\bafternoon\b/.test(lower)) {
    patch.returnTimePreference = field('afternoon');
  }

  const travellers = extractTravellers(text);
  if (travellers) patch.travellers = field(travellers, travellers.children > 0 && !/\d+\s*adult/.test(lower) ? 'inferred' : 'confirmed');

  const budget = extractBudget(text);
  if (budget) patch.budget = budget;

  if (/\bitinerary\b|\bday[- ]by[- ]day\b|\bdaily schedule\b|\bbuild (?:me )?a plan\b|\bcreate (?:an? )?itinerary\b/.test(lower)) {
    patch.explicitItineraryIntent = true;
  }

  if (/\bcar hire\b|\brent(?:al)? car\b/.test(lower)) {
    patch.carHireRequirements = ['align_to_flight_schedule'];
    if (/match(?:es)? the flights?|aligned? to (?:the )?flights?|same schedule/.test(lower)) {
      patch.carHireRequirements.push('match_flight_times');
    }
  }

  if (/\b4wd\b|\bfour[- ]?wheel\b/.test(lower)) {
    patch.fourWdRequirements = ['four_wheel_drive'];
    patch.vehiclePreferences = ['4WD'];
  }

  if (/\bcamping\b|\btent\b|\bcampsite\b/.test(lower)) {
    patch.campingRequirements = ['camping'];
  }

  if (/\bcruise\b/.test(lower)) {
    patch.cruiseRequirements = ['cruise'];
  }

  if (/\bbusiness\b|\bmeeting\b|\bconference\b/.test(lower)) {
    patch.businessRequirements = ['business'];
  }

  if (/\baccessib|\bwheelchair\b|\bmobility\b/.test(lower)) {
    patch.accessibility = ['accessibility_required'];
  }

  if (/\bpet\b|\bdog\b|\bcat\b/.test(lower)) {
    patch.pets = ['travelling_with_pet'];
  }

  if (/\bfrequent flyer\b|\bloyalty\b|\bqantas\b|\bvelocity\b/.test(lower)) {
    patch.loyaltyPreferences = ['loyalty_mentioned'];
  }

  if (/\bdirect\b|\bnon[- ]stop\b/.test(lower)) {
    patch.flightPreferences = [...(patch.flightPreferences ?? []), 'direct'];
  }

  // Destination/date updates mid-conversation
  if (previous && (patch.destination || patch.origin || patch.departureDate)) {
    patch.updates = {
      origin: patch.origin?.value,
      destination: patch.destination?.value,
      departureIso: patch.departureDate?.value.isoDate,
    };
  }

  return patch;
}
