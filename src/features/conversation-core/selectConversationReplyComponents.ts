import type { ConversationStateChangeClassification } from './classifyConversationStateChange';
import type { ConversationAcknowledgementEvent } from './conversationAcknowledgementEvent';
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
 * Phase 16I — acknowledgementEvent paired with acknowledgement text from
 * the same selector decision.
 */
export type ConversationReplyComponents = {
  acknowledgement: string | null;
  acknowledgementEvent: ConversationAcknowledgementEvent;
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
 * Phase 18B — follow-up selection always inspects final trip state; it is not
 * gated on messageInterpreted. Uninterpreted turns still receive the required
 * missing-field question (or the existing terminal neutral when complete).
 * Acknowledgement and messageInterpreted remain classification-driven.
 */
export function selectConversationReplyComponents(
  input: SelectConversationReplyComponentsInput,
): ConversationReplyComponents {
  const { state, classification } = input;
  const messageInterpreted =
    selectConversationMessageInterpreted(classification);
  const selected = selectConversationAcknowledgement(state, classification);
  const acknowledgement = selected?.text ?? null;
  const acknowledgementEvent = selected?.event ?? null;
  const followUpQuestion = selectConversationFollowUpQuestion(state);
  const continuationPrompt = selectConversationContinuationPrompt({
    followUpQuestion,
  });

  return {
    acknowledgement,
    acknowledgementEvent,
    followUpQuestion,
    continuationPrompt,
    messageInterpreted,
  };
}
