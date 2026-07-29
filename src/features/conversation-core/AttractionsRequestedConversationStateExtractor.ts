import type {
  ConversationStateExtractionInput,
  ConversationStateExtractionResult,
  ConversationStateExtractor,
} from './types';

/**
 * Internal attractions-requested extraction boundary.
 *
 * Phase 7S: recognises only narrow, explicit attraction-request cues in the
 * current message. Deterministic and local — emits only true, never false or
 * null, and ignores prior conversation state.
 */
export class AttractionsRequestedConversationStateExtractor
  implements ConversationStateExtractor
{
  extract(
    input: ConversationStateExtractionInput,
  ): ConversationStateExtractionResult {
    if (!hasExplicitAttractionsRequest(input.message)) {
      return {
        stateUpdate: {},
      };
    }
    return {
      stateUpdate: {
        attractionsRequested: true,
      },
    };
  }
}

/** Trim edges without String.prototype.trim (architecture boundary). */
function edgeTrim(value: string): string {
  return value.replace(/^\s+|\s+$/g, '');
}

function hasAttractionCue(message: string): boolean {
  return /\battractions?\b/i.test(message);
}

function isBlockedAttractionsRequestMessage(message: string): boolean {
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
    /\bno\s+attractions?\b/i.test(message) ||
    /\bnot\b/i.test(message) ||
    /\bwithout\b/i.test(message)
  ) {
    return true;
  }
  if (
    /\b(?:landmark|landmarks|museum|museums|theme\s+parks?|zoo|zoos|aquarium|aquariums|tourist\s+spots?|sightseeing|places\s+to\s+visit)\b/i.test(
      message,
    ) &&
    !hasAttractionCue(message)
  ) {
    return true;
  }
  if (
    /\b(?:tourist|top|best|local|popular|family(?:[\s-]?friendly)?|guided|indoor|outdoor|historic|cultural)\s+attractions?\b/i.test(
      message,
    ) ||
    /\battractions?\s+(?:near|nearby|in|around|by|for|to|options|tours?|list)\b/i.test(
      message,
    ) ||
    /\bnearby\s+attractions?\b/i.test(message)
  ) {
    return true;
  }
  return false;
}

const EXPLICIT_ATTRACTIONS_REQUEST_CUES: readonly RegExp[] = [
  /\b(?:book|need|include|add|show|find)\s+(?:me\s+)?(?:some\s+|a\s+)?attractions?\b/i,
  /\bi\s+need\s+attractions?\b/i,
  /\battractions?\b/i,
];

function hasExplicitAttractionsRequest(message: string): boolean {
  const text = edgeTrim(message);
  if (text.length === 0) {
    return false;
  }
  if (isBlockedAttractionsRequestMessage(text)) {
    return false;
  }
  for (const cue of EXPLICIT_ATTRACTIONS_REQUEST_CUES) {
    if (cue.test(text)) {
      return true;
    }
  }
  return false;
}
