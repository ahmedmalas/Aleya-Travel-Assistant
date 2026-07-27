import { MONTHS, WEEKDAYS } from '../lexicon';
import type {
  ConversationState,
  DepartureDate,
  ExactDate,
  ExtractionPatch,
  FieldValue,
  ReturnDate,
} from '../types';

const MONTH_NAMES =
  'january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec';

const WEEKDAY_NAMES = 'sunday|monday|tuesday|wednesday|thursday|friday|saturday';

function fieldExact(value: DepartureDate): FieldValue<DepartureDate> {
  return { value, source: 'explicit', confirmed: value.kind === 'exact' };
}

function buildExact(day: number, month: number, year: number, label: string): ExactDate {
  const isoDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return { kind: 'exact', isoDate, label, day, month, year };
}

function resolveYear(month: number, explicitYear: number | undefined, now: Date): number {
  if (explicitYear) return explicitYear < 100 ? 2000 + explicitYear : explicitYear;
  let year = now.getFullYear();
  if (month < now.getMonth() + 1) year += 1;
  return year;
}

function monthContextFromState(previous?: ConversationState): { month: number; year: number } | undefined {
  const dep = previous?.departureDate?.value;
  if (!dep) return undefined;
  if (dep.kind === 'mid_month' || dep.kind === 'month_end') {
    return { month: dep.month, year: dep.year };
  }
  if (dep.kind === 'unresolved' && dep.month != null && dep.year != null) {
    return { month: dep.month, year: dep.year };
  }
  if (dep.kind === 'exact') {
    return { month: dep.month, year: dep.year };
  }
  return undefined;
}

/** Parse absolute / numeric AU dates from a fragment. */
export function parseExactDate(
  text: string,
  now: Date,
  monthContext?: { month: number; year: number },
): ExactDate | undefined {
  const lower = text.toLowerCase().trim();

  // Friday 14th of August / Friday the 14th of August 2026
  const weekdayDayMonth = lower.match(
    new RegExp(
      `\\b(?:${WEEKDAY_NAMES})\\s+(?:the\\s+)?(\\d{1,2})(?:st|nd|rd|th)?(?:\\s+of)?\\s+(${MONTH_NAMES})(?:\\s+(\\d{2,4}))?\\b`,
    ),
  );
  if (weekdayDayMonth) {
    const day = Number(weekdayDayMonth[1]);
    const month = MONTHS[weekdayDayMonth[2]!];
    const year = resolveYear(month, weekdayDayMonth[3] ? Number(weekdayDayMonth[3]) : undefined, now);
    return buildExact(day, month, year, weekdayDayMonth[0]!);
  }

  // 14th of August / 14 August 2026
  const dayMonthYear = lower.match(
    new RegExp(
      `\\b(\\d{1,2})(?:st|nd|rd|th)?(?:\\s+of)?\\s+(${MONTH_NAMES})(?:\\s+(\\d{2,4}))?\\b`,
    ),
  );
  if (dayMonthYear) {
    const day = Number(dayMonthYear[1]);
    const month = MONTHS[dayMonthYear[2]!];
    const year = resolveYear(month, dayMonthYear[3] ? Number(dayMonthYear[3]) : undefined, now);
    return buildExact(day, month, year, dayMonthYear[0]!);
  }

  // August 14 / August 14th 2026
  const monthDayYear = lower.match(
    new RegExp(`\\b(${MONTH_NAMES})\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:\\s+(\\d{2,4}))?\\b`),
  );
  if (monthDayYear) {
    const month = MONTHS[monthDayYear[1]!];
    const day = Number(monthDayYear[2]);
    const year = resolveYear(month, monthDayYear[3] ? Number(monthDayYear[3]) : undefined, now);
    return buildExact(day, month, year, monthDayYear[0]!);
  }

  const numeric = lower.match(/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2}|\d{4})\b/);
  if (numeric) {
    const day = Number(numeric[1]);
    const month = Number(numeric[2]);
    let year = Number(numeric[3]);
    if (year < 100) year += 2000;
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      return buildExact(day, month, year, numeric[0]!);
    }
  }

  // Clarification answers: "14th", "the 14th", "14" against retained month context
  if (monthContext) {
    const dayOnly = lower.match(/^(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?$/);
    if (dayOnly) {
      const day = Number(dayOnly[1]);
      if (day >= 1 && day <= 31) {
        return buildExact(day, monthContext.month, monthContext.year, dayOnly[0]!);
      }
    }
  }

  return undefined;
}

