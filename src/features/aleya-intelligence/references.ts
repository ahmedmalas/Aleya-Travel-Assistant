import type { ExtractionPatch } from './extract';
import { matchAreaName, PLACES } from './places';
import type {
  ApproximateDate,
  ConversationState,
  PresentedOption,
  ReferenceResolution,
  TimePreference,
} from './types';
import { withConfidence } from './confidence';

const NON_DESTINATION_INSTEAD = new Set([
  'one',
  'a',
  'day',
  'earlier',
  'later',
  'sometime',
  'maybe',
  'please',
  'four',
  'three',
  'two',
  'five',
  'virgin',
  'qantas',
  'jetstar',
  'emirates',
  'cathay',
]);

function isKnownDestinationCandidate(raw: string): boolean {
  const lower = raw.trim().toLowerCase();
  if (!lower || NON_DESTINATION_INSTEAD.has(lower)) return false;
  if (/\bday\b/i.test(lower)) return false;
  if (matchAreaName(raw)) return true;
  return PLACES.some((p) => p.name.toLowerCase() === lower || p.aliases.includes(lower));
}

/** Resolve "X instead" to a known place, ignoring leading hedges like "Maybe Bali". */
function resolveInsteadPlaceCandidate(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (isKnownDestinationCandidate(trimmed)) return trimmed;
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length > 1) {
    const last = parts[parts.length - 1]!;
    if (isKnownDestinationCandidate(last)) return last;
    const lastTwo = parts.slice(-2).join(' ');
    if (isKnownDestinationCandidate(lastTwo)) return lastTwo;
  }
  return undefined;
}

function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(y!, m! - 1, d!));
  date.setUTCDate(date.getUTCDate() + days);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

function shiftTime(direction: 'earlier' | 'later', pref?: TimePreference): TimePreference {
  const order: TimePreference[] = ['morning', 'afternoon', 'after_5pm', 'evening'];
  const current = pref && pref !== 'flexible' ? pref : 'afternoon';
  const idx = order.indexOf(current);
  if (direction === 'earlier') return order[Math.max(0, idx - 1)]!;
  return order[Math.min(order.length - 1, idx + 1)]!;
}

function parseOptionIndex(text: string): number | undefined {
  const lower = text.toLowerCase();
  if (/\b(?:first|1st)\b/.test(lower) || /\boption\s*1\b/.test(lower)) return 0;
  if (/\b(?:second|2nd)\b/.test(lower) || /\boption\s*2\b/.test(lower)) return 1;
  if (/\b(?:third|3rd)\b/.test(lower) || /\boption\s*3\b/.test(lower)) return 2;
  if (/\bthat one\b|\bthat option\b|\bthe same one\b/.test(lower)) return 0;
  return undefined;
}

function relativeDateFromText(text: string, now: Date, previous?: ConversationState): ApproximateDate | undefined {
  const lower = text.toLowerCase();
  if (/\bnext week\b/.test(lower)) {
    const d = new Date(now);
    d.setDate(d.getDate() + 7);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return { kind: 'relative', label: 'next week', isoDate: iso };
  }
  if (/\byesterday\b/.test(lower) && previous?.departureDate?.value.isoDate) {
    return undefined;
  }
  return undefined;
}

/** True when earlier/later clearly refers to travel timing, not casual English. */
function hasTravelTimeShiftIntent(lower: string, direction: 'earlier' | 'later'): boolean {
  const word = direction;
  // Require earlier/later adjacent to an explicit travel-timing cue — never bare "later"/"earlier".
  const patterns = [
    new RegExp(`\\b${word}\\s+(?:flight|flights|departure|departures|take[- ]?off|arrival|return|outbound)\\b`),
    new RegExp(
      `\\b(?:flight|flights|departure|departures|take[- ]?off|arrival|return|outbound)\\s+${word}\\b`,
    ),
    new RegExp(`\\b(?:leave|leaving|depart|departing)\\s+${word}\\b`),
    new RegExp(`\\btravel time\\s+${word}\\b`),
    new RegExp(`\\b${word}\\s+travel time\\b`),
  ];
  return patterns.some((re) => re.test(lower));
}

