import type { ExtractionPatch } from './extract';
import type {
  ApproximateDate,
  ConversationState,
  PresentedOption,
  ReferenceResolution,
  TimePreference,
} from './types';
import { withConfidence } from './confidence';

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
    if (!previous.requestedServices.includes('accommodation')) {
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

  // "make it Brisbane instead" / "actually Brisbane instead" — never day-shift phrases
  if (!dayShift) {
    const insteadPlace = text.match(
      /\b(?:actually\s+)?(?:make it|switch to|change (?:it )?to|go to)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)\s+instead\b/,
    ) ?? text.match(/\b([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)\s+instead\b/);
    const candidate = insteadPlace?.[1]?.trim();
    const invalid =
      !candidate ||
      /^(one|a|day|earlier|later|sometime|maybe|please)$/i.test(candidate) ||
      /\bday\b/i.test(candidate);
    if (candidate && !invalid && !next.destination) {
      resolution = { kind: 'instead', detail: candidate };
      next.destination = withConfidence(candidate, 'confirmed', 0.95);
    }

    const shortInstead = text.match(
      /^\s*(?:actually[, ]+)?(?:make it|change (?:it )?to)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)\s*\.?$/i,
    );
    const shortCandidate = shortInstead?.[1]?.trim();
    if (
      shortCandidate &&
      previous.destination &&
      !next.destination &&
      !/^(one|a|day|earlier|later|sometime)$/i.test(shortCandidate) &&
      !/\bday\b/i.test(shortCandidate)
    ) {
      resolution = { kind: 'instead', detail: shortCandidate };
      next.destination = withConfidence(shortCandidate.replace(/^\w/, (c) => c.toUpperCase()), 'confirmed', 0.95);
    }
  }

  const relative = relativeDateFromText(text, now, previous);
  if (relative && !next.departureDate) {
    resolution = { kind: 'relative_date', detail: relative.label };
    next.departureDate = withConfidence(relative, 'confirmed', 0.8);
  }

  return { patch: next, resolution, selected };
}
