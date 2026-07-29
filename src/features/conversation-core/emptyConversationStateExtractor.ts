import type {
  ConversationStateExtractionInput,
  ConversationStateExtractionResult,
  ConversationStateExtractor,
} from './types';

/**
 * Internal deterministic extractor used to establish the implementation boundary.
 *
 * It intentionally ignores all input and always returns a new empty explicit
 * state update. It is not wired into the conversation runtime.
 */
export class EmptyConversationStateExtractor
  implements ConversationStateExtractor
{
  extract(
    _input: ConversationStateExtractionInput,
  ): ConversationStateExtractionResult {
    return {
      stateUpdate: {},
    };
  }
}
