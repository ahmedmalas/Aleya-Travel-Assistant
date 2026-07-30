import type {
  ConversationStateExtractionInput,
  ConversationStateExtractionResult,
  ConversationStateExtractor,
} from '../types';

/**
 * Internal wineries/food-trails-requested extraction boundary.
 *
 * Phase 7X: recognises only narrow, explicit wineries or food-trail requests in
 * the current message. Phase 9A extends clear winery / food-trail discovery
 * cues (vineyards, wine regions/trails, gourmet/culinary trails, nearby,
 * winery options/locations, places to visit/explore). Deterministic and local
 * — emits only true, never false or null, and ignores prior conversation
 * state. Does not use a blanket question-mark block.
 */
export class WineriesFoodTrailsRequestedConversationStateExtractor
  implements ConversationStateExtractor
{
  extract(
    input: ConversationStateExtractionInput,
  ): ConversationStateExtractionResult {
    if (!hasExplicitWineriesFoodTrailsRequest(input.message)) {
      return {
        stateUpdate: {},
      };
    }
    return {
      stateUpdate: {
        wineriesFoodTrailsRequested: true,
      },
    };
  }
}

/** Trim edges without String.prototype.trim (architecture boundary). */
function edgeTrim(value: string): string {
  return value.replace(/^\s+|\s+$/g, '');
}

const WINERIES_FOOD_TRAILS_SERVICE_PHRASE = String.raw`(?:wineries|winery|vineyards?|wine\s+regions?|wine\s+trails?|food\s+trails?|gourmet\s+trails?|culinary\s+trails?|winery\s+(?:locations?|options?)|food[\s-]?trail\s+locations?)`;

function hasActionWineriesFoodTrailsServiceCue(message: string): boolean {
  return (
    new RegExp(
      String.raw`\b(?:book|find|search|need|want|include|add|show(?:\s+me)?|recommend(?:\s+me)?|suggest(?:\s+me)?|try|visit|explore|go)\s+(?:me\s+)?(?:a\s+|the\s+|some\s+|somewhere\s+to\s+|to\s+(?:go\s+|visit\s+|explore\s+)?)?(?:best\s+|family(?:[\s-]?friendly)?\s+|nearby\s+|local\s+)?${WINERIES_FOOD_TRAILS_SERVICE_PHRASE}\b`,
      'i',
    ).test(message) ||
    new RegExp(
      String.raw`\bi\s+(?:need|want)(?:\s+to\s+(?:go|visit|explore))?\s+(?:a\s+|the\s+|some\s+)?${WINERIES_FOOD_TRAILS_SERVICE_PHRASE}\b`,
      'i',
    ).test(message) ||
    /\bcan\s+you\s+recommend\s+(?:\w+[\s-]*){0,3}?(?:wineries|winery|vineyards?|food\s+trails?|wine\s+(?:regions?|trails?))\b/i.test(
      message,
    ) ||
    /\b(?:wineries|winery|food\s+trails?|wine\s+trails?|gourmet\s+trails?|culinary\s+trails?)\s+(?:recommendations?|options?)\b/i.test(
      message,
    ) ||
    /\b(?:winery|food[\s-]?trail)\s+locations?\b/i.test(message) ||
    /\bnearby\s+(?:wineries|winery|vineyards?|food\s+trails?|wine\s+trails?|gourmet\s+trails?|culinary\s+trails?)\b/i.test(
      message,
    ) ||
    /\b(?:wineries|winery|vineyards?|food\s+trails?)\s+near\s+me\b/i.test(
      message,
    ) ||
    /\bwhere\s+can\s+(?:i|we)\s+(?:visit|explore|go\s+to)\s+(?:wineries|a\s+winery|vineyards?|food\s+trails?)\b/i.test(
      message,
    ) ||
    /\bplaces?\s+to\s+visit\s+(?:wineries|a\s+winery|vineyards?)\b/i.test(
      message,
    ) ||
    /\bplaces?\s+to\s+explore\s+(?:local\s+)?food\b/i.test(message) ||
    /\bplaces?\s+to\s+explore\s+(?:food\s+trails?|wineries|wine\s+regions?)\b/i.test(
      message,
    ) ||
    /\bvisit\s+(?:wineries|a\s+winery|vineyards?)\b/i.test(message) ||
    /\bexplore\s+(?:local\s+food|food\s+trails?|wineries|wine\s+regions?)\b/i.test(
      message,
    )
  );
}

