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
    // "same as yesterday" style relative to prior stated date if present; otherwise skip inventing trips
    return undefined;
  }
  if (/\binstead\b/.test(lower) && /\bnext week\b/.test(lower)) {
    const d = new Date(now);
    d.setDate(d.getDate() + 7);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return { kind: 'relative', label: 'next week', isoDate: iso };
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

  if (/\bearlier\b|\bearlier flight\b|\bleave earlier\b/.test(lower)) {
    resolution = { kind: 'earlier' };
    const shifted = shiftTime('earlier', previous.departureTimePreference?.value);
    next.departureTimePreference = withConfidence(shifted, 'confirmed', 0.85);
  }

  if (/\blater\b|\blater flight\b|\bleave later\b/.test(lower)) {
    resolution = { kind: 'later' };
    const shifted = shiftTime('later', previous.departureTimePreference?.value);
    next.departureTimePreference = withConfidence(shifted, 'confirmed', 0.85);
  }

  // "make it Brisbane instead" / "actually Brisbane instead"
  const insteadPlace = text.match(
    /\b(?:actually\s+)?(?:make it|switch to|change (?:it )?to|go to)?\s*([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)\s+instead\b/,
  ) ?? text.match(/\binstead(?:\s+make it|\s+to)?\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)/);
  if (insteadPlace?.[1] && !next.destination) {
    resolution = { kind: 'instead', detail: insteadPlace[1] };
    next.destination = withConfidence(insteadPlace[1], 'confirmed', 0.95);
  }

  const shortInstead = text.match(/^\s*(?:actually[, ]+)?(?:make it|change (?:it )?to)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)\s*\.?$/i);
  if (shortInstead?.[1] && previous.destination && !next.destination) {
    resolution = { kind: 'instead', detail: shortInstead[1] };
    next.destination = withConfidence(shortInstead[1].replace(/^\w/, (c) => c.toUpperCase()), 'confirmed', 0.95);
  }

  const relative = relativeDateFromText(text, now, previous);
  if (relative && !next.departureDate) {
    resolution = { kind: 'relative_date', detail: relative.label };
    next.departureDate = withConfidence(relative, 'confirmed', 0.8);
  }

  // "a day earlier/later" relative to confirmed departure
  if (previous.departureDate?.value.isoDate) {
    if (/\b(?:one|a|1)\s+day earlier\b|\bearlier by (?:one|a|1) day\b/.test(lower)) {
      const iso = addDaysIso(previous.departureDate.value.isoDate, -1);
      next.departureDate = withConfidence(
        { kind: 'absolute', isoDate: iso, label: iso },
        'confirmed',
        0.9,
      );
      resolution = { kind: 'earlier', detail: iso };
    }
    if (/\b(?:one|a|1)\s+day later\b|\blater by (?:one|a|1) day\b/.test(lower)) {
      const iso = addDaysIso(previous.departureDate.value.isoDate, 1);
      next.departureDate = withConfidence(
        { kind: 'absolute', isoDate: iso, label: iso },
        'confirmed',
        0.9,
      );
      resolution = { kind: 'later', detail: iso };
    }
  }

  return { patch: next, resolution, selected };
}
