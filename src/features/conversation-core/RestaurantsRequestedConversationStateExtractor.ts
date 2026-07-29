import type {
  ConversationStateExtractionInput,
  ConversationStateExtractionResult,
  ConversationStateExtractor,
} from './types';

/**
 * Internal restaurants-requested extraction boundary.
 *
 * Phase 7L: recognises only narrow, explicit restaurants-service requests in the
 * current message. Deterministic and local — emits only true, never false or
 * null, and ignores prior conversation state.
 */
export class RestaurantsRequestedConversationStateExtractor
  implements ConversationStateExtractor
{
  extract(
    input: ConversationStateExtractionInput,
  ): ConversationStateExtractionResult {
    if (!hasExplicitRestaurantsRequest(input.message)) {
      return {
        stateUpdate: {},
      };
    }
    return {
      stateUpdate: {
        restaurantsRequested: true,
      },
    };
  }
}

/** Trim edges without String.prototype.trim (architecture boundary). */
function edgeTrim(value: string): string {
  return value.replace(/^\s+|\s+$/g, '');
}

function isBlockedRestaurantsRequestMessage(message: string): boolean {
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
    /\bno\s+restaurants?\b/i.test(message) ||
    /\bnot\b/i.test(message)
  ) {
    return true;
  }
  if (
    /\b(?:food|dining|dinner|lunch|breakfast|brunch|cafe|cafes|bar|bars|meal|meals|eat|eatery|eateries|cuisine)\b/i.test(
      message,
    ) &&
    !/\brestaurants?\b/i.test(message)
  ) {
    return true;
  }
  if (
    /\b(?:italian|chinese|thai|mexican|indian|japanese|french|greek|korean|vietnamese|halal|vegan|vegetarian|sushi|pizza)\s+restaurants?\b/i.test(
      message,
    ) ||
    /\b(?:italian|chinese|thai|mexican|indian|japanese|french|greek|korean|vietnamese)\s+cuisine\b/i.test(
      message,
    )
  ) {
    return true;
  }
  if (
    /\b(?:nobu|mcdonald'?s|kfc|subway|guzman|yagos|grill'?d|hungry\s+jack'?s|domino'?s|pizza\s+hut|hatted|michelin)\b/i.test(
      message,
    ) &&
    !/\b(?:find|show|need|include|add)\s+(?:me\s+)?restaurants?\b/i.test(
      message,
    ) &&
    !/\bi\s+need\s+restaurants?\b/i.test(message) &&
    !/^restaurants?$/i.test(edgeTrim(message))
  ) {
    return true;
  }
  return false;
}

const EXPLICIT_RESTAURANTS_REQUEST_CUES: readonly RegExp[] = [
  /\b(?:find|show|need|include|add)\s+(?:me\s+)?restaurants?\b/i,
  /\bi\s+need\s+restaurants?\b/i,
  /\brestaurants?\b/i,
];

function hasExplicitRestaurantsRequest(message: string): boolean {
  const text = edgeTrim(message);
  if (text.length === 0) {
    return false;
  }
  if (isBlockedRestaurantsRequestMessage(text)) {
    return false;
  }
  for (const cue of EXPLICIT_RESTAURANTS_REQUEST_CUES) {
    if (cue.test(text)) {
      return true;
    }
  }
  return false;
}
