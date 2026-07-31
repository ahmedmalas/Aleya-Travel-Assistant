import type {
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
 * geographic validation, origin extraction, or currentState inspection.
 *
 * Phase 17B: adds explicit single-fact destination repair cues (meant /
 * Actually, Place / make that / change that / Not X, Y). Does not inspect
 * prior destination values; contrast repair selects only the new place.
 */
export class DestinationConversationStateExtractor
  implements ConversationStateExtractor
{
  extract(
    input: ConversationStateExtractionInput,
  ): ConversationStateExtractionResult {
    const destination = extractExplicitDestination(input.message);
    if (destination === null) {
      return {
        stateUpdate: {},
      };
    }
    return {
      stateUpdate: {
        destination: destination,
      },
    };
  }
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
 */
function hasExplicitDestinationCueAlongsideOrigin(message: string): boolean {
  return (
    /\b(?:go(?:ing)?|travel(?:l?ing)?|fly(?:ing)?|head(?:ing)?)\s+to\b/i.test(
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
  if (/\bleaving\b/i.test(message) || /\bdeparting\b/i.test(message)) {
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
 */
function isRejectedRepairDestinationCapture(value: string): boolean {
  if (/^(?:that|this|it|the|i|we|you|a|an)\b/i.test(value)) {
    return true;
  }
  if (
    /\b(?:adults?|children|kids?|infants?|bab(?:y|ies)|flights?|accommodation|hotel|should|need|sure|about)\b/i.test(
      value,
    )
  ) {
    return true;
  }
  if (
    /\b(?:one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+(?:adults?|children|kids?|infants?|bab(?:y|ies))\b/i.test(
      value,
    )
  ) {
    return true;
  }
  if (/^(?:keep|forget|do|don't|return|depart|leaving|departing)\b/i.test(value)) {
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
  return null;
}
