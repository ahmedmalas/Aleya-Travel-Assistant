import type {
  ConversationStateExtractionInput,
  ConversationStateExtractionResult,
  ConversationStateExtractor,
} from '../types';

/**
 * Internal fishing-requested extraction boundary.
 *
 * Phase 7V: recognises only narrow, explicit fishing requests in the current
 * message. Phase 8Y extends clear fishing discovery / trip-requirement cues
 * (spots, locations, places, shore/beach/river/lake, nearby, where can I).
 * Deterministic and local — emits only true, never false or null, and ignores
 * prior conversation state. Does not use a blanket question-mark block.
 */
export class FishingRequestedConversationStateExtractor
  implements ConversationStateExtractor
{
  extract(
    input: ConversationStateExtractionInput,
  ): ConversationStateExtractionResult {
    if (!hasExplicitFishingRequest(input.message)) {
      return {
        stateUpdate: {},
      };
    }
    return {
      stateUpdate: {
        fishingRequested: true,
      },
    };
  }
}

/** Trim edges without String.prototype.trim (architecture boundary). */
function edgeTrim(value: string): string {
  return value.replace(/^\s+|\s+$/g, '');
}

const FISHING_SERVICE_PHRASE = String.raw`(?:fishing|shore\s+fishing|beach\s+fishing|river\s+fishing|lake\s+fishing|fishing\s+(?:spots?|locations?|places?|options?))`;

function hasActionFishingServiceCue(message: string): boolean {
  return (
    new RegExp(
      String.raw`\b(?:book|find|search|need|want|include|add|show(?:\s+me)?|recommend(?:\s+me)?|suggest(?:\s+me)?|try|go)\s+(?:me\s+)?(?:a\s+|the\s+|some\s+|somewhere\s+to\s+|to\s+go\s+)?(?:best\s+|family(?:[\s-]?friendly)?\s+|nearby\s+)?${FISHING_SERVICE_PHRASE}\b`,
      'i',
    ).test(message) ||
    new RegExp(
      String.raw`\bi\s+(?:need|want)(?:\s+to\s+go)?\s+(?:a\s+|the\s+|some\s+)?${FISHING_SERVICE_PHRASE}\b`,
      'i',
    ).test(message) ||
    /\b(?:want|need|like)\s+to\s+(?:go\s+)?fish(?:ing)?\b/i.test(message) ||
    /\bcan\s+you\s+recommend\s+(?:\w+[\s-]*){0,3}?(?:fishing|somewhere\s+to\s+fish)\b/i.test(
      message,
    ) ||
    /\brecommend\s+somewhere\s+to\s+fish\b/i.test(message) ||
    /\bsuggest\s+(?:somewhere|places?|spots?)\s+to\s+fish\b/i.test(message) ||
    /\bfishing\s+(?:recommendations?|options?)\b/i.test(message) ||
    /\bfishing\s+(?:spots?|locations?|places?)\b/i.test(message) ||
    /\b(?:shore|beach|river|lake)\s+fishing\b/i.test(message) ||
    /\bnearby\s+fishing\b/i.test(message) ||
    /\bfishing\s+near\s+me\b/i.test(message) ||
    /\bfind\s+fishing\s+near\s+me\b/i.test(message) ||
    /\bwhere\s+can\s+(?:i|we)\s+go\s+fishing\b/i.test(message) ||
    /\bwhere\s+can\s+(?:i|we)\s+fish\b/i.test(message) ||
    /\bplaces?\s+to\s+fish\b/i.test(message) ||
    /\bsomewhere\s+to\s+fish\b/i.test(message) ||
    /\bfamily(?:[\s-]?friendly)?\s+fishing\b/i.test(message) ||
    /\bfishing\b[\s\S]{0,40}\bfamily(?:[\s-]?friendly)?\b/i.test(message) ||
    /\bgo\s+fishing\b/i.test(message)
  );
}

function hasClearFishingServiceCue(message: string): boolean {
  return (
    hasActionFishingServiceCue(message) ||
    /\bfishing\b/i.test(message) ||
    /\b(?:shore|beach|river|lake)\s+fishing\b/i.test(message) ||
    /\bfishing\s+(?:spots?|locations?|places?|options?)\b/i.test(message) ||
    new RegExp(String.raw`^${FISHING_SERVICE_PHRASE}$`, 'i').test(
      edgeTrim(message),
    )
  );
}

function hasNamedLocationAlone(message: string): boolean {
  return (
    /\bport\s+hacking\b/i.test(message) ||
    /\bsydney\s+harbour\b/i.test(message) ||
    /\bbotany\s+bay\b/i.test(message)
  );
}

