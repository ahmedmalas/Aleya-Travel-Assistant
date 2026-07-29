import type {
  ConversationStateExtractionInput,
  ConversationStateExtractionResult,
  ConversationStateExtractor,
} from './types';

/**
 * Internal camping-requested extraction boundary.
 *
 * Phase 7O: recognises only narrow, explicit camping-service requests in the
 * current message. Deterministic and local — emits only true, never false or
 * null, and ignores prior conversation state.
 */
export class CampingRequestedConversationStateExtractor
  implements ConversationStateExtractor
{
  extract(
    input: ConversationStateExtractionInput,
  ): ConversationStateExtractionResult {
    if (!hasExplicitCampingRequest(input.message)) {
      return {
        stateUpdate: {},
      };
    }
    return {
      stateUpdate: {
        campingRequested: true,
      },
    };
  }
}

/** Trim edges without String.prototype.trim (architecture boundary). */
function edgeTrim(value: string): string {
  return value.replace(/^\s+|\s+$/g, '');
}

function isBlockedCampingRequestMessage(message: string): boolean {
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
    /\bno\s+camping\b/i.test(message) ||
    /\bnot\b/i.test(message)
  ) {
    return true;
  }
  if (
    /\b(?:campsite|campsites|campground|campgrounds|caravan|caravans|tent|tents|glamping|swag|campfire|holiday\s+park|powered\s+site|unpowered\s+site)\b/i.test(
      message,
    ) &&
    !/\bcamping\b/i.test(message)
  ) {
    return true;
  }
  if (
    /\b(?:family[\s-]?friendly|dog[\s-]?friendly|bush|free|remote|cabin|cabins)\s+camping\b/i.test(
      message,
    ) ||
    /\bcamping\s+(?:cabins?|options)\b/i.test(message)
  ) {
    return true;
  }
  return false;
}

const EXPLICIT_CAMPING_REQUEST_CUES: readonly RegExp[] = [
  /\b(?:book|need|include|add|show|find)\s+(?:me\s+)?(?:some\s+|a\s+)?camping\b/i,
  /\bi\s+need\s+camping\b/i,
  /\bcamping\b/i,
];

function hasExplicitCampingRequest(message: string): boolean {
  const text = edgeTrim(message);
  if (text.length === 0) {
    return false;
  }
  if (isBlockedCampingRequestMessage(text)) {
    return false;
  }
  for (const cue of EXPLICIT_CAMPING_REQUEST_CUES) {
    if (cue.test(text)) {
      return true;
    }
  }
  return false;
}
