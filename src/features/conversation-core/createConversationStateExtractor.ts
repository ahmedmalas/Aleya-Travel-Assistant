import { EmptyConversationStateExtractor } from './emptyConversationStateExtractor';
import type { ConversationStateExtractor } from './types';

/**
 * Internal construction boundary for conversation-state extractors.
 *
 * Always returns a new EmptyConversationStateExtractor. No configuration,
 * selection, caching, or runtime wiring.
 */
export function createConversationStateExtractor(): ConversationStateExtractor {
  return new EmptyConversationStateExtractor();
}