function hasClearWineriesFoodTrailsServiceCue(message: string): boolean {
  return (
    hasActionWineriesFoodTrailsServiceCue(message) ||
    /\bwineries\b/i.test(message) ||
    /\bwinery\b/i.test(message) ||
    /\bvineyards?\b/i.test(message) ||
    /\bwine\s+regions?\b/i.test(message) ||
    /\bwine\s+trails?\b/i.test(message) ||
    /\bfood\s+trails?\b/i.test(message) ||
    /\bgourmet\s+trails?\b/i.test(message) ||
    /\bculinary\s+trails?\b/i.test(message) ||
    /\bwinery\s+(?:locations?|options?)\b/i.test(message) ||
    /\bfood[\s-]?trail\s+locations?\b/i.test(message) ||
    /\bplaces?\s+to\s+explore\s+(?:local\s+)?food\b/i.test(message) ||
    new RegExp(String.raw`^${WINERIES_FOOD_TRAILS_SERVICE_PHRASE}$`, 'i').test(
      edgeTrim(message),
    )
  );
}

function hasNamedWineryOrRegionAlone(message: string): boolean {
  return (
    /\bpenfolds\b/i.test(message) ||
    /\bbarossa\s+valley\b/i.test(message) ||
    /\bhunter\s+valley\b/i.test(message) ||
    /\bmargaret\s+river\b/i.test(message) ||
    /\byarra\s+valley\b/i.test(message)
  );
}

