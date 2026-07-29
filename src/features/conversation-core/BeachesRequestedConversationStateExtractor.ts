import type {
  ConversationStateExtractionInput,
  ConversationStateExtractionResult,
  ConversationStateExtractor,
} from './types';

/**
 * Internal beaches-requested extraction boundary.
 *
 * Phase 7N: recognises only narrow, explicit beaches-service requests in the
 * current message. Deterministic and local — emits only true, never false or
 * null, and ignores prior conversation state.
 */
export class BeachesRequestedConversationStateExtractor
  implements ConversationStateExtractor
{
  extract(
    input: ConversationStateExtractionInput,
  ): ConversationStateExtractionResult {
    if (!hasExplicitBeachesRequest(input.message)) {
      return {
        stateUpdate: {},
      };
    }
    return {
      stateUpdate: {
        beachesRequested: true,
      },
    };
  }
}

/** Trim edges without String.prototype.trim (architecture boundary). */
function edgeTrim(value: string): string {
  return value.replace(/^\s+|\s+$/g, '');
}

function isBlockedBeachesRequestMessage(message: string): boolean {
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
    /\bno\s+beaches?\b/i.test(message) ||
    /\bnot\b/i.test(message)
  ) {
    return true;
  }
  if (
    /\b(?:coast|seaside|ocean|swim|swimming|snorkel|snorkelling|waterfront|bay|bays|cove|coves|lagoon|lagoons|surf)\b/i.test(
      message,
    ) &&
    !/\bbeach(?:es)?\b/i.test(message)
  ) {
    return true;
  }
  if (
    /\b(?:family[\s-]?friendly|surf|ocean|quiet|secluded|best)\s+beach(?:es)?\b/i.test(
      message,
    )
  ) {
    return true;
  }
  if (
    /\b(?:bondi|manly|coogee|bronte|burleigh|noosa|surfer'?s?\s+paradise|whitehaven|cable\s+beach)\b/i.test(
      message,
    ) &&
    !/\b(?:book|need|include|add|show|find)\s+(?:me\s+)?(?:the\s+)?beach(?:es)?\b/i.test(
      message,
    ) &&
    !/\bi\s+need\s+beach(?:es)?\b/i.test(message) &&
    !/^beach(?:es)?$/i.test(edgeTrim(message))
  ) {
    return true;
  }
  return false;
}

const EXPLICIT_BEACHES_REQUEST_CUES: readonly RegExp[] = [
  /\b(?:book|need|include|add|show|find)\s+(?:me\s+)?(?:the\s+)?beach(?:es)?\b/i,
  /\bi\s+need\s+beach(?:es)?\b/i,
  /\bbeach(?:es)?\b/i,
];

function hasExplicitBeachesRequest(message: string): boolean {
  const text = edgeTrim(message);
  if (text.length === 0) {
    return false;
  }
  if (isBlockedBeachesRequestMessage(text)) {
    return false;
  }
  for (const cue of EXPLICIT_BEACHES_REQUEST_CUES) {
    if (cue.test(text)) {
      return true;
    }
  }
  return false;
}
