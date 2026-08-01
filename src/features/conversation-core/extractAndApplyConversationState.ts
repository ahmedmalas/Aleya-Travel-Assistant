import { applyConversationStateUpdate } from './applyConversationStateUpdate';
import { extractConversationState } from './extractConversationState';
import type { ConversationCoreState } from './types';

/**
 * Local input contract for the internal extract-and-apply orchestration.
 *
 * Not part of the public conversation-core surface.
 */
export type ExtractAndApplyConversationStateInput = {
  message: string;
  currentState: ConversationCoreState;
};

/**
 * Internal orchestration: extract an explicit update, then apply it.
 *
 * Delegates through extractConversationState and applyConversationStateUpdate.
 * Not wired into the conversation processor or public index.
 */
export function extractAndApplyConversationState(
  input: ExtractAndApplyConversationStateInput,
): ConversationCoreState {
  const extractionResult = extractConversationState({
    message: input.message,
    currentState: input.currentState,
  });

  const travel = applyConversationStateUpdate(
    input.currentState,
    extractionResult.stateUpdate,
  );

  return {
    ...input.currentState,
    ...travel,
  };
}
