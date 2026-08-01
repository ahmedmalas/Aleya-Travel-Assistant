import type {
  ConversationStateExtractionInput,
  ConversationStateExtractionResult,
  ConversationStateUpdate,
} from '../types';

/**
 * Shared Phase 19B helper for true-only requested-capability extractors.
 *
 * Matches established capability architecture: emit only `true`, never false or
 * null; ignore prior conversation state; block questions / removals / negations
 * with conservative domain false-positive guards.
 */

/** Trim edges without String.prototype.trim (architecture boundary). */
export function edgeTrim(value: string): string {
  return value.replace(/^\s+|\s+$/g, '');
}

export type TrueRequestedCapabilityField = Extract<
  keyof ConversationStateUpdate,
  | 'nightlifeRequested'
  | 'shoppingRequested'
  | 'wellnessRequested'
  | 'toursRequested'
  | 'familyActivitiesRequested'
  | 'accessibleTravelRequested'
>;

export type TrueRequestedCapabilityDefinition = {
  field: TrueRequestedCapabilityField;
  /** Alternation used in standard no/without blocks. */
  serviceAlternation: string;
  enableCues: readonly RegExp[];
  /** Domain-specific false positives beyond the standard block taxonomy. */
  isDomainBlocked: (message: string) => boolean;
};

export function isStandardCapabilityRequestBlocked(
  message: string,
  serviceAlternation: string,
): boolean {
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
      String.raw`\bno\s+(?:a\s+|the\s+|some\s+)?(?:${serviceAlternation})\b`,
      'i',
    ).test(message) ||
    new RegExp(
      String.raw`\bwithout\s+(?:a\s+|the\s+|some\s+)?(?:${serviceAlternation})\b`,
      'i',
    ).test(message) ||
    /\bwe\s+do\s+not\s+need\b/i.test(message) ||
    /\bnot\b/i.test(message)
  ) {
    return true;
  }
  return false;
}

export function extractTrueRequestedCapability(
  input: ConversationStateExtractionInput,
  definition: TrueRequestedCapabilityDefinition,
): ConversationStateExtractionResult {
  const text = edgeTrim(input.message);
  if (text.length === 0) {
    return { stateUpdate: {} };
  }
  if (isStandardCapabilityRequestBlocked(text, definition.serviceAlternation)) {
    return { stateUpdate: {} };
  }
  if (definition.isDomainBlocked(text)) {
    return { stateUpdate: {} };
  }
  for (const cue of definition.enableCues) {
    if (cue.test(text)) {
      return {
        stateUpdate: {
          [definition.field]: true,
        },
      };
    }
  }
  return { stateUpdate: {} };
}
