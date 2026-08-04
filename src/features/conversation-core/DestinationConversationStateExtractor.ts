import { trimRepairPlaceCaptureAtSiblingClause } from './repairPlaceClauseBoundary';
import type {
  ConversationCoreState,
  ConversationStateExtractionInput,
  ConversationStateExtractionResult,
  ConversationStateExtractor,
} from './types';

/**
 * Internal destination-field extraction boundary.
 *
 * Phase 7A / 7A.1: recognises only narrow, explicit destination statements,
 * destination-replacement instructions, and explicit origin+destination route
 * forms in the current message. Deterministic and local — no external lookup,
 * geographic validation, or origin extraction.
 *
 * Phase 17B: adds explicit single-fact destination repair cues (meant /
 * Actually, Place / make that / change that / Not X, Y). Does not inspect
 * prior destination values; contrast repair selects only the new place.
 *
 * Phase 17C collision: origin-cued repairs ("meant from …", "Actually, from …")
 * must not yield a destination capture such as "from Brisbane".
 *
 * Phase 17I: repair place captures trim at following origin/date/passenger
 * clauses via the shared clause-boundary helper.
 *
 * Phase 21D: when destination is the canonical next required core field
 * (destination null), a whole-message bare place answer may emit destination.
 * Explicit cue ownership is unchanged and always tried first. currentState is
 * read only for that active-destination gate — never copied.
 *
 * Phase 21F: bare place tokens are accepted regardless of user-entered casing;
 * the bare path emits deterministic Title-Case display forms. Explicit with-"to"
 * cue value casing is unchanged.
 *
 * Phase 21I: missing-"to" travel grammar (go/travel/fly/head + place without
 * "to") is recognised as an explicit destination cue family. Captures are
 * validated with the same place-shape + deny-list boundary as the bare path
 * (no closed city list; no external place-lookup module). With-"to" cues
 * still run first. Bare-answer ownership (21B / 21D / 21F) is unchanged.
 */
export class DestinationConversationStateExtractor
  implements ConversationStateExtractor
{
  extract(
    input: ConversationStateExtractionInput,
  ): ConversationStateExtractionResult {
    const cuedDestination = extractExplicitDestination(input.message);
    if (cuedDestination !== null) {
      return {
        stateUpdate: {
          destination: cuedDestination,
        },
      };
    }

    if (!isDestinationFollowUpActive(input.currentState)) {
      return {
        stateUpdate: {},
      };
    }

    const bareDestination = extractBareDestinationPlace(input.message);
    if (bareDestination === null) {
      return {
        stateUpdate: {},
      };
    }

    return {
      stateUpdate: {
        destination: bareDestination,
      },
    };
  }
}

/**
 * True when destination is the next required core travel field.
 *
 * Mirrors core progression priority (destination → origin → departureDate →
 * returnDate). destination null is sufficient for destination to own the
 * active follow-up; does not import the follow-up selector.
 */
function isDestinationFollowUpActive(state: ConversationCoreState): boolean {
  return state.destination === null;
}

/** Trim edges without String.prototype.trim (architecture boundary). */
function edgeTrim(value: string): string {
  return value.replace(/^\s+|\s+$/g, '');
}

/**
 * Phase 17B contrast repair: "Not Melbourne, Cairns".
 * Requires a comma-separated old/new pair; does not match "Not sure about …".
 */
function matchContrastDestinationRepair(
  message: string,
): { previousRaw: string; nextRaw: string } | null {
  const match = edgeTrim(message).match(/^not\s+([^,]+),\s*(.+)$/i);
  if (match === null) {
    return null;
  }
  const previousRaw = match[1];
  const nextRaw = match[2];
  if (typeof previousRaw !== 'string' || typeof nextRaw !== 'string') {
    return null;
  }
  return { previousRaw, nextRaw };
}

/**
 * True when the message already contains an explicit destination cue that can
 * safely coexist with an origin “from …” clause.
 *
 * Phase 21I: missing-"to" travel verbs with a following non-"to" token also
 * count so "I want to go Melbourne from Sydney" is not blocked by \\bfrom\\b.
 */
