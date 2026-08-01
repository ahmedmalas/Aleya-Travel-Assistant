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
 * Internal shopping-requested extraction boundary.
 *
 * Phase 19B: recognises narrow, explicit shopping requests in the current
 * message. Deterministic and local — emits only true, never false or null, and
 * ignores prior conversation state.
 */
export class ShoppingRequestedConversationStateExtractor
  implements ConversationStateExtractor
{
  extract(
    input: ConversationStateExtractionInput,
  ): ConversationStateExtractionResult {
    return extractTrueRequestedCapability(input, SHOPPING_DEFINITION);
  }
}

const SERVICE = String.raw`(?:shopping|shops?|shopping\s+centres?|markets?|outlets?|places?\s+to\s+shop)`;

const SHOPPING_DEFINITION: TrueRequestedCapabilityDefinition = {
  field: 'shoppingRequested',
  serviceAlternation: SERVICE,
  enableCues: [
    new RegExp(
      String.raw`\b(?:book|find|search|need|want|include|add|show(?:\s+me)?|recommend)\s+(?:me\s+)?(?:a\s+|the\s+|some\s+)?${SERVICE}\b`,
      'i',
    ),
    new RegExp(
      String.raw`\bi\s+(?:need|want)\s+(?:a\s+|the\s+|some\s+)?(?:to\s+go\s+)?${SERVICE}\b`,
      'i',
    ),
    new RegExp(
      String.raw`\bwe\s+(?:need|want|would\s+like)\s+(?:a\s+|the\s+|some\s+)?${SERVICE}\b`,
      'i',
    ),
    /\bi\s+want\s+to\s+go\s+shopping\b/i,
    /\bgo\s+shopping\b/i,
    /\bshopping\b/i,
    /\bplaces?\s+to\s+shop\b/i,
  ],
  isDomainBlocked: (message) =>
    /\bshopping\s+for\s+(?:flights?|tickets?|airfare|hotels?|accommodation|cars?|car\s+hire)\b/i.test(
      message,
    ) ||
    /\b(?:grocery|groceries|window)\s+shopping\b/i.test(message),
};
