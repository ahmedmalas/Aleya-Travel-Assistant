import type {
  ConversationStateExtractionInput,
  ConversationStateExtractionResult,
  ConversationStateExtractor,
} from './types';

/**
 * Internal four-wheel-driving-requested extraction boundary.
 *
 * Phase 7Q: recognises only narrow, explicit four-wheel-driving requests in the
 * current message. Phase 8T extends clear four-wheel-driving discovery-request
 * cues only. Deterministic and local — emits only true, never false or null,
 * and ignores prior conversation state.
 */
export class FourWheelDrivingRequestedConversationStateExtractor
  implements ConversationStateExtractor
{
  extract(
    input: ConversationStateExtractionInput,
  ): ConversationStateExtractionResult {
    if (!hasExplicitFourWheelDrivingRequest(input.message)) {
      return {
        stateUpdate: {},
      };
    }
    return {
      stateUpdate: {
        fourWheelDriveRequested: true,
      },
    };
  }
}

/** Trim edges without String.prototype.trim (architecture boundary). */
function edgeTrim(value: string): string {
  return value.replace(/^\s+|\s+$/g, '');
}

const FOUR_WHEEL_DRIVING_SERVICE_PHRASE = String.raw`(?:four[\s-]?wheel\s+driving|4[\s-]?wheel\s+driving|4wding|4wd|4x4|off[\s-]?road\s+driving|four[\s-]?wheel\s+drive\s+tracks?|4wd\s+tracks?|4x4\s+tracks?|off[\s-]?road\s+tracks?)`;

function hasActionFourWheelDrivingServiceCue(message: string): boolean {
  return (
    new RegExp(
      String.raw`\b(?:book|find|search|need|want|include|add|show(?:\s+me)?|recommend(?:\s+me)?|go)\s+(?:me\s+)?(?:a\s+|the\s+|some\s+)?(?:best\s+|beginner(?:[\s-]?friendly)?\s+|family(?:[\s-]?friendly)?\s+)?${FOUR_WHEEL_DRIVING_SERVICE_PHRASE}\b`,
      'i',
    ).test(message) ||
    new RegExp(
      String.raw`\bi\s+(?:need|want)\s+(?:a\s+|the\s+|some\s+)?${FOUR_WHEEL_DRIVING_SERVICE_PHRASE}\b`,
      'i',
    ).test(message) ||
    /\b(?:find|search|show(?:\s+me)?|recommend(?:\s+me)?)\s+(?:\w+[\s-]*){0,4}?places\s+to\s+go\s+off[\s-]?road\b/i.test(
      message,
    ) ||
    /\b4wd\s+recommendations?\b/i.test(message) ||
    /\b4wd\s+options?\b/i.test(message) ||
    /\bbest\s+4wd\s+tracks?\b/i.test(message) ||
    /\bnearby\s+(?:4wd|4x4|four[\s-]?wheel(?:\s+drive)?|off[\s-]?road)\s+tracks?\b/i.test(
      message,
    ) ||
    /\b(?:4wd|4x4|four[\s-]?wheel(?:\s+drive)?|off[\s-]?road)\s+tracks?\s+near\s+me\b/i.test(
      message,
    ) ||
    /\bplaces\s+to\s+go\s+four[\s-]?wheel\s+driving\b/i.test(message) ||
    /\bwhere\s+can\s+i\s+go\s+4wding\b/i.test(message)
  );
}

function hasClearFourWheelDrivingServiceCue(message: string): boolean {
  return (
    hasActionFourWheelDrivingServiceCue(message) ||
    /\bfour[\s-]?wheel\s+driving\b/i.test(message) ||
    /\b4[\s-]?wheel\s+driving\b/i.test(message) ||
    /\b4wding\b/i.test(message) ||
    /\boff[\s-]?road\s+driving\b/i.test(message) ||
    /\bfour[\s-]?wheel\s+drive\s+tracks?\b/i.test(message) ||
    /\b4wd\s+tracks?\b/i.test(message) ||
    /\b4x4\s+tracks?\b/i.test(message) ||
    /\boff[\s-]?road\s+tracks?\b/i.test(message) ||
    /\b4wd\b/i.test(message) ||
    /\b4x4\b/i.test(message) ||
    new RegExp(String.raw`^${FOUR_WHEEL_DRIVING_SERVICE_PHRASE}$`, 'i').test(
      edgeTrim(message),
    )
  );
}

