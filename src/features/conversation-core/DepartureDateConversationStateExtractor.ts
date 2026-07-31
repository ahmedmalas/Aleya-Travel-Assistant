import type {
  ConversationStateExtractionInput,
  ConversationStateExtractionResult,
  ConversationStateExtractor,
} from './types';

/**
 * Internal departure-date extraction boundary.
 *
 * Phase 7C: recognises only narrow, explicit departure-date statements in the
 * current message. Phase 8C extends clear departure-date cues only.
 * Deterministic and local — no Date API, geographic services, return-date
 * extraction, or currentState inspection.
 *
 * Phase 17D: adds explicit departure-cued repair forms. Bare repaired dates
 * remain unowned. Return-cued messages stay blocked for this extractor.
 */
export class DepartureDateConversationStateExtractor
  implements ConversationStateExtractor
{
  extract(
    input: ConversationStateExtractionInput,
  ): ConversationStateExtractionResult {
    const departureDate = extractExplicitDepartureDate(input.message);
    if (departureDate === null) {
      return {
        stateUpdate: {},
      };
    }
    return {
      stateUpdate: {
        departureDate: departureDate,
      },
    };
  }
}

/** Trim edges without String.prototype.trim (architecture boundary). */
function edgeTrim(value: string): string {
  return value.replace(/^\s+|\s+$/g, '');
}

function pad2(value: string): string {
  return value.length === 1 ? `0${value}` : value;
}

function monthTokenToMm(month: string): string | null {
  if (/^jan(?:uary)?$/i.test(month)) return '01';
  if (/^feb(?:ruary)?$/i.test(month)) return '02';
  if (/^mar(?:ch)?$/i.test(month)) return '03';
  if (/^apr(?:il)?$/i.test(month)) return '04';
  if (/^may$/i.test(month)) return '05';
  if (/^jun(?:e)?$/i.test(month)) return '06';
  if (/^jul(?:y)?$/i.test(month)) return '07';
  if (/^aug(?:ust)?$/i.test(month)) return '08';
  if (/^sept?(?:ember)?$/i.test(month)) return '09';
  if (/^oct(?:ober)?$/i.test(month)) return '10';
  if (/^nov(?:ember)?$/i.test(month)) return '11';
  if (/^dec(?:ember)?$/i.test(month)) return '12';
  return null;
}

/**
 * Phase 17D contrast repair:
 * "Not departing on 28 August 2026, departing on 29 August 2026".
 */
function matchContrastDepartureDateRepair(
  message: string,
): { previousRaw: string; nextRaw: string } | null {
  const match = edgeTrim(message).match(
    /^not\s+departing\s+on\s+([^,]+),\s*departing\s+on\s+(.+)$/i,
  );
  if (match === null) {
    return null;
  }
  const previousRaw = match[1];
  const nextRaw = match[2];
  if (typeof previousRaw !== 'string' || typeof nextRaw !== 'string') {
    return null;
  }
  return { previousRaw, nextRaw };
}

/** True when the message carries an explicit departure-date cue or repair form. */
function hasExplicitDepartureDateCue(message: string): boolean {
  return (
    /\bdeparture\s+date\s+is\b/i.test(message) ||
    /\bdeparture\s+is\b/i.test(message) ||
    /\bchange\s+(?:the\s+)?departure\s+date\s+to\b/i.test(message) ||
    /\bno[,.]?\s+make\s+the\s+departure\s+date\b/i.test(message) ||
    /\bdepart(?:ing)?\s+on\b/i.test(message) ||
    /\bleav(?:e|ing)\s+on\b/i.test(message) ||
    /\bfly(?:ing)?\s+on\b/i.test(message) ||
    /\btravel(?:l?ing)?\s+on\b/i.test(message) ||
    matchContrastDepartureDateRepair(message) !== null
  );
}

