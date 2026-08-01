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
 * Internal wellness-requested extraction boundary.
 *
 * Phase 19B: recognises narrow, explicit wellness/spa requests in the current
 * message. Deterministic and local — emits only true, never false or null, and
 * ignores prior conversation state.
 */
export class WellnessRequestedConversationStateExtractor
  implements ConversationStateExtractor
{
  extract(
    input: ConversationStateExtractionInput,
  ): ConversationStateExtractionResult {
    return extractTrueRequestedCapability(input, WELLNESS_DEFINITION);
  }
}

const SERVICE = String.raw`(?:wellness(?:\s+activities)?|spa(?:\s+and\s+wellness(?:\s+options?)?)?|massage|retreats?|relaxation|health\s+resorts?)`;

const WELLNESS_DEFINITION: TrueRequestedCapabilityDefinition = {
  field: 'wellnessRequested',
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
    /\bspa\s+and\s+wellness(?:\s+options?)?\b/i,
    /\bwellness(?:\s+activities)?\b/i,
    /\bspa\b/i,
  ],
  isDomainBlocked: (message) =>
    /\b(?:hotel|hotels|stay|stays|accommodation|room|rooms)\s+(?:offers?|has|have|with)\s+(?:a\s+)?(?:wellness|spa)\b/i.test(
      message,
    ) ||
    /\b(?:wellness|spa)\s+facilities\b/i.test(message) ||
    /\bthe\s+hotel\s+offers\s+wellness\b/i.test(message),
};
