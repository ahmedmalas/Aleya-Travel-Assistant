import type {
  ConversationStateExtractionInput,
  ConversationStateExtractionResult,
  ConversationStateExtractor,
} from './types';

/**
 * Internal nearby-discovery-requested extraction boundary.
 *
 * Phase 7M: recognises only narrow, explicit nearby-discovery requests in the
 * current message. Deterministic and local — emits only true, never false or
 * null, and ignores prior conversation state.
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

function isBlockedNearbyDiscoveryRequestMessage(message: string): boolean {
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
    /\bno\s+nearby\b/i.test(message) ||
    /\bnot\b/i.test(message)
  ) {
    return true;
  }
  if (
    /\bnear(?:er|est)\b/i.test(message) ||
    /\bnear\s+(?!me\b)/i.test(message)
  ) {
    return true;
  }
  return false;
}

const EXPLICIT_NEARBY_DISCOVERY_REQUEST_CUES: readonly RegExp[] = [
  /\b(?:show|find)\s+(?:me\s+)?nearby\b/i,
  /\bwhat'?s\s+nearby\b/i,
  /\bwhat\s+is\s+nearby\b/i,
  /\bthings\s+nearby\b/i,
  /\bnearby\s+attractions\b/i,
  /\bnear\s+me\b/i,
  /\bnearby\b/i,
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
