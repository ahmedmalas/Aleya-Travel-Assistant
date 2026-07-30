import {
  assembleConversationReplyPlan,
  type ConversationReplyPlan,
} from './assembleConversationReplyPlan';
import type { ConversationStateChangeClassification } from './classifyConversationStateChange';
import { NEUTRAL_TRIP_FALLBACK_REPLY } from './selectConversationFollowUpQuestion';
import { selectConversationReplyComponents } from './selectConversationReplyComponents';
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
 * Phase 10N: selector coordination uses selectConversationReplyComponents.
 */
export function createConversationReplyPlan(
  input: CreateConversationReplyPlanInput,
): ConversationReplyPlan {
  const components = selectConversationReplyComponents(input);
  return assembleConversationReplyPlan(components);
}
