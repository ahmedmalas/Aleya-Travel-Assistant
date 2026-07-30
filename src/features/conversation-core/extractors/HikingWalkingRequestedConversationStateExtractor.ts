import type {
  ConversationStateExtractionInput,
  ConversationStateExtractionResult,
  ConversationStateExtractor,
} from '../types';

/**
 * Internal hiking/walking-requested extraction boundary.
 *
 * Phase 7U: recognises only narrow, explicit hiking/walking requests in the
 * current message. Phase 8R extends clear hiking-discovery request cues only.
 * Phase 8X extends bushwalking/trekking/walk-track discovery cues and allows
 * clear discovery questions without a blanket question-mark block.
 * Deterministic and local — emits only true, never false or null, and ignores
 * prior conversation state.
 */
export class HikingWalkingRequestedConversationStateExtractor
  implements ConversationStateExtractor
{
  extract(
    input: ConversationStateExtractionInput,
  ): ConversationStateExtractionResult {
    if (!hasExplicitHikingWalkingRequest(input.message)) {
      return {
        stateUpdate: {},
      };
    }
    return {
      stateUpdate: {
        hikingWalkingRequested: true,
      },
    };
  }
}

/** Trim edges without String.prototype.trim (architecture boundary). */
function edgeTrim(value: string): string {
  return value.replace(/^\s+|\s+$/g, '');
}

const HIKING_SERVICE_PHRASE = String.raw`(?:hiking(?:\s+and\s+walking)?|hiking\s+trails?|hiking\s+routes?|walking\s+trails?|walking\s+tracks?|nature\s+walks?|coastal\s+walks?|bushwalking|trekking|hikes?|walks|walking)`;

function hasActionHikingServiceCue(message: string): boolean {
  return (
    new RegExp(
      String.raw`\b(?:book|find|search|need|want|include|add|show(?:\s+me)?|recommend(?:\s+me)?|suggest(?:\s+me)?|try|do|go)\s+(?:me\s+)?(?:a\s+|the\s+|some\s+|to\s+go\s+)?(?:best\s+|family(?:[\s-]?friendly)?\s+|nearby\s+)?${HIKING_SERVICE_PHRASE}\b`,
      'i',
    ).test(message) ||
    new RegExp(
      String.raw`\bi\s+(?:need|want)(?:\s+to\s+go)?\s+(?:a\s+|the\s+|some\s+)?${HIKING_SERVICE_PHRASE}\b`,
      'i',
    ).test(message) ||
    /\bcan\s+you\s+recommend\s+(?:\w+[\s-]*){0,3}?(?:hiking\s+trails?|hikes?|walks?|walking\s+tracks?)\b/i.test(
      message,
    ) ||
    /\bhiking\s+(?:recommendations|options)\b/i.test(message) ||
    /\bwalking\s+track\s+options?\b/i.test(message) ||
    /\bbest\s+(?:hikes|hiking\s+trails?|walks)\b/i.test(message) ||
    /\bnearby\s+(?:hiking|walks|hikes|walking\s+tracks?|hiking\s+trails?)\b/i.test(
      message,
    ) ||
    /\b(?:hiking|hikes|walks|trails|walking\s+tracks?)\s+near\s+me\b/i.test(
      message,
    ) ||
    /\bplaces\s+to\s+hike\b/i.test(message) ||
    /\bwhere\s+can\s+i\s+(?:hike|go\s+(?:hiking|trekking|bushwalking))\b/i.test(
      message,
    ) ||
    /\bwhat\s+(?:hikes|walks)\s+can\s+i\s+do\b/i.test(message)
  );
}

function hasClearHikingServiceCue(message: string): boolean {
  return (
    hasActionHikingServiceCue(message) ||
    /\bhiking(?:\s+and\s+walking)?\b/i.test(message) ||
    /\bhiking\s+trails?\b/i.test(message) ||
    /\bhiking\s+routes?\b/i.test(message) ||
    /\bwalking\s+trails?\b/i.test(message) ||
    /\bwalking\s+tracks?\b/i.test(message) ||
    /\bnature\s+walks?\b/i.test(message) ||
    /\bcoastal\s+walks?\b/i.test(message) ||
    /\bbushwalking\b/i.test(message) ||
    /\btrekking\b/i.test(message) ||
    /\bhikes?\b/i.test(message) ||
    /\bwalking\b/i.test(message) ||
    new RegExp(String.raw`^${HIKING_SERVICE_PHRASE}$`, 'i').test(
      edgeTrim(message),
    )
  );
}

function hasNamedTrailAlone(message: string): boolean {
  return (
    /\bbondi\s+to\s+coogee(?:\s+walk)?\b/i.test(message) ||
    /\boverland\s+track\b/i.test(message) ||
    /\blarapinta\s+trail\b/i.test(message) ||
    /\bthree\s+capes\s+track\b/i.test(message)
  );
}

