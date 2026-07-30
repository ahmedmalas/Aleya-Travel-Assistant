import {
  assembleConversationReplyPlan,
  type ConversationReplyPlan,
} from './assembleConversationReplyPlan';
import type { ConversationStateChangeClassification } from './classifyConversationStateChange';
import { selectConversationAcknowledgement } from './selectConversationAcknowledgement';
import { selectConversationContinuationPrompt } from './selectConversationContinuationPrompt';
import {
  NEUTRAL_TRIP_FALLBACK_REPLY,
  selectConversationFollowUpQuestion,
} from './selectConversationFollowUpQuestion';
import { selectConversationMessageInterpreted } from './selectConversationMessageInterpreted';
import type { ConversationCoreState } from './types';

export { NEUTRAL_TRIP_FALLBACK_REPLY };
export type { ConversationReplyPlan };

export type CreateConversationReplyPlanInput = {
  state: ConversationCoreState;
  classification: ConversationStateChangeClassification;
};

/**
 * Build a structured reply plan from final canonical state and the turn's
 * change classification.
 *
 * Phase 10G — consumed only by generateConversationReply. Phase 10H:
 * follow-up selection uses selectConversationFollowUpQuestion. Phase 10I:
 * acknowledgement selection uses selectConversationAcknowledgement.
 * Phase 10J: messageInterpreted uses selectConversationMessageInterpreted.
 * Phase 10K: reply wording comes from CONVERSATION_REPLY_CATALOGUE.
 * Phase 10L: continuation fallback uses selectConversationContinuationPrompt.
 * Phase 10M: final object construction uses assembleConversationReplyPlan.
 */
export function createConversationReplyPlan(
  input: CreateConversationReplyPlanInput,
): ConversationReplyPlan {
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

  return assembleConversationReplyPlan({
    acknowledgement,
    followUpQuestion,
    continuationPrompt,
    messageInterpreted,
  });
}
