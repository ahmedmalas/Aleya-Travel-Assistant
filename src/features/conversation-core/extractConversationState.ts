import { createConversationStateExtractor } from './createConversationStateExtractor';
import type {
  ConversationStateExtractionInput,
  ConversationStateExtractionResult,
} from './types';

/**
 * Internal extraction execution path.
 *
 * Delegates through createConversationStateExtractor → extract(input).
 * Not wired into the conversation processor or public index.
 */
export function extractConversationState(
  input: ConversationStateExtractionInput,
): ConversationStateExtractionResult {
  const extractor = createConversationStateExtractor();

  return extractor.extract(input);
}
