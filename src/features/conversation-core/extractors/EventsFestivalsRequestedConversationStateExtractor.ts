import type {
  ConversationStateExtractionInput,
  ConversationStateExtractionResult,
  ConversationStateExtractor,
} from '../types';

/**
 * Internal events/festivals-requested extraction boundary.
 *
 * Phase 7Y: recognises only narrow, explicit events or festivals requests in the
 * current message. Phase 9B extends clear event/festival discovery cues (local
 * / upcoming events, music/food/cultural/community festivals, nearby, options,
 * listings, what is on, things happening nearby). Deterministic and local —
 * emits only true, never false or null, and ignores prior conversation state.
 * Does not use a blanket question-mark block. Named events alone do not emit.
 *
 * Phase 19C: single canonical events capability (`eventsFestivalsRequested`).
 * Events-only and festival-oriented affirmative requests both populate this
 * field. The legacy `eventsRequested` field has been removed.
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

const EVENTS_FESTIVALS_SERVICE_PHRASE = String.raw`(?:events?|festivals?|local\s+events?|upcoming\s+events?|music\s+festivals?|food\s+festivals?|cultural\s+festivals?|community\s+festivals?|festival\s+options?|event\s+listings?)`;

/** Named identities recognised only with a clear discovery request — never stored. */
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

function hasDiscoveryVerb(message: string): boolean {
  return /\b(?:book|find|search|need|want|include|add|show|recommend|suggest|try|attend|visit|explore|discover|go)\b/i.test(
    message,
  );
}

function hasNamedEventWithDiscoveryRequest(message: string): boolean {
  return hasNamedEventOrFestival(message) && hasDiscoveryVerb(message);
}