function hasNamedTrackAlone(message: string): boolean {
  return (
    /\bfinke\s+desert\s+race\b/i.test(message) ||
    /\blarapinta\s+trail\b/i.test(message)
  );
}

function isBlockedFourWheelDrivingRequestMessage(message: string): boolean {
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
      String.raw`\bno\s+(?:a\s+|the\s+|some\s+)?(?:${FOUR_WHEEL_DRIVING_SERVICE_PHRASE}|4wd(?:ing)?|4x4|four[\s-]?wheel|off[\s-]?road)\b`,
      'i',
    ).test(message) ||
    new RegExp(
      String.raw`\bwithout\s+(?:a\s+|the\s+|some\s+)?(?:${FOUR_WHEEL_DRIVING_SERVICE_PHRASE}|4wd(?:ing)?|4x4|four[\s-]?wheel|off[\s-]?road)\b`,
      'i',
    ).test(message) ||
    /\bnot\b/i.test(message)
  ) {
    return true;
  }
  if (hasNamedTrackAlone(message)) {
    return true;
  }
  if (
    /\b(?:4wd|4x4|four[\s-]?wheel(?:\s+drive)?)\s+hire\b/i.test(message) ||
    /\bhire\s+(?:a\s+|the\s+|some\s+)?(?:4wd|4x4|four[\s-]?wheel(?:\s+drive)?)\b/i.test(
      message,
    ) ||
    /\b(?:4wd|4x4|four[\s-]?wheel(?:\s+drive)?)\s+rental\b/i.test(message) ||
    /\brent(?:al)?\s+(?:a\s+|the\s+|some\s+)?(?:4wd|4x4|four[\s-]?wheel(?:\s+drive)?)\b/i.test(
      message,
    ) ||
    /\bbuy\s+(?:a\s+|the\s+|some\s+)?(?:4wd|4x4|four[\s-]?wheel(?:\s+drive)?)\b/i.test(
      message,
    ) ||
    /\b(?:4wd|4x4|four[\s-]?wheel(?:\s+drive)?)\s+for\s+sale\b/i.test(message) ||
    /\b(?:4wd|4x4|four[\s-]?wheel(?:\s+drive)?)\s+dealership\b/i.test(message) ||
    /\b(?:4wd|4x4|four[\s-]?wheel(?:\s+drive)?)\s+vehicle\b/i.test(message) ||
    /\b(?:4wd|4x4)\s+tyres?\b/i.test(message) ||
    /\b(?:4wd|4x4)\s+accessories\b/i.test(message) ||
    /\b(?:4wd|4x4)\s+equipment\b/i.test(message) ||
    /\b(?:4wd|4x4)\s+recovery\s+gear\b/i.test(message) ||
    /\b(?:4wd|4x4)\s+winch\b/i.test(message) ||
    /\b(?:4wd|4x4)\s+suspension\b/i.test(message) ||
    /\b(?:4wd|4x4)\s+service\b/i.test(message) ||
    /\b(?:4wd|4x4)\s+repairs?\b/i.test(message) ||
    /\b(?:4wd|4x4)\s+permit\b/i.test(message) ||
    /\b(?:4wd|4x4)\s+rules?\b/i.test(message) ||
    /\b(?:4wd|4x4)\s+regulations?\b/i.test(message) ||
    /\b(?:4wd|4x4)\s+track\s+map\b/i.test(message) ||
    /\b(?:4wd|4x4)\s+track\s+conditions?\b/i.test(message) ||
    /\b(?:4wd|4x4)\s+track\s+closure\b/i.test(message) ||
    /\b(?:4wd|4x4)\s+warning\b/i.test(message) ||
    /\boff[\s-]?road\s+weather\b/i.test(message)
  ) {
    return true;
  }
  if (
    /\bwe\s+went\s+four[\s-]?wheel\s+driving\b/i.test(message) ||
    /\bwe\s+drove\s+the\s+track\b/i.test(message) ||
    /\bi\s+own\s+(?:a\s+)?(?:4wd|4x4)\b/i.test(message) ||
    /\bi\s+like\s+4wding\b/i.test(message)
  ) {
    return true;
  }
  if (
    /\b(?:suv|awd|ute)\b/i.test(message) &&
    !hasClearFourWheelDrivingServiceCue(message)
  ) {
    return true;
  }
  if (
    /\boff[\s-]?road(?:ing)?\b/i.test(message) &&
    !hasClearFourWheelDrivingServiceCue(message)
  ) {
    return true;
  }
  if (
    /\bfour[\s-]?wheel\s+drive\b/i.test(message) &&
    !hasClearFourWheelDrivingServiceCue(message)
  ) {
    return true;
  }
  return false;
}

