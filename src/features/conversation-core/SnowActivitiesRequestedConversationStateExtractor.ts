import type {
  ConversationStateExtractionInput,
  ConversationStateExtractionResult,
  ConversationStateExtractor,
} from './types';

/**
 * Internal snow-activities-requested extraction boundary.
 *
 * Phase 7T: recognises only narrow, explicit snow-activities requests in the
 * current message. Phase 8W extends clear snow-activity discovery-request cues
 * only. Deterministic and local — emits only true, never false or null, and
 * ignores prior conversation state. Does not use a blanket question-mark block.
 */
export class SnowActivitiesRequestedConversationStateExtractor
  implements ConversationStateExtractor
{
  extract(
    input: ConversationStateExtractionInput,
  ): ConversationStateExtractionResult {
    if (!hasExplicitSnowActivitiesRequest(input.message)) {
      return {
        stateUpdate: {},
      };
    }
    return {
      stateUpdate: {
        snowActivitiesRequested: true,
      },
    };
  }
}

/** Trim edges without String.prototype.trim (architecture boundary). */
function edgeTrim(value: string): string {
  return value.replace(/^\s+|\s+$/g, '');
}

const SNOW_ACTIVITIES_SERVICE_PHRASE = String.raw`(?:snow\s+activit(?:y|ies)|skiing|snowboarding|snowboard|tobogganing|sledding|snow\s+play|ski\s+resorts?|snow\s+resorts?|snow[\s-]?fields?)`;

function hasActionSnowActivitiesServiceCue(message: string): boolean {
  return (
    new RegExp(
      String.raw`\b(?:book|find|search|need|want|include|add|show(?:\s+me)?|recommend(?:\s+me)?|suggest(?:\s+me)?|try|go)\s+(?:me\s+)?(?:a\s+|the\s+|some\s+|somewhere\s+to\s+|to\s+go\s+)?(?:best\s+|family(?:[\s-]?friendly)?\s+|nearby\s+)?${SNOW_ACTIVITIES_SERVICE_PHRASE}\b`,
      'i',
    ).test(message) ||
    new RegExp(
      String.raw`\bi\s+(?:need|want)(?:\s+to\s+go)?\s+(?:a\s+|the\s+|some\s+)?${SNOW_ACTIVITIES_SERVICE_PHRASE}\b`,
      'i',
    ).test(message) ||
    /\bcan\s+you\s+recommend\s+(?:\w+[\s-]*){0,3}?snow\s+activit(?:y|ies)\b/i.test(
      message,
    ) ||
    /\bsnow\s+activit(?:y|ies)\s+(?:recommendations?|options?)\b/i.test(message) ||
    /\bskiing\s+options?\b/i.test(message) ||
    /\bnearby\s+(?:snow\s+activit(?:y|ies)|snow[\s-]?fields?|ski\s+resorts?|snow\s+resorts?)\b/i.test(
      message,
    ) ||
    /\b(?:tobogganing|sledding|skiing|snowboarding|snow\s+activit(?:y|ies))\s+near\s+me\b/i.test(
      message,
    ) ||
    /\bwhere\s+can\s+(?:i|we)\s+go\s+(?:skiing|snowboarding|tobogganing|sledding)\b/i.test(
      message,
    ) ||
    /\bwhat\s+snow\s+activit(?:y|ies)\s+can\s+i\s+do\b/i.test(message) ||
    /\bwhat\s+can\s+i\s+do\s+(?:\w+[\s-]*){0,4}?snow\s+activit(?:y|ies)\b/i.test(
      message,
    )
  );
}

function hasClearSnowActivitiesServiceCue(message: string): boolean {
  return (
    hasActionSnowActivitiesServiceCue(message) ||
    /\bsnow\s+activit(?:y|ies)\b/i.test(message) ||
    /\bskiing\b/i.test(message) ||
    /\bsnowboarding\b/i.test(message) ||
    /\btobogganing\b/i.test(message) ||
    /\bsledding\b/i.test(message) ||
    /\bsnow\s+play\b/i.test(message) ||
    /\bski\s+resorts?\b/i.test(message) ||
    /\bsnow\s+resorts?\b/i.test(message) ||
    /\bsnow[\s-]?fields?\b/i.test(message) ||
    new RegExp(String.raw`^${SNOW_ACTIVITIES_SERVICE_PHRASE}$`, 'i').test(
      edgeTrim(message),
    )
  );
}

function hasNamedResortAlone(message: string): boolean {
  return (
    /\bthredbo\b/i.test(message) ||
    /\bperisher\b/i.test(message) ||
    /\bfalls\s+creek\b/i.test(message)
  );
}

