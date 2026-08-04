import type { ActiveTravelRequirement } from './types';
import type { TravelInterpretationContext } from './buildInterpretationContext';
import type { TravelSemanticInterpretation } from './schema';
import { emptySemanticInterpretation } from './schema';

/**
 * Contextual temporal / reference semantics for relative travel language.
 *
 * This is calendar + conversation-anchor reasoning used when the AI layer is
 * unavailable. It is not a destination/origin cue-extractor catalogue and must
 * not grow phrase-specific travel grammar patches.
 */

const WEEKDAY_TO_INDEX: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
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

function parseIso(iso: string): Date | null {
  const parsed = new Date(`${iso}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(iso: string, days: number): string | null {
  const parsed = parseIso(iso);
  if (!parsed) return null;
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return toIso(parsed);
}

/** Monday-start week containing the anchor (UTC). */
function mondayOfWeek(iso: string): string | null {
  const parsed = parseIso(iso);
  if (!parsed) return null;
  const day = parsed.getUTCDay(); // 0 Sun .. 6 Sat
  const offsetToMonday = day === 0 ? -6 : 1 - day;
  return addDays(iso, offsetToMonday);
}

function weekdayInWeekOf(anchorIso: string, weekdayIndex: number): string | null {
  const monday = mondayOfWeek(anchorIso);
  if (!monday) return null;
  // Monday=1 .. Sunday=0 → days from Monday
  const fromMonday = weekdayIndex === 0 ? 6 : weekdayIndex - 1;
  return addDays(monday, fromMonday);
}

function ensureReturnOnOrAfterDeparture(
  candidate: string,
  departure: string | null,
): string {
  if (!departure) return candidate;
  if (candidate >= departure) return candidate;
  const bumped = addDays(candidate, 7);
  return bumped ?? candidate;
}

function wordNumber(raw: string): number | null {
  if (/^\d+$/.test(raw)) return Number(raw);
  const words: Record<string, number> = {
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
  };
  return words[raw] ?? null;
}

function targetDateField(
  activeRequirement: ActiveTravelRequirement,
  folded: string,
): 'departureDate' | 'returnDate' | null {
  if (/\bkeep everything else\b/.test(folded) || /\bchange (?:it|that) to\b/.test(folded)) {
    if (activeRequirement === 'returnDate') return 'returnDate';
    if (activeRequirement === 'departureDate') return 'departureDate';
  }
  if (activeRequirement === 'returnDate') return 'returnDate';
  if (activeRequirement === 'departureDate') return 'departureDate';
  if (/\breturn\b/.test(folded)) return 'returnDate';
  if (/\bdepart(?:ure|ing)?\b/.test(folded) || /\bleav(?:e|ing)\b/.test(folded)) {
    return 'departureDate';
  }
  return activeRequirement === 'none' ? null : null;
}

/**
 * Resolve relative temporal / reference language against interpretation context.
 * Returns null when the utterance is not a contextual temporal/reference update.
 */
export function resolveContextualTemporalSemantics(
  context: TravelInterpretationContext,
): TravelSemanticInterpretation | null {
  const folded = asciiFold(context.message).trim();
  if (!folded) return null;

  const semantic = emptySemanticInterpretation();
  semantic.intent = 'provide_info';
  let matched = false;

  const keepEverything = /\bkeep everything else\b/.test(folded);
  if (keepEverything) {
    semantic.preferences = ['preserve_unmentioned_fields'];
    matched = true;
  }

  if (/\bsame time\b/.test(folded)) {
    const pref =
      context.activeRequirement === 'returnDate'
        ? 'same_as_departure_time'
        : 'same_as_prior_time';
    if (context.activeRequirement === 'returnDate') {
      semantic.returnTimePreference = pref;
    } else {
      semantic.departureTimePreference = pref;
    }
    semantic.preferences = [...semantic.preferences, 'same_time'];
    semantic.confidence = Math.max(semantic.confidence, 0.75);
    matched = true;
  }

  if (/\bearlier flight\b/.test(folded) || /\bthe earlier flight\b/.test(folded)) {
    semantic.preferences = [...semantic.preferences, 'earlier_flight'];
    semantic.confidence = Math.max(semantic.confidence, 0.7);
    matched = true;
  }

  const anchor =
    context.temporalAnchors.primaryAnchorDate ??
    context.travelState.departureDate ??
    context.todayIso;

  // "the day after" / "N days later" / "four nights later"
  if (/\bthe day after\b/.test(folded)) {
    const next = addDays(anchor, 1);
    if (next) {
      assignDate(semantic, context, next);
      matched = true;
    }
  }

  const nightsLater = folded.match(
    /\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+nights?\s+later\b/,
  );
  if (nightsLater) {
    const n = wordNumber(nightsLater[1] ?? '');
    if (n !== null) {
      const dep = context.travelState.departureDate ?? anchor;
      const derived = addDays(dep, n);
      if (derived) {
        semantic.returnDate = ensureReturnOnOrAfterDeparture(
          derived,
          context.travelState.departureDate,
        );
        semantic.nightCount = n;
        semantic.confidence = Math.max(semantic.confidence, 0.85);
        matched = true;
      }
    }
  }

  const daysLater = folded.match(
    /\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+days?\s+later\b/,
  );
  if (daysLater && !nightsLater) {
    const n = wordNumber(daysLater[1] ?? '');
    if (n !== null) {
      const derived = addDays(anchor, n);
      if (derived) {
        assignDate(semantic, context, derived);
        matched = true;
      }
    }
  }

  // Weekend of the anchor week
  if (/\bthat weekend\b/.test(folded) || /\bthe weekend\b/.test(folded)) {
    const saturday = weekdayInWeekOf(anchor, 6);
    const sunday = saturday ? addDays(saturday, 1) : null;
    if (context.activeRequirement === 'returnDate' && sunday) {
      semantic.returnDate = ensureReturnOnOrAfterDeparture(
        sunday,
        context.travelState.departureDate,
      );
      semantic.confidence = Math.max(semantic.confidence, 0.8);
      matched = true;
    } else if (saturday) {
      // Prefer Saturday as departure when that slot is open / active.
      if (
        context.activeRequirement === 'departureDate' ||
        context.travelState.departureDate === null
      ) {
        semantic.departureDate = saturday;
      } else if (sunday) {
        semantic.returnDate = ensureReturnOnOrAfterDeparture(
          sunday,
          context.travelState.departureDate,
        );
      }
      semantic.confidence = Math.max(semantic.confidence, 0.8);
      matched = true;
    }
  }

  // Weekday references: "Monday of that week", "change it to Friday", bare "Friday"
  const weekdayHit = folded.match(
    /\b(?:(?:on|this|that|the)\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?:\s+of\s+(?:that|the|this)\s+week)?\b/,
  );
  const changeToWeekday = folded.match(
    /\bchange (?:it|that) to\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/,
  );
  const weekdayName = changeToWeekday?.[1] ?? weekdayHit?.[1];
  if (weekdayName) {
    const index = WEEKDAY_TO_INDEX[weekdayName];
    if (index !== undefined) {
      let weekAnchor = anchor;
      if (changeToWeekday) {
        // Correct the date currently in play for that slot.
        if (context.activeRequirement === 'returnDate' && context.travelState.returnDate) {
          weekAnchor = context.travelState.returnDate;
        } else if (context.travelState.departureDate) {
          weekAnchor = context.travelState.departureDate;
        }
        semantic.intent = 'correct';
      }

      let resolved = weekdayInWeekOf(weekAnchor, index);
      if (resolved) {
        const field = targetDateField(context.activeRequirement, folded);
        if (field === 'returnDate' || context.activeRequirement === 'returnDate') {
          resolved = ensureReturnOnOrAfterDeparture(
            resolved,
            context.travelState.departureDate,
          );
          semantic.returnDate = resolved;
        } else if (
          field === 'departureDate' ||
          context.activeRequirement === 'departureDate' ||
          context.travelState.departureDate === null
        ) {
          semantic.departureDate = resolved;
        } else {
          // Default: if return missing, treat as return; else departure correction.
          if (context.travelState.returnDate === null) {
            semantic.returnDate = ensureReturnOnOrAfterDeparture(
              resolved,
              context.travelState.departureDate,
            );
          } else {
            semantic.departureDate = resolved;
            semantic.intent = 'correct';
          }
        }
        semantic.confidence = Math.max(semantic.confidence, 0.86);
        matched = true;
      }
    }
  }

  if (!matched) return null;
  if (semantic.confidence < 0.35) semantic.confidence = 0.7;
  return semantic;
}

function assignDate(
  semantic: TravelSemanticInterpretation,
  context: TravelInterpretationContext,
  iso: string,
): void {
  if (context.activeRequirement === 'returnDate') {
    semantic.returnDate = ensureReturnOnOrAfterDeparture(
      iso,
      context.travelState.departureDate,
    );
  } else if (context.activeRequirement === 'departureDate') {
    semantic.departureDate = iso;
  } else if (context.travelState.departureDate === null) {
    semantic.departureDate = iso;
  } else if (context.travelState.returnDate === null) {
    semantic.returnDate = ensureReturnOnOrAfterDeparture(
      iso,
      context.travelState.departureDate,
    );
  } else {
    semantic.departureDate = iso;
    semantic.intent = 'correct';
  }
  semantic.confidence = Math.max(semantic.confidence, 0.82);
}
