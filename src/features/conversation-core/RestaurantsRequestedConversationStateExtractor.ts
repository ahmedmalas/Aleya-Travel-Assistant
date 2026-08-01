import type {
  ConversationStateExtractionInput,
  ConversationStateExtractionResult,
  ConversationStateExtractor,
} from './types';

/**
 * Internal restaurants-requested extraction boundary.
 *
 * Phase 7L: recognises only narrow, explicit restaurants-service requests in the
 * current message. Phase 8L extends clear restaurant-service request cues only.
 * Deterministic and local — emits only true, never false or null, and ignores
 * prior conversation state.
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

const RESTAURANT_SERVICE_PHRASE = String.raw`(?:restaurants?)`;

function hasClearRestaurantsServiceCue(message: string): boolean {
  return (
    new RegExp(
      String.raw`\b(?:book|find|search|need|want|include|add|show\s+me|recommend|compare)\s+(?:me\s+)?(?:a\s+|the\s+|some\s+)?${RESTAURANT_SERVICE_PHRASE}\b`,
      'i',
    ).test(message) ||
    new RegExp(
      String.raw`\bi\s+(?:need|want)\s+(?:a\s+|the\s+|some\s+)?${RESTAURANT_SERVICE_PHRASE}\b`,
      'i',
    ).test(message) ||
    /\brestaurant\s+(?:recommendations|options)\b/i.test(message) ||
    /\b(?:places|somewhere|where)\s+to\s+eat\b/i.test(message) ||
    /\bdining\s+options\b/i.test(message) ||
    /\bfood\s+recommendations\b/i.test(message) ||
    new RegExp(String.raw`\b${RESTAURANT_SERVICE_PHRASE}\b`, 'i').test(
      message,
    ) ||
    new RegExp(String.raw`^${RESTAURANT_SERVICE_PHRASE}$`, 'i').test(
      edgeTrim(message),
    )
  );
}

function isBlockedRestaurantsRequestMessage(message: string): boolean {
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
    new RegExp(
      String.raw`\bno\s+(?:a\s+|the\s+|some\s+)?(?:${RESTAURANT_SERVICE_PHRASE}|dining\s+options|restaurant\s+recommendations)\b`,
      'i',
    ).test(message) ||
    new RegExp(
      String.raw`\bwithout\s+(?:a\s+|the\s+|some\s+)?(?:${RESTAURANT_SERVICE_PHRASE}|dining\s+options|restaurant\s+recommendations)\b`,
      'i',
    ).test(message) ||
    /\bnot\b/i.test(message)
  ) {
    return true;
  }
  if (
    /\bhotel\s+restaurant\b/i.test(message) ||
    /\brestaurant\s+(?:address|phone(?:\s+number)?|opening\s+hours|menu|review|rating|manager|job|equipment)\b/i.test(
      message,
    ) ||
    /\brestaurant\s+booking\s+already\s+confirmed\b/i.test(message) ||
    /\b(?:the\s+)?restaurant\s+was\s+cancelled\b/i.test(message)
  ) {
    return true;
  }
  if (
    /\bfood\s+allergy\b/i.test(message) ||
    /\bmeal\s+preference\b/i.test(message) ||
    /\bbreakfast\s+included\b/i.test(message) ||
    /\bhotel\s+breakfast\b/i.test(message) ||
    /\broom\s+service\b/i.test(message) ||
    /\bgrocery\s+store\b/i.test(message) ||
    /\bsupermarket\b/i.test(message) ||
    /\bcooking\b/i.test(message)
  ) {
    return true;
  }
  if (
    /\bi\s+like\s+\w+\s+food\b/i.test(message) ||
    /\bvegetarian\s+meals?\b/i.test(message) ||
    /\bhalal\s+food\b/i.test(message) ||
    /\bno\s+seafood\b/i.test(message) ||
    /\bgluten[\s-]?free\b/i.test(message)
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
    /\b(?:food|dining|dinner|lunch|breakfast|brunch|cafe|cafes|bar|bars|meal|meals|eat|eatery|eateries|cuisine)\b/i.test(
      message,
    ) &&
    !hasClearRestaurantsServiceCue(message)
  ) {
    return true;
  }
  if (
    /\b(?:nobu|mcdonald'?s|kfc|subway|guzman|yagos|grill'?d|hungry\s+jack'?s|domino'?s|pizza\s+hut|hatted|michelin)\b/i.test(
      message,
    ) &&
    !hasClearRestaurantsServiceCue(message)
  ) {
    return true;
  }
  return false;
}

const EXPLICIT_RESTAURANTS_REQUEST_CUES: readonly RegExp[] = [
  new RegExp(
    String.raw`\b(?:book|find|search|need|want|include|add|show\s+me|recommend|compare)\s+(?:me\s+)?(?:a\s+|the\s+|some\s+)?${RESTAURANT_SERVICE_PHRASE}\b`,
    'i',
  ),
  new RegExp(
    String.raw`\bi\s+(?:need|want)\s+(?:a\s+|the\s+|some\s+)?${RESTAURANT_SERVICE_PHRASE}\b`,
    'i',
  ),
  /\brestaurant\s+(?:recommendations|options)\b/i,
  /\b(?:places|somewhere|where)\s+to\s+eat\b/i,
  /\bdining\s+options\b/i,
  /\bfood\s+recommendations\b/i,
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
