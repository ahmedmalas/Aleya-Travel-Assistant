import { resolveActivePassengerCountField } from './passengerCountFollowUpContext';
import type {
  ConversationStateExtractionInput,
  ConversationStateExtractionResult,
  ConversationStateExtractor,
} from './types';

/**
 * Internal contextual bare-number passenger extraction boundary.
 *
 * Phase 19I: when exactly one passenger-count follow-up is active (same
 * priority as the passenger follow-up selector), a whole-message unsigned
 * integer updates that field. Explicit noun cues remain owned by the
 * Adult / Child / Infant extractors; explicit guest nouns are Phase 19J.
 *
 * Phase 19L: bare `0` is accepted only when the active field is childCount
 * or infantCount (domain 0–99). Adult / guest (adultCount) remains 1–99;
 * bare `0` never mutates adultCount.
 */
export class BareNumberPassengerCountConversationStateExtractor
  implements ConversationStateExtractor
{
  extract(
    input: ConversationStateExtractionInput,
  ): ConversationStateExtractionResult {
    const field = resolveActivePassengerCountField(input.currentState);
    if (field === null) {
      return {
        stateUpdate: {},
      };
    }

    const count = parseBarePassengerCount(input.message, field);
    if (count === null) {
      return {
        stateUpdate: {},
      };
    }

    return {
      stateUpdate: {
        [field]: count,
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

/**
 * Whole-message bare unsigned integer only. Rejects words, signs, decimals,
 * and trailing punctuation. Domain is field-aware (Phase 19L):
 * adultCount → 1–99; childCount / infantCount → 0–99.
 */
function parseBarePassengerCount(
  message: string,
  field: 'adultCount' | 'childCount' | 'infantCount',
): number | null {
  const text = edgeTrim(message);
  if (text.length === 0) {
    return null;
  }

  let value = 0;
  for (let index = 0; index < text.length; index += 1) {
    const digit = digitCharToValue(text[index]!);
    if (digit === null) {
      return null;
    }
    value = value * 10 + digit;
  }

  const minimum = field === 'adultCount' ? 1 : 0;
  if (value < minimum || value > 99) {
    return null;
  }
  return value;
}