export function parseMidMonth(text: string, now: Date): DepartureDate | undefined {
  return parseMonthPeriod(text, now);
}

/** early / mid / late <month> → retained period until an exact day is given. */
export function parseMonthPeriod(text: string, now: Date): DepartureDate | undefined {
  const match = text.toLowerCase().match(
    new RegExp(`\\b(early|mid|late)[-\\s]?(${MONTH_NAMES})(?:\\s+(\\d{2,4}))?\\b`),
  );
  if (!match) return undefined;
  const period = match[1]!;
  const month = MONTHS[match[2]!];
  const year = resolveYear(month, match[3] ? Number(match[3]) : undefined, now);
  const label = match[0]!;
  if (period === 'mid') {
    return { kind: 'mid_month', month, year, label };
  }
  if (period === 'late') {
    return { kind: 'month_end', month, year, label };
  }
  return { kind: 'unresolved', label, month, year };
}

function nextWeekdayAfter(isoDate: string, weekday: number): ReturnDate {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  let guard = 0;
  while (d.getUTCDay() !== weekday && guard < 8) {
    d.setUTCDate(d.getUTCDate() + 1);
    guard += 1;
  }
  const iso = d.toISOString().slice(0, 10);
  return {
    isoDate: iso,
    label: iso,
    weekday,
    day: d.getUTCDate(),
    month: d.getUTCMonth() + 1,
    year: d.getUTCFullYear(),
  };
}

function addNights(isoDate: string, nights: number): ReturnDate {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + nights);
  const iso = d.toISOString().slice(0, 10);
  return {
    isoDate: iso,
    label: iso,
    day: d.getUTCDate(),
    month: d.getUTCMonth() + 1,
    year: d.getUTCFullYear(),
  };
}

/**
 * Explicit date correction / invalidation language.
 * Returns a patch that clears or replaces departure — never keeps a contradicted exact date.
 */
export function extractDateCorrection(text: string, now: Date): Partial<ExtractionPatch> | undefined {
  const lower = text.toLowerCase().trim();
  const correctionCue =
    /^(no\b|nope\b|nah\b)|^\s*actually\b|\bchange\s+(?:the\s+)?(?:departure\s+)?date\b|\bforget\s+(?:that\s+)?date\b|\bhaven'?t\s+decided\b|\bnot\s+the\s+\d|\bi want to leave\b|\bleave\s+(?:mid|early|late|earlier|later)\b|\bmake it\b/i.test(
      lower,
    );

  if (/\bforget\s+(?:that\s+)?date\b|\bhaven'?t\s+decided\b|\bnot sure (?:about )?(?:the )?date\b/i.test(lower)) {
    return {
      clearFields: ['departureDate'],
      explicitChanges: ['departureDate'],
      departureDate: {
        value: { kind: 'unresolved', label: 'date undecided' },
        source: 'explicit',
        confirmed: false,
      },
    };
  }

  const period = parseMonthPeriod(text, now);
  if (
    period &&
    (correctionCue ||
      /\b(?:early|mid|late)[- ]?(?:january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\b/i.test(
        lower,
      ))
  ) {
    return {
      clearFields: [],
      explicitChanges: ['departureDate'],
      departureDate: fieldExact(period),
    };
  }

  if (correctionCue) {
    const exact = parseExactDate(text, now);
    if (exact) {
      return {
        explicitChanges: ['departureDate'],
        departureDate: fieldExact(exact),
      };
    }
  }

  const notNth = lower.match(/\bnot\s+the\s+(\d{1,2})(?:st|nd|rd|th)?\b/);
  if (notNth) {
    const replacement = parseExactDate(text, now);
    if (replacement && String(replacement.day) !== notNth[1]) {
      return {
        explicitChanges: ['departureDate'],
        departureDate: fieldExact(replacement),
      };
    }
    return {
      clearFields: ['departureDate'],
      explicitChanges: ['departureDate'],
      departureDate: {
        value: { kind: 'unresolved', label: 'date to confirm' },
        source: 'explicit',
        confirmed: false,
      },
    };
  }

  return undefined;
}