function hasExplicitDestinationCueAlongsideOrigin(message: string): boolean {
  return (
    /\b(?:go(?:ing)?|travel(?:l?ing)?|fly(?:ing)?|head(?:ing)?)\s+to\b/i.test(
      message,
    ) ||
    /\b(?:go(?:ing)?|travel(?:l?ing)?|fly(?:ing)?|head(?:ing)?)\s+(?!to\b)\S+/i.test(
      message,
    ) ||
    /\b(?:fly(?:ing)?|travel(?:l?ing)?)\s+from\s+.+?\s+to\b/i.test(message) ||
    /\btake\s+me\s+to\b/i.test(message) ||
    /\bvisit(?:ing)?\b/i.test(message) ||
    /\bdestination\s+is\b/i.test(message) ||
    /\bchange\s+(?:it|that|(?:my\s+)?destination)\s+to\b/i.test(message) ||
    /\b(?:actually\s+)?make\s+it\b/i.test(message) ||
    /\bno[,.]?\s+make\s+that\b/i.test(message) ||
    /\b(?:sorry[,.]?\s+)?i\s+meant\b/i.test(message) ||
    /\bactually[,]\s+\S/i.test(message) ||
    /\bswitch\s+it\s+to\b/i.test(message) ||
    matchContrastDestinationRepair(message) !== null
  );
}

/**
 * Messages that must not yield a destination in this phase — vague discovery,
 * recommendations, origin/accommodation locality, negation, or preservation.
 *
 * Phase 17B: the blanket \\bnot\\b block remains, except for the narrow
 * contrast-repair shape "Not {old}, {new}" which is handled as a repair cue.
 */
