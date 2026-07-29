import type {
  ConversationStateExtractionInput,
  ConversationStateExtractionResult,
  ConversationStateExtractor,
} from './types';

/**
 * Internal infant-count extraction boundary.
 *
 * Phase 7G: recognises only narrow, explicit infant passenger-count statements
 * in the current message. Deterministic and local — no numeric coercion helpers,
 * adult/child extraction, or currentState inspection.
 */
export class InfantCountConversationStateExtractor
  implements ConversationStateExtractor
{
  extract(
    input: ConversationStateExtractionInput,
  ): ConversationStateExtractionResult {
    const infantCount = extractExplicitInfantCount(input.message);
    if (infantCount === null) {
      return {
        stateUpdate: {},
      };
    }
    return {
      stateUpdate: {
        infantCount: infantCount,
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

function parseInfantCountToken(raw: string): number | null {
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

function isBlockedInfantCountMessage(message: string): boolean {
  if (/\?/.test(message)) {
    return true;
  }
  if (
    /\b(?:adult|adults|child|children|kids?)\b/i.test(message)
  ) {
    return true;
  }
  if (
    /\b(?:travellers?|passengers?|people|persons?|party|grown-?ups?|bab(?:y|ies)|newborns?|toddlers?)\b/i.test(
      message,
    )
  ) {
    return true;
  }
  if (
    /\b(?:lap\s+infant|month-?old|year-?old|my\s+wife|our\s+baby)\b/i.test(
      message,
    )
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
  if (/\bno\s+infants?\b/i.test(message) || /\bnot\b/i.test(message)) {
    return true;
  }
  if (/\bremove\b/i.test(message)) {
    return true;
  }
  return false;
}

const EXPLICIT_INFANT_COUNT_CUES: readonly RegExp[] = [
  /\binfant\s+count\s+is\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\b/i,
  /\b(?:for|travell?ing\s+with)\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+infants?\b/i,
  /\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+infants?\b/i,
];

function extractExplicitInfantCount(message: string): number | null {
  const text = edgeTrim(message);
  if (text.length === 0) {
    return null;
  }
  if (isBlockedInfantCountMessage(text)) {
    return null;
  }
  for (const cue of EXPLICIT_INFANT_COUNT_CUES) {
    const match = text.match(cue);
    const captured = match?.[1];
    if (typeof captured !== 'string') {
      continue;
    }
    const infantCount = parseInfantCountToken(captured);
    if (infantCount !== null) {
      return infantCount;
    }
  }
  return null;
}
