import type {
  ConversationStateExtractionInput,
  ConversationStateExtractionResult,
  ConversationStateExtractor,
} from '../types';

/**
 * Internal wildlife-requested extraction boundary.
 *
 * Phase 7Z: recognises only narrow, explicit wildlife requests in the current
 * message. Phase 9C extends clear wildlife discovery cues (experiences,
 * encounters, watching, animal spotting, birdwatching, marine wildlife, native
 * animals, spots/locations/options, nearby, places to see/watch). Deterministic
 * and local — emits only true, never false or null, and ignores prior
 * conversation state. Does not use a blanket question-mark block.
 */
export class WildlifeRequestedConversationStateExtractor
  implements ConversationStateExtractor
{
  extract(
    input: ConversationStateExtractionInput,
  ): ConversationStateExtractionResult {
    if (!hasExplicitWildlifeRequest(input.message)) {
      return {
        stateUpdate: {},
      };
    }
    return {
      stateUpdate: {
        wildlifeRequested: true,
      },
    };
  }
}

/** Trim edges without String.prototype.trim (architecture boundary). */
function edgeTrim(value: string): string {
  return value.replace(/^\s+|\s+$/g, '');
}

const WILDLIFE_SERVICE_PHRASE = String.raw`(?:wildlife|wildlife\s+(?:experiences?|encounters?|watching|locations?|spots?|options?)|animal\s+spotting|birdwatching|bird[\s-]?watching|marine\s+wildlife|native\s+animals?)`;

function hasWildlifeCue(message: string): boolean {
  return /\bwildlife\b/i.test(message);
}

function hasActionWildlifeServiceCue(message: string): boolean {
  return (
    new RegExp(
      String.raw`\b(?:book|find|search|need|want|include|add|show(?:\s+me)?|recommend(?:\s+me)?|suggest(?:\s+me)?|try|see|watch|visit|explore|discover|go)\s+(?:me\s+)?(?:a\s+|the\s+|some\s+|to\s+(?:go\s+)?(?:see\s+|watch\s+)?)?(?:best\s+|family(?:[\s-]?friendly)?\s+|nearby\s+|local\s+|native\s+|marine\s+)?${WILDLIFE_SERVICE_PHRASE}\b`,
      'i',
    ).test(message) ||
    new RegExp(
      String.raw`\bi\s+(?:need|want)(?:\s+to\s+(?:see|watch|visit|explore|discover))?\s+(?:a\s+|the\s+|some\s+)?${WILDLIFE_SERVICE_PHRASE}\b`,
      'i',
    ).test(message) ||
    /\bcan\s+you\s+recommend\s+(?:\w+[\s-]*){0,3}?(?:wildlife|birdwatching|animal\s+spotting)\b/i.test(
      message,
    ) ||
    /\bwildlife\s+(?:recommendations?|options?|experiences?|encounters?|watching|locations?|spots?)\b/i.test(
      message,
    ) ||
    /\banimal\s+spotting\b/i.test(message) ||
    /\bbirdwatching\b/i.test(message) ||
    /\bbird[\s-]?watching\b/i.test(message) ||
    /\bmarine\s+wildlife\b/i.test(message) ||
    /\bnative\s+animals?\b/i.test(message) ||
    /\bnearby\s+wildlife\b/i.test(message) ||
    /\bwildlife\s+near\s+me\b/i.test(message) ||
    /\bwhere\s+can\s+(?:i|we)\s+(?:see|watch|find)\s+(?:wildlife|animals?|birds?)\b/i.test(
      message,
    ) ||
    /\bplaces?\s+to\s+see\s+wildlife\b/i.test(message) ||
    /\bplaces?\s+to\s+watch\s+animals?\b/i.test(message) ||
    /\bsee\s+wildlife\b/i.test(message) ||
    /\bwatch\s+(?:wildlife|animals?|birds?)\b/i.test(message)
  );
}

function hasClearWildlifeServiceCue(message: string): boolean {
  return (
    hasActionWildlifeServiceCue(message) ||
    hasWildlifeCue(message) ||
    /\banimal\s+spotting\b/i.test(message) ||
    /\bbirdwatching\b/i.test(message) ||
    /\bbird[\s-]?watching\b/i.test(message) ||
    /\bmarine\s+wildlife\b/i.test(message) ||
    /\bnative\s+animals?\b/i.test(message) ||
    /\bwildlife\s+(?:experiences?|encounters?|watching|locations?|spots?|options?)\b/i.test(
      message,
    ) ||
    /\bplaces?\s+to\s+see\s+wildlife\b/i.test(message) ||
    /\bplaces?\s+to\s+watch\s+animals?\b/i.test(message) ||
    new RegExp(String.raw`^${WILDLIFE_SERVICE_PHRASE}$`, 'i').test(
      edgeTrim(message),
    )
  );
}

function hasNamedAnimalOrLocationAlone(message: string): boolean {
  return (
    /\blone\s+pine\b/i.test(message) ||
    /\btaronga\b/i.test(message) ||
    /\baustralia\s+zoo\b/i.test(message)
  );
}

