import type {
  ConversationStateExtractionInput,
  ConversationStateExtractionResult,
  ConversationStateExtractor,
} from './types';

/**
 * Internal scenic-drives-requested extraction boundary.
 *
 * Phase 7R: recognises only narrow, explicit scenic-drive requests in the
 * current message. Phase 8U extends clear scenic-drive discovery-request cues
 * only. Deterministic and local — emits only true, never false or null, and
 * ignores prior conversation state.
 */
export class ScenicDrivesRequestedConversationStateExtractor
  implements ConversationStateExtractor
{
  extract(
    input: ConversationStateExtractionInput,
  ): ConversationStateExtractionResult {
    if (!hasExplicitScenicDrivesRequest(input.message)) {
      return {
        stateUpdate: {},
      };
    }
    return {
      stateUpdate: {
        scenicDrivesRequested: true,
      },
    };
  }
}

/** Trim edges without String.prototype.trim (architecture boundary). */
function edgeTrim(value: string): string {
  return value.replace(/^\s+|\s+$/g, '');
}

const SCENIC_DRIVES_SERVICE_PHRASE = String.raw`(?:scenic\s+drives?|scenic\s+routes?|driving\s+routes?|road[\s-]?trips?(?:\s+routes?)?)`;

function hasActionScenicDrivesServiceCue(message: string): boolean {
  return (
    new RegExp(
      String.raw`\b(?:book|find|search|need|want|include|add|show(?:\s+me)?|recommend(?:\s+me)?|go|plan)\s+(?:me\s+)?(?:a\s+|the\s+|some\s+|on\s+a\s+)?(?:best\s+|family(?:[\s-]?friendly)?\s+)?${SCENIC_DRIVES_SERVICE_PHRASE}\b`,
      'i',
    ).test(message) ||
    new RegExp(
      String.raw`\bi\s+(?:need|want)\s+(?:a\s+|the\s+|some\s+)?${SCENIC_DRIVES_SERVICE_PHRASE}\b`,
      'i',
    ).test(message) ||
    /\bgo\s+on\s+a\s+scenic\s+drive\b/i.test(message) ||
    /\bplan\s+a\s+scenic\s+drive\b/i.test(message) ||
    /\bscenic\s+drive\s+recommendations?\b/i.test(message) ||
    /\bscenic\s+drive\s+options?\b/i.test(message) ||
    /\bbest\s+scenic\s+(?:drives?|routes?)\b/i.test(message) ||
    /\bnearby\s+scenic\s+drives?\b/i.test(message) ||
    /\bscenic\s+drives?\s+near\s+me\b/i.test(message) ||
    /\bplaces\s+to\s+drive\b/i.test(message) ||
    /\bwhere\s+can\s+i\s+go\s+for\s+a\s+scenic\s+drive\b/i.test(message)
  );
}

function hasClearScenicDrivesServiceCue(message: string): boolean {
  return (
    hasActionScenicDrivesServiceCue(message) ||
    /\bscenic\s+drives?\b/i.test(message) ||
    /\bscenic\s+routes?\b/i.test(message) ||
    /\bdriving\s+routes?\b/i.test(message) ||
    /\broad[\s-]?trips?(?:\s+routes?)?\b/i.test(message) ||
    new RegExp(String.raw`^${SCENIC_DRIVES_SERVICE_PHRASE}$`, 'i').test(
      edgeTrim(message),
    )
  );
}

function hasNamedRoadOrRouteAlone(message: string): boolean {
  return (
    /\bgreat\s+ocean\s+road\b/i.test(message) ||
    /\bpacific\s+coast\s+(?:drive|highway)\b/i.test(message) ||
    /\bgrand\s+pacific\s+drive\b/i.test(message) ||
    /\bwaterfall\s+way\b/i.test(message) ||
    /\bcairns\s+to\s+port\s+douglas\b/i.test(message)
  );
}

