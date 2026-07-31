import type { ConversationReplyPlan } from '../assembleConversationReplyPlan';
import { renderConversationReplyPlan } from '../generateConversationReply';
import { renderBaselineAcknowledgementFollowUp } from '../renderBaselineAcknowledgementFollowUp';
import { transformBaselineAcknowledgement } from '../transformBaselineAcknowledgement';

/**
 * Expected production / baseline wording after Phase 15B–15C activation.
 *
 * Mirrors renderBaselineConversationalLayer branching without weakening
 * deterministic renderConversationReplyPlan assertions.
 */
export function expectedActivatedBaselineReply(
  plan: ConversationReplyPlan,
): string {
  if (
    plan.acknowledgements.length === 1 &&
    plan.followUpQuestion === null
  ) {
    return transformBaselineAcknowledgement(plan.acknowledgements[0]!);
  }
  if (
    plan.acknowledgements.length === 1 &&
    plan.followUpQuestion !== null
  ) {
    return renderBaselineAcknowledgementFollowUp({
      acknowledgement: plan.acknowledgements[0]!,
      followUpQuestion: plan.followUpQuestion,
    });
  }
  return renderConversationReplyPlan(plan);
}
