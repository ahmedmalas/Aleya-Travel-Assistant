import type {
  ConversationStateExtractionInput,
  ConversationStateExtractionResult,
  ConversationStateExtractor,
} from './types';

/**
 * Internal attractions-requested extraction boundary.
 *
 * Phase 7S: recognises only narrow, explicit attraction-request cues in the
 * current message. Phase 8V extends clear attractions-discovery request cues
 * only. Deterministic and local — emits only true, never false or null, and
 * ignores prior conversation state.
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

const ATTRACTIONS_SERVICE_PHRASE = String.raw`(?:(?:tourist|local)\s+)?attractions?|things\s+to\s+see|sights\s+to\s+see|places\s+to\s+visit`;

function hasActionAttractionsServiceCue(message: string): boolean {
  return (
    new RegExp(
      String.raw`\b(?:book|find|search|need|want|include|add|show(?:\s+me)?|recommend(?:\s+me)?|visit)\s+(?:me\s+)?(?:a\s+|an\s+|the\s+|some\s+)?(?:best\s+|top\s+|must[\s-]?see\s+|family(?:[\s-]?friendly)?\s+|nearby\s+)?(?:${ATTRACTIONS_SERVICE_PHRASE})\b`,
      'i',
    ).test(message) ||
    new RegExp(
      String.raw`\bi\s+(?:need|want)\s+(?:a\s+|an\s+|the\s+|some\s+)?(?:${ATTRACTIONS_SERVICE_PHRASE})\b`,
      'i',
    ).test(message) ||
    /\battraction\s+recommendations?\b/i.test(message) ||
    /\battraction\s+options?\b/i.test(message) ||
    /\bbest\s+attractions?\b/i.test(message) ||
    /\btop\s+attractions?\b/i.test(message) ||
    /\bmust[\s-]?see\s+attractions?\b/i.test(message) ||
    /\bnearby\s+attractions?\b/i.test(message) ||
    /\battractions?\s+near\s+me\b/i.test(message) ||
    /\bwhat\s+should\s+i\s+see\b/i.test(message) ||
    /\bwhere\s+should\s+i\s+visit\b/i.test(message)
  );
}

function hasClearAttractionsServiceCue(message: string): boolean {
  return (
    hasActionAttractionsServiceCue(message) ||
    /\b(?:tourist|local)\s+attractions?\b/i.test(message) ||
    /\battractions?\b/i.test(message) ||
    /\bthings\s+to\s+see\b/i.test(message) ||
    /\bsights\s+to\s+see\b/i.test(message) ||
    /\bplaces\s+to\s+visit\b/i.test(message) ||
    new RegExp(String.raw`^(?:${ATTRACTIONS_SERVICE_PHRASE})$`, 'i').test(
      edgeTrim(message),
    )
  );
}

function hasNamedAttractionAlone(message: string): boolean {
  return (
    /\bsydney\s+opera\s+house\b/i.test(message) ||
    /\blone\s+pine\s+koala\s+sanctuary\b/i.test(message) ||
    /\bsea\s+world\b/i.test(message) ||
    /\bthe\s+big\s+banana\b/i.test(message) ||
    /\bbondi\s+beach\b/i.test(message)
  );
}

function isBlockedAttractionsRequestMessage(message: string): boolean {
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
      String.raw`\bno\s+(?:a\s+|an\s+|the\s+|some\s+)?(?:${ATTRACTIONS_SERVICE_PHRASE})\b`,
      'i',
    ).test(message) ||
    new RegExp(
      String.raw`\bwithout\s+(?:a\s+|an\s+|the\s+|some\s+)?(?:${ATTRACTIONS_SERVICE_PHRASE})\b`,
      'i',
    ).test(message) ||
    /\bnot\b/i.test(message)
  ) {
    return true;
  }
  if (hasNamedAttractionAlone(message)) {
    return true;
  }
  if (
    /\battraction\s+tickets?\b/i.test(message) ||
    /\battraction\s+ticket\s+prices?\b/i.test(message) ||
    /\battraction\s+opening\s+hours\b/i.test(message) ||
    /\battraction\s+address\b/i.test(message) ||
    /\battraction\s+phone\s+number\b/i.test(message) ||
    /\battraction\s+website\b/i.test(message) ||
    /\battraction\s+map\b/i.test(message) ||
    /\battraction\s+weather\b/i.test(message) ||
    /\battraction\s+closure\b/i.test(message) ||
    /\battraction\s+warning\b/i.test(message) ||
    /\battraction\s+accessibility\b/i.test(message) ||
    /\bhotel\s+near\s+an\s+attraction\b/i.test(message) ||
    /\baccommodation\s+near\s+tourist\s+attractions?\b/i.test(message)
  ) {
    return true;
  }
  if (
    /\bthe\s+attraction\s+was\s+crowded\b/i.test(message) ||
    /\bwe\s+visited\s+the\s+attraction\b/i.test(message) ||
    /\bi\s+liked\s+the\s+attraction\b/i.test(message)
  ) {
    return true;
  }
  if (
    /\b(?:landmark|landmarks|museum|museums|theme\s+parks?|zoo|zoos|aquarium|aquariums|tourist\s+spots?|sightseeing)\b/i.test(
      message,
    ) &&
    !hasClearAttractionsServiceCue(message)
  ) {
    return true;
  }
  return false;
}

const EXPLICIT_ATTRACTIONS_REQUEST_CUES: readonly RegExp[] = [
  new RegExp(
    String.raw`\b(?:book|find|search|need|want|include|add|show(?:\s+me)?|recommend(?:\s+me)?|visit)\s+(?:me\s+)?(?:a\s+|an\s+|the\s+|some\s+)?(?:best\s+|top\s+|must[\s-]?see\s+|family(?:[\s-]?friendly)?\s+|nearby\s+)?(?:${ATTRACTIONS_SERVICE_PHRASE})\b`,
    'i',
  ),
  new RegExp(
    String.raw`\bi\s+(?:need|want)\s+(?:a\s+|an\s+|the\s+|some\s+)?(?:${ATTRACTIONS_SERVICE_PHRASE})\b`,
    'i',
  ),
  /\battraction\s+recommendations?\b/i,
  /\battraction\s+options?\b/i,
  /\bbest\s+attractions?\b/i,
  /\btop\s+attractions?\b/i,
  /\bmust[\s-]?see\s+attractions?\b/i,
  /\bnearby\s+attractions?\b/i,
  /\battractions?\s+near\s+me\b/i,
  /\bwhat\s+should\s+i\s+see\b/i,
  /\bwhere\s+should\s+i\s+visit\b/i,
  /\b(?:tourist|local)\s+attractions?\b/i,
  /\battractions?\b/i,
  /\bthings\s+to\s+see\b/i,
  /\bsights\s+to\s+see\b/i,
  /\bplaces\s+to\s+visit\b/i,
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
