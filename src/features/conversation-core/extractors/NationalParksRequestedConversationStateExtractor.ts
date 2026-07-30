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
 * only. Phase 9D extends state parks, nature reserves, protected parks, park
 * locations/options, places to visit/explore, and named parks only with a clear
 * discovery request. Deterministic and local — emits only true, never false or
 * null, and ignores prior conversation state. Does not store park names. Does
 * not use a blanket question-mark block.
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

const NATIONAL_PARK_SERVICE_PHRASE = String.raw`(?:national\s+parks?|state\s+parks?|nature\s+reserves?|protected\s+parks?|park\s+(?:locations?|options?))`;

function hasDiscoveryVerb(message: string): boolean {
  return /\b(?:book|find|search|need|want|include|add|show|recommend|suggest|compare|visit|explore|discover|see|go|try)\b/i.test(
    message,
  );
}

function hasActionNationalParksServiceCue(message: string): boolean {
  return (
    new RegExp(
      String.raw`\b(?:book|find|search|need|want|include|add|show(?:\s+me)?|recommend(?:\s+me)?|suggest(?:\s+me)?|compare|visit|explore|discover|see|try|go)\s+(?:me\s+)?(?:a\s+|the\s+|some\s+|to\s+(?:go\s+)?(?:visit\s+|explore\s+|see\s+)?)?(?:best\s+|family(?:[\s-]?friendly)?\s+|nearby\s+)?${NATIONAL_PARK_SERVICE_PHRASE}\b`,
      'i',
    ).test(message) ||
    new RegExp(
      String.raw`\bi\s+(?:need|want)(?:\s+to\s+(?:visit|explore|see|discover))?\s+(?:a\s+|the\s+|some\s+)?${NATIONAL_PARK_SERVICE_PHRASE}\b`,
      'i',
    ).test(message) ||
    /\bcan\s+you\s+recommend\s+(?:\w+[\s-]*){0,3}?(?:national\s+parks?|state\s+parks?|nature\s+reserves?)\b/i.test(
      message,
    ) ||
    /\b(?:national\s+park|state\s+park|park)\s+(?:recommendations?|options?|locations?)\b/i.test(
      message,
    ) ||
    /\bbest\s+(?:national\s+parks?|state\s+parks?)\b/i.test(message) ||
    /\bnearby\s+(?:national\s+parks?|state\s+parks?|nature\s+reserves?|protected\s+parks?)\b/i.test(
      message,
    ) ||
    /\b(?:national\s+parks?|state\s+parks?|nature\s+reserves?)\s+near\s+me\b/i.test(
      message,
    ) ||
    /\bparks?\s+to\s+visit\b/i.test(message) ||
    /\bplaces?\s+to\s+visit\s+in\s+national\s+parks?\b/i.test(message) ||
    /\bplaces?\s+to\s+explore\s+nature\b/i.test(message) ||
    /\bwhere\s+can\s+(?:i|we)\s+(?:visit|explore|see|find)\s+(?:national\s+parks?|state\s+parks?|nature\s+reserves?)\b/i.test(
      message,
    ) ||
    /\bwhich\s+national\s+parks?\s+should\s+i\s+visit\b/i.test(message) ||
    (hasNamedNationalPark(message) && hasDiscoveryVerb(message))
  );
}