export function extractDates(
  text: string,
  now: Date,
  durationNights?: number,
  previous?: ConversationState,
): Partial<ExtractionPatch> {
  const patch: Partial<ExtractionPatch> = { explicitChanges: [], clearFields: [] };
  const monthContext = monthContextFromState(previous);
  const pendingDate = previous?.pendingClarification === 'departureDate';

  const correction = extractDateCorrection(text, now);
  if (correction?.departureDate) {
    patch.departureDate = correction.departureDate;
    patch.explicitChanges = [...(patch.explicitChanges ?? []), 'departureDate'];
    if (correction.clearFields?.length) {
      patch.clearFields = [...(patch.clearFields ?? []), ...correction.clearFields];
    }
  }

  if (!patch.departureDate) {
    // Exact day answers must win while a departure clarification is pending,
    // including "14th of August" and day-only replies against mid-August context.
    const exact = parseExactDate(text, now, pendingDate || monthContext ? monthContext : undefined);
    const periodOnly =
      /\b(?:early|mid|late)[- ]?(?:january|february|march|april|may|june|july|august|september|october|november|december)\b/i.test(
        text,
      ) &&
      !/\b\d{1,2}(?:st|nd|rd|th)?(?:\s+of)?\s+(?:january|february|march|april|may|june|july|august|september|october|november|december)/i.test(
        text,
      );

    if (exact && (!periodOnly || pendingDate)) {
      patch.departureDate = fieldExact(exact);
      patch.explicitChanges = [...(patch.explicitChanges ?? []), 'departureDate'];
    } else if (periodOnly) {
      const period = parseMonthPeriod(text, now);
      if (period) {
        patch.departureDate = fieldExact(period);
        patch.explicitChanges = [...(patch.explicitChanges ?? []), 'departureDate'];
      }
    } else if (exact) {
      patch.departureDate = fieldExact(exact);
      patch.explicitChanges = [...(patch.explicitChanges ?? []), 'departureDate'];
    }
  }

  const returnWeekday = text.match(
    new RegExp(
      `\\b(?:return(?:ing)?|come back)(?:\\s+on)?\\s+(${WEEKDAY_NAMES})\\b`,
      'i',
    ),
  );
  const weekendCue = /\b(?:over\s+the\s+weekend|this\s+weekend|for\s+the\s+weekend)\b/i.test(text);
  const depIso =
    patch.departureDate?.value.kind === 'exact' ? patch.departureDate.value.isoDate : undefined;

  if (returnWeekday?.[1]) {
    const weekdayName = returnWeekday[1].toLowerCase();
    const weekday = WEEKDAYS[weekdayName]!;
    if (depIso) {
      patch.returnDate = {
        value: nextWeekdayAfter(depIso, weekday),
        source: 'explicit',
        confirmed: true,
      };
    } else {
      // Preserve Monday (and weekend) constraint until an exact departure is known.
      patch.returnDate = {
        value: {
          label: weekendCue ? `weekend, ${weekdayName}` : weekdayName,
          weekday,
        },
        source: 'explicit',
        confirmed: false,
      };
    }
    patch.explicitChanges = [...(patch.explicitChanges ?? []), 'returnDate'];
  } else if (weekendCue && !depIso) {
    // Weekend without an explicit return weekday → prefer Friday departure later;
    // keep a Monday return constraint as the common weekend pattern.
    patch.returnDate = {
      value: { label: 'weekend, monday', weekday: 1 },
      source: 'inferred',
      confirmed: false,
    };
    patch.explicitChanges = [...(patch.explicitChanges ?? []), 'returnDate'];
  } else if (depIso && durationNights != null && durationNights > 0) {
    patch.returnDate = {
      value: addNights(depIso, durationNights),
      source: 'inferred',
      confirmed: false,
    };
  }

  return patch;
}

/** Recalculate return when departure becomes exact and nights/weekday known. */
export function deriveReturn(
  departureIso: string,
  previousReturn: ReturnDate | undefined,
  nights: number | undefined,
): ReturnDate | undefined {
  if (previousReturn?.weekday != null) {
    return nextWeekdayAfter(departureIso, previousReturn.weekday);
  }
  if (nights != null && nights > 0) return addNights(departureIso, nights);
  if (previousReturn?.isoDate) {
    return previousReturn;
  }
  return undefined;
}
