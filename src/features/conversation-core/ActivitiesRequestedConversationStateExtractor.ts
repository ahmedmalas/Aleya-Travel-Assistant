import type {
  ConversationStateExtractionInput,
  ConversationStateExtractionResult,
  ConversationStateExtractor,
} from './types';

/**
 * Internal activities-requested extraction boundary.
 *
 * Phase 7K: recognises only narrow, explicit activities-service requests in the
 * current message. Phase 8K extends clear general activity-service request cues
 * only. Deterministic and local — emits only true, never false or null, and
 * ignores prior conversation state.
 */
export class ActivitiesRequestedConversationStateExtractor
  implements ConversationStateExtractor
{
  extract(
    input: ConversationStateExtractionInput,
  ): ConversationStateExtractionResult {
    if (!hasExplicitActivitiesRequest(input.message)) {
      return {
        stateUpdate: {},
      };
    }
    return {
      stateUpdate: {
        activitiesRequested: true,
      },
    };
  }
}

/** Trim edges without String.prototype.trim (architecture boundary). */
function edgeTrim(value: string): string {
  return value.replace(/^\s+|\s+$/g, '');
}

const ACTIVITY_SERVICE_PHRASE =
  String.raw`(?:activities|activity|things\s+to\s+do|what\s+to\s+do|tours?|attractions?|(?:local\s+)?experiences?)`;

function hasClearActivitiesServiceCue(message: string): boolean {
  return (
    new RegExp(
      String.raw`\b(?:book|find|search|need|want|include|add|show\s+me|compare)\s+(?:me\s+)?(?:a\s+|the\s+|some\s+)?${ACTIVITY_SERVICE_PHRASE}\b`,
      'i',
    ).test(message) ||
    new RegExp(
      String.raw`\bi\s+(?:need|want)\s+(?:a\s+|the\s+|some\s+)?${ACTIVITY_SERVICE_PHRASE}\b`,
      'i',
    ).test(message) ||
    /\bactivity\s+options\b/i.test(message) ||
    new RegExp(String.raw`\b${ACTIVITY_SERVICE_PHRASE}\b`, 'i').test(message) ||
    new RegExp(String.raw`^${ACTIVITY_SERVICE_PHRASE}$`, 'i').test(
      edgeTrim(message),
    )
  );
}

function isBlockedActivitiesRequestMessage(message: string): boolean {
  if (/\?/.test(message)) {
    return true;
  }
  if (/\bwhat\s+(?:is|are)\b/i.test(message)) {
    return true;
  }
  if (/\bkeep\b/i.test(message) || /\bforget\b/i.test(message)) {
    return true;
  }
  if (/\bremove\b/i.test(message) || /\bcancel\b/i.test(message)) {
    return true;
  }
  if (/\binstead\b/i.test(message) || /\bactually\b/i.test(message)) {
    return true;
  }
  if (
    /\b(?:do\s+not|don't)\b/i.test(message) ||
    new RegExp(
      String.raw`\bno\s+(?:a\s+|the\s+|some\s+)?${ACTIVITY_SERVICE_PHRASE}\b`,
      'i',
    ).test(message) ||
    new RegExp(
      String.raw`\bwithout\s+(?:a\s+|the\s+|some\s+)?${ACTIVITY_SERVICE_PHRASE}\b`,
      'i',
    ).test(message) ||
    /\bnot\b/i.test(message)
  ) {
    return true;
  }
  if (
    /\b(?:physical|daily|account|recent|business)\s+activity\b/i.test(
      message,
    ) ||
    /\bactivity\s+log\b/i.test(message)
  ) {
    return true;
  }
  if (
    /\btour\s+(?:operator|bus|guide)s?\b/i.test(message) ||
    /\btourism\b/i.test(message)
  ) {
    return true;
  }
  if (
    /\battraction\s+(?:address|opening\s+hours|ticket\s+already\s+booked)\b/i.test(
      message,
    ) ||
    /\b(?:we\s+)?visited\s+(?:the\s+)?attraction\b/i.test(message) ||
    /\b(?:the\s+)?tour\s+was\s+cancelled\b/i.test(message) ||
    /\battraction\s+ticket\s+already\s+booked\b/i.test(message)
  ) {
    return true;
  }
  if (
    /\b(?:tourist|top|best|local|popular|family(?:[\s-]?friendly)?|guided|indoor|outdoor|historic|cultural)\s+attractions?\b/i.test(
      message,
    ) ||
    /\battractions?\s+(?:near|nearby|in|around|by|for|to|options|tours?|list)\b/i.test(
      message,
    ) ||
    /\bnearby\s+attractions?\b/i.test(message)
  ) {
    return true;
  }
  if (/\b(?:wine|food)\s+tours?\b/i.test(message)) {
    return true;
  }
  if (
    /\bthings\s+are\s+busy\b/i.test(message) ||
    /\bwhat\s+should\s+i\s+do\b/i.test(message) ||
    /\bwhat\s+do\s+you\s+need\b/i.test(message)
  ) {
    return true;
  }
  if (
    /\b(?:family|outdoor|leisure|recreation|snow|alpine|paddling|water|kids?|children'?s?|kid[\s-]?friendly|family[\s-]?friendly)\s+activities\b/i.test(
      message,
    )
  ) {
    return true;
  }
  if (
    /\b(?:adventure|adventures|sightseeing|entertainment|leisure|recreation|excursion|excursions|opera|museum|theme\s+park)\b/i.test(
      message,
    ) &&
    !hasClearActivitiesServiceCue(message)
  ) {
    return true;
  }
  if (
    /\b(?:restaurants?|nearby\s+places|beaches?|camping|national\s+parks?|hiking|kayaking|4wd|four[\s-]?wheel|scenic\s+drives?)\b/i.test(
      message,
    ) &&
    !hasClearActivitiesServiceCue(message)
  ) {
    return true;
  }
  return false;
}

const EXPLICIT_ACTIVITIES_REQUEST_CUES: readonly RegExp[] = [
  new RegExp(
    String.raw`\b(?:book|find|search|need|want|include|add|show\s+me|compare)\s+(?:me\s+)?(?:a\s+|the\s+|some\s+)?${ACTIVITY_SERVICE_PHRASE}\b`,
    'i',
  ),
  new RegExp(
    String.raw`\bi\s+(?:need|want)\s+(?:a\s+|the\s+|some\s+)?${ACTIVITY_SERVICE_PHRASE}\b`,
    'i',
  ),
  /\bactivity\s+options\b/i,
  /\bactivities\b/i,
  /\bactivity\b/i,
  /\bthings\s+to\s+do\b/i,
  /\bwhat\s+to\s+do\b/i,
  /\btours?\b/i,
  /\battractions?\b/i,
  /\blocal\s+experiences\b/i,
  /\bexperiences?\b/i,
];

function hasExplicitActivitiesRequest(message: string): boolean {
  const text = edgeTrim(message);
  if (text.length === 0) {
    return false;
  }
  if (isBlockedActivitiesRequestMessage(text)) {
    return false;
  }
  for (const cue of EXPLICIT_ACTIVITIES_REQUEST_CUES) {
    if (cue.test(text)) {
      return true;
    }
  }
  return false;
}
