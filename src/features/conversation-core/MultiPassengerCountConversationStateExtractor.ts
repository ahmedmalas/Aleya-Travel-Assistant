import { isPassengerServiceRelevant } from './passengerCountFollowUpContext';
import type {
  ConversationStateExtractionInput,
  ConversationStateExtractionResult,
  ConversationStateExtractor,
  ConversationStateUpdate,
} from './types';

type PassengerCategory = 'adult' | 'child' | 'infant';

/**
 * Internal multi-passenger count extraction boundary.
 *
 * Phase 19K: one whole-message combined passenger sentence with two or three
 * explicit digit counts maps to a single stateUpdate owning every captured
 * field (adultCount / childCount / infantCount). Service-gated to flights or
 * accommodation (Phase 19H). Atomic — any invalid category rejects the entire
 * message. Does not invent omitted categories or zeros. Alternate category
 * order is supported when each segment is an explicit digit+noun phrase.
 * Single-category and guest/bare-number ownership remain with their extractors.
 */
export class MultiPassengerCountConversationStateExtractor
  implements ConversationStateExtractor
{
  extract(
    input: ConversationStateExtractionInput,
  ): ConversationStateExtractionResult {
    if (!isPassengerServiceRelevant(input.currentState)) {
      return {
        stateUpdate: {},
      };
    }

    const counts = extractMultiPassengerCounts(input.message);
    if (counts === null) {
      return {
        stateUpdate: {},
      };
    }

    const stateUpdate: ConversationStateUpdate = {};
    if (counts.adult !== undefined) {
      stateUpdate.adultCount = counts.adult;
    }
    if (counts.child !== undefined) {
      stateUpdate.childCount = counts.child;
    }
    if (counts.infant !== undefined) {
      stateUpdate.infantCount = counts.infant;
    }
    return { stateUpdate };
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

function parsePassengerCountToken(raw: string): number | null {
  const fromDigits = parseUnsignedDigits(edgeTrim(raw));
  if (fromDigits === null) {
    return null;
  }
  if (fromDigits < 1 || fromDigits > 99) {
    return null;
  }
  return fromDigits;
}

function nounToCategory(noun: string): PassengerCategory | null {
  if (/^adults?$/i.test(noun)) {
    return 'adult';
  }
  if (/^children$/i.test(noun) || /^child$/i.test(noun)) {
    return 'child';
  }
  if (/^infants?$/i.test(noun)) {
    return 'infant';
  }
  return null;
}

function isBlockedMultiPassengerMessage(message: string): boolean {
  if (/\?/.test(message)) {
    return true;
  }
  if (/\bhow\s+many\b/i.test(message)) {
    return true;
  }
  if (
    /\ballows?\b/i.test(message) ||
    /\ballowed\b/i.test(message) ||
    /\bpackage\s+price\b/i.test(message) ||
    /\bcomparing\s+prices\b/i.test(message) ||
    /\brecommends?\b/i.test(message) ||
    /\bper\s+room\b/i.test(message) ||
    /\bprice\s+is\s+for\b/i.test(message)
  ) {
    return true;
  }
  if (
    /-\d+\s+(?:adults?|child(?:ren)?|infants?)\b/i.test(message) ||
    /\d+\.\d+\s+(?:adults?|child(?:ren)?|infants?)\b/i.test(message)
  ) {
    return true;
  }
  return false;
}

const OPTIONAL_PREFIX =
  /^(?:we\s+have|there\s+will\s+be|travell?ing\s+with)\s+/i;

const SEGMENT_PATTERN = /^(\d+)\s+(adults?|children|child|infants?)$/i;

/**
 * Parse two or three digit+noun passenger segments joined by commas and "and".
 * Supports any explicit category order. Returns null when the message is not a
 * clear multi-passenger answer or any category is invalid.
 */
function extractMultiPassengerCounts(
  message: string,
): Partial<Record<PassengerCategory, number>> | null {
  let text = edgeTrim(message);
  if (text.length === 0) {
    return null;
  }
  text = text.replace(/[.!]+$/, '');
  text = edgeTrim(text);
  if (text.length === 0) {
    return null;
  }
  if (isBlockedMultiPassengerMessage(text)) {
    return null;
  }

  text = text.replace(OPTIONAL_PREFIX, '');
  text = edgeTrim(text);
  if (text.length === 0) {
    return null;
  }

  // Normalize conjunctions to commas, then split segments.
  const normalized = text.replace(/\s+and\s+/gi, ', ');
  const parts = normalized.split(',').map((part) => edgeTrim(part));
  if (parts.length < 2 || parts.length > 3) {
    return null;
  }

  const counts: Partial<Record<PassengerCategory, number>> = {};
  for (const part of parts) {
    if (part.length === 0) {
      return null;
    }
    const match = part.match(SEGMENT_PATTERN);
    if (match === null) {
      return null;
    }
    const rawCount = match[1];
    const noun = match[2];
    if (typeof rawCount !== 'string' || typeof noun !== 'string') {
      return null;
    }
    const category = nounToCategory(noun);
    if (category === null) {
      return null;
    }
    if (counts[category] !== undefined) {
      return null;
    }
    const value = parsePassengerCountToken(rawCount);
    if (value === null) {
      return null;
    }
    counts[category] = value;
  }

  if (Object.keys(counts).length < 2) {
    return null;
  }
  return counts;
}
