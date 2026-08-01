import type {
  ConversationStateExtractionInput,
  ConversationStateExtractionResult,
  ConversationStateExtractor,
} from './types';

/**
 * Internal flights-requested extraction boundary.
 *
 * Phase 7H: recognises only narrow, explicit flights-service requests in the
 * current message. Phase 8H extends clear flight-service request cues only.
 * Deterministic and local — emits only true, never false or null, and ignores
 * prior conversation state.
 */
export class FlightsRequestedConversationStateExtractor
  implements ConversationStateExtractor
{
  extract(
    input: ConversationStateExtractionInput,
  ): ConversationStateExtractionResult {
    if (!hasExplicitFlightsRequest(input.message)) {
      return {
        stateUpdate: {},
      };
    }
    return {
      stateUpdate: {
        flightsRequested: true,
      },
    };
  }
}

/** Trim edges without String.prototype.trim (architecture boundary). */
function edgeTrim(value: string): string {
  return value.replace(/^\s+|\s+$/g, '');
}

function isBlockedFlightsRequestMessage(message: string): boolean {
  if (/\?/.test(message)) {
    return true;
  }
  if (/\bwhat\s+are\b/i.test(message)) {
    return true;
  }
  if (/\bkeep\b/i.test(message) || /\bforget\b/i.test(message)) {
    return true;
  }
  if (/\bremove\b/i.test(message) || /\bcancel\b/i.test(message)) {
    return true;
  }
  if (/\binstead\b/i.test(message) || /\bactually\b/i.test(message)) {
    return true;
  }
  if (
    /\b(?:do\s+not|don't)\b/i.test(message) ||
    /\bno\s+flights?\b/i.test(message) ||
    /\bwithout\s+flights?\b/i.test(message) ||
    /\bnot\b/i.test(message)
  ) {
    return true;
  }
  if (
    /\bflight\s+(?:delayed|cancelled|number|status|time|duration|attendant|school|simulator)\b/i.test(
      message,
    ) ||
    /\b(?:my\s+)?flight\s+was\s+(?:delayed|cancelled)\b/i.test(message)
  ) {
    return true;
  }
  if (
    /\b(?:airline|airlines|airport|plane|planes)\b/i.test(message) &&
    !/\b(?:flights?|airfare|plane\s+tickets?)\b/i.test(message)
  ) {
    return true;
  }
  if (
    /\b(?:qantas|virgin|jetstar|rex|singapore\s+airlines|emirates|qatar)\b/i.test(
      message,
    ) &&
    !/\b(?:book|find|search|need|want|include|add|show\s+me|compare)\s+(?:me\s+)?(?:a\s+)?flights?\b/i.test(
      message,
    ) &&
    !/\bi\s+(?:need|want)\s+(?:a\s+)?flights?\b/i.test(message) &&
    !/\bflights?\s+please\b/i.test(message) &&
    !/^flights?$/i.test(edgeTrim(message))
  ) {
    return true;
  }
  if (
    /\bflight\s+[A-Z]{1,3}\d{1,4}\b/i.test(message) ||
    /\b[A-Z]{2}\d{2,4}\b/.test(message)
  ) {
    return true;
  }
  if (
    /\b(?:want\s+to\s+fly|i\s+want\s+to\s+fly|i\s+am\s+flying|i'm\s+flying|flying\s+from|flying\s+to|fly\s+from|fly\s+to)\b/i.test(
      message,
    ) &&
    !/\b(?:book|find|search|need|include|add|show\s+me|compare)\s+(?:me\s+)?(?:a\s+)?flights?\b/i.test(
      message,
    ) &&
    !/\bi\s+(?:need|want)\s+(?:a\s+)?flights?\b/i.test(message) &&
    !/\bflights?\s+please\b/i.test(message) &&
    !/\bairfare\b/i.test(message) &&
    !/\bplane\s+tickets?\b/i.test(message) &&
    !/^flights?$/i.test(edgeTrim(message))
  ) {
    return true;
  }
  if (
    /\b(?:departure|arrival)\b/i.test(message) &&
    !/\b(?:flights?|airfare|plane\s+tickets?)\b/i.test(message)
  ) {
    return true;
  }
  return false;
}

const EXPLICIT_FLIGHTS_REQUEST_CUES: readonly RegExp[] = [
  /\b(?:book|find|search|need|want|include|add|show\s+me|compare)\s+(?:me\s+)?(?:a\s+)?flights?\b/i,
  /\bi\s+(?:need|want)\s+(?:a\s+)?flights?\b/i,
  /\bflights?\s+options\b/i,
  /\bflights?\s+please\b/i,
  /\bairfare\b/i,
  /\bplane\s+tickets?\b/i,
  /^flights?$/i,
  /\bflights?\b/i,
];

function hasExplicitFlightsRequest(message: string): boolean {
  const text = edgeTrim(message);
  if (text.length === 0) {
    return false;
  }
  if (isBlockedFlightsRequestMessage(text)) {
    return false;
  }
  for (const cue of EXPLICIT_FLIGHTS_REQUEST_CUES) {
    if (cue.test(text)) {
      return true;
    }
  }
  return false;
}