function isDayShiftRequest(lower: string): { direction: 'earlier' | 'later'; days: number } | undefined {
  if (
    /\b(?:make it\s+)?(?:one|a|1)\s+day earlier\b/.test(lower) ||
    /\bearlier by (?:one|a|1) day\b/.test(lower) ||
    /\b(?:leave|depart|move)\s+(?:it\s+)?(?:one|a|1)\s+day earlier\b/.test(lower)
  ) {
    return { direction: 'earlier', days: 1 };
  }
  if (
    /\b(?:make it\s+)?(?:one|a|1)\s+day later\b/.test(lower) ||
    /\blater by (?:one|a|1) day\b/.test(lower) ||
    /\b(?:leave|depart|move)\s+(?:it\s+)?(?:one|a|1)\s+day later\b/.test(lower) ||
    /\bleave (?:one|a|1) day later\b/.test(lower)
  ) {
    return { direction: 'later', days: 1 };
  }
  return undefined;
}

/**
 * Resolve conversational references against prior state / presented options.
 * Never invents inventory — only adjusts preferences or selects known options.
 */
export function resolveReferences(
  message: string,
  previous: ConversationState,
  patch: ExtractionPatch,
  now: Date,
  presentedOptions?: PresentedOption[],
): { patch: ExtractionPatch; resolution?: ReferenceResolution; selected?: PresentedOption } {
  const text = message.trim();
  const lower = text.toLowerCase();
  const next: ExtractionPatch = { ...patch };
  const options = presentedOptions?.length ? presentedOptions : previous.lastPresentedOptions;
  let resolution: ReferenceResolution | undefined;
  let selected: PresentedOption | undefined;

  const optionIndex = parseOptionIndex(lower);
  if (optionIndex != null && options.length > 0) {
    selected = options[Math.min(optionIndex, options.length - 1)];
    resolution = { kind: 'option_index', optionIndex, detail: selected?.label };
    if (selected?.kind === 'hotel' && selected.label) {
      next.hotelPreferences = withConfidence(
        {
          ...(previous.hotelPreferences?.value ?? {}),
          notes: selected.label,
        },
        'confirmed',
        0.9,
      );
    }
    if (selected?.kind === 'flight' && selected.label) {
      next.airlinePreferences = withConfidence(
        {
          ...(previous.airlinePreferences?.value ?? {}),
          notes: selected.label,
        },
        'confirmed',
        0.9,
      );
    }
  }

  if (/\bsame hotel\b|\bkeep the hotel\b|\bsame accommodation\b/.test(lower)) {
    resolution = { kind: 'same_hotel', detail: previous.accommodationArea?.value };
    if (previous.accommodationArea) next.accommodationArea = previous.accommodationArea;
    if (previous.hotelPreferences) next.hotelPreferences = previous.hotelPreferences;
    if (!next.requestedServices) next.requestedServices = [];
    if (
      !previous.requestedServices.includes('accommodation') &&
      !(previous.excludedServices ?? []).includes('accommodation')
    ) {
      next.requestedServices = Array.from(new Set([...(next.requestedServices ?? []), 'accommodation']));
    }
  }

  if (/\bsame flights?\b|\bkeep the flights?\b/.test(lower)) {
    resolution = { kind: 'same_flights' };
    if (previous.airlinePreferences) next.airlinePreferences = previous.airlinePreferences;
    if (previous.departureDate && !next.departureDate) next.departureDate = previous.departureDate;
    if (previous.departureTimePreference && !next.departureTimePreference) {
      next.departureTimePreference = previous.departureTimePreference;
    }
  }

  if (/\bcheaper\b|\blower (?:price|cost|fare)\b|\bless expensive\b/.test(lower)) {
    resolution = { kind: 'cheaper' };
    next.budget = withConfidence(
      {
        ...(previous.budget?.value ?? {}),
        style: 'budget',
        relative: 'cheaper',
      },
      'confirmed',
      0.85,
    );
  }

  // Date day-shifts first — never also mutate departure time for these phrases
  const dayShift = isDayShiftRequest(lower);
  if (dayShift && previous.departureDate?.value.isoDate) {
    const delta = dayShift.direction === 'earlier' ? -dayShift.days : dayShift.days;
    const iso = addDaysIso(previous.departureDate.value.isoDate, delta);
    next.departureDate = withConfidence({ kind: 'absolute', isoDate: iso, label: iso }, 'confirmed', 0.9);
    // Explicitly do not touch departureTimePreference
    delete next.departureTimePreference;
    resolution = { kind: dayShift.direction, detail: iso };
  } else {
    // Time preference shifts only with clear travel-timing intent
    if (hasTravelTimeShiftIntent(lower, 'earlier')) {
      resolution = { kind: 'earlier' };
      next.departureTimePreference = withConfidence(
        shiftTime('earlier', previous.departureTimePreference?.value),
        'confirmed',
        0.85,
      );
    } else if (hasTravelTimeShiftIntent(lower, 'later')) {
      resolution = { kind: 'later' };
      next.departureTimePreference = withConfidence(
        shiftTime('later', previous.departureTimePreference?.value),
        'confirmed',
        0.85,
      );
    }
  }

  // Destination retention must target the destination itself — not "keep looking/hotel/flights"
  const retainingDestination =
    !/\bkeep\s+(?:looking|searching|thinking|exploring|checking)\b/i.test(text) &&
    !/\b(?:make (?:the\s+)?destination|change (?:the\s+)?destination|go to\b[\s\S]{0,40}\binstead)\b/i.test(
      text,
    ) &&
    /\b(?:keep\s+(?:the\s+)?(?:current\s+)?destination|keep\s+it\s+as|do not change|don'?t change|do not make it|don'?t make it|leave\s+.+\s+as it is|stay with\s+[a-z]|keep\s+(?:it\s+as\s+)?(?:gold coast|melbourne|brisbane|sydney|adelaide|cairns|perth|bali|tokyo))\b/i.test(
      text,
    ) &&
    !/\bnot\s+[a-z][a-z\s]+?\s+anymore\b/i.test(text);

  if (!dayShift && !retainingDestination) {
    const insteadPlace = text.match(
      /\b(?:actually\s+)?(?:make it|switch to|change (?:it )?to|go to)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)\s+instead\b/,
    ) ?? text.match(/\b([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)\s+instead\b/);
    const candidate = resolveInsteadPlaceCandidate(insteadPlace?.[1]);
    const softHedge = /\b(?:maybe|might|thinking of|possibly|not sure|sometime)\b/i.test(text);
    if (candidate) {
      const area = matchAreaName(candidate);
      const name = area?.city ?? candidate;
      const canOverride =
        !next.destination ||
        next.destination.source === 'inferred' ||
        (next.destination.confidence ?? 0) < 0.9;
      if (canOverride) {
        resolution = { kind: 'instead', detail: candidate };
        next.destination = withConfidence(
          name,
          softHedge ? 'inferred' : 'confirmed',
          softHedge ? 0.55 : 0.95,
        );
        if (area && !next.accommodationArea) {
          next.accommodationArea = withConfidence(area.area, 'confirmed', 0.95);
        }
      }
    }

    const shortInstead = text.match(
      /^\s*(?:actually[, ]+)?(?:make it|change (?:it )?to)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)\s*\.?$/i,
    );
    const shortCandidate = resolveInsteadPlaceCandidate(shortInstead?.[1]);
    if (shortCandidate && previous.destination && !next.destination) {
      const area = matchAreaName(shortCandidate);
      const name = area?.city ?? shortCandidate.replace(/^\w/, (c) => c.toUpperCase());
      resolution = { kind: 'instead', detail: shortCandidate };
      next.destination = withConfidence(name, 'confirmed', 0.95);
      if (area) {
        next.accommodationArea = withConfidence(area.area, 'confirmed', 0.95);
      }
    }
  }

  const relative = relativeDateFromText(text, now, previous);
  if (relative && !next.departureDate) {
    resolution = { kind: 'relative_date', detail: relative.label };
    next.departureDate = withConfidence(relative, 'confirmed', 0.8);
  }

  return { patch: next, resolution, selected };
}
