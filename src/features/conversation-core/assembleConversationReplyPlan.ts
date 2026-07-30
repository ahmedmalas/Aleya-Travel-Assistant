/**
 * Internal deterministic reply-plan object assembly.
 *
 * Phase 10M — owns only constructing the final ConversationReplyPlan from
 * already-selected response components. Does not select wording, evaluate
 * eligibility, or inspect conversation state.
 */
export type ConversationReplyPlan = {
  acknowledgements: readonly string[];
  followUpQuestion: string | null;
  messageInterpreted: boolean;
};

export type AssembleConversationReplyPlanInput = {
  acknowledgement: string | null;
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
    followUpQuestion: input.followUpQuestion ?? input.continuationPrompt,
    messageInterpreted: input.messageInterpreted,
  };
}
