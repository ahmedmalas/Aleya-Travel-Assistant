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
 * Internal events-requested extraction boundary.
 *
 * Phase 19B: owns affirmative events-only requests (`eventsRequested`).
 * Festival-oriented wording remains on the festivals capability field
 * (`eventsFestivalsRequested`). Dual-model consolidation is deferred to
 * Phase 19C. Emits only true, never false or null, and ignores prior state.
 */
export class EventsRequestedConversationStateExtractor
  implements ConversationStateExtractor
{
  extract(
    input: ConversationStateExtractionInput,
  ): ConversationStateExtractionResult {
    return extractTrueRequestedCapability(input, EVENTS_DEFINITION);
  }
}

const SERVICE = String.raw`(?:events?|local\s+events?|upcoming\s+events?)`;

const EVENTS_DEFINITION: TrueRequestedCapabilityDefinition = {
  field: 'eventsRequested',
  serviceAlternation: SERVICE,
  enableCues: [
    new RegExp(
      String.raw`\b(?:book|find|search|need|want|include|add|show(?:\s+me)?|recommend)\s+(?:me\s+)?(?:a\s+|the\s+|some\s+)?(?:local\s+|upcoming\s+)?events?\b`,
      'i',
    ),
    new RegExp(
      String.raw`\b(?:i|we)\s+(?:need|want|would\s+like)\s+(?:a\s+|the\s+|some\s+)?(?:local\s+|upcoming\s+)?events?\b`,
      'i',
    ),
    /\bshow\s+me\s+local\s+events\b/i,
    /\blocal\s+events?\b/i,
    /\bupcoming\s+events?\b/i,
    /\bevents?\b/i,
  ],
  isDomainBlocked: (message) =>
    // Festival-oriented wording stays on the festivals extractor.
    /\bfestivals?\b/i.test(message) ||
    /\bevents?\s+and\s+festivals?\b/i.test(message) ||
    /\bfestivals?\s+and\s+events?\b/i.test(message) ||
    /\bwhat(?:'s|\s+is)\s+on\b/i.test(message) ||
    /\bthings\s+happening\b/i.test(message) ||
    /\bhappening\b/i.test(message) ||
    /\bsporting\s+events?\b/i.test(message),
};
