import type {
  ConversationStateExtractionInput,
  ConversationStateExtractionResult,
  ConversationStateExtractor,
} from '../types';

/**
 * Internal fishing-requested extraction boundary.
 *
 * Behaviourally empty in this phase — ignores all input and always returns a
 * new empty explicit state update. Not wired as a public runtime API.
 */
export class FishingRequestedConversationStateExtractor
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
