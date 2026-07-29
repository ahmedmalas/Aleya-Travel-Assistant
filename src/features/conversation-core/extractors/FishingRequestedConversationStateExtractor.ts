import type {
  ConversationStateExtractionInput,
  ConversationStateExtractionResult,
  ConversationStateExtractor,
} from '../types';

/**
 * Internal fishing-requested extraction boundary.
 *
 * Phase 7V: recognises only narrow, explicit fishing requests in the current
 * message. Deterministic and local — emits only true, never false or null,
 * and ignores prior conversation state.
 */
export class FishingRequestedConversationStateExtractor
  implements ConversationStateExtractor
{
  extract(
    input: ConversationStateExtractionInput,
  ): ConversationStateExtractionResult {
    if (!hasExplicitFishingRequest(input.message)) {
      return {
        stateUpdate: {},
      };
    }
    return {
      stateUpdate: {
        fishingRequested: true,
      },
    };
  }
}

/** Trim edges without String.prototype.trim (architecture boundary). */
function edgeTrim(value: string): string {
  return value.replace(/^\s+|\s+$/g, '');
}

function hasFishingCue(message: string): boolean {
  return /\bfishing\b/i.test(message);
}

function isBlockedFishingRequestMessage(message: string): boolean {
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
    /\bno\s+fishing\b/i.test(message) ||
    /\bnot\b/i.test(message) ||
    /\bwithout\b/i.test(message)
  ) {
    return true;
  }
  if (
    /\b(?:fish|seafood|charters?|boats?|tackle|rod|rods|bait|equipment)\b/i.test(
      message,
    ) &&
    !hasFishingCue(message)
  ) {
    return true;
  }
  if (
    /\b(?:deep[\s-]?sea|fly|spear|ice|rock|shore|boat|charter|guided|family(?:[\s-]?friendly)?|beginner[\s-]?friendly|sport)\s+fishing\b/i.test(
      message,
    ) ||
    /\bfishing\s+(?:charters?|boats?|spots?|locations?|trips?|tours?|options|tackle|equipment|near|nearby|in|around|by|for|at|to)\b/i.test(
      message,
    ) ||
    /\bnearby\s+fishing\b/i.test(message)
  ) {
    return true;
  }
  return false;
}

const EXPLICIT_FISHING_REQUEST_CUES: readonly RegExp[] = [
  /\b(?:book|need|include|add|show|find)\s+(?:me\s+)?(?:some\s+|a\s+)?fishing\b/i,
  /\bi\s+need\s+fishing\b/i,
  /\bfishing\b/i,
];

function hasExplicitFishingRequest(message: string): boolean {
  const text = edgeTrim(message);
  if (text.length === 0) {
    return false;
  }
  if (isBlockedFishingRequestMessage(text)) {
    return false;
  }
  for (const cue of EXPLICIT_FISHING_REQUEST_CUES) {
    if (cue.test(text)) {
      return true;
    }
  }
  return false;
}
