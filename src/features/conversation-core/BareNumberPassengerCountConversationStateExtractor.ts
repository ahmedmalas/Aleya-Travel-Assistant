import type {
  ConversationCoreState,
  ConversationStateExtractionInput,
  ConversationStateExtractionResult,
  ConversationStateExtractor,
} from './types';

type PassengerCountField = 'adultCount' | 'childCount' | 'infantCount';

/**
 * Internal contextual bare-number passenger extraction boundary.
 *
 * Phase 19I: when exactly one passenger-count follow-up is active (same
 * priority as the passenger follow-up selector), a whole-message unsigned
 * integer in 1–99 updates that field. Does not own guest nouns, word numbers,
 * multi-passenger sentences, or zeros. Explicit noun cues remain owned by the
 * Adult / Child / Infant extractors.
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

    const count = parseBarePassengerCount(input.message);
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
 * trailing punctuation, and values outside 1–99.
 */
function parseBarePassengerCount(message: string): number | null {
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

  if (value < 1 || value > 99) {
    return null;
  }
  return value;
}

/**
 * Mirrors follow-up passenger priority after core travel fields are complete:
 * flights adult → accommodation guest (adultCount) → child → infant.
 */
function resolveActivePassengerCountField(
  state: ConversationCoreState,
): PassengerCountField | null {
  if (
    state.destination === null ||
    state.origin === null ||
    state.departureDate === null ||
    state.returnDate === null
  ) {
    return null;
  }

  if (state.flightsRequested === true && state.adultCount === null) {
    return 'adultCount';
  }
  if (state.accommodationRequested === true && state.adultCount === null) {
    return 'adultCount';
  }

  const passengerServiceRelevant =
    state.flightsRequested === true || state.accommodationRequested === true;
  if (
    passengerServiceRelevant &&
    state.adultCount !== null &&
    state.childCount === null
  ) {
    return 'childCount';
  }
  if (
    passengerServiceRelevant &&
    state.adultCount !== null &&
    state.childCount !== null &&
    state.infantCount === null
  ) {
    return 'infantCount';
  }

  return null;
}