function isBlockedFishingRequestMessage(message: string): boolean {
  if (
    /\?/.test(message) &&
    !hasActionFishingServiceCue(message) &&
    !/\bwhere\s+can\b/i.test(message) &&
    !/\bcan\s+you\s+recommend\b/i.test(message) &&
    !/\brecommend\s+somewhere\s+to\s+fish\b/i.test(message)
  ) {
    return true;
  }
  if (/\bwhat\s+(?:is|are)\b/i.test(message)) {
    return true;
  }
  if (
    (/\bkeep\b/i.test(message) || /\bforget\b/i.test(message)) &&
    /\b(?:fishing|fish)\b/i.test(message)
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
    /\bno\s+(?:a\s+|the\s+|some\s+)?fishing\b/i.test(message) ||
    /\bwithout\s+(?:a\s+|the\s+|some\s+)?fishing\b/i.test(message) ||
    /\bnot\b/i.test(message)
  ) {
    return true;
  }
  if (hasNamedLocationAlone(message) && !hasClearFishingServiceCue(message)) {
    return true;
  }
  if (
    /\b(?:licen[cs]e|licen[cs]es|permit|permits|regulation|regulations)\b/i.test(
      message,
    ) ||
    /\b(?:weather|tide|tides|conditions?)\b/i.test(message) ||
    /\bfishing\s+(?:closure|warning)\b/i.test(message) ||
    /\b(?:closure|warning)\s+(?:for\s+)?fishing\b/i.test(message) ||
    /\b(?:rod|rods|bait|tackle|equipment|gear)\b/i.test(message) ||
    /\bbait\s+shop\b/i.test(message) ||
    /\b(?:boat\s+hire|charter|charters)\b/i.test(message) ||
    /\bfishing\s+(?:boats?|charters?|tackle|equipment|trips?|tours?)\b/i.test(
      message,
    ) ||
    /\b(?:map|maps|address|addresses|directions?)\b/i.test(message) ||
    /\b(?:hotel|hotels|accommodation|lodge|lodges)\b[\s\S]{0,40}\bfishing\b/i.test(
      message,
    ) ||
    /\b(?:deep[\s-]?sea|fly|spear|ice|rock|boat|charter|guided|sport)\s+fishing\b/i.test(
      message,
    ) ||
    /\b(?:how\s+far|drive[\s-]?time|website)\b/i.test(message)
  ) {
    return true;
  }
  if (
    /\bwe\s+went\s+fishing\b/i.test(message) ||
    /\bi\s+went\s+fishing\b/i.test(message) ||
    /\bwe\s+fished\b/i.test(message) ||
    /\bi\s+fished\b/i.test(message) ||
    /\bwent\s+fishing\s+yesterday\b/i.test(message) ||
    /\bi\s+like\s+fishing\b/i.test(message)
  ) {
    return true;
  }
  if (
    (/\b(?:fish|seafood|charters?|boats?|tackle|rod|rods|bait|equipment)\b/i.test(
      message,
    ) &&
      !/\bfishing\b/i.test(message) &&
      !/\bto\s+fish\b/i.test(message) &&
      !/\bgo\s+fish\b/i.test(message))
  ) {
    return true;
  }
  return false;
}

const EXPLICIT_FISHING_REQUEST_CUES: readonly RegExp[] = [
  new RegExp(
    String.raw`\b(?:book|find|search|need|want|include|add|show(?:\s+me)?|recommend(?:\s+me)?|suggest(?:\s+me)?|try|go)\s+(?:me\s+)?(?:a\s+|the\s+|some\s+|somewhere\s+to\s+|to\s+go\s+)?(?:best\s+|family(?:[\s-]?friendly)?\s+|nearby\s+)?${FISHING_SERVICE_PHRASE}\b`,
    'i',
  ),
  new RegExp(
    String.raw`\bi\s+(?:need|want)(?:\s+to\s+go)?\s+(?:a\s+|the\s+|some\s+)?${FISHING_SERVICE_PHRASE}\b`,
    'i',
  ),
  /\b(?:want|need|like)\s+to\s+(?:go\s+)?fish(?:ing)?\b/i,
  /\bcan\s+you\s+recommend\s+(?:\w+[\s-]*){0,3}?(?:fishing|somewhere\s+to\s+fish)\b/i,
  /\brecommend\s+somewhere\s+to\s+fish\b/i,
  /\bsuggest\s+(?:somewhere|places?|spots?)\s+to\s+fish\b/i,
  /\bfishing\s+(?:recommendations?|options?)\b/i,
  /\bfishing\s+(?:spots?|locations?|places?)\b/i,
  /\b(?:shore|beach|river|lake)\s+fishing\b/i,
  /\bnearby\s+fishing\b/i,
  /\bfishing\s+near\s+me\b/i,
  /\bwhere\s+can\s+(?:i|we)\s+go\s+fishing\b/i,
  /\bwhere\s+can\s+(?:i|we)\s+fish\b/i,
  /\bplaces?\s+to\s+fish\b/i,
  /\bsomewhere\s+to\s+fish\b/i,
  /\bfamily(?:[\s-]?friendly)?\s+fishing\b/i,
  /\bgo\s+fishing\b/i,
  /\bfishing\b/i,
];

function hasExplicitFishingRequest(message: string): boolean {
  const text = edgeTrim(message);
  if (text.length === 0) {
    return false;
  }
  if (isBlockedFishingRequestMessage(text)) {
    return false;
  }
  for (const cue of EXPLICIT_FISHING_REQUEST_CUES) {
    if (cue.test(text)) {
      return true;
    }
  }
  return false;
}
