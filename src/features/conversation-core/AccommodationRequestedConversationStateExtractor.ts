import type {
  ConversationStateExtractionInput,
  ConversationStateExtractionResult,
  ConversationStateExtractor,
} from './types';

/**
 * Internal accommodation-requested extraction boundary.
 *
 * Phase 7I: recognises only narrow, explicit accommodation-service requests in
 * the current message. Phase 8I extends clear accommodation-service request
 * cues only. Deterministic and local — emits only true, never false or null,
 * and ignores prior conversation state.
 */
export class AccommodationRequestedConversationStateExtractor
  implements ConversationStateExtractor
{
  extract(
    input: ConversationStateExtractionInput,
  ): ConversationStateExtractionResult {
    if (!hasExplicitAccommodationRequest(input.message)) {
      return {
        stateUpdate: {},
      };
    }
    return {
      stateUpdate: {
        accommodationRequested: true,
      },
    };
  }
}

/** Trim edges without String.prototype.trim (architecture boundary). */
function edgeTrim(value: string): string {
  return value.replace(/^\s+|\s+$/g, '');
}

function hasClearAccommodationServiceCue(message: string): boolean {
  return (
    /\b(?:book|find|search|need|want|include|add|show\s+me|compare)\s+(?:me\s+)?(?:a\s+)?(?:hotel|accommodation)\b/i.test(
      message,
    ) ||
    /\bi\s+(?:need|want)\s+(?:a\s+)?(?:hotel|accommodation)\b/i.test(message) ||
    /\b(?:hotel|accommodation)\s+options\b/i.test(message) ||
    /\b(?:a\s+place|somewhere)\s+to\s+stay\b/i.test(message) ||
    /\blodging\b/i.test(message) ||
    /^(?:hotel|hotels|accommodation|lodging)$/i.test(edgeTrim(message)) ||
    /\b(?:accommodation|hotels?)\b/i.test(message)
  );
}

function isBlockedAccommodationRequestMessage(message: string): boolean {
  if (/\?/.test(message)) {
    return true;
  }
  if (/\bwhat\s+(?:is|are)\b/i.test(message)) {
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
    /\bno\s+(?:hotel|accommodation|hotels)\b/i.test(message) ||
    /\bwithout\s+(?:hotel|accommodation|hotels)\b/i.test(message) ||
    /\bnot\b/i.test(message)
  ) {
    return true;
  }
  if (
    /\bhotel\s+(?:address|phone|check-?in|check-?out|checkout|cancellation|policy|review|rating|restaurant|transfer|booked)\b/i.test(
      message,
    ) ||
    /\b(?:my\s+)?hotel\s+(?:is\s+)?cancelled\b/i.test(message)
  ) {
    return true;
  }
  if (/\blodging\s+a\s+complaint\b/i.test(message)) {
    return true;
  }
  if (
    /\bstaying\s+(?:in|near|at|with)\b/i.test(message) ||
    /(?<!\bto\s)\bstay\s+(?:in|near|at|with)\b/i.test(message) ||
    /\b(?:\d+-)?(?:night|nights)\s+stay\b/i.test(message) ||
    /\bthree-night\s+stay\b/i.test(message)
  ) {
    return true;
  }
  if (
    /\b(?:motel|motels|resort|resorts|hostel|hostels|apartment|apartments|airbnb|room|rooms)\b/i.test(
      message,
    ) &&
    !/\b(?:accommodation|hotels?|lodging|(?:a\s+place|somewhere)\s+to\s+stay)\b/i.test(
      message,
    )
  ) {
    return true;
  }
  if (
    /\b(?:hilton|marriott|hyatt|ibis|novotel|sheraton|radisson|mantra|meriton)\b/i.test(
      message,
    ) &&
    !hasClearAccommodationServiceCue(message)
  ) {
    return true;
  }
  return false;
}

const EXPLICIT_ACCOMMODATION_REQUEST_CUES: readonly RegExp[] = [
  /\b(?:book|find|search|need|want|include|add|show\s+me|compare)\s+(?:me\s+)?(?:a\s+)?(?:hotel|accommodation)\b/i,
  /\bi\s+(?:need|want)\s+(?:a\s+)?(?:hotel|accommodation)\b/i,
  /\b(?:hotel|accommodation)\s+options\b/i,
  /\b(?:a\s+place|somewhere)\s+to\s+stay\b/i,
  /\blodging\b/i,
  /^(?:hotel|hotels|accommodation|lodging)$/i,
  /\baccommodation\b/i,
  /\bhotels?\b/i,
];

function hasExplicitAccommodationRequest(message: string): boolean {
  const text = edgeTrim(message);
  if (text.length === 0) {
    return false;
  }
  if (isBlockedAccommodationRequestMessage(text)) {
    return false;
  }
  for (const cue of EXPLICIT_ACCOMMODATION_REQUEST_CUES) {
    if (cue.test(text)) {
      return true;
    }
  }
  return false;
}
