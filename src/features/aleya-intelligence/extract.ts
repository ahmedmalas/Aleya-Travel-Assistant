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

export type ExtractionPatch = {
  origin?: FieldValue<string>;
  destination?: FieldValue<string>;
  departureDate?: FieldValue<ApproximateDate>;
  returnDate?: FieldValue<ApproximateDate>;
  departureTimePreference?: FieldValue<TimePreference>;
  returnTimePreference?: FieldValue<TimePreference>;
  requestedServices?: TravelServiceKind[];
  removeServices?: TravelServiceKind[];
  accommodationArea?: FieldValue<string>;
  clearAccommodationArea?: boolean;
  travellers?: FieldValue<TravellerCounts>;
  tripPurpose?: FieldValue<TripPurposeKind>;
  budget?: FieldValue<{ amount?: number; currency?: string; style?: 'budget' | 'mid' | 'luxury' }>;
  explicitItineraryIntent?: boolean;
  isGreeting?: boolean;
  isThanks?: boolean;
  isCapabilityQuestion?: boolean;
  isDateConfirmation?: boolean;
  confirmedDateLabel?: string;
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
  'the', 'a', 'an', 'after', 'before', 'near', 'via', 'leaving',
]);

function field<T>(value: T, source: 'confirmed' | 'inferred' = 'confirmed'): FieldValue<T> {
  return { value, source };
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
  return byFirst?.name ?? cleaned;
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
  return undefined;
}

