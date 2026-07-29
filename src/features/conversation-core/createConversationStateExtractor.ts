import { CompositeConversationStateExtractor } from './CompositeConversationStateExtractor';
import { DestinationConversationStateExtractor } from './DestinationConversationStateExtractor';
import { EmptyConversationStateExtractor } from './emptyConversationStateExtractor';
import type { ConversationStateExtractor } from './types';

/**
 * Internal construction boundary for conversation-state extractors.
 *
 * Always returns a new CompositeConversationStateExtractor containing a new
 * DestinationConversationStateExtractor followed by a new
 * EmptyConversationStateExtractor. No configuration, selection, caching, or
 * runtime wiring.
 */
export function createConversationStateExtractor(): ConversationStateExtractor {
  return new CompositeConversationStateExtractor([
    new DestinationConversationStateExtractor(),
    new EmptyConversationStateExtractor(),
  ]);
}