function isBlockedWildlifeRequestMessage(message: string): boolean {
  if (
    /\?/.test(message) &&
    !hasActionWildlifeServiceCue(message) &&
    !/\bwhere\s+can\b/i.test(message) &&
    !/\bcan\s+you\s+recommend\b/i.test(message) &&
    !/\bplaces?\s+to\s+(?:see|watch)\b/i.test(message)
  ) {
    return true;
  }
  if (/\bwhat\s+(?:is|are)\b/i.test(message)) {
    return true;
  }
  if (
    (/\bkeep\b/i.test(message) || /\bforget\b/i.test(message)) &&
    /\b(?:wildlife|birdwatching|animals?)\b/i.test(message)
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
    /\bno\s+(?:a\s+|the\s+|some\s+)?wildlife\b/i.test(message) ||
    /\bwithout\s+(?:a\s+|the\s+|some\s+)?wildlife\b/i.test(message) ||
    /\bnot\b/i.test(message)
  ) {
    return true;
  }
  if (
    hasNamedAnimalOrLocationAlone(message) &&
    !hasClearWildlifeServiceCue(message)
  ) {
    return true;
  }
  if (
    /\b(?:zoo|zoos|aquarium|aquariums)\b/i.test(message) ||
    /\bwildlife\s+(?:parks?|sanctuar(?:y|ies)|reserves?|zoos?|aquariums?)\b/i.test(
      message,
    ) ||
    /\b(?:pet|pets|pet\s+shop|pet\s+shops|veterinar(?:y|ian)|vet|vets)\b/i.test(
      message,
    ) ||
    /\b(?:purchase|buy|sale|adopt|adoption)\b/i.test(message) ||
    (/\b(?:hunting|fishing)\b/i.test(message) && !hasWildlifeCue(message)) ||
    /\b(?:rescue|rehabilitation|volunteering|volunteer)\b/i.test(message) ||
    /\b(?:camera|cameras|lens|lenses|tripod|photography\s+equipment)\b/i.test(
      message,
    ) ||
    /\bwildlife\s+(?:tours?|trips?|tickets?)\b/i.test(message) ||
    (/\b(?:ticket|tickets|tour|tours)\b/i.test(message) &&
      !hasClearWildlifeServiceCue(message)) ||
    /\b(?:permit|permits|licen[cs]e|licen[cs]es|law|laws|regulation|regulations)\b/i.test(
      message,
    ) ||
    /\b(?:weather|conditions?|sightings?)\b/i.test(message) ||
    /\bwildlife\s+(?:closure|warning)\b/i.test(message) ||
    /\b(?:closure|warning)\s+(?:for\s+)?wildlife\b/i.test(message) ||
    /\b(?:map|maps|address|addresses|directions?)\b/i.test(message)
  ) {
    return true;
  }
  if (
    /\bwe\s+saw\s+wildlife\b/i.test(message) ||
    /\bi\s+saw\s+wildlife\b/i.test(message) ||
    /\bwent\s+(?:wildlife\s+watching|birdwatching)\s+yesterday\b/i.test(
      message,
    ) ||
    /\bi\s+like\s+wildlife\b/i.test(message)
  ) {
    return true;
  }
  if (
    /\b(?:kangaroo|koalas?|wombats?|platypus(?:es)?|emus?|crocodiles?|cassowar(?:y|ies)|dingoes?|wallab(?:y|ies)|quokkas?|dolphins?|whales?|turtles?|penguins?|parrots?|eagles?|birds?|animals?|safari|sanctuar(?:y|ies)|whale[\s-]?watching)\b/i.test(
      message,
    ) &&
    !hasClearWildlifeServiceCue(message)
  ) {
    return true;
  }
  return false;
}

const EXPLICIT_WILDLIFE_REQUEST_CUES: readonly RegExp[] = [
  new RegExp(
    String.raw`\b(?:book|find|search|need|want|include|add|show(?:\s+me)?|recommend(?:\s+me)?|suggest(?:\s+me)?|try|see|watch|visit|explore|discover|go)\s+(?:me\s+)?(?:a\s+|the\s+|some\s+|to\s+(?:go\s+)?(?:see\s+|watch\s+)?)?(?:best\s+|family(?:[\s-]?friendly)?\s+|nearby\s+|local\s+|native\s+|marine\s+)?${WILDLIFE_SERVICE_PHRASE}\b`,
    'i',
  ),
  new RegExp(
    String.raw`\bi\s+(?:need|want)(?:\s+to\s+(?:see|watch|visit|explore|discover))?\s+(?:a\s+|the\s+|some\s+)?${WILDLIFE_SERVICE_PHRASE}\b`,
    'i',
  ),
  /\bcan\s+you\s+recommend\s+(?:\w+[\s-]*){0,3}?(?:wildlife|birdwatching|animal\s+spotting)\b/i,
  /\bwildlife\s+(?:recommendations?|options?|experiences?|encounters?|watching|locations?|spots?)\b/i,
  /\banimal\s+spotting\b/i,
  /\bbirdwatching\b/i,
  /\bbird[\s-]?watching\b/i,
  /\bmarine\s+wildlife\b/i,
  /\bnative\s+animals?\b/i,
  /\bnearby\s+wildlife\b/i,
  /\bwildlife\s+near\s+me\b/i,
  /\bwhere\s+can\s+(?:i|we)\s+(?:see|watch|find)\s+(?:wildlife|animals?|birds?)\b/i,
  /\bplaces?\s+to\s+see\s+wildlife\b/i,
  /\bplaces?\s+to\s+watch\s+animals?\b/i,
  /\bsee\s+wildlife\b/i,
  /\bwatch\s+(?:wildlife|animals?|birds?)\b/i,
  /\bwildlife\b/i,
];

function hasExplicitWildlifeRequest(message: string): boolean {
  const text = edgeTrim(message);
  if (text.length === 0) {
    return false;
  }
  if (isBlockedWildlifeRequestMessage(text)) {
    return false;
  }
  for (const cue of EXPLICIT_WILDLIFE_REQUEST_CUES) {
    if (cue.test(text)) {
      return true;
    }
  }
  return false;
}
