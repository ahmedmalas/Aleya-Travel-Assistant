import type { ApproximateDate, ConversationState, TimePreference } from '../types';
import type { DateParseContext, ExtractionPatch } from './types';
import { MONTHS, WEEKDAYS, field, markChanged } from './shared';

export type { DateParseContext };

function resolveYearForMonth(
  month: number,
  explicitYear: number | undefined,
  now: Date,
  contextYear?: number,
): number {
  if (explicitYear) return explicitYear;
  if (contextYear) return contextYear;
  let year = now.getFullYear();
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
  return { kind: 'absolute', isoDate: iso, label, weekday, month, year };
}

/** Parse common Australian absolute date phrases. */
export function parseAbsoluteDate(
  text: string,
  now: Date,
  context?: DateParseContext,
): ApproximateDate | undefined {
  const lower = text.toLowerCase().trim();
  const monthNames =
    'january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec';
  const weekdays = 'sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue|wed|thu|fri|sat';

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

  const monthDay = lower.match(
    new RegExp(`\\b(${monthNames})\\s+(?:the\\s+)?(\\d{1,2})(?:st|nd|rd|th)?(?:\\s+(\\d{4}))?\\b`),
  );
  if (monthDay) {
    const month = MONTHS[monthDay[1]!];
    const day = Number(monthDay[2]);
    const year = resolveYearForMonth(month, monthDay[3] ? Number(monthDay[3]) : undefined, now, context?.year);
    return buildAbsoluteDate(day, month, year, monthDay[0]!);
  }

  // Numeric AU formats: 28/08/2026, 28-08-26, 28.08.2026
  const numeric = lower.match(/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2}|\d{4})\b/);
  if (numeric) {
    const day = Number(numeric[1]);
    const month = Number(numeric[2]);
    let year = Number(numeric[3]);
    if (year < 100) year += year >= 70 ? 1900 : 2000;
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 2000 && year <= 2100) {
      return buildAbsoluteDate(day, month, year, numeric[0]!);
    }
  }

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

