import type {
  ConversationStateExtractionInput,
  ConversationStateExtractionResult,
  ConversationStateExtractor,
} from './types';

/**
 * Internal snow-activities-requested extraction boundary.
 *
 * Phase 7T: recognises only narrow, explicit snow-activities requests in the
 * current message. Deterministic and local — emits only true, never false or
 * null, and ignores prior conversation state.
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

function hasSnowActivitiesCue(message: string): boolean {
  return /\bsnow\s+activit(?:y|ies)\b/i.test(message);
}

function isBlockedSnowActivitiesRequestMessage(message: string): boolean {
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
    /\bno\s+snow\s+activit(?:y|ies)\b/i.test(message) ||
    /\bnot\b/i.test(message) ||
    /\bwithout\b/i.test(message)
  ) {
    return true;
  }
  if (
    /\b(?:skiing|snowboarding|tobogganing|sledding|snow\s+resorts?|snow\s+fields?|snowfield|snowfields|ski(?:ing)?|snowboard(?:ing)?)\b/i.test(
      message,
    ) &&
    !hasSnowActivitiesCue(message)
  ) {
    return true;
  }
  if (/\bsnow\b/i.test(message) && !hasSnowActivitiesCue(message)) {
    return true;
  }
  if (
    /\b(?:family(?:[\s-]?friendly)?|guided|beginner[\s-]?friendly|alpine|winter|indoor|outdoor|kids?)\s+snow\s+activit(?:y|ies)\b/i.test(
      message,
    ) ||
    /\bsnow\s+activit(?:y|ies)\s+(?:near|nearby|in|around|by|for|at|options|tours?|list)\b/i.test(
      message,
    ) ||
    /\bnearby\s+snow\s+activit(?:y|ies)\b/i.test(message)
  ) {
    return true;
  }
  return false;
}

const EXPLICIT_SNOW_ACTIVITIES_REQUEST_CUES: readonly RegExp[] = [
  /\b(?:book|need|include|add|show|find)\s+(?:me\s+)?(?:some\s+|a\s+)?snow\s+activit(?:y|ies)\b/i,
  /\bi\s+need\s+snow\s+activit(?:y|ies)\b/i,
  /\bsnow\s+activit(?:y|ies)\b/i,
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
