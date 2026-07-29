import type {
  ConversationStateExtractionInput,
  ConversationStateExtractionResult,
  ConversationStateExtractor,
} from './types';

/**
 * Internal car-hire-requested extraction boundary.
 *
 * Phase 7J: recognises only narrow, explicit car-hire-service requests in the
 * current message. Deterministic and local — emits only true, never false or
 * null, and ignores prior conversation state.
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

function isBlockedCarHireRequestMessage(message: string): boolean {
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
    /\bno\s+(?:car\s+hire|hire\s+a\s+car|rent\s+a\s+car|rental\s+car)\b/i.test(
      message,
    ) ||
    /\bnot\b/i.test(message)
  ) {
    return true;
  }
  if (
    /\b(?:taxi|taxis|cab|cabs|rideshare|ride[\s-]?share|uber|lyft|chauffeur|chauffeurs|private\s+driver|transfer|transfers|airport\s+transfer)\b/i.test(
      message,
    )
  ) {
    return true;
  }
  if (
    /\b(?:vehicle|vehicles|transport|transportation|get\s+around|drive|driving|suv|4wd|ute|van|pickup|pick[\s-]?up|drop[\s-]?off)\b/i.test(
      message,
    ) &&
    !/\b(?:car\s+hire|hire\s+a\s+car|rent\s+a\s+car|rental\s+car)\b/i.test(
      message,
    )
  ) {
    return true;
  }
  if (
    /\b(?:tesla|bmw|ferrari|mercedes|toyota|honda|ford|hertz|avis|budget|europcar|thrifty|sixt)\b/i.test(
      message,
    ) &&
    !/\b(?:book|need|include|add)\s+(?:a\s+|the\s+|some\s+)?(?:car\s+hire|hire\s+a\s+car|rent\s+a\s+car|rental\s+car)\b/i.test(
      message,
    ) &&
    !/\bi\s+need\s+(?:a\s+|the\s+|some\s+)?(?:car\s+hire|hire\s+a\s+car|rent\s+a\s+car|rental\s+car)\b/i.test(
      message,
    ) &&
    !/^(?:car\s+hire|hire\s+a\s+car|rent\s+a\s+car|rental\s+car)$/i.test(
      edgeTrim(message),
    )
  ) {
    return true;
  }
  return false;
}

const EXPLICIT_CAR_HIRE_REQUEST_CUES: readonly RegExp[] = [
  /\b(?:book|need|include|add)\s+(?:a\s+|the\s+|some\s+|me\s+a\s+)?(?:car\s+hire|hire\s+a\s+car|rent\s+a\s+car|rental\s+car)\b/i,
  /\bi\s+need\s+(?:a\s+|the\s+|some\s+)?(?:car\s+hire|hire\s+a\s+car|rent\s+a\s+car|rental\s+car)\b/i,
  /\bcar\s+hire\b/i,
  /\bhire\s+a\s+car\b/i,
  /\brent\s+a\s+car\b/i,
  /\brental\s+car\b/i,
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
