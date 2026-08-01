import type {
  ConversationStateExtractionInput,
  ConversationStateExtractionResult,
  ConversationStateExtractor,
} from '../types';

/**
 * Internal diving/snorkelling-requested extraction boundary.
 *
 * Phase 7W: recognises only narrow, explicit diving/snorkelling requests in the
 * current message. Phase 8Z extends clear diving/snorkelling discovery cues
 * (spots, locations, options, nearby, places to dive/snorkel). Deterministic
 * and local — emits only true, never false or null, and ignores prior
 * conversation state. Does not use a blanket question-mark block.
 */
export class DivingSnorkellingRequestedConversationStateExtractor
  implements ConversationStateExtractor
{
  extract(
    input: ConversationStateExtractionInput,
  ): ConversationStateExtractionResult {
    if (!hasExplicitDivingSnorkellingRequest(input.message)) {
      return {
        stateUpdate: {},
      };
    }
    return {
      stateUpdate: {
        divingSnorkellingRequested: true,
      },
    };
  }
}

/** Trim edges without String.prototype.trim (architecture boundary). */
function edgeTrim(value: string): string {
  return value.replace(/^\s+|\s+$/g, '');
}

const DIVING_SNORKELLING_SERVICE_PHRASE = String.raw`(?:diving(?:\s+and\s+snorkelling)?|snorkelling(?:\s+and\s+diving)?|diving\s+(?:spots?|locations?|places?|options?)|snorkelling\s+(?:spots?|locations?|places?|options?)|dive\s+locations?)`;

function hasActionDivingSnorkellingServiceCue(message: string): boolean {
  return (
    new RegExp(
      String.raw`\b(?:book|find|search|need|want|include|add|show(?:\s+me)?|recommend(?:\s+me)?|suggest(?:\s+me)?|try|go)\s+(?:me\s+)?(?:a\s+|the\s+|some\s+|somewhere\s+to\s+|to\s+go\s+)?(?:best\s+|family(?:[\s-]?friendly)?\s+|nearby\s+)?${DIVING_SNORKELLING_SERVICE_PHRASE}\b`,
      'i',
    ).test(message) ||
    new RegExp(
      String.raw`\bi\s+(?:need|want)(?:\s+to\s+go)?\s+(?:a\s+|the\s+|some\s+)?${DIVING_SNORKELLING_SERVICE_PHRASE}\b`,
      'i',
    ).test(message) ||
    /\b(?:want|need|like)\s+to\s+(?:go\s+)?(?:dive|diving|snorkel|snorkelling)\b/i.test(
      message,
    ) ||
    /\bcan\s+you\s+recommend\s+(?:\w+[\s-]*){0,3}?(?:diving|snorkelling|somewhere\s+to\s+(?:dive|snorkel))\b/i.test(
      message,
    ) ||
    /\brecommend\s+somewhere\s+to\s+(?:dive|snorkel)\b/i.test(message) ||
    /\bsuggest\s+(?:somewhere|places?|spots?)\s+to\s+(?:dive|snorkel)\b/i.test(
      message,
    ) ||
    /\b(?:diving|snorkelling)\s+(?:recommendations?|options?)\b/i.test(message) ||
    /\b(?:diving|snorkelling)\s+(?:spots?|locations?|places?)\b/i.test(message) ||
    /\bdive\s+locations?\b/i.test(message) ||
    /\bnearby\s+(?:diving|snorkelling)\b/i.test(message) ||
    /\b(?:diving|snorkelling)\s+near\s+me\b/i.test(message) ||
    /\bwhere\s+can\s+(?:i|we)\s+go\s+(?:diving|snorkelling)\b/i.test(message) ||
    /\bwhere\s+can\s+(?:i|we)\s+(?:dive|snorkel)\b/i.test(message) ||
    /\bplaces?\s+to\s+(?:dive|snorkel)\b/i.test(message) ||
    /\bsomewhere\s+to\s+(?:dive|snorkel)\b/i.test(message) ||
    /\bgo\s+(?:diving|snorkelling)\b/i.test(message)
  );
}

