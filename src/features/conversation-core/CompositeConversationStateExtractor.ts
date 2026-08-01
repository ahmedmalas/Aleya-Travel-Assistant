import type {
  ConversationStateExtractionInput,
  ConversationStateExtractionResult,
  ConversationStateExtractor,
  ConversationStateUpdate,
} from './types';

/**
 * Internal deterministic composition boundary for conversation-state extractors.
 *
 * Merges explicit stateUpdate objects in extractor order. Later extractors win
 * for the same property. Does not apply updates to canonical state.
 */
export class CompositeConversationStateExtractor
  implements ConversationStateExtractor
{
  constructor(
    private readonly extractors: readonly ConversationStateExtractor[],
  ) {}

  extract(
    input: ConversationStateExtractionInput,
  ): ConversationStateExtractionResult {
    let accumulatedStateUpdate: ConversationStateUpdate = {};

    for (const extractor of this.extractors) {
      const result = extractor.extract(input);
      accumulatedStateUpdate = {
        ...accumulatedStateUpdate,
        ...result.stateUpdate,
      };
    }

    return {
      stateUpdate: accumulatedStateUpdate,
    };
  }
}
