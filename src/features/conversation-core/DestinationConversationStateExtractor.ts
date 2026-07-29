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
    /\bchange\s+(?:it|(?:my\s+)?destination)\s+to\b/i.test(message) ||
    /\b(?:actually\s+)?make\s+it\b/i.test(message) ||
    /\bswitch\s+it\s+to\b/i.test(message)
  );
}

/**
 * Messages that must not yield a destination in this phase — vague discovery,
 * recommendations, origin/accommodation locality, negation, or preservation.
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
  // present (Phase 7A.1 route forms).
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
  if (/\bnot\b/i.test(message)) {
    return true;
  }
  return false;
}

const EXPLICIT_DESTINATION_CUES: readonly RegExp[] = [
  /\bchange\s+it\s+to\s+(.+)$/i,
  /\bchange\s+(?:my\s+)?destination\s+to\s+(.+)$/i,
  /\bmake\s+it\s+(.+?)\s+instead\b/i,
  /\bactually\s+make\s+it\s+(.+)$/i,
  /\bswitch\s+it\s+to\s+(.+)$/i,
  /\bdestination\s+is\s+(.+)$/i,
  // Phase 7A.1: fly/travel from <origin> to <destination>
  /\b(?:fly(?:ing)?|travel(?:l?ing)?)\s+from\s+.+?\s+to\s+(.+)$/i,
  /\b(?:(?:i\s+want\s+to|we(?:'re|\s+are))\s+)?(?:go(?:ing)?|travel(?:l?ing)?|fly(?:ing)?|head(?:ing)?)\s+to\s+(.+)$/i,
  /\btake\s+me\s+to\s+(.+)$/i,
  /\bvisit(?:ing)?\s+(.+)$/i,
];

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

function extractExplicitDestination(message: string): string | null {
  const text = edgeTrim(message);
  if (text.length === 0) {
    return null;
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
    if (destination !== null) {
      return destination;
    }
  }
  return null;
}
