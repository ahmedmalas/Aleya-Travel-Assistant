import type { ConversationStateChangeClassification } from './classifyConversationStateChange';
import { selectConversationAcknowledgement } from './selectConversationAcknowledgement';
import {
  NEUTRAL_TRIP_FALLBACK_REPLY,
  selectConversationFollowUpQuestion,
} from './selectConversationFollowUpQuestion';
import { selectConversationMessageInterpreted } from './selectConversationMessageInterpreted';
import type { ConversationCoreState } from './types';

export { NEUTRAL_TRIP_FALLBACK_REPLY };

/**
 * Internal deterministic reply plan produced before reply text is rendered.
 *
 * Phase 10G — consumed only by generateConversationReply. Contains at most
 * one acknowledgement string and at most one follow-up question. Phase 10H:
 * follow-up selection is delegated to selectConversationFollowUpQuestion.
 * Phase 10I: acknowledgement selection is delegated to
 * selectConversationAcknowledgement. Phase 10J: messageInterpreted is
 * delegated to selectConversationMessageInterpreted.
 */
export type ConversationReplyPlan = {
  acknowledgements: readonly string[];
  followUpQuestion: string | null;
  messageInterpreted: boolean;
};

export type CreateConversationReplyPlanInput = {
  state: ConversationCoreState;
  classification: ConversationStateChangeClassification;
};

/**
 * Build a structured reply plan from final canonical state and the turn's
 * change classification. Acknowledgement selection is owned by
 * selectConversationAcknowledgement; follow-up selection is owned by
 * selectConversationFollowUpQuestion; messageInterpreted is owned by
 * selectConversationMessageInterpreted.
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

  if (!messageInterpreted) {
    return {
      acknowledgements: [],
      followUpQuestion: NEUTRAL_TRIP_FALLBACK_REPLY,
      messageInterpreted: false,
    };
  }

  return {
    acknowledgements: acknowledgement === null ? [] : [acknowledgement],
    followUpQuestion: selectConversationFollowUpQuestion(state),
    messageInterpreted: true,
  };
}
