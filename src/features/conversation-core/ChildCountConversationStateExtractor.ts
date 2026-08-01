import { extractPassengerCountRepairToken } from './passengerCountRepairExtraction';
import type {
  ConversationStateExtractionInput,
  ConversationStateExtractionResult,
  ConversationStateExtractor,
} from './types';

/**
 * Internal child-count extraction boundary.
 *
 * Phase 7F: recognises only narrow, explicit child passenger-count statements
 * in the current message. Phase 8F extends clear child-count cues only.
 * Deterministic and local — no numeric coercion helpers, adult/infant
 * extraction, or currentState inspection.
 *
 * Phase 17G: adds Actually / contrast / change-the-child(ren)-count-to repair
 * families via the shared passenger repair helper. Zero and removal remain
 * blocked; multi-passenger sentences stay out of scope.
 */
export class ChildCountConversationStateExtractor
  implements ConversationStateExtractor
{
  extract(
    input: ConversationStateExtractionInput,
  ): ConversationStateExtractionResult {
    const childCount = extractExplicitChildCount(input.message);
    if (childCount === null) {
      return {
        stateUpdate: {},
      };
    }
    return {
      stateUpdate: {
        childCount: childCount,
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

function wordTokenToCount(token: string): number | null {
  if (/^one$/i.test(token)) return 1;
  if (/^two$/i.test(token)) return 2;
  if (/^three$/i.test(token)) return 3;
  if (/^four$/i.test(token)) return 4;
  if (/^five$/i.test(token)) return 5;
  if (/^six$/i.test(token)) return 6;
  if (/^seven$/i.test(token)) return 7;
  if (/^eight$/i.test(token)) return 8;
  if (/^nine$/i.test(token)) return 9;
  if (/^ten$/i.test(token)) return 10;
  return null;
}

function parseChildCountToken(raw: string): number | null {
  const token = edgeTrim(raw);
  if (token.length === 0) {
    return null;
  }
  const fromDigits = parseUnsignedDigits(token);
  if (fromDigits !== null) {
    if (fromDigits < 1 || fromDigits > 99) {
      return null;
    }
    return fromDigits;
  }
  const fromWord = wordTokenToCount(token);
  if (fromWord === null) {
    return null;
  }
  return fromWord;
}

function isBlockedChildCountMessage(message: string): boolean {
  if (/\?/.test(message)) {
    return true;
  }
  if (/\bhow\s+many\b/i.test(message)) {
    return true;
  }
  // Phase 19K — combined multi-passenger sentences are owned exclusively by
  // MultiPassengerCountConversationStateExtractor (atomic accept/reject).
  if (
    /\b(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+adults?\b/i.test(
      message,
    ) ||
    /\b(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+infants?\b/i.test(
      message,
    )
  ) {
    return true;
  }
  if (
    /-\d+\s+child(?:ren)?\b/i.test(message) ||
    /\d+\.\d+\s+child(?:ren)?\b/i.test(message)
  ) {
    return true;
  }
  if (
    /\bkids?\s+club\b/i.test(message) ||
    /\bchild\s+fare\b/i.test(message) ||
    /\bchild\s+ticket\b/i.test(message) ||
    /\bchild\s+seat\b/i.test(message)
  ) {
    return true;
  }
  if (/\bunder\s+\d+\b/i.test(message) || /\byears?\s+old\b/i.test(message)) {
    return true;
  }
  if (
    /\b(?:travellers?|passengers?|people|persons?|party|grown-?ups?|kids?|toddlers?|teenagers?)\b/i.test(
      message,
    )
  ) {
    return true;
  }
  if (
    /\b(?:my\s+son|my\s+daughter|year-?old)\b/i.test(message)
  ) {
    return true;
  }
  if (/\bkeep\b/i.test(message) || /\bforget\b/i.test(message)) {
    return true;
  }
  if (/\binstead\b/i.test(message) || /\bactually\b/i.test(message)) {
    return true;
  }
  if (
    /\b(?:do\s+not|don't)\s+(?:change|make|set)\b/i.test(message) ||
    /\bdo\s+not\s+change\b/i.test(message)
  ) {
    return true;
  }
  if (/\bno\s+child(?:ren)?\b/i.test(message) || /\bnot\b/i.test(message)) {
    return true;
  }
  if (/\bremove\b/i.test(message)) {
    return true;
  }
  return false;
}

const COUNT_TOKEN = String.raw`(\d+|one|two|three|four|five|six|seven|eight|nine|ten)`;

const EXPLICIT_CHILD_COUNT_CUES: readonly RegExp[] = [
  new RegExp(String.raw`\bchild\s+count\s+is\s+${COUNT_TOKEN}\b`, 'i'),
  new RegExp(
    String.raw`\b(?:we\s+have|book\s+for|for|travell?ing\s+with)\s+${COUNT_TOKEN}\s+child(?:ren)?\b`,
    'i',
  ),
  new RegExp(String.raw`\b${COUNT_TOKEN}\s+child(?:ren)?\b`, 'i'),
];

function extractExplicitChildCount(message: string): number | null {
  const text = edgeTrim(message);
  if (text.length === 0) {
    return null;
  }

  // Phase 17G repair families are evaluated before the actually/not blocks.
  const repaired = extractPassengerCountRepairToken(
    text,
    'child(?:ren)?',
    'child(?:ren)?',
    parseChildCountToken,
  );
  if (repaired !== null) {
    return repaired;
  }

  if (isBlockedChildCountMessage(text)) {
    return null;
  }
  for (const cue of EXPLICIT_CHILD_COUNT_CUES) {
    const match = text.match(cue);
    const captured = match?.[1];
    if (typeof captured !== 'string') {
      continue;
    }
    const childCount = parseChildCountToken(captured);
    if (childCount !== null) {
      return childCount;
    }
  }
  return null;
}
