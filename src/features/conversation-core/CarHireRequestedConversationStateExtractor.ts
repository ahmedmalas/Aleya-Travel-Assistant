import type {
  ConversationStateExtractionInput,
  ConversationStateExtractionResult,
  ConversationStateExtractor,
} from './types';

/**
 * Internal car-hire-requested extraction boundary.
 *
 * Phase 7J: recognises only narrow, explicit car-hire-service requests in the
 * current message. Phase 8J extends clear car-hire service request cues only.
 * Deterministic and local — emits only true, never false or null, and ignores
 * prior conversation state.
 */
export class CarHireRequestedConversationStateExtractor
  implements ConversationStateExtractor
{
  extract(
    input: ConversationStateExtractionInput,
  ): ConversationStateExtractionResult {
    if (!hasExplicitCarHireRequest(input.message)) {
      return {
        stateUpdate: {},
      };
    }
    return {
      stateUpdate: {
        carHireRequested: true,
      },
    };
  }
}

/** Trim edges without String.prototype.trim (architecture boundary). */
function edgeTrim(value: string): string {
  return value.replace(/^\s+|\s+$/g, '');
}

const CAR_HIRE_SERVICE_PHRASE =
  String.raw`(?:car\s+hire|hire\s+a\s+car|rent\s+a\s+car|rental\s+cars?|car\s+rentals?|vehicle\s+hire)`;

function hasClearCarHireServiceCue(message: string): boolean {
  return (
    new RegExp(
      String.raw`\b(?:book|find|search|need|want|include|add|show\s+me|compare)\s+(?:me\s+)?(?:a\s+|the\s+|some\s+)?${CAR_HIRE_SERVICE_PHRASE}\b`,
      'i',
    ).test(message) ||
    new RegExp(
      String.raw`\bi\s+(?:need|want)\s+(?:a\s+|the\s+|some\s+)?${CAR_HIRE_SERVICE_PHRASE}\b`,
      'i',
    ).test(message) ||
    new RegExp(
      String.raw`\b(?:car\s+hire|rental\s+car|car\s+rental)\s+options\b`,
      'i',
    ).test(message) ||
    new RegExp(String.raw`\b${CAR_HIRE_SERVICE_PHRASE}\b`, 'i').test(message) ||
    new RegExp(String.raw`^${CAR_HIRE_SERVICE_PHRASE}$`, 'i').test(
      edgeTrim(message),
    )
  );
}

function isBlockedCarHireRequestMessage(message: string): boolean {
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
      String.raw`\bno\s+(?:a\s+|the\s+)?${CAR_HIRE_SERVICE_PHRASE}\b`,
      'i',
    ).test(message) ||
    new RegExp(
      String.raw`\bwithout\s+(?:a\s+|the\s+)?${CAR_HIRE_SERVICE_PHRASE}\b`,
      'i',
    ).test(message) ||
    /\bno\s+car\b/i.test(message) ||
    /\bnot\b/i.test(message)
  ) {
    return true;
  }
  if (
    /\b(?:i\s+have|we\s+have)\s+(?:a\s+)?(?:rental\s+car|car\s+hire|car\s+rental)\b/i.test(
      message,
    ) ||
    /\b(?:the\s+)?(?:rental\s+car|car\s+hire|car\s+rental)\s+(?:is\s+)?booked\b/i.test(
      message,
    )
  ) {
    return true;
  }
  if (
    /\bmy\s+car\b/i.test(message) ||
    /\bdrive\s+my\s+car\b/i.test(message) ||
    /\bcar\s+park\b/i.test(message) ||
    /\bparking\b/i.test(message) ||
    /\bcar\s+(?:accident|insurance|registration|service|repair|dealership|price|model|seat)\b/i.test(
      message,
    ) ||
    /\bvehicle\s+details\b/i.test(message)
  ) {
    return true;
  }
  if (
    /\b(?:taxi|taxis|cab|cabs|rideshare|ride[\s-]?share|uber|lyft|chauffeur|chauffeurs|private\s+driver|transfer|transfers|airport\s+transfer|bus|train)\b/i.test(
      message,
    )
  ) {
    return true;
  }
  if (/\broad\s+trip\b/i.test(message)) {
    return true;
  }
  if (
    /\b(?:vehicle|vehicles|transport|transportation|get\s+around|drive|driving|suv|4wd|ute|van|pickup|pick[\s-]?up|drop[\s-]?off)\b/i.test(
      message,
    ) &&
    !hasClearCarHireServiceCue(message)
  ) {
    return true;
  }
  if (
    /\b(?:tesla|bmw|ferrari|mercedes|toyota|honda|ford|hertz|avis|budget|europcar|thrifty|sixt)\b/i.test(
      message,
    ) &&
    !hasClearCarHireServiceCue(message)
  ) {
    return true;
  }
  return false;
}

const EXPLICIT_CAR_HIRE_REQUEST_CUES: readonly RegExp[] = [
  new RegExp(
    String.raw`\b(?:book|find|search|need|want|include|add|show\s+me|compare)\s+(?:me\s+)?(?:a\s+|the\s+|some\s+)?${CAR_HIRE_SERVICE_PHRASE}\b`,
    'i',
  ),
  new RegExp(
    String.raw`\bi\s+(?:need|want)\s+(?:a\s+|the\s+|some\s+)?${CAR_HIRE_SERVICE_PHRASE}\b`,
    'i',
  ),
  /\b(?:car\s+hire|rental\s+car|car\s+rental)\s+options\b/i,
  /\bcar\s+hire\b/i,
  /\bhire\s+a\s+car\b/i,
  /\brent\s+a\s+car\b/i,
  /\brental\s+cars?\b/i,
  /\bcar\s+rentals?\b/i,
  /\bvehicle\s+hire\b/i,
];

function hasExplicitCarHireRequest(message: string): boolean {
  const text = edgeTrim(message);
  if (text.length === 0) {
    return false;
  }
  if (isBlockedCarHireRequestMessage(text)) {
    return false;
  }
  for (const cue of EXPLICIT_CAR_HIRE_REQUEST_CUES) {
    if (cue.test(text)) {
      return true;
    }
  }
  return false;
}
