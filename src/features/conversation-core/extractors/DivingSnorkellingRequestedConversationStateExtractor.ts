import type {
  ConversationStateExtractionInput,
  ConversationStateExtractionResult,
  ConversationStateExtractor,
} from '../types';

/**
 * Internal diving/snorkelling-requested extraction boundary.
 *
 * Phase 7W: recognises only narrow, explicit diving/snorkelling requests in the
 * current message. Deterministic and local — emits only true, never false or
 * null, and ignores prior conversation state.
 */
export class DivingSnorkellingRequestedConversationStateExtractor
  implements ConversationStateExtractor
{
  extract(
    input: ConversationStateExtractionInput,
  ): ConversationStateExtractionResult {
    if (!hasExplicitDivingSnorkellingRequest(input.message)) {
      return {
        stateUpdate: {},
      };
    }
    return {
      stateUpdate: {
        divingSnorkellingRequested: true,
      },
    };
  }
}

/** Trim edges without String.prototype.trim (architecture boundary). */
function edgeTrim(value: string): string {
  return value.replace(/^\s+|\s+$/g, '');
}

function hasDivingCue(message: string): boolean {
  return /\bdiving\b/i.test(message);
}

function hasSnorkellingCue(message: string): boolean {
  return /\bsnorkelling\b/i.test(message);
}

function hasDivingOrSnorkellingCue(message: string): boolean {
  return hasDivingCue(message) || hasSnorkellingCue(message);
}

function isBlockedDivingSnorkellingRequestMessage(message: string): boolean {
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
    /\bno\s+(?:diving|snorkelling)\b/i.test(message) ||
    /\bnot\b/i.test(message) ||
    /\bwithout\b/i.test(message)
  ) {
    return true;
  }
  if (
    /\b(?:dive|snorkel|scuba|boats?|gear|equipment|mask|fins?|wetsuit)\b/i.test(
      message,
    ) &&
    !hasDivingOrSnorkellingCue(message)
  ) {
    return true;
  }
  if (
    /\b(?:scuba|reef|free|wreck|cave|shore|boat|night|guided|deep[\s-]?sea|family(?:[\s-]?friendly)?|beginner[\s-]?friendly)\s+diving\b/i.test(
      message,
    ) ||
    /\b(?:reef|guided|boat|family(?:[\s-]?friendly)?|beginner[\s-]?friendly)\s+snorkelling\b/i.test(
      message,
    ) ||
    /\b(?:diving|snorkelling)\s+(?:spots?|sites?|locations?|trips?|tours?|options|gear|equipment|boats?|near|nearby|in|around|by|for|at|to)\b/i.test(
      message,
    ) ||
    /\bnearby\s+(?:diving|snorkelling)\b/i.test(message)
  ) {
    return true;
  }
  return false;
}

const EXPLICIT_DIVING_SNORKELLING_REQUEST_CUES: readonly RegExp[] = [
  /\b(?:book|need|include|add|show|find)\s+(?:me\s+)?(?:some\s+|a\s+)?(?:diving|snorkelling)\b/i,
  /\bi\s+need\s+(?:diving|snorkelling)\b/i,
  /\bdiving\s+and\s+snorkelling\b/i,
  /\bsnorkelling\s+and\s+diving\b/i,
  /\bdiving\b/i,
  /\bsnorkelling\b/i,
];

function hasExplicitDivingSnorkellingRequest(message: string): boolean {
  const text = edgeTrim(message);
  if (text.length === 0) {
    return false;
  }
  if (isBlockedDivingSnorkellingRequestMessage(text)) {
    return false;
  }
  for (const cue of EXPLICIT_DIVING_SNORKELLING_REQUEST_CUES) {
    if (cue.test(text)) {
      return true;
    }
  }
  return false;
}
