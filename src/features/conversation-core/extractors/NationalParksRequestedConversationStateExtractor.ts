import type {
  ConversationStateExtractionInput,
  ConversationStateExtractionResult,
  ConversationStateExtractor,
} from '../types';

/**
 * Internal national-parks-requested extraction boundary.
 *
 * Phase 7AA: recognises only narrow, explicit national-parks requests —
 * including clear named national-park references — in the current message.
 * Deterministic and local — emits only true, never false or null, and ignores
 * prior conversation state. Does not store park names.
 */
export class NationalParksRequestedConversationStateExtractor
  implements ConversationStateExtractor
{
  extract(
    input: ConversationStateExtractionInput,
  ): ConversationStateExtractionResult {
    if (!hasExplicitNationalParksRequest(input.message)) {
      return {
        stateUpdate: {},
      };
    }
    return {
      stateUpdate: {
        nationalParksRequested: true,
      },
    };
  }
}

/** Trim edges without String.prototype.trim (architecture boundary). */
function edgeTrim(value: string): string {
  return value.replace(/^\s+|\s+$/g, '');
}

function hasNationalParksCue(message: string): boolean {
  return /\bnational\s+parks?\b/i.test(message);
}

/** Clear named national-park identities only — never stores the name. */
const NAMED_NATIONAL_PARKS: readonly RegExp[] = [
  /\broyal\s+national\s+park\b/i,
  /\bblue\s+mountains\s+national\s+park\b/i,
  /\bkakadu\s+national\s+park\b/i,
  /\bkosciuszko\s+national\s+park\b/i,
  /\bdaintree\s+national\s+park\b/i,
];

function hasNamedNationalPark(message: string): boolean {
  for (const named of NAMED_NATIONAL_PARKS) {
    if (named.test(message)) {
      return true;
    }
  }
  return false;
}

function isHardBlockedNationalParksMessage(message: string): boolean {
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
    /\bno\s+national\s+parks?\b/i.test(message) ||
    (/\bno\b/i.test(message) && hasNamedNationalPark(message)) ||
    /\bnot\b/i.test(message) ||
    /\bwithout\b/i.test(message)
  ) {
    return true;
  }
  return false;
}

function isBlockedGenericNationalParksMessage(message: string): boolean {
  if (
    /\b(?:playgrounds?|gardens?|reserves?|state\s+parks?|conservation\s+areas?|protected\s+areas?|wilderness(?:\s+areas?)?)\b/i.test(
      message,
    ) &&
    !hasNationalParksCue(message) &&
    !hasNamedNationalPark(message)
  ) {
    return true;
  }
  if (
    /\bparks?\b/i.test(message) &&
    !hasNationalParksCue(message) &&
    !hasNamedNationalPark(message)
  ) {
    return true;
  }
  if (
    /\b(?:coastal|australian|local|regional|guided|family(?:[\s-]?friendly)?|beginner[\s-]?friendly|remote|alpine)\s+national\s+parks?\b/i.test(
      message,
    ) ||
    /\bnational\s+parks?\s+(?:tours?|trips?|options|spots?|locations?|near|nearby|in|around|by|for|at|to)\b/i.test(
      message,
    ) ||
    /\bnearby\s+national\s+parks?\b/i.test(message)
  ) {
    return true;
  }
  return false;
}

const EXPLICIT_NATIONAL_PARKS_REQUEST_CUES: readonly RegExp[] = [
  /\b(?:book|need|include|add|show|find)\s+(?:me\s+)?(?:some\s+|a\s+)?national\s+parks?\b/i,
  /\bi\s+need\s+national\s+parks?\b/i,
  /\bnational\s+parks?\b/i,
];

function hasExplicitNationalParksRequest(message: string): boolean {
  const text = edgeTrim(message);
  if (text.length === 0) {
    return false;
  }
  if (isHardBlockedNationalParksMessage(text)) {
    return false;
  }
  if (hasNamedNationalPark(text)) {
    return true;
  }
  if (isBlockedGenericNationalParksMessage(text)) {
    return false;
  }
  for (const cue of EXPLICIT_NATIONAL_PARKS_REQUEST_CUES) {
    if (cue.test(text)) {
      return true;
    }
  }
  return false;
}
