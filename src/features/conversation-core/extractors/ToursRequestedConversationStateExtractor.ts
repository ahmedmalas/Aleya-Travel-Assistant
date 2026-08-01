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
 * Internal tours-requested extraction boundary.
 *
 * Phase 19B: recognises narrow, explicit tours requests in the current message.
 * Deterministic and local — emits only true, never false or null, and ignores
 * prior conversation state.
 */
export class ToursRequestedConversationStateExtractor
  implements ConversationStateExtractor
{
  extract(
    input: ConversationStateExtractionInput,
  ): ConversationStateExtractionResult {
    return extractTrueRequestedCapability(input, TOURS_DEFINITION);
  }
}

const SERVICE = String.raw`(?:tours?|guided\s+tours?|day\s+tours?|sightseeing\s+tours?)`;

const TOURS_DEFINITION: TrueRequestedCapabilityDefinition = {
  field: 'toursRequested',
  serviceAlternation: SERVICE,
  enableCues: [
    new RegExp(
      String.raw`\b(?:book|find|search|need|want|include|add|show(?:\s+me)?|recommend)\s+(?:me\s+)?(?:a\s+|the\s+|some\s+)?${SERVICE}\b`,
      'i',
    ),
    new RegExp(
      String.raw`\bi\s+(?:need|want)\s+(?:a\s+|the\s+|some\s+)?${SERVICE}\b`,
      'i',
    ),
    new RegExp(
      String.raw`\bwe\s+(?:need|want|would\s+like)\s+(?:a\s+|the\s+|some\s+)?${SERVICE}\b`,
      'i',
    ),
    /\bguided\s+tours?\b/i,
    /\bday\s+tours?\b/i,
    /\bsightseeing\s+tours?\b/i,
    /\btours?\b/i,
  ],
  isDomainBlocked: (message) =>
    /\b(?:expensive|cheap|cost|price|priced)\b/i.test(message) ||
    /\btour\s+(?:operator|operators|bus|buses|guide|guides)\b/i.test(message) ||
    /\btourism\b/i.test(message) ||
    /\b(?:wine|food)\s+tours?\b/i.test(message),
};
