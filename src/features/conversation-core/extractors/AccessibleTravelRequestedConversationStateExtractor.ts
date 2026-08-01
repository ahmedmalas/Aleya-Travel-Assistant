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
 * Internal accessible-travel-requested extraction boundary.
 *
 * Phase 19B: recognises narrow, explicit accessible-travel requests in the
 * current message. Deterministic and local — emits only true, never false or
 * null, and ignores prior conversation state.
 */
export class AccessibleTravelRequestedConversationStateExtractor
  implements ConversationStateExtractor
{
  extract(
    input: ConversationStateExtractionInput,
  ): ConversationStateExtractionResult {
    return extractTrueRequestedCapability(input, ACCESSIBLE_DEFINITION);
  }
}

const SERVICE = String.raw`(?:accessible\s+travel(?:\s+options?)?|wheelchair[\s-]?accessible(?:\s+activities)?|mobility\s+access|step[\s-]?free(?:\s+access)?|accessible\s+accommodation|disability\s+access|accessible\s+activities)`;

const ACCESSIBLE_DEFINITION: TrueRequestedCapabilityDefinition = {
  field: 'accessibleTravelRequested',
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
    /\baccessible\s+travel(?:\s+options?)?\b/i,
    /\bwheelchair[\s-]?accessible(?:\s+activities)?\b/i,
    /\bmobility\s+access\b/i,
    /\bstep[\s-]?free(?:\s+access)?\b/i,
    /\baccessible\s+accommodation\b/i,
    /\bdisability\s+access\b/i,
    /\baccessible\s+activities\b/i,
  ],
  isDomainBlocked: (message) =>
    /\baccessible\s+rooms?\b/i.test(message) ||
    /\bare\s+accessible\b/i.test(message) ||
    /\baccessible\s+parking\b/i.test(message),
};