function isBlockedDestinationMessage(message: string): boolean {
  if (/\?/.test(message)) {
    return true;
  }
  if (
    /\b(?:recommend|surprise)\b/i.test(message) ||
    /\bwhere\s+should\b/i.test(message) ||
    /\bwhat\s+do\s+you\s+recommend\b/i.test(message) ||
    /^(?:is|what|how|where|tell)\b/i.test(message) ||
    /\btell\s+me\s+about\b/i.test(message)
  ) {
    return true;
  }
  if (/\b(?:somewhere|anywhere)\b/i.test(message)) {
    return true;
  }
  if (/\b(?:maybe|perhaps)\b/i.test(message)) {
    return true;
  }
  if (/\bthinking\s+about\b/i.test(message)) {
    return true;
  }
  if (/\bi\s+like\b/i.test(message)) {
    return true;
  }
  if (/\bsounds\s+nice\b/i.test(message)) {
    return true;
  }
  if (
    /\b(?:stay\s+in|hotel\s+in|accommodation\s+(?:near|in)|activities\s+near)\b/i.test(
      message,
    )
  ) {
    return true;
  }
  if (/\bflights\s+to\s+compare\b/i.test(message)) {
    return true;
  }
  // Origin/date “leaving/departing …” remains blocked unless a destination
  // repair/route cue is also present (Phase 17I multi-fact coexistence).
  if (
    (/\bleaving\b/i.test(message) || /\bdeparting\b/i.test(message)) &&
    !hasExplicitDestinationCueAlongsideOrigin(message)
  ) {
    return true;
  }
  // Origin-only “from …” remains blocked; allow when a destination cue is also
  // present (Phase 7A.1 route forms / Phase 17B repair cues).
  if (
    /\bfrom\b/i.test(message) &&
    !hasExplicitDestinationCueAlongsideOrigin(message)
  ) {
    return true;
  }
  if (/\bkeep\b/i.test(message)) {
    return true;
  }
  if (/\bforget\b/i.test(message)) {
    return true;
  }
  if (
    /\b(?:do\s+not|don't)\s+(?:go(?:ing)?\s+to|change|make\s+it)\b/i.test(message)
  ) {
    return true;
  }
  if (/\bnot\s+going\s+to\b/i.test(message)) {
    return true;
  }
  // Phase 17B: allow only comma contrast repair through the not-block.
  if (
    /\bnot\b/i.test(message) &&
    matchContrastDestinationRepair(message) === null
  ) {
    return true;
  }
  return false;
}

/**
 * Phase 17B — reject repair captures that are passenger counts, dates,
 * pronouns, clauses, or non-destination tokens (not bare place names).
 *
 * Phase 17G: singular "child" must also be rejected so passenger-cued
 * repairs such as "I meant 1 child" stay passenger-owned.
 */
function isRejectedRepairDestinationCapture(value: string): boolean {
  if (/^(?:that|this|it|the|i|we|you|a|an)\b/i.test(value)) {
    return true;
  }
  // Phase 17C: origin-cued "from …" repairs are origin-owned, not destinations.
  if (/^(?:from|departing(?:\s+from)?|leaving(?:\s+from)?)\b/i.test(value)) {
    return true;
  }
  if (
    /\b(?:adults?|child(?:ren)?|kids?|infants?|bab(?:y|ies)|flights?|accommodation|hotel|should|need|sure|about)\b/i.test(
      value,
    )
  ) {
    return true;
  }
  if (
    /\b(?:one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+(?:adults?|child(?:ren)?|kids?|infants?|bab(?:y|ies))\b/i.test(
      value,
    )
  ) {
    return true;
  }
  if (
    /^(?:keep|forget|do|don't|return(?:ing)?|depart(?:ing)?|leaving)\b/i.test(
      value,
    )
  ) {
    return true;
  }
  // Bare date / month phrases must not become destinations via "I meant …".
  if (
    /\b(?:january|february|march|april|may|june|july|august|september|october|november|december)\b/i.test(
      value,
    )
  ) {
    return true;
  }
  if (/\b\d{4}\b/.test(value) && /\b\d{1,2}\b/.test(value)) {
    return true;
  }
  if (/,/.test(value) || /\bnot\b/i.test(value)) {
    return true;
  }
  return false;
}

/** Case-insensitive equality without String.prototype.toLowerCase. */
function sameDestinationIgnoreCase(left: string, right: string): boolean {
  if (left.length !== right.length) {
    return false;
  }
  const escaped = left.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^${escaped}$`, 'i').test(right);
}

const EXPLICIT_DESTINATION_CUES: readonly RegExp[] = [
  /\bchange\s+it\s+to\s+(.+)$/i,
  // Phase 17B: "Change that to Cairns" (distinct from change it to).
  /\bchange\s+that\s+to\s+(.+)$/i,
  /\bchange\s+(?:my\s+)?destination\s+to\s+(.+)$/i,
  /\bmake\s+it\s+(.+?)\s+instead\b/i,
  /\bactually\s+make\s+it\s+(.+)$/i,
  // Phase 17B: "No, make that Cairns".
  /\bno[,.]?\s+make\s+that\s+(.+)$/i,
  // Phase 17B: "Sorry, I meant Cairns" / "I meant Cairns".
  /\b(?:sorry[,.]?\s+)?i\s+meant\s+(.+)$/i,
  // Phase 17B: "Actually, Cairns" — comma required so "Actually make it" stays
  // on the existing cue above.
  /\bactually[,]\s+(.+)$/i,
  /\bswitch\s+it\s+to\s+(.+)$/i,
  /\bdestination\s+is\s+(.+)$/i,
  // Phase 7A.1: fly/travel from <origin> to <destination>
  /\b(?:fly(?:ing)?|travel(?:l?ing)?)\s+from\s+.+?\s+to\s+(.+)$/i,
  /\b(?:(?:i\s+want\s+to|we(?:'re|\s+are))\s+)?(?:go(?:ing)?|travel(?:l?ing)?|fly(?:ing)?|head(?:ing)?)\s+to\s+(.+)$/i,
  /\btake\s+me\s+to\s+(.+)$/i,
  /\bvisit(?:ing)?\s+(.+)$/i,
];

/**
 * Phase 21I — travel verb + place without the word "to".
 *
 * Tried only after with-"to" cues. Negative lookahead keeps "go to Melbourne"
 * on the with-"to" family. Captures are place-validated + Title-Cased.
 */
const MISSING_TO_DESTINATION_CUES: readonly RegExp[] = [
  /\b(?:(?:i\s+want\s+to|we(?:'re|\s+are))\s+)?(?:go(?:ing)?|travel(?:l?ing)?|fly(?:ing)?|head(?:ing)?)\s+(?!to\b)(.+)$/i,
];

/** Repair-family cues that must apply the Phase 17B capture guards. */
const REPAIR_DESTINATION_CUE_SOURCES: readonly RegExp[] = [
  /\bchange\s+that\s+to\s+(.+)$/i,
  /\bno[,.]?\s+make\s+that\s+(.+)$/i,
  /\b(?:sorry[,.]?\s+)?i\s+meant\s+(.+)$/i,
  /\bactually[,]\s+(.+)$/i,
];

function isRepairDestinationCue(cue: RegExp): boolean {
  return REPAIR_DESTINATION_CUE_SOURCES.some(
    (repairCue) => repairCue.source === cue.source && repairCue.flags === cue.flags,
  );
}

function normaliseCapturedDestination(raw: string): string | null {
  let value = edgeTrim(raw);
  // Phase 17I: stop before following origin / date / passenger clauses.
  value = trimRepairPlaceCaptureAtSiblingClause(value);
  value = value.replace(/\s+instead(?:\s+of\b.*)?$/i, '');
  value = value.replace(/\s+from\b.*$/i, '');
  value = value.replace(/\s+for\b.*$/i, '');
  value = value.replace(/\s+with\b.*$/i, '');
  value = value.replace(/\s+next\s+week.*$/i, '');
  value = value.replace(/[.!?,;:]+$/g, '');
  value = edgeTrim(value);
  if (value.length === 0) {
    return null;
  }
  if (/^(?:somewhere|anywhere|here|there|it)\b/i.test(value)) {
    return null;
  }
  if (/\b(?:or|and)\b/i.test(value)) {
    return null;
  }
  return value;
}

function extractContrastDestination(message: string): string | null {
  const matched = matchContrastDestinationRepair(message);
  if (matched === null) {
    return null;
  }
  const previous = normaliseCapturedDestination(matched.previousRaw);
  const next = normaliseCapturedDestination(matched.nextRaw);
  if (previous === null || next === null) {
    return null;
  }
  if (sameDestinationIgnoreCase(previous, next)) {
    return null;
  }
  if (isRejectedRepairDestinationCapture(next)) {
    return null;
  }
  // Only the new destination is returned; old value is never selected.
  return next;
}

function extractExplicitDestination(message: string): string | null {
  const text = edgeTrim(message);
  if (text.length === 0) {
    return null;
  }

  // Phase 17B contrast repair is evaluated before the general not-block path
  // via matchContrastDestinationRepair inside isBlockedDestinationMessage.
  const contrast = extractContrastDestination(text);
  if (contrast !== null) {
    return contrast;
  }

  if (isBlockedDestinationMessage(text)) {
    return null;
  }
  for (const cue of EXPLICIT_DESTINATION_CUES) {
    const match = text.match(cue);
    const captured = match?.[1];
    if (typeof captured !== 'string') {
      continue;
    }
    const destination = normaliseCapturedDestination(captured);
    if (destination === null) {
      continue;
    }
    if (
      isRepairDestinationCue(cue) &&
      isRejectedRepairDestinationCapture(destination)
    ) {
      continue;
    }
    return destination;
  }

  // Phase 21I: missing-"to" travel grammar after with-"to" cues.
  for (const cue of MISSING_TO_DESTINATION_CUES) {
    const match = text.match(cue);
    const captured = match?.[1];
    if (typeof captured !== 'string') {
      continue;
    }
    const normalised = normaliseCapturedDestination(captured);
    if (normalised === null) {
      continue;
    }
    if (isRejectedRepairDestinationCapture(normalised)) {
      continue;
    }
    const destination = asValidatedTitleCasePlace(normalised);
    if (destination === null) {
      continue;
    }
    return destination;
  }
  return null;
}

/**
 * Conversational fillers that must not become destination when destination is
 * active. Compared with ASCII case-folding (no String#toLowerCase).
 */
const BARE_DESTINATION_FILLERS: readonly string[] = [
  'ok',
  'okay',
  'thanks',
  'thank',
  'hello',
  'hi',
  'hey',
  'yes',
  'no',
  'sure',
  'yep',
  'nope',
  'good',
  'great',
  'fine',
  'cool',
  'maybe',
  'perhaps',
  'please',
  'weather',
  'friend',
  'there',
  'here',
  'what',
  'who',
  'why',
  'how',
  'when',
  'where',
  'let',
  'think',
  'help',
  'me',
  'you',
  'can',
  'do',
  'not',
  'warm',
  'surprise',
  // Route / function words — block "Sydney to Brisbane" style bare chatter.
  'to',
  'from',
  'of',
  'the',
  'a',
  'an',
  'and',
  'or',
  'for',
  'with',
  'in',
  'on',
  'at',
  'instead',
  'change',
  'colour',
  'color',
  'blue',
  'favourite',
  'favorite',
  'flexible',
  'budget',
  'recommend',
  'recommendation',
  'recommendations',
  // Capability / activity / schedule tokens must not become destinations.
  'cancel',
  'everything',
  'anything',
  'fresh',
  'call',
  'flying',
  'friday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'saturday',
  'sunday',
  'sightseeing',
  'nearest',
  'station',
  'add',
  'go',
  'going',
  'four',
  'wheel',
  'driving',
  'track',
  'tracks',
  'wine',
  'wineries',
  'food',
  'trails',
  'snow',
  'concert',
  'concerts',
  'vivid',
  'local',
  'show',
  'is',
  'options',
  'option',
  'events',
  'event',
  'festivals',
  'festival',
  'wildlife',
  'national',
  'park',
  'parks',
  'camping',
  'kayaking',
  'beaches',
  'beach',
  'hiking',
  'fishing',
  'diving',
  'snorkelling',
  'snorkeling',
  'skiing',
  'walking',
  'scenic',
  'drive',
  'drives',
  'attraction',
  'attractions',
  'nightlife',
  'shopping',
  'wellness',
  'tours',
  'tour',
  'family',
  'accessible',
  'restaurants',
  'restaurant',
  'accommodation',
  'hotel',
  'hotels',
  'flights',
  'flight',
  'activities',
  'activity',
  'nearby',
  'discovery',
  'next',
  'car',
  'hire',
  // Additional capability / activity tokens that become place-shaped when
  // casing is normalised (Phase 21F). Keep destination from claiming them.
  'kayak',
  'gear',
  'road',
  'trip',
  'trips',
  'bushwalking',
  'seafood',
  'dive',
  'vineyard',
  'vineyards',
  'birdwatching',
  'nature',
  'reserve',
  'reserves',
  'kangaroo',
  'kangaroos',
  'remember',
  'this',
  'clear',
  'mobility',
  'access',
  // Phase 21I — fragments from "go ahead" / "go back" / "go now" must not
  // become destinations via missing-"to" cues.
  'ahead',
  'back',
  'now',
];

/** Multi-word bare phrases that must stay uninterpreted. */
const BARE_DESTINATION_PHRASE_FILLERS: readonly string[] = [
  'not sure',
  'surprise me',
  'somewhere warm',
  'what can you do',
  'help me',
  'hi aleya',
  'hello aleya',
];

function equalsIgnoreAsciiCase(left: string, right: string): boolean {
  if (left.length !== right.length) {
    return false;
  }
  for (let index = 0; index < left.length; index += 1) {
    let leftCode = left.charCodeAt(index);
    let rightCode = right.charCodeAt(index);
    if (leftCode >= 65 && leftCode <= 90) {
      leftCode += 32;
    }
    if (rightCode >= 65 && rightCode <= 90) {
      rightCode += 32;
    }
    if (leftCode !== rightCode) {
      return false;
    }
  }
  return true;
}

function isBareDestinationFiller(value: string): boolean {
  if (
    BARE_DESTINATION_PHRASE_FILLERS.some((filler) =>
      equalsIgnoreAsciiCase(value, filler),
    )
  ) {
    return true;
  }
  const words = value.split(/\s+/);
  return words.some((word) =>
    BARE_DESTINATION_FILLERS.some((filler) =>
      equalsIgnoreAsciiCase(word, filler),
    ),
  );
}

/**
 * Phase 21D / 21F / 21I — place-shape validation without a closed city list.
 *
 * Accepts one to three alphabetic place tokens (optional internal
 * hyphen/apostrophe), rejects filler / capability deny-list tokens, and emits
 * deterministic Title-Case. Used by the bare follow-up path and by Phase 21I
 * missing-"to" captures. Does not import an external place-lookup module
 * (conversation-core architecture boundary).
 */
function asValidatedTitleCasePlace(value: string): string | null {
  if (
    !/^[A-Za-z]+(?:['\-][A-Za-z]+)*(?:\s+[A-Za-z]+(?:['\-][A-Za-z]+)*){0,2}$/.test(
      value,
    )
  ) {
    return null;
  }
  if (isBareDestinationFiller(value)) {
    return null;
  }
  return toTitleCasePlace(value);
}

/**
 * Phase 21D / 21F — whole-message bare place when destination follow-up is active.
 *
 * Allows one to three alphabetic place tokens (optional internal
 * hyphen/apostrophe) so multi-word destinations such as "Gold Coast" /
 * "gold coast" work. Reuses normaliseCapturedDestination, then emits a
 * deterministic Title-Case display form (Phase 21F). Rejects conversational
 * fillers and capability tokens via the existing deny-lists. Missing-"to"
 * travel grammar is owned by Phase 21I explicit cues, not this bare path.
 */
function extractBareDestinationPlace(message: string): string | null {
  const text = edgeTrim(message);
  if (text.length === 0) {
    return null;
  }
  if (/\?/.test(text)) {
    return null;
  }
  if (/\d/.test(text)) {
    return null;
  }

  const destination = normaliseCapturedDestination(text);
  if (destination === null) {
    return null;
  }
  if (isRejectedRepairDestinationCapture(destination)) {
    return null;
  }

  // Whole-message bare: normalisation may only strip trailing punctuation.
  const punctStripped = edgeTrim(text.replace(/[.!?,;:]+$/g, ''));
  if (destination !== punctStripped) {
    return null;
  }

  return asValidatedTitleCasePlace(destination);
}

/**
 * Deterministic Title-Case for bare destination display (no String#toLowerCase).
 * Capitalises the first letter of each whitespace-separated token and each
 * segment after hyphen/apostrophe; lowercases other ASCII letters.
 */
function toTitleCasePlace(value: string): string {
  const words = value.split(/\s+/);
  const titled: string[] = [];
  for (const word of words) {
    titled.push(toTitleCaseToken(word));
  }
  return titled.join(' ');
}

function toTitleCaseToken(token: string): string {
  let result = '';
  let capitalizeNext = true;
  for (let index = 0; index < token.length; index += 1) {
    const code = token.charCodeAt(index);
    const char = token.charAt(index);
    if (char === '-' || char === "'") {
      result += char;
      capitalizeNext = true;
      continue;
    }
    if (capitalizeNext) {
      if (code >= 97 && code <= 122) {
        result += String.fromCharCode(code - 32);
      } else {
        result += char;
      }
      capitalizeNext = false;
      continue;
    }
    if (code >= 65 && code <= 90) {
      result += String.fromCharCode(code + 32);
    } else {
      result += char;
    }
  }
  return result;
}