function isBlockedSnowActivitiesRequestMessage(message: string): boolean {
  if (/\bwhat\s+(?:is|are)\b/i.test(message)) {
    return true;
  }
  if (
    (/\bkeep\b/i.test(message) || /\bforget\b/i.test(message)) &&
    /\b(?:snow\s+activit(?:y|ies)|skiing|snowboarding|tobogganing|sledding|ski|snow)\b/i.test(
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
      String.raw`\bno\s+(?:a\s+|the\s+|some\s+)?(?:${SNOW_ACTIVITIES_SERVICE_PHRASE}|ski(?:ing)?|snowboard(?:ing)?)\b`,
      'i',
    ).test(message) ||
    new RegExp(
      String.raw`\bwithout\s+(?:a\s+|the\s+|some\s+)?(?:${SNOW_ACTIVITIES_SERVICE_PHRASE}|ski(?:ing)?|snowboard(?:ing)?)\b`,
      'i',
    ).test(message) ||
    /\bnot\b/i.test(message)
  ) {
    return true;
  }
  if (hasNamedResortAlone(message) && !hasClearSnowActivitiesServiceCue(message)) {
    return true;
  }
  if (
    /\b(?:ski|snowboard|snow)\s+hire\b/i.test(message) ||
    /\bhire\s+(?:a\s+|the\s+|some\s+)?(?:ski|skis|snowboard|snowboards)\b/i.test(
      message,
    ) ||
    /\blift\s+pass(?:es)?(?:\s+prices?)?\b/i.test(message) ||
    /\bski\s+(?:pass|ticket|tickets|lesson|lessons)(?:\s+prices?)?\b/i.test(
      message,
    ) ||
    /\bsnow\s+chains?\b/i.test(message) ||
    /\bski\s+(?:equipment|clothing|gear)\b/i.test(message) ||
    /\binstructor\s+details?\b/i.test(message) ||
    /\bsnow\s+forecast\b/i.test(message) ||
    /\bski\s+conditions?\b/i.test(message) ||
    /\bsnow\s+conditions?\b/i.test(message) ||
    /\bski\s+resort\s+map\b/i.test(message) ||
    /\bski\s+(?:warning|closure)\b/i.test(message) ||
    /\bhotel\s+near\s+a\s+ski\s+resort\b/i.test(message) ||
    /\baccommodation\s+near\s+(?:a\s+)?(?:ski|snow)\s+resorts?\b/i.test(message) ||
    /\b(?:how\s+far|drive[\s-]?time|directions?|address|website)\b/i.test(message)
  ) {
    return true;
  }
  if (
    /\bwe\s+went\s+skiing\b/i.test(message) ||
    /\bwe\s+went\s+snowboarding\b/i.test(message) ||
    /\bi\s+like\s+(?:skiing|snowboarding|snow\s+activit(?:y|ies))\b/i.test(message)
  ) {
    return true;
  }
  if (
    (/\b(?:winter|alpine)\b/i.test(message) ||
      (/\bsnow\b/i.test(message) &&
        !/\bsnow\s+(?:activit(?:y|ies)|play|resorts?|fields?)\b/i.test(message) &&
        !/\bsnowboarding\b/i.test(message) &&
        !/\bsnow[\s-]?fields?\b/i.test(message))) &&
    !hasClearSnowActivitiesServiceCue(message)
  ) {
    return true;
  }
  return false;
}

const EXPLICIT_SNOW_ACTIVITIES_REQUEST_CUES: readonly RegExp[] = [
  new RegExp(
    String.raw`\b(?:book|find|search|need|want|include|add|show(?:\s+me)?|recommend(?:\s+me)?|suggest(?:\s+me)?|try|go)\s+(?:me\s+)?(?:a\s+|the\s+|some\s+|somewhere\s+to\s+|to\s+go\s+)?(?:best\s+|family(?:[\s-]?friendly)?\s+|nearby\s+)?${SNOW_ACTIVITIES_SERVICE_PHRASE}\b`,
    'i',
  ),
  new RegExp(
    String.raw`\bi\s+(?:need|want)(?:\s+to\s+go)?\s+(?:a\s+|the\s+|some\s+)?${SNOW_ACTIVITIES_SERVICE_PHRASE}\b`,
    'i',
  ),
  /\bcan\s+you\s+recommend\s+(?:\w+[\s-]*){0,3}?snow\s+activit(?:y|ies)\b/i,
  /\bsnow\s+activit(?:y|ies)\s+(?:recommendations?|options?)\b/i,
  /\bskiing\s+options?\b/i,
  /\bnearby\s+(?:snow\s+activit(?:y|ies)|snow[\s-]?fields?|ski\s+resorts?|snow\s+resorts?)\b/i,
  /\b(?:tobogganing|sledding|skiing|snowboarding|snow\s+activit(?:y|ies))\s+near\s+me\b/i,
  /\bwhere\s+can\s+(?:i|we)\s+go\s+(?:skiing|snowboarding|tobogganing|sledding)\b/i,
  /\bwhat\s+snow\s+activit(?:y|ies)\s+can\s+i\s+do\b/i,
  /\bwhat\s+can\s+i\s+do\s+(?:\w+[\s-]*){0,4}?snow\s+activit(?:y|ies)\b/i,
  /\bsnow\s+activit(?:y|ies)\b/i,
  /\bskiing\b/i,
  /\bsnowboarding\b/i,
  /\btobogganing\b/i,
  /\bsledding\b/i,
  /\bsnow\s+play\b/i,
  /\bski\s+resorts?\b/i,
  /\bsnow\s+resorts?\b/i,
  /\bsnow[\s-]?fields?\b/i,
];

function hasExplicitSnowActivitiesRequest(message: string): boolean {
  const text = edgeTrim(message);
  if (text.length === 0) {
    return false;
  }
  if (isBlockedSnowActivitiesRequestMessage(text)) {
    return false;
  }
  for (const cue of EXPLICIT_SNOW_ACTIVITIES_REQUEST_CUES) {
    if (cue.test(text)) {
      return true;
    }
  }
  return false;
}
