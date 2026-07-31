import type {
  ConversationStateExtractionInput,
  ConversationStateExtractionResult,
  ConversationStateExtractor,
} from './types';

/**
 * Internal return-date extraction boundary.
 *
 * Phase 7D: recognises only narrow, explicit return-date statements in the
 * current message. Phase 8D extends clear return-date cues only.
 * Deterministic and local — no Date API, geographic services, departure-date
 * extraction, or currentState inspection.
 *
 * Phase 17E: adds explicit return-cued repair forms. Bare repaired dates
 * remain unowned. Departure-cued messages are not claimed here.
 */
export class ReturnDateConversationStateExtractor
  implements ConversationStateExtractor
{
  extract(
    input: ConversationStateExtractionInput,
  ): ConversationStateExtractionResult {
    const returnDate = extractExplicitReturnDate(input.message);
    if (returnDate === null) {
      return {
        stateUpdate: {},
      };
    }
    return {
      stateUpdate: {
        returnDate: returnDate,
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
 * Phase 17E contrast repair:
 * "Not returning on 1 September 2026, returning on 2 September 2026".
 */
function matchContrastReturnDateRepair(
  message: string,
): { previousRaw: string; nextRaw: string } | null {
  const match = edgeTrim(message).match(
    /^not\s+returning\s+on\s+([^,]+),\s*returning\s+on\s+(.+)$/i,
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

/** True when the message carries an explicit return-date cue or repair form. */
function hasExplicitReturnDateCue(message: string): boolean {
  return (
    /\breturn\s+date\s+is\b/i.test(message) ||
    /\bchange\s+(?:the\s+)?return\s+date\s+to\b/i.test(message) ||
    /\bno[,.]?\s+make\s+the\s+return\s+date\b/i.test(message) ||
    /\breturn(?:ing)?\s+on\b/i.test(message) ||
    /\bcome\s+back\s+on\b/i.test(message) ||
    /\bcoming\s+back\s+on\b/i.test(message) ||
    /\bback\s+on\b/i.test(message) ||
    matchContrastReturnDateRepair(message) !== null
  );
}

function isBlockedReturnDateMessage(message: string): boolean {
  if (/\?/.test(message)) {
    return true;
  }
  if (
    /\breturn\s+flights?\b/i.test(message) ||
    /\breturn\s+ticket\b/i.test(message) ||
    /\breturn\s+policy\b/i.test(message) ||
    /\bhotel\s+until\b/i.test(message)
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
  // Comparative / non-repair clauses that mention returning on a date.
  if (/\bcheaper\b/i.test(message)) {
    return true;
  }
  // "instead" remains a hard block (including "Return on … instead").
  if (/\binstead\b/i.test(message)) {
    return true;
  }
  // Phase 17E: allow "Actually, return on …" when an explicit return cue
  // is present; bare "Actually, {date}" stays blocked (no cue).
  if (/\bactually\b/i.test(message) && !hasExplicitReturnDateCue(message)) {
    return true;
  }
  if (
    /\b(?:do\s+not|don't)\s+(?:return|come|change|make)\b/i.test(message)
  ) {
    return true;
  }
  // Phase 17E: allow only the narrow contrast-repair shape through not-block.
  if (
    /\bnot\b/i.test(message) &&
    matchContrastReturnDateRepair(message) === null
  ) {
    return true;
  }
  return false;
}

/** Phase 17E explicit return-date repair cues (before general cues). */
const RETURN_DATE_REPAIR_CUES: readonly RegExp[] = [
  /\b(?:sorry[,.]?\s+)?i\s+meant\s+return(?:ing)?\s+(?:on\s+)?(.+)$/i,
  /\bactually[,.]?\s+return(?:ing)?\s+(?:on\s+)?(.+)$/i,
  /\bactually[,.]?\s+come\s+back\s+(?:on\s+)?(.+)$/i,
  /\bno[,.]?\s+make\s+the\s+return\s+date\s+(.+)$/i,
  /\bchange\s+(?:the\s+)?return\s+date\s+to\s+(.+)$/i,
  /\bchange\s+that\s+to\s+returning\s+on\s+(.+)$/i,
];

const EXPLICIT_RETURN_DATE_CUES: readonly RegExp[] = [
  ...RETURN_DATE_REPAIR_CUES,
  /\breturn\s+date\s+is\s+(.+)$/i,
  /\breturn(?:ing)?\s+(?:on\s+)?(.+)$/i,
  /\bcome\s+back\s+(?:on\s+)?(.+)$/i,
  /\bcoming\s+back\s+(?:on\s+)?(.+)$/i,
  /\bback\s+on\s+(.+)$/i,
  /\buntil\s+(.+)$/i,
];

const DAY_MONTH_YEAR =
  /\b(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sept?|Oct|Nov|Dec)\s+(\d{4})\b/i;
const ISO_DATE = /\b(\d{4})-(\d{2})-(\d{2})\b/;

function parseCanonicalReturnDate(raw: string): string | null {
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

function extractContrastReturnDate(message: string): string | null {
  const matched = matchContrastReturnDateRepair(message);
  if (matched === null) {
    return null;
  }
  const previous = parseCanonicalReturnDate(matched.previousRaw);
  const next = parseCanonicalReturnDate(matched.nextRaw);
  if (previous === null || next === null) {
    return null;
  }
  if (previous === next) {
    return null;
  }
  return next;
}

function extractExplicitReturnDate(message: string): string | null {
  const text = edgeTrim(message);
  if (text.length === 0) {
    return null;
  }

  const contrast = extractContrastReturnDate(text);
  if (contrast !== null) {
    return contrast;
  }

  if (isBlockedReturnDateMessage(text)) {
    return null;
  }
  for (const cue of EXPLICIT_RETURN_DATE_CUES) {
    const match = text.match(cue);
    const captured = match?.[1];
    if (typeof captured !== 'string') {
      continue;
    }
    const returnDate = parseCanonicalReturnDate(captured);
    if (returnDate !== null) {
      return returnDate;
    }
  }
  return null;
}