function isBlockedDepartureDateMessage(message: string): boolean {
  if (/\?/.test(message)) {
    return true;
  }
  if (
    /\breturn(?:ing)?\b/i.test(message) ||
    /\bcome\s+back\b/i.test(message) ||
    /\bback\s+on\b/i.test(message) ||
    /\buntil\b/i.test(message)
  ) {
    return true;
  }
  if (
    /\bhotel\s+booked\s+for\b/i.test(message) ||
    /\bevents?\s+on\b/i.test(message) ||
    /\bconcerts?\s+on\b/i.test(message)
  ) {
    return true;
  }
  if (
    /\b(?:tomorrow|yesterday|tonight|today)\b/i.test(message) ||
    /\bnext\s+(?:week|month|year|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i.test(
      message,
    ) ||
    /\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i.test(
      message,
    ) ||
    /\bsometime\b/i.test(message) ||
    /\blate\s+(?:january|february|march|april|may|june|july|august|september|october|november|december)\b/i.test(
      message,
    ) ||
    /\bthe\s+\d{1,2}(?:st|nd|rd|th)\b/i.test(message)
  ) {
    return true;
  }
  if (
    /\b(?:hours?|minutes?|days?|nights?|weeks?)\b/i.test(message) &&
    !/\b(?:january|february|march|april|may|june|july|august|september|october|november|december|\d{4}-\d{2}-\d{2})\b/i.test(
      message,
    )
  ) {
    return true;
  }
  if (/\bA\$|\b\$\d/i.test(message)) {
    return true;
  }
  if (/\bkeep\b/i.test(message) || /\bforget\b/i.test(message)) {
    return true;
  }
  // Comparative / non-repair clauses that mention departing on a date.
  if (/\bcheaper\b/i.test(message)) {
    return true;
  }
  // "instead" remains a hard block (including "Depart on … instead").
  if (/\binstead\b/i.test(message)) {
    return true;
  }
  // Phase 17D: allow "Actually, depart on …" when an explicit departure cue
  // is present; bare "Actually, {date}" stays blocked (no cue).
  if (/\bactually\b/i.test(message) && !hasExplicitDepartureDateCue(message)) {
    return true;
  }
  if (
    /\b(?:do\s+not|don't)\s+(?:leave|depart|change|make)\b/i.test(message)
  ) {
    return true;
  }
  // Phase 17D: allow only the narrow contrast-repair shape through not-block.
  if (
    /\bnot\b/i.test(message) &&
    matchContrastDepartureDateRepair(message) === null
  ) {
    return true;
  }
  return false;
}

/** Phase 17D explicit departure-date repair cues (before general cues). */
const DEPARTURE_DATE_REPAIR_CUES: readonly RegExp[] = [
  /\b(?:sorry[,.]?\s+)?i\s+meant\s+depart(?:ing)?\s+(?:on\s+)?(.+)$/i,
  /\bactually[,.]?\s+depart(?:ing)?\s+(?:on\s+)?(.+)$/i,
  /\bactually[,.]?\s+leav(?:e|ing)\s+(?:on\s+)?(.+)$/i,
  /\bno[,.]?\s+make\s+the\s+departure\s+date\s+(.+)$/i,
  /\bchange\s+(?:the\s+)?departure\s+date\s+to\s+(.+)$/i,
  /\bchange\s+that\s+to\s+departing\s+on\s+(.+)$/i,
];

const EXPLICIT_DEPARTURE_DATE_CUES: readonly RegExp[] = [
  ...DEPARTURE_DATE_REPAIR_CUES,
  /\bdeparture\s+date\s+is\s+(.+)$/i,
  /\bdeparture\s+is\s+(.+)$/i,
  /\bdepart(?:ing)?\s+(?:on\s+)?(.+)$/i,
  /\bleav(?:e|ing)\s+(?:on\s+)?(.+)$/i,
  /\bfly(?:ing)?\s+on\s+(.+)$/i,
  /\btravel(?:l?ing)?\s+on\s+(.+)$/i,
  /\bfrom\s+.+\s+on\s+(.+)$/i,
];

const DAY_MONTH_YEAR =
  /\b(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sept?|Oct|Nov|Dec)\s+(\d{4})\b/i;
const ISO_DATE = /\b(\d{4})-(\d{2})-(\d{2})\b/;

function parseCanonicalDepartureDate(raw: string): string | null {
  let value = edgeTrim(raw);
  value = value.replace(/[.!?,;:]+$/g, '');
  value = edgeTrim(value);
  if (value.length === 0) {
    return null;
  }

  const iso = value.match(ISO_DATE);
  if (iso) {
    const year = iso[1];
    const month = iso[2];
    const day = iso[3];
    if (!year || !month || !day) {
      return null;
    }
    const monthNum = Number(month);
    const dayNum = Number(day);
    if (monthNum < 1 || monthNum > 12 || dayNum < 1 || dayNum > 31) {
      return null;
    }
    return `${year}-${month}-${day}`;
  }

  const dmy = value.match(DAY_MONTH_YEAR);
  if (dmy) {
    const day = dmy[1];
    const monthToken = dmy[2];
    const year = dmy[3];
    if (!day || !monthToken || !year) {
      return null;
    }
    const month = monthTokenToMm(monthToken);
    if (month === null) {
      return null;
    }
    const dayNum = Number(day);
    if (dayNum < 1 || dayNum > 31) {
      return null;
    }
    return `${year}-${month}-${pad2(day)}`;
  }

  return null;
}

function extractContrastDepartureDate(message: string): string | null {
  const matched = matchContrastDepartureDateRepair(message);
  if (matched === null) {
    return null;
  }
  const previous = parseCanonicalDepartureDate(matched.previousRaw);
  const next = parseCanonicalDepartureDate(matched.nextRaw);
  if (previous === null || next === null) {
    return null;
  }
  if (previous === next) {
    return null;
  }
  return next;
}

function extractExplicitDepartureDate(message: string): string | null {
  const text = edgeTrim(message);
  if (text.length === 0) {
    return null;
  }

  const contrast = extractContrastDepartureDate(text);
  if (contrast !== null) {
    return contrast;
  }

  if (isBlockedDepartureDateMessage(text)) {
    return null;
  }
  for (const cue of EXPLICIT_DEPARTURE_DATE_CUES) {
    const match = text.match(cue);
    const captured = match?.[1];
    if (typeof captured !== 'string') {
      continue;
    }
    const departureDate = parseCanonicalDepartureDate(captured);
    if (departureDate !== null) {
      return departureDate;
    }
  }
  return null;
}
