import type {
  ConversationStateExtractionInput,
  ConversationStateExtractionResult,
  ConversationStateExtractor,
} from '../types';
import {
  extractTrueRequestedCapability,
  type TrueRequestedCapabilityDefinition,
} from './trueRequestedCapabilityExtraction';

/**
 * Internal family-activities-requested extraction boundary.
 *
 * Phase 19B: recognises narrow, explicit family-activity requests in the
 * current message. Deterministic and local — emits only true, never false or
 * null, and ignores prior conversation state.
 */
export class FamilyActivitiesRequestedConversationStateExtractor
  implements ConversationStateExtractor
{
  extract(
    input: ConversationStateExtractionInput,
  ): ConversationStateExtractionResult {
    return extractTrueRequestedCapability(input, FAMILY_DEFINITION);
  }
}

const SERVICE = String.raw`(?:family\s+activities|family[\s-]?friendly\s+activities|things\s+to\s+do\s+with\s+(?:kids?|children)|kid[\s-]?friendly\s+activities|activities\s+for\s+(?:kids?|children)|children'?s?\s+attractions?)`;

const FAMILY_DEFINITION: TrueRequestedCapabilityDefinition = {
  field: 'familyActivitiesRequested',
  serviceAlternation: SERVICE,
  enableCues: [
    new RegExp(
      String.raw`\b(?:book|find|search|need|want|include|add|show(?:\s+me)?|recommend)\s+(?:me\s+)?(?:a\s+|the\s+|some\s+)?${SERVICE}\b`,
      'i',
    ),
    new RegExp(
      String.raw`\b(?:i|we)\s+(?:need|want|would\s+like)\s+(?:a\s+|the\s+|some\s+)?${SERVICE}\b`,
      'i',
    ),
    /\bfamily\s+activities\b/i,
    /\bfamily[\s-]?friendly\s+activities\b/i,
    /\bthings\s+to\s+do\s+with\s+(?:kids?|children)\b/i,
    /\bkid[\s-]?friendly\s+activities\b/i,
    /\bactivities\s+for\s+(?:kids?|children)\b/i,
    /\bchildren'?s?\s+attractions?\b/i,
  ],
  isDomainBlocked: (message) =>
    /\bfamily\s+trip\b/i.test(message) ||
    /\bthis\s+is\s+a\s+family\b/i.test(message) ||
    /\bfamily\s+(?:room|rooms|suite|suites|hotel|hotels|accommodation)\b/i.test(
      message,
    ) ||
    (/\bfamily[\s-]?friendly\b/i.test(message) &&
      !/\bfamily[\s-]?friendly\s+activities\b/i.test(message) &&
      !/\bfamily\s+activities\b/i.test(message)),
};
