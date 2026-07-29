import type {
  ConversationStateExtractionInput,
  ConversationStateExtractionResult,
  ConversationStateExtractor,
} from '../types';

/**
 * Internal hiking/walking-requested extraction boundary.
 *
 * Phase 7U: recognises only narrow, explicit hiking/walking requests in the
 * current message. Deterministic and local — emits only true, never false or
 * null, and ignores prior conversation state.
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

function isBlockedHikingWalkingRequestMessage(message: string): boolean {
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
    /\bno\s+(?:hiking|walking|hiking\s+and\s+walking)\b/i.test(message) ||
    /\bnot\b/i.test(message) ||
    /\bwithout\b/i.test(message)
  ) {
    return true;
  }
  if (
    /\b(?:walkable|walking\s+directions?|walking\s+distance|bushwalking|trekking|trek|hike|hikes|trails?|track|tracks)\b/i.test(
      message,
    ) &&
    !/\bhiking\b/i.test(message) &&
    !/\bwalking\b/i.test(message)
  ) {
    return true;
  }
  if (
    /\b(?:walkable|walking\s+directions?|walking\s+distance)\b/i.test(message)
  ) {
    return true;
  }
  if (
    /\b(?:easy|guided|beginner[\s-]?friendly|family(?:[\s-]?friendly)?|coastal|mountain|forest|day|multi[\s-]?day|scenic|remote)\s+(?:hiking|walking)\b/i.test(
      message,
    ) ||
    /\b(?:hiking|walking)\s+(?:trails?|tracks?|routes?|paths?|tours?|options|near|nearby|in|around|by|for|to|along|through)\b/i.test(
      message,
    ) ||
    /\bnearby\s+(?:hiking|walking)\b/i.test(message)
  ) {
    return true;
  }
  return false;
}

const EXPLICIT_HIKING_WALKING_REQUEST_CUES: readonly RegExp[] = [
  /\b(?:book|need|include|add|show|find)\s+(?:me\s+)?(?:some\s+|a\s+)?(?:hiking\s+and\s+walking|hiking|walking)\b/i,
  /\bi\s+need\s+(?:hiking\s+and\s+walking|hiking|walking)\b/i,
  /\bhiking\s+and\s+walking\b/i,
  /\bhiking\b/i,
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