function isBlockedHikingWalkingRequestMessage(message: string): boolean {
  if (
    /\?/.test(message) &&
    !hasActionHikingServiceCue(message) &&
    !/\bwhere\s+can\b/i.test(message) &&
    !/\bwhat\s+(?:hikes|walks)\s+can\b/i.test(message) &&
    !/\bcan\s+you\s+recommend\b/i.test(message)
  ) {
    return true;
  }
  if (/\bwhat\s+(?:is|are)\b/i.test(message)) {
    return true;
  }
  if (
    (/\bkeep\b/i.test(message) || /\bforget\b/i.test(message)) &&
    /\b(?:hiking|hikes?|walking|walks?|bushwalking|trekking|trails?|tracks?)\b/i.test(
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
      String.raw`\bno\s+(?:a\s+|the\s+|some\s+)?(?:${HIKING_SERVICE_PHRASE}|hiking\s+trails?|hiking\s+recommendations|walking\s+trails?)\b`,
      'i',
    ).test(message) ||
    new RegExp(
      String.raw`\bwithout\s+(?:a\s+|the\s+|some\s+)?(?:${HIKING_SERVICE_PHRASE}|hiking\s+trails?|hiking\s+recommendations|walking\s+trails?)\b`,
      'i',
    ).test(message) ||
    /\bnot\b/i.test(message)
  ) {
    return true;
  }
  if (hasNamedTrailAlone(message) && !hasActionHikingServiceCue(message)) {
    return true;
  }
  if (
    /\bhiking\s+(?:boots|shoes|gear|equipment|backpack|poles|clothes|store|shop|permit|rules|map|weather|conditions|warning|closure)\b/i.test(
      message,
    ) ||
    /\btrail\s+(?:map|closure|conditions|difficulty|warning)\b/i.test(message) ||
    /\bwalking\s+track\s+closed\b/i.test(message) ||
    /\bnational\s+park\s+permit\b/i.test(message) ||
    /\bguide\s+phone\s+number\b/i.test(message) ||
    /\bhotel\s+near\s+the\s+trail\b/i.test(message) ||
    /\baccommodation\s+near\s+(?:a\s+|the\s+)?trail\b/i.test(message) ||
    /\bis\s+hiking\s+healthy\b/i.test(message) ||
    /\b(?:transport|bus|shuttle)\s+to\s+(?:a\s+|the\s+)?trail\b/i.test(message)
  ) {
    return true;
  }
  if (
    /\bwe\s+went\s+hiking\b/i.test(message) ||
    /\bwe\s+hiked\b/i.test(message) ||
    /\bi\s+like\s+hiking\b/i.test(message)
  ) {
    return true;
  }
  if (
    /\b(?:walkable|walking\s+directions?|walking\s+distance|go\s+for\s+a\s+walk)\b/i.test(
      message,
    )
  ) {
    return true;
  }
  if (
    /\b(?:easy|guided|beginner[\s-]?friendly|mountain|forest|day|multi[\s-]?day|scenic|remote)\s+(?:hiking|walking)\b/i.test(
      message,
    ) &&
    !hasActionHikingServiceCue(message)
  ) {
    return true;
  }
  if (
    /\b(?:trails?|tracks?)\b/i.test(message) &&
    !hasClearHikingServiceCue(message) &&
    !/\btrails\s+near\s+me\b/i.test(message)
  ) {
    return true;
  }
  if (/\btrek\b/i.test(message) && !/\btrekking\b/i.test(message) && !hasActionHikingServiceCue(message)) {
    return true;
  }
  return false;
}

const EXPLICIT_HIKING_WALKING_REQUEST_CUES: readonly RegExp[] = [
  new RegExp(
    String.raw`\b(?:book|find|search|need|want|include|add|show(?:\s+me)?|recommend(?:\s+me)?|suggest(?:\s+me)?|try|do|go)\s+(?:me\s+)?(?:a\s+|the\s+|some\s+|to\s+go\s+)?(?:best\s+|family(?:[\s-]?friendly)?\s+|nearby\s+)?${HIKING_SERVICE_PHRASE}\b`,
    'i',
  ),
  new RegExp(
    String.raw`\bi\s+(?:need|want)(?:\s+to\s+go)?\s+(?:a\s+|the\s+|some\s+)?${HIKING_SERVICE_PHRASE}\b`,
    'i',
  ),
  /\bcan\s+you\s+recommend\s+(?:\w+[\s-]*){0,3}?(?:hiking\s+trails?|hikes?|walks?|walking\s+tracks?)\b/i,
  /\bhiking\s+(?:recommendations|options)\b/i,
  /\bwalking\s+track\s+options?\b/i,
  /\bbest\s+(?:hikes|hiking\s+trails?|walks)\b/i,
  /\bnearby\s+(?:hiking|walks|hikes|walking\s+tracks?|hiking\s+trails?)\b/i,
  /\b(?:hiking|hikes|walks|trails|walking\s+tracks?)\s+near\s+me\b/i,
  /\bplaces\s+to\s+hike\b/i,
  /\bwhere\s+can\s+i\s+(?:hike|go\s+(?:hiking|trekking|bushwalking))\b/i,
  /\bwhat\s+(?:hikes|walks)\s+can\s+i\s+do\b/i,
  /\bhiking(?:\s+and\s+walking)?\b/i,
  /\bhiking\s+trails?\b/i,
  /\bhiking\s+routes?\b/i,
  /\bwalking\s+trails?\b/i,
  /\bwalking\s+tracks?\b/i,
  /\bnature\s+walks?\b/i,
  /\bcoastal\s+walks?\b/i,
  /\bbushwalking\b/i,
  /\btrekking\b/i,
  /\bhikes?\b/i,
  /\bwalking\b/i,
];

function hasExplicitHikingWalkingRequest(message: string): boolean {
  const text = edgeTrim(message);
  if (text.length === 0) {
    return false;
  }
  if (isBlockedHikingWalkingRequestMessage(text)) {
    return false;
  }
  for (const cue of EXPLICIT_HIKING_WALKING_REQUEST_CUES) {
    if (cue.test(text)) {
      return true;
    }
  }
  return false;
}