function hasWhatsOnCue(message: string): boolean {
  return /\bwhat(?:'s|\s+is)\s+on\b/i.test(message);
}

function hasThingsHappeningCue(message: string): boolean {
  return (
    /\bthings\s+happening\s+nearby\b/i.test(message) ||
    /\bthings\s+happening\b/i.test(message)
  );
}

function hasActionEventsFestivalsServiceCue(message: string): boolean {
  return (
    new RegExp(
      String.raw`\b(?:book|find|search|need|want|include|add|show(?:\s+me)?|recommend(?:\s+me)?|suggest(?:\s+me)?|try|attend|visit|explore|discover|go)\s+(?:me\s+)?(?:a\s+|the\s+|some\s+|to\s+(?:go\s+to\s+|attend\s+|visit\s+)?)?(?:best\s+|family(?:[\s-]?friendly)?\s+|nearby\s+|local\s+|upcoming\s+)?${EVENTS_FESTIVALS_SERVICE_PHRASE}\b`,
      'i',
    ).test(message) ||
    new RegExp(
      String.raw`\bi\s+(?:need|want)(?:\s+to\s+(?:go|attend|visit|explore|discover))?\s+(?:a\s+|the\s+|some\s+)?${EVENTS_FESTIVALS_SERVICE_PHRASE}\b`,
      'i',
    ).test(message) ||
    /\bcan\s+you\s+recommend\s+(?:\w+[\s-]*){0,3}?(?:events?|festivals?)\b/i.test(
      message,
    ) ||
    /\b(?:events?|festivals?)\s+(?:recommendations?|options?|listings?)\b/i.test(
      message,
    ) ||
    /\bfestival\s+options?\b/i.test(message) ||
    /\bevent\s+listings?\b/i.test(message) ||
    /\b(?:local|upcoming)\s+events?\b/i.test(message) ||
    /\b(?:music|food|cultural|community)\s+festivals?\b/i.test(message) ||
    /\bnearby\s+(?:events?|festivals?)\b/i.test(message) ||
    /\b(?:events?|festivals?)\s+near\s+me\b/i.test(message) ||
    /\bwhere\s+can\s+(?:i|we)\s+(?:find|attend|visit|explore)\s+(?:events?|festivals?)\b/i.test(
      message,
    ) ||
    /\bplaces?\s+hosting\s+(?:events?|festivals?)\b/i.test(message) ||
    hasNamedEventWithDiscoveryRequest(message) ||
    hasWhatsOnCue(message) ||
    hasThingsHappeningCue(message)
  );
}

function hasClearEventsFestivalsServiceCue(message: string): boolean {
  return (
    hasActionEventsFestivalsServiceCue(message) ||
    /\bevents?\b/i.test(message) ||
    /\bfestivals?\b/i.test(message) ||
    /\b(?:local|upcoming)\s+events?\b/i.test(message) ||
    /\b(?:music|food|cultural|community)\s+festivals?\b/i.test(message) ||
    /\bfestival\s+options?\b/i.test(message) ||
    /\bevent\s+listings?\b/i.test(message) ||
    hasNamedEventWithDiscoveryRequest(message) ||
    hasWhatsOnCue(message) ||
    hasThingsHappeningCue(message) ||
    new RegExp(String.raw`^${EVENTS_FESTIVALS_SERVICE_PHRASE}$`, 'i').test(
      edgeTrim(message),
    )
  );
}

function isBlockedEventsFestivalsRequestMessage(message: string): boolean {
  if (
    /\?/.test(message) &&
    !hasActionEventsFestivalsServiceCue(message) &&
    !hasWhatsOnCue(message) &&
    !hasThingsHappeningCue(message) &&
    !/\bwhere\s+can\b/i.test(message) &&
    !/\bcan\s+you\s+recommend\b/i.test(message)
  ) {
    return true;
  }
  if (
    /\bwhat\s+(?:is|are)\b/i.test(message) &&
    !hasWhatsOnCue(message)
  ) {
    return true;
  }
  if (
    (/\bkeep\b/i.test(message) || /\bforget\b/i.test(message)) &&
    (/\b(?:events?|festivals?)\b/i.test(message) ||
      hasNamedEventOrFestival(message))
  ) {
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
    /\bno\s+(?:a\s+|the\s+|some\s+)?(?:events?|festivals?)\b/i.test(message) ||
    (/\bno\b/i.test(message) && hasNamedEventOrFestival(message)) ||
    /\bwithout\s+(?:a\s+|the\s+|some\s+)?(?:events?|festivals?)\b/i.test(
      message,
    ) ||
    /\bnot\b/i.test(message)
  ) {
    return true;
  }
  if (hasNamedEventOrFestival(message) && !hasDiscoveryVerb(message)) {
    return true;
  }
  if (
    /\b(?:ticket|tickets|ticket\s+purchase|buy\s+tickets?)\b/i.test(message) ||
    /\b(?:venue|venues)\b/i.test(message) ||
    /\b(?:wedding|weddings|conference|conferences|private\s+function|private\s+functions)\b/i.test(
      message,
    ) ||
    /\b(?:planning|staffing|catering|merchandise|merch)\b/i.test(message) ||
    /\b(?:employment|job|jobs|sponsorship|vendor|vendors|application|applications)\b/i.test(
      message,
    ) ||
    /\b(?:event|festival)\s+(?:transport|transfer|transfers|accommodation|hotel|hotels|stay|stays)\b/i.test(
      message,
    ) ||
    /\b(?:hotel|hotels|accommodation)\s+(?:near|for)\s+(?:a\s+)?(?:event|festival|events|festivals)\b/i.test(
      message,
    ) ||
    /\b(?:hotel|hotels|the\s+hotel|accommodation)\s+hosts?\s+(?:events?|festivals?)\b/i.test(
      message,
    ) ||
    /\b(?:permit|permits|licen[cs]e|licen[cs]es|law|laws|regulation|regulations)\b/i.test(
      message,
    ) ||
    /\b(?:weather|conditions?|cancellations?)\b/i.test(message) ||
    /\b(?:event|festival)\s+(?:closure|warning)\b/i.test(message) ||
    /\b(?:closure|warning)\s+(?:for\s+)?(?:events?|festivals?)\b/i.test(
      message,
    ) ||
    /\bsporting\s+events?\b/i.test(message) ||
    /\b(?:map|maps|address|addresses|directions?)\b/i.test(message)
  ) {
    return true;
  }
  if (
    /\bwe\s+went\s+to\s+(?:an?\s+)?(?:event|festival)\b/i.test(message) ||
    /\bi\s+went\s+to\s+(?:an?\s+)?(?:event|festival)\b/i.test(message) ||
    /\battended\s+(?:an?\s+)?(?:event|festival)\s+yesterday\b/i.test(message) ||
    /\bi\s+like\s+(?:events?|festivals?)\b/i.test(message)
  ) {
    return true;
  }
  if (
    /\b(?:concerts?|shows?|markets?|exhibitions?|nightlife)\b/i.test(message) &&
    !hasClearEventsFestivalsServiceCue(message)
  ) {
    return true;
  }
  return false;
}

const EXPLICIT_EVENTS_FESTIVALS_REQUEST_CUES: readonly RegExp[] = [
  new RegExp(
    String.raw`\b(?:book|find|search|need|want|include|add|show(?:\s+me)?|recommend(?:\s+me)?|suggest(?:\s+me)?|try|attend|visit|explore|discover|go)\s+(?:me\s+)?(?:a\s+|the\s+|some\s+|to\s+(?:go\s+to\s+|attend\s+|visit\s+)?)?(?:best\s+|family(?:[\s-]?friendly)?\s+|nearby\s+|local\s+|upcoming\s+)?${EVENTS_FESTIVALS_SERVICE_PHRASE}\b`,
    'i',
  ),
  new RegExp(
    String.raw`\bi\s+(?:need|want)(?:\s+to\s+(?:go|attend|visit|explore|discover))?\s+(?:a\s+|the\s+|some\s+)?${EVENTS_FESTIVALS_SERVICE_PHRASE}\b`,
    'i',
  ),
  /\bcan\s+you\s+recommend\s+(?:\w+[\s-]*){0,3}?(?:events?|festivals?)\b/i,
  /\b(?:events?|festivals?)\s+(?:recommendations?|options?|listings?)\b/i,
  /\bfestival\s+options?\b/i,
  /\bevent\s+listings?\b/i,
  /\b(?:local|upcoming)\s+events?\b/i,
  /\b(?:music|food|cultural|community)\s+festivals?\b/i,
  /\bnearby\s+(?:events?|festivals?)\b/i,
  /\b(?:events?|festivals?)\s+near\s+me\b/i,
  /\bwhere\s+can\s+(?:i|we)\s+(?:find|attend|visit|explore)\s+(?:events?|festivals?)\b/i,
  /\bplaces?\s+hosting\s+(?:events?|festivals?)\b/i,
  /\bwhat(?:'s|\s+is)\s+on\b/i,
  /\bthings\s+happening(?:\s+nearby)?\b/i,
  /\bsydney\s+festival\b/i,
  /\bvivid\s+sydney\b/i,
  /\bmelbourne\s+food\s+and\s+wine\s+festival\b/i,
  /\badelaide\s+fringe\b/i,
  /\bsplendour\s+in\s+the\s+grass\b/i,
  /\btamworth\s+country\s+music\s+festival\b/i,
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
  if (isBlockedEventsFestivalsRequestMessage(text)) {
    return false;
  }
  for (const cue of EXPLICIT_EVENTS_FESTIVALS_REQUEST_CUES) {
    if (cue.test(text)) {
      return true;
    }
  }
  return false;
}