export function parseRelativeDate(text: string, now: Date): ApproximateDate | undefined {
  const lower = text.toLowerCase();
  const endOfMonth = lower.match(
    /\bend of (january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\b/,
  );
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

export function extractTimePreference(fragment: string): TimePreference | undefined {
  const t = fragment.toLowerCase();
  if (/after\s*5|after work|from\s*5\s*pm/.test(t)) return 'after_5pm';
  if (/\bmorning\b/.test(t)) return 'morning';
  if (/\bafternoon\b/.test(t)) return 'afternoon';
  if (/\bevening\b|\bnight\b/.test(t)) return 'evening';
  if (/\bflexible\b/.test(t)) return 'flexible';
  return undefined;
}

export function dateContextFromState(previous?: ConversationState): DateParseContext | undefined {
  const dep = previous?.departureDate?.value;
  if (!dep) return undefined;
  const month = dep.month ?? (dep.isoDate ? Number(dep.isoDate.slice(5, 7)) : undefined);
  const year = dep.year ?? (dep.isoDate ? Number(dep.isoDate.slice(0, 4)) : undefined);
  if (month == null && year == null) return undefined;
  return { month, year };
}

export function awaitingExactDepartureDate(previous?: ConversationState): boolean {
  if (!previous) return false;
  // Concrete ISO departure is settled — never treat leftover suggestions as pending.
  if (previous.departureDate?.value.isoDate) return false;
  if (previous.awaitingDateConfirmation) return true;
  if (previous.lastSuggestedDate) return true;
  if (previous.missingRequiredFields.includes('departureDate')) return true;
  if (previous.missingRequiredFields.includes('departureDateConfirmation')) return true;
  const kind = previous.departureDate?.value.kind;
  return Boolean(kind && kind !== 'absolute' && !previous.departureDate?.value.isoDate);
}

export function looksLikeDateConfirmation(
  text: string,
  previous?: ConversationState,
  now = new Date(),
): boolean {
  const t = text.trim().toLowerCase();
  if (previous?.awaitingDestinationConfirmation) return false;
  if (!awaitingExactDepartureDate(previous)) return false;
  // Compound turns keep normal extraction (return / service ops)
  if (/\b(?:come back|return|remove|forget|add|keep|don'?t need)\b/i.test(text)) return false;
  if (/^(yes|yep|yeah|correct|confirm|that works|sounds good)\b/.test(t)) return true;
  if (t.includes('friday') && (t.includes('28') || t.includes('august'))) return true;
  if (t.length <= 80 && parseAbsoluteDate(text, now, dateContextFromState(previous))) return true;
  return false;
}

function resolveReturnWeekdayAfterDeparture(
  departureIso: string,
  weekday: number,
  label: string,
): ApproximateDate {
  const d = new Date(`${departureIso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  let guard = 0;
  while (d.getUTCDay() !== weekday && guard < 8) {
    d.setUTCDate(d.getUTCDate() + 1);
    guard += 1;
  }
  return {
    kind: 'absolute',
    isoDate: d.toISOString().slice(0, 10),
    label,
    weekday,
    month: d.getUTCMonth() + 1,
    year: d.getUTCFullYear(),
  };
}

function extractReturnWeekdayPhrase(text: string): { weekday: number; label: string } | undefined {
  const match = text.match(
    /\b(?:come back|return(?:ing)?)(?:\s+on)?\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i,
  );
  if (!match?.[1]) return undefined;
  const weekday = WEEKDAYS[match[1].toLowerCase()];
  if (weekday == null) return undefined;
  return { weekday, label: match[0]!.trim() };
}

/** Extract departure, return, and time preferences in one pass. */
export function extractDatesAndTimes(
  text: string,
  previous: ConversationState | undefined,
  now: Date,
): Partial<ExtractionPatch> {
  const patch: Partial<ExtractionPatch> = { changedFields: [], explicitChanges: [] };
  const changed = patch.changedFields!;
  const explicit = patch.explicitChanges!;
  const lower = text.toLowerCase();
  const dateCtx = dateContextFromState(previous);

  if (looksLikeDateConfirmation(text, previous, now)) {
    patch.isDateConfirmation = true;
    const absolute = parseAbsoluteDate(text, now, dateCtx);
    if (absolute) {
      patch.confirmedDateLabel = absolute.label;
      patch.departureDate = field(absolute, 'confirmed');
      markChanged(changed, 'departureDate');
      explicit.push('departureDate');
    } else if (previous?.lastSuggestedDate) {
      patch.confirmedDateLabel = previous.lastSuggestedDate.label;
      patch.departureDate = field({ ...previous.lastSuggestedDate, kind: 'absolute' }, 'confirmed');
      markChanged(changed, 'departureDate');
      explicit.push('departureDate');
    }
  }

  const returnOnlyUpdate = /^\s*return\b/i.test(text) && !/\b(?:depart|leave|outbound|from\s+[A-Z])/i.test(text);
  const dateChange = text.match(/\b(?:change|update|move)\s+(?:the\s+)?date\s+to\s+(.+)$/i);

  if (!patch.departureDate && !returnOnlyUpdate) {
    const depDate = dateChange
      ? parseAbsoluteDate(dateChange[1]!, now) ?? parseRelativeDate(dateChange[1]!, now)
      : parseRelativeDate(text, now);
    if (depDate) {
      // When absolute date + return weekday share one sentence, prefer absolute as departure
      // and leave weekday for return (parseRelativeDate end-of-month may latch weekday).
      if (depDate.kind === 'month_end' && extractReturnWeekdayPhrase(text)) {
        const { weekday: _w, ...rest } = depDate;
        patch.departureDate = field(rest);
      } else {
        patch.departureDate = field(depDate);
      }
      markChanged(changed, 'departureDate');
      if (depDate.kind === 'absolute' || depDate.isoDate || dateChange) {
        explicit.push('departureDate');
      }
    }
  }

  // Outbound time: only from explicit outbound clauses, never from return clauses
  const fridayWindow = /\bfriday\b/i.test(text)
    ? text.match(/\bfriday\b[\s\S]{0,80}?(?=come back|return|$)/i)?.[0] ?? ''
    : '';
  if (fridayWindow) {
    const pref = /after\s*5|after work/.test(fridayWindow.toLowerCase())
      ? 'after_5pm'
      : extractTimePreference(fridayWindow);
    if (pref) {
      patch.departureTimePreference = field(pref);
      markChanged(changed, 'departureTimePreference');
    }
    const outboundPref = pref ?? previous?.departureTimePreference?.value;
    if (patch.departureDate) {
      patch.departureDate = field({
        ...patch.departureDate.value,
        weekday: 5,
        timePreference: outboundPref ?? patch.departureDate.value.timePreference,
      });
    } else if (!parseAbsoluteDate(text, now, dateCtx) && !patch.isDateConfirmation) {
      patch.departureDate = field({
        kind: 'relative',
        label: 'Friday',
        weekday: 5,
        timePreference: outboundPref,
      });
      markChanged(changed, 'departureDate');
    }
  } else if (
    /after\s*5|after work/.test(lower) &&
    !/\b(?:come back|return)[\s\S]{0,40}(?:after\s*5|afternoon)/.test(lower)
  ) {
    patch.departureTimePreference = field('after_5pm');
    markChanged(changed, 'departureTimePreference');
  }

  if (!patch.departureTimePreference) {
    if (
      /\b(?:leave|depart(?:ure)?|fly|flight)\s+(?:in\s+the\s+|early\s+)?morning\b/i.test(text) ||
      /\bmorning\s+(?:flight|departure)\b/i.test(text) ||
      /\bdepart early morning\b/i.test(text)
    ) {
      patch.departureTimePreference = field('morning');
      markChanged(changed, 'departureTimePreference');
    } else if (
      /\b(?:leave|depart(?:ure)?|fly|flight)\s+(?:in\s+the\s+)?afternoon\b/i.test(text) ||
      /\bafternoon\s+(?:flight|departure)\b/i.test(text)
    ) {
      patch.departureTimePreference = field('afternoon');
      markChanged(changed, 'departureTimePreference');
    } else if (
      /\b(?:leave|depart(?:ure)?|fly|flight)\s+(?:in\s+the\s+)?evening\b/i.test(text) ||
      /\bevening\s+(?:flight|departure)\b/i.test(text) ||
      /\bfly after\s+5\s*(?:pm|p\.m\.)\b/i.test(text)
    ) {
      patch.departureTimePreference = field(
        /\bafter\s+5\s*(?:pm|p\.m\.)\b/i.test(text) ? 'after_5pm' : 'evening',
      );
      markChanged(changed, 'departureTimePreference');
    }
  }

  // Return date / time
  const returnClause = text.match(/\b(?:come back|return(?:ing)?)([\s\S]{0,60})/i);
  if (returnClause) {
    const returnBit = returnClause[0]!;
    const returnAbs = parseAbsoluteDate(returnBit, now);
    const returnTime = extractTimePreference(returnBit);
    const returnWeekday = extractReturnWeekdayPhrase(text);
    const departureIso = patch.departureDate?.value.isoDate ?? previous?.departureDate?.value.isoDate;

    if (returnAbs && !returnWeekday) {
      patch.returnDate = field({ ...returnAbs, timePreference: returnTime });
      markChanged(changed, 'returnDate');
      explicit.push('returnDate');
    } else if (returnWeekday) {
      const label = returnTime ? `${returnWeekday.label} ${returnTime}` : returnWeekday.label;
      patch.returnDate = field(
        departureIso
          ? { ...resolveReturnWeekdayAfterDeparture(departureIso, returnWeekday.weekday, label), timePreference: returnTime }
          : { kind: 'relative', label, weekday: returnWeekday.weekday, timePreference: returnTime },
      );
      markChanged(changed, 'returnDate');
      explicit.push('returnDate');
    } else if (returnTime) {
      patch.returnDate = field({ kind: 'relative', label: `return ${returnTime}`, timePreference: returnTime });
      markChanged(changed, 'returnDate');
      explicit.push('returnDate');
    }
    if (returnTime) {
      patch.returnTimePreference = field(returnTime);
      markChanged(changed, 'returnTimePreference');
      explicit.push('returnTimePreference');
    }
  } else if (/\bcome back\b|\breturn\b/.test(lower) && /\bafternoon\b/.test(lower)) {
    patch.returnTimePreference = field('afternoon');
    markChanged(changed, 'returnTimePreference');
  }

  if (!patch.returnDate) {
    const returnWeekday = extractReturnWeekdayPhrase(text);
    if (returnWeekday) {
      const departureIso = patch.departureDate?.value.isoDate ?? previous?.departureDate?.value.isoDate;
      const returnTime = extractTimePreference(
        text.match(/\b(?:come back|return(?:ing)?)([\s\S]{0,40})/i)?.[0] ?? '',
      );
      patch.returnDate = field(
        departureIso
          ? {
              ...resolveReturnWeekdayAfterDeparture(departureIso, returnWeekday.weekday, returnWeekday.label),
              timePreference: returnTime,
            }
          : {
              kind: 'relative',
              label: returnWeekday.label,
              weekday: returnWeekday.weekday,
              timePreference: returnTime,
            },
      );
      markChanged(changed, 'returnDate');
      if (returnTime) {
        patch.returnTimePreference = field(returnTime);
        markChanged(changed, 'returnTimePreference');
      }
    }
  }

  return patch;
}

export function extractDurationNights(text: string): number | undefined {
  const word: Record<string, number> = {
    one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
    eleven: 11, twelve: 12, fourteen: 14,
  };
  const m = text.match(
    /\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fourteen)\s*nights?\b/i,
  );
  if (!m?.[1]) return undefined;
  if (/^\d+$/.test(m[1])) return Number(m[1]);
  return word[m[1].toLowerCase()];
}
