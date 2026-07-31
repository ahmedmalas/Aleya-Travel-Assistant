import type { ConversationReplyPlan } from '../assembleConversationReplyPlan';
import { renderConversationReplyPlan } from '../generateConversationReply';
import { renderBaselineAcknowledgementFollowUp } from '../renderBaselineAcknowledgementFollowUp';
import { renderBaselineAcknowledgementNeutralContinuation } from '../renderBaselineAcknowledgementNeutralContinuation';
import { renderBaselineFollowUpOnly } from '../renderBaselineFollowUpOnly';
import {
  CANONICAL_NEUTRAL_CONTINUATION_PROMPT,
  renderBaselineNeutralContinuation,
} from '../renderBaselineNeutralContinuation';
import { transformBaselineAcknowledgement } from '../transformBaselineAcknowledgement';

/**
 * Expected production / baseline wording after Phase 15B–16B activation.
 *
 * Mirrors renderBaselineConversationalLayer branching without weakening
 * deterministic renderConversationReplyPlan assertions.
 */
export function expectedActivatedBaselineReply(
  plan: ConversationReplyPlan,
): string {
  if (
    plan.acknowledgements.length === 1 &&
    plan.followUpQuestion === CANONICAL_NEUTRAL_CONTINUATION_PROMPT
  ) {
    return renderBaselineAcknowledgementNeutralContinuation({
      acknowledgement: plan.acknowledgements[0]!,
      followUpQuestion: plan.followUpQuestion,
    });
  }
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
  if (
    plan.acknowledgements.length === 0 &&
    plan.followUpQuestion === CANONICAL_NEUTRAL_CONTINUATION_PROMPT
  ) {
    return renderBaselineNeutralContinuation({
      followUpQuestion: plan.followUpQuestion,
    });
  }
  if (
    plan.acknowledgements.length === 0 &&
    plan.followUpQuestion !== null
  ) {
    return renderBaselineFollowUpOnly({
      followUpQuestion: plan.followUpQuestion,
    });
  }
  return renderConversationReplyPlan(plan);
}