function hasClearNationalParksServiceCue(message: string): boolean {
  return (
    hasActionNationalParksServiceCue(message) ||
    new RegExp(String.raw`\b${NATIONAL_PARK_SERVICE_PHRASE}\b`, 'i').test(
      message,
    ) ||
    /\bnature\s+reserves?\b/i.test(message) ||
    /\bprotected\s+parks?\b/i.test(message) ||
    /\bpark\s+(?:locations?|options?)\b/i.test(message) ||
    /\bplaces?\s+to\s+visit\s+in\s+national\s+parks?\b/i.test(message) ||
    /\bplaces?\s+to\s+explore\s+nature\b/i.test(message) ||
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
  if (
    /\?/.test(message) &&
    !hasActionNationalParksServiceCue(message) &&
    !/\bwhere\s+can\b/i.test(message) &&
    !/\bcan\s+you\s+recommend\b/i.test(message) &&
    !/\bwhich\s+national\s+parks?\s+should\b/i.test(message) &&
    !/\bplaces?\s+to\s+(?:visit|explore)\b/i.test(message)
  ) {
    return true;
  }
  if (/\bwhat\s+(?:is|are)\b/i.test(message)) {
    return true;
  }
  if (
    (/\bkeep\b/i.test(message) || /\bforget\b/i.test(message)) &&
    /\b(?:national\s+parks?|state\s+parks?|nature\s+reserves?|parks?)\b/i.test(
      message,
    )
  ) {
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
  if (hasNamedNationalPark(message) && !hasDiscoveryVerb(message)) {
    return true;
  }
  if (
    /\b(?:entry\s+)?(?:ticket|tickets|pass|passes)\b/i.test(message) ||
    /\b(?:camping\s+booking|camping\s+bookings|book\s+camping)\b/i.test(
      message,
    ) ||
    /\b(?:national\s+park|state\s+park|park)\s+(?:pass|permit|permits|fees|rules|regulations|map|maps|address|addresses|weather|conditions?|warning|closure|fire\s+ban|fire\s+warning|track\s+conditions?|accommodation|hotel|hotels|stay|stays|employment|volunteering|volunteer)\b/i.test(
      message,
    ) ||
    /\b(?:hotel|stay|staying|accommodation)\s+near\s+(?:a\s+|the\s+)?(?:national\s+park|state\s+park)\b/i.test(
      message,
    ) ||
    /\b(?:licen[cs]e|licen[cs]es|permit|permits)\b/i.test(message) ||
    (/\b(?:weather|conditions?|fire\s+ban|fire\s+warning|track\s+conditions?)\b/i.test(
      message,
    ) &&
      hasClearNationalParksServiceCue(message)) ||
    /\b(?:map|maps|address|addresses|directions?|navigation)\b/i.test(message)
  ) {
    return true;
  }
  if (
    /\bwe\s+visited\s+(?:a\s+|the\s+)?(?:national\s+park|state\s+park)\b/i.test(
      message,
    ) ||
    /\b(?:the\s+)?national\s+park\s+was\s+crowded\b/i.test(message) ||
    /\bi\s+like\s+(?:national\s+parks?|state\s+parks?|nature\s+reserves?)\b/i.test(
      message,
    )
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
    /\b(?:playgrounds?|gardens?|conservation\s+areas?|protected\s+areas?|wilderness(?:\s+areas?)?)\b/i.test(
      message,
    ) &&
    !hasClearNationalParksServiceCue(message)
  ) {
    return true;
  }
  if (
    /\bparks?\b/i.test(message) &&
    !hasClearNationalParksServiceCue(message) &&
    !/\bparks?\s+to\s+visit\b/i.test(message) &&
    !/\bpark\s+(?:locations?|options?)\b/i.test(message)
  ) {
    return true;
  }
  if (
    /\breserves?\b/i.test(message) &&
    !/\bnature\s+reserves?\b/i.test(message) &&
    !hasClearNationalParksServiceCue(message)
  ) {
    return true;
  }
  return false;
}

const EXPLICIT_NATIONAL_PARKS_REQUEST_CUES: readonly RegExp[] = [
  new RegExp(
    String.raw`\b(?:book|find|search|need|want|include|add|show(?:\s+me)?|recommend(?:\s+me)?|suggest(?:\s+me)?|compare|visit|explore|discover|see|try|go)\s+(?:me\s+)?(?:a\s+|the\s+|some\s+|to\s+(?:go\s+)?(?:visit\s+|explore\s+|see\s+)?)?(?:best\s+|family(?:[\s-]?friendly)?\s+|nearby\s+)?${NATIONAL_PARK_SERVICE_PHRASE}\b`,
    'i',
  ),
  new RegExp(
    String.raw`\bi\s+(?:need|want)(?:\s+to\s+(?:visit|explore|see|discover))?\s+(?:a\s+|the\s+|some\s+)?${NATIONAL_PARK_SERVICE_PHRASE}\b`,
    'i',
  ),
  /\bcan\s+you\s+recommend\s+(?:\w+[\s-]*){0,3}?(?:national\s+parks?|state\s+parks?|nature\s+reserves?)\b/i,
  /\b(?:national\s+park|state\s+park|park)\s+(?:recommendations?|options?|locations?)\b/i,
  /\bbest\s+(?:national\s+parks?|state\s+parks?)\b/i,
  /\bnearby\s+(?:national\s+parks?|state\s+parks?|nature\s+reserves?|protected\s+parks?)\b/i,
  /\b(?:national\s+parks?|state\s+parks?|nature\s+reserves?)\s+near\s+me\b/i,
  /\bparks?\s+to\s+visit\b/i,
  /\bplaces?\s+to\s+visit\s+in\s+national\s+parks?\b/i,
  /\bplaces?\s+to\s+explore\s+nature\b/i,
  /\bwhere\s+can\s+(?:i|we)\s+(?:visit|explore|see|find)\s+(?:national\s+parks?|state\s+parks?|nature\s+reserves?)\b/i,
  /\bwhich\s+national\s+parks?\s+should\s+i\s+visit\b/i,
  /\broyal\s+national\s+park\b/i,
  /\bblue\s+mountains\s+national\s+park\b/i,
  /\bkakadu\s+national\s+park\b/i,
  /\bkosciuszko\s+national\s+park\b/i,
  /\bdaintree\s+national\s+park\b/i,
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
