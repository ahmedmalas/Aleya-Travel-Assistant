import { MONTHS, MONTH_PATTERN, WEEKDAY_PATTERN, WEEKDAYS } from '../lexicon';
import type { ConversationState, TripField } from '../types';
import type { DateCandidate, DurationCandidate } from './types';

function resolveYear(month: number, explicitYear: number | undefined, now: Date): number {
  if (explicitYear) return explicitYear < 100 ? 2000 + explicitYear : explicitYear;
  let year = now.getFullYear();
  if (month < now.getMonth() + 1) year += 1;
  return year;
}

function iso(day: number, month: number, year: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function monthContext(previous?: ConversationState): { month: number; year: number } | undefined {
  const dep = previous?.departureDate?.value;
  if (!dep) return undefined;
  if (dep.kind === 'approximate') return { month: dep.month, year: dep.year };
  if (dep.kind === 'unresolved' && dep.month != null && dep.year != null) {
    return { month: dep.month, year: dep.year };
  }
  if (dep.kind === 'exact') return { month: dep.month, year: dep.year };
  return undefined;
}

export function extractDateCandidates(
  text: string,
  now: Date,
  previous?: ConversationState,
  awaitingField?: TripField,
): DateCandidate[] {
  const found: DateCandidate[] = [];
  const lower = text.toLowerCase();
  const ctx = monthContext(previous);
  const pendingDate = awaitingField === 'departureDate';

  // Approximate periods
  const approx = lower.match(
    new RegExp(`\\b(early|mid|late)[-\\s]?(${MONTH_PATTERN})(?:\\s+(\\d{2,4}))?\\b`),
  );
  if (approx) {
    const period = approx[1] as 'early' | 'mid' | 'late';
    const month = MONTHS[approx[2]!];
    const year = resolveYear(month, approx[3] ? Number(approx[3]) : undefined, now);
    found.push({
      kind: 'date',
      raw: approx[0]!,
      roleHint: 'approximate',
      cue: `${period}-month`,
      index: approx.index ?? 0,
      confidence: 0.9,
      source: 'explicit',
      approximate: { period, month, year, label: approx[0]! },
    });
  }

  // Exact: Friday 28th of August / 28th of August / 28 August
  const weekdayExact = lower.match(
    new RegExp(
      `\\b(?:${WEEKDAY_PATTERN})\\s+(?:the\\s+)?(\\d{1,2})(?:st|nd|rd|th)?(?:\\s+of)?\\s+(${MONTH_PATTERN})(?:\\s+(\\d{2,4}))?\\b`,
    ),
  );
  const dayMonth = lower.match(
    new RegExp(
      `\\b(?:the\\s+)?(\\d{1,2})(?:st|nd|rd|th)?(?:\\s+of)?\\s+(${MONTH_PATTERN})(?:\\s+(\\d{2,4}))?\\b`,
    ),
  );
  const monthDay = lower.match(
    new RegExp(`\\b(${MONTH_PATTERN})\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:\\s+(\\d{2,4}))?\\b`),
  );
  const numeric = lower.match(/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2}|\d{4})\b/);

  const pushExact = (
    day: number,
    month: number,
    year: number,
    label: string,
    index: number,
    cue: string,
  ) => {
    found.push({
      kind: 'date',
      raw: label,
      roleHint: 'departure',
      cue,
      index,
      confidence: 0.95,
      source: 'explicit',
      exact: { day, month, year, isoDate: iso(day, month, year), label },
    });
  };

  if (weekdayExact) {
    const day = Number(weekdayExact[1]);
    const month = MONTHS[weekdayExact[2]!];
    const year = resolveYear(month, weekdayExact[3] ? Number(weekdayExact[3]) : undefined, now);
    pushExact(day, month, year, weekdayExact[0]!, weekdayExact.index ?? 0, 'weekday-day-month');
  } else if (dayMonth) {
    // Prefer exact over mid-month when both appear unless mid-only intent
    const midOnly =
      /\b(?:early|mid|late)[- ]?[a-z]+\b/i.test(lower) &&
      !/\b\d{1,2}(?:st|nd|rd|th)?(?:\s+of)?\s+[a-z]+/i.test(lower);
    if (!midOnly || pendingDate) {
      const day = Number(dayMonth[1]);
      const month = MONTHS[dayMonth[2]!];
      const year = resolveYear(month, dayMonth[3] ? Number(dayMonth[3]) : undefined, now);
      pushExact(day, month, year, dayMonth[0]!, dayMonth.index ?? 0, 'day-month');
    }
  } else if (monthDay) {
    const month = MONTHS[monthDay[1]!];
    const day = Number(monthDay[2]);
    const year = resolveYear(month, monthDay[3] ? Number(monthDay[3]) : undefined, now);
    pushExact(day, month, year, monthDay[0]!, monthDay.index ?? 0, 'month-day');
  } else if (numeric) {
    const day = Number(numeric[1]);
    const month = Number(numeric[2]);
    let year = Number(numeric[3]);
    if (year < 100) year += 2000;
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      pushExact(day, month, year, numeric[0]!, numeric.index ?? 0, 'numeric-au');
    }
  } else if ((pendingDate || ctx) && ctx) {
    const dayOnly = lower.trim().match(/^(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?$/);
    if (dayOnly) {
      const day = Number(dayOnly[1]);
      if (day >= 1 && day <= 31) {
        pushExact(day, ctx.month, ctx.year, dayOnly[0]!, 0, 'day-only-context');
      }
    }
  }

  // Return weekday + weekend
  const returnWd = lower.match(
    new RegExp(`\\b(?:return(?:ing)?|come back)(?:\\s+on)?\\s+(${WEEKDAY_PATTERN})\\b`),
  );
  const weekend = /\b(?:over\s+the\s+weekend|this\s+weekend|for\s+the\s+weekend)\b/i.test(lower);
  if (returnWd?.[1]) {
    const weekday = WEEKDAYS[returnWd[1]!]!;
    found.push({
      kind: 'date',
      raw: returnWd[0]!,
      roleHint: 'return',
      cue: 'return-weekday',
      index: returnWd.index ?? 0,
      confidence: 0.9,
      source: 'explicit',
      returnWeekday: weekday,
      weekend,
    });
  } else if (weekend) {
    found.push({
      kind: 'date',
      raw: 'weekend',
      roleHint: 'return',
      cue: 'weekend',
      index: lower.indexOf('weekend'),
      confidence: 0.55,
      source: 'inferred',
      returnWeekday: 1,
      weekend: true,
    });
  }

  return found;
}

export function extractDurationCandidates(text: string): DurationCandidate[] {
  const words: Record<string, number> = {
    one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  };
  const numeric = text.match(/\bfor\s+(\d+)\s+nights?\b/i);
  if (numeric) {
    return [
      {
        kind: 'duration',
        nights: Number(numeric[1]),
        raw: numeric[0]!,
        index: numeric.index ?? 0,
        confidence: 0.95,
        source: 'explicit',
      },
    ];
  }
  const worded = text.match(/\bfor\s+(one|two|three|four|five|six|seven)\s+nights?\b/i);
  if (worded?.[1]) {
    return [
      {
        kind: 'duration',
        nights: words[worded[1].toLowerCase()]!,
        raw: worded[0]!,
        index: worded.index ?? 0,
        confidence: 0.95,
        source: 'explicit',
      },
    ];
  }
  return [];
}