function isBlockedWineriesFoodTrailsRequestMessage(message: string): boolean {
  if (
    /\?/.test(message) &&
    !hasActionWineriesFoodTrailsServiceCue(message) &&
    !/\bwhere\s+can\b/i.test(message) &&
    !/\bcan\s+you\s+recommend\b/i.test(message) &&
    !/\bplaces?\s+to\s+(?:visit|explore)\b/i.test(message)
  ) {
    return true;
  }
  if (/\bwhat\s+(?:is|are)\b/i.test(message)) {
    return true;
  }
  if (
    (/\bkeep\b/i.test(message) || /\bforget\b/i.test(message)) &&
    /\b(?:wineries|winery|vineyards?|food\s+trails?|wine\s+(?:regions?|trails?)|gourmet\s+trails?|culinary\s+trails?)\b/i.test(
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
    /\bno\s+(?:a\s+|the\s+|some\s+)?(?:wineries|winery|vineyards?|food\s+trails?|wine\s+(?:regions?|trails?))\b/i.test(
      message,
    ) ||
    /\bwithout\s+(?:a\s+|the\s+|some\s+)?(?:wineries|winery|vineyards?|food\s+trails?)\b/i.test(
      message,
    ) ||
    /\bnot\b/i.test(message)
  ) {
    return true;
  }
  if (
    hasNamedWineryOrRegionAlone(message) &&
    !hasClearWineriesFoodTrailsServiceCue(message)
  ) {
    return true;
  }
  if (
    /\b(?:bottle\s+shop|bottle\s+shops|liquor\s+store|liquor\s+stores|alcohol)\b/i.test(
      message,
    ) ||
    /\b(?:buy|purchase|order)\s+(?:wine|alcohol|food|bottles?)\b/i.test(
      message,
    ) ||
    /\b(?:wine|alcohol|food)\s+(?:purchase|shipping|delivery)\b/i.test(
      message,
    ) ||
    /\b(?:meal|meals|cuisine|cuisines|recipe|recipes|ingredient|ingredients)\b/i.test(
      message,
    ) ||
    /\b(?:winery|wine)\s+(?:accommodation|hotel|hotels|stay|stays|lodge|lodges)\b/i.test(
      message,
    ) ||
    /\b(?:accommodation|hotel|hotels)\s+(?:at\s+)?(?:a\s+)?(?:winery|wineries)\b/i.test(
      message,
    ) ||
    /\b(?:wine[\s-]?making|winemaking)\s+equipment\b/i.test(message) ||
    /\b(?:employment|job|jobs|career|property|real\s+estate|for\s+sale)\b/i.test(
      message,
    ) ||
    /\b(?:wine|food)\s+tours?\b/i.test(message) ||
    (/\b(?:transport|transfer|transfers)\s+booking/i.test(message) &&
      !hasClearWineriesFoodTrailsServiceCue(message)) ||
    /\b(?:licen[cs]e|licen[cs]es|law|laws|regulation|regulations)\b/i.test(
      message,
    ) ||
    /\b(?:weather|conditions?)\b/i.test(message) ||
    /\b(?:wineries|winery|food\s+trails?)\s+(?:closure|warning)\b/i.test(
      message,
    ) ||
    /\b(?:closure|warning)\s+(?:for\s+)?(?:wineries|winery|food\s+trails?)\b/i.test(
      message,
    ) ||
    /\b(?:map|maps|address|addresses|directions?)\b/i.test(message)
  ) {
    return true;
  }
  if (
    /\bwe\s+visited\s+(?:wineries|a\s+winery)\b/i.test(message) ||
    /\bi\s+visited\s+(?:wineries|a\s+winery)\b/i.test(message) ||
    /\bwent\s+to\s+(?:wineries|a\s+winery)\s+yesterday\b/i.test(message) ||
    /\bi\s+like\s+(?:wineries|wine|food\s+trails?)\b/i.test(message)
  ) {
    return true;
  }
  if (
    /\b(?:wine|food|restaurants?|cellar\s+doors?|markets?)\b/i.test(message) &&
    !hasClearWineriesFoodTrailsServiceCue(message)
  ) {
    return true;
  }
  return false;
}

const EXPLICIT_WINERIES_FOOD_TRAILS_REQUEST_CUES: readonly RegExp[] = [
  new RegExp(
    String.raw`\b(?:book|find|search|need|want|include|add|show(?:\s+me)?|recommend(?:\s+me)?|suggest(?:\s+me)?|try|visit|explore|go)\s+(?:me\s+)?(?:a\s+|the\s+|some\s+|somewhere\s+to\s+|to\s+(?:go\s+|visit\s+|explore\s+)?)?(?:best\s+|family(?:[\s-]?friendly)?\s+|nearby\s+|local\s+)?${WINERIES_FOOD_TRAILS_SERVICE_PHRASE}\b`,
    'i',
  ),
  new RegExp(
    String.raw`\bi\s+(?:need|want)(?:\s+to\s+(?:go|visit|explore))?\s+(?:a\s+|the\s+|some\s+)?${WINERIES_FOOD_TRAILS_SERVICE_PHRASE}\b`,
    'i',
  ),
  /\bcan\s+you\s+recommend\s+(?:\w+[\s-]*){0,3}?(?:wineries|winery|vineyards?|food\s+trails?|wine\s+(?:regions?|trails?))\b/i,
  /\b(?:wineries|winery|food\s+trails?|wine\s+trails?|gourmet\s+trails?|culinary\s+trails?)\s+(?:recommendations?|options?)\b/i,
  /\b(?:winery|food[\s-]?trail)\s+locations?\b/i,
  /\bnearby\s+(?:wineries|winery|vineyards?|food\s+trails?|wine\s+trails?|gourmet\s+trails?|culinary\s+trails?)\b/i,
  /\b(?:wineries|winery|vineyards?|food\s+trails?)\s+near\s+me\b/i,
  /\bwhere\s+can\s+(?:i|we)\s+(?:visit|explore|go\s+to)\s+(?:wineries|a\s+winery|vineyards?|food\s+trails?)\b/i,
  /\bplaces?\s+to\s+visit\s+(?:wineries|a\s+winery|vineyards?)\b/i,
  /\bplaces?\s+to\s+explore\s+(?:local\s+)?food\b/i,
  /\bplaces?\s+to\s+explore\s+(?:food\s+trails?|wineries|wine\s+regions?)\b/i,
  /\bvisit\s+(?:wineries|a\s+winery|vineyards?)\b/i,
  /\bexplore\s+(?:local\s+food|food\s+trails?|wineries|wine\s+regions?)\b/i,
  /\bwineries\s+and\s+food\s+trails?\b/i,
  /\bfood\s+trails?\s+and\s+wineries\b/i,
  /\bwineries\b/i,
  /\bwinery\b/i,
  /\bvineyards?\b/i,
  /\bwine\s+regions?\b/i,
  /\bwine\s+trails?\b/i,
  /\bfood\s+trails?\b/i,
  /\bgourmet\s+trails?\b/i,
  /\bculinary\s+trails?\b/i,
];

function hasExplicitWineriesFoodTrailsRequest(message: string): boolean {
  const text = edgeTrim(message);
  if (text.length === 0) {
    return false;
  }
  if (isBlockedWineriesFoodTrailsRequestMessage(text)) {
    return false;
  }
  for (const cue of EXPLICIT_WINERIES_FOOD_TRAILS_REQUEST_CUES) {
    if (cue.test(text)) {
      return true;
    }
  }
  return false;
}
