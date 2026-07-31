import type { ConversationAcknowledgementEvent } from './conversationAcknowledgementEvent';

/**
 * Internal deterministic reply-plan object assembly.
 *
 * Phase 10M — owns only constructing the final ConversationReplyPlan from
 * already-selected response components. Does not select wording, evaluate
 * eligibility, or inspect conversation state.
 * Phase 16I — carries acknowledgementEvent from selection unchanged.
 */
export type ConversationReplyPlan = {
  acknowledgements: readonly string[];
  acknowledgementEvent: ConversationAcknowledgementEvent;
  followUpQuestion: string | null;
  messageInterpreted: boolean;
};

export type AssembleConversationReplyPlanInput = {
  acknowledgement: string | null;
  acknowledgementEvent: ConversationAcknowledgementEvent;
  followUpQuestion: string | null;
  continuationPrompt: string | null;
  messageInterpreted: boolean;
};

/**
 * Assemble the final reply-plan object from selected components.
 *
 * Rules:
 * - acknowledgement present → acknowledgements contains one item
 * - acknowledgement absent → acknowledgements is empty
 * - acknowledgementEvent is preserved exactly (null when no acknowledgement)
 * - followUpQuestion present → use followUpQuestion
 * - followUpQuestion absent → use continuationPrompt
 * - messageInterpreted is preserved unchanged
 */
export function assembleConversationReplyPlan(
  input: AssembleConversationReplyPlanInput,
): ConversationReplyPlan {
  return {
    acknowledgements:
      input.acknowledgement === null ? [] : [input.acknowledgement],
    acknowledgementEvent: input.acknowledgementEvent,
    followUpQuestion: input.followUpQuestion ?? input.continuationPrompt,
    messageInterpreted: input.messageInterpreted,
  };
}