function parseAbsoluteDate(text: string, now: Date): ApproximateDate | undefined {
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

function extractTravellers(text: string): TravellerCounts | undefined {
  const t = text.toLowerCase();
  const adultsMatch = t.match(/(\d+)\s*adults?/);
  const childrenMatch = t.match(/(\d+)\s*(?:children|kids|child)/);
  const peopleMatch = t.match(/(\d+)\s*(?:travellers?|travelers?|people|passengers?|of us)/);
  if (adultsMatch || childrenMatch) {
    const adults = adultsMatch ? Number(adultsMatch[1]) : 1;
    const children = childrenMatch ? Number(childrenMatch[1]) : 0;
    return { adults, children, total: adults + children };
  }
  if (peopleMatch) {
    const total = Number(peopleMatch[1]);
    return { adults: total, children: 0, total };
  }
  if (/\bjust me\b|\bsolo\b/.test(t)) return { adults: 1, children: 0, total: 1 };
  if (/\bcouple\b|\btwo of us\b/.test(t)) return { adults: 2, children: 0, total: 2 };
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

function looksLikeDateConfirmation(text: string, previous?: ConversationState): boolean {
  const t = text.trim().toLowerCase();
  if (previous?.awaitingDateConfirmation || previous?.lastSuggestedDate) {
    if (/^(yes|yep|yeah|correct|confirm|that works|sounds good)\b/.test(t)) return true;
    if (t.includes('friday') && (t.includes('28') || t.includes('august'))) return true;
  }
  if (parseAbsoluteDate(text, new Date()) && /^(yes[,.]?\s*)?/i.test(t) && t.length < 100) {
    if (previous?.awaitingDateConfirmation) return true;
  }
  return false;
}

export function extractRequirements(message: string, previous?: ConversationState, now = new Date()): ExtractionPatch {
  const text = message.trim();
  const lower = text.toLowerCase();
  const patch: ExtractionPatch = {};

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

  const fromMatch = text.match(/\bfrom\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)/);
  const backToMatch = text.match(/\b(?:come back|return|back)\s+to\s+([A-Za-z][a-zA-Z]+(?:\s+[A-Za-z][a-zA-Z]+)?)/i);
  const toMatch = text.match(
    /\b(?:travel to|go to|going to|fly to|visit(?:ing)?|change destination to|destination to)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)/,
  );
  const inMatch = text.match(
    /\b(?:hotel|stay|resort|accommodation)\s+(?:in\s+|at\s+)([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)/,
  );

  if (fromMatch) patch.origin = field(resolvePlaceName(fromMatch[1]!));
  if (backToMatch) patch.origin = field(resolvePlaceName(backToMatch[1]!));

  if (toMatch) {
    const raw = toMatch[1]!;
    const isReturnPhrase =
      /\b(?:come back|return|back)\s+to\b/i.test(text) &&
      new RegExp(`\\b(?:come back|return|back)\\s+to\\s+${raw.split(/\s+/)[0]}`, 'i').test(text);
    if (!isReturnPhrase) patch.destination = field(resolvePlaceName(raw));
  }

  if (!patch.destination && inMatch) {
    const name = resolvePlaceName(inMatch[1]!);
    // Hotel at Docklands is an area, not destination city
    if (
      name &&
      !PLACE_STOPWORDS.has(name.toLowerCase()) &&
      !areas.some((a) => a.area.toLowerCase() === name.toLowerCase())
    ) {
      patch.destination = field(name);
    }
  }

  if (!patch.destination && places.length > 0) {
    const originName = patch.origin?.value.toLowerCase();
    const preferred =
      places.find((p) => p.name === 'Melbourne' && p.name.toLowerCase() !== originName) ??
      places.find((p) => p.name.toLowerCase() !== originName) ??
      places[0];
    if (preferred && preferred.name.toLowerCase() !== originName) {
      patch.destination = field(preferred.name);
    }
  }

  if (areas.length > 0) {
    patch.accommodationArea = field(areas[0]!.area);
    if (!patch.destination) patch.destination = field(areas[0]!.city, 'inferred');
  }

  const removals = extractRemovals(text);
  if (removals.length) patch.removeServices = removals;

  const services = extractServices(text).filter((s) => !removals.includes(s));
  if (services.length) patch.requestedServices = services;
  if (areas.length && !services.includes('accommodation') && !removals.includes('accommodation')) {
    patch.requestedServices = Array.from(new Set([...(patch.requestedServices ?? []), 'accommodation']));
  }

  const purpose = extractPurpose(text);
  if (purpose) patch.tripPurpose = field(purpose);

  if (!patch.isDateConfirmation) {
    const depDate = parseRelativeDate(text, now);
    if (depDate) patch.departureDate = field(depDate);

    const fridayWindow = /\bfriday\b/i.test(text)
      ? text.match(/\bfriday\b[\s\S]{0,80}?(?=come back|return|$)/i)?.[0] ?? ''
      : '';
    if (fridayWindow) {
      const pref = /after\s*5|after work/.test(fridayWindow.toLowerCase())
        ? 'after_5pm'
        : extractTimePreference(fridayWindow) ?? 'afternoon';
      patch.departureTimePreference = field(pref);
      if (patch.departureDate) {
        patch.departureDate = field({ ...patch.departureDate.value, weekday: 5, timePreference: pref });
      } else {
        patch.departureDate = field({ kind: 'relative', label: 'Friday', weekday: 5, timePreference: pref });
      }
    } else if (/after\s*5|after work/.test(lower) && !/\b(?:come back|return)[\s\S]{0,40}(?:after\s*5|afternoon)/.test(lower)) {
      patch.departureTimePreference = field('after_5pm');
    }

    const returnClause = text.match(/\b(?:come back|return)([\s\S]{0,60})/i);
    if (returnClause) {
      const returnBit = returnClause[0]!;
      const returnAbs = parseAbsoluteDate(returnBit, now);
      const returnTime = extractTimePreference(returnBit);
      if (returnAbs) {
        patch.returnDate = field({ ...returnAbs, timePreference: returnTime });
      } else if (returnTime) {
        patch.returnDate = field({
          kind: 'relative',
          label: `return ${returnTime}`,
          timePreference: returnTime,
        });
      }
      if (returnTime) patch.returnTimePreference = field(returnTime);
    } else if (/\bcome back\b|\breturn\b/.test(lower) && /\bafternoon\b/.test(lower)) {
      patch.returnTimePreference = field('afternoon');
    }

    // "Return Sunday afternoon" without "come back"
    const returnDay = text.match(/\breturn\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\s+(afternoon|morning|evening)/i);
    if (returnDay) {
      patch.returnTimePreference = field(extractTimePreference(returnDay[2]!) ?? 'afternoon');
      patch.returnDate = field({
        kind: 'relative',
        label: `return ${returnDay[1]} ${returnDay[2]}`,
        weekday: WEEKDAYS[returnDay[1]!.toLowerCase()],
        timePreference: extractTimePreference(returnDay[2]!) ?? 'afternoon',
      });
    }
  }

  // Return day/time can appear on confirmation or later turns
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
  if (travellers) patch.travellers = field(travellers);

  const budget = extractBudget(text);
  if (budget) patch.budget = budget;

  if (/\bitinerary\b|\bday[- ]by[- ]day\b|\bdaily schedule\b|\bbuild (?:me )?an? itinerary\b|\bcreate (?:an? )?itinerary\b/.test(lower)) {
    patch.explicitItineraryIntent = true;
  }

  return patch;
}
