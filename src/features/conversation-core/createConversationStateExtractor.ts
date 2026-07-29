import { CompositeConversationStateExtractor } from './CompositeConversationStateExtractor';
import { DepartureDateConversationStateExtractor } from './DepartureDateConversationStateExtractor';
import { DestinationConversationStateExtractor } from './DestinationConversationStateExtractor';
import { EmptyConversationStateExtractor } from './emptyConversationStateExtractor';
import { OriginConversationStateExtractor } from './OriginConversationStateExtractor';
import type { ConversationStateExtractor } from './types';

/**
 * Internal construction boundary for conversation-state extractors.
 *
 * Always returns a new CompositeConversationStateExtractor containing a new
 * DestinationConversationStateExtractor, then a new
 * OriginConversationStateExtractor, then a new
 * DepartureDateConversationStateExtractor, then a new
 * EmptyConversationStateExtractor. No configuration, selection, caching, or
 * runtime wiring.
 */
export function createConversationStateExtractor(): ConversationStateExtractor {
  return new CompositeConversationStateExtractor([
    new DestinationConversationStateExtractor(),
    new OriginConversationStateExtractor(),
    new DepartureDateConversationStateExtractor(),
    new EmptyConversationStateExtractor(),
  ]);
}
