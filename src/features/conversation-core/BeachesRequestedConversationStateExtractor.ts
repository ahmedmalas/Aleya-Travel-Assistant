import type {
  ConversationStateExtractionInput,
  ConversationStateExtractionResult,
  ConversationStateExtractor,
} from './types';

/**
 * Internal beaches-requested extraction boundary.
 *
 * Phase 7N: recognises only narrow, explicit beaches-service requests in the
 * current message. Phase 8N extends clear beach-discovery request cues only.
 * Deterministic and local — emits only true, never false or null, and ignores
 * prior conversation state.
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

const BEACH_SERVICE_PHRASE = String.raw`(?:beaches|beach)`;

function hasActionBeachesServiceCue(message: string): boolean {
  return (
    new RegExp(
      String.raw`\b(?:book|find|search|need|want|include|add|show\s+me|recommend|compare)\s+(?:me\s+)?(?:a\s+|the\s+|some\s+)?(?:best\s+)?${BEACH_SERVICE_PHRASE}\b`,
      'i',
    ).test(message) ||
    new RegExp(
      String.raw`\bi\s+(?:need|want)\s+(?:a\s+|the\s+|some\s+)?${BEACH_SERVICE_PHRASE}\b`,
      'i',
    ).test(message) ||
    /\bbeach\s+(?:recommendations|options)\b/i.test(message) ||
    /\bbest\s+beaches\b/i.test(message) ||
    /\bnearby\s+beaches\b/i.test(message) ||
    /\bbeaches\s+near\s+me\b/i.test(message) ||
    /\bplaces\s+to\s+swim\b/i.test(message) ||
    /\bwhere\s+can\s+i\s+swim\b/i.test(message)
  );
}

function hasClearBeachesServiceCue(message: string): boolean {
  return (
    hasActionBeachesServiceCue(message) ||
    new RegExp(String.raw`\b${BEACH_SERVICE_PHRASE}\b`, 'i').test(message) ||
    new RegExp(String.raw`^${BEACH_SERVICE_PHRASE}$`, 'i').test(
      edgeTrim(message),
    )
  );
}

function isBlockedBeachesRequestMessage(message: string): boolean {
  if (/\?/.test(message)) {
    return true;
  }
  if (/\bwhat\s+(?:is|are)\b/i.test(message)) {
    return true;
  }
  if (/\bkeep\b/i.test(message) || /\bforget\b/i.test(message)) {
    return true;
  }
  if (
    /\bremove\b/i.test(message) ||
    /\bcancel\b/i.test(message) ||
    /\bavoid\b/i.test(message)
  ) {
    return true;
  }
  if (/\binstead\b/i.test(message) || /\bactually\b/i.test(message)) {
    return true;
  }
  if (
    /\b(?:do\s+not|don't)\b/i.test(message) ||
    new RegExp(
      String.raw`\bno\s+(?:a\s+|the\s+|some\s+)?(?:${BEACH_SERVICE_PHRASE}|beach\s+recommendations)\b`,
      'i',
    ).test(message) ||
    new RegExp(
      String.raw`\bwithout\s+(?:a\s+|the\s+|some\s+)?(?:${BEACH_SERVICE_PHRASE}|beach\s+recommendations)\b`,
      'i',
    ).test(message) ||
    /\bnot\b/i.test(message)
  ) {
    return true;
  }
  if (
    /\b(?:hotel|stay|staying)\s+(?:near|by|at)\s+(?:the\s+)?beach\b/i.test(
      message,
    ) ||
    /\bbeachfront(?:\s+hotel)?\b/i.test(message) ||
    /\bbeach\s+(?:address|weather|conditions|warning|closure|towel|bag|house|wedding)\b/i.test(
      message,
    )
  ) {
    return true;
  }
  if (
    /\b(?:the\s+)?beach\s+was\s+crowded\b/i.test(message) ||
    /\b(?:we\s+)?visited\s+(?:the\s+)?beach\b/i.test(message)
  ) {
    return true;
  }
  if (
    /\b(?:bondi|manly|coogee|bronte|burleigh|noosa|whitehaven|cable)\s+beach\b/i.test(
      message,
    ) ||
    /\bsurfer'?s?\s+paradise\s+beach\b/i.test(message)
  ) {
    return true;
  }
  if (
    /\b(?:coast|seaside|ocean|swim|swimming|snorkel|snorkelling|waterfront|bay|bays|cove|coves|lagoon|lagoons|surf)\b/i.test(
      message,
    ) &&
    !hasClearBeachesServiceCue(message)
  ) {
    return true;
  }
  if (
    /\b(?:family[\s-]?friendly|surf|ocean|quiet|secluded)\s+beach(?:es)?\b/i.test(
      message,
    )
  ) {
    return true;
  }
  if (
    /\b(?:bondi|manly|coogee|bronte|burleigh|noosa|surfer'?s?\s+paradise|whitehaven|cable\s+beach)\b/i.test(
      message,
    ) &&
    !hasActionBeachesServiceCue(message)
  ) {
    return true;
  }
  return false;
}

const EXPLICIT_BEACHES_REQUEST_CUES: readonly RegExp[] = [
  new RegExp(
    String.raw`\b(?:book|find|search|need|want|include|add|show\s+me|recommend|compare)\s+(?:me\s+)?(?:a\s+|the\s+|some\s+)?(?:best\s+)?${BEACH_SERVICE_PHRASE}\b`,
    'i',
  ),
  new RegExp(
    String.raw`\bi\s+(?:need|want)\s+(?:a\s+|the\s+|some\s+)?${BEACH_SERVICE_PHRASE}\b`,
    'i',
  ),
  /\bbeach\s+(?:recommendations|options)\b/i,
  /\bbest\s+beaches\b/i,
  /\bnearby\s+beaches\b/i,
  /\bbeaches\s+near\s+me\b/i,
  /\bplaces\s+to\s+swim\b/i,
  /\bwhere\s+can\s+i\s+swim\b/i,
  /\bbeaches\b/i,
  /\bbeach\b/i,
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
