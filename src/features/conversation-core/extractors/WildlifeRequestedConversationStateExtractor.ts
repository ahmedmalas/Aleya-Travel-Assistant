import type {
  ConversationStateExtractionInput,
  ConversationStateExtractionResult,
  ConversationStateExtractor,
} from '../types';

/**
 * Internal wildlife-requested extraction boundary.
 *
 * Phase 7Z: recognises only narrow, explicit wildlife requests in the current
 * message. Deterministic and local — emits only true, never false or null,
 * and ignores prior conversation state.
 */
export class WildlifeRequestedConversationStateExtractor
  implements ConversationStateExtractor
{
  extract(
    input: ConversationStateExtractionInput,
  ): ConversationStateExtractionResult {
    if (!hasExplicitWildlifeRequest(input.message)) {
      return {
        stateUpdate: {},
      };
    }
    return {
      stateUpdate: {
        wildlifeRequested: true,
      },
    };
  }
}

/** Trim edges without String.prototype.trim (architecture boundary). */
function edgeTrim(value: string): string {
  return value.replace(/^\s+|\s+$/g, '');
}

function hasWildlifeCue(message: string): boolean {
  return /\bwildlife\b/i.test(message);
}

function isBlockedWildlifeRequestMessage(message: string): boolean {
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
    /\bno\s+wildlife\b/i.test(message) ||
    /\bnot\b/i.test(message) ||
    /\bwithout\b/i.test(message)
  ) {
    return true;
  }
  if (
    /\b(?:zoo|zoos|aquarium|aquariums|sanctuar(?:y|ies)|safari|birdwatching|whale[\s-]?watching)\b/i.test(
      message,
    ) &&
    !hasWildlifeCue(message)
  ) {
    return true;
  }
  if (
    /\b(?:kangaroo|koalas?|wombats?|platypus(?:es)?|emus?|crocodiles?|cassowar(?:y|ies)|dingoes?|wallab(?:y|ies)|quokkas?|dolphins?|whales?|turtles?|penguins?|parrots?|eagles?|birds?|animals?)\b/i.test(
      message,
    ) &&
    !hasWildlifeCue(message)
  ) {
    return true;
  }
  if (
    /\b(?:marine|australian|native|local|regional|guided|family(?:[\s-]?friendly)?|beginner[\s-]?friendly|nocturnal|rare)\s+wildlife\b/i.test(
      message,
    ) ||
    /\bwildlife\s+(?:parks?|sanctuar(?:y|ies)|reserves?|zoos?|aquariums?|tours?|trips?|options|spots?|locations?|near|nearby|in|around|by|for|at|to)\b/i.test(
      message,
    ) ||
    /\bnearby\s+wildlife\b/i.test(message)
  ) {
    return true;
  }
  return false;
}

const EXPLICIT_WILDLIFE_REQUEST_CUES: readonly RegExp[] = [
  /\b(?:book|need|include|add|show|find)\s+(?:me\s+)?(?:some\s+|a\s+)?wildlife\b/i,
  /\bi\s+need\s+wildlife\b/i,
  /\bwildlife\b/i,
];

function hasExplicitWildlifeRequest(message: string): boolean {
  const text = edgeTrim(message);
  if (text.length === 0) {
    return false;
  }
  if (isBlockedWildlifeRequestMessage(text)) {
    return false;
  }
  for (const cue of EXPLICIT_WILDLIFE_REQUEST_CUES) {
    if (cue.test(text)) {
      return true;
    }
  }
  return false;
}
