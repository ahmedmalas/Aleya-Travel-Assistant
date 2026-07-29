import type {
  ConversationStateExtractionInput,
  ConversationStateExtractionResult,
  ConversationStateExtractor,
} from './types';

/**
 * Internal kayaking-requested extraction boundary.
 *
 * Phase 7P: recognises only narrow, explicit kayaking-service requests in the
 * current message. Deterministic and local — emits only true, never false or
 * null, and ignores prior conversation state.
 */
export class KayakingRequestedConversationStateExtractor
  implements ConversationStateExtractor
{
  extract(
    input: ConversationStateExtractionInput,
  ): ConversationStateExtractionResult {
    if (!hasExplicitKayakingRequest(input.message)) {
      return {
        stateUpdate: {},
      };
    }
    return {
      stateUpdate: {
        kayakingRequested: true,
      },
    };
  }
}

/** Trim edges without String.prototype.trim (architecture boundary). */
function edgeTrim(value: string): string {
  return value.replace(/^\s+|\s+$/g, '');
}

function isBlockedKayakingRequestMessage(message: string): boolean {
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
    /\bno\s+kayaking\b/i.test(message) ||
    /\bnot\b/i.test(message)
  ) {
    return true;
  }
  if (
    /\b(?:kayak|kayaks|canoe|canoes|paddle|paddling|paddleboard|rafting|sup|stand[\s-]?up)\b/i.test(
      message,
    ) &&
    !/\bkayaking\b/i.test(message)
  ) {
    return true;
  }
  if (
    /\b(?:ocean|harbour|harbor|river|lake|bay|mangrove|estuary|white[\s-]?water|calm[\s-]?water|guided|beginner[\s-]?friendly|family[\s-]?friendly)\s+kayaking\b/i.test(
      message,
    ) ||
    /\bkayaking\s+(?:on|in|through|near|tours?|options)\b/i.test(message)
  ) {
    return true;
  }
  return false;
}

const EXPLICIT_KAYAKING_REQUEST_CUES: readonly RegExp[] = [
  /\b(?:book|need|include|add|show|find)\s+(?:me\s+)?(?:some\s+|a\s+)?kayaking\b/i,
  /\bi\s+need\s+kayaking\b/i,
  /\bkayaking\b/i,
];

function hasExplicitKayakingRequest(message: string): boolean {
  const text = edgeTrim(message);
  if (text.length === 0) {
    return false;
  }
  if (isBlockedKayakingRequestMessage(text)) {
    return false;
  }
  for (const cue of EXPLICIT_KAYAKING_REQUEST_CUES) {
    if (cue.test(text)) {
      return true;
    }
  }
  return false;
}
