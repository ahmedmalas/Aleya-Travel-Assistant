import type {
  ConversationStateExtractionInput,
  ConversationStateExtractionResult,
  ConversationStateExtractor,
} from './types';

/**
 * Internal accommodation-requested extraction boundary.
 *
 * Phase 7I: recognises only narrow, explicit accommodation-service requests in
 * the current message. Deterministic and local — emits only true, never false
 * or null, and ignores prior conversation state.
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

function isBlockedAccommodationRequestMessage(message: string): boolean {
  if (/\?/.test(message)) {
    return true;
  }
  if (/\bkeep\b/i.test(message) || /\bforget\b/i.test(message)) {
    return true;
  }
  if (/\bremove\b/i.test(message)) {
    return true;
  }
  if (/\binstead\b/i.test(message) || /\bactually\b/i.test(message)) {
    return true;
  }
  if (
    /\b(?:do\s+not|don't)\b/i.test(message) ||
    /\bno\s+(?:hotel|accommodation|hotels)\b/i.test(message) ||
    /\bnot\b/i.test(message)
  ) {
    return true;
  }
  if (
    /\b(?:motel|motels|resort|resorts|hostel|hostels|apartment|apartments|airbnb|lodging|stay|staying|room|rooms)\b/i.test(
      message,
    ) &&
    !/\b(?:accommodation|hotels?)\b/i.test(message)
  ) {
    return true;
  }
  if (
    /\b(?:somewhere\s+to\s+stay|find\s+somewhere|stay\s+with\s+family|check\s+in|check\s+out)\b/i.test(
      message,
    )
  ) {
    return true;
  }
  if (
    /\b(?:hilton|marriott|hyatt|ibis|novotel|sheraton|radisson|mantra|meriton)\b/i.test(
      message,
    ) &&
    !/\b(?:book|need|include|add)\s+(?:a\s+)?(?:hotel|accommodation)\b/i.test(
      message,
    ) &&
    !/\bi\s+need\s+(?:a\s+)?(?:hotel|accommodation)\b/i.test(message) &&
    !/^(?:hotel|hotels|accommodation)$/i.test(edgeTrim(message))
  ) {
    return true;
  }
  return false;
}

const EXPLICIT_ACCOMMODATION_REQUEST_CUES: readonly RegExp[] = [
  /\b(?:book|need|include|add)\s+accommodation\b/i,
  /\bi\s+need\s+accommodation\b/i,
  /\b(?:book|need)\s+(?:me\s+)?(?:a\s+)?hotel\b/i,
  /\bi\s+need\s+(?:a\s+)?hotel\b/i,
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
