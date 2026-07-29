import type {
  ConversationStateExtractionInput,
  ConversationStateExtractionResult,
  ConversationStateExtractor,
} from '../types';

/**
 * Internal wineries/food-trails-requested extraction boundary.
 *
 * Phase 7X: recognises only narrow, explicit wineries or food-trail requests in
 * the current message. Deterministic and local — emits only true, never false
 * or null, and ignores prior conversation state.
 */
export class WineriesFoodTrailsRequestedConversationStateExtractor
  implements ConversationStateExtractor
{
  extract(
    input: ConversationStateExtractionInput,
  ): ConversationStateExtractionResult {
    if (!hasExplicitWineriesFoodTrailsRequest(input.message)) {
      return {
        stateUpdate: {},
      };
    }
    return {
      stateUpdate: {
        wineriesFoodTrailsRequested: true,
      },
    };
  }
}

/** Trim edges without String.prototype.trim (architecture boundary). */
function edgeTrim(value: string): string {
  return value.replace(/^\s+|\s+$/g, '');
}

function hasWineriesCue(message: string): boolean {
  return /\bwinery\b/i.test(message) || /\bwineries\b/i.test(message);
}

function hasFoodTrailsCue(message: string): boolean {
  return /\bfood\s+trails?\b/i.test(message);
}

function hasWineriesOrFoodTrailsCue(message: string): boolean {
  return hasWineriesCue(message) || hasFoodTrailsCue(message);
}

function isBlockedWineriesFoodTrailsRequestMessage(message: string): boolean {
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
    /\bno\s+(?:wineries|winery|food\s+trails?)\b/i.test(message) ||
    /\bnot\b/i.test(message) ||
    /\bwithout\b/i.test(message)
  ) {
    return true;
  }
  if (
    /\b(?:wine|food|restaurants?|vineyards?|cellar\s+doors?|markets?)\b/i.test(
      message,
    ) &&
    !hasWineriesOrFoodTrailsCue(message)
  ) {
    return true;
  }
  if (
    /\b(?:boutique|organic|premium|guided|family(?:[\s-]?friendly)?|beginner[\s-]?friendly|local|regional)\s+(?:wineries|winery)\b/i.test(
      message,
    ) ||
    /\b(?:guided|local|regional|scenic)\s+food\s+trails?\b/i.test(message) ||
    /\b(?:wine|food)\s+tours?\b/i.test(message) ||
    /\b(?:wineries|winery|food\s+trails?)\s+(?:tours?|trips?|options|regions?|near|nearby|in|around|by|for|at|to)\b/i.test(
      message,
    ) ||
    /\bnearby\s+(?:wineries|winery|food\s+trails?)\b/i.test(message)
  ) {
    return true;
  }
  return false;
}

const EXPLICIT_WINERIES_FOOD_TRAILS_REQUEST_CUES: readonly RegExp[] = [
  /\b(?:book|need|include|add|show|find)\s+(?:me\s+)?(?:some\s+|a\s+)?(?:wineries|winery|food\s+trails?)\b/i,
  /\bi\s+need\s+(?:wineries|winery|food\s+trails?)\b/i,
  /\bwineries\s+and\s+food\s+trails?\b/i,
  /\bfood\s+trails?\s+and\s+wineries\b/i,
  /\bwineries\b/i,
  /\bwinery\b/i,
  /\bfood\s+trails?\b/i,
];

function hasExplicitWineriesFoodTrailsRequest(message: string): boolean {
  const text = edgeTrim(message);
  if (text.length === 0) {
    return false;
  }
  if (isBlockedWineriesFoodTrailsRequestMessage(text)) {
    return false;
  }
  for (const cue of EXPLICIT_WINERIES_FOOD_TRAILS_REQUEST_CUES) {
    if (cue.test(text)) {
      return true;
    }
  }
  return false;
}
