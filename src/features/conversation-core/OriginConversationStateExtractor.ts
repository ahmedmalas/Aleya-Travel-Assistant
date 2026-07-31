import type {
  ConversationStateExtractionInput,
  ConversationStateExtractionResult,
  ConversationStateExtractor,
} from './types';

/**
 * Internal origin-field extraction boundary.
 *
 * Phase 7B / Phase 8B: recognises only narrow, explicit origin statements in
 * the current message. Deterministic and local — no external lookup,
 * geographic validation, destination extraction, or currentState inspection.
 *
 * Phase 17C: adds explicit origin-cued repair forms (meant from / Actually,
 * from / make that from / change origin|departure location / from … instead).
 * Bare-place repairs remain destination-owned (Phase 17B).
 */
export class OriginConversationStateExtractor
  implements ConversationStateExtractor
{
  extract(
    input: ConversationStateExtractionInput,
  ): ConversationStateExtractionResult {
    const origin = extractExplicitOrigin(input.message);
    if (origin === null) {
      return {
        stateUpdate: {},
      };
    }
    return {
      stateUpdate: {
        origin: origin,
      },
    };
  }
}

/** Trim edges without String.prototype.trim (architecture boundary). */
function edgeTrim(value: string): string {
  return value.replace(/^\s+|\s+$/g, '');
}

/**
 * Non-travel or unsafe “from” uses, negation, and preservation that must not
 * yield an origin update in this phase.
 */
function isBlockedOriginMessage(message: string): boolean {
  if (/\?/.test(message)) {
    return true;
  }
  if (
    /\b(?:hotel|flights?|prices?|available|open)\s+from\b/i.test(message) ||
    /\bfrom\s+A\$/i.test(message) ||
    /\bfrom\s+\d/i.test(message) ||
    /\b(?:hours?|kilometres?|kilometers?|km|miles?)\s+from\b/i.test(message) ||
    /\b(?:recommendations?|message|confirmation)\s+from\b/i.test(message) ||
    /\bbooking\s+confirmation\s+from\b/i.test(message) ||
    /\bfar\s+from\b/i.test(message) ||
    /\bfrom\s+(?:memory|experience)\b/i.test(message)
  ) {
    return true;
  }
  if (/\breturn\s+from\b/i.test(message)) {
    return true;
  }
  if (/\bkeep\b/i.test(message)) {
    return true;
  }
  if (/\bforget\b/i.test(message)) {
    return true;
  }
  if (
    /\b(?:do\s+not|don't)\s+(?:depart\s+from|leave\s+from|change|make\s+(?:the\s+)?origin)\b/i.test(
      message,
    )
  ) {
    return true;
  }
  if (/\bnot\s+(?:from|leaving\s+from|departing\s+from)\b/i.test(message)) {
    return true;
  }
  if (/\bi(?:\s+am|'m)\s+not\s+from\b/i.test(message)) {
    return true;
  }
  if (/\bnot\b/i.test(message)) {
    return true;
  }
  return false;
}

/**
 * Phase 17C — reject repair captures that are passenger counts, dates,
 * pronouns, or non-origin tokens.
 */
function isRejectedRepairOriginCapture(value: string): boolean {
  if (/^(?:that|this|it|the|i|we|you|a|an|from)\b/i.test(value)) {
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

/** Phase 17C explicit origin-repair cues (tried before general origin cues). */
const ORIGIN_REPAIR_CUES: readonly RegExp[] = [
  /\b(?:sorry[,.]?\s+)?i\s+meant\s+from\s+(.+)$/i,
  /\bactually[,]\s+from\s+(.+)$/i,
  /\bno[,.]?\s+make\s+that\s+from\s+(.+)$/i,
  /\bchange\s+that\s+to\s+departing\s+from\s+(.+)$/i,
  /\bchange\s+(?:the\s+)?origin\s+to\s+(.+)$/i,
  /\bchange\s+(?:the\s+)?departure\s+location\s+to\s+(.+)$/i,
  /\bfrom\s+(.+?)\s+instead\b/i,
  /\bdeparting\s+from\s+(.+?)\s+instead\b/i,
];

const EXPLICIT_ORIGIN_CUES: readonly RegExp[] = [
  ...ORIGIN_REPAIR_CUES,
  /\bmy\s+origin\s+is\s+(.+)$/i,
  /\borigin\s+is\s+(.+)$/i,
  /\bi(?:\s+am|'m)\s+coming\s+from\s+(.+)$/i,
  /\bi(?:\s+am|'m)\s+from\s+(.+)$/i,
  /\b(?:we\s+are\s+)?(?:fly(?:ing)?|travel(?:l?ing)?|depart(?:ing)?|leav(?:e|ing)|start(?:ing)?|coming)\s+from\s+(.+)$/i,
  /\bfrom\s+(.+)$/i,
];

function isOriginRepairCue(cue: RegExp): boolean {
  return ORIGIN_REPAIR_CUES.some(
    (repairCue) =>
      repairCue.source === cue.source && repairCue.flags === cue.flags,
  );
}

function normaliseCapturedOrigin(raw: string): string | null {
  let value = edgeTrim(raw);
  // Stop before a destination clause on the same turn.
  value = value.replace(
    /,?\s+i\s+(?:want|need|would\s+like)\s+to\s+(?:go(?:ing)?|travel(?:l?ing)?|fly(?:ing)?|head(?:ing)?|visit(?:ing)?)\s+to\b.*$/i,
    '',
  );
  value = value.replace(
    /,?\s+(?:go(?:ing)?|travel(?:l?ing)?|fly(?:ing)?|head(?:ing)?|visit(?:ing)?|take\s+me)\s+to\b.*$/i,
    '',
  );
  value = value.replace(
    /\s+and\s+(?:fly(?:ing)?|go(?:ing)?|travel(?:l?ing)?|head(?:ing)?)\b.*$/i,
    '',
  );
  value = value.replace(/\s+to\b.*$/i, '');
  value = value.replace(/\s+instead(?:\s+of\b.*)?$/i, '');
  value = value.replace(/\s+for\b.*$/i, '');
  value = value.replace(/\s+with\b.*$/i, '');
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
  // Reject leftover clause fragments that are not place names.
  if (/\bi\s+(?:want|need|would)\b/i.test(value)) {
    return null;
  }
  return value;
}

function extractExplicitOrigin(message: string): string | null {
  const text = edgeTrim(message);
  if (text.length === 0) {
    return null;
  }
  if (isBlockedOriginMessage(text)) {
    return null;
  }
  for (const cue of EXPLICIT_ORIGIN_CUES) {
    const match = text.match(cue);
    const captured = match?.[1];
    if (typeof captured !== 'string') {
      continue;
    }
    const origin = normaliseCapturedOrigin(captured);
    if (origin === null) {
      continue;
    }
    if (isOriginRepairCue(cue) && isRejectedRepairOriginCapture(origin)) {
      continue;
    }
    return origin;
  }
  return null;
}