const EXPLICIT_FOUR_WHEEL_DRIVING_REQUEST_CUES: readonly RegExp[] = [
  new RegExp(
    String.raw`\b(?:book|find|search|need|want|include|add|show(?:\s+me)?|recommend(?:\s+me)?|go)\s+(?:me\s+)?(?:a\s+|the\s+|some\s+)?(?:best\s+|beginner(?:[\s-]?friendly)?\s+|family(?:[\s-]?friendly)?\s+)?${FOUR_WHEEL_DRIVING_SERVICE_PHRASE}\b`,
    'i',
  ),
  new RegExp(
    String.raw`\bi\s+(?:need|want)\s+(?:a\s+|the\s+|some\s+)?${FOUR_WHEEL_DRIVING_SERVICE_PHRASE}\b`,
    'i',
  ),
  /\b(?:find|search|show(?:\s+me)?|recommend(?:\s+me)?)\s+(?:\w+[\s-]*){0,4}?places\s+to\s+go\s+off[\s-]?road\b/i,
  /\b4wd\s+recommendations?\b/i,
  /\b4wd\s+options?\b/i,
  /\bbest\s+4wd\s+tracks?\b/i,
  /\bnearby\s+(?:4wd|4x4|four[\s-]?wheel(?:\s+drive)?|off[\s-]?road)\s+tracks?\b/i,
  /\b(?:4wd|4x4|four[\s-]?wheel(?:\s+drive)?|off[\s-]?road)\s+tracks?\s+near\s+me\b/i,
  /\bplaces\s+to\s+go\s+four[\s-]?wheel\s+driving\b/i,
  /\bwhere\s+can\s+i\s+go\s+4wding\b/i,
  /\bfour[\s-]?wheel\s+driving\b/i,
  /\b4[\s-]?wheel\s+driving\b/i,
  /\b4wding\b/i,
  /\boff[\s-]?road\s+driving\b/i,
  /\bfour[\s-]?wheel\s+drive\s+tracks?\b/i,
  /\b4wd\s+tracks?\b/i,
  /\b4x4\s+tracks?\b/i,
  /\boff[\s-]?road\s+tracks?\b/i,
  /\b4wd\b/i,
  /\b4x4\b/i,
];

function hasExplicitFourWheelDrivingRequest(message: string): boolean {
  const text = edgeTrim(message);
  if (text.length === 0) {
    return false;
  }
  if (isBlockedFourWheelDrivingRequestMessage(text)) {
    return false;
  }
  for (const cue of EXPLICIT_FOUR_WHEEL_DRIVING_REQUEST_CUES) {
    if (cue.test(text)) {
      return true;
    }
  }
  return false;
}
