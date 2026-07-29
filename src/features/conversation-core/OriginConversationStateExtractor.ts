import type {
  ConversationStateExtractionInput,
  ConversationStateExtractionResult,
  ConversationStateExtractor,
} from './types';

/**
 * Internal origin-field extraction boundary.
 *
 * Behaviourally empty in this phase — ignores all input and always returns a
 * new empty explicit state update. Not wired as a public runtime API.
 */
export class OriginConversationStateExtractor
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
