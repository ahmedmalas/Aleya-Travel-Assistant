import type {
  ConversationStateExtractionInput,
  ConversationStateExtractionResult,
  ConversationStateExtractor,
} from '../types';

/**
 * Internal national-parks-requested extraction boundary.
 *
 * Phase 7AA: recognises only narrow, explicit national-parks requests in the
 * current message. Phase 8Q extends clear national-park discovery request cues
 * only. Deterministic and local — emits only true, never false or null, and
 * ignores prior conversation state. Does not store park names.
 */
export class NationalParksRequestedConversationStateExtractor
  implements ConversationStateExtractor
{
  extract(
    input: ConversationStateExtractionInput,
  ): ConversationStateExtractionResult {
    if (!hasExplicitNationalParksRequest(input.message)) {
      return {
        stateUpdate: {},
      };
    }
    return {
      stateUpdate: {
        nationalParksRequested: true,
      },
    };
  }
}

/** Trim edges without String.prototype.trim (architecture boundary). */
function edgeTrim(value: string): string {
  return value.replace(/^\s+|\s+$/g, '');
}

const NATIONAL_PARK_SERVICE_PHRASE = String.raw`(?:national\s+parks?)`;

function hasActionNationalParksServiceCue(message: string): boolean {
  return (
    new RegExp(
      String.raw`\b(?:book|find|search|need|want|include|add|show\s+me|recommend|compare|visit)\s+(?:me\s+)?(?:a\s+|the\s+|some\s+)?(?:best\s+|family(?:[\s-]?friendly)?\s+)?${NATIONAL_PARK_SERVICE_PHRASE}\b`,
      'i',
    ).test(message) ||
    new RegExp(
      String.raw`\bi\s+(?:need|want)\s+(?:a\s+|the\s+|some\s+)?${NATIONAL_PARK_SERVICE_PHRASE}\b`,
      'i',
    ).test(message) ||
    /\bnational\s+park\s+(?:recommendations|options)\b/i.test(message) ||
    /\bbest\s+national\s+parks?\b/i.test(message) ||
    /\bnearby\s+national\s+parks?\b/i.test(message) ||
    /\bnational\s+parks?\s+near\s+me\b/i.test(message) ||
    /\bparks\s+to\s+visit\b/i.test(message) ||
    /\bwhich\s+national\s+parks?\s+should\s+i\s+visit\b/i.test(message)
  );
}

function hasClearNationalParksServiceCue(message: string): boolean {
  return (
    hasActionNationalParksServiceCue(message) ||
    new RegExp(String.raw`\b${NATIONAL_PARK_SERVICE_PHRASE}\b`, 'i').test(
      message,
    ) ||
    new RegExp(String.raw`^${NATIONAL_PARK_SERVICE_PHRASE}$`, 'i').test(
      edgeTrim(message),
    )
  );
}

/** Named national-park identities alone are never discovery requests. */
function hasNamedNationalPark(message: string): boolean {
  return (
    /\broyal\s+national\s+park\b/i.test(message) ||
    /\bblue\s+mountains\s+national\s+park\b/i.test(message) ||
    /\bkakadu\s+national\s+park\b/i.test(message) ||
    /\bkosciuszko\s+national\s+park\b/i.test(message) ||
    /\bdaintree\s+national\s+park\b/i.test(message)
  );
}

function isBlockedNationalParksRequestMessage(message: string): boolean {
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
      String.raw`\bno\s+(?:a\s+|the\s+|some\s+)?(?:${NATIONAL_PARK_SERVICE_PHRASE}|national\s+park\s+recommendations)\b`,
      'i',
    ).test(message) ||
    new RegExp(
      String.raw`\bwithout\s+(?:a\s+|the\s+|some\s+)?(?:${NATIONAL_PARK_SERVICE_PHRASE}|national\s+park\s+recommendations)\b`,
      'i',
    ).test(message) ||
    /\bnot\b/i.test(message)
  ) {
    return true;
  }
  if (hasNamedNationalPark(message)) {
    return true;
  }
  if (
    /\bnational\s+park\s+(?:pass|permit|fees|rules|regulations|map|address|weather|conditions|warning|closure|fire\s+ban|accommodation)\b/i.test(
      message,
    ) ||
    /\b(?:hotel|stay|staying)\s+near\s+(?:a\s+|the\s+)?national\s+park\b/i.test(
      message,
    )
  ) {
    return true;
  }
  if (
    /\bwe\s+visited\s+(?:a\s+|the\s+)?national\s+park\b/i.test(message) ||
    /\b(?:the\s+)?national\s+park\s+was\s+crowded\b/i.test(message) ||
    /\bi\s+like\s+national\s+parks?\b/i.test(message)
  ) {
    return true;
  }
  if (
    /\b(?:coastal|australian|local|regional|guided|beginner[\s-]?friendly|remote|alpine)\s+national\s+parks?\b/i.test(
      message,
    ) &&
    !hasActionNationalParksServiceCue(message)
  ) {
    return true;
  }
  if (
    /\b(?:playgrounds?|gardens?|reserves?|state\s+parks?|conservation\s+areas?|protected\s+areas?|wilderness(?:\s+areas?)?)\b/i.test(
      message,
    ) &&
    !hasClearNationalParksServiceCue(message)
  ) {
    return true;
  }
  if (
    /\bparks?\b/i.test(message) &&
    !hasClearNationalParksServiceCue(message)
  ) {
    return true;
  }
  return false;
}

const EXPLICIT_NATIONAL_PARKS_REQUEST_CUES: readonly RegExp[] = [
  new RegExp(
    String.raw`\b(?:book|find|search|need|want|include|add|show\s+me|recommend|compare|visit)\s+(?:me\s+)?(?:a\s+|the\s+|some\s+)?(?:best\s+|family(?:[\s-]?friendly)?\s+)?${NATIONAL_PARK_SERVICE_PHRASE}\b`,
    'i',
  ),
  new RegExp(
    String.raw`\bi\s+(?:need|want)\s+(?:a\s+|the\s+|some\s+)?${NATIONAL_PARK_SERVICE_PHRASE}\b`,
    'i',
  ),
  /\bnational\s+park\s+(?:recommendations|options)\b/i,
  /\bbest\s+national\s+parks?\b/i,
  /\bnearby\s+national\s+parks?\b/i,
  /\bnational\s+parks?\s+near\s+me\b/i,
  /\bparks\s+to\s+visit\b/i,
  /\bwhich\s+national\s+parks?\s+should\s+i\s+visit\b/i,
  new RegExp(String.raw`\b${NATIONAL_PARK_SERVICE_PHRASE}\b`, 'i'),
];

function hasExplicitNationalParksRequest(message: string): boolean {
  const text = edgeTrim(message);
  if (text.length === 0) {
    return false;
  }
  if (isBlockedNationalParksRequestMessage(text)) {
    return false;
  }
  for (const cue of EXPLICIT_NATIONAL_PARKS_REQUEST_CUES) {
    if (cue.test(text)) {
      return true;
    }
  }
  return false;
}