function hasClearDivingSnorkellingServiceCue(message: string): boolean {
  return (
    hasActionDivingSnorkellingServiceCue(message) ||
    /\bdiving\b/i.test(message) ||
    /\bsnorkelling\b/i.test(message) ||
    /\b(?:diving|snorkelling)\s+(?:spots?|locations?|places?|options?)\b/i.test(
      message,
    ) ||
    /\bdive\s+locations?\b/i.test(message) ||
    new RegExp(String.raw`^${DIVING_SNORKELLING_SERVICE_PHRASE}$`, 'i').test(
      edgeTrim(message),
    )
  );
}

function hasNamedDiveSiteAlone(message: string): boolean {
  return (
    /\bgreat\s+barrier\s+reef\b/i.test(message) ||
    /\bcod\s+hole\b/i.test(message) ||
    /\bss\s+yongala\b/i.test(message) ||
    /\bningaloo\b/i.test(message)
  );
}

function isBlockedDivingSnorkellingRequestMessage(message: string): boolean {
  if (
    /\?/.test(message) &&
    !hasActionDivingSnorkellingServiceCue(message) &&
    !/\bwhere\s+can\b/i.test(message) &&
    !/\bcan\s+you\s+recommend\b/i.test(message) &&
    !/\brecommend\s+somewhere\s+to\s+(?:dive|snorkel)\b/i.test(message)
  ) {
    return true;
  }
  if (/\bwhat\s+(?:is|are)\b/i.test(message)) {
    return true;
  }
  if (
    (/\bkeep\b/i.test(message) || /\bforget\b/i.test(message)) &&
    /\b(?:diving|snorkelling|dive|snorkel)\b/i.test(message)
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
    /\bno\s+(?:a\s+|the\s+|some\s+)?(?:diving|snorkelling)\b/i.test(message) ||
    /\bwithout\s+(?:a\s+|the\s+|some\s+)?(?:diving|snorkelling)\b/i.test(
      message,
    ) ||
    /\bnot\b/i.test(message)
  ) {
    return true;
  }
  if (
    hasNamedDiveSiteAlone(message) &&
    !hasClearDivingSnorkellingServiceCue(message)
  ) {
    return true;
  }
  if (
    /\b(?:mask|masks|fins?|tank|tanks|wetsuit|wetsuits|accessory|accessories)\b/i.test(
      message,
    ) ||
    /\b(?:diving|snorkelling)\s+(?:gear|equipment|boats?|charters?|trips?|tours?)\b/i.test(
      message,
    ) ||
    /\b(?:gear|equipment)\s+(?:hire|rental|purchase|sale)\b/i.test(message) ||
    /\b(?:hire|rent|buy|purchase)\s+(?:a\s+|the\s+|some\s+)?(?:mask|masks|fins?|tank|tanks|wetsuit|wetsuits|gear|equipment)\b/i.test(
      message,
    ) ||
    /\b(?:wetsuit|tank|gear|equipment)\s+(?:hire|rental)\b/i.test(message) ||
    /\b(?:course|courses|certification|certifications|licen[cs]e|licen[cs]es)\b/i.test(
      message,
    ) ||
    /\b(?:boat\s+hire|charter|charters)\b/i.test(message) ||
    /\b(?:weather|tide|tides|visibility|conditions?)\b/i.test(message) ||
    /\b(?:diving|snorkelling)\s+(?:closure|warning)\b/i.test(message) ||
    /\b(?:closure|warning)\s+(?:for\s+)?(?:diving|snorkelling)\b/i.test(
      message,
    ) ||
    /\b(?:map|maps|address|addresses|directions?)\b/i.test(message) ||
    /\b(?:scuba|reef|free|wreck|cave|shore|boat|night|guided|deep[\s-]?sea|sport)\s+diving\b/i.test(
      message,
    ) ||
    /\b(?:reef|guided|boat)\s+snorkelling\b/i.test(message) ||
    /\bfreediving\b/i.test(message) ||
    /\b(?:how\s+far|drive[\s-]?time|website)\b/i.test(message)
  ) {
    return true;
  }
  if (
    /\bwe\s+went\s+(?:diving|snorkelling)\b/i.test(message) ||
    /\bi\s+went\s+(?:diving|snorkelling)\b/i.test(message) ||
    /\bwe\s+(?:dived|dove|snorkelled)\b/i.test(message) ||
    /\bi\s+(?:dived|dove|snorkelled)\b/i.test(message) ||
    /\bwent\s+(?:diving|snorkelling)\s+yesterday\b/i.test(message) ||
    /\bi\s+like\s+(?:diving|snorkelling)\b/i.test(message)
  ) {
    return true;
  }
  if (
    /\b(?:dive|snorkel|scuba|boats?|gear|equipment|mask|fins?|wetsuit)\b/i.test(
      message,
    ) &&
    !/\bdiving\b/i.test(message) &&
    !/\bsnorkelling\b/i.test(message) &&
    !/\bto\s+(?:dive|snorkel)\b/i.test(message) &&
    !/\bplaces?\s+to\s+(?:dive|snorkel)\b/i.test(message) &&
    !/\bsomewhere\s+to\s+(?:dive|snorkel)\b/i.test(message) &&
    !/\bdive\s+locations?\b/i.test(message) &&
    !/\bgo\s+(?:dive|snorkel)\b/i.test(message)
  ) {
    return true;
  }
  return false;
}

