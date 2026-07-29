import type {
  ConversationStateExtractionInput,
  ConversationStateExtractionResult,
  ConversationStateExtractor,
} from '../types';

/**
 * Internal events/festivals-requested extraction boundary.
 *
 * Phase 7Y: recognises only narrow, explicit events or festivals requests —
 * including clear named event/festival references — in the current message.
 * Deterministic and local — emits only true, never false or null, and ignores
 * prior conversation state. Does not store event names.
 */
export class EventsFestivalsRequestedConversationStateExtractor
  implements ConversationStateExtractor
{
  extract(
    input: ConversationStateExtractionInput,
  ): ConversationStateExtractionResult {
    if (!hasExplicitEventsFestivalsRequest(input.message)) {
      return {
        stateUpdate: {},
      };
    }
    return {
      stateUpdate: {
        eventsFestivalsRequested: true,
      },
    };
  }
}

/** Trim edges without String.prototype.trim (architecture boundary). */
function edgeTrim(value: string): string {
  return value.replace(/^\s+|\s+$/g, '');
}

function hasEventsCue(message: string): boolean {
  return /\bevents?\b/i.test(message);
}

function hasFestivalsCue(message: string): boolean {
  return /\bfestivals?\b/i.test(message);
}

function hasEventsOrFestivalsCue(message: string): boolean {
  return hasEventsCue(message) || hasFestivalsCue(message);
}

/** Clear named event/festival identities only — never stores the name. */
const NAMED_EVENTS_FESTIVALS: readonly RegExp[] = [
  /\bsydney\s+festival\b/i,
  /\bvivid\s+sydney\b/i,
  /\bmelbourne\s+food\s+and\s+wine\s+festival\b/i,
  /\badelaide\s+fringe\b/i,
  /\bsplendour\s+in\s+the\s+grass\b/i,
  /\btamworth\s+country\s+music\s+festival\b/i,
];

function hasNamedEventOrFestival(message: string): boolean {
  for (const named of NAMED_EVENTS_FESTIVALS) {
    if (named.test(message)) {
      return true;
    }
  }
  return false;
}

function isHardBlockedEventsFestivalsMessage(message: string): boolean {
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
    /\bno\s+(?:events?|festivals?)\b/i.test(message) ||
    (/\bno\b/i.test(message) && hasNamedEventOrFestival(message)) ||
    /\bnot\b/i.test(message) ||
    /\bwithout\b/i.test(message)
  ) {
    return true;
  }
  if (
    /\bwhat\s+is\s+on\b/i.test(message) ||
    /\bthings\s+happening\b/i.test(message)
  ) {
    return true;
  }
  return false;
}

function isBlockedGenericEventsFestivalsMessage(message: string): boolean {
  if (
    /\b(?:concerts?|shows?|markets?|exhibitions?|nightlife|sporting)\b/i.test(
      message,
    ) &&
    !hasEventsOrFestivalsCue(message) &&
    !hasNamedEventOrFestival(message)
  ) {
    return true;
  }
  if (
    /\b(?:music|food|film|art|comedy|cultural|local|regional|guided|family(?:[\s-]?friendly)?|beginner[\s-]?friendly|sporting)\s+(?:events?|festivals?)\b/i.test(
      message,
    ) ||
    /\b(?:events?|festivals?)\s+(?:calendar|listings?|schedule|tickets?|passes?|near|nearby|in|around|by|for|at|to)\b/i.test(
      message,
    ) ||
    /\bnearby\s+(?:events?|festivals?)\b/i.test(message) ||
    /\bsporting\s+events?\b/i.test(message)
  ) {
    return true;
  }
  return false;
}

const EXPLICIT_EVENTS_FESTIVALS_REQUEST_CUES: readonly RegExp[] = [
  /\b(?:book|need|include|add|show|find)\s+(?:me\s+)?(?:some\s+|a\s+)?(?:events?|festivals?)\b/i,
  /\bi\s+need\s+(?:events?|festivals?)\b/i,
  /\bevents?\s+and\s+festivals?\b/i,
  /\bfestivals?\s+and\s+events?\b/i,
  /\bevents?\b/i,
  /\bfestivals?\b/i,
];

function hasExplicitEventsFestivalsRequest(message: string): boolean {
  const text = edgeTrim(message);
  if (text.length === 0) {
    return false;
  }
  if (isHardBlockedEventsFestivalsMessage(text)) {
    return false;
  }
  if (hasNamedEventOrFestival(text)) {
    return true;
  }
  if (isBlockedGenericEventsFestivalsMessage(text)) {
    return false;
  }
  for (const cue of EXPLICIT_EVENTS_FESTIVALS_REQUEST_CUES) {
    if (cue.test(text)) {
      return true;
    }
  }
  return false;
}
