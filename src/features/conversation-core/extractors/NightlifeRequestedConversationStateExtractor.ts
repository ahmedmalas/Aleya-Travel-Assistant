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
 * Internal nightlife-requested extraction boundary.
 *
 * Phase 19B: recognises narrow, explicit nightlife requests in the current
 * message. Deterministic and local — emits only true, never false or null, and
 * ignores prior conversation state.
 */
export class NightlifeRequestedConversationStateExtractor
  implements ConversationStateExtractor
{
  extract(
    input: ConversationStateExtractionInput,
  ): ConversationStateExtractionResult {
    return extractTrueRequestedCapability(input, NIGHTLIFE_DEFINITION);
  }
}

const SERVICE = String.raw`(?:nightlife|bars?(?:\s+and\s+clubs?)?|clubs?|nightclubs?|late[\s-]?night\s+venues?)`;

const NIGHTLIFE_DEFINITION: TrueRequestedCapabilityDefinition = {
  field: 'nightlifeRequested',
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
    /\bnightlife\b/i,
    /\bbars?\s+and\s+clubs?\b/i,
    /\bnightclubs?\b/i,
    /\blate[\s-]?night\s+venues?\b/i,
  ],
  isDomainBlocked: (message) =>
    /\b(?:safe|safety|dangerous|unsafe|crime)\b/i.test(message) ||
    /\bis\s+the\s+nightlife\b/i.test(message),
};
