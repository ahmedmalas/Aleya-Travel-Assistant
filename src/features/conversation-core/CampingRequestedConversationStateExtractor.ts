import type {
  ConversationStateExtractionInput,
  ConversationStateExtractionResult,
  ConversationStateExtractor,
} from './types';

/**
 * Internal camping-requested extraction boundary.
 *
 * Phase 7O: recognises only narrow, explicit camping-service requests in the
 * current message. Phase 8P extends clear camping-discovery request cues only.
 * Deterministic and local — emits only true, never false or null, and ignores
 * prior conversation state.
 */
export class CampingRequestedConversationStateExtractor
  implements ConversationStateExtractor
{
  extract(
    input: ConversationStateExtractionInput,
  ): ConversationStateExtractionResult {
    if (!hasExplicitCampingRequest(input.message)) {
      return {
        stateUpdate: {},
      };
    }
    return {
      stateUpdate: {
        campingRequested: true,
      },
    };
  }
}

/** Trim edges without String.prototype.trim (architecture boundary). */
function edgeTrim(value: string): string {
  return value.replace(/^\s+|\s+$/g, '');
}

const CAMPING_SERVICE_PHRASE = String.raw`(?:camping|campsites?|camp\s+sites?|campgrounds?|camp\s+grounds?|camp)`;

function hasActionCampingServiceCue(message: string): boolean {
  return (
    new RegExp(
      String.raw`\b(?:book|find|search|need|want|include|add|show\s+me|recommend|compare)\s+(?:me\s+)?(?:a\s+|the\s+|some\s+)?(?:best\s+|family\s+)?${CAMPING_SERVICE_PHRASE}\b`,
      'i',
    ).test(message) ||
    new RegExp(
      String.raw`\bi\s+(?:need|want)\s+(?:a\s+|the\s+|some\s+)?${CAMPING_SERVICE_PHRASE}\b`,
      'i',
    ).test(message) ||
    /\bcamping\s+(?:recommendations|options)\b/i.test(message) ||
    /\bbest\s+campsites?\b/i.test(message) ||
    /\bnearby\s+camping\b/i.test(message) ||
    /\bcamping\s+near\s+me\b/i.test(message) ||
    /\bcampgrounds?\s+near\s+me\b/i.test(message)
  );
}

function hasClearCampingServiceCue(message: string): boolean {
  return (
    hasActionCampingServiceCue(message) ||
    new RegExp(String.raw`\b${CAMPING_SERVICE_PHRASE}\b`, 'i').test(message) ||
    new RegExp(String.raw`^${CAMPING_SERVICE_PHRASE}$`, 'i').test(
      edgeTrim(message),
    )
  );
}

function isBlockedCampingRequestMessage(message: string): boolean {
  if (/\?/.test(message)) {
    return true;
  }
  if (/\bwhat\s+(?:is|are)\b/i.test(message)) {
    return true;
  }
  if (/\bkeep\b/i.test(message) || /\bforget\b/i.test(message)) {
    return true;
  }
  if (
    /\bremove\b/i.test(message) ||
    /\bcancel\b/i.test(message) ||
    /\bavoid\b/i.test(message) ||
    /\bskip\b/i.test(message)
  ) {
    return true;
  }
  if (/\binstead\b/i.test(message) || /\bactually\b/i.test(message)) {
    return true;
  }
  if (
    /\b(?:do\s+not|don't)\b/i.test(message) ||
    new RegExp(
      String.raw`\bno\s+(?:a\s+|the\s+|some\s+)?(?:${CAMPING_SERVICE_PHRASE}|camping\s+recommendations)\b`,
      'i',
    ).test(message) ||
    new RegExp(
      String.raw`\bwithout\s+(?:a\s+|the\s+|some\s+)?(?:${CAMPING_SERVICE_PHRASE}|camping\s+recommendations)\b`,
      'i',
    ).test(message) ||
    /\bnot\b/i.test(message)
  ) {
    return true;
  }
  if (
    /\bcamping\s+(?:store|shop|equipment|gear|stove|chair|tent|supplies|permit|rules|regulations|weather|conditions|ban|fire\s+restrictions|warning|closure)\b/i.test(
      message,
    )
  ) {
    return true;
  }
  if (
    /\bwe\s+went\s+camping\b/i.test(message) ||
    /\bwe\s+camped\b/i.test(message) ||
    /\bi\s+like\s+camping\b/i.test(message)
  ) {
    return true;
  }
  if (
    /\b(?:family[\s-]?friendly|dog[\s-]?friendly|bush|free|remote)\s+(?:camping|campsites?)\b/i.test(
      message,
    ) ||
    /\bcamping\s+cabins?\b/i.test(message)
  ) {
    return true;
  }
  if (
    /\b(?:caravan|caravans|tent|tents|glamping|swag|campfire|holiday\s+park|powered\s+site|unpowered\s+site)\b/i.test(
      message,
    ) &&
    !hasClearCampingServiceCue(message)
  ) {
    return true;
  }
  return false;
}

const EXPLICIT_CAMPING_REQUEST_CUES: readonly RegExp[] = [
  new RegExp(
    String.raw`\b(?:book|find|search|need|want|include|add|show\s+me|recommend|compare)\s+(?:me\s+)?(?:a\s+|the\s+|some\s+)?(?:best\s+|family\s+)?${CAMPING_SERVICE_PHRASE}\b`,
    'i',
  ),
  new RegExp(
    String.raw`\bi\s+(?:need|want)\s+(?:a\s+|the\s+|some\s+)?${CAMPING_SERVICE_PHRASE}\b`,
    'i',
  ),
  /\bcamping\s+(?:recommendations|options)\b/i,
  /\bbest\s+campsites?\b/i,
  /\bnearby\s+camping\b/i,
  /\bcamping\s+near\s+me\b/i,
  /\bcampgrounds?\s+near\s+me\b/i,
  new RegExp(String.raw`\b${CAMPING_SERVICE_PHRASE}\b`, 'i'),
];

function hasExplicitCampingRequest(message: string): boolean {
  const text = edgeTrim(message);
  if (text.length === 0) {
    return false;
  }
  if (isBlockedCampingRequestMessage(text)) {
    return false;
  }
  for (const cue of EXPLICIT_CAMPING_REQUEST_CUES) {
    if (cue.test(text)) {
      return true;
    }
  }
  return false;
}
