import type {
  ConversationStateExtractionInput,
  ConversationStateExtractionResult,
  ConversationStateExtractor,
} from './types';

/**
 * Internal kayaking-requested extraction boundary.
 *
 * Phase 7P: recognises only narrow, explicit kayaking-service requests in the
 * current message. Phase 8S extends clear kayaking-discovery request cues only.
 * Deterministic and local — emits only true, never false or null, and ignores
 * prior conversation state.
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

const KAYAKING_SERVICE_PHRASE = String.raw`(?:kayaking(?:\s+(?:tours?|activities|experiences))?|kayak(?:s|\s+trips?|\s+tours?|\s+experiences)?|kayaks)`;

function hasActionKayakingServiceCue(message: string): boolean {
  return (
    new RegExp(
      String.raw`\b(?:book|find|search|need|want|include|add|show\s+me|recommend|compare|go)\s+(?:me\s+)?(?:a\s+|the\s+|some\s+)?(?:best\s+|family(?:[\s-]?friendly)?\s+)?${KAYAKING_SERVICE_PHRASE}\b`,
      'i',
    ).test(message) ||
    new RegExp(
      String.raw`\bi\s+(?:need|want)\s+(?:a\s+|the\s+|some\s+)?${KAYAKING_SERVICE_PHRASE}\b`,
      'i',
    ).test(message) ||
    /\bkayaking\s+(?:recommendations|options)\b/i.test(message) ||
    /\bbest\s+(?:kayaking|kayak\s+tours?)\b/i.test(message) ||
    /\bnearby\s+kayaking\b/i.test(message) ||
    /\bkayaking\s+near\s+me\b/i.test(message) ||
    /\bkayak\s+tours?\s+near\s+me\b/i.test(message) ||
    /\bplaces\s+to\s+kayak\b/i.test(message) ||
    /\bwhere\s+can\s+i\s+kayak\b/i.test(message)
  );
}

function hasClearKayakingServiceCue(message: string): boolean {
  return (
    hasActionKayakingServiceCue(message) ||
    new RegExp(String.raw`\b${KAYAKING_SERVICE_PHRASE}\b`, 'i').test(message) ||
    new RegExp(String.raw`^${KAYAKING_SERVICE_PHRASE}$`, 'i').test(
      edgeTrim(message),
    )
  );
}

function hasNamedKayakingOperatorOrLocationAlone(message: string): boolean {
  return (
    /\b(?:noosa|byron(?:\s+bay)?|whitsunday|sydney|cairns)\s+kayak(?:ing)?\s+(?:tours?|adventures?)\b/i.test(
      message,
    ) || /\bsea\s+kayak\s+adventures?\b/i.test(message)
  );
}

function isBlockedKayakingRequestMessage(message: string): boolean {
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
    /\bavoid\b/i.test(message) ||
    /\bskip\b/i.test(message)
  ) {
    return true;
  }
  if (/\binstead\b/i.test(message) || /\bactually\b/i.test(message)) {
    return true;
  }
  if (
    /\b(?:do\s+not|don't)\b/i.test(message) ||
    new RegExp(
      String.raw`\bno\s+(?:a\s+|the\s+|some\s+)?(?:${KAYAKING_SERVICE_PHRASE}|kayak\s+tours?|kayaking\s+recommendations)\b`,
      'i',
    ).test(message) ||
    new RegExp(
      String.raw`\bwithout\s+(?:a\s+|the\s+|some\s+)?(?:${KAYAKING_SERVICE_PHRASE}|kayak\s+tours?|kayaking\s+recommendations)\b`,
      'i',
    ).test(message) ||
    /\bnot\b/i.test(message)
  ) {
    return true;
  }
  if (hasNamedKayakingOperatorOrLocationAlone(message)) {
    return true;
  }
  if (
    /\bkayak(?:ing)?\s+(?:shop|store|equipment|gear|paddle|paddles|roof\s+rack|trailer|hire(?:\s+price)?|permit|rules|regulations|weather|conditions|warning|closure)\b/i.test(
      message,
    ) ||
    /\bhire\s+(?:a\s+|the\s+|some\s+)?kayaks?\b/i.test(message) ||
    /\bwater\s+conditions\s+for\s+kayaking\b/i.test(message)
  ) {
    return true;
  }
  if (
    /\bwe\s+went\s+kayaking\b/i.test(message) ||
    /\bwe\s+kayaked\b/i.test(message) ||
    /\bi\s+like\s+kayaking\b/i.test(message)
  ) {
    return true;
  }
  if (
    (/\b(?:ocean|harbour|harbor|river|lake|bay|mangrove|estuary|white[\s-]?water|calm[\s-]?water|guided|beginner[\s-]?friendly|family(?:[\s-]?friendly)?)\s+kayaking\b/i.test(
      message,
    ) ||
      /\bguided\s+kayak(?:ing)?(?:\s+tours?)?\b/i.test(message)) &&
    !hasActionKayakingServiceCue(message)
  ) {
    return true;
  }
  if (
    /\b(?:canoe|canoes|paddle|paddling|paddleboard|rafting|sup|stand[\s-]?up)\b/i.test(
      message,
    ) &&
    !hasClearKayakingServiceCue(message)
  ) {
    return true;
  }
  return false;
}

const EXPLICIT_KAYAKING_REQUEST_CUES: readonly RegExp[] = [
  new RegExp(
    String.raw`\b(?:book|find|search|need|want|include|add|show\s+me|recommend|compare|go)\s+(?:me\s+)?(?:a\s+|the\s+|some\s+)?(?:best\s+|family(?:[\s-]?friendly)?\s+)?${KAYAKING_SERVICE_PHRASE}\b`,
    'i',
  ),
  new RegExp(
    String.raw`\bi\s+(?:need|want)\s+(?:a\s+|the\s+|some\s+)?${KAYAKING_SERVICE_PHRASE}\b`,
    'i',
  ),
  /\bkayaking\s+(?:recommendations|options)\b/i,
  /\bbest\s+(?:kayaking|kayak\s+tours?)\b/i,
  /\bnearby\s+kayaking\b/i,
  /\bkayaking\s+near\s+me\b/i,
  /\bkayak\s+tours?\s+near\s+me\b/i,
  /\bplaces\s+to\s+kayak\b/i,
  /\bwhere\s+can\s+i\s+kayak\b/i,
  new RegExp(String.raw`\b${KAYAKING_SERVICE_PHRASE}\b`, 'i'),
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