const EXPLICIT_DIVING_SNORKELLING_REQUEST_CUES: readonly RegExp[] = [
  new RegExp(
    String.raw`\b(?:book|find|search|need|want|include|add|show(?:\s+me)?|recommend(?:\s+me)?|suggest(?:\s+me)?|try|go)\s+(?:me\s+)?(?:a\s+|the\s+|some\s+|somewhere\s+to\s+|to\s+go\s+)?(?:best\s+|family(?:[\s-]?friendly)?\s+|nearby\s+)?${DIVING_SNORKELLING_SERVICE_PHRASE}\b`,
    'i',
  ),
  new RegExp(
    String.raw`\bi\s+(?:need|want)(?:\s+to\s+go)?\s+(?:a\s+|the\s+|some\s+)?${DIVING_SNORKELLING_SERVICE_PHRASE}\b`,
    'i',
  ),
  /\b(?:want|need|like)\s+to\s+(?:go\s+)?(?:dive|diving|snorkel|snorkelling)\b/i,
  /\bcan\s+you\s+recommend\s+(?:\w+[\s-]*){0,3}?(?:diving|snorkelling|somewhere\s+to\s+(?:dive|snorkel))\b/i,
  /\brecommend\s+somewhere\s+to\s+(?:dive|snorkel)\b/i,
  /\bsuggest\s+(?:somewhere|places?|spots?)\s+to\s+(?:dive|snorkel)\b/i,
  /\b(?:diving|snorkelling)\s+(?:recommendations?|options?)\b/i,
  /\b(?:diving|snorkelling)\s+(?:spots?|locations?|places?)\b/i,
  /\bdive\s+locations?\b/i,
  /\bnearby\s+(?:diving|snorkelling)\b/i,
  /\b(?:diving|snorkelling)\s+near\s+me\b/i,
  /\bwhere\s+can\s+(?:i|we)\s+go\s+(?:diving|snorkelling)\b/i,
  /\bwhere\s+can\s+(?:i|we)\s+(?:dive|snorkel)\b/i,
  /\bplaces?\s+to\s+(?:dive|snorkel)\b/i,
  /\bsomewhere\s+to\s+(?:dive|snorkel)\b/i,
  /\bgo\s+(?:diving|snorkelling)\b/i,
  /\bdiving\s+and\s+snorkelling\b/i,
  /\bsnorkelling\s+and\s+diving\b/i,
  /\bdiving\b/i,
  /\bsnorkelling\b/i,
];

function hasExplicitDivingSnorkellingRequest(message: string): boolean {
  const text = edgeTrim(message);
  if (text.length === 0) {
    return false;
  }
  if (isBlockedDivingSnorkellingRequestMessage(text)) {
    return false;
  }
  for (const cue of EXPLICIT_DIVING_SNORKELLING_REQUEST_CUES) {
    if (cue.test(text)) {
      return true;
    }
  }
  return false;
}
