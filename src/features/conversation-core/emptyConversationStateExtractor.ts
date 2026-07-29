import type {
  ConversationStateExtractionInput,
  ConversationStateExtractionResult,
  ConversationStateExtractor,
} from './types';

/**
 * Internal intentional no-op extraction boundary.
 *
 * Phase 7AB: finalised as the last production composite extractor. Deterministic
 * and local — ignores all input and always returns a new empty explicit state
 * update. Emits no canonical fields and never true, false, or null. Not a
 * public runtime API.
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
