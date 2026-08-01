import { isAccommodationGuestCountFollowUpActive } from './passengerCountFollowUpContext';
import type {
  ConversationStateExtractionInput,
  ConversationStateExtractionResult,
  ConversationStateExtractor,
} from './types';

/**
 * Internal contextual explicit guest-count extraction boundary.
 *
 * Phase 19J: when the accommodation guest-count follow-up is active, clear
 * whole-message guest noun phrases with an integer in 1–99 update adultCount
 * (existing product contract — no separate guestCount field). Does not own
 * bare numbers (Phase 19I), word numbers, zeros, multi-passenger sentences,
 * or guest wording while the flights-adult question is ahead in priority.
 * Restricted to adultCount === null (active missing-adult guest question);
 * does not re-apply or change already-captured adultCount via guest nouns.
 */
export class ExplicitGuestCountConversationStateExtractor
  implements ConversationStateExtractor
{
  extract(
    input: ConversationStateExtractionInput,
  ): ConversationStateExtractionResult {
    if (!isAccommodationGuestCountFollowUpActive(input.currentState)) {
      return {
        stateUpdate: {},
      };
    }

    const count = extractExplicitGuestCount(input.message);
    if (count === null) {
      return {
        stateUpdate: {},
      };
    }

    return {
      stateUpdate: {
        adultCount: count,
      },
    };
  }
}

/** Trim edges without String.prototype.trim (architecture boundary). */
function edgeTrim(value: string): string {
  return value.replace(/^\s+|\s+$/g, '');
}

function digitCharToValue(ch: string): number | null {
  if (ch === '0') return 0;
  if (ch === '1') return 1;
  if (ch === '2') return 2;
  if (ch === '3') return 3;
  if (ch === '4') return 4;
  if (ch === '5') return 5;
  if (ch === '6') return 6;
  if (ch === '7') return 7;
  if (ch === '8') return 8;
  if (ch === '9') return 9;
  return null;
}

function parseUnsignedDigits(raw: string): number | null {
  if (raw.length === 0) {
    return null;
  }
  let value = 0;
  for (let index = 0; index < raw.length; index += 1) {
    const digit = digitCharToValue(raw[index]!);
    if (digit === null) {
      return null;
    }
    value = value * 10 + digit;
  }
  return value;
}

function parseGuestCountToken(raw: string): number | null {
  const fromDigits = parseUnsignedDigits(edgeTrim(raw));
  if (fromDigits === null) {
    return null;
  }
  if (fromDigits < 1 || fromDigits > 99) {
    return null;
  }
  return fromDigits;
}

/**
 * Whole-message guest-count answers only. Digits + guest/guests; optional
 * trailing . or !. No word numbers, questions, or incidental property mentions.
 */
const EXPLICIT_GUEST_COUNT_CUES: readonly RegExp[] = [
  /^(\d+)\s+guests?\.?!?$/i,
  /^there\s+will\s+be\s+(\d+)\s+guests?\.?!?$/i,
  /^we\s+have\s+(\d+)\s+guests?\.?!?$/i,
  /^it\s+will\s+be\s+(\d+)\s+guests?\.?!?$/i,
];

function isBlockedGuestCountMessage(message: string): boolean {
  if (/\?/.test(message)) {
    return true;
  }
  if (/\bhow\s+many\b/i.test(message)) {
    return true;
  }
  if (
    /\bguest\s+rooms?\b/i.test(message) ||
    /\bguest\s+houses?\b/i.test(message) ||
    /\bguesthouses?\b/i.test(message) ||
    /\bguest\s+list\b/i.test(message) ||
    /\bguest\s+speaker\b/i.test(message)
  ) {
    return true;
  }
  if (
    /\bpermits?\b/i.test(message) ||
    /\ballowed\b/i.test(message) ||
    /\bcharges?\b/i.test(message) ||
    /\bper\s+guest\b/i.test(message) ||
    /\bmay\s+arrive\b/i.test(message)
  ) {
    return true;
  }
  if (
    /-\d+\s+guests?\b/i.test(message) ||
    /\d+\.\d+\s+guests?\b/i.test(message)
  ) {
    return true;
  }
  return false;
}

function extractExplicitGuestCount(message: string): number | null {
  const text = edgeTrim(message);
  if (text.length === 0) {
    return null;
  }
  if (isBlockedGuestCountMessage(text)) {
    return null;
  }
  for (const cue of EXPLICIT_GUEST_COUNT_CUES) {
    const match = text.match(cue);
    const captured = match?.[1];
    if (typeof captured !== 'string') {
      continue;
    }
    const count = parseGuestCountToken(captured);
    if (count !== null) {
      return count;
    }
  }
  return null;
}
