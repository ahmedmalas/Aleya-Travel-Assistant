import type { ConversationStateChangeClassification } from './classifyConversationStateChange';
import { selectConversationAcknowledgement } from './selectConversationAcknowledgement';
import { selectConversationContinuationPrompt } from './selectConversationContinuationPrompt';
import { selectConversationFollowUpQuestion } from './selectConversationFollowUpQuestion';
import { selectConversationMessageInterpreted } from './selectConversationMessageInterpreted';
import type { ConversationCoreState } from './types';

/**
 * Already-selected reply-plan components before object assembly.
 *
 * Phase 10N — produced only by selectConversationReplyComponents and
 * consumed by the reply planner when constructing the final plan object.
 */
export type ConversationReplyComponents = {
  acknowledgement: string | null;
  followUpQuestion: string | null;
  continuationPrompt: string | null;
  messageInterpreted: boolean;
};

export type SelectConversationReplyComponentsInput = {
  state: ConversationCoreState;
  classification: ConversationStateChangeClassification;
};

/**
 * Coordinate existing reply-component selectors for one turn.
 *
 * Phase 10N — owns only orchestration of:
 * selectConversationMessageInterpreted, selectConversationAcknowledgement,
 * selectConversationFollowUpQuestion, and selectConversationContinuationPrompt.
 * Does not classify changes, own wording/priority/suppression, construct the
 * final reply-plan object, render text, or mutate state.
 */
export function selectConversationReplyComponents(
  input: SelectConversationReplyComponentsInput,
): ConversationReplyComponents {
  const { state, classification } = input;
  const messageInterpreted =
    selectConversationMessageInterpreted(classification);
  const acknowledgement = selectConversationAcknowledgement(
    state,
    classification,
  );
  const followUpQuestion = messageInterpreted
    ? selectConversationFollowUpQuestion(state)
    : null;
  const continuationPrompt = selectConversationContinuationPrompt({
    followUpQuestion,
  });

  return {
    acknowledgement,
    followUpQuestion,
    continuationPrompt,
    messageInterpreted,
  };
}
