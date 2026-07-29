import { CompositeConversationStateExtractor } from './CompositeConversationStateExtractor';
import { EmptyConversationStateExtractor } from './emptyConversationStateExtractor';
import type { ConversationStateExtractor } from './types';

/**
 * Internal construction boundary for conversation-state extractors.
 *
 * Always returns a new CompositeConversationStateExtractor containing a new
 * EmptyConversationStateExtractor. No configuration, selection, caching, or
 * runtime wiring.
 */
export function createConversationStateExtractor(): ConversationStateExtractor {
  return new CompositeConversationStateExtractor([
    new EmptyConversationStateExtractor(),
  ]);
}
