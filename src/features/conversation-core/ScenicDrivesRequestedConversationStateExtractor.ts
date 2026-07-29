import type {
  ConversationStateExtractionInput,
  ConversationStateExtractionResult,
  ConversationStateExtractor,
} from './types';

/**
 * Internal scenic-drives-requested extraction boundary.
 *
 * Phase 7R: recognises only narrow, explicit scenic-drive requests in the
 * current message. Deterministic and local — emits only true, never false or
 * null, and ignores prior conversation state.
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

function hasScenicDriveCue(message: string): boolean {
  return /\bscenic\s+drives?\b/i.test(message);
}

function isBlockedScenicDrivesRequestMessage(message: string): boolean {
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
    /\bno\s+scenic\s+drives?\b/i.test(message) ||
    /\bnot\b/i.test(message) ||
    /\bwithout\b/i.test(message)
  ) {
    return true;
  }
  if (
    /\b(?:driving|road[\s-]?trip|roadtrip|route|routes|lookout)\b/i.test(
      message,
    ) &&
    !hasScenicDriveCue(message)
  ) {
    return true;
  }
  if (
    /\b(?:coastal|mountain|country|easy|guided|beginner[\s-]?friendly|family(?:[\s-]?friendly)?|remote|sunset|waterfall)\s+scenic\s+drives?\b/i.test(
      message,
    ) ||
    /\b(?:coastal|mountain|country)\s+drives?\b/i.test(message) ||
    /\bscenic\s+drives?\s+(?:near|nearby|along|through|to|on|around|by|routes?|options|tours?)\b/i.test(
      message,
    ) ||
    /\bnearby\s+scenic\s+drives?\b/i.test(message)
  ) {
    return true;
  }
  return false;
}

const EXPLICIT_SCENIC_DRIVES_REQUEST_CUES: readonly RegExp[] = [
  /\b(?:book|need|include|add|show|find)\s+(?:me\s+)?(?:some\s+|a\s+)?scenic\s+drives?\b/i,
  /\bi\s+need\s+scenic\s+drives?\b/i,
  /\bscenic\s+drives?\b/i,
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