function isBlockedScenicDrivesRequestMessage(message: string): boolean {
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
      String.raw`\bno\s+(?:a\s+|the\s+|some\s+)?(?:${SCENIC_DRIVES_SERVICE_PHRASE}|scenic\s+routes?)\b`,
      'i',
    ).test(message) ||
    new RegExp(
      String.raw`\bwithout\s+(?:a\s+|the\s+|some\s+)?(?:${SCENIC_DRIVES_SERVICE_PHRASE}|scenic\s+routes?)\b`,
      'i',
    ).test(message) ||
    /\bnot\b/i.test(message)
  ) {
    return true;
  }
  if (hasNamedRoadOrRouteAlone(message)) {
    return true;
  }
  if (
    /\bscenic\s+(?:drive|route)\s+map\b/i.test(message) ||
    /\bscenic\s+(?:drive|route)\s+address\b/i.test(message) ||
    /\bscenic\s+(?:drive|route)\s+distance\b/i.test(message) ||
    /\bscenic\s+drive\s+duration\b/i.test(message) ||
    /\bscenic\s+(?:drive|route)\s+weather\b/i.test(message) ||
    /\bscenic\s+drive\s+conditions?\b/i.test(message) ||
    /\broad\s+conditions?\b/i.test(message) ||
    /\broad\s+closure\b/i.test(message) ||
    /\broad\s+warning\b/i.test(message) ||
    /\btraffic\s+on\s+the\s+scenic\s+route\b/i.test(message) ||
    /\bscenic\s+drive\s+permit\b/i.test(message) ||
    /\bscenic\s+drive\s+rules?\b/i.test(message) ||
    /\bscenic\s+drive\s+accommodation\b/i.test(message) ||
    /\bhotel\s+on\s+a\s+scenic\s+route\b/i.test(message) ||
    /\bcar\s+hire\s+for\s+a\s+road[\s-]?trip\b/i.test(message) ||
    /\broad[\s-]?trip\s+car\s+rental\b/i.test(message)
  ) {
    return true;
  }
  if (
    /\bwe\s+went\s+on\s+a\s+scenic\s+drive\b/i.test(message) ||
    /\bwe\s+drove\s+that\s+route\b/i.test(message) ||
    /\bthe\s+drive\s+was\s+scenic\b/i.test(message) ||
    /\bi\s+like\s+scenic\s+drives?\b/i.test(message)
  ) {
    return true;
  }
  if (
    /\b(?:coastal|mountain|country|lookout)\s+drives?\b/i.test(message) &&
    !hasClearScenicDrivesServiceCue(message)
  ) {
    return true;
  }
  if (
    /\bdriving\b/i.test(message) &&
    !hasClearScenicDrivesServiceCue(message)
  ) {
    return true;
  }
  return false;
}

const EXPLICIT_SCENIC_DRIVES_REQUEST_CUES: readonly RegExp[] = [
  new RegExp(
    String.raw`\b(?:book|find|search|need|want|include|add|show(?:\s+me)?|recommend(?:\s+me)?|go|plan)\s+(?:me\s+)?(?:a\s+|the\s+|some\s+|on\s+a\s+)?(?:best\s+|family(?:[\s-]?friendly)?\s+)?${SCENIC_DRIVES_SERVICE_PHRASE}\b`,
    'i',
  ),
  new RegExp(
    String.raw`\bi\s+(?:need|want)\s+(?:a\s+|the\s+|some\s+)?${SCENIC_DRIVES_SERVICE_PHRASE}\b`,
    'i',
  ),
  /\bgo\s+on\s+a\s+scenic\s+drive\b/i,
  /\bplan\s+a\s+scenic\s+drive\b/i,
  /\bscenic\s+drive\s+recommendations?\b/i,
  /\bscenic\s+drive\s+options?\b/i,
  /\bbest\s+scenic\s+(?:drives?|routes?)\b/i,
  /\bnearby\s+scenic\s+drives?\b/i,
  /\bscenic\s+drives?\s+near\s+me\b/i,
  /\bplaces\s+to\s+drive\b/i,
  /\bwhere\s+can\s+i\s+go\s+for\s+a\s+scenic\s+drive\b/i,
  /\bscenic\s+drives?\b/i,
  /\bscenic\s+routes?\b/i,
  /\bdriving\s+routes?\b/i,
  /\broad[\s-]?trips?(?:\s+routes?)?\b/i,
];

function hasExplicitScenicDrivesRequest(message: string): boolean {
  const text = edgeTrim(message);
  if (text.length === 0) {
    return false;
  }
  if (isBlockedScenicDrivesRequestMessage(text)) {
    return false;
  }
  for (const cue of EXPLICIT_SCENIC_DRIVES_REQUEST_CUES) {
    if (cue.test(text)) {
      return true;
    }
  }
  return false;
}
