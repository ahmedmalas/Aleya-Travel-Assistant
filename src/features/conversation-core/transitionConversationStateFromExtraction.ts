import { applyConversationStateUpdate } from './applyConversationStateUpdate';
import { extractConversationState } from './extractConversationState';
import { hasConversationStateUpdateChanged } from './hasConversationStateUpdateChanged';
import type {
  ConversationCoreState,
  ConversationStateExtractionResult,
} from './types';

/**
 * Local input contract for the internal extract–detect–apply transition.
 *
 * Not part of the public conversation-core surface.
 */
export type TransitionConversationStateFromExtractionInput = {
  message: string;
  currentState: ConversationCoreState;
};

/**
 * Local result contract for the internal extract–detect–apply transition.
 *
 * Not part of the public conversation-core surface.
 */
export type TransitionConversationStateFromExtractionResult = {
  extractionResult: ConversationStateExtractionResult;
  hasStateChanged: boolean;
  nextState: ConversationCoreState;
};

/**
 * Internal transition orchestration: extract, detect change, then apply.
 *
 * Delegates through extractConversationState, hasConversationStateUpdateChanged,
 * and applyConversationStateUpdate. Not wired into the conversation processor
 * or public index.
 */
export function transitionConversationStateFromExtraction(
  input: TransitionConversationStateFromExtractionInput,
): TransitionConversationStateFromExtractionResult {
  const extractionResult = extractConversationState({
    message: input.message,
    currentState: input.currentState,
  });

  const hasStateChanged = hasConversationStateUpdateChanged(
    input.currentState,
    extractionResult.stateUpdate,
  );

  const travel = applyConversationStateUpdate(
    input.currentState,
    extractionResult.stateUpdate,
  );

  const nextState: ConversationCoreState = {
    ...input.currentState,
    ...travel,
  };

  return {
    extractionResult,
    hasStateChanged,
    nextState,
  };
}
