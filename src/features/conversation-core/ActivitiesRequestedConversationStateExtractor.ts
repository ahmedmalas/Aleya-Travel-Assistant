import type {
  ConversationStateExtractionInput,
  ConversationStateExtractionResult,
  ConversationStateExtractor,
} from './types';

/**
 * Internal activities-requested extraction boundary.
 *
 * Phase 7K: recognises only narrow, explicit activities-service requests in the
 * current message. Deterministic and local — emits only true, never false or
 * null, and ignores prior conversation state.
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

function isBlockedActivitiesRequestMessage(message: string): boolean {
  if (/\?/.test(message)) {
    return true;
  }
  if (/\bkeep\b/i.test(message) || /\bforget\b/i.test(message)) {
    return true;
  }
  if (/\bremove\b/i.test(message)) {
    return true;
  }
  if (/\binstead\b/i.test(message) || /\bactually\b/i.test(message)) {
    return true;
  }
  if (
    /\b(?:do\s+not|don't)\b/i.test(message) ||
    /\bno\s+activities\b/i.test(message) ||
    /\bnot\b/i.test(message)
  ) {
    return true;
  }
  if (
    /\b(?:tour|tours|attraction|attractions|adventure|adventures|sightseeing|entertainment|leisure|recreation|excursion|excursions|experience|experiences|opera|museum|theme\s+park)\b/i.test(
      message,
    )
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
    /\b(?:show\s+me|find|look\s+for|want)\s+(?:some\s+|an?\s+)?(?:activities|things\s+to\s+do)\b/i.test(
      message,
    ) &&
    !/\b(?:book|need|include|add)\s+activities\b/i.test(message) &&
    !/\bi\s+need\s+activities\b/i.test(message) &&
    !/^(?:activities|things\s+to\s+do)$/i.test(edgeTrim(message))
  ) {
    return true;
  }
  return false;
}

const EXPLICIT_ACTIVITIES_REQUEST_CUES: readonly RegExp[] = [
  /\b(?:book|need|include|add)\s+activities\b/i,
  /\bi\s+need\s+activities\b/i,
  /\bactivities\b/i,
  /\bthings\s+to\s+do\b/i,
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
