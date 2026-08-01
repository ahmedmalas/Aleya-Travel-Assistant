import type {
  ConversationStateExtractionInput,
  ConversationStateExtractionResult,
  ConversationStateExtractor,
} from './types';

/**
 * Internal nearby-discovery-requested extraction boundary.
 *
 * Phase 7M: recognises only narrow, explicit nearby-discovery requests in the
 * current message. Phase 8M extends clear nearby-discovery request cues only.
 * Deterministic and local — emits only true, never false or null, and ignores
 * prior conversation state.
 */
export class NearbyDiscoveryRequestedConversationStateExtractor
  implements ConversationStateExtractor
{
  extract(
    input: ConversationStateExtractionInput,
  ): ConversationStateExtractionResult {
    if (!hasExplicitNearbyDiscoveryRequest(input.message)) {
      return {
        stateUpdate: {},
      };
    }
    return {
      stateUpdate: {
        nearbyDiscoveryRequested: true,
      },
    };
  }
}

/** Trim edges without String.prototype.trim (architecture boundary). */
function edgeTrim(value: string): string {
  return value.replace(/^\s+|\s+$/g, '');
}

function hasClearNearbyDiscoveryCue(message: string): boolean {
  return (
    /\b(?:show|find)\s+(?:me\s+)?nearby(?:\s+places)?\b/i.test(message) ||
    /\b(?:show|find)\s+(?:me\s+)?nearby\s+(?:attractions|activities|restaurants|beaches|places\s+to\s+visit)\b/i.test(
      message,
    ) ||
    /\bwhat'?s\s+nearby\b/i.test(message) ||
    /\bwhat\s+is\s+nearby\b/i.test(message) ||
    /\b(?:places|things)\s+near\s+me\b/i.test(message) ||
    /\bthings\s+nearby\b/i.test(message) ||
    /\bnear\s+me\b/i.test(message) ||
    /\bwhat\s+is\s+around(?:\s+me)?\b/i.test(message) ||
    /\bwhat'?s\s+around\s+here\b/i.test(message) ||
    /\bshow\s+me\s+what\s+is\s+around\b/i.test(message) ||
    /\bnearby\s+(?:attractions|activities|restaurants|beaches|places\s+to\s+visit|places)\b/i.test(
      message,
    ) ||
    /\bplaces\s+close\s+by\b/i.test(message) ||
    /\bwhat\s+is\s+close\s+to\s+me\b/i.test(message) ||
    /\b(?:find|show)\s+(?:me\s+)?places\s+near\b/i.test(message) ||
    /\bi\s+want\s+places\s+close\s+to\b/i.test(message)
  );
}

function isBlockedNearbyDiscoveryRequestMessage(message: string): boolean {
  if (/\?/.test(message)) {
    return true;
  }
  if (/\bwhat\s+does\b/i.test(message)) {
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
    /\bno\s+nearby(?:\s+discovery)?\b/i.test(message) ||
    /\bwithout\s+nearby\b/i.test(message) ||
    /\bnot\b/i.test(message)
  ) {
    return true;
  }
  if (
    /\b(?:hotel|restaurant|stay|staying)\s+(?:near|close\s+to)\b/i.test(
      message,
    ) ||
    /\bnear\s+the\s+(?:airport|beach|hotel|city)\b/i.test(message) ||
    /\bhow\s+far\s+is\b/i.test(message) ||
    /\bclose\s+the\s+booking\b/i.test(message) ||
    /\baround\s+\d+\b/i.test(message) ||
    /\bnear\s+completion\b/i.test(message)
  ) {
    return true;
  }
  if (/\bnear(?:er|est)\b/i.test(message)) {
    return true;
  }
  if (
    /^(?:nearby|close|around)$/i.test(edgeTrim(message)) ||
    (/\b(?:nearby|close|around)\b/i.test(message) &&
      !hasClearNearbyDiscoveryCue(message))
  ) {
    return true;
  }
  return false;
}

const EXPLICIT_NEARBY_DISCOVERY_REQUEST_CUES: readonly RegExp[] = [
  /\b(?:show|find)\s+(?:me\s+)?nearby(?:\s+places)?\b/i,
  /\b(?:show|find)\s+(?:me\s+)?nearby\s+(?:attractions|activities|restaurants|beaches|places\s+to\s+visit)\b/i,
  /\bwhat'?s\s+nearby\b/i,
  /\bwhat\s+is\s+nearby\b/i,
  /\b(?:places|things)\s+near\s+me\b/i,
  /\bthings\s+nearby\b/i,
  /\bnear\s+me\b/i,
  /\bwhat\s+is\s+around(?:\s+me)?\b/i,
  /\bwhat'?s\s+around\s+here\b/i,
  /\bshow\s+me\s+what\s+is\s+around\b/i,
  /\bnearby\s+(?:attractions|activities|restaurants|beaches|places\s+to\s+visit|places)\b/i,
  /\bplaces\s+close\s+by\b/i,
  /\bwhat\s+is\s+close\s+to\s+me\b/i,
  /\b(?:find|show)\s+(?:me\s+)?places\s+near\b/i,
  /\bi\s+want\s+places\s+close\s+to\b/i,
];

function hasExplicitNearbyDiscoveryRequest(message: string): boolean {
  const text = edgeTrim(message);
  if (text.length === 0) {
    return false;
  }
  if (isBlockedNearbyDiscoveryRequestMessage(text)) {
    return false;
  }
  for (const cue of EXPLICIT_NEARBY_DISCOVERY_REQUEST_CUES) {
    if (cue.test(text)) {
      return true;
    }
  }
  return false;
}
